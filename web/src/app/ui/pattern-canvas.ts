import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import { PX, PatternParams, drawPattern, isGenericPattern, newPatternState, withDefaults } from '../core/game/pattern-draw';
import { SCENES, SCENE_FOR, SceneRun, sceneColours } from '../core/pixel/scenes';
import { SettingsService } from '../core/settings.service';

const FRAME_MS = 1000 / 30;   // pixel art moves in steps; 30 fps also halves the cost

const num = (v: unknown, d: number) => { const n = typeof v === 'number' ? v : parseFloat(String(v)); return isFinite(n) ? n : d; };

/** One art pixel in screen pixels, as the theme sets --px. */
function artPx(): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--px')) || 3;
}

/**
 * An animated background pattern filling its parent. Seven of the generic
 * patterns are drawn as Underground scenes at art resolution (SCENE_FOR),
 * the rest at a quarter of the size; both scale up pixelated. Nothing is
 * drawn in performance mode, and a single still frame for reduced motion.
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
  /** The running scene and what it was built from, so a speed change keeps it going. */
  private scene: { run: SceneRun; key: string } | null = null;
  private tick = 0;

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
      if (type !== lastType) { lastType = type; this.state = newPatternState(); this.t0 = 0; this.scene = null; this.tick = 0; }
      if (this.ready) this.restart();
    });
    inject(DestroyRef).onDestroy(() => { cancelAnimationFrame(this.raf); resize.disconnect(); });
  }

  private fit(force = false): void {
    const cv = this.canvas().nativeElement;
    const px = SCENE_FOR[this.type() || ''] ? artPx() : PX;
    const w = Math.max(1, Math.ceil(this.host.clientWidth / px));
    const h = Math.max(1, Math.ceil(this.host.clientHeight / px));
    if (!force && cv.width === w && cv.height === h) return;
    cv.width = w; cv.height = h;
    this.state = { ...newPatternState(), w, h };
    this.scene = null;
    if (this.ready) this.restart();
  }

  private restart(): void {
    cancelAnimationFrame(this.raf);
    const cv = this.canvas().nativeElement;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const type = this.type() || 'none';
    const map = SCENE_FOR[type];
    // the canvas resolution depends on the kind of pattern
    const px = map ? artPx() : PX;
    if (cv.width !== Math.max(1, Math.ceil(this.host.clientWidth / px))) { this.fit(true); return; }
    this.state.w = cv.width;
    this.state.h = cv.height;
    ctx.clearRect(0, 0, cv.width, cv.height);
    cv.style.opacity = '';
    if (this.settings.perfMode() || !isGenericPattern(type)) { this.scene = null; return; }
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (map) { this.runScene(cv, type, map, still); return; }

    const draw = (t: number) => drawPattern(ctx, this.state, type, this.params() || {}, t, this.rainbow());
    if (still) { draw(2); return; }
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

  /**
   * A scene keeps the settings that carry a character's identity: its colour
   * sets the ramps, count / density scales how many things move, speed scales
   * the tick rate, and an opacity below the default dims it.
   */
  private runScene(cv: HTMLCanvasElement, type: string, map: (typeof SCENE_FOR)[string], still: boolean): void {
    const p = withDefaults(type, this.params());
    const colour = String(p[map.color] ?? '');
    const density = map.count ? Math.max(0.2, Math.min(4, num(p[map.count], map.countDefault!) / map.countDefault!)) : 1;
    const key = `${map.scene}|${colour}|${density}|${cv.width}x${cv.height}`;
    if (this.scene?.key !== key) {
      this.scene = { run: new SceneRun(cv, SCENES[map.scene], sceneColours(colour), density), key };
    }
    cv.style.opacity = String(Math.max(0, Math.min(1, num(p['opacity'], map.opacityDefault) / map.opacityDefault)));
    const run = this.scene.run;
    const fps = Math.max(0, Math.min(30, run.def.fps * num(p['speed'], map.speedDefault) / map.speedDefault));
    if (still || fps === 0) { run.frame(still ? 20 : this.tick); return; }
    const ms = 1000 / fps;
    this.last = -Infinity;
    const frame = (now: number) => {
      if (now - this.last >= ms) {
        this.last = now;
        run.frame(this.tick++);
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
}
