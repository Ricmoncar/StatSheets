// Parity check against the OLD site: rebuild/tools/gen_stats_fixture.js records
// what the old getEffectiveStats returns for every live character in every
// form; this port must return the same numbers. Skipped when the fixture
// (git-ignored, it holds live data) has not been generated.
import { describe, expect, it } from 'vitest';
import { effectiveStats } from './stats';

const fixturePath = new URL('../../../testing/fixtures/stats.json', import.meta.url);

async function loadFixture(): Promise<any | null> {
  try {
    const fs = await import('node:fs');
    const p = fixturePath.protocol === 'file:' ? fixturePath : new URL('file://' + process.cwd() + '/src/testing/fixtures/stats.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function close(a: number | null, b: number): boolean {
  if (a === null) return Number.isNaN(b);          // JSON turns NaN into null
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b);
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
}

describe('effectiveStats matches the old site', async () => {
  const fx = await loadFixture();
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
