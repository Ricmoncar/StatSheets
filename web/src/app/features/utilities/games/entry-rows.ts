import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';
import { Icon } from '../../../ui/icon';

/**
 * Editable rows of name + description (powers, perks, passives...), with
 * remove buttons and an add button up to `max`. The last row is cleared
 * rather than removed, so there is always one to type into.
 */
@Component({
  selector: 'ss-entry-rows',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (e of items(); track $index; let i = $index) {
      <div class="row">
        <span class="num">{{ i + 1 }}.</span>
        <div class="fields">
          <input type="text" maxlength="60" [placeholder]="namePh()" [value]="$any(e).name || ''" (input)="edit.emit({ i, field: 'name', value: $any($event.target).value })" />
          <textarea rows="2" [placeholder]="descPh()" [value]="$any(e)[descKey()] || ''" (input)="edit.emit({ i, field: descKey(), value: $any($event.target).value })"></textarea>
        </div>
        <button type="button" class="x u-btn icon sm" (click)="remove.emit(i)" aria-label="Remove"><ss-icon name="x" [soul]="false" /></button>
      </div>
    }
    @if (items().length < max()) { <button type="button" class="add u-btn sm" (click)="add.emit(); focusLast()"><ss-icon name="plus" />{{ addLabel() }}</button> }
  `,
  styles: `
    @use 'underground' as u;
    :host { display: grid; gap: var(--p2); }
    .row { display: flex; gap: var(--p2); align-items: flex-start; }
    .num { width: 2ch; padding-top: var(--p2); font: var(--fs-num) / 1 var(--f-body); color: var(--c-mute); }
    .fields { flex: 1; min-width: 0; display: grid; gap: var(--p1); }
    input, textarea { width: 100%; @include u.field; resize: vertical; }
    .x:hover { color: var(--c-red); }
    .add { justify-self: start; margin-top: var(--p1); }
  `,
})
export class EntryRows {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly items = input.required<readonly object[]>();
  readonly namePh = input('Name...');
  readonly descPh = input('Description...');
  readonly descKey = input<'desc' | 'text'>('desc');
  readonly max = input(99);
  readonly addLabel = input('ADD');
  readonly edit = output<{ i: number; field: string; value: string }>();
  readonly add = output<void>();
  readonly remove = output<number>();

  /** The new row's name box gets the cursor (the old 50 ms focus). */
  protected focusLast(): void {
    setTimeout(() => this.el.querySelector<HTMLInputElement>('.row:last-of-type input')?.focus(), 50);
  }
}
