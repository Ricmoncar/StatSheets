import { describe, expect, it } from 'vitest';
import type { Character } from '../data/models';
import { iconHue, modTag, pasteItem, saveItem, toggleEquip } from './items';

const char = (): Character => ({ id: 'c', name: 'C', inventory: [{ id: 'a', name: 'Sword', equipped: true, mods: [] }] });
const draft = { name: ' Axe ', desc: ' big ', icon: 'axe', iconImage: null, mods: [{ stat: 'atk', op: 'mul', value: '1.5' as any }], passives: [' cleaves ', '  '] };

describe('items', () => {
  it('formats mod tags like the old cards', () => {
    expect(modTag({ stat: 'atk', op: 'add', value: 10 })).toBe('ATK +10');
    expect(modTag({ stat: 'hp', op: 'mul', value: 1.5 })).toBe('HP x1.5');
    expect(modTag({ stat: 'crit_rate', op: 'div', value: 2 })).toBe('CRIT_RATE /2');
  });

  it('hashes icon keys to the old hues', () => {
    expect(iconHue('sword')).toBe(iconHue(undefined));
    expect(iconHue('axe')).toMatch(/^hsl\(\d+, 80%, 60%\)$/);
  });

  it('adds a new item at the end, trimmed, unequipped', () => {
    const c = char();
    const r = saveItem(c, draft, null, 'new1') as any;
    expect(r.item).toEqual({ id: 'new1', name: 'Axe', desc: 'big', icon: 'axe', iconImage: null, mods: [{ stat: 'atk', op: 'mul', value: 1.5 }], passives: ['cleaves'], equipped: false });
    expect(c.inventory!.map(i => i.id)).toEqual(['a', 'new1']);
  });

  it('keeps place and equipped state when editing', () => {
    const c = char();
    saveItem(c, draft, 'a', 'unused');
    expect(c.inventory![0]).toMatchObject({ id: 'a', name: 'Axe', equipped: true });
  });

  it('requires a name', () => {
    expect(saveItem(char(), { ...draft, name: '  ' }, null, 'x')).toEqual({ error: 'Item needs a name!' });
  });

  it('pastes a fresh unequipped copy', () => {
    const c = char();
    pasteItem(c, c.inventory![0], 'b');
    expect(c.inventory![1]).toMatchObject({ id: 'b', name: 'Sword', equipped: false });
    expect(toggleEquip(c, 'b')).toBe(true);
  });
});
