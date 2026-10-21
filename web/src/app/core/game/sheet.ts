// Numbers on a character sheet: segmented stat bars with prestige tiers, power
// levels, accent presets, and gold. Ported from the old script.js (COLOR
// PRESETS, STAT SEGMENTS HELPER, POWER LEVEL AUTO-CALC, GOLD / TREASURY).

import type { Character, GoldEntry } from '../data/models';
import type { EffectiveStats } from './stats';

/** The 16 accent colour presets offered in the editor, in order. */
export const COLOR_PRESETS = [
  '#ffff00', '#ff0000', '#00ff80', '#00ffff', '#ff8000', '#ff80ff',
  '#8000ff', '#ffffff', '#0080ff', '#ff4040', '#80ff00', '#40ffff',
  '#ff6600', '#cc00cc', '#00cc66', '#6666ff',
];

// ── stat bars ──────────────────────────────────────────────────
export const SEG_COUNT = 20;
/** One full bar is worth this much; past it the bar starts a prestige tier. */
export const STAT_BASE_MAX: Record<string, number> = { hp: 999, atk: 99, def: 99, mag: 99, spd: 99, iq: 150 };
/** Hard caps (top of Mountain level). */
export const STAT_HARD_MAX: Record<string, number> = { hp: 1250, atk: 300, def: 300, mag: 300, spd: 300, iq: 500 };
/** Tier colour classes stop at this tier. */
export const MAX_TIER_STYLE = 25;

export interface Segment {
  /** 0 to 100: how much of this segment is filled */
  fill: number;
  /** the last filled segment */
  peak: boolean;
  /** tier whose colour the fill takes (0 = base colours) */
  fillTier: number;
  /** tier whose solid colour shows behind the fill (-1 = empty ghost, 0 = base colour) */
  backTier: number;
}

export interface BarModel {
  /** 0 on the first bar; 1 and up are prestige tiers ("[T1]") */
  tier: number;
  segments: Segment[];
}

/** The old _renderStatSegsFrame as data: what each of the 20 segments shows for a value. */
export function statBar(val: number, key: string): BarModel | null {
  const baseMax = STAT_BASE_MAX[key];
  if (!baseMax) return null;
  const tier = Math.floor((val - 1) / baseMax);
  const valInTier = ((val - 1) % baseMax) + 1;
  const pct = valInTier / baseMax * 100;
  const exactFilled = Math.max(0, Math.min(100, pct)) / 100 * SEG_COUNT;
  const fullFilled = Math.floor(exactFilled);
  const segments: Segment[] = [];
  for (let i = 0; i < SEG_COUNT; i++) {
    let fill = 0;
    if (i < fullFilled) fill = 100;
    else if (i === fullFilled) fill = (exactFilled - fullFilled) * 100;
    const peak = i === Math.ceil(exactFilled) - 1 && exactFilled > 0;
    const on = fill > 0;
    if (tier === 0) {
      segments.push({ fill, peak: on && peak, fillTier: 0, backTier: -1 });
    } else {
      // prestige tiers stack on top of the previous tier's solid colour
      segments.push({
        fill,
        peak: on && peak,
        fillTier: on ? Math.min(tier, MAX_TIER_STYLE) : 0,
        backTier: tier > 1 ? Math.min(tier - 1, MAX_TIER_STYLE) : 0,
      });
    }
  }
  return { tier, segments };
}

/** "[T3]" for prestige tiers, nothing on the first bar. */
export function tierLabel(tier: number): string {
  return tier > 0 ? `[T${tier}]` : '';
}

// ── power level ───────────────────────────────────────────────
export interface PlTier { label: string; short: string; color: string }

