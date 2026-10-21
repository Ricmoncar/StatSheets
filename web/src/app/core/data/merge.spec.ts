import { describe, expect, it } from 'vitest';
import { ABSENT, baselineOf, changedFields, merge3, mergeChanges, stable, stripUndefined } from './merge';

describe('stable', () => {
  it('sorts object keys and skips undefined entries', () => {
    expect(stable({ b: 1, a: { d: 2, c: undefined } })).toBe('{"a":{"d":2},"b":1}');
  });
  it('writes undefined as null', () => {
    expect(stable(undefined)).toBe('null');
    expect(stable([1, undefined])).toBe('[1,null]');
  });
});

describe('stripUndefined', () => {
  it('drops undefined and zeroes non-finite numbers', () => {
    expect(stripUndefined({ a: undefined, b: NaN, c: [Infinity, 2], d: { e: undefined } }))
      .toEqual({ b: 0, c: [0, 2], d: {} });
  });
});

describe('changedFields', () => {
  it('finds edited, added and removed fields, never _rev', () => {
    const base = baselineOf({ name: 'A', gold: 5, bio: 'x', _rev: 3 });
    expect(changedFields({ name: 'A', gold: 6, tags: ['t'], _rev: 9 }, base).sort()).toEqual(['bio', 'gold', 'tags']);
  });
});

describe('merge3', () => {
  it('keeps the other side when only one side changed', () => {
    const c: string[] = [];
    expect(merge3(1, 1, 2, 'gold', c)).toBe(2);   // only the database changed
    expect(merge3(1, 3, 1, 'gold', c)).toBe(3);   // only this client changed
    expect(c).toEqual([]);
  });

  it('reports a conflict and keeps the database value when both changed differently', () => {
    const c: string[] = [];
    expect(merge3(1, 3, 2, 'gold', c)).toBe(2);
    expect(c).toEqual(['gold']);
  });

  it('merges nested objects key by key', () => {
    const c: string[] = [];
    const b = { hp: 10, atk: 5 };
    const out = merge3(b, { hp: 12, atk: 5 }, { hp: 10, atk: 7 }, 'stats', c);
    expect(out).toEqual({ hp: 12, atk: 7 });
    expect(c).toEqual([]);
  });

  it('removes a nested key this client deleted', () => {
    const c: string[] = [];
    const out = merge3({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2, c: 3 }, 'info', c);
    expect(out).toEqual({ a: 1, c: 3 });
  });

  it('merges trait lists as sets', () => {
    const c: string[] = [];
    // this client added "fire" and removed "ice"; someone else added "wind"
    const out = merge3(['ice', 'rock'], ['rock', 'fire'], ['ice', 'rock', 'wind'], 'traits', c);
    expect(out).toEqual(['rock', 'wind', 'fire']);
    expect(c).toEqual([]);
  });

  it('merges alternate forms by position when the count is unchanged', () => {
    const c: string[] = [];
    const b = [{ name: 'A', stats: { hp: 1 } }, { name: 'B', stats: { hp: 1 } }];
    const l = [{ name: 'A', stats: { hp: 2 } }, { name: 'B', stats: { hp: 1 } }];
    const s = [{ name: 'A', stats: { hp: 1 } }, { name: 'B2', stats: { hp: 1 } }];
    expect(merge3(b, l, s, 'altForms', c)).toEqual([{ name: 'A', stats: { hp: 2 } }, { name: 'B2', stats: { hp: 1 } }]);
    expect(c).toEqual([]);
  });

  it('treats other lists as one value', () => {
    const c: string[] = [];
    expect(merge3([1], [1, 2], [1, 3], 'inventory', c)).toEqual([1, 3]);
    expect(c).toEqual(['inventory']);
  });
});

describe('mergeChanges', () => {
  it('builds a patch of only the fields that differ from the database', () => {
    const r = mergeChanges(
      ['gold', 'bio'],
      { gold: 6, bio: ABSENT },
      { gold: 5, bio: 'old' },
      { gold: 5, bio: 'old', name: 'A' },
    );
    expect(r.patch).toEqual({ gold: 6, bio: ABSENT });
    expect(r.conflicts).toEqual([]);
  });

  it('writes nothing when the database already has the same change', () => {
    const r = mergeChanges(['gold'], { gold: 6 }, { gold: 5 }, { gold: 6 });
    expect(r.patch).toEqual({});
  });
});
