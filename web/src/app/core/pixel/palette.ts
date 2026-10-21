/**
 * THE UNDERGROUND palette: 35 fixed colours in 11 families, plus two ramps
 * (accent ac0-ac4, stone sn0-sn3) derived from the accent at runtime.
 * styles.scss declares the same values as --c-* tokens for the first paint.
 */
export const FIXED = {
  void: '#000000', ink: '#0c0b10', ink2: '#16141c', ink3: '#252230',
  ash: '#3e3753', mute: '#8a83a3', bone: '#d7d0e4', white: '#ffffff',
  red: '#ff1f3d', 'red-d': '#8c0b24', yel: '#ffe23b', kr: '#ff3ce6',
  wd0: '#2b170d', wd1: '#553118', wd2: '#85532a', wd3: '#c08448',
  mt0: '#1b1d27', mt1: '#3a3f55', mt2: '#6a7190', mt3: '#b2b9d1',
  fr0: '#8fb4e0', fr1: '#d6ebff',
  ec0: '#0f2350', ec1: '#2f6fe0', ec2: '#6fd2ff',
  em0: '#5c0d12', em1: '#c22a1c', em2: '#ff7a1e', em3: '#ffc23a',
  vi0: '#2a0f55', vi1: '#5b23b0', vi2: '#a24dff', vi3: '#dcb4ff',
  gd: '#b47812', grn: '#45d65a',
} as const;

export type FixedKey = keyof typeof FIXED;
export type RampKey = 'ac0' | 'ac1' | 'ac2' | 'ac3' | 'ac4' | 'sn0' | 'sn1' | 'sn2' | 'sn3';
export type ColourKey = FixedKey | RampKey;
/** The palette a painter draws with: the fixed colours plus the current ramps. */
export type Colours = Record<ColourKey, string>;

/** One character per palette entry, used by every sprite grid ('.' is clear). */
export const KEY: Record<string, ColourKey> = {
  '0': 'void', '1': 'ink', '2': 'ink2', '3': 'ink3', '4': 'ash', '5': 'mute', '6': 'bone', '7': 'white',
  R: 'red', r: 'red-d', Y: 'yel', w: 'wd0', x: 'wd1', y: 'wd2', z: 'wd3', m: 'mt0', n: 'mt1', o: 'mt2', p: 'mt3',
  f: 'fr0', F: 'fr1', q: 'ec0', Q: 'ec1', k: 'ec2', L: 'em0', M: 'em1', N: 'em2', O: 'em3',
  v: 'vi0', V: 'vi1', u: 'vi2', U: 'vi3', g: 'gd', G: 'grn', h: 'vi1', K: 'kr',
  A: 'ac0', B: 'ac1', C: 'ac2', D: 'ac3', E: 'ac4', S: 'sn0', T: 'sn1', I: 'sn2', J: 'sn3',
};

/** The site's own accent when no character is open (the style tile's ORANGE). */
export const DEFAULT_ACCENT = '#ff8000';
