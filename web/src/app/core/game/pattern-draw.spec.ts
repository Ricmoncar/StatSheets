import { describe, expect, it } from 'vitest';
import { isGenericPattern, withDefaults } from './pattern-draw';

describe('background patterns', () => {
  it('fills missing settings from the defaults and keeps saved ones', () => {
    const p = withDefaults('checkerboard', { size: 48 });
    expect(p['size']).toBe(48);
    expect(p['speed']).toBe(0.5);
    expect(p['dir']).toBeDefined();
    expect(withDefaults('unknown', null)).toEqual({});
  });

  it('knows which patterns are generic', () => {
    expect(isGenericPattern('matrix_rain')).toBe(true);
    expect(isGenericPattern('none')).toBe(false);
    expect(isGenericPattern('juko_code')).toBe(false);
    expect(isGenericPattern(undefined)).toBe(false);
  });
});
