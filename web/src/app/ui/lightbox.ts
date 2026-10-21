import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { Icon } from './icon';

/**
 * A picture full size on the void, in a white frame, with arrows (and the
 * arrow keys) through the others and a counter. A click anywhere but the
 * arrows, or Escape, closes it.
 */
@Component({
  selector: 'ss-lightbox',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lightbox',
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-label]': "label() || 'Picture'",
    '(click)': 'closed.emit()',
    '(document:keydown)': 'onKey($event)',
  },
  template: `
    <button type="button" class="lb-x u-btn icon" (click)="$event.stopPropagation(); closed.emit()" aria-label="Close"><ss-icon name="x" [soul]="false" /></button>
    @if (label()) { <div class="lb-name">{{ label() }}</div> }
    @if (urls().length > 1) {
      <button type="button" class="lb-nav prev u-btn icon" (click)="$event.stopPropagation(); step(-1)" aria-label="Previous"><ss-icon name="left" [soul]="false" /></button>
      <button type="button" class="lb-nav next u-btn icon" (click)="$event.stopPropagation(); step(1)" aria-label="Next"><ss-icon name="right" [soul]="false" /></button>
    }
    <img class="lb-img" [src]="urls()[index()]" [alt]="label() || ''" />
    <div class="lb-count">{{ index() + 1 }} / {{ urls().length }}</div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 45; display: grid; place-items: center; padding: 56px max(64px, env(safe-area-inset-right, 0px)) 56px max(64px, env(safe-area-inset-left, 0px)); background: rgb(0 0 0 / 0.94); cursor: zoom-out; }
    .lb-img { max-width: 100%; max-height: calc(100dvh - 112px); object-fit: contain; box-shadow: 0 0 0 var(--p1) var(--c-white), 0 0 0 calc(2 * var(--p1)) var(--c-void); }
    .lb-x { position: absolute; top: var(--p4); right: var(--p4); }
    .lb-name { position: absolute; top: var(--p6); left: 50%; transform: translateX(-50%); max-width: calc(100% - 140px); font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-white); text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lb-count { position: absolute; bottom: var(--p6); left: 50%; transform: translateX(-50%); font: var(--fs-num) / 1 var(--f-body); color: var(--c-mute); }
    .lb-nav { position: absolute; top: 50%; transform: translateY(-50%); &.prev { left: var(--p4); } &.next { right: var(--p4); } }
    @media (max-width: 560px) {
      :host { padding-left: 16px; padding-right: 16px; }
      .lb-nav { top: auto; bottom: var(--p3); transform: none; }
    }
  `,
})
export class Lightbox {
  readonly urls = input.required<string[]>();
  readonly index = model(0);
  /** Shown along the top, and read out as the dialog's name. */
  readonly label = input<string | null | undefined>(null);
  readonly closed = output<void>();

  protected step(dir: number): void {
    const n = this.urls().length;
    if (n) this.index.set((this.index() + dir + n) % n);
  }

  protected onKey(ev: KeyboardEvent): void {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); this.step(-1); }
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); this.step(1); }
    if (ev.key === 'Escape') { ev.stopImmediatePropagation(); this.closed.emit(); }
  }
}
