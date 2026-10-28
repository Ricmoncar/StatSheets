// SPIN A BADDIE: the effects over the page, in pixels. Bursts of confetti
// when something good lands, rings, the sparks a click throws (each cursor
// its own), the Apex roll's green rain. One canvas at art resolution that
// only draws while something is on it.
import { artPx } from '../../pages/host';
import { bayer } from '../../pages/raster';
import { hex } from '../../core/pixel/pixelate';
import { glyphMask } from './art';

interface Part { x: number; y: number; vx: number; vy: number; life: number; col: [number, number, number]; sz: number }
interface Ring { x: number; y: number; t0: number; dur: number; r0: number; r1: number; col: [number, number, number] }
interface Glyph { x: number; y: number; t0: number; mask: number[][]; col: [number, number, number] }
const RAIN = '0123456789';

export class Fx {
  private ctx: CanvasRenderingContext2D;
  private img: ImageData | null = null;
  private W = 0; private H = 0; private px = 3;
  private parts: Part[] = [];
  private rings: Ring[] = [];
  private glyphs: Glyph[] = [];
  private rain: { until: number; t0: number; cols: number[] } | null = null;
  private raf = 0;
  private running = false;
  private shown = false;
  private last = 0;

  constructor(private readonly cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d')!;
  }

  stop(): void { cancelAnimationFrame(this.raf); this.running = false; this.parts = []; this.rings = []; this.glyphs = []; this.rain = null; }

  /** A burst of confetti at x, y (CSS pixels): count bits, thrown with power (the old page's numbers). */
  burst(x: number, y: number, col: string, count: number, power: number): void {
    const c = hex(col), px = this.px = artPx();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.28, sp = Math.random() * power + power * 0.25;
      this.parts.push({ x: x / px, y: y / px, vx: Math.cos(a) * sp / px, vy: (Math.sin(a) * sp - 2) / px, life: 1, col: c, sz: Math.random() < 0.3 ? 2 : 1 });
    }
    this.wake();
  }
  /** A ring growing out from x, y. */
  ring(x: number, y: number, col: string, dur = 0.95, r1 = 60): void {
    const px = this.px = artPx();
    this.rings.push({ x: x / px, y: y / px, t0: performance.now() / 1000, dur, r0: 2, r1: r1 / px * 3 / 3, col: hex(col) });
    this.wake();
  }
  /** A click: a small ring and the cursor's glyphs, scattered and floating off. */
  click(x: number, y: number, glyph: string, col: string, n: number): void {
    const px = this.px = artPx(), c = hex(col), t0 = performance.now() / 1000;
    this.rings.push({ x: x / px, y: y / px, t0, dur: 0.5, r0: 3 / px, r1: 27 / px, col: c });
    const mask = glyphMask(glyph).split('\n').filter(l => l.length).map(l => [...l].map(ch => ch === 'X' ? 1 : 0));
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6, d = 14 + Math.random() * 26;
      this.glyphs.push({ x: (x + Math.cos(a) * d) / px, y: (y + Math.sin(a) * d) / px, t0, mask, col: c });
    }
    this.wake();
  }
  /** The Apex roll: green rain down the whole window for a couple of seconds. */
  matrix(): void {
    const t0 = performance.now() / 1000;
    this.rain = { t0, until: t0 + 2.4, cols: Array.from({ length: Math.ceil(innerWidth / artPx() / 5) }, () => Math.random() * innerHeight / artPx()) };
    this.wake();
  }

  private wake(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000), k = dt * 60, t = now / 1000;
    this.last = now;
    const px = this.px = artPx(), W = Math.ceil(innerWidth / px), H = Math.ceil(innerHeight / px);
    if (this.cv.width !== W || this.cv.height !== H || !this.img) { this.cv.width = W; this.cv.height = H; this.W = W; this.H = H; this.img = this.ctx.createImageData(W, H); }
    const d = this.img.data;
    d.fill(0);
    const set = (x: number, y: number, c: [number, number, number]) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const q = (y * W + x) * 4; d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
    };
    // confetti: falls, slows, and goes out by the dither
    for (const p of this.parts) { p.vy += 0.13 / px * k; p.vx *= Math.pow(0.99, k); p.x += p.vx * k; p.y += p.vy * k; p.life -= 0.011 * k; }
    this.parts = this.parts.filter(p => p.life > 0 && p.y < H + 10);
    for (const p of this.parts) {
      if (p.life < bayer(Math.round(p.x), Math.round(p.y))) continue;
      set(p.x, p.y, p.col);
      if (p.sz > 1) { set(p.x + 1, p.y, p.col); set(p.x, p.y + 1, p.col); set(p.x + 1, p.y + 1, p.col); }
    }
    // rings
    this.rings = this.rings.filter(r => t - r.t0 < r.dur);
    for (const r of this.rings) {
      const u = (t - r.t0) / r.dur, rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - u) * (1 - u)), fade = 1 - u;
      const n = Math.max(12, Math.ceil(rad * 7));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = r.x + Math.cos(a) * rad, y = r.y + Math.sin(a) * rad;
        if (fade > bayer(Math.round(x), Math.round(y))) set(x, y, r.col);
      }
    }
    // glyphs float up and fade
    this.glyphs = this.glyphs.filter(g => t - g.t0 < 0.64);
    for (const g of this.glyphs) {
      const u = (t - g.t0) / 0.64, oy = -u * 6, fade = 1 - u;
      g.mask.forEach((row, j) => row.forEach((on, i) => {
        const x = g.x - 2 + i, y = g.y - 2 + j + oy;
        if (on && fade > bayer(Math.round(x), Math.round(y)) * 0.9) set(x, y, g.col);
      }));
    }
    // the Apex rain
    if (this.rain) {
      const r = this.rain, life = (t - r.t0) / 2.4;
      if (t > r.until) this.rain = null;
      else {
        const fade = life < 0.7 ? 1 : 1 - (life - 0.7) / 0.3;
        r.cols.forEach((y, i) => {
          r.cols[i] = (y + 5 / px * k) % (H + 8);
          for (let j = 0; j < 6; j++) {
            const yy = r.cols[i] - j * 6;
            if (fade * (1 - j / 6) < bayer(i * 5, Math.round(yy))) continue;
            const ch = RAIN[(i * 7 + j * 3 + Math.floor(t * 12)) % RAIN.length], on = ch.charCodeAt(0);
            for (let b = 0; b < 15; b++) if ((on * 2654435761 >>> b) & 1) set(i * 5 + (b % 3), yy + Math.floor(b / 3), j ? [74, 220, 60] : [190, 255, 170]);
          }
        });
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    const busy = this.parts.length || this.rings.length || this.glyphs.length || this.rain;
    if (busy) { this.shown = true; this.raf = requestAnimationFrame(this.frame); }
    else { this.running = false; if (this.shown) { this.ctx.clearRect(0, 0, W, H); this.shown = false; } }
  };
}
