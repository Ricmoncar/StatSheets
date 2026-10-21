import { Painter, rng, rows } from './painter';

/**
 * Sprites: palette grids drawn frame by frame into one horizontal strip.
 * Each becomes a CSS variable --s-<id> and a class .s-<id> (see PixelTheme);
 * `.anim` steps through the frames at `fps`. `acc` marks sprites that use
 * the accent ramps and are redrawn when the accent changes.
 */
export interface SpriteDef { id: string; w: number; h: number; n: number; fps: number; acc: boolean; draw: (P: Painter, f: number) => void }

export const SPRITES: SpriteDef[] = [];
const S = (id: string, w: number, h: number, n: number, fps: number, acc: boolean, draw: SpriteDef['draw']) => SPRITES.push({ id, w, h, n, fps, acc, draw });

export const HEART9 = `
.RRR.RRR.
RRRRRRRRR
RRRRRRRRR
RRRRRRRRR
.RRRRRRR.
..RRRRR..
...RRR...
....R....`;
export const HEART7 = `
.RR.RR.
RRRRRRR
RRRRRRR
.RRRRR.
..RRR..
...R...`;
export const GEM9 = `
..00000..
.0DEEDC0.
0DDEEDCB0
0CDDDCCB0
0CCDCCBB0
.0CCCBB0.
..0CBB0..
...0B0...
....0....`;
const GEM7 = `
..000..
.0DEC0.
0DDECB0
0CDCBB0
.0CBB0.
..0B0..
...0...`;

