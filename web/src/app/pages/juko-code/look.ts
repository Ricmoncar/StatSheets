// JUKO! · THE CODE GARDEN: the palette, the words, the timeline of the 0∞
// breakdown, and Juko herself (the chibi cat that is the cursor).
//
// THE CLAIM. A programmer's garden at night: an editor-dark green field with
// code raining down it, tickers scrolling behind, little snippets surfacing
// and fading, warm bokeh drifting up, all of it moving to her song. In "0∞"
// the program has crashed into an infinite loop: a 22-second intro (the song's
// intro) builds the corruption up, and on the drop it tears the garden, and
// then the whole app, apart. Green is hers; red and white are only ever the
// glitch.
import { Character } from '../../core/data/models';
import { Raster, bayer } from '../raster';
import { activeFormName, pageCharacter } from '../host';
import { palette } from '../kit/palette';
import { SongPulse } from '../kit/music';

export const P = palette({
  // the editor-dark ground, void to garden
  k: ['#000000', '#030805', '#08130c', '#0c1c12', '#122a1a'],
  // the rain's green, tail to head
  g: ['#0c2a14', '#13401e', '#1c5c2c', '#26803c', '#30a24c', '#3cc85c', '#68dc78', '#9cf094', '#cdfac2', '#eaffe4'],
  // her light yellow (keywords, the warm heads)
  y: ['#3c4414', '#66721e', '#9aa63a', '#d0dc64', '#e8f094', '#f7fccd'],
  // the crash's acid lime, and white
  a: ['#3a7a14', '#6ee030', '#9bff3a', '#d2ff9a', '#ffffff'],
  // the ghosts: cyan and lime
  c: ['#0e4a58', '#2fb6d0', '#5aecff', '#bff7ff'],
  l: ['#3c6a14', '#86d038', '#baff60', '#e4ffb8'],
  // Juko: her greens, the dark of her face, ears, headphones, gold glasses, blush
  j: ['#12331c', '#1f5a30', '#2b8642', '#3fb257', '#62d273', '#8fe49a'],
  h: ['#141814', '#1c211b', '#23291f', '#2b332c', '#3a4530'],
  e: ['#143a20', '#f4fff0', '#e7ec88', '#d9b347', '#ff9aa6', '#cfe96a'],
  // the equalizer, dark base to light-yellow tips, and in the crash (acid to white)
  q: ['#06301a', '#0f5a28', '#1c9c3d', '#38c844', '#5cef4a', '#a4f77d', '#eaffb0'],
  z: ['#04220e', '#178a2c', '#2ad14a', '#5ce852', '#8dff5a', '#c0ffa4', '#f2fff0'],
  // the border that breaks out of the 0∞ vignette, green to yellow
  o: ['#4ade5a', '#72e670', '#9aee86', '#c2f79a', '#eaffb0'],
  // static
  n: ['#2e322e', '#5e625e', '#8e928e', '#c4c8c4'],
});
export const C = P.C;
export const DN = P.shiftMap(-1), UP = P.shiftMap(1);
/** How light each index is (0..255), for effects that keep the lighter of two pixels. */
export const LUM = Uint8Array.from(P.hex, h => (h ? Math.round(parseInt(h.slice(1, 3), 16) * 0.3 + parseInt(h.slice(3, 5), 16) * 0.59 + parseInt(h.slice(5, 7), 16) * 0.11) : 0));

export const RAIN = '01{}()<>[];=+*/&|!?:.#%abcdefijklmnoprstuvwxyz01'.split('');
export const RAIN_CHAOS = '0∞0∞0∞18X#%¤×÷≠¿?!∞0{}<>[]()∞0'.split('');
export const ERRORS = [
  'RangeError: 0 / ∞', 'STACK OVERFLOW', 'while(true){ }', 'SEGFAULT 0x00',
  'NaN', 'undefined is not a function', 'HEAP CORRUPTED', '∞ != ∞',
  'FATAL: loop unbounded', 'MEMORY LEAK 0x∞', 'core dumped', 'return 0;// ∞',
  'ERR_INFINITE_RECURSION', 'kernel panic', 'null → ∞', 'SIGKILL',
];
export const TOKENS = ['{', '}', ';', '<', '>', '/', '=', '(', ')', '[', ']', '*', '+', '&&', '=>', '!', '0', '1', 'fn', '//'];
export const SNIPPETS = [
  'function fun(){', 'return joy;', 'while(alive){', 'let dream = 1;', 'console.log("hi!")', 'if(bug) fix();', 'juko.code()',
  '=> { play() }', 'for(;;) dance;', 'const win = true;', 'npm run fun', 'git push origin', 'sudo make coffee', '0xC0DE',
  '} // :3', 'await snack()', 'render(<Joy/>)', 'while(true) vibe;', 'let x = 42;', 'export default me;',
];
export const pick = <T>(a: readonly T[]) => a[(Math.random() * a.length) | 0];

