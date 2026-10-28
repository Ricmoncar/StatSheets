// What every character page shares with the app around it: the active form's
// name, the size of an art pixel, the parts of the interface a page may move
// or tear, and what counts as a control (a click on one must stay a click).
import { Character } from '../core/data/models';

/** The character whose page is open (kept by the main page), for pages that change with the form without being reloaded. */
export const pageCharacter: { c: Character | null } = { c: null };

/** The active form's name, '' for the base form. */
export function activeFormName(c: Character | null | undefined): string {
  if (!c) return '';
  const idx = c.activeFormIdx || 0;
  return idx ? ((c.altForms || [])[idx - 1]?.name || '') : '';
}

let narrow: MediaQueryList | null = null;
/** One art pixel in CSS pixels: --px in styles.scss, 2 at 720 px wide and under, else 3. */
export function artPx(): number {
  return (narrow ??= matchMedia('(max-width: 720px)')).matches ? 2 : 3;
}

/** Phones and touch screens: the pages draw at half the rate there, and the room and the overlay share one tick. */
export const SMALL = '(max-width: 760px), (pointer: coarse)';

// ── the interface a page may move or tear ──
// The containers first, then the blocks inside the sheet (the second number
// is how much harder a page may shove them: they are what you are looking at).
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
