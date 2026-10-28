// SPIN A BADDIE: the theme's animated backdrop, in pixels. The four modes of
// the old page (nebula, matrix, embers, cupcakes) drawn at art resolution:
// the colour gradients and the soft glows come out as ordered dither in a
// few steps, the stars are single pixels, the matrix rain is a tiny pixel
// font. The slow parts (the gradient and the nebula's glows) are drawn a few
// times a second; the rest every frame.
import { artPx } from '../../pages/host';
import { bayer } from '../../pages/raster';
import { hex } from '../../core/pixel/pixelate';
import { ThemeDef } from './data';

type RGB = [number, number, number];
const STEP = 24;   // colours are kept to steps of this much, with the dither between

function hslRgb(h: number, s: number, l: number): RGB {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** 3 by 5 glyphs for the rain, made up as it falls (the old page used katakana). */
const RAIN = Array.from({ length: 24 }, (_, i) => {
  const bits: number[] = [];
  let s = i * 7919 + 13;
  for (let k = 0; k < 15; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; bits.push((s >> 16) & 1); }
  bits[1] = 1; bits[13] = 1;
  return bits;
});

export class Backdrop {
  private ctx: CanvasRenderingContext2D;
  private img: ImageData | null = null;
  private base: Float32Array = new Float32Array(0);   // the slow layer, RGB
  private trail: Float32Array = new Float32Array(0);  // the matrix's fading buffer
  private W = 0; private H = 0; private px = 3;
  private theme: ThemeDef | null = null;
  private stars: { x: number; y: number; z: number; tw: number }[] = [];
  private orbs: { x: number; y: number; r: number; ci: number; vx: number; vy: number }[] = [];
  private cols: { x: number; y: number; sp: number; g: number }[] = [];
  private embers: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private cakes: { x: number; y: number; vy: number; ph: number }[] = [];
  private t = 0;
  private baseAt = -1;
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(private readonly cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d')!;
  }

  setTheme(t: ThemeDef): void {
    this.theme = t;
    this.build();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const small = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
    const ms = small ? 1000 / 15 : 1000 / 30;
    const loop = () => {
      this.raf = requestAnimationFrame(() => {
        if (!document.hidden) this.frame(ms / 1000);
        this.timer = setTimeout(loop, ms);
      });
    };
    loop();
  }
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
  }

  private size(): boolean {
    const px = artPx(), W = Math.ceil(innerWidth / px), H = Math.ceil(innerHeight / px);
    if (W === this.W && H === this.H && px === this.px) return false;
    this.W = W; this.H = H; this.px = px;
    this.cv.width = W; this.cv.height = H;
    this.img = this.ctx.createImageData(W, H);
    this.base = new Float32Array(W * H * 3);
    this.trail = new Float32Array(W * H * 3);
    this.build();
    return true;
  }

  private build(): void {
    const { W, H } = this, t = this.theme;
    if (!t || !W) return;
    this.stars = Array.from({ length: Math.min(170, Math.floor(W * this.px / 8)) }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * 0.85 + 0.15, tw: Math.random() * 6.28 }));
    this.orbs = Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: Math.random() * 0.16 + 0.16, ci: i % t.pal.length, vx: (Math.random() - 0.5) * 0.00009, vy: (Math.random() - 0.5) * 0.00009 }));
    this.cols = Array.from({ length: Math.ceil(W / 5) }, (_, i) => ({ x: i * 5, y: Math.random() * H, sp: (Math.random() * 7 + 3) / this.px, g: 0 }));
    this.embers = Array.from({ length: 70 }, () => this.ember(true));
    this.cakes = Array.from({ length: 16 }, () => this.cake(true));
    this.trail.fill(0);
    if (t.mode === 'matrix') for (let i = 0; i < this.trail.length; i += 3) { this.trail[i + 1] = 6; }
    this.baseAt = -1;
  }
  private ember(any: boolean) { const { W, H } = this; return { x: Math.random() * W, y: any ? Math.random() * H : H + 3, vy: -(Math.random() * 0.8 + 0.4) / this.px, vx: (Math.random() - 0.5) * 0.3 / this.px, life: Math.random() * 0.6 + 0.4 }; }
  private cake(any: boolean) { const { W, H } = this; return { x: Math.random() * W, y: any ? Math.random() * H : H + 8, vy: -(Math.random() * 0.45 + 0.2) / this.px, ph: Math.random() * 6.28 }; }

  /** The gradient top to bottom, and for the nebula its glows: the slow layer. */
  private paintBase(): void {
    const { W, H } = this, t = this.theme!, b = this.base;
    const g = t.grad.map(hex), stops = [[0, g[0]], [0.55, g[1] || g[0]], [1, g[2] || g[1] || g[0]]] as [number, RGB][];
    const row: RGB[] = [];
    for (let y = 0; y < H; y++) {
      const f = y / Math.max(1, H - 1);
      const k = f < 0.55 ? 0 : 1, [f0, c0] = stops[k], [f1, c1] = stops[k + 1], u = (f - f0) / (f1 - f0);
      row.push([c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u]);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; b[o] = row[y][0]; b[o + 1] = row[y][1]; b[o + 2] = row[y][2]; }
    if (t.mode === 'nebula') {
      // the glows, added the way the old page added them (lighter), each fading to nothing at its edge
      const M = Math.max(W, H);
      for (const o of this.orbs) {
        o.x += o.vx * 15; o.y += o.vy * 15;   // fifteen of the old page's frames between paints
        if (o.x < -0.3 || o.x > 1.3) o.vx *= -1;
        if (o.y < -0.3 || o.y > 1.3) o.vy *= -1;
        const col = t.pastel ? hslRgb((this.t * 40 + o.ci * 60) % 360, 95, 72) : hex(t.pal[o.ci]);
        const a0 = t.pastel ? 0.5 : 0.34, R = o.r * M * (t.pastel ? 1.25 : 1), cx = o.x * W, cy = o.y * H;
        const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H, Math.ceil(cy + R));
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const d = Math.hypot(x - cx, y - cy) / R;
          if (d >= 1) continue;
          const a = a0 * (1 - d), p = (y * W + x) * 3;
          b[p] += col[0] * a; b[p + 1] += col[1] * a; b[p + 2] += col[2] * a;
        }
      }
      if (t.texas) this.texasStar();
    }
  }
  /** A faint white star, Texas's. */
  private texasStar(): void {
    const { W, H } = this, b = this.base, cx = W * 0.82, cy = H * 0.24, o = Math.min(W, H) * 0.13, i = Math.min(W, H) * 0.055;
    const pts: [number, number][] = [];
    for (let k = 0; k < 10; k++) { const r = k % 2 ? i : o, a = Math.PI / 5 * k - Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    for (let y = Math.floor(cy - o); y <= cy + o; y++) {
      if (y < 0 || y >= H) continue;
      const xs: number[] = [];
      for (let k = 0; k < 10; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % 10], yc = y + 0.5;
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, c) => a - c);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]); x <= xs[k + 1] && x < W; x++) {
        if (x < 0) continue;
        const p = (y * W + x) * 3;
        b[p] += 255 * 0.07; b[p + 1] += 255 * 0.07; b[p + 2] += 255 * 0.07;
      }
    }
  }

  frame(dt: number): void {
    const t = this.theme;
    if (!t) return;
    const grew = this.size();
    const { W, H } = this, d = this.img!.data;
    this.t += dt;
    const k = dt * 60;   // the old page moved things per frame at 60
    if (t.mode !== 'matrix' && (grew || this.baseAt < 0 || this.t - this.baseAt > 0.25)) { this.paintBase(); this.baseAt = this.t; }
    const out = t.mode === 'matrix' ? this.trail : this.base;
    // the layer, posterised with the dither
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3, q = (y * W + x) * 4, th = bayer(x, y) * STEP;
      d[q] = Math.min(255, Math.floor((out[p] + th) / STEP) * STEP);
      d[q + 1] = Math.min(255, Math.floor((out[p + 1] + th) / STEP) * STEP);
      d[q + 2] = Math.min(255, Math.floor((out[p + 2] + th) / STEP) * STEP);
      d[q + 3] = 255;
    }
    const set = (x: number, y: number, r: number, g: number, b: number) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const q = (y * W + x) * 4; d[q] = r; d[q + 1] = g; d[q + 2] = b;
    };
    if (t.mode === 'nebula') {
      for (const s of this.stars) {
        s.y -= s.z * 0.0004 * k;
        if (s.y < 0) { s.y = 1; s.x = Math.random(); }
        const a = (0.4 + 0.6 * Math.abs(Math.sin(this.t * 1.6 + s.tw))) * s.z;
        if (a < bayer(Math.round(s.x * W), Math.round(s.y * H)) * 0.9) continue;
        const v = a > 0.6 ? 1 : 0.7;
        set(s.x * W, s.y * H, 234 * v, 242 * v, 255 * v);
        if (s.z > 0.8 && a > 0.75) set(s.x * W + 1, s.y * H, 180, 190, 220);
      }
    } else if (t.mode === 'matrix') {
      // the trail fades toward the dark green, and each column drops a glyph
      const tr = this.trail, f = Math.pow(0.88, k);
      for (let i = 0; i < tr.length; i += 3) { tr[i] *= f; tr[i + 1] = 8 + (tr[i + 1] - 8) * f; tr[i + 2] *= f; }
      for (const c of this.cols) {
        c.y += c.sp * k;
        if (c.y > H + Math.random() * 60) { c.y = 0; c.sp = (Math.random() * 7 + 3) / this.px; }
        const yy = Math.floor(c.y);
        if (yy === c.g) continue;
        c.g = yy;
        const g = RAIN[Math.floor(Math.random() * RAIN.length)], g2 = RAIN[Math.floor(Math.random() * RAIN.length)];
        for (let j = 0; j < 15; j++) {
          const gx = c.x + (j % 3), gy = yy + Math.floor(j / 3);
          if (g[j] && gy >= 0 && gy < H) { const p = (gy * W + gx) * 3; tr[p] = 190; tr[p + 1] = 255; tr[p + 2] = 190; }
          const hy = gy - 6;
          if (g2[j] && hy >= 0 && hy < H) { const p = (hy * W + gx) * 3; tr[p] = Math.max(tr[p], 0); tr[p + 1] = Math.max(tr[p + 1], 140); tr[p + 2] = Math.max(tr[p + 2], 50); }
        }
      }
    } else if (t.mode === 'embers') {
      // the glow coming up from below, and the embers in it
      for (let y = Math.floor(H * 0.5); y < H; y++) {
        const a = ((y - H * 0.5) / (H * 0.5)) * 0.3;
        for (let x = 0; x < W; x++) {
          if (a < bayer(x, y) * 0.3) continue;
          const q = (y * W + x) * 4;
          d[q] = Math.min(255, d[q] + 70); d[q + 1] = Math.min(255, d[q + 1] + 22); d[q + 2] = Math.min(255, d[q + 2] + 5);
        }
      }
      for (const e of this.embers) {
        e.x += e.vx * k; e.y += e.vy * k; e.life -= 0.004 * k;
        if (e.y < -3 || e.life <= 0) Object.assign(e, this.ember(false));
        if (e.life < bayer(Math.round(e.x), Math.round(e.y))) continue;
        set(e.x, e.y, 255, 154 + (e.life > 0.7 ? 60 : 0), 60);
      }
    } else {
      for (const c of this.cakes) {
        c.y += c.vy * k; c.ph += 0.03 * k;
        if (c.y < -10) Object.assign(c, this.cake(false));
        this.cupcake(d, Math.round(c.x + Math.sin(c.ph) * 1.5), Math.round(c.y));
      }
    }
    this.ctx.putImageData(this.img!, 0, 0);
  }

  /** A cupcake, seven pixels wide, half seen. */
  private cupcake(d: Uint8ClampedArray, cx: number, cy: number): void {
    const { W, H } = this;
    const C = ['', '#c8884a', '#8a4a2a', '#e84a64'].map(c => c ? hex(c) : null);
    const rows = ['...3...', '.22222.', '2222222', '1111111', '.11111.', '.11111.', '..111..'];
    rows.forEach((r, j) => {
      for (let i = 0; i < 7; i++) {
        const c = C[+r[i] || 0];
        if (!c) continue;
        const x = cx - 3 + i, y = cy + j;
        if (x < 0 || y < 0 || x >= W || y >= H || 0.55 < bayer(x, y)) continue;
        const q = (y * W + x) * 4;
        d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2];
      }
    });
  }
}
