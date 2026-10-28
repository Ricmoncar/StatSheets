// RIEGEN · THE PHOENIX: the page. Behind the sheet, the ember sky: sparks
// rising, burning feathers drifting down, and the phoenix sweeping round the
// middle of the sky, every 22 seconds burning out to ash in a ring of sparks
// and blazing back. Over the window, the burning feather you hold: it sheds
// sparks as it goes, flares at a click, and each click lets a small firebird
// go that rises and dissolves. All as the old page had it.
import { Raster } from '../raster';
import { artPx } from '../host';
import { PageOverlay } from '../kit/overlay';
import { Scene, sceneModule } from '../kit/scene';
import { Xf, alpha, bez2, bez3, glow, shape, shapeOval, stopAt, vgrad } from '../kit/paint';
import { C, P, drawPhoenix } from './look';

const TAU = Math.PI * 2;
const rgHash = (i: number) => { const v = Math.sin(i * 73.91 + 3.3) * 43758.5453; return v - Math.floor(v); };
const DN1 = P.shiftMap(-1), DN2 = P.shiftMap(-2);

class Sky implements Scene {
  private W = 0; private H = 0; private px = 3;
  private bg = new Raster(1, 1);
  /** How many steps darker each pixel goes under the heat vignette (0, 1 or 2). */
  private vig = new Uint8Array(0);

  colours(): Uint32Array { return P.table; }

