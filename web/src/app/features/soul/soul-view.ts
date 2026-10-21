import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Soul, buildSoulSvg } from '../../core/game/soul';

/**
 * Draws a soul. The SVG comes from buildSoulSvg, which validates every value
 * it puts in the markup, so it is safe to hand to the page as trusted HTML.
 */
@Component({
  selector: 'ss-soul-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="soul" [innerHTML]="svg()"></span>`,
  styles: `
    :host { display: inline-block; line-height: 0; }
    .soul ::ng-deep .soul-svg { image-rendering: pixelated; overflow: visible; }
    .soul ::ng-deep .soul-svg.beat { animation: soul-beat 1.1s steps(4) infinite; transform-origin: 50% 55%; }
    .soul ::ng-deep .soul-cycle { animation: soul-cycle 6s linear infinite; }
    @keyframes soul-beat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.12); } 30% { transform: scale(1); } 45% { transform: scale(1.06); } }
    @keyframes soul-cycle { to { filter: hue-rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .soul ::ng-deep * { animation: none !important; } }
  `,
})
export class SoulView {
  private readonly sanitizer = inject(DomSanitizer);
  readonly soul = input.required<Soul>();
  readonly px = input(72);
  protected readonly svg = computed(() => this.sanitizer.bypassSecurityTrustHtml(buildSoulSvg(this.soul(), this.px())));
}
