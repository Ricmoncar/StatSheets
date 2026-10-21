import { describe, expect, it } from 'vitest';
import { buildSoulSvg, nextColor, normalizeSoul, soulDesc } from './soul';

describe('soul', () => {
  it('fills defaults and upgrades old colour pairs', () => {
    const s = normalizeSoul({ color: '#ff0000', color2: '#00ff00', fill: 'split' });
    expect(s.colors).toEqual(['#ff0000', '#00ff00']);
    expect(s['color']).toBeUndefined();
    expect(s.name).toBe('Vessel');
  });

  it('builds an SVG with every layer, and refuses non-hex colours', () => {
    const s = normalizeSoul({ fill: 'checker', colors: ['#ff0000', '"/><script>x</script>'], inner: true, outline: true, cracked: true, monster: true });
    const svg = buildSoulSvg(s, 72);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('<script');
    expect(svg).toContain('rotate(180 20 18)');
    expect(svg.match(/soulshard-/g)!.length).toBeGreaterThanOrEqual(5);
  });

  it('describes and extends palettes like the old editor', () => {
    expect(soulDesc(normalizeSoul({ fill: 'gradient', inner: true, cracked: true }))).toBe('BLEND · NESTED · CRACKED');
    expect(nextColor(['#ff0000'])).not.toBe('#ff0000');
    expect(nextColor(['#ffffff'])).toMatch(/^#[0-9a-f]{6}$/);
  });
});
