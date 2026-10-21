import { Colours, FIXED, KEY } from './palette';
import { Painter, canvas, hash, rng, rows } from './painter';
import { ramp } from './ramp';
import { CRYSTAL } from './sprites';

/**
 * THE UNDERGROUND scenes: animated places drawn at art resolution, each in
 * the colour ramp of the colour it is given. They stand in for seven of the
 * generic background patterns (SCENE_FOR), keeping the settings that carry a
 * character's identity: the colour, the speed, how many things move, and the
 * opacity below its default.
 *
 * base() paints the still parts once per size, init() seeds what moves, and
 * frame() draws the moving parts over a copy of the base every tick.
 */
export interface SceneState { W: number; H: number; density: number; [k: string]: any }
export interface SceneDef {
  name: string;
  fps: number;
  base(P: Painter, s: SceneState): void;
  init(s: SceneState): void;
  frame(P: Painter, s: SceneState, t: number): void;
}

const sparkle = (P: Painter, x: number, y: number, st: number) => {
  if (st === 0) { P.p(x, y, 'ac1'); return; }
  if (st === 1) { P.p(x, y, 'ac3'); P.p(x - 1, y, 'ac1'); P.p(x + 1, y, 'ac1'); P.p(x, y - 1, 'ac1'); P.p(x, y + 1, 'ac1'); return; }
  P.p(x, y, 'white');
  for (const [d, c] of [[1, 'ac3'], [2, 'ac2'], [3, 'ac1']] as const) { P.p(x - d, y, c); P.p(x + d, y, c); P.p(x, y - d, c); P.p(x, y + d, c); }
};
const CRYS_ROWS = rows(CRYSTAL).reverse();

