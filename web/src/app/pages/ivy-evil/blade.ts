// OVER THE WINDOW: the rapier you hold, the cuts it opens through the
// interface, the frame of the room reaching out into the corners of the
// window, and the heartbeat in the interface itself. Drawn at the same art
// resolution as everything else, so the blade is pixels like the room is.
//
// The rapier's TIP is the pointer, because a rapier points at what you are
// pointing at; the hilt hangs back and leans into wherever you are going.
// A click on nothing is a thrust, and a thrust is a cut across the window:
// the interface is masked open along it and shoved apart in whole pixels,
// held, and closed again. A click on a control is just a click.
//
// It is several layers, so a frame only redraws what changed: the corners
// and the heartbeat at the edges are small canvases shown again only when
// the palette or the beat moves on, the dark is a veil shown once per step,
// the rapier is its own small canvas that travels with the pointer, and the
// full-window layer is drawn only while a cut, a splinter or an event is on it.
import { Raster, Screen, bayer, css } from '../raster';
import { SMALL, artPx, interfaceTargets, isInteractive } from '../host';
import { BUD, C, EventName, ROSE5, ROSE7, clock } from './look';

const TAU = Math.PI * 2;
const hash = (a: number, b = 0, c = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };
const IDLE = -2.25;      // at rest the blade points up and left, like an arrow
const STEPS = 48;        // the blade is drawn at one of 48 angles, so it does not shimmer as it turns
const R = 64;            // the rapier's canvas is 2R across, the tip at its middle
const BAND = 3;          // how deep the heartbeat reaches in from the edges
const PULSES = [0, 0.3, 0.55, 0.85];   // the heartbeat at the edges, in steps

interface Cut { x: number; y: number; a: number; t0: number; w: number; seed: number; burst: boolean }
interface Bit { x: number; y: number; vx: number; vy: number; c: number; life: number; size: number }
interface Petal { x: number; y: number; el: HTMLElement; at: string; look: string }
interface Ghost { x: number; y: number; a: number; life: number }
interface Target { el: HTMLElement; k: number; bx: number; by: number; bw: number; bh: number; tx: number; ty: number }

/** One canvas of art pixels in the overlay, placed by CSS and shown through the palette. */
class Layer {
  readonly cv = document.createElement('canvas');
  r = new Raster(1, 1);
  private readonly ctx: CanvasRenderingContext2D;
  private readonly screen: Screen;
  private on = true;

  constructor(parent: HTMLElement, place: string) {
    this.cv.style.cssText = 'position:absolute;image-rendering:pixelated;' + place;
    parent.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    this.screen = new Screen(this.ctx);
  }
  /** Sizes it to w x h art pixels (and its own raster with it, unless it shows someone else's). */
  size(w: number, h: number, px: number, own = true): Raster {
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    if (own && (this.r.w !== w || this.r.h !== h)) this.r = new Raster(w, h);
    this.cv.style.width = w * px + 'px';
    this.cv.style.height = h * px + 'px';
    return this.r;
  }
  show(r = this.r): void { this.screen.show(r, clock.colours); }
  wipe(): void { this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); }
  visible(v: boolean): void { if (v !== this.on) { this.on = v; this.cv.style.visibility = v ? '' : 'hidden'; } }
}

export class Blade {
  private root: HTMLElement | null = null;
  private corners: Layer[] = [];
  private edges: Layer[] = [];
  private veil: Layer | null = null;
  private fx: Layer | null = null;
  private cursor: Layer | null = null;
  // what each layer last showed, so it is shown again only when that changes
  private dims = '';
  private shown = { tone: -1, beat: -1, veil: '', blade: '', at: '', frame: true };
  private corner = new Raster(1, 1);
  private bands: { top: Raster; side: Raster }[] = [];
  private px = 3;
  private raf = 0;
  private paced = false;
  private last = 0;
  // the pointer, in art pixels
  private mx = -1; private my = -1; private pmx = -1; private pmy = -1;
  private mouse = false;
  private down = false;
  private ang = IDLE;
  private lunge = 0;
  private ghosts: Ghost[] = [];
  private cuts: Cut[] = [];
  private bits: Bit[] = [];
  private petals: Petal[] = [];
  private masked = false;
  private ink = false;
  private targets: Target[] = [];
  private targetsAt = -9;
  private thump = { n: 0, until: 0, big: false };
  private crack: { pts: number[][]; for: number } | null = null;
  private tap: { x: number; y: number; t: number; target: EventTarget | null } | null = null;

