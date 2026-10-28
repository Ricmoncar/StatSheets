// JUKO! · THE CODE GARDEN: the world behind the sheet, the old page's layers
// in its order. Editor-dark green; soft orbs drifting up; code tickers
// scrolling left; little snippets surfacing and fading; the rain (dense
// green streams with yellow keywords, heads that flare on the beat, the
// field racing when the song is loud); light bands sweeping over it; the odd
// torn slice and garbled block even when nothing is wrong; the whole of it
// breathing with the song inside a frame of shade.
//
// In 0∞ the base rots from green to void across the 22-second intro, the
// rain turns to 0s and ∞s with acid and white flares, static and a rolling
// tracking bar creep in, and on the drop the picture scrambles in blocks,
// smears, slips its vertical hold and flashes inverted.
import { Raster, bayer, table } from '../raster';
import { artPx } from '../host';
import { Scene } from '../kit/scene';
import { glow, glyph, text } from '../kit/paint';
import { C, DN, ERRORS, J, LUM, P, RAIN, RAIN_CHAOS, SNIPPETS, UP, pick, sync } from './look';

/** Column pitch and cell height of the rain, in art pixels (the 3x5 glyph and its gaps). */
const COLW = 4, CELL = 6;
const g = P.ramp('g'), y = P.ramp('y'), a = P.ramp('a'), n = P.ramp('n');
const BAYER = Float32Array.from({ length: 16 }, (_, k) => bayer(k & 3, k >> 2));

// the colours of the old additive washes, one frame each: the drop's punch and the inverted flash
const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hex = (c: number[]) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const DROP = table(P.hex.map(h => (h ? hex(rgb(h).map((v, i) => v + [150, 255, 150][i] * 0.34)) : '')));
const INVERT = table(P.hex.map(h => (h ? hex(rgb(h).map((v, i) => v * 0.6 + Math.abs(v - [20, 107, 40][i]) * 0.4)) : '')));

// how bright a glyph is (the old alpha) to the ramp step it shows as
const tail = (v: number) => (v < 0.05 ? 0 : v < 0.15 ? g[0] : v < 0.3 ? g[1] : v < 0.5 ? g[2] : v < 0.7 ? g[3] : g[4]);
const tailD = (v: number) => (v < 0.08 ? 0 : v < 0.25 ? g[0] : v < 0.55 ? g[1] : g[2]);
const near = (v: number) => (v < 0.3 ? g[2] : v < 0.5 ? g[3] : v < 0.7 ? g[5] : v < 0.85 ? g[6] : g[7]);
const nearD = (v: number) => (v < 0.4 ? g[3] : v < 0.7 ? g[5] : g[6]);
const key = (v: number) => (v < 0.12 ? 0 : v < 0.25 ? y[0] : v < 0.45 ? y[1] : v < 0.7 ? y[2] : y[3]);
const keyD = (v: number) => (v < 0.15 ? 0 : v < 0.55 ? a[0] : v < 0.8 ? a[1] : a[2]);
const acid = (v: number) => (v < 0.4 ? a[0] : v < 0.75 ? a[1] : a[2]);
const white = (v: number) => (v < 0.4 ? g[6] : v < 0.75 ? a[3] : a[4]);

interface Orb { x: number; y: number; r: number; vy: number; sw: number; sa: number; pf: number; ph: number; yellow: boolean; corrupt: boolean }
interface Col { x: number; y: number; spd: number; len: number; phase: number; head: string; cell: number; yellow: boolean; bright: number; glyphs: string[]; ver: number }
interface Row { y: number; off: number; spd: number; dim: boolean; glyphs: string[] }
interface Snip { x: number; y: number; txt: string; yellow: boolean; life: number; dur: number; delay: number }

export class Garden implements Scene {
  private W = 1; private H = 1; private px = 3;
  private orbs: Orb[] = [];
  private cols: Col[] = [];
  private rows: Row[] = [];
  private snips: Snip[] = [];
  /** Per pixel: the breath's reach (1 at the middle) and the frame of shade, and a copy of the frame for the self-copying effects. */
  private breath = new Float32Array(1);
  private vig = new Float32Array(1); private vigChaos = false;
  private band = new Float32Array(1);
  private scratch = new Uint8Array(1);
  private run = -1; private chaos = false; private punched = false;
  private flash: Uint32Array | null = null;

