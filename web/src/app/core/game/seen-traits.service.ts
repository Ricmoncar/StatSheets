import { Injectable, effect, inject, signal } from '@angular/core';
import { CharacterStore } from '../data/character-store';
import { TRAITS } from './traits-data';

// Shared key with the old site (same origin): discoveries carry over.
const KEY = 'statsheets_seen_traits';

/**
 * Traits this browser has seen. Unseen traits are 1.5x likelier in rolls, and
 * the codex shows only seen ones. As on the old site, every trait any loaded
 * character holds counts as seen.
 */
@Injectable({ providedIn: 'root' })
export class SeenTraits {
  private readonly store = inject(CharacterStore);
  readonly seen = signal<ReadonlySet<string>>(load());

  constructor() {
    effect(() => {
      const keys = this.store.characters().flatMap(c => c.traits || []);
      this.add(keys);
    });
  }

  add(keys: Iterable<string>): void {
    const cur = this.seen();
    const next = new Set(cur);
    for (const k of keys) if (TRAITS[k]) next.add(k);
    if (next.size === cur.size) return;
    this.seen.set(next);
    try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* storage blocked */ }
  }
}

function load(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]') || []); } catch { return new Set(); }
}