  start(): void {
    this.stop();
    const root = this.root = document.createElement('div');
    root.id = 'ivyevil-overlay';
    root.setAttribute('aria-hidden', 'true');
    // its own layer: what changes in it (a strip shown, a petal turning) repaints nothing of the page's
    root.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden;contain:strict;will-change:transform;';
    // the e2e test starts events through this instead of waiting for them
    Object.assign(root, { force: (n: EventName) => { clock.force = n; } });
    this.corners = [
      new Layer(root, 'left:0;top:0;'), new Layer(root, 'right:0;top:0;transform:scaleX(-1);'),
      new Layer(root, 'left:0;bottom:0;transform:scaleY(-1);'), new Layer(root, 'right:0;bottom:0;transform:scale(-1,-1);'),
    ];
    this.edges = [
      new Layer(root, 'left:0;top:0;'), new Layer(root, 'left:0;bottom:0;transform:scaleY(-1);'),
      new Layer(root, 'left:0;top:0;'), new Layer(root, 'right:0;top:0;transform:scaleX(-1);'),
    ];
    this.veil = new Layer(root, 'left:0;top:0;');
    this.fx = new Layer(root, 'left:0;top:0;');
    this.cursor = new Layer(root, 'left:0;top:0;will-change:transform;');
    this.cursor.visible(false);
    document.body.appendChild(root);
    this.dims = '';
    addEventListener('pointermove', this.onMove, { passive: true });
    addEventListener('pointerdown', this.onDown, { capture: true, passive: true });
    addEventListener('pointerup', this.onUp, { capture: true, passive: true });
    addEventListener('pointercancel', this.onUp, { passive: true });
    addEventListener('blur', this.onUp);
    addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    addEventListener('resize', this.onScroll, { passive: true });
    // on a phone there is no blade to follow a pointer, so the overlay keeps the room's time and draws
    // in the room's frames (see tick); elsewhere it draws every frame, for the blade's sake
    this.paced = matchMedia(SMALL).matches;
    if (this.paced) return;
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      this.draw(now / 1000);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** A frame of the room's: the overlay draws in it too when it keeps the room's time. */
  tick(now: number): void {
    if (this.paced && this.root) this.draw(now / 1000);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    removeEventListener('pointermove', this.onMove);
    removeEventListener('pointerdown', this.onDown, { capture: true });
    removeEventListener('pointerup', this.onUp, { capture: true });
    removeEventListener('pointercancel', this.onUp);
    removeEventListener('blur', this.onUp);
    removeEventListener('scroll', this.onScroll, { capture: true });
    removeEventListener('resize', this.onScroll);
    this.resized.disconnect();
    this.root?.remove();
    this.root = this.veil = this.fx = this.cursor = null;
    this.corners = []; this.edges = []; this.petals = [];
    this.cuts = [];
    this.unmask();
    // and put the interface back where it was
    for (const t of this.targets) { t.el.style.translate = ''; t.el.removeAttribute('data-drip'); }
    this.targets = [];
    this.targetsAt = -9;
  }

  /** The sheet has moved or changed size under us: measure it again in the next frame. */
  private readonly onScroll = () => { this.targetsAt = -9; };
  private readonly resized = new ResizeObserver(this.onScroll);

  // ── the pointer ──
  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.mouse = true;
    this.mx = e.clientX / this.px; this.my = e.clientY / this.px;
  };
  private readonly onDown = (e: PointerEvent) => {
    this.down = true;
    if (e.pointerType === 'mouse') {
      this.mouse = true;
      this.mx = e.clientX / this.px; this.my = e.clientY / this.px;
      this.lunge = 1;
      this.spark(this.mx, this.my, this.ang, 12);
      if (!isInteractive(e.target)) this.cut(this.mx, this.my, this.ang, 1.1);
    } else {
      // a finger: a tap cuts, a drag is a scroll
      this.mouse = false;
      this.tap = { x: e.clientX, y: e.clientY, t: performance.now(), target: e.target };
    }
  };
  private readonly onUp = (e?: Event) => {
    this.down = false;
    const tp = this.tap;
    this.tap = null;
    if (!tp || !(e instanceof PointerEvent)) return;
    if (Math.hypot(e.clientX - tp.x, e.clientY - tp.y) > 10 || performance.now() - tp.t > 350 || isInteractive(tp.target)) return;
    const x = e.clientX / this.px, y = e.clientY / this.px, a = -0.6 + hash(tp.t) * 1.2 - Math.PI / 2;
    this.spark(x, y, a, 10);
    this.cut(x, y, a, 1.1);
  };

