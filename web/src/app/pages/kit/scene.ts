// A page's world as a module: the page describes its scene (what to do at a
// new size, how to draw a frame, which colours to show it through) and gets
// back the PageModule the world canvas runs. The raster and the screen are
// kept between frames; dt is the time since the last frame, capped.
import { Raster, Screen } from '../raster';
import { PageModule } from '../registry';

export interface Scene {
  /** The page has a new size (also the first frame): lay out whatever depends on it. */
  size(W: number, H: number): void;
  /** Draws a frame of the world into `r` (W x H art pixels). t is seconds since the page opened. */
  draw(r: Raster, t: number, dt: number): void;
  /** The colour table this frame is shown through (a page may change entries for a flash or a fade). */
  colours(): Uint32Array;
}

/** What the overlay layer (over the whole window) offers the world canvas. */
export interface OverlayHandle { start(): void; stop(): void }

export function sceneModule(scene: Scene, overlay?: OverlayHandle): PageModule {
  let r: Raster | null = null;
  let screen: { ctx: CanvasRenderingContext2D; s: Screen } | null = null;
  let last = -1;
  return {
    drawBackground(_cv, ctx, W, H, t) {
      if (!r || r.w !== W || r.h !== H) { r = new Raster(W, H); scene.size(W, H); }
      if (screen?.ctx !== ctx) screen = { ctx, s: new Screen(ctx) };
      const dt = last < 0 ? 1 / 30 : Math.min(0.1, Math.max(0, t - last));
      last = t;
      scene.draw(r, t, dt);
      screen.s.show(r, scene.colours());
    },
    resetBackground() { last = -1; },
    startOverlay: overlay ? () => overlay.start() : undefined,
    stopOverlay: overlay ? () => overlay.stop() : undefined,
  };
}

/** A raster as a CSS image (a data URL), shown through `colours`: for sprites a page hands to its chrome. */
export function rasterImage(r: Raster, colours: Uint32Array): string {
  const c = document.createElement('canvas');
  c.width = r.w; c.height = r.h;
  new Screen(c.getContext('2d')!).show(r, colours);
  return `url("${c.toDataURL()}")`;
}
