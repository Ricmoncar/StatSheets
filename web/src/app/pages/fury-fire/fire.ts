// FURY'S FIRE, the world and the fire over the window, shared with Sorrow
// (whose page is the same fire pouring down from above, in grey).
//
// THE CLAIM. A fire dictator's hall: everything is burning and everything
// marches. The fire comes up in five channels from the floor, the floor itself
// cracks with lava, the room jolts on a steady BOOM-boom footfall and flares
// with a roar every nine seconds. Two war banners hang in it. Fire adds up,
// so every flame adds heat to a field that is read off the fire ramp at the
// end; the crimson flames (the tongues along the floor, the twisting
// columns) keep a field of their own, so they stay crimson where they lead.
import { Raster, bayer } from '../raster';
import { artPx } from '../host';
import { Heat } from '../kit/heat';
import { PageOverlay } from '../kit/overlay';
import { palette } from '../kit/palette';
import { Scene } from '../kit/scene';
import { bez2, bez3 } from '../kit/paint';

export const P = palette({
  // heat: black, through blood red and orange, to white heat
  e: ['#000000', '#1a0000', '#330000', '#520303', '#760707', '#9c0b0b', '#c4160c', '#e8320e', '#ff5a1a', '#ff8a2e', '#ffbb55', '#ffe49a'],
  // crimson flame
  c: ['#2a0006', '#4e000c', '#7a0818', '#a80c24', '#d82038', '#ff4a64', '#ff8ca0'],
  // the banners' cloth
  b: ['#120102', '#2a0304', '#46070a', '#6a0e12'],
  // gold
  g: ['#3c2a08', '#7a5a1c', '#b48a3a', '#e2c67a', '#f4da92', '#fff2c8'],
  // the chip, red and blue, and its cream inserts
  r: ['#5c0a0a', '#9c1414', '#c0282a', '#ff6a5a'],
  u: ['#0c1a44', '#16307a', '#2a52c0', '#8fb8ec'],
  w: ['#140406', '#8a8070', '#efe6d2', '#ffffff'],
});
export const C = P.C;
const FIRE = P.ramp('e'), CRIM = [C['e0'], ...P.ramp('c')];
const FIRE_CLEAR = [0, ...FIRE.slice(2)], CRIM_CLEAR = [0, ...P.ramp('c').slice(1)];
/** Where the fire comes up, across the floor. */
const CHAN = [0.1, 0.3, 0.52, 0.72, 0.9];

interface Flame { cx: number; base: boolean; x: number; y: number; vx: number; vy: number; r: number; life: number; decay: number; phase: number; tf: number; ta: number }
interface Ember { x: number; y: number; vx: number; vy: number; r: number; life: number; decay: number; hot: boolean }

