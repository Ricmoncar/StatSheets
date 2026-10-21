// The admin page's rules, ported from the old admin.html: the password check,
// trait keys, and how its saves merge with changes made elsewhere meanwhile.

/** btoa('maxshimmy'), as on the old page; the session remembers it under '_adm'. */
const PASS_B64 = 'bWF4c2hpbW15';
export const SESSION_KEY = '_adm';

export function passwordOk(value: string): boolean {
  try { return btoa(value) === PASS_B64; } catch { return false; }   // btoa throws on characters outside Latin-1
}

/** What the old page stored for a typed key: lower case with no spaces. */
export function traitKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * A list of trait keys merged three ways: what the database has now, plus
 * what this page added, minus what this page removed (the old _setMerge).
 */
export function setMerge(base: string[] | undefined, mine: string[] | undefined, theirs: string[] | undefined): string[] {
  const b = new Set(base || []), m = new Set(mine || []);
  const out = (theirs || []).filter(k => !(b.has(k) && !m.has(k)));
  for (const k of mine || []) if (!b.has(k) && !out.includes(k)) out.push(k);
  return out;
}

export type StatMap = Record<string, number | undefined>;

/**
 * Quick stat override: a stat edited here is written unless someone else
 * changed that same stat since it was loaded; stats not edited are left alone.
 */
export function mergeStats(orig: StatMap, want: StatMap, now: StatMap): { stats: StatMap; clashed: string[] } {
  const stats: StatMap = { ...now };
  const clashed: string[] = [];
  for (const k of Object.keys(want)) {
    if (want[k] === orig[k]) continue;
    if (now[k] !== orig[k] && now[k] !== want[k]) { clashed.push(k); continue; }
    stats[k] = want[k];
  }
  return { stats, clashed };
}

/** The firm number typed for a stat, or undefined (blank, zero and below are not written). */
export function statValue(text: string): number | undefined {
  const v = parseInt(text, 10);
  return !isNaN(v) && v > 0 ? v : undefined;
}

export function nextRev(d: { _rev?: unknown }): number {
  return (typeof d._rev === 'number' ? d._rev : 0) + 1;
}
