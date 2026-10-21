// @ts-nocheck
// IVY · EVIL CREATURE, ported from the old site's script.js (the IVY · EVIL
// CREATURE section), the drawing code unchanged. Every change is marked
// [port]; the rest is the original, so the two can be compared line for line.
// What it reached for outside itself (the active form, the layout cache, the
// page canvas, the interface it tears) comes from ../host.
import {
  activeFormName as _activeFormName, lyRect as _lyRect, lyGen as _lyGen,
  worldCanvas as _worldCanvas, interfaceTargets as _interfaceTargets, isInteractive as _isInteractive,
} from '../host';

// ════════════════════════════════════════════════════════════════
// IVY · EVIL CREATURE
//
// THE CLAIM. A rococo ballroom that has been bled into. Everything
// in it was gilt once and every bit of that gold has gone over to
// arterial red; the chandelier still burns but it burns red and it
// drips; the lacquer floor still takes a perfect reflection and
// what it reflects is a room with something loose in it. Dark
// elegance on top, bloodthirst underneath, and the second one is
// winning.
//
// ONE LIGHT. The chandelier, high and right of centre, burning red.
// It is the only light in the hall, so every rim, every reflection
// and every shadow is computed from that one point, and when it
// swings the whole room's lighting swings with it.
//
// TWO COLOURS AND A THIRD FOR CUTTING. Black and red, five values
// of red from clotted to arterial, and pure white used ONLY for an
// edge that is about to open something: the keys, the pearls, the
// blade. White is the most violent thing available in a red room
// and it is spent carefully.
//
// EVERY ORNAMENT IS ONE SHAPE. Rococo is C scrolls and acanthus
// and nothing else, so there is one scroll primitive here and the
// whole page is built out of it: the vault ribs, the mirror frame,
// the chandelier arms, the ornament in the corners of the window,
// and the guard of the rapier you are holding.
//
// PIXELS. Like Juko's "1", both layers are drawn into a buffer
// about a quarter of the size with the world transform scaled to
// match, so all the geometry stays in real coordinates, and blitted
// up with smoothing off. The baked sheets are ordered-dithered,
// which is where most of the pixel-art character comes from: the
// banding in a dark red gradient is going to be visible at this bit
// depth whatever happens, so it may as well be deliberate.
// ════════════════════════════════════════════════════════════════
const _IVY_RE = /^\s*ivy\s*$/i;
function _isIvy(c) { return !!(c && c.name && _IVY_RE.test(c.name)); }
const _IVY_EVIL_RE = /evil/i;
function _isIvyEvil(c) { return !!(_isIvy(c) && _IVY_EVIL_RE.test(_activeFormName(c))); }

function _ivRnd(i) { const x = Math.sin(i * 91.7 + 47.13) * 43758.5453; return x - Math.floor(x); }

let _ivRM = false;
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  _ivRM = !!mq.matches;
  if (mq.addEventListener) mq.addEventListener('change', e => { _ivRM = !!e.matches; });
}

// ── PERF: interned colour ramps. Nothing on this page ever builds an
//    `rgba(...)` string in a loop. ──
const _IV_STEPS = 24;
function _ivRamp(rgb) {
  const p = rgb.split(','), a = new Array(_IV_STEPS + 1);
  for (let i = 0; i <= _IV_STEPS; i++) a[i] = 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + (i / _IV_STEPS).toFixed(3) + ')';
  return a;
}
function _ivA(v) { return v <= 0 ? 0 : v >= 1 ? _IV_STEPS : ((v * _IV_STEPS + 0.5) | 0); }

// black, five reds, and white kept for cutting
const _IV_VOID  = _ivRamp('7,3,5');
const _IV_CLOT  = _ivRamp('34,5,11');       // the deep of any red thing
const _IV_DARK  = _ivRamp('62,8,17');
const _IV_BLOOD = _ivRamp('138,14,30');
const _IV_HOT   = _ivRamp('214,28,48');
const _IV_EMBER = _ivRamp('255,86,74');     // the rim on anything facing the light
const _IV_FLAME = _ivRamp('255,182,120');   // candle cores only
const _IV_BONE  = _ivRamp('255,236,236');   // keys, pearls, the blade
const _IV_WHITE = _ivRamp('255,255,255');
const _IV_LAC   = _ivRamp('16,8,12');       // black lacquer

// One palette shape, handed to the one ornament renderer, exactly as the vine
// renderer on the Flowey page takes one. Body, the lit band down the side
// facing the chandelier, and the rim on that edge.
const _IV_PAL_FAR  = { body: _IV_CLOT[20],  mid: _IV_DARK[16],  lit: _IV_BLOOD[12], lw: 1 };
const _IV_PAL_MID  = { body: _IV_CLOT[23],  mid: _IV_BLOOD[19], lit: _IV_EMBER[15], lw: 1 };
const _IV_PAL_NEAR = { body: _IV_VOID[24],  mid: _IV_CLOT[21],  lit: _IV_HOT[11],   lw: 1 };
const _IV_PAL_GILT = { body: _IV_DARK[24],  mid: _IV_BLOOD[22], lit: _IV_EMBER[20], lw: 1 };

// ── state both layers read, so the ornament round the window is IN each
//    event with the hall rather than watching it happen ──
let _ivPulse = 0;      // the heartbeat, 0..1, peaks on the beat
let _ivDrain = 0;      // `bleed`: 1 = every red in the world has gone to grey
let _ivDark = 0;       // `hunger`: the candles are out
let _ivSwing = 0;      // `chandelier`: how far the light has swung, -1..1
let _ivGrow = 0;       // `rococo`: how far the ornament has grown inward
// `lunge` and every click open CUTS instead, held in _ivCuts in window coords
let _ivCrack = 0;      // `shatter`: how far the mirror crack has spread
let _ivEvNow = null;

// Red, drained toward grey by the `bleed` event. One string built per call and
// only four calls a frame, so it never shows up in a profile.
function _ivRed(ramp, v) {
  if (_ivDrain < 0.02) return ramp[_ivA(v)];
  const s = ramp[_ivA(v)];
  const p = s.slice(5, -1).split(',');
  const r = +p[0], g = +p[1], b = +p[2];
  const l = (r * 0.35 + g * 0.5 + b * 0.15) * 0.85;
  const d = _ivDrain;
  return 'rgba(' + ((r + (l - r) * d) | 0) + ',' + ((g + (l - g) * d) | 0) + ',' +
         ((b + (l - b) * d) | 0) + ',' + p[3] + ')';
}

// ── the pixel pipeline ──
function _ivPX(W) { return Math.max(2, Math.min(5, Math.round(W / 360))); }
function _ivLo(canvas, key, W, H, PX) {
  const k = key + 'Lo';
  let c = canvas[k];
  const lw = Math.ceil(W / PX), lh = Math.ceil(H / PX);
  if (!c || c.width !== lw || c.height !== lh) {
    c = canvas[k] = document.createElement('canvas');
    c.width = lw; c.height = lh;
    c._g = c.getContext('2d');
  }
  return c;
}
// a sheet baked at pixel resolution with the world transform already on it, so
// everything inside is written in real coordinates
function _ivSheet(W, H, PX) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(W / PX); c.height = Math.ceil(H / PX);
  const g = c.getContext('2d');
  g.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  g.lineJoin = 'round'; g.lineCap = 'round';
  return c;
}
const _IV_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function _ivDither(c, levels) {
  const g = c.getContext('2d');
  let img;
  try { img = g.getImageData(0, 0, c.width, c.height); } catch (e) { return; }
  const d = img.data, w = c.width, step = 255 / levels;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const b = (_IV_BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step * 0.55;
      for (let k = 0; k < 3; k++) {
        const v = Math.round((d[i + k] + b) / step) * step;
        d[i + k] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.putImageData(img, 0, 0);
  g.setTransform(1 / (c._px || 1), 0, 0, 1 / (c._px || 1), 0, 0);
}
function _ivBloom(canvas, lo, amount) {
  const w1 = Math.max(8, lo.width >> 2), h1 = Math.max(8, lo.height >> 2);
  let b1 = canvas._ivB1, b2 = canvas._ivB2;
  if (!b1 || b1.width !== w1 || b1.height !== h1) {
    b1 = canvas._ivB1 = document.createElement('canvas'); b1.width = w1; b1.height = h1;
    b2 = canvas._ivB2 = document.createElement('canvas'); b2.width = Math.max(4, w1 >> 1); b2.height = Math.max(4, h1 >> 1);
  }
  const g1 = b1.getContext('2d'), g2 = b2.getContext('2d');
  g1.globalCompositeOperation = 'copy'; g1.drawImage(lo, 0, 0, w1, h1);
  g2.globalCompositeOperation = 'copy'; g2.drawImage(b1, 0, 0, b2.width, b2.height);
  const lg = lo._g;
  lg.save();
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.globalCompositeOperation = 'lighter';
  lg.globalAlpha = amount;      lg.drawImage(b2, 0, 0, lo.width, lo.height);
  lg.globalAlpha = amount * 0.6; lg.drawImage(b1, 0, 0, lo.width, lo.height);
  lg.restore();
}

// ════════════════════════════════════════════════════════════════
// THE ORNAMENT
//
// Rococo is C scrolls and acanthus and almost nothing else, so
// there is one scroll here and the entire page is built out of it.
// A scroll is a logarithmic spiral: the radius falls by a constant
// factor per turn, which is why the eye of a real one sits where it
// does and why an evenly-spaced arc never looks right. It is walked
// from its OUTER end so it can be attached to something, drawn as a
// tapering ribbon so it has weight, and lit down the side facing
// the chandelier like everything else in the room.
// ════════════════════════════════════════════════════════════════
const _IV_PT = new Float32Array(200);
const _IV_NX = new Float32Array(100), _IV_NY = new Float32Array(100);
const _IV_SG = new Int8Array(100);

// Fills _IV_PT with a scroll starting at (x,y) heading along `ang`, curling in
// `dir` (+1 or -1), with `turns` of spiral inside radius R. Returns the count.
function _ivScroll(x, y, ang, R, turns, dir, N) {
  const n = N || 22;
  const TH = turns * 6.2831853;
  const k = Math.log(7) / TH;                    // the eye is a seventh of R
  const a0 = ang + dir * 1.5707963;              // so the outer tangent is `ang`
  const cx = x - Math.cos(a0) * R, cy = y - Math.sin(a0) * R;
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * TH;
    const r = R * Math.exp(-k * th);
    const a = a0 + dir * th;
    _IV_PT[i * 2] = cx + Math.cos(a) * r;
    _IV_PT[i * 2 + 1] = cy + Math.sin(a) * r;
  }
  return n + 1;
}
// a plain curved stem, for joining ornaments to each other
function _ivArc(x, y, ang, len, bend, N) {
  const n = N || 14;
  let px = x, py = y, a = ang;
  for (let i = 0; i <= n; i++) {
    _IV_PT[i * 2] = px; _IV_PT[i * 2 + 1] = py;
    a += bend / n;
    px += Math.cos(a) * (len / n); py += Math.sin(a) * (len / n);
  }
  return n + 1;
}

function _ivNorms(p, n) {
  for (let i = 0; i < n; i++) {
    let dx, dy;
    if (i === 0) { dx = p[2] - p[0]; dy = p[3] - p[1]; }
    else if (i === n - 1) { dx = p[i * 2] - p[i * 2 - 2]; dy = p[i * 2 + 1] - p[i * 2 - 1]; }
    else { dx = p[i * 2 + 2] - p[i * 2 - 2]; dy = p[i * 2 + 3] - p[i * 2 - 1]; }
    const m = Math.hypot(dx, dy) || 1;
    _IV_NX[i] = -dy / m; _IV_NY[i] = dx / m;
  }
}

// A closed ribbon around the current point list, tapering to the eye. Filled
// shapes occlude; outlines pile up.
function _ivRibbonPath(ctx, p, n, w0, w1) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const w = (w0 + (w1 - w0) * (i / (n - 1))) * 0.5;
    const X = p[i * 2] + _IV_NX[i] * w, Y = p[i * 2 + 1] + _IV_NY[i] * w;
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  for (let i = n - 1; i >= 0; i--) {
    const w = (w0 + (w1 - w0) * (i / (n - 1))) * 0.5;
    ctx.lineTo(p[i * 2] - _IV_NX[i] * w, p[i * 2 + 1] - _IV_NY[i] * w);
  }
  ctx.closePath();
}

// THE ONE ORNAMENT RENDERER. Body, a lit band down the side facing the light
// that stops at the centreline, and a rim on that edge. Which side is lit is
// dot(normal, light - point) per point, so a scroll that curls past the
// chandelier changes sides halfway round, which is what actually happens.
function _ivGilt(ctx, p, n, w0, w1, lx, ly, P) {
  _ivNorms(p, n);
  for (let i = 0; i < n; i++) {
    _IV_SG[i] = ((lx - p[i * 2]) * _IV_NX[i] + (ly - p[i * 2 + 1]) * _IV_NY[i]) >= 0 ? 1 : -1;
  }
  ctx.fillStyle = P.body;
  _ivRibbonPath(ctx, p, n, w0, w1);
  ctx.fill();
  const hw = (i) => (w0 + (w1 - w0) * (i / (n - 1))) * 0.5;
  ctx.fillStyle = P.mid;
  ctx.beginPath();
  for (let i = 0; i < n - 1; i++) {
    const s = _IV_SG[i];
    if (s !== _IV_SG[i + 1]) continue;
    const a = hw(i), b = hw(i + 1);
    const x0 = p[i * 2], y0 = p[i * 2 + 1], x1 = p[i * 2 + 2], y1 = p[i * 2 + 3];
    ctx.moveTo(x0 + _IV_NX[i] * a * s, y0 + _IV_NY[i] * a * s);
    ctx.lineTo(x1 + _IV_NX[i + 1] * b * s, y1 + _IV_NY[i + 1] * b * s);
    ctx.lineTo(x1 + _IV_NX[i + 1] * b * 0.10 * s, y1 + _IV_NY[i + 1] * b * 0.10 * s);
    ctx.lineTo(x0 + _IV_NX[i] * a * 0.10 * s, y0 + _IV_NY[i] * a * 0.10 * s);
    ctx.closePath();
  }
  ctx.fill();
  ctx.strokeStyle = P.lit; ctx.lineWidth = P.lw;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const s = _IV_SG[i], w = hw(i);
    const X = p[i * 2] + _IV_NX[i] * w * s, Y = p[i * 2 + 1] + _IV_NY[i] * w * s;
    if (i === 0 || s !== _IV_SG[i - 1]) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.stroke();
}

// An acanthus leaf: a lobed blade that curls the same way the scroll it sits on
// does. Three lobes down one side, one long point.
function _ivAcanthus(ctx, x, y, ang, L, Wd, dir) {
  const cx = Math.cos(ang), cy = Math.sin(ang);
  const nx = -cy * dir, ny = cx * dir;
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + cx * L * 0.30 + nx * Wd * 1.05, y + cy * L * 0.30 + ny * Wd * 1.05,
                       x + cx * L * 0.46 + nx * Wd * 0.45, y + cy * L * 0.46 + ny * Wd * 0.45);
  ctx.quadraticCurveTo(x + cx * L * 0.62 + nx * Wd * 0.92, y + cy * L * 0.62 + ny * Wd * 0.92,
                       x + cx * L * 0.74 + nx * Wd * 0.36, y + cy * L * 0.74 + ny * Wd * 0.36);
  ctx.quadraticCurveTo(x + cx * L * 0.92 + nx * Wd * 0.52, y + cy * L * 0.92 + ny * Wd * 0.52,
                       x + cx * L, y + cy * L);
  ctx.quadraticCurveTo(x + cx * L * 0.44 - nx * Wd * 0.30, y + cy * L * 0.44 - ny * Wd * 0.30, x, y);
  ctx.closePath();
}

// A COMPOUND ORNAMENT: the thing rococo actually is. A C scroll one way, a
// smaller S scroll answering it the other way, acanthus in the crook of each,
// and a bead where they meet. Used for the vault ribs, the mirror frame, the
// corners of the window and the guard of the rapier, at four different sizes.
function _ivOrnament(ctx, x, y, ang, S, lx, ly, P, seed, flip) {
  const d = flip ? -1 : 1;
  const w = S * 0.115;
  let n = _ivScroll(x, y, ang, S * 0.62, 1.35, d, 20);
  _ivGilt(ctx, _IV_PT, n, w, w * 0.22, lx, ly, P);
  const bx = x + Math.cos(ang) * S * 0.30, by = y + Math.sin(ang) * S * 0.30;
  n = _ivScroll(bx, by, ang + d * 2.5, S * 0.36, 1.15, -d, 16);
  _ivGilt(ctx, _IV_PT, n, w * 0.70, w * 0.16, lx, ly, P);
  ctx.fillStyle = P.mid;
  ctx.beginPath();
  _ivAcanthus(ctx, x, y, ang - d * 0.55, S * 0.52, S * 0.17, d);
  _ivAcanthus(ctx, bx, by, ang + d * 1.15, S * 0.34, S * 0.12, -d);
  ctx.fill();
  ctx.fillStyle = P.lit;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.9, y); ctx.arc(x, y, w * 0.9, 0, 6.2831853);
  ctx.fill();
}

// ════════════════════════════════════════════════════════════════
// EVENTS. One at a time, every four to nine seconds, never the same
// one twice running, rolled once when it starts. Each is a
// different KIND: a cut across the frame, the palette dying, the
// light itself moving, the ornament growing, everything stopping,
// something dancing through, and the world breaking.
// ════════════════════════════════════════════════════════════════
let _ivEvNext = 0, _ivEvLast = '';
const _IV_EV = [
  { n: 'lunge',   d: 0.95 },   // a rapier cut opens the whole frame
  { n: 'bleed',   d: 3.30 },   // every red in the hall drains out and floods back
  { n: 'sweep',   d: 3.60 },   // the chandelier swings and takes the lighting with it
  { n: 'rococo',  d: 3.40 },   // the ornament grows inward over everything and lets go
  { n: 'hunger',  d: 3.00 },   // the candles go out one at a time, then all relight at once
  { n: 'waltz',   d: 4.20 },   // two of them turn through the hall, and their reflection does too
  { n: 'shatter', d: 2.60 },   // a crack spiders across the world and heals
];
function _ivEvTick(t) {
  const e = _ivEvNow;
  if (e) {
    const p = (t - e.t0) / e.d;
    if (p < 1) { e.p = p; return e; }
    _ivEvNow = null;
    _ivEvNext = t + 3.6 + _ivRnd(t * 13.1) * 5.0;
    return null;
  }
  if (_ivEvNext === 0) { _ivEvNext = t + 2.6 + _ivRnd(t * 7.3) * 3.0; return null; }
  if (t < _ivEvNext) return null;
  let d = null;
  for (let tries = 0; tries < 12; tries++) {
    d = _IV_EV[(_ivRnd(t * 91.7 + tries * 3.3) * _IV_EV.length) | 0];
    if (_ivRM && (d.n === 'lunge' || d.n === 'shatter' || d.n === 'hunger')) continue;
    if (d.n !== _ivEvLast) break;
  }
  if (_ivRM && (d.n === 'lunge' || d.n === 'shatter' || d.n === 'hunger')) d = _IV_EV[5];
  _ivEvLast = d.n;
  _ivEvNow = { name: d.n, d: d.d, t0: t, p: 0,
               r0: _ivRnd(t * 17.7), r1: _ivRnd(t * 29.3), r2: _ivRnd(t * 41.9) };
  return _ivEvNow;
}
function _ivEvReset() {
  _ivEvNow = null; _ivEvNext = 0; _ivEvLast = '';
  _ivPulse = 0; _ivDrain = 0; _ivDark = 0; _ivSwing = 0; _ivGrow = 0; _ivCrack = 0;
  if (typeof _ivCutClear === 'function') _ivCutClear();
  if (typeof _ivSparks !== 'undefined') { _ivSparks = []; _ivGhosts = []; _ivDrips = []; }
  if (typeof _ivShards !== 'undefined') _ivShards = [];
}

// ════════════════════════════════════════════════════════════════
// THE HALL
// ════════════════════════════════════════════════════════════════
// One point perspective, the vanishing point under the chandelier and
// off to the right, because the GUI panels own the left two thirds of
// this canvas and a hall nobody can see down is not a hall.
function _ivVP(W, H) { return [W * 0.700, H * 0.455]; }
// the floor, parameterised by depth u (0 at the horizon, 1 at your feet)
function _ivFloorY(H, VY, u) { return VY + (H * 1.12 - VY) * Math.pow(u, 1.65); }
function _ivFloorX(W, VX, u, s) { return VX + s * (W * 0.045 + W * 1.30 * Math.pow(u, 1.55)); }

