import { Colours, ColourKey, KEY } from './palette';

/** A colour by palette key, a '#hex', or null for "leave clear". */
export type Ink = ColourKey | `#${string}` | null | undefined;

/** Integer hash used for stable, seeded detail in tiles and frames. */
export function hash(x: number, y = 0, z = 0): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A small seeded random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Splits a sprite grid written as lines of palette characters. */
export const rows = (grid: string): string[] => grid.split('\n').map(s => s.trim()).filter(s => s.length);

/**
 * A tiny pixel painter around a canvas: every call works in art pixels and
 * fills whole pixels, so nothing is ever anti-aliased.
 */
export class Painter {
  readonly x: CanvasRenderingContext2D;
  ox = 0;
  oy = 0;

  constructor(readonly c: HTMLCanvasElement, readonly colours: Colours) {
    this.x = c.getContext('2d')!;
    this.x.imageSmoothingEnabled = false;
  }

  col(k: Ink): string | null {
    if (k == null) return null;
    return k[0] === '#' ? k : this.colours[k as ColourKey] ?? null;
  }
  p(a: number, b: number, k: Ink): void {
    const cl = this.col(k);
    if (!cl) return;
    this.x.fillStyle = cl;
    this.x.fillRect(a + this.ox, b + this.oy, 1, 1);
  }
  r(a: number, b: number, w: number, h: number, k: Ink): void {
    const cl = this.col(k);
    if (!cl || w <= 0 || h <= 0) return;
    this.x.fillStyle = cl;
    this.x.fillRect(a + this.ox, b + this.oy, w, h);
  }
  /** Draws a grid of palette characters; `map` swaps characters for other colours. */
  g(grid: string, a = 0, b = 0, map: Record<string, Ink> = {}): void {
    rows(grid).forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        this.p(a + i, b + j, ch in map ? map[ch] : KEY[ch]);
      }
    });
  }
  line(x0: number, y0: number, x1: number, y1: number, k: Ink, dash = 0): void {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, i = 0;
    for (;;) {
      if (!dash || i++ % dash === 0) this.p(x0, y0, k);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  /** Ordered dither at four densities (0.25, 0.5, 0.75, else sparse). */
  dither(a: number, b: number, w: number, h: number, k: Ink, dens: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = a + i, Y = b + j;
      const on = dens >= 0.75 ? !((X & 1) && (Y & 1)) : dens >= 0.5 ? ((X + Y) & 1) === 0 : dens >= 0.25 ? (X & 1) === 0 && (Y & 1) === 0 : (X & 3) === 0 && (Y & 3) === 0;
      if (on) this.p(X, Y, k);
    }
  }
  ell(cx: number, cy: number, rx: number, ry: number, k: Ink): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) {
      const u = (X + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
      if (u * u + v * v <= 1) this.p(X, y, k);
    }
  }
  /** Fills a polygon by scanlines (pixel centres), for radar shapes and dice. */
  poly(pts: [number, number][], k: Ink | ((x: number, y: number) => Ink), height: number): void {
    for (let y = 0; y < height; y++) {
      const xs: number[] = [], yc = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let n = 0; n + 1 < xs.length; n += 2)
        for (let x = Math.ceil(xs[n] - 0.5); x <= Math.floor(xs[n + 1] - 0.5); x++) this.p(x, y, typeof k === 'function' ? k(x, y) : k);
    }
  }
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
