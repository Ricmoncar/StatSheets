import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import { PX, PatternParams, drawPattern, isGenericPattern, newPatternState, withDefaults } from '../core/game/pattern-draw';
import { SCENES, SCENE_FOR, SceneRun, sceneColours } from '../core/pixel/scenes';
import { SettingsService } from '../core/settings.service';

const FRAME_MS = 1000 / 30;   // pixel art moves in steps; 30 fps also halves the cost
// phones and touch screens get fewer frames: the motion still reads, at a fraction of the work
const SMALL = '(max-width: 760px), (pointer: coarse)';
const SMALL_FRAME_MS = 1000 / 15;
const SMALL_SCENE_FPS = 8;

const num = (v: unknown, d: number) => { const n = typeof v === 'number' ? v : parseFloat(String(v)); return isFinite(n) ? n : d; };

/**
 * One art pixel in screen pixels: --px in styles.scss, 2 at 720 px wide and
 * under, else 3. Read from the width rather than the computed style, which
 * forced a restyle of the whole page each time a canvas was resized.
 */
function artPx(): number {
  return matchMedia('(max-width: 720px)').matches ? 2 : 3;
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
  private timer: ReturnType<typeof setTimeout> | undefined;
  private t0 = 0;
  private ready = false;
  /** The running scene and what it was built from, so a speed change keeps it going. */
  private scene: { run: SceneRun; key: string } | null = null;
  private tick = 0;
  /** On screen (and not display: none): nothing is drawn while it is not. */
  private visible = true;
  /** The host's size in CSS pixels, from the resize observer. */
  private size = { w: 0, h: 0 };

  constructor() {
    // the observer hands over the size, so nothing has to read it back from the layout (which forces one)
    const resize = new ResizeObserver(([e]) => { this.size = { w: e.contentRect.width, h: e.contentRect.height }; this.fit(); });
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting === this.visible) return;
      this.visible = e.isIntersecting;
      if (this.ready) this.restart();
    });
    afterNextRender(() => {
      this.ready = true;
      resize.observe(this.host);
      seen.observe(this.host);   // both observers report once straight away
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
    inject(DestroyRef).onDestroy(() => { this.stop(); resize.disconnect(); seen.disconnect(); });
  }

  private fit(force = false): void {
    const cv = this.canvas().nativeElement;
    const px = SCENE_FOR[this.type() || ''] ? artPx() : PX;
    const w = Math.max(1, Math.ceil(this.size.w / px));
    const h = Math.max(1, Math.ceil(this.size.h / px));
    if (!force && cv.width === w && cv.height === h) return;
    cv.width = w; cv.height = h;
    this.state = { ...newPatternState(), w, h };
    this.scene = null;
    if (this.ready) this.restart();
  }

  private stop(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
  }

  /**
   * Draws a frame every `ms`, waking only when one is due. (Checking the clock
   * on every animation frame instead made the browser run a full style and
   * layout pass of the page 60 times a second for a scene drawn 8 times.)
   */
  private loop(ms: number, draw: (now: number) => void): void {
    const tick = () => { this.raf = requestAnimationFrame(now => { draw(now); this.timer = setTimeout(tick, ms); }); };
    tick();
  }

  private restart(): void {
    this.stop();
    if (!this.visible) return;   // off screen: picks up again when it scrolls back into view
    const cv = this.canvas().nativeElement;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const type = this.type() || 'none';
    const map = SCENE_FOR[type];
    // the canvas resolution depends on the kind of pattern
    const px = map ? artPx() : PX;
    if (!this.size.w) return;   // not measured yet: the first resize report starts it
    if (cv.width !== Math.max(1, Math.ceil(this.size.w / px))) { this.fit(true); return; }
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
    this.loop(matchMedia(SMALL).matches ? SMALL_FRAME_MS : FRAME_MS, now => draw((now - this.t0) / 1000));
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
    const cap = matchMedia(SMALL).matches ? SMALL_SCENE_FPS : 30;
    const fps = Math.max(0, Math.min(cap, run.def.fps * num(p['speed'], map.speedDefault) / map.speedDefault));
    if (still || fps === 0) { run.frame(still ? 20 : this.tick); return; }
    this.loop(1000 / fps, () => run.frame(this.tick++));
  }
}
