import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { Sprite, burgerSprite, dieSprite, eggSprite, petSprite } from './art';

/** One of the game's pixel sprites (a pet, a die, an egg), drawn when first asked for, at a whole multiple of its size. */
@Component({
  selector: 'ss-bd-sprite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (s(); as s) {
    <i class="u-spr" [class.u-anim]="s.n > 1" aria-hidden="true"
       [style.--w]="s.w" [style.--h]="s.h" [style.--n]="s.n" [style.--fps]="s.fps" [style.--sc]="scale()"
       [style.--sheet]="sheet()" [style.background-image]="s.n > 1 ? null : sheet()"></i>
  } @else { <i class="ph" aria-hidden="true" [style.width]="box()" [style.height]="box()"></i> }`,
  styles: `:host { display: inline-flex; vertical-align: middle; line-height: 0; } i { image-rendering: pixelated; } .ph { display: inline-block; }`,
})
export class BdSprite {
  readonly kind = input.required<'pet' | 'die' | 'egg' | 'burger'>();
  readonly id = input<string | number>('');
  readonly scale = input(1);
  /** For a die: how many art pixels across it is drawn. */
  readonly size = input(16);
  protected readonly s = signal<Sprite | null>(null);
  protected readonly sheet = computed(() => { const s = this.s(); return s ? `url("${s.url}")` : null; });
  protected readonly box = computed(() => `calc(${this.kind() === 'die' ? this.size() : 20} * var(--px) * ${this.scale()})`);

  constructor() {
    effect(() => {
      const kind = this.kind(), id = this.id(), size = this.size();
      const p = kind === 'pet' ? petSprite(String(id)) : kind === 'die' ? dieSprite(+id, size) : kind === 'egg' ? eggSprite(String(id)) : burgerSprite();
      p.then(s => this.s.set(s));
    });
  }
}
