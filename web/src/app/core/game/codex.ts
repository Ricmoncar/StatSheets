// The trait codex, the cultivation (SCALING) window and the roll history.
// Ported from the old script.js (TRAIT CODEX, CULTIVATION / SCALING WINDOW,
// renderRollHistory).

import type { Character } from '../data/models';
import { RARITY_LABEL, RARITY_ORDER, activeRarityWeights } from './roll';
import { baseEffectiveStats, effectiveStats, formTraits, getTraitDef } from './stats';
import type { TraitDef } from './trait-types';
import { ROLE_LABELS, ROLE_ORDER, TRAIT_ROLES } from './trait-roles';
import { TRAITS } from './traits-data';

export interface CodexSection {
  rarity: string;
  label: string;
  seen: number;
  total: number;
  /** the rarity's current roll weight (shown as "N% chance", as before) */
  chance: number;
  /** seen traits grouped by role (empty groups left out); duality and determined use one group */
  groups: { role: string; label: string; traits: { key: string; def: TraitDef }[] }[];
}

/** One section per rarity, in rarity order. Only traits this browser has seen are listed. */
export function codexSections(seen: ReadonlySet<string>, fortuneLevel: number): CodexSection[] {
  const weights = activeRarityWeights(fortuneLevel);
  return RARITY_ORDER.map(rar => {
    const all = Object.entries(TRAITS).filter(([, t]) => t.rarity === rar);
    const seenOf = all.filter(([k]) => seen.has(k)).map(([key, def]) => ({ key, def }));
    let groups: CodexSection['groups'];
    if (rar === 'duality' || rar === 'determined') {
      groups = seenOf.length ? [{ role: rar, label: '', traits: seenOf }] : [];
    } else {
      groups = ROLE_ORDER.map(role => ({
        role,
        label: ROLE_LABELS[role],
        traits: seenOf.filter(t => (TRAIT_ROLES[t.key] || 'utility') === role),
      })).filter(g => g.traits.length);
    }
    return { rarity: rar, label: RARITY_LABEL[rar], seen: seenOf.length, total: all.length, chance: weights[rar], groups };
  });
}

// ── cultivation ──
export interface CultivationRow {
  key: string;
  rarity: string;
  def: TraitDef;
  label: string;
  stacks: number;
  max: number;
}

export function cultivationRows(c: Character): CultivationRow[] {
  const stacks = (c.traitStacks || {}) as Record<string, number>;
  return formTraits(c).filter(k => TRAITS[k]?.cultivation).map(key => {
    const def = getTraitDef(c, key)!;
    const cult = def.cultivation as Record<string, any>;
    return {
      key,
      rarity: String(TRAITS[key].rarity),
      def,
      label: cult['label'],
      stacks: stacks[key] != null ? stacks[key] : (cult['defaultStacks'] || 0),
      max: cult['maxStacks'],
    };
  });
}

/** Sets a trait's stacks, clamped to 0..max. */
export function setStacks(c: Character, key: string, val: unknown): number {
  const def = getTraitDef(c, key)!;
  const max = (def.cultivation as any).maxStacks;
  const v = Math.max(0, Math.min(max, parseInt(String(val), 10) || 0));
  c.traitStacks = c.traitStacks || {};
  c.traitStacks[key] = v;
  return v;
}

export function adjustStacks(c: Character, key: string, delta: number): number {
  const def = getTraitDef(c, key)!;
  const cult = def.cultivation as any;
  const cur = (c.traitStacks || {})[key] != null ? (c.traitStacks as any)[key] : (cult.defaultStacks || 0);
  c.traitStacks = c.traitStacks || {};
  c.traitStacks[key] = Math.max(0, Math.min(cult.maxStacks, cur + delta));
  return c.traitStacks[key];
}

const SUB_LABELS: Record<string, string> = { heal_pow: 'HEAL PWR', crit_rate: 'CRIT RATE', crit_dmg: 'CRIT DMG', status_res: 'STATUS RES', dexterity: 'DEXTERITY', resilience: 'RESILIENCE', true_dmg: 'TRUE DMG', lifesteal: 'LIFESTEAL', cooldown_red: 'CDR' };

/**
 * SCALED STAT DELTA for one cultivation trait: its effect on its own (no
 * other traits, no scenario triggers) against the raw base. Main stats show
 * when the change is half a point or more; sub-stats always show. Exactly the
 * old refreshCultivationPreviews.
 */
export function cultivationPreview(c: Character, key: string): { label: string; diff: number; pct: boolean }[] {
  const without = JSON.parse(JSON.stringify(c));
  without._rawTraits = true;
  without.traitStacks = {};
  const raw = baseEffectiveStats(without) as Record<string, number>;
  const single = JSON.parse(JSON.stringify(c));
  single._rawTraits = true;
  single.traits = [key];
  single.traitTriggers = {};
  const eff = effectiveStats(single) as Record<string, number>;
  const out: { label: string; diff: number; pct: boolean }[] = [];
  for (const k of ['hp', 'atk', 'def', 'mag', 'spd', 'iq']) {
    const diff = eff[k] - raw[k];
    if (Math.abs(diff) >= 0.5) out.push({ label: k.toUpperCase(), diff, pct: false });
  }
  for (const [k, label] of Object.entries(SUB_LABELS)) out.push({ label, diff: eff[k] - raw[k], pct: true });
  return out;
}

/** "M/D H:MM" as the roll history shows it. */
export function historyDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
