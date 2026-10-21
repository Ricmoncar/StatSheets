// THE HALL: the ballroom behind the sheet, seen head on the way the
// Underground draws its rooms. A wall of tall stained-glass windows between
// fluted pilasters, the rose window in the middle with the moon behind it,
// a full-length mirror under that, a black and red floor polished to a
// mirror, velvet curtains and a valance framing it like a stage, and a grand
// piano in the near corner. The chandelier hangs in front of the rose window,
// so the brightest thing in the room is behind its darkest.
//
// Everything that holds still is baked once per size into `back` (behind
// what moves) and `front` (the curtains and the piano, in front of it).
// Every frame copies `back`, draws what moves, lights it, lays `front` over
// it and darkens the edges.
import { Raster, bayer } from '../raster';
import { BUD, C, CARTOUCHE, DN, EYE, FIGURE, FLAME, FLAME_SM, ROSE5, ROSE7, SPLASH, UP, VOLUTE, clock, shift } from './look';

const TAU = Math.PI * 2;
const hash = (a: number, b = 0, c = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

interface Win { x0: number; x1: number; top: number; bot: number }
interface Flame { x: number; y: number; big: boolean; ph: number }
interface Drop { x: number; y: number; v: number; grow: number }
interface Mark { x: number; y: number; t: number }
interface Bit { x: number; y: number; vx: number; vy: number; c: number; life: number; rest: boolean; floor?: number }
interface Vine { pts: number[]; nodes: { k: number; side: number; kind: 'rose' | 'leaf' | 'thorn' }[]; delay: number }

export class Hall {
  readonly out: Raster;
  private readonly back: Raster;
  private readonly front: Raster;
  // the layout, in art pixels
  private readonly land: boolean;
  private readonly cx: number;
  private readonly corn: number;
  private readonly fy: number;
  private readonly dado: number;
  private readonly vy: number;
  private readonly rose: { x: number; y: number; r: number };
  private readonly moon: { x: number; y: number; r: number };
  private readonly mirror: Win;
  private readonly windows: Win[] = [];
  private readonly pillars: { x0: number; x1: number }[] = [];
  private readonly landY: number;   // where the drips from the chandelier land
  private readonly cone: Uint8Array;
  private readonly coneList: Int32Array;
  /** For each pixel the moonlight reaches, how strong the light must be to lift it a step (the dither, worked out once). */
  private readonly coneTh: Float32Array;
  /** A light's shape, worked out once per size: the pixels round it that it reaches, and how strongly. */
  private readonly stamps = new Map<string, { dx: Int16Array; dy: Int16Array; f: Float32Array }>();
  /** The pool's shape at each size it has been: where each pixel is, and its colour. */
  private readonly pools = new Map<number, { dx: Int16Array; dy: Int16Array; c: Uint8Array }>();
  /** The front layer as the list of pixels it covers, so laying it over the room skips the clear ones. */
  private readonly frontAt: Int32Array;
  private readonly frontC: Uint8Array;
  // the chandelier, baked as a sprite with its candles and crystals listed
  private readonly chand: { r: Raster; ox: number; oy: number; flames: Flame[]; crystals: number[]; tip: [number, number]; top: number };
  private readonly pianoFlames: Flame[] = [];
  private readonly sconces: Flame[] = [];
  private readonly keys: { x: number; y: number }[] = [];
  private readonly mirrorFlames: [number, number][] = [];
  private readonly stars: [number, number, number][] = [];
  private readonly vines: Vine[] = [];
  private readonly cw: number;
  private readonly tieY: number;
  // what moves
  private drops: Drop[] = [];
  private splashes: Mark[] = [];
  private ripples: Mark[] = [];
  private pool: number;
  private bits: Bit[] = [];        // petals and glass, falling and lying
  private motes: number[] = [];
  private nextDrop = 0;
  private lastT = 0;
  private crack: { pts: number[][]; for: number } | null = null;
  private lastThump = 0;
  private keyDown = -1;

  constructor(readonly W: number, readonly H: number) {
    this.out = new Raster(W, H);
    this.back = new Raster(W, H);
    this.front = new Raster(W, H);
    const land = this.land = W >= H * 0.9;
    this.cx = Math.round(land ? W * 0.56 : W * 0.5);
    const ceil = Math.max(8, Math.round(H * (land ? 0.07 : 0.05)));
    this.corn = ceil + 6;
    this.fy = Math.round(H * (land ? 0.64 : 0.6));
    const wallH = this.fy - this.corn;
    this.dado = this.fy - Math.max(10, Math.round(wallH * 0.17));
    this.vy = Math.round(this.corn + wallH * 0.42);
    const r = Math.max(14, Math.round(Math.min(wallH * 0.29, W * (land ? 0.095 : 0.21))));
    this.rose = { x: this.cx, y: this.corn + 4 + r, r };
    // the moon sits up and to the left behind the glass, where a pane is out and it shows through
    this.moon = { x: this.cx - Math.round(r * 0.4), y: this.rose.y - Math.round(r * 0.4), r: Math.round(r * 0.44) };
    const mw = Math.round(r * 0.86);
    this.mirror = { x0: this.cx - (mw >> 1), x1: this.cx - (mw >> 1) + mw, top: this.rose.y + r + 8, bot: this.fy - 1 };
    this.landY = this.fy + Math.round((H - this.fy) * 0.42);

    // windows and pilasters, outward from the middle bay
    const ww = Math.max(12, Math.min(28, Math.round(W * 0.056)));
    const pw = Math.max(6, Math.round(ww * 0.42)), gap = 3;
    const half = r + 8;
    this.pillars.push({ x0: this.cx - half - pw, x1: this.cx - half }, { x0: this.cx + half, x1: this.cx + half + pw });
    for (const side of [-1, 1]) {
      let edge = side < 0 ? this.cx - half - pw : this.cx + half + pw;
      for (let n = 0; n < 12; n++) {
        const x0 = side < 0 ? edge - gap - ww : edge + gap;
        if (x0 + ww < -4 || x0 > W + 4) break;
        this.windows.push({ x0, x1: x0 + ww, top: this.corn + 12, bot: this.dado - 6 });
        const p0 = side < 0 ? x0 - gap - pw : x0 + ww + gap;
        this.pillars.push({ x0: p0, x1: p0 + pw });
        edge = side < 0 ? p0 : p0 + pw;
      }
    }

    this.cw = Math.max(10, Math.round(W * (land ? 0.06 : 0.09)));
    this.tieY = Math.round(H * 0.52);
    this.chand = this.buildChandelier(r / 41);
    this.pool = r * 0.32;   // the floor has been bleeding a while before you came in
    this.bakeBack();
    this.bakeFront();
    // the moonlight: a cone from the rose window to the floor, with rays in it
    const cone = new Uint8Array(W * H), list: number[] = [];
    const top = this.rose.y + Math.round(r * 0.3), spread = W * (land ? 0.36 : 0.46);
    for (let y = top; y < H; y++) {
      const f = (y - top) / (H - top), half2 = r * 0.6 + f * (spread - r * 0.6);
      for (let x = Math.max(0, Math.floor(this.cx - half2)); x <= Math.min(W - 1, Math.ceil(this.cx + half2)); x++) {
        const u = (x - this.cx) / half2;
        const ang = Math.atan2(x - this.cx, y - this.rose.y);
        const ray = Math.pow(Math.max(0, Math.cos(ang * 9 + 0.6)), 6) * 0.55;
        const edge = 1 - smooth(0.7, 1, Math.abs(u));
        const fade = 1 - smooth(0.55, 1, f) * 0.6;
        const v = (0.24 + ray) * edge * fade;
        if (v < 0.04) continue;
        cone[y * W + x] = Math.min(255, Math.round(v * 255));
        list.push(y * W + x);
      }
    }
    this.cone = cone;
    this.coneList = Int32Array.from(list);
    this.coneTh = Float32Array.from(list, i => bayer(i % W, (i / W) | 0) / (cone[i] / 255));
    for (let k = 0; k < Math.round(W * H / 1800); k++) this.motes.push(hash(k, 1) * W, top + hash(k, 2) * (H - top), hash(k, 3) * TAU);
    // the edges sink into the dark, two steps at the corners: baked into both layers, not done every frame
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x / W - 0.5) * 2, v = (y / H - 0.5) * 2;
      const n = Math.floor(smooth(0.62, 1.25, Math.sqrt(u * u * 0.8 + v * v * 0.9)) * 2.2 + bayer(x, y));
      if (n <= 0) continue;
      const i = y * W + x;
      this.back.px[i] = shift(this.back.px[i], -n);
      if (this.front.px[i]) this.front.px[i] = shift(this.front.px[i], -n);
    }
    const at: number[] = [];
    this.front.px.forEach((v, i) => { if (v) at.push(i); });
    this.frontAt = Int32Array.from(at);
    this.frontC = Uint8Array.from(at, i => this.front.px[i]);
    this.buildVines();
  }

  // ════════════════════════════════════════════════════════════
  // BAKED: the room
  // ════════════════════════════════════════════════════════════
  private bakeBack(): void {
    const g = this.back, { W, H, corn, fy, dado, cx } = this;

    // ── the wall: a damask in two near-blacks ──
    g.rect(0, 0, W, fy, C['k1']);
    const DAM = ['......x.....', '.....xxx....', '....x.x.x...', '...x..x..x..', '......x.....', '..xx.xxx.xx.', '.x..xx.xx..x', '..xx.xxx.xx.', '......x.....', '.....x.x....', '....x...x...'];
    for (let y = corn; y < dado; y++) for (let x = 0; x < W; x++) {
      const ty = Math.floor((y - corn) / 13), sx = (x + (ty & 1) * 6) % 12, sy = (y - corn) % 13;
      if (sy < DAM.length && DAM[sy][sx] === 'x') g.set(x, y, C['k2']);
    }

    // ── the ceiling and the cornice ──
    g.rect(0, 0, W, corn - 6, C['k0']);
    for (let x = 4; x < W; x += 16) { g.rect(x, 2, 12, corn - 10, C['k1']); g.rect(x + 1, 3, 10, corn - 12, C['k0']); g.set(x + 6, (corn - 6) >> 1, C['r1']); }
    const cy0 = corn - 6;
    g.rect(0, cy0, W, 6, C['r1']);
    g.rect(0, cy0, W, 1, C['r3']);
    for (let x = 0; x < W; x += 3) g.rect(x, cy0 + 2, 2, 2, C['r2']);
    g.rect(0, cy0 + 4, W, 1, C['r2']);
    g.rect(0, cy0 + 5, W, 1, C['k0']);

    // ── the wainscot, the dado rail and the skirting ──
    g.rect(0, dado, W, fy - dado, C['k2']);
    for (let x = 3; x < W; x += 26) {
      const y0 = dado + 4, h = fy - dado - 9;
      if (h < 4) break;
      g.rect(x, y0, 21, 1, C['r2']); g.rect(x, y0, 1, h, C['r2']);
      g.rect(x, y0 + h - 1, 21, 1, C['k0']); g.rect(x + 20, y0, 1, h, C['k0']);
      g.rect(x + 1, y0 + 1, 19, h - 2, C['k3']);
    }
    g.rect(0, dado, W, 1, C['r3']); g.rect(0, dado + 1, W, 1, C['r2']); g.rect(0, dado + 2, W, 1, C['r0']);
    g.rect(0, fy - 3, W, 1, C['r2']); g.rect(0, fy - 2, W, 2, C['r1']);

    // ── the glow the rose window throws on the wall round it ──
    const { x: rx, y: ry, r } = this.rose;
    for (let y = ry - r - 16; y <= ry + r + 16; y++) for (let x = rx - r - 16; x <= rx + r + 16; x++) {
      const d = Math.hypot(x + 0.5 - rx, y + 0.5 - ry) - r;
      if (d < 0 || d > 16) continue;
      if ((1 - d / 16) * 0.85 > bayer(x, y)) g.set(x, y, UP[g.get(x, y)]);
    }

    // ── windows, pilasters, swags ──
    for (const w of this.windows) this.window(w);
    this.roseWindow();
    this.mirrorFrame();
    for (const p of this.pillars) this.pilaster(p.x0, p.x1);
    this.swags();
    // a sconce on each pilaster, which is what gives the wall a rhythm of small lights
    const sy = Math.round(corn + (dado - corn) * 0.46);
    for (const p of this.pillars) {
      const x = Math.round((p.x0 + p.x1) / 2) - 1;
      if (x < 4 || x > W - 6) continue;
      g.oval(x + 1, sy + 4, 2.4, 3.6, (xx, yy, u, v) => v < -0.3 ? C['r3'] : C['r1']);
      g.tube([x + 1, sy + 6, x - 1, sy + 3, x + 1, sy + 1], () => 1.2, [C['r4'], C['r2'], C['k1']], -1, -1);
      g.rect(x - 1, sy, 5, 1, C['r4']);
      g.rect(x, sy - 4, 2, 4, C['w2']); g.set(x + 1, sy - 3, C['w1']); g.set(x, sy - 4, C['w3']);
      this.sconces.push({ x, y: sy - 5, big: false, ph: x * 0.37 });
    }

    // ── the floor: black and red marble in perspective, polished to a mirror ──
    const D0 = fy - this.vy, ROWK = D0 * D0 / 3, COLK = D0 / 14;
    for (let y = fy; y < H; y++) {
      const dz = y - this.vy + 0.5;
      const rowF = ROWK / dz, row = Math.floor(rowF), vfrac = rowF - row;
      const nextRow = Math.floor(ROWK / (dz + 1));
      const depth = (y - fy) / (H - fy);
      for (let x = 0; x < W; x++) {
        const colF = (x + 0.5 - cx) * COLK / dz, col = Math.floor(colF), ufrac = colF - col;
        const red = ((row + col) & 1) === 1;
        const h = hash(row, col);
        const vein = Math.abs(((ufrac * 1.1 + vfrac * 0.8 + h * 3) % 1) - 0.5) < 0.035 + h * 0.02;
        let c = red ? (vein ? C['r2'] : C['r1']) : (vein ? C['k3'] : C['k1']);
        if (nextRow !== row) c = DN[c];   // the seam where one rank of tiles meets the next
        // the wall, upside down in the lacquer, dimmer the further down
        const ry2 = fy - 1 - (y - fy);
        const level = 0.5 * Math.pow(1 - depth, 1.3) + 0.06;
        if (ry2 >= corn && level > bayer(x, y)) {
          const xs = Math.min(W - 1, Math.max(0, x + Math.round(Math.sin(y * 0.9) * 0.6)));
          const rc = DN[DN[g.get(xs, ry2)]];
          if (rc !== C['k0']) c = rc;   // a black reflection would only darken the marble
        }
        g.set(x, y, c);
      }
    }
    // the light the floor takes at the foot of the wall
    for (let x = 0; x < W; x++) g.dot(x, fy, UP[g.get(x, fy)], 0.6);
    // petals already fallen, and a few more will
    for (let k = 0; k < Math.round(W / 24); k++) {
      const x = Math.floor(hash(k, 9) * W), y = Math.floor(fy + 3 + hash(k, 8) * (H - fy - 6));
      g.set(x, y, hash(k, 7) > 0.5 ? C['r3'] : C['r4']);
    }
  }

  private window(w: Win): void {
    const g = this.back;
    const ww = w.x1 - w.x0, rad = ww / 2, xc = w.x0 + rad, ay = w.top + rad;
    const inGlass = (x: number, y: number) => y >= w.top && y < w.bot && x >= w.x0 && x < w.x1 && (y >= ay || Math.hypot(x + 0.5 - xc, y + 0.5 - ay) <= rad);
    // the frame: three rings round the glass, outermost first
    for (let y = w.top - 4; y < w.bot + 1; y++) for (let x = w.x0 - 3; x < w.x1 + 3; x++) {
      if (inGlass(x, y)) continue;
      let d = 9;
      for (let k = 1; k <= 3 && d === 9; k++) if (inGlass(x - k, y) || inGlass(x + k, y) || inGlass(x, y + k) || inGlass(x, y - k)) d = k;
      if (d === 9) continue;
      const litSide = x < xc || y < ay - rad * 0.5;
      g.set(x, y, d === 3 ? C['k0'] : d === 2 ? C['r2'] : litSide ? C['r3'] : C['r1']);
    }
    // the glass: a lattice of diamonds, brighter at the top where the moon is, with a rose in it
    const embY = Math.round(w.top + (w.bot - w.top) * 0.3), embR = Math.max(2, Math.round(ww * 0.26));
    const tr = Math.round(w.top + (w.bot - w.top) * 0.62);
    for (let y = w.top; y < w.bot; y++) for (let x = w.x0; x < w.x1; x++) {
      if (!inGlass(x, y)) continue;
      const u = (x - xc + y) / 5, v = (x - xc - y) / 5;
      const cu = Math.floor(u), cv = Math.floor(v);
      const lead = u - cu < 0.22 || v - cv < 0.22 || y === tr;
      const h = hash(cu, cv, w.x0);
      if (lead) { g.set(x, y, C['k0']); continue; }
      if (h > 0.955) {
        // a pane gone: the night through it, and now and then a star
        g.set(x, y, (y - w.top) < (w.bot - w.top) * 0.4 ? C['n2'] : C['n1']);
        if (hash(x, y, 1) > 0.9) this.stars.push([x, y, hash(x, y, 2)]);
        continue;
      }
      const up = (y - w.top) < (w.bot - w.top) * 0.35 ? 1 : 0;
      let c = (h > 0.62 ? C['g2'] : C['g1']);
      c = shift(c, up);
      const de = Math.hypot(x + 0.5 - xc, y + 0.5 - embY);
      if (de < embR) c = de < embR * 0.45 ? C['b2'] : de < embR * 0.75 ? C['g4'] : C['g3'];
      g.set(x, y, c);
    }
    // the sill, and the cartouche over the arch
    g.rect(w.x0 - 3, w.bot, ww + 6, 1, C['r3']); g.rect(w.x0 - 3, w.bot + 1, ww + 6, 2, C['r1']); g.rect(w.x0 - 3, w.bot + 3, ww + 6, 1, C['k0']);
    g.blit(CARTOUCHE, Math.round(xc - CARTOUCHE.w / 2), w.top - 9);
  }

  private roseWindow(): void {
    const g = this.back, { x: rx, y: ry, r } = this.rose, m = this.moon;
    const SECT = 12;
    for (let y = ry - r - 4; y <= ry + r + 4; y++) for (let x = rx - r - 4; x <= rx + r + 4; x++) {
      const dx = x + 0.5 - rx, dy = y + 0.5 - ry, d = Math.hypot(dx, dy);
      if (d > r + 4) continue;
      const a = (Math.atan2(dy, dx) + TAU) % TAU;
      // the frame: dark line, a band of red gilt lit on the upper left, studs round it
      if (d > r) {
        const k = d - r;
        const lit = dx + dy < 0;
        let c = k > 3 ? C['k0'] : k > 2.2 ? (lit ? C['r4'] : C['r2']) : k > 1 ? (lit ? C['r3'] : C['r1']) : C['k0'];
        if (k > 1 && k <= 3 && Math.abs(((a / TAU) * 24) % 1 - 0.5) < 0.12) c = C['r5'];
        g.set(x, y, c);
        continue;
      }
      // tracery: spokes, an inner ring round the medallion, a ring of cusps
      const sec = Math.floor((a / TAU) * SECT), sa = (a / TAU) * SECT - sec;
      const inner = r * 0.34, mid = r * 0.68;
      const cuspA = ((sec + 0.5) / SECT) * TAU, cuspX = rx + Math.cos(cuspA) * r * 0.84, cuspY = ry + Math.sin(cuspA) * r * 0.84;
      const cd = Math.hypot(x + 0.5 - cuspX, y + 0.5 - cuspY), cr = r * 0.13;
      const sw = 0.6 / ((TAU / SECT) * d);   // half a spoke's width, as a fraction of the sector
      const spoke = d > inner && (sa < sw || sa > 1 - sw);
      // The middle of the window is where the light is, and where the chandelier hangs in front of it, so
      // it is bright and quiet glass with pale leading; all the dark tracery is in the outer ring. Detail
      // behind a silhouette is what lost the chandelier against this window the first two times.
      let lead = Math.abs(d - mid) < 0.7 || Math.abs(cd - cr) < 0.7 || d > r - 1 || (spoke && d > mid);
      let soft = d < mid && (spoke || Math.abs(d - inner) < 0.6);
      let c: number;
      if (d < inner) {
        // the medallion: a six-petalled rose round a ruby
        let pd = 99;
        for (let k = 0; k < 6; k++) { const pa = k * TAU / 6 - Math.PI / 2; pd = Math.min(pd, Math.hypot(x + 0.5 - rx - Math.cos(pa) * inner * 0.5, y + 0.5 - ry - Math.sin(pa) * inner * 0.5)); }
        const pr = inner * 0.36;
        soft = Math.abs(pd - pr) < 0.6 && d > inner * 0.24;
        c = d < inner * 0.24 ? (dx + dy < -1 ? C['b3'] : C['b2']) : pd < pr ? C['g5'] : C['g4'];
      } else if (cd < cr) c = C['g4'];
      else if (d < mid) c = 0.2 > bayer(x, y) ? C['g5'] : C['g4'];
      else c = sec & 1 ? C['g2'] : C['g1'];
      if (soft) c = C['g3'];
      // the moon behind it: the glass in front of it burns the moon's colour, so it shows as a disc through the tracery
      const md = Math.hypot(x + 0.5 - m.x, y + 0.5 - m.y);
      if (md < m.r) {
        const g = c === C['g5'] || c === C['g4'] ? 3 : c === C['g3'] ? 2 : 1;
        c = md > m.r - 1.2 ? C['m0'] : (x - m.x) + (y - m.y) < -m.r * 0.5 ? C['m3'] : [C['m1'], C['m1'], C['m2'], C['m3']][g];
      }
      // a pane is gone, low on the right: the night through it
      const broken = d > mid + 1 && sec === 2 && sa > 0.18 && sa < 0.82 && hash(x, y) > 0.08;
      if (broken) {
        c = C['n2'];
        if (hash(x, y, 3) > 0.94) this.stars.push([x, y, hash(x, y, 4)]);
        lead = false;
      }
      // the leading is wine, not black: the chandelier in front of it has to be the darkest thing against the glass
      g.set(x, y, lead ? (d > r - 1 ? C['k0'] : C['g0']) : c);
    }
    // a keystone rose at the top of the frame
    g.blit(ROSE7, rx - 3, ry - r - 6);
  }

  private mirrorFrame(): void {
    const g = this.back, m = this.mirror;
    const w = m.x1 - m.x0, rad = w / 2, xc = m.x0 + rad, ay = m.top + rad;
    const inGlass = (x: number, y: number) => y >= m.top && y < m.bot - 3 && x >= m.x0 && x < m.x1 && (y >= ay || Math.hypot(x + 0.5 - xc, y + 0.5 - ay) <= rad);
    for (let y = m.top - 5; y < m.bot; y++) for (let x = m.x0 - 4; x < m.x1 + 4; x++) {
      if (inGlass(x, y)) {
        // dark glass with a slanting sheen; in it, the room behind you: a window, the floor, the glow from above
        let c = C['n1'];
        const fu = (x + 0.5 - xc) / rad, fv = (y - m.top) / (m.bot - m.top);
        const archTop = 0.3, archR = 0.42;
        const inArch = Math.abs(fu) < archR && (fv > archTop + archR * rad / (m.bot - m.top) || Math.hypot(fu, (fv - archTop - archR * rad / (m.bot - m.top)) * (m.bot - m.top) / rad) < archR) && fv < 0.72;
        if (inArch) c = 0.4 > bayer(x, y) ? C['g1'] : C['n2'];
        if (fv > 0.8) {
          const row = Math.floor((fv - 0.8) * 40), col = Math.floor(fu * (3 + row));
          c = ((row + col) & 1) && 0.6 > bayer(x, y) ? C['r1'] : C['k2'];
        }
        if (((x - y * 0.5) % 13 + 13) % 13 < 2) c = 0.5 > bayer(x, y) ? C['n2'] : c;
        const top = (y - m.top) / (m.bot - m.top);
        if (top < 0.25 && (0.25 - top) * 2.2 > bayer(x, y)) c = C['g1'];
        g.set(x, y, c);
        continue;
      }
      let d = 9;
      for (let k = 1; k <= 4 && d === 9; k++) if (inGlass(x - k, y) || inGlass(x + k, y) || inGlass(x, y + k) || inGlass(x, y - k)) d = k;
      if (d === 9) continue;
      const lit = x < xc;
      g.set(x, y, d === 4 ? C['k0'] : d === 3 ? C['r2'] : d === 2 ? (lit ? C['r4'] : C['r2']) : C['r1']);
    }
    // the plinth it stands on, and its crest
    g.rect(m.x0 - 6, m.bot - 3, w + 12, 1, C['r3']); g.rect(m.x0 - 6, m.bot - 2, w + 12, 2, C['r1']);
    g.blit(CARTOUCHE, Math.round(xc - CARTOUCHE.w / 2), m.top - 11);
    for (let k = 0; k < 4; k++) this.mirrorFlames.push([Math.round(m.x0 + w * (0.2 + 0.2 * k)), Math.round(m.top + rad + (m.bot - m.top) * (0.35 + 0.08 * (k & 1)))]);
  }

  private pilaster(x0: number, x1: number): void {
    const g = this.back, { corn, fy } = this;
    for (let x = x0; x < x1; x++) {
      const k = x - x0, w = x1 - x0;
      const c = k === 0 ? C['r1'] : k === w - 1 ? C['k0'] : (k & 1) ? C['k3'] : C['k1'];
      g.rect(x, corn, 1, fy - corn, c);
    }
    // capital and base
    g.rect(x0 - 1, corn, x1 - x0 + 2, 2, C['r2']); g.rect(x0 - 1, corn, x1 - x0 + 2, 1, C['r3']);
    g.blit(VOLUTE, x0 - 3, corn + 2);
    g.blit(VOLUTE, x1 - VOLUTE.w + 3, corn + 2, true);
    g.rect(x0 - 1, fy - 7, x1 - x0 + 2, 1, C['r3']); g.rect(x0 - 1, fy - 6, x1 - x0 + 2, 4, C['r1']); g.rect(x0 - 2, fy - 2, x1 - x0 + 4, 2, C['r2']);
  }

  /** Fabric swags under the cornice from pilaster to pilaster, a rose where each is caught up. */
  private swags(): void {
    const g = this.back, ps = this.pillars.slice().sort((a, b) => a.x0 - b.x0), y0 = this.corn + 2;
    for (let k = 0; k + 1 < ps.length; k++) {
      const a = (ps[k].x0 + ps[k].x1) / 2, b = (ps[k + 1].x0 + ps[k + 1].x1) / 2;
      if (b - a > this.rose.r * 2.4) continue;   // not across the rose window
      const sag = Math.max(3, Math.round((b - a) * 0.22));
      const pts: number[] = [];
      for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push(a + (b - a) * u, y0 + Math.sin(Math.PI * u) * sag); }
      g.tube(pts, () => 3, [C['r3'], C['r2'], C['r0']], 0, -1);
    }
    for (const p of ps) g.blit(ROSE5, Math.round((p.x0 + p.x1) / 2) - 2, y0 - 1);
  }

  private bakeFront(): void {
    const g = this.front, { W, H, land } = this;
    // ── the curtains, tied back, and the valance across the top ──
    const { cw, tieY } = this;
    for (const side of [-1, 1]) {
      for (let y = 0; y < H; y++) {
        const above = y < tieY;
        const inner = above ? cw * (1 - 0.38 * smooth(0, tieY, y)) : cw * (0.62 + 0.75 * smooth(tieY, H, y));
        for (let x = 0; x <= inner + 1; x++) {
          const X = side < 0 ? x : W - 1 - x;
          if (x > inner) { g.set(X, y, C['k0']); continue; }
          const u = x / Math.max(1, inner);
          const f = Math.sin(u * Math.PI * (above ? 3.2 : 2.6) + (above ? 0 : (y - tieY) * 0.015));
          let c = f > 0.62 ? C['r3'] : f > 0.1 ? C['r2'] : f > -0.55 ? C['r1'] : C['r0'];
          if (x >= inner - 1) c = C['r4'];
          g.set(X, y, c);
        }
      }
      // the tie: a rope round it, and a tassel
      const tx = side < 0 ? 0 : W - 1, len = Math.round(cw * 0.7);
      const pts = [tx, tieY - 1, tx + side * -len * 0.5, tieY + 1, tx + side * -len, tieY];
      g.tube(pts, () => 3, [C['r5'], C['r4'], C['r2']], 0, -1);
      const qx = Math.round(tx - side * len);
      g.oval(qx + 0.5, tieY + 2.5, 2, 2, (x, y, u, v) => u + v < -0.3 ? C['r5'] : C['r3']);
      g.rect(qx - 2, tieY + 5, 5, 1, C['r4']);
      for (let i = -2; i <= 2; i++) g.line(qx + i * 0.6, tieY + 6, qx + i * 1.2, tieY + 13 - Math.abs(i), (i & 1) ? C['r5'] : C['r3']);
    }
    // the valance: velvet scallops with a fringe, caught up at each pilaster's line
    const sw = Math.max(26, Math.round(W / Math.max(3, Math.round(W / 46)))), base = this.corn - 4, sag = Math.max(4, Math.round(sw * 0.16));
    for (let x = 0; x < W; x++) {
      const u = (x % sw) / sw, bottom = Math.round(base + Math.sin(Math.PI * u) * sag);
      for (let y = 0; y <= bottom; y++) {
        const d = bottom - y;
        let c = d < 1 ? C['r4'] : d < 3 ? C['r3'] : ((d >> 1) % 3 === 0) ? C['r1'] : C['r2'];
        if (y < 3) c = C['r0'];
        g.set(x, y, c);
      }
      // the fringe
      const fl = 3 + (x & 1);
      for (let k = 1; k <= fl; k++) g.set(x, bottom + k, k === fl ? C['k0'] : (x & 1) ? C['r5'] : C['r3']);
    }
    for (let x = 0; x <= W; x += sw) {
      g.rect(x - 1, base - 2, 3, 3, C['r5']);
      g.rect(x - 1, base + 1, 2, 5, C['r4']);
      for (let i = -1; i <= 1; i++) g.line(x + i, base + 6, x + i * 2, base + 11, (i & 1) ? C['r5'] : C['r3']);
    }
    this.piano();
  }

  /**
   * A grand piano in the near right corner, keyboard toward you, its body
   * running back into the room with the curved side on the right, seen from
   * a little above and to the left: a keyboard is only a keyboard when it is
   * square on. The lid is down, so its lacquer shows the curve that makes it
   * a grand and the chandelier lying in it; the music desk is up with a page
   * on it, a candelabra and a rose on the lid, three turned legs, the pedal
   * lyre, and the whole of it again, upside down, in the floor.
   *
   * Built in plan: x across the keyboard (0 to 44), z from the keys back to
   * the tail (0 to 80), h up from the floor, projected with a little height
   * and a little shear so the far end is up and to the right.
   */
  private piano(): void {
    const { W, H, fy, land } = this;
    const S = Math.max(0.7, Math.min(1.9, W * (land ? 0.0035 : 0.004)));
    const ox = Math.round(W * (land ? 0.655 : 0.47)), oy = Math.round(fy + (H - fy) * (land ? 0.68 : 0.72));
    const g = new Raster(W, H);
    const X = (x: number, z: number) => ox + (x + z * 0.26) * S;
    const Y = (z: number, h: number) => oy - (z * 0.5 + h) * S;
    const Q = (pts: [number, number, number][]) => pts.flatMap(([x, z, h]) => [X(x, z), Y(z, h)]);
    const L = (a: [number, number, number], b: [number, number, number], c: number) => g.line(X(a[0], a[1]), Y(a[1], a[2]), X(b[0], b[1]), Y(b[1], b[2]), c);
    const TOP = 17, BOT = 11, KEYS = 13.5;
    // the outline of the case in plan: the straight spine on the left, the bentside curving in on the right
    const plan: [number, number][] = [[0, 0], [44, 0], [44, 26], [41, 40], [35, 52], [27, 62], [18, 70], [10, 76], [4, 79], [0, 78]];

    // the spine side, the one face of the case you can see
    g.poly(Q([[0, 0, TOP], [0, 78, TOP], [0, 78, BOT], [0, 0, BOT]]), (x, y) => {
      const f = (Y(0, TOP) - y) / ((TOP - BOT) * S);
      return f > -0.2 ? C['k2'] : C['k1'];
    });
    L([0, 0, BOT], [0, 78, BOT], C['k0']);
    // the lid, down: lacquer with the chandelier lying in it as a long gleam that follows the curve
    g.poly(Q(plan.map(([x, z]) => [x, z, TOP] as [number, number, number])), (x, y) => {
      const z = (oy - y) / S / 0.5 - TOP / 0.5, xx = (x - ox) / S - z * 0.26;   // back into plan, roughly
      const curve = 44 - (z > 26 ? (z - 26) * 0.68 : 0);
      const band = Math.abs(xx - curve * 0.62 + 2);
      if (band < 1) return C['r3'];
      if (band < 2.6) return 0.5 > bayer(x, y) ? C['r1'] : C['k3'];
      if (Math.hypot(xx - 14, z - 22) < 2.4) return C['r5'];
      return z > 55 ? C['k1'] : C['k2'];
    });
    for (let k = 1; k + 1 < plan.length; k++) L([plan[k][0], plan[k][1], TOP], [plan[k + 1][0], plan[k + 1][1], TOP], C['r4']);
    L([0, 0, TOP], [0, 78, TOP], C['r3']);
    L([0, 78, TOP], [4, 79, TOP], C['r3']);

    // the lyre under the keys and its three pedals, drawn first: the key bed hides the top of it
    {
      const lx = X(20, 2), ly = Y(2, BOT), lh = Y(2, 1.5) - ly;
      g.tube([lx, ly, lx - 1.5 * S, ly + lh * 0.5, lx, ly + lh], () => Math.max(1, 1.2 * S), [C['r4'], C['r2'], C['k1']], -1, 0);
      g.tube([lx + 5 * S, ly, lx + 6.5 * S, ly + lh * 0.5, lx + 5 * S, ly + lh], () => Math.max(1, 1.2 * S), [C['r4'], C['r2'], C['k1']], -1, 0);
      g.rect(lx - 1, ly + lh, 5 * S + 3, 2, C['k2']);
      for (const k of [0.5, 2.5, 4.5]) g.rect(Math.round(lx + k * S) - 1, Math.round(ly + lh + 2), 2, 1, C['r4']);
    }

    // the music desk, standing up at the back of the keys, a page of something on it
    g.poly(Q([[11, 3, TOP], [33, 3, TOP], [33, 7, TOP + 9], [11, 7, TOP + 9]]), C['k2']);
    // a page of music on it: staves, and a few notes on them
    g.poly(Q([[17, 3.6, TOP + 1.5], [27, 3.6, TOP + 1.5], [27, 6.4, TOP + 7.5], [17, 6.4, TOP + 7.5]]), (x, y) => {
      const r = Math.round(Y(5, TOP + 4.5)) - y;
      return r % 3 === 0 ? C['w0'] : hash(x, y) > 0.86 ? C['k3'] : C['w1'];
    });
    L([11, 3, TOP], [33, 3, TOP], C['r3']);
    // the fallboard behind the keys, folded back, and the name rail
    g.poly(Q([[0, 0, KEYS], [44, 0, KEYS], [44, 0, TOP], [0, 0, TOP]]), C['k1']);
    L([2, 0, TOP - 1.2], [42, 0, TOP - 1.2], C['r2']);
    // the keys, square on, drawn a row at a time: white with a pixel of shadow between them, and black
    // keys in twos and threes on the back of them (polygons this small came out as a checker)
    const N = Math.max(14, Math.round(20 * S));
    const backY = Math.round(Y(0, KEYS)), frontY = Math.round(Y(-12, KEYS)), lipY = Math.round(Y(-12, KEYS - 1.8));
    for (let y = backY; y <= lipY; y++) {
      const t = Math.min(1, (y - backY) / Math.max(1, frontY - backY));
      const xl = X(2, -12 * t), xr = X(42, -12 * t);
      for (let x = Math.round(xl); x < Math.round(xr); x++) {
        const u = ((x + 0.5 - xl) / (xr - xl)) * N, k = Math.floor(u), f = u - k;
        let c = y > frontY ? C['w1'] : C['w2'];
        if (f * (xr - xl) / N < 1) c = C['w0'];
        // a black key straddles the line between key k-1 and key k, on the back three fifths
        const near = f < 0.5 ? k : k + 1, d = Math.abs(u - near);
        if (y <= frontY && t < 0.6 && near > 0 && near < N && near % 7 !== 3 && near % 7 !== 0 && d < 0.34) c = C['k0'];
        g.set(x, y, c);
      }
    }
    this.keys.length = 0;
    for (let k = 0; k < N; k++) this.keys.push({ x: Math.round(X(2 + 40 * (k + 0.5) / N, -10)), y: Math.round(Y(-10, KEYS)) });
    // the cheek blocks at both ends of the keys
    for (const x0 of [0, 42]) g.poly(Q([[x0, 0, TOP - 1], [x0 + 2, 0, TOP - 1], [x0 + 2, -13, KEYS + 1], [x0, -13, KEYS + 1]]), C['k1']);
    // the key bed's front, under the keys
    g.poly(Q([[0, -13, KEYS - 1.8], [44, -13, KEYS - 1.8], [44, -13, BOT], [0, -13, BOT]]), C['k1']);
    L([0, -13, KEYS - 1.8], [44, -13, KEYS - 1.8], C['r2']);

    // legs: turned, lit on the side facing the room, a brass cup at the foot, a shadow under it
    const feet: number[] = [];
    for (const [lx, lz] of [[3, -9], [41, -6], [4, 70]] as const) {
      const x = X(lx, lz), y0 = Y(lz, BOT), y1 = Y(lz, 0);
      for (let y = Math.round(y0); y < y1; y++) {
        const f = (y - y0) / (y1 - y0), wd = Math.max(2, Math.round((f < 0.14 ? 5 : f < 0.26 ? 3 : f < 0.55 ? 4 : 3.2 - f) * S));
        const xl = Math.round(x - wd / 2);
        g.rect(xl, y, wd, 1, f < 0.14 ? C['k2'] : C['k1']);
        g.set(xl, y, f < 0.14 ? C['r3'] : C['r2']);
      }
      g.rect(Math.round(x - 1.5 * S), Math.round(y1) - 1, Math.max(2, Math.round(3 * S)), 2, C['r4']);
      feet.push(Math.round(y1) + 1);
      g.oval(x, y1 + 1, 4 * S, 1.2 * S, (xx, yy) => g.get(xx, yy) ? 0 : C['k0']);
    }
    // a candelabra on the lid, three candles, and a rose somebody left beside it
    {
      const cx = Math.round(X(18, 34)), cy = Math.round(Y(34, TOP));
      g.rect(cx - 3, cy, 7, 1, C['r3']); g.rect(cx - 1, cy - 1, 3, 1, C['r4']); g.rect(cx, cy - 7, 1, 7, C['r4']);
      g.tube([cx - 4, cy - 8, cx, cy - 5, cx + 4, cy - 8], () => 1, [C['r4'], C['r3'], C['r1']], -1, -1);
      for (const dx of [-4, 0, 4]) {
        const t0 = cy - 8 - (dx ? 4 : 6);
        g.rect(cx + dx, t0, 1, cy - 8 - t0, C['w2']); g.set(cx + dx, t0, C['w3']);
        this.pianoFlames.push({ x: cx + dx, y: t0 - 1, big: false, ph: dx });
      }
      const rx = Math.round(X(30, 22)), ry = Math.round(Y(22, TOP));
      g.line(rx - 5, ry + 1, rx, ry, C['k4']); g.set(rx - 3, ry - 1, C['k4']);
      g.blit(ROSE5, rx, ry - 2);
    }

    // and the floor has it too: upside down below its feet, dim, broken up by the dither
    const floorY = Math.max(...feet);
    for (let y = Math.max(0, floorY - 90); y < floorY; y++) for (let x = 0; x < W; x++) {
      const v = g.px[y * W + x], ry = 2 * floorY - y;
      if (!v || ry >= H || this.front.get(x, ry)) continue;
      if (0.42 - (ry - floorY) * 0.006 > bayer(x, ry)) this.front.set(x, ry, shift(v, -2) || C['k1']);
    }
    this.front.blit(g, 0, 0);
  }

  // ════════════════════════════════════════════════════════════
  // the chandelier, baked into a sprite
  // ════════════════════════════════════════════════════════════
  private buildChandelier(s: number) {
    const A = Math.round(44 * s), top = Math.round(30 * s), bot = Math.round(13 * s), drop = Math.round(10 * s);
    const w = A * 2 + 18, h = top + bot + drop + Math.round(22 * s);
    const r = new Raster(w, h), ox = w >> 1, oy = top + 5;
    // backlit by the window, so the metal is a dark silhouette, warm only along the top where the candles catch it
    const metal: [number, number, number] = [C['r3'], C['k3'], C['k1']];
    const flames: Flame[] = [], crystals: number[] = [];
    const bead = (x: number, y: number, c = C['w1']) => { r.set(x, y, c); crystals.push(Math.round(x) - ox, Math.round(y) - oy); };
    const bez = (P: number[][], n = 20) => {
      const pts: number[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, a = 1 - t;
        pts.push(ox + a * a * a * P[0][0] + 3 * a * a * t * P[1][0] + 3 * a * t * t * P[2][0] + t * t * t * P[3][0],
                 oy + a * a * a * P[0][1] + 3 * a * a * t * P[1][1] + 3 * a * t * t * P[2][1] + t * t * t * P[3][1]);
      }
      return pts;
    };

    // the column, with its bulbs
    r.tube([ox, oy - top, ox, oy + bot], () => 4, metal, -1, -1);
    for (const [y, rx] of [[-0.72 * top, 3.6], [-0.4 * top, 2.6], [0.55 * bot, 4.2]] as const)
      r.oval(ox + 0.5, oy + y + 0.5, rx * s, rx * s * 0.75, (x, yy, u, v) => v < -0.45 ? C['r3'] : v > 0.4 ? C['k1'] : u < -0.5 ? C['k4'] : C['k3']);
    // the bowl the lower arms spring from, with a fringe of crystal round its lip
    const bw = 12 * s, bh = 4 * s;
    r.oval(ox + 0.5, oy + 1.5, bw, bh, (x, yy, u, v) => v < -0.5 ? C['r3'] : v > 0.4 ? C['k1'] : u < -0.55 ? C['k4'] : C['k3']);
    for (let x = -Math.floor(bw) + 1; x < bw; x += 2) {
      const lip = oy + 1.5 + bh * Math.sqrt(Math.max(0, 1 - (x / bw) ** 2));
      const len = 2 + (Math.abs(x) < bw * 0.5 ? 2 : 0) + ((x >> 1) & 1);
      for (let k = 1; k <= len; k++) bead(ox + x, lip + k, k === len ? C['g4'] : C['w1']);
    }

    // the arms: S curves out of the bowl and the column, a cup, a candle and a pendant on each
    const arm = (dir: number, sx: number, from: number, reach: number, cupY: number, dip: number, big: boolean) => {
      r.tube(bez([[dir * sx, from], [dir * (sx + reach * 0.25), from + dip], [dir * reach * 0.95, from + dip * 0.75], [dir * reach, cupY]]), u => (big ? 3.6 : 2.8) - u * 1.0, metal, -1, -1);
      // a curl under the arm, which is what makes it rococo and not plumbing
      const kx = ox + dir * (sx + (reach - sx) * 0.45), ky = oy + from + dip * 0.92;
      const curl: number[] = [];
      for (let i = 0; i <= 12; i++) { const a = i * 0.52, rr = 3.6 * s * Math.exp(-i * 0.08); curl.push(kx + dir * Math.cos(a) * rr, ky + 3 + Math.sin(a) * rr); }
      r.tube(curl, () => 1.4, metal, -1, -1);
      const cx = Math.round(ox + dir * reach), cy = Math.round(oy + cupY);
      // the cup
      r.rect(cx - 2, cy, 6, 1, C['r3']); r.rect(cx - 1, cy + 1, 4, 1, C['k3']); r.set(cx, cy + 2, C['k2']);
      // the candle, with a run of red wax down one side
      const ch = Math.round((big ? 8 : 6) * s);
      r.rect(cx, cy - ch, 2, ch, C['w2']); r.rect(cx + 1, cy - ch + 1, 1, ch - 1, C['w1']); r.set(cx, cy - ch, C['w3']);
      if (hash(cx, cy) > 0.35) r.rect(cx + (hash(cy, cx) > 0.5 ? 1 : 0), cy - ch + 1, 1, Math.max(2, ch >> 1), C['b1']);
      flames.push({ x: cx - ox, y: cy - ch - oy, big: true, ph: hash(cx, 5) * 9 });
      // the pendant under the cup
      for (let k = 3; k <= 6; k++) bead(cx + (k & 1), cy + k, k === 6 ? C['g4'] : C['w1']);
      return [cx, cy] as const;
    };
    const lo: (readonly [number, number])[] = [], hi: (readonly [number, number])[] = [];
    for (const dir of [-1, 1]) {
      for (const f of [0.42, 0.72, 1]) lo.push(arm(dir, bw * 0.75, Math.round(1 * s), Math.round(A * f), Math.round(-5 * s), Math.round((8 + f * 5) * s), true));
      for (const f of [0.3, 0.56]) hi.push(arm(dir, 2, Math.round(-14 * s), Math.round(A * f), Math.round(-24 * s), Math.round(6 * s), false));
    }
    // the crown: a ring for the chain, and three points
    const cy0 = oy - top;
    r.ring(ox + 0.5, cy0 - 3, 1.4, 2.8, C['r3']);
    for (const dx of [-3, 0, 3]) r.line(ox + dx, cy0, ox + dx * 1.3, cy0 - (dx ? 3 : 5), C['r4']);
    r.rect(ox - 4, cy0, 9, 2, C['r3']);

    // crystal: swags from cup to cup, and long drapes from the outer cups down under the bowl
    const swag = (a: readonly [number, number], b: readonly [number, number], sag: number) => {
      const n = Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
      for (let i = 1; i < n; i++) {
        const u = i / n;
        bead(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + Math.sin(Math.PI * u) * sag + 2, i % 4 === 0 ? C['w2'] : C['w1']);
      }
    };
    const sorted = lo.slice().sort((p, q) => p[0] - q[0]);
    for (let k = 0; k + 1 < sorted.length; k++) if (k !== 2) swag(sorted[k], sorted[k + 1], 6 * s);
    const under: [number, number] = [ox, oy + bot + Math.round(drop * 0.4)];
    swag(sorted[0], under, 12 * s);
    swag(sorted[sorted.length - 1], under, 12 * s);
    const hs = hi.slice().sort((p, q) => p[0] - q[0]);
    swag(hs[0], hs[1], 4 * s); swag(hs[2], hs[3], 4 * s);

    // the finial: a long drop, where the blood runs off
    const fy0 = oy + bot;
    for (let k = 0; k < drop; k++) {
      const f = k / drop, wd = Math.max(1, Math.round(Math.sin(Math.PI * Math.min(1, f * 1.4 + 0.15)) * 3 * s));
      for (let x = -wd + 1; x < wd; x++) r.set(ox + x, fy0 + k, x < 0 ? C['g4'] : x === 0 ? C['w1'] : C['g2']);
    }
    r.set(ox, fy0 + drop, C['b2']);
    r.outline(C['k0']);
    return { r, ox, oy, flames, crystals, tip: [0, bot + drop] as [number, number], top: -top - 7 };
  }

  /** Where the roses climb when they come: up the curtains, round the mirror and the rose window, down from the valance. */
  private buildVines(): void {
    const { W, H, cw, tieY, mirror: m, rose } = this;
    const guides: number[][] = [];
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? cw * 1.1 : W - 1 - cw * 1.1, x1 = s < 0 ? cw * 0.7 : W - 1 - cw * 0.7;
      guides.push([x0, H - 1, x1, tieY + 6]);
    }
    const rad = (m.x1 - m.x0) / 2, xc = m.x0 + rad;
    for (const s of [-1, 1]) {
      const pts = [xc + s * (rad + 5), m.bot, xc + s * (rad + 5), m.top + rad];
      for (let k = 1; k <= 8; k++) { const a = (k / 8) * Math.PI / 2; pts.push(xc + s * Math.cos(a) * (rad + 5), m.top + rad - Math.sin(a) * (rad + 5)); }
      guides.push(pts);
    }
    for (const s of [-1, 1]) {
      const pts: number[] = [];
      for (let k = 0; k <= 16; k++) { const a = Math.PI / 2 + s * (0.25 + (k / 16) * 2); pts.push(rose.x + Math.cos(a) * (rose.r + 6), rose.y + Math.sin(a) * (rose.r + 6)); }
      guides.push(pts);
    }
    for (const f of [0.18, 0.4, 0.82]) guides.push([W * f, this.corn, W * f + 3, this.corn + (this.dado - this.corn) * 0.35]);
    guides.forEach((gd, v) => {
      // walk the guide a pixel at a time, wandering either side of it
      const pts: number[] = [], nodes: Vine['nodes'] = [];
      let k = 0;
      for (let i = 0; i + 3 < gd.length; i += 2) {
        const ax = gd[i], ay = gd[i + 1], bx = gd[i + 2], by = gd[i + 3], len = Math.hypot(bx - ax, by - ay) || 1;
        const nx = -(by - ay) / len, ny = (bx - ax) / len;
        for (let s = 0; s < len; s++, k++) {
          const w = Math.sin(k * 0.21 + v * 1.7) * 2.2 + Math.sin(k * 0.07 + v) * 1.2;
          pts.push(ax + (bx - ax) * s / len + nx * w, ay + (by - ay) * s / len + ny * w);
          if (k % 5 === 4) nodes.push({ k, side: (k / 5) & 1 ? 1 : -1, kind: hash(v, k, 2) > 0.62 ? 'rose' : hash(v, k, 3) > 0.45 ? 'leaf' : 'thorn' });
        }
      }
      this.vines.push({ pts, nodes, delay: hash(v, 7) * 0.2 });
    });
  }


  // ════════════════════════════════════════════════════════════
  // every frame
  // ════════════════════════════════════════════════════════════
  draw(t: number): Raster {
    clock.tick(t);
    const o = this.out, { W, H, fy } = this;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT)) || 0.033;
    this.lastT = t;
    const ev = clock.ev, p = ev?.p ?? 0, is = (n: string) => ev?.name === n;
    const pulse = clock.pulse;
    o.copy(this.back);

    // the stars through the broken panes
    for (const [x, y, h] of this.stars) {
      const tw = Math.sin(t * (1.5 + h * 3) + h * 40);
      o.set(x, y, tw > 0.6 ? C['w3'] : tw > -0.2 ? C['w1'] : C['n3']);
    }

    // which candles are burning (hunger puts them out one at a time)
    const candles = this.chand.flames.length + this.pianoFlames.length + this.sconces.length;
    const lit = is('hunger') ? (p < 0.6 ? Math.ceil(candles * (1 - p / 0.6)) : p < 0.72 ? 0 : candles) : candles;

    // the mirror: the room behind you, and sometimes someone in it
    const m = this.mirror;
    for (const [x, y] of this.mirrorFlames) if (lit > 2) o.set(x, y, Math.sin(t * 9 + x) > 0 ? C['f1'] : C['f0']);
    if (is('mirror')) {
      const show = p < 0.12 ? p / 0.12 : p < 0.85 ? 1 : 0;
      const fx = Math.round((m.x0 + m.x1) / 2 - FIGURE.w / 2 + Math.sin(t * 1.3) * 0.6), fyy = m.bot - 4 - FIGURE.h;
      for (let j = 0; j < FIGURE.h; j++) for (let i = 0; i < FIGURE.w; i++) {
        const v = FIGURE.d[j * FIGURE.w + i];
        if (v && show > bayer(fx + i, fyy + j)) o.set(fx + i, fyy + j, v);
      }
      // the glass ripples where it stands
      if (p < 0.15 || (p > 0.82 && p < 0.9)) for (let y = m.top + 4; y < m.bot - 3; y += 3) o.set(m.x0 + 2 + ((y * 7 + Math.floor(t * 30)) % (m.x1 - m.x0 - 4)), y, C['n3']);
    }
    // hunger: in the dark, something looks back, from the mirror and the windows
    if (is('hunger') && p > 0.42 && p < 0.74) {
      const open = (p - 0.42) / 0.06;
      const blink = Math.sin(t * 2.3) > 0.97;
      const eyes: [number, number][] = [[Math.round((m.x0 + m.x1) / 2), m.top + Math.round((m.bot - m.top) * 0.28)]];
      if (this.windows.length > 2) for (const k of [1, this.windows.length - 2]) { const w = this.windows[k]; eyes.push([Math.round((w.x0 + w.x1) / 2), Math.round(w.top + (w.bot - w.top) * 0.5)]); }
      for (const [x, y] of eyes) if (open > 1 && !blink) { o.blit(EYE, x - 6, y - 1); o.blit(EYE, x + 2, y - 1); }
    }

    // the chandelier, swinging from its chain
    // it hangs across the foot of the rose window: its crown against the glass, its candles against the dark
    const ch = this.chand, rx = this.cx, ry = this.rose.y + Math.round(this.rose.r * 0.55);
    const L = ry - ch.top;
    const ang = Math.sin(t * 0.55) * 0.012 + clock.swing * 0.11;
    const bx = Math.round(rx + Math.sin(ang) * L), by = ry;
    o.line(rx, 0, bx, by + ch.top + 1, (x, y, k) => k % 3 === 0 ? C['r3'] : C['k3']);
    o.blit(ch.r, bx - ch.ox, by - ch.oy);
    // crystal catching the light, a few at a time
    for (let k = 0; k < ch.crystals.length; k += 2) {
      const s = Math.sin(t * 2.1 + k * 1.7 + pulse * 2);
      if (s > 0.93) {
        const x = bx + ch.crystals[k], y = by + ch.crystals[k + 1];
        o.set(x, y, C['w3']);
        if (s > 0.985) { o.set(x - 1, y, C['w1']); o.set(x + 1, y, C['w1']); o.set(x, y - 1, C['w1']); o.set(x, y + 1, C['w1']); }
      }
    }
    // and the flames, which flare on the thump
    let n = 0;
    const fire = (f: Flame, ox: number, oy: number) => {
      if (n++ >= lit) return;
      const fr = Math.floor(t * 9 + f.ph) % 3;
      const big = f.big || pulse > 0.6;
      if (big) o.blit(FLAME[fr], ox + f.x - 1, oy + f.y - 5);
      else o.blit(FLAME_SM[fr & 1], ox + f.x, oy + f.y - 2);
      this.light(ox + f.x + 1, oy + f.y - 1, (big ? 8 : 6) * (0.9 + pulse * 0.3), 0.55 + Math.sin(t * 13 + f.ph) * 0.08);
    };
    for (const f of ch.flames) fire(f, bx, by);
    for (const f of this.sconces) fire(f, 0, 0);

    // the drips, the splashes, and the pool they make
    const tipX = bx + ch.tip[0], tipY = by + ch.tip[1];
    const rate = is('bleed') ? 0.5 : 1.6;
    if (!this.nextDrop) this.nextDrop = t + 1;
    if (t > this.nextDrop) { this.drops.push({ x: tipX, y: tipY, v: 0, grow: 0 }); this.nextDrop = t + rate * (0.6 + hash(t) * 0.9); }
    for (let k = this.drops.length - 1; k >= 0; k--) {
      const d = this.drops[k];
      if (d.grow < 1) { d.grow += dt * 2.2; d.x = tipX; d.y = tipY; o.set(d.x, d.y + 1, C['b2']); if (d.grow > 0.5) o.set(d.x, d.y + 2, C['b1']); continue; }
      d.v += 320 * dt; d.y += d.v * dt;
      if (d.y >= this.landY) {
        this.drops.splice(k, 1);
        this.splashes.push({ x: Math.round(d.x), y: this.landY, t });
        this.ripples.push({ x: Math.round(d.x), y: this.landY, t });
        this.pool = Math.min(this.rose.r * 0.7, this.pool + 0.6);
        continue;
      }
      o.set(d.x, d.y, C['b2']); o.set(d.x, d.y - 1, C['b1']);
      if (d.v > 120) o.set(d.x, d.y - 2, C['b0']);
    }

    // the moonlight, and the dust turning in it
    const cone = this.cone, cl = this.coneList, th = this.coneTh, opx = o.px;
    const k1 = (0.85 + pulse * 0.35) * (1 - clock.dark);
    for (let k = 0; k < cl.length; k++) if (k1 > th[k]) opx[cl[k]] = UP[opx[cl[k]]];
    const mo = this.motes;
    for (let k = 0; k < mo.length; k += 3) {
      mo[k + 1] += dt * (2 + (k % 5));
      if (mo[k + 1] > H) mo[k + 1] = this.rose.y + this.rose.r;
      const x = Math.round(mo[k] + Math.sin(t * 0.7 + mo[k + 2]) * 3), y = Math.round(mo[k + 1]);
      if (x >= 0 && x < W && y >= 0 && y < H && cone[y * W + x] > 40) o.set(x, y, Math.sin(t * 3 + mo[k + 2]) > 0.3 ? C['w2'] : C['r6']);
    }

    // the light the chandelier puts on the room and the floor under it
    this.light(bx, by, this.rose.r * 1.35, 0.32 * (1 - clock.dark) * (lit / candles) * (1 + pulse * 0.4));
    this.poolLight(bx, lit / candles);
    this.drawPool(t, bx);

    // events in the room
    if (is('waltz')) this.waltz(p, t);
    if (is('shatter')) this.shatter(p, ev!.t0, ev!.r0, ev!.r1);
    else this.crack = null;
    this.drawBits(dt, t);

    // in front of it all: the curtains and the piano
    for (let k = 0, fa = this.frontAt, fc = this.frontC; k < fa.length; k++) opx[fa[k]] = fc[k];
    // a key goes down on the thump, as if someone were playing
    if (clock.thumps !== this.lastThump) { this.lastThump = clock.thumps; this.keyDown = Math.floor(hash(clock.thumps) * this.keys.length); }
    if (pulse > 0.35 && this.keyDown >= 0 && this.keys[this.keyDown]) { const kk = this.keys[this.keyDown]; o.set(kk.x, kk.y, C['w0']); o.set(kk.x, kk.y + 1, C['w1']); }
    for (const f of this.pianoFlames) fire(f, 0, 0);
    if (is('bloom')) this.bloom(p, t);

    return o;
  }

  /**
   * Lifts every pixel a light reaches one step, by the dither. A light's
   * shape (the pixels round its origin it reaches, and how strongly) is
   * worked out the first time a light of that size is lit and kept, so a
   * frame only compares, wherever the light has moved to.
   */
  private lightAt(key: string, build: (add: (dx: number, dy: number, f: number) => void) => void, x: number, y: number, I: number): void {
    if (I <= 0.02) return;
    let s = this.stamps.get(key);
    if (!s) {
      const dx: number[] = [], dy: number[] = [], f: number[] = [];
      build((a, b, v) => { if (v > 0.001) { dx.push(a); dy.push(b); f.push(v); } });
      this.stamps.set(key, s = { dx: Int16Array.from(dx), dy: Int16Array.from(dy), f: Float32Array.from(f) });
    }
    const { W, H } = this, px = this.out.px, { dx, dy, f } = s;
    for (let k = 0; k < f.length; k++) {
      const xx = x + dx[k], yy = y + dy[k];
      if (xx < 0 || yy < 0 || xx >= W || yy >= H || I * f[k] <= bayer(xx, yy)) continue;
      const i = yy * W + xx, v = px[i];
      if (v) px[i] = UP[v];
    }
  }

  /** A round light falling off from a point. */
  private light(x: number, y: number, R: number, I: number): void {
    R = Math.round(R);
    this.lightAt(`L${R}`, add => {
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx + 0.5, dy + 0.5) / R;
        if (d < 1) add(dx, dy, (1 - d) * (1 - d) * 2);
      }
    }, Math.round(x), Math.round(y), I);
  }

  /** The pool of light on the floor under the chandelier, and its long reflection down the lacquer. */
  private poolLight(bx: number, frac: number): void {
    const { H, fy } = this, y0 = this.landY, rx = this.rose.r * 1.5, ry = Math.max(3, (H - fy) * 0.16);
    this.lightAt('P', add => {
      for (let y = Math.floor(y0 - ry); y <= Math.ceil(y0 + ry); y++) for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
        const u = (x + 0.5) / rx, v = (y + 0.5 - y0) / ry, d = u * u + v * v;
        if (d < 1) add(x, y, (1 - d) * 0.55);
      }
      for (let y = fy + 2; y < H; y++) {
        const wd = 1 + (y - fy) * 0.06;
        for (let x = Math.floor(-wd); x <= Math.ceil(wd); x++) add(x, y, (1 - Math.abs(x + 0.5) / (wd + 0.5)) * 0.7);
      }
    }, Math.round(bx), 0, frac * (1 - clock.dark));
  }

  private drawPool(t: number, bx: number): void {
    const o = this.out, r = this.pool, y = this.landY;
    if (r > 0.5) {
      // not a disc: three lobes run together, dark, with one gleam along the far edge (its shape kept per half pixel it grows)
      const size = Math.round(r * 2);
      let s = this.pools.get(size);
      if (!s) {
        const rr = size / 2, lobes = [[0, 0, 1], [-0.55, 0.12, 0.62], [0.6, -0.08, 0.5]];
        const inPool = (x: number, yy: number) => lobes.some(([dx, dy, k]) => {
          const u = (x + 0.5 - dx * rr) / (rr * k), v = (yy + 0.5 - dy * rr * 0.3) / (rr * k * 0.3);
          return u * u + v * v <= 1;
        });
        const dx: number[] = [], dy: number[] = [], c: number[] = [];
        for (let yy = Math.floor(-rr * 0.5); yy <= Math.ceil(rr * 0.5); yy++) for (let x = Math.floor(-rr * 1.7); x <= Math.ceil(rr * 1.7); x++) {
          if (!inPool(x, yy)) continue;
          dx.push(x); dy.push(yy);
          c.push(!inPool(x, yy - 1) ? (Math.abs(x) < rr * 0.9 ? C['b2'] : C['b1']) : !inPool(x, yy + 1) ? C['k1'] : yy < 0 ? C['b1'] : C['b0']);
        }
        this.pools.set(size, s = { dx: Int16Array.from(dx), dy: Int16Array.from(dy), c: Uint8Array.from(c) });
      }
      const ox = Math.round(bx);
      for (let k = 0; k < s.c.length; k++) o.set(ox + s.dx[k], y + s.dy[k], s.c[k]);
      // the candles in it
      if (r > 3) { o.set(bx - Math.round(r * 0.3), y - 1, Math.sin(t * 8) > 0 ? C['f1'] : C['r5']); o.set(bx + Math.round(r * 0.25), y, C['r5']); }
    }
    for (let k = this.ripples.length - 1; k >= 0; k--) {
      const q = this.ripples[k], a = t - q.t;
      if (a > 0.8) { this.ripples.splice(k, 1); continue; }
      const rr = 2 + a * 14;
      for (let i = 0; i < 24; i++) { const th = (i / 24) * TAU; if ((i + Math.floor(a * 10)) % 3) o.set(q.x + Math.cos(th) * rr, q.y + Math.sin(th) * rr * 0.3, a < 0.4 ? C['b3'] : C['b1']); }
    }
    for (let k = this.splashes.length - 1; k >= 0; k--) {
      const q = this.splashes[k], f = Math.floor((t - q.t) / 0.07);
      if (f >= SPLASH.length) { this.splashes.splice(k, 1); continue; }
      o.blit(SPLASH[f], q.x - 2, q.y - SPLASH[f].h);
    }
  }

  /** Two of them, turning across the floor in three time; the lacquer has them upside down. */
  private waltz(p: number, t: number): void {
    const o = this.out, { W, H, fy } = this;
    const a = p < 0.12 ? p / 0.12 : p > 0.85 ? (1 - p) / 0.15 : 1;
    const x0 = this.cx - W * 0.3 + p * W * 0.6;
    const y0 = fy + (H - fy) * (0.22 + Math.sin(p * Math.PI) * 0.3);
    const h = Math.round(13 + (y0 - fy) * 0.34), turn = p * TAU * 3;
    const hands: number[] = [];
    for (let who = 0; who < 2; who++) {
      const sx = Math.round(x0 + Math.cos(turn + who * Math.PI) * h * 0.32), foot = Math.round(y0 + Math.sin(turn + who * Math.PI) * h * 0.08);
      // row k counts down from the head (0) to the feet (h-1); the reflection is the same rows below the feet
      const figure = (alpha: number, mirrored: boolean) => {
        for (let k = 0; k < h; k++) {
          const yy = mirrored ? foot + h - k : foot - h + k, f = k / h;
          // her: shoulders, a waist, then a bell of a gown; him: shoulders, a coat, two legs
          const half = k < 2 ? 0.5 : who === 0
            ? (f < 0.22 ? 0.5 : f < 0.3 ? 1.3 : f < 0.42 ? 0.6 : 0.6 + Math.pow((f - 0.42) / 0.58, 0.8) * h * 0.3)
            : (f < 0.22 ? 0.5 : f < 0.32 ? 1.6 : f < 0.62 ? 1.1 : 1.1);
          for (let xx = Math.round(sx - half); xx <= Math.round(sx + 1 + half); xx++) {
            if (who === 1 && f >= 0.62 && Math.abs(xx - sx - 0.5) < 0.6) continue;   // between his legs
            if (alpha <= bayer(xx, yy)) continue;
            const c = k < 2 ? C['w3'] : who === 0 ? (f > 0.45 && (xx + k) % 3 === 0 ? C['g4'] : C['g5']) : (Math.abs(xx - sx - 0.5) < 0.6 && f < 0.6 ? C['w3'] : C['w1']);
            o.set(xx, yy, mirrored ? C['g2'] : c);
          }
        }
      };
      figure(a * 1.1, false);
      figure(a * 0.32, true);
      hands.push(sx + 0.5, foot - h * 0.72);
      this.light(sx, foot - h * 0.5, h * 0.9, a * 0.35);
    }
    // their arms, joined between them
    if (hands.length === 4 && a > 0.5) o.line(hands[0], hands[1], hands[2], hands[3], C['w1']);
    // the turn they have cut into the floor behind them
    for (let k = 1; k < 30; k++) {
      const q = Math.max(0, p - k * 0.006), tq = q * TAU * 3;
      const xx = this.cx - W * 0.3 + q * W * 0.6 + Math.cos(tq) * h * 0.32, yy = fy + (H - fy) * (0.22 + Math.sin(q * Math.PI) * 0.3) + Math.sin(tq) * h * 0.08;
      if (a * (1 - k / 30) * 0.6 > bayer(Math.round(xx), Math.round(yy))) o.set(xx, yy + 1, C['g2']);
    }
    void t;
  }

  /** The rose window cracks from one point, sheds glass onto the floor, and mends. */
  private shatter(p: number, t0: number, r0: number, r1: number): void {
    const o = this.out, { x: rx, y: ry, r } = this.rose;
    if (!this.crack || this.crack.for !== t0) {
      const ox = rx + (r0 - 0.5) * r * 0.9, oy = ry + (r1 - 0.5) * r * 0.9, pts: number[][] = [];
      for (let b = 0; b < 7; b++) {
        let x = ox, y = oy, a = b * 0.9 + r0 * 6;
        const st = [x, y];
        for (let k = 0; k < 6; k++) { a += (hash(b, k, t0) - 0.5) * 1.1; const L = r * (0.1 + hash(b, k) * 0.14); x += Math.cos(a) * L; y += Math.sin(a) * L; if (Math.hypot(x - rx, y - ry) > r) break; st.push(x, y); }
        pts.push(st);
      }
      this.crack = { pts, for: t0 };
      // glass, shed from along the cracks
      for (let k = 0; k < 26; k++) {
        const st = pts[k % pts.length], i = (Math.floor(hash(k, 3) * (st.length / 2)) * 2);
        this.bits.push({ x: st[i], y: st[i + 1], vx: (hash(k, 4) - 0.5) * 30, vy: -10 - hash(k, 5) * 20, c: [C['g3'], C['g4'], C['g5'], C['w2']][k % 4], life: 1, rest: false });
      }
    }
    const grow = p < 0.18 ? p / 0.18 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    for (const st of this.crack.pts) {
      const n = Math.max(1, Math.floor((st.length / 2 - 1) * grow));
      for (let k = 0; k < n; k++) o.line(st[k * 2], st[k * 2 + 1], st[k * 2 + 2], st[k * 2 + 3], p < 0.3 ? C['w3'] : C['w2']);
    }
    if (p < 0.2) this.light(this.crack.pts[0][0], this.crack.pts[0][1], r * 0.6, (0.2 - p) * 4);
  }

  /** Petals off the swags, and anything shed in an event: falling, then lying on the floor a while. */
  private drawBits(dt: number, t: number): void {
    const o = this.out, { W, H, fy } = this;
    if (this.bits.filter(b => !b.rest).length < 4 && hash(Math.floor(t * 3)) > 0.97) {
      const p = this.pillars[Math.floor(hash(t) * this.pillars.length)];
      this.bits.push({ x: (p.x0 + p.x1) / 2, y: this.corn + 4, vx: 0, vy: 6, c: hash(t, 1) > 0.5 ? C['r4'] : C['r3'], life: 1, rest: false });
    }
    for (let k = this.bits.length - 1; k >= 0; k--) {
      const b = this.bits[k];
      if (b.rest) { b.life -= dt * 0.08; if (b.life <= 0) { this.bits.splice(k, 1); continue; } }
      else {
        const petal = b.c === C['r4'] || b.c === C['r3'];
        if (petal) { b.vy = 8 + Math.sin(t * 2 + k) * 3; b.vx = Math.sin(t * 1.3 + k * 2) * 6; }
        else b.vy += 160 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.floor ??= Math.round(fy + 2 + hash(b.x, t) * (H - fy - 4));   // where on the floor it comes to rest
        if (b.y >= b.floor) { b.y = b.floor; b.rest = true; }
      }
      if (b.x < 0 || b.x >= W) { this.bits.splice(k, 1); continue; }
      if (b.life > bayer(Math.round(b.x), Math.round(b.y)) * 0.6) o.set(b.x, b.y, b.c);
    }
    if (this.bits.length > 140) this.bits.splice(0, this.bits.length - 140);
  }

  /** Thorned roses climb the room, open, and wither. */
  private bloom(p: number, t: number): void {
    const o = this.out;
    const grow = p < 0.55 ? smooth(0, 0.55, p) : p < 0.78 ? 1 : 1 - smooth(0.78, 1, p);
    for (const v of this.vines) {
      const g = Math.max(0, Math.min(1, (grow - v.delay) / (1 - v.delay)));
      const n = Math.floor((v.pts.length / 2 - 1) * g);
      // the stem: two pixels, lit on the side toward the room
      for (let k = 0; k < n; k++) {
        const x = v.pts[k * 2], y = v.pts[k * 2 + 1];
        o.set(x + 1, y, C['k1']);
        o.set(x, y, k % 3 === 0 ? C['r3'] : C['r2']);
      }
      for (const nd of v.nodes) {
        if (nd.k >= n) break;
        const x = v.pts[nd.k * 2], y = v.pts[nd.k * 2 + 1];
        const dx = v.pts[nd.k * 2 + 2] - x, dy = v.pts[nd.k * 2 + 3] - y;
        const px = -dy * nd.side, py = dx * nd.side;
        if (nd.kind === 'thorn') { o.set(x + px, y + py, C['r2']); o.set(x + px * 2, y + py * 2, C['r4']); continue; }
        if (nd.kind === 'leaf') {
          o.set(x + px, y + py, C['k4']); o.set(x + px * 2, y + py * 2, C['k4']); o.set(x + px * 3 + dx, y + py * 3 + dy, C['k3']);
          o.set(x + px * 2 + dx, y + py * 2 + dy, C['r1']);
          continue;
        }
        if (p > 0.82) { if (hash(nd.k, Math.floor(t * 5)) > 0.9) this.bits.push({ x, y, vx: 0, vy: 6, c: C['r4'], life: 1, rest: false }); continue; }
        const age = (n - nd.k) / 16;
        if (age < 1) o.blit(BUD, x - 1, y - 1); else if (age < 2) o.blit(ROSE5, x - 2, y - 2); else o.blit(ROSE7, x - 3, y - 3);
      }
    }
  }

}