const FLAME = [`
...O...
..OO...
..ONO..
.ONYNO.
.NYYYN.
.NYYYN.
..NNN..
...M...`, `
....O..
...OO..
..ONO..
.ONYNO.
.NYYYNO
.NYYYN.
..NYN..
...M...`, `
...O...
...OO..
..OON..
.ONYYO.
.NYYYN.
ONYYYN.
..NNN..
...M...`, `
..O....
..OO...
..ONO..
.ONYNO.
.NYYYN.
.NYYYNO
..NYN..
...M...`];
S('torch', 7, 14, 4, 8, false, (P, f) => {
  P.g(FLAME[f], 0, 0);
  P.g(`
.0ooo0.
.0non0.
..0x0..
..xyx..
..xyx..
...x...`, 0, 8);
});
const SPARK = [`
.....
.....
..C..
.....
.....`, `
.....
..D..
.DED.
..D..
.....`, `
..D..
..D..
DD7DD
..D..
..D..`, `
.....
..D..
.DED.
..D..
.....`];
S('spark', 5, 5, 4, 8, true, (P, f) => P.g(SPARK[f]));
S('spark-epic', 5, 5, 4, 8, false, (P, f) => P.g(SPARK[f], 0, 0, { C: 'vi1', D: 'vi3', E: 'white' }));
S('coin', 8, 8, 6, 10, false, (P, f) => {
  const s = [1, 0.72, 0.38, 0.13, 0.38, 0.72][f], widths = [2, 3, 4, 4, 4, 4, 3, 2];
  widths.forEach((hw0, y) => {
    const hw = Math.max(1, Math.round(hw0 * s)), x0 = 4 - hw, x1 = 4 + hw - 1;
    for (let x = x0; x <= x1; x++) {
      let k: Parameters<Painter['p']>[2] = 'em3';
      if (x === x0 || x === x1 || y === 0 || y === 7) k = 'void';
      else if (y === 1 || y === 6) k = x === x0 + 1 && f !== 3 ? 'yel' : y === 6 ? 'gd' : 'em3';
      else if (f === 3) k = 'gd';
      else if (x === x0 + 1) k = f >= 2 && f <= 4 ? 'em3' : 'yel';
      else if (x === x1 - 1) k = 'gd';
      if (f === 0 && x === 4 && (y === 3 || y === 4)) k = 'gd';
      P.p(x, y, k);
    }
  });
});
S('coin-s', 5, 5, 1, 1, false, P => P.g(`
.000.
0YOg0
0YOg0
0Ogg0
.000.`));
const STAR = [`
.....O.....
.....Y.....
....YYY....
....YYY....
...YYYYY...
OYYYY7YYYYO
...YYYYY...
....YYY....
....YYY....
.....Y.....
.....O.....`, `
...........
.....O.....
.....Y.....
....YYY....
...YYYYY...
.OYYY7YYYO.
...YYYYY...
....YYY....
.....Y.....
.....O.....
...........`, `
...........
...........
.....O.....
.....Y.....
....YYY....
..OYY7YYO..
....YYY....
.....Y.....
.....O.....
...........
...........`];
S('save', 11, 11, 4, 6, false, (P, f) => P.g(STAR[[0, 1, 2, 1][f]]));
S('pstar-off', 11, 11, 1, 1, false, P => P.g(STAR[1], 0, 0, { O: 'ink3', Y: 'ash', '7': 'mute' }));
S('soul', 9, 8, 1, 1, false, P => P.g(HEART9));
S('heart7', 7, 6, 1, 1, false, P => P.g(HEART7));
S('pick', 7, 4, 1, 1, false, P => P.g(`
...Y...
..YYY..
.YY.YY.
YY...YY`));
S('tail', 7, 4, 1, 1, false, P => P.g(`
0fFFFf0
.0fFf0.
..0F0..
...0...`));
S('chk', 9, 9, 6, 1, true, (P, f) => {
  const dis = f >= 4, hov = f === 2 || f === 3, on = f === 1 || f === 3 || f === 5;
  P.r(0, 0, 9, 9, hov ? 'yel' : 'void');
  P.r(1, 1, 7, 7, dis ? 'ink3' : 'sn0');
  P.r(2, 2, 6, 6, dis ? 'ink2' : 'sn3');
  P.r(2, 2, 5, 5, dis ? 'ink2' : 'ink');
  if (on) P.g(`
.R.R.
RRRRR
.RRR.
..R..`, 2, 3, dis ? { R: 'ash' } : {});
});
// toggle: a carved groove, and the SOUL is the knob (grey off, red on, yellow ring under the pointer)
S('trk', 19, 9, 3, 1, true, (P, f) => {
  P.r(0, 1, 19, 7, 'void');
  P.r(1, 2, 17, 5, f === 2 ? 'ink2' : 'sn0');
  P.r(1, 2, 17, 1, 'void');
  if (f === 1) { P.r(2, 3, 15, 3, 'ac1'); for (let x = 3; x < 17; x += 3) P.p(x, 4, 'ac2'); }
  else if (f === 2) { for (let x = 2; x < 17; x += 2) P.p(x, 4, 'ink3'); }
  else P.r(2, 3, 15, 3, 'ink2');
  P.r(1, 6, 17, 1, f === 2 ? 'ink3' : 'sn2');
});
const HEART_M = rows(HEART7);
S('knob', 9, 9, 5, 1, false, (P, f) => {
  const on = (x: number, y: number) => y >= 0 && y < 6 && x >= 0 && x < 7 && HEART_M[y][x] === 'R';
  const fill = ([['mt2', 'mt3'], ['red', 'white'], ['mt2', 'mt3'], ['red', 'white'], ['ink3', 'ash']] as const)[f];
  const ring = f === 2 || f === 3 ? 'yel' : f === 4 ? 'ash' : 'void';
  for (let y = -1; y <= 6; y++) for (let x = -1; x <= 7; x++) {
    if (on(x, y)) P.p(x + 1, y + 2, x === 1 && y === 1 ? fill[1] : fill[0]);
    else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) P.p(x + 1, y + 2, ring);
  }
});
S('eq', 11, 10, 6, 8, true, (P, f) => {
  const H = [[4, 8, 6, 9], [7, 5, 9, 4], [9, 3, 7, 6], [5, 9, 4, 8], [8, 6, 3, 10], [3, 7, 8, 5]][f];
  H.forEach((h, i) => { P.r(i * 3, 10 - h, 2, h, 'ac2'); P.r(i * 3, 10 - h, 2, 1, 'ac4'); P.r(i * 3 + 1, 10 - h + 1, 1, h - 1, 'ac1'); });
});
S('more', 7, 7, 4, 6, true, (P, f) => P.g(`
C......
CD.....
CDC....
CDCC...
CDC....
CD.....
C......`, [0, 1, 2, 1][f], 0));

