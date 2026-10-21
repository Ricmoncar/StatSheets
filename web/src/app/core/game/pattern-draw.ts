import { GENERIC_PATTERNS } from './patterns';

/**
 * The generic background patterns, redrawn as pixel art. The canvas is drawn
 * at 1/PX of its on-screen size and scaled up with `image-rendering: pixelated`,
 * and every shape is plotted on whole pixels, so lines step, circles are
 * midpoint circles and soft gradients become ordered dithering.
 *
 * Each pattern keeps the old settings (same ids and defaults, sizes and speeds
 * in screen pixels), so a saved choice looks like itself, only chunkier.
 */
export const PX = 4;

export type PatternParams = Record<string, unknown>;

/** Per-canvas memory (particles, buffers) that survives between frames. */
export interface PatternState {
  w: number;
  h: number;
  [k: string]: unknown;
}

export function newPatternState(): PatternState {
  return { w: 0, h: 0 };
}

/** The pattern's saved settings over its defaults. */
export function withDefaults(type: string, params: PatternParams | null | undefined): PatternParams {
  const out: PatternParams = { ...(params || {}) };
  for (const p of GENERIC_PATTERNS[type]?.params || []) if (out[p.id] === undefined) out[p.id] = p.default;
  return out;
}

export function isGenericPattern(type: string | null | undefined): boolean {
  return !!type && type !== 'none' && !!GENERIC_PATTERNS[type];
}

// ── helpers ──
const num = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? v : (parseFloat(String(v)) || d));
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);
const cell = (screenPx: number) => Math.max(1, Math.round(screenPx / PX));

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** 4x4 ordered (Bayer) dither threshold, 0..1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const dither = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

function plot(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1): void {
  ctx.fillRect(Math.round(x), Math.round(y), s, s);
}

/** Bresenham, stamped with an s-pixel square. */
function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, s = 1): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const off = Math.floor(s / 2);
  for (let i = 0; i < 4096; i++) {
    ctx.fillRect(x0 - off, y0 - off, s, s);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Midpoint circle outline, s pixels thick. */
function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, s = 1): void {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  if (r <= 0) { ctx.fillRect(cx, cy, s, s); return; }
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) ctx.fillRect(cx + px, cy + py, s, s);
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

/** A buffer the size of the canvas for per-pixel patterns. */
function pixels(st: PatternState, ctx: CanvasRenderingContext2D): ImageData {
  let img = st['img'] as ImageData | undefined;
  if (!img || img.width !== st.w || img.height !== st.h) img = st['img'] = ctx.createImageData(st.w, st.h);
  return img;
}

// tiny 3x5 glyphs for the matrix rain (bit rows, top to bottom)
const GLYPHS = [
  [7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 3, 1, 7], [5, 5, 7, 1, 1], [7, 4, 7, 1, 7],
  [6, 4, 7, 5, 7], [7, 1, 2, 2, 2], [7, 5, 2, 5, 7], [7, 5, 7, 1, 3], [2, 7, 2, 2, 3], [4, 7, 5, 1, 6],
  [7, 2, 7, 2, 4], [1, 7, 1, 5, 7], [5, 2, 7, 2, 5], [3, 4, 2, 1, 6],
];

/**
 * Draws one frame of a generic pattern. `ctx` belongs to a canvas already
 * sized to the low-res grid (st.w x st.h); t is seconds since the start.
 * `rainbow` tints falling pixels through the hues (NARA!'s page).
 */
