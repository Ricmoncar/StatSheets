import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A dialog over a dimmed page: title bar with a close button, body in the
 * default slot. Closes on the backdrop and on Escape.
 */
@Component({
  selector: 'ss-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()" [style.max-width]="width()">
      <header class="bar">
        <span>{{ title() }}</span>
        <button type="button" class="x" (click)="closed.emit()" aria-label="Close">&#10005;</button>
      </header>
      <div class="body"><ng-content /></div>
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); }
    .backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / 0.8); }
    .dialog { position: relative; width: 100%; max-height: 100%; display: flex; flex-direction: column; background: var(--ss-bg); border: var(--ss-border) solid var(--ss-line); }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: var(--ss-border) solid var(--ss-line); font-size: var(--ss-text-sm); letter-spacing: 3px; }
    .x { background: none; border: 1px solid var(--ss-line-dim); padding: 4px 7px; font-size: var(--ss-text-xs); }
    .body { overflow-y: auto; padding: 16px; }
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly width = input('640px');
  readonly closed = output<void>();
}
