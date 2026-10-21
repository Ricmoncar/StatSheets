import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, ElementRef, afterNextRender, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../environments/environment';
import { NotifyService } from './core/notify.service';
import { BADDIE_PAGE, ENCYCLOPEDIA_PAGE } from './core/pages';
import { SettingsService } from './core/settings.service';
import { ConfirmHost } from './ui/confirm-host';
import { ThemeBar } from './features/music/theme-bar';
import { Icon } from './ui/icon';
import { SfxControl } from './ui/sfx-control';
import { TooltipHost } from './ui/tooltip';

@Component({
  selector: 'ss-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmHost, ThemeBar, SfxControl, TooltipHost, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(document:click)': 'outside($event)', '(document:keydown.escape)': 'moreOpen.set(false)' },
})
export class App {
  protected readonly notifier = inject(NotifyService);
  protected readonly settings = inject(SettingsService);
  protected readonly sandboxLabel = environment.collectionPrefix ? environment.sandboxLabel : '';
  /** The page list folded into a menu when the bar is too narrow for it. */
  protected readonly moreOpen = signal(false);

  /**
   * Top bar links, in the old site's order. The Encyclopaedia and SPIN A
   * BADDIE stay the old pages as they are (`href`), shipped next to the app.
   */
  protected readonly nav: { path: string; label: string; href?: string }[] = [
    { path: '/utilities', label: 'UTILITIES' },
    { path: '/gallery', label: 'GALLERY' },
    { path: '/encyclopedia', label: 'ENCYCLOPAEDIA', href: ENCYCLOPEDIA_PAGE },
    { path: '/playlists', label: 'PLAYLISTS' },
    { path: '/bkscorner', label: "BK'S CORNER" },
    { path: '/baddie', label: 'SPIN A BADDIE', href: BADDIE_PAGE },
  ];

  constructor() {
    // performance mode pauses every looping sprite and texture, not only the backgrounds
    const root = inject(DOCUMENT).documentElement;
    effect(() => root.classList.toggle('perf', this.settings.perfMode()));
    inject(Router).events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.moreOpen.set(false));
    // pages that fill the screen (the character sheet) size themselves under the bar
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let ro: ResizeObserver | undefined;
    afterNextRender(() => {
      const bar = host.querySelector<HTMLElement>('.topbar');
      if (!bar) return;
      ro = new ResizeObserver(() => root.style.setProperty('--topbar-h', bar.offsetHeight + 'px'));
      ro.observe(bar);
    });
    inject(DestroyRef).onDestroy(() => ro?.disconnect());
  }

  protected outside(e: Event): void {
    if (this.moreOpen() && !(e.target as Element).closest?.('.more')) this.moreOpen.set(false);
  }
}
