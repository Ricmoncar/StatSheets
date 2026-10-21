import { mergeStats, nextRev, passwordOk, setMerge, statValue, traitKey } from './admin';

describe('admin', () => {
  it('checks the old password', () => {
    expect(passwordOk('maxshimmy')).toBe(true);
    expect(passwordOk('MAXSHIMMY')).toBe(false);
    expect(passwordOk('')).toBe(false);
    expect(passwordOk('✦')).toBe(false);
  });

  it('normalises typed trait keys', () => {
    expect(traitKey('  Perfect Soul ')).toBe('perfectsoul');
  });

  it('merges trait lists three ways', () => {
    // this page added c and removed a; elsewhere d was added meanwhile
    expect(setMerge(['a', 'b'], ['b', 'c'], ['a', 'b', 'd'])).toEqual(['b', 'd', 'c']);
    // nothing changed here: the database wins
    expect(setMerge(['a'], ['a'], ['x'])).toEqual(['x']);
    expect(setMerge(undefined, ['k'], undefined)).toEqual(['k']);
  });

  it('writes only the stats edited here, unless changed elsewhere', () => {
    const r = mergeStats({ hp: 10, atk: 5, def: 3 }, { hp: 12, atk: 5, def: 4 }, { hp: 10, atk: 9, def: 7 });
    expect(r.stats).toEqual({ hp: 12, atk: 9, def: 7 });
    expect(r.clashed).toEqual(['def']);
    // the same value set elsewhere is not a clash
    expect(mergeStats({ hp: 1 }, { hp: 2 }, { hp: 2 }).clashed).toEqual([]);
  });

  it('reads stat inputs and revisions like the old page', () => {
    expect(statValue('12')).toBe(12);
    expect(statValue('0')).toBeUndefined();
    expect(statValue('')).toBeUndefined();
    expect(nextRev({})).toBe(1);
    expect(nextRev({ _rev: 4 })).toBe(5);
  });
});
