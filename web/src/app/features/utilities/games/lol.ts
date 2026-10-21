import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CharacterStore } from '../../../core/data/character-store';
import { Character } from '../../../core/data/models';
import { Tip } from '../../../core/game/breakdown';
import { PatternCanvas } from '../../../ui/pattern-canvas';
import { TipDirective } from '../../../ui/tooltip';
import { GameDocs } from './game-docs';
import { GamePicker } from './game-picker';
import { NgTemplateOutlet } from '@angular/common';
import { LolItem, LolItems } from './lol-items';

interface Slot { name: string; desc: string; color: string }
interface LolDoc { roles: string[]; resource: string; passive: Slot; q: Slot; w: Slot; e: Slot; r: Slot; stats: Record<string, { base: number; growth: number }>; items: (string | null)[]; role?: string }

const ROLES: Record<string, string> = { top: 'TOP', jgl: 'JGL', mid: 'MID', bot: 'BOT', sup: 'SUP' };
const RESOURCES: Record<string, string> = { mana: 'MANA', energy: 'ENERGY', fury: 'FURY', heat: 'HEAT', none: 'NONE' };
const RES_COLORS: Record<string, string> = { mana: '#4a9eff', energy: '#ffdd33', fury: '#ff4433', heat: '#ff7722', none: '#444444' };
const SLOTS = ['passive', 'q', 'w', 'e', 'r'] as const;
type SlotKey = typeof SLOTS[number];
const SLOT_LABELS: Record<SlotKey, string> = { passive: 'PASSIVE', q: 'Q', w: 'W', e: 'E', r: 'R: ULTIMATE' };
const SLOT_DEFAULTS: Record<SlotKey, string> = { passive: '#a0a0a0', q: '#4a9eff', w: '#44cc88', e: '#ffcc44', r: '#e8a030' };
const STATS = ['hp', 'mana', 'ad', 'as', 'armor', 'mr', 'ms', 'range'];
const STAT_SHORT: Record<string, string> = { hp: 'HP', mana: 'MANA', ad: 'AD', as: 'AS', armor: 'ARM', mr: 'MR', ms: 'MS', range: 'RANGE' };
const STAT_NAMES: Record<string, string> = { hp: 'HEALTH', mana: 'MANA', ad: 'ATTACK DAMAGE', as: 'ATTACK SPEED', armor: 'ARMOR', mr: 'MAGIC RESIST', ms: 'MOVE SPEED', range: 'RANGE' };
const STAT_STEP: Record<string, number> = { hp: 1, mana: 1, ad: 0.1, as: 0.001, armor: 0.1, mr: 0.1, ms: 1, range: 1 };
const STAT_MAX: Record<string, number> = { hp: 3000, mana: 1500, ad: 150, as: 2.5, armor: 150, mr: 150, ms: 500, range: 750 };
const HINT_BASE: Record<string, string> = { hp: 'avg ~580-650', mana: 'varies ~300-800', ad: 'avg ~48-68', as: 'avg ~0.600-0.700', armor: 'avg ~21-38', mr: 'avg ~30-40', ms: 'avg ~325-355', range: 'melee ~150 · ranged ~525' };
const HINT_GROW: Record<string, string> = { hp: 'avg ~85-100', mana: 'avg ~40-55', ad: 'avg ~2.5-4.5', as: 'avg ~1-3.5% per lvl', armor: 'avg ~3.5-5.5', mr: 'avg ~0.5-2.5', ms: 'usually 0', range: 'usually 0' };

function normalize(raw: Partial<LolDoc> | undefined): LolDoc {
  const d = { ...(raw || {}) } as LolDoc;
  if (d.role && !Array.isArray(d.roles)) { d.roles = [d.role]; delete d.role; }
  if (!Array.isArray(d.roles) || !d.roles.length) d.roles = ['mid'];
  d.resource = d.resource || 'mana';
  for (const s of SLOTS) {
    const v = (d[s] && typeof d[s] === 'object' ? d[s] : {}) as Partial<Slot>;
    d[s] = { name: v.name || '', desc: v.desc || '', color: v.color || SLOT_DEFAULTS[s] };
  }
  const stats = (d.stats && typeof d.stats === 'object' ? d.stats : {}) as LolDoc['stats'];
  d.stats = {};
  for (const k of STATS) d.stats[k] = { base: stats[k]?.base ?? 0, growth: stats[k]?.growth ?? 0 };
  d.items = Array.isArray(d.items) ? [...d.items] : [];
  while (d.items.length < 6) d.items.push(null);
  return d;
}
const fmt = (v: number) => { const r = Math.round(v * 100) / 100; return Number.isInteger(r) ? String(r) : String(+r.toFixed(r < 10 ? 3 : 1)); };

