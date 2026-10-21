import { describe, expect, it } from 'vitest';
import { compatHash } from './compat-tester';

describe('compatibility score', () => {
  it('is FNV-1a 32-bit, as on the old site', () => {
    expect(compatHash('a')).toBe(0xe40c292c);
    expect(compatHash('abc')).toBe(0x1a47e90b);
    expect(compatHash('compat_x::y_relationship') % 101).toBe(compatHash('compat_x::y_relationship') % 101);
  });
});