/* THE BREACH.
   The star wanted to be in the sky, and this room did not have one, so the
   room is broken. The third arched window down the LEFT wall has been torn
   out of the wall entirely, taking the cornice and a piece of the vault with
   it, and the night is behind it.
   It is built in the hall's own perspective rather than as a shape laid over
   it: every vertex is a (u, f) on the left wall, where u is how far away it is
   and f is how far up it is, run through the same two functions the floor
   junction, the dado and the cornice are run through. f = 0 is the skirting,
   f = 1 is eye level, f = 2.35 is the cornice. So the opening leans and
   foreshortens with the room, and the far end of it rides up toward the top of
   the picture, which is what stops it reading as a porthole stuck on.
   The outline is TOOTHED, not merely jittered. Masonry that has been torn out
   leaves teeth, and a soft wobbly edge reads as a stain instead of a hole.
   Rolled once from a fixed seed: the room does not change shape between
   frames, and it does not change shape between the layer that bakes it and the
   layer that throws light through it. */
function _ivBreach(W, H) {
  let K = _ivBreach._k;
  if (K && K.W === W && K.H === H) return K;
  const [VX, VY] = _ivVP(W, H);
  const wx = (u) => _ivFloorX(W, VX, u, -1.02);
  const wy = (u, f) => { const fy = _ivFloorY(H, VY, u); return fy - (fy - VY) * f; };
  // Far enough down the wall to clear the near vignette, which crushes
  // anything in the outer eighth of the picture to black and had been eating
  // the near half of this.
  const U0 = 0.415, U1 = 0.575, N = 8, D = (U1 - U0) / N;
  const FT = 2.46, FB = 1.28;                     // through the cornice, down past eye level
  const P = [];
  const push = (u, f) => { P.push(wx(u), wy(u, f)); };
  // the top lip, running away from you, with teeth of plaster left hanging
  // down into the gap
  for (let i = 0; i <= N; i++) {
    const u = U0 + D * i;
    push(u, FT + (_ivRnd(i * 3.7 + 2) - 0.5) * 0.16);
    // shallow. A tooth deeper than about a tenth of the wall stops reading as
    // broken masonry and starts reading as a spike.
    if (i < N) push(u + D * 0.5, FT - 0.05 - _ivRnd(i * 8.1 + 5) * 0.16);
  }
  // the far end coming down. All four sides have to break: two ragged edges
  // and two ruled ones is a picture frame, not a hole.
  for (let k = 1; k <= 4; k++) {
    const f = FT + (FB - FT) * (k / 5);
    P.push(wx(U1) + (_ivRnd(k * 6.1 + 31) - 0.5) * W * 0.022, wy(U1, f));
  }
  const TOP = P.length >> 1;
  // and the bottom lip coming back toward you, with the wall left standing in
  // teeth of its own
  for (let i = N; i >= 0; i--) {
    const u = U0 + D * i;
    push(u, FB + (_ivRnd(i * 5.3 + 7) - 0.5) * 0.14);
    if (i > 0) push(u - D * 0.5, FB + 0.04 + _ivRnd(i * 9.7 + 3) * 0.15);
  }
  // then the near end going back up
  for (let k = 1; k <= 4; k++) {
    const f = FB + (FT - FB) * (k / 5);
    P.push(wx(U0) + (_ivRnd(k * 4.7 + 17) - 0.5) * W * 0.022, wy(U0, f));
  }
  const n = P.length >> 1;
  // Pulled in by a CONSTANT distance rather than by a fraction of the way to
  // the middle: a fractional inset makes the band wide where the opening is
  // tall and vanishes where it is narrow, which read as a ribbon draped over
  // two sides of it instead of as the thickness of a wall.
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { cx += P[i * 2]; cy += P[i * 2 + 1]; }
  cx /= n; cy /= n;
  const Q = new Float32Array(n * 2);
  const T = Math.min(W, H) * 0.017;
  for (let i = 0; i < n; i++) {
    const vx = cx - P[i * 2], vy = cy - P[i * 2 + 1];
    const d = Math.hypot(vx, vy) || 1;
    const k = Math.min(T, d * 0.55);
    Q[i * 2] = P[i * 2] + (vx / d) * k;
    Q[i * 2 + 1] = P[i * 2 + 1] + (vy / d) * k;
  }
  // THE HORIZON, built here rather than at draw time so that the sky it cuts
  // off is a shape the star can be clipped to as well: a spike of starlight
  // has no business crossing in front of a mountain.
  const HX0 = wx(U1) - W * 0.09, HX1 = wx(U0) + W * 0.09, HN = 27;
  const hz = new Float32Array(HN * 2);
  // Level, and clear of the lower lip: a real horizon is at one height because
  // it is far away, and one that sits down on the sill is not a horizon, it is
  // a texture. Most peaks are low and a few are not, which is what a range
  // looks like and what a row of even teeth does not.
  const hy0 = Math.min(wy(U0, FB), wy(U1, FB)) - H * 0.030;
  for (let i = 0; i < HN; i++) {
    const u = i / (HN - 1);
    const pk = Math.pow(_ivRnd(i * 4.3 + 21), 2.2);
    hz[i * 2] = HX0 + u * (HX1 - HX0);
    hz[i * 2 + 1] = hy0 - H * (0.014 + pk * 0.058) * (0.55 + 0.45 * Math.sin(u * 5.1 + 1.2));
  }
  // the window this used to be: niche 2 of the four down that wall
  const nu0 = 0.47, nu1 = 0.585;
  K = _ivBreach._k = {
    W: W, H: H, p: new Float32Array(P), q: Q, n: n, cx: cx, cy: cy,
    t: TOP, hz: hz, hn: HN, hy: hy0,
    u0: U0, u1: U1, wx: wx, wy: wy,
    nx0: wx(nu0), nx1: wx(nu1),
    nb0: wy(nu0, 0.62), nb1: wy(nu1, 0.62),
    ns0: wy(nu0, 1.62), ns1: wy(nu1, 1.62),
    // where the star hangs in the opening, and the two ends of the broken sill
    // its light spills over
    sx: wx(0.495), sy: wy(0.495, 2.00),
    bx0: wx(U0), by0: wy(U0, FB), bx1: wx(U1), by1: wy(U1, FB),
  };
  return K;
}
// The sky INSIDE the opening: the top lip and the far end, then the horizon
// back along the bottom. Used as a second clip on top of the opening's own, so
// it is the intersection of the two, which is what the star is allowed to
// shine on.
function _ivSkyPoly(g, K) {
  g.beginPath();
  g.moveTo(K.p[0], K.p[1]);
  for (let i = 1; i < K.t; i++) g.lineTo(K.p[i * 2], K.p[i * 2 + 1]);
  for (let i = 0; i < K.hn; i++) g.lineTo(K.hz[i * 2], K.hz[i * 2 + 1]);
  g.closePath();
}
// `keep` appends to the path in progress instead of starting a new one, which
// is what an even-odd ring needs: both outlines have to be in the SAME path.
function _ivBreachPath(g, K, arr, keep) {
  const p = arr || K.p;
  if (!keep) g.beginPath();
  g.moveTo(p[0], p[1]);
  for (let i = 1; i < K.n; i++) g.lineTo(p[i * 2], p[i * 2 + 1]);
  g.closePath();
}


// ── the void: black, and the chandelier's light bleeding into it. Baked and
//    dithered, which is where most of the pixel-art character comes from. ──
function _ivVoidSheet(W, H, CX, CY, PX) {
  const c = _ivSheet(W, H, PX); c._px = PX;
  const g = c.getContext('2d');
  g.fillStyle = '#070305';
  g.fillRect(0, 0, W, H);
  const R = Math.hypot(W, H) * 0.86;
  const lg = g.createRadialGradient(CX, CY, 0, CX, CY, R);
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    lg.addColorStop(u, 'rgba(138,14,30,' + (0.30 * Math.pow(1 - u, 2.8)).toFixed(4) + ')');
  }
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  const hot = g.createRadialGradient(CX, CY, 0, CX, CY, W * 0.30);
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    hot.addColorStop(u, 'rgba(255,86,74,' + (0.13 * Math.pow(1 - u, 3.2)).toFixed(4) + ')');
  }
  g.fillStyle = hot; g.fillRect(0, 0, W, H);
  _ivDither(c, 11);
  return c;
}

// ── everything that does not move: the vault, the mirror, the floor, the
//    piano, and the near dark. One sheet, baked once, dithered. ──
// The sconces down both walls: one candle per niche, going away. Their
// positions are computed once and read by both the baked bracket and the live
// flame, so the two cannot drift apart.
function _ivSconces(W, H) {
  const [VX, VY] = _ivVP(W, H);
  const out = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 0; k < 4; k++) {
      // the third bracket down the left wall is inside the breach, and a
      // candle cannot burn on a wall that is not there any more
      if (side < 0 && k === 2) continue;
      const u = 0.07 + k * 0.20 - 0.030;
      const fyy = _ivFloorY(H, VY, u);
      out.push({ x: _ivFloorX(W, VX, u, side * 1.02), y: fyy - (fyy - VY) * 1.12,
                 s: 0.28 + u * 1.5, i: out.length });
    }
  }
  return out;
}

function _ivHallSheet(W, H, PX) {
  const c = _ivSheet(W, H, PX); c._px = PX;
  const g = c.getContext('2d');
  const [VX, VY] = _ivVP(W, H);
  const CX = VX, CY = H * 0.185;                       // the chandelier
  const S = W * 0.10;

  // ── 1. THE VAULT. Ribs running back to the vanishing point with an ornament
  //    at every springing, which is what a rococo ceiling is: the same scroll
  //    at four sizes and nothing else.
  for (let i = 0; i < 9; i++) {
    const a = -3.0416 + (i / 8) * 2.6;                  // fanned across the top
    const n = _ivArc(VX, VY, a, Math.hypot(W, H) * 0.95, (i - 4) * 0.16, 16);
    const w = W * (0.0055 + Math.abs(i - 4) * 0.0016);
    _ivGilt(g, _IV_PT, n, w * 0.3, w, CX, CY, _IV_PAL_FAR);
  }
  // the transverse arches, three of them, at three depths
  for (let k = 0; k < 3; k++) {
    const d = 0.16 + k * 0.30;
    const y = VY - H * (0.10 + d * 0.62);
    const sp = W * (0.10 + d * 1.05);
    g.strokeStyle = _IV_DARK[_ivA(0.55 - k * 0.12)];
    g.lineWidth = W * (0.004 + d * 0.006);
    g.beginPath();
    g.moveTo(VX - sp, y + H * 0.30 * d);
    g.quadraticCurveTo(VX, y - H * 0.14 * d, VX + sp, y + H * 0.30 * d);
    g.stroke();
    const OS = S * (0.34 + d * 0.75);
    _ivOrnament(g, VX - sp * 0.62, y - H * 0.055 * d, 0.5, OS, CX, CY, _IV_PAL_FAR, k, false);
    _ivOrnament(g, VX + sp * 0.62, y - H * 0.055 * d, Math.PI - 0.5, OS, CX, CY, _IV_PAL_FAR, k, true);
  }

  // ── 1b. THE SIDE WALLS. In one point perspective every line running away
  //    from you meets at the vanishing point, so the floor junction, the dado
  //    and the cornice are three lines out of that one point. The niches
  //    between them are what stop the hall being two planes and nothing else.
  {
    const wy = (u, f) => {
      const fyy = _ivFloorY(H, VY, u);
      return fyy - (fyy - VY) * f;
    };
    for (let side = -1; side <= 1; side += 2) {
      const wx = (u) => _ivFloorX(W, VX, u, side * 1.02);
      g.fillStyle = _IV_CLOT[_ivA(0.85)];
      g.beginPath();
      g.moveTo(VX, VY);
      for (let i = 0; i <= 12; i++) { const u = Math.pow(i / 12, 1.2); g.lineTo(wx(u), wy(u, 0)); }
      for (let i = 12; i >= 0; i--) { const u = Math.pow(i / 12, 1.2); g.lineTo(wx(u), wy(u, 2.35)); }
      g.closePath(); g.fill();
      for (const L of [[0, _IV_EMBER, 0.30], [0.62, _IV_BLOOD, 0.34], [2.10, _IV_BLOOD, 0.26]]) {
        g.strokeStyle = L[1][_ivA(L[2])];
        g.lineWidth = W * 0.0016;
        g.beginPath();
        g.moveTo(VX, VY);
        for (let i = 1; i <= 12; i++) { const u = Math.pow(i / 12, 1.2); g.lineTo(wx(u), wy(u, L[0])); }
        g.stroke();
      }
      for (let k = 0; k < 4; k++) {
        const u0 = 0.07 + k * 0.20, u1 = u0 + 0.115;
        const x0 = wx(u0), x1 = wx(u1);
        const b0 = wy(u0, 0.62), b1 = wy(u1, 0.62);
        const s0 = wy(u0, 1.55), s1 = wy(u1, 1.55);   // where the arch springs
        const cr = (wy((u0 + u1) * 0.5, 2.05));       // and its crown
        const NICHE = () => {
          g.beginPath();
          g.moveTo(x0, b0); g.lineTo(x1, b1); g.lineTo(x1, s1);
          g.quadraticCurveTo((x0 + x1) * 0.5, cr - Math.abs(x1 - x0) * 0.28, x0, s0);
          g.closePath();
        };
        g.fillStyle = _IV_VOID[24]; NICHE(); g.fill();
        const ng = g.createLinearGradient(0, cr, 0, Math.max(b0, b1));
        ng.addColorStop(0, 'rgba(255,86,74,0.34)');
        ng.addColorStop(0.45, 'rgba(138,14,30,0.16)');
        ng.addColorStop(1, 'rgba(34,5,11,0.02)');
        g.fillStyle = ng; NICHE(); g.fill();
        g.strokeStyle = _IV_EMBER[_ivA(0.26)]; g.lineWidth = Math.max(1, W * 0.0012);
        NICHE(); g.stroke();
        const OS = S * (0.22 + u1 * 0.85);
        _ivOrnament(g, x1, (b1 + s1) * 0.5, side > 0 ? Math.PI : 0, OS, CX, CY, _IV_PAL_FAR, k + 300 + side * 7, side > 0);
      }
    }
  }

  for (const sc of _ivSconces(W, H)) {
    const bw = W * 0.006 * sc.s;
    g.fillStyle = _IV_DARK[24];
    g.fillRect(sc.x - bw, sc.y, bw * 2, bw * 2.6);
    _ivOrnament(g, sc.x, sc.y + bw * 3.0, -1.5707963, S * 0.20 * sc.s, CX, CY, _IV_PAL_GILT, sc.i + 400, sc.i & 1);
  }

  // ── 1c. THE BREACH, punched last of the wall work so that it cuts the
  //    niches, the mouldings and the brackets rather than being drawn in among
  //    them. Everything a hole needs in order to read as a hole is here, in
  //    this order: something behind it, the wreckage of what used to be in the
  //    way, the THICKNESS of the material it is through, a broken lip that is
  //    bright where it faces the light, and the rubble it made on the floor.
  {
    const K = _ivBreach(W, H);

    // 1. THE NIGHT. It is a colder black than the room's, which is the only
    //    thing separating the two at this bit depth: everything indoors here
    //    is a warm red-black, so the sky is given a blue one.
    _ivBreachPath(g, K); g.save(); g.clip();
    // A night sky is almost never black in a picture: it is the LIGHTEST dark
    // in the frame, which is exactly how an opening in a shadowed wall reads as
    // an opening at all. Cool at the top against a room that is warm red-black
    // everywhere, and going to blood at the bottom where the horizon is.
    const sg = g.createLinearGradient(0, K.cy - H * 0.30, 0, K.by0 + H * 0.04);
    sg.addColorStop(0, '#15102a');
    sg.addColorStop(0.45, '#21133c');
    sg.addColorStop(0.80, '#361538');
    sg.addColorStop(1, '#4c1730');
    g.fillStyle = sg;
    g.fillRect(0, -H, W, H * 2);
    // Two thin banks of cloud, so the sky is a place and not a fill. They are
    // LIGHTER than the sky, not darker: cloud at night is lit from underneath
    // by whatever is burning, and a dark cloud over a dark sky is just a
    // second way of painting the opening shut, which is what the first pass at
    // this did.
    for (let k = 0; k < 2; k++) {
      const y = K.cy + H * (0.030 + k * 0.062);
      const th = H * 0.020;
      const cg = g.createLinearGradient(0, y - th, 0, y + th);
      cg.addColorStop(0, 'rgba(112,72,128,0)');
      cg.addColorStop(0.45, 'rgba(112,72,128,' + (0.20 - k * 0.07).toFixed(3) + ')');
      cg.addColorStop(1, 'rgba(112,72,128,0)');
      g.fillStyle = cg;
      g.beginPath();
      g.moveTo(0, y - th);
      for (let i = 0; i <= 10; i++) {
        g.lineTo(W * 0.045 * i, y - th + Math.sin(i * 1.1 + k * 2.4) * H * 0.012);
      }
      g.lineTo(W * 0.45, y + th); g.lineTo(0, y + th);
      g.closePath(); g.fill();
    }
    // A HORIZON, which is the thing that turns a coloured shape into a
    // distance. Black spires against a sky that is lighter than the room is
    // also the one contrast in this whole picture that cannot be mistaken for
    // anything else, so it is what finally makes the opening read as an
    // opening rather than as a stain on the wall.
    {
      g.fillStyle = _IV_VOID[24];
      g.beginPath();
      g.moveTo(K.hz[0], K.hz[1]);
      for (let i = 1; i < K.hn; i++) g.lineTo(K.hz[i * 2], K.hz[i * 2 + 1]);
      g.lineTo(K.hz[(K.hn - 1) * 2], K.hy + H * 0.09);
      g.lineTo(K.hz[0], K.hy + H * 0.09);
      g.closePath(); g.fill();
      // and the last of the sky caught along their tops
      g.strokeStyle = _IV_BLOOD[_ivA(0.30)];
      g.lineWidth = Math.max(1, W * 0.0010);
      g.stroke();
    }

    // the small ones. The big one is drawn live, because it is the only thing
    // out there that is doing anything.
    for (let i = 0; i < 60; i++) {
      const x = K.bx1 + _ivRnd(i * 3.7 + 1) * (K.bx0 - K.bx1) * 1.2;
      const y = K.cy - H * 0.22 + _ivRnd(i * 5.3 + 4) * H * 0.46;
      const r = W * 0.0011 * (0.5 + _ivRnd(i * 9.1) * 1.7);
      g.fillStyle = _IV_BONE[_ivA(0.22 + _ivRnd(i * 2.3) * 0.50)];
      g.beginPath(); g.arc(x, y, r, 0, 6.2831853); g.fill();
    }

    g.restore();

    // 2. THE WRECKAGE OF THE WINDOW, and it is drawn on the WALL, outside the
    //    opening's clip, because that is where it is: the arched window that
    //    used to be here had its head torn off with the masonry above it, and
    //    what is left is the bottom of it still standing under the hole. Every
    //    bar is stopped short of the lower lip so that none of them stray up
    //    into the sky.
    //    This is the tall arched window that was on the overlay before, put
    //    where a window in this hall actually goes, and then broken.
    {
      const nw = K.nx1 - K.nx0;
      const at = (u, a, b) => a + (b - a) * u;
      const NU0 = 0.47, NU1 = 0.585;
      for (let k = 1; k < 6; k++) {
        const u = k / 6;
        const x = at(u, K.nx0, K.nx1);
        const yb = at(u, K.nb0, K.nb1);
        const ys = at(u, K.ns0, K.ns1);
        const cap = K.wy(NU0 + (NU1 - NU0) * u, 1.28) + H * 0.016;
        const yt = Math.max(yb - (yb - ys) * (0.45 + _ivRnd(k * 7.1) * 1.05), cap);
        if (yb - yt < H * 0.006) continue;
        const lean = (_ivRnd(k * 3.3) - 0.5) * nw * 0.10;
        g.strokeStyle = _IV_VOID[24]; g.lineWidth = W * 0.0034;
        g.beginPath(); g.moveTo(x, yb); g.lineTo(x + lean, yt); g.stroke();
        g.strokeStyle = _IV_EMBER[_ivA(0.42)]; g.lineWidth = W * 0.0010;
        g.beginPath(); g.moveTo(x + W * 0.0011, yb); g.lineTo(x + lean + W * 0.0011, yt); g.stroke();
      }
      // the teeth of glass still standing in the sill
      for (let k = 0; k < 11; k++) {
        const u = k / 10;
        const x = at(u, K.nx0, K.nx1);
        const yb = at(u, K.nb0, K.nb1);
        const h = (yb - at(u, K.ns0, K.ns1)) * (0.12 + _ivRnd(k * 4.9) * 0.60);
        const wd = nw * 0.050 * (0.5 + _ivRnd(k * 6.1));
        g.beginPath();
        g.moveTo(x - wd, yb); g.lineTo(x + wd, yb);
        g.lineTo(x + (_ivRnd(k * 2.2) - 0.5) * wd, yb - h);
        g.closePath();
        g.fillStyle = _IV_BLOOD[_ivA(0.20)]; g.fill();
        g.strokeStyle = _IV_EMBER[_ivA(0.50)]; g.lineWidth = Math.max(1, W * 0.0009); g.stroke();
      }
    }

    // 3. THE THICKNESS, and it is the BRIGHT thing here. The wall is a plane
    //    facing across the room, so its front is in shadow at this end of the
    //    hall, but the raw face left by the break is turned inward toward the
    //    chandelier and catches it. Reading outward that gives dark wall, a
    //    band of lit broken stone, then sky: three values in a row, which is
    //    all a hole has ever needed to look like a hole.
    g.save();
    _ivBreachPath(g, K);
    _ivBreachPath(g, K, K.q, true);
    const rv = g.createLinearGradient(K.cx - W * 0.09, K.cy + H * 0.10, K.cx + W * 0.09, K.cy - H * 0.10);
    rv.addColorStop(0, _IV_CLOT[24]);
    rv.addColorStop(0.35, _IV_DARK[24]);
    rv.addColorStop(0.80, _IV_BLOOD[24]);
    rv.addColorStop(1, _IV_HOT[_ivA(0.72)]);
    g.fillStyle = rv;
    g.fill('evenodd');
    g.restore();

    // 4. THE BROKEN LIP, segment by segment. An edge turned toward the
    //    chandelier takes the ember and an edge turned away takes the void,
    //    which is the same three tone rule every other object in this hall is
    //    drawn under. Nothing is left unlit entirely, because a black edge on
    //    a black wall is how the first version of this disappeared.
    _ivBreachPath(g, K);
    g.strokeStyle = _IV_VOID[24]; g.lineWidth = W * 0.0030; g.stroke();
    _ivBreachPath(g, K, K.q);
    g.strokeStyle = _IV_EMBER[_ivA(0.78)]; g.lineWidth = Math.max(1, W * 0.0014); g.stroke();

    // 5. THE RUBBLE. A hole with nothing on the floor under it is a hole
    //    somebody drew; a hole with the wall lying under it is a hole
    //    something came through. Angular chunks, sized by depth, each with a
    //    top facet catching the chandelier.
    for (let i = 0; i < 9; i++) {
      const u = 0.470 + _ivRnd(i * 3.1 + 13) * 0.185;
      const fy = _ivFloorY(H, VY, u);
      const x = _ivFloorX(W, VX, u, -1.02) + _ivRnd(i * 5.9) * W * 0.115;
      const s = W * 0.008 * (0.4 + _ivRnd(i * 7.3) * 1.5) * (0.4 + u);
      const a = (_ivRnd(i * 2.7) - 0.5) * 0.7;
      g.save(); g.translate(x, fy); g.rotate(a);
      g.fillStyle = _IV_VOID[24];
      g.beginPath();
      g.moveTo(-s, 0); g.lineTo(-s * 0.5, -s * 0.75); g.lineTo(s * 0.7, -s * 0.55);
      g.lineTo(s, 0); g.closePath(); g.fill();
      g.fillStyle = _IV_BLOOD[_ivA(0.34)];
      g.beginPath();
      g.moveTo(-s * 0.5, -s * 0.75); g.lineTo(s * 0.7, -s * 0.55);
      g.lineTo(s * 0.5, -s * 0.70); g.lineTo(-s * 0.35, -s * 0.92);
      g.closePath(); g.fill();
      g.restore();
    }
    // and the plaster still hanging off the top lip, and the ribs of the vault
    // snapped where they ran into it
    for (let i = 3; i < 14; i += 5) {
      const x = K.p[i * 2], y = K.p[i * 2 + 1];
      const nn = _ivArc(x, y, 1.35 + (_ivRnd(i * 5.1) - 0.5) * 0.7,
                        W * (0.007 + _ivRnd(i * 3.3) * 0.011),
                        (_ivRnd(i * 7.7) - 0.5) * 0.9, 6);
      _ivGilt(g, _IV_PT, nn, W * 0.0038, W * 0.0008, CX, CY, _IV_PAL_MID);
    }
    // 6. and the room's own manners, broken off at both ends of the gap: the
    //    cornice ornament stops dead where the wall stops.
    _ivOrnament(g, K.bx0, K.by0, -0.6, S * 0.36, CX, CY, _IV_PAL_GILT, 611, false);
    _ivOrnament(g, K.p[0], K.p[1], 1.0, S * 0.32, CX, CY, _IV_PAL_GILT, 612, true);
  }

  // ── 2. THE LANDMARK: a tall arched mirror on the far wall, dead on the
  //    vanishing point, with the hall going on inside it. It is the one thing
  //    here with a light in it, so it reads at a glance and carries the scale.
  {
    const MW = W * 0.105, MT = VY - H * 0.335, MB = VY + H * 0.010;
    g.fillStyle = _IV_LAC[24];
    g.beginPath();
    g.moveTo(VX - MW, MB); g.lineTo(VX - MW, MT + MW * 0.9);
    g.quadraticCurveTo(VX, MT - MW * 0.55, VX + MW, MT + MW * 0.9);
    g.lineTo(VX + MW, MB); g.closePath(); g.fill();
    const mg = g.createLinearGradient(0, MT, 0, MB);
    mg.addColorStop(0, 'rgba(20,3,8,0.55)');
    mg.addColorStop(0.5, 'rgba(12,2,5,0.88)');
    mg.addColorStop(1, 'rgba(34,5,11,0.70)');
    g.fillStyle = mg;
    g.beginPath();
    g.moveTo(VX - MW, MB); g.lineTo(VX - MW, MT + MW * 0.9);
    g.quadraticCurveTo(VX, MT - MW * 0.55, VX + MW, MT + MW * 0.9);
    g.lineTo(VX + MW, MB); g.closePath(); g.fill();
    // what is actually in it: the chandelier, and the hall going away behind
    const cr = g.createLinearGradient(0, MT + MW * 0.2, 0, MB);
    cr.addColorStop(0, 'rgba(255,86,74,0.55)');
    cr.addColorStop(0.35, 'rgba(214,28,48,0.20)');
    cr.addColorStop(1, 'rgba(214,28,48,0.0)');
    g.fillStyle = cr;
    g.beginPath();
    g.moveTo(VX - MW * 0.10, MT + MW * 0.2);
    g.lineTo(VX + MW * 0.10, MT + MW * 0.2);
    g.lineTo(VX + MW * 0.30, MB);
    g.lineTo(VX - MW * 0.30, MB);
    g.closePath(); g.fill();
    // the hall repeating inside it, twice, going away
    for (let k = 1; k <= 3; k++) {
      const f = Math.pow(0.52, k);
      g.strokeStyle = _IV_EMBER[_ivA(0.34 / k)];
      g.lineWidth = Math.max(1, W * 0.0015);
      g.beginPath();
      g.moveTo(VX - MW * f, MB); g.lineTo(VX - MW * f, MT + MW * 0.9 * f + (MB - MT) * (1 - f) * 0.5);
      g.quadraticCurveTo(VX, MT + (MB - MT) * (1 - f) * 0.5 - MW * 0.55 * f, VX + MW * f, MT + MW * 0.9 * f + (MB - MT) * (1 - f) * 0.5);
      g.lineTo(VX + MW * f, MB); g.stroke();
    }
    // and its frame: ornament all the way round, biggest at the crown
    for (let k = 0; k < 7; k++) {
      const u = k / 6;
      const yy = MT + MW * 0.9 + (MB - MT - MW * 0.9) * u;
      _ivOrnament(g, VX - MW - W * 0.004, yy, 1.5707963 + 0.3, S * (0.30 - u * 0.10), CX, CY, _IV_PAL_GILT, k + 20, true);
      _ivOrnament(g, VX + MW + W * 0.004, yy, 1.5707963 - 0.3, S * (0.30 - u * 0.10), CX, CY, _IV_PAL_GILT, k + 30, false);
    }
    _ivOrnament(g, VX - MW * 0.5, MT + MW * 0.30, -0.9, S * 0.46, CX, CY, _IV_PAL_GILT, 41, false);
    _ivOrnament(g, VX + MW * 0.5, MT + MW * 0.30, Math.PI + 0.9, S * 0.46, CX, CY, _IV_PAL_GILT, 42, true);
    // the crown cartouche
    _ivOrnament(g, VX, MT - MW * 0.36, -1.5707963, S * 0.52, CX, CY, _IV_PAL_GILT, 43, false);
    _ivOrnament(g, VX, MT - MW * 0.36, -1.5707963, S * 0.52, CX, CY, _IV_PAL_GILT, 44, true);
  }

  // ── 3. THE FLOOR. Black lacquer, and lacquer is only black where nothing is
  //    reflected in it, so the whole thing is a mirror with a checker under it.
  const fy = (u) => _ivFloorY(H, VY, u);
  const fx = (u, s) => _ivFloorX(W, VX, u, s);
  const fg = g.createLinearGradient(0, VY, 0, H * 1.02);
  fg.addColorStop(0, '#1d0c12');
  fg.addColorStop(0.30, '#0d0509');
  fg.addColorStop(1, '#070305');
  g.fillStyle = fg; g.fillRect(0, VY - 1, W, H - VY + 2);
  // The checker, the reflection down it and the line where it meets the wall
  // are NOT baked: the floor moves. See _ivFloorLive.

  _ivDither(c, 13);
  return c;
}

