import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

/**
 * A dialog: the plain white Undertale box on a dithered scrim, titled
 * "* TITLE". Closes on the scrim and on Escape.
 */
@Component({
  selector: 'ss-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="scrim u-scrim" (click)="closed.emit()"></div>
    <section class="dialog u-voice" role="dialog" aria-modal="true" [attr.aria-label]="title()" [style.max-width]="width()">
      <header class="bar">
        <span class="t u-ast">{{ title() }}</span>
        <button type="button" class="u-btn icon sm" (click)="closed.emit()" aria-label="Close"><ss-icon name="x" [soul]="false" /></button>
      </header>
      <div class="body"><ng-content /></div>
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); }
    .scrim { position: absolute; inset: 0; animation: scrim 0.2s steps(2, end) both; }
    .dialog { position: relative; width: 100%; max-height: 100%; display: flex; flex-direction: column; box-shadow: 0 var(--p3) 0 var(--c-void); }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: var(--p4); padding: var(--p3) var(--p3) var(--p3) var(--p5); border-bottom: var(--px) solid var(--c-ash); }
    .t { font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-white); text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .body { overflow-y: auto; padding: var(--p5); }
    @keyframes scrim { from { opacity: 0; } to { opacity: 1; } }
    @media (max-width: 720px) { .body { padding: var(--p4); } }
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly width = input('640px');
  /** Off while something on top of the dialog (a lightbox, say) takes Escape for itself. */
  readonly escape = input(true);
  readonly closed = output<void>();

  protected onEscape(): void {
    if (this.escape()) this.closed.emit();
  }
}