function newFlame(W: number, H: number, px: number, scatter: boolean): Flame {
  const base = Math.random() < 0.28;
  const cx = base ? W * (0.04 + Math.random() * 0.92) : CHAN[Math.floor(Math.random() * CHAN.length)] * W;
  return {
    cx, base,
    x: cx + (Math.random() - 0.5) * W * (base ? 0.14 : 0.05),
    y: scatter ? (base ? H - Math.random() * H * 0.3 : H - Math.random() * H * 0.72) : H + (Math.random() * 18) / px,
    vx: ((Math.random() - 0.5) * (base ? 9 : 14)) / px,
    vy: (base ? -(14 + Math.random() * 38) : -(42 + Math.random() * 88)) / px,
    r: (base ? 60 + Math.random() * 38 : 8 + Math.random() * 18) / px,
    life: scatter ? Math.random() : 1,
    decay: base ? 0.06 + Math.random() * 0.1 : 0.13 + Math.random() * 0.25,
    phase: Math.random() * Math.PI * 2, tf: 0.45 + Math.random() * 0.85, ta: (base ? 5 + Math.random() * 9 : 10 + Math.random() * 18) / px,
  };
}
function newEmber(W: number, H: number, px: number, scatter: boolean, wide = 0.08, big = 0.25): Ember {
  const cx = CHAN[Math.floor(Math.random() * CHAN.length)] * W, large = Math.random() < big;
  return {
    x: scatter ? Math.random() * W : cx + (Math.random() - 0.5) * W * wide,
    y: scatter ? Math.random() * H : H + (Math.random() * 5) / px,
    vx: ((Math.random() - 0.5) * 25) / px, vy: -(60 + Math.random() * 130) / px,
    r: (large ? 3 + Math.random() * 4 : 0.8 + Math.random() * 2) / px,
    life: scatter ? Math.random() : 1, decay: large ? 0.06 + Math.random() * 0.08 : 0.09 + Math.random() * 0.14, hot: Math.random() < 0.5,
  };
}
/** The flames move and add their heat (alpha and lightness as the old page's, here as heat). */
function burnFlames(fl: Flame[], h: Heat, W: number, H: number, px: number, t: number, dt: number, strength: number): void {
  for (let i = fl.length - 1; i >= 0; i--) {
    const e = fl[i];
    e.vx += Math.sin(t * e.tf + e.phase) * e.ta * dt;
    e.vx *= 1 - 1.8 * dt;
    e.x += e.vx * dt; e.y += e.vy * dt; e.life -= e.decay * dt;
    if (e.life <= 0 || e.y < -e.r * 2) { fl[i] = newFlame(W, H, px, false); continue; }
    const a = e.life * (e.base ? 0.14 : 0.32) * strength * ((12 + 25 * e.life) / 37);
    h.disc(e.x, e.y, e.r * (0.4 + 0.6 * e.life), a * 1.7, 0.35);
  }
}
/** Reads the two fields into the raster: crimson where it leads, fire elsewhere. `flip` reads them upside down. */
function resolve(r: Raster, hf: Heat, hc: Heat, fire: readonly number[], crim: readonly number[], gain: number, flip: boolean): void {
  const { w, h } = r, nf = fire.length - 1, nc = crim.length - 1;
  for (let y = 0; y < h; y++) {
    const sy = flip ? h - 1 - y : y;
    for (let x = 0; x < w; x++) {
      const k = sy * w + x, f = hf.buf[k], c = hc.buf[k];
      if (f <= 0 && c <= 0) continue;
      const lf = 1 - Math.exp(-f * gain), lc = 1 - Math.exp(-c * gain), b = bayer(x, y);
      let i: number;
      if (lc > lf) { const v = Math.min(1, lc + lf * 0.25) * nc, n = Math.floor(v); i = crim[v - n > b ? Math.min(nc, n + 1) : n]; }
      else { const v = Math.min(1, lf + lc * 0.25) * nf, n = Math.floor(v); i = fire[v - n > b ? Math.min(nf, n + 1) : n]; }
      if (i) r.px[y * w + x] = i;
    }
  }
}
/** A row of licking flame tongues along the bottom edge (y = H), reaching up: heat into `h`. */
function tongues(h: Heat, Wc: number, H: number, px: number, t: number, seed: number, baseH: number, a: number): void {
  const n = Math.max(6, Math.ceil(Wc / 26));
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (Wc / n), fl = 0.6 + 0.4 * Math.sin(t * 7 + i * 1.7 + seed) + 0.22 * Math.sin(t * 13 + i + seed);
    const hh = baseH * (0.55 + fl * 0.8), sway = Math.sin(t * 5 + i + seed) * 6;
    for (const [w, hm, al] of [[15, 1, 0.5], [9, 0.82, 0.55], [4.5, 0.56, 0.7]]) {
      const p = [(x - w) / px, H];
      bez2(p, (x - w) / px, H, (x + sway) / px, H - (hh * hm * 0.6) / px, (x + sway * 0.5) / px, H - (hh * hm) / px);
      bez2(p, (x + sway * 0.5) / px, H - (hh * hm) / px, (x - sway) / px, H - (hh * hm * 0.6) / px, (x + w) / px, H);
      h.poly(p, al * a);
    }
  }
}

export class FireWorld implements Scene {
  private W = 0; private H = 0; private px = 3;
  private hf = new Heat(1, 1); private hc = new Heat(1, 1);
  private tmp = new Raster(1, 1);
  private flames: Flame[] = []; private embers: Ember[] = [];

  constructor(private readonly flip = false, private readonly table: Uint32Array = P.table) {}

  colours(): Uint32Array { return this.table; }

  size(W: number, H: number): void {
    this.W = W; this.H = H; const px = this.px = artPx();
    this.hf = new Heat(W, H); this.hc = new Heat(W, H); this.tmp = new Raster(W, H);
    this.flames = Array.from({ length: 280 }, (_, i) => newFlame(W, H, px, i < 220));
    this.embers = Array.from({ length: 65 }, (_, i) => newEmber(W, H, px, i < 50));
  }

