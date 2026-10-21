import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { statBar, tierLabel } from '../core/game/sheet';

/**
 * A segmented stat bar: 20 segments, partial fill on the last one, and
 * prestige tiers drawn over the previous tier's solid colour.
 * Colours come from --ss-<stat> and the --ss-tier-N tokens.
 */
@Component({
  selector: 'ss-stat-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <span class="segs" [attr.data-stat]="stat()" role="img" [attr.aria-label]="stat().toUpperCase() + ' ' + value()">
        @for (s of m.segments; track $index) {
          <span class="seg" [class.back]="s.backTier >= 0" [attr.data-back]="s.backTier" [attr.data-tier]="s.fillTier">
            <span class="fill" [class.peak]="s.peak" [style.width.%]="s.fill"></span>
          </span>
        }
      </span>
      @if (tier()) { <span class="tier">{{ tier() }}</span> }
    }
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 6px; min-width: 0; --c: var(--ss-fg); }
    .segs { flex: 1; display: grid; grid-template-columns: repeat(20, 1fr); gap: 2px; height: 10px; min-width: 0; }
    .seg { position: relative; background: var(--ss-panel-2); overflow: hidden; }
    .seg.back { background: color-mix(in srgb, var(--c) 45%, black); }
    .seg.back[data-back='0'] { background: var(--c); }
    .fill { position: absolute; inset: 0 auto 0 0; background: var(--c); }
    .seg[data-tier]:not([data-tier='0']) .fill { background: var(--ss-tier, #fff); filter: brightness(1.15); }
    .fill.peak { filter: brightness(1.4); }
    .tier { font-size: var(--ss-text-xs); color: var(--ss-accent); }
    [data-stat='hp'] { --c: var(--ss-hp); }
    [data-stat='atk'] { --c: var(--ss-atk); }
    [data-stat='def'] { --c: var(--ss-def); }
    [data-stat='mag'] { --c: var(--ss-mag); }
    [data-stat='spd'] { --c: var(--ss-spd); }
    [data-stat='iq'] { --c: var(--ss-iq); }
  `,
})
export class StatBar {
  readonly stat = input.required<string>();
  readonly value = input.required<number>();
  protected readonly model = computed(() => statBar(this.value(), this.stat()));
  protected readonly tier = computed(() => tierLabel(this.model()?.tier ?? 0));
}