// ── who, and which song ──
const JUKO = /^Juko!?$/i, INF = /0\s*.?\s*∞|infinity/i, ONE = /^\s*1\s*$/;
export const isJuko = (c: Character | null | undefined) => !!c && JUKO.test(c.name || '');
export const isJuko0Inf = (c: Character | null | undefined) => isJuko(c) && INF.test(activeFormName(c));
/** "1", the form that has a page of its own. */
export const isJuko1 = (c: Character | null | undefined) => isJuko(c) && ONE.test(activeFormName(c));
export const SONG = 'sounds/juko.mp3', SONG_0INF = 'sounds/juko-0inf.mp3', SONG_1 = 'sounds/juko-1.mp3';

/** What both layers share: the song, and where the 0∞ breakdown is. */
export const J = {
  song: new SongPulse(),
  /** In 0∞; seconds into it, how bad it is (0..1), and whether the drop has come. */
  chaos: false, el: 0, sev: 0, dropped: false,
  /** performance.now() at the 0∞ entry (the clock when the song is not playing), and how many entries so far. */
  entry: 0, run: 0, anchored: false,
  sampled: 0,
  /** Seconds skipped ahead (the tests jump to the drop; the song's own clock would otherwise hold them back). */
  skip: 0,
};
/** The page has started: whatever form she is in now is a fresh entry. */
export function restart(): void { J.chaos = false; J.entry = 0; J.sampled = 0; J.skip = 0; }
/**
 * Once a frame, from whichever layer draws first: which form she is in (a 0∞
 * entry starts its clock), the song, and where the breakdown is.
 */
export function sync(): void {
  const now = performance.now();
  if (J.sampled && now - J.sampled < 12) return;
  const dt = J.sampled ? Math.min(0.1, (now - J.sampled) / 1000) : 1 / 30;
  J.sampled = now;
  const chaos = isJuko0Inf(pageCharacter.c);
  if (chaos && !J.chaos) { J.entry = now; J.run++; J.anchored = false; J.skip = 0; }
  if (!chaos) J.entry = 0;
  J.chaos = chaos;
  J.song.follow(chaos ? SONG_0INF : isJuko1(pageCharacter.c) ? SONG_1 : SONG);
  J.song.sample(dt);
  J.el = chaos ? elapsed() + J.skip : 0;
  J.sev = chaos ? sevAt(J.el) : 0;
  J.dropped = chaos && J.el >= INTRO;
}
/** The 22-second intro: synced to the song's own clock once the 0∞ track is seen playing from the top. */
export const INTRO = 22;
export function elapsed(): number {
  const wall = J.entry ? (performance.now() - J.entry) / 1000 : 0;
  const st = J.song.time();
  if (st !== null && J.song.isPlaying(SONG_0INF)) {
    if (!J.anchored && Math.abs(st - wall) < 2.5) J.anchored = true;
    if (J.anchored && st > 0.05) return st;
  }
  return wall;
}
/** Severity: eases to 0.55 across the intro, then to 1 over the six seconds after the drop. */
export const sevAt = (e: number) => (e < INTRO ? (e / INTRO) ** 2 * 0.55 : Math.min(1, 0.55 + ((e - INTRO) / 6) * 0.45));

// ── Juko: green cat head, gold glasses, headphones, a code-cable tail ──
export interface CatState { vx: number; vy: number; bounce: number; happy: number }

/**
 * Juko at (x, y) in the raster (art pixels; `s` art pixels to her unit):
 * her tail (a glowing data cable that curls when she is still and trails when
 * she moves, tipped with a plug whose LED swells with the song), her ears, her
 * head, the headphones with their beat LEDs, the eyes (blinking, looking where
 * she goes, ^^ when happy), the glasses, the cat mouth and, after a click, a
 * blush. Squashes on a bounce, bobs, leans into her motion.
 */
