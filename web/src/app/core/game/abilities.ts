// The ABILITIES tab. Ported from the old script.js (ABILITIES TAB, TEXT COLOR
// TOOLBAR). Colour markup is [c=#hex]text[/c]; unlike the old renderer, the
// text is never injected as HTML.

import type { Ability, Character } from '../data/models';

export type AbilityType = 'ACTIVE' | 'PASSIVE' | 'REACTION' | 'TOGGLE' | 'AURA' | 'ULTIMATE';

export const AB_TYPES: Record<AbilityType, { bg: string; border: string; text: string; icon: string; iconColor: string }> = {
  ACTIVE: { bg: 'rgba(0,255,255,0.06)', border: 'rgba(0,255,255,0.3)', text: '#00ffff', icon: '⚡︎', iconColor: '#ffffff' },
  PASSIVE: { bg: 'rgba(160,80,255,0.07)', border: 'rgba(160,80,255,0.35)', text: '#cc99ff', icon: '◈', iconColor: '#cc99ff' },
  REACTION: { bg: 'rgba(255,255,0,0.05)', border: 'rgba(255,255,0,0.3)', text: '#ffff44', icon: '↺', iconColor: '#ffff44' },
  TOGGLE: { bg: 'rgba(0,255,128,0.05)', border: 'rgba(0,255,128,0.3)', text: '#00ff80', icon: '⇌', iconColor: '#00ff80' },
  AURA: { bg: 'rgba(40,120,255,0.06)', border: 'rgba(40,120,255,0.32)', text: '#5599ff', icon: '◎', iconColor: '#5599ff' },
  ULTIMATE: { bg: 'rgba(255,80,0,0.08)', border: 'rgba(255,100,0,0.4)', text: '#ff8844', icon: '★', iconColor: '#ffcc88' },
};
export const AB_TYPE_ORDER: AbilityType[] = ['ACTIVE', 'PASSIVE', 'REACTION', 'TOGGLE', 'AURA', 'ULTIMATE'];

/** The colour toolbar's swatches; null removes colour from the selection. */
export const TEXT_COLORS: { color: string | null; title: string }[] = [
  { color: '#ffffff', title: 'White' }, { color: '#00ffff', title: 'Cyan' }, { color: '#cc99ff', title: 'Purple' },
  { color: '#ffff55', title: 'Yellow' }, { color: '#00ff80', title: 'Green' }, { color: '#5599ff', title: 'Blue' },
  { color: '#ff8844', title: 'Orange' }, { color: '#ff4466', title: 'Red' }, { color: '#888888', title: 'Gray' },
  { color: null, title: 'Remove color' },
];

/** Card meta in order: label and field. */
export const AB_META: { label: string; key: keyof Ability }[] = [
  { label: 'COST', key: 'cost' }, { label: 'CD', key: 'cd' }, { label: 'RANGE', key: 'range' },
  { label: 'CAST', key: 'cast' }, { label: 'DMG', key: 'dmg' }, { label: 'DUR', key: 'duration' },
];

export const AB_IMAGE_MAX_MB = 5;
export const PASSIVE_MAX = 200;

const COLOR_RE = /\[c=(#[0-9a-fA-F]{3,8})\]([\s\S]*?)\[\/c\]/g;

/** [c=#hex]..[/c] as pieces to render; the text stays text. */
export function colorPieces(raw: string | null | undefined): { text: string; color?: string }[] {
  const s = String(raw || '');
  const out: { text: string; color?: string }[] = [];
  let last = 0;
  for (const m of s.matchAll(COLOR_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: s.slice(last, at) });
    out.push({ text: m[2], color: m[1] });
    last = at + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** Wraps the selection in colour markup, or strips colour from it (color null). */
export function applyColor(text: string, start: number, end: number, color: string | null): { text: string; start: number; end: number } {
  const sel = text.substring(start, end);
  const rep = color === null ? sel.replace(/\[c=#[0-9a-fA-F]{3,8}\]([\s\S]*?)\[\/c\]/g, '$1') : `[c=${color}]${sel}[/c]`;
  return { text: text.substring(0, start) + rep + text.substring(end), start, end: start + rep.length };
}

export function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(v);
}

/** Tags are stored as one comma-separated string. */
export function abilityTags(tags: unknown): string[] {
  return String(Array.isArray(tags) ? tags.join(',') : (tags || '')).split(',').map(t => t.trim()).filter(Boolean);
}

export interface AbilityDraft {
  name: string;
  type: AbilityType;
  desc: string;
  notes: string;
  cost: string;
  cd: string;
  range: string;
  cast: string;
  tags: string;
  dmg: string;
  duration: string;
  req: string;
  image: string | null;
}

export function emptyAbility(): AbilityDraft {
  return { name: '', type: 'ACTIVE', desc: '', notes: '', cost: '', cd: '', range: '', cast: '', tags: '', dmg: '', duration: '', req: '', image: null };
}

/** Saves the editor's ability (keeping its id when editing). Returns an error message or null. */
export function saveAbility(c: Character, d: AbilityDraft, idx: number | null, newId: string): string | null {
  const name = (d.name || '').trim();
  if (!name) return 'ABILITY NEEDS A NAME';
  c.abilities = c.abilities || [];
  const existingId = idx != null ? (c.abilities[idx]?.id || null) : null;
  const t = (v: unknown) => String(v ?? '').trim();
  const ab: Ability = {
    id: existingId || newId,
    name,
    type: d.type,
    desc: t(d.desc), notes: t(d.notes), cost: t(d.cost), cd: t(d.cd), range: t(d.range), cast: t(d.cast),
    tags: t(d.tags) as any, dmg: t(d.dmg), duration: t(d.duration), req: t(d.req),
    image: d.image || null,
  };
  if (idx != null) c.abilities[idx] = ab; else c.abilities.push(ab);
  return null;
}

/** The old ability id: time and three random base-36 digits. */
export function abilityId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
