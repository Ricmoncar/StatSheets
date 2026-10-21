// Field-level diffing and three-way merging for character saves.
//
// This is a faithful port of the old site's save path (script.js, FIREBASE
// section: _stripUndefined, _stable, _baseOf, _merge3). Both sites write the
// same Firestore documents during the transition, so the rules here must stay
// identical to the old ones: a save only sends the top-level fields this
// client changed, and a field somebody else changed in the meantime is merged
// rather than overwritten.

/** Marks a key that does not exist on one side of a merge. */
export const ABSENT: unique symbol = Symbol('absent');
export type Absent = typeof ABSENT;

/** A baseline: one stable JSON string per top-level field, as last seen in the database. */
export type Baseline = Record<string, string>;

/** Lists where order does not matter: merged as sets, so two people adding
 *  different entries at once both keep theirs. */
export const SET_LISTS: ReadonlySet<string> = new Set(['traits', 'shimmyfulTraits', 'tags']);

/** Drops undefined object entries (Firestore refuses them) and turns
 *  non-finite numbers into 0, recursively. */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'number' && !isFinite(obj)) return 0 as T;
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(item => stripUndefined(item)) as T;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)]),
  ) as T;
}

/** JSON with object keys sorted, so equal values always give equal strings. */
export function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
}

export function baselineOf(data: Record<string, unknown>): Baseline {
  const out: Baseline = {};
  for (const k of Object.keys(data)) {
    if (data[k] !== undefined) out[k] = stable(stripUndefined(data[k]));
  }
  return out;
}

export function same(a: unknown, b: unknown): boolean {
  if (a === ABSENT || b === ABSENT) return a === b;
  return stable(a) === stable(b);
}

function plainObj(v: unknown): v is Record<string, unknown> {
  return v !== ABSENT && v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Three-way merge of one value.
 * b is the value as this client loaded it, l is what this client has now,
 * s is what the database has now. Whatever only one side changed wins;
 * whatever both changed the same way is fine; whatever both changed
 * DIFFERENTLY is a conflict, and the database's version stays.
 */
export function merge3(b: unknown, l: unknown, s: unknown, path: string, conflicts: string[]): unknown {
  if (same(l, b)) return s;   // this client did not change it
  if (same(s, b)) return l;   // nobody else did
  if (same(l, s)) return l;   // both made the same change
  const leaf = path.slice(path.lastIndexOf('.') + 1);
  if (plainObj(b) && plainObj(l) && plainObj(s)) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(s)])) {
      const v = merge3(k in b ? b[k] : ABSENT, k in l ? l[k] : ABSENT, k in s ? s[k] : ABSENT, path + '.' + k, conflicts);
      if (v !== ABSENT) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(b) && Array.isArray(l) && Array.isArray(s)) {
    if (SET_LISTS.has(leaf)) {
      const key = (x: unknown) => stable(x);
      const bk = new Set(b.map(key));
      const lk = new Set(l.map(key));
      const out = s.filter(x => !(bk.has(key(x)) && !lk.has(key(x))));   // drop what this client removed
      const have = new Set(out.map(key));
      for (const x of l) {
        if (!bk.has(key(x)) && !have.has(key(x))) { out.push(x); have.add(key(x)); }
      }
      return out;
    }
    // forms keep their places, so they can be merged one by one
    if (leaf === 'altForms' && b.length === l.length && l.length === s.length) {
      return s.map((x, i) => merge3(b[i], l[i], x, path + '[' + i + ']', conflicts));
    }
  }
  conflicts.push(path);
  return s;
}

/** The top-level fields of `current` that differ from `base`, including fields it no longer has. */
export function changedFields(current: Record<string, unknown>, base: Baseline): string[] {
  const changed: string[] = [];
  for (const k of Object.keys(current)) {
    if (k === '_rev' || current[k] === undefined) continue;
    if (base[k] !== stable(stripUndefined(current[k]))) changed.push(k);
  }
  for (const k of Object.keys(base)) if (k !== '_rev' && !(k in current)) changed.push(k);
  return changed;
}

export interface MergeResult {
  /** The merged value of every changed field (ABSENT where the field is deleted). */
  merged: Record<string, unknown>;
  /** Only the fields whose merged value differs from the database's. */
  patch: Record<string, unknown>;
  conflicts: string[];
}

/**
 * Merges this client's changes into the database's current document.
 * `mine` and `was` hold, per changed field, this client's value and the value
 * it loaded (ABSENT for a missing field). The caller writes `patch` (with
 * ABSENT turned into a field delete) plus the next _rev, in one transaction.
 */
export function mergeChanges(
  changed: string[],
  mine: Record<string, unknown>,
  was: Record<string, unknown>,
  server: Record<string, unknown>,
): MergeResult {
  const conflicts: string[] = [];
  const merged: Record<string, unknown> = {};
  const patch: Record<string, unknown> = {};
  for (const k of changed) {
    const theirs = k in server ? server[k] : ABSENT;
    const m = merge3(was[k], mine[k], theirs, k, conflicts);
    merged[k] = m;
    if (!same(m, theirs)) patch[k] = m;
  }
  return { merged, patch, conflicts };
}
