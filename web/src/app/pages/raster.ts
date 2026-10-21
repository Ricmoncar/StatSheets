// The character pages' pixel toolkit. A page draws into an indexed raster:
// every pixel is a palette index (0 is clear), set with whole-pixel
// primitives only, so nothing is ever anti-aliased. The raster is shown
// through a colour table, which means a page can drain, darken or flash its
// whole palette by changing a few dozen table entries instead of redrawing.

/** The 4x4 ordered dither, as thresholds in 0..1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
export function bayer(x: number, y: number): number { return BAYER[((y & 3) << 2) | (x & 3)]; }

/** A sprite: a small block of indices, 0 clear. */
export interface Sprite { w: number; h: number; d: Uint8Array }

/** A sprite from rows of characters; `map` says which index each character is ('.' is clear). */
export function sprite(grid: string, map: Record<string, number>): Sprite {
  const rows = grid.split('\n').map(r => r.trim()).filter(r => r.length);
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const d = new Uint8Array(w * h);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) d[y * w + x] = r[x] === '.' ? 0 : (map[r[x]] ?? 0); });
  return { w, h, d };
}

export class Raster {
  readonly px: Uint8Array;

  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint8Array(w * h);
  }

  clear(i = 0): void { this.px.fill(i); }
  copy(from: Raster): void { this.px.set(from.px); }

  get(x: number, y: number): number {
    x |= 0; y |= 0;
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : 0;
  }
  set(x: number, y: number, i: number): void {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = i;
  }
  /** Sets only where the dither pattern passes `level` (0 none, 1 all). */
  dot(x: number, y: number, i: number, level: number): void {
    x = Math.floor(x); y = Math.floor(y);
    if (level > bayer(x, y)) this.set(x, y, i);
  }

  rect(x: number, y: number, w: number, h: number, i: number): void {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w)), y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) this.px.fill(i, yy * this.w + x0, yy * this.w + Math.max(x0, x1));
  }
  /** A rectangle filled to `level` with the ordered dither. */
  dither(x: number, y: number, w: number, h: number, i: number, level: number): void {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w)), y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (level > bayer(xx, yy)) this.px[yy * this.w + xx] = i;
  }

  /** A one-pixel line (Bresenham); `i` may pick the index per pixel. */
  line(x0: number, y0: number, x1: number, y1: number, i: number | ((x: number, y: number, k: number) => number)): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, k = 0;
    for (;;) {
      const c = typeof i === 'number' ? i : i(x0, y0, k++);
      if (c) this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }

  /** A filled ellipse (pixel centres inside). */
  oval(cx: number, cy: number, rx: number, ry: number, i: number | ((x: number, y: number, u: number, v: number) => number)): void {
    if (rx <= 0 || ry <= 0) return;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const v = (y + 0.5 - cy) / ry;
      if (v * v > 1) continue;
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x + 0.5 - cx) / rx;
        if (u * u + v * v > 1) continue;
        const c = typeof i === 'number' ? i : i(x, y, u, v);
        if (c) this.set(x, y, c);
      }
    }
  }
  /** A ring between two radii. */
  ring(cx: number, cy: number, r0: number, r1: number, i: number | ((x: number, y: number, a: number, r: number) => number)): void {
    for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++) for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
      if (r < r0 || r > r1) continue;
      const c = typeof i === 'number' ? i : i(x, y, Math.atan2(dy, dx), r);
      if (c) this.set(x, y, c);
    }
  }

  /** A filled polygon by scanlines (pixel centres). */
  poly(pts: number[], i: number | ((x: number, y: number) => number)): void {
    let ymin = Infinity, ymax = -Infinity;
    for (let k = 1; k < pts.length; k += 2) { ymin = Math.min(ymin, pts[k]); ymax = Math.max(ymax, pts[k]); }
    const n = pts.length >> 1, xs: number[] = [];
    for (let y = Math.max(0, Math.floor(ymin)); y <= Math.min(this.h - 1, Math.ceil(ymax)); y++) {
      xs.length = 0;
      const yc = y + 0.5;
      for (let k = 0; k < n; k++) {
        const x0 = pts[k * 2], y0 = pts[k * 2 + 1], x1 = pts[((k + 1) % n) * 2], y1 = pts[((k + 1) % n) * 2 + 1];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) {
          const c = typeof i === 'number' ? i : i(x, y);
          if (c) this.set(x, y, c);
        }
    }
  }

  /**
   * A tube along a path: discs stamped along it, each pixel coloured by which
   * side of the path it is on relative to the light (lit, body, shade), so a
   * scroll or a swag is round and lit from one side, in three tones.
   */
  tube(pts: number[], width: (u: number) => number, tones: [number, number, number], lx: number, ly: number): void {
    const n = pts.length >> 1;
    const lm = Math.hypot(lx, ly) || 1;
    for (let k = 0; k < n - 1; k++) {
      const ax = pts[k * 2], ay = pts[k * 2 + 1], bx = pts[k * 2 + 2], by = pts[k * 2 + 3];
      const len = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(len * 2));
      for (let s = 0; s < steps; s++) {
        const f = s / steps, x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
        const r = Math.max(0.5, width((k + f) / (n - 1)) / 2);
        for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
          const dx = xx + 0.5 - x, dy = yy + 0.5 - y, d = Math.hypot(dx, dy);
          if (d > r) continue;
          const side = (dx * lx + dy * ly) / (lm * r);   // -1 away from the light, +1 toward it
          this.set(xx, yy, side > 0.4 ? tones[0] : side < -0.35 ? tones[2] : tones[1]);
        }
      }
    }
  }

  /** Copies a sprite (or another raster), clear pixels left alone; `flip` mirrors it. */
  blit(s: Sprite | Raster, x: number, y: number, flip = false, map?: Uint8Array): void {
    const d = 'd' in s ? s.d : s.px;
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < s.h; j++) {
      const yy = y + j;
      if (yy < 0 || yy >= this.h) continue;
      for (let i = 0; i < s.w; i++) {
        const v = d[j * s.w + (flip ? s.w - 1 - i : i)];
        if (!v) continue;
        const xx = x + i;
        if (xx >= 0 && xx < this.w) this.px[yy * this.w + xx] = map ? map[v] : v;
      }
    }
  }

  /** Puts a one-pixel outline round everything drawn so far (into clear neighbours). */
  outline(i: number): void {
    const { w, h, px } = this, out = px.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (px[y * w + x]) continue;
      if ((x > 0 && px[y * w + x - 1]) || (x < w - 1 && px[y * w + x + 1]) || (y > 0 && px[(y - 1) * w + x]) || (y < h - 1 && px[(y + 1) * w + x])) out[y * w + x] = i;
    }
    px.set(out);
  }
}

