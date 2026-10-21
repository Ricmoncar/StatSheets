import { Ink, Painter, hash } from './painter';

/**
 * 9-slice frame sources. A frame of depth D is painted on a square of
 * 2D + L pixels; CSS border-image cuts it at D and repeats the edges.
 * fn returns the colour of one pixel given where it sits in the frame.
 */
export interface FramePx { x: number; y: number; d: number; side: 't' | 'l' | 'b' | 'r'; lit: boolean; corner: boolean; cx: string; cy: string; u: number; v: number; along: number; D: number; W: number; H: number }
export interface FrameDef { id: string; D: number; L: number; acc: boolean; fn: (o: FramePx) => Ink }

export function paintFrame(P: Painter, W: number, H: number, D: number, fn: FrameDef['fn']): void {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dl = x, dt = y, dr = W - 1 - x, db = H - 1 - y, d = Math.min(dl, dt, dr, db);
    if (d >= D) continue;
    const side = d === dt ? 't' : d === dl ? 'l' : d === db ? 'b' : 'r';
    const cx = x < D ? 'l' : x >= W - D ? 'r' : '', cy = y < D ? 't' : y >= H - D ? 'b' : '';
    const k = fn({
      x, y, d, side, lit: side === 't' || side === 'l', corner: !!(cx && cy), cx, cy,
      u: cx === 'r' ? x - (W - D) : x, v: cy === 'b' ? y - (H - D) : y,
      along: side === 't' || side === 'b' ? x : y, D, W, H,
    });
    if (k) P.p(x, y, k);
  }
}

export const FRAMES: FrameDef[] = [];
const F = (id: string, D: number, L: number, acc: boolean, fn: FrameDef['fn']) => FRAMES.push({ id, D, L, acc, fn });

/** True on the four outermost corner pixels, which every frame leaves clear. */
const round1 = (o: FramePx) => o.corner && (
  (o.u === 0 && o.v === 0 && o.cx === 'l' && o.cy === 't') || (o.cx === 'r' && o.cy === 't' && o.u === o.D - 1 && o.v === 0) ||
  (o.cx === 'l' && o.cy === 'b' && o.u === 0 && o.v === o.D - 1) || (o.cx === 'r' && o.cy === 'b' && o.u === o.D - 1 && o.v === o.D - 1));
/** A small diamond gem inside a corner block: centre, top, left, right, bottom. */
const gemAt = (o: FramePx, cxp: number, cyp: number, set: Ink[]): Ink => {
  const lu = o.cx === 'l' ? o.u : o.D - 1 - o.u, lv = o.cy === 't' ? o.v : o.D - 1 - o.v;
  const dx = lu - cxp, dy = lv - cyp;
  if (dx === 0 && dy === 0) return set[0];
  if (dx === 0 && dy === -1) return set[1];
  if (dx === -1 && dy === 0) return set[2];
  if (dx === 1 && dy === 0) return set[3];
  if (dx === 0 && dy === 1) return set[4];
  return null;
};

