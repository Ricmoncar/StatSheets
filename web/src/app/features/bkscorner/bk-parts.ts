import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { Character } from '../../core/data/models';
import { Icon } from '../../ui/icon';

/** A character as a small tag: their picture and name, in their colour. */
@Component({
  selector: 'ss-char-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--c]': "c().color || '#ffffff'" },
  template: `
    @if (c().avatar) { <img [src]="c().avatar" alt="" draggable="false" loading="lazy" /> } @else { <span class="noimg">?</span> }
    <span class="nm">{{ c().name || '???' }}</span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: var(--p2); max-width: 100%; padding: var(--px) var(--p2) var(--px) var(--px); background: var(--c-ink2); box-shadow: inset 0 0 0 var(--px) color-mix(in srgb, var(--c) 40%, transparent); }
    img, .noimg { width: calc(8 * var(--px)); height: calc(8 * var(--px)); flex: none; object-fit: cover; }
    .noimg { display: grid; place-items: center; font: var(--fs-small) / 1 var(--f-ui); color: var(--c-mute); background: var(--c-void); }
    .nm { font: var(--fs-small) / 1.3 var(--f-body); color: var(--c); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class CharChip {
  readonly c = input.required<Character>();
}

/** Picks any number of characters: a search over portraits that tick when chosen. */
@Component({
  selector: 'ss-char-pick',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="u-field">
      <ss-icon name="search" [soul]="false" />
      <input type="search" placeholder="Search characters" aria-label="Search characters" [value]="query()" (input)="query.set($any($event.target).value)" />
    </label>
    <div class="opts u-fr u-inset" role="group" [attr.aria-label]="label()">
      @for (c of shown(); track c.id) {
        @let on = selected().includes(c.id);
        <button type="button" class="opt" [class.on]="on" [attr.aria-pressed]="on" [style.--c]="c.color || '#ffffff'" (click)="toggle(c.id)">
          <span class="av">
            @if (c.avatar) { <img [src]="c.avatar" alt="" draggable="false" loading="lazy" /> } @else { ? }
            @if (on) { <span class="tick"><ss-icon name="check" [soul]="false" /></span> }
          </span>
          <span class="nm">{{ c.name || 'UNNAMED' }}</span>
        </button>
      } @empty {
        <p class="none">{{ chars().length ? 'NO MATCHES' : 'NO CHARACTERS YET' }}</p>
      }
    </div>
  `,
  styles: `
    :host { display: grid; gap: var(--p2); }
    .opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(30 * var(--px)), 1fr)); gap: var(--p2); max-height: calc(80 * var(--px)); overflow-y: auto; padding: var(--p2); background-color: var(--c-ink); }
    .opt { display: grid; justify-items: center; gap: var(--p1); padding: var(--p1); text-align: center;
      &:hover, &:focus-visible { background: var(--c-ink2); .nm { color: var(--c-yel); } }
      &.on { background: color-mix(in srgb, var(--c) 16%, transparent); .av { box-shadow: 0 0 0 var(--px) var(--c-void), 0 0 0 var(--p1) var(--c); } .nm { color: var(--c-white); } } }
    .av { position: relative; width: calc(20 * var(--px)); height: calc(20 * var(--px)); display: grid; place-items: center; overflow: hidden; background: var(--c-void); color: var(--c-mute); font: var(--fs-ui) / 1 var(--f-ui); box-shadow: 0 0 0 var(--px) var(--c-void), 0 0 0 var(--p1) var(--c-ash);
      img { width: 100%; height: 100%; object-fit: cover; } }
    .tick { position: absolute; right: 0; bottom: 0; display: grid; place-items: center; padding: var(--px); color: var(--c-void); background: var(--c-grn); }
    .nm { max-width: 100%; font: var(--fs-small) / 1.2 var(--f-body); color: var(--c-bone); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .none { grid-column: 1 / -1; margin: 0; padding: var(--p4); text-align: center; font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-mute); }
  `,
})
export class CharPick {
  readonly chars = input.required<Character[]>();
  readonly selected = model<string[]>([]);
  readonly label = input('Characters');
  protected readonly query = signal('');
  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.chars().filter(c => (c.name || '').toLowerCase().includes(q)) : this.chars();
  });

  protected toggle(id: string): void {
    const s = this.selected();
    this.selected.set(s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
}