  size(W: number, H: number): void {
    this.W = W; this.H = H; this.px = artPx();
    const bg = this.bg = new Raster(W, H);
    // the old sky's stops: black at the top, smoulder by the middle, ember at the horizon
    vgrad(bg, 0, 0, W, H * 0.55 + 1, [C['s1'], C['s2'], C['s3']]);
    vgrad(bg, 0, H * 0.55, W, H * 0.3 + 1, [C['s3'], C['s4'], C['s5']]);
    vgrad(bg, 0, H * 0.85, W, H * 0.15 + 1, [C['s5'], C['s6'], C['s7']]);
    this.vig = new Uint8Array(W * H);
    const cx = W * 0.5, cy = H * 0.47, r0 = Math.min(W, H) * 0.25, r1 = Math.max(W, H) * 0.75;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const lv = Math.max(0, (Math.hypot(x - cx, y - cy) - r0) / (r1 - r0)) * 1.4;
      const b = ((y & 3) * 4 + (x & 3) + 0.5) / 16;
      this.vig[y * W + x] = lv > 1 + b * 0.8 ? 2 : lv > b ? 1 : 0;
    }
  }

  draw(r: Raster, t: number): void {
    const { W, H, px } = this, Wc = W * px, Hc = H * px;
    r.copy(this.bg);
    // sparks rising
    for (let i = 0; i < 36; i++) {
      const sd = i * 0.618, spd = 22 + (sd % 18);
      const x = (((sd * 2.73) % 1) * Wc + Math.sin(t * 0.8 + i) * 18) / px, y = (Hc - ((t * spd + sd * Hc) % (Hc + 20))) / px;
      const al = 0.16 + (sd % 0.3) * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)));
      const c = (i * 37) % 70 > 40 ? C['f6'] : C['f5'];
      r.dot(x, y, c, al * 2.6);
      if (0.9 + (sd % 1.3) > 1.8) r.dot(x, y - 1, C['f4'], al * 2);
    }
    // burning feathers drifting down
    for (let k = 0; k < 5; k++) {
      const sd = k * 1.618, cyc = 14 + (sd % 6), ph = ((t * 0.55 + sd * 3.7) % cyc) / cyc;
      const f: Xf = { x: (((sd * 2.236) % 1) * Wc + Math.sin(t * 0.7 + k * 2) * 30) / px, y: (ph * (Hc + 70) - 35) / px, a: Math.sin(t * 1.1 + k) * 0.7 + 0.5, s: 1.3 / px };
      const fa = Math.sin(ph * Math.PI) * 0.75;
      const vane = [0, -9];
      bez2(vane, 0, -9, 5, -3, 1.6, 8); bez2(vane, 1.6, 8, 0, 9.5, -1.6, 8); bez2(vane, -1.6, 8, -5, -3, 0, -9);
      shape(r, f, vane, alpha(C['f2'], fa + 0.1));
      shape(r, f, [-0.5, -9, 0.5, -9, 0.5, 9, -0.5, 9], alpha(C['f5'], fa + 0.1));
      const fl = 0.6 + Math.sin(t * 9 + k * 3) * 0.25, tip = [-2, -8];
      bez2(tip, -2, -8, 0, -15 - fl * 4, 2, -8);
      shape(r, f, tip, alpha(C['f6'], fl * fa + 0.1));
    }
    // the phoenix: soar, burn out, ash, rebirth, every 22 seconds
    const T = 22, ph = (t % T) / T;
    const pos = (tt: number): [number, number] => [(Wc * 0.5 + Math.sin(tt * 0.3) * Wc * 0.34) / px, (Hc * 0.34 + Math.sin(tt * 0.6 + 1.2) * Hc * 0.16 + Math.cos(tt * 0.23) * Hc * 0.07) / px];
    const [bx, by] = pos(t), [bx2, by2] = pos(t + 0.05);
    const ang = Math.atan2(by2 - by, bx2 - bx);
    let scale = 1.6, gl = 0, alive = true;
    if (ph > 0.78 && ph <= 0.86) { const k = (ph - 0.78) / 0.08; scale = 1.6 * (1 - k * 0.85); gl = -k; }
    else if (ph > 0.86 && ph <= 0.92) alive = false;
    else if (ph > 0.92) { const k = (ph - 0.92) / 0.08; scale = 1.6 * (0.2 + 0.8 * k); gl = 1 - k; }
    // the ring of sparks as it burns out and comes back
    if (ph > 0.8 && ph < 0.97) {
      const k = Math.min(1, (ph - 0.8) / 0.17), rr = (k * 130) / px;
      r.ring(bx, by, rr - 0.6, rr + 0.6, alpha(C['f5'], 0.8 * (1 - k) + 0.1));
      for (let a = 0; a < 14; a++) {
        const aa = a * (TAU / 14) + k * 1.2, ar = rr * (0.55 + rgHash(a) * 0.5), rad = (1.6 + rgHash(a * 3) * 2) / px;
        r.oval(bx + Math.cos(aa) * ar, by + Math.sin(aa) * ar, Math.max(0.7, rad), Math.max(0.7, rad), alpha((a * 31) % 90 > 45 ? C['f6'] : C['f4'], 0.95 * (1 - k) + 0.1));
      }
    }
    // the rebirth flash
    if (ph > 0.9 && ph < 0.95) glow(r, bx, by, 90 / px, C['f7'], (1 - Math.abs((ph - 0.925) / 0.025)) * 0.9);
    if (alive) {
      // its flame trail along the way it came
      for (let k = 1; k <= 7; k++) {
        const [tx, ty] = pos(t - k * 0.085), ta = (1 - k / 8) * 0.55 * (gl >= 0 ? 1 : 1 + gl), rad = (7 - k * 0.7) / px;
        if (ta > 0) r.oval(tx, ty, rad, rad, alpha(k < 3 ? C['f4'] : C['f3'], ta));
      }
      drawPhoenix(r, { x: bx, y: by, a: ang, s: scale / px, flip: Math.cos(ang) < 0 ? -1 : 1 }, t * 7.5, t, Math.max(0, gl));
    }
    // the heat vignette
    const p8 = r.px, vig = this.vig;
    for (let k = 0; k < p8.length; k++) { const v = vig[k]; if (v) p8[k] = v === 2 ? DN2[p8[k]] : DN1[p8[k]]; }
  }
}

interface Spark { bird: boolean; x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; flap: number }

class Feather extends PageOverlay {
  private sx = 0; private sy = 0;
  private parts: Spark[] = [];
  private flare = 0;
  private acc = 0;

  constructor() { super('pg-riegen_phoenix', () => P.table); }

  protected override begin(): void { this.parts = []; this.flare = 0; this.acc = 0; this.sx = this.mx; this.sy = this.my; }

