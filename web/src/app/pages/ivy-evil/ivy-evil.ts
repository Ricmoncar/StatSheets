// IVY · EVIL CREATURE: the page. The hall is drawn behind the sheet, the
// blade over the whole window; both keep time by the one clock in look.ts.
import { Raster, Screen } from '../raster';
import { Blade } from './blade';
import { Hall } from './hall';
import { BASE, C, ROSE5, ROSE7, clock } from './look';

let hall: Hall | null = null;
let screen: { ctx: CanvasRenderingContext2D; s: Screen } | null = null;
const blade = new Blade();

export function drawBackground(_canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W: number, H: number): void {
  if (!hall || hall.W !== W || hall.H !== H) hall = new Hall(W, H);
  if (screen?.ctx !== ctx) screen = { ctx, s: new Screen(ctx) };
  const now = performance.now();
  screen.s.show(hall.draw(now / 1000), clock.colours);
  blade.tick(now);
}

/** The page keeps its own clock (shared with the overlay), so a new background clock changes nothing. */
export function resetBackground(): void { /* nothing to reset */ }

export function startOverlay(): void { blade.start(); }
export function stopOverlay(): void { blade.stop(); }

// ── the sheet's own sprites, drawn by the page and handed to its chrome (_chrome.scss) as CSS images ──
function image(r: Raster): string {
  const c = document.createElement('canvas');
  c.width = r.w; c.height = r.h;
  new Screen(c.getContext('2d')!).show(r, BASE);
  return `url("${c.toDataURL()}")`;
}
/**
 * A frame of thorned vine for the portrait, cut for border-image (slices of
 * 5): the stem two pixels in from the edge, thorns off both sides of it, and
 * a rose over each corner. The middle five pixels of each side repeat.
 */
function thorns(): Raster {
  const f = new Raster(15, 15);
  for (let i = 0; i < 15; i++) {
    f.set(i, 2, C['r2']); f.set(i, 3, C['k1']); f.set(i, 11, C['r2']); f.set(i, 12, C['k1']);
    f.set(2, i, C['r2']); f.set(3, i, C['k1']); f.set(11, i, C['r2']); f.set(12, i, C['k1']);
  }
  for (const k of [5, 8]) {
    const out = k === 5;
    f.set(k, out ? 1 : 4, C['r4']); f.set(k, out ? 13 : 10, C['r4']);
    f.set(out ? 1 : 4, k, C['r4']); f.set(out ? 13 : 10, k, C['r4']);
    f.set(k + 1, 2, C['r3']); f.set(k + 1, 11, C['r3']); f.set(2, k + 1, C['r3']); f.set(11, k + 1, C['r3']);
  }
  for (const [x, y] of [[0, 0], [10, 0], [0, 10], [10, 10]]) f.blit(ROSE5, x, y);
  return f;
}
const rose = new Raster(ROSE7.w, ROSE7.h);
rose.blit(ROSE7, 0, 0);
document.documentElement.style.setProperty('--ivy-thorns', image(thorns()));
document.documentElement.style.setProperty('--ivy-rose', image(rose));
