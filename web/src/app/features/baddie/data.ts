// SPIN A BADDIE: everything the game is made of, exactly as the old page had
// it (baddie.html). The numbers are the game's balance; change one here and
// it changes for everyone's save.

export interface Rarity { key: string; col: string; rate: number; sell: number; weight: number }
export interface Modifier { key: string; mult: number; weight: number; col: string; itemOnly?: boolean }
export interface Die { id: number; name: string; cost: number; weights: number[] }
export interface PotionDef { name: string; col: string; icon: string; levels: { mult: number; cost: number }[] }
export type PetBehaviour = 'hop' | 'prowl' | 'dart' | 'fly' | 'swim' | 'creep' | 'star';
export interface PetDef { glyph: string; col: string; luck: number; money: number; behav: PetBehaviour; name?: string; shiny?: boolean; special?: boolean }
export interface EggDef { name: string; col: string; cost: number; table: [string, number][] }
export interface CursorDef { id: string; name: string; cost: number; speed: number; col: string; fx: { glyph: string; col: string; n: number } }
export type ThemeMode = 'nebula' | 'cupcakes' | 'embers' | 'matrix';
export interface ThemeDef { id: string; name: string; cost: number; custom: boolean; mutbuff: number; mode: ThemeMode; accent: string; grad: string[]; pal: string[]; pastel?: boolean; texas?: boolean }

/** 13 tiers, low to high: the index is the power tier. weight is the base drop weight (it also seeds the dice odds). */
export const RARITIES: Rarity[] = [
  { key: 'Common', col: '#b8c0cc', rate: 1, sell: 5, weight: 1000 },
  { key: 'Rare', col: '#4aa3ff', rate: 3, sell: 20, weight: 480 },
  { key: 'Epic', col: '#b15cff', rate: 8, sell: 65, weight: 200 },
  { key: 'Legendary', col: '#ffb028', rate: 35, sell: 180, weight: 50 },
  { key: 'Divine', col: '#c9b0ff', rate: 99, sell: 450, weight: 20 },
  { key: 'Mythic', col: '#ff5ec4', rate: 220, sell: 1100, weight: 10 },
  { key: 'Prismatic', col: '#7df9ff', rate: 400, sell: 2700, weight: 2 },
  { key: 'Sacred', col: '#ffe08a', rate: 600, sell: 6800, weight: 0.3 },
  { key: 'Secret', col: '#ff4d6d', rate: 2000, sell: 160000, weight: 0.1 },
  { key: 'Godly', col: '#ff8a3d', rate: 10000, sell: 400000, weight: 0.08 },
  { key: 'Cosmic', col: '#2bd9d9', rate: 40000, sell: 950000, weight: 0.022 },
  { key: 'Apex', col: '#7CFF4A', rate: 200000, sell: 550000, weight: 0.00009 },
  { key: 'Primordial', col: '#ff2bd0', rate: 250000, sell: 600000, weight: 0.00006 },
];
export const RAR_IDX: Record<string, number> = Object.fromEntries(RARITIES.map((r, i) => [r.key, i]));
export const rarMeta = (key: string): Rarity => RARITIES[RAR_IDX[key] ?? 0];

/** The weights are the percentages from the spec; Cappyfied comes only from Cappy's Milk. */
export const MODIFIERS: Modifier[] = [
  { key: 'None', mult: 1, weight: 70, col: '#9aa' },
  { key: 'Silver', mult: 1.1, weight: 10, col: '#cfd6e0' },
  { key: 'Golden', mult: 1.3, weight: 7, col: '#ffd24a' },
  { key: 'Wet', mult: 1.4, weight: 3.3, col: '#4ad6ff' },
  { key: 'Emerald', mult: 1.5, weight: 2.5, col: '#3bff9b' },
  { key: 'Diamond', mult: 1.7, weight: 2, col: '#aee9ff' },
  { key: 'Ruby', mult: 2, weight: 1.5, col: '#ff3b5c' },
  { key: 'Rainbow', mult: 2.2, weight: 1, col: '#ff8ad6' },
  { key: 'Lovestruck', mult: 2.5, weight: 0.7, col: '#ff5bb0' },
  { key: 'Lunar', mult: 2.7, weight: 0.6, col: '#8aa6ff' },
  { key: 'Solar', mult: 2.9, weight: 0.5, col: '#ffae3b' },
  { key: 'Celestial', mult: 3.15, weight: 0.4, col: '#c9a8ff' },
  { key: 'Starstruck', mult: 3.33, weight: 0.3, col: '#ffe27a' },
  { key: 'Hellish', mult: 3.4, weight: 0.2, col: '#ff5a2b' },
  { key: 'Cappyfied', mult: 5, weight: 0, col: '#ff66dd', itemOnly: true },
];
export const MOD_IDX: Record<string, number> = Object.fromEntries(MODIFIERS.map((m, i) => [m.key, i]));
export const modMeta = (key: string): Modifier => MODIFIERS[MOD_IDX[key] ?? 0];