// ── colour tables ──
/** Packs '#rrggbb' colours for a little-endian ImageData (index 0 stays clear). */
export function table(hexes: readonly string[]): Uint32Array {
  const t = new Uint32Array(hexes.length);
  hexes.forEach((h, i) => {
    if (!i || !h) return;
    const n = parseInt(h.slice(1), 16);
    t[i] = (0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff);
  });
  return t;
}
const R = (c: number) => c & 0xff, G = (c: number) => (c >> 8) & 0xff, B = (c: number) => (c >> 16) & 0xff;
const pack = (r: number, g: number, b: number) => ((0xff << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
/** Mixes two colours from a table, `t` of the way from a to b. */
export function mix(a: number, b: number, t: number): number {
  return pack(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t);
}
/** A colour's own grey (by luminance), a little darker. */
export function grey(c: number): number {
  const l = (R(c) * 0.3 + G(c) * 0.55 + B(c) * 0.15) * 0.9;
  return pack(l, l, l * 1.04);
}

/** A table colour as CSS, for the odd pixel that is an element rather than part of a raster. */
export function css(c: number): string {
  return '#' + ((R(c) << 16) | (G(c) << 8) | B(c)).toString(16).padStart(6, '0');
}

/** Shows a raster on a canvas of the same size through a colour table. */
export class Screen {
  private img: ImageData | null = null;
  private u32: Uint32Array | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  show(r: Raster, t: Uint32Array): void {
    if (!this.img || this.img.width !== r.w || this.img.height !== r.h) {
      this.img = this.ctx.createImageData(r.w, r.h);
      this.u32 = new Uint32Array(this.img.data.buffer);
    }
    const u = this.u32!, p = r.px;
    for (let k = 0; k < p.length; k++) u[k] = t[p[k]];
    this.ctx.putImageData(this.img, 0, 0);
  }
}
