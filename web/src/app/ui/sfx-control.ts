import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { SoundService } from '../core/sound.service';
import { Icon } from './icon';

/** The header's sound button: a frost panel with the SFX switch and volume. */
@Component({
  selector: 'ss-sfx-control',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'outside($event)', '(keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button" class="u-btn icon" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-controls="sfx-panel"
            [attr.aria-label]="sound.muted() ? 'Sound effects off' : 'Sound effects on'" title="Sound effects">
      <ss-icon [name]="sound.muted() || sound.volume() === 0 ? 'mute' : 'speaker'" [soul]="false" />
    </button>
    @if (open()) {
      <div class="panel u-fr u-frost u-snowcap" id="sfx-panel" role="group" aria-label="Sound effects">
        <span class="u-tip-h">SOUND EFFECTS</span>
        <label class="u-tog">
          <input type="checkbox" role="switch" [checked]="!sound.muted()" (change)="sound.toggleMute()" />
          <span class="trk u-spr"><span class="knob u-spr"></span></span>
          <span>SFX</span><span class="state">{{ sound.muted() ? 'OFF' : 'ON' }}</span>
        </label>
        <div class="row">
          <input type="range" min="0" max="100" [value]="percent()" (input)="sound.setVolume(+$any($event.target).value)" aria-label="Sound effects volume" />
          <output class="val">{{ percent() }}</output>
        </div>
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block; }
    .panel { position: absolute; right: 0; top: calc(100% + 12 * var(--px)); z-index: 40; display: grid; gap: var(--p3); padding: var(--p2) var(--p4) var(--p4); min-width: calc(90 * var(--px)); box-shadow: var(--hard); }
    .state { min-width: 4ch; color: var(--c-mute); }
    .u-tog input:checked ~ .state { color: var(--ac3); }
    .row { display: flex; gap: var(--p3); align-items: center; input { flex: 1; min-width: 0; } }
    .val { min-width: 3ch; text-align: right; font: var(--fs-num) / 1 var(--f-body); color: var(--c-white); }
  `,
})
export class SfxControl {
  protected readonly sound = inject(SoundService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly open = signal(false);
  protected readonly percent = computed(() => Math.round(this.sound.volume() * 100));

  protected outside(e: Event): void {
    if (this.open() && !this.el.contains(e.target as Node)) this.open.set(false);
  }
}
