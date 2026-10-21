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
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(28 * var(--px)), 1fr)); gap: var(--p2); max-height: calc(100 * var(--px)); overflow-y: auto; padding: var(--p1); }
    // each character as a framed portrait; the picked one is lit with the SOUL beside it
    .card { --c: #888; position: relative; display: grid; justify-items: center; gap: var(--p1); padding: var(--p2) var(--p1); background: var(--c-ink2);
      &:hover { background: var(--c-ink3); .name { color: var(--c-yel); } }
      &.on { background: var(--ac0); box-shadow: inset 0 0 0 var(--px) var(--ac2); .name { color: var(--c-white); }
        &::before { content: ''; position: absolute; left: var(--p1); top: var(--p1); width: calc(7 * var(--px)); height: calc(6 * var(--px)); background: var(--s-heart7) 0 0 / 100% 100%; } } }
    .av { width: calc(16 * var(--px)); height: calc(16 * var(--px)); overflow: hidden; display: grid; place-items: center; background: var(--c-void); box-shadow: 0 0 0 var(--px) var(--c-void), 0 0 0 var(--p1) color-mix(in srgb, var(--c), #000 35%);
      img { width: 100%; height: 100%; object-fit: cover; } }
    .init { font: 700 var(--fs-plaque) / 1 var(--f-display); color: var(--c); }
    .name { width: 100%; font: var(--fs-small) / 1 var(--f-body); text-align: center; color: color-mix(in oklab, var(--c), #fff 30%); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dot { position: absolute; top: var(--p1); right: var(--p1); width: var(--p2); height: var(--p2); box-shadow: 0 0 0 var(--px) var(--c-void); }
    .none { grid-column: 1 / -1; margin: 0; padding: var(--p8) 0; text-align: center; font: var(--fs-ui) / 20px var(--f-ui); color: var(--c-mute); }
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