// ── everything IN FRONT of the live layers: the piano, the ornament crowding
//    in from the near edges, and the vignette. Baked and dithered like the
//    rest, so the embers and the dancers have a hall to be inside of. ──
/* THE FLOOR, LIVE. It marches toward you, one rank of tiles at a time, slowly
   enough that you are not sure at first. A baked floor in a room where
   everything else breathes was the one dead surface on the page.
   Every row is ONE path and one fill, so the whole floor is seventeen fills
   however many tiles are on it. The row index carries the whole-number part of
   the phase, so the black and red squares stay in step across the moment a
   rank passes under your feet and the pattern is reborn at the horizon. */
function _ivFloorLive(g, W, H, t) {
  const [VX, VY] = _ivVP(W, H);
  const fy = (u) => _ivFloorY(H, VY, u);
  const fx = (u, s) => _ivFloorX(W, VX, u, s);
  const N = 17;
  const phase = t * 0.085 * (_ivRM ? 0.3 : 1);
  const base = Math.floor(phase), frac = phase - base;
  for (let r = -1; r < N; r++) {
    const v0 = (r + frac) / N, v1 = (r + 1 + frac) / N;
    if (v1 <= 0) continue;
    const u0 = Math.pow(Math.max(0, v0), 1.30), u1 = Math.pow(Math.max(0, v1), 1.30);
    const y0 = fy(u0), y1 = fy(u1);
    if (y1 < VY) continue;
    // a little stronger than the baked one was: that got its bite from the
    // dither, and a live layer does not go through it
    g.fillStyle = _ivRed(_IV_DARK, Math.max(0, 0.66 - u0 * 0.50));
    g.beginPath();
    let any = false;
    for (let cIdx = -22; cIdx < 22; cIdx++) {
      if (((cIdx + r + base) & 1) === 0) continue;
      const a0 = fx(u0, cIdx * 0.085), b0 = fx(u0, (cIdx + 1) * 0.085);
      if (b0 < -W * 0.1 || a0 > W * 1.1) continue;
      const a1 = fx(u1, cIdx * 0.085), b1 = fx(u1, (cIdx + 1) * 0.085);
      g.moveTo(a0, y0); g.lineTo(b0, y0); g.lineTo(b1, y1); g.lineTo(a1, y1);
      g.closePath();
      any = true;
    }
    if (any) g.fill();
  }
  // the long reflection of the chandelier down the lacquer, which is the thing
  // that makes a polished floor read as polished, and the line where the floor
  // meets the wall. Both sit ON the checker, so both come with it.
  let rg = _ivFloorLive._rg;
  if (!rg || _ivFloorLive._w !== W || _ivFloorLive._h !== H) {
    rg = _ivFloorLive._rg = g.createLinearGradient(0, VY, 0, H * 1.05);
    rg.addColorStop(0, 'rgba(255,86,74,0.34)');
    rg.addColorStop(0.30, 'rgba(214,28,48,0.16)');
    rg.addColorStop(1, 'rgba(138,14,30,0.0)');
    const hl = _ivFloorLive._hl = g.createLinearGradient(0, 0, W, 0);
    hl.addColorStop(0, _IV_EMBER[0]);
    hl.addColorStop(0.5, _IV_EMBER[_ivA(0.30)]);
    hl.addColorStop(1, _IV_EMBER[0]);
    _ivFloorLive._w = W; _ivFloorLive._h = H;
  }
  g.fillStyle = rg;
  g.beginPath();
  g.moveTo(VX - W * 0.020, VY);
  g.lineTo(VX + W * 0.020, VY);
  g.lineTo(VX + W * 0.135, H * 1.05);
  g.lineTo(VX - W * 0.135, H * 1.05);
  g.closePath(); g.fill();
  g.strokeStyle = _ivFloorLive._hl; g.lineWidth = W * 0.0016;
  g.beginPath(); g.moveTo(0, VY); g.lineTo(W, VY); g.stroke();
}

function _ivNearSheet(W, H, PX) {
  const c = _ivSheet(W, H, PX); c._px = PX;
  const g = c.getContext('2d');
  const [VX, VY] = _ivVP(W, H);
  const CX = VX, CY = H * 0.185;
  const S = W * 0.10;

  // ── 4. THE PIANO. A grand is a shape everybody knows, so it has to have
  //    the parts: a bent case, a raised lid whose polished UNDERSIDE is what
  //    you actually see and what the chandelier is reflected in, the plate and
  //    strings under it, a stick holding it up, a cheek at the end of the
  //    keys, and a turned leg. It is the blackest object on the page and the
  //    only one with straight edges, which is why it reads at all in a room
  //    made entirely of scrollwork.
  {
    const PL = W * 0.585, PR = W * 1.16;
    const CT = H * 0.760;                     // the case top at the near end
    const RISE = H * 0.085;                   // how far it climbs going away
    const topY = (u) => CT - RISE * u;        // u: 0 near, 1 at the right edge
    const xAt = (u) => PL + (PR - PL) * u;
    const LH = H * 0.300;                     // how high the far edge is lifted
    const LID = () => {
      g.beginPath();
      g.moveTo(xAt(0.02), topY(0.02) - H * 0.010);
      g.lineTo(xAt(1), topY(1) - LH);
      g.lineTo(xAt(1), topY(1) - LH + H * 0.046);
      g.lineTo(xAt(0.02), topY(0.02) + H * 0.024);
      g.closePath();
    };
    const CASE = () => {
      g.beginPath();
      g.moveTo(xAt(0), topY(0));
      g.lineTo(xAt(1), topY(1));
      g.lineTo(xAt(1), H * 1.03);
      g.quadraticCurveTo(xAt(0.34), H * 1.06, xAt(0), topY(0) + H * 0.115);
      g.closePath();
    };
    const KTOP = (u) => topY(u) + H * 0.014;
    const KBOT = (u) => topY(u) + H * 0.056;
    const K0 = 0.035, K1 = 1;
    const KEYS = () => {
      g.beginPath();
      g.moveTo(xAt(K0), KTOP(K0)); g.lineTo(xAt(K1), KTOP(K1));
      g.lineTo(xAt(K1), KBOT(K1)); g.lineTo(xAt(K0), KBOT(K0));
      g.closePath();
    };

    // the lid, raised: its underside faces us and it is a mirror
    g.fillStyle = _IV_LAC[24]; LID(); g.fill();
    const und = g.createLinearGradient(xAt(0.1), topY(0.1), xAt(1), topY(1) - LH);
    und.addColorStop(0, 'rgba(6,2,4,0.92)');
    und.addColorStop(0.45, 'rgba(120,12,26,0.55)');
    und.addColorStop(0.78, 'rgba(255,86,74,0.42)');
    und.addColorStop(1, 'rgba(40,5,12,0.85)');
    g.fillStyle = und; LID(); g.fill();
    g.strokeStyle = _IV_EMBER[_ivA(0.85)]; g.lineWidth = W * 0.0022;
    g.beginPath(); g.moveTo(xAt(0.02), topY(0.02) - H * 0.010); g.lineTo(xAt(1), topY(1) - LH); g.stroke();
    g.strokeStyle = _IV_BONE[_ivA(0.30)]; g.lineWidth = Math.max(1, W * 0.0008);
    g.beginPath(); g.moveTo(xAt(0.30), topY(0.30) - H * 0.096); g.lineTo(xAt(0.86), topY(0.86) - H * 0.253); g.stroke();

    // the plate and the strings, under the lid and over the case
    g.fillStyle = '#050203';
    g.beginPath();
    g.moveTo(xAt(0.05), topY(0.05));
    g.lineTo(xAt(1), topY(1) - H * 0.020);
    g.lineTo(xAt(1), topY(1) - LH + H * 0.020);
    g.lineTo(xAt(0.05), topY(0.05) + H * 0.006);
    g.closePath(); g.fill();
    for (let k = 0; k < 34; k++) {
      const v = k / 33;
      const y0 = topY(0.05) - H * 0.004 - v * H * 0.010;
      const y1 = topY(1) - H * 0.024 - v * (LH - H * 0.048);
      g.strokeStyle = (k % 7 === 0) ? _IV_EMBER[_ivA(0.34)] : _IV_BLOOD[_ivA(0.20 + (k % 3) * 0.05)];
      g.lineWidth = Math.max(1, W * (k % 7 === 0 ? 0.0014 : 0.0006));
      g.beginPath(); g.moveTo(xAt(0.05), y0); g.lineTo(xAt(1), y1); g.stroke();
    }
    g.strokeStyle = _IV_DARK[24]; g.lineWidth = W * 0.0055;
    for (const u of [0.34, 0.66]) {
      g.beginPath();
      g.moveTo(xAt(u), topY(u) - H * 0.004);
      g.lineTo(xAt(u), topY(u) - LH * u - H * 0.016);
      g.stroke();
    }
    // the stick holding the lid up
    g.strokeStyle = _IV_DARK[24]; g.lineWidth = W * 0.0035;
    g.beginPath(); g.moveTo(xAt(0.80), topY(0.80) - H * 0.006); g.lineTo(xAt(0.72), topY(0.72) - LH * 0.72 - H * 0.006); g.stroke();
    g.strokeStyle = _IV_HOT[_ivA(0.5)]; g.lineWidth = Math.max(1, W * 0.0010);
    g.beginPath(); g.moveTo(xAt(0.80), topY(0.80) - H * 0.006); g.lineTo(xAt(0.72), topY(0.72) - LH * 0.72 - H * 0.006); g.stroke();

    // the case
    g.fillStyle = _IV_LAC[24]; CASE(); g.fill();
    const cs = g.createLinearGradient(0, CT, 0, H * 1.03);
    cs.addColorStop(0, 'rgba(214,28,48,0.24)');
    cs.addColorStop(0.26, 'rgba(24,3,8,0.82)');
    cs.addColorStop(1, 'rgba(3,1,2,0.97)');
    g.fillStyle = cs; CASE(); g.fill();
    g.strokeStyle = _IV_EMBER[_ivA(0.62)]; g.lineWidth = W * 0.0020;
    g.beginPath(); g.moveTo(xAt(0), topY(0)); g.lineTo(xAt(1), topY(1)); g.stroke();

    // THE KEYS. The only pure white on the page and the reason it is spent
    // here: a keyboard is a row of teeth.
    g.fillStyle = _IV_BONE[_ivA(0.88)]; KEYS(); g.fill();
    const NK = 30;
    g.fillStyle = '#050203';
    for (let k = 0; k < NK; k++) {
      const m = k % 7;
      if (m === 2 || m === 6) continue;
      const ua = K0 + (K1 - K0) * ((k + 0.60) / NK), ub = K0 + (K1 - K0) * ((k + 1.02) / NK);
      g.beginPath();
      g.moveTo(xAt(ua), KTOP(ua)); g.lineTo(xAt(ub), KTOP(ub));
      g.lineTo(xAt(ub), KTOP(ub) + H * 0.026); g.lineTo(xAt(ua), KTOP(ua) + H * 0.026);
      g.closePath(); g.fill();
    }
    g.strokeStyle = _IV_CLOT[_ivA(0.8)]; g.lineWidth = 1;
    for (let k = 1; k < NK; k++) {
      const u = K0 + (K1 - K0) * (k / NK);
      g.beginPath(); g.moveTo(xAt(u), KTOP(u) + H * 0.026); g.lineTo(xAt(u), KBOT(u)); g.stroke();
    }
    // the cheek, and the shadow the fallboard throws across the back of them
    g.fillStyle = _IV_LAC[24];
    g.beginPath();
    g.moveTo(xAt(0), topY(0) + H * 0.006); g.lineTo(xAt(K0), KTOP(K0) - H * 0.002);
    g.lineTo(xAt(K0), KBOT(K0) + H * 0.008); g.lineTo(xAt(0), topY(0) + H * 0.070);
    g.closePath(); g.fill();
    g.strokeStyle = _IV_HOT[_ivA(0.45)]; g.lineWidth = Math.max(1, W * 0.0012);
    g.beginPath(); g.moveTo(xAt(0), topY(0) + H * 0.006); g.lineTo(xAt(K0), KTOP(K0) - H * 0.002); g.stroke();
    g.fillStyle = 'rgba(4,1,3,0.55)';
    g.beginPath();
    g.moveTo(xAt(K0), KTOP(K0)); g.lineTo(xAt(K1), KTOP(K1));
    g.lineTo(xAt(K1), KTOP(K1) + H * 0.008); g.lineTo(xAt(K0), KTOP(K0) + H * 0.008);
    g.closePath(); g.fill();

    // the leg, with the hall's own scroll at its knee
    g.fillStyle = _IV_LAC[24];
    g.beginPath();
    g.moveTo(xAt(0.055), topY(0.055) + H * 0.098);
    g.lineTo(xAt(0.115), topY(0.115) + H * 0.092);
    g.lineTo(xAt(0.100), H * 1.04);
    g.lineTo(xAt(0.048), H * 1.04);
    g.closePath(); g.fill();
    g.strokeStyle = _IV_HOT[_ivA(0.34)]; g.lineWidth = W * 0.0014;
    g.beginPath(); g.moveTo(xAt(0.055), topY(0.055) + H * 0.098); g.lineTo(xAt(0.048), H * 1.04); g.stroke();
    _ivOrnament(g, xAt(0.085), topY(0.085) + H * 0.140, -1.5707963, S * 0.40, CX, CY, _IV_PAL_MID, 61, false);
    _ivOrnament(g, xAt(0.28), topY(0.28) + H * 0.150, -0.20, S * 0.44, CX, CY, _IV_PAL_MID, 62, true);

    // and what the lacquer floor makes of the whole thing
    g.save();
    g.globalAlpha = 0.20;
    g.translate(0, (topY(0) + H * 0.115) * 2);
    g.scale(1, -1);
    g.fillStyle = _IV_LAC[20]; CASE(); g.fill();
    g.fillStyle = _IV_BONE[10]; KEYS(); g.fill();
    g.restore();
  }

  // ── 5. THE NEAR DARK: heavy ornament crowding in at the left and along the
  //    bottom, flat black, so the hall has a near plane to be seen past.
  const dr = g.createLinearGradient(0, 0, W * 0.30, 0);
  dr.addColorStop(0, _IV_CLOT[_ivA(0.62)]);
  dr.addColorStop(0.5, _IV_CLOT[_ivA(0.22)]);
  dr.addColorStop(1, _IV_CLOT[0]);
  g.fillStyle = dr; g.fillRect(0, 0, W * 0.30, H);
  for (let i = 0; i < 8; i++) {
    const y = H * (0.16 + i * 0.115);
    _ivOrnament(g, -W * 0.015, y, -0.35 + _ivRnd(i * 3.1) * 0.7, S * (0.95 + _ivRnd(i * 5.5) * 0.70),
                CX, CY, _IV_PAL_NEAR, i + 70, i & 1);
  }
  for (let i = 0; i < 5; i++) {
    _ivOrnament(g, W * (0.04 + i * 0.115), H * 1.03, -1.5707963 + (_ivRnd(i * 7.7) - 0.5) * 0.9,
                S * (0.72 + _ivRnd(i * 2.3) * 0.5), CX, CY, _IV_PAL_NEAR, i + 80, i & 1);
  }
  const vg = g.createRadialGradient(CX, CY + H * 0.14, 0, CX, CY + H * 0.14, Math.hypot(W, H) * 0.62);
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    vg.addColorStop(u, 'rgba(4,2,3,' + (0.92 * Math.pow(u, 2.2)).toFixed(3) + ')');
  }
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  _ivDither(c, 13);
  return c;
}

