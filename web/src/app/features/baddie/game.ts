// SPIN A BADDIE: the game. The rules, the state and the save are the old
// page's (baddie.html), line for line, so a save from the old page loads here
// and the other way round: same keys in this origin's localStorage, same
// shape, same codes.
import { Injectable, inject, signal } from '@angular/core';
import { SoundName, SoundService } from '../../core/sound.service';
import {
  AUTO_ROLL_COST, BADDIES, CRACK_COOLDOWN, CRACK_DURATION, CRACK_MOD_CHANCE, CRACK_MULT, CURSORS, DICE, EGGS,
  MAX_UPGRADES, MODIFIERS, MOD_IDX, OFFLINE_CAP_MS, OFFLINE_RATE, PETS, PET_SLOT_BASE_COST, PLOT_BASE, PLOT_MAX,
  POTIONS, POTION_DURATION, RARITIES, RARITY_LEVEL_STEPS, RAR_IDX, REBIRTH_REQ, THEMES, UPGRADE_CD_PER_LVL,
  UPGRADE_COOLDOWN, UPGRADE_MAX_LVL, UPGRADE_MULT_PER_LVL, curMeta, fmt, fmtTime, modMeta, petName, rarMeta, thmMeta,
} from './data';

export interface Baddie {
  id: number; key: string; rarity: string; modifier: string; level: number;
  placed: boolean; slot: number; overUntil: number; born: number; varMul: number;
}
export type PetMode = 'move' | 'stay' | 'follow';
export interface Pet { id: number; type: string; born: number; mode?: PetMode; pos?: { x: number; y: number } }
export interface Potion { type: 'money' | 'luck' | 'mod'; level: number; mult: number; exp: number }
export interface State {
  coins: number;
  baddies: Baddie[];
  dice: number[];
  activeDie: number;
  potions: Potion[];
  pets: { list: Pet[]; equipped: number[]; slots: number };
  upgrades: { id: number; finish: number }[];
  plotsBought: number;
  claimed: Record<string, boolean>;
  crackUntil: number;
  daily: { lastDay: number; streak: number };
  petSlotsBought: number;
  cursors: { owned: string[]; active: string };
  themes: { owned: string[]; active: string };
  autoRoll: boolean;
  rebirths: number;
  maxRarityEver: number;
  unlocked: Record<string, boolean>;
  cappyBought: number;
  lastSeen: number;
  born: number;
  test: boolean;
  upgrade?: { id: number; finish: number };
}
export interface SaveSlot { t: number; coins: number; count: number; code: string }
export interface Toast { id: number; msg: string; col?: string }

/** v2: everyone's data was reset once (v1 saves had money exploits). */
export const SAVE_KEY = 'baddie_save_v2';
export const SLOTS_KEY = 'baddie_slots_v2';
export const TEST_KEY = 'baddie_testmode';

const ROSTER = BADDIES.map(b => ({ key: b.key, rarity: b.rarity }));
const ROSTER_BY_RARITY: Record<string, typeof ROSTER> = Object.fromEntries(RARITIES.map(r => [r.key, ROSTER.filter(e => e.rarity === r.key)]));
export const ROSTER_KEYS = ROSTER.map(e => e.key);
export function rosterSorted() {
  return [...ROSTER].sort((a, b) => (RAR_IDX[b.rarity] ?? 0) - (RAR_IDX[a.rarity] ?? 0) || a.key.localeCompare(b.key));
}

const rnd = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const upgradeMult = (level: number) => Math.pow(UPGRADE_MULT_PER_LVL, level);
export const upgradeCost = (b: Baddie) => Math.ceil(rarMeta(b.rarity).sell * 3 * Math.pow(1.55, b.level));
export const sellValue = (b: Baddie) => Math.ceil(rarMeta(b.rarity).sell * modMeta(b.modifier).mult * (1 + (b.level || 0) * 0.12));
export const upgradeCooldown = (b: Baddie) => UPGRADE_COOLDOWN + (b.level || 0) * UPGRADE_CD_PER_LVL;
/** One-time index reward: about 15 seconds of what that rarity earns, at least 15. */
export const indexClaimReward = (rarity: string) => Math.max(15, Math.ceil(15 * rarMeta(rarity).rate));
export const dailyAmount = (streak: number) => Math.floor(500 * Math.pow(1.25, Math.min(streak, 30)));
const todayNum = () => Math.floor(Date.now() / 86400000);

export function defaultState(): State {
  return {
    coins: 50, baddies: [], dice: [0], activeDie: 0, potions: [],
    pets: { list: [], equipped: [], slots: 2 }, upgrades: [], plotsBought: 0, claimed: {}, crackUntil: 0,
    daily: { lastDay: 0, streak: 0 }, petSlotsBought: 0,
    cursors: { owned: ['classic'], active: 'classic' }, themes: { owned: ['midnight'], active: 'midnight' },
    autoRoll: false, rebirths: 0, maxRarityEver: 0, unlocked: {}, cappyBought: 0,
    lastSeen: Date.now(), born: Date.now(), test: false,
  };
}