// stone: one course of tall Ruins blocks, 12 long on top and bottom, 6 tall
// on the sides, so a panel edge reads as masonry. Cornerstones carry an accent gem.
const brick = (r: number, c: number, P: number, x: number, y: number): Ink => {
  if (c === 0) return 'sn0';
  const sp = hash(x, y, 7) % 13;
  if (r === 0 || c === 1) return sp === 0 ? 'sn2' : 'sn3';
  if (r === 3 || c === P - 1) return 'sn1';
  return sp === 1 ? 'sn1' : sp === 2 ? 'sn3' : 'sn2';
};
F('stone', 7, 24, true, o => {
  if (round1(o)) return null;
  if (o.d === 0) return 'void';
  const D = o.D;
  if (o.corner) {
    const lu = o.cx === 'l' ? o.u : D - 1 - o.u, lv = o.cy === 't' ? o.v : D - 1 - o.v;
    const ax = o.cx === 'l' ? lu - 1 : 4 - lu, ay = o.cy === 't' ? lv - 1 : 4 - lv;
    if (lu >= 1 && lu <= 4 && lv >= 1 && lv <= 4) {
      if ((ax === 1 || ax === 2) && (ay === 1 || ay === 2)) return ax === 1 && ay === 1 ? 'ac4' : ax === 2 && ay === 2 ? 'ac1' : 'ac2';
      if (ay === 0 || ax === 0) return 'sn3';
      if (ay === 3 || ax === 3) return 'sn1';
      return 'sn2';
    }
    const dd = Math.min(lu, lv);
    if (dd >= 5) return dd === 5 ? 'void' : o.cy === 'b' && o.cx === 'r' ? 'ink' : 'void';
    if (lu >= 5) return lu === 5 ? 'sn0' : o.cx === 'l' ? 'sn3' : 'sn1';
    if (lv >= 5) return lv === 5 ? 'sn0' : o.cy === 't' ? 'sn3' : 'sn1';
    return 'sn2';
  }
  if (o.d === 5) return 'void';
  if (o.d === 6) return o.lit ? 'void' : 'ink';
  if (o.side === 't' || o.side === 'b') { const r = o.side === 't' ? o.y - 1 : o.y - (o.H - 5); return brick(r, (o.x + 7) % 12, 12, o.x, o.y); }
  const c = o.side === 'l' ? o.x - 1 : o.x - (o.W - 5);
  const rr = (o.y + 1) % 6;
  if (rr === 0) return 'sn0';
  const sp = hash(o.x, o.y, 7) % 13;
  if (rr === 1 || c === 0) return sp === 0 ? 'sn2' : 'sn3';
  if (rr === 5 || c === 3) return 'sn1';
  return sp === 1 ? 'sn1' : sp === 2 ? 'sn3' : 'sn2';
});
F('slate', 5, 16, true, o => {
  if (round1(o)) return null;
  if (o.d === 0 || o.d === 4) return 'void';
  if (o.corner) { const g = gemAt(o, 2, 2, ['ac3', 'sn3', 'sn3', 'sn1', 'sn1']); if (g) return g; }
  if (o.d === 1) return o.lit ? 'sn3' : 'sn0';
  if (o.d === 2) return o.along % 8 === 0 && !o.corner ? 'sn0' : o.lit ? 'sn2' : 'sn1';
  return o.lit ? 'sn1' : 'sn0';
});
// wood: the inner bevel is an accent inlay and the nail heads are accent brass
F('wood', 5, 16, true, o => {
  if (round1(o)) return null;
  if (o.d === 0) return 'void';
  if (o.d === 4) return o.lit ? 'ac1' : 'wd0';
  if (o.corner) { const lu = o.cx === 'l' ? o.u : 4 - o.u, lv = o.cy === 't' ? o.v : 4 - o.v; if (lu === 2 && lv === 2) return 'ac3'; if ((lu === 3 && lv === 2) || (lu === 2 && lv === 3)) return 'ac1'; }
  if (o.d === 1) return o.lit ? 'wd3' : 'wd0';
  if (o.d === 2) return hash(o.along >> 2, o.side.charCodeAt(0)) % 4 === 0 ? 'wd1' : 'wd2';
  return hash(o.along >> 1, o.d, o.side.charCodeAt(0)) % 5 === 0 ? 'wd2' : 'wd1';
});
const metalFn = (r: Ink[], rivet = true) => (o: FramePx): Ink => { // r: dark, mid-dark, mid, light, highlight
  if (round1(o)) return null;
  if (o.d === 0 || o.d === o.D - 1) return 'void';
  const lu = o.cx === 'l' ? o.u : o.D - 1 - o.u, lv = o.cy === 't' ? o.v : o.D - 1 - o.v;
  if (rivet && o.corner && lu >= 1 && lu <= 2 && lv >= 1 && lv <= 2) return [r[4], r[3], r[3], r[0]][(lv - 1) * 2 + (lu - 1)];
  if (rivet && !o.corner && (o.along % 12 === 5 || o.along % 12 === 6) && (o.d === 1 || o.d === 2)) return o.along % 12 === 5 ? (o.d === 1 ? r[4] : r[3]) : o.d === 1 ? r[3] : r[0];
  if (o.d === 1) return o.lit ? r[3] : r[0];
  if (o.d === 2) return o.lit ? r[2] : r[1];
  return r[1];
};
F('metal', 5, 12, false, metalFn(['mt0', 'mt1', 'mt2', 'mt3', 'white']));
F('frost', 4, 8, false, o => {
  if (round1(o)) return null;
  if (o.d === 0) return 'void';
  if (o.corner) { const lu = o.cx === 'l' ? o.u : 3 - o.u, lv = o.cy === 't' ? o.v : 3 - o.v; if (lu === 1 && lv === 1) return 'white'; }
  if (o.d === 1) return o.lit ? 'fr1' : 'fr0';
  if (o.d === 2) return (o.x + o.y) & 1 ? 'fr0' : o.lit ? 'fr1' : 'ec1';
  return 'ec0';
});
const insetFn = (outerLit: Ink, outerShade: Ink, inner: Ink) => (o: FramePx): Ink => {
  if (round1(o)) return null;
  if (o.d === 0) return o.lit ? outerLit : outerShade;
  if (o.d === 1) return o.lit ? 'void' : 'mt1';
  return o.lit ? inner : 'ink2';
};
F('inset', 3, 4, false, insetFn('mt0', 'mt2', 'ink3'));
F('inset-hi', 3, 4, false, insetFn('mt1', 'mt3', 'ink3'));
F('inset-on', 3, 4, true, o => (round1(o) ? null : o.d === 0 ? 'yel' : o.d === 1 ? 'void' : 'ac1'));
F('crystal', 5, 12, true, o => {
  if (round1(o)) return null;
  if (o.d === 0 || o.d === 4) return 'void';
  if (o.corner) { const g = gemAt(o, 2, 2, ['white', 'ac4', 'ac3', 'ac2', 'ac1']); if (g) return g; }
  if (o.d === 1) return o.lit ? 'ac4' : 'ac1';
  if (o.d === 2) return (o.along + o.d) % 6 < 3 ? (o.lit ? 'ac3' : 'ac2') : o.lit ? 'ac2' : 'ac1';
  return o.lit ? 'ac2' : 'ac0';
});
// buttons (D=4): outline, bevel, face, and a seam that turns yellow under the SOUL
const btnFn = (r: Ink[], seam: Ink, grain: boolean) => (o: FramePx): Ink => {
  if (round1(o)) return null;
  if (o.d === 0) return 'void';
  if (o.d === 3) return seam;
  if (o.d === 1) return o.lit ? r[3] : r[0];
  if (grain && hash(o.along >> 2, o.side.charCodeAt(0)) % 3 === 0) return r[1];
  return o.lit ? r[2] : r[1];
};
F('btn-wood', 4, 8, false, btnFn(['wd0', 'wd1', 'wd2', 'wd3'], 'wd0', true));
F('btn-wood-hi', 4, 8, false, btnFn(['wd0', 'wd1', 'wd2', 'wd3'], 'yel', true));
F('tab-on', 4, 8, true, btnFn(['wd0', 'wd1', 'wd2', 'wd3'], 'ac2', true));
F('btn-acc', 4, 8, true, btnFn(['ac0', 'ac1', 'ac3', 'ac4'], 'ac2', false));
F('btn-acc-hi', 4, 8, true, btnFn(['ac0', 'ac1', 'ac3', 'ac4'], 'yel', false));
F('btn-hot', 4, 8, false, btnFn(['em0', 'em0', 'em2', 'em3'], 'em1', false));
F('btn-hot-hi', 4, 8, false, btnFn(['em0', 'em0', 'em2', 'em3'], 'yel', false));
F('btn-stone', 4, 8, true, btnFn(['sn0', 'sn1', 'sn2', 'sn3'], 'sn1', false));
F('btn-stone-hi', 4, 8, true, btnFn(['sn0', 'sn1', 'sn2', 'sn3'], 'yel', false));
F('btn-dis', 4, 8, false, o => (round1(o) ? null : o.d === 0 ? 'ink3' : o.d === 1 ? ((o.x + o.y) & 1 ? 'ink3' : 'ink2') : 'ink2'));
F('tag', 2, 4, false, o => (round1(o) ? null : o.d === 0 ? 'void' : o.lit ? 'wd2' : 'wd1'));
const bubbleFn = (rim: Ink, fill: Ink) => (o: FramePx): Ink => {
  if (o.corner) { const lu = o.cx === 'l' ? o.u : 2 - o.u, lv = o.cy === 't' ? o.v : 2 - o.v; if (lu + lv < 2) return null; if (lu === 1 && lv === 1) return 'void'; }
  return o.d === 0 ? 'void' : o.d === 1 ? rim : fill;
};
F('bubble', 3, 6, false, bubbleFn('white', 'white'));
F('bubble-me', 3, 6, true, bubbleFn('ac3', 'ac0'));