/** A die's odds: the rarity base weights, leaned toward the rarer tiers by its luck. */
const dieWeights = (luck: number) => RARITIES.map((r, i) => r.weight * Math.pow(1 + luck, i));
const DICE_DEF = [
  { name: 'Wooden Die', cost: 0, luck: 0 },
  { name: 'Stone Die', cost: 15000, luck: 0.025 },
  { name: 'Iron Die', cost: 65000, luck: 0.05 },
  { name: 'Gold Die', cost: 220000, luck: 0.12 },
  { name: 'Crystal Die', cost: 2500000, luck: 0.18 },
  { name: 'Astral Die', cost: 75000000, luck: 0.25 },
  { name: 'Void Die', cost: 250000000, luck: 0.35 },
  { name: 'Celestial Die', cost: 2000000000, luck: 0.50 },
  { name: 'Chaos Die', cost: 45000000000, luck: 0.60 },
  { name: 'Primordial Die', cost: 500000000000, luck: 1.00 },
];
// the low dice can never roll above a rarity, and epics are a little rarer on the first three
const HARD_CAP: Record<number, string> = { 0: 'Epic', 1: 'Legendary', 2: 'Divine', 3: 'Mythic' };
export const DICE: Die[] = DICE_DEF.map((d, i) => {
  let weights = dieWeights(d.luck);
  if (HARD_CAP[i]) { const cap = RAR_IDX[HARD_CAP[i]]; weights = weights.map((w, ri) => ri > cap ? 0 : w); }
  if (i < 3) { const epic = RAR_IDX['Epic']; weights = weights.map((w, ri) => ri === epic ? w * 0.7 : w); }
  return { id: i, name: d.name, cost: d.cost, weights };
});
/** How each die tumbles while it rolls. */
export const DICE_ANIM: Record<number, string> = { 0: 'tumble', 1: 'tumble', 2: 'flip', 3: 'spin', 4: 'flip', 5: 'spin', 6: 'warp', 7: 'spin', 8: 'chaos', 9: 'energy' };

export const POTIONS: Record<'money' | 'luck' | 'mod', PotionDef> = {
  money: { name: 'Money Tonic', col: '#ffb028', icon: '$', levels: [{ mult: 1.25, cost: 50000 }, { mult: 1.5, cost: 250000 }, { mult: 2, cost: 1200000 }] },
  luck: { name: 'Luck Elixir', col: '#7CFF4A', icon: '?', levels: [{ mult: 1.25, cost: 80000 }, { mult: 1.5, cost: 400000 }, { mult: 2, cost: 2000000 }] },
  mod: { name: 'Modifier Draught', col: '#b15cff', icon: '*', levels: [{ mult: 1.25, cost: 120000 }, { mult: 1.5, cost: 600000 }, { mult: 2, cost: 3200000 }] },
};
export const POTION_DURATION = 10 * 60 * 1000;

