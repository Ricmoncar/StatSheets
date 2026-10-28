import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CharacterStore } from '../../core/data/character-store';
import { EncData, EncMemory, EncNpc, EncPlace, EncStatus, EncyclopediaStore, statusFolder } from '../../core/data/encyclopedia-store';
import { Character, InventoryItem } from '../../core/data/models';
import { ITEM_ICONS } from '../../core/game/item-icons';
import { TRAITS } from '../../core/game/traits-data';
import { uploadMedia } from '../../core/media';
import { NotifyService } from '../../core/notify.service';
import { PixelTheme } from '../../core/pixel/pixel-theme.service';
import { SoundService } from '../../core/sound.service';
import { Modal } from '../../ui/modal';
import { StatusOrb } from '../../ui/status-orb';

type Section = 'characters' | 'places' | 'statuses' | 'memories' | 'items' | 'npcs';
type Folder = 'GOOD' | 'BAD' | 'NEUTRAL';
interface Item extends InventoryItem { characterId: string; characterName: string; characterColor?: string; characterAvatar?: string | null }
type Entry = Character | EncPlace | EncStatus | EncMemory | Item | EncNpc;
type Editing =
  | { kind: 'place'; id: string | null; d: EncPlace }
  | { kind: 'status'; id: string | null; d: EncStatus }
  | { kind: 'memory'; id: string | null; d: EncMemory }
  | { kind: 'npc'; id: string | null; d: EncNpc };

const SECTIONS: Record<Section, { label: string; sub: string; col: string; tab: string }> = {
  characters: { label: 'CHARACTERS', sub: 'CHARACTER PROFILES', col: '#c9a227', tab: 'CHARACTERS' },
  places: { label: 'PLACES', sub: 'LOCATIONS & REALMS', col: '#2a9d8f', tab: 'PLACES' },
  statuses: { label: 'STATUS EFFECTS', sub: 'BUFFS, DEBUFFS & FX', col: '#8b5cf6', tab: 'STATUS FX' },
  memories: { label: 'MEMORIES', sub: 'CHAPTERS & SCENES', col: '#e76f51', tab: 'MEMORIES' },
  items: { label: 'ITEMS', sub: 'EQUIPMENT & BAG', col: '#00ccaa', tab: 'ITEMS' },
  npcs: { label: 'NPCS', sub: 'NON-PLAYER CHARACTERS', col: '#e05a9a', tab: 'NPCS' },
};
const ORDER: Section[] = ['characters', 'places', 'statuses', 'memories', 'items', 'npcs'];
const EMPTY: Record<Section, { icon: string; title: string; sub: string }> = {
  characters: { icon: '⚔', title: 'NO CHARACTERS', sub: 'CREATE CHARACTERS IN THE MAIN APP' },
  places: { icon: '◈', title: 'NO PLACES YET', sub: 'ADD YOUR FIRST LOCATION ENTRY' },
  statuses: { icon: '✦', title: 'NO STATUS EFFECTS', sub: 'DOCUMENT YOUR BUFFS & DEBUFFS' },
  memories: { icon: '✦', title: 'NO CHAPTERS YET', sub: 'BEGIN WRITING YOUR STORY' },
  items: { icon: '⚒', title: 'NO ITEMS', sub: 'ITEMS ARE ADDED FROM CHARACTER INVENTORIES' },
  npcs: { icon: '◉', title: 'NO NPCS YET', sub: 'ADD YOUR FIRST NON-PLAYER CHARACTER' },
};
const AB_COLORS: Record<string, { text: string; icon: string }> = {
  ACTIVE: { text: '#00ffff', icon: '⚡︎' }, PASSIVE: { text: '#cc99ff', icon: '◈' }, REACTION: { text: '#ffff44', icon: '↺' },
  TOGGLE: { text: '#00ff80', icon: '⇌' }, AURA: { text: '#5599ff', icon: '◎' }, ULTIMATE: { text: '#ff8844', icon: '★' },
};
const STATUS_TYPE_COLORS: Record<string, string> = { BUFF: '#44ff88', DEBUFF: '#ff4444', NEUTRAL: '#aaaaaa', PASSIVE: '#cc99ff', UNIQUE: '#ffcc44' };
/** Firestore's hard cap is 1 MiB a document: a picture that would take enc/data past this goes to Cloudinary instead. */
const DOC_SAFE_LIMIT = 900000;
const NARA = /^NARA!+$/;

