import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NmtGame } from './nmt';
import { CrtlGame } from './crtl';
import { AutGame } from './aut';
import { LolGame } from './lol';
import { FinalHourGame } from './final-hour';

const GAMES = [
  { key: 'nmt', icon: '◈', label: 'NO MORE TIME', color: '#9b5cf0' },
  { key: 'fh', icon: '☠', label: 'ASYM HORROR', color: '#cc2233' },
  { key: 'fg', icon: '⚡', label: 'AUT', color: '#e0961a' },
  { key: 'lol', icon: '⚔', label: 'LOL', color: '#00b4de' },
  { key: 'crtl', icon: '⊙', label: 'CRTL', color: '#36c98a' },
] as const;

/** GAME WORLDS: what your characters would be in five other games. */
@Component({
  selector: 'ss-game-worlds',
  imports: [NmtGame, CrtlGame, AutGame, LolGame, FinalHourGame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" aria-label="Game">
      @for (g of games; track g.key) {
        <button type="button" role="tab" class="tab u-btn u-tab" [class.on]="active() === g.key" [attr.aria-selected]="active() === g.key" [style.--g]="g.color" (click)="active.set(g.key)">
          <span class="icon" aria-hidden="true">{{ g.icon }}</span>{{ g.label }}
        </button>
      }
    </div>
    @switch (active()) {
      @case ('nmt') { <ss-game-nmt /> }
      @case ('crtl') { <ss-game-crtl /> }
      @case ('fg') { <ss-game-aut /> }
      @case ('lol') { <ss-game-lol /> }
      @case ('fh') { <ss-game-fh /> }
    }
  `,
  styles: `
    .tabs { display: flex; gap: var(--p2); flex-wrap: wrap; margin-bottom: var(--p6); padding-bottom: var(--p2); }
    // wooden tabs; the open game is underlined in its own colour
    .tab { --g: #888; flex: 1; min-width: calc(36 * var(--px)); gap: var(--p2); }
    .tab.on::after { background: var(--g); }
    .icon { font-size: var(--fs-body); line-height: 1; color: var(--g); }
    .tab.on .icon { color: var(--c-white); }
  `,
})
export class GameWorlds {
  protected readonly games = GAMES;
  protected readonly active = signal<string>('nmt');
}
