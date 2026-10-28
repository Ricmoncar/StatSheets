import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PixelTheme } from '../../core/pixel/pixel-theme.service';
import { SettingsService } from '../../core/settings.service';
import { NgTemplateOutlet } from '@angular/common';
import { Modal } from '../../ui/modal';
import { COIN, cursorArt, burgerSprite, modMarks, petSprite } from './art';
import { Backdrop } from './backdrop';
import {
  AUTO_ROLL_COST, CRACK_MULT, CURSORS, DICE, DICE_ANIM, EGGS, INV_PAGE, MODIFIERS, PETS, PLOT_MAX, POTIONS, RARITIES,
  RARITY_LEVEL_STEPS, RAR_IDX, REBIRTH_COLORS, REBIRTH_LABELS, REBIRTH_REQ, THEMES, ThemeDef, UPGRADE_MAX_LVL,
  curMeta, fmt, fmtTime, modMeta, petName, rarMeta, thmMeta,
} from './data';
import { Fx } from './fx';
import { Baddie, BaddieGame, PetMode, ROSTER_KEYS, TEST_KEY, indexClaimReward, rosterSorted, sellValue, upgradeCost, upgradeMult } from './game';
import { BdSprite } from './sprite';

type Tab = 'roll' | 'plot' | 'inv' | 'shop' | 'pets' | 'index' | 'bj' | 'saves';
type ModalState =
  | { kind: 'baddie'; id: number }
  | { kind: 'sellAll' }
  | { kind: 'cappy'; cost: number }
  | { kind: 'slotLoad'; i: number }
  | { kind: 'code'; title: string; sub: string; code: string }
  | { kind: 'hardReset' }
  | { kind: 'fullWipe' }
  | { kind: 'reborn' }
  | { kind: 'full'; key: string };
interface Card { suit: string; rank: string; red: boolean }
interface FloatingPet {
  id: number; type: string; el: HTMLElement; x: number; y: number;
  from: { x: number; y: number; t: number }; to: { x: number; y: number; t: number };
  mode: PetMode; drag: boolean; flip: boolean;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'roll', label: 'ROLL' }, { id: 'plot', label: 'PLOT' }, { id: 'inv', label: 'INVENTORY' }, { id: 'shop', label: 'SHOP' },
  { id: 'pets', label: 'PETS' }, { id: 'index', label: 'INDEX' }, { id: 'bj', label: 'BLACKJACK' }, { id: 'saves', label: 'SAVES' },
];
const SUITS: [string, boolean][] = [['♥', true], ['♦', true], ['♠', false], ['♣', false]];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const rnd = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/**
 * SPIN A BADDIE: the gacha idle game, every tab of the old page (baddie.html)
 * and every rule (game.ts), in the site's pixel style. The game keeps its
 * own save in this browser, under the same keys as the old page.
 */
