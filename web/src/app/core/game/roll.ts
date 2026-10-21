// Trait rolls: rarity odds, pity, fortune, and dealing a hand of three.
// Ported from the old script.js (RARITIES, FORTUNE, rollRarity, rollOneTrait,
// rollHand, and the pity bookkeeping in rollTraitsFor). Randomness comes in as
// a function so the port can be replayed against the old code with the same
// sequence of numbers.

import { TRAITS } from './traits-data';

export type Rng = () => number;
export type Weights = Record<string, number>;

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic', 'hexxed', 'duality', 'determined'] as const;
export const RARITY_LABEL: Record<string, string> = {
  common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY', mythic: 'MYTHIC',
  hexxed: 'HEXXED', duality: 'DUALITY', determined: 'DETERMINED',
};

export const RARITY_WEIGHTS: Weights = { common: 60, rare: 30, epic: 18.4, legendary: 1.5, mythic: 0.13, hexxed: 0.02, duality: 0.01, determined: 0.005 };
/** Odds on the 100th roll: legendary or better guaranteed. */
export const PITY_WEIGHTS: Weights = { common: 0, rare: 0, epic: 0, legendary: 68.9, mythic: 25, hexxed: 1, duality: 5, determined: 0.1 };

/** Unseen traits are this much likelier within their rarity. */
export const UNSEEN_MULT = 1.5;

/** Chance a dealt trait is SHIMMYFUL, by rarity. */
export const SHIMMY_CHANCE: Record<string, number> = { common: 0.01, rare: 0.01, epic: 0.01, legendary: 0.05, mythic: 0.10 };

// FORTUNE: local luck, unlocked by a code on a page nothing links to. It lives
// in this browser only and is shown on the roll overlay, so a rigged roll
// never looks like a fair one.
export const FORTUNE_KEY = 'ss_fortune';
export const SHIMMY_ALL_KEY = 'ss_shimmy_all';
export const FORTUNE_TIERS: Record<number, Weights> = {
  1: { legendary: 6, mythic: 12, hexxed: 20, duality: 25 },
  2: { legendary: 14, mythic: 40, hexxed: 80, duality: 100 },
  3: { legendary: 30, mythic: 120, hexxed: 300, duality: 400 },
};

export interface Fortune {
  /** 0 to 3 */
  level: number;
  /** force every eligible trait to be shimmyful */
  shimmyAll: boolean;
}

export function readFortune(storage: Pick<Storage, 'getItem'> | null): Fortune {
  let level = 0, shimmyAll = false;
  try { level = Math.max(0, Math.min(3, parseInt(storage?.getItem(FORTUNE_KEY) ?? '', 10) || 0)); } catch { /* storage blocked */ }
  try { shimmyAll = storage?.getItem(SHIMMY_ALL_KEY) === '1'; } catch { /* storage blocked */ }
  return { level, shimmyAll };
}

/** The odds a normal roll uses right now. */
export function activeRarityWeights(fortune: number): Weights {
  const mult = FORTUNE_TIERS[fortune];
  if (!mult) return RARITY_WEIGHTS;
  const w = { ...RARITY_WEIGHTS };
  for (const k in mult) w[k] = +(RARITY_WEIGHTS[k] * mult[k]).toFixed(4);
  return w;
}

export function fortuneLabel(f: Fortune): string {
  const bits: string[] = [];
  if (f.level) bits.push('FORTUNE ' + 'I'.repeat(f.level));
  if (f.shimmyAll) bits.push('SHIMMYFUL');
  return bits.join(' + ');
}

export function rollRarity(weights: Weights, rng: Rng): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [k, wt] of Object.entries(weights)) {
    if (r < wt) return k;
    r -= wt;
  }
  return Object.keys(weights).find(k => weights[k] > 0) || 'common';
}

export function rollOneTrait(rarityOverride: string | null, weights: Weights, seen: ReadonlySet<string>, rng: Rng): string {
  const rarity = rarityOverride || rollRarity(weights, rng);
  const pool = Object.entries(TRAITS).filter(([, t]) => t.rarity === rarity);
  if (!pool.length) return rollOneTrait('common', RARITY_WEIGHTS, seen, rng);
  const weighted = pool.map(([key]) => ({ key, w: seen.has(key) ? 1 : UNSEEN_MULT }));
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  for (const { key, w } of weighted) {
    if (r < w) return key;
    r -= w;
  }
  return weighted[weighted.length - 1].key;
}

export interface HandCard {
  key: string;
  shimmyful: boolean;
}

/** Three different traits (up to 50 draws), each possibly shimmyful. */
export function rollHand(isPityRoll: boolean, fortune: Fortune, seen: ReadonlySet<string>, rng: Rng): HandCard[] {
  const weights = isPityRoll ? PITY_WEIGHTS : activeRarityWeights(fortune.level);
  const dealt = new Set<string>();
  const hand: HandCard[] = [];
  let tries = 0;
  while (hand.length < 3 && tries < 50) {
    const k = rollOneTrait(null, weights, seen, rng);
    if (!dealt.has(k)) {
      dealt.add(k);
      const rarity = TRAITS[k]?.rarity as string;
      const chance = SHIMMY_CHANCE[rarity];
      // the old code tested the rarities in this order and drew a number only for the matching one
      const shimmyful = chance != null && rng() < (fortune.shimmyAll ? 1 : chance);
      hand.push({ key: k, shimmyful });
    }
    tries++;
  }
  return hand;
}

/** Pity after starting a roll: +1, capped at 100; the 100th roll is the pity roll. */
export function pityBeforeRoll(pity: number): { pity: number; isPityRoll: boolean } {
  const next = Math.min(Math.max(0, Math.min(100, pity || 0)) + 1, 100);
  return { pity: next, isPityRoll: next >= 100 };
}

/** Pity once the hand is revealed: reset by a pity roll or a hexxed card, -80 for mythic, -25 for legendary. */
export function pityAfterRoll(pity: number, hand: HandCard[], isPityRoll: boolean): number {
  if (isPityRoll) return 0;
  const rarities = hand.map(h => TRAITS[h.key].rarity);
  if (rarities.includes('hexxed')) return 0;
  if (rarities.includes('mythic')) return Math.max(0, pity - 80);
  if (rarities.includes('legendary')) return Math.max(0, pity - 25);
  return pity;
}

/** Small deterministic generator for replaying rolls in tests (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
