// JUKO!: what all her pages do to the sheet (the old juko-ui layers, under the
// code garden, 0∞ and "1" alike): an equalizer standing along the bottom of
// the window under the sheet, every panel's frame drawn as a ring of
// streaming code with a bright comet running round it, and the song's glow
// written into three CSS variables the chrome reads, with the portrait's
// sheen and tag and the name's split copies hooked onto the sheet.
import { Raster, Screen, bayer } from '../raster';
import { glyph } from '../kit/paint';
import { J, RAIN, RAIN_CHAOS, pick } from './look';

/** The code frame's cell, in art pixels. */
const CELL = 6;
const BAYER = Float32Array.from({ length: 16 }, (_, k) => bayer(k & 3, k >> 2));

/** The equalizer's colours: a ramp from its dark base to its tips, calm and in the crash, and the lit caps. */
export interface EqLook { table: Uint32Array; calm: number[]; crash: number[]; capCalm: number; capCrash: number }

/** The equalizer: its own canvas along the bottom of the window, under the sheet (the old page's layer behind the panels). */
export class Equalizer {
  readonly cv = document.createElement('canvas');
  private readonly screen = new Screen(this.cv.getContext('2d')!);
  private r = new Raster(1, 1);
  private h = new Float32Array(0); private rate = new Float32Array(0); private ph = new Float32Array(0); private rnd = new Float32Array(0);

  constructor(private readonly look: EqLook) {
    this.cv.setAttribute('aria-hidden', 'true');
    this.cv.className = 'pg-jk-eq';
    this.cv.style.cssText = 'position:fixed;left:0;bottom:0;z-index:0;pointer-events:none;image-rendering:pixelated;';
  }
  /** Behind the sheet's view, in front of the world. */
  place(): void {
    const stage = document.querySelector('ss-main-page .stage'), view = stage?.querySelector(':scope > .view');
    if (stage && view && this.cv.parentElement !== stage) stage.insertBefore(this.cv, view);
  }
  remove(): void { this.cv.remove(); }
  draw(W: number, H: number, px: number, t: number, dt: number): void {
    const chaos = J.chaos, sev = J.sev, lvl = J.song.level, beat = J.song.beat;
    const eqH = Math.min(240, H * px * (chaos ? 0.26 + sev * 0.08 : 0.26)) / px, RH = Math.ceil(Math.min(240, H * px * 0.34) / px) + 2;
    if (this.r.w !== W || this.r.h !== RH) {
      this.r = new Raster(W, RH);
      this.cv.width = W; this.cv.height = RH;
      this.cv.style.width = W * px + 'px'; this.cv.style.height = RH * px + 'px';
    }
    const nb = Math.max(8, Math.floor(W / 2));
    if (this.h.length !== nb) {
      this.h = new Float32Array(nb);
      this.rate = Float32Array.from({ length: nb }, () => 2 + Math.random() * 7);
      this.ph = Float32Array.from({ length: nb }, () => Math.random() * Math.PI * 2);
      this.rnd = Float32Array.from({ length: nb }, () => 0.55 + Math.random() * 0.45);
    }
    const r = this.r, ramp = chaos ? this.look.crash : this.look.calm, cap = chaos ? this.look.capCrash : this.look.capCalm;
    const kUp = Math.min(1, dt * (chaos ? 60 : 38)), kDn = Math.min(1, dt * (chaos ? 16 : 9));
    r.clear(0);
    for (let i = 0; i < nb; i++) {
      const wave = 0.55 + 0.45 * Math.sin(t * this.rate[i] + this.ph[i]);
      const idle = 0.018 + 0.012 * Math.sin(t * 1.4 + i * 0.4);
      let target = Math.min(1, idle + (lvl * 0.5 + beat * 0.72) * wave * this.rnd[i]);
      if (chaos) {
        // random spikes slam bars to the top whatever the music does
        if (Math.random() < 0.06 + sev * 0.14) target = Math.min(1, 0.5 + Math.random() * (0.5 + sev * 0.5));
        target = Math.max(target, 0.12 + 0.28 * (0.5 + 0.5 * Math.sin(t * 9 + i * 0.9)) * (0.5 + sev));
      }
      this.h[i] += (target > this.h[i] ? kUp : kDn) * (target - this.h[i]);
      const bh = Math.round(this.h[i] * eqH);
      if (bh < 1) continue;
      const x = i * 2 + (chaos && Math.random() < sev * 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0);
      for (let k = 0; k < bh; k++) {
        const yy = RH - 1 - k, u = (k / eqH) * (ramp.length - 1), s = Math.min(ramp.length - 2, Math.floor(u));
        r.set(x, yy, u - s > BAYER[((yy & 3) << 2) | (x & 3)] ? ramp[s + 1] : ramp[s]);
      }
      // the lit cap
      if (bh >= 2 && Math.min(chaos ? 0.8 : 0.6, this.h[i] * (chaos ? 0.9 : 0.75)) * 1.6 > BAYER[(((RH - bh) & 3) << 2) | (x & 3)]) r.set(x, RH - bh, cap);
    }
    this.screen.show(r, this.look.table);
  }
}

