// Parity check against the OLD site: rebuild/tools/gen_stats_fixture.js records
// what the old getEffectiveStats returns for every live character in every
// form; this port must return the same numbers. Skipped when the fixture
// (git-ignored, it holds live data) has not been generated.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { effectiveStats } from './stats';

const FIXTURE = 'src/testing/fixtures/stats.json';

function close(a: number | null, b: number): boolean {
  if (a === null) return Number.isNaN(b);          // JSON turns NaN into null
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b);
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
}

describe('effectiveStats matches the old site', () => {
  const fx = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null;
  it.skipIf(!fx)('for every live character in every form', () => {
    const mismatches: string[] = [];
    let cases = 0;
    for (const c of fx.chars) {
      for (const [form, expected] of Object.entries(fx.results[c.id] as Record<string, Record<string, number | null>>)) {
        const clone = JSON.parse(JSON.stringify(c));
        clone.activeFormIdx = Number(form);
        const got = effectiveStats(clone) as Record<string, number>;
        cases++;
        for (const [k, v] of Object.entries(expected)) {
          if (!close(v, got[k])) mismatches.push(`${c.name} form ${form} ${k}: old ${v}, new ${got[k]}`);
        }
      }
    }
    expect(cases).toBeGreaterThan(100);
    expect(mismatches).toEqual([]);
  });
});
