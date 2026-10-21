import { describe, expect, it } from 'vitest';
import { overallPowerLevel, statBar, statPowerLevel, tierLabel, transactGold } from './sheet';

describe('statBar', () => {
  it('fills a first bar proportionally with a peak segment', () => {
    const b = statBar(50, 'atk')!;           // 50 of 99 = 10.101 segments
    expect(b.tier).toBe(0);
    expect(b.segments.filter(s => s.fill === 100).length).toBe(10);
    expect(b.segments[10].fill).toBeCloseTo(10.101, 3);
    expect(b.segments[10].peak).toBe(true);
    expect(b.segments[11].fill).toBe(0);
  });

  it('starts prestige tiers past a full bar, over the previous tier colour', () => {
    expect(statBar(99, 'atk')!.tier).toBe(0);
    const t1 = statBar(100, 'atk')!;
    expect(t1.tier).toBe(1);
    expect(tierLabel(t1.tier)).toBe('[T1]');
    expect(t1.segments[19].backTier).toBe(0);           // tier 1 sits on the base colour
    const t3 = statBar(99 * 3 + 50, 'atk')!;
    expect(t3.tier).toBe(3);
    expect(t3.segments[0].fillTier).toBe(3);
    expect(t3.segments[19].backTier).toBe(2);
  });

  it('knows nothing about unknown stats', () => {
    expect(statBar(10, 'luck')).toBeNull();
  });
});

describe('power level', () => {
  it('uses the highest threshold reached', () => {
    expect(statPowerLevel('atk', 0)).toBe(0);
    expect(statPowerLevel('atk', 50)).toBe(4);
    expect(statPowerLevel('hp', 300000)).toBe(16);
  });
  it('averages the five combat stats, rounding down', () => {
    expect(overallPowerLevel({ hp: 225, atk: 50, def: 50, mag: 50, spd: 70 }).label).toBe('WALL');
  });
});

describe('transactGold', () => {
  it('floors the amount, records the balance, newest first', () => {
    const r = transactGold({ gold: 10, goldHistory: [] }, 1, '5.9', '  loot ', 1000);
    expect(r).toEqual({ gold: 15, goldHistory: [{ amount: 5, note: 'loot', ts: 1000, balance: 15 }] });
  });
  it('allows a negative balance and labels empty notes', () => {
    const r = transactGold({ gold: 3 }, -1, 10, '', 5) as any;
    expect(r.gold).toBe(-7);
    expect(r.goldHistory[0].note).toBe('Removed');
  });
  it('refuses zero, negative and non-numbers', () => {
    expect(transactGold({}, 1, '0', '', 1)).toEqual({ error: 'ENTER A VALID AMOUNT' });
    expect(transactGold({}, 1, 'abc', '', 1)).toEqual({ error: 'ENTER A VALID AMOUNT' });
    expect(transactGold({}, 1, -4, '', 1)).toEqual({ error: 'ENTER A VALID AMOUNT' });
  });
  it('keeps the latest 200 entries', () => {
    const hist = Array.from({ length: 200 }, (_, i) => ({ amount: 1, note: 'x', ts: i, balance: i }));
    const r = transactGold({ gold: 0, goldHistory: hist }, 1, 1, 'new', 999) as any;
    expect(r.goldHistory.length).toBe(200);
    expect(r.goldHistory[0].note).toBe('new');
  });
});