interface Cell { x: number; y: number; ch: string; shade: number; warm: boolean; flick: number; mut: number }

/** Every panel's frame as a ring of streaming code, drawn into the overlay. */
export class CodeRings {
  private frames = new WeakMap<Element, { w: number; h: number; cells: Cell[] }>();
  private comet = 0;

  /**
   * `ink` picks a glyph's colour: lit to b (0..1.3), lifted `lift` steps
   * toward white by the comet, warm (a few are), or a corruption glint.
   */
  constructor(private readonly ink: (b: number, lift: number, warm: boolean, glint: boolean) => number) {}

  /** cR is how far the breakdown has gone (0 outside 0∞). True if anything was drawn. */
  draw(r: Raster, px: number, t: number, dt: number, cR: number, lvl: number, beat: number): boolean {
    // over the sheet only, and not over a dialog, the trait roll or the open drawer
    if (document.querySelector('ss-modal, ss-roll-overlay, ss-main-page > .scrim')) return false;
    const view = document.querySelector('ss-main-page .view');
    if (!view) return false;
    // between the top bar and the theme bar, where the sheet shows
    const vr = view.getBoundingClientRect();
    const top = Math.max(vr.top, document.querySelector('header.topbar')?.getBoundingClientRect().bottom ?? 0);
    const bottom = Math.min(vr.bottom, document.querySelector('ss-theme-bar')?.getBoundingClientRect().top ?? innerHeight);
    const cx0 = Math.max(0, Math.floor(vr.left / px)), cy0 = Math.max(0, Math.floor(top / px));
    const cx1 = Math.min(r.w, Math.ceil(vr.right / px)), cy1 = Math.min(r.h, Math.ceil(bottom / px));
    const set = cR > 0.4 ? RAIN_CHAOS : RAIN;
    this.comet += dt * (55 + lvl * 130) * (1 + cR * 1.6) / px;
    let drew = false;
    view.querySelectorAll('ss-character-view ss-panel').forEach((el, pi) => {
      const pr = el.getBoundingClientRect();
      if (pr.width < 24 || pr.bottom < top - 40 || pr.top > bottom + 40) return;
      const w = Math.round(pr.width / px), h = Math.round(pr.height / px);
      let f = this.frames.get(el);
      if (!f || f.w !== w || f.h !== h) { f = { w, h, cells: ring(w, h) }; this.frames.set(el, f); }
      const cells = f.cells, N = cells.length, head = (this.comet / CELL + pi * 7) % N;
      const pjx = cR > 0 ? ((Math.random() - 0.5) * cR * 10) / px : 0, pjy = cR > 0 ? ((Math.random() - 0.5) * cR * 10) / px : 0;
      const ox = pr.left / px, oy = pr.top / px;
      // the ring goes round the panel's title plaque and its buttons, which sit on its edge
      const holes = [...el.querySelectorAll(':scope > .head > .title, :scope > .head > .actions > *')].map(hl => {
        const b = hl.getBoundingClientRect();
        return [b.left / px - 1, b.top / px - 1, b.right / px + 1, b.bottom / px + 1];
      });
      for (let i = 0; i < N; i++) {
        const c = cells[i];
        c.mut -= dt * (1 + cR * 2.2);
        if (c.mut <= 0) { c.ch = pick(set); c.mut = 0.25 + Math.random() * 1.7; }
        let d = Math.abs(i - head);
        if (d > N / 2) d = N - d;
        const comet = Math.max(0, 1 - d / 7), flick = 0.8 + 0.2 * Math.sin(t * 7 + c.flick);
        let b = c.shade * flick * (0.3 + lvl * 0.28) + comet * (0.55 + beat * 0.65) + beat * 0.12 + cR * 0.45;
        if (b < 0.045) continue;
        b = Math.min(1.3, b);
        const col = this.ink(b, Math.round(comet * (0.5 + beat * 0.45) * 3), c.warm, cR > 0 && Math.random() < cR * 0.3);
        const gx = Math.round(ox + c.x - 1 + pjx + (cR > 0 ? ((Math.random() - 0.5) * cR * 6) / px : 0));
        const gy = Math.round(oy + c.y - 2 + pjy + (cR > 0 ? ((Math.random() - 0.5) * cR * 6) / px : 0));
        if (gx < cx0 || gy < cy0 || gx + 3 > cx1 || gy + 5 > cy1) continue;
        if (holes.some(hl => gx + 3 > hl[0] && gx < hl[2] && gy + 5 > hl[1] && gy < hl[3])) continue;
        glyph(r, gx, gy, c.ch, col);
        drew = true;
      }
    });
    return drew;
  }
}

