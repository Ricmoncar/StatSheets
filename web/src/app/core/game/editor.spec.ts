import { describe, expect, it } from 'vitest';
import type { Character } from '../data/models';
import { addTag, buildCharacter, clampStat, draftFrom, newDraft, placeholderFrom } from './editor';

const existing: Character = {
  id: 'x', name: 'Old', createdAt: 5, gold: 99, traits: ['favored'], info: { owner: 'BK' }, custom: 'kept',
  stats: { hp: 100, atk: 20, def: 20, mag: 20, spd: 20, iq: 60 },
  altForms: [{ name: 'F', stats: { hp: 10, atk: 1, def: 1, mag: 1, spd: 1, iq: 50 }, traits: ['spicy'], shimmyfulTraits: [], themeSong: { url: 'u' } as any }],
};

describe('editor', () => {
  it('starts new characters with the old defaults', () => {
    const d = newDraft();
    expect(d.stats).toEqual({ hp: 50, atk: 10, def: 10, mag: 10, spd: 10, iq: 50 });
    expect(d.color).toBe('#ffff00');
    expect(d.pattern.type).toBe('none');
  });

  it('keeps every field the editor does not touch, and live form traits', () => {
    const d = draftFrom(existing);
    d.name = '  New Name ';
    d.forms[0].name = 'Renamed';
    // someone rolls a new trait on the form while the editor is open
    const live = JSON.parse(JSON.stringify(existing));
    live.altForms[0].traits = ['sonic'];
    const c = buildCharacter(live, d, 'x', 1000) as any;
    expect(c.name).toBe('New Name');
    expect(c.custom).toBe('kept');
    expect(c.gold).toBe(99);
    expect(c.info).toEqual({ owner: 'BK' });
    expect(c.createdAt).toBe(5);
    expect(c.altForms[0]).toMatchObject({ name: 'Renamed', traits: ['sonic'], themeSong: { url: 'u' } });
    expect(c.isPlaceholder).toBe(false);
  });

  it('shows UNTITLED drafts with an empty name', () => {
    expect(draftFrom({ id: 'p', name: 'UNTITLED', stats: {} }).name).toBe('');
    expect(placeholderFrom(newDraft(), 'p').name).toBe('UNTITLED');
  });

  it('clamps stats and tags like the old inputs', () => {
    expect(clampStat('9999', 300)).toBe(300);
    expect(clampStat('', 300)).toBe(1);
    expect(addTag(['a'], ' b ')).toEqual(['a', 'b']);
    expect(addTag(['a'], 'a')).toBeNull();
    expect(addTag(['1', '2', '3', '4', '5', '6', '7', '8'], 'nine')).toBeNull();
  });
});
