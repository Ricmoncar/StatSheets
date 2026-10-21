import { contrast, oklch, ramp, toOklch } from './ramp';

describe('accent ramps', () => {
  it('round-trips colours through OKLCH', () => {
    for (const hex of ['#ff8000', '#3aa0ff', '#80ff00', '#8000ff', '#ffffff', '#000000']) {
      const [L, C, H] = toOklch(hex);
      expect(oklch(L, C, H)).toBe(hex);
    }
  });

  it('builds five accent steps from dark to light and four stone steps', () => {
    for (const hex of ['#ff8000', '#ff3fa4', '#00e5ff', '#80ff00', '#8000ff', '#ffff00', '#ffffff', '#222222']) {
      const r = ramp(hex);
      const L = (['ac0', 'ac1', 'ac2', 'ac3', 'ac4'] as const).map(k => toOklch(r[k])[0]);
      for (let i = 1; i < L.length; i++) expect(L[i]).toBeGreaterThan(L[i - 1]);
      const S = (['sn0', 'sn1', 'sn2', 'sn3'] as const).map(k => toOklch(r[k])[0]);
      for (let i = 1; i < S.length; i++) expect(S[i]).toBeGreaterThan(S[i - 1]);
      for (const v of Object.values(r)) expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps the accent hue and picks readable text for it', () => {
    const r = ramp('#ff8000');
    expect(Math.abs(toOklch(r.ac2)[2] - toOklch('#ff8000')[2])).toBeLessThan(3);
    // ac2 is lifted to at least mid lightness, so text on it is the better of black and white
    for (const hex of ['#ff8000', '#0000ff', '#8000ff', '#ffff00', '#cc0000', '#00cc66']) {
      const x = ramp(hex);
      expect(contrast(x.ac2, x.on)).toBeGreaterThanOrEqual(contrast(x.ac2, x.on === '#000000' ? '#ffffff' : '#000000'));
      expect(contrast(x.ac2, x.on)).toBeGreaterThan(4.5);
    }
  });

  it('falls back to the default accent on bad input', () => {
    expect(ramp('not a colour')).toEqual(ramp('#ff8000'));
  });
});
