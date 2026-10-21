import { describe, expect, it } from 'vitest';
import type { Character } from '../data/models';
import { adjustStacks, codexSections, cultivationRows, setStacks } from './codex';
import { TRAITS } from './traits-data';

const cultKey = Object.keys(TRAITS).find(k => TRAITS[k].cultivation)!;

describe('codex', () => {
  it('counts seen traits per rarity and groups them by role', () => {
    const someCommon = Object.keys(TRAITS).filter(k => TRAITS[k].rarity === 'common').slice(0, 3);
    const s = codexSections(new Set(someCommon), 0);
    const common = s.find(x => x.rarity === 'common')!;
    expect(common.seen).toBe(3);
    expect(common.total).toBe(Object.values(TRAITS).filter(t => t.rarity === 'common').length);
    expect(common.chance).toBe(60);
    expect(common.groups.flatMap(g => g.traits.map(t => t.key)).sort()).toEqual([...someCommon].sort());
    expect(s.map(x => x.rarity)).toEqual(['common', 'rare', 'epic', 'legendary', 'mythic', 'hexxed', 'duality', 'determined']);
  });

  it('shows fortune-boosted weights', () => {
    expect(codexSections(new Set(), 3).find(x => x.rarity === 'legendary')!.chance).toBe(45);
  });
});

describe('cultivation', () => {
  it('lists cultivation traits and clamps stacks', () => {
    const c: Character = { id: 'c', name: 'C', stats: { hp: 50, atk: 10, def: 10, mag: 10, spd: 10, iq: 50 }, traits: [cultKey] };
    const rows = cultivationRows(c);
    expect(rows.map(r => r.key)).toEqual([cultKey]);
    expect(setStacks(c, cultKey, 99999)).toBe(rows[0].max);
    expect(adjustStacks(c, cultKey, -999999)).toBe(0);
    expect(setStacks(c, cultKey, 'x')).toBe(0);
  });
});
