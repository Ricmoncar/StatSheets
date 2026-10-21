// Replays trait-card actions against the OLD site
// (rebuild/tools/gen_trait_actions_fixture.js): the same steps with the same
// random numbers must leave the character in the same state after every step.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as A from './trait-actions';
import { seededRng } from './roll';
import { effectiveStats, getTraitDef } from './stats';
import { TRAITS } from './traits-data';

const FIXTURE = 'src/testing/fixtures/trait-actions.json';
const fx = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null;
const FIELDS = ['traits', 'shimmyfulTraits', 'traitStacks', 'traitTriggers', 'dualityState', 'perfectSoulData',
  'missingNoRolls', 'glitchRolls', 'thousandDoorsAccum', 'thousandDoorsHistory', 'drunkStats'];

describe('trait-card actions match the old site', () => {
  it.skipIf(!fx)('after every step of every scenario', () => {
    const diffs: string[] = [];
    for (const k of fx.cases) {
      const c = JSON.parse(JSON.stringify(k.start));
      const rng = seededRng(k.seed);
      k.steps.forEach((step: string, i: number) => {
        const [op, a, b] = step.split(':');
        const other = fx.others[+a];
        if (op === 'missingNo') A.rollMissingNo(c, rng);
        else if (op === 'glitch') A.rollGlitch(c, rng);
        else if (op === 'doors') A.rollThousandDoors(c, rng);
        else if (op === 'doorsUndo') A.undoThousandDoors(c);
        else if (op === 'doorsReset') A.resetThousandDoors(c);
        else if (op === 'drunk') A.rollAnotherAndAnother(c, a as 'atkmag' | 'defhp', rng);
        else if (op === 'soul') A.absorbSoul(c, other, rng);
        else if (op === 'soulRemove') A.removeSoul(c, +a);
        else if (op === 'soulUndo') A.undoSoul(c);
        else if (op === 'soulReset') A.resetSouls(c);
        else if (op === 'capitalist') A.toggleCapitalist(c);
        else if (op === 'det') A.adjustDetermination(c, k.key, a as 'kills' | 'deaths' | 'spares', +b);
        else if (op === 'detState') A.setDeterminationState(c, a as 'hatred' | 'mercyful' | 'determined');
        else if (op === 'detAbsorb') A.absorbCharacter(c, other, effectiveStats(other));
        else if (op === 'detRemove') A.removeAbsorbed(c, other.id);
        else if (op === 'duality') A.toggleDuality(c, k.key);
        else if (op === 'trigger') {
          const state = ((c.dualityState || {})[k.key] || 'heavenly').toUpperCase();
          const sit = (getTraitDef(c, k.key)!.situational || []).find((s: any) => s.passive?.length && (!String(TRAITS[k.key].rarity).includes('duality') || s.label.startsWith(state)));
          A.toggleTrigger(c, k.key + ':' + sit!.id);
        } else if (op === 'remove') A.removeTrait(c, k.key);
        for (const f of FIELDS) {
          if (JSON.stringify(c[f] ?? null) !== JSON.stringify(k.after[i][f] ?? null)) diffs.push(`${k.key} shimmy=${k.shimmy} step ${i} (${step}) ${f}: old ${JSON.stringify(k.after[i][f])} new ${JSON.stringify(c[f])}`);
        }
      });
    }
    expect(fx.cases.length).toBe(26);
    expect(diffs).toEqual([]);
  });
});
