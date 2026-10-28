// JUKO · 1: the void behind the sheet, the old page's layers in its order.
// The void itself (deep teal where the light reaches into the dust, violet
// banks) with the rings of the coordinate space on the light and the shafts
// coming through the span overhead; spokes that light up where the sword
// points; the field of digits coming at you in perspective and resolving to
// 1 on the way (the moment a digit resolves it flashes), with chains of
// digits running past; the wreck of the Code Garden still out there; the far
// span and the canopy overhead, rocking round its root; the prism, the one
// light; debris going past close by; the void closing in round it all. On
// entry the field rushes in from far out for two seconds.
//
// Every six to eleven seconds, one event, never the same twice running: a
// comet (one enormous digit crossing the frame trailing the spectrum), an
// eclipse (the light gutters, everything goes with it, and comes back in a
// flash), the garden (the old room showing through for a moment), a cascade
// (the collapse arriving as a straight front), a constellation (the field
// drawing itself a figure), a wingbeat (the thing overhead beats once), and
// the zero (the value that did not survive, coming back through and undoing
// the collapse where it passes).
import { Raster, table } from '../raster';
import { artPx } from '../host';
import { Scene } from '../kit/scene';
import { bez2, glyph, glyphBits as glyphMask } from '../kit/paint';
import { J, sync } from './look';
import { BAYER, C1, DIGITS, DN1, Ev, LUM1, ONE, P1, SPEC, UP1, along, bigGlyph, glyphAt, glyphOutline, hueAt, lighten, rnd, step } from './prism';

const NEAR = 90, FAR = 2600, FOCAL = 700;
const m = P1.ramp('m'), c = P1.ramp('c'), w = P1.ramp('w'), v = P1.ramp('v'), u = P1.ramp('u'), rk = P1.ramp('r'), gr = P1.ramp('g');
const EVENTS = ['comet', 'eclipse', 'garden', 'cascade', 'constel', 'wingbeat', 'zero'];
const EV_DUR: Record<string, number> = { comet: 3.6, eclipse: 1.9, garden: 1.9, cascade: 2.1, constel: 3.0, wingbeat: 1.6, zero: 6.0 };
const TAU = Math.PI * 2;
// the light coming back on after an eclipse: the whole table washed toward white
const FLASH = [0.15, 0.3, 0.45, 0.6, 0.75].map(k => table(P1.hex.map(h => (h ? '#' + [1, 3, 5].map((i, j) => {
  const a = parseInt(h.slice(i, i + 2), 16);
  return Math.min(255, Math.round(a + [226, 255, 246][j] * k)).toString(16).padStart(2, '0');
}).join('') : ''))));

interface Mote { x: number; y: number; z: number; ch: string; mut: number; br: number; lock: boolean; prism: boolean; px: number; py: number }
interface Conduit { a: number; r: number; rise: number; curl: number; n: number; spd: number; z0: number; br: number }
interface Shard { a: number; r: number; z: number; sp: number; vr: number; seed: number; size: number; pts: number[] }
/** One blade of the thing overhead, at rest: its outline, its lit edge and its shadowed edge (CSS px), and their inks. */
interface Vane { fill: number[]; lit: number[]; dark: number[]; litInk: number; darkInk: number }
interface Span { vanes: Vane[]; tips: number[]; tipInk: number }

export class Void implements Scene {
  private W = 1; private H = 1; private px = 3; private WC = 1; private HC = 1;
  /** The light (CSS px), and the scale of everything round it. */
  private CX = 0; private CY = 0; private S = 1;
  private base = new Raster(1, 1);
  private ray = new Float32Array(1);
  private vig = new Float32Array(1);
  private motes: Mote[] = [];
  private conduits: Conduit[] = [];
  private shards: Shard[] = [];
  private flashes: { x: number; y: number; life: number; s: number }[] = [];
  private canopy: Span[] = []; private far: Span[] = []; private arm: number[] = [];
  private pos: number[] = [];
  private bloom = new Float32Array(1); private bloomW = 1; private bloomH = 1;
  private t0 = -1;
  private wave = -99;
  private cw: { x: number; y: number; t0: number } | null = null;
  private ev: (Ev & { t0: number; dur: number }) | null = null;
  private nextEv = 3.5; private lastEv = '';
  private flash: Uint32Array | null = null;

  size(W: number, H: number): void {
    const px = this.px = artPx();
    this.W = W; this.H = H; this.WC = W * px; this.HC = H * px;
    this.CX = this.WC * 0.73; this.CY = this.HC * 0.29; this.S = Math.min(this.WC * 0.55, this.HC * 0.95);
    this.bakeVoid();
    this.canopy = this.bakeCanopy(); this.far = this.bakeFar();
    this.bakeRays();
    const want = Math.max(190, Math.min(760, Math.round((this.WC * this.HC) / 1650)));
    this.motes = Array.from({ length: want }, () => this.mote({} as Mote, true));
    this.conduits = Array.from({ length: 5 }, (_, i) => ({
      a: rnd(i * 3.1) * TAU, r: 220 + rnd(i * 5.7) * 900, rise: (rnd(i * 7.3) - 0.5) * 700, curl: (rnd(i * 9.1) - 0.5) * 2.4,
      n: 26 + ((rnd(i * 11.7) * 14) | 0), spd: 150 + rnd(i * 13.3) * 240, z0: rnd(i * 17.9) * FAR, br: 0.5 + rnd(i * 19.3) * 0.5,
    }));
    this.shards = Array.from({ length: 5 }, (_, i) => this.shard(i));
    this.bloomW = Math.ceil(W / 4); this.bloomH = Math.ceil(H / 4);
    this.bloom = new Float32Array(this.bloomW * this.bloomH);
    this.t0 = -1;
  }

  colours(): Uint32Array {
    const f = this.flash;
    this.flash = null;
    return f ?? P1.table;
  }

  // ── baked once a size ──

