// What the old site's character pages reached for outside themselves, for the
// pages ported from script.js: the active form's name, the layout cache, the
// page's background canvas, and the parts of the interface a page may move or
// tear. Old ids map onto the new app's elements here, so a ported page keeps
// its own code close to the original.
import { Character } from '../core/data/models';

/** The active form's name, '' for the base form (the old _activeFormName). */
export function activeFormName(c: Character | null | undefined): string {
  if (!c) return '';
  const idx = c.activeFormIdx || 0;
  return idx ? ((c.altForms || [])[idx - 1]?.name || '') : '';
}

// ── the layout cache (the old _lyGen / _lyRect) ──
// A layout read inside an animation frame forces a full recalc whenever
// anything changed, which on an animated page is every frame. Boxes only move
// when something moves them, so reads are cached against a generation that
// resizes, scrolls and a ResizeObserver bump. The cache lives on the element
// (_lyG, _lyR) because the pages read those fields directly.
type Cached = Element & { _lyG?: number; _lyR?: DOMRect };
export let lyGen = 0;
export function lyBump(): void { lyGen++; }
export function lyRect(el: Element): DOMRect {
  const e = el as Cached;
  if (e._lyG === lyGen && e._lyR) return e._lyR;
  e._lyG = lyGen;
  return (e._lyR = el.getBoundingClientRect());
}

/** Starts bumping the generation; returns the stop. Observes the given elements' sizes. */
export function watchLayout(...els: Element[]): () => void {
  const opts = { passive: true, capture: true };
  addEventListener('resize', lyBump, { passive: true });
  addEventListener('scroll', lyBump, opts);
  const ro = new ResizeObserver(lyBump);
  for (const el of els) ro.observe(el);
  // and a slow net for anything none of the above catches (a panel opening, an image arriving)
  const net = setInterval(lyBump, 2000);
  return () => {
    removeEventListener('resize', lyBump);
    removeEventListener('scroll', lyBump, opts);
    ro.disconnect();
    clearInterval(net);
  };
}

// ── the page's background canvas (the old #pattern-canvas) ──
let world: HTMLCanvasElement | null = null;
export function setWorldCanvas(c: HTMLCanvasElement | null): void { world = c; }
export function worldCanvas(): HTMLCanvasElement | null { return world; }

// ── the interface a page may move or tear ──
// The old ids, in the old order: the containers, then the blocks inside the
// sheet, which the pages shove harder (the second number) because they are
// what you are looking at.
const SHELL = ['ss-character-view', 'ss-sidebar', 'header.topbar', 'ss-theme-bar'];
const BLOCKS = 'ss-character-view ss-panel, ss-character-view .head .portrait, ss-character-view .head .name, ss-character-view .sheet > .tabs';

export function interfaceTargets(blockWeight: number): [HTMLElement, number][] {
  const out: [HTMLElement, number][] = [];
  for (const sel of SHELL) { const el = document.querySelector<HTMLElement>(sel); if (el) out.push([el, 1]); }
  for (const el of document.querySelectorAll<HTMLElement>(BLOCKS)) out.push([el, blockWeight]);
  return out;
}

/** Anything you can press, type in or pick from: a click on one must not set off an effect that moves the page under it. */
const INTERACTIVE = 'button, a, input, select, textarea, label, summary, option, [onclick], [role="button"], [role="tab"], [contenteditable],'
  + ' .u-btn, .u-tab, .chip, ss-trait-card, ss-stat-bar, ss-sidebar .entry, ss-sidebar .folder-head, .sheet .bars .row, ss-inventory-panel .item';
export function isInteractive(el: EventTarget | null): boolean {
  return !!(el && (el as Element).closest?.(INTERACTIVE));
}