// ── the chandelier, drawn live because it swings, and because its candles are
//    the only thing in the hall that is actually on fire ──
// The chandelier. Its metal is eighteen scroll arms and a curtain of drops,
// all of which cost three passes each and none of which ever change: baked
// once into a sheet and blitted, with the swing applied as a rotation of the
// blit. Only the fire is drawn live, because only the fire is doing anything.
function _ivChandelierSheet(W, H, CX, CY, PX) {
  const c = _ivSheet(W, H, PX); c._px = PX;
  const g = c.getContext('2d');
  const S = W * 0.10;
  const R = W * 0.082;
  const FL = [];
  g.strokeStyle = _IV_DARK[24]; g.lineWidth = W * 0.0035;
  g.beginPath(); g.moveTo(CX, -H * 0.06); g.lineTo(CX, CY + R * 0.5); g.stroke();
  for (let tier = 0; tier < 3; tier++) {
    const ty = CY - R * 0.30 + tier * R * 0.42;
    const rr = R * (1.0 - tier * 0.26);
    const nA = 7 - tier;
    for (let i = 0; i < nA; i++) {
      const u = (i + 0.5) / nA;
      const ax = CX + (u - 0.5) * 2 * rr;
      const side = u < 0.5 ? -1 : 1;
      const n = _ivScroll(CX, ty, side > 0 ? 0.35 : Math.PI - 0.35, Math.abs(ax - CX) + R * 0.10, 0.55, side, 12);
      _ivGilt(g, _IV_PT, n, S * 0.055, S * 0.022, CX, CY, _IV_PAL_GILT);
      const ex = _IV_PT[n * 2 - 2], ey = _IV_PT[n * 2 - 1];
      FL.push(ex, ey - S * 0.055);
      g.fillStyle = _IV_BONE[_ivA(0.55)];
      g.fillRect(ex - S * 0.016, ey - S * 0.055, S * 0.032, S * 0.055);
    }
  }
  g.fillStyle = _IV_HOT[_ivA(0.62)];
  g.beginPath();
  for (let i = 0; i < 26; i++) {
    const u = (i + 0.5) / 26;
    const x = CX + (u - 0.5) * 2 * R * 1.02;
    const dy = R * (0.34 + 0.30 * Math.sin(u * 9.4 + 1.1));
    for (let k = 0; k < 3; k++) {
      const y = CY + R * 0.55 + dy * (k / 3);
      const rr = S * (0.026 - k * 0.005);
      g.moveTo(x + rr, y); g.arc(x, y, rr, 0, 6.2831853);
    }
  }
  g.fill();
  _ivOrnament(g, CX, CY + R * 0.62, -1.5707963, S * 0.72, CX, CY, _IV_PAL_GILT, 91, false);
  _ivOrnament(g, CX, CY + R * 0.62, -1.5707963, S * 0.72, CX, CY, _IV_PAL_GILT, 92, true);
  c._flames = FL;
  return c;
}

// The fire, live. `hunger` puts the candles out one at a time and relights them
// all at once, so the count of them IS the event.
function _ivChandelierFire(g, W, H, sheet, t) {
  const S = W * 0.10;
  const FL = sheet._flames;
  const n = FL.length >> 1;
  const lit = _ivDark > 0.01 ? Math.ceil(n * (1 - _ivDark)) : n;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < lit; i++) {
    const x = FL[i * 2], y = FL[i * 2 + 1];
    const f = 0.72 + Math.sin(t * (7 + (i % 5)) + i) * 0.22 + _ivPulse * 0.30;
    const hgt = S * 0.16 * f;
    g.fillStyle = _IV_HOT[_ivA(0.55)];
    g.beginPath();
    g.moveTo(x, y - hgt * 1.7);
    g.quadraticCurveTo(x + hgt * 0.55, y - hgt * 0.4, x, y + hgt * 0.15);
    g.quadraticCurveTo(x - hgt * 0.55, y - hgt * 0.4, x, y - hgt * 1.7);
    g.fill();
    g.fillStyle = _IV_FLAME[_ivA(0.75)];
    g.beginPath();
    g.moveTo(x, y - hgt * 1.0);
    g.quadraticCurveTo(x + hgt * 0.26, y - hgt * 0.25, x, y + hgt * 0.08);
    g.quadraticCurveTo(x - hgt * 0.26, y - hgt * 0.25, x, y - hgt * 1.0);
    g.fill();
  }
  g.restore();
}

// One soft glow sprite, baked, then blitted at whatever size a light needs.
// Sixteen createRadialGradient calls a frame was most of what this page cost.
function _ivGlowSprite() {
  let c = _ivGlowSprite._c;
  if (c) return c;
  c = _ivGlowSprite._c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    gg.addColorStop(u, 'rgba(255,255,255,' + Math.pow(1 - u, 2.6).toFixed(4) + ')');
  }
  g.fillStyle = gg; g.fillRect(0, 0, 64, 64);
  return c;
}

// ════════════════════════════════════════════════════════════════
// WHAT IS HAPPENING IN IT
// ════════════════════════════════════════════════════════════════
const _IV_NEARZ = 90, _IV_FARZ = 1500, _IV_FOCAL = 640;

// The glow sprite, tinted once per drain level rather than once per light.
function _ivGlowTinted() {
  const k = (_ivDrain * 8) | 0;
  if (_ivGlowTinted._k === k && _ivGlowTinted._c) return _ivGlowTinted._c;
  let c = _ivGlowTinted._c;
  if (!c) { c = _ivGlowTinted._c = document.createElement('canvas'); c.width = c.height = 64; }
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'copy';
  g.drawImage(_ivGlowSprite(), 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = _ivRed(_IV_HOT, 1);
  g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'source-over';
  _ivGlowTinted._k = k;
  return c;
}

/* THE STAR, in the sky, through the breach in the left wall.
   A core too bright to look at, a corona, and the four long diffraction spikes
   that are the reason a bright point in a dark sky reads as a star at all,
   with four short ones between them. It is clipped to the opening, so the
   spikes are cut off by the broken masonry and it reads as a thing OUT THERE
   being seen through a hole rather than a shape drawn on top of one.
   THE LIGHT RULE HOLDS: the chandelier is still the one light, and every lit
   edge in this hall is still computed from it. The star does the two things a
   real one that far away would do and no more. It glows, and it throws a shaft
   of its own light through the opening onto the floor. */
function _ivStarSky(g, W, H, t) {
  const K = _ivBreach(W, H);
  const S = _ivStarSky;
  const beat = _ivPulse;
  // it flares on its own clock, slower than the heart, so the two drift in and
  // out of phase instead of thumping together
  const flare = Math.pow(Math.max(0, Math.sin(t * 0.29)), 12);
  const pw = (1 - _ivDark * 0.35) * (1 - _ivDrain * 0.55);
  if (pw <= 0.01) return;
  const SX = K.sx, SY = K.sy;
  const R = W * (0.0125 + beat * 0.0030 + flare * 0.0052);
  const GL = _ivGlowTinted();
  const slow = _ivRM ? 0.3 : 1;

  g.save();
  _ivBreachPath(g, K); g.clip();
  _ivSkyPoly(g, K); g.clip();
  g.globalCompositeOperation = 'lighter';

  // the small ones twinkle. They are baked, so this is the only live pass over
  // them and it is one path and one fill.
  g.beginPath();
  for (let i = 0; i < 30; i++) {
    const x = K.bx1 + _ivRnd(i * 3.7 + 1) * (K.bx0 - K.bx1) * 1.2;
    const y = K.cy - H * 0.22 + _ivRnd(i * 5.3 + 4) * H * 0.46;
    const tw = Math.pow(Math.abs(Math.sin(t * (0.5 + _ivRnd(i * 8.3) * 1.6) * slow + i)), 3);
    const r = W * 0.0013 * tw;
    if (r < 0.35) continue;
    g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.2831853);
  }
  g.fillStyle = _ivRed(_IV_EMBER, 0.7 * pw);
  g.fill();

  // the halo, three passes of the one glow sprite, which is how every other
  // light in this scene is done
  for (let k = 0; k < 3; k++) {
    const hr = R * (7.5 - k * 2.2) * (1 + beat * 0.18 + flare * 0.38);
    g.globalAlpha = (0.11 + beat * 0.08 + flare * 0.14) * pw;
    g.drawImage(GL, SX - hr, SY - hr, hr * 2, hr * 2);
  }
  g.globalAlpha = 1;

  // THE PULSE, made visible: on the top of every heartbeat the star throws off
  // a ring, and it goes out across the sky and dies. Two or three alive at a
  // time. This is the difference between something that scales up and down on
  // a sine and something that is doing it ON PURPOSE.
  if (!S._rings) S._rings = [];
  if (!_ivRM && beat > 0.88 && t - (S._last || -9) > 0.55) { S._last = t; S._rings.push({ r: R * 1.5, a: 1 }); }
  for (let i = S._rings.length - 1; i >= 0; i--) {
    const q = S._rings[i];
    q.r += R * 0.62; q.a -= 0.042;
    if (q.a <= 0 || q.r > R * 30) { S._rings.splice(i, 1); continue; }
    g.strokeStyle = _ivRed(_IV_HOT, q.a * q.a * 0.42 * pw);
    g.lineWidth = Math.max(1, R * 0.13 * q.a);
    g.beginPath(); g.arc(SX, SY, q.r, 0, 6.2831853); g.stroke();
  }

  // the spikes. Four long, four short, drawn twice: a wide soft cross in the
  // hot red and a narrow hard one over it, so they have a core instead of
  // being flat triangles. They are longer than the opening is wide, so the
  // broken wall cuts them off, which is the whole point: the thing is too
  // bright to fit through the hole you are looking at it through.
  const spin = Math.sin(t * 0.09) * 0.05;
  for (let pass = 0; pass < 2; pass++) {
    const L1 = R * (15.0 + beat * 5.5 + flare * 11.0) * (pass ? 0.46 : 1);
    const L2 = R * (4.4 + beat * 1.6 + flare * 3.4) * (pass ? 0.46 : 1);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = spin + i * 0.7853982;
      const L = (i & 1) ? L2 : L1;
      const w = R * ((i & 1) ? 0.16 : 0.24) * (pass ? 0.40 : 1);
      const cx = Math.cos(a), cy = Math.sin(a);
      g.moveTo(SX + cx * L, SY + cy * L);
      g.lineTo(SX - cy * w, SY + cx * w);
      g.lineTo(SX + cy * w, SY - cx * w);
      g.closePath();
    }
    g.fillStyle = pass ? _ivRed(_IV_EMBER, (0.80 + beat * 0.20) * pw)
                       : _ivRed(_IV_HOT, (0.34 + beat * 0.26) * pw);
    g.fill();
  }

  // THE DISC, and this part is NOT additive. Stacking additive reds saturates
  // the red channel first and then keeps piling green and blue on top, so an
  // additive core goes white and then faintly cyan: the first version of this
  // was a red giant that came out looking like a headlight. Painted straight,
  // through one radial gradient the way every other light on this page is
  // done, it stays red and it still has a core you cannot look at.
  g.globalCompositeOperation = 'source-over';
  const RR = R * 1.45;
  const dg = g.createRadialGradient(SX, SY, 0, SX, SY, RR);
  dg.addColorStop(0, _IV_BONE[24]);
  dg.addColorStop(0.16, _IV_FLAME[24]);
  dg.addColorStop(0.38, _ivRed(_IV_EMBER, 1));
  dg.addColorStop(0.70, _ivRed(_IV_HOT, 0.94));
  dg.addColorStop(0.88, _ivRed(_IV_HOT, 0.45));
  dg.addColorStop(1, _ivRed(_IV_HOT, 0));
  g.fillStyle = dg;
  g.beginPath(); g.arc(SX, SY, RR, 0, 6.2831853); g.fill();
  // and the two brightest spikes carried across the disc itself, so the core
  // is a point of light and not a bead sitting in front of a cross
  g.strokeStyle = _IV_FLAME[_ivA(0.55 + beat * 0.35)];
  g.lineWidth = Math.max(1, R * 0.11);
  g.beginPath();
  g.moveTo(SX - Math.cos(spin) * R * 2.4, SY - Math.sin(spin) * R * 2.4);
  g.lineTo(SX + Math.cos(spin) * R * 2.4, SY + Math.sin(spin) * R * 2.4);
  g.moveTo(SX + Math.sin(spin) * R * 2.4, SY - Math.cos(spin) * R * 2.4);
  g.lineTo(SX - Math.sin(spin) * R * 2.4, SY + Math.cos(spin) * R * 2.4);
  g.stroke();
  g.restore();

  // and the light it puts in the room: the halo blooming a little past the
  // broken lip, because a bright thing behind a hole does exactly that, and
  // the shaft it throws down onto the floor
  g.save();
  g.globalCompositeOperation = 'lighter';
  const hr = R * 9 * (1 + beat * 0.2 + flare * 0.5);
  g.globalAlpha = (0.05 + beat * 0.04 + flare * 0.09) * pw;
  g.drawImage(GL, SX - hr, SY - hr, hr * 2, hr * 2);
  g.globalAlpha = 1;
  // A shaft, cast from the opening down into the room along the direction the
  // starlight is actually travelling. Narrow and bright at the lip, wide and
  // gone by the time it reaches the floor, which is what a beam of light in
  // dusty air does and what a flat wash over the floorboards does not.
  const dx = 0.80, dy = 0.60, L = H * 0.95;
  const beam = (spread, alpha) => {
    const sh = g.createLinearGradient(K.bx0, K.by0, K.bx0 + dx * L, K.by0 + dy * L);
    sh.addColorStop(0, _ivRed(_IV_HOT, alpha * pw));
    sh.addColorStop(0.42, _ivRed(_IV_HOT, alpha * 0.42 * pw));
    sh.addColorStop(1, _ivRed(_IV_HOT, 0));
    g.fillStyle = sh;
    const mx = (K.bx0 + K.bx1) * 0.5, my = (K.by0 + K.by1) * 0.5;
    const ax = K.bx0 + (mx - K.bx0) * (1 - spread), ay = K.by0 + (my - K.by0) * (1 - spread);
    const bx = K.bx1 + (mx - K.bx1) * (1 - spread), by = K.by1 + (my - K.by1) * (1 - spread);
    g.beginPath();
    g.moveTo(ax, ay); g.lineTo(bx, by);
    g.lineTo(bx + dx * L * 1.20, by + dy * L * 1.20);
    g.lineTo(ax + dx * L * 0.80, ay + dy * L * 1.20);
    g.closePath(); g.fill();
  };
  beam(1.00, 0.055 + beat * 0.035 + flare * 0.075);
  beam(0.40, 0.075 + beat * 0.050 + flare * 0.110);
  g.restore();
}


/* The star, laid over the vignette. Everything else in this hall is behind the
   near dark and should be: the vignette is the room closing in. A star is not
   in the room. So its core and the tightest ring of its halo go on afterwards,
   which is the only reason it reads as the brightest thing in the picture
   instead of as a warm grey dot. Small, additive, clipped to the sky. */
