import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { SoundService } from '../../core/sound.service';
import { ThemeMusic, formTheme } from '../../core/theme-music.service';
import { CharacterView } from './character-view';
import { Sidebar } from './sidebar';
import { PatternCanvas } from '../../ui/pattern-canvas';
import { Icon } from '../../ui/icon';
import { PixelTheme } from '../../core/pixel/pixel-theme.service';

// Which character the page opens on: the last one THIS browser looked at
// (shared key with the old site, same origin), then Blackjack, then the first.
const LAST_CHAR_KEY = 'statsheets_last_char';
const BLACKJACK = /^blackjack$/i;
const NARA = /^NARA!+$/;

@Component({
  selector: 'ss-main-page',
  imports: [Sidebar, CharacterView, PatternCanvas, Icon],
  host: { '(document:keydown.escape)': 'drawer.set(false)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-sidebar [class.open]="drawer()" [activeId]="current()?.id ?? null" (pick)="open($event)" />
    @if (drawer()) { <div class="scrim u-scrim" (click)="drawer.set(false)"></div> }
    <section class="stage">
      <button type="button" class="drawer-btn u-btn sm" (click)="drawer.set(true)" [attr.aria-expanded]="drawer()"><ss-icon name="menu" [soul]="false" />CHARACTERS</button>
      <ss-pattern-canvas class="bg" [type]="pattern()?.type" [params]="pattern()?.params" [rainbow]="rainbow()" />
      <div class="view">
        @if (current(); as c) {
          <ss-character-view [character]="c" />
        } @else if (store.status() === 'live' && !store.characters().length) {
          <p class="empty">NO CHARACTERS YET</p>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: grid; grid-template-columns: calc(104 * var(--px)) minmax(0, 1fr); height: calc(100dvh - var(--topbar-h, 84px)); min-height: 0; }
    .stage { position: relative; min-height: 0; overflow: hidden; }
    .bg { opacity: 0.3; }
    .view { position: relative; z-index: 1; height: 100%; overflow-y: auto; }
    .empty { padding: var(--p12) 16px; text-align: center; color: var(--c-mute); font: var(--fs-ui) / 20px var(--f-ui); }
    @media (max-width: 1000px) { :host { grid-template-columns: calc(90 * var(--px)) minmax(0, 1fr); } }
    .drawer-btn, .scrim { display: none; }
    // phones: the list slides in over the sheet from the left
    @media (max-width: 760px) {
      :host { grid-template-columns: minmax(0, 1fr); height: auto; }
      .view { height: auto; }
      .drawer-btn { display: inline-flex; position: relative; z-index: 2; margin: var(--p4) 0 0 max(16px, env(safe-area-inset-left, 0px)); }
      ss-sidebar { position: fixed; z-index: 34; left: 0; top: var(--topbar-h, 60px); bottom: 0; width: min(calc(150 * var(--px)), 88vw); transform: translateX(-105%); transition: transform 0.2s steps(4, end); }
      ss-sidebar.open { transform: none; box-shadow: var(--p2) 0 0 var(--c-void); }
      .scrim { display: block; position: fixed; inset: var(--topbar-h, 60px) 0 0; z-index: 33; }
    }
  `,
})
export class MainPage {
  protected readonly store = inject(CharacterStore);
  private readonly router = inject(Router);
  private readonly sound = inject(SoundService);

  /** On phones the character list is a drawer. */
  protected readonly drawer = signal(false);

  /** From the route /c/:id */
  readonly id = input<string>();

  protected readonly current = computed<Character | null>(() => {
    const id = this.id();
    return id ? this.store.byId().get(id) ?? null : null;
  });

  private readonly music = inject(ThemeMusic);

  /** The generic background pattern (the custom pages come in phase 2). */
  protected readonly pattern = computed(() => this.current()?.pattern ?? null);
  protected readonly rainbow = computed(() => NARA.test(this.current()?.name || ''));

  /** What should be playing: the open character's form and its song. */
  private readonly themeKey = computed(() => {
    const c = this.current();
    if (!c) return null;
    const idx = c.activeFormIdx || 0;
    return `${c.id}:${idx}:${formTheme(c, idx)?.url || ''}`;
  });

  constructor() {
    // The song follows the form the sheet shows, whoever switched it.
    effect(() => {
      if (!this.themeKey()) return;
      untracked(() => this.music.playFor(this.current()!));
    });
    effect(() => this.music.preload(this.store.characters()));
    // the whole page takes the open character's colour: frames, gems, buttons, scenes
    const theme = inject(PixelTheme);
    effect(() => theme.setAccent(this.current()?.color));
    inject(DestroyRef).onDestroy(() => theme.setAccent(null));
    // At / (or an unknown id), open the start character once the list has loaded.
    effect(() => {
      const chars = this.store.characters();
      if (!chars.length || this.current()) return;
      const id = this.startId(chars);
      if (id) void this.router.navigate(['/c', id], { replaceUrl: true });
    });
    effect(() => {
      const c = this.current();
      if (c) { try { localStorage.setItem(LAST_CHAR_KEY, c.id); } catch { /* storage blocked */ } }
    });
  }

  /** The entry is a link (a draft's goes to the editor); picking one plays the sound. */
  protected open(c: Character): void {
    this.drawer.set(false);
    if (!c.isPlaceholder) this.sound.play('characterchange', { volume: 0.7 });
  }

  private startId(chars: Character[]): string | null {
    let id: string | null = null;
    try { id = localStorage.getItem(LAST_CHAR_KEY); } catch { /* storage blocked */ }
    if (id && chars.some(x => x.id === id)) return id;
    const bj = chars.find(x => BLACKJACK.test((x.name || '').trim()));
    return bj ? bj.id : chars[0]?.id ?? null;
  }
}
