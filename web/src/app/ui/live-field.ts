import { Directive, ElementRef, OnDestroy, effect, inject, input, output } from '@angular/core';

/**
 * For text fields that save as you type (the old saveInfoField pattern).
 *
 * - [ssLiveField]="value": the saved value. It is written into the field only
 *   while the field is NOT focused, so a live update from someone else can
 *   never replace text under the user's cursor.
 * - (commit): the typed value, 600 ms after the last keystroke (as before),
 *   and at once when the field loses focus.
 */
@Directive({
  selector: 'input[ssLiveField], textarea[ssLiveField]',
  host: { '(input)': 'onInput()', '(blur)': 'flush()' },
})
export class LiveField implements OnDestroy {
  private readonly el = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef).nativeElement;
  readonly ssLiveField = input<string | null | undefined>('');
  readonly delay = input(600);
  readonly commit = output<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: string | null = null;

  constructor() {
    effect(() => {
      const v = this.ssLiveField() ?? '';
      if (document.activeElement !== this.el && this.pending === null && this.el.value !== v) this.el.value = v;
    });
  }

  protected onInput(): void {
    this.pending = this.el.value;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay());
  }

  protected flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.pending === null) return;
    const v = this.pending;
    this.pending = null;
    this.commit.emit(v);
  }

  ngOnDestroy(): void {
    this.flush();
  }
}
