import { Injectable, signal } from '@angular/core';

// Shared with the old site (same origin), so the choice carries over.
const PERF_KEY = 'perf_mode';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Per-browser display settings. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  /** Performance mode: no animated backgrounds, for devices that lag. */
  readonly perfMode = signal(read(PERF_KEY) === '1');

  togglePerfMode(): void {
    this.perfMode.update(v => !v);
    try { localStorage.setItem(PERF_KEY, this.perfMode() ? '1' : '0'); } catch { /* storage blocked */ }
  }
}
