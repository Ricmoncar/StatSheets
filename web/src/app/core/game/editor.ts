// The character editor's rules. Ported from the old script.js (EDITOR,
// ALTERNATE FORMS editor side, CHARACTER TAGS): defaults, limits, and how the
// saved character is built from the draft.

import type { AltForm, Character, Stats, Substats } from '../data/models';
import { GENERIC_PATTERNS } from './patterns';

export const NAME_MAX = 24;
export const TAG_MAX_LEN = 20;
export const TAGS_MAX = 8;
export const FORMS_MAX = 12;
export const FORM_NAME_MAX = 20;
export const DEFAULT_COLOR = '#ffff00';

/** Base-form stat limits (the editor sliders). */
export const BASE_STAT_MAX: Record<string, number> = { hp: 1250, atk: 300, def: 300, mag: 300, spd: 300, iq: 500 };
/** Alt-form stat limits: up to COUNTRY level. */
export const FORM_STAT_MAX: Record<string, number> = { hp: 2200, atk: 400, def: 400, mag: 400, spd: 400, iq: 500 };
export const NEW_STATS = { hp: 50, atk: 10, def: 10, mag: 10, spd: 10, iq: 50 };

/** Base-form sub-stats: only HEAL POWER (0-100) and DEXTERITY (0-10) can be entered; the rest are derived. */
export const BASE_SUBSTAT_FIELDS: { key: keyof Substats; label: string; color: string; help: string; editable: boolean; max?: number; step?: number }[] = [
  { key: 'heal_pow', label: 'HEAL POWER (%)', color: '#88ff88', help: '+5% healing power per 15 MAG. No max.', editable: true, max: 100, step: 1 },
  { key: 'crit_rate', label: 'CRIT CHANCE (%)', color: '#ff8888', help: '+0.3% crit chance per 20 ATK. Max 80% without items.', editable: false },
  { key: 'crit_dmg', label: 'EXTRA CRIT DMG (%)', color: '#cc0000', help: '+1% extra crit damage per 50 ATK. +0.1% extra crit damage per 1% crit chance.', editable: false },
  { key: 'status_res', label: 'STATUS RES (%)', color: '#00ccaa', help: '+1% status effect resistance per 20 DEF. Max 50% without items.', editable: false },
  { key: 'dexterity', label: 'DEXTERITY (%)', color: '#ffff88', help: '+0.5% dexterity per 10 SPEED. Combat speed, weaving, dodging.', editable: true, max: 10, step: 0.1 },
  { key: 'resilience', label: 'RESILIENCE (%)', color: '#8800cc', help: 'Chance to survive with 1 hp. +0.20% resilience per 100 HP. Max 50%.', editable: false },
  { key: 'true_dmg', label: 'TRUE DAMAGE (%)', color: '#ffffff', help: 'Ignores defense. +1% true damage per 300 HP.', editable: false },
  { key: 'lifesteal', label: 'LIFESTEAL (%)', color: '#aa0000', help: 'Heal from damage dealt. +1% lifesteal per 100 DEF.', editable: false },
  { key: 'cooldown_red', label: 'COOLDOWN RED. (%)', color: '#00aaff', help: 'Reduces skill cooldowns. +1% CDR per 20 SPEED. Max 40% without items.', editable: false },
];

/** Alt-form sub-stats: all editable, with these limits. */
export const FORM_SUBSTAT_FIELDS: { key: keyof Substats; label: string; color: string; max: number; step: number }[] = [
  { key: 'heal_pow', label: 'HEAL POW', color: '#88ff88', max: 999, step: 1 },
  { key: 'crit_rate', label: 'CRIT RATE', color: '#ff8888', max: 100, step: 0.1 },
  { key: 'crit_dmg', label: 'CRIT DMG', color: '#cc2222', max: 999, step: 1 },
  { key: 'status_res', label: 'STATUS RES', color: '#00ccaa', max: 100, step: 0.1 },
  { key: 'dexterity', label: 'DEX', color: '#ffff88', max: 100, step: 0.1 },
  { key: 'resilience', label: 'RESILIENCE', color: '#8844cc', max: 100, step: 0.1 },
  { key: 'true_dmg', label: 'TRUE DMG', color: '#ffffff', max: 999, step: 1 },
  { key: 'lifesteal', label: 'LIFESTEAL', color: '#aa2222', max: 100, step: 0.1 },
  { key: 'cooldown_red', label: 'CDR', color: '#00aaff', max: 100, step: 0.1 },
];

