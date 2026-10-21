import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * A titled, collapsible panel (the old .panel with a chevron title).
 * Header actions go in the [actions] slot; the body is the default slot.
 */
@Component({
  selector: 'ss-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <button class="title" type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()">
        <span class="chev" [class.shut]="!open()" aria-hidden="true">&#9660;</span>{{ title() }}
      </button>
      <div class="actions"><ng-content select="[actions]" /></div>
    </div>
    @if (open()) { <div class="body"><ng-content /></div> }
  `,
  styles: `
    :host { display: block; border: var(--ss-border) solid var(--ss-accent); background: var(--ss-panel); }
    .head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; flex-wrap: wrap; }
    .title { display: flex; align-items: center; gap: 8px; background: none; border: 0; padding: 0; font-size: var(--ss-text-sm); }
    .chev { font-size: var(--ss-text-xs); transition: transform 0.2s; }
    .chev.shut { transform: rotate(-90deg); }
    .actions { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
    .body { padding: 0 14px 14px; }
  `,
})
export class Panel {
  readonly title = input.required<string>();
  readonly open = signal(true);
}
