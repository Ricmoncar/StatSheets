import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Character } from '../../core/data/models';
import { THEME_MAX_MB, ThemeMusic, fmtTime, formTheme, isJuko, parseTime } from '../../core/theme-music.service';
import { LiveField } from '../../ui/live-field';
import { Icon } from '../../ui/icon';

/** The MUSIC tab: a theme song per form, with where it starts and loops back to. */
@Component({
  selector: 'ss-music-tab',
  imports: [LiveField, Icon],
  host: { class: 'u-fr u-stone' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (juko()) {
      <div class="locked">
        <p class="locked-title"><i class="u-spr s-eq u-anim" aria-hidden="true"></i>{{ jukoTrack() }}<i class="u-spr s-eq u-anim" aria-hidden="true"></i></p>
        <p class="locked-text">NO! GO AWAY!!! DON'T CHANGE MY MUSIC!!!!<br />It's locked! <em>it can't be changed or removed.</em></p>
        <p class="locked-tag">&lt;/&gt; LOCKED!!!!!amp;&amp;</p>
      </div>
    } @else {
      <ul class="forms">
        @for (f of forms(); track f.idx) {
          <li class="form">
            <span class="label">{{ f.label }}</span>
            @if (f.song; as song) {
              <i class="note u-spr s-eq" [class.u-anim]="music.isPlaying(character().id, f.idx)" [class.on]="music.isPlaying(character().id, f.idx)" aria-hidden="true"></i>
              <div class="details">
                <span class="name">{{ song.name || 'UNTITLED' }}</span>
                <label class="start">
                  <span class="slbl">START</span>
                  <input type="text" placeholder="0:00" title="Type a time (M:SS or seconds)" [delay]="dayMs"
                         [ssLiveField]="fmt(song.startAt || 0)" (commit)="setStart(f.idx, $event)"
                         (keydown.enter)="$any($event.target).blur()" (focus)="$any($event.target).select()" />
                </label>
                <button type="button" class="btn u-btn sm" (click)="music.captureStart(character(), f.idx)" title="Set to current playback position"><ss-icon name="check" />NOW</button>
              </div>
              <div class="controls">
                <button type="button" class="btn u-btn sm" [class.primary]="music.isPlaying(character().id, f.idx)" (click)="music.playForm(character(), f.idx)"><ss-icon [name]="music.isPlaying(character().id, f.idx) ? 'pause' : 'play'" />{{ music.isPlaying(character().id, f.idx) ? 'PAUSE' : 'PLAY' }}</button>
                <label class="btn u-btn sm"><ss-icon name="pencil" />CHANGE<input type="file" accept="audio/*" hidden (change)="upload(f.idx, $event)" /></label>
                <button type="button" class="btn danger u-btn sm danger" (click)="music.clear(character(), f.idx)"><ss-icon name="trash" />REMOVE</button>
              </div>
            } @else {
              <span class="none"><ss-icon name="note" [soul]="false" />no theme</span>
              <label class="btn accent u-btn sm primary"><ss-icon name="upload" />UPLOAD MP3<input type="file" accept="audio/*" hidden (change)="upload(f.idx, $event)" /></label>
            }
          </li>
        }
      </ul>
      <p class="limit">Max {{ maxMb }} MB per file · auto-plays on character/form switch</p>
    }
  `,
  styleUrl: './music-tab.scss',
})
export class MusicTab {
  protected readonly music = inject(ThemeMusic);
  readonly character = input.required<Character>();

  protected readonly maxMb = THEME_MAX_MB;
  protected readonly dayMs = 86_400_000;   // the start time saves on Enter or blur, not while typing
  protected readonly fmt = fmtTime;

  protected readonly juko = computed(() => isJuko(this.character()));
  protected readonly jukoTrack = computed(() => formTheme(this.character(), this.character().activeFormIdx || 0)?.name || "JUKO'S THEME");

  protected readonly forms = computed(() => {
    const c = this.character();
    const alt = c.altForms || [];
    return [0, ...alt.map((_, i) => i + 1)].map(idx => {
      const song = formTheme(c, idx);
      return {
        idx,
        label: idx === 0 ? 'BASE' : (alt[idx - 1]?.name || 'FORM ' + idx).toUpperCase(),
        song: song?.url ? song : null,
      };
    });
  });

  protected setStart(formIdx: number, val: string): void {
    this.music.setStartAt(this.character(), formIdx, parseTime(val));
  }

  protected upload(formIdx: number, ev: Event): void {
    const inp = ev.target as HTMLInputElement;
    const file = inp.files?.[0];
    inp.value = '';
    if (file) void this.music.upload(this.character(), formIdx, file);
  }
}
