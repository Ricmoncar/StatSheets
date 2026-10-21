import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { effectiveStats } from '../../core/game/stats';
import { Modal } from '../../ui/modal';
import { StatIcon } from '../../ui/stat-icon';

const KEYS = ['hp', 'atk', 'def', 'mag', 'spd', 'iq', 'heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'] as const;
const LABELS: Record<string, string> = {
  hp: 'HP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD', iq: 'IQ', heal_pow: 'HEAL POW', crit_rate: 'CRIT%', crit_dmg: 'CRIT DMG',
  status_res: 'STATUS RES', dexterity: 'DEX', resilience: 'RESIL', true_dmg: 'TRUE DMG', lifesteal: 'LIFESTEAL', cooldown_red: 'CDR',
};
const NARA = /^NARA!+$/;

/**
 * Two characters side by side, every stat on bars against the larger of all
 * thirty numbers; the higher side of each row lights up in its colour.
 */
@Component({
  selector: 'ss-compare-modal',
  imports: [Modal, StatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-modal title="COMPARE CHARACTERS" width="640px" (closed)="closed.emit()">
      <div class="pick">
        <select aria-label="First character" (change)="a.set($any($event.target).value)">
          <option value="">--</option>
          @for (c of chars(); track c.id) { <option [value]="c.id" [selected]="c.id === a()">{{ c.name }}</option> }
        </select>
        <span class="vs">VS</span>
        <select aria-label="Second character" (change)="b.set($any($event.target).value)">
          <option value="">--</option>
          @for (c of chars(); track c.id) { <option [value]="c.id" [selected]="c.id === b()">{{ c.name }}</option> }
        </select>
      </div>
      @if (result(); as r) {
        <p class="names">
          <span [class.rainbow]="r.a.rainbow" [style.color]="r.a.rainbow ? null : r.a.color">{{ r.a.name }}</span>
          <span class="vs">VS</span>
          <span [class.rainbow]="r.b.rainbow" [style.color]="r.b.rainbow ? null : r.b.color">{{ r.b.name }}</span>
        </p>
        <div class="rows">
          @for (row of r.rows; track row.key) {
            <div class="row">
              <span class="val" [class.win]="row.va > row.vb" [class.lose]="row.va < row.vb">{{ row.va }}</span>
              <span class="bar a"><span [style.width.%]="row.pa" [class.rainbow-bg]="row.va > row.vb && r.a.rainbow" [style.background]="row.va > row.vb ? (r.a.rainbow ? null : r.a.color) : 'var(--c-ash)'"></span></span>
              <span class="key"><ss-stat-icon [stat]="row.key" [size]="21" />{{ row.label }}</span>
              <span class="bar b"><span [style.width.%]="row.pb" [class.rainbow-bg]="row.vb > row.va && r.b.rainbow" [style.background]="row.vb > row.va ? (r.b.rainbow ? null : r.b.color) : 'var(--c-ash)'"></span></span>
              <span class="val" [class.win]="row.vb > row.va" [class.lose]="row.vb < row.va">{{ row.vb }}</span>
            </div>
          }
        </div>
      } @else {
        <p class="none u-empty">SELECT TWO DIFFERENT CHARACTERS</p>
      }
    </ss-modal>
  `,
  styles: `
    @use 'underground' as u;
    .pick { display: flex; gap: var(--p3); align-items: center; margin-bottom: var(--p5); }
    select { flex: 1; @include u.field; }
    .vs { font: 700 var(--fs-plaque) / 1 var(--f-display); letter-spacing: -0.125em; color: var(--c-red); text-shadow: var(--p1) var(--p1) 0 var(--c-red-d); }
    .names { display: flex; justify-content: space-between; align-items: center; gap: var(--p4); margin: 0 0 var(--p4); font: 700 var(--fs-plaque) / 1 var(--f-display); letter-spacing: -0.125em; text-shadow: var(--p1) var(--p1) 0 var(--c-void); text-transform: uppercase;
      > span:not(.vs) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
    .rows { display: grid; gap: var(--p2); }
    .row { display: grid; grid-template-columns: calc(18 * var(--px)) 1fr calc(44 * var(--px)) 1fr calc(18 * var(--px)); gap: var(--p3); align-items: center; }
    .val { text-align: right; font: var(--fs-num) / 1 var(--f-body); color: var(--c-mute); font-variant-numeric: tabular-nums; &.win { color: var(--c-white); } &.lose { color: var(--t-off); } }
    .row > .val:last-child { text-align: left; }
    // each side's bar grows outward from the stat name; the winner's is in its colour
    .bar { height: calc(5 * var(--px)); padding: var(--px); background: var(--c-void); box-shadow: inset 0 0 0 var(--px) var(--c-ink3); display: flex;
      > span { display: block; height: 100%; box-shadow: inset 0 var(--px) 0 rgb(255 255 255 / 0.45), inset 0 calc(-1 * var(--px)) 0 rgb(0 0 0 / 0.35); }
      &.a { justify-content: flex-end; } }
    .key { display: flex; gap: var(--p2); align-items: center; justify-content: center; font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-bone); white-space: nowrap;
      ::ng-deep svg { width: calc(7 * var(--px)); height: calc(7 * var(--px)); } }
    .none { margin: 0; }
    .rainbow { animation: rbw 2.4s steps(6) infinite; }
    .rainbow-bg { animation: rbw-bg 2.4s steps(6) infinite; }
    @keyframes rbw { 0%, 100% { color: #ff1f3d; } 33% { color: #45d65a; } 67% { color: #6fd2ff; } }
    @keyframes rbw-bg { 0%, 100% { background: #ff1f3d; } 33% { background: #45d65a; } 67% { background: #6fd2ff; } }
    @media (max-width: 560px) { .row { grid-template-columns: calc(14 * var(--px)) 1fr calc(9 * var(--px)) 1fr calc(14 * var(--px)); } .key { font-size: 0; gap: 0; } }
  `,
})
export class CompareModal implements OnInit {
  private readonly store = inject(CharacterStore);
  /** Who starts on the left: the open character. */
  readonly first = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly chars = computed(() => this.store.characters().filter(c => !c.isPlaceholder));
  protected readonly a = signal('');
  protected readonly b = signal('');

  ngOnInit(): void {
    this.a.set(this.first() || '');
  }

  protected readonly result = computed(() => {
    const byId = this.store.byId();
    const a = byId.get(this.a()), b = byId.get(this.b());
    if (!a || !b || a.id === b.id) return null;
    const ea = effectiveStats(a) as unknown as Record<string, number>;
    const eb = effectiveStats(b) as unknown as Record<string, number>;
    const max = Math.max(...KEYS.flatMap(k => [+(ea[k] || 0), +(eb[k] || 0)]), 1);
    const side = (c: Character) => ({ name: c.name, color: c.color || '#4aff9e', rainbow: NARA.test(c.name || '') });
    return {
      a: side(a),
      b: side(b),
      rows: KEYS.map(k => {
        const va = +(ea[k] || 0).toFixed(1), vb = +(eb[k] || 0).toFixed(1);
        return { key: k, label: LABELS[k], va, vb, pa: Math.round((va / max) * 100), pb: Math.round((vb / max) * 100) };
      }),
    };
  });
}