/** The ten accent swatches next to the colour wheel (soul colours). */
export const SOUL_SWATCHES = ['#ff0000', '#00ffff', '#ff8000', '#0080ff', '#ff80ff', '#00ff00', '#ffff00', '#ffffff', '#ff4444', '#44ffaa'];

export interface FormDraft {
  /** index in the character's altForms when the editor opened; null for a new form */
  srcIdx: number | null;
  name: string;
  avatar: string | null;
  stats: Required<Stats>;
  substats: Required<Substats>;
  /** shown only; the editor does not change a form's traits */
  traits: string[] | null;
}

export interface EditorDraft {
  name: string;
  bio: string;
  color: string;
  avatar: string | null;
  stats: Required<Stats>;
  substats: Required<Substats>;
  tags: string[];
  forms: FormDraft[];
  pattern: { type: string; params: Record<string, unknown> };
}

export function fullSubstats(src?: Substats | null, coerce = false): Required<Substats> {
  const s = (src || {}) as Record<string, unknown>;
  const n = (v: unknown) => (coerce ? (+(v as number) || 0) : ((v as number) || 0));
  return {
    heal_pow: n(s['heal_pow']), crit_rate: n(s['crit_rate']), crit_dmg: n(s['crit_dmg']),
    status_res: n(s['status_res']), dexterity: n(s['dexterity']), resilience: n(s['resilience']),
    true_dmg: n(s['true_dmg']), lifesteal: n(s['lifesteal']), cooldown_red: n(s['cooldown_red']),
  };
}

export function newDraft(): EditorDraft {
  return { name: '', bio: '', color: DEFAULT_COLOR, avatar: null, stats: { ...NEW_STATS }, substats: fullSubstats(), tags: [], forms: [], pattern: { type: 'none', params: {} } };
}

export function newForm(): FormDraft {
  return { srcIdx: null, name: '', avatar: null, stats: { ...NEW_STATS }, substats: fullSubstats(), traits: null };
}

export function draftFrom(c: Character): EditorDraft {
  const st = (c.stats || {}) as Record<string, number>;
  return {
    name: c.name === 'UNTITLED' ? '' : (c.name || ''),
    bio: c.bio || '',
    color: c.color || DEFAULT_COLOR,
    avatar: c.avatar || null,
    stats: { hp: st['hp'], atk: st['atk'], def: st['def'], mag: st['mag'], spd: st['spd'], iq: st['iq'] || 50 },
    substats: fullSubstats(c.substats),
    tags: [...(c.tags || [])],
    forms: (c.altForms || []).map((f, i) => ({
      srcIdx: i,
      name: f.name || '',
      avatar: f.avatar || null,
      stats: { hp: f.stats?.hp || 50, atk: f.stats?.atk || 10, def: f.stats?.def || 10, mag: f.stats?.mag || 10, spd: f.stats?.spd || 10, iq: f.stats?.iq || 50 },
      substats: fullSubstats(f.substats),
      traits: Array.isArray(f.traits) ? f.traits.slice() : null,
    })),
    pattern: { type: c.pattern?.type || 'none', params: { ...(c.pattern?.params || {}) } },
  };
}

/** Clamp a stat the way the editor's number box does: whole number, 1 to max. */
export function clampStat(val: unknown, max: number): number {
  return Math.min(max, Math.max(1, parseInt(String(val), 10) || 1));
}

