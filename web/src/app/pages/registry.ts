// The characters' own pages (phase 2). A page replaces the generic pattern
// behind the sheet with a world of its own, may draw over the whole window,
// and restyles the sheet through its chrome (pages/_pages.scss, keyed on the
// sheet's data-page). Its drawing code is downloaded only when its character
// is opened.
import { Character } from '../core/data/models';
import { activeFormName } from './host';

/** A page's drawing code. */
export interface PageModule {
  /** Draws the world behind the sheet into a canvas at art resolution (W x H art pixels); t is in seconds. */
  drawBackground(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void;
  /** Called before a new clock starts. */
  resetBackground(): void;
  /** The layer over the whole window (cursor, weather, cuts), started and stopped with the page. */
  startOverlay?(): void;
  stopOverlay?(): void;
}

export interface CustomPage {
  /** The old pattern type, and the sheet's data-page. */
  key: string;
  label: string;
  /** The colour the whole interface takes (the old page's --char-color). */
  accent: string;
  /** How strongly the world shows behind the sheet: a generic pattern sits at 0.3, a page that IS the page raises it. */
  opacity: number;
  /** The page draws its own cursor, so the system one is hidden while a mouse points. */
  ownCursor: boolean;
  matches(c: Character): boolean;
  load(): Promise<PageModule>;
}

const IVY = /^\s*ivy\s*$/i;
const EVIL = /evil/i;
const name = (re: RegExp) => (c: Character) => re.test(c.name || '');

// In the old site's order of precedence (its ptype ladder): a form's page before its base form's.
export const CUSTOM_PAGES: readonly CustomPage[] = [
  {
    key: 'bizzy_bees', label: "Bizzy's Hive", accent: '#f0ac1e', opacity: 0.8, ownCursor: true,
    matches: name(/^Bizzy$/i),
    load: () => import('./bizzy-bees/bizzy-bees'),
  },
  {
    key: 'riegen_phoenix', label: "Riegen · Phoenix", accent: '#ff8a2a', opacity: 0.92, ownCursor: true,
    matches: name(/^Riegen$/i),
    load: () => import('./riegen-phoenix/riegen-phoenix'),
  },
  {
    key: 'fury_fire', label: "Fury's Fire", accent: '#ff0000', opacity: 0.3, ownCursor: true,
    matches: name(/^Fury$/i),
    load: () => import('./fury-fire/fury-fire'),
  },
  {
    key: 'sorrow_fire', label: "Sorrow", accent: '#9a9a9a', opacity: 0.3, ownCursor: true,
    matches: name(/^Sorrow$/i),
    load: () => import('./sorrow-fire/sorrow-fire'),
  },
  {
    key: 'juko_one', label: "Juko · 1, the value left", accent: '#4ef0c4', opacity: 0.95, ownCursor: true,
    matches: c => /^Juko!?$/i.test(c.name || '') && /^\s*1\s*$/.test(activeFormName(c)),
    load: () => import('./juko-code/juko-one'),
  },
  {
    key: 'juko_code', label: "Juko! · Code Garden", accent: '#2fd09c', opacity: 0.3, ownCursor: true,
    matches: c => /^Juko!?$/i.test(c.name || '') && !/^\s*1\s*$/.test(activeFormName(c)),
    load: () => import('./juko-code/juko-code'),
  },
  {
    key: 'ivy_evil', label: 'Ivy · EVIL creature', accent: '#d61c30', opacity: 0.97, ownCursor: true,
    matches: c => IVY.test(c.name || '') && EVIL.test(activeFormName(c)),
    load: () => import('./ivy-evil/ivy-evil'),
  },
];

/** The page a character opens on in its current form, if it has one. */
export function customPageFor(c: Character | null | undefined): CustomPage | null {
  return (c && CUSTOM_PAGES.find(p => p.matches(c))) || null;
}