export const PETS: Record<string, PetDef> = {
  Dog: { glyph: '\u{1F436}', col: '#caa472', luck: 1.05, money: 1, behav: 'hop' },
  Cat: { glyph: '\u{1F431}', col: '#c0c0c0', luck: 1, money: 1.05, behav: 'prowl' },
  Goat: { glyph: '\u{1F410}', col: '#e0d8c0', luck: 1.05, money: 1.05, behav: 'hop' },
  Lizard: { glyph: '\u{1F98E}', col: '#6fd06f', luck: 1.2, money: 1.2, behav: 'dart' },
  Dragon: { glyph: '\u{1F409}', col: '#ff5a3c', luck: 1.3, money: 1.65, behav: 'fly' },
  Phoenix: { glyph: '\u{1F985}', col: '#ff8a3d', luck: 1.65, money: 1.3, behav: 'fly' },
  Pegasus: { glyph: '\u{1F40E}', col: '#cfe0ff', luck: 2, money: 1.1, behav: 'fly' },
  Unicorn: { glyph: '\u{1F984}', col: '#ff8ad6', luck: 2.4, money: 2.4, behav: 'fly', shiny: true },
  CosmicFish: { glyph: '\u{1F420}', col: '#2bd9d9', luck: 2, money: 2, behav: 'swim', name: 'Cosmic Fish' },
  Parasite: { glyph: '\u{1F9A0}', col: '#a23fe0', luck: 2.4, money: 2.2, behav: 'creep' },
  ShooShi: { glyph: '\u{1F419}', col: '#b07be8', luck: 2.6, money: 2.6, behav: 'swim', name: 'ShooShi' },
  Tiki: { glyph: '\u{1F438}', col: '#6fe06f', luck: 3, money: 2.3, behav: 'hop', name: 'Tiki' },
  Kebab: { glyph: '\u{1F362}', col: '#d8a05a', luck: 1, money: 4, behav: 'prowl' },
  Bizzy: { glyph: '\u{1F41D}', col: '#ffd24a', luck: 4, money: 2, behav: 'fly', name: 'Bizzy' },
  Muffin: { glyph: '\u{1F9C1}', col: '#e0a060', luck: 3, money: 3, behav: 'hop' },
  SHIMMY: { glyph: '⭐', col: '#fff27a', luck: 5, money: 5, behav: 'star', shiny: true, special: true },
  // the forest egg's
  Fox: { glyph: '\u{1F98A}', col: '#e08a3c', luck: 1.3, money: 1.3, behav: 'dart', name: 'Fox' },
  Deer: { glyph: '\u{1F98C}', col: '#c9a06a', luck: 1.35, money: 1.4, behav: 'hop', name: 'Deer' },
  Owl: { glyph: '\u{1F989}', col: '#b8946a', luck: 1.6, money: 1.3, behav: 'fly', name: 'Owl' },
  Hedgehog: { glyph: '\u{1F994}', col: '#9a7a52', luck: 1.45, money: 1.5, behav: 'creep', name: 'Hedgehog' },
  Mushroom: { glyph: '\u{1F344}', col: '#d86a5a', luck: 1.7, money: 1.7, behav: 'hop', name: 'Mushroom' },
  Treant: { glyph: '\u{1F333}', col: '#4faa5a', luck: 2.2, money: 2.4, behav: 'prowl', name: 'Treant', shiny: true },
};
export const petName = (type: string) => PETS[type]?.name || type;

export const EGGS: Record<string, EggDef> = {
  common: { name: 'Common Egg', col: '#b8c0cc', cost: 1000, table: [['Dog', 40], ['Cat', 40], ['Goat', 15], ['Lizard', 5]] },
  forest: { name: 'Forest Egg', col: '#5fae5f', cost: 150000, table: [['Fox', 30], ['Deer', 26], ['Hedgehog', 20], ['Owl', 14], ['Mushroom', 8], ['Treant', 2]] },
  prismatic: { name: 'Prismatic Egg', col: '#7df9ff', cost: 50000000, table: [['Dragon', 33.3], ['Phoenix', 33.3], ['Pegasus', 33.3], ['Unicorn', 0.1]] },
  cosmic: { name: 'Cosmic Egg', col: '#2bd9d9', cost: 2500000000, table: [['CosmicFish', 50], ['Parasite', 15], ['ShooShi', 10], ['Tiki', 10], ['Kebab', 9.9], ['Bizzy', 2.5], ['Muffin', 2.5], ['SHIMMY', 0.1]] },
};

