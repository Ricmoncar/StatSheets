import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CharacterStore } from '../../../core/data/character-store';
import { Character } from '../../../core/data/models';
import { NotifyService } from '../../../core/notify.service';
import { uploadMedia } from '../../../core/media';
import { PatternCanvas } from '../../../ui/pattern-canvas';
import { EntryRows } from './entry-rows';
import { GameDocs, Named, filled, namedList } from './game-docs';
import { GamePicker } from './game-picker';

interface Song { url: string; name: string }
interface Lms { charId: string | null; desc: string; music: Song | null; special?: Named | null; specialOpponent?: Named | null }
interface FhDoc { role: 'hunter' | 'survivor'; powers: Named[]; abilities: Named[]; perks: Named[]; specialLms: Lms[]; chaseMusic?: Song | null; lmsMusic?: Song | null; power?: Named }
type ListKey = 'powers' | 'abilities' | 'perks';

const HUNTER = '#cc2233', SURVIVOR = '#22bb77';
const ROMAN = ['I', 'II', 'III', 'IV'];
const PERK_ICONS = { hunter: ['✦', '◈', '⬡', '▲'], survivor: ['◆', '◇', '○', '□'] };
const MAX_MB = 20;

function normalize(raw: Partial<FhDoc> | undefined): FhDoc {
  const d = { ...(raw || {}) } as FhDoc;
  if (!d.role) d.role = 'survivor';
  // the old single power becomes a list
  if (d.power && !Array.isArray(d.powers)) { d.powers = [d.power.name || d.power.desc ? d.power : { name: '', desc: '' }]; delete d.power; }
  d.powers = namedList(d.powers);
  d.abilities = namedList(d.abilities);
  d.perks = namedList(d.perks);
  const s = d.specialLms as unknown;
  if (s && !Array.isArray(s)) { const o = s as Lms; d.specialLms = o.charId || o.desc || o.music ? [o] : []; }
  if (!Array.isArray(d.specialLms)) d.specialLms = [];
  return d;
}

/**
 * ASYM HORROR (Final Hour): HUNTER or SURVIVOR, their powers or abilities,
 * perks, music, and Special LMS match-ups. A match-up names an opponent,
 * whose own page then shows it too, and lets them add their side.
 */