export const PL_TIERS: PlTier[] = [
  { label: 'BELOW HUMAN', short: '< HUMAN', color: '#555555' },
  { label: 'HUMAN', short: 'HUMAN', color: '#888888' },
  { label: 'ATHLETE', short: 'ATHLETE', color: '#88ccff' },
  { label: 'STREET', short: 'STREET', color: '#88ffaa' },
  { label: 'WALL', short: 'WALL', color: '#ffff88' },
  { label: 'BUILDING', short: 'BUILDING', color: '#ffcc44' },
  { label: 'CITY', short: 'CITY', color: '#ff8844' },
  { label: 'MOUNTAIN', short: 'MOUNTAIN', color: '#ff4444' },
  { label: 'ISLAND', short: 'ISLAND', color: '#ff2200' },
  { label: 'COUNTRY', short: 'COUNTRY', color: '#ff0088' },
  { label: 'CONTINENT', short: 'CONTINENT', color: '#dd00dd' },
  { label: 'PLANETARY', short: 'PLANETARY', color: '#aa00ff' },
  { label: 'STELLAR', short: 'STELLAR', color: '#6600ff' },
  { label: 'GALACTIC', short: 'GALACTIC', color: '#0044ff' },
  { label: 'UNIVERSAL', short: 'UNIVERSAL', color: '#00aaff' },
  { label: 'MULTIVERSAL', short: 'MULTI', color: '#00ffee' },
  { label: 'OMNIVERSAL', short: 'OMNI', color: '#ffffff' },
];

/** Minimum value to reach each tier (the power level reference modal uses the same numbers). */
export const PL_THRESHOLDS: Record<string, number[]> = {
  hp: [1, 25, 50, 100, 225, 350, 500, 850, 1300, 2200, 3500, 6000, 12000, 25000, 55000, 120000, 300000],
  atk: [1, 5, 15, 30, 50, 70, 125, 200, 275, 400, 600, 900, 1500, 3000, 6000, 12000, 25000],
  def: [1, 5, 15, 30, 50, 70, 125, 200, 275, 400, 600, 900, 1500, 3000, 6000, 12000, 25000],
  mag: [1, 5, 15, 30, 50, 70, 125, 200, 275, 400, 600, 900, 1500, 3000, 6000, 12000, 25000],
  spd: [1, 5, 15, 30, 50, 70, 125, 200, 275, 400, 600, 900, 1500, 3000, 6000, 12000, 25000],
  iq: [1, 10, 30, 50, 80, 110, 140, 175, 210, 250, 300, 350, 400, 440, 470, 490, 500],
};

export function statPowerLevel(stat: string, value: number): number {
  const thresholds = PL_THRESHOLDS[stat] || PL_THRESHOLDS['atk'];
  let tier = 0;
  for (let i = 0; i < thresholds.length; i++) if (value >= thresholds[i]) tier = i;
  return tier;
}

const PL_STATS = ['hp', 'atk', 'def', 'mag', 'spd'] as const;

/** Overall power level: the average of the five combat stats' tiers, rounded down. */
export function overallPowerLevel(eff: Pick<EffectiveStats, typeof PL_STATS[number]>): PlTier {
  let total = 0;
  for (const s of PL_STATS) total += statPowerLevel(s, eff[s] || 0);
  return PL_TIERS[Math.min(Math.floor(total / PL_STATS.length), PL_TIERS.length - 1)];
}

// ── gold ──────────────────────────────────────────────────────
export const GOLD_HISTORY_MAX = 200;

/** Rounded, with thousands separators in the viewer's locale; negative balances keep their sign. */
export function formatGold(n: number): string {
  const v = Math.round(n);
  return (v < 0 ? '-' : '') + Math.abs(v).toLocaleString();
}

/**
 * Adds (direction 1) or removes (direction -1) gold. Amounts are floored;
 * zero, negative and non-numbers are refused. The balance may go negative.
 * The newest entry goes first and the history keeps the latest 200.
 */
export function transactGold(
  c: Pick<Character, 'gold' | 'goldHistory'>,
  direction: 1 | -1,
  rawAmount: string | number,
  note: string,
  now: number,
): { gold: number; goldHistory: GoldEntry[] } | { error: string } {
  const raw = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);
  if (isNaN(raw) || raw <= 0) return { error: 'ENTER A VALID AMOUNT' };
  const amount = Math.floor(raw);
  const gold = (c.gold || 0) + direction * amount;
  const entry: GoldEntry = {
    amount: direction * amount,
    note: note.trim() || (direction > 0 ? 'Added' : 'Removed'),
    ts: now,
    balance: gold,
  };
  return { gold, goldHistory: [entry, ...(c.goldHistory || [])].slice(0, GOLD_HISTORY_MAX) };
}
