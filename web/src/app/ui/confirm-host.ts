import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from '../core/confirm.service';

/** Shows ConfirmService questions. Placed once in the app shell. */
@Component({
  selector: 'ss-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'confirm.current() && confirm.answer(false)' },
  template: `
    @if (confirm.current(); as q) {
      <div class="backdrop" (click)="confirm.answer(false)"></div>
      <section class="box" role="alertdialog" aria-modal="true" [attr.aria-label]="q.message">
        <p class="msg">{{ q.message }}</p>
        <div class="row">
          <button type="button" class="btn" (click)="confirm.answer(false)">CANCEL</button>
          <button type="button" class="btn yes" (click)="confirm.answer(true)" autofocus>CONFIRM</button>
        </div>
      </section>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: 70; background: rgb(0 0 0 / 0.8); }
    .box { position: fixed; z-index: 71; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100% - 32px)); display: grid; gap: 18px; padding: 20px; background: var(--ss-bg); border: var(--ss-border) solid var(--ss-line); }
    .msg { margin: 0; font-size: var(--ss-text-sm); line-height: 2; text-align: center; }
    .row { display: flex; gap: 10px; justify-content: center; }
    .btn { font-size: var(--ss-text-xs); padding: 8px 12px; background: none; border: var(--ss-border) solid var(--ss-fg); &.yes { border-color: var(--ss-err); color: var(--ss-err); } }
  `,
})
export class ConfirmHost {
  protected readonly confirm = inject(ConfirmService);
}