/** speed: how much faster the dice roll with it (manual and auto); fx: the burst a click makes. */
export const CURSORS: CursorDef[] = [
  { id: 'classic', name: 'Classic Arrow', cost: 0, speed: 1, col: '#ffffff', fx: { glyph: '•', col: '#ffffff', n: 5 } },
  { id: 'gold', name: 'Gilded Arrow', cost: 8000, speed: 1.15, col: '#ffd34a', fx: { glyph: '◆', col: '#ffd34a', n: 6 } },
  { id: 'gem', name: 'Crystal Tip', cost: 450000, speed: 1.3, col: '#7fe9ff', fx: { glyph: '❖', col: '#aef6ff', n: 6 } },
  { id: 'flame', name: 'Flame Pointer', cost: 2000000, speed: 1.5, col: '#ff7a1c', fx: { glyph: '🔥', col: '#ff5a2b', n: 7 } },
  { id: 'heart', name: 'Sweetheart', cost: 12000000, speed: 1.6, col: '#ff5bb0', fx: { glyph: '♥', col: '#ff5bb0', n: 8 } },
  { id: 'star', name: 'Star Wand', cost: 100000000, speed: 1.75, col: '#ffe24a', fx: { glyph: '✦', col: '#ffe24a', n: 8 } },
  { id: 'void', name: 'Void Cursor', cost: 1000000000, speed: 2.1, col: '#c084ff', fx: { glyph: '✧', col: '#b15cff', n: 9 } },
  { id: 'matrix', name: 'Matrix Code', cost: 8000000000, speed: 2.35, col: '#00ff66', fx: { glyph: '1', col: '#00ff66', n: 10 } },
  { id: 'rainbow', name: 'Prism Pointer', cost: 50000000000, speed: 2.6, col: '#ff8ad6', fx: { glyph: '✨', col: '#ff8ad6', n: 12 } },
  { id: 'cosmic', name: 'Cosmic Comet', cost: 600000000000, speed: 3, col: '#2bd9d9', fx: { glyph: '☄', col: '#2bd9d9', n: 14 } },
];
export const curMeta = (id: string): CursorDef => CURSORS.find(c => c.id === id) || CURSORS[0];

/** mode drives the backdrop, accent recolours the page, mutbuff is extra modifier luck while it is on. */
export const THEMES: ThemeDef[] = [
  { id: 'midnight', name: 'Midnight', cost: 0, custom: false, mutbuff: 1, mode: 'nebula', accent: '#b15cff', grad: ['#1c0e2e', '#0a0612', '#050308'], pal: ['#b15cff', '#4aa3ff', '#2bd9d9', '#ff4d9d'] },
  { id: 'emerald', name: 'Emerald', cost: 50000, custom: false, mutbuff: 1.03, mode: 'nebula', accent: '#3bff9b', grad: ['#06241a', '#04140e', '#020806'], pal: ['#3bff9b', '#2bd9d9', '#7CFF4A', '#aef6ff'] },
  { id: 'crimson', name: 'Crimson', cost: 50000, custom: false, mutbuff: 1.03, mode: 'nebula', accent: '#ff4d6d', grad: ['#2a0810', '#160409', '#080204'], pal: ['#ff4d6d', '#ff8a3d', '#c216a0', '#ffd24a'] },
  { id: 'oceanic', name: 'Oceanic', cost: 150000, custom: false, mutbuff: 1.05, mode: 'nebula', accent: '#4aa3ff', grad: ['#06182e', '#040e1c', '#02060e'], pal: ['#4aa3ff', '#2bd9d9', '#7df9ff', '#8aa6ff'] },
  { id: 'mono', name: 'Monochrome', cost: 400000, custom: false, mutbuff: 1.08, mode: 'nebula', accent: '#cfd6e0', grad: ['#181820', '#0e0e14', '#060608'], pal: ['#cfd6e0', '#9aa0aa', '#7a808a', '#e8ecf2'] },
  { id: 'jimmy', name: 'Jimmy', cost: 8000000, custom: true, mutbuff: 1.15, mode: 'cupcakes', accent: '#e0a060', grad: ['#3a2416', '#241509', '#140c05'], pal: ['#e0a060', '#d98c4a', '#8a4a2a'] },
  { id: 'fury', name: 'Fury', cost: 80000000, custom: true, mutbuff: 1.30, mode: 'embers', accent: '#ffb028', grad: ['#1a0a06', '#0e0604', '#050201'], pal: ['#ff5a2b', '#ffb028', '#ffd24a'] },
  { id: 'juko', name: 'Juko', cost: 600000000, custom: true, mutbuff: 1.50, mode: 'matrix', accent: '#00ff66', grad: ['#020a02', '#010401', '#000000'], pal: ['#00ff66', '#7CFF4A'] },
  { id: 'nara', name: 'Nara', cost: 600000000, custom: true, mutbuff: 1.50, mode: 'nebula', accent: '#ff9ed6', pastel: true, grad: ['#241033', '#160a24', '#0a0614'], pal: ['#ff8ad6', '#8ad0ff', '#9bffc0', '#fff39a', '#c79bff', '#ff9ed6'] },
  { id: 'texas', name: 'Texas', cost: 5000000000, custom: true, mutbuff: 1.80, mode: 'nebula', accent: '#ffcf3a', texas: true, grad: ['#2a160a', '#3a1208', '#140804'], pal: ['#ffcf3a', '#ff5a2b', '#ffffff', '#c8a020'] },
];
export const thmMeta = (id: string): ThemeDef => THEMES.find(t => t.id === id) || THEMES[0];

