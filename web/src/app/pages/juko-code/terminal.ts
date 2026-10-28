// JUKO! · THE CODE GARDEN: what the page lays over the window. Juko herself
// is the cursor (in place of the heart), leaning into the motion, bumping to
// the beat, and a click makes her squish, go ^^ and
// throw a puff of code tokens. Every panel's frame is a ring of streaming
// code with a bright comet running round it. The song drives the sheet's
// glow through three CSS variables, and an equalizer stands along the bottom
// of the window, behind the sheet.
//
// In 0∞ she glitches into cyan and lime ghosts; the whole window gets static,
// torn bands, a tracking line and error spew; a black vignette swallows the
// page and clears over the 22-second intro; on the drop it breaks with a
// flash, two shockwave rings and cracks, and a swaying green-to-yellow border
// holds the page from then on.
import { Raster, bayer } from '../raster';
import { PageOverlay } from '../kit/overlay';
import { text, textWidth } from '../kit/paint';
import { Breakdown } from './breakdown';
import { C, CatState, ERRORS, INTRO, J, LUM, P, TOKENS, drawCat, pick, restart, sync } from './look';
import { CodeRings, Equalizer, SheetPulse } from './sheet';

const g = P.ramp('g'), y = P.ramp('y'), q = P.ramp('q'), z = P.ramp('z'), o = P.ramp('o'), n = P.ramp('n');
const cy = P.ramp('c'), li = P.ramp('l');
const BAYER = Float32Array.from({ length: 16 }, (_, k) => bayer(k & 3, k >> 2));

interface Bit { x: number; y: number; vx: number; vy: number; life: number; ch: string; yellow: boolean }

class Terminal extends PageOverlay {
  private x = innerWidth / 2; private y = innerHeight / 2;
  private st: CatState = { vx: 0, vy: 0, bounce: 0, happy: 0 };
  private cat = new Raster(1, 1); private ghostR = new Raster(1, 1); private catPx = 0;
  private bits: Bit[] = [];
  private readonly rings = new CodeRings((b, lift, warm, glint) =>
    glint ? C['e1'] : warm ? y[Math.min(5, Math.floor(b * 4.2) + lift)] : g[Math.min(9, Math.min(6, Math.floor(b * 5.5)) + lift)]);
  private readonly pulse = new SheetPulse();
  private eq: Equalizer | null = null;
  private boom = { run: -1, t0: -1, cracks: [] as { ang: number; jag: number[] }[] };
  private readonly breakdown = new Breakdown();

  constructor() { super('pg-juko_code', () => P.table, true); }

  protected override begin(): void {
    restart();
    this.x = this.mx > -1000 ? this.mx : innerWidth / 2; this.y = this.my > -1000 ? this.my : innerHeight / 2;
    this.st = { vx: 0, vy: 0, bounce: 0, happy: 0 };
    this.bits = []; this.pulse.reset(); this.boom = { run: -1, t0: -1, cracks: [] };
    this.eq = new Equalizer({ table: P.table, calm: q, crash: z, capCalm: q[5], capCrash: z[5] });
  }
  protected override end(): void {
    this.eq?.remove(); this.eq = null;
    this.pulse.clear();
    this.breakdown.stop(true);
    document.documentElement.classList.remove('pg-juko-0inf');
  }
  // she is placed every frame, where the spring has her
  protected override moved(): void { /* nothing */ }

  protected override press(): void {
    this.st.bounce = 1; this.st.happy = 1.8;
    for (let i = 0; i < 16; i++) {
      const an = Math.random() * Math.PI * 2, s = (70 + Math.random() * 190) / this.px;
      this.bits.push({ x: this.x / this.px, y: this.y / this.px, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 70 / this.px, life: 1, ch: pick(TOKENS), yellow: Math.random() >= 0.55 });
    }
  }
  protected override force(name: string): void {
    // the e2e tests jump the 0∞ clock to just before the drop
    if (name === 'drop' && J.chaos) J.skip += Math.max(0, INTRO - 0.5 - J.el);
  }