function _ivStarBurn(g, W, H, t) {
  const K = _ivBreach(W, H);
  const beat = _ivPulse;
  const flare = Math.pow(Math.max(0, Math.sin(t * 0.29)), 12);
  const pw = (1 - _ivDark * 0.35) * (1 - _ivDrain * 0.55);
  if (pw <= 0.01) return;
  const R = W * (0.0125 + beat * 0.0030 + flare * 0.0052);
  g.save();
  _ivBreachPath(g, K); g.clip();
  _ivSkyPoly(g, K); g.clip();
  g.globalCompositeOperation = 'lighter';
  const hr = R * 3.2 * (1 + beat * 0.2 + flare * 0.4);
  g.globalAlpha = (0.34 + beat * 0.20 + flare * 0.26) * pw;
  g.drawImage(_ivGlowTinted(), K.sx - hr, K.sy - hr, hr * 2, hr * 2);
  g.globalAlpha = 1;
  g.fillStyle = _IV_FLAME[_ivA((0.72 + beat * 0.28) * pw)];
  g.beginPath(); g.arc(K.sx, K.sy, R * 0.44, 0, 6.2831853); g.fill();
  g.fillStyle = _IV_BONE[_ivA((0.60 + beat * 0.40) * pw)];
  g.beginPath(); g.arc(K.sx, K.sy, R * 0.20, 0, 6.2831853); g.fill();
  g.restore();
}

function _drawIvyEvilPattern(canvas, ctx, W, H, t) {
  if (!(W > 0 && H > 0)) return;
  // The `>= 0` matters: a clock that jumps BACKWARDS leaves t - _lt hugely
  // negative, which passes a bare `< 0.033` and freezes the layer for good.
  if (_drawIvyEvilPattern._lt !== undefined && t - _drawIvyEvilPattern._lt >= 0
      && t - _drawIvyEvilPattern._lt < 0.033) return;
  const dt = _drawIvyEvilPattern._lt === undefined ? 0.016 : Math.min(Math.abs(t - _drawIvyEvilPattern._lt), 0.05);
  _drawIvyEvilPattern._lt = t;

  const P = _drawIvyEvilPattern;
  const PX = _ivPX(W);
  const [VX, VY] = _ivVP(W, H);
  const ev = _ivEvTick(t);

  // ── THE HEARTBEAT. Two thumps, then a wait. Every layer on both canvases
  //    reads it, which is what ties a page of separate effects into one body.
  const hb = (t * 0.70) % 1;
  _ivPulse = Math.max(Math.exp(-hb * 15), Math.exp(-Math.max(0, hb - 0.17) * 15) * 0.66);

  // ── the states the events drive, which both layers read ──
  _ivDrain = (ev && ev.name === 'bleed')
    ? (ev.p < 0.28 ? ev.p / 0.28 : ev.p < 0.56 ? 1 : 1 - (ev.p - 0.56) / 0.44)
    : _ivDrain + (0 - _ivDrain) * Math.min(1, dt * 4);
  _ivDark = (ev && ev.name === 'hunger')
    ? (ev.p < 0.68 ? ev.p / 0.68 : 0)
    : _ivDark + (0 - _ivDark) * Math.min(1, dt * 9);
  _ivSwing = (ev && ev.name === 'sweep')
    ? Math.sin(ev.p * 6.2831853 * 1.5) * Math.sin(Math.PI * ev.p)
    : _ivSwing + (0 - _ivSwing) * Math.min(1, dt * 2.4);
  _ivGrow = (ev && ev.name === 'rococo')
    ? Math.sin(Math.PI * Math.min(1, ev.p / 0.88))
    : _ivGrow + (0 - _ivGrow) * Math.min(1, dt * 3);
  _ivCrack = (ev && ev.name === 'shatter')
    ? (ev.p < 0.22 ? ev.p / 0.22 : ev.p < 0.68 ? 1 : 1 - (ev.p - 0.68) / 0.32)
    : 0;
  if (ev && ev.name === 'lunge' && P._lungeFor !== ev.t0) {
    P._lungeFor = ev.t0;
    _ivCutFire((window.innerWidth || W) * (0.30 + ev.r1 * 0.45),
               (window.innerHeight || H) * (0.28 + ev.r2 * 0.44), null, ev.t0 * 13.7);
  }

  const CX0 = VX, CY = H * 0.185;
  const CX = CX0 + _ivSwing * W * 0.055;              // the light itself moves

  if (P._w !== W || P._h !== H) {
    P._void = _ivVoidSheet(W, H, CX0, CY, PX);
    P._hall = _ivHallSheet(W, H, PX);
    P._near = _ivNearSheet(W, H, PX);
    P._chand = _ivChandelierSheet(W, H, CX0, CY, PX);
    P._motes = null;
    P._w = W; P._h = H;
  }
  if (!P._motes) {
    const m = [];
    for (let i = 0; i < 270; i++) {
      m.push({ x: (_ivRnd(i * 3.1) - 0.5) * W * 2.4, y: (_ivRnd(i * 5.7) - 0.5) * H * 2.0,
               z: _IV_NEARZ + _ivRnd(i * 7.3) * (_IV_FARZ - _IV_NEARZ),
               v: 70 + _ivRnd(i * 9.1) * 260, s: 1.6 + _ivRnd(i * 2.7) * 4.2,
               ph: _ivRnd(i * 4.4) * 6.283 });
    }
    P._motes = m;
    P._drips = [];
    P._rings = [];
    P._lastHb = 0;
  }

  const lo = _ivLo(canvas, '_iv', W, H, PX);
  const lg = lo._g;
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.clearRect(0, 0, lo.width, lo.height);
  lg.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  lg.lineJoin = 'round'; lg.lineCap = 'round';
  lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1;
  const BL = (sheet) => { lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.drawImage(sheet, 0, 0); lg.restore(); };

  // ── the void, breathing on the heartbeat ──
  BL(P._void);
  lg.save();
  lg.globalCompositeOperation = 'lighter';
  lg.globalAlpha = (0.05 + _ivPulse * 0.26) * (1 - _ivDark * 0.9) * (1 - _ivDrain * 0.75);
  BL(P._void);
  lg.restore();

  BL(P._hall);
  _ivFloorLive(lg, W, H, t);
  _ivStarSky(lg, W, H, t);
  _ivEvBack(lg, ev, W, H, VX, VY, CX, CY, t);

  // ── the light the chandelier is actually throwing, which moves when it does ──
  {
    const R = Math.hypot(W, H) * 0.55;
    const gg = lg.createRadialGradient(CX, CY, 0, CX, CY, R);
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      gg.addColorStop(u, _ivRed(_IV_HOT, 0.09 * (1 + _ivPulse * 0.8) * (1 - _ivDark) * Math.pow(1 - u, 3.0)));
    }
    lg.save();
    lg.globalCompositeOperation = 'lighter';
    lg.fillStyle = gg;
    lg.fillRect(CX - R, CY - R, R * 2, R * 2);
    lg.restore();
  }

  // ── DRIPS. The chandelier is not only burning, it is running. Each drop
  //    falls, lands on the lacquer, and leaves a ring in the reflection.
  if (P._drips.length < 14 && _ivRnd((t * 4) | 0) > 0.86 && _ivDark < 0.5) {
    P._drips.push({ x: CX + (_ivRnd(t * 31.1) - 0.5) * W * 0.14, y: CY + H * 0.05, v: 0 });
  }
  lg.beginPath();
  for (let i = P._drips.length - 1; i >= 0; i--) {
    const d = P._drips[i];
    d.v += 900 * dt; d.y += d.v * dt;
    const ground = _ivFloorY(H, VY, 0.30);
    if (d.y >= ground) {
      P._rings.push({ x: d.x, y: ground, r: 0, a: 1 });
      P._drips.splice(i, 1); continue;
    }
    lg.moveTo(d.x, d.y - 5); lg.lineTo(d.x, d.y + 5);
  }
  lg.strokeStyle = _ivRed(_IV_HOT, 0.85); lg.lineWidth = Math.max(1.5, W * 0.0022); lg.stroke();
  for (let i = P._rings.length - 1; i >= 0; i--) {
    const r = P._rings[i];
    r.r += W * 0.10 * dt; r.a -= dt * 0.9;
    if (r.a <= 0) { P._rings.splice(i, 1); continue; }
    lg.strokeStyle = _ivRed(_IV_EMBER, r.a * 0.5);
    lg.lineWidth = Math.max(1, W * 0.0014);
    lg.beginPath();
    lg.ellipse(r.x, r.y, r.r, r.r * 0.26, 0, 0, 6.2831853);
    lg.stroke();
  }

  // ── the ring the heartbeat throws off, out across the whole hall ──
  if (_ivPulse > 0.90 && t - P._lastHb > 0.5) { P._lastHb = t; P._rings.push({ x: CX, y: CY, r: 0, a: 0.7, big: 1 }); }
  for (const r of P._rings) {
    if (!r.big) continue;
    r.r += W * 1.5 * dt;
    lg.save();
    lg.globalCompositeOperation = 'lighter';
    lg.strokeStyle = _ivRed(_IV_HOT, r.a * 0.30 * (1 - _ivDrain));
    lg.lineWidth = Math.max(1, W * 0.0026);
    lg.beginPath(); lg.arc(r.x, r.y, r.r, 0, 6.2831853); lg.stroke();
    lg.restore();
  }

  // ── THE EMBERS. Real z, projected on the vanishing point, coming at the
  //    camera. Three sheets at three speeds is a parallax trick and reads as
  //    one; giving every mote a z and projecting it reads as a space you are
  //    standing in.
  lg.save();
  lg.globalCompositeOperation = 'lighter';
  lg.beginPath();
  const speed = (1 + _ivPulse * 1.2) * (_ivRM ? 0.35 : 1);
  for (const m of P._motes) {
    m.z -= m.v * dt * speed;
    if (m.z < _IV_NEARZ) { m.z = _IV_FARZ; m.x = (Math.random() - 0.5) * W * 2.4; m.y = (Math.random() - 0.5) * H * 2.0; }
    const k = _IV_FOCAL / m.z;
    const sx = VX + m.x * k, sy = VY + m.y * k + Math.sin(t * 1.6 + m.ph) * 3;
    if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
    const r = Math.max(PX * 0.5, m.s * k);
    lg.rect(sx - r, sy - r, r * 2, r * 2);
  }
  lg.fillStyle = _ivRed(_IV_EMBER, (0.30 + _ivPulse * 0.26) * (1 - _ivDark * 0.7));
  lg.fill();
  lg.restore();

  // ── the sconces: sixteen small fires going away down both walls, which is
  //    what turns a corridor of flat panels into a hall with a length to it ──
  if (!P._sc) P._sc = _ivSconces(W, H);
  const GLOW = _ivGlowTinted();
  lg.save();
  lg.globalCompositeOperation = 'lighter';
  const scLit = 1 - _ivDark;
  for (const sc of P._sc) {
    if (scLit <= 0.02) break;
    const f = (0.66 + Math.sin(t * (5.5 + (sc.i % 4) * 1.7) + sc.i * 2.1) * 0.24 + _ivPulse * 0.34) * scLit;
    const hgt = W * 0.0090 * sc.s * f;
    const R = hgt * 7;
    lg.save();
    lg.globalAlpha = 0.40 * f;
    lg.drawImage(GLOW, sc.x - R, sc.y - R, R * 2, R * 2);
    lg.restore();
    lg.fillStyle = _ivRed(_IV_HOT, 0.75);
    lg.beginPath();
    lg.moveTo(sc.x, sc.y - hgt * 2.0);
    lg.quadraticCurveTo(sc.x + hgt * 0.7, sc.y - hgt * 0.5, sc.x, sc.y + hgt * 0.2);
    lg.quadraticCurveTo(sc.x - hgt * 0.7, sc.y - hgt * 0.5, sc.x, sc.y - hgt * 2.0);
    lg.fill();
    lg.fillStyle = _ivRed(_IV_FLAME, 0.85);
    lg.beginPath();
    lg.moveTo(sc.x, sc.y - hgt * 1.15);
    lg.quadraticCurveTo(sc.x + hgt * 0.30, sc.y - hgt * 0.3, sc.x, sc.y + hgt * 0.10);
    lg.quadraticCurveTo(sc.x - hgt * 0.30, sc.y - hgt * 0.3, sc.x, sc.y - hgt * 1.15);
    lg.fill();
  }
  lg.restore();

  // ── the chandelier itself ──
  lg.save();
  if (_ivSwing !== 0) { lg.translate(CX0, CY - H * 0.22); lg.rotate(_ivSwing * 0.13); lg.translate(-CX0, -(CY - H * 0.22)); }
  lg.save(); lg.scale(PX, PX); lg.drawImage(P._chand, 0, 0); lg.restore();
  _ivChandelierFire(lg, W, H, P._chand, t);
  lg.restore();

  BL(P._near);
  _ivStarBurn(lg, W, H, t);
  _ivEvFront(lg, ev, W, H, VX, VY, CX, CY, t);

  if (_ivDark > 0.01) {
    lg.fillStyle = 'rgba(3,1,2,' + (_ivDark * 0.72).toFixed(3) + ')';
    lg.fillRect(0, 0, W, H);
  }
  let cutGlow = 0;
  for (const c of _ivCuts) if (c.p > 0 && c.p < 1) cutGlow = Math.max(cutGlow, 1 - c.p);
  _ivBloom(canvas, lo, 0.15 + _ivPulse * 0.14 + cutGlow * 0.45);

  // ── up, with the smoothing off, which is the whole point ──
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lo, 0, 0, lo.width, lo.height, 0, 0, lo.width * PX, lo.height * PX);
  ctx.imageSmoothingEnabled = true;
}

