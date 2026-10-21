import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { SoundService } from '../core/sound.service';

/** The header's sound button: a panel with mute and the SFX volume. */
@Component({
  selector: 'ss-sfx-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'outside($event)', '(keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button" class="btn" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-controls="sfx-panel" title="Sound effects">
      <svg viewBox="0 0 13 13" width="13" height="13" aria-hidden="true" shape-rendering="crispEdges">
        <path d="M1 4h3v5H1zM4 3h1v7H4zM5 2h1v9H5zM6 1h1v11H6z" fill="currentColor" />
        @if (level() > 0) { <path d="M9 5h1v3H9z" fill="currentColor" /> }
        @if (level() > 1) { <path d="M11 3h1v7h-1z" fill="currentColor" /> }
        @if (level() === 0) { <path d="M9 4h1v1H9zM10 5h1v1h-1zM11 6h1v1h-1zM10 7h1v1h-1zM9 8h1v1H9zM11 4h1v1h-1zM11 8h1v1h-1z" fill="currentColor" /> }
      </svg>
      <span class="sr">{{ sound.muted() ? 'SFX OFF' : 'SFX ON' }}</span>
    </button>
    @if (open()) {
      <div class="panel" id="sfx-panel" role="group" aria-label="Sound effects">
        <span class="label">SOUND EFFECTS</span>
        <div class="row">
          <button type="button" class="mute" (click)="sound.toggleMute()" [attr.aria-pressed]="sound.muted()">{{ sound.muted() ? 'OFF' : 'ON' }}</button>
          <input type="range" min="0" max="100" [value]="percent()" [style.--val]="percent() + '%'"
                 (input)="sound.setVolume(+$any($event.target).value)" title="Volume" aria-label="Sound effects volume" />
          <span class="val">{{ percent() }}</span>
        </div>
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block; }
    .btn { display: inline-flex; gap: 8px; align-items: center; padding: 8px 10px; font-size: var(--ss-text-sm); background: transparent; border: var(--ss-border) solid var(--ss-line-dim); color: var(--ss-fg-dim); &:hover { color: var(--ss-fg); border-color: var(--ss-fg-dim); } }
    .sr { font-size: var(--ss-text-sm); }
    .panel { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; display: grid; gap: 8px; padding: 10px 12px; min-width: 210px; background: var(--ss-bg); border: var(--ss-border) solid var(--ss-line-dim); box-shadow: 4px 4px 0 #000; }
    .label { font-size: var(--ss-text-xs); color: var(--ss-fg-faint); }
    .row { display: flex; gap: 8px; align-items: center; }
    .mute { width: 36px; padding: 4px 0; font-size: var(--ss-text-xs); background: none; border: 1px solid var(--ss-line-dim); color: var(--ss-ok); &[aria-pressed='true'] { color: var(--ss-err); } }
    input { flex: 1; appearance: none; height: 4px; background: linear-gradient(to right, var(--ss-gold) var(--val), #242424 var(--val)); border: 1px solid #2e2e2e;
      &::-webkit-slider-thumb { appearance: none; width: 8px; height: 16px; background: #fff; border: 2px solid #000; }
      &::-moz-range-thumb { width: 8px; height: 16px; background: #fff; border: 2px solid #000; border-radius: 0; } }
    .val { width: 24px; text-align: right; font-size: var(--ss-text-xs); color: var(--ss-fg-dim); }
  `,
})
export class SfxControl {
  protected readonly sound = inject(SoundService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly open = signal(false);
  protected readonly percent = computed(() => Math.round(this.sound.volume() * 100));
  /** 0 muted or silent, 1 quiet, 2 loud: the speaker's sound waves */
  protected readonly level = computed(() => (this.sound.muted() || this.sound.volume() === 0 ? 0 : this.sound.volume() < 0.4 ? 1 : 2));

  protected outside(e: Event): void {
    if (this.open() && !this.el.contains(e.target as Node)) this.open.set(false);
  }
}
