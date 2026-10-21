import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { Unsubscribe, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { CharacterStore, genId } from '../../core/data/character-store';
import { FIRESTORE, col } from '../../core/firebase';
import { NotifyService } from '../../core/notify.service';
import { readAsDataURL, uploadMedia } from '../../core/media';
import { CldSrc } from '../../ui/cld-src';

export interface HcEntry {
  id: string;
  rosterId?: string;
  name: string;
  heightCm: number;
  color: string;
  spriteBase64?: string | null;
  spriteUrl?: string | null;
  spriteTopFrac?: number;
  spriteBotFrac?: number;
  aura?: string | null;
  xOffset?: number;
}

const FLOOR_H = 36;
const ZOOM_MIN = 0.2, ZOOM_MAX = 3;
// 'soft' has its own DEFAULT button and stays out of the cycle
const AURAS = [null, 'blaze', 'shadow', 'void', 'ghost', 'crimson', 'haze', 'static', 'neon', 'reaper'];
const AURA_DOT: Record<string, string> = { blaze: '#ff6020', shadow: '#9030d0', void: '#5010a0', ghost: '#b0d0ff', crimson: '#cc0015', haze: '#ff80ff', static: '#aaa', neon: '#f0f0f0', reaper: '#220000' };
const AURA_DUR: Record<string, number> = { blaze: 1.4, shadow: 2.8, void: 2.2, ghost: 3.4, crimson: 2.2, haze: 6, static: 0.18, neon: 1.5, reaper: 4, soft: 4 };

// a 12x31 pixel person for characters without a sprite
const PERSON = [
  '....####....', '...######...', '...######...', '...######...', '....####....', '.....##.....',
  '..########..', '.##########.', '.#.######.#.', '.#.######.#.', '.#.######.#.', '.#.######.#.', '.#.######.#.',
  '.#.######.#.', '.#.######.#.', '.#.######.#.', '##.######.##', '...######...', '...######...',
  '...##..##...', '...##..##...', '...##..##...', '...##..##...', '...##..##...', '...##..##...', '...##..##...',
  '...##..##...', '...##..##...', '...##..##...', '..###..###..', '..###..###..',
];
const PERSON_PATH = PERSON.flatMap((r, y) => [...r].map((ch, x) => (ch === '#' ? `M${x} ${y}h1v1h-1z` : ''))).join('');

/** A stable 0..1 from an id and a slot: particles keep their places between draws. */
export function hcHash(str: string, n: number): number {
  let h = (n + 1) * 2654435769;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 2654435769);
  return ((h >>> 0) % 10000) / 10000;
}

/** Where a picture's visible (non-transparent) rows start and end, as fractions of its height. */
function opaqueRows(img: HTMLImageElement, maxW: number): { top: number; bot: number } | null {
  const w = Math.min(img.naturalWidth, maxW), h = Math.round(img.naturalHeight * (w / img.naturalWidth));
  if (!w || !h) return null;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  let top = h, bot = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 16) { if (y < top) top = y; if (y > bot) bot = y; }
  return bot < 0 ? null : { top: top / h, bot: (bot + 1) / h };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
}

/**
 * The shared height chart (heightchart/main): characters side by side on a
 * ruler, in cm or feet and inches. Drag the stage to pan, wheel or pinch to
 * zoom, drag a character to reorder; select one to edit its name, height,
 * spacing, colour, sprite (auto-cropped to its visible pixels), head crop
 * and aura.
 */
