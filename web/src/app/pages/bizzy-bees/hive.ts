// BIZZY'S HIVE, behind the sheet: the old page's honeycomb with its gentle
// amber pulse and the odd cell full of honey, the shafts of light pouring
// down through it, honey dripping, seven bees about their business (each
// with the old page's flight: wanderers, a figure eight, the queen, a flower
// inspector, a looper, a commuter) and pollen rising.
//
// The comb, the backdrop and the light are one pass: every pixel knows its
// cell (laid out once per size), and its brightness is the backdrop's glow,
// plus its cell's pulse, plus any shaft it is in, read off the hive ramp.
import { Raster } from '../raster';
import { artPx } from '../host';
import { Scene } from '../kit/scene';
import { glow, stopAt } from '../kit/paint';
import { BeeModel, C, HIVE, P, drawBee } from './look';

const TAU = Math.PI * 2;
/** The old page's hash, so every bee and cell does what it did there. */
export const bzHash = (i: number, n: number) => { const v = Math.sin(i * 91.7 + n * 47.3 + 13.1) * 43758.5453; return v - Math.floor(v); };
/** Bees drawn a third larger than the old page's, so a bee is still a bee in whole pixels. */
export const BEE = 1.35;

/** Where bee `b` is at time t on a W x H (CSS pixel) field, its scale, its wings, and whether it is the queen: the old page's flights. */
export function beeFlight(b: number, W: number, H: number, t: number): { pos: (tt: number) => [number, number]; sc: number; flap: number; model: BeeModel } {
  const sx = bzHash(b, 1), sy = bzHash(b, 2);
  if (b === 2) {
    // a sweeping figure eight across the whole field
    const cx = W * 0.5, cy = H * (0.3 + 0.2 * sy), Ax = W * 0.4, Ay = H * 0.22, f = 0.06 + 0.02 * sx, ph = b * 1.3;
    return { pos: tt => [cx + Math.sin(tt * f * TAU + ph) * Ax, cy + Math.sin(2 * (tt * f * TAU + ph)) * Ay], sc: 0.82, flap: Math.abs(Math.sin(t * 24 + b)), model: 'new' };
  }
  if (b === 3 || b === 4) {
    // a darting worker: from one spot to the next, fast, then a hover
    const period = 1.5 + sx * 0.9;
    return {
      pos: tt => {
        const k = Math.floor(tt / period), fr = tt / period - k;
        const ax = bzHash(b * 9 + k, 3) * W, ay = bzHash(b * 9 + k, 4) * H, nx = bzHash(b * 9 + k + 1, 3) * W, ny = bzHash(b * 9 + k + 1, 4) * H;
        let e = Math.min(1, fr / 0.55); e = e * e * (3 - 2 * e);
        return [ax + (nx - ax) * e, ay + (ny - ay) * e + Math.sin(tt * 9) * (1 - e) * 4];
      },
      sc: 0.7, flap: Math.abs(Math.sin(t * 30 + b * 2)), model: 'new',
    };
  }
  if (b === 5) {
    // the queen: large, slow, majestic
    const cx = W * (0.3 + 0.4 * sx), cy = H * (0.3 + 0.35 * sy), f = 0.022 + 0.01 * sy, ph = b * 2.1;
    return { pos: tt => [cx + Math.cos(tt * f * TAU + ph) * W * 0.18, cy + Math.sin(tt * f * TAU * 1.3 + ph) * H * 0.14], sc: 1.18, flap: Math.abs(Math.sin(t * 16 + b)), model: 'queen' };
  }
  if (b === 6) {
    // the flower inspector: hovers over a slowly drifting spot, bobbing
    const cx = W * (0.2 + 0.6 * sx), cy = H * (0.25 + 0.5 * sy), ph = b * 1.9;
    return { pos: tt => [cx + Math.sin(tt * 0.13 + ph) * W * 0.06 + Math.cos(tt * 2.2) * 8, cy + Math.cos(tt * 0.11 + ph) * H * 0.05 + Math.sin(tt * 3.1) * 10], sc: 0.74, flap: Math.abs(Math.sin(t * 28 + b)), model: 'old' };
  }
  if (b === 7) {
    // loop-the-loop: tight fast loops riding a wide slow drift
    const cx = W * (0.2 + 0.6 * sx), cy = H * (0.2 + 0.55 * sy), ph = b * 2.4;
    return {
      pos: tt => [cx + Math.sin(tt * 0.07 + ph) * W * 0.18 + Math.cos(tt * 3 + ph) * 26, cy + Math.cos(tt * 0.06 + ph) * H * 0.12 + Math.sin(tt * 3 + ph) * 26],
      sc: 0.76, flap: Math.abs(Math.sin(t * 26 + b)), model: 'new',
    };
  }
  if (b === 8) {
    // the commuter: straight across and round again
    const speed = W * 0.11 * (0.8 + sx * 0.5), yBase = H * (0.15 + 0.7 * sy), ph = b * 1.1;
    return { pos: tt => [((tt * speed + sx * W) % (W + 120)) - 60, yBase + Math.sin(tt * 1.5 + ph) * 22], sc: 0.8, flap: Math.abs(Math.sin(t * 24 + b)), model: 'old' };
  }
  // the lazy wide wanderers
  const cx = W * (0.18 + 0.64 * sx), cy = H * (0.2 + 0.55 * sy), f1 = 0.05 + 0.03 * sx, f2 = 0.08 + 0.04 * sy, ph = b * 1.7;
  return {
    pos: tt => [cx + Math.sin(tt * f1 * TAU + ph) * W * 0.13 + Math.cos(tt * f2 * TAU * 1.7 + ph) * W * 0.05, cy + Math.cos(tt * f1 * TAU + ph) * H * 0.11 + Math.sin(tt * f2 * TAU * 1.5 + ph) * H * 0.05],
    sc: 0.78 + sx * 0.16, flap: Math.abs(Math.sin(t * 22 + b * 1.57)), model: b === 0 ? 'old' : 'new',
  };
}

