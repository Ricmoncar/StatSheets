import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { NotifyService } from './core/notify.service';
import { SettingsService } from './core/settings.service';
import { ConfirmHost } from './ui/confirm-host';
import { ThemeBar } from './features/music/theme-bar';
import { SfxControl } from './ui/sfx-control';
import { TooltipHost } from './ui/tooltip';

@Component({
  selector: 'ss-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmHost, ThemeBar, SfxControl, TooltipHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly notifier = inject(NotifyService);
  protected readonly settings = inject(SettingsService);
  protected readonly sandboxLabel = environment.collectionPrefix ? environment.sandboxLabel : '';

  /** Top bar links, in the old site's order. */
  protected readonly nav = [
    { path: '/utilities', label: 'UTILITIES' },
    { path: '/gallery', label: 'GALLERY' },
    { path: '/encyclopedia', label: 'ENCYCLOPAEDIA' },
    { path: '/playlists', label: 'PLAYLISTS' },
    { path: '/bkscorner', label: "BK'S CORNER" },
    { path: '/baddie', label: 'SPIN A BADDIE' },
  ];
}
