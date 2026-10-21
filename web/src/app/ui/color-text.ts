import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { colorPieces } from '../core/game/abilities';

/** Text with [c=#hex]coloured[/c] runs, rendered as text (never as HTML). */
@Component({
  selector: 'ss-color-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (p of pieces(); track $index) {@if (p.color) {<span [style.color]="p.color">{{ p.text }}</span>} @else {{{ p.text }}}}`,
  styles: `:host { white-space: pre-wrap; overflow-wrap: anywhere; }`,
})
export class ColorText {
  readonly text = input<string | null | undefined>('');
  protected readonly pieces = computed(() => colorPieces(this.text()));
}
