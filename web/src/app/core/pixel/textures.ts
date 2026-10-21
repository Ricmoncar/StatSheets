import { Painter, rng } from './painter';

/** Seamless tiles, each set as a CSS variable --t-<id>. */
export interface TextureDef { id: string; w: number; h: number; acc: boolean; draw: (P: Painter) => void }

export const TEXTURES: TextureDef[] = [];
const T = (id: string, w: number, h: number, acc: boolean, draw: TextureDef['draw']) => TEXTURES.push({ id, w, h, acc, draw });

// the page ground: faint cave rocks on the void
T('cave', 48, 48, false, P => {
  const R = rng(11);
  for (let i = 0; i < 6; i++) {
    const cx = Math.floor(R() * 48), cy = Math.floor(R() * 48), rx = 2 + Math.floor(R() * 3), ry = 1 + Math.floor(R() * 2);
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
      P.p((cx + x + 48) % 48, (cy + y + 48) % 48, y === -ry || x === -rx ? 'ink2' : 'ink');
    }
  }
  for (let i = 0; i < 18; i++) P.p(Math.floor(R() * 48), Math.floor(R() * 48), R() < 0.3 ? 'ink2' : 'ink');
});
T('rule', 8, 2, true, P => { P.r(0, 0, 5, 1, 'ac2'); P.r(0, 1, 5, 1, 'ac0'); P.p(5, 0, 'ac1'); });
T('water', 16, 8, false, P => {
  for (let x = 0; x < 16; x++) {
    const c = 3 + Math.round(Math.sin((x / 16) * Math.PI * 2) * 1.6);
    for (let y = 0; y < 8; y++) P.p(x, y, y < c - 1 ? 'ec1' : y === c - 1 ? 'ec2' : y === c ? 'fr1' : y < c + 3 ? 'ec1' : 'ec0');
    if (x % 8 === 3) P.p(x, c, 'white');
  }
});
T('glitch', 16, 16, false, P => {
  const R = rng(5);
  for (let y = 0; y < 16; y++) {
    const rowShift = R() < 0.2;
    for (let x = 0; x < 16; x++) { const v = R(); P.p(x, y, rowShift ? (v < 0.5 ? 'vi2' : 'vi0') : v < 0.45 ? 'vi0' : v < 0.7 ? 'void' : v < 0.9 ? 'vi1' : v < 0.97 ? 'vi3' : 'white'); }
  }
});
T('snowcap', 16, 6, false, P => {
  const h = [3, 4, 4, 5, 5, 4, 3, 3, 4, 5, 5, 5, 4, 4, 3, 3];
  for (let x = 0; x < 16; x++) { const top = 6 - h[x] - 1; for (let y = Math.max(0, top); y < 5; y++) P.p(x, y, y === top ? 'void' : y === top + 1 ? 'white' : y < 4 ? 'fr1' : 'fr0'); }
  [2, 9, 13].forEach(x => P.p(x, 5, 'fr0'));
  P.p(9, 4, 'fr1');
});
T('dither', 2, 2, false, P => { P.p(0, 0, 'void'); P.p(1, 1, 'void'); });
// interior textures: one ramp step off the fill, so text on top keeps its contrast
T('in-stone', 24, 10, true, P => {
  P.r(0, 4, 24, 1, 'sn0'); P.r(0, 9, 24, 1, 'sn0');
  P.r(0, 0, 1, 4, 'sn1'); P.r(12, 0, 1, 4, 'sn1'); P.r(6, 5, 1, 4, 'sn1'); P.r(18, 5, 1, 4, 'sn1');
});
T('in-wood', 32, 6, false, P => { P.r(2, 1, 7, 1, 'wd0'); P.r(14, 4, 9, 1, 'wd0'); P.r(26, 2, 4, 1, 'wd0'); P.p(11, 3, 'wd2'); P.r(22, 0, 3, 1, 'wd2'); });
T('in-metal', 4, 3, false, P => P.r(0, 2, 4, 1, 'ink2'));
T('fade', 12, 2, false, P => {
  for (let x = 0; x < 12; x++) for (let y = 0; y < 2; y++) {
    const d = x / 11, on = d > 0.8 ? true : d > 0.55 ? ((x + y) & 1) === 0 : d > 0.3 ? (x & 1) === 0 && y === 0 : false;
    if (on) P.p(x, y, 'void');
  }
});
T('cardback', 8, 8, true, P => {
  P.r(0, 0, 8, 8, 'ac0');
  for (let i = 0; i < 8; i++) { P.p(i, i, 'ac1'); P.p(7 - i, i, 'ac1'); }
  P.p(4, 4, 'ac2'); P.p(0, 4, 'ac2');
});
T('skel', 2, 2, false, P => { P.r(0, 0, 2, 2, 'ink2'); P.p(0, 0, 'ink3'); P.p(1, 1, 'ink3'); });
T('skelband', 40, 1, false, P => { P.r(0, 0, 6, 1, 'ash'); P.r(6, 0, 2, 1, 'ink3'); });