export const SCENES: Record<string, SceneDef> = {
  wish: {
    name: 'WISHING ROOM', fps: 10,
    base(P, s) {
      const { W, H } = s;
      P.r(0, 0, W, H, 'void');
      s['ceil'] = [] as number[];
      for (let x = 0; x < W; x++) s['ceil'].push(7 + Math.round(3 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.19 + 1)));
      const R = rng(17);
      for (let x = 6; x < W - 6; x += 9 + Math.floor(R() * 22)) {
        const len = 5 + Math.floor(R() * 14), w = 2 + Math.floor(R() * 3);
        for (let i = -w; i <= w; i++) { const xx = x + i; if (xx < 0 || xx >= W) continue; s['ceil'][xx] = Math.max(s['ceil'][xx], s['ceil'][x] + Math.round(len * (1 - Math.abs(i) / (w + 1)))); }
      }
      for (let x = 0; x < W; x++) { const h = s['ceil'][x]; P.dither(x, h, 1, 6, 'ac0', 0.5); P.dither(x, h + 6, 1, 8, 'ac0', 0.25); }
      for (let x = 0; x < W; x++) { const h = s['ceil'][x]; P.r(x, 0, 1, h, 'ink2'); P.p(x, h - 1, 'ink3'); P.p(x, h, 'void'); if (hash(x, 1) % 5 === 0) P.p(x, Math.floor(h / 2), 'ink3'); }
      s['crys'] = [] as [number, number][];
      for (let x = 12 + Math.floor(R() * 20); x < W - 12; x += 34 + Math.floor(R() * 40)) {
        const y = s['ceil'][x] - 2;
        s['crys'].push([x, y]);
        CRYS_ROWS.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') P.p(x - 4 + i, y + j, KEY[row[i]]); });
      }
      s['fy'] = H - Math.max(6, Math.floor(H * 0.1));
      for (let x = 0; x < W; x++) { const top = s['fy'] + Math.round(1.5 * Math.sin(x * 0.11)) + (hash(x >> 2, 3) % 2); P.r(x, top, 1, H - top, 'ink'); P.p(x, top, 'ink3'); }
      for (let y = s['fy'] + 3; y < H; y += 2) for (let x = (y * 5) % 11; x < W; x += 11 + (y % 5)) P.r(x, y, 3, 1, 'ac0');
    },
    init(s) {
      const R = rng(7);
      s['st'] = [];
      const n = Math.max(6, Math.floor((s.W * s.H / 170) * s.density));
      for (let i = 0; i < n; i++) {
        const x = 3 + Math.floor(R() * (s.W - 6)), y0 = (s['ceil'][x] || 8) + 5;
        s['st'].push({ x, y: y0 + Math.floor(R() * Math.max(4, s['fy'] - y0 - 6)), ph: Math.floor(R() * 80), per: 30 + Math.floor(R() * 50), big: R() < 0.12 });
      }
    },
    frame(P, s, t) {
      for (const k of s['st']) { const q = (t + k.ph) % k.per, st = q < 2 ? 1 : q < 4 ? 2 : q < 6 ? 1 : 0; sparkle(P, k.x, k.y, k.big ? Math.max(st, 1) : st); }
      (s['crys'] as [number, number][]).forEach(([x, y], i) => { const q = (t + i * 13) % 50; if (q < 6) sparkle(P, x - 1 + (i % 3), y + 8, q < 2 || q > 3 ? 1 : 2); });
      const q = t % 80;
      if (q < 16) {
        const x0 = 20 + ((Math.floor(t / 80) * 53) % Math.max(1, s.W - 60)), x = x0 + q * 2, y = 14 + q;
        P.p(x, y, 'white'); P.p(x - 1, y, 'ac4'); P.p(x - 2, y - 1, 'ac3'); P.p(x - 3, y - 1, 'ac2'); P.p(x - 5, y - 2, 'ac1');
      }
    },
  },
  leaf: {
    name: 'LEAFFALL', fps: 10,
    base(P, s) {
      const { W, H } = s;
      P.r(0, 0, W, H, 'sn0');
      for (let y = 0; y < H; y++) {
        const row = Math.floor(y / 6);
        for (let x = 0; x < W; x++) { const m = y % 6 === 5 || (x + (row & 1) * 7) % 14 === 0; if (!m) P.p(x, y, y % 6 === 0 && (x + (row & 1) * 7) % 14 === 1 ? 'sn2' : 'sn1'); }
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const b = x + y * 0.6 - W * 0.55; if (b > 0 && b < 26 && ((x + y) & 1) === 0 && y % 6 !== 5) P.p(x, y, 'sn2'); }
      P.dither(0, 0, W, 4, 'void', 0.5); P.dither(0, 4, W, 4, 'void', 0.25);
      for (let x = 0; x < W; x++) {
        const h = 3 + Math.round(3 * (0.5 + 0.5 * Math.sin(x * 0.09)) + 2 * (0.5 + 0.5 * Math.sin(x * 0.023 + 1)));
        for (let y = H - h; y < H; y++) { const v = hash(x, y, 2) % 6; P.p(x, y, y === H - h ? 'ac3' : v < 2 ? 'ac2' : v < 4 ? 'ac1' : 'ac0'); }
      }
    },
    init(s) {
      const R = rng(3);
      s['lv'] = [];
      const n = Math.max(3, Math.floor((s.W * s.H / 500) * s.density));
      for (let i = 0; i < n; i++) s['lv'].push({ x: R() * s.W, y: R() * s.H, v: 0.5 + R() * 0.8, ph: Math.floor(R() * 10), c: (['ac2', 'ac3', 'ac2', 'ac1'] as const)[i % 4] });
    },
    frame(P, s, t) {
      const sway = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1];
      for (const l of s['lv']) {
        l.y += l.v; const ph = (t + l.ph) % 10; l.x += sway[ph] * 0.6;
        if (l.y > s.H - 3) { l.y = -3; l.x = Math.random() * s.W; }
        const x = Math.floor(l.x), y = Math.floor(l.y);
        if ((t + l.ph) % 8 < 4) { P.p(x, y, l.c); P.p(x + 1, y, l.c); P.p(x + 1, y + 1, 'ac1'); P.p(x + 2, y + 1, l.c); }
        else { P.p(x, y + 1, l.c); P.p(x + 1, y + 1, 'ac1'); P.p(x + 1, y, l.c); P.p(x + 2, y, l.c); }
      }
    },
  },
  water: {
    name: 'WATERFALL', fps: 12,
    base(P, s) {
      const { W, H } = s;
      P.r(0, 0, W, H, 'void'); P.dither(0, 0, W, H, 'ink', 0.25);
      s['py'] = H - Math.max(10, Math.floor(H * 0.2));
      const R = rng(9);
      s['streams'] = [] as [number, number][];
      const n = Math.max(2, Math.min(6, Math.round(W / 110)));
      for (let i = 0; i < n; i++) { const w = 6 + Math.floor(R() * 7); s['streams'].push([Math.max(1, Math.floor((i + 0.5) * W / n - w / 2 + (R() - 0.5) * W / n * 0.4)), w]); }
      s['cliff'] = [] as number[];
      for (let x = 0; x < W; x++) s['cliff'].push(8 + Math.round(3 * Math.sin(x * 0.05) + 2 * Math.sin(x * 0.17)));
      for (const [x0, w] of s['streams']) for (let x = x0 - 2; x < x0 + w + 2; x++) if (x >= 0 && x < W) s['cliff'][x] = Math.min(s['cliff'][x], 7);
      for (let x = 0; x < W; x++) { const c = s['cliff'][x]; P.r(x, 0, 1, c, 'ink2'); P.p(x, c - 1, 'ink3'); P.p(x, c, 'void'); }
      for (const [x0, w] of s['streams']) { P.r(x0 - 1, s['cliff'][x0], 1, s['py'] - s['cliff'][x0], 'ink2'); P.r(x0 + w, s['cliff'][x0], 1, s['py'] - s['cliff'][x0], 'ink2'); }
      P.r(0, s['py'], W, H - s['py'], 'ac0'); P.r(0, s['py'], W, 1, 'ac2'); P.dither(0, s['py'] + 1, W, 3, 'ac1', 0.5);
      s['fl'] = [] as number[];
      for (let x = 10 + Math.floor(R() * 20); x < W - 8; x += 30 + Math.floor(R() * 50)) {
        if ((s['streams'] as [number, number][]).some(([a, w]) => x > a - 6 && x < a + w + 6)) continue;
        s['fl'].push(x); P.r(x, s['py'] - 5, 1, 5, 'ac1'); P.p(x - 1, s['py'] - 3, 'ac1');
      }
    },
    init(s) {
      const R = rng(4);
      s['sh'] = [];
      const n = Math.max(2, Math.floor((s.W * (s.H - s['py']) / 120) * s.density));
      for (let i = 0; i < n; i++) s['sh'].push({ x: R() * s.W, y: s['py'] + 4 + Math.floor(R() * Math.max(1, s.H - s['py'] - 5)), l: 2 + Math.floor(R() * 6), d: R() < 0.5 ? -1 : 1 });
    },
    frame(P, s, t) {
      for (const [x0, w] of s['streams'] as [number, number][]) {
        const top = s['cliff'][x0];
        for (let y = top; y < s['py']; y++) for (let x = x0; x < x0 + w; x++) { const q = (((y - t * 2 + (x - x0) * 5) % 11) + 11) % 11; P.p(x, y, x === x0 ? 'ac3' : q < 2 ? 'ac4' : q < 4 ? 'ac3' : q < 7 ? 'ac2' : 'ac1'); }
        for (let i = 0; i < w + 4; i++) { const h = hash(i, t, x0) % 5; if (h < 2) P.p(x0 - 2 + i, s['py'] - 1 - (hash(i, t) % 3), h ? 'white' : 'ac4'); }
        P.dither(x0 - 3, s['py'] + 1, w + 6, 2, 'ac3', 0.5);
      }
      for (const k of s['sh']) { const x = Math.floor((k.x + t * 0.5 * k.d + s.W * 10) % s.W); P.r(x, k.y, k.l, 1, k.l > 5 ? 'ac3' : 'ac2'); }
      (s['fl'] as number[]).forEach((x, i) => { const on = (t + i * 7) % 30 < 15; P.p(x, s['py'] - 6, on ? 'white' : 'ac3'); P.p(x - 1, s['py'] - 6, 'ac3'); P.p(x + 1, s['py'] - 6, 'ac3'); P.p(x, s['py'] - 7, 'ac2'); });
    },
  },
  snow: {
    name: 'SNOWFALL', fps: 10,
    base(P, s) {
      const { W, H } = s;
      P.r(0, 0, W, H, 'void');
      s['gy'] = H - Math.max(6, Math.floor(H * 0.12));
      const hz = s['gy'] - Math.min(130, Math.floor(H * 0.42));
      P.dither(0, hz - 14, W, 7, 'ac0', 0.25); P.dither(0, hz - 7, W, 7, 'ac0', 0.5); P.r(0, hz, W, s['gy'] - hz, 'ac0');
      const R = rng(21);
      for (let x = 0; x < W; x++) { const m = Math.round((10 + 8 * Math.sin(x * 0.03) + 5 * Math.sin(x * 0.071 + 2)) * Math.max(1, H / 220)); const top = hz + 20 - m; P.r(x, top, 1, s['gy'] - top, 'ac1'); if (m > 15) P.p(x, top, 'fr0'); }
      const tree = (x: number, base: number, h: number, body: 'ink' | 'ink2', side: 'void' | 'ink') => {
        const tiers = Math.max(2, Math.floor(h / 7));
        P.r(x, base - 3, 2, 3, 'wd0');
        for (let k = 0; k < tiers; k++) for (let y = 0; y < 8; y++) {
          const yy = base - 3 - (tiers - k) * 7 + y, hw = 1 + Math.floor(y * 0.9) + k;
          P.r(x + 1 - hw, yy, hw * 2, 1, body); P.r(x + 1, yy, hw, 1, side);
          if (y === 0) P.r(x + 1 - hw, yy, hw * 2, 1, 'fr1'); else if (y < 3) { P.p(x + 1 - hw, yy, 'white'); P.p(x - hw + 2, yy, 'fr1'); }
        }
      };
      for (let x = Math.floor(R() * 8); x < W; x += 9 + Math.floor(R() * 14)) tree(x, s['gy'] - 1, 14 + Math.floor(R() * 10 + H * 0.03), 'ink', 'void');
      for (let x = Math.floor(R() * 20); x < W; x += 22 + Math.floor(R() * 34)) tree(x, s['gy'] + 2, 22 + Math.floor(R() * 22 + H * 0.06), 'ink2', 'ink');
      P.r(0, s['gy'], W, H - s['gy'], 'fr1'); P.r(0, s['gy'], W, 1, 'white'); P.dither(0, s['gy'] + 3, W, H - s['gy'] - 3, 'fr0', 0.25);
      s['wire'] = [] as number[];
      for (let x = 0; x < W; x++) { const y = 5 + Math.round(4 * Math.sin(Math.PI * ((x % 60) / 60))); s['wire'].push(y); P.p(x, y, 'ink3'); }
    },
    init(s) {
      const R = rng(2);
      s['fl'] = [];
      const n = Math.max(5, Math.floor((s.W * s.H / 140) * s.density));
      for (let i = 0; i < n; i++) s['fl'].push({ x: R() * s.W, y: R() * s.H, v: 0.3 + R() * 0.8, big: R() < 0.2, ph: Math.floor(R() * 12) });
    },
    frame(P, s, t) {
      for (let x = 6; x < s.W; x += 10) { const on = ((x / 10) | 0) + ((t / 5) | 0); P.p(x, s['wire'][x] + 1, on % 2 ? 'ac3' : 'ac1'); P.p(x, s['wire'][x] + 2, on % 2 ? 'ac2' : 'ac0'); }
      const drift = [0, 0, 1, 0, 0, -1];
      for (const f of s['fl']) {
        f.y += f.v; f.x += drift[(t + f.ph) % 6] * 0.5;
        if (f.y > s['gy']) { f.y = -2; f.x = Math.random() * s.W; }
        const x = Math.floor(f.x), y = Math.floor(f.y);
        if (f.big) { P.p(x, y, 'white'); P.p(x + 1, y, 'fr1'); P.p(x, y + 1, 'fr1'); P.p(x + 1, y + 1, 'fr0'); } else P.p(x, y, f.v > 0.8 ? 'white' : 'fr0');
      }
    },
  },
  floor: {
    name: 'PUZZLE FLOOR', fps: 8,
    base(P, s) {
      const { W, H } = s, T = 12;
      P.r(0, 0, W, H, 'void');
      s['T'] = T;
      for (let j = 0; j * T < H; j++) for (let i = 0; i * T < W; i++) {
        const x = i * T, y = j * T, a = (i + j) & 1;
        P.r(x + 1, y + 1, T - 1, T - 1, a ? 'sn1' : 'sn2'); P.r(x + 1, y + 1, T - 1, 1, a ? 'sn2' : 'sn3'); P.r(x + 1, y + 1, 1, T - 1, a ? 'sn2' : 'sn3');
        P.r(x + 1, y + T - 1, T - 1, 1, 'sn0'); P.r(x + T - 1, y + 1, 1, T - 1, 'sn0');
        if (hash(i, j) % 11 === 0) { P.r(x + 4, y + 4, 4, 4, 'sn0'); P.r(x + 5, y + 5, 2, 2, a ? 'sn2' : 'sn3'); }
      }
    },
    init() {},
    frame(P, s, t) {
      const T = s['T'];
      for (let j = 0; j * T < s.H; j++) for (let i = 0; i * T < s.W; i++) {
        const dd = (((i + j - Math.floor(t / 2)) % 24) + 24) % 24;
        if (dd > 2) continue;
        const x = i * T, y = j * T;
        const k = (dd === 0 ? ['ac2', 'ac4', 'ac1'] : dd === 1 ? ['ac1', 'ac3', 'ac0'] : ['ac0', 'ac1', 'void']) as ['ac2', 'ac4', 'ac1'];
        P.r(x + 1, y + 1, T - 1, T - 1, k[0]); P.r(x + 1, y + 1, T - 1, 1, k[1]); P.r(x + 1, y + 1, 1, T - 1, k[1]);
        P.r(x + 1, y + T - 1, T - 1, 1, k[2]); P.r(x + T - 1, y + 1, 1, T - 1, k[2]);
        if (dd === 0) { P.r(x + 4, y + 4, 4, 4, 'ac3'); P.r(x + 5, y + 5, 2, 2, 'white'); }
      }
    },
  },
  core: {
    name: 'CORE PULSE', fps: 12,
    base(P, s) {
      const { W, H } = s;
      P.r(0, 0, W, H, 'mt0');
      for (let x = 0; x < W; x += 8) P.r(x, 0, 1, H, 'mt1');
      for (let y = 0; y < H; y += 8) P.r(0, y, W, 1, 'mt1');
      for (let x = 0; x < W; x += 8) for (let y = 0; y < H; y += 8) P.p(x + 1, y + 1, 'mt2');
      const mh = Math.max(24, Math.min(64, Math.floor(H * 0.46)));
      s['my0'] = Math.floor(H * 0.48 - mh / 2); s['my1'] = s['my0'] + mh;
      P.r(0, s['my0'] - 2, W, mh + 4, 'void'); P.r(0, s['my0'] - 2, W, 1, 'mt2'); P.r(0, s['my1'] + 1, W, 1, 'mt2');
      for (let x = 2; x < W; x += 4) for (let y = s['my0'] + 1; y < s['my1']; y += 4) P.p(x, y, 'ac0');
      s['cy'] = Math.floor((s['my0'] + s['my1']) / 2);
      const pipe = (y: number) => {
        P.r(0, y, W, 1, 'mt3'); P.r(0, y + 1, W, 2, 'mt2'); P.r(0, y + 3, W, 1, 'void');
        for (let x = 20; x < W; x += 48) { P.r(x, y - 1, 4, 6, 'void'); P.r(x, y - 1, 4, 1, 'mt3'); P.r(x, y, 4, 4, 'mt2'); P.p(x + 1, y + 1, 'white'); }
      };
      s['p0'] = s['my0'] - 12; s['p1'] = s['my1'] + 8;
      if (s['p0'] > 3) pipe(s['p0']);
      if (s['p1'] < H - 10) pipe(s['p1']);
      P.r(0, H - 5, W, 5, 'ink2'); P.r(0, H - 5, W, 1, 'mt1');
    },
    init(s) { s['steam'] = []; },
    frame(P, s, t) {
      const W = s.W, head = (t * 3) % (W + 40), amp = Math.max(4, Math.floor((s['my1'] - s['my0']) * 0.42));
      const wave = (x: number) => { const p = ((x % 64) + 64) % 64; if (p >= 8 && p < 12) return -2; if (p === 20 || p === 21) return 2; if (p === 22 || p === 23) return -amp; if (p === 24 || p === 25) return Math.round(amp * 0.45); if (p >= 36 && p < 44) return -3; return 0; };
      let px0: number | null = null, py0 = 0;
      for (let x = Math.max(0, head - 160); x <= Math.min(W - 1, head); x++) {
        const age = head - x, y = s['cy'] + wave(x), k = age < 6 ? 'white' : age < 34 ? 'ac3' : age < 90 ? 'ac2' : 'ac1';
        if (px0 !== null) P.line(px0, py0, x, y, k); else P.p(x, y, k);
        px0 = x; py0 = y;
      }
      if (head < W) P.r(head, s['cy'] + wave(head) - 1, 2, 3, 'white');
      for (let x = 44, i = 0; x < W; x += 48, i++) { const on = (i + ((t / 6) | 0)) % 3 === 0; if (s['p1'] < s.H - 10) { P.r(x, s['p1'] + 6, 2, 2, on ? 'ac3' : 'ac0'); if (on) P.p(x, s['p1'] + 6, 'white'); } }
      for (let x = (t % 8) - 8; x < W; x += 8) { P.p(x + 2, s.H - 3, 'ac2'); P.p(x + 3, s.H - 2, 'ac2'); P.p(x + 2, s.H - 1, 'ac2'); }
      if (t % 5 === 0 && s['p0'] > 3) s['steam'].push({ x: 21 + 48 * (hash(t, 3) % Math.max(1, Math.floor((W - 20) / 48))), y: s['p0'] - 2, a: 0 });
      s['steam'] = s['steam'].filter((p: { a: number }) => p.a < 10);
      for (const p of s['steam']) {
        p.a++; p.y -= 0.8;
        const k = p.a < 4 ? 'fr1' : p.a < 7 ? 'fr0' : 'mt2', x = Math.floor(p.x + (p.a % 4 < 2 ? 0 : 1)), y = Math.floor(p.y);
        P.p(x, y, k); if (p.a < 7) { P.p(x + 1, y, k); P.p(x + 1, y + 1, 'mt3'); }
      }
    },
  },
  echo: {
    name: 'ECHO RIPPLES', fps: 10,
    base(P, s) {
      const { W, H } = s;
      P.r(0, 0, W, H, 'void');
      for (let y = 0; y < H; y += 3) P.dither(0, y, W, 1, 'ac0', y % 6 ? 0.25 : 0.5);
      const R = rng(13);
      s['fl'] = [];
      const n = Math.max(1, Math.floor((W * H / 2600) * s.density));
      for (let i = 0; i < n; i++) s['fl'].push({ x: 8 + Math.floor(R() * (W - 16)), y: 10 + Math.floor(R() * (H - 18)), off: Math.floor(R() * 40) });
      for (const f of s['fl']) { P.r(f.x, f.y + 1, 1, 4, 'ac1'); P.p(f.x - 1, f.y + 3, 'ac1'); }
    },
    init() {},
    frame(P, s, t) {
      const circ = (cx: number, cy: number, r: number, k: 'ac3' | 'ac2' | 'ac1', dash: boolean) => {
        let x = r, y = 0, e = 1 - r, i = 0;
        while (x >= y) {
          for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) if (!dash || i++ & 1) P.p(cx + a, cy + Math.round(b * 0.55), k);
          y++;
          if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
        }
      };
      for (const f of s['fl']) {
        for (const lag of [0, 14]) { const r = (t + f.off + lag) % 42; if (r > 1 && r < 34) circ(f.x, f.y + 2, r, r < 8 ? 'ac3' : r < 18 ? 'ac2' : 'ac1', r >= 18); }
        const on = (t + f.off) % 42 < 4;
        P.p(f.x, f.y, on ? 'white' : 'ac3'); P.p(f.x - 1, f.y, 'ac2'); P.p(f.x + 1, f.y, 'ac2'); P.p(f.x, f.y - 1, 'ac2');
      }
    },
  },
};

