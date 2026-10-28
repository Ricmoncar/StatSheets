// JUKO · 1, THE VALUE THAT WAS LEFT: the palette and what the void and the
// layer over the window share.
//
// THE CLAIM. The loop tore itself apart and everything inside it resolved to a
// single value. The Code Garden was a room, 0∞ broke the room, and this is
// the void the room was standing in: no ground, no horizon, no weather. One
// light, the prism, and it is the origin of the space as well as the only
// thing lighting it. Everything falls toward it and resolves to 1 on the way.
// The prism refracts, so colour comes from the angle round the light: violet
// on one flank through her mint in the middle to gold on the other.
import { Raster, bayer } from '../raster';
import { palette } from '../kit/palette';
import { glyphBits } from '../kit/paint';

const mixHex = (a: string, b: string, t: number) => {
  const A = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const VOID = '#02060a';
/** The spectrum the prism splits the light into, her mint in the middle of it. */
export const SPECTRUM = ['#9a60ee', '#6092ff', '#54deff', '#5ef0c8', '#96ff98', '#d4ff78', '#ffe270', '#ff96a0'];

export const P1 = palette({
  // the void, deep teal where the light reaches into the dust
  v: ['#010205', VOID, '#041016', '#061a20', '#0a252b', '#0e3137', '#133e44', '#184c52'],
  // the violet banks
  u: ['#0a0a17', '#121025', '#1b1633', '#251f44'],
  // the spectrum, each hue from dim to full
  ...Object.fromEntries(SPECTRUM.map((h, i) => ['S' + i, [0.2, 0.42, 0.68, 1].map(a => mixHex(VOID, h, a))])),
  // her mint, the cyan, and white (the light itself)
  m: [0.12, 0.25, 0.42, 0.62, 0.82, 1].map(a => mixHex(VOID, '#5ef0c8', a)).concat('#e2fff6'),
  c: [0.15, 0.32, 0.55, 0.8, 1].map(a => mixHex(VOID, '#3ec4d6', a)),
  w: ['#3c4c48', '#7a9890', '#b8dcd0', '#e2fff6', '#ffffff'],
  // the wreck of the garden, dead green, and the garden itself showing through
  r: [0.2, 0.34, 0.5, 0.68].map(a => mixHex(VOID, '#3aa66c', a)).concat('#4ab674'),
  g: [mixHex(VOID, '#36c25a', 0.25), mixHex(VOID, '#36c25a', 0.5), '#36c25a', '#bef0be'],
  // the sword: its dark steel, the gem's four colours and the three primaries it refracts into
  k: ['#03090c', '#05121a', '#0e242a', '#1b3d48', '#2c5866', '#4a7f8c'],
  x: ['#ff5684', '#ffd65c', '#78ffb4', '#6eb6ff'],
  y: ['#ff5a8c', '#5abeff', '#beff78'],
  // the equalizer, in the void's light
  q: ['#031c1c', '#0a4a46', '#12796f', '#28ac98', '#3fe0c0', '#92f0dc', '#e6fff6'],
});
export const C1 = P1.C;
export const SPEC = SPECTRUM.map((_, i) => P1.ramp('S' + i));
export const UP1 = P1.shiftMap(1), DN1 = P1.shiftMap(-1);
export const LUM1 = Uint8Array.from(P1.hex, h => (h ? Math.round(parseInt(h.slice(1, 3), 16) * 0.3 + parseInt(h.slice(3, 5), 16) * 0.59 + parseInt(h.slice(5, 7), 16) * 0.11) : 0));
export const BAYER = Float32Array.from({ length: 16 }, (_, k) => bayer(k & 3, k >> 2));
export const DIGITS = '0123456789'.split('');
export const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** The field is resolving: far out it is still every digit, near the light mostly the answer (res 0 undecided, 1 resolved). */
export const glyphAt = (res: number, h: number) => (rnd(h) < res * 0.82 ? '1' : DIGITS[(rnd(h * 1.7) * 10) | 0]);
/** Which hue a point takes, from its angle round the light. */
export const hueAt = (dx: number, dy: number) => (((Math.atan2(dy, dx) / (Math.PI * 2) + 1.5) * 8) | 0) % 8;
/** An old alpha to a step of a four-step hue ramp (-1: too faint to show). */
export const step = (a: number) => (a < 0.06 ? -1 : a < 0.25 ? 0 : a < 0.5 ? 1 : a < 0.78 ? 2 : 3);
/** A ramp's step for an old alpha 0..1. */
export const along = (ramp: readonly number[], a: number) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(a * ramp.length)))];

/** Sets a pixel only where it brings light: the additive layers of the old page. */
export function lighten(r: Raster, x: number, y: number, i: number): void {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return;
  const k = y * r.w + x;
  if (LUM1[i] > LUM1[r.px[k]]) r.px[k] = i;
}

/**
 * A character `s` pixels to a font pixel, centred on (cx, cy), each pixel
 * coloured by `ink` (from its font row and column; 0 leaves it), laid in only
 * where it brings light when `add`.
 */
export function bigGlyph(r: Raster, cx: number, cy: number, ch: string, s: number, ink: (row: number, col: number, x: number, y: number) => number, add = false): void {
  const m = glyphBits(ch), x0 = Math.round(cx - 1.5 * s), y0 = Math.round(cy - 2.5 * s);
  for (let k = 0; k < 15; k++) {
    if (!((m >> (14 - k)) & 1)) continue;
    const col = k % 3, row = (k / 3) | 0;
    for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
      const x = x0 + col * s + xx, y = y0 + row * s + yy, i = ink(row, col, x, y);
      if (i) { if (add) lighten(r, x, y, i); else r.set(x, y, i); }
    }
  }
}
/** The outline of a big character: the edges of its font pixels that face out of it. */
export function glyphOutline(r: Raster, cx: number, cy: number, ch: string, s: number, ink: (x: number, y: number) => number): void {
  const m = glyphBits(ch), x0 = Math.round(cx - 1.5 * s), y0 = Math.round(cy - 2.5 * s);
  const on = (col: number, row: number) => col >= 0 && col < 3 && row >= 0 && row < 5 && (m >> (14 - (row * 3 + col))) & 1;
  const put = (x: number, y: number) => { const i = ink(x, y); if (i) lighten(r, x, y, i); };
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
    if (!on(col, row)) continue;
    const X = x0 + col * s, Y = y0 + row * s;
    for (let k = 0; k < s; k++) {
      if (!on(col, row - 1)) put(X + k, Y);
      if (!on(col, row + 1)) put(X + k, Y + s - 1);
      if (!on(col - 1, row)) put(X, Y + k);
      if (!on(col + 1, row)) put(X + s - 1, Y + k);
    }
  }
}

/** An event in the void, as the layer over the window needs to know it. */
export interface Ev { name: string; p: number; a: number; dirX: number; dirY: number; ch: string; hue: number; x0: number; y0: number; x1: number; y1: number; side: number; pts: number[] | null; zx?: number; zy?: number; zr?: number }

/** What the void and the layer over the window share. */
export const ONE = {
  /** The sword's point (window CSS px), a click's pulse and swing (1 decaying to 0), where a click landed. */
  tip: null as { x: number; y: number } | null,
  pulse: 0, swing: 0,
  clickAt: null as { x: number; y: number } | null,
  /** A few pixels of counter-parallax (CSS px). */
  parX: 0, parY: 0,
  /** Whatever the void is doing. */
  ev: null as Ev | null,
};
