// JUKO · 1: what the page lays over the window. The thing is bigger than the
// sheet, so the far field of digits drifts across the whole app and three
// arms of digits reach out of the light over the nav and the list; prismatic
// sparks come up through it all; the window's edge carries a spectrum
// fringe that breathes with the song; and every event in the void reaches
// the whole window (the eclipse darkens all of it). The layer adds light,
// like the old page's, so it is screened onto the app.
//
// The cursor is the rainbow sword: its point follows the pointer, the blade
// falls away behind it with the prism set in the guard, and it leaves a
// spectrum ribbon with the digits it cut loose riding on it. A click swings
// it (a spectrum crescent off the edge), throws a split shockwave and a
// scatter of digits, most of them already resolved, and the void answers.
import { Raster, bayer } from '../raster';
import { PageOverlay } from '../kit/overlay';
import { glow, glyph } from '../kit/paint';
import { J, restart, sync } from './look';
import { DIGITS, LUM1, ONE, P1, SPEC, bigGlyph, glyphAt, hueAt, lighten, rnd, step } from './prism';
import { CodeRings, Equalizer, SheetPulse } from './sheet';
import { Void } from './void';

const m = P1.ramp('m'), c = P1.ramp('c'), w = P1.ramp('w'), q = P1.ramp('q'), k = P1.ramp('k'), x4 = P1.ramp('x'), y3 = P1.ramp('y'), g = P1.ramp('g');
const BAYER = Float32Array.from({ length: 16 }, (_, i) => bayer(i & 3, i >> 2));
const TAU = Math.PI * 2;
// ── her blade: CSS px, the point (the pointer's hot spot) at the origin, y down ──
/** How far it reaches from the point, the slash's reach, and the angle it hangs at when at rest. */
const REACH = 420, SWORD = 300, BASE = 0.83;
/**
 * A curved sword, its blade an arc round one centre: it runs from the point
 * (at angle A0 round the centre) back round to its root (at A1), where the
 * hilt is. Its middle line sits at radius 115 near the point and a little
 * further out by the root; the cutting edge is the inside of the curve.
 */
const A0 = 200, A1 = 10, R0 = 115, R1 = 125, WB = 24;
const CEN = [-R0 * Math.cos((A0 * Math.PI) / 180), -R0 * Math.sin((A0 * Math.PI) / 180)];
/** Along the blade (0 the point, 1 the root): its middle line's radius, its half width, and the two barbs on its back. */
const midR = (u: number) => R0 + (R1 - R0) * u;
const halfW = (u: number) => WB * Math.min(1, u / 0.2) ** 0.8 * (1 - 0.12 * u);
const barb = (u: number) => { let b = 0; for (const at of [0.42, 0.66]) if (u > at - 0.07 && u <= at) b = Math.max(b, 15 * ((u - (at - 0.07)) / 0.07)); return b; };
/** The root: where the hilt starts, the way the grip runs, and across it. */
const RA = (A1 * Math.PI) / 180, ROOT = [CEN[0] + R1 * Math.cos(RA), CEN[1] + R1 * Math.sin(RA)], HD = [Math.sin(RA), -Math.cos(RA)], HN = [Math.cos(RA), Math.sin(RA)];
const hilt = (along: number, across: number) => [ROOT[0] + HD[0] * along + HN[0] * across, ROOT[1] + HD[1] * along + HN[1] * across];
/** Its colour along it, as spectrum indices: yellow-green at the point, through green and mint, to cyan and blue by the root. */
const RUN: [number, number][] = [[0, 5], [0.25, 4], [0.5, 3], [0.75, 2], [1, 1]];
const dith = (lv: number, x: number, y: number) => lv > BAYER[((y & 3) << 2) | (x & 3)];

interface Wake { x: number; y: number; life: number; h: number; ch: string }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; ch: string }
interface Arm { ang: number; len: number; curl: number; br: number; root: number; rt: number; n: number; spd: number; wf: number; wa: number; ph: number }

