import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { applyPick, pickMessage } from '../../core/game/pick';
import {
  HandCard, RARITY_LABEL, fortuneLabel, pityAfterRoll, pityBeforeRoll, readFortune, rollHand,
} from '../../core/game/roll';
import { SeenTraits } from '../../core/game/seen-traits.service';
import { getShimmyfulDef } from '../../core/game/stats';
import { TRAITS } from '../../core/game/traits-data';

/** Rank used by auto-roll to decide whether a hand is worth stopping on. */
const AR_RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4, hexxed: 99, duality: 99, determined: 99 };
const SHIMMY_MARK: Record<string, string> = { legendary: '★', mythic: '✦', epic: '✦', rare: '✦', common: '✦' };
const REVEAL_AT = [1400, 1950, 2500];
const CLASSIC = /^Classic$/i;

interface CardView {
  rolling: boolean;
  rarity: string;
  name: string;
  desc: string;
  shimmy: string | null;
  flash: boolean;
  notable: boolean;
}

interface FormRow { idx: number; name: string; traits: string; inherits: boolean }

/**
 * The trait roll: optional form chooser, the dealing animation, the hand of
 * three, pity, REROLL and AUTO roll. Ported from the old rollTraits /
 * rollTraitsFor / pickTraitFromHand / closeTraitRoll flow.
 */