/** The cells round a panel w x h (art pixels), one every CELL, riding just inside its edge, clockwise from the top left. */
function ring(w: number, h: number): Cell[] {
  const cells: Cell[] = [], m = CELL * 0.62;
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const k = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / CELL));
    for (let i = 0; i < k; i++) cells.push({
      x: x0 + ((x1 - x0) * i) / k, y: y0 + ((y1 - y0) * i) / k, ch: pick(RAIN),
      shade: 0.45 + Math.random() * 0.55, warm: Math.random() < 0.16, flick: Math.random() * Math.PI * 2, mut: 0.2 + Math.random() * 1.6,
    });
  };
  edge(m, m, w - m, m); edge(w - m, m, w - m, h - m); edge(w - m, h - m, m, h - m); edge(m, h - m, m, m);
  return cells;
}

/** The song in the sheet: the three variables, the portrait's sheen and tag, and the name's text for its split copies. */
export class SheetPulse {
  private css = { g: -1, o: -1, x: -1, t: -9 };
  private fx: HTMLElement | null = null;

  reset(): void { this.css = { g: -1, o: -1, x: -1, t: -9 }; }

  tick(t: number, lvl: number, beat: number): void {
    const view = document.querySelector<HTMLElement>('ss-character-view');
    if (!view) return;
    const nm = view.querySelector('.head .name');
    if (nm && nm.getAttribute('data-text') !== nm.textContent) nm.setAttribute('data-text', nm.textContent || '');
    const pf = view.querySelector('.head .portrait');
    if (pf && (!this.fx || this.fx.parentElement !== pf)) {
      this.fx?.remove();
      const fx = this.fx = document.createElement('span');
      fx.className = 'pg-jk-fx'; fx.setAttribute('aria-hidden', 'true');
      fx.innerHTML = '<i class="sheen"></i><b class="tag">&lt;/&gt;</b>';
      pf.appendChild(fx);
    }
    // Rest dark and let the beat do the talking. Written on a jump, or at most four times a second
    // (every write restyles everything under the sheet).
    const glow = Math.min(1, 0.05 + 0.03 * Math.sin(t * 2) + lvl * 0.22 + beat * 0.92), on = Math.min(1, beat);
    const glitch = beat > 0.5 ? 1 : Math.sin(t * 13) > 0.94 ? 0.5 : 0, c = this.css;
    const jump = Math.abs(glow - c.g) > 0.13 || Math.abs(on - c.o) > 0.16 || glitch !== c.x;
    const settle = t - c.t > 0.25 && (Math.abs(glow - c.g) > 0.03 || Math.abs(on - c.o) > 0.04);
    if (jump || settle) {
      view.style.setProperty('--juko-glow', glow.toFixed(3));
      view.style.setProperty('--juko-onset', on.toFixed(3));
      view.style.setProperty('--juko-glitch', glitch.toFixed(2));
      c.g = glow; c.o = on; c.x = glitch; c.t = t;
    }
  }

  /** Everything handed back. */
  clear(): void {
    this.fx?.remove(); this.fx = null;
    const view = document.querySelector<HTMLElement>('ss-character-view');
    view?.style.removeProperty('--juko-glow'); view?.style.removeProperty('--juko-onset'); view?.style.removeProperty('--juko-glitch');
    document.querySelector('ss-character-view .head .name')?.removeAttribute('data-text');
  }
}
