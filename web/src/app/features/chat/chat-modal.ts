import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { arrayUnion, doc, increment, updateDoc } from 'firebase/firestore';
import { CharacterStore } from '../../core/data/character-store';
import { FIRESTORE, col } from '../../core/firebase';
import { NotifyService } from '../../core/notify.service';
import { Modal } from '../../ui/modal';
import { Icon } from '../../ui/icon';

interface ChatMsg { text: string; ts: number }
const MSG_MAX = 500;

/**
 * A character's inbox (the old character chat): messages other characters
 * left for them, by sender, oldest first. Typing "as" a character appends to
 * chats.<senderId> with arrayUnion, so two people writing at once both land.
 */
@Component({
  selector: 'ss-chat-modal',
  imports: [Modal, DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recipient(); as r) {
      <ss-modal [title]="'MESSAGES FOR ' + (r.name || 'UNNAMED').toUpperCase()" width="760px" (closed)="closed.emit()">
        <div class="chat" [style.--who]="r.color || '#888'">
          <nav class="convs" aria-label="Conversations">
            <span class="label">CONVERSATIONS</span>
            <button type="button" class="conv" [class.on]="!filter()" (click)="filter.set(null)">
              <span class="dot" style="background: var(--c-mute)"></span><span class="cname">ALL</span><span class="count">{{ total() }}</span>
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
                  <span class="text bubble">{{ m.text }}</span>
                </li>
              } @empty {
                <li class="empty"><i class="u-spr s-soul soulf" aria-hidden="true"></i>NO MESSAGES YET<span>Pick who is typing below and say something.</span></li>
              }
            </ol>
            <form class="send" (submit)="$event.preventDefault(); send()">
              <label class="as"><span class="aslbl">AS</span>
                <select [value]="sender()" (change)="sender.set($any($event.target).value)" aria-label="Who is typing">
                  <option value="">-- WHO IS TYPING? --</option>
                  @for (c of others(); track c.id) { <option [value]="c.id">{{ c.name || 'UNNAMED' }}</option> }
                </select>
              </label>
              <input #box type="text" [maxLength]="max" placeholder="Type a message..." aria-label="Message" [value]="draft()" (input)="draft.set($any($event.target).value)" />
              <button type="submit" class="btn u-btn primary"><ss-icon name="chat" />SEND</button>
            </form>
          </div>
        </div>
      </ss-modal>
    }
  `,
  styles: `
    @use 'underground' as u;
    .chat { display: grid; grid-template-columns: calc(62 * var(--px)) minmax(0, 1fr); gap: var(--p5); min-height: calc(120 * var(--px)); }
    .convs { display: grid; align-content: start; gap: var(--p1); padding-right: var(--p4); box-shadow: inset calc(-1 * var(--px)) 0 0 var(--c-ink3); overflow-y: auto; max-height: 60vh; }
    .label { @include u.label; color: var(--c-mute); padding-bottom: var(--p2); }
    .conv { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--p2); align-items: center; padding: var(--p1) var(--p2); text-align: left; font: var(--fs-ui) / 20px var(--f-ui); text-transform: uppercase;
      &:hover { background: var(--c-ink2); } &.on { background: var(--ac0); box-shadow: inset var(--px) 0 0 var(--ac2); } }
    .cname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .count { font: var(--fs-small) / 1 var(--f-body); color: var(--c-mute); }
    .dot { width: var(--p2); height: var(--p2); display: inline-block; box-shadow: 0 0 0 var(--px) var(--c-void); }
    .main { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: var(--p4); min-width: 0; }
    .messages { list-style: none; margin: 0; padding: 0 var(--p1) 0 calc(9 * var(--px)); display: flex; flex-direction: column; gap: var(--p5); overflow-y: auto; max-height: 52vh; }
    .msg { display: flex; flex-direction: column; align-items: flex-start; gap: var(--p1); min-width: 0; }
    .head { display: flex; gap: var(--p2); align-items: center; width: 100%; font: var(--fs-ui) / 1 var(--f-ui); text-transform: uppercase; }
    time { margin-left: auto; font: var(--fs-small) / 1 var(--f-body); color: var(--c-mute); text-transform: none; }
    // a white speech bubble with a pixel tail, as in the style tile
    .bubble { position: relative; max-width: 100%; padding: var(--p2) var(--p4) var(--p3); font: var(--fs-body) / var(--lh-body) var(--f-body); color: var(--c-void); background: var(--c-white) padding-box; border: calc(3 * var(--px)) solid transparent; border-image: var(--f-bubble) 3 repeat; white-space: pre-wrap; overflow-wrap: anywhere; }
    .bubble::before { content: ''; position: absolute; left: calc(-8 * var(--px)); top: var(--p2); width: calc(6 * var(--px)); height: calc(5 * var(--px)); background: var(--s-btail) 0 0 / 100% 100%; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: var(--p3); padding: var(--p12) var(--p4); text-align: center; font: var(--fs-voice) / 1 var(--f-body); color: var(--c-white); span { font: var(--fs-body) / var(--lh-body) var(--f-body); color: var(--c-mute); } .soulf { animation: u-bob 1.2s steps(2, end) infinite; } }
    .send { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--p3); align-items: center; }
    .as { display: flex; gap: var(--p2); align-items: center; .aslbl { @include u.label; color: var(--c-mute); } }
    select, input { @include u.field; }
    select { max-width: calc(56 * var(--px)); }
    @media (max-width: 700px) {
      .chat { grid-template-columns: 1fr; }
      .convs { grid-auto-flow: column; grid-auto-columns: max-content; box-shadow: none; padding: 0 0 var(--p2); max-height: none; overflow-x: auto; }
      .send { grid-template-columns: minmax(0, 1fr) auto; .as { grid-column: 1 / -1; } }
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