@Component({
  selector: 'ss-roll-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancel()' },
  templateUrl: './roll-overlay.html',
  styleUrl: './roll-overlay.scss',
})
export class RollOverlay implements OnInit, OnDestroy {
  private readonly store = inject(CharacterStore);
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);
  private readonly seen = inject(SeenTraits);

  readonly character = input.required<Character>();
  readonly closed = output<void>();

  protected readonly choosing = signal(false);
  protected readonly title = signal('DRAWING YOUR HAND...');
  protected readonly sub = signal(' ');
  protected readonly cards = signal<CardView[]>([]);
  protected readonly pity = signal(0);
  protected readonly interactive = signal(false);
  protected readonly dealing = signal(false);
  protected readonly autoMode = signal(false);
  protected readonly stopRarity = signal<'rare' | 'epic' | 'legendary' | 'mythic'>('legendary');
  protected readonly stopShimmy = signal(true);
  protected readonly stopOptions = ['rare', 'epic', 'legendary', 'mythic'] as const;

  protected readonly formRows = computed<FormRow[]>(() => {
    const c = this.character();
    const forms = c.altForms || [];
    const label = (keys: string[]) => keys.length ? keys.map(k => TRAITS[k]?.name || k).join(', ') : 'no traits';
    return [
      { idx: 0, name: CLASSIC.test(c.name || '') ? 'GHOST' : 'BASE', traits: label(c.traits || []), inherits: false },
      ...forms.map((f, i) => {
        // ask the form itself whether it owns a list; otherwise it inherits the base
        const own = Array.isArray(f.traits);
        return { idx: i + 1, name: f.name || `FORM ${i + 1}`, traits: label(own ? f.traits! : (c.traits || [])), inherits: !own };
      }),
    ];
  });
  protected readonly activeForm = computed(() => this.character().activeFormIdx || 0);

  private formIdx = 0;
  private hand: HandCard[] | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private intervals: ReturnType<typeof setInterval>[] = [];

  ngOnInit(): void {
    this.pity.set(clampPity(this.character().pity));
    if ((this.character().altForms || []).length) {
      this.choosing.set(true);
      this.sound.play('characterclick', { volume: 0.5 });
    } else {
      this.roll(0);
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  protected chooseForm(idx: number): void {
    this.choosing.set(false);
    this.roll(idx);
  }

  protected reroll(): void {
    if (!this.dealing()) this.roll(this.formIdx);
  }

  protected cancel(): void {
    this.sound.play('cancel', { volume: 0.75 });
    this.close();
  }

  protected toggleAuto(): void {
    this.autoMode.update(v => !v);
  }

  protected pick(i: number): void {
    if (!this.interactive() || !this.hand) return;
    const card = this.hand[i];
    const formIdx = this.formIdx;
    let kept: string[] = [];
    void this.store.update(this.character().id, c => { kept = applyPick(c, formIdx, card, Math.random, Date.now()); });
    this.seen.add(kept);
    this.sound.play('equip', { rate: 1.15, volume: 0.9 });
    this.notifier.notify(pickMessage(card, RARITY_LABEL), 'ok');
    this.close();
  }

  private roll(formIdx: number): void {
    if (this.dealing()) return;
    this.clearTimers();
    this.formIdx = formIdx;
    this.dealing.set(true);
    this.interactive.set(false);

    const c = this.character();
    const { pity, isPityRoll } = pityBeforeRoll(this.pity());
    this.setPity(pity);

    const form = formIdx > 0 ? (c.altForms || [])[formIdx - 1] : null;
    const fortune = readFortune(safeStorage());
    let sub = isPityRoll ? 'Guaranteed legendary or better.' : '';
    this.title.set(isPityRoll ? 'PITY ROLL!' : 'DRAWING YOUR HAND...');
    if (form) sub = `for ${(form.name || `FORM ${formIdx}`).toUpperCase()}`;
    const fl = fortuneLabel(fortune);
    if (fl) sub = sub ? `${sub}  ·  ${fl}` : fl;
    this.sub.set(sub || ' ');
    this.sound.play('dicealt', { rate: 0.9 + Math.random() * 0.15, volume: 0.75 });

    const hand = rollHand(isPityRoll, fortune, this.seen.seen(), Math.random);
    this.hand = hand;
    const finalPity = pityAfterRoll(pity, hand, isPityRoll);

    // three cards flicking through random traits at slightly different rates
    const allKeys = Object.keys(TRAITS);
    this.cards.set(hand.map(() => ({ rolling: true, rarity: '', name: '---', desc: '', shimmy: null, flash: false, notable: false })));
    let popCooldown = false;
    hand.forEach((_, i) => {
      this.intervals[i] = setInterval(() => {
        const t = TRAITS[allKeys[Math.floor(Math.random() * allKeys.length)]];
        this.patchCard(i, { rarity: t.rarity as string, name: t.name, desc: t.desc || '' });
        if (!popCooldown) {
          popCooldown = true;
          this.sound.play('pop', { rate: 0.85 + Math.random() * 0.35, volume: 0.12 });
          this.timers.push(setTimeout(() => { popCooldown = false; }, 75));
        }
      }, 85 + i * 15);
    });

    // lock each card in turn
    REVEAL_AT.forEach((delay, i) => {
      this.timers.push(setTimeout(() => {
        clearInterval(this.intervals[i]);
        if (!this.hand) return;   // cancelled mid-deal
        const h = hand[i];
        if (!h) return;
        const t = TRAITS[h.key];
        const who = this.character();
        this.patchCard(i, { rolling: false, rarity: t.rarity as string, name: named(t.name, who), desc: named(t.desc || '', who), flash: true });
        this.timers.push(setTimeout(() => this.patchCard(i, { flash: false }), 90));
        this.sound.play('pop', { rate: 0.9 + Math.random() * 0.2, volume: 0.85 });
        if (t.rarity === 'hexxed') this.sound.play('hexxed', { volume: 0.9 });
        else if (t.rarity === 'mythic') this.sound.play('mythic', { volume: 0.85 });
        else if (t.rarity === 'legendary') this.sound.play('legendary', { volume: 0.8 });

        if (h.shimmyful) {
          this.timers.push(setTimeout(() => {
            const sd = getShimmyfulDef(h.key);
            if (!sd) return;
            const w = this.character();
            this.patchCard(i, { shimmy: t.rarity as string, name: named(sd.name, w), desc: named(sd.desc || '', w), flash: true });
            this.timers.push(setTimeout(() => this.patchCard(i, { flash: false }), 90));
            this.sound.play('legendary', { rate: t.rarity === 'legendary' ? 0.72 : 1.85, volume: 0.9 });
          }, 400));
        }
        this.seen.add([h.key]);

        if (i === hand.length - 1) {
          const interactDelay = hand.some(x => x.shimmyful) ? 1600 : 380;
          this.timers.push(setTimeout(() => this.handReady(isPityRoll, finalPity), interactDelay));
        }
      }, delay));
    });
  }

  private handReady(isPityRoll: boolean, finalPity: number): void {
    this.setPity(finalPity);
    this.title.set('YOUR TRAIT HAND');
    this.sub.set(isPityRoll ? 'Pity reset. Pick your trait.' : 'Pick one, or close to discard.');
    this.interactive.set(true);
    this.dealing.set(false);
    if (!this.autoMode() || !this.hand) return;
    const stops = this.hand.map(h => this.isStop(h));
    if (stops.some(Boolean)) {
      this.title.set('★ NOTABLE ROLL');
      this.sub.set('Pick a card, or REROLL to skip.');
      this.cards.update(cs => cs.map((c, i) => ({ ...c, notable: stops[i] })));
    } else {
      this.title.set('AUTO-ROLLING...');
      this.sub.set('Nothing notable. Rolling again...');
      this.timers.push(setTimeout(() => {
        if (this.autoMode() && !document.hidden) this.roll(this.formIdx);
      }, 320));
    }
  }

  /** Auto-roll stops on hexxed, duality, determined, shimmyful (if chosen) and the chosen rarity or better. */
  private isStop(h: HandCard): boolean {
    const rar = String(TRAITS[h.key]?.rarity || '').toLowerCase();
    if (rar === 'hexxed' || rar === 'duality' || rar === 'determined') return true;
    if (h.shimmyful && this.stopShimmy()) return true;
    const rank = rar ? (AR_RANK[rar] ?? 99) : 0;
    return rank >= (AR_RANK[this.stopRarity()] ?? 3);
  }

  private setPity(p: number): void {
    this.pity.set(p);
    if (clampPity(this.character().pity) !== p) void this.store.update(this.character().id, c => { c.pity = p; });
  }

  private patchCard(i: number, patch: Partial<CardView>): void {
    this.cards.update(cs => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  private close(): void {
    this.clearTimers();
    this.hand = null;
    this.closed.emit();
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.intervals.forEach(clearInterval);
    this.timers = [];
    this.intervals = [];
  }

  protected rarityLabel(r: string): string {
    return RARITY_LABEL[r] || r.toUpperCase();
  }
  protected shimmyMark(r: string | null): string {
    return r ? SHIMMY_MARK[r] || '✦' : '';
  }
}

function clampPity(p: unknown): number {
  return Math.max(0, Math.min(100, Number(p) || 0));
}

/** Trait text may say [NAME]; it becomes the character's name. */
function named(text: string, c: Character): string {
  return (text || '').replace(/\[NAME\]/g, c?.name || '?');
}

function safeStorage(): Storage | null {
  try { return localStorage; } catch { return null; }
}