// ── upgrades ──
export const UPGRADE_MULT_PER_LVL = 1.25;
export const UPGRADE_MAX_LVL = 600;             // effectively uncapped: the rarity levelling stops at Cosmic
export const UPGRADE_COOLDOWN = 60 * 1000;      // a minute, plus 30 seconds a level
export const UPGRADE_CD_PER_LVL = 30 * 1000;
export const MAX_UPGRADES = 2;                  // two baddies upgrading at once
/** Reach these levels and the baddie goes up a rarity (as far as Cosmic). */
export const RARITY_LEVEL_STEPS = [5, 15, 30, 60, 120, 240, 480];

// ── crack (overdrive) ──
export const CRACK_DURATION = 5 * 60 * 1000;
export const CRACK_COOLDOWN = 10 * 60 * 1000;
export const CRACK_MULT = 2.6;
export const CRACK_MOD_CHANCE = 0.6;

// ── the plot, pets, being away ──
export const PLOT_BASE = 12;
export const PLOT_MAX = 40;
export const PET_SLOT_BASE_COST = 50000000;
export const OFFLINE_CAP_MS = 4 * 60 * 60 * 1000;
export const OFFLINE_RATE = 0.25;               // with the browser closed; tabbed out earns in full

// ── rebirth: the rarity you must have rolled for each, which is also the soft cap on rolls until then ──
export const REBIRTH_REQ = [4, 6, 8, 10, 11];   // Divine, Prismatic, Secret, Cosmic, Apex
export const REBIRTH_LABELS = ['Divine', 'Prismatic', 'Secret', 'Cosmic', 'Apex'];
export const REBIRTH_COLORS = ['#c9b0ff', '#7df9ff', '#ff4d6d', '#2bd9d9', '#7CFF4A'];

export const AUTO_ROLL_COST = 10000;
export const INV_PAGE = 48;

