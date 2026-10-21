import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Unsubscribe, collection, deleteDoc, doc, getCountFromServer, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { ConfirmService } from '../../core/confirm.service';
import { FIRESTORE, col } from '../../core/firebase';
import { NotifyService } from '../../core/notify.service';
import { Modal } from '../../ui/modal';
import { Icon } from '../../ui/icon';
import { GalleryImage, compressToFit, genId, imageLabel } from './gallery-images';

// a 9x7 camera, '#' is a pixel
const CAMERA = ['..###....', '#########', '#...#...#', '#..#.#..#', '#...#...#', '#.......#', '#########'];
const CAMERA_PATH = CAMERA.flatMap((r, y) => [...r].map((ch, x) => (ch === '#' ? `M${x} ${y}h1v1h-1z` : ''))).join('');

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * CHARACTER GALLERY (the old gallery.html): every character's pictures,
 * kept in characters/{id}/gallery as compressed JPEGs. Add by picking or
 * dropping files, rename, delete, and browse them full size.
 */
@Component({
  selector: 'ss-gallery-page',
  imports: [Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gallery-page.html',
  styleUrl: './gallery-page.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class GalleryPage {
  private readonly db = inject(FIRESTORE);
  protected readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);
  private readonly confirm = inject(ConfirmService);
  protected readonly cameraPath = CAMERA_PATH;
  protected readonly label = imageLabel;

  /** Pictures per character, counted on the server so the cards show them before a gallery is opened. */
  protected readonly counts = signal<Record<string, number>>({});
  protected readonly total = computed(() => Object.values(this.counts()).reduce((a, b) => a + b, 0));
  protected readonly activeId = signal<string | null>(null);
  protected readonly active = computed(() => (this.activeId() ? this.store.byId().get(this.activeId()!) ?? null : null));
  /** null while loading. */
  protected readonly images = signal<GalleryImage[] | null>(null);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly progress = signal<number | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly renaming = signal<string | null>(null);
  protected readonly lightbox = signal<number | null>(null);
  protected readonly shown = computed(() => { const i = this.lightbox(), l = this.images(); return i !== null && l ? l[i] ?? null : null; });

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('file');
  private unsub: Unsubscribe | null = null;
  private readonly counted = new Set<string>();

  constructor() {
    effect(() => {
      const ids = this.store.characters().map(c => c.id).filter(id => !this.counted.has(id));
      untracked(() => void this.countAll(ids));
    });
    inject(DestroyRef).onDestroy(() => this.unsub?.());
  }

  private gallery(charId: string) { return collection(this.db, col('characters'), charId, 'gallery'); }

  private async countAll(ids: string[]): Promise<void> {
    for (const id of ids) this.counted.add(id);
    // a few at a time; a failed count just leaves the badge off, as before
    for (let i = 0; i < ids.length; i += 6) {
      await Promise.all(ids.slice(i, i + 6).map(async id => {
        try {
          const n = (await getCountFromServer(this.gallery(id))).data().count;
          this.counts.update(c => ({ ...c, [id]: n }));
        } catch { this.counted.delete(id); }
      }));
    }
  }

  protected open(c: Character): void {
    this.unsub?.();
    this.activeId.set(c.id);
    this.images.set(null);
    this.error.set('');
    this.status.set('');
    this.renaming.set(null);
    this.unsub = onSnapshot(query(this.gallery(c.id), orderBy('uploadedAt')), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as GalleryImage);
      this.images.set(list);
      this.counts.update(m => ({ ...m, [c.id]: list.length }));
      const i = this.lightbox();
      if (i !== null) this.lightbox.set(list.length ? Math.min(i, list.length - 1) : null);
    }, err => {
      console.error('gallery listener error:', err);
      this.error.set(err.message);
    });
  }
  protected close(): void {
    this.unsub?.();
    this.unsub = null;
    this.activeId.set(null);
    this.images.set(null);
    this.lightbox.set(null);
  }

  // ── adding ──
  protected pickFiles(): void { this.fileInput()?.nativeElement.click(); }
  protected onFiles(ev: Event): void {
    const inp = ev.target as HTMLInputElement;
    const files = Array.from(inp.files || []);
    inp.value = '';
    if (files.length) void this.upload(files);
  }
  protected onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver.set(false);
    const files = Array.from(ev.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length) void this.upload(files);
    else this.notifier.notify('NO IMAGE FILES IN DROP', 'err');
  }
  protected onDragOver(ev: DragEvent): void { ev.preventDefault(); this.dragOver.set(true); }

  private async upload(files: File[]): Promise<void> {
    const charId = this.activeId();
    if (!charId) return;
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (!valid.length) { this.notifier.notify('NO IMAGE FILES FOUND', 'err'); return; }
    for (let i = 0; i < valid.length; i++) {
      this.status.set(`PROCESSING ${i + 1} / ${valid.length}...`);
      this.progress.set(10);
      try {
        const dataUrl = await compressToFit(valid[i]);
        this.progress.set(70);
        await setDoc(doc(this.gallery(charId), genId()), { dataUrl, name: valid[i].name, uploadedAt: Date.now() });
        this.progress.set(100);
        this.notifier.notify('IMAGE ADDED!', 'ok');
      } catch (e) {
        console.error('upload error:', e);
        this.notifier.notify(`${valid[i].name}: FAILED, ${(e as Error).message}`, 'err');
      }
      await delay(180);   // let the bar show 100% for a moment
      this.progress.set(null);
    }
    this.status.set('');
  }

  // ── renaming and deleting ──
  protected startRename(ev: Event, img: GalleryImage): void {
    ev.stopPropagation();
    this.renaming.set(img.id);
    setTimeout(() => { const el = document.querySelector<HTMLInputElement>('.rename'); el?.focus(); el?.select(); });
  }
  protected async finishRename(img: GalleryImage, value: string | null): Promise<void> {
    if (this.renaming() !== img.id) return;
    this.renaming.set(null);
    const name = value?.trim() ?? null;
    const charId = this.activeId();
    if (name === null || name === (img.name || '') || !charId) return;
    try {
      await updateDoc(doc(this.gallery(charId), img.id), { name });
      this.notifier.notify('RENAMED!', 'ok');
    } catch (e) {
      this.notifier.notify('RENAME FAILED: ' + (e as Error).message, 'err');
    }
  }
  protected onRenameKey(ev: KeyboardEvent, img: GalleryImage): void {
    ev.stopPropagation();
    if (ev.key === 'Enter') void this.finishRename(img, (ev.target as HTMLInputElement).value);
    if (ev.key === 'Escape') void this.finishRename(img, null);
  }
  protected async remove(ev: Event, img: GalleryImage): Promise<void> {
    ev.stopPropagation();
    const charId = this.activeId();
    if (!charId || !(await this.confirm.ask('DELETE THIS IMAGE?'))) return;
    try {
      await deleteDoc(doc(this.gallery(charId), img.id));
      this.notifier.notify('IMAGE DELETED', 'ok');
    } catch (e) {
      console.error('delete error:', e);
      this.notifier.notify('DELETE FAILED: ' + (e as Error).message, 'err');
    }
  }

  // ── full size ──
  protected step(dir: number): void {
    const n = this.images()?.length || 0, i = this.lightbox();
    if (n && i !== null) this.lightbox.set((i + dir + n) % n);
  }
  protected onKey(ev: KeyboardEvent): void {
    if (this.lightbox() === null) return;   // the gallery itself closes on Escape through ss-modal
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); this.step(-1); }
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); this.step(1); }
    if (ev.key === 'Escape') this.lightbox.set(null);
  }
}
