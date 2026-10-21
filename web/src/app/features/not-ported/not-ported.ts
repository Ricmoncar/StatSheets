import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../ui/icon';

/** Stand-in for a page that has not been ported to the new site yet. */
@Component({
  selector: 'ss-not-ported',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="np u-voice">
      <h1 class="u-display">{{ title() }}</h1>
      <p class="u-say">* This page has not been rebuilt yet.
* It still works on the current site.</p>
      <a class="u-opt" routerLink="/"><ss-icon name="ast" />BACK TO CHARACTERS</a>
    </section>
  `,
  styles: `
    :host { display: grid; place-items: center; padding: var(--p12) max(16px, env(safe-area-inset-right, 0px)) var(--p12) max(16px, env(safe-area-inset-left, 0px)); }
    .np { display: grid; gap: var(--p5); width: min(100%, calc(220 * var(--px))); padding: var(--p6); box-shadow: 0 var(--p3) 0 var(--c-void); }
    h1 { margin: 0; text-transform: uppercase; }
    p { margin: 0; }
    a { text-decoration: none; justify-self: start; }
  `,
})
export class NotPorted {
  readonly title = input('');
}
