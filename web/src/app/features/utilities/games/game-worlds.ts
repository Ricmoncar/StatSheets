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
        <button type="button" role="tab" class="tab" [class.on]="active() === g.key" [attr.aria-selected]="active() === g.key" [style.--g]="g.color" (click)="active.set(g.key)">
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
    .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--ss-panel-2); }
    .tab { --g: #888; flex: 1; min-width: 110px; display: flex; gap: 8px; align-items: center; justify-content: center; padding: 11px 6px; font-size: 7px; letter-spacing: 3px; background: rgb(255 255 255 / 0.015); border: 1px solid rgb(255 255 255 / 0.06); color: var(--ss-fg-faint);
      &:hover { color: color-mix(in srgb, var(--g) 70%, #fff 0%); border-color: color-mix(in srgb, var(--g) 30%, transparent); }
      &.on { color: var(--g); border-color: var(--g); background: color-mix(in srgb, var(--g) 8%, transparent); box-shadow: inset 0 -3px 0 var(--g); } }
    .icon { font-size: 12px; letter-spacing: 0; }
  `,
})
export class GameWorlds {
  protected readonly games = GAMES;
  protected readonly active = signal<string>('nmt');
}
