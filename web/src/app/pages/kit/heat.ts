// Light that adds up: the old pages drew fire and glows with additive
// blending, so where flames overlap they burn brighter. In pixels, every
// flame adds heat to a field instead, and the field is read off a ramp at the
// end (ordered-dithered between its steps), so overlapping flames still burn
// brighter, in whole palette colours.
import { Raster, bayer } from '../raster';

export class Heat {
  buf: Float32Array;
  constructor(readonly w: number, readonly h: number) { this.buf = new Float32Array(w * h); }

  clear(): void { this.buf.fill(0); }
  /** Heat everywhere (a flash). */
  all(a: number): void { if (a > 0) for (let k = 0; k < this.buf.length; k++) this.buf[k] += a; }
  /** A full-width band from row y0 to y1 whose heat goes from a0 at y0 to a1 at y1. */
  band(y0: number, y1: number, a0: number, a1: number): void {
    const lo = Math.max(0, Math.floor(Math.min(y0, y1))), hi = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1)));
    for (let y = lo; y <= hi; y++) {
      const a = a0 + (a1 - a0) * ((y - y0) / (y1 - y0 || 1));
      if (a <= 0) continue;
      const row = y * this.w;
      for (let x = 0; x < this.w; x++) this.buf[row + x] += a;
    }
  }
  /** A disc of heat `a` (falling off towards its rim by `soft`, 0 flat to 1 to nothing). */
  disc(cx: number, cy: number, r: number, a: number, soft = 0.5): void {
    if (r < 0.5) { this.dot(cx, cy, a); return; }
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h - 1, Math.ceil(cy + r)), r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w - 1, Math.ceil(cx + r));
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, d2 = (dx * dx + dy * dy) / r2;
        if (d2 < 1) this.buf[y * this.w + x] += a * (1 - soft * d2);
      }
    }
  }
  /** A round glow: `a` at the middle falling smoothly to nothing at radius r (rx, ry for an oval). */
  glow(cx: number, cy: number, rx: number, a: number, ry = rx): void {
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    for (let y = y0; y <= y1; y++) {
      const v = (y + 0.5 - cy) / ry;
      for (let x = x0; x <= x1; x++) {
        const u = (x + 0.5 - cx) / rx, d = u * u + v * v;
        if (d < 1) { const f = 1 - Math.sqrt(d); this.buf[y * this.w + x] += a * f * f; }
      }
    }
  }
  dot(x: number, y: number, a: number): void {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.buf[y * this.w + x] += a;
  }
  /** A filled polygon (pixel centres), each pixel's heat from `a` (a number, or a function of the pixel). */
  poly(pts: readonly number[], a: number | ((x: number, y: number) => number)): void {
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
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) this.buf[y * this.w + x] += typeof a === 'number' ? a : a(x, y);
      }
    }
  }
  /** A one-pixel line of heat. */
  line(x0: number, y0: number, x1: number, y1: number, a: number): void {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.dot(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, a);
  }
}

/**
 * Reads heat off a ramp into the raster: level = 1 - e^(-heat * gain), so
 * heat piles up towards the top of the ramp without ever clipping, dithered
 * between steps. ramp[0] may be 0 to leave cold pixels as they are (on an
 * overlay, clear). `onlyAbove` leaves pixels below that level untouched.
 */
export function burn(r: Raster, h: Heat, ramp: readonly number[], gain = 2, onlyAbove = 0): void {
  const n = ramp.length - 1, px = r.px, buf = h.buf, w = r.w;
  for (let k = 0; k < buf.length; k++) {
    const v = buf[k];
    if (v <= 0) continue;
    const lv = 1 - Math.exp(-v * gain);
    if (lv < onlyAbove) continue;
    const f = lv * n, i = Math.floor(f), x = k % w, y = (k / w) | 0;
    const c = f - i > bayer(x, y) ? ramp[Math.min(n, i + 1)] : ramp[i];
    if (c) px[k] = c;
  }
}
