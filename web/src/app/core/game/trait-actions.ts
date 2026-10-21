// What the buttons on trait cards do. Each function changes the character it
// is given (pass the copy from CharacterStore.update) and returns what the
// caller needs for its toast. Ported from the old script.js (TRAIT ROLL and
// RENDER TRAITS sections): toggleTraitTrigger, toggleDuality,
// adjustDetermination, setDeterminationState, absorbCharacterStats,
// removeAbsorbedStats, rollMissingNo, rollGlitch, rollThousandDoors (+undo,
// reset), rollAnotherandAnother, the I WANT A PERFECT SOUL absorber,
// toggleCapitalistTrait and removeTrait.

import type { Character } from '../data/models';
import type { Rng } from './roll';
import { EffectiveStats, isShimmyful, traitOwner } from './stats';

type C = Character & Record<string, any>;
const FIVE = ['hp', 'atk', 'def', 'mag', 'spd'] as const;
const HISTORY_MAX = 20;

const stacks = (c: C): Record<string, any> => (c.traitStacks = c.traitStacks || {}) as Record<string, any>;
const triggers = (c: C): Record<string, any> => (c.traitTriggers = c.traitTriggers || {}) as Record<string, any>;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Situational scenario on or off ("key:situationId"). */
export function toggleTrigger(c: C, triggerKey: string): void {
  const t = triggers(c);
  t[triggerKey] = !t[triggerKey];
}

/** HEAVENLY <-> HELLFORGED; the trait's active scenarios are switched off. */
export function toggleDuality(c: C, key: string): 'heavenly' | 'hellforged' {
  c.dualityState = c.dualityState || {};
  const ds = c.dualityState as Record<string, string>;
  const next = (ds[key] || 'heavenly') === 'heavenly' ? 'hellforged' : 'heavenly';
  const t = c.traitTriggers as Record<string, unknown> | undefined;
  if (t) for (const tk of Object.keys(t)) if (tk.startsWith(key + ':')) delete t[tk];
  ds[key] = next;
  return next;
}

/** DETERMINATION counters: kills and spares stop at 10, defeats at 9999, none below 0. */
export function adjustDetermination(c: C, key: string, counter: 'kills' | 'deaths' | 'spares', delta: number): void {
  const s = stacks(c);
  const k = key + ':' + counter;
  const max = counter === 'kills' || counter === 'spares' ? 10 : 9999;
  s[k] = Math.max(0, Math.min(max, (s[k] || 0) + delta));
}

/** Force HATRED or MERCYFUL, or go back to DETERMINED (which clears all three counters). */
export function setDeterminationState(c: C, state: 'hatred' | 'mercyful' | 'determined'): void {
  const s = stacks(c);
  if (state === 'determined') {
    delete s['determination:state'];
    s['determination:kills'] = 0;
    s['determination:deaths'] = 0;
    s['determination:spares'] = 0;
  } else {
    s['determination:state'] = state;
  }
}

/** HATRED: absorb another character's non-HP main stats (once per character); counts as a kill. */
export function absorbCharacter(c: C, target: Character, targetEff: EffectiveStats): 'absorbed' | 'already' {
  const s = stacks(c);
  const k = `determination:absorbed_${target.id}`;
  if (s[k]) return 'already';
  s[k] = { name: target.name, atk: targetEff.atk, def: targetEff.def, mag: targetEff.mag, spd: targetEff.spd };
  s['determination:kills'] = (s['determination:kills'] || 0) + 1;
  return 'absorbed';
}

/** Undo one absorb (and one kill, never below 0). Returns the absorbed name, or null. */
export function removeAbsorbed(c: C, targetId: string): string | null {
  const s = c.traitStacks as Record<string, any> | undefined;
  const k = `determination:absorbed_${targetId}`;
  if (!s || !s[k]) return null;
  const name = s[k].name || 'CHARACTER';
  delete s[k];
  s['determination:kills'] = Math.max(0, (s['determination:kills'] || 0) - 1);
  return String(name);
}