export function drawCat(r: Raster, x: number, y: number, s: number, t: number, st: CatState, level: number, onset: number): void {
  const b = st.bounce, sq = b > 0 ? Math.sin(b * Math.PI * 3) * b * 0.4 : 0;
  const sX = 1 + sq * 0.3, sY = 1 - sq * 0.4, lean = Math.max(-0.26, Math.min(0.26, st.vx / 900));
  const happy = Math.min(1, st.happy), cyc = t % 3.4, blink = cyc < 0.16 ? 1 - Math.abs(cyc - 0.08) / 0.08 : 0;
  const cy0 = y + Math.sin(t * 2.6) * 2.6 * s, cl = Math.cos(lean), sl = Math.sin(lean);
  // her frame: u right, v down, scaled and leaning
  const at = (u: number, v: number): [number, number] => { const uu = u * sX * s, vv = v * sY * s; return [x + uu * cl - vv * sl, cy0 + uu * sl + vv * cl]; };
  const local = (px: number, py: number): [number, number] => { const dx = px + 0.5 - x, dy = py + 0.5 - cy0; return [(dx * cl + dy * sl) / (sX * s), (-dx * sl + dy * cl) / (sY * s)]; };
  const fill = (u0: number, v0: number, u1: number, v1: number, f: (u: number, v: number, px: number, py: number) => number) => {
    const c = [at(u0, v0), at(u1, v0), at(u0, v1), at(u1, v1)];
    const xs = c.map(p => p[0]), ys = c.map(p => p[1]);
    for (let py = Math.floor(Math.min(...ys)); py <= Math.ceil(Math.max(...ys)); py++) for (let px = Math.floor(Math.min(...xs)); px <= Math.ceil(Math.max(...xs)); px++) {
      const [u, v] = local(px, py), i = f(u, v, px, py);
      if (i) r.set(px, py, i);
    }
  };
  const R = 20, eyeOX = 8.5, eyeY = -1.5, eyeR = 6.6;
  // the tail: a cable that curls up idle and trails out behind motion
  {
    const spd = Math.hypot(st.vx, st.vy), vf = Math.min(1, spd / 340), bend = Math.max(-1, Math.min(1, -st.vx / 280));
    let pu = -bend * 2, pv = R * 0.86, ang = Math.PI * 0.5 + bend * 0.55;
    const pts: [number, number][] = [at(pu, pv)];
    for (let i = 1; i <= 11; i++) {
      const f = i / 11;
      ang += 0.3 * (1 - vf) + bend * 0.18 * f + Math.sin(t * 4.2 + i * 0.7) * (0.1 + 0.06 * f) * (0.5 + vf * 0.8 + level * 0.7);
      pu += Math.cos(ang) * 5.6; pv += Math.sin(ang) * 5.6;
      pts.push(at(pu, pv));
    }
    for (let i = 1; i < pts.length; i++) {
      const f = i / pts.length, c = f < 0.3 ? C['g3'] : f < 0.6 ? C['g4'] : f < 0.85 ? C['g5'] : C['g6'];
      r.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c);
      if (f < 0.5) r.line(pts[i - 1][0] + 1, pts[i - 1][1], pts[i][0] + 1, pts[i][1], C['g2']);
    }
    // the plug and its LED
    const [tx, ty] = pts[pts.length - 1];
    r.rect(tx - 1, ty - 1, 2, 2, C['h3']);
    const led = Math.min(1, 0.32 + level + onset * 0.8);
    r.set(tx, ty, led > 0.6 ? C['y5'] : C['y3']);
    if (led > 0.75) { r.set(tx + 1, ty, C['y3']); r.set(tx, ty - 1, C['y3']); }
  }
  // the ears, behind the head: green, yellow inside
  for (const sd of [-1, 1]) {
    const outer = [[sd * 4, -R * 0.8], [sd * 23, -R * 2.14], [sd * 26, -R * 0.4]], inner = [[sd * 8, -R * 0.86], [sd * 20, -R * 1.8], [sd * 22, -R * 0.52]];
    r.poly(outer.flatMap(([u, v]) => at(u, v)), C['j2']);
    r.poly(inner.flatMap(([u, v]) => at(u, v)), C['e2']);
  }
  // the head, lit from the top left, and its outline
  fill(-R - 1, -R - 1, R + 1, R + 1, (u, v, px, py) => {
    const d = Math.hypot(u, v);
    if (d > R) return 0;
    if (d > R - 1.2 / s) return C['j0'];
    const l = Math.hypot(u + R * 0.32, v + R * 0.4) / (R * 1.3);
    return l < 0.35 ? C['j4'] : l < 0.62 ? (l - 0.35 > bayer(px, py) * 0.27 ? C['j3'] : C['j4']) : l < 0.9 ? C['j3'] : C['j2'];
  });
  // the headphones: the band over the top, its highlight, and the cups with their beat LEDs
  fill(-R - 7, -R - 7, R + 7, 4, (u, v) => { const d = Math.hypot(u, v - 1); return v < 1 && d > R + 2 && d < R + 6 ? (d > R + 5 ? C['e2'] : C['h3']) : 0; });
  const glow = Math.min(1, level + onset * 0.6);
  for (const sd of [-1, 1]) {
    const cu = sd * (R + 3.5), cv = 4;
    fill(cu - 7, cv - 11, cu + 7, cv + 11, (u, v) => {
      const e = ((u - cu) / 6.6) ** 2 + ((v - cv) / 10) ** 2;
      if (e > 1) return 0;
      const ring = ((u - cu) / 3.6) ** 2 + ((v - cv) / 6) ** 2;
      return ring > 0.6 && ring < 1.25 + glow * 0.6 ? (glow > 0.5 ? C['y4'] : C['e5']) : e > 0.8 ? C['h4'] : C['h2'];
    });
  }
  // the eyes: open (with pupils that look about, or where she is going), blinking, or ^^ when happy
  const spd = Math.hypot(st.vx, st.vy), vf = Math.min(1, spd / 300);
  for (const sd of [-1, 1]) {
    const ex = sd * eyeOX;
    if (happy > 0.1) {
      for (let a = 1.18; a <= 1.82; a += 0.08) { const [px, py] = at(ex + Math.cos(Math.PI * a) * eyeR * 0.95, eyeY + 2 + Math.sin(Math.PI * a) * eyeR * 0.95); r.set(px, py, C['j0']); }
      continue;
    }
    const sy = 1 - blink * 0.85;
    let pdx = Math.sin(t * 1.2 + sd * 0.8) * eyeR * 0.32 * (1 - vf), pdy = Math.cos(t * 0.9 + sd * 1.2) * eyeR * 0.32 * (1 - vf);
    if (spd > 8) { pdx += (st.vx / spd) * eyeR * 0.42 * vf; pdy += (st.vy / spd) * eyeR * 0.42 * vf; }
    const pd = Math.hypot(pdx, pdy), mx = eyeR * 0.42;
    if (pd > mx) { pdx *= mx / pd; pdy *= mx / pd; }
    fill(ex - eyeR - 1, eyeY - eyeR - 1, ex + eyeR + 1, eyeY + eyeR + 1, (u, v) => {
      const du = u - ex, dv = (v - eyeY) / sy;
      if (du * du + dv * dv > eyeR * eyeR) return 0;
      const pu = du - pdx, pv = dv - pdy;
      if (Math.hypot(pu + eyeR * 0.18, pv + eyeR * 0.2) < eyeR * 0.24) return C['e1'];
      return Math.hypot(pu, pv) < eyeR * 0.55 ? C['e0'] : C['e1'];
    });
  }
  // the glasses: gold rings round the eyes, the bridge and the arms
  fill(-R, eyeY - eyeR - 4, R, eyeY + eyeR + 4, (u, v) => {
    for (const sd of [-1, 1]) { const d = Math.hypot(u - sd * eyeOX, v - eyeY); if (d > eyeR + 1.6 && d < eyeR + 1.6 + 1.4 / s) return C['e3']; }
    if (Math.abs(v - eyeY) < 0.7 / s && (Math.abs(u) < eyeOX - eyeR - 1 || (Math.abs(u) > eyeOX + eyeR + 2.4 && Math.abs(u) < R - 1))) return C['e3'];
    return 0;
  });
  // the cat mouth (wider when happy)
  const my = eyeY + eyeR + 5.5, mw = 4 + happy * 2;
  let lx: number | null = null, ly = 0;
  for (let k = 0; k <= 8; k++) {
    const f = k / 8, u = -mw + f * mw * 2, v = my + Math.abs(Math.sin(f * Math.PI * 2)) * (3 + happy * 1.5);
    const [px, py] = at(u, v);
    if (lx !== null) r.line(lx, ly, px, py, C['j0']);
    lx = px; ly = py;
  }
  // and the blush after a click
  if (happy > 0) for (const sd of [-1, 1]) fill(sd * (eyeOX + 5) - 5, eyeY + 3, sd * (eyeOX + 5) + 5, eyeY + 9, (u, v, px, py) => (((u - sd * (eyeOX + 5)) / 4.6) ** 2 + ((v - eyeY - 6) / 2.8) ** 2 <= 1 && happy * 0.9 > bayer(px, py) ? C['e4'] : 0));
}