export function drawPattern(ctx: CanvasRenderingContext2D, st: PatternState, type: string, raw: PatternParams, t: number, rainbow = false): void {
  const W = st.w, H = st.h;
  const p = withDefaults(type, raw);
  const alpha = Math.max(0, Math.min(1, num(p['opacity'], 0.25)));
  ctx.imageSmoothingEnabled = false;

  // trails: these fade the last frame instead of clearing it
  if (type !== 'matrix_rain' && type !== 'cyber_circuitry') ctx.clearRect(0, 0, W, H);
  if (!isGenericPattern(type)) return;
  ctx.globalAlpha = alpha;

  switch (type) {
    case 'checkerboard': {
      const sz = cell(num(p['size'], 32)), dir = str(p['dir'], 'diagonal');
      const move = Math.floor((t * num(p['speed'], 0.5) * 60) / PX) % (sz * 2);
      const ox = dir === 'right' || dir === 'diagonal' ? move : dir === 'left' ? -move : 0;
      const oy = dir === 'down' || dir === 'diagonal' ? move : dir === 'up' ? -move : 0;
      const c1 = str(p['color1'], '#ffffff'), c2 = str(p['color2'], '#000000');
      // the tile is two cells wide, so counting cells from an offset start keeps the colours in place
      const x0 = (ox % (sz * 2)) - sz * 2, y0 = (oy % (sz * 2)) - sz * 2;
      for (let j = 0, y = y0; y < H; j++, y += sz) {
        for (let i = 0, x = x0; x < W; i++, x += sz) {
          ctx.fillStyle = ((i + j) & 1) === 0 ? c1 : c2;
          ctx.fillRect(x, y, sz, sz);
        }
      }
      break;
    }

    case 'scrolling_lines': {
      // every pixel asks which stripe it falls in: clean stair-stepped diagonals
      const th = Math.max(1, num(p['thickness'], 2) / PX), total = th + num(p['gap'], 16) / PX;
      const ang = (num(p['angle'], 45) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
      const off = (t * num(p['speed'], 1) * 60) / PX;
      const [r, g, b] = rgb(str(p['color'], '#ffffff'));
      const img = pixels(st, ctx), d = img.data;
      for (let y = 0, i = 0; y < H; y++) {
        for (let x = 0; x < W; x++, i += 4) {
          const u = (((x * ca + y * sa - off) % total) + total) % total;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = u < th ? 255 * alpha : 0;
        }
      }
      ctx.putImageData(img, 0, 0);
      break;
    }

    case 'matrix_rain': {
      const size = num(p['size'], 14), spd = num(p['speed'], 3), dens = num(p['density'], 12);
      const gw = 4, gh = 6;   // a 3x5 glyph plus a pixel of spacing
      const scale = Math.max(1, Math.round(size / (PX * gh)));
      if (st['cols'] === undefined || st['colsW'] !== W || st['colsS'] !== scale) {
        st['cols'] = Array.from({ length: Math.ceil(W / (gw * scale)) + 1 }, (_, i) => ({ x: i * gw * scale, y: Math.random() * H, v: 0.5 + Math.random() }));
        st['colsW'] = W; st['colsS'] = scale;
        ctx.clearRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = str(p['color'], '#00ff00');
      for (const col of st['cols'] as { x: number; y: number; v: number }[]) {
        const step = gh * scale;
        const before = Math.floor(col.y / step);
        col.y += (size * col.v * spd * 0.06 * 2) / PX;   // per 30 fps frame
        if (Math.floor(col.y / step) !== before && Math.random() * 40 < dens) {
          const glyph = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          const gy = Math.floor(col.y / step) * step;
          glyph.forEach((row, ry) => { for (let rx = 0; rx < 3; rx++) if (row & (4 >> rx)) ctx.fillRect(col.x + rx * scale, gy + ry * scale, scale, scale); });
        }
        if (col.y > H + step) col.y = -step;
      }
      break;
    }

    case 'bouncing_diamonds': {
      if (!st['diamonds']) st['diamonds'] = Array.from({ length: 30 }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: Math.random() - 0.5, vy: Math.random() - 0.5, r: 0 }));
      const count = num(p['count'], 8), size = cell(num(p['size'], 30)), spd = num(p['speed'], 1.5), spin = p['rotate'] !== 'no';
      ctx.fillStyle = str(p['color'], '#ffff00');
      for (const dm of (st['diamonds'] as { x: number; y: number; vx: number; vy: number; r: number }[]).slice(0, count)) {
        dm.x += (dm.vx * 2 * spd) / PX * 2; dm.y += (dm.vy * 2 * spd) / PX * 2;
        if (dm.x < 0 || dm.x > W) dm.vx *= -1;
        if (dm.y < 0 || dm.y > H) dm.vy *= -1;
        if (spin) dm.r += 0.02;
        // rotation snaps to 16 steps, as a sprite would
        const r = Math.round(dm.r / (Math.PI / 8)) * (Math.PI / 8);
        const pts = [0, 1, 2, 3].map(k => [dm.x + Math.sin(r + (k * Math.PI) / 2) * size, dm.y - Math.cos(r + (k * Math.PI) / 2) * size]);
        for (let k = 0; k < 4; k++) line(ctx, pts[k][0], pts[k][1], pts[(k + 1) % 4][0], pts[(k + 1) % 4][1]);
      }
      break;
    }

    case 'pulse_rings': {
      const spd = num(p['speed'], 0.8), count = num(p['count'], 4), thick = Math.max(1, Math.round(num(p['thick'], 2) / 2));
      const maxR = Math.max(W, H) * 0.8;
      ctx.fillStyle = str(p['color'], '#ffffff');
      for (let i = 0; i < count; i++) {
        const phase = (t * spd * 0.5 + i / count) % 1;
        if (phase <= 0.01) continue;
        // fade in three hard steps rather than smoothly
        ctx.globalAlpha = alpha * Math.ceil((1 - phase) * 3) / 3;
        circle(ctx, W / 2, H / 2, phase * maxR, thick);
      }
      break;
    }

    case 'static_noise': {
      // a new grain about `speed` times a second, in blocks of `size`
      const sz = cell(num(p['size'], 4)), dens = num(p['density'], 0.35);
      const tick = Math.floor(t * num(p['speed'], 15));
      if (st['noiseTick'] === tick && st['img']) { ctx.putImageData(st['img'] as ImageData, 0, 0); break; }
      st['noiseTick'] = tick;
      const [r, g, b] = rgb(str(p['color'], '#ffffff'));
      const img = pixels(st, ctx), d = img.data;
      d.fill(0);
      for (let by = 0; by < H; by += sz) {
        for (let bx = 0; bx < W; bx += sz) {
          if (Math.random() >= dens) continue;
          const a = (0.4 + Math.random() * 0.6) * 255 * alpha;
          for (let y = by; y < Math.min(H, by + sz); y++) {
            for (let x = bx, i = (y * W + bx) * 4; x < Math.min(W, bx + sz); x++, i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; }
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      break;
    }

    case 'falling_pixels': {
      if (!st['drops']) st['drops'] = Array.from({ length: 200 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 0.5 + Math.random() * 1.5, hue: Math.random() * 360 }));
      const count = num(p['count'], 60), size = cell(num(p['size'], 6)), spd = num(p['speed'], 2);
      ctx.fillStyle = str(p['color'], '#ffffff');
      for (const dp of (st['drops'] as { x: number; y: number; v: number; hue: number }[]).slice(0, count)) {
        dp.y += (dp.v * spd) / PX * 2;
        if (dp.y > H + size) { dp.y = -size; dp.x = Math.random() * W; }
        if (rainbow) ctx.fillStyle = `hsl(${(((t * 50 + dp.hue) % 360) + 360) % 360} 80% 78%)`;
        ctx.fillRect(Math.floor(dp.x), Math.floor(dp.y), size, size);
      }
      break;
    }

    case 'scanwave': {
      // a dithered band sweeping across
      const thick = num(p['thickness'], 10) / PX, dir = str(p['dir'], 'down');
      const vertical = dir === 'down' || dir === 'up';
      const period = vertical ? H : W;
      let pos = ((t * num(p['speed'], 2) * 100) / PX) % period;
      if (dir === 'up' || dir === 'left') pos = period - pos;
      const [r, g, b] = rgb(str(p['color'], '#00ffff'));
      const img = pixels(st, ctx), d = img.data;
      d.fill(0);
      const reach = Math.max(1, thick * 0.4);
      const from = Math.max(0, Math.floor(pos - reach)), to = Math.min(period - 1, Math.ceil(pos + reach));
      for (let k = from; k <= to; k++) {
        const strength = 1 - Math.abs(k - pos) / reach;
        if (strength <= 0) continue;
        const span = vertical ? W : H;
        for (let j = 0; j < span; j++) {
          const x = vertical ? j : k, y = vertical ? k : j;
          if (strength < dither(x, y)) continue;
          const i = (y * W + x) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255 * alpha;
        }
      }
      ctx.putImageData(img, 0, 0);
      break;
    }

    case 'crosshatch': {
      const sz = cell(num(p['size'], 24));
      const off = Math.floor((t * num(p['speed'], 0.5) * 30) / PX) % sz;
      ctx.fillStyle = str(p['color'], '#ffffff');
      for (let x = off - sz; x < W; x += sz) ctx.fillRect(x, 0, 1, H);
      for (let y = off - sz; y < H; y += sz) ctx.fillRect(0, y, W, 1);
      break;
    }

    case 'heartbeat': {
      const bpm = num(p['speed'], 80), thick = Math.max(1, Math.round(num(p['thick'], 2) / 2));
      const cycleW = 400 / PX, scroll = (t * (bpm / 60) * 400) / PX, mid = H / 2;
      const profile = [[0.18, 0], [0.2, -0.08], [0.22, 0], [0.3, 0], [0.32, -0.45], [0.35, 0.22], [0.38, 0], [0.55, -0.12], [0.65, 0]];
      const yAt = (x: number) => {
        const wx = scroll + x, idx = Math.floor(wx / cycleW), ratio = (wx % cycleW) / cycleW;
        const s = Math.sin(idx * 1.543) * 1000, intensity = 0.7 + (s - Math.floor(s)) * 0.6;
        const n = Math.sin(Math.floor(wx / 4) * 789.123), jitter = Math.round((n - Math.floor(n)) * 2 - 1);
        let spike = 0;
        for (let i = 0; i < profile.length - 1; i++) {
          const [x1, y1] = profile[i], [x2, y2] = profile[i + 1];
          if (ratio >= x1 && ratio <= x2) { spike = (y1 + ((y2 - y1) * (ratio - x1)) / (x2 - x1)) * H * intensity; break; }
        }
        return mid + jitter + spike;
      };
      ctx.fillStyle = str(p['color'], '#ff0000');
      let py = yAt(0);
      for (let x = 2; x <= W + 2; x += 2) { const y = yAt(x); line(ctx, x - 2, py, x, y, thick); py = y; }
      break;
    }

    case 'twinkling_stars': {
      if (!st['stars'] || st['starsW'] !== W || st['starsH'] !== H) {
        st['stars'] = Array.from({ length: 300 }, () => ({ x: (Math.random() * W) | 0, y: (Math.random() * H) | 0, big: Math.random() < 0.25, ph: Math.random() * Math.PI * 2 }));
        st['starsW'] = W; st['starsH'] = H;
      }
      const count = Math.min(num(p['count'], 100), 300), spd = num(p['speed'], 1);
      ctx.fillStyle = str(p['color'], '#ffffff');
      for (const s of (st['stars'] as { x: number; y: number; big: boolean; ph: number }[]).slice(0, count)) {
        // four frames of twinkle: off, dot, small cross, big cross
        const frame = Math.floor(((Math.sin(t * spd * 3 + s.ph) + 1) / 2) * 3.99);
        if (frame === 0) continue;
        ctx.globalAlpha = alpha * (frame === 1 ? 0.5 : 1);
        ctx.fillRect(s.x, s.y, 1, 1);
        if (frame >= 2) { ctx.fillRect(s.x - 1, s.y, 3, 1); ctx.fillRect(s.x, s.y - 1, 1, 3); }
        if (frame === 3 && s.big) { ctx.fillRect(s.x - 2, s.y, 5, 1); ctx.fillRect(s.x, s.y - 2, 1, 5); }
      }
      break;
    }

    case 'glitch_grid': {
      const sz = cell(num(p['size'], 40)), spd = num(p['speed'], 2);
      ctx.fillStyle = str(p['color'], '#00ff80');
      ctx.globalAlpha = alpha * 0.5;
      for (let x = 0; x < W; x += sz) ctx.fillRect(x, 0, 1, H);
      for (let y = 0; y < H; y += sz) ctx.fillRect(0, y, W, 1);
      // the glitches hold for a few frames, then jump
      const tick = Math.floor(t * 15);
      if (st['glitchTick'] !== tick) {
        st['glitchTick'] = tick;
        const n = Math.floor(((W * H) / (sz * sz * 20)) * spd);
        st['glitches'] = Array.from({ length: n }, () => [(Math.random() * W) | 0, (Math.random() * H) | 0, Math.random() < 0.3]);
      }
      ctx.globalAlpha = Math.min(1, alpha * 1.5);
      for (const [x, y, wide] of st['glitches'] as [number, number, boolean][]) ctx.fillRect(x, y, wide ? sz * 2 : sz, 1);
      break;
    }

    case 'neural_network': {
      if (!st['nodes']) st['nodes'] = Array.from({ length: 100 }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: Math.random() - 0.5, vy: Math.random() - 0.5 }));
      const count = num(p['count'], 40), spd = num(p['speed'], 0.5), reach = 150 / PX;
      const nodes = (st['nodes'] as { x: number; y: number; vx: number; vy: number }[]).slice(0, count);
      ctx.fillStyle = str(p['color'], '#ffffff');
      for (const n of nodes) {
        n.x = (n.x + (n.vx * spd) / PX * 2 + W) % W;
        n.y = (n.y + (n.vy * spd) / PX * 2 + H) % H;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (dist >= reach) continue;
          // links fade in two steps: near and far
          ctx.globalAlpha = Math.min(1, alpha * (dist < reach / 2 ? 1.2 : 0.55));
          line(ctx, nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        }
      }
      ctx.globalAlpha = alpha * 1.5;
      for (const n of nodes) ctx.fillRect(Math.round(n.x) - 1, Math.round(n.y) - 1, 2, 2);
      break;
    }

    case 'cyber_circuitry': {
      // traces that draw themselves and slowly fade, with a pad at every turn
      const dens = num(p['density'], 6), move = Math.max(1, Math.round((num(p['speed'], 1) * 2) / PX * 2));
      if (!st['traces'] || st['tracesW'] !== W) {
        st['traces'] = Array.from({ length: 15 }, () => ({ x: (Math.random() * W) | 0, y: (Math.random() * H) | 0, len: 0, max: (50 + Math.random() * 150) / PX, dir: (Math.random() * 4) | 0 }));
        st['tracesW'] = W;
        ctx.clearRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.02)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = str(p['color'], '#00ffaa');
      for (const c of (st['traces'] as { x: number; y: number; len: number; max: number; dir: number }[]).slice(0, dens)) {
        const dx = c.dir === 0 ? 1 : c.dir === 1 ? -1 : 0, dy = c.dir === 2 ? 1 : c.dir === 3 ? -1 : 0;
        for (let k = 0; k < move; k++) { c.x += dx; c.y += dy; ctx.fillRect(c.x, c.y, 1, 1); }
        c.len += move;
        if (c.len > c.max || c.x < 0 || c.x > W || c.y < 0 || c.y > H) {
          ctx.fillRect(c.x - 1, c.y - 1, 3, 3);
          if (Math.random() < 0.3) { c.dir = (c.dir + (Math.random() < 0.5 ? 1 : 3)) % 4; c.len = 0; c.max = (50 + Math.random() * 150) / PX; }
          else { c.x = (Math.random() * W) | 0; c.y = (Math.random() * H) | 0; c.len = 0; c.dir = (Math.random() * 4) | 0; ctx.fillRect(c.x - 1, c.y - 1, 3, 3); }
        }
      }
      break;
    }

    case 'digital_vortex': {
      const spd = num(p['speed'], 1), count = 15, maxS = Math.max(W, H) * 1.2;
      ctx.fillStyle = str(p['color'], '#ff00ff');
      for (let i = 0; i < count; i++) {
        const rot = Math.round((t * spd * 0.15 + (i / count) * Math.PI * 2) / (Math.PI / 16)) * (Math.PI / 16);
        const size = ((t * spd * 120) / PX + i * (maxS / count)) % maxS;
        ctx.globalAlpha = alpha * Math.ceil((1 - size / maxS) * 4) / 4;
        const h = size / 2, cs = Math.cos(rot), sn = Math.sin(rot);
        const pts = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => [W / 2 + x * cs - y * sn, H / 2 + x * sn + y * cs]);
        for (let k = 0; k < 4; k++) line(ctx, pts[k][0], pts[k][1], pts[(k + 1) % 4][0], pts[(k + 1) % 4][1]);
        if (i % 3 === 0) ctx.fillRect(Math.round(pts[1][0]) - 1, Math.round(pts[1][1]) - 1, 3, 3);
      }
      break;
    }
  }
  ctx.globalAlpha = 1;
}
