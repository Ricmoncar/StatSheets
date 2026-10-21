// Taking a trait from a rolled hand. Ported from the old pickTraitFromHand
// (script.js, TRAIT ROLL). The trait REPLACES the form's trait list; a few
// traits grant bonus traits on top. Everything keyed by trait (stacks,
// triggers, duality, history) lives on the character and is shared by forms.
//
// The old code's pools are kept exactly as written, including the shimmyful
// Bravest of the Brave branch, whose "epic" and "rare/epic" pools are both
// legendary traits.

import type { Character } from '../data/models';
import type { HandCard, Rng } from './roll';
import { getShimmyfulDef } from './stats';
import { SHIMMYFUL_LEGENDARY_TRAITS, TRAITS } from './traits-data';

export const TRAIT_HISTORY_MAX = 50;

type TraitOwner = { traits?: string[]; shimmyfulTraits?: string[] };

function pool(pred: (rarity: string) => boolean): string[] {
  return Object.entries(TRAITS).filter(([, t]) => pred(t.rarity as string)).map(([k]) => k);
}
function pickFrom(list: string[], rng: Rng): string {
  return list[Math.floor(rng() * list.length)];
}

/**
 * Applies a picked card to `c` in place (pass a copy). `formIdx` is the form
 * the roll was for (0 = base). Returns the trait keys that are now in the
 * form's list, so the caller can mark them as seen.
 */
export function applyPick(c: Character, formIdx: number, card: HandCard, rng: Rng, now: number): string[] {
  const { key } = card;
  const shimmyful = !!card.shimmyful;
  const tgt: TraitOwner = formIdx > 0 ? ((c.altForms || [])[formIdx - 1] || c) : c;
  tgt.traits = tgt.traits || [];
  tgt.shimmyfulTraits = tgt.shimmyfulTraits || [];

  if (key === 'brave') {
    // BRAVEST OF THE BRAVE: bonus traits
    tgt.traits = ['brave'];
    tgt.shimmyfulTraits = shimmyful ? ['brave'] : [];
    const seen = new Set(['brave']);
    if (shimmyful) {
      const epicPool = pool(r => r === 'legendary');
      const rareEpicPool = pool(r => r === 'legendary' || r === 'legendary');
      let rolledEpic = false;
      while (!rolledEpic) {
        const k = pickFrom(epicPool, rng);
        if (!seen.has(k)) { seen.add(k); tgt.traits.push(k); rolledEpic = true; }
      }
      while (tgt.traits.length < 4) {
        const k = pickFrom(rareEpicPool, rng);
        if (!seen.has(k)) { seen.add(k); tgt.traits.push(k); }
      }
    } else {
      const rareEpicPool = pool(r => r === 'rare' || r === 'epic');
      while (tgt.traits.length < 3) {
        const k = pickFrom(rareEpicPool, rng);
        if (!seen.has(k)) { seen.add(k); tgt.traits.push(k); }
      }
    }
  } else if (key === 'girlyopscurse') {
    tgt.traits = ['girlyopscurse'];
    tgt.shimmyfulTraits = shimmyful ? ['girlyopscurse'] : [];
    const seen = new Set(['girlyopscurse']);
    const commonPool = pool(r => r === 'common');
    const rarePool = pool(r => r === 'rare');
    if (shimmyful) {
      // 3 common and 2 rare, all shimmyful
      while (seen.size < 4) {
        const k = pickFrom(commonPool, rng);
        if (!seen.has(k)) { seen.add(k); tgt.traits.push(k); tgt.shimmyfulTraits.push(k); }
      }
      while (seen.size < 6) {
        const k = pickFrom(rarePool, rng);
        if (!seen.has(k)) { seen.add(k); tgt.traits.push(k); tgt.shimmyfulTraits.push(k); }
      }
    } else {
      // 2 common and 1 rare, each with a 25% chance of being shimmyful
      while (seen.size < 3) {
        const k = pickFrom(commonPool, rng);
        if (!seen.has(k)) { seen.add(k); tgt.traits.push(k); if (rng() < 0.25) tgt.shimmyfulTraits.push(k); }
      }
      while (seen.size < 4) {
        const k = pickFrom(rarePool, rng);
        if (!seen.has(k)) { seen.add(k); tgt.traits.push(k); if (rng() < 0.25) tgt.shimmyfulTraits.push(k); }
      }
    }
  } else if (key === 'onlyatraitor') {
    tgt.traits = ['onlyatraitor'];
    tgt.shimmyfulTraits = shimmyful ? ['onlyatraitor'] : [];
    const seen = new Set(['onlyatraitor']);
    const legPool = pool(r => r === 'legendary');
    const count = shimmyful ? 3 : 2;
    while (tgt.traits.length < count + 1) {
      const k = pickFrom(legPool, rng);
      if (!seen.has(k)) { seen.add(k); tgt.traits.push(k); }
    }
  } else if (key === 'woetothee') {
    tgt.traits = ['woetothee'];
    tgt.shimmyfulTraits = shimmyful ? ['woetothee'] : [];
    const seen = new Set(['woetothee']);
    const legShimmyPool = Object.keys(SHIMMYFUL_LEGENDARY_TRAITS).filter(k => k !== 'woetothee');
    const count = shimmyful ? 2 : 1;
    let added = 0;
    while (added < count) {
      const k = pickFrom(legShimmyPool, rng);
      if (!seen.has(k) && TRAITS[k]) {
        seen.add(k);
        tgt.traits.push(k);
        if (!tgt.shimmyfulTraits.includes(k)) tgt.shimmyfulTraits.push(k);
        added++;
      }
    }
  } else {
    tgt.traits = [key];
    tgt.shimmyfulTraits = shimmyful ? [key] : [];
    if (TRAITS[key]?.rarity === 'duality') {
      c.dualityState = c.dualityState || {};
      (c.dualityState as Record<string, unknown>)[key] = 'heavenly';
    }
    if (key === 'determination') {
      c.traitStacks = c.traitStacks || {};
      c.traitStacks['determination:kills'] = 0;
      c.traitStacks['determination:deaths'] = 0;
      c.traitStacks['determination:spares'] = 0;
    }
  }

  // re-seed only what this pick touches: stacks are shared across forms
  c.traitTriggers = c.traitTriggers || {};
  c.traitStacks = c.traitStacks || {};
  for (const k of tgt.traits) {
    delete (c.traitTriggers as Record<string, unknown>)[k];
    const t = TRAITS[k];
    if (t?.cultivation) c.traitStacks[k] = t.cultivation.defaultStacks || 0;
  }

  const tDef = TRAITS[key];
  if (tDef) {
    c.traitHistory = c.traitHistory || [];
    const sd = shimmyful ? getShimmyfulDef(key) : null;
    c.traitHistory.unshift({ key, name: sd ? sd.name : tDef.name, rarity: tDef.rarity as string, shimmyful, ts: now });
    if (c.traitHistory.length > TRAIT_HISTORY_MAX) c.traitHistory.length = TRAIT_HISTORY_MAX;
  }
  return [...tgt.traits];
}

/** The toast after taking a trait, e.g. "LEGENDARY: Blood Moon!". */
export function pickMessage(card: HandCard, rarityLabel: Record<string, string>): string {
  const tDef = TRAITS[card.key];
  const sd = card.shimmyful ? getShimmyfulDef(card.key) : null;
  return `${rarityLabel[tDef?.rarity as string]}: ${sd ? sd.name : tDef?.name}!`;
}