@Component({
  selector: 'ss-height-chart',
  imports: [CldSrc],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'importing() ? importing.set(false) : closed.emit()' },
  templateUrl: './height-chart.html',
  styleUrl: './height-chart.scss',
})
export class HeightChart {
  private readonly db = inject(FIRESTORE);
  private readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);
  readonly closed = output<void>();

  protected readonly personPath = PERSON_PATH;
  protected readonly auraDot = AURA_DOT;
  protected readonly entries = signal<HcEntry[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly unit = signal<'cm' | 'in'>('cm');
  protected readonly zoom = signal(1);
  protected readonly pan = signal(0);
  protected readonly stageSize = signal({ w: 900, h: 440 });
  protected readonly importing = signal(false);
  protected readonly importQuery = signal('');
  protected readonly dropX = signal<number | null>(null);
  protected readonly draggingId = signal<string | null>(null);

  private readonly stageEl = viewChild<ElementRef<HTMLElement>>('stage');
  private unsub: Unsubscribe | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private saving = false;
  private boundsChecked = new Set<string>();

  protected readonly selected = computed(() => this.entries().find(e => e.id === this.selectedId()) ?? null);

  /** Everything the chart draws, in pixels. */
  protected readonly layout = computed(() => {
    const list = this.entries(), { w: stageW, h: stageH } = this.stageSize(), zoom = this.zoom();
    const chartH = Math.max(60, stageH - FLOOR_H);
    const maxCm = list.length ? Math.max(220, Math.ceil((Math.max(...list.map(e => e.heightCm || 0)) + 25) / 10) * 10) : 220;
    const pxPerCm = (chartH / maxCm) * zoom;
    const n = list.length;
    const tallest = n ? Math.max(...list.map(e => (e.heightCm || 170) * pxPerCm)) : 200;
    const slot = Math.max(70, tallest * 0.38);
    const canvasW = Math.max(stageW, n > 1 ? (n + 1) * slot : stageW);
    const shown = chartH / pxPerCm;
    const step = shown > 600 ? 100 : shown > 300 ? 50 : shown > 150 ? 25 : 10;
    const ticks: { cm: number; y: number; major: boolean; label: string }[] = [];
    for (let h = 0; h <= shown + step; h += step) {
      const y = stageH - FLOOR_H - h * pxPerCm;
      if (y > stageH - FLOOR_H + 2) continue;
      if (y < -2) break;
      ticks.push({ cm: h, y, major: h % (step * 2) === 0, label: this.unit() === 'cm' ? String(h) : this.fmt(h) });
    }
    return {
      canvasW, pxPerCm, ticks,
      chars: list.map((e, i) => {
        const cm = e.heightCm || 170, hPx = cm * pxPerCm;
        const x = (n > 1 ? ((i + 1) / (n + 1)) * canvasW : canvasW / 2) + (e.xOffset || 0) * zoom;
        const src = e.spriteUrl || e.spriteBase64 || null;
        const top = e.spriteTopFrac ?? 0, bot = e.spriteBotFrac ?? 1;
        const fullH = hPx / Math.max(0.01, bot - top);
        const delay = e.aura ? `-${(hcHash(e.id, 97) * (AURA_DUR[e.aura] || 2)).toFixed(2)}s` : '0s';
        const particles = e.aura === 'blaze' || e.aura === 'crimson'
          ? [0, 1, 2, 3].map(p => ({
            left: 15 + hcHash(e.id, p * 3) * 70,
            bottom: e.aura === 'crimson' ? 60 + hcHash(e.id, p + 20) * 30 : 5 + hcHash(e.id, p + 12) * 18,
            dur: (1.1 + hcHash(e.id, p * 3 + 1) * 1.6).toFixed(2) + 's',
            delay: '-' + (hcHash(e.id, p * 3 + 2) * 2).toFixed(2) + 's',
          }))
          : [];
        return { e, i, x, hPx, cm, src, fullH, bottom: -(1 - bot) * fullH, delay, particles, label: this.fmt(cm) };
      }),
    };
  });

  protected readonly rosterMatches = computed(() => {
    const q = this.importQuery().toLowerCase().trim();
    const added = new Set(this.entries().map(e => e.rosterId).filter(Boolean));
    return this.store.characters().filter(c => !q || (c.name || '').toLowerCase().includes(q)).map(c => ({ c, added: added.has(c.id) }));
  });

  constructor() {
    const destroy = inject(DestroyRef);
    this.unsub = onSnapshot(doc(this.db, col('heightchart'), 'main'), snap => {
      // our own edit is waiting to be saved: keep it rather than flash the old one
      if (this.saveTimer || this.saving) return;
      const data = snap.exists() ? (snap.data() as { entries?: HcEntry[] }) : {};
      this.entries.set(data.entries || []);
      this.checkLegacyBounds();
    }, err => console.error('Height chart failed to load:', err));

    afterNextRender(() => {
      const el = this.stageEl()?.nativeElement;
      if (!el) return;
      const ro = new ResizeObserver(() => this.stageSize.set({ w: el.clientWidth || 900, h: el.clientHeight || 440 }));
      ro.observe(el);
      const wheel = (e: WheelEvent) => { e.preventDefault(); this.setZoom(this.zoom() * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); };
      el.addEventListener('wheel', wheel, { passive: false });
      // pinch to zoom
      let pinch: { d: number; z: number } | null = null;
      const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      const ts = (e: TouchEvent) => { if (e.touches.length === 2) { pinch = { d: dist(e.touches), z: this.zoom() }; this.panDrag = null; } };
      const tm = (e: TouchEvent) => { if (e.touches.length === 2 && pinch) { e.preventDefault(); this.setZoom(pinch.z * (dist(e.touches) / pinch.d)); } };
      const te = (e: TouchEvent) => { if (e.touches.length < 2) pinch = null; };
      el.addEventListener('touchstart', ts, { passive: true });
      el.addEventListener('touchmove', tm, { passive: false });
      el.addEventListener('touchend', te, { passive: true });
      destroy.onDestroy(() => {
        ro.disconnect();
        el.removeEventListener('wheel', wheel);
        el.removeEventListener('touchstart', ts);
        el.removeEventListener('touchmove', tm);
        el.removeEventListener('touchend', te);
      });
    });

    const move = (e: MouseEvent | TouchEvent) => this.onMove(e);
    const up = () => this.onUp();
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
    destroy.onDestroy(() => {
      this.unsub?.();
      if (this.saveTimer) { clearTimeout(this.saveTimer); void this.save(); }
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    });
  }

  // ── units ──
  protected fmt(cm: number): string {
    if (this.unit() === 'cm') return Math.round(cm) + 'cm';
    const inches = cm / 2.54;
    return Math.floor(inches / 12) + "'" + Math.round(inches % 12) + '"';
  }
  protected heightValue(e: HcEntry): number {
    return this.unit() === 'cm' ? Math.round(e.heightCm) : +(e.heightCm / 2.54).toFixed(1);
  }

  // ── saving ──
  private edit(id: string | null, change: (e: HcEntry) => void, immediate = false): void {
    this.entries.update(list => list.map(e => (e.id === id ? (() => { const c = { ...e }; change(c); return c; })() : e)));
    this.queueSave(immediate);
  }
  private queueSave(immediate = false): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), immediate ? 0 : 500);
  }
  private async save(): Promise<void> {
    this.saveTimer = undefined;
    this.saving = true;
    try {
      // a whole-document write, as before; Firestore rejects undefined fields
      await setDoc(doc(this.db, col('heightchart'), 'main'), { entries: JSON.parse(JSON.stringify(this.entries())) });
    } catch (err) {
      console.error('HC save error', err);
      this.notifier.notify('SAVE FAILED', 'err');
    } finally {
      this.saving = false;
    }
  }

  // ── entries ──
  protected add(): void {
    const id = genId();
    this.entries.update(l => [...l, { id, name: 'CHARACTER', heightCm: 170, color: '#aaaaaa', spriteBase64: null, spriteUrl: null, spriteTopFrac: 0, spriteBotFrac: 1, aura: null }]);
    this.selectedId.set(id);
    this.queueSave(true);
  }

  protected importChar(rosterId: string): void {
    const existing = this.entries().find(e => e.rosterId === rosterId);
    if (existing) { this.selectedId.set(existing.id); this.importing.set(false); return; }
    const c = this.store.byId().get(rosterId);
    if (!c) return;
    const id = genId();
    this.entries.update(l => [...l, { id, rosterId, name: c.name || 'CHARACTER', heightCm: 170, color: c.color || '#aaaaaa', spriteBase64: null, spriteUrl: null, spriteTopFrac: 0, spriteBotFrac: 1 }]);
    this.selectedId.set(id);
    this.queueSave(true);
  }

  protected sortByHeight(): void {
    this.entries.update(l => [...l].sort((a, b) => (a.heightCm || 0) - (b.heightCm || 0)));
    this.queueSave(true);
  }

  protected remove(): void {
    const id = this.selectedId();
    if (!id) return;
    this.entries.update(l => l.filter(e => e.id !== id));
    this.selectedId.set(null);
    this.queueSave(true);
  }

  protected move(id: string, dir: number): void {
    const list = [...this.entries()];
    const i = list.findIndex(e => e.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.entries.set(list);
    this.panTo(j);
    this.queueSave();
  }

  protected setName(v: string): void { this.edit(this.selectedId(), e => { e.name = v; }); }
  protected setColor(v: string): void { this.edit(this.selectedId(), e => { e.color = v; }); }
  protected setOffset(v: number): void { this.edit(this.selectedId(), e => { e.xOffset = v; }); }
  protected setHeight(v: number): void {
    if (!v || isNaN(v) || v <= 0) return;
    this.edit(this.selectedId(), e => { e.heightCm = this.unit() === 'cm' ? v : +(v * 2.54).toFixed(1); });
  }
  protected setCropTop(pct: number): void {
    this.edit(this.selectedId(), e => { e.spriteTopFrac = Math.min(pct / 100, (e.spriteBotFrac ?? 1) - 0.01); });
  }
  protected cycleAura(): void {
    this.edit(this.selectedId(), e => { e.aura = AURAS[(AURAS.indexOf(e.aura ?? null) + 1) % AURAS.length]; });
  }
  protected toggleSoft(): void { this.edit(this.selectedId(), e => { e.aura = e.aura === 'soft' ? null : 'soft'; }); }
  protected clearAura(): void { this.edit(this.selectedId(), e => { e.aura = null; }); }
  protected clearSprite(): void {
    this.edit(this.selectedId(), e => { e.spriteBase64 = null; e.spriteUrl = null; e.spriteTopFrac = 0; e.spriteBotFrac = 1; }, true);
  }

  /**
   * A GIF goes to the media host whole, so it keeps moving; anything else is
   * shrunk to 200px wide and stored inline. Either way the visible rows are
   * measured, so the feet sit on the floor and the head on its height.
   */
  protected async upload(ev: Event): Promise<void> {
    const inp = ev.target as HTMLInputElement;
    const file = inp.files?.[0];
    inp.value = '';
    const id = this.selectedId();
    if (!file || !id) return;
    try {
      const dataUrl = await readAsDataURL(file);
      const img = await loadImage(dataUrl);
      const rows = opaqueRows(img, 600) ?? { top: 0, bot: 1 };
      if (file.type === 'image/gif') {
        this.notifier.notify('UPLOADING GIF...', 'ok');
        const url = await uploadMedia(file, 'image');
        this.edit(id, e => { e.spriteBase64 = null; e.spriteUrl = url; e.spriteTopFrac = rows.top; e.spriteBotFrac = rows.bot; }, true);
        this.notifier.notify('GIF UPLOADED', 'ok');
        return;
      }
      const ratio = Math.min(1, 200 / img.naturalWidth);
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * ratio);
      cv.height = Math.round(img.naturalHeight * ratio);
      cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
      const base64 = cv.toDataURL('image/png');
      this.edit(id, e => { e.spriteBase64 = base64; e.spriteUrl = null; e.spriteTopFrac = rows.top; e.spriteBotFrac = rows.bot; }, true);
      this.notifier.notify('SPRITE UPLOADED', 'ok');
    } catch (err) {
      console.error('[height chart sprite]', err);
      this.notifier.notify(file.type === 'image/gif' ? 'GIF UPLOAD FAILED' : 'UPLOAD FAILED', 'err');
    }
  }

  /** Sprites stored before measuring existed get measured once, here. */
  private checkLegacyBounds(): void {
    for (const e of this.entries()) {
      if (!e.spriteBase64 || this.boundsChecked.has(e.id)) continue;
      if (e.spriteBotFrac !== 1 && e.spriteTopFrac !== 0) continue;
      this.boundsChecked.add(e.id);
      loadImage(e.spriteBase64).then(img => {
        const rows = opaqueRows(img, 300);
        if (!rows) return;
        if (Math.abs(rows.bot - (e.spriteBotFrac || 1)) > 0.005 || Math.abs(rows.top - (e.spriteTopFrac || 0)) > 0.005) {
          this.edit(e.id, x => { x.spriteTopFrac = rows.top; x.spriteBotFrac = rows.bot; });
        }
      }).catch(() => undefined);
    }
  }

  // ── zoom and pan ──
  protected setZoom(z: number): void {
    this.zoom.set(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)));
    this.clampPan();
  }
  private clampPan(): void {
    this.pan.set(Math.max(0, Math.min(Math.max(0, this.layout().canvasW - this.stageSize().w), this.pan())));
  }
  private panTo(idx: number): void {
    const L = this.layout(), c = L.chars[idx];
    if (c) this.pan.set(Math.max(0, Math.min(Math.max(0, L.canvasW - this.stageSize().w), c.x - this.stageSize().w / 2)));
  }

  private panDrag: { x: number; pan: number } | null = null;
  private drag: { id: string; x: number; active: boolean; insert: number | null } | null = null;
  private dragged = false;

  private static x(e: MouseEvent | TouchEvent): number {
    if ('touches' in e) return (e.touches[0] ?? e.changedTouches[0])?.clientX ?? 0;
    return e.clientX;
  }

  protected stageDown(e: MouseEvent | TouchEvent): void {
    if ('touches' in e && e.touches.length !== 1) return;
    if (this.drag) { this.drag = null; this.draggingId.set(null); this.dropX.set(null); return; }
    this.panDrag = { x: HeightChart.x(e), pan: this.pan() };
    e.preventDefault();
  }

  protected charDown(e: MouseEvent | TouchEvent, id: string): void {
    e.stopPropagation();
    if ('touches' in e && e.touches.length !== 1) return;
    this.drag = { id, x: HeightChart.x(e), active: false, insert: null };
    this.dragged = false;
  }

  protected charClick(id: string): void {
    if (!this.dragged) this.selectedId.set(id);
  }

  private onMove(e: MouseEvent | TouchEvent): void {
    if (!this.panDrag && !this.drag) return;
    if (e.cancelable) e.preventDefault();
    const x = HeightChart.x(e);
    if (this.panDrag) {
      this.pan.set(this.panDrag.pan - (x - this.panDrag.x));
      this.clampPan();
    }
    if (this.drag) {
      if (!this.drag.active && Math.abs(x - this.drag.x) > 6) { this.drag.active = true; this.dragged = true; this.draggingId.set(this.drag.id); }
      if (!this.drag.active) return;
      const stage = this.stageEl()?.nativeElement;
      if (!stage) return;
      const L = this.layout();
      const cursor = x - stage.getBoundingClientRect().left + this.pan();
      const n = L.chars.length;
      const pos = L.chars.map((_, i) => (n > 1 ? ((i + 1) / (n + 1)) * L.canvasW : L.canvasW / 2));
      let insert = 0;
      pos.forEach((p, i) => { if (cursor > p) insert = i + 1; });
      this.drag.insert = insert;
      this.dropX.set(!pos.length ? L.canvasW / 2 : insert === 0 ? pos[0] * 0.5 : insert >= pos.length ? (pos[pos.length - 1] + L.canvasW) * 0.5 : (pos[insert - 1] + pos[insert]) * 0.5);
    }
  }

  private onUp(): void {
    this.panDrag = null;
    const d = this.drag;
    this.drag = null;
    if (!d?.active) return;
    this.draggingId.set(null);
    this.dropX.set(null);
    const list = [...this.entries()];
    const from = list.findIndex(e => e.id === d.id), to = d.insert;
    if (from < 0 || to === null || to === from || to === from + 1) return;
    const [moved] = list.splice(from, 1);
    const at = to > from ? to - 1 : to;
    list.splice(at, 0, moved);
    this.entries.set(list);
    this.panTo(at);
    this.queueSave();
  }
}
