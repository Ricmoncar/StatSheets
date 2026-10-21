import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Character } from '../../core/data/models';
import { formatGold, overallPowerLevel } from '../../core/game/sheet';
import { effectiveStats } from '../../core/game/stats';
import { StatBar } from '../../ui/stat-bar';

const MAIN = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'] as const;

/** The open character sheet (first slice: header and core stats). */
@Component({
  selector: 'ss-character-view',
  imports: [StatBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = character();
    <article class="sheet" [style.--ss-accent]="c.color || '#ffff00'">
      <header class="head">
        <div class="portrait">
          @if (avatar(); as a) { <img [src]="a" alt="" /> }
        </div>
        <div class="who">
          <h1 class="name">{{ c.name }}</h1>
          @if (formName(); as f) { <span class="form">{{ f }}</span> }
          @if (c.info?.owner) { <p class="owner">BY {{ c.info?.owner }}</p> }
          <p class="pl" [style.color]="pl().color">{{ pl().label }} LEVEL</p>
          <p class="gold" [class.neg]="(c.gold || 0) < 0">G {{ gold() }}</p>
          @if (c.bio) { <p class="bio">{{ c.bio }}</p> }
        </div>
      </header>

      <section class="panel" aria-labelledby="stats-h">
        <h2 id="stats-h">STATS</h2>
        @for (k of main; track k) {
          <div class="row">
            <span class="label">{{ k.toUpperCase() }}</span>
            <ss-stat-bar [stat]="k" [value]="eff()[k]" />
            <span class="num">{{ eff()[k] }}</span>
          </div>
        }
      </section>
    </article>
  `,
  styleUrl: './character-view.scss',
})
export class CharacterView {
  readonly character = input.required<Character>();
  protected readonly main = MAIN;
  protected readonly eff = computed(() => effectiveStats(this.character()));
  protected readonly pl = computed(() => overallPowerLevel(this.eff()));
  protected readonly gold = computed(() => formatGold(this.character().gold || 0));
  /** The active form's portrait, falling back to the base one. */
  protected readonly avatar = computed(() => {
    const c = this.character();
    const idx = c.activeFormIdx || 0;
    return (idx > 0 && c.altForms?.[idx - 1]?.avatar) || c.avatar || null;
  });
  protected readonly formName = computed(() => {
    const c = this.character();
    const idx = c.activeFormIdx || 0;
    return idx > 0 ? (c.altForms?.[idx - 1]?.name || `FORM ${idx}`) : (c.altForms?.length ? 'BASE' : '');
  });
}
