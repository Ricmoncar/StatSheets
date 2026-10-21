import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CharacterStore } from '../../../core/data/character-store';
import { Character } from '../../../core/data/models';

/** The grid of characters to pick from; a dot marks those with something filled in. */
@Component({
  selector: 'ss-game-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" role="listbox" aria-label="Characters">
      @for (c of chars(); track c.id) {
        @let dot = dotFor()(c);
        <button type="button" role="option" class="card" [class.on]="c.id === selected()" [attr.aria-selected]="c.id === selected()" [style.--c]="c.color || '#888'" (click)="pick.emit(c.id)">
          <span class="av">
            @if (c.avatar) { <img [src]="c.avatar" alt="" loading="lazy" /> }
            @else { <span class="init">{{ (c.name || '?')[0].toUpperCase() }}</span> }
          </span>
          <span class="name">{{ c.name || 'UNNAMED' }}</span>
          @if (dot) { <span class="dot" [style.background]="dot"></span> }
        </button>
      } @empty {
        <p class="none">NO CHARACTERS YET</p>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; max-height: 300px; overflow-y: auto; padding: 2px 4px 4px 2px; }
    .card { --c: #888; position: relative; display: grid; justify-items: center; gap: 6px; padding: 10px 6px; background: rgb(255 255 255 / 0.015); border: 1px solid rgb(255 255 255 / 0.05);
      &:hover { background: rgb(255 255 255 / 0.06); border-color: rgb(255 255 255 / 0.18); translate: 0 -2px; box-shadow: 3px 3px 0 #000; }
      &.on { border-color: color-mix(in srgb, var(--c) 60%, transparent); background: color-mix(in srgb, var(--c) 8%, transparent); .name { color: var(--c); } } }
    .av { width: 46px; height: 46px; overflow: hidden; border: 2px solid color-mix(in srgb, var(--c) 45%, transparent); display: grid; place-items: center; background: color-mix(in srgb, var(--c) 12%, transparent);
      img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; } }
    .init { font-size: 16px; color: var(--c); }
    .name { width: 100%; font-size: 6.5px; letter-spacing: 0.5px; text-align: center; color: var(--ss-fg-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dot { position: absolute; top: 5px; right: 5px; width: 5px; height: 5px; }
    .none { grid-column: 1 / -1; margin: 0; padding: 24px 0; text-align: center; font-size: var(--ss-text-sm); letter-spacing: 2px; color: var(--ss-fg-faint); }
  `,
})
export class GamePicker {
  private readonly store = inject(CharacterStore);
  readonly selected = input<string | null>(null);
  /** The dot's colour for a character, or null for no dot. */
  readonly dotFor = input<(c: Character) => string | null>(() => null);
  readonly pick = output<string>();
  protected readonly chars = computed(() => this.store.characters().filter(c => !c.isPlaceholder));
}
