import { ChangeDetectionStrategy, Component, DOCUMENT, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../environments/environment';
import { NotifyService } from './core/notify.service';
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

  /** Top bar links, in the old site's order. */
  protected readonly nav = [
    { path: '/utilities', label: 'UTILITIES' },
    { path: '/gallery', label: 'GALLERY' },
    { path: '/encyclopedia', label: 'ENCYCLOPAEDIA' },
    { path: '/playlists', label: 'PLAYLISTS' },
    { path: '/bkscorner', label: "BK'S CORNER" },
    { path: '/baddie', label: 'SPIN A BADDIE' },
  ];

  constructor() {
    // performance mode pauses every looping sprite and texture, not only the backgrounds
    const root = inject(DOCUMENT).documentElement;
    effect(() => root.classList.toggle('perf', this.settings.perfMode()));
    inject(Router).events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.moreOpen.set(false));
  }

  protected outside(e: Event): void {
    if (this.moreOpen() && !(e.target as Element).closest?.('.more')) this.moreOpen.set(false);
  }
}