  // ════════════════════════════════════════════════════════════
  private draw(t: number): void {
    clock.tick(t);
    // measured first, before this frame writes a single style, so measuring costs no layout of its own
    if (!clock.still) this.refresh(t);
    const px = this.px = artPx();
    const W = Math.ceil(innerWidth / px), H = Math.ceil(innerHeight / px);
    if (this.dims !== `${W},${H},${px}`) this.layout(W, H, px);
    const dt = Math.min(0.1, Math.max(0, t - this.last)) || 0.016;
    this.last = t;
    const ev = clock.ev, p = ev?.p ?? 0, sh = this.shown;

    // the palette as the still layers see it: they are shown again only when it moves a step
    const tone = Math.round(clock.drain * 16) * 1e4 + Math.round(clock.dark * 16) * 100 + Math.round(clock.flash * 16);
    const recolour = tone !== sh.tone;
    sh.tone = tone;

    // the corners of the room, reaching into the corners of the window
    const frame = !(clock.dark > 0.6);
    if (frame !== sh.frame) { sh.frame = frame; for (const l of this.corners) l.visible(frame); }
    if (frame && recolour) for (const l of this.corners) l.show(this.corner);

    // the heartbeat at the edges of the window, in steps
    const pulse = clock.pulse, beat = pulse < 0.15 ? 0 : pulse < 0.42 ? 1 : pulse < 0.7 ? 2 : 3;
    if (beat !== sh.beat || (beat && recolour)) {
      sh.beat = beat;
      for (const l of this.edges) l.visible(beat > 0);
      if (beat) { const b = this.bands[beat]; this.edges.forEach((l, k) => l.show(k < 2 ? b.top : b.side)); }
    }

    // the dark coming down over everything, and the flash when the candles relight
    const nd = Math.round(clock.dark * 0.55 * 16), nf = Math.round(clock.flash * 0.25 * 16);
    const veil = nd || nf ? `${nd},${nf},${tone}` : '';
    if (veil !== sh.veil) {
      sh.veil = veil;
      const v = this.veil!;
      v.visible(!!veil);
      if (veil) {
        v.r.clear();
        if (nd) v.r.dither(0, 0, W, H, C['k0'], nd / 16);
        if (nf) v.r.dither(0, 0, W, H, C['r6'], nf / 16);
        v.show();
      }
    }

    // and the full-window layer, only while something is on it
    const fx = this.fx!, was = this.ink;
    if (was) fx.r.clear();
    this.ink = false;
    if (ev?.name === 'lunge' && p < 0.05 && !this.cuts.some(c => c.t0 === ev.t0)) this.cut(W * (0.3 + ev.r1 * 0.45), H * (0.28 + ev.r2 * 0.44), -0.4 + ev.r0 * 0.8, 1.5, ev.t0);
    if (ev?.name === 'bloom') this.vines(W, H, p);
    if (ev?.name === 'shatter') this.cracks(W, H, p, ev.t0, ev.r0, ev.r1);
    this.cutsDraw(dt, t, W, H);
    this.interface(t, W, H);
    this.drift(t, dt, W, H, recolour);
    this.drip(t);

    // you
    if (this.mouse && this.mx >= 0) this.rapier(t, dt);
    else this.cursor!.visible(false);
    if (this.ink) fx.show();
    else if (was) fx.wipe();
  }

  /** Everything that depends on the size of the window, made again when it changes. */
  private layout(W: number, H: number, px: number): void {
    this.dims = `${W},${H},${px}`;
    this.fx!.size(W, H, px); this.fx!.wipe(); this.ink = false;
    this.veil!.size(W, H, px);
    this.cursor!.size(R * 2, R * 2, px);
    this.corner = this.bakeCorners(W, H);
    for (const l of this.corners) l.size(this.corner.w, this.corner.h, px, false);
    this.bands = PULSES.map(pulse => {
      const deep = pulse > 0.6 ? BAND : BAND - 1, lvl = pulse * 0.4;
      const top = new Raster(W, BAND), side = new Raster(BAND, H);
      for (let k = 0; k < deep; k++) {
        const l = lvl * (1 - k / deep);
        for (let x = 0; x < W; x++) top.dot(x, k, C['r2'], l);
        for (let y = 0; y < H; y++) side.dot(k, y, C['r2'], l);
      }
      return { top, side };
    });
    this.edges.forEach((l, k) => k < 2 ? l.size(W, BAND, px, false) : l.size(BAND, H, px, false));
    this.shown = { tone: -1, beat: -1, veil: '', blade: '', at: '', frame: true };
    this.targetsAt = -9;
  }

