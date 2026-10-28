import { Injectable, computed, inject, signal } from '@angular/core';
import { Firestore, doc, onSnapshot, runTransaction, Unsubscribe } from 'firebase/firestore';
import { FIRESTORE, col } from '../firebase';

export interface StatusEffect {
  name: string;
  color?: string;
  desc?: string;
  type?: string;
  [k: string]: unknown;
}

// ── the encyclopaedia's own entries (enc/data), as the old page wrote them ──
export interface EncSoundtrack { label: string; url: string }
export interface EncPlace { id: string; name: string; region?: string; type?: string; desc?: string; lore?: string; features?: string; image?: string | null; soundtracks?: EncSoundtrack[] }
export interface EncStatus { id: string; name: string; type?: string; folder?: string; color?: string; desc?: string; duration?: string; stars?: number; shape?: string }
export interface EncScene { title: string; text: string }
export interface EncMemory { id: string; title: string; arc?: string; date?: string; image?: string | null; scenes?: EncScene[]; characterIds?: string[] }
export interface EncNpc { id: string; name: string; role?: string; affiliation?: string; alignment?: string; color?: string; desc?: string; personality?: string; notes?: string; image?: string | null }
export interface EncData { places: EncPlace[]; statuses: EncStatus[]; memories: EncMemory[]; npcs: EncNpc[] }

/** Which folder of the status index a status is in: its own, or by its type (buffs GOOD, debuffs BAD). */
export function statusFolder(s: { folder?: unknown; type?: unknown } | null | undefined): 'GOOD' | 'BAD' | 'NEUTRAL' {
  const f = s?.folder ? String(s.folder).toUpperCase() : '';
  if (f === 'GOOD' || f === 'BAD' || f === 'NEUTRAL') return f;
  const t = String(s?.type || '').toUpperCase();
  return t === 'BUFF' ? 'GOOD' : t === 'DEBUFF' ? 'BAD' : 'NEUTRAL';
}

/** Drops undefined values all the way down (Firestore refuses them). */
function stripUndef<T>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(stripUndef) as T;
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, stripUndef(x)])) as T;
}

/**
 * The encyclopaedia document (enc/data), live. The main app uses its status
 * effects to colour status names in trait descriptions and for the status
 * roller; the encyclopaedia page uses the rest, and edits it.
 */
@Injectable({ providedIn: 'root' })
export class EncyclopediaStore {
  private readonly db: Firestore = inject(FIRESTORE);
  readonly data = signal<Record<string, any>>({});
  /** True once the document has come in (or turned out not to exist). */
  readonly loaded = signal(false);
  readonly statuses = computed<StatusEffect[]>(() => this.data()['statuses'] || []);
  /** Status info by UPPERCASE name. */
  readonly statusMap = computed(() => {
    const m = new Map<string, StatusEffect>();
    for (const s of this.statuses()) if (s.name) m.set(s.name.toUpperCase(), { ...s, color: s.color || '#ffdd00', desc: s.desc || '' });
    return m;
  });
  /** The four lists the encyclopaedia keeps, each status in its folder. */
  readonly enc = computed<EncData>(() => {
    const d = this.data();
    return {
      places: d['places'] || [],
      statuses: (d['statuses'] || []).map((s: EncStatus) => ({ ...s, folder: statusFolder(s) })),
      memories: d['memories'] || [],
      npcs: d['npcs'] || [],
    };
  });
  private unsub: Unsubscribe | null = null;

  start(): void {
    if (this.unsub) return;
    this.unsub = onSnapshot(doc(this.db, col('enc'), 'data'), snap => { this.data.set(snap.data() || {}); this.loaded.set(true); }, () => { this.loaded.set(true); });
  }

  /**
   * Changes the document: `change` is given the copy in the database right
   * now (inside a transaction) and edits it, so an edit made meanwhile in
   * another tab, or on the old page, is kept rather than written over. The
   * document is written whole, with the four lists only, as the old page did.
   */
  async change(change: (d: EncData) => void): Promise<void> {
    const ref = doc(this.db, col('enc'), 'data');
    await runTransaction(this.db, async t => {
      const snap = await t.get(ref);
      const cur = (snap.data() || {}) as Partial<EncData>;
      const d: EncData = structuredClone({ places: cur.places || [], statuses: cur.statuses || [], memories: cur.memories || [], npcs: cur.npcs || [] });
      change(d);
      t.set(ref, stripUndef({ places: d.places, statuses: d.statuses, memories: d.memories, npcs: d.npcs }));
    });
  }
}
