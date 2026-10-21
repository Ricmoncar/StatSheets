// Effective stats: base stats of the active form, plus equipped item mods,
// plus trait passives, plus the derived sub-stats.
//
// Ported from the old script.js, keeping its structure so the two can be
// compared number for number:
//   baseEffectiveStats  = the original getEffectiveStats (INVENTORY SYSTEM)
//   effectiveStats      = the trait-aware wrapper (TRAIT EFFECT APPLICATION)
//   buildTraitPassives  = buildTraitPassives
// The one deliberate difference: the old function zeroed the character's
// stored locked sub-stats in memory as a side effect. This one works on copies
// and never changes the character it is given.

import type { Character } from '../data/models';
import type { Passive, TraitDef } from './trait-types';
import {
  SHIMMYFUL_EPIC_TRAITS,
  SHIMMYFUL_LEGENDARY_TRAITS,
  SHIMMYFUL_MYTHIC_TRAITS,
  SHIMMYFUL_RARE_TRAITS,
  SHIMMYFUL_TRAITS,
  TRAITS,
} from './traits-data';

export const MAIN_STATS = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'] as const;
export const SUB_STATS = ['heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'] as const;
export type MainStat = typeof MAIN_STATS[number];
export type SubStat = typeof SUB_STATS[number];
export type EffectiveStats = Record<MainStat | SubStat, number>;

