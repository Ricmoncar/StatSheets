import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, afterNextRender, computed, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { FIXED } from '../../core/pixel/palette';
import { SettingsService } from '../../core/settings.service';
import { SoundService } from '../../core/sound.service';
import { applyPick, pickMessage } from '../../core/game/pick';
import {
  HandCard, RARITY_LABEL, fortuneLabel, pityAfterRoll, pityBeforeRoll, readFortune, rollHand,
} from '../../core/game/roll';
import { SeenTraits } from '../../core/game/seen-traits.service';
import { getShimmyfulDef } from '../../core/game/stats';
import { TRAITS } from '../../core/game/traits-data';
import { Icon } from '../../ui/icon';
import { RARITY_INKS, RollFx } from './roll-fx';

/** Rank used by auto-roll to decide whether a hand is worth stopping on. */
const AR_RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4, hexxed: 99, duality: 99, determined: 99 };
const SHIMMY_MARK: Record<string, string> = { legendary: '★', mythic: '✦', epic: '✦', rare: '✦', common: '✦' };
/** When each card lands (the old page's timing, which auto-roll is paced by). */
const REVEAL_AT = [1400, 1950, 2500];
/** The cards are dealt face down first; then each reel starts, a little apart. */
const REEL_AT = 300;
/** How long before it lands a high card gives itself away. */
const TELL_FOR = 560;
/** How much a rarity is worth to the show: the burst, the tell, the rays. */
const SHOW: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4, duality: 4, determined: 4, hexxed: 5 };
const CLASSIC = /^Classic$/i;

interface CardView {
  /** face down, the reel turning, or face up */
  phase: 'back' | 'reel' | 'face';
  /** one up per turn of the reel, so each name rolls in */
  tick: number;
  rarity: string;
  name: string;
  desc: string;
  shimmy: string | null;
  flash: boolean;
  notable: boolean;
  /** the card giving away what it is just before it lands */
  tell: '' | 'soft' | 'hard' | 'hex';
  /** the colour it gives away: the one it lands as */
  tellCol: string;
  landed: boolean;
}

interface FormRow { idx: number; name: string; traits: string; inherits: boolean }

/**
 * The trait roll: optional form chooser, the dealing animation, the hand of
 * three, pity, REROLL and AUTO roll. Ported from the old rollTraits /
 * rollTraitsFor / pickTraitFromHand / closeTraitRoll flow.
 */
