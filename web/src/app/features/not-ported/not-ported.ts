import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Stand-in for a page that has not been ported to the new site yet. */
@Component({
  selector: 'ss-not-ported',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="np">
      <h1>{{ title() }}</h1>
      <p>This page has not been rebuilt yet.</p>
      <p>It still works on the current site.</p>
      <a routerLink="/">BACK TO CHARACTERS</a>
    </section>
  `,
  styles: `
    .np { display: grid; gap: 16px; justify-items: center; text-align: center; padding: 80px 16px; }
    h1 { font-size: var(--ss-text-xl); margin: 0; }
    p { color: var(--ss-fg-dim); margin: 0; }
    a { color: var(--ss-accent); }
  `,
})
export class NotPorted {
  readonly title = input('');
}
