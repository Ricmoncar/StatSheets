import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { Unsubscribe, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { ConfirmService } from '../../core/confirm.service';
import { FIRESTORE, col } from '../../core/firebase';
import { NotifyService } from '../../core/notify.service';
import { Icon } from '../../ui/icon';
import { Lightbox } from '../../ui/lightbox';
import { Modal } from '../../ui/modal';
import { compressToFit, genId } from '../gallery/gallery-images';
import {
  ArtRequest, BoardImage, RequestFilter, RequestImage, cardCover, doneLabel, fileTitle, filterRequests, fmtDate,
  linkChanges, makeThumb, syncNote,
} from './bk';
import { CharChip, CharPick } from './bk-parts';

interface Staged { full: string; thumb: string; name: string }
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * BK'S CORNER (the old bkscorner.html). ART REQUESTS: what to draw, for whom,
 * with reference pictures, marked done with the finished art. GALLERY: a
 * shared board of pictures; linking characters mirrors a picture into their
 * own galleries. Pictures are stored as compressed JPEGs in the documents,
 * with small covers on the cards.
 */
@Component({
  selector: 'ss-bk-corner-page',
  imports: [Icon, Modal, Lightbox, CharChip, CharPick],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bk-corner-page.html',
  styleUrl: './bk-corner-page.scss',
})
export class BkCornerPage {
  private readonly db = inject(FIRESTORE);
  private readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);
  private readonly confirm = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly cover = cardCover;
  protected readonly date = fmtDate;
  protected readonly note = syncNote;

  /** As on the old page, characters in the order they were made. */
  protected readonly chars = computed(() => [...this.store.characters()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
  private readonly byId = computed(() => new Map(this.chars().map(c => [c.id, c])));
  protected charsOf(ids: string[] | undefined): Character[] {
    const m = this.byId();
    return (ids || []).map(id => m.get(id)).filter((c): c is Character => !!c);
  }

  protected readonly view = signal<'requests' | 'gallery'>('requests');
  private readonly unsubs: Unsubscribe[] = [];

  // ── requests ──
  protected readonly requests = signal<ArtRequest[] | null>(null);
  protected readonly filter = signal<RequestFilter>('all');
  protected readonly shown = computed(() => filterRequests(this.requests() || [], this.filter()));
  protected readonly done = computed(() => doneLabel(this.requests() || []));

  constructor() {
    this.unsubs.push(onSnapshot(query(collection(this.db, col('art_requests')), orderBy('createdAt', 'desc')), snap => {
      this.requests.set(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ArtRequest));
    }, err => {
      console.error('requests error:', err);
      this.notifier.notify('COULD NOT LOAD REQUESTS', 'err');
    }));
    inject(DestroyRef).onDestroy(() => { this.unsubs.forEach(u => u()); this.detailUnsub?.(); });
  }

  protected setView(v: 'requests' | 'gallery'): void {
    this.view.set(v);
    if (v === 'gallery') this.startBoard();
  }

  // ── a new request ──
  protected readonly creating = signal(false);
  protected readonly draftTitle = signal('');
  protected readonly draftDesc = signal('');
  protected readonly draftChars = signal<string[]>([]);
  protected readonly draftRefs = signal<Staged[]>([]);
  protected readonly staging = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly dropOver = signal<string | null>(null);

  protected openCreate(): void {
    this.draftTitle.set('');
    this.draftDesc.set('');
    this.draftChars.set([]);
    this.draftRefs.set([]);
    this.saving.set(false);
    this.creating.set(true);
    setTimeout(() => this.host.querySelector<HTMLInputElement>('.f-title')?.focus(), 50);
  }

  /** Compresses picked or dropped pictures into a staging list, with a progress bar. */
  private async stage(files: File[], into: (s: Staged) => void): Promise<void> {
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (!valid.length) { this.notifier.notify('NO IMAGE FILES FOUND', 'err'); return; }
    for (let i = 0; i < valid.length; i++) {
      this.staging.set(Math.round((i / valid.length) * 100));
      try {
        into({ full: await compressToFit(valid[i]), thumb: await makeThumb(valid[i]), name: fileTitle(valid[i].name) });
      } catch (err) {
        console.error(err);
        this.notifier.notify(`${valid[i].name}: FAILED`, 'err');
      }
    }
    this.staging.set(100);
    await delay(180);
    this.staging.set(null);
  }

  protected pick(sel: string): void { this.host.querySelector<HTMLInputElement>(sel)?.click(); }
  private files(ev: Event): File[] {
    const inp = ev.target as HTMLInputElement;
    const files = Array.from(inp.files || []);
    inp.value = '';
    return files;
  }
  private dropped(ev: DragEvent): File[] | null {
    ev.preventDefault();
    this.dropOver.set(null);
    const files = Array.from(ev.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
    if (!files.length) { this.notifier.notify('NO IMAGE FILES IN DROP', 'err'); return null; }
    return files;
  }
  protected dragOver(ev: DragEvent, zone: string): void { ev.preventDefault(); this.dropOver.set(zone); }

  protected onRefs(ev: Event): void { void this.stage(this.files(ev), s => this.draftRefs.update(l => [...l, s])); }
  protected onRefDrop(ev: DragEvent): void { const f = this.dropped(ev); if (f) void this.stage(f, s => this.draftRefs.update(l => [...l, s])); }
  protected unstageRef(i: number): void { this.draftRefs.update(l => l.filter((_, j) => j !== i)); }

  protected async submitRequest(): Promise<void> {
    const title = this.draftTitle().trim();
    if (!title) {
      this.notifier.notify('GIVE IT A TITLE FIRST', 'err');
      this.host.querySelector<HTMLInputElement>('.f-title')?.focus();
      return;
    }
    this.saving.set(true);
    const refs = this.draftRefs();
    try {
      const id = genId();
      const req = doc(this.db, col('art_requests'), id);
      await setDoc(req, {
        title, description: this.draftDesc().trim(), charIds: this.draftChars(),
        completed: false, refCount: refs.length, refCover: refs[0]?.thumb || '', resultCover: '',
        createdAt: Date.now(), completedAt: null,
      });
      for (let i = 0; i < refs.length; i++) {
        await setDoc(doc(collection(req, 'images'), genId()), { dataUrl: refs[i].full, kind: 'ref', order: i, addedAt: Date.now() });
      }
      this.notifier.notify('ART REQUEST CREATED!', 'ok');
      this.creating.set(false);
    } catch (err) {
      console.error(err);
      this.notifier.notify('FAILED: ' + (err as Error).message, 'err');
      this.saving.set(false);
    }
  }

  // ── one request ──
  protected readonly detailId = signal<string | null>(null);
  protected readonly detail = computed(() => (this.requests() || []).find(r => r.id === this.detailId()) ?? null);
  protected readonly detailImgs = signal<RequestImage[] | null>(null);
  protected readonly detailErr = signal('');
  protected readonly refs = computed(() => (this.detailImgs() || []).filter(i => i.kind === 'ref'));
  protected readonly result = computed(() => (this.detailImgs() || []).filter(i => i.kind === 'result').slice(-1)[0] ?? null);
  protected readonly working = signal<number | null>(null);
  private detailUnsub: Unsubscribe | null = null;

  private images(id: string) { return collection(this.db, col('art_requests'), id, 'images'); }

  protected openDetail(r: ArtRequest): void {
    this.detailUnsub?.();
    this.detailId.set(r.id);
    this.detailImgs.set(null);
    this.detailErr.set('');
    this.detailUnsub = onSnapshot(query(this.images(r.id), orderBy('addedAt')), snap => {
      this.detailImgs.set(snap.docs.map(d => ({ id: d.id, ...d.data() }) as RequestImage));
    }, err => {
      console.error(err);
      this.detailErr.set(err.message);
    });
  }
  protected closeDetail(): void {
    this.detailUnsub?.();
    this.detailUnsub = null;
    this.detailId.set(null);
    this.detailImgs.set(null);
  }

  protected async toggleCompleted(): Promise<void> {
    const r = this.detail();
    if (!r) return;
    const now = !r.completed;
    try {
      await updateDoc(doc(this.db, col('art_requests'), r.id), { completed: now, completedAt: now ? Date.now() : null });
      this.notifier.notify(now ? 'MARKED COMPLETED' : 'MOVED BACK TO PENDING', 'ok');
    } catch (err) {
      console.error(err);
      this.notifier.notify('FAILED: ' + (err as Error).message, 'err');
    }
  }

  /** The finished art replaces any before it, and becomes the card's cover. */
  protected async onResult(ev: Event): Promise<void> {
    const file = this.files(ev)[0], r = this.detail();
    if (!file || !r) return;
    if (!file.type.startsWith('image/')) { this.notifier.notify('NOT AN IMAGE', 'err'); return; }
    this.working.set(20);
    try {
      const full = await compressToFit(file);
      this.working.set(60);
      const thumb = await makeThumb(file);
      for (const p of (this.detailImgs() || []).filter(i => i.kind === 'result')) await deleteDoc(doc(this.images(r.id), p.id));
      await setDoc(doc(this.images(r.id), genId()), { dataUrl: full, kind: 'result', addedAt: Date.now() });
      await updateDoc(doc(this.db, col('art_requests'), r.id), { resultCover: thumb });
      this.working.set(100);
      this.notifier.notify('FINISHED ART UPLOADED!', 'ok');
    } catch (err) {
      console.error(err);
      this.notifier.notify('UPLOAD FAILED: ' + (err as Error).message, 'err');
    } finally {
      await delay(200);
      this.working.set(null);
    }
  }

  protected async onMoreRefs(ev: Event): Promise<void> {
    const files = this.files(ev).filter(f => f.type.startsWith('image/')), r = this.detail();
    if (!r) return;
    if (!files.length) { this.notifier.notify('NO IMAGE FILES', 'err'); return; }
    this.working.set(0);
    try {
      const existing = this.refs().length;
      let firstThumb: string | null = null;
      for (let i = 0; i < files.length; i++) {
        this.working.set(Math.round((i / files.length) * 100));
        const full = await compressToFit(files[i]);
        if (i === 0 && existing === 0) firstThumb = await makeThumb(files[i]);
        await setDoc(doc(this.images(r.id), genId()), { dataUrl: full, kind: 'ref', order: existing + i, addedAt: Date.now() });
      }
      await updateDoc(doc(this.db, col('art_requests'), r.id), { refCount: existing + files.length, ...(firstThumb ? { refCover: firstThumb } : {}) });
      this.working.set(100);
      this.notifier.notify('REFERENCES ADDED!', 'ok');
    } catch (err) {
      console.error(err);
      this.notifier.notify('FAILED: ' + (err as Error).message, 'err');
    } finally {
      await delay(200);
      this.working.set(null);
    }
  }

  protected async deleteRequest(): Promise<void> {
    const r = this.detail();
    if (!r || !(await this.confirm.ask('DELETE THIS ART REQUEST AND ALL ITS IMAGES? THIS CANNOT BE UNDONE.'))) return;
    try {
      const imgs = await getDocs(this.images(r.id));
      const b = writeBatch(this.db);
      imgs.forEach(d => b.delete(d.ref));
      await b.commit();
      await deleteDoc(doc(this.db, col('art_requests'), r.id));
      this.notifier.notify('REQUEST DELETED', 'ok');
      this.closeDetail();
    } catch (err) {
      console.error(err);
      this.notifier.notify('DELETE FAILED: ' + (err as Error).message, 'err');
    }
  }

  // ── the board ──
  protected readonly board = signal<BoardImage[] | null>(null);
  private boardStarted = false;

  private startBoard(): void {
    if (this.boardStarted) return;
    this.boardStarted = true;
    this.unsubs.push(onSnapshot(query(collection(this.db, col('bk_gallery')), orderBy('uploadedAt', 'desc')), snap => {
      this.board.set(snap.docs.map(d => ({ id: d.id, ...d.data() }) as BoardImage));
    }, err => {
      console.error('gallery error:', err);
      this.notifier.notify('COULD NOT LOAD GALLERY', 'err');
    }));
  }

  /** Mirrors a board picture into each newly linked character's gallery, and out of each unlinked one. */
  private async sync(imgId: string, data: { dataUrl: string; name: string; uploadedAt: number }, oldIds: string[], newIds: string[]): Promise<void> {
    const ch = linkChanges(oldIds, newIds);
    const mirror = (cid: string) => doc(this.db, col('characters'), cid, 'gallery', imgId);
    for (const cid of ch.add) await setDoc(mirror(cid), { dataUrl: data.dataUrl, name: data.name || '', uploadedAt: data.uploadedAt || Date.now(), source: 'bkscorner', bkId: imgId });
    for (const cid of ch.remove) await deleteDoc(mirror(cid)).catch(() => undefined);
  }

  // adding pictures
  protected readonly upOpen = signal(false);
  protected readonly upRefs = signal<Staged[]>([]);
  protected readonly upChars = signal<string[]>([]);
  protected readonly upProgress = signal<string | null>(null);

  protected openUpload(): void {
    this.upRefs.set([]);
    this.upChars.set([]);
    this.upProgress.set(null);
    this.upOpen.set(true);
  }
  protected onUpFiles(ev: Event): void { void this.stage(this.files(ev), s => this.upRefs.update(l => [...l, s])); }
  protected onUpDrop(ev: DragEvent): void { const f = this.dropped(ev); if (f) void this.stage(f, s => this.upRefs.update(l => [...l, s])); }
  protected unstageUp(i: number): void { this.upRefs.update(l => l.filter((_, j) => j !== i)); }

  protected async submitUpload(): Promise<void> {
    const refs = this.upRefs(), chars = this.upChars();
    if (!refs.length) { this.notifier.notify('PICK AT LEAST ONE IMAGE', 'err'); return; }
    try {
      for (let i = 0; i < refs.length; i++) {
        this.upProgress.set(`UPLOADING ${i + 1}/${refs.length}...`);
        const id = genId(), ts = Date.now();
        await setDoc(doc(this.db, col('bk_gallery'), id), { dataUrl: refs[i].full, thumb: refs[i].thumb, name: refs[i].name || '', charIds: chars, uploadedAt: ts });
        if (chars.length) await this.sync(id, { dataUrl: refs[i].full, name: refs[i].name || '', uploadedAt: ts }, [], chars);
      }
      this.notifier.notify(chars.length ? 'ADDED & SYNCED TO GALLERY!' : 'ADDED TO GALLERY!', 'ok');
      this.upOpen.set(false);
    } catch (err) {
      console.error(err);
      this.notifier.notify('FAILED: ' + (err as Error).message, 'err');
      this.upProgress.set(null);
    }
  }

  // one picture
  protected readonly editId = signal<string | null>(null);
  protected readonly editing = computed(() => (this.board() || []).find(i => i.id === this.editId()) ?? null);
  protected readonly editName = signal('');
  protected readonly editChars = signal<string[]>([]);

  protected openImage(img: BoardImage): void {
    this.editId.set(img.id);
    this.editName.set(img.name || '');
    this.editChars.set([...(img.charIds || [])]);
  }

  protected async saveImage(): Promise<void> {
    const img = this.editing();
    if (!img) return;
    const name = this.editName().trim(), oldIds = img.charIds || [], newIds = this.editChars();
    try {
      await updateDoc(doc(this.db, col('bk_gallery'), img.id), { name, charIds: newIds });
      await this.sync(img.id, { dataUrl: img.dataUrl, name, uploadedAt: img.uploadedAt || Date.now() }, oldIds, newIds);
      // a new name reaches the copies that stay linked
      if (name !== (img.name || '')) {
        for (const cid of linkChanges(oldIds, newIds).stay) await updateDoc(doc(this.db, col('characters'), cid, 'gallery', img.id), { name }).catch(() => undefined);
      }
      this.notifier.notify('SAVED!', 'ok');
      this.editId.set(null);
    } catch (err) {
      console.error(err);
      this.notifier.notify('SAVE FAILED: ' + (err as Error).message, 'err');
    }
  }

  protected async deleteImage(): Promise<void> {
    const img = this.editing();
    if (!img || !(await this.confirm.ask('DELETE THIS IMAGE? IT WILL ALSO BE REMOVED FROM ANY LINKED CHARACTER GALLERIES.'))) return;
    try {
      for (const cid of img.charIds || []) await deleteDoc(doc(this.db, col('characters'), cid, 'gallery', img.id)).catch(() => undefined);
      await deleteDoc(doc(this.db, col('bk_gallery'), img.id));
      this.notifier.notify('IMAGE DELETED', 'ok');
      this.editId.set(null);
    } catch (err) {
      console.error(err);
      this.notifier.notify('DELETE FAILED: ' + (err as Error).message, 'err');
    }
  }

  // ── full size ──
  protected readonly lb = signal<string[] | null>(null);
  protected readonly lbIndex = signal(0);
  protected openLightbox(urls: string[], i = 0): void {
    if (!urls.length) return;
    this.lbIndex.set(i);
    this.lb.set(urls);
  }
  protected refUrls(): string[] { return this.refs().map(r => r.dataUrl); }
}