  protected frame(r: Raster, t: number, dt: number): boolean {
    sync();
    const { W, H, px } = this, chaos = J.chaos, sev = J.sev, dropped = J.dropped, lvl = J.song.level, onset = J.song.onset, beat = J.song.beat;
    document.documentElement.classList.toggle('pg-juko-0inf', chaos);

    // the spring she follows the pointer on, the squish, and a bump on a strong beat
    const st = this.st;
    // she is the pointer now, so she sits right on it; how fast it moves still leans and bumps her
    if (this.mouse && dt > 0) {
      const k = Math.min(1, dt * 12);
      st.vx += ((this.mx - this.x) / dt - st.vx) * k; st.vy += ((this.my - this.y) / dt - st.vy) * k;
      this.x = this.mx; this.y = this.my;
    } else { st.vx *= 0.9; st.vy *= 0.9; }
    st.bounce = Math.max(0, st.bounce - dt * 3); st.happy = Math.max(0, st.happy - dt);
    if (onset > 0.5) st.bounce = Math.max(st.bounce, (onset - 0.5) * 1.1);

    let any = this.rings.draw(r, px, t, dt, chaos ? sev : 0, lvl, beat);

    // the puff of tokens
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.vy += (130 / px) * dt; b.life -= dt * 1.6;
      if (b.life <= 0) { this.bits.splice(i, 1); continue; }
      const k = b.life * 1.25, c = b.yellow ? (k > 0.66 ? y[4] : k > 0.33 ? y[2] : y[1]) : k > 0.66 ? g[6] : k > 0.33 ? g[4] : g[2];
      text(r, b.x - textWidth(b.ch) / 2, b.y - 2, b.ch, c);
      any = true;
    }

    if (chaos) { this.pageGlitch(r, t, sev, dropped, onset); any = true; }
    if (chaos) { this.frameOfDark(r, t, sev, dropped, lvl, onset); any = true; }
    if (this.boomFrame(r, t, dropped)) any = true;