@Component({
  selector: 'ss-game-fh',
  imports: [GamePicker, PatternCanvas, EntryRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './final-hour.html',
  styleUrls: ['./game-shared.scss', './final-hour.scss'],
})
export class FinalHourGame {
  private readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);
  protected readonly docs = new GameDocs<FhDoc>('finalHour', normalize);
  protected readonly hunterColor = HUNTER;
  protected readonly survivorColor = SURVIVOR;
  protected readonly roman = ROMAN;
  protected readonly sel = signal<string | null>(null);
  protected readonly mode = signal<'view' | 'edit'>('view');
  protected readonly uploading = signal<string | null>(null);
  protected readonly char = computed(() => (this.sel() ? this.store.byId().get(this.sel()!) ?? null : null));
  protected readonly doc = computed(() => { this.docs.docs(); return this.sel() ? this.docs.get(this.sel()!) : normalize(undefined); });
  protected readonly others = computed(() => this.store.characters().filter(c => !c.isPlaceholder && c.id !== this.sel()));
  protected readonly filledList = (l: Named[]) => filled(l);
  protected readonly perkIcon = (role: string, i: number) => (role === 'hunter' ? PERK_ICONS.hunter : PERK_ICONS.survivor)[i % 4];

  /** Match-ups on this page: its own, then others' that name this character. */
  protected readonly matchups = computed(() => {
    const id = this.sel(), c = this.char();
    if (!id || !c) return [];
    const byId = this.store.byId(), all = this.docs.docs(), d = this.doc();
    const roleOf = (cid: string | null) => (cid && all[cid]?.role) || 'survivor';
    const own = d.specialLms.map((s, i) => ({ s, i, owner: c, ownerRole: d.role, opp: s.charId ? byId.get(s.charId) ?? null : null, oppRole: roleOf(s.charId) }))
      .filter(m => m.s.charId || m.s.desc || m.s.music);
    const incoming: typeof own = [];
    for (const other of this.store.characters()) {
      if (other.id === id || other.isPlaceholder) continue;
      const od = all[other.id];
      if (!od || !Array.isArray(od.specialLms)) continue;
      od.specialLms.forEach((s, i) => { if (s.charId === id) incoming.push({ s, i, owner: other, ownerRole: od.role || 'survivor', opp: c, oppRole: d.role }); });
    }
    return [...own.map(m => ({ ...m, key: `slms_${c.id}_${m.i}` })), ...incoming.map(m => ({ ...m, key: `slms_${m.owner.id}_${m.i}` }))];
  });
  /** Others' match-ups naming this character, where it adds its own side. */
  protected readonly incoming = computed(() => this.matchups().filter(m => m.owner.id !== this.sel()));

  protected readonly dot = (c: Character) => {
    const raw = this.docs.docs()[c.id];
    if (!raw) return null;
    const d = normalize(raw);
    const any = [...d.powers, ...d.abilities, ...d.perks].some(p => p.name || p.desc) || d.specialLms.some(s => s.charId || s.desc);
    return any ? (d.role === 'hunter' ? HUNTER : SURVIVOR) : null;
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected select(id: string): void {
    if (this.sel() !== id) { this.mode.set('view'); this.stop(); }
    this.sel.set(id);
  }
  protected set(change: (d: FhDoc) => void): void {
    const id = this.sel();
    if (id) this.docs.edit(id, change);
  }

  // ── lists (four at most) ──
  protected editRow(k: ListKey, e: { i: number; field: string; value: string }): void {
    this.set(d => { const x = d[k][e.i]; if (x) (x as unknown as Record<string, string>)[e.field] = e.value; });
  }
  protected addRow(k: ListKey): void { this.set(d => { if (d[k].length < 4) d[k].push({ name: '', desc: '' }); }); }
  protected removeRow(k: ListKey, i: number): void {
    this.set(d => { if (d[k].length <= 1) d[k][0] = { name: '', desc: '' }; else d[k].splice(i, 1); });
  }

  // ── Special LMS ──
  protected addLms(): void { this.set(d => d.specialLms.push({ charId: null, desc: '', music: null })); }
  protected removeLms(i: number): void {
    if (this.playingKey() === `slms_${this.sel()}_${i}`) this.stop();
    this.set(d => d.specialLms.splice(i, 1));
  }
  protected editLms(i: number, change: (s: Lms) => void): void { this.set(d => { if (d.specialLms[i]) change(d.specialLms[i]); }); }
  /** The opponent's side lives in the owner's document. */
  protected editOpp(ownerId: string, i: number, change: (s: Lms) => void): void {
    this.docs.edit(ownerId, d => { if (d.specialLms[i]) change(d.specialLms[i]); });
  }
  protected setSpecialField(s: Lms, key: 'special' | 'specialOpponent', field: 'name' | 'desc', v: string): void {
    s[key] = { ...(s[key] || { name: '', desc: '' }), [field]: v };
  }

  // ── music ──
  protected async upload(ev: Event, kind: 'chase' | 'lms' | number): Promise<void> {
    const inp = ev.target as HTMLInputElement;
    const file = inp.files?.[0];
    inp.value = '';
    const id = this.sel();
    if (!file || !id) return;
    if (file.size > MAX_MB * 1024 * 1024) { this.notifier.notify(`File too large: max ${MAX_MB} MB`, 'err'); return; }
    const tag = typeof kind === 'number' ? `slms${kind}` : kind;
    this.uploading.set(tag);
    try {
      const url = await uploadMedia(file, 'video', `fh_music/${id}_${tag}_${Date.now()}`);
      const song = { url, name: file.name.replace(/\.[^/.]+$/, '') };
      if (typeof kind === 'number') { this.editLms(kind, s => { s.music = song; }); this.notifier.notify('Special LMS theme set!', 'ok'); }
      else { this.set(d => { d[kind === 'chase' ? 'chaseMusic' : 'lmsMusic'] = song; }); this.notifier.notify(kind === 'chase' ? 'Chase music set!' : 'LMS music set!', 'ok'); }
    } catch (e) {
      console.error('FH upload error', e);
      this.notifier.notify('Upload failed', 'err');
    } finally {
      this.uploading.set(null);
    }
  }
  protected removeMusic(kind: 'chase' | 'lms'): void {
    if (this.playingKey() === `${kind}_${this.sel()}`) this.stop();
    this.set(d => { d[kind === 'chase' ? 'chaseMusic' : 'lmsMusic'] = null; });
  }
  protected removeLmsMusic(i: number): void {
    if (this.playingKey() === `slms_${this.sel()}_${i}`) this.stop();
    this.editLms(i, s => { s.music = null; });
  }

  // one player for the whole game world, with its own little bar
  private audio: HTMLAudioElement | null = null;
  protected readonly playingKey = signal<string | null>(null);
  protected readonly playing = signal(false);
  protected readonly volume = signal(1);
  protected readonly nowPlaying = signal<{ label: string; name: string; color: string } | null>(null);

  protected play(key: string, url: string, label: string, name: string, color: string): void {
    if (!url) return;
    if (this.audio && this.playingKey() === key) {
      if (this.audio.paused) void this.audio.play().catch(() => undefined); else this.audio.pause();
      return;
    }
    this.audio?.pause();
    const a = new Audio(url);
    a.volume = this.volume();
    a.addEventListener('play', () => this.playing.set(true));
    a.addEventListener('pause', () => this.playing.set(false));
    a.addEventListener('ended', () => { this.playing.set(false); this.playingKey.set(null); });
    this.audio = a;
    this.playingKey.set(key);
    this.nowPlaying.set({ label, name, color });
    void a.play().catch(() => undefined);
  }
  protected isOn(key: string): boolean { return this.playingKey() === key && this.playing(); }
  protected toggle(): void {
    if (!this.audio) return;
    if (this.audio.paused) void this.audio.play().catch(() => undefined); else this.audio.pause();
  }
  protected setVolume(v: number): void {
    this.volume.set(v);
    if (this.audio) this.audio.volume = v;
  }
  protected stop(): void {
    this.audio?.pause();
    this.audio = null;
    this.playingKey.set(null);
    this.playing.set(false);
    this.nowPlaying.set(null);
  }
}
