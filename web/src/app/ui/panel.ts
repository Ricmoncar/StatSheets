import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Icon } from './icon';

/**
 * A titled, collapsible panel: Ruins stone that holds things, named by a
 * wooden plaque hung over its top edge. Header actions go in the [actions]
 * slot; the body is the default slot.
 */
@Component({
  selector: 'ss-panel',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'u-fr u-stone' },
  template: `
    <div class="head">
      <button class="title u-fr u-wood u-plaque" type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()">
        <span class="chev" [class.shut]="!open()"><ss-icon name="chev" [soul]="false" /></span>{{ title() }}
      </button>
      <div class="actions"><ng-content select="[actions]" /></div>
    </div>
    @if (open()) { <div class="body"><ng-content /></div> }
  `,
  styles: `
    :host { display: block; position: relative; min-width: 0; padding: var(--p4) var(--p6) var(--p6); box-shadow: var(--hard); }
    .head { display: flex; align-items: center; gap: var(--p3); flex-wrap: wrap; margin: calc(-12 * var(--px)) 0 var(--p5) calc(-2 * var(--px)); }
    .title { max-width: 100%; overflow: hidden; text-overflow: ellipsis; &:hover { color: var(--c-yel); } }
    .chev { display: inline-flex; color: var(--c-wd3); }
    .chev.shut { transform: rotate(-90deg); }
    .actions { margin-left: auto; display: flex; gap: var(--p3); flex-wrap: wrap; align-items: center; }
    :host:has(.head > .title[aria-expanded='false']) .head { margin-bottom: 0; }
    @media (max-width: 720px) { :host { padding: var(--p4) var(--p4) var(--p5); } }
  `,
})
export class Panel {
  readonly title = input.required<string>();
  readonly open = signal(true);
}