export function encodeState(st: State): string {
  try { return 'BAD1.' + btoa(unescape(encodeURIComponent(JSON.stringify(st)))); } catch { return ''; }
}
export function decodeState(code: string): State | null {
  try {
    code = code.trim();
    if (code.startsWith('BAD1.')) code = code.slice(5);
    return JSON.parse(decodeURIComponent(escape(atob(code))));
  } catch { return null; }
}

/** What the page does when the game does something worth seeing. */
export interface GameFx {
  flash(col: string): void;
  shake(): void;
  burst(x: number, y: number, col: string, n: number, power: number): void;
  banner(title: string, small: string, col: string): void;
  pets(): void;
}

@Injectable()
export class BaddieGame {
  private readonly sound = inject(SoundService);
  S: State = defaultState();
  /** Bumps on every change; everything the page shows reads it. */
  readonly v = signal(0);
  readonly toasts = signal<Toast[]>([]);
  /** Every roll since the page opened, newest first (the RECENT PULLS). */
  lastRolls: Baddie[] = [];
  debugLuck = 1;
  fx: GameFx = { flash() {}, shake() {}, burst() {}, banner() {}, pets() {} };
  private uid = 1;
  private saveT = 0;
  private acc = 0;
  private lastTick = 0;
  private hiddenAt = 0;
  private toastId = 0;
  private timers: ReturnType<typeof setInterval>[] = [];