  /** The void: base, the light in the dust, and the nebula banks; then the rings of the coordinate space. */
  private bakeVoid(): void {
    const { W, H, px, WC, HC, CX, CY } = this;
    const b = this.base = new Raster(W, H), R = Math.hypot(WC, HC) * 0.8;
    const banks = [
      [WC * 0.82, HC * 0.74, WC * 0.6, HC * 0.32, 0, 0.22, -0.22],   // cyan
      [WC * 0.16, HC * 0.16, WC * 0.62, HC * 0.38, 1, 0.34, 0.3],    // violet
      [WC * 0.44, HC * 0.99, WC * 0.55, HC * 0.26, 1, 0.17, 0.1],    // violet
      [WC * 0.1, HC * 0.76, WC * 0.36, HC * 0.26, 0, 0.1, -0.15],    // green, read as teal
    ];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const X = (x + 0.5) * px, Y = (y + 0.5) * px;
      let teal = 0.8 * Math.max(0, 1 - Math.hypot(X - CX, Y - CY) / R) ** 2.5, vio = 0;
      for (const [bx, by, bw, bh, kind, a, rot] of banks) {
        const dx = X - bx, dy = Y - by, cr = Math.cos(-rot), sr = Math.sin(-rot);
        const lu = (dx * cr - dy * sr) / bw, lv = (dx * sr + dy * cr) / bh, d = Math.hypot(lu, lv);
        if (d >= 1) continue;
        const k = a * (1 - d) ** 2.2;
        if (kind) vio += k; else teal += k * 1.4;
      }
      const th = BAYER[((y & 3) << 2) | (x & 3)];
      let i: number;
      if (vio > teal * 0.9) { const f = Math.min(1, vio / 0.3) * 4; i = f < 0.4 ? v[1] : u[Math.min(3, Math.floor(f - 0.4 + th))]; }
      else { const f = 1 + Math.min(1, teal / 0.75) * 6.99; i = v[Math.min(7, Math.floor(f + th - 0.5))] || v[1]; }
      b.px[y * W + x] = i;
    }
    // the rings: they do not care about rotation, so they bake once
    const maxR = Math.hypot(Math.max(CX, WC - CX), Math.max(CY, HC - CY));
    for (let i = 1; i <= 22; i++) {
      // a ring is the void a step or two lighter where it runs
      const rr = maxR * (i / 22) ** 1.55, a = 0.12 * (1 - i / 23) ** 1.1 + 0.012, steps = a > 0.09 ? 2 : 1;
      const n = Math.ceil((TAU * rr) / px) * 2, seen = new Set<number>();
      for (let k = 0; k < n; k++) {
        const an = (k / n) * TAU, x = Math.floor((CX + Math.cos(an) * rr) / px), y = Math.floor((CY + Math.sin(an) * rr) / px);
        if (x < 0 || y < 0 || x >= W || y >= H || seen.has(y * W + x)) continue;
        seen.add(y * W + x);
        for (let s2 = 0; s2 < steps; s2++) b.px[y * W + x] = UP1[b.px[y * W + x]];
      }
      if (i % 4 === 0) for (let k = 0; k < 24; k++) {
        const an = (k / 24) * TAU + i * 0.13, x = CX + Math.cos(an) * rr, y = CY + Math.sin(an) * rr, s = step(a * 2);
        if (s < 0) continue;
        const ink2 = SPEC[hueAt(x - CX, y - CY)][s];
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) lighten(b, x / px - 1 + dx, y / px - 1 + dy, ink2);
      }
    }
    // the void closing in round the light, as steps darker
    this.vig = new Float32Array(W * H);
    const r0 = Math.min(WC, HC) * 0.28, r1 = Math.hypot(WC, HC) * 0.86;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const q = Math.max(0, Math.min(1, (Math.hypot((x + 0.5) * px - CX, (y + 0.5) * px - CY) - r0) / (r1 - r0)));
      this.vig[y * W + x] = 0.5 * q ** 2.8 * 2.2;
    }
  }

  /** Blades fanned from a short shoulder arc, longest at the top, back to front. */
  private wing(ox: number, oy: number, S: number, a0: number, a1: number, reach: number, n: number, lit: number, wid: number): Span {
    const { CX, CY } = this, vanes: Vane[] = [], tips: number[] = [];
    for (let k = n - 1; k >= 0; k--) {
      const uu = k / (n - 1), ang = a0 + (a1 - a0) * uu, rt = S * (0.055 + uu * 0.06);
      const x = ox + Math.cos(ang) * rt, y = oy + Math.sin(ang) * rt;
      const len = S * reach * (1 - uu * 0.5) * (0.66 + rnd(k * 5.3 + a0 * 10) * 0.62);
      const wd = S * wid * (1 - uu * 0.25), bow = S * 0.055 * (0.4 + rnd(k * 7.9) * 1.0), lt = lit * (1 - uu * 0.34);
      const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca, tx = x + ca * len, ty = y + sa * len;
      const mx = x + ca * len * 0.5 + nx * bow, my = y + sa * len * 0.5 + ny * bow;
      const fill = [x + nx * wd, y + ny * wd];
      bez2(fill, x + nx * wd, y + ny * wd, mx + nx * wd * 0.62, my + ny * wd * 0.62, tx, ty, 12);
      bez2(fill, tx, ty, mx - nx * wd * 0.62, my - ny * wd * 0.62, x - nx * wd, y - ny * wd, 12);
      // one lit edge, whichever faces the light
      const sg = (CX - x) * nx + (CY - y) * ny >= 0 ? 1 : -1;
      const litE = [x + nx * wd * sg, y + ny * wd * sg];
      bez2(litE, x + nx * wd * sg, y + ny * wd * sg, mx + nx * wd * 0.62 * sg, my + ny * wd * 0.62 * sg, tx, ty, 12);
      const darkE = [x - nx * wd * sg, y - ny * wd * sg];
      bez2(darkE, x - nx * wd * sg, y - ny * wd * sg, mx - nx * wd * 0.62 * sg, my - ny * wd * 0.62 * sg, tx, ty, 12);
      vanes.push({ fill, lit: litE, dark: darkE, litInk: SPEC[hueAt(x - CX, y - CY)][Math.min(3, step(lt) + 1)], darkInk: v[lt * 0.8 > 0.3 ? 6 : 5] });
      tips.push(tx, ty);
    }
    // the curve through the tips
    const curve = [tips[tips.length - 2], tips[tips.length - 1]];
    for (let k = tips.length / 2 - 2; k >= 0; k--) {
      const ax = tips[k * 2 + 2], ay = tips[k * 2 + 3], bx = tips[k * 2], by = tips[k * 2 + 1];
      bez2(curve, ax, ay, (ax + bx) / 2 + (by - ay) * 0.12, (ay + by) / 2 - (bx - ax) * 0.12, bx, by, 6);
    }
    return { vanes, tips: curve, tipInk: m[lit * 0.5 > 0.2 ? 2 : 1] };
  }
  /** The thing overhead: a span, not a figure, rooted off the top right and running off two edges. */
  private bakeCanopy(): Span[] {
    const { WC, HC } = this, S = Math.max(WC, HC), rx = WC * 1.06, ry = HC * 0.02;
    const spans = [this.wing(rx + S * 0.03, ry - S * 0.04, S, -3.02, -3.52, 0.34, 8, 0.2, 0.011), this.wing(rx, ry, S, -2.86, -3.72, 0.56, 11, 0.5, 0.014)];
    this.arm = [rx + S * 0.05, ry + S * 0.05];
    bez2(this.arm, rx + S * 0.05, ry + S * 0.05, rx - S * 0.3, ry - S * 0.02, rx - S * 0.62, ry + S * 0.12, 16);
    return spans;
  }
  private bakeFar(): Span[] {
    const { WC, HC } = this;
    return [this.wing(-WC * 0.06, HC * 1.1, Math.max(WC, HC), -1.02, -0.46, 0.34, 6, 0.14, 0.009)];
  }
  /**
   * GOD RAYS. The span is between you and the light, so it throws shafts: the
   * canopy is read once along 220 rays out of the light to find where it
   * blocks, and a shaft is light that got past with something beside it.
   */
  private bakeRays(): void {
    const { W, H, px, WC, HC, CX, CY } = this, mask = new Raster(W, H);
    this.drawSpans(mask, this.canopy, (x, y) => [x / px, y / px], true);
    const N = 220, maxR = Math.hypot(WC, HC) * 0.75, occ = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      let hit = 0, tries = 0;
      for (let rr = maxR * 0.06; rr < maxR; rr += maxR * 0.035) {
        tries++;
        if (mask.get((CX + ca * rr) / px, (CY + sa * rr) / px)) hit++;
      }
      occ[i] = tries ? hit / tries : 0;
    }
    const open = Float32Array.from(occ, (o, i) => (1 - o) * Math.max(occ[(i + 1) % N], occ[(i - 1 + N) % N], occ[(i + 3) % N], occ[(i - 3 + N) % N]));
    this.ray = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5) * px - CX, dy = (y + 0.5) * px - CY, i = Math.floor(((Math.atan2(dy, dx) + TAU) % TAU) / TAU * N) % N;
      if (open[i] < 0.06) continue;
      const A = Math.min(0.5, open[i] * 0.5), q = (Math.hypot(dx, dy) - maxR * 0.04) / (maxR * 0.96);
      if (q < 0 || q > 1) continue;
      this.ray[y * W + x] = q < 0.35 ? A * (1 - (q / 0.35) * 0.5) : A * 0.5 * (1 - (q - 0.35) / 0.65);
    }
  }

  private mote(o: Mote, scatter: boolean): Mote {
    const a = Math.random() * TAU, r = 90 + Math.random() ** 0.62 * 1350;
    o.x = Math.cos(a) * r; o.y = Math.sin(a) * r * 0.92;
    o.z = scatter ? NEAR + Math.random() * (FAR - NEAR) : FAR * (0.86 + Math.random() * 0.14);
    o.ch = DIGITS[(Math.random() * 10) | 0]; o.mut = Math.random() * 0.5; o.br = 0.5 + Math.random() * 0.5;
    o.lock = false; o.prism = Math.random() < 0.11; o.px = NaN; o.py = NaN;
    return o;
  }
  /** Debris close enough to be nearly black, with one lit edge and a face you can only just read digits on. */
  private shard(i: number): Shard {
    const seed = i * 17 + 3, n = 5 + ((rnd(seed) * 3) | 0), tilt = rnd(seed * 1.7) * TAU, pts: number[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + tilt + rnd(seed + k * 3.1) * 0.5, r = 0.5 * (0.5 + rnd(seed + k * 7.7) * 0.46);
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    return { a: rnd(i * 5.3) * TAU, r: 200 + rnd(i * 9.7) * 900, z: NEAR + rnd(i * 3.1) * (FAR - NEAR), sp: 0.5 + rnd(i * 13.9) * 0.7, vr: (rnd(i * 7.1) - 0.5) * 0.12, seed, size: this.S * (0.24 + rnd(i * 21.1) * 0.3), pts };
  }

  // ── a frame ──

  draw(r: Raster, t: number, dt: number): void {
    sync();
    const { W, H, px, WC, HC, S } = this, p = r.px;
    const aL = J.song.level, aO = J.song.onset, beat = J.song.beat;
    if (this.t0 < 0) this.t0 = t;
    // the arrival: two seconds of the field rushing in and the light coming up
    const arrive = Math.max(0, Math.min(1, (t - this.t0) / 2.2)), ease = arrive * arrive * (3 - 2 * arrive);

    // the sword's point, in this canvas, and the parallax it drives
    const cv = document.querySelector('ss-world-canvas canvas'), box = cv?.getBoundingClientRect();
    const sx = box && box.width ? WC / box.width : 1, sy = box && box.height ? HC / box.height : 1;
    const toHere = (x: number, y: number): [number, number] => (box ? [(x - box.left) * sx, (y - box.top) * sy] : [x, y]);
    let tipX = -9999, tipY = -9999;
    if (ONE.tip) [tipX, tipY] = toHere(ONE.tip.x, ONE.tip.y);
    const pxT = tipX > -9000 ? tipX / WC - 0.5 : 0, pyT = tipY > -9000 ? tipY / HC - 0.5 : 0;
    ONE.parX += (-pxT * 26 - ONE.parX) * Math.min(1, dt * 3);
    ONE.parY += (-pyT * 18 - ONE.parY) * Math.min(1, dt * 3);
    const LX = this.CX + ONE.parX, LY = this.CY + ONE.parY;
    // a wave of resolution thrown off the light on a real hit, and the one a click threw
    if (aO > 0.42 && t - this.wave > 1.5) this.wave = t;
    const wp = (t - this.wave) / 2.3, wave = wp >= 0 && wp < 1 ? wp : 0;
    if (ONE.clickAt) { const [x, y] = toHere(ONE.clickAt.x, ONE.clickAt.y); this.cw = { x, y, t0: t }; ONE.clickAt = null; }
    let cw: { x: number; y: number; p: number } | null = null;
    if (this.cw) { const q = (t - this.cw.t0) / 1.5; if (q >= 0 && q < 1) cw = { x: this.cw.x, y: this.cw.y, p: q }; else this.cw = null; }
    const ev = this.evTick(t);
    ONE.ev = ev;

    // 1 ── the void, and behind the field the old garden showing through, or the light going out
    p.set(this.base.px);
    this.evBack(r, ev, t);
    // 2 ── the shafts coming through the span, then the spokes of the coordinate space
    const rl = (0.55 + beat * 0.45) * ease * 4, ray = this.ray;
    for (let k = 0; k < p.length; k++) {
      const lv = ray[k] * rl;
      if (lv < 0.03) continue;
      const th = BAYER[((((k / W) | 0) & 3) << 2) | (k % W & 3)];
      if (lv > th) { p[k] = UP1[p[k]]; if (lv - 1 > th) p[k] = UP1[p[k]]; }
    }
    const maxR = Math.hypot(Math.max(LX, WC - LX), Math.max(LY, HC - LY)), spin = t * 0.021;
    const tipAng = tipX > -9000 ? Math.atan2(tipY - LY, tipX - LX) : 0;
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * TAU + spin, c1 = Math.cos(ang), s1 = Math.sin(ang);
      let near = 0;
      if (tipX > -9000) { const d = Math.abs(((ang - tipAng + Math.PI * 3) % TAU) - Math.PI); near = Math.max(0, 1 - d / 0.42); }
      const lv = near > 0.02 ? near * near * (0.2 + ONE.pulse * 0.45) : (0.02 + beat * 0.02) * ease;
      const ink = near > 0.02 ? SPEC[hueAt(c1, s1)][Math.max(0, step(lv * 2))] : c[0];
      r.line((LX + c1 * S * 0.05) / px, (LY + s1 * S * 0.05) / px, (LX + c1 * maxR) / px, (LY + s1 * maxR) / px,
        (x, y) => (Math.min(1, lv * 6) > BAYER[((y & 3) << 2) | (x & 3)] && LUM1[ink] > LUM1[r.get(x, y)] ? ink : 0));
    }

    // 3 ── the field coming at you, and the chains of digits it travels down
    this.field(r, dt, t, aL, beat, wave, tipX, tipY, cw, ease, ev, LX, LY);
    this.chains(r, t, beat, LX, LY);
    this.evFront(r, ev, t, LX, LY);

    // 4 ── the wreck of the garden, still out there
    this.wreck(r, t, ease);
    // 5 ── the far span, and the canopy overhead rocked round its root
    const fx = ONE.parX * 0.8, fy = ONE.parY * 0.8;
    this.drawSpans(r, this.far, (x, y) => [(x + fx) / px, (y + fy) / px], false, ease, 0);
    const rock = Math.sin(t * 0.13) * 0.018 + Math.sin(t * 0.061) * 0.01 + beat * 0.006 + (ev?.name === 'wingbeat' ? Math.sin(Math.PI * ev.p) * 0.06 : 0);
    const rx = WC * 1.06, ry = HC * 0.02, ox = rx + ONE.parX * 0.5, oy = ry + ONE.parY * 0.5, cr = Math.cos(rock), sr = Math.sin(rock);
    const rocked = (x: number, y: number): [number, number] => [(ox + (x - rx) * cr - (y - ry) * sr) / px, (oy + (x - rx) * sr + (y - ry) * cr) / px];
    this.drawSpans(r, this.canopy, rocked, false, ease, beat > 0.2 ? 1 : 0);
    for (let k = 2; k < this.arm.length; k += 2) {
      const [x0, y0] = rocked(this.arm[k - 2], this.arm[k - 1]), [x1, y1] = rocked(this.arm[k], this.arm[k + 1]);
      for (let o = -1; o <= 0; o++) r.line(x0, y0 + o, x1, y1 + o, m[beat > 0.3 ? 3 : 2]);
    }

    // 6 ── the light itself, and the waves leaving it
    this.prismAt(r, LX, LY, S * 0.032, t, beat, ONE.pulse + (1 - ease) * 0.8);
    if (wave > 0) this.circle(r, LX, LY, wave * maxR * 1.1, 1 + (1 - wave) * 4, (1 - wave) ** 2.1 * 0.55, m[4]);
    if (cw) this.circle(r, cw.x, cw.y, cw.p * maxR * 0.9, 1 + (1 - cw.p) * 3.5, (1 - cw.p) ** 2.2 * 0.6, w[3]);

    // 7 ── the near plane: debris going past, turned so its lit edge faces the light
    const shSpeed = (210 + aL * 460 + beat * 320) * (1 + (1 - ease) * 6);
    for (const sh of this.shards) {
      sh.z -= shSpeed * sh.sp * dt;
      if (sh.z < NEAR * 0.7) { sh.z = FAR; sh.a = Math.random() * TAU; sh.r = 200 + Math.random() * 900; }
      const k = FOCAL / sh.z, x = LX + Math.cos(sh.a) * sh.r * k, y = LY + Math.sin(sh.a) * sh.r * 0.72 * k, sz = sh.size * k * 0.8;
      if (sz < 6 || sz > HC * 0.55 || x < -sz || x > WC + sz || y < -sz || y > HC + sz) continue;
      this.shardAt(r, sh, x, y, sz, Math.atan2(LY - y, LX - x) + 1.047 + Math.sin(t * sh.vr * 8 + sh.seed) * 0.08, Math.min(1, 0.35 + (1 - sh.z / FAR) * 0.9) * ease);
    }

    // 8 ── the void closing in, the light coming back on, and the bloom
    const vig = this.vig;
    for (let k = 0; k < p.length; k++) {
      const lv = vig[k];
      if (lv < 0.03) continue;
      const th = BAYER[((((k / W) | 0) & 3) << 2) | (k % W & 3)];
      if (lv > th) p[k] = DN1[p[k]];
    }
    const fl = ev?.name === 'eclipse' && ev.p > 0.62 ? (1 - (ev.p - 0.62) / 0.38) ** 2.2 : 0;
    if (fl > 0.05) this.flash = FLASH[Math.min(4, Math.floor(fl * 5))];
    this.glow(r, 0.3 + beat * 0.22 + fl * 0.5);
  }

  /** The field: every mote has a real depth, is projected and comes at you; far out it is still every digit, near the light it reads 1. */
  private field(r: Raster, dt: number, t: number, aL: number, beat: number, wave: number, tipX: number, tipY: number,
    cw: { x: number; y: number; p: number } | null, arrive: number, ev: Ev | null, cx: number, cy: number): void {
    const { WC, HC, px } = this, maxD = Math.hypot(WC, HC) * 0.5, pos = this.pos;
    const speed = (210 + aL * 460 + beat * 320) * (1 + (1 - arrive) * 6);
    pos.length = 0;
    for (const o of this.motes) {
      o.z -= speed * dt;
      if (o.z < NEAR) { this.mote(o, false); continue; }
      const k = FOCAL / o.z, sx = cx + o.x * k, sy = cy + o.y * k;
      if (sx < -40 || sx > WC + 40 || sy < -40 || sy > HC + 40) { o.px = NaN; continue; }
      let res = (o.z - 700) / 1500;
      if (wave > 0) { const d = Math.hypot(sx - cx, sy - cy); if (d < wave * maxD) res = Math.max(res, 1 - (wave * maxD - d) / (maxD * 0.5)); }
      if (cw) { const d = Math.hypot(sx - cw.x, sy - cw.y), R = cw.p * maxD * 0.85; if (d < R) res = Math.max(res, 1 - (R - d) / (maxD * 0.4)); }
      if (ev?.name === 'cascade') { if ((sx - cx) * ev.dirX + (sy - cy) * ev.dirY < (ev.p * 2 - 1) * Math.hypot(WC, HC) * 0.75) res = 1; }
      else if (ev?.name === 'zero' && ev.zx !== undefined) { const d = Math.hypot(sx - ev.zx, sy - ev.zy!); if (d < ev.zr!) { res = Math.min(res, (d / ev.zr!) * 0.4); o.lock = false; } }
      let touched = 0;
      if (tipX > -9000) { const td = Math.hypot(sx - tipX, sy - tipY); if (td < 150) { touched = 1 - td / 150; res = Math.max(res, touched); } }
      res = Math.max(0, Math.min(1, res));
      if (res > 0.75) {
        // THE MOMENT IT RESOLVES, which is the whole idea of the page
        if (!o.lock) { o.lock = true; o.ch = '1'; if (this.flashes.length < 90) this.flashes.push({ x: sx, y: sy, life: 1, s: 9 * k }); }
      } else {
        o.lock = false;
        o.mut -= dt * (1.4 + aL * 2.6);
        if (o.mut <= 0) { o.mut = 0.08 + Math.random() * 0.4; o.ch = DIGITS[(Math.random() * 10) | 0]; }
      }
      const sz = 26 * k * (0.7 + o.br * 0.6), near = 1 - (o.z - NEAR) / (FAR - NEAR);
      const a = Math.min(1, (0.16 + near * 0.62) * o.br + touched * 0.7) * (0.45 + res * 0.65) * arrive;
      if (a < 0.03) { o.px = NaN; continue; }
      const X = sx / px, Y = sy / px, hue = SPEC[hueAt(o.x, o.y)];
      // depth of field, the pixel-art kind: too far to read is a pixel
      if (sz < 10.4) {
        const s = step(a);
        if (s >= 0) { const d = Math.max(1, Math.round((sz * 0.5) / px)); for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) lighten(r, X - d / 2 + i, Y - d / 2 + j, hue[s]); }
        o.px = NaN;
        continue;
      }
      // the streaks off the near ones
      if (k > 0.85 && !isNaN(o.px)) r.line(o.px / px, o.py / px, X, Y, (x, y) => (LUM1[c[aL > 0.4 ? 2 : 1]] > LUM1[r.get(x, y)] ? c[aL > 0.4 ? 2 : 1] : 0));
      o.px = sx; o.py = sy;
      if (pos.length < 400) pos.push(sx, sy);
      const sc = Math.max(1, Math.min(8, Math.round((sz * 0.62) / (5 * px))));
      if (o.prism) {
        // the few that carry the whole spectrum down their height
        bigGlyph(r, X, Y, o.ch, sc, row => SPEC[Math.min(7, Math.round((row / 4) * 7))][Math.max(1, step(Math.min(1, a * 1.7)))]);
        continue;
      }
      const s = step(a);
      if (s < 0) continue;
      const ink = touched > 0.15 ? w[Math.min(4, s + 1)] : res > 0.75 ? m[Math.min(6, s + 3)] : hue[s];
      if (sc === 1) glyph(r, X - 1, Y - 2, o.ch, ink); else bigGlyph(r, X, Y, o.ch, sc, () => ink);
    }
    // and the ones caught in the act
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt * 3.4;
      if (f.life <= 0) { this.flashes.splice(i, 1); continue; }
      this.circle(r, f.x, f.y, f.s * (1 + (1 - f.life) * 2.4), 1, f.life * f.life * 0.8, w[3]);
    }
  }
  /** Chains of digits running past on the same perspective, so they belong to the space. */
  private chains(r: Raster, t: number, beat: number, cx: number, cy: number): void {
    const { WC, HC, px } = this;
    this.conduits.forEach((cd, ci) => {
      const head = (cd.z0 - t * cd.spd) % FAR;
      for (let i = 0; i < cd.n; i++) {
        const z = (((head + i * 74) % FAR) + FAR) % FAR;
        if (z < NEAR + 30) continue;
        const uu = i / cd.n, ang = cd.a + cd.curl * uu + Math.sin(t * 0.3 + ci) * 0.12, rr = cd.r * (1 + uu * 0.35), k = FOCAL / z;
        const sx = cx + Math.cos(ang) * rr * k, sy = cy + (Math.sin(ang) * rr * 0.72 + cd.rise * uu) * k;
        if (sx < -30 || sx > WC + 30 || sy < -30 || sy > HC + 30) continue;
        const sz = 42 * k;
        if (sz < 9) continue;
        const near = 1 - (z - NEAR) / (FAR - NEAR), a = Math.min(1, (0.22 + near * 0.72) * cd.br * (1 - uu * 0.35) + beat * 0.2), s = step(a);
        if (s < 0) continue;
        const ink = near > 0.62 ? w[Math.min(4, s + 1)] : SPEC[hueAt(sx - cx, sy - cy)][s];
        const ch = z > 1500 ? '1' : DIGITS[((ci * 7 + i) * 3 + ((t * 3) | 0)) % 10], sc = Math.max(1, Math.min(8, Math.round((sz * 0.62) / (5 * px))));
        if (sc === 1) glyph(r, sx / px - 1, sy / px - 2, ch, ink); else bigGlyph(r, sx / px, sy / px, ch, sc, () => ink);
      }
    });
  }

  /** The wreck of the Code Garden: dead green, no light of its own, broken open, turning very slowly. */
  private wreck(r: Raster, t: number, ease: number): void {
    const { WC, HC, px, S } = this, Sw = S * 0.42, R = Sw * 0.36;
    const ox = WC * 0.15 + ONE.parX * 1.6, oy = HC * 0.8 + ONE.parY * 1.6 + Math.sin(t * 0.11) * HC * 0.012, rot = t * 0.012 + 0.2;
    const cr = Math.cos(rot), sr = Math.sin(rot), at = (x: number, y: number): [number, number] => [(ox + x * cr - y * sr) / px, (oy + x * sr + y * cr) / px];
    const lv = 0.85 * ease, ok = (x: number, y: number) => lv > BAYER[((y & 3) << 2) | (x & 3)];
    for (let i = 0; i < 9; i++) {
      const a0 = rnd(i * 4.1) * TAU, sp = 0.25 + rnd(i * 6.7) * 0.5, rr = R * (0.72 + rnd(i * 9.3) * 0.5), ink = rk[Math.min(3, 1 + Math.floor(rnd(i * 3.3) * 2.99))];
      const n = Math.max(4, Math.ceil((sp * rr) / px) * 2), thick = rnd(i * 8.1) > 0.5 ? 2 : 1;
      for (let k = 0; k <= n; k++) {
        const an = a0 + (sp * k) / n;
        for (let d = 0; d < thick; d++) { const [x, y] = at(Math.cos(an) * (rr + d * px), Math.sin(an) * (rr + d * px)); if (ok(x | 0, y | 0)) r.set(x, y, ink); }
      }
    }
    for (let i = 0; i < 7; i++) {
      const a = rnd(i * 12.7) * TAU, l = R * (0.4 + rnd(i * 15.1) * 0.75);
      const [x0, y0] = at(Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18), [x1, y1] = at(Math.cos(a + 0.3) * l, Math.sin(a + 0.3) * l);
      r.line(x0, y0, x1, y1, (x, y) => (ok(x, y) ? rk[rnd(i * 2.9) > 0.5 ? 2 : 1] : 0));
    }
    for (let i = 0; i < 5; i++) {
      // plates torn off it
      const a = 0.7 + rnd(i * 19.1) * 4.2, d = R * (0.85 + rnd(i * 23.7) * 0.6), ps = Sw * (0.05 + rnd(i * 27.3) * 0.07), pr = rnd(i * 31.9) * TAU;
      const pcx = Math.cos(a) * d, pcy = Math.sin(a) * d, pc = Math.cos(pr), psn = Math.sin(pr);
      const pts = [[-ps, -ps * 0.5], [ps * 0.8, -ps * 0.72], [ps, ps * 0.55], [-ps * 0.6, ps * 0.8]].flatMap(([x, y]) => at(pcx + x * pc - y * psn, pcy + x * psn + y * pc));
      r.poly(pts, (x, y) => (ok(x, y) ? v[1] : 0));
      for (let k = 0; k < 4; k++) r.line(pts[k * 2], pts[k * 2 + 1], pts[((k + 1) % 4) * 2], pts[((k + 1) % 4) * 2 + 1], (x, y) => (ok(x, y) ? rk[rnd(i * 33.1) > 0.5 ? 2 : 1] : 0));
    }
    for (let i = 0; i < 14; i++) {
      const a = rnd(i * 5.9) * TAU, d = R * (0.5 + rnd(i * 7.7) * 0.6), [x, y] = at(Math.cos(a) * d, Math.sin(a) * d);
      const ink = rk[rnd(i * 13.9) > 0.5 ? 3 : 2];
      if (lv > 0.5) glyph(r, x - 1, y - 2, DIGITS[(rnd(i * 17.3) * 10) | 0], ink);
    }
  }

  /** Spans of blades: filled close to the void so the lit edges carry the shape. `mask` only fills (for the rays). */
  private drawSpans(r: Raster, spans: Span[], at: (x: number, y: number) => [number, number], mask: boolean, level = 1, lift = 0): void {
    const ok = (x: number, y: number) => level > BAYER[((y & 3) << 2) | (x & 3)];
    const line = (pts: number[], ink: number) => {
      let [lx, ly] = at(pts[0], pts[1]);
      for (let k = 2; k < pts.length; k += 2) { const [x, y] = at(pts[k], pts[k + 1]); r.line(lx, ly, x, y, (xx, yy) => (ok(xx, yy) ? ink : 0)); lx = x; ly = y; }
    };
    for (const sp of spans) {
      for (const vn of sp.vanes) {
        const pts: number[] = [];
        for (let k = 0; k < vn.fill.length; k += 2) pts.push(...at(vn.fill[k], vn.fill[k + 1]));
        if (mask) { r.poly(pts, 1); continue; }
        r.poly(pts, (x, y) => (ok(x, y) ? v[2] : 0));
        line(vn.lit, lift ? UP1[vn.litInk] : vn.litInk);
        // the lit edge two pixels wide where it is the main span's
        if (LUM1[vn.litInk] > 90) line(vn.lit.map((q2, i2) => (i2 % 2 ? q2 + this.px : q2)), vn.litInk);
        line(vn.dark, vn.darkInk);
      }
      if (!mask) line(sp.tips, lift ? UP1[sp.tipInk] : sp.tipInk);
    }
  }

  /** The prism: the one light, and the thing splitting it. */
  private prismAt(r: Raster, x: number, y: number, rad: number, t: number, beat: number, pulse: number): void {
    const px = this.px, b = 1 + beat * 0.5 + pulse * 0.7, X = x / px, Y = y / px;
    // the spectrum thrown off it, a wedge per hue, turning
    const outer = (rad * 6.4 * b) / px, rot = t * 0.18;
    for (let yy = Math.floor(Y - outer); yy <= Math.ceil(Y + outer); yy++) for (let xx = Math.floor(X - outer); xx <= Math.ceil(X + outer); xx++) {
      const dx = xx + 0.5 - X, dy = yy + 0.5 - Y, d = Math.hypot(dx, dy) * px;
      const an = (((Math.atan2(dy, dx) - rot) % TAU) + TAU) % TAU, i = Math.floor((an / TAU) * 8), into = an - (i / 8) * TAU;
      if (into > 0.62) continue;
      const rr = rad * (5.5 + Math.sin(t * 1.3 + i) * 0.9) * b, q = (d - rad * 0.4) / (rr - rad * 0.4);
      if (q < 0 || q > 1) continue;
      const lv = 0.2 * b * (1 - q) * 3;
      if (lv > BAYER[((yy & 3) << 2) | (xx & 3)]) lighten(r, xx, yy, SPEC[i][lv > 0.9 ? 2 : 1]);
    }
    // the halo
    const hr = (rad * 7 * b) / px;
    for (let yy = Math.floor(Y - hr); yy <= Math.ceil(Y + hr); yy++) for (let xx = Math.floor(X - hr); xx <= Math.ceil(X + hr); xx++) {
      const q = Math.hypot(xx + 0.5 - X, yy + 0.5 - Y) / hr;
      if (q >= 1 || xx < 0 || yy < 0 || xx >= r.w || yy >= r.h) continue;
      const lv = 0.36 * b * (1 - q) ** 2.7 * 5, th = BAYER[((yy & 3) << 2) | (xx & 3)], k = yy * r.w + xx;
      if (lv > th) { r.px[k] = UP1[r.px[k]]; if (lv - 1 > th) r.px[k] = UP1[r.px[k]]; if (lv - 2 > th) lighten(r, xx, yy, m[5]); }
    }
    // and the stone itself: a tall diamond, white to mint to sky, with a white edge
    const rr = (rad * (1 + beat * 0.14 + pulse * 0.2)) / px;
    const pts = [X, Y - rr * 1.5, X + rr, Y, X, Y + rr * 1.5, X - rr, Y];
    r.poly(pts, (xx, yy) => { const g = ((xx - (X - rr)) + (yy - (Y - rr))) / (rr * 4); return g < 0.3 ? w[3] : g < 0.62 ? m[5] : c[4]; });
    for (let k = 0; k < 4; k++) r.line(pts[k * 2], pts[k * 2 + 1], pts[((k + 1) % 4) * 2], pts[((k + 1) % 4) * 2 + 1], w[4]);
  }

  /** A shard of debris at (x, y) CSS px, sz across, turned by `rot`, at `level` (dithered in). */
  private shardAt(r: Raster, sh: Shard, x: number, y: number, sz: number, rot: number, level: number): void {
    const px = this.px, cr = Math.cos(rot), sr = Math.sin(rot), s = sz / px, X = x / px, Y = y / px;
    const pts: number[] = [];
    for (let k = 0; k < sh.pts.length; k += 2) pts.push(X + (sh.pts[k] * cr - sh.pts[k + 1] * sr) * s, Y + (sh.pts[k] * sr + sh.pts[k + 1] * cr) * s);
    // its face, with digits you can only just read on it
    const cell = Math.max(4, Math.round(s / 6));
    r.poly(pts, (xx, yy) => {
      if (level <= BAYER[((yy & 3) << 2) | (xx & 3)]) return 0;
      const dx = xx + 0.5 - X, dy = yy + 0.5 - Y, lu = (dx * cr + dy * sr) / s * 6 * cell, lvv = (-dx * sr + dy * cr) / s * 6 * cell;
      const gx = Math.floor(lu / cell), gy = Math.floor(lvv / cell), fx = Math.floor(((lu % cell) + cell) % cell / (cell / 4)), fy = Math.floor(((lvv % cell) + cell) % cell / (cell / 6));
      if (fx < 3 && fy < 5 && rnd(sh.seed + gx * 7.1 + gy * 13.3) < 0.55) {
        const ch = glyphAt(0.75, sh.seed + gx * 3.7 + gy * 9.1), bits = glyphMask(ch);
        if ((bits >> (14 - (fy * 3 + fx))) & 1) return v[rnd(sh.seed + gx + gy * 3) > 0.5 ? 5 : 4];
      }
      return C1['k1'];
    });
    // one lit edge, up and right in its own frame
    const n = sh.pts.length / 2;
    for (let k = 0; k < n; k++) {
      const ax = sh.pts[k * 2], ay = sh.pts[k * 2 + 1], bx = sh.pts[((k + 1) % n) * 2], by = sh.pts[((k + 1) % n) * 2 + 1];
      const mx = (ax + bx) / 2, my = (ay + by) / 2, facing = (mx * 0.5 + my * -0.86) / (Math.hypot(mx, my) || 1);
      if (facing < 0.05) continue;
      const ink = along(m, 0.2 + facing * 0.8);
      r.line(pts[k * 2], pts[k * 2 + 1], pts[((k + 1) % n) * 2], pts[((k + 1) % n) * 2 + 1], (xx, yy) => (level > BAYER[((yy & 3) << 2) | (xx & 3)] ? ink : 0));
    }
  }

  /** A ring of light (centre and radius CSS px, `wd` pixels thick) at `level`. */
  private circle(r: Raster, x: number, y: number, rad: number, wd: number, level: number, ink: number): void {
    const px = this.px, R = rad / px;
    if (R < 0.5 || level < 0.02) return;
    const lv = Math.min(1, level * 1.8);
    r.ring(x / px, y / px, R - wd / 2, R + wd / 2, (xx, yy) => (lv > BAYER[((yy & 3) << 2) | (xx & 3)] && LUM1[ink] > LUM1[r.get(xx, yy)] ? ink : 0));
  }

  /** Bloom: the frame's brightness, four pixels to a cell, smeared and laid back over it as light. */
  private glow(r: Raster, amount: number): void {
    const { W, H } = this, bw = this.bloomW, bh = this.bloomH, b = this.bloom, p = r.px;
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      let s = 0;
      for (let k = 0; k < 4; k++) { const x = Math.min(W - 1, i * 4 + (k & 1) * 2 + 1), y = Math.min(H - 1, j * 4 + (k >> 1) * 2 + 1); s += LUM1[p[y * W + x]]; }
      b[j * bw + i] = s / 4;
    }
    // smear it across its neighbours
    const sm = new Float32Array(b.length);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < bw && jj < bh) { const wgt = di || dj ? 1 : 2; s += b[jj * bw + ii] * wgt; n += wgt; }
      }
      sm[j * bw + i] = s / n;
    }
    for (let y = 0; y < H; y++) {
      const row = (y >> 2) * bw, by = (y & 3) << 2;
      for (let x = 0; x < W; x++) {
        const lv = (sm[row + (x >> 2)] - 70) / 140 * amount * 1.4;
        if (lv > BAYER[by | (x & 3)]) p[y * W + x] = UP1[p[y * W + x]];
      }
    }
  }

  // ── the events ──

  private evTick(t: number): Ev | null {
    const e = this.ev;
    if (e && !this.forced) {
      e.p = (t - e.t0) / e.dur;
      if (e.p < 1) return e;
      this.ev = null; this.nextEv = t + 6 + Math.random() * 5;
    }
    if (t < this.nextEv && !this.forced) return null;
    let name = this.forced || this.lastEv;
    for (let i = 0; i < 8 && name === this.lastEv && !this.forced; i++) name = EVENTS[(Math.random() * EVENTS.length) | 0];
    this.forced = '';
    this.lastEv = name;
    const a = Math.random() * TAU, { WC, HC } = this;
    this.ev = {
      name, t0: t, dur: EV_DUR[name], p: 0, a, dirX: Math.cos(a), dirY: Math.sin(a), ch: DIGITS[(Math.random() * 10) | 0], hue: (Math.random() * 8) | 0,
      x0: -0.2 * WC + Math.random() * 0.3 * WC, y0: Math.random() * HC, x1: WC * 1.15, y1: Math.random() * HC, side: Math.random() < 0.5 ? -1 : 1, pts: null,
    };
    return this.ev;
  }
  /** Starts an event on the next frame (the tests call it through the overlay). */
  force(name: string): void { if (EVENTS.includes(name)) this.forced = name; }
  private forced = '';

  /** Behind the field: the old garden showing through, and the light going out. */
  private evBack(r: Raster, e: Ev | null, t: number): void {
    if (!e) return;
    const { W, H, px, WC, HC } = this;
    if (e.name === 'garden') {
      // the room showing through the void it was standing in: same green, same rain, gone in under two seconds
      const env = Math.sin(Math.PI * e.p), cols = Math.min(46, Math.round(WC / 44));
      for (let i = 0; i < cols; i++) {
        const x = ((i + 0.5) * (WC / cols)) / px, head = ((t * (160 + rnd(i * 3.1) * 220) + rnd(i * 7.7) * HC * 3) % (HC * 1.4)) - HC * 0.2;
        const len = 6 + ((rnd(i * 5.3) * 9) | 0);
        for (let k = 0; k < len; k++) {
          const yy = (head - k * 32) / px;
          if (yy < -6 || yy > H + 6) continue;
          const a = env * (1 - k / len) * 0.5 * (0.4 + rnd(i * 2.3 + k) * 0.6);
          if (a < 0.05) continue;
          const ink = k === 0 ? gr[a > 0.25 ? 3 : 2] : gr[a > 0.3 ? 1 : 0];
          glyph(r, x - 1, yy - 2, DIGITS[(i * 7 + k * 3 + ((t * 9) | 0)) % 10], ink);
        }
      }
    }
    if (e.name === 'eclipse') {
      // the light gutters, and everything it lights goes with it
      const q = e.p < 0.62 ? Math.sin((e.p / 0.62) * Math.PI * 0.85) : 0, lv = q * 0.86 * 3, p = r.px;
      if (lv > 0.02) for (let k = 0; k < p.length; k++) {
        const th = BAYER[((((k / W) | 0) & 3) << 2) | (k % W & 3)];
        if (lv > th) { p[k] = DN1[p[k]]; if (lv - 1 > th) p[k] = DN1[p[k]]; if (lv - 2 > th) p[k] = DN1[p[k]]; }
      }
    }
  }

  /** In front of the field: the things that cross the frame. */
  private evFront(r: Raster, e: Ev | null, t: number, LX: number, LY: number): void {
    if (!e) return;
    const { W, H, px, WC, HC, S } = this, ep = e.p;
    if (e.name === 'comet') {
      // one enormous digit crossing the frame, the spectrum trailing it
      const fade = Math.sin(Math.PI * Math.min(1, ep * 1.15));
      for (let k = 7; k >= 0; k--) {
        const tu = Math.max(0, ep - k * 0.026);
        const tx = e.x0 + (e.x1 - e.x0) * tu, ty = e.y0 + (e.y1 - e.y0) * tu + Math.sin(tu * 3.1) * HC * 0.06;
        const ts = S * (0.16 + Math.sin(Math.PI * tu) * 0.5) * (1 - k * 0.045), sc = Math.max(1, Math.round((ts * 0.62) / (5 * px)));
        const s = step(fade * (k === 0 ? 0.95 : 0.26 - k * 0.028));
        if (s < 0) continue;
        bigGlyph(r, tx / px, ty / px, e.ch, sc, () => SPEC[(e.hue + k) % 8][s], true);
      }
    }
    if (e.name === 'zero') {
      // the value that did not survive, coming back through: it undoes the collapse where it passes
      const x = WC * 1.2 - WC * 1.5 * ep, y = HC * (0.28 + e.side * 0.16) + Math.sin(ep * 2.2) * HC * 0.05;
      e.zx = x; e.zy = y; e.zr = S * 0.42;
      const fade = Math.sin(Math.PI * Math.min(1, ep * 1.06)), sc = Math.max(2, Math.round((S * 0.78 * 0.62) / (5 * px)));
      bigGlyph(r, x / px, y / px, '0', sc, (_row, _col, xx, yy) => (fade * 0.9 > BAYER[((yy & 3) << 2) | (xx & 3)] ? v[0] : 0));
      for (let k = 0; k < 3; k++) {
        const ink = SPEC[(k * 3) % 8][Math.max(0, step(fade * 0.32 * 2))];
        glyphOutline(r, x / px + (k - 1) * 2, y / px, '0', sc, () => ink);
      }
    }
    if (e.name === 'cascade') {
      // the collapse as a straight front sweeping the field, lit along its edge
      const L = Math.hypot(WC, HC), edge = (ep * 2 - 1) * L * 0.75, env = Math.sin(Math.PI * ep), p = r.px;
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        const d = ((xx + 0.5) * px - LX) * e.dirX + ((yy + 0.5) * px - LY) * e.dirY - edge;
        if (d < 0 || d > L) continue;
        const lv = (d < L * 0.06 ? 0.5 - (d / (L * 0.06)) * 0.34 : 0.16 * (1 - (d - L * 0.06) / (L * 0.94))) * env * 3.2;
        const th = BAYER[((yy & 3) << 2) | (xx & 3)], k = yy * W + xx;
        if (lv > th) { p[k] = UP1[p[k]]; if (lv - 1 > th) lighten(r, xx, yy, m[4]); }
      }
    }
    if (e.name === 'constel') {
      // the field draws itself a figure out of whatever is there, holds it, and lets it go
      const pos = this.pos;
      if (!e.pts && pos.length >= 12) {
        const seed = ((Math.random() * (pos.length >> 1)) | 0) * 2, R = Math.min(WC, HC) * 0.42;
        const cand: number[][] = [];
        for (let i = 0; i < pos.length; i += 2) { const d = Math.hypot(pos[i] - pos[seed], pos[i + 1] - pos[seed + 1]); if (d < R) cand.push([pos[i], pos[i + 1], d]); }
        cand.sort((a, b) => a[2] - b[2]);
        const picked = cand.slice(0, 9), order = [picked[0][0], picked[0][1]], used = picked.map((_, i) => i === 0);
        for (let k = 1; k < picked.length; k++) {
          let best = -1, bd = 1e9;
          picked.forEach((q, j) => { if (used[j]) return; const d = Math.hypot(q[0] - order[order.length - 2], q[1] - order[order.length - 1]); if (d < bd) { bd = d; best = j; } });
          if (best < 0) break;
          used[best] = true; order.push(picked[best][0], picked[best][1]);
        }
        e.pts = order.length >= 6 ? order : null;
        if (!e.pts) (e as Ev & { dur: number }).dur = 0.12;
      }
      if (e.pts) {
        const env = Math.sin(Math.PI * ep), lv = Math.min(1, env * 1.2);
        for (let i = 2; i < e.pts.length; i += 2) r.line(e.pts[i - 2] / px, e.pts[i - 1] / px, e.pts[i] / px, e.pts[i + 1] / px, (xx, yy) => (lv > BAYER[((yy & 3) << 2) | (xx & 3)] ? w[2] : 0));
        for (let i = 0; i < e.pts.length; i += 2) { const s = step(env * 0.9); if (s >= 0) r.rect(e.pts[i] / px - 1, e.pts[i + 1] / px - 1, 2, 2, SPEC[((i >> 1) + e.hue) % 8][s]); }
      }
    }
    if (e.name === 'wingbeat') {
      const env = Math.sin(Math.PI * ep);
      this.circle(r, WC * 1.06, HC * 0.02, ep * Math.hypot(WC, HC) * 1.1, 1 + env * 4, (1 - ep) ** 1.8 * 0.4, m[3]);
    }
  }
}
