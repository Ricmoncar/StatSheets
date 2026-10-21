// Replays trait picks against the OLD site (rebuild/tools/gen_pick_fixture.js):
// the same pick, form and random numbers must change the character the same way.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { applyPick } from './pick';
import { seededRng } from './roll';

const FIXTURE = 'src/testing/fixtures/picks.json';
const fx = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null;
const FIELDS = ['traits', 'shimmyfulTraits', 'traitTriggers', 'traitStacks', 'dualityState', 'traitHistory', 'altForms'];

describe('applyPick matches the old site', () => {
  it.skipIf(!fx)('for special, cultivation, duality and plain traits, shimmyful or not, on base and alt forms', () => {
    const diffs: string[] = [];
    for (const k of fx.cases) {
      const c = JSON.parse(JSON.stringify(fx.base));
      c.id = 'fixture-' + k.seed;
      applyPick(c, k.formIdx, { key: k.key, shimmyful: k.shimmyful }, seededRng(k.seed), 1700000000000 + k.seed);
      for (const f of FIELDS) {
        if (JSON.stringify(c[f] ?? null) !== JSON.stringify(k.after[f] ?? null)) diffs.push(`${k.key} shimmy=${k.shimmyful} form=${k.formIdx} ${f}`);
      }
    }
    expect(fx.cases.length).toBe(32);
    expect(diffs).toEqual([]);
  });
});
