import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { ConfirmService } from '../../core/confirm.service';
import { FIRESTORE, col } from '../../core/firebase';
import { cldSwap, CLOUDINARY_BACKUPS, uploadMedia } from '../../core/media';
import { NotifyService } from '../../core/notify.service';
import { PixelTheme } from '../../core/pixel/pixel-theme.service';
import { Icon } from '../../ui/icon';
import {
  Playlist, Queue, Song, UNTITLED, afterRemove, afterReorder, fmtDuration, fromDoc, moveSong, nextInQueue,
  prevInQueue, queueFrom, reshuffle, songId, titleFromFile, toDoc, totalSeconds,
} from './playlist';

const MOBILE = '(max-width: 640px)';
const NO_QUEUE: Queue = { ids: [], pos: 0 };

/**
 * PLAYLISTS (the old playlists.html): every character's playlist, with a
 * cover, a title and a description edited in place, MP3 uploads, drag to
 * reorder, and a player along the bottom with shuffle, repeat, seeking and
 * volume. Playback follows the playlist it started in, so browsing another
 * character carries on playing.
 */
@Component({
  selector: 'ss-playlists-page',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './playlists-page.html',
  styleUrl: './playlists-page.scss',
  host: { '[class.with-player]': 'barShown()', '[class.mob-main]': 'mobMain()' },
})
export class PlaylistsPage {
  private readonly db = inject(FIRESTORE);
  protected readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);
  private readonly confirm = inject(ConfirmService);
  private readonly theme = inject(PixelTheme);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly fmt = fmtDuration;
  protected readonly UNTITLED = UNTITLED;

  protected readonly chars = computed(() => this.store.characters().filter(c => !c.isPlaceholder));
  /** Playlists loaded so far, by character id. */
  private readonly lists = signal<Record<string, Playlist>>({});
  protected readonly selId = signal<string | null>(null);
  protected readonly selected = computed(() => (this.selId() ? this.store.byId().get(this.selId()!) ?? null : null));
  protected readonly view = computed(() => (this.selId() ? this.lists()[this.selId()!] ?? null : null));
  protected readonly total = computed(() => { const p = this.view(); return p ? totalSeconds(p) : 0; });
  protected readonly mobMain = signal(false);
  protected readonly editing = signal<'title' | 'desc' | null>(null);
  /** The character whose songs are uploading. */
  protected readonly uploadingId = signal<string | null>(null);

  // ── the player ──
  private readonly audio = new Audio();
  protected readonly playId = signal<string | null>(null);
  protected readonly queue = signal<Queue>(NO_QUEUE);
  protected readonly nowSongId = computed(() => this.queue().ids[this.queue().pos] ?? null);
  protected readonly playing = signal(false);
  protected readonly shuffled = signal(false);
  protected readonly repeat = signal(false);
  protected readonly volume = signal(0.7);
  protected readonly muted = signal(false);
  protected readonly time = signal(0);
  protected readonly duration = signal(0);
  protected readonly barShown = signal(false);
  protected seeking = false;
  private fallback = 0;
  private srcUrl = '';
  /** What the bar shows: the song loaded now, or the last one. */
  private readonly lastNow = signal<{ title: string; by: string; art: string } | null>(null);
  protected readonly now = computed(() => {
    const id = this.playId(), sid = this.nowSongId();
    const song = id && sid ? this.lists()[id]?.songs.find(s => s.id === sid) : null;
    if (!song) return this.lastNow();
    const c = this.store.byId().get(id!);
    return { title: song.title || 'Untitled', by: c?.name || '', art: this.lists()[id!]?.image || c?.avatar || '' };
  });

  // ── drag to reorder ──
  protected readonly dragFrom = signal<number | null>(null);
  protected readonly dropAt = signal<{ i: number; above: boolean } | null>(null);

  private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Characters with changes not yet stored; a fresh load does not replace them. */
  private readonly dirty = new Set<string>();

  constructor() {
    const a = this.audio;
    a.volume = this.volume();
    a.addEventListener('timeupdate', () => { if (!this.seeking) this.time.set(a.currentTime); });
    a.addEventListener('loadedmetadata', () => this.onMeta());
    a.addEventListener('ended', () => { if (!this.repeat()) this.next(); });
    a.addEventListener('play', () => this.playing.set(true));
    a.addEventListener('pause', () => this.playing.set(false));
    a.addEventListener('error', () => this.onError());
    inject(DestroyRef).onDestroy(() => {
      a.pause();
      a.removeAttribute('src');
      for (const id of [...this.saveTimers.keys()]) void this.saveNow(id);
      this.theme.setAccent(null);
    });
  }

  protected initial(c: Character): string { return (c.name || '?')[0].toUpperCase(); }
  protected pad(i: number): string { return String(i).padStart(2, '0'); }

  // ── choosing a character ──
  protected async select(c: Character): Promise<void> {
    if (this.selId() === c.id) { this.enterMobile(); return; }
    this.editing.set(null);
    this.selId.set(c.id);
    this.theme.setAccent(c.color || '#7777bb');
    this.enterMobile();
    let p: Playlist;
    try {
      const snap = await getDoc(doc(this.db, col('playlists'), c.id));
      p = fromDoc(snap.exists() ? snap.data() : undefined, c.name);
    } catch (err) {
      console.error('Load playlist error', err);
      p = fromDoc(undefined, c.name);
    }
    if (!this.dirty.has(c.id)) this.lists.update(m => ({ ...m, [c.id]: p }));
  }
  private enterMobile(): void { if (matchMedia(MOBILE).matches) this.mobMain.set(true); }

  private patch(id: string, fn: (p: Playlist) => Playlist): void {
    const cur = this.lists()[id];
    if (cur) this.lists.update(m => ({ ...m, [id]: fn(cur) }));
  }

  // ── title and description, edited in place ──
  protected edit(field: 'title' | 'desc'): void {
    this.editing.set(field);
    setTimeout(() => { const el = this.host.querySelector<HTMLInputElement>('.edit-in'); el?.focus(); el?.select(); });
  }
  protected commit(field: 'title' | 'desc', value: string): void {
    const id = this.selId();
    if (this.editing() !== field || !id) return;
    this.editing.set(null);
    const v = value.trim();
    this.patch(id, p => (field === 'title' ? { ...p, title: v || UNTITLED } : { ...p, description: v }));
    this.scheduleSave(id);
  }
  protected onEditKey(ev: KeyboardEvent, field: 'title' | 'desc'): void {
    if (ev.key === 'Escape') { ev.stopPropagation(); this.editing.set(null); }   // leaves it as it was
    if (ev.key === 'Enter' && field === 'title') this.commit(field, (ev.target as HTMLInputElement).value);
  }

  // ── songs ──
  protected async remove(song: Song): Promise<void> {
    const id = this.selId();
    if (!id || !(await this.confirm.ask(`REMOVE "${(song.title || 'UNTITLED').toUpperCase()}"?`))) return;
    if (this.playId() === id) {
      if (this.nowSongId() === song.id) this.unload();
      else this.queue.update(q => afterRemove(q, song.id));
    }
    this.patch(id, p => ({ ...p, songs: p.songs.filter(s => s.id !== song.id) }));
    void this.saveNow(id);
  }

  protected move(from: number, to: number): void {
    const id = this.selId(), p = this.view();
    if (!id || !p || to < 0 || to >= p.songs.length || from === to) return;
    const songs = moveSong(p.songs, from, to);
    this.patch(id, x => ({ ...x, songs }));
    if (this.playId() === id) this.queue.update(q => afterReorder(q, songs, this.shuffled()));
    this.scheduleSave(id);
  }

  protected onGripKey(ev: KeyboardEvent, i: number): void {
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
    ev.preventDefault();
    const to = i + (ev.key === 'ArrowUp' ? -1 : 1);
    this.move(i, to);
    setTimeout(() => this.host.querySelectorAll<HTMLElement>('.grip')[to]?.focus());
  }

  protected dragStart(ev: DragEvent, i: number): void {
    this.dragFrom.set(i);
    if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(i)); }
  }
  protected dragOver(ev: DragEvent, i: number): void {
    const from = this.dragFrom();
    if (from === null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    this.dropAt.set(i === from ? null : { i, above: i < from });
  }
  protected drop(ev: DragEvent, i: number): void {
    ev.preventDefault();
    const from = this.dragFrom();
    this.dragEnd();
    if (from !== null) this.move(from, i);
  }
  protected dragEnd(): void { this.dragFrom.set(null); this.dropAt.set(null); }

  // ── uploads ──
  protected pick(cls: string): void { this.host.querySelector<HTMLInputElement>(cls)?.click(); }

  protected async onAudio(ev: Event): Promise<void> {
    const inp = ev.target as HTMLInputElement;
    const files = Array.from(inp.files || []);
    inp.value = '';
    const id = this.selId();
    if (!files.length || !id) return;
    this.uploadingId.set(id);
    this.dirty.add(id);
    for (const file of files) {
      this.notifier.notify(`UPLOADING: ${file.name.slice(0, 28)}...`, 'info');
      try {
        const url = await uploadMedia(file, 'video', `playlists/${id}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        const song: Song = { id: songId(), title: titleFromFile(file.name), url, duration: null };
        if (!this.lists()[id]) this.lists.update(m => ({ ...m, [id]: fromDoc(undefined, this.store.byId().get(id)?.name) }));
        this.patch(id, p => ({ ...p, songs: [...p.songs, song] }));
        await this.saveNow(id);   // each song is stored as soon as it is up
        this.notifier.notify(`ADDED: ${song.title.slice(0, 28)}`, 'ok');
      } catch (err) {
        console.error('Audio upload error:', err);
        this.notifier.notify('UPLOAD FAILED: ' + ((err as Error).message || 'unknown error').slice(0, 30), 'err');
      }
    }
    this.uploadingId.set(null);
  }

  protected async onCover(ev: Event): Promise<void> {
    const inp = ev.target as HTMLInputElement;
    const file = inp.files?.[0];
    inp.value = '';
    const id = this.selId();
    if (!file || !id) return;
    this.notifier.notify('UPLOADING COVER...', 'info');
    try {
      const url = await uploadMedia(file, 'image', `playlists/covers/${id}_${Date.now()}`);
      this.patch(id, p => ({ ...p, image: url }));
      await this.saveNow(id);
      this.notifier.notify('COVER UPDATED', 'ok');
    } catch (err) {
      console.error('Image upload error:', err);
      this.notifier.notify('UPLOAD FAILED', 'err');
    }
  }

  // ── saving: the whole document, as the old page did ──
  private scheduleSave(id: string): void {
    this.dirty.add(id);
    clearTimeout(this.saveTimers.get(id));
    this.saveTimers.set(id, setTimeout(() => void this.saveNow(id), 700));
  }
  private async saveNow(id: string): Promise<void> {
    clearTimeout(this.saveTimers.get(id));
    this.saveTimers.delete(id);
    const p = this.lists()[id];
    if (!p) return;
    try {
      await setDoc(doc(this.db, col('playlists'), id), toDoc(p, Date.now()));
    } catch (err) {
      console.error('Playlist save error:', err);
      this.notifier.notify('SAVE FAILED', 'err');
    }
    if (!this.saveTimers.has(id) && this.uploadingId() !== id) this.dirty.delete(id);
  }

  // ── playback ──
  protected play(idx: number): void {
    const id = this.selId(), p = this.view();
    if (!id || !p?.songs.length) return;
    this.playId.set(id);
    this.queue.set(queueFrom(p.songs, idx, this.shuffled()));
    this.load();
  }

  private songs(): Song[] { return (this.playId() && this.lists()[this.playId()!]?.songs) || []; }

  private load(): void {
    const song = this.songs().find(s => s.id === this.nowSongId());
    if (!song) return;
    this.barShown.set(true);
    const c = this.store.byId().get(this.playId()!);
    this.lastNow.set({ title: song.title || 'Untitled', by: c?.name || '', art: this.lists()[this.playId()!]?.image || c?.avatar || '' });
    this.fallback = 0;
    this.srcUrl = song.url;
    this.time.set(0);
    this.duration.set(song.duration || 0);
    this.audio.src = song.url;
    this.audio.load();
    this.audio.play().catch(err => console.warn('Audio play error', err));
  }

  /** The loaded song was removed: stop, and let PLAY start over. */
  private unload(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.queue.set(NO_QUEUE);
    this.time.set(0);
    this.duration.set(0);
  }

  protected toggle(): void {
    if (!this.nowSongId()) {
      // nothing loaded: start the playlist on screen (at a random song when shuffling)
      const n = this.view()?.songs.length || 0;
      if (n) this.play(this.shuffled() ? Math.floor(Math.random() * n) : 0);
      return;
    }
    if (this.audio.paused) this.audio.play().catch(() => { /* blocked */ });
    else this.audio.pause();
  }

  protected next(): void {
    if (!this.queue().ids.length) return;
    this.queue.set(nextInQueue(this.queue(), this.songs(), this.shuffled()));
    this.load();
  }

  protected prev(): void {
    if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
    if (!this.queue().ids.length) return;
    this.queue.set(prevInQueue(this.queue()));
    this.load();
  }

  protected toggleShuffle(): void {
    this.shuffled.update(v => !v);
    this.queue.update(q => reshuffle(q, this.songs(), this.shuffled()));
  }

  protected toggleRepeat(): void {
    this.repeat.update(v => !v);
    this.audio.loop = this.repeat();
  }

  protected toggleMute(): void {
    this.muted.update(v => !v);
    this.audio.volume = this.muted() ? 0 : this.volume();
  }

  protected setVolume(v: number): void {
    this.volume.set(Math.max(0, Math.min(1, v)));
    this.muted.set(false);
    this.audio.volume = this.volume();
  }

  protected seek(t: number): void {
    if (!this.audio.duration) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, t));
    this.time.set(this.audio.currentTime);
  }

  /** Learns a song's length the first time it plays, and stores it. */
  private onMeta(): void {
    const d = this.audio.duration;
    if (!isFinite(d)) return;
    this.duration.set(d);
    const id = this.playId(), sid = this.nowSongId();
    const song = this.songs().find(s => s.id === sid);
    if (id && song && !song.duration) {
      this.patch(id, p => ({ ...p, songs: p.songs.map(s => (s.id === sid ? { ...s, duration: Math.round(d) } : s)) }));
      this.scheduleSave(id);
    }
  }

  /** A song that will not load is tried on the backup accounts before giving up. */
  private onError(): void {
    if (!this.srcUrl || !this.audio.getAttribute('src')) return;
    while (this.fallback < CLOUDINARY_BACKUPS.length) {
      const alt = cldSwap(this.srcUrl, this.fallback++);
      if (alt) { this.audio.src = alt; this.audio.load(); this.audio.play().catch(() => { /* blocked */ }); return; }
    }
    this.notifier.notify('COULD NOT LOAD THIS SONG', 'err');
  }
}
