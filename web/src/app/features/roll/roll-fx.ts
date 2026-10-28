// THE TRAIT ROLL's effects, in pixels: the bursts a card throws as it lands,
// rings, and the rays that turn behind a high card. Two canvases at art
// resolution, the rays behind the cards and the rest in front, drawing only
// while something is on them.
import { FIXED } from '../../core/pixel/palette';
import { hex } from '../../core/pixel/pixelate';
import { artPx } from '../../pages/host';
import { bayer } from '../../pages/raster';

type RGB = [number, number, number];
interface Part { x: number; y: number; vx: number; vy: number; life: number; fade: number; col: RGB; sz: number }
interface Ring { x: number; y: number; t0: number; dur: number; r1: number; col: RGB }
interface Rays { el: HTMLElement; cols: RGB[]; t0: number; n: number }

/** Each rarity's colours, brightest first: the bursts, rings and rays use them. */
export const RARITY_INKS: Record<string, string[]> = {
  common: [FIXED.white, FIXED.mt3, FIXED.mt2],
  rare: [FIXED.fr1, FIXED.ec2, FIXED.ec1],
  epic: [FIXED.vi3, FIXED.vi2, FIXED.vi1],
  legendary: [FIXED.white, FIXED.yel, FIXED.em3],
  mythic: [FIXED.em3, FIXED.em2, FIXED.em1],
  hexxed: [FIXED.vi3, FIXED.vi2, FIXED.red],
  duality: [FIXED.white, FIXED.fr1, FIXED.red],
  determined: [FIXED.white, FIXED.red, FIXED['red-d']],
};

export class RollFx {
  private readonly bctx: CanvasRenderingContext2D;
  private readonly fctx: CanvasRenderingContext2D;
  private bimg: ImageData | null = null;
  private fimg: ImageData | null = null;
  private parts: Part[] = [];
  private rings: Ring[] = [];
  private rays: Rays[] = [];
  private raf = 0;
  private running = false;
  private shown = false;
  private last = 0;

  constructor(private readonly back: HTMLCanvasElement, private readonly front: HTMLCanvasElement) {
    this.bctx = back.getContext('2d')!;
    this.fctx = front.getContext('2d')!;
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.running = false;
    this.parts = []; this.rings = []; this.rays = [];
    this.bctx.clearRect(0, 0, this.back.width, this.back.height);
    this.fctx.clearRect(0, 0, this.front.width, this.front.height);
  }

  /** A burst from an element's middle: count bits in the colours given, thrown with power (CSS pixels a frame). */
  burst(el: Element, cols: string[], count: number, power: number): void {
    const r = el.getBoundingClientRect(), px = artPx(), cx = (r.left + r.width / 2) / px, cy = (r.top + r.height / 2) / px;
    const hw = r.width / px / 2, hh = r.height / px / 2;
    for (let i = 0; i < count; i++) {
      // from all round the card's edge, outward
      const a = Math.random() * Math.PI * 2, ex = Math.cos(a), ey = Math.sin(a);
      const k = Math.min(hw / Math.abs(ex || 1e-6), hh / Math.abs(ey || 1e-6));
      const sp = (Math.random() * power + power * 0.35) / px;
      this.parts.push({
        x: cx + ex * k * 0.9, y: cy + ey * k * 0.9, vx: ex * sp, vy: ey * sp - 1.2 / px,
        life: 1, fade: 0.012 + Math.random() * 0.01, col: hex(cols[i % cols.length]), sz: Math.random() < 0.35 ? 2 : 1,
      });
    }
    this.wake();
  }

  /** A ring growing out from an element's middle. */
  ring(el: Element, col: string, dur = 0.7): void {
    const r = el.getBoundingClientRect(), px = artPx();
    this.rings.push({ x: (r.left + r.width / 2) / px, y: (r.top + r.height / 2) / px, t0: performance.now() / 1000, dur, r1: Math.max(r.width, r.height) / px * 0.85, col: hex(col) });
    this.wake();
  }

  /** Rays turning behind an element until clearRays(). */
  addRays(el: HTMLElement, cols: string[], n = 12): void {
    this.rays = this.rays.filter(r => r.el !== el);
    this.rays.push({ el, cols: cols.map(hex), t0: performance.now() / 1000, n });
    this.wake();
  }
  clearRays(): void { this.rays = []; }

