import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { RARITY_LABEL } from '../../core/game/roll';
import { formatGold } from '../../core/game/sheet';
import { effectiveStats, getShimmyfulDef, getTraitDef, isShimmyful } from '../../core/game/stats';
import * as A from '../../core/game/trait-actions';
import { TRAITS } from '../../core/game/traits-data';
import { RichDesc } from '../../ui/rich-desc';

type Variant = 'duality' | 'capitalist' | 'determination' | 'plain';
interface SitButton { id: string; label: string; desc: string; on: boolean }

const HATRED_DESC = 'Absorb every defeated enemy: permanently add all their non-HP main stats to yours for the rest of that fight. Lose -1% HP per absorb. Revive infinitely with no stat loss.';
const MERCYFUL_DESC = 'Revive infinitely without losing stats. x10 Heal Power, x10 DEF. Healing received is divided by 5.';

/**
 * One trait on the sheet, with whatever controls it has: scenario triggers,
 * the duality switch, Determination's states and counters, Capitalist, the
 * stat rerollers, and the soul absorber. Ported from renderTraitsDisplay and
 * renderTraitSituationals; every button goes through trait-actions.ts.
 */
@Component({
  selector: 'ss-trait-card',
  imports: [RichDesc],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trait-card.html',
  styleUrl: './trait-card.scss',
})
export class TraitCard {
  private readonly store = inject(CharacterStore);
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);

  readonly character = input.required<Character>();
  readonly traitKey = input.required<string>();

  protected readonly fmtGold = formatGold;
  protected readonly base = computed(() => TRAITS[this.traitKey()]);
  protected readonly rarity = computed(() => String(this.base()?.rarity || 'common'));
  protected readonly variant = computed<Variant>(() => {
    const k = this.traitKey();
    if (this.rarity() === 'duality') return 'duality';
    if (k === 'capitalist') return 'capitalist';
    if (k === 'determination') return 'determination';
    return 'plain';
  });
  protected readonly shimmy = computed(() => {
    const c = this.character(), k = this.traitKey();
    return isShimmyful(c, k) && !!getShimmyfulDef(k) ? this.rarity() : null;
  });
  protected readonly stacks = computed(() => (this.character().traitStacks || {}) as Record<string, any>);

  // duality
  protected readonly duState = computed(() => ((this.character().dualityState || {}) as Record<string, string>)[this.traitKey()] || 'heavenly');
  protected readonly flipping = signal<'to-hell' | 'to-heaven' | null>(null);

  /** Rarity label, name and text as the card shows them. */
  protected readonly face = computed(() => {
    const c = this.character(), k = this.traitKey(), t = this.base();
    if (!t) return { label: '', name: k, desc: '' };
    if (this.variant() === 'duality') {
      const d = t[this.duState()] || t;
      return { label: this.duState() === 'heavenly' ? 'HEAVENLY' : 'HELLFORGED', name: d.name, desc: d.desc };
    }
    if (this.variant() === 'determination') {
      const st = this.detState();
      if (st === 'hatred') return { label: 'HATRED', name: 'HATRED', desc: HATRED_DESC };
      if (st === 'mercyful') return { label: 'MERCYFUL', name: 'MERCYFUL', desc: MERCYFUL_DESC };
      return { label: 'DETERMINED', name: 'Determination', desc: t.desc };
    }
    const d = getTraitDef(c, k) || t;
    return { label: RARITY_LABEL[this.rarity()] || this.rarity().toUpperCase(), name: d.name, desc: d.desc };
  });

  // capitalist
  protected readonly capitalist = computed(() => {
    const gold = Number(this.character().gold || 0);
    return { active: !!this.stacks()['capitalist:active'], gold, mult: Math.max(0, gold / 90000) };
  });

  // determination
  protected readonly detState = computed(() => {
    const s = this.stacks();
    return s['determination:state'] || ((s['determination:kills'] || 0) >= 10 ? 'hatred' : (s['determination:spares'] || 0) >= 10 ? 'mercyful' : 'determined');
  });
  protected readonly det = computed(() => {
    const s = this.stacks();
    return { kills: s['determination:kills'] || 0, deaths: s['determination:deaths'] || 0, spares: s['determination:spares'] || 0 };
  });
  protected readonly absorbed = computed(() => Object.keys(this.stacks())
    .filter(k => k.startsWith('determination:absorbed_'))
    .map(k => {
      const id = k.slice('determination:absorbed_'.length);
      const d = this.stacks()[k] || {};
      return { id, name: d.name || this.store.byId().get(id)?.name || 'UNKNOWN', atk: d.atk || 0, def: d.def || 0, mag: d.mag || 0, spd: d.spd || 0 };
    }));
  protected readonly others = computed(() => this.store.characters().filter(x => x.id !== this.character().id));
  protected readonly absorbPick = signal('');

  /** Scenario toggles (duality ones filtered to the current side). */
  protected readonly situationals = computed<SitButton[]>(() => {
    const c = this.character(), k = this.traitKey();
    const def = getTraitDef(c, k);
    let pool: any[] = def?.situational || [];
    if (this.rarity() === 'duality') {
      const side = this.duState() === 'heavenly' ? 'HEAVENLY' : 'HELLFORGED';
      pool = pool.filter(s => s.label.startsWith(side));
    }
    const trig = (c.traitTriggers || {}) as Record<string, unknown>;
    return pool.filter(s => s.passive && s.passive.length).map(s => {
      const id = k + ':' + s.id;
      return { id, label: s.label, desc: s.desc || 'Toggle this scenario to preview your stats.', on: !!trig[id] };
    });
  });
  protected readonly bolt = computed(() => this.traitKey() === 'hunterhunted' ? '' : '⚡ ');

  // stat rerollers
  protected readonly rollsLine = computed(() => {
    const c = this.character() as Record<string, any>, k = this.traitKey();
    const fmt = (o: Record<string, number> | undefined, keys: string[], dflt: number | null) =>
      o ? keys.map(s => (o[s] != null || dflt != null) ? `${s.toUpperCase()} x${(o[s] ?? dflt).toFixed(2)}` : '').filter(Boolean).join('  ') : '';
    if (k === 'missingno') return fmt(c['missingNoRolls'], ['hp', 'atk', 'def', 'mag', 'spd'], 1);
    if (k === 'glitch') return fmt(c['glitchRolls'], ['hp', 'atk', 'def', 'mag', 'spd'], 1);
    if (k === 'thousanddoors') { const a = c['thousandDoorsAccum'] || {}; return Object.keys(a).length ? fmt(a, ['hp', 'atk', 'def', 'mag', 'spd'], 1) : ''; }
    if (k === 'anotherandanother') { const d = c['drunkStats'] || {}; return Object.keys(d).length ? fmt(d, ['atk', 'mag', 'def', 'hp'], null) : ''; }
    return '';
  });
  protected readonly doors = computed(() => {
    const c = this.character() as Record<string, any>;
    return { canUndo: !!(c['thousandDoorsHistory'] || []).length, canReset: Object.values(c['thousandDoorsAccum'] || {}).some(v => v !== 1) };
  });
  protected readonly glitchMax = computed(() => isShimmyful(this.character(), 'glitch') ? 30 : 20);

  // perfect soul
  protected readonly souls = computed(() => (this.character().perfectSoulData?.souls || []) as { name: string; pct: number; stats: Record<string, number> }[]);
  protected readonly soulHistory = computed(() => !!(this.character().perfectSoulData?.history || []).length);
  protected readonly soulListOpen = signal(false);
  protected readonly soulPickerOpen = signal(false);
  protected readonly soulQuery = signal('');
  protected readonly soulTarget = signal<string | null>(null);
  protected readonly soulTargetChar = computed(() => this.store.characters().find(x => x.name === this.soulTarget()) || null);
  protected readonly soulChoices = computed(() => {
    const q = this.soulQuery().toLowerCase();
    return this.store.characters().filter(x => (x.name || '').toLowerCase().includes(q));
  });
  protected readonly soulRange = computed(() => isShimmyful(this.character(), 'perfectsoul') ? '55-90%' : '40-80%');

  // ── actions ──
  private edit(fn: (c: any) => void): void {
    void this.store.update(this.character().id, fn);
  }

  protected toggleTrigger(id: string): void { this.edit(c => A.toggleTrigger(c, id)); }

  protected toggleDuality(): void {
    const k = this.traitKey();
    const next = this.duState() === 'heavenly' ? 'hellforged' : 'heavenly';
    this.flipping.set(next === 'hellforged' ? 'to-hell' : 'to-heaven');
    setTimeout(() => {
      this.sound.play('pop', { rate: next === 'hellforged' ? 0.65 : 1.35, volume: 0.85 });
      this.edit(c => A.toggleDuality(c, k));
      this.flipping.set(null);
    }, 480);
  }

  protected toggleCapitalist(): void {
    let r = { active: false, multiplier: 0, gold: 0 };
    this.edit(c => { r = A.toggleCapitalist(c); });
    if (r.active) this.notifier.notify(`CAPITALIST ACTIVATED · x${r.multiplier.toFixed(2)} FROM ${formatGold(r.gold)} G`, 'ok');
    else this.notifier.notify('CAPITALIST DEACTIVATED', 'info');
  }

  protected adjust(counter: 'kills' | 'deaths' | 'spares', delta: number): void {
    this.edit(c => A.adjustDetermination(c, this.traitKey(), counter, delta));
  }
  protected setDet(state: 'hatred' | 'mercyful' | 'determined'): void { this.edit(c => A.setDeterminationState(c, state)); }

  protected absorb(): void {
    const target = this.store.byId().get(this.absorbPick());
    if (!this.absorbPick()) { this.notifier.notify('SELECT A CHARACTER TO ABSORB', 'err'); return; }
    if (!target) { this.notifier.notify('CHARACTER NOT FOUND', 'err'); return; }
    let r = 'already' as 'absorbed' | 'already';
    const eff = effectiveStats(target);
    this.edit(c => { r = A.absorbCharacter(c, target, eff); });
    this.notifier.notify(r === 'absorbed' ? `ABSORBED ${target.name.toUpperCase()}'S STATS` : `ALREADY ABSORBED ${target.name.toUpperCase()}`, r === 'absorbed' ? 'ok' : 'info');
    this.absorbPick.set('');
  }
  protected unabsorb(id: string): void {
    let name = null as string | null;
    this.edit(c => { name = A.removeAbsorbed(c, id); });
    if (name) this.notifier.notify(`REMOVED ${String(name).toUpperCase()}`, 'ok');
  }

  protected missingNo(): void { this.edit(c => A.rollMissingNo(c, Math.random)); }
  protected glitch(): void { this.edit(c => A.rollGlitch(c, Math.random)); }
  protected doorsRoll(): void { this.edit(c => A.rollThousandDoors(c, Math.random)); }
  protected doorsUndo(): void { this.edit(c => A.undoThousandDoors(c)); }
  protected doorsReset(): void { this.edit(c => A.resetThousandDoors(c)); }
  protected drunk(type: 'atkmag' | 'defhp'): void { this.edit(c => A.rollAnotherAndAnother(c, type, Math.random)); }

  protected soulAbsorb(): void {
    if (!this.soulTarget()) { this.notifier.notify('SELECT A CHARACTER FIRST', 'err'); return; }
    const target = this.soulTargetChar();
    if (!target) { this.notifier.notify('CHARACTER NOT FOUND', 'err'); return; }
    this.edit(c => A.absorbSoul(c, target, Math.random));
  }
  protected soulUndo(): void { this.edit(c => A.undoSoul(c)); }
  protected soulReset(): void { this.edit(c => A.resetSouls(c)); }
  protected soulRemove(i: number): void { this.edit(c => A.removeSoul(c, i)); }
  protected pickSoul(name: string | null): void { this.soulTarget.set(name); this.soulPickerOpen.set(false); }

  protected remove(): void {
    this.edit(c => A.removeTrait(c, this.traitKey()));
    this.sound.play('delete');
    this.notifier.notify('TRAIT REMOVED', 'err');
  }

  protected statLine(s: Record<string, number> | undefined): string {
    const t = s || {};
    return `HP ${t['hp'] || 0} · ATK ${t['atk'] || 0} · DEF ${t['def'] || 0} · MAG ${t['mag'] || 0} · SPD ${t['spd'] || 0}`;
  }
  protected soulStats(s: Record<string, number>): { k: string; v: number }[] {
    return ['hp', 'atk', 'def', 'mag', 'spd'].filter(k => s && s[k]).map(k => ({ k, v: Math.round(s[k]) }));
  }
}
