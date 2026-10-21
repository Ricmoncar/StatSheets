// Parity check against the OLD site: rebuild/tools/gen_tooltip_fixture.js
// records the old stat breakdowns and trait tooltips for every live
// character; these must read the same. Skipped without the (git-ignored)
// fixture.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { statBreakdown, traitTip } from './breakdown';

const FIXTURE = 'src/testing/fixtures/tooltips.json';
type Parsed = { title: string; lines: [string, string][]; notes: string[] };

describe('tooltips match the old site', () => {
  const fx = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null;

  it.skipIf(!fx)('stat breakdowns, for every live character', () => {
    const bad: string[] = [];
    let n = 0;
    for (const c of fx.chars) {
      const base = { ...c, activeFormIdx: 0 };
      for (const [stat, old] of Object.entries(fx.breakdowns[c.id] as Record<string, Parsed>)) {
        const tip = statBreakdown(base, stat);
        const lines = [...tip.lines.map(l => [l.label, l.value]), [tip.total!.label, tip.total!.value]];
        n++;
        if (tip.title !== old.title || JSON.stringify(lines) !== JSON.stringify(old.lines)) {
          bad.push(`${c.name} ${stat}: old ${JSON.stringify(old.lines)} new ${JSON.stringify(lines)}`);
        }
      }
    }
    expect(n).toBeGreaterThan(500);
    expect(bad).toEqual([]);
  });

  it.skipIf(!fx)('trait tooltips, for every trait in every form', () => {
    const bad: string[] = [];
    let n = 0;
    for (const c of fx.chars) {
      for (const [form, tips] of Object.entries(fx.traits[c.id] as Record<string, Record<string, Parsed>>)) {
        const clone = { ...JSON.parse(JSON.stringify(c)), activeFormIdx: Number(form) };
        for (const [key, old] of Object.entries(tips)) {
          const tip = traitTip(clone, key)!;
          n++;
          const lines = tip.lines.map(l => [l.label, l.value]);
          if (tip.title !== old.title) bad.push(`${c.name}/${form} ${key} title: old ${old.title} new ${tip.title}`);
          if (JSON.stringify(lines) !== JSON.stringify(old.lines)) bad.push(`${c.name}/${form} ${key} lines: old ${JSON.stringify(old.lines)} new ${JSON.stringify(lines)}`);
          if (JSON.stringify(tip.notes) !== JSON.stringify(old.notes)) bad.push(`${c.name}/${form} ${key} notes: old ${JSON.stringify(old.notes)} new ${JSON.stringify(tip.notes)}`);
        }
      }
    }
    expect(n).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });
});
