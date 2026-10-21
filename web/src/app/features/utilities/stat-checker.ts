import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { StatBar } from '../../ui/stat-bar';
import { StatIcon } from '../../ui/stat-icon';

const KEYS = ['hp', 'atk', 'def', 'mag', 'spd'] as const;
type Key = typeof KEYS[number];
interface Row { base: number; add: number; mult: number; div: number; max: number }

/**
 * The stat simulator: a base value per stat, then (+ add) x mult / div, and
 * the sub-stats those finals would derive (the formulas the sheet uses
 * before items and traits).
 */
@Component({
  selector: 'ss-stat-checker',
  imports: [StatBar, StatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (k of keys; track k) {
      @let r = rows()[k];
      <div class="row">
        <label class="base">
          <span class="lbl"><ss-stat-icon [stat]="k" [size]="10" />{{ k.toUpperCase() }} BASE: <b>{{ r.base }}</b></span>
          <input type="range" min="1" [max]="r.max" [value]="r.base" (input)="set(k, 'base', $any($event.target).value)" [attr.aria-label]="k + ' base'" />
          <ss-stat-bar class="ghost" [stat]="k" [value]="r.base" />
        </label>
        <div class="math">
          <label><span>ADD (+)</span><input type="number" [value]="r.add" (input)="set(k, 'add', $any($event.target).value)" /></label>
          <label><span>MULT (x)</span><input type="number" step="0.1" [value]="r.mult" (input)="set(k, 'mult', $any($event.target).value)" /></label>
          <label><span>DIV (/)</span><input type="number" step="0.1" [value]="r.div" (input)="set(k, 'div', $any($event.target).value)" /></label>
        </div>
        <div class="res">
          <span class="lbl">MODIFIED RESULT: <b>{{ finals()[k] }}</b></span>
          <ss-stat-bar [stat]="k" [value]="finals()[k]" />
        </div>
      </div>
    }
    <div class="subs">
      <span class="head">DERIVED SUBSTATS</span>
      <dl>
        @for (s of subs(); track s.label) {
          <div class="sub" [title]="s.tip"><dt>{{ s.label }}:</dt><dd>{{ s.value }}</dd></div>
        }
      </dl>
    </div>
  `,
  styles: `
    .row { display: grid; gap: 10px; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1px solid var(--ss-panel-2); }
    .lbl { display: inline-flex; gap: 6px; align-items: center; font-size: var(--ss-text-xs); letter-spacing: 1px; color: var(--ss-fg-dim); b { color: var(--ss-fg); font-weight: normal; } }
    .base { display: grid; gap: 8px; input { width: 100%; accent-color: var(--ss-accent); } }
    .ghost { opacity: 0.3; }
    .math { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      label { display: grid; gap: 4px; font-size: 7px; letter-spacing: 1px; color: var(--ss-fg-dim); }
      input { width: 100%; padding: 5px; font-size: var(--ss-text-sm); background: var(--ss-bg); border: 1px solid var(--ss-line-dim); color: var(--ss-fg); } }
    .res { display: grid; gap: 6px; }
    .subs { padding: 16px; border-top: 1px solid var(--ss-line-dim); background: rgb(0 0 0 / 0.4); }
    .head { display: block; margin-bottom: 12px; font-size: var(--ss-text-md); letter-spacing: 2px; color: var(--ss-accent); }
    dl { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .sub { display: flex; gap: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--ss-panel-2); font-size: var(--ss-text-sm); letter-spacing: 1px; cursor: help; }
    dt { color: var(--ss-fg-dim); } dd { margin: 0; color: var(--ss-fg); }
    @media (max-width: 560px) { dl { grid-template-columns: 1fr; } }
  `,
})
export class StatChecker {
  protected readonly keys = KEYS;
  protected readonly rows = signal<Record<Key, Row>>({
    hp: { base: 100, add: 0, mult: 1, div: 1, max: 1250 },
    atk: { base: 10, add: 0, mult: 1, div: 1, max: 300 },
    def: { base: 10, add: 0, mult: 1, div: 1, max: 300 },
    mag: { base: 10, add: 0, mult: 1, div: 1, max: 300 },
    spd: { base: 10, add: 0, mult: 1, div: 1, max: 300 },
  });

  protected readonly finals = computed(() => {
    const out = {} as Record<Key, number>;
    for (const k of KEYS) {
      const r = this.rows()[k];
      out[k] = Math.max(0, Math.round(((r.base + r.add) * r.mult) / (r.div || 1)));
    }
    return out;
  });

  protected readonly subs = computed(() => {
    const { hp, atk, def, mag, spd } = this.finals();
    const critRate = Math.min((atk / 20) * 0.3, 80);
    const statusRes = Math.min((def / 20) * 1, 50);
    const heal = (mag / 15) * 5;
    const dex = (spd / 10) * 0.5;
    const resil = Math.min((hp / 100) * 0.2, 50);
    const critFromAtk = (atk / 50) * 1, critFromRate = critRate * 0.1;
    const trueDmg = (hp / 300) * 1;
    const lifesteal = (def / 100) * 1;
    const cdr = Math.min((spd / 20) * 1, 40);
    const f = (v: number) => v.toFixed(1);
    return [
      { label: 'CRIT CHANCE', value: f(critRate) + '%', tip: `ATK Scaling: +${f(critRate)}% (from ${atk} ATK). Max 80%.` },
      { label: 'CRIT DMG', value: f(critFromAtk + critFromRate) + '%', tip: `ATK Scaling: +${f(critFromAtk)}% | Crit Rate Bonus: +${f(critFromRate)}%.` },
      { label: 'HEAL POWER', value: '+' + f(heal), tip: `MAG Scaling: +${f(heal)} (from ${mag} MAG).` },
      { label: 'STATUS RES', value: f(statusRes) + '%', tip: `DEF Scaling: +${f(statusRes)}% (from ${def} DEF). Max 50%.` },
      { label: 'DEXTERITY', value: f(dex) + '%', tip: `SPD Scaling: +${f(dex)}% (from ${spd} SPD).` },
      { label: 'RESILIENCE', value: f(resil) + '%', tip: `HP Scaling: +${f(resil)}% (from ${hp} HP). Max 50%.` },
      { label: 'TRUE DAMAGE', value: f(trueDmg) + '%', tip: `HP Scaling: +${f(trueDmg)}% (from ${hp} HP).` },
      { label: 'LIFESTEAL', value: f(lifesteal) + '%', tip: `DEF Scaling: +${f(lifesteal)}% (from ${def} DEF).` },
      { label: 'COOLDOWN RED.', value: f(cdr) + '%', tip: `SPD Scaling: +${f(cdr)}% (from ${spd} SPD). Max 40%.` },
    ];
  });

  protected set(k: Key, part: keyof Row, raw: string): void {
    const v = part === 'base' ? +raw : parseFloat(raw) || 0;
    this.rows.update(r => ({ ...r, [k]: { ...r[k], [part]: v } }));
  }
}
