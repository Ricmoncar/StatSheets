import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';

/**
 * Editable rows of name + description (powers, perks, passives...), with
 * remove buttons and an add button up to `max`. The last row is cleared
 * rather than removed, so there is always one to type into.
 */
@Component({
  selector: 'ss-entry-rows',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (e of items(); track $index; let i = $index) {
      <div class="row">
        <span class="num">{{ i + 1 }}.</span>
        <div class="fields">
          <input type="text" maxlength="60" [placeholder]="namePh()" [value]="$any(e).name || ''" (input)="edit.emit({ i, field: 'name', value: $any($event.target).value })" />
          <textarea rows="2" [placeholder]="descPh()" [value]="$any(e)[descKey()] || ''" (input)="edit.emit({ i, field: descKey(), value: $any($event.target).value })"></textarea>
        </div>
        <button type="button" class="x" (click)="remove.emit(i)" aria-label="Remove">&#10005;</button>
      </div>
    }
    @if (items().length < max()) { <button type="button" class="add" (click)="add.emit(); focusLast()">+ {{ addLabel() }}</button> }
  `,
  styles: `
    :host { display: grid; gap: 6px; }
    .row { display: flex; gap: 8px; align-items: flex-start; }
    .num { width: 2ch; padding-top: 8px; font-size: var(--ss-text-xs); color: var(--ss-fg-faint); }
    .fields { flex: 1; min-width: 0; display: grid; gap: 4px; }
    input, textarea { width: 100%; padding: 6px 8px; font-size: var(--ss-text-sm); line-height: 1.7; background: var(--ss-bg); border: 1px solid var(--ss-line-dim); color: var(--ss-fg); resize: vertical; }
    .x { padding: 5px 7px; font-size: var(--ss-text-xs); background: none; border: 1px solid var(--ss-err); color: var(--ss-err); }
    .add { justify-self: start; margin-top: 4px; padding: 5px 9px; font-size: var(--ss-text-xs); background: none; border: 1px dashed var(--ss-line-dim); color: var(--ss-fg-dim); &:hover { color: var(--ss-fg); } }
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