/** MISSING NO.: x0.5 to x3 on each stat; SHIMMYFUL x0.25 to x5.5 with one stat set to x3. */
export function rollMissingNo(c: C, rng: Rng): void {
  const rolls: Record<string, number> = {};
  if (isShimmyful(c, 'missingno')) {
    FIVE.forEach(s => { rolls[s] = round2(0.25 + rng() * (5.5 - 0.25)); });
    rolls[FIVE[Math.floor(rng() * FIVE.length)]] = 3.0;
  } else {
    FIVE.forEach(s => { rolls[s] = round2(0.5 + rng() * (3.0 - 0.5)); });
  }
  c['missingNoRolls'] = rolls;
}

/** GLITCH: x0.01 to x20 on each stat (x30 SHIMMYFUL). */
export function rollGlitch(c: C, rng: Rng): void {
  const maxVal = isShimmyful(c, 'glitch') ? 30 : 20;
  const rolls: Record<string, number> = {};
  FIVE.forEach(s => { rolls[s] = round2(0.01 + rng() * (maxVal - 0.01)); });
  c['glitchRolls'] = rolls;
}

/** AT THOUSAND DOORS: one random stat's multiplier compounds by x0.75-1.75 (SHIMMYFUL x0.5-2.5, biased up). 20 undo steps. */
export function rollThousandDoors(c: C, rng: Rng): void {
  const s = FIVE[Math.floor(rng() * FIVE.length)];
  let mult: number;
  if (isShimmyful(c, 'thousanddoors')) {
    const raw = 0.5 + rng() * 2.0;
    mult = rng() < 0.3 ? raw + 0.3 : raw;
    mult = Math.max(0.5, Math.min(2.5, mult));
  } else {
    mult = 0.75 + rng() * 1.0;
  }
  mult = round2(mult);
  c['thousandDoorsAccum'] = c['thousandDoorsAccum'] || {};
  c['thousandDoorsHistory'] = c['thousandDoorsHistory'] || [];
  c['thousandDoorsHistory'].push({ ...c['thousandDoorsAccum'] });
  if (c['thousandDoorsHistory'].length > HISTORY_MAX) c['thousandDoorsHistory'].shift();
  c['thousandDoorsAccum'][s] = round2((c['thousandDoorsAccum'][s] || 1) * mult);
}

export function undoThousandDoors(c: C): boolean {
  const h = c['thousandDoorsHistory'];
  if (!h || !h.length) return false;
  c['thousandDoorsAccum'] = h.pop();
  return true;
}

export function resetThousandDoors(c: C): void {
  c['thousandDoorsHistory'] = c['thousandDoorsHistory'] || [];
  const acc = c['thousandDoorsAccum'];
  if (acc && Object.keys(acc).length) {
    c['thousandDoorsHistory'].push({ ...acc });
    if (c['thousandDoorsHistory'].length > HISTORY_MAX) c['thousandDoorsHistory'].shift();
  }
  c['thousandDoorsAccum'] = {};
}

/** ANOTHER, AND ANOTHER: reroll ATK and MAG, or DEF and HP, x0.1 to x10 skewed low (x15 SHIMMYFUL). */
export function rollAnotherAndAnother(c: C, type: 'atkmag' | 'defhp', rng: Rng): void {
  const maxVal = isShimmyful(c, 'anotherandanother') ? 15.0 : 10.0;
  c['drunkStats'] = c['drunkStats'] || {};
  const r = () => round2(0.1 + Math.pow(rng(), 2) * (maxVal - 0.1));
  if (type === 'atkmag') { c['drunkStats'].atk = r(); c['drunkStats'].mag = r(); }
  else { c['drunkStats'].def = r(); c['drunkStats'].hp = r(); }
}