/** The roster: each is baddies/<key>.png. Add a line here and drop the png in to add one. */
export const BADDIES: { key: string; rarity: string }[] = [
  { key: 'codebaddie', rarity: 'Apex' }, { key: 'komodobaddie', rarity: 'Legendary' }, { key: 'racialbaddie', rarity: 'Secret' },
  { key: 'frogbaddie', rarity: 'Secret' }, { key: 'employmentbaddie', rarity: 'Mythic' }, { key: 'sniperbaddie', rarity: 'Secret' },
  { key: 'humblebaddie', rarity: 'Cosmic' }, { key: 'bravebaddie', rarity: 'Mythic' }, { key: 'phonebaddie', rarity: 'Sacred' },
  { key: 'drunkbaddie', rarity: 'Godly' }, { key: 'parasitebaddie', rarity: 'Mythic' }, { key: 'nightguardbaddie', rarity: 'Godly' },
  { key: 'cottonbaddie', rarity: 'Legendary' }, { key: 'bloodbaddie', rarity: 'Prismatic' }, { key: 'shimmybaddie', rarity: 'Cosmic' },
  { key: 'lifebaddie', rarity: 'Epic' }, { key: 'fatbaddie', rarity: 'Epic' }, { key: 'beebaddie', rarity: 'Prismatic' },
  { key: 'cupcakebaddie', rarity: 'Prismatic' }, { key: 'devilbaddie', rarity: 'Godly' }, { key: 'dominantbaddie', rarity: 'Sacred' },
  { key: 'policebaddie', rarity: 'Rare' }, { key: 'engibaddie', rarity: 'Legendary' }, { key: 'moonbaddie', rarity: 'Prismatic' },
  { key: 'sunbaddie', rarity: 'Secret' }, { key: 'waterbaddie', rarity: 'Godly' }, { key: 'kebabbaddie', rarity: 'Sacred' },
  { key: 'milfbaddie', rarity: 'Divine' }, { key: 'deathbaddie', rarity: 'Legendary' }, { key: 'phoenixbaddie', rarity: 'Cosmic' },
  { key: 'rhinobaddie', rarity: 'Sacred' }, { key: 'bunnybaddie', rarity: 'Mythic' }, { key: 'crowbaddie', rarity: 'Sacred' },
  { key: 'junglebaddie', rarity: 'Common' }, { key: 'anorexicbaddie', rarity: 'Common' }, { key: 'starbaddie', rarity: 'Secret' },
  { key: 'axolotlbaddie', rarity: 'Mythic' }, { key: 'mombaddie', rarity: 'Secret' }, { key: 'burgerbaddie', rarity: 'Cosmic' },
  { key: 'lightbaddie', rarity: 'Sacred' }, { key: 'bossbaddie', rarity: 'Prismatic' }, { key: 'jihaubaddie', rarity: 'Prismatic' },
  { key: 'mexicanbaddie', rarity: 'Mythic' }, { key: 'artbaddie', rarity: 'Primordial' }, { key: 'goatbaddie', rarity: 'Rare' },
  { key: 'piratebaddie', rarity: 'Sacred' }, { key: 'sirenbaddie', rarity: 'Secret' }, { key: 'twirlybaddie', rarity: 'Common' },
  { key: 'furrybaddie', rarity: 'Secret' }, { key: 'clockbaddie', rarity: 'Mythic' }, { key: 'armorbaddie', rarity: 'Godly' },
  { key: 'frutigerbaddie', rarity: 'Secret' }, { key: 'seabunnybaddie', rarity: 'Secret' }, { key: 'sushibaddie', rarity: 'Godly' },
  { key: 'texasbaddie', rarity: 'Prismatic' }, { key: 'daddybaddie', rarity: 'Godly' }, { key: 'dragbaddie', rarity: 'Mythic' },
  { key: 'virusbaddie', rarity: 'Secret' }, { key: 'priestbaddie', rarity: 'Godly' }, { key: 'pawnbaddie', rarity: 'Prismatic' },
  { key: 'fuckbaddie', rarity: 'Sacred' }, { key: 'steampunkbaddie', rarity: 'Sacred' }, { key: 'nullbaddie', rarity: 'Divine' },
  { key: 'maskbaddie', rarity: 'Prismatic' }, { key: 'tikibaddie', rarity: 'Rare' }, { key: 'archiebaddie', rarity: 'Rare' },
  { key: 'determinedbaddie', rarity: 'Cosmic' }, { key: 'firemanbaddie', rarity: 'Legendary' }, { key: 'mangabaddie', rarity: 'Prismatic' },
  { key: 'schizobaddie', rarity: 'Godly' }, { key: 'infestedbaddie', rarity: 'Sacred' }, { key: 'larpingbaddie', rarity: 'Cosmic' },
];

// ── numbers ──
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd'];
export function fmt(n: number): string {
  if (n === Infinity) return 'INF';
  n = n || 0;
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return (Math.floor(n) === n ? n : n.toFixed(1)).toString();
  let t = 0;
  while (n >= 1000 && t < SUFFIX.length - 1) { n /= 1000; t++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + SUFFIX[t];
}
export function fmtTime(ms: number): string {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm ' + sec + 's';
  return sec + 's';
}