// rarity card frames (D=6)
export const RARITY_FRAME: Record<string, { r: Ink[]; pat: (o: FramePx) => number }> = {
  common: { r: ['mt0', 'mt1', 'mt2', 'mt3'], pat: o => (o.along % 8 === 0 ? 0 : 2) },
  rare: { r: ['ec0', 'ec1', 'ec2', 'fr1'], pat: o => ((o.along >> 2) % 2 ? 2 : 1) },
  epic: { r: ['vi0', 'vi1', 'vi2', 'vi3'], pat: o => ((o.along + o.d) % 4 < 2 ? 3 : 2) },
  legendary: { r: ['wd1', 'gd', 'em3', 'yel'], pat: o => (o.along % 8 === 4 ? 3 : 2) },
  mythic: { r: ['em0', 'em1', 'em2', 'em3'], pat: o => (o.along % 8 === 4 ? 3 : 1) },
  hexxed: { r: ['void', 'vi1', 'vi2', 'vi3'], pat: o => { const h = hash(o.x, o.y, 9) % 6; return h === 0 ? 3 : h < 3 ? 1 : 0; } },
  // the special traits: Duality's two sides and Determination's three states
  heavenly: { r: ['mt2', 'fr0', 'fr1', 'white'], pat: o => (o.along % 6 === 3 ? 3 : 2) },
  hellforged: { r: ['em0', 'red-d', 'red', 'em2'], pat: o => (o.along % 6 === 3 ? 3 : 1) },
  determined: { r: ['red-d', 'red-d', 'red', 'white'], pat: o => (o.along % 8 === 4 ? 3 : 2) },
  hatred: { r: ['void', 'red-d', 'red-d', 'red'], pat: o => (hash(o.x, o.y, 4) % 5 === 0 ? 3 : 1) },
  mercyful: { r: ['ec0', 'ec1', 'grn', 'fr1'], pat: o => (o.along % 8 === 4 ? 3 : 2) },
};
for (const [name, def] of Object.entries(RARITY_FRAME)) {
  F('tc-' + name, 6, 16, false, o => {
    if (round1(o)) return null;
    const r = def.r;
    if (o.d === 0 || o.d === 5) return 'void';
    if (o.corner) {
      const g = gemAt(o, 2, 2, [name === 'hexxed' ? 'red' : 'white', r[3], r[3], r[1], r[1]]); if (g) return g;
      const lu = o.cx === 'l' ? o.u : 5 - o.u, lv = o.cy === 't' ? o.v : 5 - o.v;
      return lu === 4 || lv === 4 ? r[0] : r[2];
    }
    if (o.d === 1) return o.lit ? r[3] : r[0];
    if (o.d === 2) return o.lit ? r[2] : r[1];
    if (o.d === 3) return r[def.pat(o)];
    return o.lit ? r[1] : r[0];
  });
}
F('cardback', 6, 16, true, o => {
  if (round1(o)) return null;
  if (o.d === 0 || o.d === 5) return 'void';
  if (o.corner) { const g = gemAt(o, 2, 2, ['white', 'ac4', 'ac3', 'ac1', 'ac1']); return g || 'ac2'; }
  if (o.d === 1) return o.lit ? 'ac4' : 'ac1';
  if (o.d === 2) return o.lit ? 'ac3' : 'ac2';
  if (o.d === 3) return o.along % 4 === 0 ? 'ac4' : 'ac2';
  return 'ac1';
});
