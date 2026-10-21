import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { statBar, tierLabel } from '../core/game/sheet';

/** Prestige tiers stack in this order over the battle bar's yellow (tier 0). */
export const TIER_FILLS = ['var(--c-yel)', 'var(--c-kr)', 'var(--c-ec2)', 'var(--c-grn)', 'var(--c-em2)', 'var(--c-vi3)', 'var(--c-white)', 'var(--c-red)'];

/**
 * A stat bar in Undertale's HP language: 20 segments, yellow over red, with
 * a partial fill on the last one. Prestige tiers fill in KR magenta (then
 * cyan, green...) over a bar already full of the tier below. The stat's own
 * colour lives on its icon, not here.
 */
@Component({
  selector: 'ss-stat-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <span class="segs" role="img" [attr.aria-label]="stat().toUpperCase() + ' ' + value()">
        @for (s of m.segments; track $index) {
          <span class="seg" [class.back]="s.backTier >= 0" [style.--e]="s.backTier >= 0 ? fill(s.backTier) : null">
            <span class="fill" [class.peak]="s.peak" [style.width.%]="s.fill" [style.--f]="fill(s.fillTier)"></span>
          </span>
        }
      </span>
      @if (tier()) { <span class="tier" [style.--f]="fill(m.tier)">{{ tier() }}</span> }
    }
  `,
  styles: `
    :host { display: flex; align-items: center; gap: var(--p2); min-width: 0; }
    .segs { flex: 1; display: grid; grid-template-columns: repeat(20, minmax(0, 1fr)); gap: var(--px); padding: var(--px); min-width: 0; background: var(--c-void); }
    .seg { position: relative; height: calc(5 * var(--px)); overflow: hidden; background: var(--c-red-d); box-shadow: inset 0 var(--px) 0 var(--c-red); }
    .seg.back { background: var(--e); box-shadow: inset 0 var(--px) 0 color-mix(in srgb, var(--e), #fff 55%), inset 0 calc(-1 * var(--px)) 0 color-mix(in srgb, var(--e), #000 35%); }
    .fill { --f: var(--c-yel); position: absolute; inset: 0 auto 0 0; background: var(--f); box-shadow: inset 0 var(--px) 0 color-mix(in srgb, var(--f), #fff 55%), inset 0 calc(-1 * var(--px)) 0 color-mix(in srgb, var(--f), #000 35%); }
    .fill.peak { box-shadow: inset 0 var(--px) 0 #fff, inset 0 calc(-1 * var(--px)) 0 color-mix(in srgb, var(--f), #000 35%); }
    .tier { --f: var(--c-kr); display: inline-grid; place-items: center; height: calc(8 * var(--px)); padding: 0 var(--p1); font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-void); background: var(--f); box-shadow: 0 0 0 var(--px) var(--c-void); white-space: nowrap; }
  `,
})
export class StatBar {
  readonly stat = input.required<string>();
  readonly value = input.required<number>();
  protected readonly model = computed(() => statBar(this.value(), this.stat()));
  protected readonly tier = computed(() => tierLabel(this.model()?.tier ?? 0));

  /** Tier 0 is yellow; prestige tiers cycle through the rest. */
  protected fill(t: number): string { return t <= 0 ? TIER_FILLS[0] : TIER_FILLS[1 + ((t - 1) % (TIER_FILLS.length - 1))]; }
}