/** Which generic pattern each scene stands in for, and which of its settings it reads. */
export const SCENE_FOR: Record<string, { scene: string; color: string; count?: string; countDefault?: number; speedDefault: number; opacityDefault: number }> = {
  bouncing_diamonds: { scene: 'wish', color: 'color', count: 'count', countDefault: 8, speedDefault: 0.8, opacityDefault: 0.25 },
  falling_pixels: { scene: 'leaf', color: 'color', count: 'count', countDefault: 60, speedDefault: 2, opacityDefault: 0.25 },
  scrolling_lines: { scene: 'water', color: 'color', speedDefault: 1, opacityDefault: 0.2 },
  matrix_rain: { scene: 'snow', color: 'color', count: 'density', countDefault: 12, speedDefault: 1.5, opacityDefault: 0.3 },
  checkerboard: { scene: 'floor', color: 'color1', speedDefault: 0.5, opacityDefault: 0.3 },
  heartbeat: { scene: 'core', color: 'color', speedDefault: 80, opacityDefault: 0.4 },
  pulse_rings: { scene: 'echo', color: 'color', count: 'count', countDefault: 4, speedDefault: 0.8, opacityDefault: 0.2 },
};

/** The palette a scene paints with: the fixed colours and the ramps of its own colour. */
export function sceneColours(hex: string | undefined): Colours {
  const r = ramp(hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ff8000');
  return { ...FIXED, ac0: r.ac0, ac1: r.ac1, ac2: r.ac2, ac3: r.ac3, ac4: r.ac4, sn0: r.sn0, sn1: r.sn1, sn2: r.sn2, sn3: r.sn3 } as Colours;
}

/**
 * A running scene on a canvas of W x H art pixels: paints the base once,
 * then frame(t) redraws the moving layer for tick t.
 */
export class SceneRun {
  readonly s: SceneState;
  private readonly base: Painter;
  private readonly out: Painter;

  constructor(cv: HTMLCanvasElement, readonly def: SceneDef, colours: Colours, density: number) {
    const W = cv.width, H = cv.height;
    this.s = { W, H, density };
    this.base = new Painter(canvas(W, H), colours);
    this.out = new Painter(cv, colours);
    def.base(this.base, this.s);
    def.init(this.s);
  }

  frame(t: number): void {
    this.out.x.clearRect(0, 0, this.s.W, this.s.H);
    this.out.x.drawImage(this.base.c, 0, 0);
    this.def.frame(this.out, this.s, t);
  }
}
