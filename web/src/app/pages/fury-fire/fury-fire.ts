// FURY'S FIRE: the page. The hall is the shared fire world; over the window,
// the fire, a burning frame round the whole window with gold Victorian
// scrollwork in its corners and vines along its edges, and the casino chip
// that is the pointer: embers spiral into it, and every click is an eruption
// (the chip flips red to blue and back, the window flashes, two shockwaves
// and a gout of sparks).
import { Raster, bayer } from '../raster';
import { sceneModule } from '../kit/scene';
import { bez2, bez3 } from '../kit/paint';
import { sfx } from '../kit/sound';
import { C, FireOverlay, FireWorld, P } from './fire';

const TAU = Math.PI * 2;
const CHIP = { red: ['r0', 'r1', 'r2', 'g3', 'e9'], blue: ['u0', 'u1', 'u2', 'u3', 'u3'] } as const;
const DN = P.shiftMap(-1), UP = P.shiftMap(1);

/** A gold scroll for a corner of the frame, from the corner inward, mirrored into each corner by fx, fy. */
function corner(r: Raster, x: number, y: number, s: number, fx: number, fy: number, t: number, px: number): void {
  const a = 0.55 + 0.3 * Math.sin(t * 1.5);
  const P2 = (u: number, v: number): [number, number] => [x + (u * fx * s) / px, y + (v * fy * s) / px];
  const stroke = (pts: number[], bright: boolean) => {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const [x0, y0] = P2(pts[i], pts[i + 1]), [x1, y1] = P2(pts[i + 2], pts[i + 3]);
      // the gold's glow a pixel out, then the line itself
      r.line(x0 + 1, y0, x1 + 1, y1, (xx, yy) => (0.3 > bayer(xx, yy) && !r.get(xx, yy) ? C['g1'] : 0));
      r.line(x0, y0, x1, y1, (xx, yy) => (a + 0.25 > bayer(xx, yy) ? (bright ? C['g4'] : C['g3']) : C['g2']));
    }
  };
  stroke(bez3(bez3(bez3(bez3([60, 6], 60, 6, 34, 6, 26, 14, 24, 30), 24, 30, 22, 44, 30, 50, 40, 46), 40, 46, 48, 42, 46, 32, 38, 33), 38, 33, 33.5, 34, 34.5, 40, 38, 39), true);
  stroke(bez3(bez3(bez3(bez3([6, 60], 6, 60, 6, 34, 14, 26, 30, 24), 30, 24, 44, 22, 50, 30, 46, 40), 46, 40, 42, 48, 32, 46, 33, 38), 33, 38, 34, 33.5, 40, 34.5, 39, 38), true);
  stroke(bez2([60, 6], 60, 6, 30, 16, 6, 60, 14), false);
  stroke(bez2([60, 6], 60, 6, 52, 1, 45, 8), true);
  stroke(bez2([6, 60], 6, 60, 1, 52, 8, 45), true);
  stroke(bez2([24, 30], 24, 30, 16, 24, 14, 16), true);
  stroke(bez2([30, 24], 30, 24, 24, 16, 16, 14), true);
  for (const [u, v] of [[60, 6], [6, 60], [38, 39], [12, 12]]) { const [bx, by] = P2(u, v); r.set(bx, by, C['g5']); }
}
/** A gold vine along an edge of the frame, from (ax, ay) to (bx, by), art pixels. */
function vine(r: Raster, ax: number, ay: number, bx: number, by: number, t: number, px: number): void {
  const a = 0.5 + 0.28 * Math.sin(t * 1.5), dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  if (len * px < 30) return;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, waves = Math.max(2, Math.round((len * px) / 78)), amp = 6 / px, N = waves * 16;
  let lx = ax, ly = ay;
  for (let i = 1; i <= N; i++) {
    const f = i / N, off = Math.sin(f * TAU * waves) * amp, x = ax + ux * len * f + nx * off, y = ay + uy * len * f + ny * off;
    r.line(lx, ly, x, y, (xx, yy) => (a + 0.25 > bayer(xx, yy) ? C['g3'] : C['g2']));
    lx = x; ly = y;
  }
  for (let w = 0; w < waves; w++) {
    const f = (w + 0.25) / waves, sg = w % 2 === 0 ? 1 : -1;
    const cx = ax + ux * len * f + nx * amp * sg, cy = ay + uy * len * f + ny * amp * sg;
    r.set(cx, cy, C['g5']);
    const p = bez2([cx, cy], cx, cy, cx + (nx * 6 * sg + ux * 5) / px, cy + (ny * 6 * sg + uy * 5) / px, cx + (ux * 9) / px, cy + (uy * 9) / px, 6);
    for (let i = 0; i + 3 < p.length; i += 2) r.line(p[i], p[i + 1], p[i + 2], p[i + 3], C['g3']);
  }
}

