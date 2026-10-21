import { DestroyRef, inject, signal } from '@angular/core';
import { Unsubscribe, collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { FIRESTORE, col } from '../../../core/firebase';

export type SaveState = '' | 'saving' | 'saved';
const SAVE_DELAY = 900;

/**
 * One game world's documents (one per character id), live, with the old
 * autosave: an edit saves the whole document 900 ms after the last change.
 * While a document has an edit waiting, snapshots of it are ignored, so
 * nothing anyone else saves can overwrite text being typed (the old site
 * ignored every snapshot while in edit mode).
 *
 * Create it in a component's injection context.
 */
export class GameDocs<T extends object> {
  private readonly db = inject(FIRESTORE);
  readonly docs = signal<Record<string, T>>({});
  /** The save indicator of the document being edited. */
  readonly state = signal<SaveState>('');
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly unsub: Unsubscribe;

  constructor(private readonly name: string, private readonly normalize: (raw: Partial<T> | undefined) => T) {
    this.unsub = onSnapshot(collection(this.db, col(name)), snap => {
      const next = { ...this.docs() };
      for (const ch of snap.docChanges()) {
        if (this.timers.has(ch.doc.id)) continue;
        if (ch.type === 'removed') delete next[ch.doc.id];
        else next[ch.doc.id] = ch.doc.data() as T;
      }
      this.docs.set(next);
    }, err => console.error(`${name} failed to load:`, err));
    inject(DestroyRef).onDestroy(() => {
      this.unsub();
      for (const id of [...this.timers.keys()]) this.flush(id);
    });
  }

  /** The character's document with every field filled in (a fresh copy). */
  get(id: string): T {
    return this.normalize(structuredClone(this.docs()[id]));
  }

  /** Changes a character's document and saves it shortly after. */
  edit(id: string, change: (d: T) => void, quietly = false): void {
    const d = this.get(id);
    change(d);
    this.docs.update(all => ({ ...all, [id]: d }));
    if (!quietly) this.state.set('saving');
    clearTimeout(this.timers.get(id));
    this.timers.set(id, setTimeout(() => this.flush(id, quietly), SAVE_DELAY));
  }

  private flush(id: string, quietly = false): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    const d = this.docs()[id];
    if (!d) return;
    setDoc(doc(this.db, col(this.name), id), JSON.parse(JSON.stringify(d)))
      .then(() => {
        if (quietly) return;
        this.state.set('saved');
        setTimeout(() => { if (this.state() === 'saved') this.state.set(''); }, 2000);
      })
      .catch(err => console.error(`${this.name} save error`, err));
  }
}

export interface Named { name: string; desc: string }
/** A list of {name, desc} entries, never empty: old plain strings become descriptions. */
export function namedList(a: unknown, key: 'desc' | 'text' = 'desc'): Named[] {
  const blank = () => ({ name: '', [key]: '' }) as unknown as Named;
  if (!Array.isArray(a) || !a.length) return [blank()];
  return a.map(e => (e && typeof e === 'object' ? e : { name: '', [key]: e || '' })) as Named[];
}
export const filled = <E extends { name?: string }>(arr: E[], key: string = 'desc') =>
  arr.filter(e => ((e.name || '') as string).trim() || (((e as Record<string, unknown>)[key] as string) || '').trim());