// ── events that belong to the hall, drawn between the floor and the piano ──
function _ivEvBack(g, ev, W, H, VX, VY, CX, CY, t) {
  if (!ev) return;

  // WALTZ. Two of them turning through the hall in three time, and the lacquer
  // has them too. Nobody is drawn: two lights and a reflection is enough, and
  // a figure would be a picture of the character instead of a place.
  if (ev.name === 'waltz') {
    const q = ev.p;
    const a = q < 0.14 ? q / 0.14 : q > 0.80 ? (1 - q) / 0.20 : 1;
    const turn = q * 6.2831853 * 2.2;
    const path = 0.18 + q * 0.55;                       // they come toward you
    const cx = VX + Math.sin(q * 3.1 + 0.6) * W * 0.16;
    const cy = _ivFloorY(H, VY, path);
    const rr = W * (0.020 + path * 0.055);
    g.save();
    g.globalCompositeOperation = 'lighter';
    // the figure they have been cutting into the floor for the last second
    for (let k = 0; k < 2; k++) {
      g.strokeStyle = _ivRed(k ? _IV_BONE : _IV_EMBER, a * 0.26);
      g.lineWidth = Math.max(1, W * 0.0022);
      g.beginPath();
      for (let i = 0; i <= 22; i++) {
        const qq = Math.max(0, q - (1 - i / 22) * 0.16);
        const tn = qq * 6.2831853 * 2.2 + k * 3.1415927;
        const pth = 0.18 + qq * 0.55;
        const ccx = VX + Math.sin(qq * 3.1 + 0.6) * W * 0.16;
        const ccy = _ivFloorY(H, VY, pth);
        const r2 = W * (0.020 + pth * 0.055);
        const xx = ccx + Math.cos(tn) * r2, yy = ccy + Math.sin(tn) * r2 * 0.32;
        if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const ang = turn + k * 3.1415927;
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.32;
      const s = W * (0.007 + path * 0.018);
      g.fillStyle = _ivRed(k ? _IV_BONE : _IV_EMBER, a * 0.95);
      g.beginPath(); g.ellipse(x, y - s * 3.0, s * 0.85, s * 2.6, 0, 0, 6.2831853); g.fill();
      const gg2 = g.createRadialGradient(x, y - s * 2.2, 0, x, y - s * 2.2, s * 7);
      gg2.addColorStop(0, _ivRed(k ? _IV_BONE : _IV_EMBER, a * 0.34));
      gg2.addColorStop(1, _ivRed(_IV_HOT, 0));
      g.fillStyle = gg2;
      g.fillRect(x - s * 7, y - s * 9, s * 14, s * 14);
      g.globalAlpha = 0.34;
      g.fillStyle = _ivRed(k ? _IV_BONE : _IV_EMBER, a * 0.7);
      g.beginPath(); g.ellipse(x, y + s * 3.2, s * 0.7, s * 2.2, 0, 0, 6.2831853); g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
  }

  // SWEEP. The light has moved, so there is a bright band lying across the
  // floor where it now points, and it travels.
  if (ev.name === 'sweep') {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const lgd = g.createLinearGradient(CX - W * 0.20, 0, CX + W * 0.20, 0);
    const env = Math.sin(Math.PI * ev.p);
    lgd.addColorStop(0, _ivRed(_IV_HOT, 0));
    lgd.addColorStop(0.5, _ivRed(_IV_EMBER, 0.46 * env));
    lgd.addColorStop(1, _ivRed(_IV_HOT, 0));
    g.fillStyle = lgd;
    g.beginPath();
    g.moveTo(CX - W * 0.035, VY); g.lineTo(CX + W * 0.035, VY);
    g.lineTo(CX + W * 0.30, H * 1.05); g.lineTo(CX - W * 0.30, H * 1.05);
    g.closePath(); g.fill();
    // and the near wall it is raking, so the light is somewhere and not just
    // a brighter patch of floor
    const wg = g.createRadialGradient(CX, VY - H * 0.10, 0, CX, VY - H * 0.10, W * 0.34);
    wg.addColorStop(0, _ivRed(_IV_EMBER, 0.30 * env));
    wg.addColorStop(1, _ivRed(_IV_EMBER, 0));
    g.fillStyle = wg;
    g.fillRect(CX - W * 0.34, VY - H * 0.44, W * 0.68, H * 0.44);
    g.restore();
  }
}

// ── events that cross the glass, drawn over everything in the hall ──
function _ivEvFront(g, ev, W, H, VX, VY, CX, CY, t) {
  // ROCOCO. The ornament grows in over the picture, four more of it from the
  // sides, and lets go again. The window frame does the same thing at the same
  // moment, so the two layers are in the event together.
  if (_ivGrow > 0.01) {
    const S = W * 0.10 * _ivGrow;
    for (let i = 0; i < 6; i++) {
      const side = i & 1;
      const y = H * (0.16 + (i >> 1) * 0.30);
      _ivOrnament(g, side ? W * 1.01 : -W * 0.01, y, side ? Math.PI + 0.4 : -0.4,
                  S * (0.9 + _ivRnd(i * 5.1) * 0.6), CX, CY, _IV_PAL_MID, i + 130, side);
    }
  }

  // SHATTER. A crack spiders across the world and heals. Rolled once when the
  // event starts, so it is the same crack all the way through.
  if (_ivCrack > 0.01 && ev) {
    const F = _ivEvFront;
    if (F._crackFor !== ev.t0) {
      F._crackFor = ev.t0;
      const seg = [];
      const ox = W * (0.2 + ev.r0 * 0.6), oy = H * (0.2 + ev.r1 * 0.6);
      for (let b = 0; b < 9; b++) {
        let x = ox, y = oy, a = ev.r2 * 6.283 + b * 0.7;
        const st = [];
        for (let k = 0; k < 7; k++) {
          st.push(x, y);
          a += (_ivRnd(b * 13.1 + k * 3.7) - 0.5) * 1.2;
          const L = Math.hypot(W, H) * (0.05 + _ivRnd(b * 2.3 + k) * 0.09);
          x += Math.cos(a) * L; y += Math.sin(a) * L;
        }
        st.push(x, y);
        seg.push(st);
      }
      F._crack = seg;
    }
    const grow = Math.min(1, _ivCrack * 1.4);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const st of F._crack) {
      const n = Math.max(2, (grow * (st.length / 2)) | 0);
      g.beginPath();
      g.moveTo(st[0], st[1]);
      for (let k = 1; k < n; k++) g.lineTo(st[k * 2], st[k * 2 + 1]);
      g.strokeStyle = _ivRed(_IV_EMBER, _ivCrack * 0.55); g.lineWidth = Math.max(1, W * 0.0030); g.stroke();
      g.strokeStyle = _IV_BONE[_ivA(_ivCrack * 0.60)]; g.lineWidth = Math.max(1, W * 0.0012); g.stroke();
    }
    g.restore();
  }

  // HUNGER. The candles have all gone out, and they come back at once.
  if (ev && ev.name === 'hunger' && ev.p > 0.68) {
    const f = Math.pow(1 - (ev.p - 0.68) / 0.32, 2.2);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = _ivRed(_IV_EMBER, f * 0.85);
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  // LUNGE. The cuts are held in WINDOW coordinates because they go through the
  // application as well; the picture converts them into its own space so the
  // same wound crosses both layers in the same frame.
  if (_ivCuts.length) {
    if (!_ivEvFront._pc || !_ivEvFront._pc.isConnected) _ivEvFront._pc = _worldCanvas();
    const r = _ivEvFront._pc ? _lyRect(_ivEvFront._pc) : null;
    const sx = r && r.width > 0 ? W / r.width : 1, sy = r && r.height > 0 ? H / r.height : 1;
    const ox = r ? r.left : 0, oy = r ? r.top : 0;
    for (const c of _ivCuts) _ivCutDraw(g, c, W, H, _ivPX(W), sx, sy, ox, oy);
  }
}


// ════════════════════════════════════════════════════════════════
// TEARING THE INTERFACE APART
//
// A clean gap is not a tear. What makes an interface look TORN is
// three things happening at once, and the first version had one of
// them.
//
// 1. THE RIP IS RAGGED. The hole taken out of each element is a
//    walked, jittering band with bites out of its edges and a few
//    chunks missing entirely, not a ruled slot. It is built as an
//    SVG path and handed to `mask-image` as a data URL: a string,
//    so it costs microseconds to build and renders crisp at any
//    size, where a rasterised mask would have to be encoded as a
//    PNG several times a second.
//
// 2. THE PIECES MOVE. Every element gets a translate away from the
//    cut, on the side of it that element's middle falls on, plus a
//    shear along the cut. The panels, the sidebar, the header and
//    the music bar all shift against each other, so the whole
//    application comes apart rather than developing a slot.
//
// 3. SOMETHING COMES OFF. Shards in the panels' own colour tumble
//    out of the wound and fall, and the exposed faces burn.
//
// The mask is built once in WINDOW space and placed on each element
// with mask-size and a negative mask-position, so a single string
// lands the same cut on four boxes of four different sizes. Get
// that wrong and every element gets its own private diagonal.
// ════════════════════════════════════════════════════════════════
const _IV_CUT_KINDS = ['single', 'single', 'cross', 'flurry', 'flurry', 'wide', 'shred'];
let _ivCuts = [];              // live cuts, in window coordinates
let _ivCutLast = '';
let _ivShards = [];

// The rip's own shape, rolled once when the cut starts so it is the same rip
// all the way through: a walked centreline, a half width per point that varies
// along it, and a few bites taken out of the edge.
function _ivTearBuild(c, W, H) {
  const N = 30;
  const dx = c.x1 - c.x0, dy = c.y1 - c.y0, m = Math.hypot(dx, dy) || 1;
  const nx = -dy / m, ny = dx / m;
  c.nx = nx; c.ny = ny;
  const D = Math.hypot(W, H);
  c.pts = new Float32Array((N + 1) * 2);
  c.hw = new Float32Array(N + 1);
  let wob = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    wob += (_ivRnd(c.seed * 3.1 + i * 7.7) - 0.5) * D * 0.010;
    wob *= 0.72;                                   // it wanders but comes back
    const off = wob + (_ivRnd(c.seed * 1.7 + i * 2.3) - 0.5) * D * 0.006;
    c.pts[i * 2] = c.x0 + dx * u + nx * off;
    c.pts[i * 2 + 1] = c.y0 + dy * u + ny * off;
    c.hw[i] = 0.45 + _ivRnd(c.seed * 5.3 + i * 3.7) * 1.25
            + (_ivRnd(c.seed * 9.1 + i) > 0.86 ? 1.6 : 0);   // the odd big bite
  }
  c.n = N + 1;
  c.bites = [];
  for (let k = 0; k < 7; k++) {
    c.bites.push({ u: _ivRnd(c.seed * 11.3 + k * 4.1),
                   s: _ivRnd(c.seed * 13.7 + k) > 0.5 ? 1 : -1,
                   r: 0.7 + _ivRnd(c.seed * 17.1 + k) * 1.9,
                   o: 0.6 + _ivRnd(c.seed * 19.3 + k) * 1.4 });
  }
}

function _ivCutFire(cx, cy, kind, seed) {
  const W = window.innerWidth || 1600, H = window.innerHeight || 900;
  const L = Math.hypot(W, H) * 1.2;
  if (!kind) {
    for (let i = 0; i < 12; i++) {
      kind = _IV_CUT_KINDS[(_ivRnd(seed * 7.7 + i * 3.1) * _IV_CUT_KINDS.length) | 0];
      if (kind !== _ivCutLast) break;
    }
  }
  _ivCutLast = kind;
  const base = (_ivRnd(seed * 3.3) - 0.5) * 2.4;
  const add = (a, off, delay, w) => {
    const px = cx - Math.sin(a) * off, py = cy + Math.cos(a) * off;
    const c = { a: a, x: px, y: py,
                x0: px - Math.cos(a) * L, y0: py - Math.sin(a) * L,
                x1: px + Math.cos(a) * L, y1: py + Math.sin(a) * L,
                t0: -delay, p: 0, w: w || 1, seed: seed * 7.3 + off * 0.017 + delay * 31 };
    _ivTearBuild(c, W, H);
    _ivCuts.push(c);
  };
  if (kind === 'single') add(base, 0, 0, 1.1);
  else if (kind === 'wide') add(base, 0, 0, 2.4);
  else if (kind === 'cross') { add(base, 0, 0, 1.2); add(base + 1.5707963, 0, 0.10, 1.2); }
  else if (kind === 'shred') {
    for (let i = 0; i < 6; i++) {
      add(base + (_ivRnd(seed + i * 2.7) - 0.5) * 1.9,
          (_ivRnd(seed * 2.1 + i) - 0.5) * Math.min(W, H) * 0.75, i * 0.055, 0.75);
    }
  } else {
    const n = 3 + ((_ivRnd(seed * 5.1) * 2) | 0);
    for (let i = 0; i < n; i++) add(base + (_ivRnd(seed + i) - 0.5) * 0.28,
                                    (i - (n - 1) * 0.5) * Math.min(W, H) * 0.125, i * 0.06, 0.9);
  }
  _ivCutApply();
}

/* How far apart the two sides have been pulled RIGHT NOW: the only thing about
   a cut that is allowed to animate.
   Snap, HOLD, then settle. The first version went straight from the snap into
   a steady decay and the whole thing was over before you had looked at it: a
   wound wants to sit there. It is held wide for a third of its life and then
   takes the remaining two thirds to close, rocking a little as it seats,
   because two heavy pieces that have been knocked apart do not glide back into
   line. */
function _ivCutOpen(c) {
  if (c.p < 0 || c.p > 1) return 0;
  if (c.p < 0.05) return c.p / 0.05;
  if (c.p < 0.34) return 1;
  const u = (c.p - 0.34) / 0.66;
  return Math.max(0, Math.pow(1 - u, 1.7) * (1 + 0.16 * Math.sin(u * 13)));
}
// The rip itself is a fixed width. It is a cut: it happens in one frame.
function _ivRipGap(c, D) { return D * 0.0115 * c.w; }

/* The mask is built ONCE per burst and taken off once.
   Rebuilding it as the wound widened meant a fresh data URL twenty times a
   second, and every one of those is a new image the browser has to re-rasterise
   before it can composite the element: the page flickered, because for a frame
   at a time elements were being drawn with no mask at all. It also modelled the
   wrong thing. A cut is instantaneous; the hole does not grow. What grows is
   the SEPARATION of the two pieces, and that is a transform, which is free to
   animate and never re-rasterises anything. */
function _ivTearSVG(W, H) {
  let d = 'M0 0H' + W + 'V' + H + 'H0Z';
  let any = false;
  const D = Math.hypot(W, H);
  for (const c of _ivCuts) {
    if (!c.pts) continue;
    any = true;
    const gap = _ivRipGap(c, D);
    let f = '', b = '';
    for (let i = 0; i < c.n; i++) {
      const hw = gap * c.hw[i];
      const x = c.pts[i * 2], y = c.pts[i * 2 + 1];
      f += (i ? 'L' : 'M') + (x + c.nx * hw).toFixed(1) + ' ' + (y + c.ny * hw).toFixed(1);
      b = 'L' + (x - c.nx * hw).toFixed(1) + ' ' + (y - c.ny * hw).toFixed(1) + b;
    }
    d += f + b + 'Z';
    for (const bt of c.bites) {
      const i = Math.min(c.n - 1, (bt.u * (c.n - 1)) | 0);
      const r = gap * bt.r * 1.05 * bt.o;
      const x = c.pts[i * 2] + c.nx * (gap * c.hw[i] + r * 0.45) * bt.s;
      const y = c.pts[i * 2 + 1] + c.ny * (gap * c.hw[i] + r * 0.45) * bt.s;
      d += 'M' + (x - r).toFixed(1) + ' ' + y.toFixed(1) +
           'a' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 1 0 ' + (r * 2).toFixed(1) + ' 0' +
           'a' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 1 0 ' + (-r * 2).toFixed(1) + ' 0Z';
    }
  }
  if (!any) return null;
  return 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
    '<path fill="#fff" fill-rule="evenodd" d="' + d + '"/></svg>') + '")';
}

// The list of everything that gets torn: the four containers, then the blocks
// inside the card, which are shoved harder because they are what you are
// looking at. Nothing repeated per character: an effect on .char-entry is one
// element per character in the sidebar.
function _ivCutTargets() {
  // [port] the sheet, the list, the header and the music bar, then the panels,
  // portrait, name and tabs inside the sheet: see pages/host.ts
  return _interfaceTargets(1.55);
}

// Put the hole through the interface. Once.
function _ivCutApply() {
  if (_ivRM) return;
  const W = window.innerWidth || 1600, H = window.innerHeight || 900;
  const url = _ivTearSVG(W, H);
  _ivCutTargets().forEach(function (t) {
    const el = t[0];
    const s = _ivFxBox(el, _ivFxState(el));
    if (!el._ivBase) el._ivBase = { left: s.bx, top: s.by, width: s.bw, height: s.bh };
    if (!url) return;
    el.style.webkitMaskImage = url; el.style.maskImage = url;
    el.style.webkitMaskRepeat = 'no-repeat'; el.style.maskRepeat = 'no-repeat';
    el.style.webkitMaskSize = W + 'px ' + H + 'px'; el.style.maskSize = W + 'px ' + H + 'px';
    const b = el._ivBase;
    const px = (-b.left).toFixed(1) + 'px ' + (-b.top).toFixed(1) + 'px';
    el.style.webkitMaskPosition = px; el.style.maskPosition = px;
  });
}

/* THE SWAY, and the red left behind it.
   The hall breathes on the heartbeat, the chandelier swings, the floor marches;
   the interface sat perfectly still on top of all of it, which is what made it
   read as a screenshot pasted over a picture rather than as something in the
   room. So it moves too, on the same heartbeat.
   ONE function owns `transform` on these elements. The tear already wrote it,
   and two writers on one property is a fight nobody wins, so the sway and the
   shove are summed here and written once.
   A transform is a compositor property: animating it costs no layout and no
   repaint, which is the only reason a dozen panels can move every frame. The
   moment this reaches for `left`, `filter` or `box-shadow` instead, it becomes
   a full relayout of the page at 70 frames a second.
   Amplitude is deliberately small. Tipping every straight line on a page at
   once is the difference between a page that feels alive and a page that makes
   the reader ill, and the manual has that lesson written in blood already. */
const _IV_ECHO_N = 34;                 // frames of position history kept per panel

// The target list, and the boxes to measure it against. Rebuilt twice a second
// rather than every frame: querySelectorAll is not free, and panels do not come
// and go at 70 Hz.
let _ivFxList = null, _ivFxAt = -9;
let _ivFxSeen = [];                    // everything a transform has ever been written to
function _ivFxTargets(t) {
  if (_ivFxList && t - _ivFxAt >= 0 && t - _ivFxAt < 0.5) return _ivFxList;
  _ivFxAt = t;
  const out = _ivCutTargets();
  for (const e of out) if (_ivFxSeen.indexOf(e[0]) < 0) _ivFxSeen.push(e[0]);
  if (_ivFxSeen.length > 120) _ivFxSeen = _ivFxSeen.slice(-60);
  return (_ivFxList = out);
}

// An element's box with OUR OWN transform taken back out of it.
// getBoundingClientRect reports the box as transformed, so measuring a panel we
// are already swaying and then swaying it from that measurement walks it off
// the screen. _lyRect only re-reads when the layout generation changes, and
// when it does the transform in effect is the one written on the previous
// frame, which is the one recorded here.
function _ivFxBox(el, s) {
  if (el._lyG !== _lyGen || !s.bw) {
    const r = _lyRect(el);
    s.bx = r.left - s.tx; s.by = r.top - s.ty; s.bw = r.width; s.bh = r.height;
  }
  return s;
}
function _ivFxState(el) {
  // three floats a sample: where it was, and how long that frame took. The
  // duration is what lets the echo be read back at a fixed number of
  // MILLISECONDS behind rather than a fixed number of frames, so the trail is
  // the same length on a 30 Hz laptop and a 144 Hz monitor.
  return el._ivFx || (el._ivFx = { tx: 0, ty: 0, wx: 9e9, wy: 9e9,
                                   bx: 0, by: 0, bw: 0, bh: 0,
                                   h: new Float32Array(_IV_ECHO_N * 3), i: 0, n: 0 });
}

// the sample this far behind the head, by time
function _ivEchoBack(s, lag) {
  let acc = 0, j = (s.i - 1 + _IV_ECHO_N) % _IV_ECHO_N;
  for (let c = 1; c < s.n; c++) {
    acc += s.h[j * 3 + 2];
    if (acc >= lag) break;
    j = (j - 1 + _IV_ECHO_N) % _IV_ECHO_N;
  }
  return j;
}

function _ivMoveAll(t, dt) {
  if (_ivRM) return;
  // Nothing moves while a button is held down, or while something is being
  // typed into: a `click` needs its mousedown and its mouseup on the same
  // element, and anything that slides the interface in between is how you lose
  // one. It FREEZES rather than snapping back to zero, because snapping back is
  // itself a jump, and a jump on mousedown is the bug this is guarding against.
  const ae = document.activeElement;
  const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
  if (_ivPtrDown || typing) return;

  const W = window.innerWidth || 1600, H = window.innerHeight || 900;
  const D = Math.hypot(W, H);
  const beat = _ivPulse;
  const kick = beat * beat;              // squared: the shove is on the thump, not the whole cycle
  const calm = 1 - _ivDark * 0.6;
  const list = _ivFxTargets(t);

  for (let i = 0; i < list.length; i++) {
    const el = list[i][0], k = list[i][1];
    const s = _ivFxBox(el, _ivFxState(el));
    const cx = s.bx + s.bw * 0.5, cy = s.by + s.bh * 0.5;
    // Phase off the element's own place on the screen as well as its index, so
    // the panels drift out of step with each other. In step, a dozen boxes
    // moving together is not a swaying interface, it is a wobbling page.
    const ph = i * 1.9 + cx * 0.0042 + cy * 0.0061;
    const A = 2.0 * k * calm;
    // A slow drift with a faster wobble riding on it. The wobble is what the
    // echoes have to bite on: a pure slow drift moves too little between frames
    // to leave a trail of any kind.
    let tx = A * Math.sin(t * 0.51 + ph) + A * 0.52 * Math.sin(t * 1.37 + ph * 1.7);
    let ty = A * 0.60 * Math.sin(t * 0.43 + ph * 1.3) + A * 0.38 * Math.sin(t * 1.19 + ph * 2.1);
    // and the heartbeat, shoving everything out from the middle of the screen
    const dx0 = cx - W * 0.5, dy0 = cy - H * 0.5, dl = Math.hypot(dx0, dy0) || 1;
    tx += (dx0 / dl) * kick * 5.0 * k * calm;
    ty += (dy0 / dl) * kick * 5.0 * k * calm;

    // then whatever the cuts are doing to it, on top
    for (const c of _ivCuts) {
      const open = _ivCutOpen(c);
      if (open < 0.002) continue;
      const sgn = ((cx - c.x) * c.nx + (cy - c.y) * c.ny) >= 0 ? 1 : -1;
      const m = D * 0.013 * c.w * open * sgn * k;
      tx += c.nx * m - c.ny * m * 0.42;
      ty += c.ny * m + c.nx * m * 0.42;
    }

    s.tx = tx; s.ty = ty;
    s.h[s.i * 3] = tx; s.h[s.i * 3 + 1] = ty; s.h[s.i * 3 + 2] = dt || 0.016;
    s.i = (s.i + 1) % _IV_ECHO_N;
    if (s.n < _IV_ECHO_N) s.n++;
    // Writing the same string back into style.transform still invalidates
    // style, so do not.
    if (Math.abs(tx - s.wx) > 0.04 || Math.abs(ty - s.wy) > 0.04) {
      s.wx = tx; s.wy = ty;
      // [port] on `translate`, which composes with the elements' own transforms
      // (the music bar and the phone drawer slide on theirs)
      el.style.translate = (Math.abs(tx) + Math.abs(ty) < 0.05) ? ''
        : tx.toFixed(2) + 'px ' + ty.toFixed(2) + 'px';
    }
  }
}

// Take the hole out. This runs at the end of EVERY tear, so it must not touch
// the sway: clearing the transform here snapped the whole interface back a few
// pixels and dropped its echoes every time a cut healed. The shove fades out on
// its own, because it is summed from _ivCuts and _ivCuts is now empty.
function _ivCutClear() {
  _ivCuts = [];
  for (const el of _ivFxAll()) {
    el.style.webkitMaskImage = ''; el.style.maskImage = '';
    el.style.webkitMaskSize = ''; el.style.maskSize = '';
    el.style.webkitMaskPosition = ''; el.style.maskPosition = '';
    el.style.webkitMaskRepeat = ''; el.style.maskRepeat = '';
    el._ivBase = null;
  }
}

// Everything currently in the list plus everything that has ever been in it:
// panels are replaced when you change character, and an element that has left
// the list still has our transform sitting on it.
function _ivFxAll() {
  const all = _ivCutTargets().map(function (t) { return t[0]; });
  for (const el of _ivFxSeen) if (all.indexOf(el) < 0) all.push(el);
  return all;
}

// And put the interface back where it was. Leaving the page is the only time
// this is right.
function _ivFxReset() {
  for (const el of _ivFxAll()) {
    el.style.translate = '';
    el._ivFx = null;
  }
  _ivFxSeen = [];
  _ivFxList = null; _ivFxAt = -9;
}

// Throw pieces of whatever was there out of the wound.
function _ivShardBurst(c, W, H) {
  const D = Math.hypot(W, H);
  const gap = D * 0.0075 * c.w;
  for (let k = 0; k < 9; k++) {
    const u = _ivRnd(c.seed * 23.1 + k * 3.3);
    const i = Math.min(c.n - 1, (u * (c.n - 1)) | 0);
    const sgn = k & 1 ? 1 : -1;
    const sp = D * (0.10 + _ivRnd(c.seed * 29.7 + k) * 0.35);
    _ivShards.push({
      x: c.pts[i * 2] + c.nx * gap * sgn, y: c.pts[i * 2 + 1] + c.ny * gap * sgn,
      vx: c.nx * sp * sgn - c.ny * sp * 0.35, vy: c.ny * sp * sgn + c.nx * sp * 0.35,
      a: _ivRnd(c.seed + k) * 6.283, va: (_ivRnd(c.seed * 2 + k) - 0.5) * 9,
      w: gap * (1.4 + _ivRnd(c.seed * 3 + k) * 4.5), h: gap * (0.7 + _ivRnd(c.seed * 4 + k) * 2.2),
      life: 1
    });
  }
}