// ── rarity art windows: 20x20, 8 frames each ──
const HEART14 = rows(`
..XXXX..XXXX..
.XXXXXXXXXXXX.
XXXXXXXXXXXXXX
XXXXXXXXXXXXXX
XXXXXXXXXXXXXX
.XXXXXXXXXXXX.
..XXXXXXXXXX..
...XXXXXXXX...
....XXXXXX....
.....XXXX.....
......XX......`);
const RARITY_ART: Record<string, (P: Painter, f: number) => void> = {
  common(P, f) { // a pebble that glints, lint drifting up
    P.r(0, 0, 20, 20, 'mt0'); P.dither(0, 0, 20, 8, 'ink2', 0.25);
    P.r(0, 15, 20, 5, 'mt1'); P.r(0, 15, 20, 1, 'mt2'); P.dither(0, 17, 20, 3, 'mt0', 0.5);
    P.ell(10, 12.5, 6, 3.6, 'void'); P.ell(10, 12.5, 5.2, 2.9, 'mt2');
    P.r(6, 10, 6, 1, 'mt3'); P.p(5, 11, 'mt3'); P.r(7, 15, 7, 1, 'mt1'); P.p(14, 14, 'mt1'); P.p(11, 12, 'mt1'); P.p(8, 13, 'mt1');
    if (f < 2) { P.p(7, 11, 'white'); if (f === 0) { P.p(7, 10, 'mt3'); P.p(6, 11, 'mt3'); P.p(8, 11, 'mt3'); } }
    [[4, 0], [13, 3], [16, 6]].forEach(([x, o]) => { const y = (13 - ((f + o) % 8) * 1.5) | 0; if (y > 1) P.p(x + ((f + o) % 4 < 2 ? 0 : 1), y, (f + o) % 8 > 5 ? 'mt2' : 'mt3'); });
  },
  rare(P, f) { // a drip falls into the pool and rings out
    P.r(0, 0, 20, 20, 'ec0'); P.dither(0, 0, 20, 4, 'void', 0.5);
    P.r(0, 14, 20, 6, 'ec1'); P.r(0, 14, 20, 1, 'ec2'); P.dither(0, 16, 20, 4, 'ec0', 0.25);
    P.r(8, 0, 4, 2, 'ink2'); P.p(9, 2, 'ec2');
    if (f < 4) { const y = 3 + f * 3; P.p(10, y, 'fr1'); P.r(9, y + 1, 3, 2, 'ec2'); P.p(10, y + 1, 'white'); P.r(10, y + 3, 1, 1, 'ec1'); }
    if (f === 4) { P.p(8, 12, 'fr1'); P.p(12, 12, 'fr1'); P.p(7, 11, 'white'); P.p(13, 11, 'white'); P.p(10, 11, 'fr1'); P.r(8, 14, 5, 1, 'white'); }
    if (f >= 5) { const w = [5, 8, 11][f - 5]; P.r(10 - w, 14, 3, 1, 'fr1'); P.r(10 + w - 2, 14, 3, 1, 'fr1'); P.r(10 - w + 2, 15, 2, 1, 'ec2'); P.r(10 + w - 3, 15, 2, 1, 'ec2'); }
  },
  epic(P, f) { // a crystal cluster; a glint climbs the big face
    P.r(0, 0, 20, 20, 'vi0'); P.dither(0, 0, 20, 20, 'void', 0.25);
    P.r(0, 17, 20, 3, 'void'); P.r(0, 17, 20, 1, 'vi1');
    const cr = (x: number, top: number, w: number, k: ['vi2' | 'vi3', 'vi1' | 'vi2', 'vi3' | 'white']) => {
      for (let y = top; y < 17; y++) { const hw = Math.min(w, 1 + ((y - top) >> 1)); for (let i = -hw; i < hw; i++) P.p(x + i, y, i < 0 ? k[0] : k[1]); }
      P.p(x - 1, top, k[2]);
    };
    cr(5, 9, 2, ['vi2', 'vi1', 'vi3']); cr(15, 7, 2, ['vi2', 'vi1', 'vi3']); cr(10, 2, 3, ['vi3', 'vi2', 'white']);
    const gy = 15 - f * 2; if (gy >= 3) { P.r(8, gy, 2, 1, 'white'); P.p(9, gy - 1, 'vi3'); }
    if (f === 6 || f === 7) { P.p(10, 0, f === 6 ? 'white' : 'vi3'); P.p(9, 1, 'vi3'); P.p(11, 1, 'vi3'); if (f === 6) { P.p(8, 1, 'vi2'); P.p(12, 1, 'vi2'); } }
  },
  legendary(P, f) { // a crown; a white glint sweeps across the band
    P.r(0, 0, 20, 20, 'wd0'); P.dither(0, 0, 20, 20, 'wd1', 0.25);
    P.r(0, 17, 20, 3, 'void'); P.r(0, 17, 20, 1, 'gd');
    P.r(3, 11, 14, 5, 'void'); P.r(4, 12, 12, 3, 'em3'); P.r(4, 14, 12, 1, 'gd'); P.r(4, 12, 12, 1, 'yel');
    [[4, 5], [9, 3], [14, 5]].forEach(([x, t]) => { P.r(x - 1, t, 4, 9 - (t - 3), 'void'); P.r(x, t + 1, 2, 11 - t - 1, 'em3'); P.p(x, t + 1, 'yel'); P.p(x + 1, 11, 'gd'); });
    P.p(10, 2, 'void'); P.p(9, 2, 'void'); P.r(9, 2, 2, 1, 'yel');
    P.p(6, 13, 'red'); P.p(10, 13, 'ec2'); P.p(14, 13, 'grn');
    const gx = f * 3 - 2; for (let y = 4; y < 15; y++) { const x = gx + ((15 - y) >> 2); if (x >= 4 && x < 16) P.p(x, y, 'white'); }
  },
  mythic(P, f) { // a living flame with embers
    P.r(0, 0, 20, 20, 'em0'); P.dither(0, 0, 20, 20, 'void', 0.5);
    P.r(0, 18, 20, 2, 'void'); P.r(0, 18, 20, 1, 'em1');
    for (let y = 0; y < 16; y++) {
      const yy = 17 - y, t = y / 15, hw = Math.round(6 * Math.sin(Math.PI * (t * 0.85 + 0.12)) * (1 - t * 0.35));
      const cx = 10 + Math.round(Math.sin(y * 0.7 + f * 1.6) * 1.4 * t);
      for (let i = -hw; i < hw; i++) { const e = Math.abs(i + 0.5) / Math.max(1, hw); P.p(cx + i, yy, e > 0.75 ? 'em1' : e > 0.45 ? 'em2' : y < 7 ? 'yel' : 'em3'); }
    }
    [[4, 0], [15, 3], [8, 5]].forEach(([x, o]) => { const q = (f + o) % 8, y = 15 - q * 2; if (y > 0) P.p(x + (q & 1), y, q > 5 ? 'em2' : 'em3'); });
  },
  hexxed(P, f) { // a broken SOUL that will not hold still
    P.r(0, 0, 20, 20, 'void');
    const R2 = rng(40 + f); for (let i = 0; i < 26; i++) P.p(Math.floor(R2() * 20), Math.floor(R2() * 20), R2() < 0.7 ? 'vi0' : 'vi1');
    const shift = f === 5 ? [5, 7, 2] : f === 7 ? [3, 5, -2] : null, flash = f === 6;
    HEART14.forEach((row, y) => {
      const dx = shift && y >= shift[0] && y <= shift[1] ? shift[2] : 0;
      for (let x = 0; x < 14; x++) {
        if (row[x] !== 'X') continue;
        const crack = (x === 7 && y % 3 !== 2) || (x === 6 && y % 3 === 2) || (x === 8 && y === 4);
        const edge = y === 0 || x === 0 || x === 13 || row[x - 1] !== 'X' || row[x + 1] !== 'X' || !HEART14[y + 1] || HEART14[y + 1][x] !== 'X';
        P.p(3 + x + dx, 5 + y, crack ? (flash ? 'vi3' : 'void') : flash ? 'red' : edge ? 'vi1' : x < 4 && y < 4 ? 'vi3' : 'vi2');
      }
    });
    if (f === 5 || f === 7) { P.r(0, 10, 20, 1, 'vi3'); P.r(2, 11, 6, 1, 'red'); }
  },
};
for (const [k, fn] of Object.entries(RARITY_ART)) S('art-' + k, 20, 20, 8, k === 'hexxed' ? 10 : 8, false, fn);

