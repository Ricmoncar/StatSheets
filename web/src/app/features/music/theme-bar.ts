import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeMusic } from '../../core/theme-music.service';
import { Icon } from '../../ui/icon';

const MOBILE = '(max-width: 700px)';

/**
 * The theme music mini-player along the bottom of the screen. It slides up
 * when a song starts, tucks itself away to a strip after 1.5 s, and comes back
 * when the pointer nears the bottom edge (it stays up on phones).
 */
@Component({
  selector: 'ss-theme-bar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    class: 'u-fr u-metal',
    'aria-label': 'Theme music',
    '[class.visible]': "state() === 'visible'",
    '[class.peeked]': "state() === 'peeked'",
    '[class.blocked]': 'music.blocked()',
    '[class.rainbow]': 'last()?.rainbow',
    '[style.--bar-accent]': 'last()?.rainbow ? null : last()?.color',
    '[attr.title]': "music.blocked() ? 'Click anywhere to start music' : null",
    '(mouseenter)': 'enter()',
    '(mouseleave)': 'leave()',
  },
  template: `
    @if (last(); as cur) {
      <button type="button" class="pp u-btn icon" (click)="music.toggle()" title="Play / Pause" [attr.aria-label]="music.playing() ? 'Pause' : 'Play'"><ss-icon [name]="music.playing() ? 'pause' : 'play'" [soul]="false" /></button>
      <i class="eq u-spr s-eq" [class.u-anim]="music.playing()" aria-hidden="true"></i>
      <button type="button" class="info" (click)="openTab(cur.charId)" title="Open Music tab">
        <span class="title">{{ cur.title }}</span>
        <span class="who" [style.color]="cur.rainbow ? null : cur.color">{{ cur.who }}</span>
      </button>
      <input type="range" class="vol" min="0" max="100" [value]="music.volume()"
             (input)="music.setVolume(+$any($event.target).value)" title="Volume" aria-label="Volume" />
      <span class="vol-label" aria-hidden="true">{{ music.volume() }}</span>
      <button type="button" class="bg u-btn sm" [class.on]="music.keepInBackground()" [attr.aria-pressed]="music.keepInBackground()"
              (click)="music.keepInBackground.set(!music.keepInBackground())" title="Keep playing when tab is hidden (off by default)">BG</button>
      <button type="button" class="stop u-btn icon sm" (click)="music.stop()" title="Hide player (theme stays assigned)" aria-label="Hide player"><ss-icon name="x" [soul]="false" /></button>
    }
  `,
  styleUrl: './theme-bar.scss',
})
export class ThemeBar {
  protected readonly music = inject(ThemeMusic);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);

  protected readonly state = signal<'hidden' | 'visible' | 'peeked'>('hidden');
  /** The song shown: the last one, so the bar keeps its text while it slides away. */
  protected readonly last = signal<ReturnType<ThemeMusic['current']>>(null);
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private leaveTimer: ReturnType<typeof setTimeout> | undefined;
  private hovered = false;

  constructor() {
    // every new song shows the bar, then tucks it away
    effect(() => {
      const cur = this.music.current();
      untracked(() => {
        if (cur) { this.last.set(cur); this.show(); } else this.hide();
      });
    });
    // a plain listener: moving the mouse should not wake change detection
    const near = (e: MouseEvent) => {
      if (this.isMobile() || this.state() !== 'peeked') return;
      if (innerHeight - e.clientY <= 80) this.raise();
    };
    this.doc.addEventListener('mousemove', near, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      this.doc.removeEventListener('mousemove', near);
      clearTimeout(this.hideTimer);
      clearTimeout(this.leaveTimer);
    });
  }

  protected enter(): void {
    this.hovered = true;
    if (this.state() !== 'hidden') this.raise();
  }

  protected leave(): void {
    this.hovered = false;
    if (this.isMobile()) return;
    clearTimeout(this.leaveTimer);
    this.leaveTimer = setTimeout(() => { if (this.state() === 'visible') this.state.set('peeked'); }, 700);
  }

  protected openTab(charId: string): void {
    this.music.wantTab.set(true);
    if (!this.router.url.startsWith('/c/' + charId)) void this.router.navigate(['/c', charId]);
  }

  private show(): void {
    this.raise();
    if (this.isMobile()) return;
    this.hideTimer = setTimeout(() => { if (!this.hovered) this.state.set('peeked'); }, 1500);
  }

  private raise(): void {
    clearTimeout(this.hideTimer);
    clearTimeout(this.leaveTimer);
    this.state.set('visible');
  }

  private hide(): void {
    clearTimeout(this.hideTimer);
    clearTimeout(this.leaveTimer);
    this.state.set('hidden');
  }

  private isMobile(): boolean {
    return matchMedia(MOBILE).matches;
  }
}
