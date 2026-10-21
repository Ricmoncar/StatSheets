// Shapes of the documents the site stores in Firestore, taken from the live
// data (144 characters surveyed) and the old code. Every interface keeps an
// index signature: the old site may add fields this one does not know about
// yet, and those must survive a round trip untouched.

export type StatKey = 'hp' | 'atk' | 'def' | 'mag' | 'spd' | 'iq';
export type SubstatKey =
  | 'crit_rate' | 'crit_dmg' | 'heal_pow' | 'status_res' | 'dexterity'
  | 'resilience' | 'true_dmg' | 'lifesteal' | 'cooldown_red';

export type Stats = Partial<Record<StatKey, number>>;
export type Substats = Partial<Record<SubstatKey, number>>;

export interface ItemMod {
  stat?: string;
  op?: string;
  value?: number;
  [k: string]: unknown;
}

export interface InventoryItem {
  id: string;
  name: string;
  desc?: string;
  icon?: string | null;
  iconImage?: string | null;
  equipped?: boolean;
  mods?: ItemMod[];
  passives?: unknown[];
  [k: string]: unknown;
}

export interface GoldEntry {
  amount: number;
  balance: number;
  note?: string;
  ts: number;
  [k: string]: unknown;
}

export interface TraitHistoryEntry {
  key: string;
  name: string;
  rarity: string;
  ts: number;
  shimmyful?: boolean;
  [k: string]: unknown;
}

export interface AltForm {
  name: string;
  avatar?: string | null;
  stats?: Stats;
  substats?: Substats;
  themeSong?: string;
  traits?: string[];
  shimmyfulTraits?: string[];
  [k: string]: unknown;
}

export interface CharacterInfo {
  owner?: string;
  pronouns?: string;
  race?: string;
  age?: string;
  soul?: unknown;
  height?: string;
  origin?: string;
  occupation?: string;
  affiliation?: string;
  personality?: string;
  fears?: string;
  goals?: string;
  bio?: string;
  notes?: string;
  themeSong?: string;
  soundtrack?: unknown;
  voiceclaims?: unknown;
  [k: string]: unknown;
}

export interface Ability {
  id: string;
  name: string;
  type?: string;
  desc?: string;
  image?: string | null;
  cost?: string;
  cd?: string;
  cast?: string;
  duration?: string;
  range?: string;
  dmg?: string;
  req?: string;
  tags?: string[];
  notes?: string;
  [k: string]: unknown;
}

export interface Character {
  id: string;
  name: string;
  color?: string;
  bio?: string;
  avatar?: string | null;
  isPlaceholder?: boolean;
  createdAt?: number;
  order?: number | null;
  folderId?: string | null;
  tags?: string[];
  stats?: Stats;
  substats?: Substats;
  gold?: number;
  goldHistory?: GoldEntry[];
  inventory?: InventoryItem[];
  traits?: string[];
  shimmyfulTraits?: string[];
  traitHistory?: TraitHistoryEntry[];
  traitStacks?: Record<string, number>;
  traitTriggers?: Record<string, unknown>;
  dualityState?: Record<string, unknown>;
  pity?: number;
  pattern?: { type: string; params?: Record<string, unknown> };
  info?: CharacterInfo;
  altForms?: AltForm[];
  activeFormIdx?: number;
  abilities?: Ability[];
  charPassives?: unknown[];
  perfectSoulData?: { souls?: unknown[]; history?: unknown[] };
  /** Revision number; every update must write exactly one more than the database has. */
  _rev?: number;
  [k: string]: unknown;
}

export interface Folder {
  id: string;
  name?: string;
  order?: number;
  color?: string;
  [k: string]: unknown;
}
