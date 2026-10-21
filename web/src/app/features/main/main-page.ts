import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { SoundService } from '../../core/sound.service';
import { ThemeMusic, formTheme } from '../../core/theme-music.service';
import { CharacterView } from './character-view';
import { Sidebar } from './sidebar';
import { PatternCanvas } from '../../ui/pattern-canvas';

// Which character the page opens on: the last one THIS browser looked at
// (shared key with the old site, same origin), then Blackjack, then the first.
const LAST_CHAR_KEY = 'statsheets_last_char';
const BLACKJACK = /^blackjack$/i;
const NARA = /^NARA!+$/;

@Component({
  selector: 'ss-main-page',
  imports: [Sidebar, CharacterView, PatternCanvas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-sidebar [activeId]="current()?.id ?? null" (pick)="open($event)" />
    <section class="stage">
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
    :host { display: grid; grid-template-columns: 260px 1fr; height: calc(100dvh - 60px); min-height: 0; }
    .stage { position: relative; min-height: 0; overflow: hidden; }
    .bg { opacity: 0.3; }
    .view { position: relative; z-index: 1; height: 100%; overflow-y: auto; }
    .empty { padding: 64px 16px; text-align: center; color: var(--ss-fg-dim); }
    @media (max-width: 760px) { :host { grid-template-columns: 1fr; height: auto; } .view { height: auto; } }
  `,
})
export class MainPage {
  protected readonly store = inject(CharacterStore);
  private readonly router = inject(Router);
  private readonly sound = inject(SoundService);

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

  protected open(c: Character): void {
    if (c.isPlaceholder) {
      void this.router.navigate(['/edit', c.id]);   // a draft resumes in the editor
      return;
    }
    this.sound.play('characterchange', { volume: 0.7 });
    void this.router.navigate(['/c', c.id]);
  }

  private startId(chars: Character[]): string | null {
    let id: string | null = null;
    try { id = localStorage.getItem(LAST_CHAR_KEY); } catch { /* storage blocked */ }
    if (id && chars.some(x => x.id === id)) return id;
    const bj = chars.find(x => BLACKJACK.test((x.name || '').trim()));
    return bj ? bj.id : chars[0]?.id ?? null;
  }
}
