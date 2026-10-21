// Inventory rules. Ported from the old script.js (INVENTORY SYSTEM:
// renderInventory, toggleEquip, deleteItem, copyItem/pasteItem, saveItem,
// the mod editor).

import type { Character, InventoryItem, ItemMod } from '../data/models';

/** What a mod can change, in the editor's order; values in % where marked. */
export const MOD_STATS: { key: string; label: string }[] = [
  { key: 'hp', label: 'HP' }, { key: 'atk', label: 'ATK' }, { key: 'def', label: 'DEF' },
  { key: 'mag', label: 'MAG' }, { key: 'spd', label: 'SPD' }, { key: 'iq', label: 'IQ' },
  { key: 'heal_pow', label: 'HEALING POW (%)' }, { key: 'crit_rate', label: 'CRIT CHANCE (%)' },
  { key: 'crit_dmg', label: 'CRIT DMG (%)' }, { key: 'status_res', label: 'STATUS RES (%)' },
  { key: 'dexterity', label: 'DEXTERITY (%)' }, { key: 'resilience', label: 'RESILIENCE (%)' },
  { key: 'true_dmg', label: 'TRUE DAMAGE (%)' }, { key: 'lifesteal', label: 'LIFESTEAL (%)' },
  { key: 'cooldown_red', label: 'COOLDOWN RED. (%)' }, { key: 'sanity', label: 'SANITY' },
];
export const MOD_OPS: { key: string; label: string; sign: string }[] = [
  { key: 'add', label: 'Add (+)', sign: '+' },
  { key: 'sub', label: 'Subtract (-)', sign: '-' },
  { key: 'mul', label: 'Multiply (x)', sign: 'x' },
  { key: 'div', label: 'Divide (/)', sign: '/' },
];
/** A new mod row starts as +10 ATK. */
export const NEW_MOD: ItemMod = { stat: 'atk', op: 'add', value: 10 };
export const ITEM_NAME_MAX = 32;
export const PASSIVE_MAX = 140;

/** "ATK +10", "HP x1.5": the tag on an item card. */
export function modTag(m: ItemMod): string {
  const sign = MOD_OPS.find(o => o.key === m.op)?.sign ?? '';
  return `${String(m.stat || '').toUpperCase()} ${sign}${m.value}`;
}

/** The hue each icon key gets on cards and in the picker (the old string hash). */
export function iconHue(key: string | null | undefined): string {
  const k = key || 'sword';
  let hash = 0;
  for (let x = 0; x < k.length; x++) hash = k.charCodeAt(x) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 80%, 60%)`;
}

export function toggleEquip(c: Character, itemId: string): boolean | null {
  const item = (c.inventory || []).find(i => i.id === itemId);
  if (!item) return null;
  item.equipped = !item.equipped;
  return item.equipped;
}

export function deleteItem(c: Character, itemId: string): void {
  c.inventory = (c.inventory || []).filter(i => i.id !== itemId);
}

/** A pasted item is a copy with a new id, unequipped. */
export function pasteItem(c: Character, copied: InventoryItem, newId: string): InventoryItem {
  const item: InventoryItem = { ...JSON.parse(JSON.stringify(copied)), id: newId, equipped: false };
  c.inventory = c.inventory || [];
  c.inventory.push(item);
  return item;
}

export interface ItemDraft {
  name: string;
  desc: string;
  icon: string | null;
  iconImage: string | null;
  mods: ItemMod[];
  passives: string[];
}

/**
 * Saves the editor's draft: a new item goes at the end, an edited one keeps
 * its place and its equipped state. The name is required; blank passives are
 * dropped; mod values that are not numbers become 0.
 */
export function saveItem(c: Character, draft: ItemDraft, editingId: string | null, newId: string): { error: string } | { item: InventoryItem } {
  const name = draft.name.trim();
  if (!name) return { error: 'Item needs a name!' };
  const item: InventoryItem = {
    id: editingId || newId,
    name,
    desc: draft.desc.trim(),
    icon: draft.icon,
    iconImage: draft.iconImage,
    mods: draft.mods.map(m => ({ stat: m.stat, op: m.op, value: parseFloat(String(m.value)) || 0 })),
    passives: draft.passives.map(p => p.trim()).filter(Boolean),
    equipped: false,
  };
  c.inventory = c.inventory || [];
  if (editingId) {
    const idx = c.inventory.findIndex(i => i.id === editingId);
    if (idx >= 0) { item.equipped = c.inventory[idx].equipped; c.inventory[idx] = item; }
  } else {
    c.inventory.push(item);
  }
  return { item };
}
