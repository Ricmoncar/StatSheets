// The layer a page draws over the whole window (its cursor, its weather, the
// sparks a click throws), in art pixels like the world. The full-window
// raster is shown only while something is on it; the cursor is a small
// canvas of its own that travels with the pointer, so a page whose overlay
// is just a cursor costs one small transform a move.
import { Raster, Screen } from '../raster';
import { SMALL, artPx, isInteractive } from '../host';

const FRAME_MS = 1000 / 30, SMALL_FRAME_MS = 1000 / 15;

/** A small canvas of art pixels that follows the pointer, hot spot at (hx, hy). */
export class CursorLayer {
  readonly cv = document.createElement('canvas');
  private readonly screen: Screen;
  private shown: Raster | null = null;
  private hx = 0; private hy = 0;

  constructor(parent: HTMLElement) {
    this.cv.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated;will-change:transform;visibility:hidden;';
    parent.appendChild(this.cv);
    this.screen = new Screen(this.cv.getContext('2d')!);
  }
  /** Shows `r` as the cursor (only if it changed: pass the same raster again to redraw it after drawing into it, with force). */
  set(r: Raster, colours: Uint32Array, hx: number, hy: number, px: number, force = false): void {
    if (this.shown === r && !force && this.hx === hx && this.hy === hy) return;
    if (this.cv.width !== r.w || this.cv.height !== r.h) { this.cv.width = r.w; this.cv.height = r.h; }
    this.cv.style.width = r.w * px + 'px';
    this.cv.style.height = r.h * px + 'px';
    this.screen.show(r, colours);
    this.shown = r; this.hx = hx; this.hy = hy;
  }
  /** Puts the hot spot at (x, y) CSS pixels, snapped to the art grid. */
  move(x: number, y: number, px: number, visible: boolean): void {
    this.cv.style.visibility = visible ? 'visible' : 'hidden';
    if (!visible) return;
    const sx = Math.round(x / px) * px - this.hx * px, sy = Math.round(y / px) * px - this.hy * px;
    this.cv.style.transform = `translate(${sx}px,${sy}px)`;
  }
}

/**
 * Subclass and implement frame(): draw into `r` (cleared to 0 each frame) and
 * return true if anything is on it. `press` hears every click and tap, told
 * whether it landed on a control (a page must leave those alone). `force`
 * starts a named event on demand (the e2e tests call it through the root
 * element). The overlay keeps running while it is started; stop() takes it all
 * away again.
 */
export abstract class PageOverlay {
  protected root: HTMLDivElement | null = null;
  protected r = new Raster(1, 1);
  protected cursor: CursorLayer | null = null;
  protected W = 0; protected H = 0; protected px = 3;
  /** The pointer: CSS pixels, art pixels, whether a mouse (not a finger) is over the window, and whether it is held. */
  protected mx = -1000; protected my = -1000; protected ax = -1000; protected ay = -1000;
  protected mouse = false; protected held = false;
  private cv: HTMLCanvasElement | null = null;
  private screen: Screen | null = null;
  private drawn = false;
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private last = 0;
  protected t0 = 0;

  constructor(private readonly id: string, protected readonly colours: () => Uint32Array, private readonly withCursor = false) {}

  start(): void {
    this.stop();
    const root = this.root = document.createElement('div');
    root.id = this.id;
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden;contain:strict;';
    const cv = this.cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated;visibility:hidden;';
    root.appendChild(cv);
    this.screen = new Screen(cv.getContext('2d')!);
    if (this.withCursor) this.cursor = new CursorLayer(root);
    (root as unknown as { force: (n: string) => void }).force = n => this.force(n);
    document.body.appendChild(root);
    addEventListener('pointermove', this.onMove, { passive: true });
    addEventListener('pointerdown', this.onDown, { capture: true, passive: true });
    addEventListener('pointerup', this.onUp, { capture: true, passive: true });
    addEventListener('pointercancel', this.onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onLeave);
    addEventListener('resize', this.onResize, { passive: true });
    this.onResize();
    this.t0 = performance.now();
    this.last = this.t0;
    this.begin();
    this.tick();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    removeEventListener('pointermove', this.onMove);
    removeEventListener('pointerdown', this.onDown, { capture: true });
    removeEventListener('pointerup', this.onUp, { capture: true });
    removeEventListener('pointercancel', this.onUp);
    document.documentElement.removeEventListener('pointerleave', this.onLeave);
    removeEventListener('resize', this.onResize);
    if (this.root) { this.root.remove(); this.root = null; this.end(); }
    this.cursor = null;
    this.cv = null;
    this.drawn = false;
  }

  /** Draws a frame of the overlay into `r`; true if anything is on it. */
  protected abstract frame(r: Raster, t: number, dt: number): boolean;
  /** A click or tap at (x, y) in art pixels. */
  protected press(_x: number, _y: number, _onControl: boolean): void { /* nothing by default */ }
  /** Starts a named event now. */
  protected force(_name: string): void { /* nothing by default */ }
  protected begin(): void { /* set up */ }
  protected end(): void { /* tear down: put back anything moved */ }

  private tick = (): void => {
    this.raf = requestAnimationFrame(now => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const r = this.r;
      r.clear(0);
      const any = this.frame(r, (now - this.t0) / 1000, dt);
      if (this.cv && this.screen) {
        if (any) { this.screen.show(r, this.colours()); if (!this.drawn) this.cv.style.visibility = 'visible'; }
        else if (this.drawn) this.cv.style.visibility = 'hidden';
        this.drawn = any;
      }
      this.timer = setTimeout(this.tick, matchMedia(SMALL).matches ? SMALL_FRAME_MS : FRAME_MS);
    });
  };

  private onResize = (): void => {
    const px = this.px = artPx();
    const W = this.W = Math.ceil(innerWidth / px), H = this.H = Math.ceil(innerHeight / px);
    if (this.r.w !== W || this.r.h !== H) this.r = new Raster(W, H);
    if (this.cv) {
      if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
      this.cv.style.width = W * px + 'px';
      this.cv.style.height = H * px + 'px';
    }
  };
  private onMove = (e: PointerEvent): void => {
    this.mx = e.clientX; this.my = e.clientY;
    this.ax = e.clientX / this.px; this.ay = e.clientY / this.px;
    this.mouse = e.pointerType === 'mouse';
    this.moved();
  };
  private onDown = (e: PointerEvent): void => {
    this.onMove(e);
    this.held = true;
    this.press(this.ax, this.ay, isInteractive(e.target));
  };
  private onUp = (): void => { this.held = false; };
  private onLeave = (): void => { this.mouse = false; this.moved(); };
  /** The pointer moved: by default the cursor layer follows it. */
  protected moved(): void { this.cursor?.move(this.mx, this.my, this.px, this.mouse); }
}
