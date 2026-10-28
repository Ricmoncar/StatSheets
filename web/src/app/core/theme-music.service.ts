import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { CharacterStore } from './data/character-store';
import { Character, ThemeSong } from './data/models';
import { CLOUDINARY_BACKUPS, cldAudio, cldSwap, uploadMedia } from './media';
import { NotifyService } from './notify.service';

export type { ThemeSong };
export const THEME_MAX_MB = 20;

// Juko's themes are locked to the bundled files (they are what his page's
// music-reactive effects analyse), and cannot be changed or removed.
const JUKO = /^Juko!?$/i;
const JUKO_0INF = /0\s*.?\s*∞|infinity/i;
const JUKO_1 = /^\s*1\s*$/;
// NARA!'s name, and so her mini-player, cycles through the rainbow
const NARA = /^NARA!+$/;

function activeFormName(c: Character): string {
  const idx = c.activeFormIdx || 0;
  return idx ? ((c.altForms || [])[idx - 1]?.name || '') : '';
}
export function isJuko(c: Character | null | undefined): boolean {
  return !!(c && c.name && JUKO.test(c.name));
}

/** The theme for a form (0 = base), or null. */
export function formTheme(c: Character | null | undefined, formIdx: number): ThemeSong | null {
  if (!c) return null;
  if (isJuko(c)) {
    const fn = activeFormName(c);
    if (JUKO_0INF.test(fn)) return { url: environment.assetBase + 'sounds/juko-0inf.mp3', name: '0 ∞', startAt: 0, locked: true };
    if (JUKO_1.test(fn)) return { url: environment.assetBase + 'sounds/juko-1.mp3', name: 'UNIVERSAL COLLAPSE', startAt: 0, locked: true };
    return { url: environment.assetBase + 'sounds/juko.mp3', name: "JUKO'S THEME", startAt: 0, locked: true };
  }
  if (formIdx === 0) return c.info?.themeSong || null;
  return (c.altForms || [])[formIdx - 1]?.themeSong || null;
}

/** "M:SS" */
export function fmtTime(s: number): string {
  s = Math.max(0, s || 0);
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}

/** "1:23" or "83" (seconds) to seconds; nothing sensible gives 0. */
export function parseTime(val: string): number {
  const v = (val || '').trim();
  if (v.includes(':')) {
    const [m, s] = v.split(':');
    return Math.max(0, (parseInt(m, 10) || 0) * 60 + (parseFloat(s) || 0));
  }
  return Math.max(0, parseFloat(v) || 0);
}

