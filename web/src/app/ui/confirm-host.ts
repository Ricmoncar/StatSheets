import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, viewChildren, ElementRef } from '@angular/core';
import { ConfirmService } from '../core/confirm.service';
import { SettingsService } from '../core/settings.service';
import { Icon } from './icon';

/**
 * Shows ConfirmService questions as an Undertale dialogue: the white box, the
 * question typed out, and "* CANCEL  * CONFIRM" with the SOUL on the one you
 * are on. Arrow keys and Tab move between them. Placed once in the app shell.
 */
@Component({
  selector: 'ss-confirm-host',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'key($event)' },
  template: `
    @if (confirm.current(); as q) {
      <div class="root">
        <div class="scrim u-scrim" (click)="confirm.answer(false)"></div>
        <section class="box u-voice" role="alertdialog" aria-modal="true" [attr.aria-label]="q.message">
          <p class="u-say msg" aria-hidden="true">{{ shown() }}@if (typing()) {<span class="caret"></span>}</p>
          <div class="opts">
            <button #opt type="button" class="u-opt" (click)="confirm.answer(false)"><ss-icon name="ast" />CANCEL</button>
            <button #opt type="button" class="u-opt danger" (click)="confirm.answer(true)"><ss-icon name="ast" />CONFIRM</button>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .root { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 16px; }
    .scrim { position: absolute; inset: 0; animation: scrim 0.2s steps(2, end) both; }
    .box { position: relative; width: min(100%, calc(220 * var(--px))); display: grid; gap: var(--p4); padding: var(--p5) var(--p6); box-shadow: 0 var(--p3) 0 var(--c-void); }
    .msg { margin: 0; min-height: calc(2 * var(--lh-voice)); }
    .msg::before { content: '* '; }
    .caret { display: inline-block; width: var(--p4); height: var(--p5); margin-left: var(--p1); background: var(--c-white); animation: blink 1s steps(2, jump-none) infinite; }
    .opts { display: flex; gap: var(--p12); flex-wrap: wrap; }
    @keyframes scrim { from { opacity: 0; } to { opacity: 1; } }
    @keyframes blink { 50% { opacity: 0; } }
    @media (max-width: 720px) { .box { padding: var(--p4); } .opts { gap: var(--p8); } }
  `,
})
export class ConfirmHost {
  protected readonly confirm = inject(ConfirmService);
  private readonly settings = inject(SettingsService);
  private readonly opts = viewChildren<ElementRef<HTMLButtonElement>>('opt');
  /** The question as typed so far. */
  protected readonly shown = signal('');
  protected readonly typing = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const q = this.confirm.current();
      clearTimeout(this.timer);
      if (!q) return;
      const text = q.message, instant = this.settings.perfMode() || matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.shown.set(instant ? text : '');
      this.typing.set(!instant);
      let i = 0;
      const step = () => {
        i++;
        this.shown.set(text.slice(0, i));
        if (i >= text.length) { this.typing.set(false); return; }
        const ch = text[i - 1];
        this.timer = setTimeout(step, ch === '.' || ch === ',' || ch === '?' ? 160 : 28);
      };
      if (!instant) this.timer = setTimeout(step, 28);
    });
    // CONFIRM has the focus, so Enter answers yes as before
    effect(() => { const o = this.opts(); if (o.length) setTimeout(() => o[1]?.nativeElement.focus()); });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected key(e: KeyboardEvent): void {
    if (!this.confirm.current()) return;
    // the question is on top: Escape answers it and goes no further (not to a dialog underneath)
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.confirm.answer(false); return; }
    const btns = this.opts().map(o => o.nativeElement), i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault();
      const d = e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1;
      btns[(i + d + btns.length) % btns.length]?.focus();
    }
  }
}
