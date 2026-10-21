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
              <span class="bar a"><span [style.width.%]="row.pa" [class.rainbow-bg]="row.va > row.vb && r.a.rainbow" [style.background]="row.va > row.vb ? (r.a.rainbow ? null : r.a.color) : '#333'"></span></span>
              <span class="key"><ss-stat-icon [stat]="row.key" [size]="12" />{{ row.label }}</span>
              <span class="bar b"><span [style.width.%]="row.pb" [class.rainbow-bg]="row.vb > row.va && r.b.rainbow" [style.background]="row.vb > row.va ? (r.b.rainbow ? null : r.b.color) : '#333'"></span></span>
              <span class="val" [class.win]="row.vb > row.va" [class.lose]="row.vb < row.va">{{ row.vb }}</span>
            </div>
          }
        </div>
      } @else {
        <p class="none">SELECT TWO DIFFERENT CHARACTERS</p>
      }
    </ss-modal>
  `,
  styles: `
    .pick { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }
    select { flex: 1; min-width: 0; padding: 6px; font-size: var(--ss-text-sm); letter-spacing: 1px; background: var(--ss-panel); border: 1px solid var(--ss-line-dim); color: var(--ss-fg); }
    .vs { font-size: var(--ss-text-sm); color: var(--ss-fg-faint); }
    .names { display: flex; justify-content: space-between; gap: 12px; margin: 0 0 12px; font-size: var(--ss-text-md); letter-spacing: 2px; }
    .rows { display: grid; gap: 6px; }
    .row { display: grid; grid-template-columns: 6ch 1fr 13ch 1fr 6ch; gap: 8px; align-items: center; font-size: var(--ss-text-xs); }
    .val { text-align: right; color: var(--ss-fg-dim); &.win { color: var(--ss-fg); } &.lose { color: var(--ss-fg-faint); } }
    .row > .val:last-child { text-align: left; }
    .bar { height: 8px; background: var(--ss-panel-2); display: flex; > span { display: block; height: 100%; } &.a { justify-content: flex-end; } }
    .key { display: flex; gap: 6px; align-items: center; justify-content: center; letter-spacing: 1px; color: var(--ss-fg-dim); white-space: nowrap; }
    .none { margin: 0; padding: 24px; text-align: center; color: var(--ss-fg-faint); font-size: var(--ss-text-sm); letter-spacing: 1px; }
    .rainbow { animation: rbw 2.5s linear infinite; }
    .rainbow-bg { animation: rbw-bg 2.5s linear infinite; }
    @keyframes rbw { 0%, 100% { color: hsl(0 100% 65%); } 33% { color: hsl(120 100% 65%); } 67% { color: hsl(240 100% 70%); } }
    @keyframes rbw-bg { 0%, 100% { background: hsl(0 100% 65%); } 33% { background: hsl(120 100% 65%); } 67% { background: hsl(240 100% 70%); } }
    @media (max-width: 560px) { .row { grid-template-columns: 5ch 1fr 4ch 1fr 5ch; } .key { font-size: 0; gap: 0; } }
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