  // ── the rapier ──
  private rapier(t: number, dt: number): void {
    const vx = (this.mx - this.pmx) / dt, vy = (this.my - this.pmy) / dt;
    this.pmx = this.mx; this.pmy = this.my;
    const spd = Math.hypot(vx, vy);
    const want = spd > 14 ? Math.atan2(vy, vx) : IDLE + Math.sin(t * 0.9) * 0.05;
    let d = want - this.ang;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    this.ang += d * Math.min(1, 0.12 + spd * 0.002);
    this.lunge = Math.max(0, this.lunge - dt * 4);
    // where the blade has just been, when it moves fast
    for (let k = this.ghosts.length - 1; k >= 0; k--) if ((this.ghosts[k].life -= dt * 5) <= 0) this.ghosts.splice(k, 1);
    if (spd > 160 && this.ghosts.length < 6) this.ghosts.push({ x: this.mx, y: this.my, a: this.ang, life: 1 });
    const o = this.fx!.r;
    for (const g of this.ghosts) {
      const a = Math.round(g.a / TAU * STEPS) / STEPS * TAU, dx = Math.cos(a), dy = Math.sin(a);
      o.line(g.x, g.y, g.x - dx * 40, g.y - dy * 40, (x, y) => g.life * 0.5 > bayer(x, y) ? C['r4'] : 0);
      this.ink = true;
    }

    // the weapon is its own canvas, moved with the pointer, and drawn again only when it looks different
    const cur = this.cursor!, px = this.px;
    cur.visible(true);
    const at = `translate(${(Math.round(this.mx) - R) * px}px,${(Math.round(this.my) - R) * px}px)`;
    if (at !== this.shown.at) { this.shown.at = at; cur.cv.style.transform = at; }
    const step = Math.round(this.ang / TAU * STEPS), push = Math.round(this.lunge * 7);
    const sh = (t * 0.45) % 1, shine = sh < 0.3 ? Math.round(sh / 0.3 * 44) : -1;
    const look = `${step},${push},${shine},${this.lunge > 0.2},${this.shown.tone}`;
    if (look === this.shown.blade) return;
    this.shown.blade = look;

    const c = cur.r;
    c.clear();
    const a = step / STEPS * TAU;
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const tx = R + dx * push, ty = R + dy * push;                 // the tip, ahead of the pointer in a thrust
    const BL = 44, gx = tx - dx * BL, gy = ty - dy * BL;          // where the guard is
    // the blade: white, a shaded edge along the near half, a needle at the point
    c.line(gx, gy, tx, ty, C['w2']);
    c.line(gx + nx, gy + ny, tx - dx * BL * 0.45 + nx, ty - dy * BL * 0.45 + ny, C['w0']);
    c.line(gx - dx * 1, gy - dy * 1, gx + dx * 6, gy + dy * 6, C['w1']);
    c.set(tx, ty, C['w3']);
    // a band of light running up the steel now and then
    if (shine >= 0) { c.set(gx + dx * shine, gy + dy * shine, C['w3']); c.set(gx + dx * (shine + 1), gy + dy * (shine + 1), C['w3']); }
    // the side ring, standing open round the base of the blade
    for (let k = 0; k < 16; k++) { const th = (k / 16) * TAU, ex = Math.cos(th) * 1.6, ey = Math.sin(th) * 3.2; c.set(gx + dx * (3 + ex) + nx * ey, gy + dy * (3 + ex) + ny * ey, k < 8 ? C['r4'] : C['r2']); }
    // the crossbar, with a curl at each end
    c.line(gx + nx * 8, gy + ny * 8, gx - nx * 8, gy - ny * 8, (x, y, k) => (k === 0 || k > 14) ? C['r5'] : C['r4']);
    for (const s of [1, -1]) { c.set(gx + nx * 9 * s + dx, gy + ny * 9 * s + dy, C['r5']); c.set(gx + nx * 8 * s + dx * 2, gy + ny * 8 * s + dy * 2, C['r3']); }
    // the knuckle bow, from the crossbar back over the hand to the pommel
    const kb: number[] = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10, a0x = gx + nx * 7, a0y = gy + ny * 7, cx = gx - dx * 6 + nx * 9, cy = gy - dy * 6 + ny * 9, bx = gx - dx * 12 + nx * 1.5, by = gy - dy * 12 + ny * 1.5;
      kb.push((1 - u) * (1 - u) * a0x + 2 * (1 - u) * u * cx + u * u * bx, (1 - u) * (1 - u) * a0y + 2 * (1 - u) * u * cy + u * u * by);
    }
    for (let k = 0; k + 3 < kb.length; k += 2) c.line(kb[k], kb[k + 1], kb[k + 2], kb[k + 3], C['r3']);
    // the grip, wrapped in wire, and the pommel with a stone in it
    for (let k = 1; k <= 10; k++) {
      const x = gx - dx * k, y = gy - dy * k;
      c.set(x, y, k & 1 ? C['r1'] : C['r5']); c.set(x + nx * 0.8, y + ny * 0.8, C['r1']);
    }
    c.oval(gx - dx * 12.5, gy - dy * 12.5, 2, 2, C['r4']);
    c.set(gx - dx * 12.5, gy - dy * 12.5, C['b3']);
    c.set(gx - dx * 13 - nx, gy - dy * 13 - ny, C['w2']);
    c.outline(C['k0']);
    // the point, which is the brightest pixel on the page, and brighter in a thrust
    if (this.lunge > 0.2) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]) c.set(tx + ox, ty + oy, Math.abs(ox) + Math.abs(oy) > 1 ? C['r6'] : C['w3']);
    cur.show();
  }

  private spark(x: number, y: number, a: number, n: number): void {
    for (let k = 0; k < n; k++) {
      const s = 40 + hash(k, x) * 110, th = a + (hash(k, y) - 0.5) * 1.4;
      this.bits.push({ x, y, vx: Math.cos(th) * s, vy: Math.sin(th) * s, c: k & 1 ? C['w3'] : C['f2'], life: 0.5, size: 1 });
    }
  }

  /**
   * Petals, a few at a time, drifting across the window. Each is a pixel or
   * two, so each is an element of its own rather than a reason to redraw
   * the whole window.
   */
  private drift(t: number, dt: number, W: number, H: number, recolour: boolean): void {
    if (this.petals.length < 3 && hash(Math.floor(t * 2), 3) > 0.985) {
      const el = document.createElement('i');
      el.style.cssText = `position:absolute;left:0;top:0;height:${this.px}px;will-change:transform;`;
      this.root!.appendChild(el);
      this.petals.push({ x: hash(t) * W, y: -2, el, at: '', look: '' });
    }
    const px = this.px, col = clock.colours;
    for (let k = this.petals.length - 1; k >= 0; k--) {
      const q = this.petals[k];
      q.x += (Math.sin(t * 1.3 + k * 3) * 6 + 2) * dt; q.y += (5 + Math.sin(t * 2 + k) * 2) * dt;
      if (q.y > H + 2 || q.x > W + 2) { q.el.remove(); this.petals.splice(k, 1); continue; }
      const at = `translate(${Math.floor(q.x) * px}px,${Math.floor(q.y) * px}px)`;
      if (at !== q.at) { q.at = at; q.el.style.transform = at; }
      // turning over: open, two pixels; edge on, one
      const open = (Math.floor(t * 4 + k) & 1) === 1, look = `${open}`;
      if (look !== q.look || recolour) {
        q.look = look;
        q.el.style.width = (open ? 2 : 1) * px + 'px';
        q.el.style.background = open ? `linear-gradient(90deg,${css(col[C['r4']])} 50%,${css(col[C['r2']])} 50%)` : css(col[C['r3']]);
      }
    }
  }

  /** The drop of blood on the portrait: a stage every so often, every 3.6 seconds (the stages are in _chrome.scss). */
  private drip(t: number): void {
    if (clock.still) return;
    const p = (t % 3.6) / 3.6;
    const stage = String(p < 0.4 ? 0 : p < 0.52 ? 1 : p < 0.64 ? 2 : p < 0.7 ? 3 : p < 0.76 ? 4 : p < 0.8 ? 5 : 6);
    for (const tg of this.targets) if (tg.el.classList.contains('portrait') && tg.el.dataset['drip'] !== stage) tg.el.dataset['drip'] = stage;
  }

  // ── cuts ──
  private cut(x: number, y: number, a: number, w: number, t0 = performance.now() / 1000): void {
    this.cuts.push({ x, y, a, t0, w, seed: hash(t0, x, y) * 1000, burst: false });
    this.lunge = 1;
    this.mask();
  }

  /** How far apart the two sides are, in art pixels: snapped open, HELD, then closed in steps, rocking once as they seat. */
  private open(c: Cut, t: number): number {
    const p = (t - c.t0) / 1.9;
    if (p < 0 || p > 1) return 0;
    if (p < 0.04) return Math.round((p / 0.04) * 5 * c.w);
    if (p < 0.36) return Math.round(5 * c.w);
    const u = (p - 0.36) / 0.64;
    return Math.max(0, Math.round(5 * c.w * Math.pow(1 - u, 1.6) * (1 + 0.25 * Math.sin(u * 12))));
  }

  private cutsDraw(dt: number, t: number, W: number, H: number): void {
    const o = this.fx!.r;
    if (this.cuts.length || this.bits.length) this.ink = true;
    for (let k = this.cuts.length - 1; k >= 0; k--) {
      const c = this.cuts[k], p = (t - c.t0) / 1.9;
      if (p > 1) { this.cuts.splice(k, 1); if (!this.cuts.length) this.unmask(); continue; }
      const dx = Math.cos(c.a), dy = Math.sin(c.a), nx = -dy, ny = dx;
      const L = Math.hypot(W, H);
      const swept = Math.min(1, p / 0.05);
      const gap = this.open(c, t) + 1;
      const heat = p < 0.08 ? C['w3'] : p < 0.25 ? C['w2'] : p < 0.5 ? C['r5'] : C['r4'];
      for (const s of [1, -1]) {
        const ex = nx * gap * s, ey = ny * gap * s;
        o.line(c.x - dx * L * swept + ex, c.y - dy * L * swept + ey, c.x + dx * L * swept + ex, c.y + dy * L * swept + ey, (x, y) => p < 0.6 || (0.9 - p) * 2 > bayer(x, y) ? heat : 0);
      }
      // the dark of the wound itself, through which the room shows
      if (p < 0.08) o.line(c.x - dx * L * swept, c.y - dy * L * swept, c.x + dx * L * swept, c.y + dy * L * swept, C['w3']);
      // it sheds: blood off the top lip, splinters of the interface off both
      if (!c.burst && p > 0.02) {
        c.burst = true;
        for (let i = 0; i < 26; i++) {
          const u = (hash(c.seed, i) - 0.5) * 1.6, along = u * Math.min(W, H) * 0.6, s = i & 1 ? 1 : -1;
          const sp = 30 + hash(c.seed, i, 2) * 90;
          this.bits.push({ x: c.x + dx * along + nx * gap * s, y: c.y + dy * along + ny * gap * s, vx: nx * sp * s + dx * (hash(i, c.seed) - 0.5) * 40, vy: ny * sp * s - 20,
                           c: i % 5 === 0 ? C['w2'] : i % 3 === 0 ? C['r4'] : C['k3'], life: 1, size: i % 4 === 0 ? 2 : 1 });
        }
      }
      if (p > 0.05 && p < 0.7 && hash(Math.floor(t * 12), c.seed) > 0.7) {
        const along = (hash(t, c.seed) - 0.5) * Math.min(W, H);
        const s = ny > 0 ? -1 : 1;
        this.bits.push({ x: c.x + dx * along + nx * gap * s, y: c.y + dy * along + ny * gap * s, vx: 0, vy: 10, c: C['b2'], life: 1.2, size: 1 });
      }
    }
    for (let k = this.bits.length - 1; k >= 0; k--) {
      const q = this.bits[k];
      q.vy += 220 * dt; q.vx *= 0.97;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.life -= dt * 0.8;
      if (q.life <= 0 || q.y > H + 4) { this.bits.splice(k, 1); continue; }
      if (q.size > 1) { o.rect(q.x, q.y, 2, 2, q.c); o.set(q.x + 1, q.y + 1, C['r4']); }
      else o.set(q.x, q.y, q.c);
      if (q.c === C['b2']) o.set(q.x, q.y - 1, C['b1']);
    }
  }

  /** The hole through the interface: one stair-stepped rip per cut, built once, taken off once. */
  private mask(): void {
    if (clock.still) return;
    const W = innerWidth, H = innerHeight, px = this.px;
    let d = `M0 0H${W}V${H}H0Z`;
    for (const c of this.cuts) {
      const dx = Math.cos(c.a), dy = Math.sin(c.a), nx = -dy, ny = dx;
      const L = Math.hypot(W, H) / px, cx = c.x * px, cy = c.y * px;
      const edge = (s: number) => {
        const out: [number, number][] = [];
        for (let i = -L; i <= L; i += 1) {
          const hw = (1 + Math.floor(hash(c.seed, Math.floor(i / 3)) * 2.2)) * c.w;
          const x = Math.round((cx + dx * i * px) / px + nx * hw * s) * px, y = Math.round((cy + dy * i * px) / px + ny * hw * s) * px;
          const prev = out[out.length - 1];
          if (prev && prev[0] !== x && prev[1] !== y) out.push([x, prev[1]]);   // a step, never a slope
          if (!prev || prev[0] !== x || prev[1] !== y) out.push([x, y]);
        }
        return out;
      };
      const a = edge(1), b = edge(-1).reverse();
      d += 'M' + a.concat(b).map(([x, y]) => `${x} ${y}`).join('L') + 'Z';
    }
    const url = 'url("data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" shape-rendering="crispEdges"><path fill="#fff" fill-rule="evenodd" d="${d}"/></svg>`) + '")';
    this.refresh(performance.now() / 1000, true);
    for (const t of this.targets) {
      const s = t.el.style;
      s.maskImage = url; s.webkitMaskImage = url;
      s.maskRepeat = 'no-repeat'; s.webkitMaskRepeat = 'no-repeat';
      s.maskSize = `${W}px ${H}px`; s.webkitMaskSize = `${W}px ${H}px`;
      s.maskPosition = `${-t.bx}px ${-t.by}px`; s.webkitMaskPosition = `${-t.bx}px ${-t.by}px`;
    }
    this.masked = true;
  }

  private unmask(): void {
    if (!this.masked) return;
    this.masked = false;
    for (const t of this.targets) {
      const s = t.el.style;
      s.maskImage = s.webkitMaskImage = s.maskRepeat = s.webkitMaskRepeat = s.maskSize = s.webkitMaskSize = s.maskPosition = s.webkitMaskPosition = '';
    }
  }

  /** The interface's own boxes, measured with our own offset taken back out (after a scroll, every two seconds anyway, or when asked). */
  private refresh(t: number, force = false): void {
    if (!force && t - this.targetsAt < 2) return;
    this.targetsAt = t;
    const seen = new Map(this.targets.map(x => [x.el, x]));
    const next: Target[] = [];
    for (const [el, k] of interfaceTargets(2)) {
      const old = seen.get(el);
      seen.delete(el);
      if (!old) this.resized.observe(el);
      const r = el.getBoundingClientRect(), tx = old?.tx ?? 0, ty = old?.ty ?? 0;
      next.push({ el, k, bx: r.left - tx, by: r.top - ty, bw: r.width, bh: r.height, tx, ty });
    }
    for (const gone of seen.values()) { gone.el.style.translate = ''; gone.el.removeAttribute('data-drip'); this.resized.unobserve(gone.el); }
    this.targets = next;
  }

  /**
   * The interface moves in whole pixels, like everything else on this page:
   * on each thump the blocks of the sheet shove out one pixel from the
   * middle and come back, and a cut shoves everything off it on both sides.
   */
  private interface(t: number, W: number, H: number): void {
    if (clock.still) return;
    const ae = document.activeElement as HTMLElement | null;
    const typing = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
    if (clock.thumps !== this.thump.n) {
      this.thump = { n: clock.thumps, until: t + (clock.pulse > 0.8 ? 0.09 : 0.06), big: clock.pulse > 0.8 };
      // the name and the portrait flare on the same thump (a class on each: two elements restyled, nothing else)
      const flare = this.targets.filter(x => x.el.matches('.head .name, .head .portrait')).map(x => x.el);
      for (const el of flare) el.classList.add('pg-thump');
      setTimeout(() => { for (const el of flare) el.classList.remove('pg-thump'); }, 110);
    }
    const thumping = t < this.thump.until && !this.down && !typing;
    const px = this.px, o = this.fx!.r;
    for (const tg of this.targets) {
      const cx = tg.bx + tg.bw / 2, cy = tg.by + tg.bh / 2;
      // a block out of sight stays put: moving it would restyle and repaint it for nobody
      if (!tg.tx && !tg.ty && (tg.by + tg.bh < 0 || tg.by > innerHeight || tg.bx + tg.bw < 0 || tg.bx > innerWidth)) continue;
      let ax = 0, ay = 0;
      if (thumping && tg.k > 1) { ax = Math.sign(Math.round((cx / px - W / 2) / (W / 4))); ay = Math.sign(Math.round((cy / px - H / 2) / (H / 4))); }
      for (const c of this.cuts) {
        const g = this.open(c, t);
        if (!g) continue;
        const nx = -Math.sin(c.a), ny = Math.cos(c.a);
        const s = ((cx / px - c.x) * nx + (cy / px - c.y) * ny) >= 0 ? 1 : -1;
        ax += Math.round(nx * g * s * (tg.k > 1 ? 1 : 0.6) + Math.cos(c.a) * g * 0.4 * s);
        ay += Math.round(ny * g * s * (tg.k > 1 ? 1 : 0.6) + Math.sin(c.a) * g * 0.4 * s);
      }
      if (this.down && !thumping && !this.cuts.length) { ax = tg.tx / px; ay = tg.ty / px; }   // hold still under a pressed button
      const tx = ax * px, ty = ay * px;
      if (tx !== tg.tx || ty !== tg.ty) {
        tg.tx = tx; tg.ty = ty;
        tg.el.style.translate = tx || ty ? `${tx}px ${ty}px` : '';
      }
      // an afterimage where it was, while it is out of place
      if ((tx || ty) && tg.k > 1 && tg.bw > 8) {
        const x0 = Math.round(tg.bx / px), y0 = Math.round(tg.by / px), w = Math.round(tg.bw / px), h = Math.round(tg.bh / px);
        const lvl = thumping ? 0.5 : 0.3;
        for (let x = x0; x < x0 + w; x++) { o.dot(x, y0, C['r4'], lvl); o.dot(x, y0 + h - 1, C['r4'], lvl); }
        for (let y = y0; y < y0 + h; y++) { o.dot(x0, y, C['r4'], lvl); o.dot(x0 + w - 1, y, C['r4'], lvl); }
        this.ink = true;
      }
    }
  }

  // ── the frame: the room's ornament in the four corners of the window (the top left; the others are it mirrored) ──
  private bakeCorners(W: number, H: number): Raster {
    const S = Math.round(Math.min(56, Math.max(36, Math.min(W, H) * 0.16))), c = new Raster(S, S), k = S / 34;
    const tones: [number, number, number] = [C['r6'], C['r4'], C['r2']];
    // a C scroll along the top edge, another down the side, each curling in toward the corner
    const scroll = (horizontal: boolean) => {
      const pts: number[] = [];
      for (let i = 0; i <= 48; i++) {
        const u = i / 48;
        let a: number, b: number;
        if (u < 0.55) { const s = u / 0.55; a = 31 - s * 22; b = 3; }
        else { const th = (u - 0.55) / 0.45 * Math.PI * 1.7, r = 6.5 * (1 - (u - 0.55) * 1.25); a = 9 - Math.sin(th) * r; b = 3 + (1 - Math.cos(th)) * r; }
        pts.push(horizontal ? a * k : b * k, horizontal ? b * k : a * k);
      }
      c.tube(pts, u => (3.2 - u * 1.6) * k, tones, 1, 1);
    };
    scroll(true); scroll(false);
    // acanthus in the crook, a curl off the end of each scroll, and roses over the joins
    const leaf: [number, number, number] = [C['r4'], C['r2'], C['k3']];
    c.tube([6, 6, 12, 10, 16, 16, 15, 21].map(v => v * k), u => (3.2 - u * 2.6) * k, leaf, 1, 1);
    c.tube([6, 6, 10, 12, 16, 15, 21, 15].map(v => v * k), u => (3.2 - u * 2.6) * k, leaf, 1, 1);
    for (const [x, y] of [[31, 3], [3, 31]]) {
      const pts: number[] = [];
      for (let i = 0; i <= 10; i++) { const th = i * 0.6, r = 3 * Math.exp(-i * 0.1); pts.push((x + (x > 3 ? 1 : 0) + Math.sin(th) * r * (x > 3 ? 1 : 0.6)) * k, (y + Math.cos(th) * r * (x > 3 ? 0.6 : 1)) * k); }
      c.tube(pts, () => 1.5 * k, tones, 1, 1);
    }
    c.blit(ROSE7, Math.round(2 * k), Math.round(2 * k));
    c.blit(ROSE5, Math.round(22 * k), Math.round(k)); c.blit(ROSE5, Math.round(k), Math.round(22 * k));
    c.outline(C['k0']);
    return c;
  }

  /** Thorned vines grow along the edges of the window from its corners, flower, and fall. */
  private vines(W: number, H: number, p: number): void {
    const o = this.fx!.r, grow = p < 0.55 ? p / 0.55 : p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
    this.ink = true;
    const runs: [number, number, number, number][] = [[0, 0, 1, 0], [0, 0, 0, 1], [W - 1, 0, -1, 0], [W - 1, 0, 0, 1], [0, H - 1, 1, 0], [0, H - 1, 0, -1], [W - 1, H - 1, -1, 0], [W - 1, H - 1, 0, -1]];
    runs.forEach(([x0, y0, dx, dy], v) => {
      const len = Math.round((dx ? W : H) * 0.32 * grow);
      for (let k = 24; k < len; k++) {
        const wob = Math.round(Math.sin(k * 0.23 + v) * 2.5) + 5;
        const x = x0 + dx * k + (dy ? (x0 ? -wob : wob) : 0), y = y0 + dy * k + (dx ? (y0 ? -wob : wob) : 0);
        o.set(x, y, k % 4 ? C['k3'] : C['k4']);
        if (k % 7 === 0) o.set(x + (dy ? (k & 8 ? 1 : -1) : 0), y + (dx ? (k & 8 ? 1 : -1) : 0), C['r2']);
        if (k % 23 === 11 && len - k > 6) { if (p > 0.85) continue; if (len - k < 14) o.blit(BUD, x - 1, y - 1); else o.blit(ROSE5, x - 2, y - 2); }
      }
    });
  }

  /** The window itself cracks: a few white lines from one edge, which mend. */
  private cracks(W: number, H: number, p: number, t0: number, r0: number, r1: number): void {
    this.ink = true;
    if (!this.crack || this.crack.for !== t0) {
      const side = Math.floor(r0 * 4), ox = side === 0 ? 0 : side === 1 ? W - 1 : r1 * W, oy = side < 2 ? r1 * H : side === 2 ? 0 : H - 1;
      const pts: number[][] = [];
      for (let b = 0; b < 5; b++) {
        let x = ox, y = oy, a = Math.atan2(H / 2 - oy, W / 2 - ox) + (b - 2) * 0.35;
        const st = [x, y];
        for (let k = 0; k < 7; k++) { a += (hash(b, k, t0) - 0.5) * 0.9; const L = Math.min(W, H) * (0.04 + hash(k, b) * 0.06); x += Math.cos(a) * L; y += Math.sin(a) * L; st.push(x, y); }
        pts.push(st);
      }
      this.crack = { pts, for: t0 };
    }
    const grow = p < 0.15 ? p / 0.15 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    for (const st of this.crack.pts) {
      const n = Math.max(1, Math.floor((st.length / 2 - 1) * grow));
      for (let k = 0; k < n; k++) this.fx!.r.line(st[k * 2], st[k * 2 + 1], st[k * 2 + 2], st[k * 2 + 3], (x, y) => (k & 1) && 0.5 > bayer(x, y) ? C['r6'] : C['w2']);
    }
  }
}