/** Adds a tag: trimmed, no duplicates, at most 8. Returns the new list, or null when refused. */
export function addTag(tags: string[], raw: string): string[] | null {
  const val = raw.trim();
  if (!val || tags.includes(val) || tags.length >= TAGS_MAX) return null;
  return [...tags, val];
}

/** Pattern params with every default filled in (the old saveCharacter). */
export function patternWithDefaults(type: string, params: Record<string, unknown>): { type: string; params: Record<string, unknown> } {
  const out = { ...params };
  for (const p of GENERIC_PATTERNS[type]?.params || []) if (out[p.id] === undefined) out[p.id] = p.default;
  return { type, params: out };
}

/**
 * The character to save: everything it already has, with the editor's
 * fields on top. A form keeps its LIVE traits and theme song (the editor does
 * not edit them; taking them from when the editor opened would undo a roll
 * made meanwhile).
 */
export function buildCharacter(existing: Partial<Character>, d: EditorDraft, id: string, now: number): Character {
  const ex = existing as Character & Record<string, any>;
  const forms: AltForm[] = d.forms.map(f => {
    const live = f.srcIdx != null ? (ex.altForms || [])[f.srcIdx] : null;
    const src: Record<string, any> = live || {};
    return {
      name: f.name || '',
      avatar: f.avatar || null,
      stats: { hp: +f.stats.hp || 1, atk: +f.stats.atk || 1, def: +f.stats.def || 1, mag: +f.stats.mag || 1, spd: +f.stats.spd || 1, iq: +f.stats.iq || 50 },
      substats: fullSubstats(f.substats, true),
      ...(src['themeSong'] ? { themeSong: src['themeSong'] } : {}),
      ...(Array.isArray(src['traits']) ? { traits: src['traits'], shimmyfulTraits: src['shimmyfulTraits'] || [] } : {}),
    };
  });
  return {
    ...ex,
    id,
    createdAt: ex.createdAt || now,
    name: d.name.trim(),
    bio: d.bio.trim(),
    color: d.color,
    avatar: d.avatar,
    isPlaceholder: false,
    stats: { hp: +d.stats.hp, atk: +d.stats.atk, def: +d.stats.def, mag: +d.stats.mag, spd: +d.stats.spd, iq: +d.stats.iq },
    substats: fullSubstats(d.substats, true),
    pattern: patternWithDefaults(d.pattern.type, d.pattern.params),
    inventory: ex.inventory || [],
    traits: ex.traits || [],
    shimmyfulTraits: ex.shimmyfulTraits || [],
    traitTriggers: ex.traitTriggers || {},
    traitStacks: ex.traitStacks || {},
    dualityState: ex.dualityState || {},
    traitHistory: ex.traitHistory || [],
    folderId: ex.folderId || null,
    order: ex.order ?? null,
    gold: ex.gold ?? 0,
    goldHistory: ex.goldHistory || [],
    pity: ex.pity ?? 0,
    tags: [...d.tags],
    altForms: forms,
    activeFormIdx: ex.activeFormIdx || 0,
    info: ex.info || {},
    missingNoRolls: ex['missingNoRolls'],
    thousandDoorsAccum: ex['thousandDoorsAccum'],
    thousandDoorsHistory: ex['thousandDoorsHistory'],
    drunkStats: ex['drunkStats'],
    drunkCount: ex['drunkCount'],
    perfectSoulData: ex.perfectSoulData,
  };
}

/** A local-only draft from a cancelled NEW character (never synced, as before). */
export function placeholderFrom(d: EditorDraft, id: string): Character {
  return {
    id,
    name: d.name.trim() || 'UNTITLED',
    bio: d.bio.trim(),
    color: d.color,
    avatar: d.avatar,
    isPlaceholder: true,
    stats: { ...d.stats },
    substats: fullSubstats(d.substats, true),
    pattern: patternWithDefaults(d.pattern.type, d.pattern.params),
    inventory: [],
  };
}
