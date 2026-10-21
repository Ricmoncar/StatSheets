import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Unsubscribe, collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { FIRESTORE, col } from '../../core/firebase';
import { ConfirmService } from '../../core/confirm.service';
import { NotifyService } from '../../core/notify.service';
import { Tip } from '../../core/game/breakdown';
import { RARITY_LABEL } from '../../core/game/roll';
import { effectiveStats, formTraits, getTraitDef } from '../../core/game/stats';
import { TRAITS } from '../../core/game/traits-data';
import { NgTemplateOutlet } from '@angular/common';
import { TipDirective } from '../../ui/tooltip';
import { Icon } from '../../ui/icon';

const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'] as const;
type TierKey = typeof TIERS[number];
const TIER_COLORS: Record<TierKey, string> = { S: '#ff4a4a', A: '#ff884a', B: '#ffcc4a', C: '#4aff9e', D: '#4a9eff', F: '#888888' };
type TierList = { id: string; name: string; createdAt?: number } & Partial<Record<TierKey, string[]>>;

/**
 * The shared tier lists: tabs for each list (double-click to rename), rows
 * S to F and an UNRANKED pool. Characters move by drag and drop, or by
 * clicking one and then the row it goes in.
 */
@Component({
  selector: 'ss-tier-list',
  imports: [TipDirective, NgTemplateOutlet, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tier-list.html',
  styleUrl: './tier-list.scss',
})
export class TierListBoard implements OnInit {
  private readonly db = inject(FIRESTORE);
  private readonly store = inject(CharacterStore);
  private readonly confirm = inject(ConfirmService);
  private readonly notifier = inject(NotifyService);
  private unsub: Unsubscribe | null = null;

  protected readonly tiers = TIERS;
  protected readonly colors = TIER_COLORS;
  protected readonly lists = signal<TierList[]>([]);
  protected readonly activeId = signal<string | null>(null);
  protected readonly selected = signal<string | null>(null);
  protected readonly naming = signal(false);
  protected readonly renaming = signal<string | null>(null);
  protected readonly dropAt = signal<string | null>(null);

  protected readonly active = computed(() => this.lists().find(l => l.id === this.activeId()) ?? null);
  private readonly byId = computed(() => this.store.byId());

  protected readonly rows = computed(() => {
    const a = this.active(), byId = this.byId();
    return TIERS.map(t => ({ tier: t, chars: (a?.[t] || []).map(id => byId.get(id)).filter((c): c is Character => !!c && !c.isPlaceholder) }));
  });
  protected readonly unranked = computed(() => {
    const a = this.active();
    const ranked = new Set(TIERS.flatMap(t => a?.[t] || []));
    return this.store.characters().filter(c => !c.isPlaceholder && !ranked.has(c.id));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.unsub?.());
  }

  ngOnInit(): void {
    this.unsub = onSnapshot(query(collection(this.db, col('tierlists')), orderBy('createdAt')), snap => {
      const lists = snap.docs.map(d => ({ ...(d.data() as Omit<TierList, 'id'>), id: d.id }));
      this.lists.set(lists);
      if (!lists.length) { void this.create('MAIN'); return; }
      if (!lists.some(l => l.id === this.activeId())) this.activeId.set(lists[0].id);
    }, err => console.error('Tier lists failed to load:', err));
  }

  // ── lists ──
  protected async create(name: string): Promise<void> {
    const ref = doc(collection(this.db, col('tierlists')));
    this.activeId.set(ref.id);
    try {
      await setDoc(ref, { name: name.toUpperCase(), S: [], A: [], B: [], C: [], D: [], F: [], createdAt: Date.now() });
    } catch (err) { console.error('Create tier list:', err); }
  }

  /** Shows a name box (a new list's, or a rename) and puts the cursor in it. */
  protected edit(which: 'new' | string): void {
    if (which === 'new') this.naming.set(true); else this.renaming.set(which);
    setTimeout(() => { const el = document.querySelector<HTMLInputElement>('ss-tier-list .tab-input'); el?.focus(); el?.select(); });
  }

  protected confirmNew(input: HTMLInputElement): void {
    const name = input.value.trim();
    this.naming.set(false);
    if (name) void this.create(name);
  }

  protected async remove(l: TierList): Promise<void> {
    if (this.lists().length <= 1) { this.notifier.notify('CANNOT DELETE THE LAST LIST', 'err'); return; }
    if (!(await this.confirm.ask('DELETE THIS TIER LIST?'))) return;
    if (this.activeId() === l.id) this.activeId.set(this.lists().find(x => x.id !== l.id)?.id ?? null);
    deleteDoc(doc(this.db, col('tierlists'), l.id)).catch(err => console.error('Delete tier list:', err));
  }

  protected finishRename(l: TierList, value: string): void {
    this.renaming.set(null);
    const name = value.trim().toUpperCase() || l.name;
    if (name !== l.name) updateDoc(doc(this.db, col('tierlists'), l.id), { name }).catch(() => undefined);
  }

  // ── moving characters ──
  /** Takes the character out of every row, then puts it in `tier` (before `beforeId`, or last). */
  private place(charId: string, tier: TierKey | null, targetId?: string, before = false): void {
    const a = this.active();
    if (!a) return;
    const next: Record<TierKey, string[]> = {} as Record<TierKey, string[]>;
    for (const t of TIERS) next[t] = (a[t] || []).filter(id => id !== charId);
    if (tier) {
      const at = targetId ? next[tier].indexOf(targetId) : -1;
      if (at < 0) next[tier].push(charId);
      else next[tier].splice(before ? at : at + 1, 0, charId);
    }
    // on screen at once; the snapshot confirms it
    this.lists.update(ls => ls.map(l => (l.id === a.id ? { ...l, ...next } : l)));
    updateDoc(doc(this.db, col('tierlists'), a.id), next).catch(err => console.error('TierList save:', err));
  }

  protected chipClick(e: Event, c: Character): void {
    e.stopPropagation();
    this.selected.set(this.selected() === c.id ? null : c.id);
  }

  protected rowClick(tier: TierKey | null): void {
    const id = this.selected();
    if (!id) return;
    this.selected.set(null);
    this.place(id, tier);
  }

  protected dragStart(e: DragEvent, c: Character): void {
    e.dataTransfer?.setData('text/plain', c.id);
  }

  protected overChip(e: DragEvent, c: Character): void {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const key = c.id + (e.clientX < r.left + r.width / 2 ? ':before' : ':after');
    if (this.dropAt() !== key) this.dropAt.set(key);
  }

  protected dropOnChip(e: DragEvent, c: Character, tier: TierKey | null): void {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer?.getData('text/plain');
    const before = this.dropAt() === c.id + ':before';
    this.dropAt.set(null);
    if (!id || id === c.id) return;
    this.place(id, tier, tier ? c.id : undefined, before);
  }

  protected overRow(e: DragEvent, key: string): void {
    e.preventDefault();
    if (this.dropAt() !== key) this.dropAt.set(key);
  }

  protected dropOnRow(e: DragEvent, tier: TierKey | null): void {
    e.preventDefault();
    this.dropAt.set(null);
    const id = e.dataTransfer?.getData('text/plain');
    if (id) this.place(id, tier);
  }

  /** A chip's tooltip: stats, non-zero sub-stats, and traits. */
  protected tipFor(c: Character): () => Tip {
    return () => {
      const e = effectiveStats(c) as unknown as Record<string, number>;
      const fmt = (v: number) => String(v % 1 === 0 ? v : +v.toFixed(1));
      const lines = [['HP', 'hp'], ['ATK', 'atk'], ['DEF', 'def'], ['MAG', 'mag'], ['SPD', 'spd']].map(([label, k]) => ({ label, value: fmt(e[k] || 0) }));
      const subs: [string, string][] = [['CRIT%', 'crit_rate'], ['CRIT DMG', 'crit_dmg'], ['HEAL POW', 'heal_pow'], ['STATUS RES', 'status_res'], ['DEX', 'dexterity'], ['RESIL', 'resilience'], ['TRUE DMG', 'true_dmg'], ['LIFESTEAL', 'lifesteal'], ['CDR', 'cooldown_red']];
      for (const [label, k] of subs) if ((e[k] || 0) > 0) lines.push({ label, value: fmt(e[k]) + '%' });
      const notes = formTraits(c).filter(k => TRAITS[k]).map(k => {
        const def = getTraitDef(c, k);
        const rar = String(TRAITS[k].rarity || 'common');
        return `${(RARITY_LABEL[rar] || rar).toUpperCase()}: ${def?.name || k}. ${def?.desc || ''}`;
      });
      return { title: c.name, lines, notes };
    };
  }
}
