import { Injectable, signal } from '@angular/core';

export type NoticeKind = 'ok' | 'err' | 'info';

export interface Notice {
  id: number;
  text: string;
  kind: NoticeKind;
}

/** Short-lived toast messages (the old site's notify()). */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  readonly notices = signal<Notice[]>([]);
  private seq = 0;

  notify(text: string, kind: NoticeKind = 'ok', ms = 2600): void {
    const id = ++this.seq;
    this.notices.update(list => [...list, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number): void {
    this.notices.update(list => list.filter(n => n.id !== id));
  }
}