  size(W: number, H: number): void {
    this.W = W; this.H = H; this.px = artPx();
    this.breath = new Float32Array(W * H);
    this.band = new Float32Array(H);
    this.scratch = new Uint8Array(W * H);
    const R = Math.max(W, H) * 0.62;
    for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) this.breath[yy * W + x] = Math.max(0, 1 - Math.hypot(x - W / 2, yy - H / 2) / R);
    this.vig = new Float32Array(0);
    this.lay();
  }

  /** Everything laid out afresh: a new size, or a new entry into (or out of) 0∞. */
  private lay(): void {
    const { W, H, px } = this;
    this.orbs = Array.from({ length: 26 }, () => this.orb(true));
    this.cols = Array.from({ length: Math.ceil(W / COLW) + 1 }, (_, i) => this.col(i * COLW + 1, true));
    this.rows = Array.from({ length: Math.max(10, Math.round((H * px) / 28)) }, () => ({
      y: Math.random() * H, off: Math.random() * 400, spd: (8 + Math.random() * 24) / px, dim: Math.random() < 0.45,
      glyphs: Array.from({ length: 64 }, () => pick(RAIN)),
    }));
    this.snips = Array.from({ length: Math.max(8, Math.round((W * H * px * px) / 58000)) }, () => this.snip(true));
    this.punched = false;
  }
  private orb(scatter: boolean): Orb {
    const { W, H, px } = this;
    return {
      x: Math.random() * W, y: scatter ? Math.random() * H : H + (Math.random() * 50) / px, r: (18 + Math.random() * 58) / px,
      vy: (8 + Math.random() * 22) / px, sw: 0.4 + Math.random() * 0.8, sa: (5 + Math.random() * 14) / px,
      pf: 0.5 + Math.random() * 1.3, ph: Math.random() * Math.PI * 2, yellow: Math.random() < 0.4, corrupt: Math.random() < 0.32,
    };
  }
  private col(x: number, scatter: boolean): Col {
    const H = this.H;
    return {
      x, y: scatter ? Math.random() * H : -Math.random() * H * 0.6, spd: (46 + Math.random() * 88) / this.px,
      len: 10 + Math.floor(Math.random() * 22), phase: (Math.random() * 40) | 0, head: pick(RAIN), cell: -99999,
      yellow: Math.random() < 0.3, bright: 0.4 + Math.random() * 0.78, glyphs: Array.from({ length: 40 }, () => pick(RAIN)), ver: 0,
    };
  }
  private snip(scatter: boolean): Snip {
    const { W, H, px } = this;
    return {
      x: (18 + Math.random() * Math.max(40, W * px - 150)) / px, y: (24 + Math.random() * Math.max(20, H * px - 48)) / px,
      txt: pick(SNIPPETS), yellow: Math.random() < 0.34, life: 0, dur: 3.4 + Math.random() * 3.6,
      delay: scatter ? Math.random() * 5 : 0.3 + Math.random() * 3.5,
    };
  }

  colours(): Uint32Array {
    const f = this.flash;
    this.flash = null;
    return f ?? P.table;
  }

  draw(r: Raster, t: number, dt: number): void {
    sync();
    const { W, H, px } = this, pxs = r.px;
    const aL = J.song.level, aO = J.song.onset, chaos = J.chaos, sev = J.sev, dropped = J.dropped;
    if (chaos !== this.chaos || (chaos && J.run !== this.run)) { this.chaos = chaos; this.run = J.run; this.lay(); }

    // 1 ── the editor-dark base; in 0∞ it rots toward void, and flickers once the drop has come
    if (!chaos) r.clear(C['k2']);
    else if (dropped && Math.random() < 0.08 + aO * 0.25 + sev * 0.1) r.clear(Math.random() < 0.5 ? C['k3'] : C['g0']);
    else {
      const k2 = C['k2'], k1 = C['k1'], k0 = C['k0'], u = sev * 2;
      for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) {
        const th = BAYER[((yy & 3) << 2) | (x & 3)];
        pxs[yy * W + x] = u < 1 ? (u > th ? k1 : k2) : u - 1 > th ? k0 : k1;
      }
    }

    // 2 ── soft orbs drifting up, green and light yellow; after the drop a third of them turn toxic and jitter
    const boost = 1 + aL * 0.9;
    for (const b of this.orbs) {
      const bad = dropped && b.corrupt;
      b.y -= b.vy * dt * boost * (bad ? 1.8 + sev * 1.4 : 1);
      b.x += Math.sin(t * b.sw + b.ph) * b.sa * dt + (bad && Math.random() < 0.04 + sev * 0.1 ? ((Math.random() - 0.5) * (60 + sev * 90)) / px : 0);
      const pulse = (0.45 + 0.55 * Math.sin(t * b.pf + b.ph)) * (1 + aL * 0.5);
      if (b.y < -b.r) Object.assign(b, this.orb(false));
      if (bad) {
        glow(r, b.x, b.y, b.r, [a[0], C['l1'], a[1], C['l0']][(Math.random() * 4) | 0], (0.5 + sev * 0.5) * pulse);
      } else {
        glow(r, b.x, b.y, b.r, C['k4'], Math.min(1, pulse * 0.9));
        glow(r, b.x, b.y, b.r * 0.55, b.yellow ? y[0] : g[0], pulse * 0.75);
      }
    }

    // 3 ── code tickers scrolling left behind the rain, faint and flat
    for (const row of this.rows) {
      row.off += row.spd * dt * (1 + aL * 1.1);
      const c = row.dim ? C['k4'] : g[0], o = row.off % COLW, first = Math.floor(row.off / COLW), gl = row.glyphs;
      for (let j = 0, x = -o; x < W; j++, x += COLW) glyph(r, x, row.y, gl[(first + j) % gl.length], c);
    }

    // 4 ── snippets that fade in and out
    for (const sp of this.snips) {
      sp.life += dt;
      const local = sp.life - sp.delay;
      if (local < 0) continue;
      if (local > sp.dur) { Object.assign(sp, this.snip(false)); continue; }
      const k = Math.sin((Math.PI * local) / sp.dur);
      if (k < 0.15) continue;
      text(r, sp.x, sp.y, sp.txt, sp.yellow ? (k < 0.45 ? y[0] : k < 0.8 ? y[1] : y[2]) : k < 0.45 ? g[0] : k < 0.8 ? g[1] : g[2]);
    }

    // 5 ── the rain
    const cols = this.cols, race = (1 + aL * 1.3) * (1 + sev * 0.35);
    // a: each head's bloom, behind everything in its column
    for (const col of cols) {
      col.y += col.spd * dt * race;
      if (col.y < -6 || col.y > H + 6) continue;
      const s = Math.min(1, 0.5 + col.bright * 0.7);
      glow(r, col.x + 1, col.y, 4.5, col.yellow ? y[0] : g[1], 0.9 * s);
      glow(r, col.x + 1, col.y, 2.5, col.yellow ? y[1] : g[2], 0.7 * s);
    }
    // b: the trails: a rigid ribbon of glyphs per column, a letter in it turning over now and then
    const cfa = Math.min(1, 0.8 + aL * 0.7);
    const corrupt = chaos && sev > 0.02 ? Math.round(sev * 0.22 * 20) / 20 : 0;
    const churn = Math.min(0.3, 0.05 + aL * 0.05 + sev * 0.07);
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci], hc = Math.floor(col.y / CELL);
      if (hc !== col.cell) { col.cell = hc; col.head = pick(chaos && Math.random() < sev ? RAIN_CHAOS : RAIN); }
      if (Math.random() < churn) { col.glyphs[(Math.random() * 40) | 0] = pick(chaos && Math.random() < sev ? RAIN_CHAOS : RAIN); col.ver++; }
      const br = col.bright * cfa, gl = col.glyphs;
      for (let k = 1; k < col.len; k++) {
        const cy = col.y - k * CELL;
        if (cy < -6 || cy > H + 1) continue;
        const idx = (k + col.phase) % 40, f = 1 - k / col.len;
        let c: number;
        if (corrupt && hash3(ci, idx, col.ver) < corrupt) c = hash3(idx, ci, col.ver) < 0.5 ? acid((0.8 * f + 0.2) * br) : white((0.9 * f + 0.2) * br);
        else if (idx % 6 === 0) c = (dropped ? keyD : key)((0.55 * f + 0.18) * br);
        else if (k <= 3) c = (dropped ? nearD : near)((0.9 * f + 0.1) * br);
        else c = (dropped ? tailD : tail)(0.78 * f * br);
        if (c) glyph(r, col.x, cy - 2, gl[idx], c);
      }
      if (col.y - col.len * CELL > H) Object.assign(col, this.col(col.x, false));
    }
    // c: the heads, flaring on the beat
    for (const col of cols) {
      if (col.y < -CELL || col.y > H + CELL) continue;
      const ha = 0.55 + col.bright * 0.45;
      const c = dropped ? nearD(ha + 0.3)
        : aO > 0.35 ? (ha + aO * 0.5 > 1.15 ? a[4] : g[9])
        : col.yellow ? (ha < 0.85 ? y[4] : y[5]) : ha < 0.8 ? g[7] : ha < 0.92 ? g[8] : g[9];
      glyph(r, col.x, col.y - 2, col.head, c);
    }
    // d: and live corruption flares over the trails, flickering at frame rate
    if (corrupt) {
      const flares = Math.min(90, Math.round(cols.length * sev * 0.5));
      for (let i = 0; i < flares; i++) {
        const col = cols[(Math.random() * cols.length) | 0], k = 1 + ((Math.random() * (col.len - 1)) | 0), cy = col.y - k * CELL;
        if (cy < 0 || cy > H) continue;
        const f = 1 - k / col.len;
        glyph(r, col.x, cy - 2, col.glyphs[(k + col.phase) % 40], Math.random() < 0.5 ? acid((0.8 * f + 0.2) * col.bright) : white((0.9 * f + 0.2) * col.bright));
      }
    }

    // 6 ── the glitches: rare and gentle in the garden, gated by severity in 0∞
    if (dropped && !this.punched) { this.punched = true; this.flash = DROP; }
    const glitchP = chaos ? Math.min(0.99, 0.08 + sev * 0.9 + aO * 0.3) : 0.2 + aO * 0.7 + aL * 0.22;
    if (Math.random() < glitchP) {
      const slices = chaos ? 1 + Math.floor(Math.random() * (1 + sev * 3 + aO * 2)) : 1 + Math.floor(Math.random() * (2 + aO * 3));
      for (let i = 0; i < slices; i++) {
        const sh = Math.max(1, Math.round((4 + Math.random() * (chaos ? 20 + aL * 60 + sev * 70 : 26 + aL * 46)) / px));
        const sy = Math.floor(Math.random() * Math.max(1, H - sh));
        const dx = Math.round(((Math.random() - 0.5) * (chaos ? 40 + aL * 160 + aO * 180 + sev * 240 : 44 + aL * 110 + aO * 130)) / px);
        this.tear(r, sy, sh, dx, chaos ? 0.6 : 0.45);
      }
    }
    // memory-corruption chunks slammed somewhere else, after the drop
    if (dropped) {
      const nb = 1 + Math.floor(Math.random() * (1 + sev * 2));
      for (let i = 0; i < nb; i++) {
        if (Math.random() > 0.3 + sev * 0.5) continue;
        const bw = Math.round((40 + Math.random() * W * px * 0.4) / px), bh = Math.round((20 + Math.random() * H * px * 0.3) / px);
        const sx = Math.floor(Math.random() * Math.max(1, W - bw)), sy = Math.floor(Math.random() * Math.max(1, H - bh));
        this.shove(r, sx, sy, bw, bh, Math.round(((Math.random() - 0.5) * (60 + sev * 220)) / px), Math.round(((Math.random() - 0.5) * (30 + sev * 120)) / px));
      }
    }
    // the green channel-split ghost
    if ((chaos && sev > 0.06) || (aO > 0.42 && Math.random() < 0.6)) {
      const off = (chaos ? 3 + aO * 14 + Math.sin(t * 19) * (2 + sev * 8) : 3 + aO * 10) / px;
      this.ghost(r, Math.round(off), dropped ? Math.round((Math.sin(t * 7) * sev * 3) / px) : 0, chaos ? 0.2 + sev * 0.3 : 0.6);
    }
    // garbled blocks of glyphs
    if (Math.random() < (chaos ? sev * 0.8 : 0.14 + aL * 0.32)) {
      const nblk = chaos ? 1 + Math.floor(Math.random() * (1 + sev * 3)) : 1 + Math.floor(Math.random() * 2);
      for (let b = 0; b < nblk; b++) {
        const bx = Math.random() * W, by = Math.random() * H;
        const bw = 3 + Math.floor(Math.random() * (dropped ? 8 : 5)), bh = 1 + Math.floor(Math.random() * (dropped ? 5 : 3));
        for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
          const c = dropped ? (Math.random() < 0.5 ? a[2] : C['e1']) : Math.random() < 0.5 ? g[8] : y[4];
          glyph(r, bx + xx * COLW, by + yy * CELL, pick(dropped ? RAIN_CHAOS : RAIN), c);
        }
      }
    }
    // runtime exceptions flashing across the crash
    if (chaos && Math.random() < sev * 0.12) {
      const msg = pick(ERRORS), sc = 12 + Math.random() * (14 + sev * 20) > 24 ? 2 : 1;
      const ex = Math.random() * W * 0.7, ey = Math.random() * H, jit = Math.round(Math.random() * 2 - 1);
      text(r, ex + sc, ey + sc, msg, C['k0'], sc);
      text(r, ex + jit, ey, msg, Math.random() < 0.3 ? C['e1'] : a[1], sc);
    }
    // the rolling tracking bar, dragging a smeared copy of the frame
    if (chaos && sev > 0.05) {
      const rollY = Math.round((((t * (120 + sev * 260)) % (H * px + 120)) - 60) / px), rh = Math.round((26 + sev * 44) / px);
      this.drag(r, rollY, rh, 0.3 + sev * 0.2);
      for (let x = 0; x < W; x++) for (let yy = rollY - 1; yy <= rollY; yy++) if (yy >= 0 && yy < H && 0.25 + sev * 0.35 > BAYER[((yy & 3) << 2) | (x & 3)]) pxs[yy * W + x] = UP[UP[pxs[yy * W + x]]];
    }
    // the vertical hold slipping, after the drop
    if (dropped && Math.random() < 0.004 + sev * 0.012) {
      const shift = (Math.random() * H) | 0, tmp = this.scratch;
      tmp.set(pxs);
      pxs.set(tmp.subarray(0, (H - shift) * W), shift * W);
      pxs.set(tmp.subarray((H - shift) * W), 0);
    }
    // static
    if (chaos && sev > 0.03) {
      const cnt = Math.round(W * H * Math.min(0.26, 0.04 + Math.random() * 0.05 + sev * 0.14) * 0.4);
      for (let i = 0; i < cnt; i++) pxs[(Math.random() * pxs.length) | 0] = n[(Math.random() * 4) | 0];
    }
    // the inverted flash, softened and green, once the crash is underway
    if (dropped && Math.random() < 0.008 + aO * 0.03 + sev * 0.012) this.flash = INVERT;

    // 7 ── light and shade in one pass: the bands sweeping over the code, the beat's bloom, the breath, and the frame
    this.light(r, t, aL, aO, chaos, sev);
  }

  /** Rows sy..sy+sh shoved sideways by dx, and the shoved copy lit. */
  private tear(r: Raster, sy: number, sh: number, dx: number, lit: number): void {
    const { W } = this, p = r.px;
    for (let yy = sy; yy < Math.min(this.H, sy + sh); yy++) {
      const o = yy * W;
      if (dx > 0) p.copyWithin(o + dx, o, o + W - dx);
      else if (dx < 0) p.copyWithin(o, o - dx, o + W);
      const x0 = Math.max(0, dx);
      for (let x = x0; x < Math.min(W, W + dx); x++) if (lit > BAYER[((yy & 3) << 2) | (x & 3)]) p[o + x] = UP[p[o + x]];
    }
  }
  /** A block of the frame copied over by (dx, dy). */
  private shove(r: Raster, sx: number, sy: number, bw: number, bh: number, dx: number, dy: number): void {
    const { W, H } = this, p = r.px, tmp = this.scratch;
    for (let j = 0; j < bh; j++) tmp.set(p.subarray((sy + j) * W + sx, (sy + j) * W + sx + bw), j * bw);
    for (let j = 0; j < bh; j++) {
      const yy = sy + dy + j;
      if (yy < 0 || yy >= H) continue;
      for (let i = 0; i < bw; i++) { const xx = sx + dx + i; if (xx >= 0 && xx < W) p[yy * W + xx] = tmp[j * bw + i]; }
    }
  }
  /** A dimmer copy of the frame laid over it at (dx, dy), where it is the lighter: the old additive self-copy. */
  private ghost(r: Raster, dx: number, dy: number, level: number): void {
    const { W, H } = this, p = r.px, src = this.scratch;
    src.set(p);
    for (let yy = Math.max(0, dy); yy < Math.min(H, H + dy); yy++) {
      const o = yy * W, so = (yy - dy) * W - dx, b = (yy & 3) << 2;
      for (let x = Math.max(0, dx); x < Math.min(W, W + dx); x++) {
        const s = src[so + x];
        if (LUM[s] > LUM[p[o + x]] + 24 && level > BAYER[b | (x & 3)]) p[o + x] = DN[s];
      }
    }
  }
  /** The band above y copied down onto rows y..y+h where it is lighter: the tracking bar's smear. */
  private drag(r: Raster, y0: number, h: number, level: number): void {
    const { W, H } = this, p = r.px;
    for (let yy = Math.min(H - 1, y0 + h - 1); yy >= Math.max(0, y0); yy--) {
      const sy = yy - h;
      if (sy < 0) continue;
      const o = yy * W, so = sy * W, b = (yy & 3) << 2;
      for (let x = 0; x < W; x++) if (LUM[p[so + x]] > LUM[p[o + x]] && level > BAYER[b | (x & 3)]) p[o + x] = p[so + x];
    }
  }

  private light(r: Raster, t: number, aL: number, aO: number, chaos: boolean, sev: number): void {
    const { W, H } = this, p = r.px;
    if (this.vig.length !== W * H || this.vigChaos !== chaos) {
      // the frame of shade (stronger, and green at its edge, in 0∞), as steps darker
      this.vig = new Float32Array(W * H); this.vigChaos = chaos;
      const r0 = Math.min(W, H) * (chaos ? 0.16 : 0.22), r1 = Math.max(W, H) * 0.72;
      for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) {
        const u = Math.max(0, Math.min(1, (Math.hypot(x - W / 2, yy - H / 2) - r0) / (r1 - r0)));
        this.vig[yy * W + x] = (chaos ? (u < 0.7 ? (u / 0.7) * 0.5 : 0.5 + ((u - 0.7) / 0.3) * 0.35) : u * 0.55) * 1.5;
      }
    }
    // three soft bands sweeping up and down (shape fixed, brightness from the song)
    const bandH = H * 0.55, band = this.band;
    band.fill(0);
    for (let bi = 0; bi < 3; bi++) {
      const dir = bi % 2 === 0 ? 1 : -1, speed = 0.05 + bi * 0.028;
      const ph = (((t * speed * dir) % 1) + 1) % 1, cy = ph * (H + bandH) - bandH / 2, lv = (0.05 + aL * 0.11) * 4;
      for (let yy = Math.max(0, Math.floor(cy - bandH / 2)); yy < Math.min(H, Math.ceil(cy + bandH / 2)); yy++) band[yy] += Math.sin(Math.PI * ((yy - (cy - bandH / 2)) / bandH)) * lv;
    }
    const bloom = aO > 0.05 || (chaos && sev > 0.08) ? (chaos ? Math.min(0.26, aO * 0.22 + sev * 0.07) : Math.min(0.42, aO * 0.3)) * 3 : 0;
    const bA = (chaos ? aL * 0.14 + sev * 0.06 : aL * 0.12) * 4;
    const vig = this.vig, br = this.breath;
    for (let yy = 0; yy < H; yy++) {
      const by = band[yy] + bloom, o = yy * W, b = (yy & 3) << 2;
      for (let x = 0; x < W; x++) {
        const k = o + x;
        let v = by + br[k] * bA - vig[k];
        if (v > -0.03 && v < 0.03) continue;
        const th = BAYER[b | (x & 3)];
        let i = p[k];
        if (v > 0) { if (v > th) { i = UP[i]; if (v - 1 > th) i = UP[i]; } }
        else { v = -v; if (v > th) { i = DN[i]; if (v - 1 > th) i = DN[i]; } }
        p[k] = i;
      }
    }
  }
}

/** A stable pseudo-random number in [0, 1) from three integers (cheaper than kit hash for the rain's thousands a frame). */
function hash3(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