/** Draws bee `b` flying over a field of W x H CSS pixels whose top left is (ox, oy) art pixels. */
export function flyBee(r: Raster, b: number, W: number, H: number, t: number, px: number, ox = 0, oy = 0): void {
  const f = beeFlight(b, W, H, t);
  const [x, y] = f.pos(t), [x2, y2] = f.pos(t + 0.05);
  drawBee(r, ox + x / px, oy + y / px, Math.atan2(y2 - y, x2 - x), f.sc * BEE / px, f.flap, f.model);
}

export class Hive implements Scene {
  private W = 0; private H = 0; private px = 3;
  /** Each pixel's cell (-1 in the gaps), and whether it is on the cell's rim or in the shine of a honey cell. */
  private cellOf = new Int32Array(0);
  private rim = new Uint8Array(0);
  private shine = new Uint8Array(0);
  /** The backdrop's glow at each pixel, as a level on the hive ramp. */
  private base = new Float32Array(0);
  private cols: number[] = []; private rows: number[] = []; private honey: boolean[] = [];
  private ph = new Float32Array(0);

  colours(): Uint32Array { return P.table; }

  size(W: number, H: number): void {
    this.W = W; this.H = H;
    const px = this.px = artPx();
    // the old cells: radius 20 CSS pixels, columns 1.5 R apart, rows sqrt(3) R, every other column half a row down
    const R = 20 / px, csx = R * 1.5, csy = R * Math.sqrt(3), hr = R * 0.87;
    const id = new Map<string, number>();
    this.cols = []; this.rows = []; this.honey = [];
    const cellId = (c: number, r: number) => {
      const k = c + ',' + r;
      let i = id.get(k);
      if (i === undefined) { i = this.cols.length; id.set(k, i); this.cols.push(c); this.rows.push(r); this.honey.push(bzHash(c * 13 + r * 7, 1) > 0.84); }
      return i;
    };
    this.cellOf = new Int32Array(W * H); this.rim = new Uint8Array(W * H); this.shine = new Uint8Array(W * H); this.base = new Float32Array(W * H);
    const gx = W * 0.5, gy = H * 0.3, gr = Math.max(W, H) * 0.9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, X = x + 0.5, Y = y + 0.5;
      let best = Infinity, bc = 0, br = 0, bdx = 0, bdy = 0;
      const c0 = Math.round(X / csx);
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const off = c & 1 ? csy * 0.5 : 0, rr = Math.round((Y - off) / csy);
        for (let r = rr - 1; r <= rr + 1; r++) {
          const dx = X - c * csx, dy = Y - (r * csy + off);
          const q = Math.max(Math.abs(dy) / 0.866, Math.abs(dx) + Math.abs(dy) / 1.732);
          if (q < best) { best = q; bc = c; br = r; bdx = dx; bdy = dy; }
        }
      }
      if (best <= hr) {
        const cell = cellId(bc, br);
        this.cellOf[k] = cell;
        this.rim[k] = best > hr - 1 ? 1 : 0;
        // the shine on a honey cell: a disc up and left of its middle
        if (this.honey[cell] && Math.hypot(bdx + R * 0.2, bdy + R * 0.2) < R * 0.34) this.shine[k] = 1;
      } else this.cellOf[k] = -1;
      const d = Math.hypot(x - gx, y - gy) / gr;
      this.base[k] = d < 0.5 ? 0.15 - d * 0.12 : 0.09 - (d - 0.5) * 0.12;
    }
    this.ph = new Float32Array(this.cols.length);
  }

  draw(r: Raster, t: number): void {
    const { W, H, px } = this, Wc = W * px, Hc = H * px;
    // each cell's pulse this frame (honey cells shimmer at their own rate)
    for (let i = 0; i < this.cols.length; i++) {
      const c = this.cols[i], w = this.rows[i];
      this.ph[i] = this.honey[i] ? 0.5 + 0.5 * Math.sin(t * 1.3 + c * 0.5 + w * 0.9) : (Math.sin(t * 0.55 + c * 0.71 + w * 1.13) + 1) * 0.5;
    }
    // the five shafts of light: their edges on each row
    const shafts: [number, number, number, number][] = [];
    for (let s = 0; s < 5; s++) {
      const rx = ((0.1 + s * 0.21) * Wc + Math.sin(t * 0.18 + s * 1.7) * 26) / px, rw = (34 + s * 14) / px;
      shafts.push([rx, rw * 0.25, rw, (0.02 + 0.015 * (0.5 + 0.5 * Math.sin(t * 0.5 + s * 1.3))) * 4.5]);
    }
    const px8 = r.px;
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const k = y * W + x, cell = this.cellOf[k];
        let lv = this.base[k];
        for (const [sx, top, bot, a] of shafts) { const hw = top + (bot - top) * v; if (x > sx - hw && x < sx + hw) lv += a; }
        if (cell >= 0) {
          const ph = this.ph[cell];
          if (this.rim[k]) lv += 0.24 + ph * 0.16;
          else if (this.honey[cell]) lv += this.shine[k] ? 0.42 + ph * 0.14 : 0.25 + ph * 0.12;
          else lv += 0.09 + ph * 0.1;
        }
        px8[k] = stopAt(HIVE, lv, x, y);
      }
    }
    // honey dripping down through it
    for (let d = 0; d < 6; d++) {
      const sd = d * 1.618, drx = ((sd * 2.236) % 1) * Wc, cyc = 5 + (sd % 3);
      const ph = ((t * (0.35 + (sd % 0.3))) % cyc) / cyc, dy = ph * (Hc + 48) - 48;
      const len = (18 + (sd % 12)) / px, rad = Math.max(1.1, (3.5 + (sd % 2.5)) / px), x = drx / px, y = dy / px;
      if (y < -len - 4 || y > H + len) continue;
      r.line(x, y - len, x, y - rad, C['h6']);
      r.oval(x, y, rad, rad * 1.2, (_x, _y, u, vv) => (vv > 0.5 ? C['h6'] : u < -0.1 && vv < -0.1 ? C['h9'] : C['h7']));
    }
    // the bees behind the menus (the two darting workers fly over the sheet instead)
    for (const b of [0, 1, 2, 5, 6, 7, 8]) flyBee(r, b, Wc, Hc, t, px);
    // pollen rising
    for (let p = 0; p < 30; p++) {
      const sd = p * 0.618, x = (((sd * 2.73) % 1) * Wc + Math.sin(t * 0.7 + sd * 6.28) * 14) / px;
      const spd = 18 + (sd % 12), y = ((Hc - ((t * spd + sd * Hc) % (Hc + 16)) + Hc + 16) % (Hc + 16)) / px;
      const rad = 1.2 + (sd % 1) * 1.8, al = 0.14 + (sd % 0.2);
      glow(r, x, y, (rad * 3.5) / px + 1, C['h7'], al * 1.6);
      r.set(x, y, al > 0.24 ? C['y4'] : C['y3']);
      if (rad > 2.4) r.set(x + 1, y, C['y3']);
    }
  }
}
