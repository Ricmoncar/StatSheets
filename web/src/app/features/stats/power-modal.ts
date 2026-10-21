import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Modal } from '../../ui/modal';
import { TipDirective } from '../../ui/tooltip';
import { PL_THRESHOLDS, PL_TIERS, STAT_HARD_MAX } from '../../core/game/sheet';

/** 12x12 pixel icons, one per tier ('#' is a pixel). */
const ICONS: string[][] = [
  // below average human: small, hunched
  ['............', '............', '.....##.....', '.....##.....', '....####....', '...#.##.#...', '.....##.....', '....#..#....', '....#..#....', '...##..##...', '............', '............'],
  // human
  ['....####....', '....####....', '....####....', '.....##.....', '...######...', '..#.####.#..', '..#.####.#..', '....####....', '....#..#....', '....#..#....', '...##..##...', '............'],
  // athlete: a bolt
  ['.......###..', '......###...', '.....###....', '....###.....', '...#######..', '......###...', '.....###....', '....###.....', '...##.......', '..#.........', '............', '............'],
  // street: a fist
  ['............', '...#######..', '..#.#.#.#.#.', '..#########.', '..#########.', '..########..', '...#######..', '....#####...', '....#####...', '....#####...', '............', '............'],
  // wall: bricks
  ['............', '############', '#.....#.....', '############', '...#.....#..', '############', '#.....#.....', '############', '...#.....#..', '############', '............', '............'],
  // building
  ['...######...', '...#....#...', '...#.##.#...', '...#....#...', '...#.##.#...', '...#....#...', '...#.##.#...', '...#....#...', '...#.##.#...', '...#....#...', '...#.##.#...', '############'],
  // city: a skyline
  ['............', '.........##.', '.##......##.', '.##..###.##.', '.##..#.#.##.', '###..###.###', '#.#..#.#.#.#', '###.######.#', '############', '############', '............', '............'],
  // mountain
  ['............', '.....##.....', '....####....', '...##..##...', '...#....##..', '..##.....#..', '..#..##..##.', '.##.#..#..#.', '.#.#....#.##', '############', '............', '............'],
];
const iconPath = (rows: string[]) =>
  rows.flatMap((row, y) => [...row].map((ch, x) => (ch === '#' ? `M${x} ${y}h1v1h-1z` : ''))).join('');

const DESCS = [
  'Weaker than an average adult human. Fragile, slow, and limited in all combat capacities.',
  'An ordinary, healthy adult human. No special training or abilities.',
  'A trained fighter, athlete, or skilled professional. Noticeably above the average person.',
  'Can handle threats common to city streets; gangs, armed thugs, small monsters. Peak human or lightly superhuman.',
  'Can damage or withstand the equivalent of a wall being destroyed. Clearly superhuman.',
  'Attacks and durability scale to destroying or surviving full building collapses. A major threat.',
  'Power that can devastate entire cities. A catastrophic, near-apocalyptic individual threat.',
  'Can crack or move mountains. Planetary-scale threat. Forces of nature themselves.',
];
const TITLES = ['BELOW AVERAGE HUMAN LEVEL', 'HUMAN LEVEL', 'ATHLETE / PROFICIENT LEVEL', 'STREET LEVEL', 'WALL LEVEL', 'BUILDING LEVEL', 'CITY LEVEL', 'MOUNTAIN LEVEL'];
const SHOWN = ['hp', 'atk', 'def', 'mag', 'spd'] as const;
// the top shown tier runs to the hard cap, as the old table did
const range = (stat: string, i: number) => `${PL_THRESHOLDS[stat][i]}-${i === TITLES.length - 1 ? STAT_HARD_MAX[stat] : PL_THRESHOLDS[stat][i + 1]}`;

/** The power level reference (the old POWER LEVEL MODAL): the tiers up to Mountain, with the character's own marked. */
@Component({
  selector: 'ss-power-modal',
  imports: [Modal, TipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-modal title="POWER LEVEL REFERENCE" width="620px" (closed)="closed.emit()">
      <ol class="tiers">
        @for (t of tiers; track t.title; let i = $index) {
          <li class="tier" [class.here]="i === current()" [style.--c]="t.color" tabindex="0" [ssTip]="{ title: t.title, desc: t.desc, lines: [], notes: [] }">
            <svg class="icon" viewBox="0 0 12 12" width="36" height="36" shape-rendering="crispEdges" aria-hidden="true"><path [attr.d]="t.icon" fill="currentColor" /></svg>
            <div class="text">
              <span class="title">{{ t.title }}@if (i === current()) { <em> &#9664; {{ name() }}</em> }</span>
              <span class="stats">{{ t.stats }}</span>
            </div>
          </li>
        }
      </ol>
      <p class="cap">CAPPED FOR NOW...</p>
    </ss-modal>
  `,
  styles: `
    .tiers { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .tier { --c: var(--ss-fg); display: grid; grid-template-columns: 36px 1fr; gap: 14px; align-items: center; padding: 10px 12px; border: 1px solid var(--ss-panel-2); color: var(--c);
      &:hover, &:focus-visible { border-color: var(--c); }
      &.here { border: var(--ss-border) solid var(--c); box-shadow: 4px 4px 0 color-mix(in srgb, var(--c) 35%, black); } }
    .icon { image-rendering: pixelated; }
    .text { display: grid; gap: 4px; min-width: 0; }
    .title { font-size: var(--ss-text-sm); em { font-style: normal; color: var(--ss-fg); } }
    .stats { font-size: var(--fs-ui); color: var(--ss-fg-dim); line-height: 1.8; }
    .cap { margin: 14px 0 0; text-align: center; font-size: var(--ss-text-xs); color: var(--ss-fg-faint); animation: blink 1.2s steps(2) infinite; }
    @keyframes blink { 50% { opacity: 0.3; } }
  `,
})
export class PowerModal {
  /** The tier index the character reaches (from overallPowerLevel), if any. */
  readonly tier = input<number | null>(null);
  readonly name = input('');
  readonly closed = output<void>();

  protected readonly current = computed(() => this.tier());
  protected readonly tiers = TITLES.map((title, i) => ({
    title,
    desc: DESCS[i],
    color: PL_TIERS[i].color,
    icon: iconPath(ICONS[i]),
    stats: SHOWN.map(s => `${s.toUpperCase()}: ${range(s, i)}`).join('  |  '),
  }));
}
