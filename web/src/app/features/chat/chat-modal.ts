import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { arrayUnion, doc, increment, updateDoc } from 'firebase/firestore';
import { CharacterStore } from '../../core/data/character-store';
import { FIRESTORE, col } from '../../core/firebase';
import { NotifyService } from '../../core/notify.service';
import { Modal } from '../../ui/modal';

interface ChatMsg { text: string; ts: number }
const MSG_MAX = 500;

/**
 * A character's inbox (the old character chat): messages other characters
 * left for them, by sender, oldest first. Typing "as" a character appends to
 * chats.<senderId> with arrayUnion, so two people writing at once both land.
 */
@Component({
  selector: 'ss-chat-modal',
  imports: [Modal, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recipient(); as r) {
      <ss-modal [title]="'MESSAGES FOR ' + (r.name || 'UNNAMED').toUpperCase()" width="760px" (closed)="closed.emit()">
        <div class="chat" [style.--who]="r.color || '#888'">
          <nav class="convs" aria-label="Conversations">
            <span class="label">CONVERSATIONS</span>
            <button type="button" class="conv" [class.on]="!filter()" (click)="filter.set(null)">
              <span class="dot" style="background:#555"></span><span class="cname">ALL</span><span class="count">{{ total() }}</span>
            </button>
            @for (s of senders(); track s.id) {
              <button type="button" class="conv" [class.on]="filter() === s.id" (click)="filter.set(s.id)">
                <span class="dot" [style.background]="s.color"></span><span class="cname" [style.color]="s.color">{{ s.name }}</span><span class="count">{{ s.count }}</span>
              </button>
            }
          </nav>
          <div class="main">
            <ol #log class="messages" aria-live="polite">
              @for (m of messages(); track $index) {
                <li class="msg">
                  <span class="head"><span class="dot" [style.background]="m.color"></span><span class="sender" [style.color]="m.color">{{ m.name }}</span><time>{{ m.ts | date: 'MMM d, HH:mm' }}</time></span>
                  <span class="text">{{ m.text }}</span>
                </li>
              } @empty {
                <li class="empty">NO MESSAGES YET<span>SELECT A CHARACTER BELOW AND START TYPING</span></li>
              }
            </ol>
            <form class="send" (submit)="$event.preventDefault(); send()">
              <label class="as"><span>AS</span>
                <select [value]="sender()" (change)="sender.set($any($event.target).value)" aria-label="Who is typing">
                  <option value="">-- WHO IS TYPING? --</option>
                  @for (c of others(); track c.id) { <option [value]="c.id">{{ c.name || 'UNNAMED' }}</option> }
                </select>
              </label>
              <input #box type="text" [maxLength]="max" placeholder="TYPE A MESSAGE..." aria-label="Message" [value]="draft()" (input)="draft.set($any($event.target).value)" />
              <button type="submit" class="btn">SEND</button>
            </form>
          </div>
        </div>
      </ss-modal>
    }
  `,
  styles: `
    .chat { display: grid; grid-template-columns: 180px 1fr; gap: 14px; min-height: 360px; }
    .convs { display: grid; align-content: start; gap: 4px; padding-right: 12px; border-right: 1px solid var(--ss-panel-2); overflow-y: auto; max-height: 60vh; }
    .label { font-size: 6px; letter-spacing: 2px; color: var(--ss-fg-faint); padding-bottom: 4px; }
    .conv { display: grid; grid-template-columns: 8px 1fr auto; gap: 8px; align-items: center; padding: 6px 8px; background: none; border: 1px solid transparent; text-align: left; font-size: var(--ss-text-xs);
      &.on { border-color: var(--who); } &:hover { background: var(--ss-panel-2); } }
    .cname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .count { color: var(--ss-fg-faint); }
    .dot { width: 8px; height: 8px; display: inline-block; }
    .main { display: grid; grid-template-rows: 1fr auto; gap: 10px; min-width: 0; }
    .messages { list-style: none; margin: 0; padding: 0; display: grid; align-content: start; gap: 12px; overflow-y: auto; max-height: 52vh; }
    .msg { display: grid; gap: 4px; padding-bottom: 10px; border-bottom: 1px solid var(--ss-panel-2); }
    .head { display: flex; gap: 8px; align-items: center; font-size: var(--ss-text-xs); }
    time { margin-left: auto; font-size: 6px; color: var(--ss-fg-faint); }
    .text { font-size: var(--ss-text-sm); line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
    .empty { display: grid; gap: 8px; padding: 48px 12px; text-align: center; color: var(--ss-fg-dim); font-size: var(--ss-text-sm); letter-spacing: 2px; span { font-size: 6px; color: var(--ss-fg-faint); } }
    .send { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; }
    .as { display: flex; gap: 6px; align-items: center; font-size: 6px; color: var(--ss-fg-faint); }
    select, input { padding: 7px 8px; font-size: var(--ss-text-xs); background: var(--ss-panel); border: 1px solid var(--ss-line-dim); color: var(--ss-fg); min-width: 0; }
    select { max-width: 160px; }
    .btn { padding: 8px 12px; font-size: var(--ss-text-xs); letter-spacing: 1px; background: none; border: var(--ss-border) solid var(--ss-gold); color: var(--ss-gold); &:hover { background: var(--ss-gold); color: var(--ss-bg); } }
    @media (max-width: 700px) {
      .chat { grid-template-columns: 1fr; }
      .convs { grid-auto-flow: column; grid-auto-columns: max-content; border: 0; padding: 0 0 8px; max-height: none; overflow-x: auto; }
      .send { grid-template-columns: 1fr auto; .as { grid-column: 1 / -1; } }
    }
  `,
})
export class ChatModal {
  private readonly store = inject(CharacterStore);
  private readonly db = inject(FIRESTORE);
  private readonly notifier = inject(NotifyService);

  readonly charId = input.required<string>();
  readonly closed = output<void>();

  protected readonly max = MSG_MAX;
  protected readonly filter = signal<string | null>(null);
  protected readonly sender = signal('');
  protected readonly draft = signal('');
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  /** The live character, so new messages from anyone show at once. */
  protected readonly recipient = computed(() => this.store.byId().get(this.charId()) ?? null);
  private readonly chats = computed(() => ((this.recipient() as { chats?: Record<string, ChatMsg[]> } | null)?.chats || {}));
  protected readonly others = computed(() => this.store.characters().filter(c => c.id !== this.charId() && !c.isPlaceholder));
  protected readonly total = computed(() => Object.values(this.chats()).reduce((n, arr) => n + (arr?.length || 0), 0));

  protected readonly senders = computed(() => {
    const byId = this.store.byId();
    return Object.entries(this.chats())
      .filter(([, msgs]) => msgs?.length)
      .map(([id, msgs]) => ({ id, name: byId.get(id)?.name || 'UNKNOWN', color: byId.get(id)?.color || '#888', count: msgs.length }));
  });

  protected readonly messages = computed(() => {
    const byId = this.store.byId(), only = this.filter();
    return Object.entries(this.chats())
      .filter(([sid]) => !only || sid === only)
      .flatMap(([sid, msgs]) => (msgs || []).map(m => ({ ...m, name: byId.get(sid)?.name || 'UNKNOWN', color: byId.get(sid)?.color || '#888' })))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  });

  constructor() {
    // newest at the bottom, in view
    effect(() => {
      this.messages();
      const el = this.log()?.nativeElement;
      if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    });
  }

  protected async send(): Promise<void> {
    const senderId = this.sender().trim();
    const text = this.draft().trim();
    if (!senderId) { this.notifier.notify('SELECT WHO IS TYPING FIRST', 'err'); return; }
    if (!text) return;
    const msg: ChatMsg = { text: text.slice(0, MSG_MAX), ts: Date.now() };
    this.draft.set('');
    this.box()?.nativeElement.focus();
    try {
      await updateDoc(doc(this.db, col('characters'), this.charId()), { [`chats.${senderId}`]: arrayUnion(msg), _rev: increment(1) });
    } catch (err) {
      console.error('Chat send failed:', err);
      this.notifier.notify('SEND FAILED', 'err');
      this.draft.set(text);
    }
  }
}