class FuryOverlay extends FireOverlay {
  private blue = false;
  private bounce = 0;
  private cur = new Raster(48, 48);
  private spiral: { a: number; rad: number; spin: number; pull: number; r: number }[] = [];

  constructor() { super('pg-fury_fire', false, () => P.table); }

  protected override begin(): void { super.begin(); this.blue = false; this.bounce = 0; this.spiral = []; }

  protected override press(): void {
    this.blue = !this.blue;
    this.bounce = 1;
    this.flash = 1;
    this.rings.push({ x: this.mx, y: this.my, life: 1, max: 0.5, delay: 0 }, { x: this.mx, y: this.my, life: 1, max: 0.7, delay: 0.06 });
    if (this.rings.length > 8) this.rings.splice(0, this.rings.length - 8);
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * TAU, s = 120 + Math.random() * 360;
      this.sparks.push({ x: this.mx, y: this.my, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 1, r: 2 + Math.random() * 5.5, hue: Math.random() * 42 });
    }
    sfx('click', { rate: 0.6 + Math.random() * 0.15, volume: 0.6 });
  }

  /** The burning frame round the window: crimson bleeding in from every edge, wisps up from the bottom, a molten rim. */
  protected override heat(t: number): void {
    const { W, H, px, hc } = this, pulse = 0.5 + 0.5 * Math.sin(t * 2.6), bd = (46 + pulse * 12) / px, a = (0.2 + pulse * 0.12) * 0.75;
    hc.band(H, H - bd * 1.4, a * 1.3, 0);
    hc.band(0, bd * 0.8, a * 0.7, 0);
    hc.poly([0, 0, bd * 0.8, 0, bd * 0.8, H, 0, H], x => a * 0.8 * Math.max(0, 1 - x / (bd * 0.8)));
    hc.poly([W - bd * 0.8, 0, W, 0, W, H, W - bd * 0.8, H], x => a * 0.8 * Math.max(0, 1 - (W - x) / (bd * 0.8)));
    const Wc = W * px, n = Math.max(8, Math.ceil(Wc / 46));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * (Wc / n) + Math.sin(t * 0.7 + i) * 10) / px, fl = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.9) + 0.2 * Math.sin(t * 11 + i);
      const h = bd * (0.7 + fl * 1.5), sway = (Math.sin(t * 4 + i) * 9) / px, w = (5 + fl * 3) / px;
      const p = bez2(bez2([x - w, H], x - w, H, x + sway, H - h * 0.62, x + sway * 0.4, H - h), x + sway * 0.4, H - h, x - sway, H - h * 0.62, x + w, H);
      hc.poly(p, (_x, y) => { const u = (H - y) / (bd * 2.2); return u < 0.55 ? 0.4 - u * 0.44 : Math.max(0, 0.16 * (1 - (u - 0.55) / 0.45)); });
    }
    const rim = 0.12 + pulse * 0.12;
    for (let k = 0; k < 2; k++) { hc.line(k, 0, k, H, rim); hc.line(W - 1 - k, 0, W - 1 - k, H, rim); hc.line(0, k, W, k, rim); hc.line(0, H - 1 - k, W, H - 1 - k, rim); }
  }

  protected override decorate(r: Raster, t: number, dt: number): void {
    const { W, H, px } = this, m = 12 / px, e = 80 / px, in13 = 13 / px;
    // gold scrollwork in each corner, vines along each edge
    corner(r, m, m, 1.05, 1, 1, t, px); corner(r, W - m, m, 1.05, -1, 1, t, px);
    corner(r, m, H - m, 1.05, 1, -1, t, px); corner(r, W - m, H - m, 1.05, -1, -1, t, px);
    vine(r, e, in13, W - e, in13, t, px); vine(r, e, H - in13, W - e, H - in13, t, px);
    vine(r, in13, e, in13, H - e, t, px); vine(r, W - in13, e, W - in13, H - e, t, px);
    // the eruption's flash runs round the edge of the window
    if (this.flash > 0.05) {
      const k = Math.ceil((30 * this.flash) / px);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (x >= k && y >= k && x < W - k && y < H - k) continue;
        if (this.flash * 0.6 > bayer(x, y)) r.px[y * W + x] = C['e8'];
      }
    }
    this.bounce = Math.max(0, this.bounce - dt * 3.2);
    if (!this.mouse) { this.cursor?.move(0, 0, px, false); return; }
    // the chip: embers spiral in to it, over its own warm glow
    const pulse = this.bounce > 0 ? Math.sin(this.bounce * Math.PI) : 0, R = (16 * 1.3 * (1 + pulse * 0.3)) / px;
    const cx = this.mx / px, cy = this.my / px;
    while (this.spiral.length < 18) this.spiral.push({ a: Math.random() * TAU, rad: 38 + Math.random() * 34, spin: (0.8 + Math.random() * 1.6) * (Math.random() < 0.5 ? 1 : -1), pull: 20 + Math.random() * 26, r: 1 + Math.random() * 2 });
    const glowC = this.blue ? C['u3'] : C['e9'];
    for (let y = Math.floor(cy - R * 2.4); y <= cy + R * 2.4; y++) for (let x = Math.floor(cx - R * 2.4); x <= cx + R * 2.4; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (R * 2.4);
      if (d < 1 && (1 - d) * (0.55 + pulse * 0.3) > bayer(x, y) && !r.get(x, y)) r.set(x, y, glowC);
    }
    for (const s of this.spiral) {
      s.a += s.spin * dt; s.rad -= s.pull * dt;
      if (s.rad < R * px * 0.55) { s.rad = 38 + Math.random() * 34; s.a = Math.random() * TAU; }
      const ea = Math.min(1, (s.rad - R * px * 0.55) / 30), x = cx + (Math.cos(s.a) * s.rad) / px, y = cy + (Math.sin(s.a) * s.rad) / px;
      r.set(x, y, ea < 0.4 ? C['e11'] : ea < 0.75 ? C['e10'] : C['e9']);
      if (s.r * (1.3 - ea * 0.6) > 2.2) r.set(x + 1, y, C['e9']);
    }
    this.drawChip(t, R);
  }

  /** The casino chip, spinning: body, cream inserts round the rim, a gold ring, a groove, the inner disc with its dashed ring, four pips and the hub; a fixed sheen on top. */
  private drawChip(t: number, R: number): void {
    const c = this.cur, N = c.w, mid = N / 2, spin = t * 0.5;
    const [k0, k1, k2, ring] = (this.blue ? CHIP.blue : CHIP.red).map(n => C[n]);
    const cream = C['w2'];
    c.clear(0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - mid, dy = y + 0.5 - mid, d = Math.hypot(dx, dy);
      if (d > R) continue;
      const a = Math.atan2(dy, dx) - spin;
      let i = k1;
      const seg = (((a % (TAU / 6)) + TAU / 6) % (TAU / 6)) - TAU / 12;
      if (d > R * 0.72 && Math.abs(seg) < 0.2) i = cream;
      if (Math.abs(d - R * 0.92) < 0.55 && Math.abs(seg) >= 0.2) i = ring;
      if (Math.abs(d - R * 0.74) < 0.5) i = k0;
      if (d < R * 0.6) {
        i = k2;
        if (Math.abs(d - R * 0.56) < 0.5 && Math.floor(((a + TAU) * R * 0.56) / 2) % 2 === 0) i = cream;
        for (let p = 0; p < 4; p++) { const pa = p * (TAU / 4) + Math.PI / 4 + spin; if (Math.hypot(dx - Math.cos(pa) * R * 0.4, dy - Math.sin(pa) * R * 0.4) < Math.max(0.6, R * 0.09)) i = cream; }
        if (d < R * 0.2) i = d < R * 0.11 ? k1 : ring;
      }
      // the sheen, fixed while the chip turns under it
      const sx = dx + R * 0.3, sy = dy + R * 0.34, ca = Math.cos(0.5), sa = Math.sin(0.5);
      if (((sx * ca - sy * sa) / (R * 0.52)) ** 2 + ((sx * sa + sy * ca) / (R * 0.22)) ** 2 < 1) i = UP[i];
      if (d > R - 1) i = DN[i] === i ? C['w0'] : DN[i];
      c.set(x, y, i);
    }
    this.cursor?.set(c, P.table, mid, mid, this.px, true);
    this.cursor?.move(this.mx, this.my, this.px, true);
  }
}

export const { drawBackground, resetBackground, startOverlay, stopOverlay } = sceneModule(new FireWorld(), new FuryOverlay());
