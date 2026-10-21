import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICON_PATHS, IconName, SOUL_PATH } from '../core/pixel/icons';

/**
 * A 7x7 pixel icon in currentColor. The SOUL heart hides in the same box:
 * a parent with the .soul-on state (hover, focus, current) swaps it in, per
 * the menu rule in styles.scss.
 */
@Component({
  selector: 'ss-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg class="ico" viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path class="g" [attr.d]="path()" />@if (soul()) {<path class="soul" [attr.d]="soulPath" />}</svg>`,
  styles: `:host { display: inline-flex; flex: none; vertical-align: middle; }`,
})
export class Icon {
  readonly name = input.required<IconName>();
  /** Off for icons that never turn into the SOUL (decorative, inside text). */
  readonly soul = input(true);
  protected readonly path = computed(() => ICON_PATHS[this.name()] || '');
  protected readonly soulPath = SOUL_PATH;
}
