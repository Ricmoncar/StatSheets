import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { FIRESTORE, col } from '../firebase';
import { NotifyService } from '../notify.service';
import { ABSENT, Baseline, baselineOf, changedFields, mergeChanges, stable, stripUndefined } from './merge';
import { Character, Folder } from './models';

/** How long after our own save a snapshot still counts as an echo of it (old SELF_WRITE_WINDOW). */
const SELF_WRITE_WINDOW = 8000;

export type SyncStatus = 'connecting' | 'live' | 'error';

/**
 * Live characters and folders, and the only way to save a character.
 *
 * Mirrors the old site's sync exactly (script.js FIREBASE and INIT sections):
 * - one listener on characters, sorted by `order`, falling back to `createdAt`;
 * - a per-character baseline of what the database last held, field by field;
 * - every character object remembers the baseline it was built from, and a
 *   save sends only the fields that differ from THAT baseline, merged in a
 *   transaction with whatever the database holds now, carrying `_rev + 1`.
 * A tab whose copy is out of date therefore cannot put old values back.
 */
@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly db: Firestore = inject(FIRESTORE);
  private readonly notifier = inject(NotifyService);

  readonly characters = signal<Character[]>([]);
  readonly folders = signal<Folder[]>([]);
  readonly status = signal<SyncStatus>('connecting');
  readonly byId = computed(() => new Map(this.characters().map(c => [c.id, c])));

  /** What the database held for each character at the last snapshot. */
  private readonly dbBase = new Map<string, Baseline>();
  /** Which baseline each character object was built from (the old non-enumerable __base). */
  private readonly objBase = new WeakMap<object, Baseline>();
  private lastSave = { id: '', time: 0 };
  private unsubs: Unsubscribe[] = [];

  start(): void {
    if (this.unsubs.length) return;
    this.unsubs.push(onSnapshot(collection(this.db, col('characters')), snapshot => {
      const changed = new Set<string>();
      for (const ch of snapshot.docChanges()) {
        if (ch.type === 'removed') this.dbBase.delete(ch.doc.id);
        else changed.add(ch.doc.id);
      }
      const shown = this.byId();
      const list = snapshot.docs.map(d => {
        const raw = d.data() as Character;
        // the baseline is the database, taken before any migration touches the object
        if (changed.has(d.id) || !this.dbBase.has(d.id)) this.dbBase.set(d.id, baselineOf(raw));
        // While our own saves of this character are still queued, keep showing
        // our copy: the database has not caught up with it yet, and redrawing
        // from it would flash older values (the old site skipped redraws of its
        // own writes for the same reason). Our queued saves merge into it.
        const local = shown.get(d.id);
        if (local && this.inflight.has(d.id)) return local;
        this.objBase.set(raw, this.dbBase.get(d.id)!);
        return this.migrate(raw);
      });
      list.sort((a, b) => sortKey(a) - sortKey(b));
      this.characters.set(list);
      this.status.set('live');
    }, err => {
      console.error('Firestore error:', err);
      this.status.set('error');
      this.notifier.notify('CONNECTION ERROR', 'err');
    }));

    this.unsubs.push(onSnapshot(query(collection(this.db, col('folders')), orderBy('order')), snap => {
      this.folders.set(snap.docs.map(d => ({ ...(d.data() as Omit<Folder, 'id'>), id: d.id })));
    }, () => { /* the old site ignores folder listener errors */ }));
  }

  stop(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  /** True while snapshots for this character are probably echoes of our own save. */
  isRecentSelfWrite(id: string): boolean {
    return this.lastSave.id === id && Date.now() - this.lastSave.time < SELF_WRITE_WINDOW;
  }

  /**
   * Edits a character and saves it. `edit` receives a deep copy it may change
   * freely; the copy keeps the baseline of the object it was made from, so
   * the save only sends what `edit` changed.
   */
  update(id: string, edit: (c: Character) => void): Promise<void> {
    const current = this.byId().get(id);
    if (!current) return Promise.resolve();
    const copy = structuredClone(current);
    const base = this.objBase.get(current);
    if (base) this.objBase.set(copy, base);
    edit(copy);
    return this.save(copy);
  }

  /** Writes a brand new character whole, with _rev 1. */
  create(c: Character): Promise<void> {
    return this.save(c);
  }

  /** Folder collapse state is shared: it is stored on the folder, for everyone (as on the old site). */
  async setFolderCollapsed(id: string, collapsed: boolean): Promise<void> {
    await updateDoc(doc(this.db, col('folders'), id), { collapsed });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.db, col('characters'), id));
  }

  /**
   * The old saveData(): diff against the object's own baseline, merge, write
   * with the next _rev.
   *
   * One deliberate change: saves of the same character run one after another.
   * The old site started each save at once, so a second edit made while the
   * first was still in flight (equipping an item just added) diffed against
   * the baseline from BEFORE the first, met the first save already in the
   * database, and was refused as "changed elsewhere". Queued, the second save
   * runs after the first has updated the shared baseline, and only real
   * edits by other people can conflict. The screen still updates at once.
   */
  save(c: Character): Promise<void> {
    this.lastSave = { id: c.id, time: Date.now() };
    this.replaceLocal(c);
    const seq = (this.saveSeq.get(c.id) ?? 0) + 1;
    this.saveSeq.set(c.id, seq);
    const run = (this.inflight.get(c.id) ?? Promise.resolve()).then(() => this.saveNow(c, seq));
    const settled = run.catch(() => undefined);
    this.inflight.set(c.id, settled);
    void settled.then(() => { if (this.inflight.get(c.id) === settled) this.inflight.delete(c.id); });
    return run;
  }

  private readonly inflight = new Map<string, Promise<void>>();
  /** Per character, the number of the newest save; only it may put its result on screen. */
  private readonly saveSeq = new Map<string, number>();

  private async saveNow(c: Character, seq: number): Promise<void> {
    const ref = doc(this.db, col('characters'), c.id);
    const cur = this.dbBase.get(c.id);
    const base = this.objBase.get(c) ?? cur;

    if (!base) {
      // never seen in the database: a brand new character, so write it whole
      const full = stripUndefined({ ...c }) as Character;
      full._rev = 1;
      c._rev = 1;
      const b = baselineOf(full);
      this.dbBase.set(c.id, b);
      this.objBase.set(c, b);
      try { await setDoc(ref, full); } catch (err) { this.fail(err); }
      return;
    }

    const changed = changedFields(c, base);
    if (!changed.length) return;
    const mine: Record<string, unknown> = {};
    const was: Record<string, unknown> = {};
    for (const k of changed) {
      mine[k] = k in c && c[k] !== undefined ? stripUndefined(c[k]) : ABSENT;
      was[k] = k in base ? JSON.parse(base[k]) : ABSENT;
    }

    try {
      const r = await runTransaction(this.db, async t => {
        const snap = await t.get(ref);
        if (!snap.exists()) return { gone: true as const };
        const sv = snap.data() as Record<string, unknown>;
        const { merged, patch, conflicts } = mergeChanges(changed, mine, was, sv);
        let rev: number | null = null;
        const keys = Object.keys(patch);
        if (keys.length) {
          rev = (typeof sv['_rev'] === 'number' ? (sv['_rev'] as number) : 0) + 1;
          const write: Record<string, unknown> = { _rev: rev };
          for (const k of keys) write[k] = patch[k] === ABSENT ? deleteField() : patch[k];
          t.update(ref, write);
        }
        return { gone: false as const, merged, conflicts, rev };
      });

      if (r.gone) { this.notifier.notify('THIS CHARACTER WAS DELETED ELSEWHERE', 'err'); return; }
      // the object catches up with what is now in the database
      for (const k of changed) {
        const m = r.merged[k];
        if (m === ABSENT) {
          delete base[k];
          if (cur && cur !== base) delete cur[k];
          delete c[k];
        } else {
          const js = stable(m);
          base[k] = js;
          if (cur && cur !== base) cur[k] = js;
          c[k] = m;
        }
      }
      if (r.rev) {
        c._rev = r.rev;
        base['_rev'] = stable(r.rev);
        if (cur && cur !== base) cur['_rev'] = base['_rev'];
      }
      // a newer edit of this character is already on screen and queued behind us
      if (this.saveSeq.get(c.id) === seq) this.replaceLocal(c);
      if (r.conflicts.length) {
        this.notifier.notify('CHANGED ELSEWHERE, NOT SAVED: ' + r.conflicts.join(', ').toUpperCase(), 'err', 5000);
        this.lastSave.time = 0;   // let the next snapshot redraw
      }
    } catch (err) {
      if ((err as { code?: string })?.code === 'permission-denied') {
        this.notifier.notify('THIS TAB IS OUT OF DATE, RELOADING', 'err');
        setTimeout(() => location.reload(), 1500);
        return;
      }
      this.fail(err);
    }
  }

  /**
   * Optimistic local update, but never by putting an OLDER copy of the
   * character back in place of a newer one (one built from another baseline).
   */
  private replaceLocal(c: Character): void {
    const list = this.characters();
    const idx = list.findIndex(x => x.id === c.id);
    const next = { ...c };
    const base = this.objBase.get(c);
    if (base) this.objBase.set(next, base);
    if (idx < 0) { this.characters.set([...list, next]); return; }
    const existing = list[idx];
    const eb = this.objBase.get(existing);
    if (existing === c || !eb || !base || eb === base) {
      const copy = list.slice();
      copy[idx] = next;
      this.characters.set(copy);
    }
  }

  /** Old data formats fixed on load (the old _migrateCharacter). */
  private migrate(c: Character): Character {
    const psd = c.perfectSoulData;
    if (psd && Array.isArray(psd.history)) {
      let dirty = false;
      psd.history = psd.history.map(entry => {
        if (Array.isArray(entry)) { dirty = true; return { souls: entry }; }
        return entry;
      });
      // deferred until after this snapshot has rebuilt the list
      if (dirty) setTimeout(() => { const now = this.byId().get(c.id); if (now) void this.save(now); }, 0);
    }
    return c;
  }

  private fail(err: unknown): void {
    console.error('Firestore write error:', err);
    this.notifier.notify('SAVE FAILED', 'err');
  }
}

function sortKey(c: Character): number {
  return c.order != null ? c.order : (c.createdAt || 0);
}

/** The old genId(): time in base 36 plus random base-36 digits. */
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