S('thumb', 9, 11, 2, 1, true, (P, f) => P.g(GEM9, 0, 1, f ? { '0': 'yel' } : {}));
S('gem-s', 7, 7, 1, 1, true, P => P.g(GEM7));
S('gem-off', 7, 7, 1, 1, false, P => P.g(GEM7, 0, 0, { D: 'ash', E: 'mute', C: 'ink3', B: 'ink2' }));
const CELL = `
..000..
.0DEC0.
0DDECB0
0DDCCB0
0CDCBB0
0CCCBB0
.0CBB0.
..0B0..
...0...`;
S('cell', 7, 9, 3, 1, true, (P, f) => {
  if (f === 2) P.g(CELL);
  else {
    P.g(CELL, 0, 0, { D: 'ink3', E: 'ash', C: 'ink2', B: 'ink2' });
    if (f === 1) P.g(`
0CDCBB0
0CCCBB0
.0CBB0.
..0B0..`, 0, 4);
  }
});
S('flower', 7, 11, 4, 6, false, (P, f) => {
  P.g(`
..k.k..
.kFkFk.
.kF7Fk.
..kFk..`, [0, 1, 0, -1][f], 0);
  P.g(`
...Q...
...Q...
..QQ...
...Q...
...Q.Q.
..QQQ..
.QQ.QQ.`, 0, 4);
});
export const CRYSTAL = `
....E....
...EDC...
...DCB...
.E.DCB.D.
.DCDCBDCB
.DCDCBDCB
DCBDCBCBB
DCBDCBCBA
CBADCBCBA
AAAAAAAAA`;
S('crystal', 9, 10, 1, 1, true, P => P.g(CRYSTAL));
S('crystal-epic', 9, 10, 1, 1, false, P => P.g(CRYSTAL, 0, 0, { A: 'vi0', B: 'vi1', C: 'vi2', D: 'vi3', E: 'white' }));
const EYE = [`
.....hhhhh.....
...hhUUUUUhh...
.hhUUUuuuUUUhh.
hUUUUuuRuuUUUUh
hUUUuuR0RuuUUUh
hUUUUuuRuuUUUUh
.hhUUUuuuUUUhh.
...hhUUUUUhh...
.....hhhhh.....`, `
...............
.....hhhhh.....
...hhhhhhhhh...
.hhhhhhhhhhhhh.
hUUUuuR0RuuUUUh
.hhUUUuRuUUUhh.
...hhhhhhhhh...
...............
...............`, `
...............
...............
...............
...............
hhhhhhhhhhhhhhh
.h.h.h.h.h.h.h.
...............
...............
...............`];
S('eye', 15, 9, 8, 6, false, (P, f) => P.g(EYE[[0, 0, 0, 0, 0, 1, 2, 1][f]], 0, 0, { h: 'vi1', '0': 'void', R: 'red' }));
S('crest', 8, 8, 4, 8, false, (P, f) => {
  const base = [2, 4, 6, 3, 1, 5, 7, 3];
  for (let x = 0; x < 8; x++) {
    const h = 1 + base[(x + f * 3) % 8];
    for (let y = 8 - h; y < 8; y++) { const d = y - (8 - h); P.p(x, y, d === 0 ? (h > 5 ? 'yel' : 'em3') : d < 2 ? 'em2' : 'em1'); }
  }
});
S('burst', 16, 16, 5, 12, false, (P, f) => {
  if (f === 4) return;
  const r = 2 + f * 2;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    P.p(Math.round(7.5 + Math.cos(a) * r), Math.round(7.5 + Math.sin(a) * r), f < 2 ? 'white' : 'yel');
    if (f > 0) P.p(Math.round(7.5 + Math.cos(a) * (r - 1)), Math.round(7.5 + Math.sin(a) * (r - 1)), 'em3');
  }
  if (f < 2) P.r(7, 7, 2, 2, 'white');
});
S('btail', 7, 5, 1, 1, false, P => P.g(`
0000000
.077777
..07777
...0777
....000`));
S('btail-me', 7, 5, 1, 1, true, P => P.g(`
0000000
.0DAAAA
..0DAAA
...0DAA
....0DD`));