  private wake(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000), k = dt * 60, t = now / 1000;
    this.last = now;
    const px = artPx(), W = Math.ceil(innerWidth / px), H = Math.ceil(innerHeight / px);
    // where the cards are, read before anything is drawn
    const rects = this.rays.filter(r => r.el.isConnected).map(r => ({ r, b: r.el.getBoundingClientRect() }));
    if (this.front.width !== W || this.front.height !== H || !this.fimg || !this.bimg) {
      this.front.width = this.back.width = W; this.front.height = this.back.height = H;
      this.fimg = this.fctx.createImageData(W, H); this.bimg = this.bctx.createImageData(W, H);
    }
    const fd = this.fimg.data, bd = this.bimg.data;
    fd.fill(0);
    const set = (d: Uint8ClampedArray, x: number, y: number, c: RGB) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const q = (y * W + x) * 4; d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
    };

    // bits: thrown out, pulled down, slowed, and gone by the dither
    for (const p of this.parts) { p.vy += 0.09 / px * k; p.vx *= Math.pow(0.975, k); p.vy *= Math.pow(0.985, k); p.x += p.vx * k; p.y += p.vy * k; p.life -= p.fade * k; }
    this.parts = this.parts.filter(p => p.life > 0 && p.y < H + 4);
    for (const p of this.parts) {
      if (p.life < bayer(Math.round(p.x), Math.round(p.y)) * 0.9) continue;
      set(fd, p.x, p.y, p.col);
      if (p.sz > 1) { set(fd, p.x + 1, p.y, p.col); set(fd, p.x, p.y + 1, p.col); set(fd, p.x + 1, p.y + 1, p.col); }
    }
    this.rings = this.rings.filter(r => t - r.t0 < r.dur);
    for (const r of this.rings) {
      const u = (t - r.t0) / r.dur, rad = 4 + (r.r1 - 4) * (1 - (1 - u) * (1 - u)), fade = 1 - u;
      const n = Math.max(16, Math.ceil(rad * 7));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = r.x + Math.cos(a) * rad, y = r.y + Math.sin(a) * rad;
        if (fade > bayer(Math.round(x), Math.round(y))) set(fd, x, y, r.col);
      }
    }
    this.fctx.putImageData(this.fimg, 0, 0);

    // rays: wedges turning slowly round the card, fading out by the dither
    if (rects.length || this.shown) {
      bd.fill(0);
      for (const { r, b } of rects) {
        // out from the card's edges, as far as REACH beyond them, thinning out by the dither
        const REACH = 18, cx = (b.left + b.width / 2) / px, cy = (b.top + b.height / 2) / px, hw = b.width / px / 2, hh = b.height / px / 2;
        const grow = Math.min(1, (t - r.t0) / 0.35), turn = (t - r.t0) * 0.05;
        const x0 = Math.max(0, Math.floor(cx - hw - REACH)), x1 = Math.min(W - 1, Math.ceil(cx + hw + REACH)), y0 = Math.max(0, Math.floor(cy - hh - REACH)), y1 = Math.min(H - 1, Math.ceil(cy + hh + REACH));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const dx = x - cx, dy = y - cy, out = Math.max(Math.abs(dx) - hw, Math.abs(dy) - hh);
          if (out < -2 || out > REACH * grow) continue;
          const u = (Math.atan2(dy * hw / hh, dx) / (Math.PI * 2) + turn) * r.n, ray = Math.floor(u), f = u - ray;
          if (f > 0.4) continue;
          if ((1 - Math.max(0, out) / REACH) * 0.75 < bayer(x, y)) continue;
          set(bd, x, y, r.cols[((ray % r.cols.length) + r.cols.length) % r.cols.length]);
        }
      }
      this.bctx.putImageData(this.bimg, 0, 0);
    }
    this.rays = rects.map(x => x.r);

    const busy = this.parts.length || this.rings.length || this.rays.length;
    if (busy) { this.shown = true; this.raf = requestAnimationFrame(this.frame); }
    else {
      this.running = false;
      if (this.shown) { this.fctx.clearRect(0, 0, W, H); this.bctx.clearRect(0, 0, W, H); this.shown = false; }
    }
  };
}