  draw(out: Raster, t: number, dt: number): void {
    const { W, H, px, hf, hc } = this, Wc = W * px, Hc = H * px, r = this.tmp;
    // the cadence: a steady BOOM-boom footfall every 1.5 s, and the roar every 9
    const roar = t % 9, shk = roar < 0.5 ? (0.5 - roar) * 2 : 0, cad = t % 1.5;
    const stomp = Math.max(Math.exp(-cad * 26), cad > 0.26 ? 0.55 * Math.exp(-(cad - 0.26) * 26) : 0);
    hf.clear(); hc.clear();
    r.clear(C['e0']);
    // the smoulder: a haze off the whole floor, a pool under each channel, and the floor's own red edge, pulsing
    hf.band(H, H - H * 0.58 * 0.22, 0.47, 0.135);
    hf.band(H - H * 0.58 * 0.22, H - H * 0.58, 0.135, 0);
    for (const xf of CHAN) hf.glow(xf * W, H, Math.min(W, H) * 0.24, 0.55);
    const peek = Math.max(0.05, 0.4 + 0.28 * Math.sin(t * 2.2) + 0.12 * Math.sin(t * 5 + 1.4));
    hf.band(H, H - H * 0.13 * 0.35, 1 * peek, 0.45 * peek);
    hf.band(H - H * 0.13 * 0.35, H - H * 0.13, 0.45 * peek, 0);
    // the fire itself
    burnFlames(this.flames, hf, W, H, px, t, dt, 1);
    // the crimson tongues along the floor
    tongues(hc, Wc, H, px, t, 3, Hc * 0.2, 0.9);
    // towering fire pillars at the far edges
    const pp = 0.5 + 0.5 * Math.sin(t * 1.6);
    for (const [x0, ph] of [[Wc * 0.035, 0], [Wc * 0.965, 1.7]]) {
      const p: number[] = [x0 / px, H];
      for (let yy = Hc; yy >= Hc * 0.08; yy -= 22) p.push((x0 - (34 * (yy / Hc) + Math.sin(yy * 0.045 + t * 4 + ph) * 12)) / px, yy / px);
      for (let yy = Hc * 0.08; yy <= Hc; yy += 22) p.push((x0 + 34 * (yy / Hc) + Math.sin(yy * 0.045 + t * 4 + ph + 1) * 12) / px, yy / px);
      hf.poly(p, (_x, y) => { const u = 1 - y / H; return u < 0.5 ? (0.3 + pp * 0.18) * (1 - u * 2) + 0.12 * u * 2 : 0.12 * (1 - (u - 0.5) / 0.42); });
    }
    // three swirling columns twisting up through it
    const yTop = Hc * 0.12;
    for (const [colX, phase] of [[Wc * 0.32, 0], [Wc * 0.5, 2.1], [Wc * 0.68, 4.3]]) {
      const u = (y: number) => (Hc - y * px) / (Hc - yTop);
      hc.poly([(colX - 66) / px, yTop / px, (colX + 66) / px, yTop / px, (colX + 66) / px, H, (colX - 66) / px, H], (_x, y) => 0.13 * Math.max(0, 1 - u(y)));
      for (let strand = 0; strand < 2; strand++) {
        const ph = phase + strand * Math.PI, p: number[] = [];
        const at = (yy: number, side: number) => { const amp = 46 * (0.35 + 0.65 * (yy / Hc)); return (colX + Math.sin(yy * 0.024 + t * 2 + ph) * amp + side * (9 * (yy / Hc) + 4)) / px; };
        for (let yy = Hc; yy >= yTop; yy -= 18) p.push(at(yy, -1), yy / px);
        for (let yy = yTop; yy <= Hc; yy += 18) p.push(at(yy, 1), yy / px);
        hc.poly(p, (_x, y) => { const v = u(y); return v < 0.5 ? 0.45 - v * 0.42 : 0.24 * (1 - (v - 0.5) * 2); });
      }
    }
    // each footfall throws a red pulse and a glow off the floor; the roar flares the whole hall
    if (stomp > 0.02) { hf.all(stomp * 0.09); hf.band(H, H - H * 0.2, stomp * 0.32, 0); }
    if (roar < 0.7) { const k = 1 - roar / 0.7; hf.all(k * k * 0.22); }
    resolve(r, hf, hc, FIRE, CRIM, 1.25, false);

    // lava cracks creeping along the floor
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
    for (let i = 0; i < 6; i++) {
      let x = (i + 0.5) * (Wc / 6) + Math.sin(t * 0.5 + i) * 20, y = Hc;
      for (let k = 0; k < 4; k++) {
        const nx = x + Math.sin(i * 3 + k * 1.7) * 26, ny = y - 14 - (k % 2) * 10;
        r.line(x / px, y / px, nx / px, ny / px, (xx, yy) => ((0.45 + pulse * 0.4) > bayer(xx, yy) ? (pulse > 0.6 ? C['e10'] : C['e9']) : 0));
        x = nx; y = ny;
      }
    }
    // embers rising out of the channels
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.x += e.vx * dt; e.y += e.vy * dt; e.life -= e.decay * dt;
      if (e.life <= 0 || e.y < -10 / px) { this.embers[i] = newEmber(W, H, px, false); continue; }
      const c = e.hot ? (e.life > 0.5 ? C['e9'] : C['e8']) : e.life > 0.5 ? C['e8'] : C['e7'];
      if (e.r < 1) r.dot(e.x, e.y, c, e.life * 0.9 + 0.1);
      else r.oval(e.x, e.y, e.r, e.r, (x, y) => (e.life * 0.9 + 0.1 > bayer(x, y) ? c : 0));
    }
    // the dictator's war banners, swaying, lit at the edges by the fire, a crown on each
    for (const bx0 of [Wc * 0.28, Wc * 0.72]) {
      const sway = Math.sin(t * 0.9 + bx0) * 7, bw = Math.min(94, Wc * 0.08), bh = Hc * 0.42, botX = bx0 + sway;
      const pts = [(bx0 - bw / 2) / px, 0, (bx0 + bw / 2) / px, 0, (botX + bw / 2) / px, bh / px, botX / px, (bh + bw * 0.32) / px, (botX - bw / 2) / px, bh / px];
      r.poly(pts, (x, y) => ((y * px) / bh > bayer(x, y) * 0.9 + 0.1 ? C['b1'] : C['b2']));
      const lit = 0.45 + 0.3 * Math.sin(t * 2 + bx0);
      for (let k = 0; k < 5; k++) r.line(pts[k * 2], pts[k * 2 + 1], pts[((k + 1) % 5) * 2], pts[((k + 1) % 5) * 2 + 1], (x, y) => (lit > bayer(x, y) ? C['c4'] : C['c2']));
      const ex = (bx0 + botX) / 2, ey = bh * 0.42, S = bw * 0.024;
      const crown = [[-18, 8], [-16, -10], [-11, 0], [-8, -20], [-3, -2], [0, -26], [3, -2], [8, -20], [11, 0], [16, -10], [18, 8]].flatMap(([u, v]) => [(ex + u * S) / px, (ey + v * S) / px]);
      r.poly(crown, (x, y) => (0.55 > bayer(x, y) ? C['g2'] : C['g1']));
    }
    // ash and cinders drifting down
    for (let i = 0; i < 28; i++) {
      const sd = i * 0.733;
      const x = (((sd * 3.1) % 1) * Wc + Math.sin(t * 0.6 + i) * 26) / px, y = (((t * (12 + (sd % 18)) + sd * Hc) % (Hc + 16)) - 8) / px;
      r.dot(x, y, i % 4 === 0 ? C['e8'] : C['b2'], (0.1 + (sd % 0.22)) * 2.6);
    }
    // a little gold at the top edge, from somewhere above
    for (let y = 0; y < H * 0.2; y++) {
      const lv = 0.32 * (1 - y / (H * 0.2));
      for (let x = 0; x < W; x++) { const k = y * W + x; if (r.px[k] <= C['e2'] && lv > bayer(x, y)) r.px[k] = C['g0']; }
    }