@Component({
  selector: 'ss-baddie-page',
  imports: [BdSprite, Modal, NgTemplateOutlet],
  providers: [BaddieGame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './baddie-page.html',
  styleUrl: './baddie-page.scss',
  host: {
    '[style.--bd-accent]': 'theme().accent',
    '[style.--cur-soul]': 'cursorCss() + ", auto"',
    '[style.--cur-point]': 'cursorCss() + ", pointer"',
    '[attr.data-theme]': 'theme().id',
    '(document:pointerdown)': 'clickFx($event)',
    '(document:pointermove)': 'followPets($event)',
    '(document:click)': 'outside($event)',
  },
})
export class BaddiePage {
  protected readonly game = inject(BaddieGame);
  private readonly pixel = inject(PixelTheme);
  private readonly settings = inject(SettingsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly bgCv = viewChild.required<ElementRef<HTMLCanvasElement>>('bg');
  private readonly fxCv = viewChild.required<ElementRef<HTMLCanvasElement>>('fx');
  private readonly petLayer = viewChild.required<ElementRef<HTMLElement>>('pets');
  private readonly autoWin = viewChild<ElementRef<HTMLElement>>('auto');
  private backdrop: Backdrop | null = null;
  private fx: Fx | null = null;

  protected readonly TABS = TABS;
  protected readonly RARITIES = RARITIES;
  protected readonly MODIFIERS = MODIFIERS;
  protected readonly DICE = DICE;
  protected readonly CURSORS = CURSORS;
  protected readonly THEMES = THEMES;
  protected readonly POTION_TYPES = ['money', 'luck', 'mod'] as const;
  protected readonly POTIONS = POTIONS;
  protected readonly EGG_KEYS = Object.keys(EGGS);
  protected readonly EGGS = EGGS;
  protected readonly PETS = PETS;
  protected readonly REBIRTH_LABELS = REBIRTH_LABELS;
  protected readonly REBIRTH_COLORS = REBIRTH_COLORS;
  protected readonly REBIRTH_REQ = REBIRTH_REQ;
  protected readonly PLOT_MAX = PLOT_MAX;
  protected readonly CRACK_MULT = CRACK_MULT;
  protected readonly AUTO_ROLL_COST = AUTO_ROLL_COST;
  protected readonly COIN = COIN;
  protected readonly fmt = fmt;
  protected readonly fmtTime = fmtTime;
  protected readonly rarMeta = rarMeta;
  protected readonly modMeta = modMeta;
  protected readonly petName = petName;
  protected readonly cursorArt = cursorArt;
  protected readonly marks = modMarks();

  protected readonly tab = signal<Tab>('roll');
  protected readonly modal = signal<ModalState | null>(null);
  protected readonly invSort = signal<'rar' | 'inc' | 'new'>('rar');
  protected readonly sellRar = signal('Common');
  protected readonly invPage = signal(0);
  protected readonly openDD = signal<'sort' | 'sell' | null>(null);
  protected readonly broken = signal<ReadonlySet<string>>(new Set());
  protected readonly test = signal(false);
  protected readonly codeIn = signal('');
  // the big moments
  protected readonly flash = signal<{ n: number; col: string }>({ n: 0, col: '#fff' });
  protected readonly banner = signal<{ n: number; title: string; small: string; col: string } | null>(null);
  protected readonly shaking = signal(0);
  // the roll
  protected readonly roll = signal<{ on: boolean; busy: boolean; die: number; cyc: string; cycCol: string; b: Baddie | null }>({ on: false, busy: false, die: 0, cyc: '', cycCol: '#fff', b: null });
  // the egg
  protected readonly egg = signal<{ on: boolean; busy: boolean; key: string; fast: boolean; pet: string | null }>({ on: false, busy: false, key: 'common', fast: false, pet: null });
  // the auto roll window
  protected readonly autoShown = signal(false);
  protected readonly autoOn = signal(false);
  protected readonly autoCount = signal(0);
  protected readonly autoCyc = signal<{ text: string; col: string; b: Baddie | null }>({ text: '', col: '#fff', b: null });
  protected readonly autoPos = signal<{ x: number; y: number } | null>(null);
  private autoBusy = false;
  private autoT: ReturnType<typeof setTimeout> | undefined;
  // pets
  protected readonly orders = signal<{ id: number; x: number; y: number } | null>(null);
  private floating = new Map<number, FloatingPet>();
  private petRaf = 0;
  private petTimer: ReturnType<typeof setInterval> | undefined;
  private mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  // blackjack's table
  protected readonly bj = signal<{ deck: Card[]; player: Card[]; dealer: Card[]; bet: number; inRound: boolean; hideHole: boolean; msg: string; cls: string }>({ deck: [], player: [], dealer: [], bet: 0, inRound: false, hideHole: true, msg: 'Place your bet and deal.', cls: '' });
  protected readonly betIn = signal('1000');
  private clickT = 0;

  /** The game's state, read so the page follows every change. */
  protected st() { this.game.v(); return this.game.S; }
  /** The time, read so a countdown on the page moves with the game's second tick. */
  protected now(): number { this.game.v(); return Date.now(); }
  protected readonly theme = computed<ThemeDef>(() => { this.game.v(); return thmMeta(this.game.S.themes.active); });
  protected readonly cursorCss = computed(() => { this.game.v(); return cursorArt(this.game.S.cursors.active).css; });

  constructor() {
    const game = this.game;
    game.fx = {
      flash: col => this.flashScreen(col),
      shake: () => this.shake(),
      burst: (x, y, col, n, p) => this.fx?.burst(x, y, col, n, p),
      banner: (title, small, col) => this.bigBanner(title, small, col),
      pets: () => this.spawnPets(),
    };
    game.start();
    // test mode: ?test=1, #test, or baddie_testmode=1 kept in this browser
    if (/[?&]test=1/.test(location.search) || location.hash === '#test') localStorage.setItem(TEST_KEY, '1');
    if (localStorage.getItem(TEST_KEY) === '1' || game.S.test) { this.test.set(true); game.setTest(true); }
    const w = window as unknown as Record<string, unknown>;
    w['baddieTest'] = (on = true) => { localStorage.setItem(TEST_KEY, on ? '1' : '0'); this.test.set(on); game.setTest(on); if (on) game.toast('TEST MODE ON', '#7CFF4A'); return on ? 'TEST MODE ENABLED' : 'TEST MODE OFF'; };
    w['cheat'] = () => game.cheatBillion();
    w['petCheat'] = () => game.cheatPets();

    effect(() => { const t = this.theme(); this.pixel.setAccent(t.accent); this.backdrop?.setTheme(t); });
    // the coin and the modifiers' marks, as images the stylesheet can use
    this.host.style.setProperty('--coin', `url("${COIN.url}")`);
    for (const [k, url] of Object.entries(this.marks)) this.host.style.setProperty('--mk-' + k, `url("${url}")`);
    afterNextRender(() => {
      this.backdrop = new Backdrop(this.bgCv().nativeElement);
      this.backdrop.setTheme(this.theme());
      this.backdrop.start();
      // performance mode stills the backdrop, as it does every background
      effect(() => { if (this.settings.perfMode()) { this.backdrop?.stop(); this.backdrop?.frame(0); } else this.backdrop?.start(); }, { injector: this.injector });
      this.fx = new Fx(this.fxCv().nativeElement);
      this.spawnPets();
      this.petTimer = setInterval(() => this.movePets(), 3000);
      setTimeout(() => this.movePets(), 400);
    });
    inject(DestroyRef).onDestroy(() => {
      game.stop();
      this.autoOn.set(false);
      clearTimeout(this.autoT);
      clearInterval(this.petTimer);
      cancelAnimationFrame(this.petRaf);
      this.backdrop?.stop();
      this.fx?.stop();
      this.pixel.setAccent(null);
      for (const k of ['baddieTest', 'cheat', 'petCheat']) delete w[k];
    });
  }

  // ── tabs ──
  protected setTab(t: Tab): void {
    this.tab.set(t);
    this.game.play('click', 0.3);
    if (t === 'bj' && !this.bj().inRound) this.bjReset();
  }

  // ── what a baddie looks like ──
  protected img(key: string): string { return `${environment.assetBase}baddies/${key}.png`; }
  protected initials(key: string): string { return key.replace(/baddie$/i, '').slice(0, 2).toUpperCase() || '??'; }
  protected label(key: string): string { return key.replace(/baddie$/i, '').toUpperCase(); }
  protected brokenImg(key: string): void { this.broken.update(s => new Set(s).add(key)); }
  protected upClass(b: Baddie): string { return b.level >= 40 ? 'up3' : b.level >= 20 ? 'up2' : b.level > 0 ? 'up1' : ''; }
  protected over(b: Baddie): boolean { return b.overUntil > Date.now(); }
  protected rate(b: Baddie): number { return this.game.baddieRate(b); }
  protected live(b: Baddie): Baddie { return this.game.S.baddies.find(x => x.id === b.id) || b; }

  // ── top ──
  protected buffs() { this.game.v(); return this.game.buffs(); }
  protected cps(): number { this.game.v(); return this.game.plotIncomePerSec(); }

  // ── ROLL ──
  protected ownedDice() { const S = this.st(); return DICE.filter(d => S.dice.includes(d.id)); }
  protected doRoll(again = false): void {
    if (this.roll().busy) return;
    if (!this.game.canRoll()) { this.game.toast('YOU DO NOT OWN THAT DIE'); return; }
    const b = this.game.doOneRoll();
    this.game.save(true); this.game.touch();
    this.showRoll(b);
    void again;
  }
  private showRoll(b: Baddie): void {
    const g = this.game;
    this.roll.set({ on: true, busy: true, die: g.S.activeDie, cyc: '', cycCol: '#fff', b: null });
    g.play('diceroll', 0.5);
    // the names scramble past, faster with a better cursor
    let ticks = 0;
    const max = 14 + Math.floor(Math.random() * 6), iv = Math.max(26, Math.round(70 / g.rollSpeed()));
    const timer = setInterval(() => {
      ticks++;
      this.roll.update(r => ({ ...r, cyc: rnd(ROSTER_KEYS).toUpperCase(), cycCol: rnd(RARITIES).col }));
      g.play('dicealt', 0.18, 1.4);
      if (ticks >= max) { clearInterval(timer); this.land(b); }
    }, iv);
  }
  private land(b: Baddie): void {
    const g = this.game, rm = rarMeta(b.rarity), mm = modMeta(b.modifier), idx = RAR_IDX[b.rarity];
    this.roll.update(r => ({ ...r, busy: false, cyc: b.key.toUpperCase(), cycCol: rm.col, b }));
    // the screen answers the rarity
    const cx = innerWidth / 2, cy = innerHeight * 0.42;
    this.flashScreen(rm.col);
    if (idx >= 8) { this.fx?.burst(cx, cy, rm.col, 150, 11); this.shake(); this.bigBanner(b.rarity.toUpperCase() + '!', b.key + (b.modifier !== 'None' ? ' · ' + b.modifier : ''), rm.col); }
    else if (idx >= 5) { this.fx?.burst(cx, cy, rm.col, 85, 9); this.shake(); }
    else if (idx >= 3) this.fx?.burst(cx, cy, rm.col, 44, 7);
    else this.fx?.burst(cx, cy, rm.col, 20, 5);
    if (b.modifier !== 'None' && g.modIdx(b.modifier) >= 7) this.fx?.burst(cx, cy, mm.col, 40, 8);
    if (idx >= 10) this.specialRollFx(idx, cx, cy);
    if (idx >= 8) g.play('mythic', 0.7);
    else if (idx >= 5) g.play('legendary', 0.6);
    else g.play('rolldone', 0.5);
    g.landed(b);
  }
  /** Cosmic, Apex and Primordial each have their own. */
  private specialRollFx(idx: number, x: number, y: number): void {
    if (idx >= 12) {
      const pal = ['#ff8ad6', '#ffd24a', '#7CFF4A', '#7df9ff', '#b277ff', '#ff5ec4'];
      pal.forEach((c, i) => setTimeout(() => { this.fx?.burst(x, y, c, 46, 9); this.flashScreen(c); }, i * 95));
      for (let r = 0; r < 3; r++) setTimeout(() => this.fx?.ring(x, y, pal[(r * 2) % pal.length]), r * 170);
    } else if (idx === 11) { this.fx?.matrix(); this.flashScreen('#7CFF4A'); }
    else { this.fx?.ring(x, y, '#2bd9d9'); setTimeout(() => this.fx?.ring(x, y, '#aef6ff'), 160); this.fx?.burst(x, y, '#2bd9d9', 130, 11); }
  }
  protected dismissRoll(): void { this.roll.update(r => ({ ...r, on: false })); }
  protected dieAnim(id: number): string { return DICE_ANIM[id] || 'tumble'; }

  // ── AUTO ROLL ──
  protected autoOpen(): void {
    if (!this.game.S.autoRoll) { this.game.toast('BUY AUTO ROLL IN THE SHOP'); this.setTab('shop'); return; }
    this.autoShown.set(true);
  }
  protected autoHide(): void { this.autoOn.set(false); clearTimeout(this.autoT); this.autoShown.set(false); }
  protected autoToggle(): void {
    if (!this.game.S.autoRoll) { this.game.toast('BUY AUTO ROLL'); return; }
    this.autoOn.update(o => !o);
    if (this.autoOn() && !this.autoBusy) this.autoStep();
    else if (!this.autoOn()) clearTimeout(this.autoT);
  }
  private autoStep(): void {
    if (!this.autoOn()) { this.autoBusy = false; return; }
    this.autoBusy = true;
    const g = this.game, b = g.doOneRoll();
    g.save(); g.touch();
    let ticks = 0;
    const iv = Math.max(22, Math.round(58 / g.rollSpeed()));
    this.autoCyc.set({ text: '', col: '#fff', b: null });
    const t = setInterval(() => {
      ticks++;
      this.autoCyc.set({ text: rnd(ROSTER_KEYS).toUpperCase(), col: rnd(RARITIES).col, b: null });
      if (ticks < 9) return;
      clearInterval(t);
      const rm = rarMeta(b.rarity);
      this.autoCyc.set({ text: b.key.toUpperCase(), col: rm.col, b });
      const r = this.autoWin()?.nativeElement.getBoundingClientRect();
      if (RAR_IDX[b.rarity] >= 8) { g.play('mythic', 0.5); if (r) this.fx?.burst(r.left + r.width / 2, r.top + 40, rm.col, 70, 8); this.shake(); }
      else if (RAR_IDX[b.rarity] >= 5) { g.play('legendary', 0.4); if (r) this.fx?.burst(r.left + r.width / 2, r.top + 40, rm.col, 40, 7); }
      else g.play('pop', 0.25);
      this.autoCount.update(n => n + 1);
      g.landed(b);
      if (this.autoOn()) this.autoT = setTimeout(() => this.autoStep(), 420); else this.autoBusy = false;
    }, iv);
  }
  protected autoDrag(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('button')) return;
    const w = this.autoWin()?.nativeElement;
    if (!w) return;
    const r = w.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top, head = e.currentTarget as HTMLElement;
    head.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => this.autoPos.set({ x: m.clientX - ox, y: m.clientY - oy });
    const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
  }

  // ── PLOT ──
  protected plotSlots(): (Baddie | null)[] {
    const S = this.st(), cap = this.game.plotCap();
    const placed = S.baddies.filter(b => b.placed).sort((a, b) => this.rate(b) - this.rate(a));
    return Array.from({ length: cap }, (_, i) => placed[i] || null);
  }

  // ── INVENTORY ──
  protected invList(): Baddie[] {
    const list = [...this.st().baddies], s = this.invSort();
    if (s === 'rar') list.sort((a, b) => RAR_IDX[b.rarity] - RAR_IDX[a.rarity] || this.rate(b) - this.rate(a));
    else if (s === 'inc') list.sort((a, b) => this.rate(b) - this.rate(a));
    else list.sort((a, b) => b.born - a.born);
    return list;
  }
  protected pages(n: number): number { return Math.max(1, Math.ceil(n / INV_PAGE)); }
  protected invSlice(list: Baddie[]): Baddie[] {
    const pages = this.pages(list.length), p = Math.min(Math.max(0, this.invPage()), pages - 1);
    return list.slice(p * INV_PAGE, p * INV_PAGE + INV_PAGE);
  }
  protected pageAt(n: number): number { return Math.min(Math.max(0, this.invPage()), this.pages(n) - 1); }
  protected turnPage(d: number, el: HTMLElement): void { this.invPage.update(p => p + d); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  protected readonly SORTS = [{ v: 'rar', l: 'SORT: RARITY' }, { v: 'inc', l: 'SORT: INCOME' }, { v: 'new', l: 'SORT: NEWEST' }] as const;
  protected sortLabel(): string { return this.SORTS.find(s => s.v === this.invSort())!.l; }
  protected sellAll(): void {
    if (!this.game.unplacedValue().n) { this.game.toast('NOTHING UNPLACED TO SELL'); return; }
    this.modal.set({ kind: 'sellAll' });
  }

  // ── a baddie's own menu ──
  protected openBaddie(b: Baddie): void { this.game.play('click', 0.4); this.modal.set({ kind: 'baddie', id: b.id }); }
  protected modalBaddie(): Baddie | null {
    const m = this.modal();
    if (m?.kind !== 'baddie') return null;
    return this.st().baddies.find(b => b.id === m.id) || null;
  }
  protected menu(b: Baddie) {
    const S = this.game.S, upCost = upgradeCost(b), upBusy = S.upgrades.find(u => u.id === b.id), slotsFull = S.upgrades.length >= 2;
    const atCap = RAR_IDX[b.rarity] >= RAR_IDX['Cosmic'], crackReady = Date.now() >= S.crackUntil, over = this.over(b);
    return {
      upCost, upBusy, atCap, crackReady, over, sellV: sellValue(b), mult: upgradeMult(b.level),
      canUp: !upBusy && !slotsFull && b.level < UPGRADE_MAX_LVL && S.coins >= upCost,
      nextBump: atCap ? undefined : RARITY_LEVEL_STEPS.find(s => s > b.level),
      upLabel: b.level >= UPGRADE_MAX_LVL ? 'MAX LEVEL' : upBusy ? 'UPGRADING ' + fmtTime(upBusy.finish - Date.now()) : slotsFull ? 'BOTH UPGRADE SLOTS BUSY' : 'UPGRADE  LV' + b.level + ' to LV' + (b.level + 1) + '  [' + fmt(upCost) + ']',
      crackLabel: over ? 'IN OVERDRIVE (' + fmtTime(b.overUntil - Date.now()) + ')' : crackReady ? 'CRACK (OVERDRIVE x' + CRACK_MULT + ', 5MIN)' : 'CRACK ON COOLDOWN (' + fmtTime(S.crackUntil - Date.now()) + ')',
    };
  }
  protected act(what: 'place' | 'upgrade' | 'crack' | 'sell', id: number): void {
    const g = this.game;
    const ok = what === 'place' ? g.togglePlace(id) : what === 'upgrade' ? g.startUpgrade(id) : what === 'crack' ? g.crack(id) : (g.sellOne(id), true);
    if (ok) this.modal.set(null);
  }

  // ── SHOP ──
  protected odds(weights: number[]): { pct: number; col: string; key: string }[] {
    const total = weights.reduce((a, b) => a + b, 0);
    return weights.map((w, i) => ({ pct: (w / total) * 100, col: RARITIES[i].col, key: RARITIES[i].key })).filter(o => o.pct >= 0.4);
  }
  protected cappy(): void {
    const cost = this.game.cappyCost();
    if (!this.game.S.baddies.some(b => b.modifier !== 'Cappyfied')) { this.game.toast('NO ELIGIBLE BADDIE'); return; }
    this.modal.set({ kind: 'cappy', cost });
  }
  protected cappyCandidates(): Baddie[] { return this.st().baddies.filter(b => b.modifier !== 'Cappyfied').sort((a, b) => RAR_IDX[b.rarity] - RAR_IDX[a.rarity]); }
  protected buyAuto(): void { if (this.game.buyAutoRoll()) this.autoShown.set(true); }

  // ── PETS ──
  protected hatch(key: string): void {
    if (this.egg().busy) { this.game.toast('ALREADY OPENING AN EGG'); return; }
    const type = this.game.buyEgg(key);
    if (!type) return;
    const e = EGGS[key], def = PETS[type], g = this.game;
    this.egg.set({ on: true, busy: true, key, fast: false, pet: null });
    g.play('diceroll', 0.5);
    setTimeout(() => { this.fx?.burst(innerWidth / 2, innerHeight * 0.4, e.col, 28, 5); g.play('dicealt', 0.3, 0.8); this.egg.update(s => ({ ...s, fast: true })); }, 1000);
    setTimeout(() => {
      g.hatched(type);
      this.egg.update(s => ({ ...s, busy: false, pet: type }));
      if (def.special || def.shiny) {
        g.play('mythic', 0.8); this.flashScreen(def.col); this.shake();
        this.fx?.burst(innerWidth / 2, innerHeight * 0.4, def.col, 130, 10);
        if (def.special) this.bigBanner(petName(type).toUpperCase() + '!', 'LEGENDARY PET', def.col);
      } else { g.play('legendary', 0.5); this.fx?.burst(innerWidth / 2, innerHeight * 0.4, def.col, 42, 7); }
    }, 1500);
  }
  protected dismissEgg(): void { if (!this.egg().busy) this.egg.update(s => ({ ...s, on: false })); }
  protected eggLines(key: string): string[] { return EGGS[key].table.map(([t, w]) => petName(t) + ' ' + w + '%'); }

  // ── the pets floating round the page ──
  private spawnPets(): void {
    const layer = this.petLayer()?.nativeElement;
    if (!layer) return;
    const S = this.game.S, px = this.px();
    for (const [id, f] of this.floating) if (!S.pets.equipped.includes(id)) { f.el.remove(); this.floating.delete(id); }
    for (const id of S.pets.equipped) {
      if (this.floating.has(id)) continue;
      const p = S.pets.list.find(x => x.id === id);
      if (!p) continue;
      const def = PETS[p.type], el = document.createElement('div');
      el.className = 'bd-pet' + (def.special ? ' special' : '');
      el.style.setProperty('--pc', def.col);
      const spr = document.createElement('i');
      spr.className = 'u-spr';
      el.appendChild(spr);
      petSprite(p.type).then(s => {
        spr.style.cssText = `--w:${s.w};--h:${s.h};--n:${s.n};--fps:${s.fps};--sc:${def.special ? 2 : 1};--sheet:url("${s.url}");` + (s.n > 1 ? '' : `background-image:url("${s.url}")`);
        if (s.n > 1) spr.classList.add('u-anim');
      });
      const x = p.mode === 'stay' && p.pos ? p.pos.x : Math.random() * (innerWidth - 120) + 20;
      const y = p.mode === 'stay' && p.pos ? p.pos.y : Math.random() * (innerHeight - 220) + 90;
      const f: FloatingPet = { id, type: p.type, el, x, y, from: { x, y, t: 0 }, to: { x, y, t: 0 }, mode: p.mode || 'move', drag: false, flip: false };
      this.floating.set(id, f);
      layer.appendChild(el);
      this.place(f, px);
      this.wirePet(f);
    }
    this.animatePets();
  }
  private px(): number { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--px')) || 3; }
  private place(f: FloatingPet, px: number): void {
    f.el.style.transform = `translate(${Math.round(f.x / px) * px}px, ${Math.round(f.y / px) * px}px)`;
    f.el.classList.toggle('flip', f.flip);
  }
  /** Every three seconds each pet that is free to goes somewhere new, at its own pace. */
  private movePets(): void {
    const now = performance.now() / 1000;
    for (const f of this.floating.values()) {
      if (f.mode !== 'move' || f.drag) continue;
      const behav = PETS[f.type].behav;
      const dur = behav === 'fly' ? 2.4 : behav === 'swim' ? 4 : behav === 'dart' ? 1.3 : behav === 'creep' ? 5.5 : behav === 'hop' ? 2.8 : behav === 'star' ? 2 : 3;
      const nx = Math.random() * (innerWidth - 110) + 18;
      const ny = behav === 'fly' || behav === 'star' ? Math.random() * (innerHeight * 0.4) + 70 : Math.random() * (innerHeight - 240) + 90;
      f.from = { x: f.x, y: f.y, t: now }; f.to = { x: nx, y: ny, t: now + dur };
      f.flip = nx >= innerWidth / 2;
      // SHIMMY drops burgers
      if (PETS[f.type].special && Math.random() < 0.4) this.dropBurger(nx, ny);
    }
    this.animatePets();
  }
  private dropBurger(x: number, y: number): void {
    const layer = this.petLayer()?.nativeElement;
    if (!layer) return;
    const el = document.createElement('i');
    el.className = 'u-spr bd-burger';
    burgerSprite().then(s => { el.style.cssText = `--w:${s.w};--h:${s.h};--n:1;background-image:url("${s.url}");left:${x}px;top:${y}px;`; });
    layer.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
  private animatePets(): void {
    if (this.petRaf) return;
    const px = this.px();
    const step = () => {
      const now = performance.now() / 1000;
      let moving = false;
      for (const f of this.floating.values()) {
        if (f.drag || f.mode === 'stay') continue;
        if (now < f.to.t) {
          const u = Math.max(0, (now - f.from.t) / (f.to.t - f.from.t)), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          f.x = f.from.x + (f.to.x - f.from.x) * e; f.y = f.from.y + (f.to.y - f.from.y) * e;
          moving = true;
        } else { f.x = f.to.x; f.y = f.to.y; }
        this.place(f, px);
      }
      this.petRaf = moving ? requestAnimationFrame(step) : 0;
    };
    this.petRaf = requestAnimationFrame(step);
  }
  protected followPets(e: PointerEvent): void {
    this.mouse = { x: e.clientX, y: e.clientY };
    let i = 0;
    const now = performance.now() / 1000;
    for (const id of this.game.S.pets.equipped) {
      const f = this.floating.get(id);
      if (!f || f.mode !== 'follow' || f.drag) continue;
      const off = 36 + i * 34;
      i++;
      f.from = { x: f.x, y: f.y, t: now }; f.to = { x: e.clientX + off, y: e.clientY + off - 10, t: now + 0.22 };
      f.flip = e.clientX + off >= innerWidth / 2;
    }
    this.animatePets();
  }
  private wirePet(f: FloatingPet): void {
    const el = f.el;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      const downX = e.clientX, downY = e.clientY, ox = e.clientX - f.x, oy = e.clientY - f.y;
      let moved = false;
      f.drag = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* the pointer is gone already */ }
      const move = (m: PointerEvent) => {
        if (Math.abs(m.clientX - downX) > 4 || Math.abs(m.clientY - downY) > 4) moved = true;
        f.x = m.clientX - ox; f.y = m.clientY - oy;
        this.place(f, this.px());
      };
      const up = (u: PointerEvent) => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
        f.drag = false; f.from = f.to = { x: f.x, y: f.y, t: 0 };
        if (moved) this.game.setPetPos(f.id, { x: f.x, y: f.y });
        else this.orders.set({ id: f.id, x: Math.min(u.clientX, innerWidth - 140), y: Math.min(u.clientY, innerHeight - 150) });
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
  }
  protected orderPet(mode: PetMode): void {
    const o = this.orders();
    if (!o) return;
    const f = this.floating.get(o.id);
    if (f) { f.mode = mode; f.from = f.to = { x: f.x, y: f.y, t: 0 }; }
    this.game.setPetMode(o.id, mode, f ? { x: f.x, y: f.y } : undefined);
    this.orders.set(null);
    if (mode === 'move') this.movePets();
  }
  protected orderPetDef() { const o = this.orders(); const p = o && this.game.S.pets.list.find(x => x.id === o.id); return p ? { p, def: PETS[p.type] } : null; }
  protected outside(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (t.closest('.bd-pet') || t.closest('.orders')) return;
    if (!t.closest('.dd')) this.openDD.set(null);
    this.orders.set(null);
  }

  // ── INDEX ──
  protected index() { const S = this.st(); return rosterSorted().map(e => ({ ...e, found: !!S.unlocked[e.key], claimed: !!S.claimed[e.key], reward: indexClaimReward(e.rarity) })); }
  protected found(list: { found: boolean }[]): number { return list.filter(e => e.found).length; }
  protected showFull(key: string): void { this.game.play('click', 0.4); this.modal.set({ kind: 'full', key }); }
  protected fullEntry() { const m = this.modal(); return m?.kind === 'full' ? { key: m.key, rarity: rosterSorted().find(e => e.key === m.key)?.rarity || 'Common' } : null; }

  // ── SAVES ──
  protected slots() { this.game.v(); return this.game.slots(); }
  protected slotCode(i: number): void {
    const s = this.game.slots()[i];
    if (s) this.modal.set({ kind: 'code', title: 'SLOT ' + (i + 1) + ' TRANSFER CODE', sub: 'Copy this and paste it on another device under TRANSFER CODE.', code: s.code });
  }
  protected exportCurrent(): void { this.modal.set({ kind: 'code', title: 'CURRENT GAME CODE', sub: 'Paste this on another device to transfer your progress.', code: this.game.currentCode() }); }
  protected importCode(): void { if (this.game.importCode(this.codeIn())) { this.codeIn.set(''); this.afterLoad(); } }
  protected loadSlot(i: number): void { if (this.game.slotLoad(i)) this.afterLoad(); this.modal.set(null); }
  private afterLoad(): void { this.autoHide(); this.spawnPets(); }
  protected afterLoadPublic(): void { this.afterLoad(); }
  protected copy(t: string): void {
    navigator.clipboard.writeText(t).then(() => this.game.toast('COPIED', '#7CFF4A'), () => this.game.toast('COPY FAILED - SELECT MANUALLY'));
  }
  protected rebirth(): void {
    if (!this.game.rebirth()) return;
    this.autoHide();
    this.modal.set({ kind: 'reborn' });
  }
  protected daily() { this.game.v(); return this.game.daily(); }
  protected slotDate(t: number): string { const d = new Date(t); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString(); }

  // ── BLACKJACK'S TABLE ──
  private deck(): Card[] {
    const d: Card[] = [];
    for (const [suit, red] of SUITS) for (const rank of RANKS) d.push({ suit, rank, red });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }
  protected cardVal(r: string): number { return r === 'A' ? 11 : ['K', 'Q', 'J', '10'].includes(r) ? 10 : +r; }
  protected handValue(h: Card[]): number {
    let v = 0, aces = 0;
    for (const c of h) { v += this.cardVal(c.rank); if (c.rank === 'A') aces++; }
    while (v > 21 && aces > 0) { v -= 10; aces--; }
    return v;
  }
  private isBJ(h: Card[]): boolean { return h.length === 2 && this.handValue(h) === 21; }
  protected parseBet(): number { const n = parseInt(this.betIn().replace(/[^0-9]/g, ''), 10); return n > 0 ? n : 0; }
  protected betAdd(n: number): void { if (!this.bj().inRound) this.betIn.set(String(Math.min(Math.floor(this.game.S.coins), this.parseBet() + n))); }
  protected betMax(): void { if (!this.bj().inRound) this.betIn.set(String(Math.floor(this.game.S.coins))); }
  protected betClear(): void { if (!this.bj().inRound) this.betIn.set('0'); }
  private bjReset(): void {
    this.bj.update(s => ({ ...s, player: [], dealer: [], inRound: false, hideHole: true, msg: 'Place your bet and deal.', cls: '' }));
    if (this.parseBet() > this.game.S.coins) this.betIn.set(String(Math.floor(this.game.S.coins)));
  }
  protected bjDeal(): void {
    const s = this.bj();
    if (s.inRound) return;
    const bet = this.parseBet();
    if (bet <= 0) { this.bj.update(x => ({ ...x, msg: 'ENTER A BET FIRST', cls: '' })); return; }
    if (bet > this.game.S.coins) { this.bj.update(x => ({ ...x, msg: 'NOT ENOUGH COINS', cls: 'lose' })); return; }
    this.game.bet(bet);
    const deck = this.deck(), player = [deck.pop()!], dealer = [deck.pop()!];
    player.push(deck.pop()!); dealer.push(deck.pop()!);
    this.game.play('click', 0.4);
    this.bj.set({ deck, player, dealer, bet, inRound: true, hideHole: true, msg: 'HIT or STAND. Bet ' + fmt(bet) + '.', cls: '' });
    // naturals
    if (this.isBJ(player) || this.isBJ(dealer)) { this.bj.update(x => ({ ...x, hideHole: false })); this.settle(true); }
  }
  protected bjHit(): void {
    const s = this.bj();
    if (!s.inRound) return;
    const player = [...s.player, s.deck.pop()!];
    this.game.play('dicealt', 0.3);
    this.bj.set({ ...s, player });
    const v = this.handValue(player);
    if (v > 21) { this.bj.update(x => ({ ...x, hideHole: false })); this.finish('lose', 'BUST! You lose ' + fmt(s.bet) + '.'); }
    else if (v === 21) this.bjStand();
  }
  protected readonly dealing = signal(false);
  protected bjStand(): void {
    if (!this.bj().inRound || this.dealing()) return;
    this.dealing.set(true);
    this.bj.update(x => ({ ...x, hideHole: false }));
    // the dealer draws to 17, and stands on every 17
    const draw = () => {
      const s = this.bj();
      if (this.handValue(s.dealer) < 17) { this.bj.set({ ...s, dealer: [...s.dealer, s.deck.pop()!] }); this.game.play('dicealt', 0.25); setTimeout(draw, 420); }
      else { this.dealing.set(false); this.settle(false); }
    };
    setTimeout(draw, 300);
  }
  private settle(checkNatural: boolean): void {
    const s = this.bj(), pv = this.handValue(s.player), dv = this.handValue(s.dealer), pBJ = this.isBJ(s.player), dBJ = this.isBJ(s.dealer), bet = s.bet;
    if (checkNatural && (pBJ || dBJ)) {
      if (pBJ && dBJ) this.finish('push', 'Both blackjack. Push - bet returned.', bet);
      else if (pBJ) this.finish('win', 'BLACKJACK! Pays 3:2.', Math.floor(bet * 2.5));
      else this.finish('lose', 'Dealer blackjack. You lose ' + fmt(bet) + '.');
      return;
    }
    if (pv > 21) this.finish('lose', 'BUST! You lose ' + fmt(bet) + '.');
    else if (dv > 21) this.finish('win', 'Dealer busts! You win ' + fmt(bet) + '.', bet * 2);
    else if (pv > dv) this.finish('win', 'You win ' + fmt(bet) + '!', bet * 2);
    else if (pv < dv) this.finish('lose', 'Dealer wins. You lose ' + fmt(bet) + '.');
    else this.finish('push', 'Push - bet returned.', bet);
  }
  private finish(cls: 'win' | 'lose' | 'push', msg: string, payout = 0): void {
    if (payout > 0) {
      this.game.pay(payout);
      if (cls === 'win') { this.game.play('legendary', 0.5); this.fx?.burst(innerWidth / 2, innerHeight * 0.4, '#ff8a3d', 40, 7); }
    } else if (cls === 'lose') this.game.play('delete', 0.4);
    this.bj.update(x => ({ ...x, inRound: false, hideHole: false, msg, cls }));
  }
  protected dealerScore(): string {
    const s = this.bj();
    if (!s.dealer.length) return '';
    return s.hideHole ? '(' + this.cardVal(s.dealer[0].rank) + '+?)' : '(' + this.handValue(s.dealer) + ')';
  }

  // ── the big moments ──
  private flashScreen(col: string): void { this.flash.update(f => ({ n: f.n + 1, col })); }
  private shake(): void { this.shaking.update(n => n + 1); }
  private bigBanner(title: string, small: string, col: string): void {
    const n = (this.banner()?.n ?? 0) + 1;
    this.banner.set({ n, title, small, col });
    setTimeout(() => { if (this.banner()?.n === n) this.banner.set(null); }, 2400);
  }
  /** Each cursor throws its own sparks where you click. */
  protected clickFx(e: PointerEvent): void {
    const now = performance.now();
    if (now - this.clickT < 70) return;
    this.clickT = now;
    const c = curMeta(this.game.S.cursors.active);
    this.fx?.click(e.clientX, e.clientY, c.fx.glyph, c.fx.col, c.fx.n);
  }

  // ── test mode ──
  protected readonly cheatRar = signal('Common');
  protected readonly cheatMod = signal('None');
  protected readonly cheatLuckIn = signal('');
  protected hideCheat(): void { this.test.set(false); this.game.setTest(false); }
  protected cheatEgg(k: string): void { this.game.S.coins += EGGS[k].cost; this.game.touch(); this.hatch(k); }
}
