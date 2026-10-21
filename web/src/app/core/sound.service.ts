import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';

/** Every sound file in sounds/, by name. */
export type SoundName =
  | 'cancel' | 'characterchange' | 'characterclick' | 'characterclick2' | 'click' | 'delete'
  | 'dicealt' | 'diceroll' | 'equip' | 'gaster' | 'hexxed' | 'hover' | 'juko-0inf' | 'juko-1'
  | 'juko' | 'legendary' | 'max' | 'minimum' | 'mythic' | 'pop' | 'rolldone' | 'save';

export interface PlayOptions {
  /** playback rate, clamped to 0.1..4 */
  rate?: number;
  /** 0..1, multiplied by the global volume */
  volume?: number;
}

// Same keys as the old site, which shares this origin: a player who muted
// the old site stays muted on the new one.
const VOLUME_KEY = 'sfx_volume';
const MUTED_KEY = 'sfx_muted';

/** Elements that click when pressed (the old global capture listener). */
const CLICK_SEL = 'button, [data-sfx-click], [data-tooltip]';
/** Elements that make the hover blip. */
const HOVER_SEL = 'button, [data-sfx-hover], [data-tooltip]';
/** Containers whose own handlers play something else (character entries). */
const SILENT_SEL = '[data-sfx-silent]';

/**
 * Sound effects: the old site's playSound, the global SFX volume and mute,
 * and the click and hover sounds on every interactive element.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly doc = inject(DOCUMENT);
  readonly volume = signal(readNumber(VOLUME_KEY, 1));   // 0..1
  readonly muted = signal(readString(MUTED_KEY) === '1');
  private hoverCooldown = false;
  private wired = false;

  play(name: SoundName, { rate = 1, volume = 1 }: PlayOptions = {}): HTMLAudioElement | undefined {
    if (this.muted()) return undefined;
    try {
      const audio = new Audio(`${environment.assetBase}sounds/${name}.mp3`);
      audio.volume = Math.max(0, Math.min(1, volume * this.volume()));
      audio.playbackRate = Math.max(0.1, Math.min(4, rate));
      audio.play().catch(() => { /* autoplay blocked before the first interaction */ });
      return audio;
    } catch {
      return undefined;
    }
  }

  click(): void {
    this.play('click', { rate: 0.9 + Math.random() * 0.3, volume: 0.4 });
  }

  hover(): void {
    if (this.hoverCooldown) return;
    this.hoverCooldown = true;
    this.play('hover', { rate: 0.9 + Math.random() * 0.3, volume: 0.45 });
    setTimeout(() => { this.hoverCooldown = false; }, 55);
  }

  /** 0..100 */
  setVolume(percent: number): void {
    const v = Math.max(0, Math.min(100, percent)) / 100;
    this.volume.set(v);
    write(VOLUME_KEY, String(v));
  }

  toggleMute(): void {
    this.muted.update(m => !m);
    write(MUTED_KEY, this.muted() ? '1' : '0');
  }

  /** Global click and hover sounds; call once at startup. */
  wireGlobalSounds(): void {
    if (this.wired) return;
    this.wired = true;
    this.doc.addEventListener('click', e => {
      const t = (e.target as Element | null)?.closest?.(CLICK_SEL);
      if (t && !t.closest(SILENT_SEL)) this.click();
    }, true);
    this.doc.addEventListener('mouseover', e => {
      const t = (e.target as Element | null)?.closest?.(HOVER_SEL);
      if (t) this.hover();
    });
  }
}

function readString(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function readNumber(key: string, fallback: number): number {
  const v = parseFloat(readString(key) ?? '');
  return isNaN(v) ? fallback : v;
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
}
