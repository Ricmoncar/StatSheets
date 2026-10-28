// BIZZY'S HIVE: the palette and the bees, shared by the hive behind the sheet
// and the swarm over the window.
//
// THE CLAIM. The inside of a hive with the light coming through it: dark comb
// in every direction, honey glowing where the light finds it, and bees going
// about their business across all of it (and across the sheet, and after the
// pointer). Everything is one warm ramp, from comb in shadow to honey in
// light; the bees are the only black and the only blue (their wings).
import { Raster, bayer } from '../raster';
import { palette } from '../kit/palette';

export const P = palette({
  // the hive, comb in shadow to honey in the light
  h: ['#0d0700', '#1c1001', '#2e1b02', '#452904', '#613a05', '#875006', '#b46c0a', '#e09414', '#ffbe36', '#ffe08a'],
  // the bees: black, the stinger's brown, yellow and its shine
  b: ['#0c0600', '#1e1004', '#3a2000'],
  y: ['#a86a00', '#e8a400', '#ffc20a', '#ffe27a', '#fff6cc'],
  // wings
  w: ['#8fb2d4', '#cfe6fa', '#f2faff'],
  // petals
  p: ['#b8457a', '#ff8fbf', '#ffc6e0'],
});
export const C = P.C;
/** The hive ramp, darkest first. */
export const HIVE = P.ramp('h');

export type BeeModel = 'new' | 'old' | 'queen';

/**
 * A bee at (x, y) heading `ang` (radians, 0 = right), drawn pixel by pixel in
 * its own frame so it is crisp at any angle. `s` is its scale in art pixels
 * per old-page pixel; `flap` (0..1) spreads the wings; `face` -1 mirrors it
 * along its heading (the cursor bees, which stay upright and turn by flipping).
 */
export function drawBee(r: Raster, x: number, y: number, ang: number, s: number, flap: number, model: BeeModel, face = 1): void {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const ws = (4.5 + flap * 3.5) * s;
  const reach = Math.ceil(26 * s) + 2;
  const old = model === 'old', queen = model === 'queen';
  const a = (old ? 10 : 10.5) * s, b = (old ? 6 : 6.2) * s;
  const hx = 13.5 * s, hr = (old ? 4.5 : 4.6) * s;
  // the faint golden air round it (the old aura)
  if (!old) {
    const R = 16 * s;
    for (let yy = Math.floor(y - R); yy <= Math.ceil(y + R); yy++) for (let xx = Math.floor(x - R); xx <= Math.ceil(x + R); xx++) {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / R;
      if (d < 1 && (1 - d) * (0.16 + flap * 0.08) > bayer(xx, yy)) { const k = r.get(xx, yy); if (k) r.set(xx, yy, P.shift(k, 1)); }
    }
  }
  for (let yy = Math.floor(y - reach); yy <= Math.ceil(y + reach); yy++) {
    for (let xx = Math.floor(x - reach); xx <= Math.ceil(x + reach); xx++) {
      const dx = xx + 0.5 - x, dy = yy + 0.5 - y;
      const u = (dx * cs + dy * sn) * face, v = -dx * sn + dy * cs;
      let c = 0;
      // wings, behind the body: the upper pair stronger than the lower
      const wing = (cu: number, cv: number, ra: number, rb: number, rot: number) => {
        const ca = Math.cos(rot), sa = Math.sin(rot), pu = u - cu * s, pv = v - cv;
        const qu = (pu * ca + pv * sa) / (ra * s), qv = (-pu * sa + pv * ca) / (rb * s);
        return qu * qu + qv * qv;
      };
      const w1 = old ? wing(1, -ws, 9.5, 4, 0.35) : wing(-1, -ws, 10, 4.3, -0.42);
      const w2 = old ? wing(-4, -ws, 7, 3, -0.35) : wing(4, -ws * 0.8, 7.4, 3, 0.28);
      const w3 = old ? wing(-1, ws * 0.7, 6, 2.2, -0.3) : wing(-1, ws, 9, 3.7, 0.42);
      const w4 = old ? 9 : wing(4, ws * 0.8, 6.6, 2.6, -0.28);
      const up = Math.min(w1, w2), dn = Math.min(w3, w4);
      if (up <= 1) c = up > 0.62 ? C['w2'] : (0.55 + flap * 0.25 > bayer(xx, yy) ? C['w1'] : C['w0']);
      else if (dn <= 1 && 0.4 + flap * 0.2 > bayer(xx, yy)) c = dn > 0.6 ? C['w1'] : C['w0'];
      // the stinger, behind
      if (u < -a * 0.95 && u > -a - 4 * s && Math.abs(v) <= Math.max(0.5, (1.6 * s) * (1 - (-u - a) / (4 * s)))) c = C['b2'];
      // the striped body
      const e = (u / a) ** 2 + (v / b) ** 2;
      if (e <= 1) {
        const us = u / s;
        const stripe = old ? (us > -8 && us < -4.5) || (us > -1 && us < 2.5) || (us > 6 && us < 9.5)
          : (us > -7 && us < -3.4) || (us > 0 && us < 3.6) || (us > 7 && us < 10.6);
        c = stripe ? C['b0'] : C['y2'];
        if (!stripe && v < -b * 0.55) c = C['y3'];
        if (e > 0.72) c = stripe ? C['b1'] : C['y0'];
      }
      // the head, in front
      if ((u - hx) ** 2 + v * v <= hr * hr) c = C['b0'];
      // the queen's crown
      if (queen) {
        const us = u / s, vs = v / s;
        if (us > 1 && us < 9 && vs < -5.5 && vs > -12.5) {
          const tooth = [8.5, 4.5, 1.5].some(tx => Math.abs(us - tx) < 1.4 + (vs + 12.5) * 0.25);
          if (vs > -7.5 || tooth) c = vs > -6.6 ? C['y1'] : C['y3'];
        }
      }
      if (c) r.set(xx, yy, c);
    }
  }
  // antennae, out and up from the head, each ending in a knob
  const at = (u: number, v: number): [number, number] => [x + (u * face * cs - v * sn), y + (u * face * sn + v * cs)];
  for (const [mu, mv, tu, tv] of old ? [[19, -9, 19, -15], [23, -8, 24, -13]] : [[18, -9, 18, -15], [22, -8, 23, -13]]) {
    const [x0, y0] = at(15.5 * s, -2 * s), [x1, y1] = at(mu * s, mv * s), [x2, y2] = at(tu * s, tv * s);
    r.line(x0, y0, x1, y1, C['b1']);
    r.line(x1, y1, x2, y2, C['b1']);
    r.set(x2, y2, C['b0']);
  }
}

/** The honeycomb as a tile for the sheet's panels (one period of flat-topped hexagons, outlines only). */
export function combTile(): Raster {
  // cells 5 pixels across the flats, spaced as the hive's (1.5 R by sqrt(3) R)
  const R = 4, W = 12, H = 7, t = new Raster(W, H);
  const cells: [number, number][] = [[0, 0], [6, 3.5], [12, 0], [0, 7], [12, 7], [6, -3.5], [6, 10.5]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = Infinity;
    for (const [cx, cy] of cells) {
      const dx = Math.abs(x + 0.5 - cx), dy = Math.abs(y + 0.5 - cy);
      best = Math.min(best, Math.max(dy / 0.866, dx + dy / 1.732));
    }
    if (best > R - 1 && best <= R + 0.2) t.set(x, y, C['h4']);
  }
  return t;
}
