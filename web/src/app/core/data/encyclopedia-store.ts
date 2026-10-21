import { Injectable, computed, inject, signal } from '@angular/core';
import { Firestore, doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { FIRESTORE, col } from '../firebase';

export interface StatusEffect {
  name: string;
  color?: string;
  desc?: string;
  type?: string;
  [k: string]: unknown;
}

/**
 * The encyclopaedia document (enc/data), live. The main app uses its status
 * effects to colour status names in trait descriptions and for the status
 * roller; the encyclopaedia page uses the rest.
 */
@Injectable({ providedIn: 'root' })
export class EncyclopediaStore {
  private readonly db: Firestore = inject(FIRESTORE);
  readonly data = signal<Record<string, any>>({});
  readonly statuses = computed<StatusEffect[]>(() => this.data()['statuses'] || []);
  /** Status info by UPPERCASE name. */
  readonly statusMap = computed(() => {
    const m = new Map<string, StatusEffect>();
    for (const s of this.statuses()) if (s.name) m.set(s.name.toUpperCase(), { ...s, color: s.color || '#ffdd00', desc: s.desc || '' });
    return m;
  });
  private unsub: Unsubscribe | null = null;

  start(): void {
    if (this.unsub) return;
    this.unsub = onSnapshot(doc(this.db, col('enc'), 'data'), snap => this.data.set(snap.data() || {}), () => { /* ignored, as before */ });
  }
}