@Component({
  selector: 'ss-roll-overlay',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancel()', '[class.quiet]': 'quiet' },
  templateUrl: './roll-overlay.html',
  styleUrl: './roll-overlay.scss',
})
export class RollOverlay implements OnInit, OnDestroy {
  private readonly store = inject(CharacterStore);
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);
  private readonly seen = inject(SeenTraits);
  /** Performance mode, or the system asking for less motion: the cards still turn, without the fireworks. */
  protected readonly quiet = inject(SettingsService).perfMode() || matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly cardEls = viewChildren<ElementRef<HTMLElement>>('card');
  private readonly fxBack = viewChild<ElementRef<HTMLCanvasElement>>('fxBack');
  private readonly fxFront = viewChild<ElementRef<HTMLCanvasElement>>('fxFront');
  private fx: RollFx | null = null;

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
  /** Pity as twenty crystal cells, five points each. */
  protected readonly cells = Array.from({ length: 20 }, (_, i) => i + 1);
  /** The hand shakes as a high card lands. */
  protected readonly shakeHand = computed(() => this.cards().some(c => c.flash && ['legendary', 'mythic', 'hexxed', 'duality', 'determined'].includes(c.rarity)));
  /** The card taken, rising while the others fall away. */
  protected readonly picking = signal<number | null>(null);
  /** The best card still to land is about to: the room darkens. */
  protected readonly tense = signal(0);
  /** A flash over everything as a high card lands. */
  protected readonly glare = signal<{ n: number; col: string } | null>(null);
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

  constructor() {
    afterNextRender(() => {
      const b = this.fxBack()?.nativeElement, f = this.fxFront()?.nativeElement;
      if (b && f && !this.quiet) this.fx = new RollFx(b, f);
    });
  }

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
    this.fx?.stop();
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
    if (!this.interactive() || !this.hand || this.picking() !== null) return;
    const card = this.hand[i];
    const formIdx = this.formIdx;
    let kept: string[] = [];
    void this.store.update(this.character().id, c => { kept = applyPick(c, formIdx, card, Math.random, Date.now()); });
    this.seen.add(kept);
    this.sound.play('equip', { rate: 1.15, volume: 0.9 });
    const rar = String(TRAITS[card.key]?.rarity || 'common');
    if ((SHOW[rar] ?? 0) >= 3) this.sound.play('max', { volume: 0.45 });
    this.notifier.notify(pickMessage(card, RARITY_LABEL), 'ok');
    // the card taken rises with a burst, the others fall away, then the hand closes
    this.interactive.set(false);
    this.picking.set(i);
    this.clearTimers();
    this.fx?.clearRays();
    const el = this.cardEls()[i]?.nativeElement;
    if (el && this.fx) { this.fx.burst(el, RARITY_INKS[rar] || RARITY_INKS['common'], 36, 5); this.fx.ring(el, (RARITY_INKS[rar] || RARITY_INKS['common'])[0]); }
    this.timers.push(setTimeout(() => this.close(), this.quiet ? 120 : 640));
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

    // dealt face down, then three reels turning through random traits, each slowing as it comes to land
    const allKeys = Object.keys(TRAITS);
    this.picking.set(null);
    this.tense.set(0);
    this.fx?.clearRays();
    this.cards.set(hand.map(() => ({ phase: 'back', tick: 0, rarity: '', name: '---', desc: '', shimmy: null, flash: false, notable: false, tell: '', tellCol: '', landed: false })));
    hand.forEach((_, i) => this.timers.push(setTimeout(() => this.sound.play('pop', { rate: 1.45 + i * 0.1, volume: 0.22 }), i * 90)));
    const t0 = performance.now();
    let lastTick = 0;
    hand.forEach((_, i) => {
      const start = REEL_AT + i * 45, lockAt = REVEAL_AT[i];
      const turn = () => {
        if (!this.hand) return;
        const at = performance.now() - t0, p = Math.min(1, Math.max(0, (at - start) / (lockAt - start)));
        const t = TRAITS[allKeys[Math.floor(Math.random() * allKeys.length)]];
        this.patchCard(i, { phase: 'reel', tick: this.cards()[i].tick + 1, rarity: t.rarity as string, name: t.name, desc: t.desc || '' });
        // one tick at a time across the three reels, rising as they slow
        if (at - lastTick > 60) {
          lastTick = at;
          this.sound.play('pop', { rate: 0.8 + p * 0.75 + Math.random() * 0.1, volume: 0.1 + p * 0.1 });
        }
        const next = 55 + 250 * p * p;
        if (at + next < lockAt - 30) this.timers.push(setTimeout(turn, next));
      };
      this.timers.push(setTimeout(turn, start));
    });

    hand.forEach((h, i) => {
      const t = TRAITS[h.key], show = SHOW[t.rarity as string] ?? 0;
      // a high card gives itself away just before it lands: it glows, and from legendary up it shakes and the room darkens
      if (show >= 2) {
        this.timers.push(setTimeout(() => {
          if (!this.hand) return;
          this.patchCard(i, { tell: show >= 5 ? 'hex' : show >= 3 ? 'hard' : 'soft', tellCol: (RARITY_INKS[t.rarity as string] || RARITY_INKS['common'])[1] });
          if (show >= 3) {
            this.tense.set(show);
            this.sound.play('pop', { rate: show >= 5 ? 0.35 : 0.5, volume: 0.6 });
          }
        }, REVEAL_AT[i] - TELL_FOR));
      }
      // and each card lands in turn
      this.timers.push(setTimeout(() => {
        if (!this.hand) return;   // cancelled mid-deal
        const who = this.character();
        this.patchCard(i, { phase: 'face', tell: '', landed: true, rarity: t.rarity as string, name: named(t.name, who), desc: named(t.desc || '', who), flash: true });
        this.timers.push(setTimeout(() => this.patchCard(i, { flash: false }), 90));
        this.tense.set(0);
        this.sound.play('pop', { rate: 0.9 + show * 0.06 + Math.random() * 0.15, volume: 0.85 });
        if (t.rarity === 'hexxed') this.sound.play('hexxed', { volume: 0.9 });
        else if (t.rarity === 'mythic') this.sound.play('mythic', { volume: 0.85 });
        else if (t.rarity === 'legendary') this.sound.play('legendary', { volume: 0.8 });
        else if (show === 2) this.sound.play('rolldone', { rate: 1.05, volume: 0.5 });
        else if (show === 1) this.sound.play('rolldone', { rate: 1.3, volume: 0.32 });
        this.land(i, t.rarity as string, show);

        if (h.shimmyful) {
          this.timers.push(setTimeout(() => {
            const sd = getShimmyfulDef(h.key);
            if (!sd) return;
            const w = this.character();
            this.patchCard(i, { shimmy: t.rarity as string, name: named(sd.name, w), desc: named(sd.desc || '', w), flash: true });
            this.timers.push(setTimeout(() => this.patchCard(i, { flash: false }), 90));
            this.sound.play('legendary', { rate: t.rarity === 'legendary' ? 0.72 : 1.85, volume: 0.9 });
            const el = this.cardEls()[i]?.nativeElement;
            if (el && this.fx) { this.fx.burst(el, [FIXED.white, ...(RARITY_INKS[t.rarity as string] || [])], 30, 4); this.fx.ring(el, FIXED.white, 0.6); }
          }, 400));
        }
        this.seen.add([h.key]);

        if (i === hand.length - 1) {
          const interactDelay = hand.some(x => x.shimmyful) ? 1600 : 380;
          this.timers.push(setTimeout(() => this.handReady(isPityRoll, finalPity), interactDelay));
        }
      }, REVEAL_AT[i]));
    });
  }

  /** A card lands: a burst in its colours, bigger the rarer, a ring and a flash from epic up, rays behind it from legendary up. */
  private land(i: number, rarity: string, show: number): void {
    const el = this.cardEls()[i]?.nativeElement, inks = RARITY_INKS[rarity] || RARITY_INKS['common'];
    if (!el || !this.fx) return;
    this.fx.burst(el, inks, [10, 18, 28, 46, 64, 72][show] ?? 10, [2.2, 2.8, 3.4, 4.4, 5.2, 5.6][show] ?? 2.2);
    if (show >= 2) this.fx.ring(el, inks[0], show >= 3 ? 0.9 : 0.6);
    if (show >= 3) {
      this.fx.addRays(el, inks.slice(1, 3), show >= 4 ? 20 : 16);
      this.glare.update(g => ({ n: (g?.n || 0) + 1, col: inks[1] }));
    }
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
    this.fx?.stop();
    this.hand = null;
    this.closed.emit();
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  /** Which card frame and art window a rarity wears. */
  protected look(r: string): string {
    if (r === 'duality') return 'heavenly';
    return ['common', 'rare', 'epic', 'legendary', 'mythic', 'hexxed', 'determined'].includes(r) ? r : 'common';
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