    // the footfalls jolt the whole hall down, the roar shakes it, and the heat shimmers over the lower half
    const sx = Math.round(((Math.random() - 0.5) * shk * 16 + (Math.random() - 0.5) * stomp * 5) / px);
    const sy = Math.round(((Math.random() - 0.5) * shk * 16 + stomp * 9) / px);
    const shimTop = H * 0.46;
    for (let y = 0; y < H; y++) {
      const ty = this.flip ? H - 1 - y : y;
      const src = y - sy, d = (y - shimTop) / (H - shimTop);
      const off = sx + (y > shimTop ? Math.round((Math.sin(y * px * 0.045 + t * 5) * (1 + d * 4.5)) / px) : 0);
      const row = ty * W;
      if (src < 0 || src >= H) { out.px.fill(C['e0'], row, row + W); continue; }
      const srow = src * W;
      for (let x = 0; x < W; x++) { const xs = x - off; out.px[row + x] = xs >= 0 && xs < W ? r.px[srow + xs] : C['e0']; }
    }
  }
}

interface Spark { x: number; y: number; vx: number; vy: number; life: number; r: number; hue: number }
interface Ring { x: number; y: number; life: number; max: number; delay: number }

/**
 * The fire over the window: a haze off the bottom of the window, more fire
 * streaming up the channels, embers, the floor's red edge and a little gold at
 * the top, all shown in 'screen' mode so it lights the interface the way the
 * old page's additive fire did rather than covering it. Clicks' sparks, the
 * eruption's flash and rings, and (Fury) the burning frame round the window
 * are drawn by the page through the hooks.
 */
