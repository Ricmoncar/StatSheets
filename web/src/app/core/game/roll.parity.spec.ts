// Replays rolls against the OLD site: rebuild/tools/gen_roll_fixture.js records
// the hands the old rollHand deals from seeded random numbers; the port must
// deal the same hands from the same seeds. Skipped without the fixture.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { pityAfterRoll, pityBeforeRoll, rollHand, seededRng } from './roll';

const FIXTURE = 'src/testing/fixtures/rolls.json';
const fx = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null;

describe('rollHand matches the old site', () => {
  it.skipIf(!fx)('deals the same hand from the same random numbers', () => {
    const seen = new Set<string>(fx.seen);
    const diffs: string[] = [];
    for (const c of fx.cases) {
      const got = rollHand(c.isPity, { level: c.fortune, shimmyAll: c.shimmyAll }, seen, seededRng(c.seed));
      if (JSON.stringify(got) !== JSON.stringify(c.hand)) diffs.push(`seed ${c.seed}: old ${JSON.stringify(c.hand)} new ${JSON.stringify(got)}`);
    }
    expect(fx.cases.length).toBe(400);
    expect(diffs).toEqual([]);
  });
});

describe('pity', () => {
  it('counts up to a pity roll on the 100th', () => {
    expect(pityBeforeRoll(0)).toEqual({ pity: 1, isPityRoll: false });
    expect(pityBeforeRoll(98)).toEqual({ pity: 99, isPityRoll: false });
    expect(pityBeforeRoll(99)).toEqual({ pity: 100, isPityRoll: true });
    expect(pityBeforeRoll(250)).toEqual({ pity: 100, isPityRoll: true });
  });
  it('resets or drops by what the hand held', () => {
    expect(pityAfterRoll(100, [], true)).toBe(0);
    expect(pityAfterRoll(50, [{ key: 'favored', shimmyful: false }], false)).toBe(50);
  });
});