  protected override press(): void {
    const x = this.mx, y = this.my;
    this.flare = 1;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU, s = 70 + Math.random() * 160;
      this.push({ bird: false, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 1, max: 0.5 + Math.random() * 0.5, r: 1.5 + Math.random() * 2.2, flap: 0 });
    }
    // a small firebird rises from the click and dissolves
    this.push({ bird: true, x, y, vx: (Math.random() - 0.5) * 60, vy: -120 - Math.random() * 60, life: 1, max: 1.4, r: 0, flap: Math.random() * TAU });
  }
  private push(p: Spark): void { this.parts.push(p); if (this.parts.length > 240) this.parts.shift(); }

  protected frame(r: Raster, t: number, dt: number): boolean {
    const px = this.px;
    this.sx += (this.mx - this.sx) * Math.min(1, dt * 16);
    this.sy += (this.my - this.sy) * Math.min(1, dt * 16);
    const vx = this.mx - this.sx, vy = this.my - this.sy;
    this.flare = Math.max(0, this.flare - dt * 2.2);
    // the feather's flame sheds sparks as it goes
    if (this.mouse) {
      this.acc += dt;
      while (this.acc > 0.05) {
        this.acc -= 0.05;
        this.push({ bird: false, x: this.mx + (Math.random() - 0.5) * 6, y: this.my - 14, vx: (Math.random() - 0.5) * 26 - vx * 0.4, vy: -30 - Math.random() * 30 - vy * 0.3, life: 1, max: 0.45 + Math.random() * 0.4, r: 1 + Math.random() * 1.6, flap: 0 });
      }
    }
    for (const p of this.parts) {
      p.life -= dt / p.max;
      if (p.life <= 0) continue;
      const al = Math.min(1, p.life);
      if (!p.bird) {
        p.vy += 26 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const c = al > 0.6 ? C['f7'] : al > 0.3 ? C['f5'] : C['f2'];
        r.dot(p.x / px, p.y / px, c, al + 0.25);
        if (p.r * (0.5 + al * 0.5) > 1.8) r.dot(p.x / px + 1, p.y / px, C['f4'], al);
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 - 0.25 * dt;
        drawPhoenix(r, { x: p.x / px, y: p.y / px, a: -0.2 * Math.sign(p.vx || 1), s: (0.45 * (0.6 + al * 0.4)) / px, flip: 1 }, t * 14 + p.flap, t, al * 0.6, al);
      }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    if (!this.mouse) return this.parts.length > 0;

    // the burning feather, leaning with the way it moves
    const f: Xf = { x: this.mx / px, y: this.my / px, a: Math.max(-0.5, Math.min(0.5, vx * 0.012)) + Math.sin(t * 2.2) * 0.06, s: 1.2 / px };
    const fl = 1 + Math.sin(t * 11) * 0.18 + Math.sin(t * 23) * 0.1 + this.flare * 1.6;
    // the glow round the flame first, then the vane over it
    const [gx, gy] = [f.x + Math.sin(f.a) * 18 * f.s, f.y - Math.cos(f.a) * 18 * f.s];
    glow(r, gx, gy, 14 * fl * f.s, C['f5'], 0.7);
    glow(r, gx, gy, 7 * fl * f.s, C['f7'], 0.8);
    const vane = [0, -16];
    bez3(vane, 0, -16, 8, -8, 7, 4, 2, 14); bez2(vane, 2, 14, 0, 16.5, -2, 14); bez3(vane, -2, 14, -7, 4, -8, -8, 0, -16);
    shape(r, f, vane, (x, y, _u, v) => stopAt([C['f6'], C['f5'], C['f3'], C['f2'], C['f1']], (v + 16) / 32, x, y));
    for (let k = -2; k <= 2; k++) {
      const p = [0, k * 5 - 4, k < 0 ? -4.5 : 4.5, k * 5 - 1, k < 0 ? -4.5 : 4.5, k * 5, 0, k * 5 - 3];
      shape(r, f, p, alpha(C['f1'], 0.6));
    }
    shape(r, f, [-0.6, -15, 0.6, -15, 0.6, 18, -0.6, 18], C['f7']);
    const flame = [-3.5, -14];
    bez2(flame, -3.5, -14, -4 - Math.sin(t * 13) * 2, -22 - fl * 4, 0, -26 - fl * 5);
    bez2(flame, 0, -26 - fl * 5, 4 + Math.cos(t * 17) * 2, -22 - fl * 4, 3.5, -14);
    shape(r, f, flame, C['f5']);
    const core = [-1.6, -15];
    bez2(core, -1.6, -15, 0, -20 - fl * 3, 1.6, -15);
    shape(r, f, core, C['f8']);
    shapeOval(r, f, 0, -15.5, 1.4, 1.4, 0, C['f8']);
    return true;
  }
}

export const { drawBackground, resetBackground, startOverlay, stopOverlay } = sceneModule(new Sky(), new Feather());