/** Sub-stats that are fully derived from main stats on the base form. */
const LOCKED_SUBSTATS: SubStat[] = ['crit_rate', 'crit_dmg', 'status_res', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'];

type AnyChar = Character & { _rawTraits?: unknown; glitchRolls?: Record<string, number>; missingNoRolls?: Record<string, number>; thousandDoorsAccum?: Record<string, number>; drunkStats?: Record<string, number> };

/** Whoever owns the trait list for a form: the alt form if it has its own list, else the character. */
export function traitOwner(c: AnyChar, formIdx?: number): { traits?: string[]; shimmyfulTraits?: string[] } {
  if (!c || c._rawTraits) return c;
  const idx = formIdx == null ? (c.activeFormIdx || 0) : formIdx;
  if (idx > 0) {
    const f = (c.altForms || [])[idx - 1];
    if (f && Array.isArray(f.traits)) return f;
  }
  return c;
}

/** The traits the character has right now, for the form on screen. */
export function formTraits(c: AnyChar | null | undefined): string[] {
  if (!c) return [];
  return traitOwner(c).traits || [];
}

export function isShimmyful(c: AnyChar, key: string): boolean {
  const o = traitOwner(c);
  return !!(o && o.shimmyfulTraits && o.shimmyfulTraits.includes(key));
}

/** The shimmyful definition for a trait, from the table matching its rarity. */
export function getShimmyfulDef(key: string): TraitDef | undefined {
  const rarity = TRAITS[key]?.rarity;
  if (rarity === 'legendary') return SHIMMYFUL_LEGENDARY_TRAITS[key];
  if (rarity === 'mythic') return SHIMMYFUL_MYTHIC_TRAITS[key];
  if (rarity === 'epic') return SHIMMYFUL_EPIC_TRAITS[key];
  if (rarity === 'rare') return SHIMMYFUL_RARE_TRAITS[key];
  return SHIMMYFUL_TRAITS[key];
}

/** The best display/passive definition for a character's trait. */
export function getTraitDef(c: AnyChar, key: string): TraitDef | undefined {
  if (isShimmyful(c, key)) {
    const sd = getShimmyfulDef(key);
    if (sd) return sd;
  }
  return TRAITS[key];
}

export function getActiveTraits(c: AnyChar): { key: string; def: TraitDef }[] {
  return formTraits(c).map(key => ({ key, def: TRAITS[key] })).filter(x => x.def);
}

type SrcPassive = Passive & { _src: string };

/** Every trait passive that is active right now, flattened. */
export function buildTraitPassives(c: AnyChar): SrcPassive[] {
  const out: SrcPassive[] = [];
  const triggers = (c.traitTriggers || {}) as Record<string, unknown>;
  const stacks = (c.traitStacks || {}) as Record<string, any>;
  for (const { key, def } of getActiveTraits(c)) {
    // DUALITY: heavenly or hellforged passive set, by the current state
    if (def.rarity === 'duality') {
      const state = ((c.dualityState || {}) as Record<string, string>)[key] || 'heavenly';
      const sd = def[state] || def;
      (sd.passive || []).forEach((p: Passive) => out.push({ ...p, _src: key }));
      (sd.situational || def.situational || []).forEach((sit: any) => {
        const isHeavenlySit = sit.label.startsWith('HEAVENLY');
        const isHellforgedSit = sit.label.startsWith('HELLFORGED');
        if (state === 'heavenly' && isHellforgedSit) return;
        if (state === 'hellforged' && isHeavenlySit) return;
        if (triggers[key + ':' + sit.id]) (sit.passive || []).forEach((p: Passive) => out.push({ ...p, _src: key + ':' + sit.id }));
      });
      continue;
    }
    // CAPITALIST: scale non-HP/non-IQ main stats from the character's treasury
    if (key === 'capitalist') {
      const active = !!stacks['capitalist:active'];
      const multiplier = Math.max(0, Number(c.gold || 0) / 90000);
      if (active && multiplier > 0) {
        for (const stat of ['atk', 'def', 'mag', 'spd']) out.push({ stat, op: 'mul', value: multiplier, _src: key });
      }
      continue;
    }
    // DETERMINATION: MERCYFUL grants stat passives; a forced state wins
    if (key === 'determination') {
      const forced = stacks['determination:state'] || '';
      const kills = stacks['determination:kills'] || 0;
      const spares = stacks['determination:spares'] || 0;
      const deaths = stacks['determination:deaths'] || 0;
      const detState = forced || (kills >= 10 ? 'hatred' : spares >= 10 ? 'mercyful' : 'determined');
      if (detState === 'mercyful') {
        out.push({ stat: 'heal_pow', op: 'pct', value: 900, _src: key });
        out.push({ stat: 'def', op: 'pct', value: 900, _src: key });
      } else if (detState === 'determined') {
        if (kills > 0) out.push({ stat: 'all_main', op: 'mul', value: Math.min(10, Math.pow(1.5, kills)), _src: key });
        if (spares > 0) {
          out.push({ stat: 'heal_pow', op: 'add', value: 5 * spares, _src: key });
          out.push({ stat: 'def', op: 'pct', value: 5 * spares, _src: key });
        }
        if (deaths > 0) out.push({ stat: 'all_main', op: 'mul', value: Math.pow(0.99, deaths), _src: key });
      }
      continue;
    }
    // MISSING NO.: stored random stat multipliers
    if (key === 'missingno') {
      const rolls = c.missingNoRolls;
      if (rolls) {
        for (const s of ['hp', 'atk', 'def', 'mag', 'spd']) {
          if (rolls[s] != null) out.push({ stat: s, op: 'mul', value: rolls[s], _src: key });
        }
      }
      continue;
    }
    // AT THOUSAND DOORS: compounded permanent stat multipliers
    if (key === 'thousanddoors') {
      const accum = c.thousandDoorsAccum;
      if (accum) {
        for (const [s, v] of Object.entries(accum)) if (v != null && v !== 1) out.push({ stat: s, op: 'mul', value: v, _src: key });
      }
      continue;
    }
    // ANOTHER, AND ANOTHER: stored randomized stats; falls through for its situational button
    if (key === 'anotherandanother') {
      const drunk = c.drunkStats;
      if (drunk) {
        if (drunk['atk'] != null) out.push({ stat: 'atk', op: 'mul', value: drunk['atk'], _src: key });
        if (drunk['mag'] != null) out.push({ stat: 'mag', op: 'mul', value: drunk['mag'], _src: key });
        if (drunk['def'] != null) out.push({ stat: 'def', op: 'mul', value: drunk['def'], _src: key });
        if (drunk['hp'] != null) out.push({ stat: 'hp', op: 'mul', value: drunk['hp'], _src: key });
      }
    }
    // I WANT A PERFECT SOUL: absorbed souls' stats as flat additions
    if (key === 'perfectsoul') {
      const data = c.perfectSoulData as { souls?: { stats?: Record<string, number> }[] } | undefined;
      if (data && data.souls && data.souls.length) {
        const totals: Record<string, number> = { hp: 0, atk: 0, def: 0, mag: 0, spd: 0 };
        for (const soul of data.souls) {
          const s = soul.stats || {};
          for (const k of Object.keys(totals)) totals[k] += (s[k] || 0);
        }
        for (const [stat, val] of Object.entries(totals)) if (val > 0) out.push({ stat, op: 'add', value: Math.round(val), _src: key });
      }
      continue;
    }
    // shimmyful passive overrides where they apply
    const shimDef = isShimmyful(c, key) ? getShimmyfulDef(key) : null;
    const activeDef = shimDef || def;
    (activeDef.passive || []).forEach((p: Passive) => out.push({ ...p, _src: key }));
    (activeDef.situational || def.situational || []).forEach((sit: any) => {
      if (triggers[key + ':' + sit.id]) (sit.passive || []).forEach((p: Passive) => out.push({ ...p, _src: key + ':' + sit.id }));
    });
    if (def.cultivation) {
      const n = stacks[key] != null ? stacks[key] : (def.cultivation.defaultStacks || 0);
      if (n > 0) {
        const per = def.cultivation.perStack;
        const perArr = Array.isArray(per) ? per : (per ? [per] : []);
        for (const p of perArr) out.push({ ...p, value: (p.value as number) * n, _src: key + ':cult' });
      }
    }
  }
  return out;
}

interface Mod { stat: string; op: string; value: unknown }

/** Trait passives as item-style mods, so derived sub-stats inherit trait boosts. */
function traitPassivesToMods(passives: Passive[]): Mod[] {
  const expanded: Mod[] = [];
  for (const p of passives) {
    if (p.op === 'derived') continue;          // applied after
    if (p.stat === 'resilience') continue;     // the base caps it at 50; traits bypass that after
    const stats: readonly string[] = p.stat === 'all_main' ? MAIN_STATS : p.stat === 'all_sub' ? SUB_STATS : [p.stat];
    for (const stat of stats) {
      if (p.op === 'add') expanded.push({ stat, op: 'add', value: p.value });
      else if (p.op === 'pct') expanded.push({ stat, op: 'mul', value: 1 + (p.value as number) / 100 });
      else if (p.op === 'mul') expanded.push({ stat, op: 'mul', value: p.value });
    }
  }
  return expanded;
}

/** The original getEffectiveStats: form base stats + equipped item mods + derived sub-stats. */
export function baseEffectiveStats(c: AnyChar): EffectiveStats {
  const formIdx = c.activeFormIdx || 0;
  const altForm = formIdx > 0 ? (c.altForms || [])[formIdx - 1] : null;
  const base: Record<string, number> = { ...(altForm ? altForm.stats : c.stats) } as Record<string, number>;
  const subBase: Record<string, number> = { ...((altForm ? altForm.substats : null) || c.substats || {
    heal_pow: 0, crit_rate: 0, crit_dmg: 0, status_res: 0, dexterity: 0, resilience: 0, true_dmg: 0, lifesteal: 0, cooldown_red: 0,
  }) } as Record<string, number>;

  // On the base form the locked sub-stats are always 0 (fully derived from main
  // stats). On an alt form the user can set them, and they become the base.
  if (!altForm) for (const key of LOCKED_SUBSTATS) subBase[key] = 0;

  const items = (c.inventory || []).filter(i => i.equipped);
  const adds: Record<string, number> = { hp: 0, atk: 0, def: 0, mag: 0, spd: 0, iq: 0, heal_pow: 0, crit_rate: 0, crit_dmg: 0, status_res: 0, dexterity: 0, resilience: 0, true_dmg: 0, lifesteal: 0, cooldown_red: 0 };
  const muls: Record<string, number> = { hp: 1, atk: 1, def: 1, mag: 1, spd: 1, iq: 1, heal_pow: 1, crit_rate: 1, crit_dmg: 1, status_res: 1, dexterity: 1, resilience: 1, true_dmg: 1, lifesteal: 1, cooldown_red: 1 };
  for (const item of items) {
    for (const m of ((item.mods || []) as Mod[])) {
      const v = parseFloat(m.value as string) || 0;
      if (m.op === 'add') adds[m.stat] += v;
      if (m.op === 'sub') adds[m.stat] -= v;
      if (m.op === 'mul') muls[m.stat] *= v;
      if (m.op === 'div') { if (v !== 0) muls[m.stat] /= v; }
    }
  }

  let effHp = Math.max(1, Math.round((base['hp'] + adds['hp']) * muls['hp']));
  let effAtk = Math.max(1, Math.round((base['atk'] + adds['atk']) * muls['atk']));
  let effDef = Math.max(1, Math.round((base['def'] + adds['def']) * muls['def']));
  let effMag = Math.max(1, Math.round((base['mag'] + adds['mag']) * muls['mag']));
  let effSpd = Math.max(1, Math.round((base['spd'] + adds['spd']) * muls['spd']));
  const effIq = Math.max(1, Math.round(((base['iq'] || 50) + adds['iq']) * muls['iq']));

  const rawCritRate = subBase['crit_rate'] + ((effAtk / 20) * 0.3);
  const cappedBaseCritRate = Math.min(rawCritRate, 80);
  const rawStatusRes = subBase['status_res'] + ((effDef / 20) * 1);
  const cappedBaseStatusRes = Math.min(rawStatusRes, 50);
  const baseHealPow = subBase['heal_pow'] + ((effMag / 15) * 5);
  const baseDex = subBase['dexterity'] + ((effSpd / 10) * 0.5);
  const baseResilience = subBase['resilience'] + ((effHp / 100) * 0.2);
  const baseTrueDmg = subBase['true_dmg'] + ((effHp / 300) * 1);
  const baseLifesteal = subBase['lifesteal'] + ((effDef / 100) * 1);
  const rawCooldownRed = subBase['cooldown_red'] + ((effSpd / 20) * 1);
  const cappedBaseCooldownRed = Math.min(rawCooldownRed, 40);

  const effHealPow = (baseHealPow + adds['heal_pow']) * muls['heal_pow'];
  const effCritRate = (cappedBaseCritRate + adds['crit_rate']) * muls['crit_rate'];
  const finalCritDmg = (subBase['crit_dmg'] + ((effAtk / 50) * 1) + (effCritRate * 0.1) + adds['crit_dmg']) * muls['crit_dmg'];
  const effStatusRes = (cappedBaseStatusRes + adds['status_res']) * muls['status_res'];
  const effDex = (baseDex + adds['dexterity']) * muls['dexterity'];
  let effResilience = (baseResilience + adds['resilience']) * muls['resilience'];
  const effTrueDmg = (baseTrueDmg + adds['true_dmg']) * muls['true_dmg'];
  const effLifesteal = (baseLifesteal + adds['lifesteal']) * muls['lifesteal'];
  const effCooldownRed = (cappedBaseCooldownRed + adds['cooldown_red']) * muls['cooldown_red'];
  effResilience = Math.min(effResilience, 50);

  const traits = formTraits(c);

  // PARADOX: swap the highest and lowest main stats
  if (traits.includes('paradox')) {
    const vals: Record<string, number> = { hp: effHp, atk: effAtk, def: effDef, mag: effMag, spd: effSpd };
    const sorted = Object.entries(vals).map(([name, val]) => ({ name, val })).sort((a, b) => a.val - b.val);
    const lowest = sorted[0].name;
    const highest = sorted[4].name;
    const tempVal = vals[lowest];
    const swapVal = vals[highest];
    const set = (k: string, v: number) => {
      if (k === 'hp') effHp = v; else if (k === 'atk') effAtk = v; else if (k === 'def') effDef = v;
      else if (k === 'mag') effMag = v; else if (k === 'spd') effSpd = v;
    };
    set(lowest, swapVal);
    set(highest, tempVal);
  }

  // GLITCH: stored random multipliers on every main stat
  if (traits.includes('glitch') && c.glitchRolls) {
    const g = c.glitchRolls;
    effHp = Math.max(1, Math.round(effHp * g['hp']));
    effAtk = Math.max(1, Math.round(effAtk * g['atk']));
    effDef = Math.max(1, Math.round(effDef * g['def']));
    effMag = Math.max(1, Math.round(effMag * g['mag']));
    effSpd = Math.max(1, Math.round(effSpd * g['spd']));
  }

  // DETERMINATION: ATK per defeat in HATRED, DEF per spare in MERCYFUL
  if (traits.includes('determination') && c.traitStacks) {
    const stacks = c.traitStacks as Record<string, any>;
    const deaths = stacks['determination:deaths'] || 0;
    const spares = stacks['determination:spares'] || 0;
    const state = stacks['determination:state'] || (stacks['determination:kills'] >= 10 ? 'hatred' : spares >= 10 ? 'mercyful' : 'determined');
    if (state === 'hatred') {
      effAtk = Math.max(1, Math.round(effAtk * (1 + deaths * 0.05)));
      // absorbed enemies add their non-HP main stats
      let absAtk = 0, absDef = 0, absMag = 0, absSpd = 0;
      for (const k in stacks) {
        if (k.indexOf('determination:absorbed_') === 0 && stacks[k]) {
          absAtk += stacks[k].atk || 0;
          absDef += stacks[k].def || 0;
          absMag += stacks[k].mag || 0;
          absSpd += stacks[k].spd || 0;
        }
      }
      effAtk += absAtk; effDef += absDef; effMag += absMag; effSpd += absSpd;
    } else if (state === 'mercyful') {
      effDef = Math.max(1, Math.round(effDef * (1 + spares * 0.05)));
    }
  }

  return {
    hp: effHp, atk: effAtk, def: effDef, mag: effMag, spd: effSpd, iq: effIq,
    heal_pow: effHealPow, crit_rate: effCritRate, crit_dmg: finalCritDmg,
    status_res: effStatusRes, dexterity: effDex, resilience: effResilience,
    true_dmg: effTrueDmg, lifesteal: effLifesteal, cooldown_red: effCooldownRed,
  };
}

/** The stats shown on a sheet: base + items + traits (the old patched getEffectiveStats). */
export function effectiveStats(c: AnyChar): EffectiveStats {
  if (!formTraits(c).length) return baseEffectiveStats(c);
  const passives = buildTraitPassives(c);
  const traitMods = traitPassivesToMods(passives);

  // a synthetic equipped "TRAITS" item carrying every passive mod
  const clone = JSON.parse(JSON.stringify(c)) as AnyChar;
  clone.inventory = clone.inventory || [];
  if (traitMods.length) clone.inventory.push({ id: '_traits_synth', name: '__TRAITS__', mods: traitMods as any, equipped: true });
  const out = baseEffectiveStats(clone);
  const o = out as Record<string, number>;

  // derived bonuses scale off the final main stats
  for (const p of passives.filter(x => x.op === 'derived')) {
    const fromVal = o[p.from as string] != null ? o[p.from as string] : 0;
    if ((MAIN_STATS as readonly string[]).includes(p.stat)) {
      if (p.perPct != null) {
        const pctBonus = Math.floor(fromVal / (p.per || 1)) * p.perPct;
        o[p.stat] = Math.max(1, Math.round(o[p.stat] * (1 + pctBonus / 100)));
      } else {
        let bonus = Math.floor(fromVal / (p.per || 1)) * (p.perValue || 0);
        if (p.cap) bonus = Math.min(bonus, p.cap);
        o[p.stat] = Math.max(1, Math.round(o[p.stat] + bonus));
      }
    } else if ((SUB_STATS as readonly string[]).includes(p.stat)) {
      const pct = Math.floor(fromVal / (p.per || 1)) * (p.perPct || p.perValue || 0);
      o[p.stat] = (o[p.stat] || 0) + pct;
    }
  }

  // resilience: trait add/mul on top, past the base cap of 50, up to 100
  let resAdd = 0, resMul = 1;
  for (const p of passives) {
    if (p.stat !== 'resilience') continue;
    if (p.op === 'add') resAdd += p.value as number;
    else if (p.op === 'pct') resAdd += p.value as number;
    else if (p.op === 'mul') resMul *= p.value as number;
  }
  if (resAdd !== 0 || resMul !== 1) out.resilience = Math.min(100, (out.resilience + resAdd) * resMul);
  return out;
}
