// The sub-stats panel as data: each sub-stat's value, how much of it comes
// from stat scaling, what each equipped item adds directly, and the SANITY
// row. Ported from the old renderSubstatsDisplay (script.js, INVENTORY SYSTEM).

import type { Character } from '../data/models';
import { EffectiveStats, effectiveStats, formTraits, SubStat } from './stats';

export interface SubstatDef {
  key: SubStat;
  label: string;
  /** colour token name, e.g. 'heal' -> var(--ss-sub-heal) */
  color: string;
  /** what the stat does and how it scales */
  help: string;
}

export const SUBSTAT_DEFS: SubstatDef[] = [
  { key: 'heal_pow', label: 'HEAL POWER', color: '#88ff88', help: 'Base +5% per 15 MAG. No max.' },
  { key: 'crit_rate', label: 'CRIT CHANCE', color: '#ff8888', help: 'Base +0.3% per 20 ATK. Max 80% without items.' },
  { key: 'crit_dmg', label: 'EXTRA CRIT DMG', color: '#cc0000', help: 'Base +1% per 50 ATK. +0.1% per 1% Crit Chance.' },
  { key: 'status_res', label: 'STATUS RES', color: '#00ccaa', help: 'Base +1% per 20 DEF. Max 50% without items.' },
  { key: 'dexterity', label: 'DEXTERITY', color: '#ffff88', help: 'Base +0.5% per 10 SPEED. Combat speed, weaving, dodging.' },
  { key: 'resilience', label: 'RESILIENCE', color: '#8800cc', help: 'Chance to survive with 1 hp. +0.20% resilience per 100 HP. Max 50%.' },
  { key: 'true_dmg', label: 'TRUE DAMAGE', color: '#ffffff', help: 'Ignores defense. +1% true damage per 300 HP.' },
  { key: 'lifesteal', label: 'LIFESTEAL', color: '#aa0000', help: 'Heal from damage dealt. +1% lifesteal per 100 DEF.' },
  { key: 'cooldown_red', label: 'COOLDOWN RED.', color: '#00aaff', help: 'Reduces skill cooldowns. +1% CDR per 20 SPEED. Max 40% without items.' },
];

const LOCKED: SubStat[] = ['crit_rate', 'crit_dmg', 'status_res', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'];

export interface SubstatRow {
  def: SubstatDef;
  value: number;
  /** effective minus the entered base; shown when its size is over 0.05 */
  diff: number;
  /** part of the value that comes from stat scaling (shown when over 0.05) */
  fromStats: number;
  /** direct item bonuses, each over 0.009 */
  items: { name: string; delta: number }[];
}

export interface SanityRow {
  value: number;
  base: number;
  perfectSoul: boolean;
  items: { name: string; delta: number }[];
  /** 'neg' under 0, 'low' at 30 or less, else 'ok' */
  level: 'neg' | 'low' | 'ok';
}

type Mod = { stat?: string; op?: string; value?: unknown };

export function substatRows(c: Character, eff: EffectiveStats = effectiveStats(c)): SubstatRow[] {
  const equipped = (c.inventory || []).filter(i => i.equipped);
  return SUBSTAT_DEFS.map(def => {
    let baseVal = c.substats ? (c.substats[def.key] || 0) : 0;
    if (LOCKED.includes(def.key)) baseVal = 0;
    const value = eff[def.key] || 0;

    // "pure scaled": every item kept, but no item's DIRECT modifier for this sub-stat
    const noDirect = clone(c);
    (noDirect.inventory || []).forEach(i => { i.mods = ((i.mods || []) as Mod[]).filter(m => m.stat !== def.key) as any; });
    const fromStats = effectiveStats(noDirect)[def.key] - baseVal;

    const items: SubstatRow['items'] = [];
    for (const item of equipped) {
      const t = clone(c);
      const idx = (t.inventory || []).findIndex(i => i.id === item.id);
      if (idx === -1) continue;
      t.inventory![idx].mods = ((t.inventory![idx].mods || []) as Mod[]).filter(m => m.stat !== def.key) as any;
      const delta = value - effectiveStats(t)[def.key];
      if (Math.abs(delta) > 0.009) items.push({ name: item.name, delta });
    }
    return { def, value, diff: value - baseVal, fromStats, items };
  });
}

/** SANITY: base 80 minus 5 per absorbed soul with I WANT A PERFECT SOUL, else 100; items add or subtract. Null when neither applies. */
export function sanityRow(c: Character): SanityRow | null {
  const perfectSoul = formTraits(c).includes('perfectsoul');
  const items: SanityRow['items'] = [];
  let delta = 0;
  for (const item of (c.inventory || []).filter(i => i.equipped)) {
    for (const m of (item.mods || []) as Mod[]) {
      if (m.stat !== 'sanity') continue;
      const v = parseFloat(m.value as string) || 0;
      const d = m.op === 'add' ? v : m.op === 'sub' ? -v : 0;
      if (d !== 0) { delta += d; items.push({ name: item.name, delta: d }); }
    }
  }
  if (!perfectSoul && delta === 0) return null;
  const souls = perfectSoul ? (c.perfectSoulData?.souls?.length || 0) : 0;
  const base = perfectSoul ? 80 - souls * 5 : 100;
  const value = base + delta;
  return { value, base, perfectSoul, items, level: value < 0 ? 'neg' : value <= 30 ? 'low' : 'ok' };
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}