// Draw one wound: the dark inside it, the burning faces, and the grit.
function _ivCutDraw(g, c, W, H, PX, sx, sy, ox, oy) {
  if (!c.pts || c.p < 0 || c.p > 1) return;
  const D = Math.hypot(W, H);
  const WD = Math.hypot(window.innerWidth || W, window.innerHeight || H);
  const open = _ivCutOpen(c);
  // the visible wound is the rip itself plus however far the two pieces have
  // been pulled apart, which is what the transform is doing to them
  const gap = _ivRipGap(c, WD) + WD * 0.013 * c.w * open;
  const fade = c.p > 0.30 ? Math.max(0, Math.pow(1 - (c.p - 0.30) / 0.70, 0.8)) : 1;
  const swept = Math.min(1, c.p / 0.07);          // the blade going through
  const last = Math.max(1, ((c.n - 1) * swept) | 0);
  const X = (i) => (c.pts[i * 2] - ox) * sx;
  const Y = (i) => (c.pts[i * 2 + 1] - oy) * sy;
  const nx = c.nx * sx, ny = c.ny * sy;

  g.save();
  // the dark inside it, kept translucent: the interface really has been taken
  // away along this line, so what belongs in the wound is the hall behind it
  g.fillStyle = 'rgba(4,1,3,' + (0.34 + 0.20 * open).toFixed(3) + ')';
  g.beginPath();
  for (let i = 0; i <= last; i++) { const h = gap * c.hw[i];
    const x = X(i) + nx * h, y = Y(i) + ny * h; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  for (let i = last; i >= 0; i--) { const h = gap * c.hw[i];
    g.lineTo(X(i) - nx * h, Y(i) - ny * h); }
  g.closePath(); g.fill();

  g.globalCompositeOperation = 'lighter';
  const w = Math.max(PX, D * 0.0022 * c.w);
  for (const sgn of [1, -1]) {
    g.beginPath();
    for (let i = 0; i <= last; i++) { const h = gap * c.hw[i];
      const x = X(i) + nx * h * sgn, y = Y(i) + ny * h * sgn;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.strokeStyle = _IV_HOT[_ivA(fade * 0.34)]; g.lineWidth = w * 2.4; g.stroke();
    g.strokeStyle = _IV_BONE[_ivA(fade * 0.80)]; g.lineWidth = Math.max(1, w * 0.40); g.stroke();
  }
  // the blade going through, in the first tenth of a second
  if (swept < 1) {
    const i = last;
    const px = X(i), py = Y(i);
    const r = Math.max(PX * 2, D * 0.010);
    g.globalAlpha = 0.9;
    g.drawImage(_ivGlowSprite(), px - r * 2, py - r * 2, r * 4, r * 4);
    g.globalAlpha = 1;
  }
  // grit still coming out of it
  g.beginPath();
  for (let k = 0; k < 15; k++) {
    const u = _ivRnd(c.seed * 7.1 + k * 3.3);
    if (u > swept) continue;
    const i = Math.min(c.n - 1, (u * (c.n - 1)) | 0);
    const sgn = (_ivRnd(c.seed * 11.7 + k) - 0.5) * 2;
    const dd = c.p * D * 0.09 * (0.4 + _ivRnd(c.seed + k * 5.1));
    const r = Math.max(PX, w * (0.5 + _ivRnd(k * 2.9)));
    g.rect(X(i) + nx * (dd * sgn + gap * Math.sign(sgn || 1)) - r,
           Y(i) + ny * (dd * sgn + gap * Math.sign(sgn || 1)) - r, r * 2, r * 2);
  }
  g.fillStyle = _IV_HOT[_ivA(fade * 0.85)];
  g.fill();
  g.restore();
}

// The pieces that came off, tumbling. They are drawn in the interface's own
// colours because that is what they are: bits of it.
function _ivShardsDraw(g, dt, W, H, PX) {
  if (!_ivShards.length) return;
  for (let i = _ivShards.length - 1; i >= 0; i--) {
    const q = _ivShards[i];
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.965; q.vy = q.vy * 0.965 + 900 * dt;
    q.a += q.va * dt;
    q.life -= dt * 0.75;
    if (q.life <= 0 || q.y > H + 80) { _ivShards.splice(i, 1); continue; }
    g.save();
    g.translate(q.x, q.y); g.rotate(q.a);
    g.globalAlpha = Math.min(1, q.life * 1.6);
    g.fillStyle = 'rgba(16,6,9,0.96)';
    g.fillRect(-q.w * 0.5, -q.h * 0.5, q.w, q.h);
    g.strokeStyle = _IV_EMBER[_ivA(0.8)];
    g.lineWidth = Math.max(1, PX * 0.6);
    g.strokeRect(-q.w * 0.5, -q.h * 0.5, q.w, q.h);
    g.restore();
  }
  g.globalAlpha = 1;
}

// ════════════════════════════════════════════════════════════════
// OVER THE APPLICATION
//
// The same hall, reaching out past the card: ornament in the four
// corners of the WINDOW, the heartbeat crossing the whole thing,
// embers coming up through the panels, and the cut going all the
// way across on a `lunge`. Drawn by the same scroll renderer off
// the same palette and the same one light, and through the same
// pixel pipeline, so a scroll on the header and a scroll on the
// mirror are the same object at two sizes.
//
// And the rapier. The tip sits exactly on the pointer, because a
// rapier points at the thing you are pointing at; everything else
// hangs back from it and lags when you move.
// ════════════════════════════════════════════════════════════════
let _ivMX = (typeof window !== 'undefined' ? window.innerWidth * 0.5 : 0);
let _ivMY = (typeof window !== 'undefined' ? window.innerHeight * 0.5 : 0);
let _ivPrevMX = _ivMX, _ivPrevMY = _ivMY;
let _ivLunge = 0;                       // 0..1, a click: the thrust
let _ivTrail = null, _ivTrailN = 0;
let _ivSparks = [];                     // struck off the blade and out of the cuts
let _ivGhosts = [];                     // where the blade has just been
let _ivDrips = [];                      // and what is still coming off it
let _ivOverlayRaf = null;
let _ivPtrDown = false;
// [port] On a touch screen there is no pointer for the rapier to sit on: a tap
// still cuts, but the blade, its trail and its light are drawn for a mouse
// only. A tap sends a mousemove of its own just before its mousedown, so a
// mousemove only counts as a mouse once no touch has happened for a second.
let _ivTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let _ivTouchAt = -1e9;
function _ivTouchStart() { _ivTouch = true; _ivTouchAt = performance.now(); }
function _ivMouseMove(e) {
  _ivMX = e.clientX; _ivMY = e.clientY;
  if (_ivTouch && performance.now() - _ivTouchAt > 1000) _ivTouch = false;
}

/* Anything you can press, type in, or pick from. A tear that fires under the
   pointer shoves the interface forty pixels sideways between mousedown and
   mouseup, and a `click` only happens when both land on the same element: the
   effect was quietly eating presses on EDIT, on the form buttons and on
   anything else you aimed at. So a click on a control opens no wound at all,
   and while a button is held down nothing is allowed to move. */
function _ivInteractive(el) {
  return _isInteractive(el);   // [port] the new app's controls: see pages/host.ts
}
function _ivMouseUp() { _ivPtrDown = false; }
function _ivMouseDown(e) {
  _ivPtrDown = true;
  _ivLunge = 1;
  const a = (_ivDrawRapier._a || -0.6);
  const L = Math.hypot(window.innerWidth || 1600, window.innerHeight || 900) * 1.1;
  if (!_ivInteractive(e && e.target)) {
    const c = { a: a, x: _ivMX, y: _ivMY,
                x0: _ivMX - Math.cos(a) * L, y0: _ivMY - Math.sin(a) * L,
                x1: _ivMX + Math.cos(a) * L, y1: _ivMY + Math.sin(a) * L,
                t0: 0, p: 0, w: 1.15, seed: performance.now() * 0.013 };
    _ivTearBuild(c, window.innerWidth || 1600, window.innerHeight || 900);
    _ivCuts.push(c);
    _ivShardBurst(c, window.innerWidth || 1600, window.innerHeight || 900);
    _ivCutApply();
  }
  for (let i = 0; i < 14; i++) {
    _ivSparks.push({ x: _ivMX, y: _ivMY,
                     vx: Math.cos(a + (Math.random() - 0.5) * 1.1) * (260 + Math.random() * 620),
                     vy: Math.sin(a + (Math.random() - 0.5) * 1.1) * (260 + Math.random() * 620),
                     life: 1, hot: Math.random() > 0.4 });
  }
}

// Where the chandelier is in WINDOW coordinates, so a scroll in the corner of
// the screen and a scroll on the mirror agree about the light. Through the
// layout cache, never a raw read.
function _ivLightAt(W, H) {
  const pc = _ivLightAt._pc && _ivLightAt._pc.isConnected
    ? _ivLightAt._pc : (_ivLightAt._pc = _worldCanvas());
  if (pc) {
    const r = _lyRect(pc);
    if (r.width > 0 && r.height > 0) return [r.left + r.width * 0.700, r.top + r.height * 0.185];
  }
  return [W * 0.70, H * 0.20];
}

// ── the ornament around the window, baked once ──
// The ornament round the window is baked at a FINER pixel than the rest of the
// page and blitted straight onto the real canvas after the low resolution
// layer has gone up. Everything else stays chunky; the border does not, which
// is what was asked for and also what a gilt frame wants: it is the one thing
// here that is supposed to look expensive.
function _ivFramePX(PX) { return Math.max(1, Math.round(PX / 2.5)); }
function _ivFrameSheet(W, H, LX, LY, PX) {
  const c = _ivSheet(W, H, PX); c._px = PX;
  const g = c.getContext('2d');
  const M = Math.min(W, H);
  const S = M * 0.20;
  // a thin gilt rail all the way round, so the corners are joined to each other
  g.strokeStyle = _IV_DARK[_ivA(0.85)]; g.lineWidth = M * 0.010;
  g.strokeRect(M * 0.012, M * 0.012, W - M * 0.024, H - M * 0.024);
  g.strokeStyle = _IV_BLOOD[_ivA(0.55)]; g.lineWidth = M * 0.0034;
  g.strokeRect(M * 0.012, M * 0.012, W - M * 0.024, H - M * 0.024);
  // the corners: one compound ornament each, mirrored round the window
  const C = [[0, 0, 0.785, false], [W, 0, 2.356, true], [W, H, -2.356, false], [0, H, -0.785, true]];
  for (let i = 0; i < 4; i++) {
    const [x, y, a, f] = C[i];
    _ivOrnament(g, x, y, a, S, LX, LY, _IV_PAL_GILT, i + 200, f);
    _ivOrnament(g, x, y, a + (f ? 0.75 : -0.75), S * 0.62, LX, LY, _IV_PAL_GILT, i + 210, !f);
    _ivOrnament(g, x, y, a + (f ? -0.75 : 0.75), S * 0.48, LX, LY, _IV_PAL_GILT, i + 220, f);
  }
  // and a bead of it along the bottom and the sides, where the GUI is quiet
  for (let i = 0; i < 5; i++) {
    const u = (i + 1) / 6;
    _ivOrnament(g, W * u, H + M * 0.004, -1.5707963, S * 0.30, LX, LY, _IV_PAL_GILT, i + 230, i & 1);
  }
  for (let i = 0; i < 3; i++) {
    const u = (i + 1) / 4;
    _ivOrnament(g, -M * 0.004, H * u, 0, S * 0.26, LX, LY, _IV_PAL_GILT, i + 240, i & 1);
    _ivOrnament(g, W + M * 0.004, H * u, Math.PI, S * 0.26, LX, LY, _IV_PAL_GILT, i + 250, i & 1);
  }
  return c;
}


/* ── the rapier ───────────────────────────────────────────────────
   A long thin blade with one lit edge and a dark spine, a swept
   guard made of the same scroll as everything else in the hall, a
   wrapped grip and a bead of a pommel. The TIP is the hotspot: it
   sits on the pointer and the rest of the weapon hangs back from
   it, leaning into wherever you are going. A click drives it
   forward along its own axis and opens a cut across the page. ── */
/* ── the rapier ───────────────────────────────────────────────────
   A rapier is three things, and the first attempt had none of them.
   It is a NEEDLE: the blade is four fifths of the whole weapon and
   barely wider than a pencil, where a short sword is a third as
   long and four times as wide. It has a CROSSBAR: two straight
   quillons across the blade at right angles, which is the silhouette
   everybody reads. And it has a SWEPT HILT: a cage of thin bars
   springing off those quillons, sweeping forward around the hand
   and back to the pommel, with a side ring standing open around the
   ricasso and a knuckle bow closing the other side.
   Built out of spirals instead, it came out as a short sword with a
   flower on the end of it.
   The blade is white and nothing else: it is the one thing in this
   hall the red has not got into yet. ── */

// One bar of the hilt: dark body, bright rim, which is the same two tone
// treatment every other piece of metal on this page gets.
function _ivBar(g, PX, w, path) {
  g.lineCap = 'round';
  g.strokeStyle = _IV_VOID[24]; g.lineWidth = w;
  path(); g.stroke();
  g.strokeStyle = _IV_DARK[24]; g.lineWidth = Math.max(1, w * 0.62);
  path(); g.stroke();
  g.strokeStyle = _IV_EMBER[_ivA(0.85)]; g.lineWidth = Math.max(1, w * 0.26);
  path(); g.stroke();
}

// The steel on its own, in local coordinates, so the ghosts can reuse it
// without repeating the hilt.
function _ivBlade(g, BL, bw, PX, hot, shimmer) {
  // a needle: full width only at the ricasso, and a hair by the point
  g.fillStyle = _IV_VOID[24];
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(-BL * 0.55, -bw * 0.62);
  g.lineTo(-BL, -bw);
  g.lineTo(-BL, bw);
  g.lineTo(-BL * 0.55, bw * 0.62);
  g.closePath(); g.fill();
  g.fillStyle = _IV_BONE[24];
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(-BL * 0.55, -bw * 0.62);
  g.lineTo(-BL, -bw * 0.90);
  g.lineTo(-BL, bw * 0.20);
  g.lineTo(-BL * 0.55, bw * 0.14);
  g.closePath(); g.fill();
  // the underside, which is the same steel turned away from the chandelier
  g.fillStyle = 'rgba(126,126,138,0.55)';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(-BL * 0.55, bw * 0.62);
  g.lineTo(-BL, bw * 0.90);
  g.lineTo(-BL, bw * 0.24);
  g.lineTo(-BL * 0.55, bw * 0.16);
  g.closePath(); g.fill();
  // the fuller
  g.strokeStyle = 'rgba(70,70,80,0.7)'; g.lineWidth = Math.max(1, PX * 0.6);
  g.beginPath(); g.moveTo(-BL * 0.20, 0); g.lineTo(-BL * 0.96, 0); g.stroke();
  // a bright band running up it, so the steel is doing something when you are not
  if (shimmer >= 0) {
    const u = shimmer;
    const sx = -BL * (1 - u);
    const hw = bw * (0.14 + 0.86 * (1 - u));
    g.fillStyle = 'rgba(255,255,255,' + (0.9 * Math.sin(Math.PI * u)).toFixed(3) + ')';
    g.fillRect(sx - Math.max(1, PX), -hw, Math.max(2, PX * 2), hw * 2);
  }
  if (hot > 0.02) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = _IV_HOT[_ivA(hot * 0.5)];
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-BL * 0.55, -bw * 0.62); g.lineTo(-BL, -bw);
    g.lineTo(-BL, bw); g.lineTo(-BL * 0.55, bw * 0.62);
    g.closePath(); g.fill();
    g.restore();
  }
}

function _ivDrawRapier(g, x, y, t, vx, vy, PX, W, H) {
  const spd = Math.hypot(vx, vy);
  let a = _ivDrawRapier._a === undefined ? -0.62 : _ivDrawRapier._a;
  const want = spd > 40 ? Math.atan2(vy, vx) : -0.62 + Math.sin(t * 0.9) * 0.05;
  let d = want - a;
  while (d > 3.1415927) d -= 6.2831853;
  while (d < -3.1415927) d += 6.2831853;
  a += d * Math.min(1, 0.14 + spd * 0.0006);
  _ivDrawRapier._a = a;

  // The proportions ARE the reading. Blade four fifths of the length and about
  // one part in forty across; everything else is hilt.
  const M = 300;
  const BL = M * 0.760;                  // blade
  const bw = M * 0.021;                  // half width at the ricasso
  const RIC = -BL;                       // where the guard sits
  const QL = M * 0.150;                  // half the crossbar
  const GRIP = M * 0.150;
  const POM = RIC - GRIP;
  const bar = Math.max(1.5, M * 0.019);
  const push = _ivLunge * M * 0.26;
  const hot = _ivLunge;
  const shimmerT = (t * 0.42) % 1;
  const shimmer = shimmerT < 0.34 ? shimmerT / 0.34 : -1;

  // ── the ghosts: blade only, no hilt ──
  for (let i = 0; i < _ivGhosts.length; i++) {
    const gh = _ivGhosts[i];
    if (gh.a <= 0.02) continue;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = gh.a * 0.38;
    g.translate(gh.x, gh.y); g.rotate(gh.r);
    g.fillStyle = _IV_BONE[_ivA(0.5)];
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-BL * 0.55, -bw * 0.62); g.lineTo(-BL, -bw);
    g.lineTo(-BL, bw); g.lineTo(-BL * 0.55, bw * 0.62);
    g.closePath(); g.fill();
    g.restore();
  }

  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.translate(push, 0);

  // ── the cage, behind the blade: the bars that sweep forward round the hand
  _ivBar(g, PX, bar * 0.80, () => {
    g.beginPath();
    g.moveTo(RIC, -QL * 0.72);
    g.quadraticCurveTo(RIC + M * 0.090, -QL * 0.48, RIC + M * 0.058, -QL * 0.04);
  });
  _ivBar(g, PX, bar * 0.80, () => {
    g.beginPath();
    g.moveTo(RIC, QL * 0.72);
    g.quadraticCurveTo(RIC + M * 0.090, QL * 0.48, RIC + M * 0.058, QL * 0.04);
  });
  // the side ring, standing open around the ricasso: the single most rapier
  // thing there is after the crossbar itself
  _ivBar(g, PX, bar * 0.85, () => {
    g.beginPath();
    g.ellipse(RIC + M * 0.038, 0, M * 0.046, QL * 0.56, 0, 0, 6.2831853);
  });

  _ivBlade(g, BL, bw, PX, hot, shimmer);

  // ── THE CROSSBAR. Straight, long, at right angles to the blade, with a
  //    small scroll finial on each end so it still belongs to this room.
  _ivBar(g, PX, bar * 1.30, () => {
    g.beginPath();
    g.moveTo(RIC - M * 0.014, -QL);
    g.quadraticCurveTo(RIC + M * 0.020, 0, RIC - M * 0.014, QL);
  });
  for (const sgn of [-1, 1]) {
    const n = _ivScroll(RIC - M * 0.014, QL * sgn, sgn > 0 ? 1.5707963 : -1.5707963,
                        M * 0.034, 0.95, sgn, 10);
    _ivGilt(g, _IV_PT, n, bar * 0.9, bar * 0.35, 0, -M * 5, _IV_PAL_GILT);
  }

  // ── the knuckle bow, from the crossbar back over the hand to the pommel
  _ivBar(g, PX, bar * 0.95, () => {
    g.beginPath();
    g.moveTo(RIC - M * 0.010, -QL * 0.96);
    g.quadraticCurveTo(POM + GRIP * 0.30, -QL * 0.98, POM + M * 0.014, -M * 0.014);
  });

  // ── the grip: a slim barrel with wire wrapped round it
  g.fillStyle = _IV_CLOT[24];
  g.beginPath();
  g.moveTo(RIC - M * 0.004, -bw * 1.25);
  g.quadraticCurveTo(RIC - GRIP * 0.5, -bw * 1.75, POM + M * 0.020, -bw * 1.15);
  g.lineTo(POM + M * 0.020, bw * 1.15);
  g.quadraticCurveTo(RIC - GRIP * 0.5, bw * 1.75, RIC - M * 0.004, bw * 1.25);
  g.closePath(); g.fill();
  g.strokeStyle = _IV_BLOOD[_ivA(0.9)]; g.lineWidth = Math.max(1, PX * 0.7);
  for (let i = 1; i < 7; i++) {
    const u = i / 7;
    const px = RIC - M * 0.004 - (GRIP - M * 0.024) * u;
    g.beginPath(); g.moveTo(px, -bw * 1.6); g.lineTo(px - GRIP * 0.10, bw * 1.6); g.stroke();
  }
  g.strokeStyle = _IV_EMBER[_ivA(0.5)]; g.lineWidth = Math.max(1, PX * 0.5);
  g.beginPath();
  g.moveTo(RIC - M * 0.004, -bw * 1.25);
  g.quadraticCurveTo(RIC - GRIP * 0.5, -bw * 1.75, POM + M * 0.020, -bw * 1.15);
  g.stroke();

  // ── the pommel: a pear, with the stone in it that the guard's ring answers
  g.fillStyle = _IV_DARK[24];
  g.beginPath(); g.ellipse(POM, 0, M * 0.030, M * 0.024, 0, 0, 6.2831853); g.fill();
  g.strokeStyle = _IV_EMBER[_ivA(0.8)]; g.lineWidth = Math.max(1, PX * 0.6);
  g.beginPath(); g.ellipse(POM, 0, M * 0.030, M * 0.024, 0, 0, 6.2831853); g.stroke();
  g.fillStyle = _IV_HOT[24];
  g.beginPath(); g.arc(POM, 0, M * 0.013, 0, 6.2831853); g.fill();
  g.fillStyle = _IV_BONE[_ivA(0.9)];
  g.beginPath(); g.arc(POM - M * 0.004, -M * 0.004, M * 0.005, 0, 6.2831853); g.fill();

  // the point, which is the brightest pixel on the page
  g.save();
  g.globalCompositeOperation = 'lighter';
  const TR = bw * (2.1 + hot * 7);
  g.globalAlpha = 0.42 + hot * 0.55;
  g.drawImage(_ivGlowSprite(), -TR, -TR, TR * 2, TR * 2);
  g.restore();
  g.restore();

  // ── and the ring it lets go of when it goes in ──
  if (hot > 0.05) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const rr = (1 - hot) * M * 1.3;
    g.strokeStyle = _IV_BONE[_ivA(hot * 0.45)];
    g.lineWidth = Math.max(1, PX * (0.6 + hot * 2));
    g.beginPath(); g.arc(x + Math.cos(a) * push, y + Math.sin(a) * push, rr, 0, 6.2831853); g.stroke();
    g.restore();
  }
}

