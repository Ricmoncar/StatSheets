import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, untracked, viewChild } from '@angular/core';
import { SettingsService } from '../core/settings.service';
import { CustomPage, PageModule } from './registry';
import { setWorldCanvas, watchLayout, worldCanvas } from './host';

const FRAME_MS = 1000 / 30;   // the pages cap their own background at 30 fps
// phones and touch screens get half that: the room still moves, at half the work
const SMALL = '(max-width: 760px), (pointer: coarse)';
const SMALL_FRAME_MS = 1000 / 15;

/**
 * A character page's world, drawn behind the sheet by the page's own code
 * (downloaded when it is first needed), and the page's layer over the whole
 * window. The canvas is its box's size in CSS pixels, as the old page canvas
 * was: the pages draw into a buffer a fraction of that and scale it up
 * pixelated themselves. Nothing is drawn in performance mode, as for every
 * background, and the background stops while it is off screen.
 */
@Component({
  selector: 'ss-world-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #cv aria-hidden="true"></canvas>`,
  styles: `
    :host { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
    canvas { display: block; width: 100%; height: 100%; }
  `,
})
export class WorldCanvas {
  readonly page = input.required<CustomPage>();

  private readonly settings = inject(SettingsService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** The page whose code is loaded or loading, and its code once it has arrived. */
  private page0: CustomPage | null = null;
  private mod: PageModule | null = null;
  private overlayOn = false;
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private t0 = 0;
  private ready = false;
  private visible = true;
  /** The host's size in CSS pixels, from the resize observer. */
  private size = { w: 0, h: 0 };

  constructor() {
    const resize = new ResizeObserver(([e]) => {
      this.size = { w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) };
      this.restart();
    });
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting === this.visible) return;
      this.visible = e.isIntersecting;
      this.restart();
    });
    let unwatch: (() => void) | null = null;
    afterNextRender(() => {
      this.ready = true;
      setWorldCanvas(this.canvas().nativeElement);
      unwatch = watchLayout(this.host);
      resize.observe(this.host);
      seen.observe(this.host);   // both report once straight away
    });
    effect(() => {
      const page = this.page();
      this.settings.perfMode();
      untracked(() => this.use(page));
    });
    inject(DestroyRef).onDestroy(() => {
      this.stopLoop();
      this.overlay(false);
      resize.disconnect();
      seen.disconnect();
      unwatch?.();
      if (worldCanvas() === this.canvas().nativeElement) setWorldCanvas(null);
    });
  }

  private use(page: CustomPage): void {
    if (this.page0 === page) { this.restart(); return; }
    this.stopLoop();
    this.overlay(false);
    this.page0 = page;
    this.mod = null;
    page.load().then(mod => {
      if (this.page0 !== page) return;   // another page was opened while this one downloaded
      this.mod = mod;
      this.t0 = 0;
      this.restart();
    }, err => console.error(`The ${page.label} page failed to load:`, err));
  }

  private stopLoop(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
  }

  private overlay(on: boolean): void {
    if (on === this.overlayOn) return;
    this.overlayOn = on;
    const root = document.documentElement;
    if (on) {
      this.mod?.startOverlay?.();
      if (this.page0?.ownCursor) root.classList.add('pg-own-cursor');
    } else {
      this.mod?.stopOverlay?.();
      root.classList.remove('pg-own-cursor');
    }
  }

  /** Draws a frame every FRAME_MS, waking only when one is due (as the pattern canvas does). */
  private restart(): void {
    this.stopLoop();
    const mod = this.mod;
    if (!this.ready || !mod) return;
    const perf = this.settings.perfMode();
    this.overlay(!perf);
    const cv = this.canvas().nativeElement;
    const { w, h } = this.size;
    if (!w || !h) return;   // not measured yet: the first resize report starts it
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    if (perf) { ctx.clearRect(0, 0, w, h); return; }
    if (!this.visible) return;   // off screen: picks up again when it comes back
    if (!this.t0) this.t0 = performance.now();
    mod.resetBackground();
    const ms = matchMedia(SMALL).matches ? SMALL_FRAME_MS : FRAME_MS;
    const tick = () => {
      this.raf = requestAnimationFrame(now => {
        mod.drawBackground(cv, ctx, w, h, (now - this.t0) / 1000);
        this.timer = setTimeout(tick, ms);
      });
    };
    tick();
  }
}
