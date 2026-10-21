import { Character } from '../data/models';
import { RARITY_LABEL } from './roll';
import { baseEffectiveStats, effectiveStats, getTraitDef, traitOwner } from './stats';
import { TRAITS } from './traits-data';

/** What a tooltip shows: a title, text, label/value rows, a total and notes. */
export interface TipLine { label: string; value: string; tone?: 'pos' | 'neg' }
export interface Tip {
  title: string;
  /** rarity key, for the title's colour */
  rarity?: string;
  desc?: string;
  /** the character's name, for [NAME] in desc */
  name?: string;
  lines: TipLine[];
  total?: TipLine;
  notes: string[];
  /** a picture above the title (a character's portrait) */
  image?: string | null;
  /** the border and title colour, instead of the rarity's */
  color?: string;
}

const signed = (v: number, digits = 0) => (v > 0 ? '+' : '') + v.toFixed(digits);
const MAIN = ['hp', 'atk', 'def', 'mag', 'spd'] as const;
const SUB = ['heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'] as const;
const LABELS: Record<string, string> = {
  hp: 'HP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD', heal_pow: 'Heal Power', crit_rate: 'Crit Chance', crit_dmg: 'Crit DMG',
  status_res: 'Status Res', dexterity: 'Dexterity', resilience: 'Resilience', true_dmg: 'True DMG', lifesteal: 'Lifesteal', cooldown_red: 'CDR',
};

/**
 * Where a main stat comes from (the old buildStatBreakdownTooltip): the
 * form's base value, each equipped item's flat +/- on it, everything traits
 * and passives add, and the total. Multipliers show only in the total.
 */
export function statBreakdown(c: Character, stat: string): Tip {
  const idx = c.activeFormIdx || 0;
  const form = idx > 0 ? (c.altForms || [])[idx - 1] : null;
  const base = Number(((form ? form.stats : c.stats) as unknown as Record<string, number>)?.[stat]) || 0;
  const lines: TipLine[] = [{ label: 'BASE', value: String(base) }];

  for (const item of (c.inventory || []).filter(i => i.equipped)) {
    let sub = 0;
    for (const m of item.mods || []) {
      if (m.stat !== stat) continue;
      if (m.op === 'add') sub += parseFloat(String(m.value)) || 0;
      if (m.op === 'sub') sub -= parseFloat(String(m.value)) || 0;
    }
    if (sub) lines.push({ label: item.name || 'ITEM', value: (sub > 0 ? '+' : '') + sub, tone: sub > 0 ? 'pos' : 'neg' });
  }

  const full = (effectiveStats(c) as unknown as Record<string, number>)[stat];
  const traitBonus = full - (baseEffectiveStats(c) as unknown as Record<string, number>)[stat];
  if (Math.abs(traitBonus) > 0.5) lines.push({ label: 'TRAITS/PASSIVES', value: signed(Math.round(traitBonus)), tone: traitBonus > 0 ? 'pos' : 'neg' });

  return { title: `${stat.toUpperCase()} BREAKDOWN`, lines, total: { label: 'TOTAL', value: String(full) }, notes: [] };
}

/**
 * A trait's card tooltip (the old buildTraitTooltip): what it changes on the
 * sheet right now, worked out by comparing the stats with and without it.
 */
export function traitTip(c: Character, key: string): Tip | null {
  const base = TRAITS[key];
  if (!base) return null;
  const def = getTraitDef(c, key) || base;
  const owner = traitOwner(c);

  // the same character without this one trait, on the same form
  const without = JSON.parse(JSON.stringify(c)) as Character & { _rawTraits?: boolean };
  without._rawTraits = true;
  without.traits = (owner.traits || []).filter(k => k !== key);
  without.shimmyfulTraits = (owner.shimmyfulTraits || []).filter(k => k !== key);
  const a = effectiveStats(c) as unknown as Record<string, number>;
  const b = effectiveStats(without) as unknown as Record<string, number>;

  const lines: TipLine[] = [];
  for (const s of [...MAIN, ...SUB]) {
    const diff = (a[s] || 0) - (b[s] || 0);
    if (Math.abs(diff) <= 0.05) continue;
    const isSub = (SUB as readonly string[]).includes(s);
    lines.push({ label: LABELS[s], value: signed(diff, isSub ? 1 : 0) + (isSub ? '%' : ''), tone: diff > 0 ? 'pos' : 'neg' });
  }

  const notes: string[] = [];
  if (!lines.length) notes.push('No direct stat change while passive. See description.');
  const situational = (def as { situational?: unknown[] }).situational;
  if (situational?.length) notes.push(`⚡ Has ${situational.length} situational trigger${situational.length > 1 ? 's' : ''}.`);
  const cult = (def as { cultivation?: { label?: string } }).cultivation;
  if (cult) notes.push(`📈 Cultivates: ${cult.label}.`);
  const extra = (def as { notes?: string }).notes;
  if (extra) notes.push(extra);

  const rarity = String(base.rarity || 'common');
  return {
    title: `${RARITY_LABEL[rarity] || rarity.toUpperCase()} • ${def.name}`,
    rarity,
    desc: def.desc,
    name: c.name,
    lines,
    notes,
  };
}
