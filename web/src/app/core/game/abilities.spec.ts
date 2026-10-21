import { describe, expect, it } from 'vitest';
import type { Character } from '../data/models';
import { abilityTags, applyColor, colorPieces, emptyAbility, saveAbility } from './abilities';

describe('abilities', () => {
  it('parses colour markup into pieces and never into HTML', () => {
    expect(colorPieces('deal [c=#ff4466]<b>fire</b>[/c] damage')).toEqual([
      { text: 'deal ' }, { text: '<b>fire</b>', color: '#ff4466' }, { text: ' damage' }]);
  });

  it('wraps and strips colour on a selection', () => {
    const w = applyColor('hello world', 6, 11, '#00ffff');
    expect(w.text).toBe('hello [c=#00ffff]world[/c]');
    expect(applyColor(w.text, 0, w.text.length, null).text).toBe('hello world');
  });

  it('splits comma tags', () => {
    expect(abilityTags(' fire, aoe ,, projectile')).toEqual(['fire', 'aoe', 'projectile']);
  });

  it('saves new abilities at the end and keeps the id when editing', () => {
    const c: Character = { id: 'c', name: 'C' };
    expect(saveAbility(c, emptyAbility(), null, 'a1')).toBe('ABILITY NEEDS A NAME');
    saveAbility(c, { ...emptyAbility(), name: ' Fireball ', cost: ' 3 MP ' }, null, 'a1');
    expect(c.abilities![0]).toMatchObject({ id: 'a1', name: 'Fireball', cost: '3 MP', type: 'ACTIVE' });
    saveAbility(c, { ...emptyAbility(), name: 'Inferno', type: 'ULTIMATE' }, 0, 'ignored');
    expect(c.abilities![0]).toMatchObject({ id: 'a1', name: 'Inferno', type: 'ULTIMATE' });
  });
});