type SoulData = { souls: { name: string; pct: number; stats: Record<string, number> }[]; history: { souls: unknown[] }[] };
function souls(c: C): SoulData {
  const d = (c.perfectSoulData = c.perfectSoulData || { souls: [], history: [] }) as SoulData;
  d.history = d.history || [];
  d.souls = d.souls || [];
  return d;
}
function pushSoulHistory(d: SoulData): void {
  d.history.push({ souls: JSON.parse(JSON.stringify(d.souls)) });
  if (d.history.length > HISTORY_MAX) d.history.shift();
}

/** I WANT A PERFECT SOUL: absorb 40-80% (55-90% SHIMMYFUL) of a character's base stats. Returns the percentage. */
export function absorbSoul(c: C, target: Character, rng: Rng): number {
  const pct = isShimmyful(c, 'perfectsoul') ? Math.round(55 + rng() * 35) : Math.round(40 + rng() * 40);
  const ts = (target.stats || {}) as Record<string, number>;
  const absorbed: Record<string, number> = {};
  FIVE.forEach(k => { absorbed[k] = Math.round((ts[k] || 0) * pct / 100); });
  const d = c.perfectSoulData = c.perfectSoulData || { souls: [], history: [] };
  d.history = d.history || [];
  d.history.push({ souls: JSON.parse(JSON.stringify(d.souls || [])) });
  if (d.history.length > HISTORY_MAX) d.history.shift();
  d.souls = d.souls || [];
  d.souls.push({ name: target.name, pct, stats: absorbed });
  return pct;
}

export function undoSoul(c: C): boolean {
  const d = c.perfectSoulData as SoulData | undefined;
  if (!d || !d.history || !d.history.length) return false;
  d.souls = ((d.history.pop() || {}) as SoulData).souls || [];
  return true;
}

export function resetSouls(c: C): void {
  const d = souls(c);
  if (d.souls.length) pushSoulHistory(d);
  d.souls = [];
}

export function removeSoul(c: C, idx: number): boolean {
  const d = c.perfectSoulData as SoulData | undefined;
  if (!d || !d.souls || idx < 0 || idx >= d.souls.length) return false;
  d.history = d.history || [];
  pushSoulHistory(d);
  d.souls.splice(idx, 1);
  return true;
}

/** CAPITALIST on or off; the multiplier is treasury / 90000. */
export function toggleCapitalist(c: C): { active: boolean; multiplier: number; gold: number } {
  const gold = Math.max(0, Number(c.gold || 0));
  const multiplier = Math.max(0, gold / 90000);
  const s = stacks(c);
  if (s['capitalist:active']) { delete s['capitalist:active']; return { active: false, multiplier, gold }; }
  s['capitalist:active'] = true;
  return { active: true, multiplier, gold };
}

/** Removes a trait from the form on screen, with the state that belongs to it. */
export function removeTrait(c: C, key: string): void {
  const own = traitOwner(c);
  own.traits = (own.traits || []).filter(k => k !== key);
  own.shimmyfulTraits = (own.shimmyfulTraits || []).filter(k => k !== key);
  if (c.dualityState) delete (c.dualityState as Record<string, unknown>)[key];
  if (key === 'missingno') delete c['missingNoRolls'];
  if (key === 'glitch') delete c['glitchRolls'];
  if (key === 'thousanddoors') { delete c['thousandDoorsAccum']; delete c['thousandDoorsHistory']; }
  if (key === 'perfectsoul') delete c.perfectSoulData;
  if (key === 'anotherandanother') { delete c['drunkStats']; delete c['drunkCount']; }
  const t = c.traitTriggers as Record<string, unknown> | undefined;
  if (t) for (const tk of Object.keys(t)) if (tk.startsWith(key + ':')) delete t[tk];
  const s = c.traitStacks as Record<string, unknown> | undefined;
  if (s) { delete s[key]; delete s[key + ':kills']; delete s[key + ':deaths']; delete s[key + ':spares']; }
}
