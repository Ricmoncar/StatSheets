import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import { PX, PatternParams, drawPattern, isGenericPattern, newPatternState } from '../core/game/pattern-draw';
import { SettingsService } from '../core/settings.service';

const FRAME_MS = 1000 / 30;   // pixel art moves in steps; 30 fps also halves the cost

/**
 * An animated generic background pattern filling its parent. Drawn at a
 * quarter of the size and scaled up pixelated. Nothing is drawn in
 * performance mode, and a single still frame for reduced motion.
 */
@Component({
  selector: 'ss-pattern-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #cv aria-hidden="true"></canvas>`,
  styles: `
    :host { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
    canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
  `,
})
export class PatternCanvas {
  readonly type = input<string | null | undefined>('none');
  readonly params = input<PatternParams | null | undefined>(null);
  /** Tints falling pixels through the rainbow. */
  readonly rainbow = input(false);

  private readonly settings = inject(SettingsService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private state = newPatternState();
  private raf = 0;
  private t0 = 0;
  private last = -Infinity;
  private ready = false;

  constructor() {
    const resize = new ResizeObserver(() => this.fit());
    afterNextRender(() => {
      this.ready = true;
      resize.observe(this.host);
      this.fit(true);
    });
    // a new pattern starts from fresh state; new settings carry on smoothly
    let lastType: string | null | undefined;
    effect(() => {
      const type = this.type();
      this.params();
      this.rainbow();
      this.settings.perfMode();
      if (type !== lastType) { lastType = type; this.state = newPatternState(); this.t0 = 0; }
      if (this.ready) this.restart();
    });
    inject(DestroyRef).onDestroy(() => { cancelAnimationFrame(this.raf); resize.disconnect(); });
  }

  private fit(force = false): void {
    const cv = this.canvas().nativeElement;
    const w = Math.max(1, Math.ceil(this.host.clientWidth / PX));
    const h = Math.max(1, Math.ceil(this.host.clientHeight / PX));
    if (!force && cv.width === w && cv.height === h) return;
    cv.width = w; cv.height = h;
    this.state = { ...newPatternState(), w, h };
    if (this.ready) this.restart();
  }

  private restart(): void {
    cancelAnimationFrame(this.raf);
    const cv = this.canvas().nativeElement;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    this.state.w = cv.width;
    this.state.h = cv.height;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const type = this.type() || 'none';
    if (this.settings.perfMode() || !isGenericPattern(type)) return;
    const draw = (t: number) => drawPattern(ctx, this.state, type, this.params() || {}, t, this.rainbow());
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(2); return; }
    if (!this.t0) this.t0 = performance.now();   // kept while only the settings change
    this.last = -Infinity;
    const frame = (now: number) => {
      if (now - this.last >= FRAME_MS) {
        this.last = now;
        draw((now - this.t0) / 1000);
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
}