    this.drawCompanion(t, chaos, sev, lvl, onset);
    this.pulse.tick(t, lvl, beat);
    this.eq?.place();
    this.eq?.draw(W, H, px, t, dt);
    if (chaos) this.breakdown.tick(performance.now() / 1000, sev, dropped, beat);
    else this.breakdown.stop(false);
    return any;
  }

  // ── Juko, and in 0∞ her ghosts ──
  private drawCompanion(t: number, chaos: boolean, sev: number, lvl: number, onset: number): void {
    if (!this.mouse) { this.cursor?.move(0, 0, this.px, false); return; }
    const px = this.px, s = 1.3 / px;
    if (this.catPx !== px) {
      this.catPx = px;
      const w = Math.ceil(150 * s) + Math.ceil(44 / px), h = Math.ceil(160 * s) + Math.ceil(30 / px);
      this.cat = new Raster(w, h); this.ghostR = new Raster(w, h);
    }
    const r = this.cat, hx = Math.floor(r.w / 2), hy = Math.floor(r.h * 0.4);
    r.clear(0);
    if (chaos && sev > 0.04) {
      const amp = (3 + sev * 16) / px, jx = (Math.random() - 0.5) * amp, jy = (Math.random() - 0.5) * amp, gA = 0.25 + sev * 0.3;
      this.ghost(r, hx - 5 / px - jx, hy + jy * 0.6, s, t, lvl, onset, cy, gA);
      this.ghost(r, hx + 5 / px + jx, hy - jy * 0.6, s, t, lvl, onset, li, gA);
      drawCat(r, hx + jx * 0.3, hy + jy * 0.3, s, t, this.st, lvl, onset);
    } else drawCat(r, hx, hy, s, t, this.st, lvl, onset);
    this.cursor?.set(r, P.table, hx, hy, px, true);
    this.cursor?.move(this.x, this.y, px, true);
  }
  /** Her silhouette in one ramp, laid in where the dither passes `level`: a ghost double. */
  private ghost(r: Raster, x: number, y0: number, s: number, t: number, lvl: number, onset: number, ramp: number[], level: number): void {
    const gr = this.ghostR;
    gr.clear(0);
    drawCat(gr, x, y0, s, t, this.st, lvl, onset);
    const p = gr.px, w = gr.w;
    for (let k = 0; k < p.length; k++) {
      const v = p[k];
      if (!v) continue;
      const xx = k % w, yy = (k / w) | 0;
      if (level <= BAYER[((yy & 3) << 2) | (xx & 3)]) continue;
      const l = LUM[v];
      r.px[k] = ramp[l < 60 ? 0 : l < 120 ? 1 : l < 190 ? 2 : 3];
    }
  }

  // ── 0∞: the breakdown reaching past the page, over everything ──
  private pageGlitch(r: Raster, t: number, R: number, dropped: boolean, beat: number): void {
    if (R <= 0.03) return;
    const { W, H, px } = this, p = r.px;
    // static over the whole window
    const cnt = Math.round(W * H * Math.min(0.18, 0.02 + Math.random() * 0.03 + R * 0.1) * 0.3);
    for (let i = 0; i < cnt; i++) { const v = Math.random(); p[(Math.random() * p.length) | 0] = n[v < 0.5 ? 0 : v < 0.8 ? 1 : v < 0.95 ? 2 : 3]; }
    // torn bands of light, straight through the nav, the list and the sheet
    if (Math.random() < 0.1 + R * 0.5) {
      const slices = 1 + Math.floor(Math.random() * (1 + R * 3));
      for (let i = 0; i < slices; i++) {
        const sh = Math.round((6 + Math.random() * (30 + R * 50)) / px), sy = Math.floor(Math.random() * Math.max(1, H - sh));
        const dx = Math.round(((Math.random() - 0.5) * (30 + R * 220 + beat * 120)) / px), c = Math.random() < 0.5 ? g[5] : C['e1'];
        for (let yy = sy; yy < sy + sh; yy++) for (let x = Math.max(0, dx); x < W; x++) if (0.16 > BAYER[((yy & 3) << 2) | (x & 3)]) p[yy * W + x] = c;
      }
    }
    // the tracking line rolling down the window
    const rollY = Math.round((((t * (140 + R * 240)) % (H * px + 100)) - 50) / px);
    if (rollY >= 0 && rollY < H) for (let x = 0; x < W; x++) if (0.2 + R * 0.4 > BAYER[((rollY & 3) << 2) | (x & 3)]) p[rollY * W + x] = g[7];
    // error spew over the whole page
    if (Math.random() < R * 0.16) {
      const msg = pick(ERRORS), sc = 12 + Math.random() * (14 + R * 22) > 24 ? 2 : 1;
      const ex = Math.random() * W * 0.75, ey = Math.random() * H;
      text(r, ex + sc, ey + sc, msg, C['k0'], sc);
      text(r, ex, ey, msg, Math.random() < 0.3 ? C['e1'] : C['a1'], sc);
    }
    // and now and then, after the drop, a dark green film over all of it for a frame
    if (dropped && Math.random() < 0.004 + beat * 0.02 + R * 0.006) {
      for (let k = 0; k < p.length; k++) if (!p[k] && 0.36 > BAYER[(((k / W | 0) & 3) << 2) | (k % W & 3)]) p[k] = g[0];
    }
  }

  /** Before the drop the black vignette that slowly lets go of the page; after it, the swaying border that holds it. */
  private frameOfDark(r: Raster, t: number, sev: number, dropped: boolean, lvl: number, onset: number): void {
    const { W, H, px } = this, p = r.px, el = J.el;
    if (!dropped) {
      const e = Math.min(1, el / INTRO) ** 2;
      const r0 = Math.min(W, H) * (0.05 + e * 0.4), r1 = Math.max(W, H) * (0.45 + e * 0.55);
      const edge = Math.max(0, 0.96 - e * 0.9), core = Math.max(0, 0.82 - e * 0.84), k0 = C['k0'];
      if (edge < 0.01 && core < 0.01) return;
      for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) {
        const u = Math.max(0, Math.min(1, (Math.hypot(x - W / 2, yy - H / 2) - r0) / (r1 - r0)));
        const al = u < 0.6 ? core + (edge * 0.65 - core) * (u / 0.6) : edge * 0.65 + edge * 0.35 * ((u - 0.6) / 0.4);
        if (al > BAYER[((yy & 3) << 2) | (x & 3)]) p[yy * W + x] = k0;
      }
      return;
    }
    // a light residual frame
    const r0 = Math.min(W, H) * 0.32, r1 = Math.max(W, H) * 0.88, k1 = C['k1'];
    for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) {
      const u = (Math.hypot(x - W / 2, yy - H / 2) - r0) / (r1 - r0);
      if (u > 0 && 0.28 * Math.min(1, u) ** 2.1 > BAYER[((yy & 3) << 2) | (x & 3)]) p[yy * W + x] = k1;
    }
    // her palette pushing back: a green-to-yellow border, fading in over 1.3s, swaying with the song
    const inn = Math.min(1, (el - INTRO) / 1.3);
    if (inn < 0.01) return;
    const sway = (4 + lvl * 12) / px, sx = Math.round(Math.sin(t * 0.6) * sway), sy = Math.round(Math.cos(t * 0.46) * sway * 0.7);
    const m = Math.round((7 + Math.sin(t * 1.1) * 2) / px);
    const bw = Math.max(1, Math.round(((6 + onset * 8 + Math.sin(t * 2.3) * 1.2 + sev * 3) * inn) / px));
    const glowW = Math.round(((18 + onset * 18 + sev * 10) * inn * 0.5) / px);
    const core = o[Math.min(4, Math.floor((0.5 + 0.5 * Math.sin(t * 0.85)) * 4.99))];
    const x0 = m + sx, y0 = m + sy, x1 = W - m + sx, y1 = H - m + sy;
    // the soft edge, three widening bands thinning out, then the line itself
    for (let gi = 3; gi >= 1; gi--) this.rectBand(r, x0, y0, x1, y1, bw + glowW * gi, (0.16 / gi) * inn * 1.5, g[4]);
    this.rectBand(r, x0, y0, x1, y1, bw, Math.min(1, inn * (0.75 + lvl * 0.25)) * 1.2, core);
  }
  /** A rectangle's outline `w` thick (straddling it), laid in where the dither passes `level`. */
  private rectBand(r: Raster, x0: number, y0: number, x1: number, y1: number, w: number, level: number, c: number): void {
    const p = r.px, W = r.w, H = r.h, h0 = Math.floor(w / 2), h1 = w - h0;
    const put = (x: number, yy: number) => { if (x >= 0 && yy >= 0 && x < W && yy < H && level > BAYER[((yy & 3) << 2) | (x & 3)]) p[yy * W + x] = c; };
    for (let yy = y0 - h0; yy < y0 + h1; yy++) for (let x = x0 - h0; x < x1 + h1; x++) put(x, yy);
    for (let yy = y1 - h0; yy < y1 + h1; yy++) for (let x = x0 - h0; x < x1 + h1; x++) put(x, yy);
    for (let x = x0 - h0; x < x0 + h1; x++) for (let yy = y0 + h1; yy < y1 - h0; yy++) put(x, yy);
    for (let x = x1 - h0; x < x1 + h1; x++) for (let yy = y0 + h1; yy < y1 - h0; yy++) put(x, yy);
  }

  /** THE BOOM, once an entry, as the vignette breaks: a flash, two shockwave rings and shatter cracks, gone in 0.9s. */
  private boomFrame(r: Raster, t: number, dropped: boolean): boolean {
    const b = this.boom;
    if (dropped && b.run !== J.run) {
      b.run = J.run; b.t0 = t;
      b.cracks = Array.from({ length: 9 }, () => ({ ang: Math.random() * Math.PI * 2, jag: Array.from({ length: 4 }, () => (Math.random() - 0.5) * 40) }));
    }
    if (b.t0 < 0) return false;
    const age = t - b.t0;
    if (age > 0.9) { b.t0 = -1; return false; }
    const { W, H, px } = this, pr = age / 0.9, cx = W / 2, cy0 = H / 2, maxR = Math.hypot(W, H) * 0.58;
    const flash = Math.max(0, 1 - pr * 1.8) ** 2.4 * 0.8;
    if (flash > 0.01) r.dither(0, 0, W, H, C['a3'], flash);
    for (let ri = 0; ri < 2; ri++) {
      const rp = pr * 1.25 - ri * 0.22;
      if (rp <= 0 || rp >= 1) continue;
      const rad = rp * maxR, wd = (7 * (1 - rp) + 1) / px, lv = (1 - rp) * 0.55 * 1.6;
      r.ring(cx, cy0, rad - wd / 2, rad + wd / 2, (x, yy) => (lv > BAYER[((yy & 3) << 2) | (x & 3)] ? C['g7'] : 0));
    }
    if (pr < 0.4) {
      const lv = (1 - pr / 0.4) * 0.75 * 1.3;
      for (const c of b.cracks) {
        let lx = cx, ly = cy0;
        for (let s = 0; s < 4; s++) {
          const rr = maxR * 0.85 * ((s + 1) / 4);
          const nx = cx + Math.cos(c.ang) * rr + c.jag[s] / px, ny = cy0 + Math.sin(c.ang) * rr + c.jag[(s + 1) % 4] / px;
          r.line(lx, ly, nx, ny, (x, yy) => (lv > BAYER[((yy & 3) << 2) | (x & 3)] ? C['g9'] : 0));
          lx = nx; ly = ny;
        }
      }
    }
    return true;
  }
}

export const terminal = new Terminal();
