// RIEGEN · THE PHOENIX: the palette and the bird.
//
// THE CLAIM. A sky that has been burning all night: black at the top, ember
// red at the horizon, sparks always rising. The phoenix is the only thing in
// it that is all fire, so it is the only thing that reaches the pale end of
// the ramp; it burns down to nothing every so often and blazes back.
import { Raster } from '../raster';
import { palette } from '../kit/palette';
import { Xf, alpha, bez2, bez3, clamp, shape, shapeOval, stopAt } from '../kit/paint';

export const P = palette({
  // the night sky down to the burning horizon
  s: ['#050202', '#0c0405', '#140607', '#1c0907', '#2a0d08', '#3a120a', '#571c0c', '#76280f'],
  // fire, coal to white heat
  f: ['#5a1206', '#8e2410', '#c2391a', '#ff5e1f', '#ff7a26', '#ffa040', '#ffc75a', '#ffe2a0', '#fff4d8'],
});
export const C = P.C;

/** The wing, in the bird's frame: a swept curve out to the tip, then the feather fingers back along the trailing edge. */
function wingPts(lift: number, du: number, dv: number, ku: number): number[] {
  const p = [2, -3];
  bez3(p, 2, -3, 8, -10 - lift * 0.6, 18, -16 - lift, 30, -18 - lift * 1.35);
  p.push(24, -12 - lift * 0.95, 27, -8 - lift * 0.8, 20, -5 - lift * 0.55, 23, -1 - lift * 0.4, 12, 1 - lift * 0.15);
  for (let i = 0; i < p.length; i += 2) { p[i] = p[i] * ku + du; p[i + 1] += dv; }
  return p;
}

/**
 * The phoenix in its frame `f` (facing +u), wings at phase `flap`, `glow`
 * (0..1) its rebirth blaze; `level` (0..1) fades the whole bird by the dither
 * (the small firebird a click lets go dissolves that way).
 */
export function drawPhoenix(r: Raster, f: Xf, flap: number, t: number, glow: number, level = 1): void {
  const wing = Math.sin(flap), g = clamp(glow);
  // the tail: three flame ribbons trailing behind
  for (let k = 0; k < 3; k++) {
    const off = (k - 1) * 5, wav = Math.sin(t * 6 + k * 2.1) * 6, wav2 = Math.sin(t * 4.5 + k * 1.3) * 9, len = 52 + k * 10;
    const p = [-10, off * 0.4];
    bez3(p, -10, off * 0.4, -24, off + wav * 0.5, -36, off + wav, -len, off * 1.6 + wav2);
    bez3(p, -len, off * 1.6 + wav2, -36, off + wav + 3, -24, off + wav * 0.5 + 3, -10, off * 0.4 + 2.5);
    shape(r, f, p, alpha([C['f5'], C['f3'], C['f1']][k], (0.62 - k * 0.12 + g * 0.3) * level));
  }
  // the far wing, dim
  shape(r, f, wingPts(wing * 13 - 3, -2, 1, 0.92), alpha(C['f1'], (0.75 + g * 0.25) * level));
  // the body: a flame teardrop with a pale belly
  const body = [16, -1];
  bez3(body, 16, -1, 12, -7, 0, -7.5, -9, -3.5);
  bez3(body, -9, -3.5, -12, -1.5, -12, 2.5, -8, 4.2);
  bez3(body, -8, 4.2, 0, 7.5, 12, 5.5, 16, -1);
  shape(r, f, body, (x, y) => (level > 0.98 || alpha(1, level)(x, y) ? stopAt([C['f4'], C['f6'], C['f8']], g, x, y) : 0));
  shapeOval(r, f, 2, 0.5, 8, 3.4, -0.15, alpha(C['f7'], (0.6 + g * 0.4) * level));
  // the head, the beak, the crest of flame and the eye
  shapeOval(r, f, 17.5, -3.5, 4.4, 4.4, 0, alpha(g > 0.4 ? C['f6'] : C['f5'], level + 0.05));
  shape(r, f, [21.2, -4.6, 26.5, -3.1, 21.2, -1.7], alpha(C['f7'], level + 0.05));
  for (let k = 0; k < 3; k++) {
    const ca = -1.9 + k * 0.45 + Math.sin(t * 7 + k) * 0.1, p = [16.5 + k * 1.2, -7];
    bez2(p, 16.5 + k * 1.2, -7, 15 + k * 1.4 + Math.cos(ca) * 4, -13 - k, 14 + k * 2.2, -14.5 - k * 1.5);
    bez2(p, 14 + k * 2.2, -14.5 - k * 1.5, 17 + k * 1.4, -11, 18 + k * 1.2, -7.2);
    shape(r, f, p, alpha(C['f4'], (0.85 - k * 0.15) * level));
  }
  shapeOval(r, f, 18.6, -4.2, 1, 1, 0, alpha(C['s0'], level + 0.05));
  // the near wing, bright, white-hot at the root and red at the tips
  shape(r, f, wingPts(wing * 16, 0, -1, 1), (x, y, u, v) => (alpha(1, level + 0.05)(x, y) ? stopAt([C['f7'], C['f6'], C['f5'], C['f4'], C['f3']], ((u - 2) * 28 - v * 20) / 1184, x, y) : 0));
}
