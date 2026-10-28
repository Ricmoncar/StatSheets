// Painting on a page's raster: the things nearly every page needs and the
// Raster primitives leave to it. Gradients are bands of palette indices that
// meet in a 4x4 ordered dither, never a blend; light and fog are dithered
// densities of one colour; everything lands on whole pixels.
import { Raster, bayer } from '../raster';

export const TAU = Math.PI * 2;

/** A stable pseudo-random number in [0, 1) from up to three integers. */
export function hash(a: number, b = 0, c = 0): number {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return x - Math.floor(x);
}
/** A seeded generator (mulberry32), for things laid out once. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
/** Smooth 1D value noise in [0, 1]. */
export function noise(x: number, seed = 0): number {
  const i = Math.floor(x), f = x - i;
  return lerp(hash(i, seed), hash(i + 1, seed), smooth(f));
}

/** The index at position `u` (0..1) through `stops`, dithered where two stops meet, for pixel (x, y). */
export function stopAt(stops: readonly number[], u: number, x: number, y: number): number {
  const n = stops.length;
  if (n === 1) return stops[0];
  const f = clamp(u) * (n - 1), k = Math.min(n - 2, Math.floor(f));
  return f - k > bayer(x, y) ? stops[k + 1] : stops[k];
}

/** A vertical gradient: `stops` top to bottom over the rectangle. */
export function vgrad(r: Raster, x: number, y: number, w: number, h: number, stops: readonly number[]): void {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(r.w, Math.floor(x + w)), y1 = Math.min(r.h, Math.floor(y + h));
  for (let yy = y0; yy < y1; yy++) {
    const u = h <= 1 ? 0 : (yy - y) / (h - 1);
    for (let xx = x0; xx < x1; xx++) r.px[yy * r.w + xx] = stopAt(stops, u, xx, yy);
  }
}
/** A horizontal gradient: `stops` left to right. */
export function hgrad(r: Raster, x: number, y: number, w: number, h: number, stops: readonly number[]): void {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(r.w, Math.floor(x + w)), y1 = Math.min(r.h, Math.floor(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) r.px[yy * r.w + xx] = stopAt(stops, w <= 1 ? 0 : (xx - x) / (w - 1), xx, yy);
}
/** A round gradient out from (cx, cy): `stops` centre to rim, drawn only inside radius `rad` (ry for an oval). */
export function rgrad(r: Raster, cx: number, cy: number, rad: number, stops: readonly number[], ry = rad): void {
  r.oval(cx, cy, rad, ry, (x, y, u, v) => stopAt(stops, Math.sqrt(u * u + v * v), x, y));
}
/**
 * Light (or fog, or shadow) as a dithered density of one colour: full
 * strength at the middle falling to nothing at radius `rad`; `ry` makes it an
 * oval. `only` limits it to pixels already holding one of those indices.
 */
export function glow(r: Raster, cx: number, cy: number, rad: number, i: number, strength = 1, ry = rad, only?: Uint8Array): void {
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(r.h - 1, Math.ceil(cy + ry));
  const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(r.w - 1, Math.ceil(cx + rad));
  for (let y = y0; y <= y1; y++) {
    const v = (y + 0.5 - cy) / ry;
    for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5 - cx) / rad, d = u * u + v * v;
      if (d >= 1) continue;
      const k = y * r.w + x;
      if (only && !only[r.px[k]]) continue;
      if ((1 - Math.sqrt(d)) * strength > bayer(x, y)) r.px[k] = i;
    }
  }
}
/** Recolours every pixel of a rectangle through `map` (a Palette.shiftMap, say) where `level` passes the dither: a shade or a lift. */
export function tint(r: Raster, x: number, y: number, w: number, h: number, map: Uint8Array, level = 1): void {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(r.w, Math.floor(x + w)), y1 = Math.min(r.h, Math.floor(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    const k = yy * r.w + xx;
    if (r.px[k] && level > bayer(xx, yy)) r.px[k] = map[r.px[k]];
  }
}
/** Darkens the edges of the whole raster through `map`, deepest in the corners: the frame every room needs. */
export function vignette(r: Raster, map: Uint8Array, strength = 0.6, reach = 0.55): void {
  const cx = r.w / 2, cy = r.h / 2;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const u = (x - cx) / cx, v = (y - cy) / cy, d = Math.sqrt(u * u * 0.7 + v * v);
    const lv = (d - (1 - reach)) / reach * strength;
    if (lv <= 0) continue;
    const k = y * r.w + x;
    if (r.px[k] && lv > bayer(x, y)) r.px[k] = map[r.px[k]];
  }
}
/** Twinkling stars: `count` of them laid out by `seed`, each one of `idx`, some winking with time. */
export function stars(r: Raster, seed: number, count: number, idx: readonly number[], t: number, maxY = r.h): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash(i, seed, 1) * r.w), y = Math.floor(hash(i, seed, 2) * maxY);
    const tw = Math.sin(t * (1 + hash(i, seed, 3) * 3) + i) * 0.5 + 0.5;
    const c = idx[Math.min(idx.length - 1, Math.floor(hash(i, seed, 4) * idx.length * (0.6 + tw * 0.4)))];
    if (tw < 0.15) continue;
    r.set(x, y, c);
    if (hash(i, seed, 5) > 0.92 && tw > 0.7) { r.set(x - 1, y, idx[0]); r.set(x + 1, y, idx[0]); r.set(x, y - 1, idx[0]); r.set(x, y + 1, idx[0]); }
  }
}

// ── a 3x5 pixel font, for the words a page writes into its world (signs, screens, labels) ──
const GLYPHS: Record<string, string> = {
  A: '111101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '111100101101111', H: '101101111101101', I: '111010010010111', J: '001001001101111',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '111101101101111',
  P: '111101111100100', Q: '111101101111001', R: '110101110101101', S: '111100111001111', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111',
  9: '111101111001111', '!': '010010010000010', '?': '111001011000010', '.': '000000000000010', ',': '000000000010100',
  ':': '000010000010000', '-': '000000111000000', '+': '000010111010000', '$': '011110010011110', '%': '101001010100101',
  "'": '010010000000000', '/': '001001010100100', '#': '101111101111101', '*': '000101010101000', '<': '001010100010001',
  '>': '100010001010100', '=': '000111000111000', '♥': '000101111111010', ' ': '000000000000000',
};
/** Writes `s` (upper-cased) at x, y in the 3x5 font, `scale` pixels to a font pixel; returns the width drawn. */
export function text(r: Raster, x: number, y: number, s: string, i: number, scale = 1): number {
  let cx = Math.round(x);
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS['?'];
    for (let k = 0; k < 15; k++) if (g[k] === '1') r.rect(cx + (k % 3) * scale, y + Math.floor(k / 3) * scale, scale, scale, i);
    cx += 4 * scale;
  }
  return cx - Math.round(x) - scale;
}
/** How wide `s` is in the 3x5 font. */
export const textWidth = (s: string, scale = 1) => Math.max(0, s.length * 4 * scale - scale);
