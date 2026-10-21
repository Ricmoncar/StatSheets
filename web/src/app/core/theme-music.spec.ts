import { describe, expect, it } from 'vitest';
import { Character } from './data/models';
import { fmtTime, formTheme, isJuko, parseTime } from './theme-music.service';

const char = (over: Partial<Character>) => ({ id: 'x', name: 'X', ...over }) as Character;

describe('theme music', () => {
  it('formats and parses start times as the old site did', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(65.9)).toBe('1:05');
    expect(parseTime('1:23')).toBe(83);
    expect(parseTime('83')).toBe(83);
    expect(parseTime('0:5.5')).toBe(5.5);
    expect(parseTime('abc')).toBe(0);
    expect(parseTime('-4')).toBe(0);
  });

  it('reads the base and alt form themes', () => {
    const c = char({ info: { themeSong: { url: 'a.mp3', name: 'A' } }, altForms: [{ name: 'F', themeSong: { url: 'b.mp3' } }, { name: 'G' }] } as any);
    expect(formTheme(c, 0)?.url).toBe('a.mp3');
    expect(formTheme(c, 1)?.url).toBe('b.mp3');
    expect(formTheme(c, 2)).toBeNull();
    expect(formTheme(null, 0)).toBeNull();
  });

  it("locks Juko's themes to the bundled files, per form", () => {
    const juko = (formName: string, idx: number) =>
      char({ name: 'Juko!', activeFormIdx: idx, info: { themeSong: { url: 'cloud.mp3' } }, altForms: [{ name: formName }] } as any);
    expect(isJuko(juko('', 0))).toBe(true);
    expect(formTheme(juko('', 0), 0)?.url).toMatch(/sounds\/juko\.mp3$/);
    expect(formTheme(juko('0 ∞', 1), 1)?.url).toMatch(/juko-0inf\.mp3$/);
    expect(formTheme(juko('1', 1), 1)?.url).toMatch(/juko-1\.mp3$/);
    expect(formTheme(juko('', 0), 0)?.locked).toBe(true);
    expect(isJuko(char({ name: 'Jukebox' }))).toBe(false);
  });
});