const ARMS: Arm[] = [[-1.38, 0.8, 1.2, 0.5], [0.36, 0.95, -1.5, 0.42], [-0.54, 1.05, 0.9, 0.34]].map(([ang, len, curl, br], i) => ({
  ang, len, curl, br, root: ang + (rnd(i * 2.7 + 5) - 0.5) * 1.4, rt: 0.1 + rnd(i * 6.7 + 5) * 0.14, n: 26 + ((rnd(i * 8.3 + 5) * 10) | 0),
  spd: 0.07 + rnd(i * 4.1 + 5) * 0.06, wf: 0.22 + rnd(i * 6.7 + 5) * 0.22, wa: 0.06 + rnd(i * 3.3 + 5) * 0.06, ph: rnd(i * 9.1 + 5) * TAU,
}));

class Blade extends PageOverlay {
  private x = innerWidth / 2; private y = innerHeight / 2; private vx = 0; private vy = 0;
  private wake: Wake[] = [];
  private bursts: { x: number; y: number; life: number }[] = [];
  private bits: Bit[] = [];
  private sparks = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.05, w: 0.4 + Math.random() * 1.2, ph: Math.random() * TAU, h: (Math.random() * 8) | 0 }));
  private sky: { x: number; y: number; ch: string; ink: number }[] = []; private skyW = 0;
  private ring = -99;
  private sword = new Raster(1, 1); private swordPx = 0;
  private film: HTMLDivElement | null = null; private filmOp = '';
  private eq: Equalizer | null = null;
  private readonly rings = new CodeRings((b, lift, warm) =>
    warm ? (lift ? w[Math.min(4, 1 + lift)] : c[Math.min(4, Math.floor(b * 3.8))]) : m[Math.min(6, Math.min(5, Math.floor(b * 4.6)) + lift)]);
  private readonly pulse = new SheetPulse();

  constructor(private readonly world: Void) { super('pg-juko_one', () => P1.table, true); }

  protected override begin(): void {
    restart();
    this.blend('screen');
    this.x = this.mx > -1000 ? this.mx : innerWidth / 2; this.y = this.my > -1000 ? this.my : innerHeight / 2;
    this.vx = this.vy = 0; this.wake = []; this.bursts = []; this.bits = []; this.ring = -99;
    ONE.pulse = 0; ONE.swing = 0; ONE.tip = null; ONE.clickAt = null;
    this.pulse.reset();
    this.eq = new Equalizer({ table: P1.table, calm: q, crash: q, capCalm: q[5], capCrash: q[6] });
    const f = this.film = document.createElement('div');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;background:#000205;opacity:0;';
    document.body.appendChild(f);
    this.filmOp = '0';
    document.documentElement.classList.add('pg-juko-one');
  }
  protected override end(): void {
    this.eq?.remove(); this.eq = null;
    this.film?.remove(); this.film = null;
    this.pulse.clear();
    ONE.tip = null;
    document.documentElement.classList.remove('pg-juko-one');
  }
  // the sword is placed every frame, where the spring has it
  protected override moved(): void { /* nothing */ }
  protected override force(name: string): void { this.world.force(name); }

  protected override press(): void {
    // the value asserting itself: a shockwave off the point and a scatter of digits, most of them already resolved
    ONE.pulse = 1; ONE.swing = 1;
    ONE.clickAt = { x: this.x, y: this.y };
    this.bursts.push({ x: this.x, y: this.y, life: 1 });
    if (this.bursts.length > 4) this.bursts.shift();
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * TAU, s = (90 + Math.random() * 240) / this.px;
      this.bits.push({ x: this.x / this.px, y: this.y / this.px, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40 / this.px, life: 1, ch: Math.random() < 0.6 ? '1' : DIGITS[(Math.random() * 10) | 0] });
    }
  }

  protected frame(r: Raster, t: number, dt: number): boolean {
    sync();
    const { W, H, px } = this, beat = J.song.beat, lvl = J.song.level, onset = J.song.onset, ev = ONE.ev;
    // the same floaty spring the cat rode on
    if (this.mouse) {
      this.vx += ((this.mx - this.x) * 80 - this.vx * 10) * dt;
      this.vy += ((this.my - this.y) * 80 - this.vy * 10) * dt;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    ONE.pulse = Math.max(0, ONE.pulse - dt * 1.9);
    ONE.swing = Math.max(0, ONE.swing - dt * 1.35);
    ONE.tip = this.mouse ? { x: this.x, y: this.y } : null;
    const X = this.x / px, Y = this.y / px;
    if (this.mouse && (!this.wake.length || Math.hypot(this.x - this.wake[0].x, this.y - this.wake[0].y) > 13)) {
      this.wake.unshift({ x: this.x, y: this.y, life: 1, h: (this.wake.length + ((t * 6) | 0)) % 8, ch: glyphAt(0.5, this.wake.length + t * 31) });
      if (this.wake.length > 26) this.wake.pop();
    }

    // where the light is, in the window
    const box = document.querySelector('ss-world-canvas')?.getBoundingClientRect();
    let LX = innerWidth * 0.7, LY = innerHeight * 0.3, S = Math.min(innerWidth * 0.55, innerHeight * 0.95);
    if (box && box.width > 0 && box.height > 0) { LX = box.left + box.width * 0.73 + ONE.parX; LY = box.top + box.height * 0.29 + ONE.parY; S = Math.min(box.width * 0.55, box.height * 0.95); }

    // ── the far field, drifting across the whole application
    if (this.skyW !== W) this.bakeSky();
    const off = (t * 1.03) % W, skyLv = 0.6 + lvl * 0.35;
    for (const s of this.sky) {
      let sx = s.x - off;
      if (sx < -3) sx += W;
      if (skyLv > 0.5 || dith(skyLv * 1.6, sx | 0, s.y | 0)) glyph(r, sx, s.y, s.ch, s.ink);
    }
    // ── the light the sword carries, spilled onto the chrome, and the light round the sword itself
    if (this.mouse) {
      const R = (190 + beat * 70 + ONE.pulse * 120) / px;
      glow(r, X, Y, R, m[0], 0.55);
      glow(r, X, Y, R * 0.45, m[1], 0.6);
      glow(r, X, Y, 54 / px, m[2], 0.5);
    }
    // ── sparks: prismatic motes coming up through the application
    for (const s of this.sparks) {
      s.y -= s.v * dt * (1 + lvl);
      if (s.y < -0.03) { s.y = 1.03; s.x = Math.random(); }
      const st = step((0.3 + beat * 0.4) * (0.5 + 0.5 * Math.sin(t * 2.2 + s.ph)));
      if (st >= 0) r.rect(s.x * W + (Math.sin(t * s.w + s.ph) * 22) / px - 1, s.y * H - 1, 2, 2, SPEC[s.h][st]);
    }
    // ── the outer arms, reaching over the nav and the list
    this.arms(r, LX, LY, S * 1.5, t * 0.8, beat * 0.6);
    // ── a spectrum fringe round the edge of the window, breathing on the music
    {
      const mm = (3 + beat * 5) / px, st = step(0.06 + beat * 0.14);
      if (st >= 0) for (let i = 0; i < 8; i++) {
        const o = Math.round(i * 1.2 + mm), ink = SPEC[i][st];
        r.rect(o, o, W - o * 2, 1, ink); r.rect(o, H - o - 1, W - o * 2, 1, ink);
        r.rect(o, o, 1, H - o * 2, ink); r.rect(W - o - 1, o, 1, H - o * 2, ink);
      }
    }
    // ── every event in the void reaches the whole window
    let film = 0;
    if (ev?.name === 'eclipse') {
      film = ev.p < 0.62 ? Math.sin((ev.p / 0.62) * Math.PI * 0.85) * 0.72 : 0;
      const fl = ev.p > 0.62 ? (1 - (ev.p - 0.62) / 0.38) ** 2.2 : 0;
      if (fl > 0.02) r.dither(0, 0, W, H, w[3], fl * 0.5);
    }
    const op = film.toFixed(2);
    if (this.film && op !== this.filmOp) { this.film.style.opacity = op; this.filmOp = op; }
    if (ev && (ev.name === 'wingbeat' || ev.name === 'cascade')) this.circle(r, LX, LY, ev.p * Math.hypot(innerWidth, innerHeight) * 1.15, 1 + (1 - ev.p) * 3, (1 - ev.p) ** 2 * 0.3, m[4]);
    if (ev?.name === 'garden') {
      // the old room bleeding out past the sheet as well
      const env = Math.sin(Math.PI * ev.p), cols = Math.min(60, Math.round(innerWidth / 64));
      for (let i = 0; i < cols; i++) {
        const gx = ((i + 0.5) * (innerWidth / cols)) / px, head = ((t * (200 + rnd(i * 3.1) * 260) + rnd(i * 7.7) * innerHeight * 3) % (innerHeight * 1.4)) - innerHeight * 0.2;
        for (let kk = 0; kk < 5; kk++) {
          const gy = (head - kk * 36) / px, a = env * (1 - kk / 5) * 0.32;
          if (gy < -6 || gy > H + 6 || a < 0.06) continue;
          glyph(r, gx - 1, gy - 2, DIGITS[(i * 7 + kk * 3 + ((t * 9) | 0)) % 10], kk === 0 ? g[a > 0.2 ? 3 : 2] : g[a > 0.15 ? 1 : 0]);
        }
      }
    }
    // ── and the resolve pulse on a hit, splitting as it crosses the application
    if (onset > 0.5 && t - this.ring > 1.4) this.ring = t;
    const rq = (t - this.ring) / 2.4;
    if (rq >= 0 && rq < 1) for (let i = 0; i < 8; i += 2) this.circle(r, LX, LY, rq * Math.hypot(innerWidth, innerHeight) * 0.85 + i * 2 * px, 1, (1 - rq) ** 2.4 * 0.3, SPEC[i][2]);

    // ── every panel's frame, in the void's light
    this.rings.draw(r, px, t, dt, 0, lvl, beat);

    // ── the sword's light, its wake, the burst and the slash
    this.trail(r, t, dt);
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.vy += (130 / px) * dt; b.life -= dt * 1.6;
      if (b.life <= 0) { this.bits.splice(i, 1); continue; }
      glyph(r, b.x - 1, b.y - 2, b.ch, m[Math.min(6, Math.max(1, Math.round(b.life * 1.25 * 6)))]);
    }
    if (this.mouse) this.bladeLight(r, t, beat);

    this.drawSword(t, beat);
    this.pulse.tick(t, lvl, beat);
    this.eq?.place();
    this.eq?.draw(W, H, px, t, dt);
    return true;
  }

  private bakeSky(): void {
    const { W, H, px } = this, n = Math.round((W * H * px * px) / 11000);
    this.skyW = W;
    this.sky = Array.from({ length: n }, (_, i) => {
      const h = i * 4.3 + 17, x = rnd(h) * W, y = rnd(h * 2.7) * H;
      return { x, y, ch: DIGITS[(rnd(h * 7.7) * 10) | 0], ink: SPEC[hueAt(x * px - innerWidth * 0.73, y * px - innerHeight * 0.29)][0] };
    });
  }

  /** The arms: digits flowing out of the light along curling paths, resolved near the root, undecided at the tips. */
  private arms(r: Raster, cx: number, cy: number, S: number, t: number, beat: number): void {
    const px = this.px;
    ARMS.forEach((a, ai) => {
      const rt = S * a.rt, len = S * a.len * (1 + beat * 0.05), stp = len / a.n, flow = (t * a.spd * a.n) % 1;
      let x = cx + Math.cos(a.root) * rt, y = cy + Math.sin(a.root) * rt, dir = a.ang + Math.sin(t * a.wf + a.ph) * a.wa;
      for (let i = 0; i < a.n; i++) {
        const u = (i + flow) / a.n;
        dir += (a.curl / a.n) * (0.35 + u * 1.9) + Math.sin(u * 5.5 + t * a.wf * 1.7 + a.ph) * 0.035;
        x += Math.cos(dir) * stp; y += Math.sin(dir) * stp;
        const al = (0.4 + beat * 0.3) * (1 - u) ** 0.7 * a.br, st = step(al);
        if (st < 0) continue;
        const ink = u < 0.2 ? w[Math.min(4, st + 1)] : SPEC[hueAt(x - cx, y - cy)][st];
        const sc = Math.max(1, Math.round((S * (0.03 - u * 0.015) * 0.62) / (5 * px)));
        const ch = glyphAt(1 - u, ai * 53 + i * 3.1);
        if (sc === 1) glyph(r, x / px - 1, y / px - 2, ch, ink);
        else bigGlyph(r, x / px, y / px, ch, sc, () => ink, true);
      }
    });
  }

  /** The wake (a spectrum ribbon through where the point has been, the digits it cut loose riding on it), the bursts, the slash. */
  private trail(r: Raster, t: number, dt: number): void {
    const px = this.px, wk = this.wake;
    if (wk.length > 2) for (let s = 0; s < 3; s++) {
      const st = step(0.3 - s * 0.06) + 1, ink = SPEC[(s * 3 + ((t * 4) | 0)) % 8][Math.min(3, st)];
      let lx = wk[0].x / px, ly = wk[0].y / px;
      for (let i = 1; i < wk.length - 1; i++) {
        const nx = ((wk[i].x + wk[i + 1].x) / 2) / px + (s - 1) * 0.6, ny = ((wk[i].y + wk[i + 1].y) / 2) / px;
        r.line(lx, ly, nx, ny, (xx, yy) => (LUM1[ink] > LUM1[r.get(xx, yy)] ? ink : 0));
        lx = nx; ly = ny;
      }
    }
    for (let i = wk.length - 1; i >= 0; i--) {
      const q2 = wk[i];
      q2.life -= dt * 0.66;
      if (q2.life <= 0) { wk.splice(i, 1); continue; }
      const st = step(q2.life * q2.life * 0.75 * 1.4);
      if (st >= 0) glyph(r, q2.x / px - 1, (q2.y + (1 - q2.life) * 11) / px - 2, q2.ch, SPEC[q2.h][st]);
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt * 0.66;
      if (b.life <= 0) { this.bursts.splice(i, 1); continue; }
      const qq = 1 - b.life;
      for (let kk = 0; kk < 8; kk++) this.circle(r, b.x, b.y, 8 + qq * (118 + kk * 9), b.life > 0.5 ? 2 : 1, b.life * b.life * 0.42, SPEC[kk][2]);
    }
    // the slash: a spectrum crescent thrown off the edge, one arc per hue
    if (ONE.swing > 0 && this.mouse) {
      const ang = this.angle(t), L = SWORD, sp = 1 - ONE.swing, lv = Math.min(1, ONE.swing * ONE.swing * 0.55 * 2.2);
      for (let kk = 0; kk < 8; kk++) {
        const rad = L * (0.42 + sp * 0.8) + kk * 1.6 * 2, a0 = ang - 1.6 + sp * 2, a1 = ang - 0.3 + sp * 2, n = Math.ceil(((a1 - a0) * rad) / px) * 2;
        for (let j = 0; j <= n; j++) {
          const an = a0 + ((a1 - a0) * j) / n, xx = (this.x + Math.cos(an) * rad) / px, yy = (this.y + Math.sin(an) * rad) / px;
          if (dith(lv, xx | 0, yy | 0)) lighten(r, xx, yy, SPEC[kk][3]);
          if (ONE.swing > 0.5) lighten(r, xx + 1, yy, SPEC[kk][2]);
        }
      }
    }
  }

  /** The blade's own light, round the hollow of the crescent. */
  private bladeLight(r: Raster, t: number, beat: number): void {
    const px = this.px, rot = this.angle(t) - BASE, c2 = Math.cos(rot), s2 = Math.sin(rot), bob = Math.sin(t * 1.6) * 2.2;
    const gx = this.x + CEN[0] * c2 - CEN[1] * s2, gy = this.y + bob + CEN[0] * s2 + CEN[1] * c2;
    glow(r, gx / px, gy / px, (150 + beat * 30 + ONE.pulse * 40) / px, SPEC[2][0], 0.45);
  }

  /** Where the blade points: down and right, leaning into the motion, breathing when left alone, swung back by a click. */
  private angle(t: number): number {
    const lean = Math.max(-0.5, Math.min(0.5, this.vx / 900)) + Math.sin(t * 0.9) * 0.03;
    return 0.83 + lean - (ONE.swing > 0 ? Math.sin(ONE.swing * Math.PI) * 1.55 : 0);
  }

  /**
   * THE CURSOR: her curved sword, on a canvas of its own with the point as
   * its hot spot. One clean crescent of dark steel: a white cutting edge
   * along the inside of the curve, the back edged in the spectrum with two
   * barbs on it, a spectrum fuller with a surge of white riding down it; a
   * guard with a spiral curl, a wrapped grip and a diamond pommel. Edged in
   * black. A glint runs along the edge on the beat.
   */
  private drawSword(t: number, beat: number): void {
    if (!this.mouse) { this.cursor?.move(0, 0, this.px, false); return; }
    const px = this.px;
    if (this.swordPx !== px) { this.swordPx = px; const n = Math.ceil((2 * REACH) / px); this.sword = new Raster(n, n); }
    const r = this.sword, h = r.w / 2, f = Math.min(1, Math.hypot(this.vx, this.vy) / 520), pulse = ONE.pulse;
    const bob = (Math.sin(t * 1.6) * 2.2 * (1 - f)) / px, rot = this.angle(t) - BASE, c2 = Math.cos(rot), s2 = Math.sin(rot);
    const at = (x: number, y: number): [number, number] => [h + (x * c2 - y * s2) / px, h + bob + (x * s2 + y * c2) / px];
    const local = (X: number, Y: number): [number, number] => {
      const dx = (X + 0.5 - h) * px, dy = (Y + 0.5 - h - bob) * px;
      return [dx * c2 + dy * s2, -dx * s2 + dy * c2];
    };
    const hue = (u: number) => { let i = 0; while (i < RUN.length - 2 && u > RUN[i + 1][0]) i++; const [u0, h0] = RUN[i], [u1, h1] = RUN[i + 1]; return Math.round(h0 + ((h1 - h0) * (u - u0)) / (u1 - u0)); };
    const glint = beat > 0.35 || pulse > 0.1 ? (t * 0.9) % 1.4 : -1, surge = 1 - ((t * 0.55) % 1.3);
    r.clear(0);

    // THE BLADE, pixel by pixel round its centre
    const span = A0 - A1, ext = R1 + WB + 16;
    const [bx0, by0] = at(CEN[0] - ext, CEN[1] - ext), [bx1, by1] = at(CEN[0] + ext, CEN[1] + ext), [bx2, by2] = at(CEN[0] - ext, CEN[1] + ext), [bx3, by3] = at(CEN[0] + ext, CEN[1] - ext);
    const X0 = Math.max(0, Math.floor(Math.min(bx0, bx1, bx2, bx3))), X1 = Math.min(r.w - 1, Math.ceil(Math.max(bx0, bx1, bx2, bx3)));
    const Y0 = Math.max(0, Math.floor(Math.min(by0, by1, by2, by3))), Y1 = Math.min(r.h - 1, Math.ceil(Math.max(by0, by1, by2, by3)));
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
      const [lx, ly] = local(X, Y), dx = lx - CEN[0], dy = ly - CEN[1], rho = Math.hypot(dx, dy);
      let a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (a < A1 - 5) a += 360;
      const u = (A0 - a) / span;
      if (u < 0 || u > 1) continue;
      const mid = midR(u), hw = halfW(u), inner = rho - (mid - hw), outer = mid + hw + barb(u) - rho;
      if (inner < 0 || outer < 0) continue;
      let ink: number;
      if (inner < px) ink = Math.abs(u - glint) < 0.03 ? w[4] : w[3];             // the cutting edge, inside the curve
      else if (inner < px * 2) ink = m[5];
      else if (outer < px) ink = SPEC[hue(u)][3];                                  // the back, in the spectrum
      else if (Math.abs(rho - mid) < px * 0.6 && u > 0.12 && u < 0.94) ink = Math.abs(u - surge) < 0.025 ? w[4] : SPEC[hue(u)][2];   // the fuller
      else ink = inner < hw * 0.7 ? k[3] : k[2];                                   // the steel, lighter toward the edge
      r.set(X, Y, ink);
    }

    // THE HILT: a guard across the root with a spiral curled at its outer end, the wrapped grip, a diamond pommel
    const poly = (pts: number[][], fill: number, edge: number) => {
      const P = pts.map(([x, y]) => at(x, y));
      r.poly(P.flat(), fill);
      for (let i = 0; i < P.length; i++) r.line(P[i][0], P[i][1], P[(i + 1) % P.length][0], P[(i + 1) % P.length][1], edge);
    };
    poly([hilt(-3, -30), hilt(-3, 30), hilt(6, 26), hilt(6, -26)], k[3], m[4]);
    const curl: number[][] = [];
    for (let i = 0; i <= 36; i++) { const a = (i / 36) * Math.PI * 3 + t * 0.6, rr = 2 + (i / 36) * 9; curl.push([hilt(2, 38)[0] + Math.cos(a) * rr, hilt(2, 38)[1] + Math.sin(a) * rr]); }
    for (let i = 1; i < curl.length; i++) { const p0 = at(curl[i - 1][0], curl[i - 1][1]), p1 = at(curl[i][0], curl[i][1]); r.line(p0[0], p0[1], p1[0], p1[1], m[4]); }
    poly([hilt(6, -6), hilt(6, 6), hilt(96, 5), hilt(96, -5)], k[1], m[3]);
    for (let i = 0; i < 10; i++) { const p0 = at(...(hilt(10 + i * 9, -5) as [number, number])), p1 = at(...(hilt(15 + i * 9, 5) as [number, number])); r.line(p0[0], p0[1], p1[0], p1[1], k[4]); }
    poly([hilt(96, 0), hilt(108, -9), hilt(120, 0), hilt(108, 9)], k[2], w[3]);
    { const [gx, gy] = at(...(hilt(108, 0) as [number, number])); r.rect(gx - 1, gy - 1, 2, 2, pulse > 0.2 || beat > 0.5 ? w[4] : x4[2]); }

    // edged in black, so it reads over anything
    r.outline(k[0]);
    this.cursor?.set(r, P1.table, h, h, px, true);
    this.cursor?.move(this.x, this.y, px, true);
  }

  /** A ring (centre and radius window CSS px, `wd` pixels thick) at `level`, only where it brings light. */
  private circle(r: Raster, x: number, y: number, rad: number, wd: number, level: number, ink: number): void {
    const px = this.px, R = rad / px, lv = Math.min(1, level * 1.8);
    if (R < 0.5 || lv < 0.03) return;
    r.ring(x / px, y / px, R - wd / 2, R + wd / 2, (xx, yy) => (dith(lv, xx, yy) && LUM1[ink] > LUM1[r.get(xx, yy)] ? ink : 0));
  }
}

export function blade(world: Void): Blade { return new Blade(world); }