function toRoman(n: number): string {
  const v = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1], s = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let r = '';
  v.forEach((val, i) => { while (n >= val) { r += s[i]; n -= val; } });
  return r;
}
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
/** A colour light enough to read on the dark page: a dark one is mixed toward white (the orbs and dots keep the real one). */
function legible(col: string): string {
  let h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(col || '')?.[1];
  if (!h) return col;
  if (h.length === 3) h = h.replace(/./g, c => c + c);
  const n = parseInt(h, 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const l = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  if (l >= 0.4) return col;
  const t = (0.4 - l) / (1 - l);
  return '#' + rgb.map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * The ENCYCLOPAEDIA: the codex of the realm, a book of six sections
 * (characters, places, status effects, memories, items, NPCs), the index on
 * the left page and the entry on the right, as the old page laid it out
 * (encyclopedia.html), in the site's pixel style. Characters and items come
 * from the characters; places, statuses, memories and NPCs live in enc/data
 * and are edited here.
 */
@Component({
  selector: 'ss-encyclopedia-page',
  imports: [Modal, StatusOrb, RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './encyclopedia-page.html',
  styleUrl: './encyclopedia-page.scss',
  host: {
    '[style.--enc-col]': 'cfg().col',
    '(document:keydown)': 'key($event)',
  },
})
export class EncyclopediaPage {
  private readonly store = inject(EncyclopediaStore);
  private readonly chars = inject(CharacterStore);
  private readonly notify = inject(NotifyService);
  protected readonly sound = inject(SoundService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroll');

  protected readonly ORDER = ORDER;
  protected readonly SECTIONS = SECTIONS;
  protected readonly AB_COLORS = AB_COLORS;
  protected readonly ITEM_ICONS = ITEM_ICONS;
  protected readonly FOLDERS: Folder[] = ['GOOD', 'BAD', 'NEUTRAL'];
  protected readonly PLACE_TYPES = ['CITY', 'DUNGEON', 'WILDERNESS', 'LANDMARK', 'REALM', 'RUIN', 'VOID', 'OTHER'];
  protected readonly STATUS_TYPES = ['DEBUFF', 'BUFF', 'NEUTRAL', 'PASSIVE', 'UNIQUE'];
  protected readonly SHAPES = [['circle', 'Sphere'], ['rounded-square', 'Rounded Square'], ['square', 'Sharp Square'], ['diamond', 'Diamond'], ['hexagon', 'Hexagon'], ['triangle', 'Triangle'], ['teardrop', 'Teardrop'], ['star', 'Star']];
  protected readonly ALIGNMENTS = ['NEUTRAL', 'FRIENDLY', 'HOSTILE', 'ALLY', 'ENEMY', 'UNKNOWN'];
  protected readonly STATUS_SWATCHES = ['#ff4444', '#ff8844', '#ffff44', '#44ff88', '#44aaff', '#aa44ff', '#ff44aa', '#aaaaaa', '#ffffff', '#00ffff', '#cc99ff', '#00ff80'];
  protected readonly NPC_SWATCHES = ['#e05a9a', '#e05a5a', '#e09a5a', '#c9a227', '#5ae0a0', '#5aaae0', '#a05ae0', '#aaaaaa'];
  protected readonly toRoman = toRoman;
  protected readonly legible = legible;

  protected readonly section = signal<Section>('characters');
  protected readonly idx = signal(0);
  /** Which way the page turned, for its animation (and a count, so the same way twice still turns). */
  protected readonly turn = signal<{ dir: 'next' | 'prev'; n: number }>({ dir: 'next', n: 0 });
  protected readonly tocOpen = signal(false);
  protected readonly memView = signal<'char' | 'all'>('char');
  protected readonly memSearch = signal('');
  protected readonly memCollapsed = signal<ReadonlySet<string>>(new Set());
  protected readonly folderOpen = signal<Record<Folder, boolean>>({ GOOD: true, BAD: true, NEUTRAL: true });
  protected readonly editing = signal<Editing | null>(null);
  protected readonly scene = signal<{ memId: string; i: number | null; title: string; text: string } | null>(null);
  protected readonly confirm = signal<{ type: 'place' | 'status' | 'memory' | 'npc'; id: string } | null>(null);
  protected readonly full = signal<string | null>(null);
  protected readonly openTracks = signal<ReadonlySet<string>>(new Set());
  protected readonly uploading = signal(false);
  protected readonly dragId = signal<string | null>(null);
  protected readonly dragOver = signal<string | null>(null);
  private autoScroll: ReturnType<typeof setInterval> | undefined;
  private autoDir = 0;
  /** The entry to keep open once the list catches up with a write (a new one, or the open one after a drag), and where it was. */
  private follow: { id: string; at: number } | null = null;

  protected readonly cfg = computed(() => SECTIONS[this.section()]);
  protected readonly enc = computed<EncData>(() => this.store.enc());
  /** The characters in the main app's order (their order, else when they were made). */
  protected readonly characters = computed(() => [...this.chars.characters()].sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0)));
  /** Every item in every character's bag, with whose it is. */
  protected readonly items = computed<Item[]>(() => this.characters().flatMap(c => (c.inventory || []).map(i => ({ ...i, characterId: c.id, characterName: c.name, characterColor: c.color, characterAvatar: c.avatar }))));
  protected readonly list = computed<Entry[]>(() => {
    const e = this.enc();
    switch (this.section()) {
      case 'characters': return this.characters();
      case 'places': return e.places;
      case 'statuses': return e.statuses;
      case 'memories': return e.memories;
      case 'items': return this.items();
      case 'npcs': return e.npcs;
    }
  });
  protected readonly entry = computed<Entry | null>(() => this.list()[this.idx()] ?? null);
  protected readonly empty = computed(() => EMPTY[this.section()]);

  /** The status index: three folders, each status keeping its place in the one list (and its numeral). */
  protected readonly statusGroups = computed(() => {
    const groups: Record<Folder, { s: EncStatus; i: number }[]> = { GOOD: [], BAD: [], NEUTRAL: [] };
    this.enc().statuses.forEach((s, i) => groups[statusFolder(s)].push({ s, i }));
    return groups;
  });
  /** The memories index by character: each character's chapters, in the characters' order, then the unassigned. */
  protected readonly memGroups = computed(() => {
    const mems = this.enc().memories, chars = this.characters(), search = this.memSearch().toLowerCase().trim();
    const groups = new Map<string, { char: Character; items: { m: EncMemory; i: number }[] }>();
    const unassigned: { m: EncMemory; i: number }[] = [];
    mems.forEach((m, i) => {
      const ids = m.characterIds || [];
      if (!ids.length) { unassigned.push({ m, i }); return; }
      for (const cid of ids) {
        if (!groups.has(cid)) { const char = chars.find(c => c.id === cid); if (char) groups.set(cid, { char, items: [] }); }
        groups.get(cid)?.items.push({ m, i });
      }
    });
    const order = chars.map(c => c.id);
    const out = [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .filter(([, g]) => !search || (g.char.name || '').toLowerCase().includes(search))
      .map(([id, g]) => ({ id, name: g.char.name || 'UNNAMED', col: legible(g.char.color || '#888'), nara: NARA.test(g.char.name || ''), items: g.items }));
    if (unassigned.length && !search) out.push({ id: '__unassigned__', name: 'UNASSIGNED', col: '#444', nara: false, items: unassigned });
    return out;
  });

  constructor() {
    // an index past the end of the list (an entry deleted, or the list still loading) comes back to the last entry
    effect(() => { const n = this.list().length, i = this.idx(); if (n && i > n - 1) this.idx.set(n - 1); });
    // a write shows once the document comes back with it: then the page turns to the entry, wherever it now is
    effect(() => {
      const list = this.list(), f = this.follow;
      if (!f) return;
      const i = list.findIndex(e => (e as { id?: string }).id === f.id);
      if (i < 0 || i === f.at) return;
      this.follow = null;
      untracked(() => (f.at < 0 ? this.go(i) : this.idx.set(i)));
    });
    // the open section's colour is the site's accent while the book is open
    const theme = inject(PixelTheme);
    effect(() => theme.setAccent(this.cfg().col));
    inject(DestroyRef).onDestroy(() => { theme.setAccent(null); clearInterval(this.autoScroll); });
  }

  // ── turning the pages ──
  protected setSection(s: Section): void {
    this.follow = null;
    this.section.set(s);
    this.idx.set(0);
    this.turn.update(t => ({ dir: 'next', n: t.n + 1 }));
    this.scene.set(null);
    this.tocOpen.set(false);
    this.top();
  }
  protected go(i: number): void {
    this.follow = null;
    this.turn.update(t => ({ dir: i >= this.idx() ? 'next' : 'prev', n: t.n + 1 }));
    this.idx.set(i);
    this.scene.set(null);
    this.tocOpen.set(false);
    this.top();
  }
  protected nav(dir: 'next' | 'prev'): void {
    const i = this.idx(), n = this.list().length;
    if (dir === 'next' && i < n - 1) this.go(i + 1);
    else if (dir === 'prev' && i > 0) this.go(i - 1);
  }
  private top(): void { const el = this.scroller()?.nativeElement; if (el) el.scrollTop = 0; }
  protected key(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (t?.closest?.('input, textarea, select, [contenteditable]') || this.editing() || this.confirm()) {
      if (e.key === 'Escape') { this.editing.set(null); this.confirm.set(null); }
      return;
    }
    if (e.key === 'Escape') { this.full.set(null); this.scene.set(null); }
    if (e.key === 'ArrowRight') this.nav('next');
    if (e.key === 'ArrowLeft') this.nav('prev');
  }

  // ── reading the entries ──
  protected asChar(e: Entry | null): Character { return e as Character; }
  protected asPlace(e: Entry | null): EncPlace { return e as EncPlace; }
  protected asStatus(e: Entry | null): EncStatus { return e as EncStatus; }
  protected asMemory(e: Entry | null): EncMemory { return e as EncMemory; }
  protected asItem(e: Entry | null): Item { return e as Item; }
  protected asNpc(e: Entry | null): EncNpc { return e as EncNpc; }
  protected entryName(e: Entry): string { return (e as { name?: string }).name || (e as { title?: string }).title || 'UNNAMED'; }
  protected dot(e: Entry): string {
    const s = this.section();
    if (s === 'items') return (e as Item).characterColor || '#00ccaa';
    if (s === 'memories') return SECTIONS.memories.col;
    return (e as { color?: string }).color || SECTIONS[s].col;
  }
  protected isNara(c: Character | null | undefined): boolean { return !!c && NARA.test(c.name || ''); }

  /** A character's stat bars: HP and IQ out of 500, the rest out of 100, coloured red to yellow to green. */
  protected stats(c: Character) {
    const st = (c.stats || {}) as Record<string, number | undefined>;
    return [['hp', 'HP', 500], ['atk', 'ATK', 100], ['def', 'DEF', 100], ['mag', 'MAG', 100], ['spd', 'SPD', 100], ['iq', 'IQ', 500]].map(([k, label, max]) => {
      const val = (k === 'iq' ? st['iq'] ?? 50 : st[k as string] || 0) as number, r = Math.min(Math.max(val / (max as number), 0), 1);
      const col = r < 0.5 ? `rgb(255,${Math.round(80 + 175 * r * 2)},${Math.round(40 + 30 * r * 2)})` : `rgb(${Math.round(255 - 210 * (r - 0.5) * 2)},255,${Math.round(70 + 60 * (r - 0.5) * 2)})`;
      return { label: label as string, val, pct: Math.round(r * 100), col };
    });
  }
  protected traits(c: Character) {
    return (c.traits || []).slice(0, 14).map(t => {
      const def = TRAITS[t];
      return { key: t, name: (def ? def.name : t.replace(/_/g, ' ')).replace(/\[NAME\]/g, c.name || '?'), rarity: def ? def.rarity : 'common', shimmy: !!c.shimmyfulTraits?.includes(t) };
    });
  }
  protected infoFields(c: Character): [string, string][] {
    const i = c.info || {};
    return ([['RACE', i.race], ['AGE', i.age], ['PRONOUNS', i.pronouns], ['HEIGHT', i.height], ['ORIGIN', i.origin], ['OCCUPATION', i.occupation], ['AFFILIATION', i.affiliation], ['OWNER', i.owner]] as [string, string | undefined][])
      .filter((f): f is [string, string] => !!f[1]);
  }
  protected passives(list: unknown[] | undefined): string[] { return (list || []).filter(Boolean).map(p => String(p)); }
  protected abColor(type: string | undefined) { return AB_COLORS[type || 'ACTIVE'] || AB_COLORS['ACTIVE']; }
  protected statusTypeColor(type: string | undefined): string { return STATUS_TYPE_COLORS[type || 'NEUTRAL'] || '#888'; }
  protected stars(n: number | undefined): number[] { return Array.from({ length: Math.max(0, Math.min(5, Number(n) || 0)) }, (_, i) => i); }
  protected modSign(op: string | undefined): string { return op === 'add' ? '+' : op === 'sub' ? '-' : op === 'mul' ? 'x' : op === 'div' ? '/' : ''; }
  protected itemIcon(i: Item): string { return ITEM_ICONS[i.icon || 'sword'] || '🎒'; }
  protected folderLabel(f: Folder): string { return f === 'GOOD' ? 'POSITIVE' : f === 'BAD' ? 'NEGATIVE' : 'NEUTRAL'; }
  protected charName(id: string): string { return this.characters().find(c => c.id === id)?.name || ''; }

  // ── soundtracks: YouTube, played in the page ──
  private embeds = new Map<string, SafeResourceUrl | null>();
  protected embed(url: string): SafeResourceUrl | null {
    if (!this.embeds.has(url)) {
      const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
      this.embeds.set(url, m ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${m[1]}?modestbranding=1`) : null);
    }
    return this.embeds.get(url) ?? null;
  }
  protected toggleTrack(k: string): void { this.openTracks.update(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }

  // ── the picture on a place or a chapter: leans away from the pointer ──
  protected lean(e: PointerEvent): void {
    const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect(), img = el.querySelector('img');
    if (img) img.style.transform = `scale(1.05) translate(${-((e.clientX - r.left) / r.width - 0.5) * 10}px, ${-((e.clientY - r.top) / r.height - 0.5) * 10}px)`;
  }
  protected unlean(e: PointerEvent): void { const img = (e.currentTarget as HTMLElement).querySelector('img'); if (img) img.style.transform = 'scale(1.05)'; }

  // ── the index: memories ──
  protected toggleMemChar(id: string): void { this.memCollapsed.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  // ── the index: statuses, dragged into order and between folders ──
  protected toggleFolder(f: Folder): void { this.folderOpen.update(o => ({ ...o, [f]: !o[f] })); }
  protected dragStart(e: DragEvent, id: string): void {
    this.dragId.set(id);
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch { /* some browsers refuse */ } }
  }
  protected dragOverItem(e: DragEvent, key: string): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (key !== this.dragId()) this.dragOver.set(key);
    // near the top or bottom of the index, it scrolls
    const toc = (e.currentTarget as HTMLElement).closest('.toc') as HTMLElement | null;
    if (!toc) return;
    const r = toc.getBoundingClientRect(), dir = e.clientY - r.top < 48 ? -1 : r.bottom - e.clientY < 48 ? 1 : 0;
    if (dir !== this.autoDir) {
      clearInterval(this.autoScroll);
      this.autoDir = dir;
      if (dir) this.autoScroll = setInterval(() => { toc.scrollTop += dir * 12; }, 40);
    }
  }
  protected dragEnd(): void { this.dragId.set(null); this.dragOver.set(null); clearInterval(this.autoScroll); this.autoDir = 0; }
  protected drop(e: DragEvent, target: { id?: string; group?: Folder }): void {
    e.preventDefault();
    const src = this.dragId();
    this.dragEnd();
    if (!src) return;
    const cur = this.enc().statuses, at = this.idx();
    if (cur.findIndex(s => s.id === src) < 0 || (!target.group && (!target.id || target.id === src))) return;
    // the open entry stays open wherever the move puts it
    const open = cur[at]?.id;
    if (open) this.follow = { id: open, at };
    this.store.change(d => {
      const f = d.statuses.findIndex(s => s.id === src);
      if (f < 0) return;
      const [moved] = d.statuses.splice(f, 1);
      if (target.id) {
        // just before the one it was dropped on
        const ti = d.statuses.findIndex(s => s.id === target.id);
        d.statuses.splice(ti < 0 ? d.statuses.length : ti, 0, moved);
      } else if (target.group) {
        moved.folder = target.group;
        const last = d.statuses.map((s, i) => ({ s, i })).filter(x => statusFolder(x.s) === target.group).map(x => x.i).pop();
        d.statuses.splice(last === undefined ? d.statuses.length : last + 1, 0, moved);
      }
    }).then(() => this.notify.notify('STATUS ORDER UPDATED'), () => this.notify.notify('COULD NOT SAVE THE ORDER', 'err'));
  }

  // ── writing: places, statuses, memories, NPCs ──
  protected newEntry(): void {
    const s = this.section();
    this.tocOpen.set(false);
    if (s === 'places') this.editPlace(null);
    else if (s === 'statuses') this.editStatus(null);
    else if (s === 'npcs') this.editNpc(null);
    else if (s === 'memories') this.editMemory(null);
  }
  protected newLabel(): string { const s = this.section(); return s === 'places' ? 'NEW PLACE' : s === 'statuses' ? 'NEW STATUS' : s === 'npcs' ? 'NEW NPC' : 'NEW CHAPTER'; }
  protected editPlace(id: string | null): void {
    const p = id ? this.enc().places.find(x => x.id === id) : null;
    this.editing.set({ kind: 'place', id, d: { id: id || '', name: '', region: '', type: 'CITY', desc: '', lore: '', features: '', image: null, soundtracks: [], ...structuredClone(p || {}) } as EncPlace });
  }
  protected editStatus(id: string | null): void {
    const s = id ? this.enc().statuses.find(x => x.id === id) : null;
    this.sound.play('click', { volume: 0.5 });
    this.editing.set({ kind: 'status', id, d: { id: id || '', name: '', type: 'DEBUFF', color: '#ff4444', desc: '', duration: '', stars: 0, shape: 'circle', ...structuredClone(s || {}) } as EncStatus });
  }
  protected editMemory(id: string | null): void {
    const m = id ? this.enc().memories.find(x => x.id === id) : null;
    this.editing.set({ kind: 'memory', id, d: { id: id || '', title: '', arc: '', date: '', image: null, scenes: [], characterIds: [], ...structuredClone(m || {}) } as EncMemory });
  }
  protected editNpc(id: string | null): void {
    const n = id ? this.enc().npcs.find(x => x.id === id) : null;
    this.editing.set({ kind: 'npc', id, d: { id: id || '', name: '', role: '', affiliation: '', alignment: 'NEUTRAL', color: '#e05a9a', desc: '', personality: '', notes: '', image: null, ...structuredClone(n || {}) } as EncNpc });
  }
  protected closeEdit(): void {
    if (this.editing()?.kind === 'status') this.sound.play('click', { rate: 1.1, volume: 0.4 });
    this.editing.set(null);
  }
  /** Sets a field of what is being edited. */
  protected set(field: string, value: unknown): void { this.editing.update(e => e ? { ...e, d: { ...e.d, [field]: value } } as Editing : e); }
  protected field(field: string): string { const e = this.editing(); return e ? String((e.d as unknown as Record<string, unknown>)[field] ?? '') : ''; }
  protected pickStar(n: number): void { this.set('stars', n); this.sound.play('click', { rate: 0.95 + Math.random() * 0.1, volume: 0.45 }); }
  protected toggleCharLink(id: string, on: boolean): void {
    const e = this.editing();
    if (e?.kind !== 'memory') return;
    const ids = new Set(e.d.characterIds || []);
    if (on) ids.add(id); else ids.delete(id);
    this.set('characterIds', [...ids]);
  }
  protected addTrack(): void { const e = this.editing(); if (e?.kind === 'place') this.set('soundtracks', [...(e.d.soundtracks || []), { label: '', url: '' }]); }
  protected setTrack(i: number, f: 'label' | 'url', v: string): void {
    const e = this.editing();
    if (e?.kind !== 'place') return;
    this.set('soundtracks', (e.d.soundtracks || []).map((t, k) => k === i ? { ...t, [f]: v } : t));
  }
  protected dropTrack(i: number): void { const e = this.editing(); if (e?.kind === 'place') this.set('soundtracks', (e.d.soundtracks || []).filter((_, k) => k !== i)); }

  /** A picture for a place, a chapter or an NPC: kept in enc/data, unless that would make it too big, then on Cloudinary. */
  protected async upload(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement, file = input.files?.[0];
    input.value = '';
    const e = this.editing();
    if (!file || !e) return;
    if (!file.type.startsWith('image/')) { this.notify.notify('NOT AN IMAGE', 'err'); return; }
    if (file.size > 20 * 1024 * 1024) { this.notify.notify('IMAGE TOO LARGE (MAX 20MB)', 'err'); return; }
    const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
    const old = e.id ? ((this.listFor(e.kind).find(x => x.id === e.id) as { image?: string | null } | undefined)?.image || '') : '';
    const size = JSON.stringify(this.enc()).length - old.length + dataUrl.length;
    let image = dataUrl;
    if (size > DOC_SAFE_LIMIT) {
      this.notify.notify('UPLOADING IMAGE...');
      this.uploading.set(true);
      try { image = await uploadMedia(file, 'image'); this.notify.notify('IMAGE UPLOADED ✓'); }
      catch { this.notify.notify('UPLOAD FAILED: TRY A SMALLER IMAGE', 'err'); return; }
      finally { this.uploading.set(false); }
    }
    this.set('image', image);
  }
  private listFor(kind: Editing['kind']): { id: string }[] {
    const e = this.enc();
    return kind === 'place' ? e.places : kind === 'status' ? e.statuses : kind === 'memory' ? e.memories : e.npcs;
  }

  protected save(): void {
    const e = this.editing();
    if (!e) return;
    const id = e.id || genId();
    let entry: EncPlace | EncStatus | EncMemory | EncNpc, key: keyof EncData, what: string;
    if (e.kind === 'place') {
      const p = e.d;
      if (!p.name.trim()) { this.notify.notify('PLACE NEEDS A NAME', 'err'); return; }
      entry = { id, name: p.name.trim(), region: (p.region || '').trim(), type: p.type, desc: (p.desc || '').trim(), lore: (p.lore || '').trim(), features: (p.features || '').trim(), image: p.image || null,
        soundtracks: (p.soundtracks || []).map(t => ({ label: t.label.trim(), url: t.url.trim() })).filter(t => t.url) };
      key = 'places'; what = 'PLACE';
    } else if (e.kind === 'status') {
      const s = e.d, existing = e.id ? this.enc().statuses.find(x => x.id === e.id) : null;
      if (!s.name.trim()) { this.notify.notify('STATUS NEEDS A NAME', 'err'); return; }
      entry = { id, name: s.name.trim(), type: s.type, folder: existing ? existing.folder : statusFolder({ type: s.type }), color: s.color, desc: (s.desc || '').trim(), duration: (s.duration || '').trim(), stars: s.stars || 0, shape: s.shape || 'circle' };
      key = 'statuses'; what = 'STATUS';
    } else if (e.kind === 'memory') {
      const m = e.d, existing = e.id ? this.enc().memories.find(x => x.id === e.id) : null;
      if (!m.title.trim()) { this.notify.notify('CHAPTER NEEDS A TITLE', 'err'); return; }
      entry = { id, title: m.title.trim(), arc: (m.arc || '').trim(), date: (m.date || '').trim(), image: m.image || null, scenes: existing ? (existing.scenes || []) : [], characterIds: m.characterIds || [] };
      key = 'memories'; what = 'CHAPTER';
    } else {
      const n = e.d;
      if (!n.name.trim()) { this.notify.notify('NPC NEEDS A NAME', 'err'); return; }
      entry = { id, name: n.name.trim(), role: (n.role || '').trim(), affiliation: (n.affiliation || '').trim(), alignment: n.alignment, color: n.color, desc: (n.desc || '').trim(), personality: (n.personality || '').trim(), notes: (n.notes || '').trim(), image: n.image || null };
      key = 'npcs'; what = 'NPC';
    }
    const isNew = !e.id;
    if (isNew && this.section() === key) this.follow = { id, at: -1 };
    this.store.change(d => {
      const list = d[key] as { id: string; scenes?: unknown }[];
      const i = list.findIndex(x => x.id === id);
      // a chapter keeps the scenes it has now (written meanwhile from another tab, say)
      if (key === 'memories' && i >= 0) (entry as EncMemory).scenes = (list[i] as EncMemory).scenes || [];
      if (i >= 0) list[i] = entry; else list.push(entry);
    }).then(() => {
      if (e.kind === 'status') this.sound.play('save', { volume: 0.7 });
      this.notify.notify(what + (isNew ? ' ADDED' : ' UPDATED'));
    }, () => this.notify.notify('COULD NOT SAVE', 'err'));
    this.editing.set(null);
  }

  protected del(type: 'place' | 'status' | 'memory' | 'npc', id: string): void { this.confirm.set({ type, id }); }
  protected confirmYes(): void {
    const c = this.confirm();
    if (!c) return;
    const key: keyof EncData = c.type === 'place' ? 'places' : c.type === 'status' ? 'statuses' : c.type === 'memory' ? 'memories' : 'npcs';
    this.store.change(d => { const list = d[key] as { id: string }[], i = list.findIndex(x => x.id === c.id); if (i >= 0) list.splice(i, 1); })
      .then(() => this.notify.notify('ENTRY DELETED'), () => this.notify.notify('COULD NOT DELETE', 'err'));
    this.idx.update(i => Math.max(0, i - 1));
    this.confirm.set(null);
  }

  // ── scenes, written into a chapter in place ──
  protected openScene(m: EncMemory, i: number | null): void {
    const sc = i === null ? { title: '', text: '' } : (m.scenes || [])[i] || { title: '', text: '' };
    this.scene.set({ memId: m.id, i, title: sc.title || '', text: sc.text || '' });
    setTimeout(() => document.querySelector('.scene-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }
  protected saveScene(): void {
    const f = this.scene();
    if (!f) return;
    if (!f.text.trim()) { this.notify.notify('SCENE NEEDS TEXT', 'err'); return; }
    const sc = { title: f.title.trim(), text: f.text };
    this.store.change(d => {
      const m = d.memories.find(x => x.id === f.memId);
      if (!m) return;
      m.scenes = m.scenes || [];
      if (f.i !== null && f.i < m.scenes.length) m.scenes[f.i] = sc; else m.scenes.push(sc);
    }).then(() => this.notify.notify(f.i !== null ? 'SCENE UPDATED' : 'SCENE ADDED'), () => this.notify.notify('COULD NOT SAVE', 'err'));
    this.scene.set(null);
  }
  protected deleteScene(m: EncMemory, i: number): void {
    const sc = (m.scenes || [])[i];
    this.store.change(d => {
      const mem = d.memories.find(x => x.id === m.id);
      if (!mem?.scenes) return;
      // the scene that was there, even if others were added meanwhile
      const at = mem.scenes.findIndex(s => s.title === sc?.title && s.text === sc?.text);
      if (at >= 0) mem.scenes.splice(at, 1);
    }).then(() => this.notify.notify('SCENE REMOVED'), () => this.notify.notify('COULD NOT SAVE', 'err'));
  }
  protected setScene(f: 'title' | 'text', v: string): void { this.scene.update(s => s ? { ...s, [f]: v } : s); }

  // ── the status preview ──
  protected previewStars(): number[] { const n = Number(this.field('stars')) || 0; return [1, 2, 3, 4, 5].map(i => i <= n ? 1 : 0); }
}
