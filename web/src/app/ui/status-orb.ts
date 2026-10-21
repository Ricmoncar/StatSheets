import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const N = 16;
const c = (N - 1) / 2;

/** Which cells of a 16x16 grid each status shape fills. */
const SHAPES: Record<string, (x: number, y: number) => boolean> = {
  circle: (x, y) => (x - c) ** 2 + (y - c) ** 2 <= 7.6 ** 2,
  diamond: (x, y) => Math.abs(x - c) + Math.abs(y - c) <= 8,
  hexagon: (x, y) => Math.abs(y - c) <= 6.6 && Math.abs(x - c) <= 7.6 - Math.abs(y - c) * 0.576,
  triangle: (x, y) => y >= 1 && Math.abs(x - c) <= (y - 0.5) * 0.52,
  star: (x, y) => {
    const a = Math.atan2(y - c, x - c), r = Math.hypot(x - c, y - c);
    const k = Math.cos(5 * (a + Math.PI / 2));
    return r <= 4 + 3.8 * Math.max(0, k) ** 1.6;
  },
  teardrop: (x, y) => ((x - c) ** 2 + (y - 9.5) ** 2 <= 5.6 ** 2) || (y < 9.5 && Math.abs(x - c) <= (y - 0.5) * 0.62),
  'rounded-square': (x, y) => {
    const dx = Math.max(0, Math.abs(x - c) - 4), dy = Math.max(0, Math.abs(y - c) - 4);
    return dx * dx + dy * dy <= 3.6 ** 2;
  },
  square: (x, y) => Math.abs(x - c) <= 6.6 && Math.abs(y - c) <= 6.6,
};

function cells(shape: string): boolean[][] {
  const inside = SHAPES[shape] || SHAPES['circle'];
  return Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => inside(x, y)));
}
const CACHE = new Map<string, { body: string; edge: string; shine: string }>();

/** The fill, a one-pixel outline and a highlight, as three SVG paths. */
function paths(shape: string): { body: string; edge: string; shine: string } {
  const hit = CACHE.get(shape);
  if (hit) return hit;
  const g = cells(shape);
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && g[y][x];
  const isEdge = (x: number, y: number) => on(x, y) && (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1));
  let body = '', edge = '', shine = '';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!g[y][x]) continue;
      const px = `M${x} ${y}h1v1h-1z`;
      if (isEdge(x, y)) edge += px;
      // a highlight just inside the upper-left rim
      else if (x < c - 1 && y < c - 1 && (isEdge(x - 1, y) || isEdge(x, y - 1))) shine += px;
      else body += px;
    }
  }
  const out = { body, edge, shine };
  CACHE.set(shape, out);
  return out;
}

/** A status effect's orb in its shape and colour, drawn as a 16x16 sprite. */
@Component({
  selector: 'ss-status-orb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 16 16" [attr.width]="size()" [attr.height]="size()" shape-rendering="crispEdges" aria-hidden="true">
      <path [attr.d]="p().body" [attr.fill]="color()" />
      <path [attr.d]="p().shine" [attr.fill]="color()" style="filter: brightness(1.5)" />
      <path [attr.d]="p().edge" [attr.fill]="color()" style="filter: brightness(0.55)" />
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; } svg { display: block; image-rendering: pixelated; }`,
})
export class StatusOrb {
  readonly shape = input<string | null | undefined>('circle');
  readonly color = input<string | null | undefined>('#aaaaaa');
  readonly size = input(48);
  protected readonly p = computed(() => paths(this.shape() || 'circle'));
}
