import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** 7x7 pixel icons for every stat ('#' is a pixel), with the old site's colours. */
const ICONS: Record<string, { color: string; rows: string[] }> = {
  hp: { color: '#44dd77', rows: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...', '.......'] },
  atk: { color: '#ff4444', rows: ['......#', '.....#.', '....#..', '#..#...', '.##....', '.##....', '#..#...'] },
  def: { color: '#4499ff', rows: ['#######', '#######', '#######', '.#####.', '.#####.', '..###..', '...#...'] },
  mag: { color: '#ff44ff', rows: ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'] },
  spd: { color: '#ffcc00', rows: ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'] },
  iq: { color: '#00bbcc', rows: ['..###..', '.#...#.', '.#...#.', '.#...#.', '..#.#..', '..###..', '..###..'] },
  heal_pow: { color: '#88ff88', rows: ['..###..', '..###..', '#######', '#######', '#######', '..###..', '..###..'] },
  crit_rate: { color: '#ff8888', rows: ['.#####.', '#.....#', '#..#..#', '#.###.#', '#..#..#', '#.....#', '.#####.'] },
  crit_dmg: { color: '#cc0000', rows: ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'] },
  status_res: { color: '#00ccaa', rows: ['#######', '#.....#', '#..#..#', '.#.#.#.', '.#...#.', '..#.#..', '...#...'] },
  dexterity: { color: '#ffff88', rows: ['.....##', '....###', '...###.', '..###..', '.###...', '##.....', '#......'] },
  resilience: { color: '#8800cc', rows: ['.##.##.', '#..#..#', '#..#..#', '.#.#.#.', '..#.#..', '...#...', '.......'] },
  true_dmg: { color: '#ffffff', rows: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'] },
  lifesteal: { color: '#aa0000', rows: ['...#...', '..###..', '.#####.', '.#####.', '#######', '#######', '.#####.'] },
  cooldown_red: { color: '#00aaff', rows: ['.#####.', '#..#..#', '#..#..#', '#..##.#', '#.....#', '#.....#', '.#####.'] },
};

const PATHS = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [
  k, v.rows.flatMap((row, y) => [...row].map((ch, x) => (ch === '#' ? `M${x} ${y}h1v1h-1z` : ''))).join(''),
]));

export const STAT_COLORS: Record<string, string> = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, v.color]));

@Component({
  selector: 'ss-stat-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 7 7" [attr.width]="size()" [attr.height]="size()" shape-rendering="crispEdges" aria-hidden="true"><path [attr.d]="path()" [attr.fill]="color()" /></svg>`,
  styles: `:host { display: inline-flex; flex: none; } svg { display: block; }`,
})
export class StatIcon {
  readonly stat = input.required<string>();
  readonly size = input(14);
  protected readonly path = computed(() => PATHS[this.stat()] || '');
  protected readonly color = computed(() => STAT_COLORS[this.stat()] || 'currentColor');
}