  // ── life ──
  start(): void {
    this.load();
    this.applyOffline();
    this.lastTick = performance.now();
    this.timers.push(setInterval(() => this.tick(), 250));
    this.timers.push(setInterval(() => this.touch(), 1000));   // the timers on the page count down
    addEventListener('beforeunload', this.onUnload);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.touch();
  }
  stop(): void {
    this.save(true);
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    removeEventListener('beforeunload', this.onUnload);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
  private readonly onUnload = () => this.save(true);
  private readonly onVisibility = () => {
    if (document.hidden) { this.hiddenAt = Date.now(); this.save(true); return; }
    if (this.hiddenAt) {
      // tabbed out earns at the full rate
      const away = Math.min(Date.now() - this.hiddenAt, OFFLINE_CAP_MS);
      const g = Math.floor(this.plotIncomePerSec() * (away / 1000));
      if (g > 0) { this.S.coins += g; if (away > 15000) this.toast('+' + fmt(g) + ' WHILE TABBED OUT', '#7CFF4A'); this.touch(); }
      this.hiddenAt = 0;
    }
    this.lastTick = performance.now();
  };

  touch(): void { this.v.update(n => n + 1); }
  play(name: SoundName, v = 0.6, rate = 1): void { this.sound.play(name, { volume: v, rate }); }
  toast(msg: string, col?: string): void {
    const t = { id: ++this.toastId, msg, col };
    this.toasts.update(l => [...l, t]);
    setTimeout(() => this.toasts.update(l => l.filter(x => x !== t)), 3000);
  }

  // ── the save ──
  private migrate(s: Partial<State> | null): State {
    const st = Object.assign(defaultState(), s || {}) as State;
    st.pets = Object.assign({ list: [], equipped: [], slots: 2 }, st.pets || {});
    st.daily = Object.assign({ lastDay: 0, streak: 0 }, st.daily || {});
    st.cursors = Object.assign({ owned: ['classic'], active: 'classic' }, st.cursors || {});
    st.themes = Object.assign({ owned: ['midnight'], active: 'midnight' }, st.themes || {});
    if (!st.cursors.owned.includes('classic')) st.cursors.owned.unshift('classic');
    if (!st.themes.owned.includes('midnight')) st.themes.owned.unshift('midnight');
    if (typeof st.autoRoll !== 'boolean') st.autoRoll = false;
    if (typeof st.rebirths !== 'number') st.rebirths = 0;
    if (typeof st.maxRarityEver !== 'number') st.maxRarityEver = 0;
    if (typeof st.cappyBought !== 'number') st.cappyBought = 0;
    if (!st.unlocked || typeof st.unlocked !== 'object') st.unlocked = {};
    if (!st.claimed || typeof st.claimed !== 'object') st.claimed = {};
    if (typeof st.plotsBought !== 'number') st.plotsBought = 0;
    if (!Array.isArray(st.upgrades)) st.upgrades = st.upgrade ? [st.upgrade] : [];
    delete st.upgrade;
    if (!Array.isArray(st.baddies)) st.baddies = [];
    if (!Array.isArray(st.dice) || !st.dice.length) st.dice = [0];
    st.baddies.forEach(b => { if (typeof b.varMul !== 'number') b.varMul = 1; });
    st.pets.list.forEach(p => { if (!p.mode) p.mode = 'move'; });
    // the id counter starts above every id already in use
    st.baddies.forEach(b => { if (b.id >= this.uid) this.uid = b.id + 1; });
    st.pets.list.forEach(p => { if (p.id >= this.uid) this.uid = p.id + 1; });
    return st;
  }
  load(): void {
    try { const raw = localStorage.getItem(SAVE_KEY); this.S = this.migrate(raw ? JSON.parse(raw) : null); } catch { this.S = defaultState(); }
  }
  save(force = false): void {
    const now = Date.now();
    if (!force && now - this.saveT < 1500) return;
    this.saveT = now;
    this.S.lastSeen = now;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.S)); } catch { /* storage full or off */ }
  }
  private replace(st: State): void { this.S = this.migrate(st); this.save(true); this.touch(); this.fx.pets(); }

  private applyOffline(): void {
    const elapsed = Date.now() - (this.S.lastSeen || Date.now());
    if (elapsed < 60000) return;
    const gained = Math.floor(this.plotIncomePerSec() * (Math.min(elapsed, OFFLINE_CAP_MS) / 1000) * OFFLINE_RATE);
    if (gained > 0) {
      this.S.coins += gained;
      setTimeout(() => this.toast('WELCOME BACK: +' + fmt(gained) + ' COINS WHILE AWAY', '#ffd56a'), 700);
    }
  }

  private tick(): void {
    const now = performance.now(), S = this.S;
    const dt = Math.min(2, (now - this.lastTick) / 1000);
    this.lastTick = now;
    // tabbed out, nothing accrues here: coming back credits the whole time at once
    if (!document.hidden) {
      this.acc += this.plotIncomePerSec() * dt;
      if (this.acc >= 1) { const add = Math.floor(this.acc); S.coins += add; this.acc -= add; }
    }
    let dirty = false;
    const before = S.potions.length;
    S.potions = S.potions.filter(p => p.exp > Date.now());
    if (S.potions.length !== before) dirty = true;
    if (S.upgrades.some(u => Date.now() >= u.finish)) { this.finishUpgrades(); dirty = true; }
    this.save(dirty);
  }

  // ── multipliers ──
  potionMult(type: string): number { let m = 1; for (const p of this.S.potions) if (p.type === type && p.exp > Date.now()) m *= p.mult; return m; }
  petMults(): { luck: number; money: number } {
    let luck = 1, money = 1;
    for (const id of this.S.pets.equipped) {
      const p = this.S.pets.list.find(x => x.id === id), def = p && PETS[p.type];
      if (def) { luck *= def.luck; money *= def.money; }
    }
    return { luck, money };
  }
  /** +0.25 a rebirth, added. */
  rebirthMult(): number { return 1 + 0.25 * (this.S.rebirths || 0); }
  totalLuck(): number { return this.potionMult('luck') * this.petMults().luck * this.rebirthMult() * this.debugLuck; }
  totalMoneyMult(): number { return this.potionMult('money') * this.petMults().money * this.rebirthMult(); }
  totalModMult(): number { return this.potionMult('mod') * (thmMeta(this.S.themes.active).mutbuff || 1) * this.rebirthMult(); }
  rollSpeed(): number { return curMeta(this.S.cursors.active).speed; }

  // ── income ──
  baddieRate(b: Baddie): number {
    const over = b.overUntil > Date.now() ? CRACK_MULT : 1;
    return rarMeta(b.rarity).rate * modMeta(b.modifier).mult * upgradeMult(b.level || 0) * over * (b.varMul || 1);
  }
  plotIncomePerSec(): number {
    let sum = 0;
    for (const b of this.S.baddies) if (b.placed) sum += this.baddieRate(b);
    return sum * this.totalMoneyMult();
  }

  // ── rolling ──
  private rebirthCapIdx(): number { const r = this.S.rebirths || 0; return r >= 5 ? 99 : REBIRTH_REQ[r]; }
  /** Above your rebirth cap a rarity is not impossible, just a great deal rarer. */
  private pickRarityIndex(weights: number[], luck: number): number {
    const cap = this.rebirthCapIdx();
    const w = weights.map((base, i) => { let v = base * Math.pow(luck, i * 0.32); if (i > cap) v *= Math.pow(0.05, i - cap); return v; });
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { if (x < w[i]) return i; x -= w[i]; }
    return 0;
  }
  pickModifier(modMult: number, allowCappy: boolean): string {
    const pool = MODIFIERS.filter(m => allowCappy || !m.itemOnly);
    const w = pool.map((m, i) => m.weight * Math.pow(modMult, i * 0.42));
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { if (x < w[i]) return pool[i].key; x -= w[i]; }
    return 'None';
  }
  private pickChar(rarKey: string): { key: string; rarity: string } {
    const idx = RAR_IDX[rarKey];
    // that tier, else the nearest lower one with baddies in it, else the nearest higher
    for (let i = idx; i >= 0; i--) { const a = ROSTER_BY_RARITY[RARITIES[i].key]; if (a?.length) return { key: rnd(a).key, rarity: RARITIES[i].key }; }
    for (let i = idx + 1; i < RARITIES.length; i++) { const a = ROSTER_BY_RARITY[RARITIES[i].key]; if (a?.length) return { key: rnd(a).key, rarity: RARITIES[i].key }; }
    return { key: 'mysterybaddie', rarity: rarKey };
  }
  makeBaddie(rarKey: string, modKey: string): Baddie {
    const pick = this.pickChar(rarKey);
    return {
      id: this.uid++, key: pick.key, rarity: pick.rarity, modifier: modKey || 'None', level: 0, placed: false, slot: -1,
      overUntil: 0, born: Date.now(), varMul: +(0.5 + Math.random()).toFixed(3),   // same rarity, 0.5x to 1.5x the income
    };
  }
  private ownsRarity(key: string): boolean { return this.S.baddies.some(b => b.rarity === key); }
  canRoll(): boolean { return this.S.dice.includes(this.S.activeDie); }
  /** One roll, kept: the page animates it. */
  doOneRoll(): Baddie {
    const S = this.S, die = DICE[S.activeDie] || DICE[0];
    let ri = this.pickRarityIndex(die.weights, this.totalLuck());
    // one Apex and one Primordial each, ever: another roll of either lands Cosmic
    if (RARITIES[ri].key === 'Primordial' && this.ownsRarity('Primordial')) ri = RAR_IDX['Cosmic'];
    if (RARITIES[ri].key === 'Apex' && this.ownsRarity('Apex')) ri = RAR_IDX['Cosmic'];
    const b = this.makeBaddie(RARITIES[ri].key, this.pickModifier(this.totalModMult(), false));
    S.baddies.push(b);
    S.unlocked[b.key] = true;
    const idx = RAR_IDX[b.rarity];
    if (idx > (S.maxRarityEver || 0)) S.maxRarityEver = idx;
    return b;
  }
  /** A roll has landed: it joins the recent pulls. */
  landed(b: Baddie): void { this.lastRolls = [b, ...this.lastRolls].slice(0, 40); this.touch(); }

  // ── the plot ──
  plotCap(): number { return Math.min(PLOT_MAX, PLOT_BASE + (this.S.plotsBought || 0)); }
  plotBuyCost(): number { return Math.ceil(100000 * Math.pow(2.5, this.S.plotsBought || 0)); }
  placedCount(): number { return this.S.baddies.filter(b => b.placed).length; }
  togglePlace(id: number): boolean {
    const b = this.S.baddies.find(x => x.id === id);
    if (!b) return false;
    if (b.placed) { b.placed = false; b.slot = -1; } else {
      if (this.placedCount() >= this.plotCap()) { this.toast('PLOT IS FULL (' + this.plotCap() + ')'); return false; }
      b.placed = true;
    }
    this.play('equip', 0.5);
    this.save(true); this.touch();
    return true;
  }
  autoPlace(): void {
    const sorted = [...this.S.baddies].sort((a, b) => this.baddieRate(b) - this.baddieRate(a));
    this.S.baddies.forEach(b => { b.placed = false; b.slot = -1; });
    sorted.slice(0, this.plotCap()).forEach(b => { b.placed = true; });
    this.play('equip', 0.5);
    this.save(true); this.touch();
    this.toast('PLACED BEST ' + Math.min(this.plotCap(), this.S.baddies.length) + ' BADDIES', '#7CFF4A');
  }
  clearPlot(): void { this.S.baddies.forEach(b => { b.placed = false; b.slot = -1; }); this.save(true); this.touch(); }
  buyPlot(): void {
    if (this.plotCap() >= PLOT_MAX) { this.toast('MAX PLOTS REACHED (' + PLOT_MAX + ')'); return; }
    const cost = this.plotBuyCost();
    if (this.S.coins < cost) { this.toast('NOT ENOUGH COINS'); return; }
    this.S.coins -= cost; this.S.plotsBought = (this.S.plotsBought || 0) + 1;
    this.play('save'); this.toast('NEW PLOT UNLOCKED (' + this.plotCap() + '/' + PLOT_MAX + ')', '#7CFF4A');
    this.save(true); this.touch();
  }

  // ── upgrades ──
  startUpgrade(id: number): boolean {
    const S = this.S, b = S.baddies.find(x => x.id === id);
    if (!b) return false;
    if (S.upgrades.find(u => u.id === id)) { this.toast('ALREADY UPGRADING THIS BADDIE'); return false; }
    if (S.upgrades.length >= MAX_UPGRADES) { this.toast('BOTH UPGRADE SLOTS BUSY'); return false; }
    if (b.level >= UPGRADE_MAX_LVL) { this.toast('MAX LEVEL'); return false; }
    const cost = upgradeCost(b);
    if (S.coins < cost) { this.toast('NOT ENOUGH COINS'); return false; }
    const cd = upgradeCooldown(b);
    S.coins -= cost;
    S.upgrades.push({ id, finish: Date.now() + cd });
    this.play('save', 0.5); this.toast('UPGRADING: ' + fmtTime(cd), '#ffd56a');
    this.save(true); this.touch();
    return true;
  }
  finishUpgrades(): void {
    const S = this.S, now = Date.now();
    if (!S.upgrades.length) return;
    const done = S.upgrades.filter(u => now >= u.finish);
    S.upgrades = S.upgrades.filter(u => now < u.finish);
    for (const u of done) {
      const b = S.baddies.find(x => x.id === u.id);
      if (!b) continue;
      b.level = (b.level || 0) + 1;
      // a level on the list moves it up a rarity, as far as Cosmic
      if (RARITY_LEVEL_STEPS.includes(b.level) && RAR_IDX[b.rarity] < RAR_IDX['Cosmic']) {
        b.rarity = RARITIES[RAR_IDX[b.rarity] + 1].key;
        S.unlocked[b.key] = true;
        this.play('mythic');
        this.toast(b.key + ' ASCENDED TO ' + b.rarity.toUpperCase() + '!', rarMeta(b.rarity).col);
      } else {
        this.play('max', 0.5);
        this.toast(b.key + ' UPGRADED TO LV' + b.level, '#7CFF4A');
      }
    }
    this.save(true); this.touch();
  }

  // ── crack (overdrive) ──
  crack(id: number): boolean {
    const S = this.S, b = S.baddies.find(x => x.id === id);
    if (!b) return false;
    if (Date.now() < S.crackUntil) { this.toast('CRACK ON COOLDOWN'); return false; }
    if (b.overUntil > Date.now()) { this.toast('ALREADY IN OVERDRIVE'); return false; }
    b.overUntil = Date.now() + CRACK_DURATION;
    S.crackUntil = Date.now() + CRACK_COOLDOWN;
    this.play('hexxed');
    let msg = 'OVERDRIVE x' + CRACK_MULT + ' FOR 5 MIN';
    if (Math.random() < CRACK_MOD_CHANCE) {
      const mod = this.pickModifier(this.totalModMult() * 1.5, false);
      b.modifier = mod;
      if (mod !== 'None') { msg += ' - GAINED ' + mod + '!'; this.play('legendary', 0.5); }
    }
    this.toast(msg, '#ff5a2b');
    this.save(true); this.touch();
    return true;
  }

  // ── selling ──
  private dropUpgradesOfGone(): void { this.S.upgrades = this.S.upgrades.filter(u => this.S.baddies.find(b => b.id === u.id)); }
  sellOne(id: number): void {
    const S = this.S, i = S.baddies.findIndex(x => x.id === id);
    if (i < 0) return;
    S.coins += sellValue(S.baddies[i]);
    S.upgrades = S.upgrades.filter(u => u.id !== id);
    S.baddies.splice(i, 1);
    this.play('delete', 0.5);
    this.save(true); this.touch();
  }
  unplacedValue(): { n: number; total: number } {
    const un = this.S.baddies.filter(b => !b.placed);
    return { n: un.length, total: un.reduce((s, b) => s + sellValue(b), 0) };
  }
  sellAllUnplaced(): void {
    const keep: Baddie[] = [];
    let gained = 0;
    for (const b of this.S.baddies) { if (b.placed) keep.push(b); else gained += sellValue(b); }
    this.S.baddies = keep;
    this.dropUpgradesOfGone();
    this.S.coins += gained;
    this.play('delete');
    this.toast('SOLD FOR ' + fmt(gained), '#ffd56a');
    this.save(true); this.touch();
  }
  sellRarityAndBelow(rarity: string): void {
    const max = RAR_IDX[rarity], keep: Baddie[] = [];
    let gained = 0, n = 0;
    for (const b of this.S.baddies) {
      if (!b.placed && RAR_IDX[b.rarity] <= max) { gained += sellValue(b); n++; } else keep.push(b);
    }
    if (!n) { this.toast('NOTHING MATCHED'); return; }
    this.S.baddies = keep;
    this.dropUpgradesOfGone();
    this.S.coins += gained;
    this.play('delete');
    this.toast('SOLD ' + n + ' FOR ' + fmt(gained), '#ffd56a');
    this.save(true); this.touch();
  }

  // ── the shop ──
  selectDie(id: number): void { if (!this.S.dice.includes(id)) return; this.S.activeDie = id; this.play('click', 0.4); this.save(true); this.touch(); }
  buyDie(id: number): void {
    const d = DICE[id], S = this.S;
    if (!d || S.dice.includes(id)) return;
    if (S.coins < d.cost) { this.toast('NOT ENOUGH COINS'); return; }
    S.coins -= d.cost; S.dice.push(id); S.activeDie = id;
    this.play('save'); this.toast('BOUGHT ' + d.name, '#ffd56a');
    this.save(true); this.touch();
  }
  activePotion(type: string): Potion | undefined { return this.S.potions.find(p => p.type === type && p.exp > Date.now()); }
  buyPotion(type: 'money' | 'luck' | 'mod', lvl: number): void {
    const P = POTIONS[type], lv = P.levels[lvl], S = this.S;
    if (S.coins < lv.cost) { this.toast('NOT ENOUGH COINS'); return; }
    S.coins -= lv.cost;
    // one of each kind at a time: buying again replaces it
    S.potions = S.potions.filter(p => p.type !== type);
    S.potions.push({ type, level: lvl, mult: lv.mult, exp: Date.now() + POTION_DURATION });
    this.play('equip', 0.5); this.toast(P.name + ' LV' + (lvl + 1) + ' ACTIVE (10 MIN)', P.col);
    this.save(true); this.touch();
  }
  equipCursor(id: string): void {
    if (!this.S.cursors.owned.includes(id)) return;
    this.S.cursors.active = id;
    this.play('equip', 0.4); this.save(true); this.touch();
  }
  buyCursor(id: string): void {
    const c = curMeta(id), S = this.S;
    if (S.cursors.owned.includes(id)) { this.equipCursor(id); return; }
    if (S.coins < c.cost) { this.toast('NOT ENOUGH COINS'); return; }
    S.coins -= c.cost; S.cursors.owned.push(id); S.cursors.active = id;
    this.play('save'); this.toast('EQUIPPED ' + c.name, '#ffd56a'); this.save(true); this.touch();
  }
  equipTheme(id: string): void {
    if (!this.S.themes.owned.includes(id)) return;
    this.S.themes.active = id;
    this.play('equip', 0.5); this.save(true); this.touch();
  }
  buyTheme(id: string): void {
    const t = thmMeta(id), S = this.S;
    if (S.themes.owned.includes(id)) { this.equipTheme(id); return; }
    if (S.coins < t.cost) { this.toast('NOT ENOUGH COINS'); return; }
    S.coins -= t.cost; S.themes.owned.push(id); S.themes.active = id;
    this.play('save'); this.toast(t.name.toUpperCase() + ' THEME EQUIPPED', t.accent); this.save(true); this.touch();
  }
  buyAutoRoll(): boolean {
    if (this.S.autoRoll) return true;
    if (this.S.coins < AUTO_ROLL_COST) { this.toast('NOT ENOUGH COINS'); return false; }
    this.S.coins -= AUTO_ROLL_COST; this.S.autoRoll = true;
    this.play('save'); this.toast('AUTO ROLL UNLOCKED', '#7CFF4A');
    this.save(true); this.touch();
    return true;
  }
  cappyCost(): number { return (this.S.cappyBought || 0) > 0 ? 5000000000 : 10000000; }
  cappyApply(id: number, cost: number): boolean {
    const S = this.S;
    if (S.coins < cost) { this.toast('NOT ENOUGH COINS'); return false; }
    const b = S.baddies.find(x => x.id === id);
    if (!b) return false;
    S.coins -= cost; b.modifier = 'Cappyfied'; S.cappyBought = (S.cappyBought || 0) + 1;
    this.play('mythic', 0.7); this.toast('CAPPYFIED x5 APPLIED', '#ff66dd');
    this.save(true); this.touch();
    return true;
  }

  // ── pets ──
  rollPet(eggKey: string): string {
    const table = EGGS[eggKey].table;
    let x = Math.random() * table.reduce((s, t) => s + t[1], 0);
    for (const [type, w] of table) { if (x < w) return type; x -= w; }
    return table[0][0];
  }
  /** Pays for an egg and decides what is in it; the page shows it hatch, then calls hatched(). */
  buyEgg(eggKey: string): string | null {
    const e = EGGS[eggKey];
    if (this.S.coins < e.cost) { this.toast('NOT ENOUGH COINS'); return null; }
    this.S.coins -= e.cost;
    this.save(true); this.touch();
    return this.rollPet(eggKey);
  }
  addPet(type: string): Pet {
    const pet: Pet = { id: this.uid++, type, born: Date.now(), mode: 'move' };
    this.S.pets.list.push(pet);
    if (this.S.pets.equipped.length < this.S.pets.slots) this.S.pets.equipped.push(pet.id);   // into a free slot
    return pet;
  }
  hatched(type: string): void { this.addPet(type); this.save(true); this.touch(); this.fx.pets(); }
  petSlotCost(): number { return Math.ceil(PET_SLOT_BASE_COST * Math.pow(8, this.S.petSlotsBought)); }
  buyPetSlot(): void {
    const cost = this.petSlotCost(), S = this.S;
    if (S.coins < cost) { this.toast('NOT ENOUGH COINS'); return; }
    S.coins -= cost; S.pets.slots++; S.petSlotsBought++;
    this.play('save'); this.toast('NEW PET SLOT (' + S.pets.slots + ' TOTAL)', '#4aa3ff');
    this.save(true); this.touch();
  }
  togglePet(id: number): void {
    const eq = this.S.pets.equipped, i = eq.indexOf(id);
    if (i >= 0) eq.splice(i, 1);
    else {
      if (eq.length >= this.S.pets.slots) { this.toast('NO FREE SLOTS - BUY MORE'); return; }
      eq.push(id);
    }
    this.play('equip', 0.5);
    this.save(true); this.touch(); this.fx.pets();
  }
  releasePet(id: number): void {
    const list = this.S.pets.list, i = list.findIndex(p => p.id === id);
    if (i < 0) return;
    list.splice(i, 1);
    const e = this.S.pets.equipped.indexOf(id);
    if (e >= 0) this.S.pets.equipped.splice(e, 1);
    this.play('delete', 0.5);
    this.save(true); this.touch(); this.fx.pets();
  }
  setPetMode(id: number, mode: PetMode, pos?: { x: number; y: number }): void {
    const p = this.S.pets.list.find(z => z.id === id);
    if (!p) return;
    p.mode = mode;
    if (mode === 'stay' && pos) p.pos = pos;
    this.save(true);
    this.toast('PET: ' + mode.toUpperCase(), PETS[p.type].col);
  }
  setPetPos(id: number, pos: { x: number; y: number }): void {
    const p = this.S.pets.list.find(z => z.id === id);
    if (p) { p.pos = pos; this.save(true); }
  }

  // ── daily ──
  daily(): { claimed: boolean; streak: number; amount: number; milestone: boolean } {
    const d = this.S.daily, today = todayNum(), claimed = d.lastDay === today, broke = today - d.lastDay > 1;
    const next = d.lastDay === today - 1 ? d.streak + 1 : (claimed ? d.streak : 1);
    return { claimed, streak: claimed ? d.streak : (broke ? 0 : d.streak), amount: dailyAmount(claimed ? d.streak : next), milestone: next % 7 === 0 };
  }
  claimDaily(): void {
    const d = this.S.daily, today = todayNum();
    if (d.lastDay === today) return;
    d.streak = d.lastDay === today - 1 ? d.streak + 1 : 1;
    d.lastDay = today;
    const amount = dailyAmount(d.streak);
    this.S.coins += amount;
    let msg = 'DAILY: +' + fmt(amount) + ' COINS';
    if (d.streak % 7 === 0) {
      // every seventh day, a pet from a common egg
      const type = this.rollPet('common');
      this.addPet(type);
      msg += ' + FREE PET (' + petName(type) + ')';
      this.fx.pets();
    }
    this.play('legendary'); this.toast(msg, '#ffd56a');
    this.save(true); this.touch();
  }

  // ── save files and codes ──
  slots(): (SaveSlot | null)[] {
    try { return JSON.parse(localStorage.getItem(SLOTS_KEY) || 'null') || [null, null, null]; } catch { return [null, null, null]; }
  }
  private setSlots(a: (SaveSlot | null)[]): void { try { localStorage.setItem(SLOTS_KEY, JSON.stringify(a)); } catch { /* storage full or off */ } }
  slotSave(i: number): void {
    const s = this.slots();
    s[i] = { t: Date.now(), coins: this.S.coins, count: this.S.baddies.length, code: encodeState(this.S) };
    this.setSlots(s);
    this.play('save'); this.toast('SAVED TO SLOT ' + (i + 1), '#7CFF4A'); this.touch();
  }
  slotLoad(i: number): boolean {
    const s = this.slots()[i];
    if (!s) return false;
    const st = decodeState(s.code);
    if (!st) { this.toast('SLOT CORRUPT'); return false; }
    this.replace(st); this.toast('LOADED SLOT ' + (i + 1), '#7CFF4A');
    return true;
  }
  slotDelete(i: number): void { const s = this.slots(); s[i] = null; this.setSlots(s); this.play('delete', 0.5); this.touch(); }
  importCode(code: string): boolean {
    if (!code.trim()) { this.toast('PASTE A CODE FIRST'); return false; }
    const st = decodeState(code);
    if (!st) { this.toast('INVALID CODE'); return false; }
    this.replace(st); this.toast('CODE LOADED', '#7CFF4A');
    return true;
  }
  currentCode(): string { return encodeState(this.S); }
  hardReset(): void { this.replace(defaultState()); this.toast('GAME RESET'); }
  fullWipe(): void {
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SLOTS_KEY); } catch { /* nothing to remove */ }
    this.replace(defaultState()); this.toast('ALL DATA WIPED', '#ff4d6d');
  }

  // ── rebirth ──
  rebirthAvailable(): boolean { const r = this.S.rebirths || 0; return r < 5 && (this.S.maxRarityEver || 0) >= REBIRTH_REQ[r]; }
  /** Resets the plot, dice, coins, auto roll and potions; keeps cursors, themes, pets and the index. */
  rebirth(): boolean {
    if (!this.rebirthAvailable()) { this.toast('REBIRTH REQUIREMENTS NOT MET'); return false; }
    const S = this.S;
    S.rebirths = (S.rebirths || 0) + 1;
    S.baddies = []; S.dice = [0]; S.activeDie = 0; S.coins = 0; S.autoRoll = false;
    S.potions = []; S.upgrades = []; S.plotsBought = 0; S.crackUntil = 0;
    this.save(true);
    this.play('mythic', 0.9);
    this.touch();
    return true;
  }

  // ── index ──
  indexClaim(key: string): void {
    const S = this.S;
    if (!S.unlocked[key]) return;
    if (S.claimed[key]) { this.toast('ALREADY CLAIMED'); return; }
    const entry = BADDIES.find(e => e.key === key);
    if (!entry) return;
    const reward = indexClaimReward(entry.rarity);
    S.claimed[key] = true; S.coins += reward;
    this.play('save'); this.toast('+' + fmt(reward) + ' COINS CLAIMED', rarMeta(entry.rarity).col);
    this.fx.burst(innerWidth / 2, innerHeight * 0.4, rarMeta(entry.rarity).col, 30, 6);
    this.save(true); this.touch();
  }

  // ── blackjack's table ──
  /** Takes the bet; false if it cannot be covered. */
  bet(n: number): boolean { if (n > this.S.coins) return false; this.S.coins -= n; this.save(true); this.touch(); return true; }
  pay(n: number): void { this.S.coins += n; this.save(true); this.touch(); }

  // ── test mode (?test=1, #test, or baddie_testmode=1 in storage) ──
  setTest(on: boolean): void { this.S.test = on; this.save(true); this.touch(); }
  cheatCoins(n: number): void { this.S.coins += n; this.save(true); this.touch(); this.toast('+' + fmt(n) + ' COINS', '#7CFF4A'); }
  cheatGive(rar: string, mod: string): void {
    // (the old page made the baddie and then dropped it, so GIVE BADDIE never gave one)
    const b = this.makeBaddie(rar, mod);
    this.S.baddies.push(b); this.S.unlocked[b.key] = true;
    this.save(true); this.touch(); this.toast('GAVE ' + rar + ' ' + mod, '#7CFF4A');
  }
  cheatAllDice(): void { for (const d of DICE) if (!this.S.dice.includes(d.id)) this.S.dice.push(d.id); this.save(true); this.touch(); this.toast('ALL DICE UNLOCKED', '#7CFF4A'); }
  cheatResetCrack(): void { this.S.crackUntil = 0; this.save(true); this.touch(); this.toast('CRACK CD RESET', '#7CFF4A'); }
  cheatFinishUpgrade(): void { for (const u of this.S.upgrades) u.finish = Date.now(); this.finishUpgrades(); this.toast('UPGRADES FINISHED', '#7CFF4A'); }
  cheatResetDaily(): void { this.S.daily.lastDay = 0; this.save(true); this.touch(); this.toast('DAILY RESET', '#7CFF4A'); }
  cheatLuck(v: number): void { this.debugLuck = v || 1; this.touch(); this.toast('DEBUG LUCK x' + this.debugLuck, '#7CFF4A'); }
  cheatClear(): void { this.S.baddies = []; this.S.upgrades = []; this.save(true); this.touch(); this.toast('BADDIES CLEARED'); }
  /** window.cheat() */
  cheatBillion(): void { this.S.coins += 1000000000; this.save(true); this.touch(); this.toast('+1,000,000,000 COINS', '#ffd56a'); }
  /** window.petCheat(): one of every pet. */
  cheatPets(): number {
    let n = 0;
    for (const type of Object.keys(PETS)) { this.addPet(type); n++; }
    this.save(true); this.touch(); this.fx.pets();
    this.toast('+' + n + ' PETS!', '#ff8ad6');
    return n;
  }

  // ── what the page shows ──
  buffs(): { cls: string; text: string }[] {
    const out: { cls: string; text: string }[] = [];
    const mm = this.totalMoneyMult(), lm = this.potionMult('luck') * this.petMults().luck, mod = this.totalModMult();
    if (mm > 1.001) out.push({ cls: 'money', text: 'MONEY x' + mm.toFixed(2) });
    if (lm > 1.001) out.push({ cls: 'luck', text: 'LUCK x' + lm.toFixed(2) });
    if (mod > 1.001) out.push({ cls: 'mod', text: 'MOD x' + mod.toFixed(2) });
    if (this.S.pets.equipped.length) out.push({ cls: 'pet', text: this.S.pets.equipped.length + ' PET(S)' });
    for (const u of this.S.upgrades) { const left = u.finish - Date.now(); if (left > 0) out.push({ cls: '', text: 'UPGRADING ' + fmtTime(left) }); }
    const ck = this.S.crackUntil - Date.now();
    if (ck > 0) out.push({ cls: '', text: 'CRACK CD ' + fmtTime(ck) });
    return out;
  }
  modIdx(key: string): number { return MOD_IDX[key] ?? 0; }
  themes() { return THEMES; }
  cursors() { return CURSORS; }
}