/* THE AFTERIMAGES.
   Every panel keeps twenty frames of where it has been, and three of those are
   drawn again in red, additively, behind the live one. They are drawn as the
   panel's OUTLINE rather than as a filled box, because these panels are frames
   with translucent middles: a filled ghost washes out the text inside the real
   one, an outlined ghost reads as a doubled border, which is exactly what an
   afterimage of a rectangle looks like.
   The lag is EXAGGERATED. A sway of a few pixels moves less than a pixel
   between one frame and the next, so an honest trail is invisible; each echo is
   pushed further along the direction the panel has come from until you can see
   it. They collapse into the panel at the turn of the sway and spread on the
   heartbeat, which is the whole effect: the interface smears when the room's
   pulse hits it and settles again between beats.
   This is on the canvas rather than in CSS on purpose. The DOM ways of doing it
   are a duplicated subtree per ghost, or an animated `filter: drop-shadow`, and
   the second one repaints the whole panel every frame. */
const _IV_ECHO_LAG = [0.045, 0.095, 0.150, 0.215, 0.300];   // seconds behind
const _IV_ECHO_A   = [0.30,  0.23,  0.17,  0.11,  0.06];
const _IV_ECHO_G = 5.0;                       // how far past the truth to push it
function _ivEchoDraw(g, W, H, PX) {
  if (_ivRM) return;
  const list = _ivFxTargets(_ivEchoDraw._t || 0);
  const pw = (1 - _ivDark * 0.7);
  if (pw <= 0.02) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineWidth = Math.max(1, PX);
  for (let i = 0; i < list.length; i++) {
    // the containers sway but do not ghost: a red rectangle the size of the
    // sidebar drawn across the window is not an afterimage, it is a border
    if (list[i][1] <= 1) continue;
    const el = list[i][0], s = el._ivFx;
    if (!s || s.n < 6 || s.bw < 8) continue;
    if (s.by + s.bh < -8 || s.by > H + 8 || s.bx + s.bw < -8 || s.bx > W + 8) continue;
    for (let k = 0; k < _IV_ECHO_LAG.length; k++) {
      const j = _ivEchoBack(s, _IV_ECHO_LAG[k]);
      const ex = s.tx + (s.h[j * 3] - s.tx) * _IV_ECHO_G;
      const ey = s.ty + (s.h[j * 3 + 1] - s.ty) * _IV_ECHO_G;
      // no ghost while it is standing still, or every panel gets a permanent
      // red double edge and the page just looks blurry
      const d = Math.abs(ex - s.tx) + Math.abs(ey - s.ty);
      if (d < 0.45) continue;
      g.strokeStyle = _ivRed(_IV_HOT, _IV_ECHO_A[k] * Math.min(1, d * 0.34) * pw);
      g.strokeRect(s.bx + ex, s.by + ey, s.bw, s.bh);
    }
  }
  g.restore();
}

function _drawIvyEvilOverlay(canvas, ctxIn, W, H, t) {
  const fresh = _drawIvyEvilOverlay._lt === undefined;
  if (!fresh && t - _drawIvyEvilOverlay._lt >= 0 && t - _drawIvyEvilOverlay._lt < 0.014) return;
  const dt = fresh ? 0.016 : Math.min(Math.abs(t - _drawIvyEvilOverlay._lt), 0.05);
  _drawIvyEvilOverlay._lt = t;
  if (!(W > 0 && H > 0)) return;

  const O = _drawIvyEvilOverlay;
  const PX = _ivPX(W);
  const M = Math.min(W, H);
  const [LX, LY] = _ivLightAt(W, H);
  _ivLunge = Math.max(0, _ivLunge - dt * 4.0);

  // ── the cuts, and the wound they leave in the interface. The mask is only
  //    rewritten when the gap has actually changed by a visible amount: it is
  //    a paint on four elements, cheap, but not free. ──
  if (_ivCuts.length) {
    let done = true;
    for (let i = _ivCuts.length - 1; i >= 0; i--) {
      const c = _ivCuts[i];
      c.t0 += dt;
      c.p = c.t0 / 1.90;
      if (c.p > 1) { _ivCuts.splice(i, 1); continue; }
      if (c.p > 0.02 && !c.burst) { c.burst = 1; _ivShardBurst(c, W, H); }
      done = false;
    }
    // The hole is put in once and taken out once; only the movement animates.
    if (!_ivCuts.length) _ivCutClear();
  }
  // and the interface moves whether or not anything is torn
  _ivMoveAll(t, dt);

  // the whole layer goes through the pixel pipeline, same as the hall: a
  // smooth cursor on a dithered room looks like two programs at once
  const lo = _ivLo(canvas, '_ivOv', W, H, PX);
  const g = lo._g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, lo.width, lo.height);
  g.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

  if (O._w !== W || O._h !== H) {
    O._sheet = _ivFrameSheet(W, H, LX, LY, _ivFramePX(PX));
    O._motes = null; O._star = null;
    O._w = W; O._h = H;
  }
  if (!O._motes) {
    const m = [];
    for (let i = 0; i < 40; i++) {
      m.push({ x: Math.random(), y: Math.random(), v: 0.03 + Math.random() * 0.07,
               s: 1 + Math.random() * 2.2, ph: Math.random() * 6.283, w: 0.4 + Math.random() * 1.1 });
    }
    O._motes = m;
    _ivTrail = new Float32Array(32); _ivTrailN = 0;
    for (let i = 0; i < 16; i++) { _ivTrail[i * 2] = _ivMX; _ivTrail[i * 2 + 1] = _ivMY; }
  }

  // ── where the interface just was ──
  _ivEchoDraw._t = t;
  _ivEchoDraw(g, W, H, PX);

  // ── embers coming up through the application ──
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.beginPath();
  for (const q of O._motes) {
    q.y -= q.v * dt * (1 + _ivPulse * 1.4) * (_ivRM ? 0.4 : 1);
    if (q.y < -0.03) { q.y = 1.03; q.x = Math.random(); }
    const x = q.x * W + Math.sin(t * q.w + q.ph) * 24;
    const y = q.y * H;
    const r = Math.max(PX, q.s * PX * 0.8);
    g.rect(x - r * 0.5, y - r * 0.5, r, r);
  }
  g.fillStyle = _ivRed(_IV_EMBER, (0.34 + _ivPulse * 0.34) * (1 - _ivDark * 0.8));
  g.fill();
  g.restore();

  // ── the heartbeat, out across the whole window ──
  if (_ivPulse > 0.02) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const R = Math.max(M * 0.10, M * 0.55 * (1 - _ivPulse));
    g.strokeStyle = _ivRed(_IV_HOT, _ivPulse * 0.16 * (1 - _ivDrain));
    g.lineWidth = Math.max(1, PX * 1.2);
    g.beginPath(); g.arc(LX, LY, R, 0, 6.2831853); g.stroke();
    // and a red breath at the very edge of the screen
    const eg = g.createLinearGradient(0, 0, 0, H);
    eg.addColorStop(0, _ivRed(_IV_BLOOD, _ivPulse * 0.20));
    eg.addColorStop(0.35, _ivRed(_IV_BLOOD, 0));
    eg.addColorStop(0.65, _ivRed(_IV_BLOOD, 0));
    eg.addColorStop(1, _ivRed(_IV_BLOOD, _ivPulse * 0.26));
    g.fillStyle = eg; g.fillRect(0, 0, W, H);
    g.restore();
  }

  // ── the light the rapier is carrying, thrown onto the chrome ──
  if (!_ivTouch) {   // [port] no blade on a touch screen
    const R = M * (0.16 + _ivLunge * 0.16);
    const cg = g.createRadialGradient(_ivMX, _ivMY, 0, _ivMX, _ivMY, R);
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      cg.addColorStop(u, _IV_HOT[_ivA((0.14 + _ivLunge * 0.22) * Math.pow(1 - u, 2.6))]);
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = cg;
    g.fillRect(_ivMX - R, _ivMY - R, R * 2, R * 2);
    g.restore();
  }

  // ── the events that reach the whole application ──
  if (_ivDark > 0.01) {
    g.fillStyle = 'rgba(3,1,2,' + (_ivDark * 0.55).toFixed(3) + ')';
    g.fillRect(0, 0, W, H);
  }
  if (_ivEvNow && _ivEvNow.name === 'hunger' && _ivEvNow.p > 0.68) {
    const f = Math.pow(1 - (_ivEvNow.p - 0.68) / 0.32, 2.4);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = _IV_EMBER[_ivA(f * 0.55)]; g.fillRect(0, 0, W, H);
    g.restore();
  }
  if (_ivCrack > 0.01) {
    const F = _drawIvyEvilOverlay;
    if (F._crackFor !== (_ivEvNow && _ivEvNow.t0)) {
      F._crackFor = _ivEvNow && _ivEvNow.t0;
      const seg = [];
      const ox = W * (0.25 + (_ivEvNow ? _ivEvNow.r0 : 0.5) * 0.5);
      const oy = H * (0.25 + (_ivEvNow ? _ivEvNow.r1 : 0.5) * 0.5);
      for (let b = 0; b < 7; b++) {
        let x = ox, y = oy, aa = b * 0.9 + (_ivEvNow ? _ivEvNow.r2 : 0) * 6.283;
        const st = [];
        for (let k = 0; k < 6; k++) {
          st.push(x, y);
          aa += (_ivRnd(b * 17.3 + k * 5.1) - 0.5) * 1.1;
          const L = M * (0.09 + _ivRnd(b * 3.7 + k) * 0.16);
          x += Math.cos(aa) * L; y += Math.sin(aa) * L;
        }
        st.push(x, y); seg.push(st);
      }
      F._crack = seg;
    }
    const grow = Math.min(1, _ivCrack * 1.4);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const st of F._crack) {
      const n = Math.max(2, (grow * (st.length / 2)) | 0);
      g.beginPath(); g.moveTo(st[0], st[1]);
      for (let k = 1; k < n; k++) g.lineTo(st[k * 2], st[k * 2 + 1]);
      g.strokeStyle = _ivRed(_IV_EMBER, _ivCrack * 0.45); g.lineWidth = Math.max(1, PX * 1.4); g.stroke();
      g.strokeStyle = _IV_BONE[_ivA(_ivCrack * 0.5)]; g.lineWidth = Math.max(1, PX * 0.5); g.stroke();
    }
    g.restore();
  }

  // ── the cuts themselves, over everything ──
  for (const c of _ivCuts) _ivCutDraw(g, c, W, H, PX, 1, 1, 0, 0);
  _ivShardsDraw(g, dt, W, H, PX);

  // ── you ──
  const mvx = (_ivMX - _ivPrevMX) / Math.max(dt, 0.001), mvy = (_ivMY - _ivPrevMY) / Math.max(dt, 0.001);
  _ivPrevMX = _ivMX; _ivPrevMY = _ivMY;
  const spd = Math.hypot(mvx, mvy);

  // where the blade has just been, and the sparks it is striking off
  for (let i = _ivGhosts.length - 1; i >= 0; i--) {
    _ivGhosts[i].a -= dt * 4.2;
    if (_ivGhosts[i].a <= 0) _ivGhosts.splice(i, 1);
  }
  if (!_ivTouch && spd > 500 && _ivGhosts.length < 7) {
    _ivGhosts.push({ x: _ivMX, y: _ivMY, r: _ivDrawRapier._a || -0.62, a: 1 });
    if (_ivRnd(t * 71.3) > 0.45) {
      const aa = (_ivDrawRapier._a || -0.62) + 3.1415927;
      _ivSparks.push({ x: _ivMX, y: _ivMY,
                       vx: Math.cos(aa + (Math.random() - 0.5) * 1.6) * (120 + Math.random() * 380),
                       vy: Math.sin(aa + (Math.random() - 0.5) * 1.6) * (120 + Math.random() * 380),
                       life: 1, hot: Math.random() > 0.5 });
    }
  }
  // and a drop of what is still on it, now and then
  if (!_ivTouch && _ivDrips.length < 6 && _ivRnd(((t * 2) | 0) * 5.3) > 0.90) {
    _ivDrips.push({ x: _ivMX + (Math.random() - 0.5) * 18, y: _ivMY + 10, v: 0, life: 1 });
  }
  if (_ivSparks.length) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.beginPath();
    let anyHot = false;
    for (let i = _ivSparks.length - 1; i >= 0; i--) {
      const q = _ivSparks[i];
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.94; q.vy = q.vy * 0.94 + 420 * dt;
      q.life -= dt * 1.5;
      if (q.life <= 0) { _ivSparks.splice(i, 1); continue; }
      if (!q.hot) continue;
      anyHot = true;
      const r = Math.max(PX, PX * 1.4 * q.life);
      g.rect(q.x - r * 0.5, q.y - r * 0.5, r, r);
    }
    if (anyHot) { g.fillStyle = _IV_BONE[_ivA(0.9)]; g.fill(); }
    g.beginPath();
    for (const q of _ivSparks) {
      if (q.hot) continue;
      const r = Math.max(PX, PX * 1.4 * q.life);
      g.rect(q.x - r * 0.5, q.y - r * 0.5, r, r);
    }
    g.fillStyle = _ivRed(_IV_HOT, 0.85); g.fill();
    g.restore();
  }
  if (_ivDrips.length) {
    g.beginPath();
    for (let i = _ivDrips.length - 1; i >= 0; i--) {
      const q = _ivDrips[i];
      q.v += 900 * dt; q.y += q.v * dt; q.life -= dt * 0.55;
      if (q.life <= 0 || q.y > H + 20) { _ivDrips.splice(i, 1); continue; }
      g.rect(q.x - PX * 0.5, q.y - PX * 2, PX, PX * 4);
    }
    g.fillStyle = _ivRed(_IV_HOT, 0.75); g.fill();
  }
  _ivTrailN = (_ivTrailN + 1) & 15;
  _ivTrail[_ivTrailN * 2] = _ivMX; _ivTrail[_ivTrailN * 2 + 1] = _ivMY;

  const ctx = ctxIn;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lo, 0, 0, lo.width, lo.height, 0, 0, lo.width * PX, lo.height * PX);

  // ── and the ornament LAST, off the low resolution layer entirely: it is
  //    baked at a finer pixel and blitted straight onto the real canvas, so
  //    the border keeps its edges while everything else stays chunky. On
  //    `rococo` it goes down a second time pulled inward, which reads as it
  //    growing because the first blit is still under it. ──
  const FPX = _ivFramePX(PX);
  const sh = O._sheet;
  ctx.globalAlpha = (0.94 - _ivDark * 0.45) * (1 - _ivDrain * 0.4);
  ctx.drawImage(sh, 0, 0, sh.width, sh.height, 0, 0, sh.width * FPX, sh.height * FPX);
  if (_ivGrow > 0.01) {
    const k = 1 - _ivGrow * 0.055;
    ctx.save();
    ctx.globalAlpha *= 0.9;
    ctx.translate(W * 0.5, H * 0.5); ctx.scale(k, k); ctx.translate(-W * 0.5, -H * 0.5);
    ctx.drawImage(sh, 0, 0, sh.width, sh.height, 0, 0, sh.width * FPX, sh.height * FPX);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;

  // ── THE RAPIER, off the low resolution layer entirely and drawn last.
  //    Everything else on this page is deliberately chunky; a rapier is a
  //    polished needle and it wants a clean edge, so it is drawn straight onto
  //    the real canvas at full resolution, after the ornament, on top of
  //    everything. Its trail comes with it: a smooth blade dragging a stepped
  //    trail would look like two different cursors. ──
  if (_ivTouch) return;   // [port] no blade without a pointer
  const CPX = 1.6;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 1; k < 15; k++) {
    const i0 = (_ivTrailN - k + 32) & 15, i1 = (_ivTrailN - k + 33) & 15;
    const u = 1 - k / 15;
    ctx.strokeStyle = _ivRed(k < 5 ? _IV_BONE : _IV_HOT, u * u * 0.45);
    ctx.lineWidth = Math.max(1, CPX * (0.5 + u * 2.4));
    ctx.beginPath();
    ctx.moveTo(_ivTrail[i0 * 2], _ivTrail[i0 * 2 + 1]);
    ctx.lineTo(_ivTrail[i1 * 2], _ivTrail[i1 * 2 + 1]);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  _ivDrawRapier(ctx, _ivMX, _ivMY, t, mvx, mvy, CPX, W, H);
  ctx.restore();
}

function _startIvyEvilOverlay() {
  _stopIvyEvilOverlay();
  _drawIvyEvilOverlay._lt = undefined;
  _ivEvReset();
  _ivLunge = 0;
  _ivSparks = []; _ivGhosts = []; _ivDrips = []; _ivShards = [];
  _ivPrevMX = _ivMX; _ivPrevMY = _ivMY;
  _ivTrail = null;
  _ivPtrDown = false;
  window.addEventListener('mousemove', _ivMouseMove);
  window.addEventListener('mousedown', _ivMouseDown, true);
  window.addEventListener('mouseup', _ivMouseUp, true);
  window.addEventListener('blur', _ivMouseUp);
  window.addEventListener('touchstart', _ivTouchStart, { passive: true, capture: true });
  const cv = document.createElement('canvas');
  cv.id = 'ivyevil-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  // [port] phones and touch screens: 30 frames a second is plenty for this layer
  const small = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  let last = -1e9;
  function frame(now) {
    const cv2 = document.getElementById('ivyevil-overlay');
    if (!cv2) return;
    if (small && now - last < 30) { _ivOverlayRaf = requestAnimationFrame(frame); return; }
    last = now;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawIvyEvilOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _ivOverlayRaf = requestAnimationFrame(frame);
  }
  _ivOverlayRaf = requestAnimationFrame(frame);
}
function _stopIvyEvilOverlay() {
  if (_ivOverlayRaf) { cancelAnimationFrame(_ivOverlayRaf); _ivOverlayRaf = null; }
  _ivPtrDown = false;
  window.removeEventListener('mousemove', _ivMouseMove);
  window.removeEventListener('mousedown', _ivMouseDown, true);
  window.removeEventListener('mouseup', _ivMouseUp, true);
  window.removeEventListener('blur', _ivMouseUp);
  window.removeEventListener('touchstart', _ivTouchStart, { capture: true });
  const cv = document.getElementById('ivyevil-overlay'); if (cv) cv.remove();
  _ivCutClear();
  _ivFxReset();
  _ivEvReset();
  _ivLunge = 0;
  _ivSparks = []; _ivGhosts = []; _ivDrips = []; _ivShards = [];
  _drawIvyEvilOverlay._w = -1;
  _drawIvyEvilPattern._w = -1;
}
/* ─────────────────────────────────────────────────────────────── */

// [port] what the page host calls
export function drawBackground(canvas, ctx, W, H, t) { _drawIvyEvilPattern(canvas, ctx, W, H, t); }
/** A fresh clock: the frame cap remembers the last one. */
export function resetBackground() { _drawIvyEvilPattern._lt = undefined; }
export { _startIvyEvilOverlay as startOverlay, _stopIvyEvilOverlay as stopOverlay };