/** LEAGUE OF LEGENDS: roles, resource, base stats by level, a six-item build and a passive + QWER kit. */
@Component({
  selector: 'ss-game-lol',
  imports: [GamePicker, PatternCanvas, TipDirective, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lol.html',
  styleUrls: ['./game-shared.scss', './lol.scss'],
})
export class LolGame {
  private readonly store = inject(CharacterStore);
  protected readonly lol = inject(LolItems);
  protected readonly docs = new GameDocs<LolDoc>('lol', normalize);
  protected readonly roles = ROLES;
  protected readonly roleKeys = Object.keys(ROLES);
  protected readonly resources = RESOURCES;
  protected readonly resourceKeys = Object.keys(RESOURCES);
  protected readonly resColors = RES_COLORS;
  protected readonly slots = SLOTS;
  protected readonly slotLabels = SLOT_LABELS;
  protected readonly statKeys = STATS;
  protected readonly statShort = STAT_SHORT;
  protected readonly statNames = STAT_NAMES;
  protected readonly statStep = STAT_STEP;
  protected readonly hintBase = HINT_BASE;
  protected readonly hintGrow = HINT_GROW;

  protected readonly sel = signal<string | null>(null);
  protected readonly mode = signal<'view' | 'edit'>('view');
  protected readonly level = signal(1);
  protected readonly pickerSlot = signal<number | null>(null);
  protected readonly search = signal('');
  protected readonly char = computed(() => (this.sel() ? this.store.byId().get(this.sel()!) ?? null : null));
  protected readonly doc = computed(() => { this.docs.docs(); return this.sel() ? this.docs.get(this.sel()!) : normalize(undefined); });

  /** The stat bars at the chosen level: base + growth per level, plus what the build adds. */
  protected readonly statRows = computed(() => {
    const d = this.doc(), lvl = this.level();
    const bonus = this.lol.bonus(d.items, d.stats['as'].base);
    return STATS.filter(k => d.stats[k].base || d.stats[k].growth).map(k => {
      const s = d.stats[k], max = STAT_MAX[k], at = s.base + s.growth * (lvl - 1), add = bonus[k] || 0;
      const pct = Math.min(100, (at / max) * 100);
      return {
        k, label: k === 'mana' ? (RESOURCES[d.resource] || 'MANA').slice(0, 5) : STAT_SHORT[k],
        pct, bonusPct: Math.max(0, Math.min(100 - pct, (add / max) * 100)), value: fmt(at + add),
      };
    });
  });
  protected readonly matches = computed(() => {
    const q = this.search().toLowerCase().trim(), all = this.lol.items();
    return all ? (q ? all.filter(i => i.name.toLowerCase().includes(q)) : all) : null;
  });

  protected readonly hasKit = (d: LolDoc) => SLOTS.some(s => d[s].name || d[s].desc);
  protected readonly kitAny = (d: LolDoc) => (['q', 'w', 'e'] as const).some(s => d[s].name || d[s].desc);
  protected readonly anyItem = (d: LolDoc) => d.items.some(x => !!x);
  protected readonly dot = (c: Character) => {
    const d = this.docs.docs()[c.id] as Partial<LolDoc> | undefined;
    return d && SLOTS.some(s => (d[s] as Slot | undefined)?.name || (d[s] as Slot | undefined)?.desc) ? c.color || '#888' : null;
  };

  constructor() {
    void this.lol.load();   // in the background, as before
  }

  protected item(id: string | null): LolItem | null { return id ? this.lol.byId()[id] ?? null : null; }
  protected itemTip(it: LolItem): Tip {
    return { title: it.name, color: '#c8aa6e', image: this.lol.image(it.image), lines: it.gold ? [{ label: 'GOLD', value: String(it.gold) }] : [], notes: it.desc ? [it.desc] : [] };
  }

  protected select(id: string): void {
    if (this.sel() !== id) { this.mode.set('view'); this.pickerSlot.set(null); this.search.set(''); this.level.set(1); }
    this.sel.set(id);
  }
  protected set(change: (d: LolDoc) => void): void {
    const id = this.sel();
    if (id) this.docs.edit(id, change);
  }
  protected editSlot(s: SlotKey, field: keyof Slot, v: string): void { this.set(d => { d[s] = { ...d[s], [field]: v }; }); }
  protected toggleRole(r: string): void {
    this.set(d => {
      const i = d.roles.indexOf(r);
      if (i >= 0) { if (d.roles.length > 1) d.roles.splice(i, 1); }   // never none
      else { if (d.roles.length >= 2) d.roles.shift(); d.roles.push(r); }   // at most two
    });
  }
  protected editStat(k: string, field: 'base' | 'growth', v: number): void {
    this.set(d => { d.stats[k] = { ...d.stats[k], [field]: isNaN(v) ? 0 : v }; });
  }
  protected pick(slot: number): void {
    this.pickerSlot.set(this.pickerSlot() === slot ? null : slot);
    this.search.set('');
  }
  protected equip(itemId: string | null, slot = this.pickerSlot()): void {
    if (slot === null) return;
    this.set(d => { d.items[slot] = itemId; });
    this.pickerSlot.set(null);
    this.search.set('');
  }
}
