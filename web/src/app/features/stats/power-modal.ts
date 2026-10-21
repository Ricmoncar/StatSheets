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
            <svg class="icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><path [attr.d]="t.icon" fill="currentColor" /></svg>
            <div class="text">
              <span class="title">{{ t.title }}@if (i === current()) { <em><i class="u-spr s-soul" aria-hidden="true"></i>{{ name() }}</em> }</span>
              <span class="stats">{{ t.stats }}</span>
            </div>
          </li>
        }
      </ol>
      <p class="cap">CAPPED FOR NOW...</p>
    </ss-modal>
  `,
  styles: `
    .tiers { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--p2); }
    // a menu of tiers: the one the character reaches is lit, with the SOUL beside the name
    .tier { --c: var(--c-white); display: grid; grid-template-columns: calc(12 * var(--px)) minmax(0, 1fr); gap: var(--p4); align-items: center; padding: var(--p2) var(--p3); color: var(--c); background: var(--c-ink2);
      &:hover, &:focus-visible { background: var(--c-ink3); }
      &.here { background: var(--c-ink); box-shadow: inset var(--p1) 0 0 var(--c), 0 0 0 var(--px) var(--c); } }
    .icon { width: calc(12 * var(--px)); height: calc(12 * var(--px)); }
    .text { display: grid; gap: var(--p1); min-width: 0; }
    .title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--p2) var(--p3); font: var(--fs-ui) / 20px var(--f-ui); text-transform: uppercase;
      em { display: inline-flex; align-items: center; gap: var(--p2); font-style: normal; color: var(--c-white); } }
    .stats { font: var(--fs-small) / 20px var(--f-body); color: var(--c-mute); }
    .cap { margin: var(--p4) 0 0; text-align: center; font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-mute); animation: blink 1.2s steps(2) infinite; }
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
