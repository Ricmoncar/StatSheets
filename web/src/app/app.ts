import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { NotifyService } from './core/notify.service';
import { SoundService } from './core/sound.service';

@Component({
  selector: 'ss-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly notifier = inject(NotifyService);
  protected readonly sound = inject(SoundService);
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
