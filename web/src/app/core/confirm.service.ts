import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest { message: string; resolve: (ok: boolean) => void }

/**
 * In-page yes/no questions (the old confirm2 and the native confirm() calls).
 * The ConfirmHost component in the app shell shows the current request.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmRequest | null>(null);

  ask(message: string): Promise<boolean> {
    this.current()?.resolve(false);
    return new Promise(resolve => this.current.set({ message, resolve }));
  }

  answer(ok: boolean): void {
    const r = this.current();
    this.current.set(null);
    r?.resolve(ok);
  }
}
