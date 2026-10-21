import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { SoundService } from '../../core/sound.service';
import { CharacterView } from './character-view';
import { Sidebar } from './sidebar';

// Which character the page opens on: the last one THIS browser looked at
// (shared key with the old site, same origin), then Blackjack, then the first.
const LAST_CHAR_KEY = 'statsheets_last_char';
const BLACKJACK = /^blackjack$/i;

@Component({
  selector: 'ss-main-page',
  imports: [Sidebar, CharacterView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-sidebar [activeId]="current()?.id ?? null" (pick)="open($event)" />
    <section class="view">
      @if (current(); as c) {
        <ss-character-view [character]="c" />
      } @else if (store.status() === 'live' && !store.characters().length) {
        <p class="empty">NO CHARACTERS YET</p>
      }
    </section>
  `,
  styles: `
    :host { display: grid; grid-template-columns: 260px 1fr; height: calc(100dvh - 60px); min-height: 0; }
    .view { overflow-y: auto; min-height: 0; }
    .empty { padding: 64px 16px; text-align: center; color: var(--ss-fg-dim); }
    @media (max-width: 760px) { :host { grid-template-columns: 1fr; height: auto; } }
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

  constructor() {
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