const key = (charId: string, formIdx: number) => charId + ':' + (formIdx || 0);
/** Routes the music keeps playing on: the sheet and the character editor. */
const SHEET_URL = /^\/(c\/|edit\/|new\b|[?#]|$)/;

/**
 * Per-character theme music and its mini-player (the old THEME MUSIC PLAYER).
 * One audio element, 800ms crossfades, a start point per song that looping
 * returns to, the position of each character and form remembered for the
 * session, autoplay unlocked by the first interaction, a pause when the tab is
 * hidden (unless BG is on), and a fallback through the original file and the
 * backup accounts when a song fails to load.
 */
/** The theme's audio element, for the character pages that move to the song (they have no injector of their own). */
export const themeAudio: { el: HTMLAudioElement | null } = { el: null };

@Injectable({ providedIn: 'root' })
export class ThemeMusic {
  private readonly doc = inject(DOCUMENT);
  private readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly audio = new Audio();

  /** "charId:formIdx" of the track loaded, or null. */
  readonly currentKey = signal<string | null>(null);
  readonly current = signal<{ charId: string; title: string; who: string; color: string; rainbow: boolean } | null>(null);
  /** Set by the mini-player to ask the sheet for its MUSIC tab. */
  readonly wantTab = signal(false);
  readonly playing = signal(false);
  readonly volume = signal(20);   // 0..100, as on the old site
  readonly keepInBackground = signal(false);
  readonly blocked = signal(false);

  private song: ThemeSong | null = null;
  private readonly positions = new Map<string, number>();
  private readonly reloadKeys = new Set<string>();
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private loadGen = 0;
  private fallbackStage = 0;
  private rawUrl = '';
  private wired = false;

  constructor() {
    themeAudio.el = this.audio;
    this.audio.loop = false;   // looped by hand so startAt is respected
    this.audio.addEventListener('ended', () => {
      if (!this.song) return;
      this.audio.currentTime = this.song.startAt || 0;
      this.audio.play().catch(() => { /* blocked */ });
    });
    this.audio.addEventListener('play', () => this.playing.set(true));
    this.audio.addEventListener('pause', () => this.playing.set(false));
    this.audio.addEventListener('error', () => this.onError());
  }

  /** Autoplay unlock and the hidden-tab pause; call once at startup. */
  wire(): void {
    if (this.wired) return;
    this.wired = true;
    for (const type of ['click', 'keydown', 'touchstart', 'mousedown']) {
      this.doc.addEventListener(type, () => this.unlock(), { capture: true, passive: true });
    }
    this.doc.addEventListener('visibilitychange', () => {
      if (this.keepInBackground()) return;
      if (this.doc.hidden && this.currentKey() && !this.audio.paused) {
        this.positions.set(this.currentKey()!, this.audio.currentTime);
        this.audio.pause();
      }
    });
    // The other pages were separate documents on the old site, so the music
    // ended there; it carries on into the editor, which was a modal.
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd && !SHEET_URL.test(e.urlAfterRedirects)) this.stop();
    });
  }

  /**
   * Plays the theme of the character's active form (or of formIdx, or the
   * given song), crossfading from whatever plays now. The song already loaded
   * for that form is left alone.
   */
  playFor(c: Character, override: ThemeSong | null = null, formIdx = c.activeFormIdx || 0): void {
    const k = key(c.id, formIdx);
    const song = override || formTheme(c, formIdx);
    if (!override && song && this.currentKey() === k && this.song?.url === song.url) return;
    if (!song || !song.url) {
      const was = this.currentKey();
      if (was) {
        this.positions.set(was, this.audio.currentTime);
        this.currentKey.set(null);
        this.song = null;
        this.current.set(null);
        const gen = ++this.loadGen;
        this.fadeOut(() => { if (gen === this.loadGen) this.audio.pause(); });
      }
      return;
    }
    if (this.currentKey() && this.currentKey() !== k) this.positions.set(this.currentKey()!, this.audio.currentTime);
    const startAt = this.positions.has(k) ? this.positions.get(k)! : (song.startAt || 0);
    this.currentKey.set(k);
    this.song = song;
    const gen = ++this.loadGen;

    const load = () => {
      if (gen !== this.loadGen) return;   // a newer request superseded this one
      const fresh = this.reloadKeys.delete(k);
      this.audio.pause();
      this.audio.src = '';
      const url = fresh ? song.url + (song.url.includes('?') ? '&' : '?') + '_v=' + Date.now() : song.url;
      this.rawUrl = url;
      this.fallbackStage = 0;
      this.audio.src = cldAudio(url);
      this.audio.load();
      this.audio.currentTime = startAt;
      this.audio.play().then(() => this.blocked.set(false)).catch(err => {
        if (gen !== this.loadGen) return;
        if (err && err.name === 'NotAllowedError') this.blocked.set(true);
      });
      this.fadeIn();
    };
    if (!this.audio.paused) this.fadeOut(load); else load();

    const formLabel = formIdx === 0 ? '' : ` · ${((c.altForms || [])[formIdx - 1]?.name || 'FORM ' + formIdx).toUpperCase()}`;
    this.current.set({
      charId: c.id, title: song.name || 'UNTITLED', who: (c.name || '') + formLabel,
      color: c.color || '#ffff00', rainbow: NARA.test(c.name || ''),
    });
  }

  /** A form card's PLAY: pauses or resumes its song if loaded, else loads it. */
  playForm(c: Character, formIdx: number): void {
    if (this.currentKey() === key(c.id, formIdx)) this.toggle();
    else this.playFor(c, null, formIdx);
  }

  toggle(): void {
    if (!this.currentKey()) return;
    if (!this.audio.paused) {
      this.positions.set(this.currentKey()!, this.audio.currentTime);
      this.audio.pause();
    } else {
      this.audio.play().catch(() => { /* blocked */ });
    }
  }

  setVolume(v: number): void {
    this.volume.set(Math.max(0, Math.min(100, v)));
    if (this.fadeTimer) { clearInterval(this.fadeTimer); this.fadeTimer = null; }
    this.audio.volume = this.volume() / 100;
  }

  /** Hides the mini-player; the theme stays assigned. */
  stop(): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    if (this.currentKey()) this.positions.set(this.currentKey()!, this.audio.currentTime);
    this.audio.pause();
    this.currentKey.set(null);
    this.song = null;
    this.current.set(null);
  }

  isPlaying(charId: string, formIdx: number): boolean {
    return this.currentKey() === key(charId, formIdx) && this.playing();
  }

  /** Sets where a song starts (and loops back to). Fails unless the song exists. */
  setStartAt(c: Character, formIdx: number, seconds: number): void {
    const s = formTheme(c, formIdx);
    if (!s || s.locked) return;
    if (this.song && this.song.url === s.url) this.song = { ...this.song, startAt: seconds };
    this.positions.delete(key(c.id, formIdx));
    void this.store.update(c.id, x => {
      const target = formIdx === 0 ? x.info?.themeSong : (x.altForms || [])[formIdx - 1]?.themeSong;
      if (target) target.startAt = seconds;
    });
    this.notifier.notify('START SET: ' + fmtTime(seconds), 'ok');
  }

  /** The current playback position, if this form's song is the one loaded. */
  captureStart(c: Character, formIdx: number): void {
    if (this.currentKey() !== key(c.id, formIdx)) { this.notifier.notify('PLAY THIS TRACK FIRST TO SET A START POINT', 'err'); return; }
    this.setStartAt(c, formIdx, Math.round(this.audio.currentTime * 10) / 10);
  }

  async upload(c: Character, formIdx: number, file: File): Promise<void> {
    if (file.size > THEME_MAX_MB * 1024 * 1024) { this.notifier.notify(`File too large: max ${THEME_MAX_MB} MB`, 'err'); return; }
    const publicId = (formIdx === 0 ? `themes/${c.id}` : `themes/${c.id}_${formIdx}`) + '_' + Date.now();
    this.notifier.notify('Uploading theme...', 'ok');
    try {
      const raw = await uploadMedia(file, 'video', publicId);
      const song: ThemeSong = { url: raw + (raw.includes('?') ? '&' : '?') + 'v=' + Date.now(), name: file.name.replace(/\.[^/.]+$/, '') };
      void this.store.update(c.id, x => {
        if (formIdx === 0) { x.info = x.info || {}; x.info.themeSong = song; }
        else { x.altForms = x.altForms || []; x.altForms[formIdx - 1] = x.altForms[formIdx - 1] || { name: '' }; x.altForms[formIdx - 1].themeSong = song; }
      });
      this.positions.delete(key(c.id, formIdx));
      this.reloadKeys.add(key(c.id, formIdx));
      if ((c.activeFormIdx || 0) === formIdx) this.playFor(c, song);
      this.notifier.notify('Theme set!', 'ok');
    } catch (e) {
      this.notifier.notify('Upload failed: ' + ((e as Error).message || e), 'err');
    }
  }

  clear(c: Character, formIdx: number): void {
    const k = key(c.id, formIdx);
    if (this.currentKey() === k) {
      this.fadeOut(() => { this.audio.pause(); this.audio.src = ''; });
      this.currentKey.set(null);
      this.song = null;
      this.current.set(null);
    }
    void this.store.update(c.id, x => {
      if (formIdx === 0) { if (x.info) delete x.info.themeSong; }
      else if (x.altForms?.[formIdx - 1]) delete x.altForms[formIdx - 1].themeSong;
    });
    this.positions.delete(k);
  }

  // ── preloading: real Audio objects so the browser fills its buffers ──
  private readonly preloaded = new Set<string>();
  private readonly preloadKeep = new Map<string, HTMLAudioElement>();
  private queue: string[] = [];
  private queueTimer: ReturnType<typeof setTimeout> | null = null;

  preload(chars: Character[]): void {
    const urls: string[] = [];
    for (const c of chars) {
      const base = c.info?.themeSong?.url;
      if (base && !this.preloaded.has(base)) urls.push(base);
      for (const f of c.altForms || []) {
        const alt = f?.themeSong?.url;
        if (alt && !this.preloaded.has(alt)) urls.push(alt);
      }
    }
    if (!urls.length) return;
    this.queue = [...new Set([...urls, ...this.queue])];
    this.kick();
  }

  private kick(): void {
    if (this.queueTimer || !this.queue.length) return;
    this.queueTimer = setTimeout(() => {
      this.queueTimer = null;
      const url = this.queue.shift();
      if (url && !this.preloaded.has(url)) {
        this.preloaded.add(url);
        const a = new Audio();
        a.preload = 'metadata';
        a.src = cldAudio(url);
        this.preloadKeep.set(url, a);
      }
      this.kick();
    }, 500);
  }

  // ── internals ──
  private unlock(): void {
    if (!this.blocked()) return;
    this.blocked.set(false);
    this.audio.play().catch(() => { /* still blocked */ });
  }

  /** optimised file fails -> original file -> each backup account in turn */
  private onError(): void {
    const reload = (url: string) => {
      const at = this.audio.currentTime || 0;
      this.audio.src = url;
      this.audio.load();
      try { this.audio.currentTime = at; } catch { /* not seekable yet */ }
      this.audio.play().catch(() => { /* blocked */ });
    };
    if (this.rawUrl && this.audio.src.includes('/br_128k/') && this.fallbackStage === 0) { this.fallbackStage = 1; reload(this.rawUrl); return; }
    for (let i = Math.max(0, this.fallbackStage - 1); i < CLOUDINARY_BACKUPS.length; i++) {
      const alt = cldSwap(this.rawUrl, i);
      if (alt) { this.fallbackStage = i + 2; reload(alt); return; }
    }
  }

  private fadeOut(done: () => void): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    let vol = this.audio.volume;
    if (vol <= 0) { done(); return; }
    const step = vol / 16;   // 16 steps x 50ms = 800ms
    this.fadeTimer = setInterval(() => {
      vol -= step;
      if (vol <= 0) { clearInterval(this.fadeTimer!); this.fadeTimer = null; this.audio.volume = 0; done(); }
      else this.audio.volume = vol;
    }, 50);
  }

  private fadeIn(): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.audio.volume = 0;
    const target = this.volume() / 100;
    let vol = 0;
    const step = target / 16;
    this.fadeTimer = setInterval(() => {
      vol += step;
      if (vol >= target) { clearInterval(this.fadeTimer!); this.fadeTimer = null; this.audio.volume = target; }
      else this.audio.volume = vol;
    }, 50);
  }
}