export abstract class FireOverlay extends PageOverlay {
  protected hf = new Heat(1, 1); protected hc = new Heat(1, 1);
  private flames: Flame[] = []; private embers: Ember[] = [];
  protected sparks: Spark[] = [];
  protected rings: Ring[] = [];
  protected flash = 0;

  constructor(id: string, private readonly flip: boolean, colours: () => Uint32Array) { super(id, colours, true); }

  protected override begin(): void {
    this.blend('screen');
    this.sparks = []; this.rings = []; this.flash = 0;
    this.flames = []; this.embers = [];
  }

  protected frame(r: Raster, t: number, dt: number): boolean {
    const { W, H, px } = this;
    if (this.hf.w !== W || this.hf.h !== H) {
      this.hf = new Heat(W, H); this.hc = new Heat(W, H);
      this.flames = Array.from({ length: 140 }, (_, i) => newFlame(W, H, px, i < 110));
      this.embers = Array.from({ length: 100 }, (_, i) => newEmber(W, H, px, i < 75, 0.1, 0.2));
    }
    const hf = this.hf, hc = this.hc;
    hf.clear(); hc.clear();
    hf.band(H, H - H * 0.55 * 0.22, 0.36, 0.1);
    hf.band(H - H * 0.55 * 0.22, H - H * 0.55, 0.1, 0);
    burnFlames(this.flames, hf, W, H, px, t, dt, 1.15);
    const peek = Math.max(0.05, 0.4 + 0.28 * Math.sin(t * 2.2) + 0.12 * Math.sin(t * 5 + 1.4));
    hf.band(H, H - H * 0.13 * 0.35, 0.9 * peek, 0.4 * peek);
    hf.band(H - H * 0.13 * 0.35, H - H * 0.13, 0.4 * peek, 0);
    this.heat(t, dt);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 2.6); hf.all(this.flash * 0.12); }
    resolve(r, hf, hc, FIRE_CLEAR, CRIM_CLEAR, 0.85, this.flip);
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.x += e.vx * dt; e.y += e.vy * dt; e.life -= e.decay * dt;
      if (e.life <= 0 || e.y < -15 / px) { this.embers[i] = newEmber(W, H, px, false, 0.1, 0.2); continue; }
      const y = this.flip ? H - 1 - e.y : e.y, c = e.hot ? C['e9'] : C['e8'], rr = e.r * Math.max(0.3, e.life);
      if (rr < 1) r.dot(e.x, y, c, e.life + 0.1);
      else r.oval(e.x, y, rr, rr, (x, yy) => (e.life + 0.1 > bayer(x, yy) ? c : 0));
    }
    // a little gold at the top edge
    const top = this.flip ? [H - H * 0.2, H] : [0, H * 0.2];
    for (let y = Math.floor(top[0]); y < top[1]; y++) {
      const u = this.flip ? (H - 1 - y) / (H * 0.2) : y / (H * 0.2), lv = 0.11 * (1 - u);
      for (let x = 0; x < W; x++) if (lv > bayer(x, y) && !r.px[y * W + x]) r.px[y * W + x] = C['g1'];
    }
    // sparks from clicks: thrown up, falling, cooling
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 130 * dt; s.life -= dt * 2.2;
      if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
      const c = s.life > 0.66 ? (s.hue < 25 ? C['e10'] : C['e11']) : s.life > 0.33 ? C['e9'] : C['e7'];
      const rr = (s.r * Math.max(0.2, s.life)) / px;
      if (rr < 1) r.dot(s.x / px, s.y / px, c, s.life + 0.2);
      else r.oval(s.x / px, s.y / px, rr, rr, c);
    }
    // the eruption's shockwave rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const g = this.rings[i];
      if (g.delay > 0) { g.delay -= dt; continue; }
      g.life -= dt / g.max;
      if (g.life <= 0) { this.rings.splice(i, 1); continue; }
      const al = g.life, rr = (12 + (1 - al) * 220) / px, w = Math.max(0.6, (5 * al + 1) / px / 2);
      r.ring(g.x / px, g.y / px, rr - w, rr + w, (x, y) => (al + 0.15 > bayer(x, y) ? (al > 0.5 ? C['e10'] : C['e9']) : 0));
    }
    this.decorate(r, t, dt);
    return true;
  }

  /** More heat for this frame (the page's own, before the fields are read). */
  protected heat(_t: number, _dt: number): void { /* none by default */ }
  /** Drawing over everything else on the full-window layer. */
  protected decorate(_r: Raster, _t: number, _dt: number): void { /* none by default */ }
}
