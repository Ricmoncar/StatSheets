import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';

type Mode = 'relationship' | 'friendship';
interface CompatTier { min: number; label: string; color: string; msg: string; flavor: string }

const TIERS: Record<Mode, CompatTier[]> = {
  relationship: [
    { min: 92, label: 'SOULMATES', color: '#ff6eb4', msg: 'LITERALLY MADE FOR EACH OTHER.', flavor: '"Violent Sex"' },
    { min: 78, label: 'VERY COMPATIBLE', color: '#ff9ec4', msg: 'STRONG CHEMISTRY.', flavor: '"sweethearts"' },
    { min: 62, label: 'COMPATIBLE', color: '#ffc44a', msg: "THERE'S REAL SOMETHING HERE. JUST NEEDS SOME WORK.", flavor: '"almost there"' },
    { min: 46, label: 'COMPLICATED', color: '#ff8c00', msg: "THEY'D FIGHT OFTEN, BUT LOVE EACHOTHER", flavor: '"chaotic, messy..."' },
    { min: 28, label: 'ROCKY', color: '#e06050', msg: 'MORE CONFLICT THAN CHEMISTRY. A LOT OF WORK.', flavor: '"this would not end well for either of them."' },
    { min: 0, label: 'DISASTER', color: '#cc2222', msg: 'ABSOLUTELY NOT.', flavor: '"do not do this to these two."' },
  ],
  friendship: [
    { min: 92, label: 'BESTIES', color: '#7ed7ff', msg: 'BESTIEEES', flavor: '"ngh"' },
    { min: 78, label: 'GREAT FRIENDS', color: '#44ccff', msg: "THEY'D GET ALONG EFFORTLESSLY. A STRONG BOND.", flavor: '"always there for each other"' },
    { min: 62, label: 'GOOD FRIENDS', color: '#44ff99', msg: "THEY'D DEF HANG OUT.", flavor: '"Type shi."' },
    { min: 46, label: 'FRIENDLY', color: '#aaff99', msg: "THEY'D BE NICE TO EACH OTHER.", flavor: '"pleasant company, not much more."' },
    { min: 28, label: 'ACQUAINTANCES', color: '#aaaaaa', msg: "THEY PROBABLY WOULDN'T CLICK.", flavor: '"they\'d nod at each other in the hallway."' },
    { min: 0, label: 'STRANGERS', color: '#555555', msg: "COMPLETE OPPOSITES. THEY'D AVOID EACH OTHER.", flavor: '"better for everyone if they never meet."' },
  ],
};
const NARA = /^NARA!+$/;
// a pixel heart and a pixel sparkle, 9x9
const HEART = 'M1 1h3v1h1v-1h3v1h1v3h-1v1h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-3h1z';
const SPARK = 'M4 0h1v3h1v1h3v1h-3v1h-1v3h-1v-3h-1v-1h-3v-1h3v-1h1z';

/** FNV-1a 32-bit: the same pair and mode always score the same, on any machine. */
export function compatHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/** How well do two characters click? Deterministic per pair and mode. */
@Component({
  selector: 'ss-compat-tester',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="intro">HOW WELL DO TWO CHARACTERS CLICK? RESULTS ARE UNIQUE TO YOU AND STAY CONSISTENT.</p>
    <div class="modes" role="radiogroup" aria-label="Mode">
      <button type="button" role="radio" class="mode rel" [class.on]="mode() === 'relationship'" [attr.aria-checked]="mode() === 'relationship'" (click)="setMode('relationship')">
        <svg viewBox="0 0 9 9" width="12" height="12" shape-rendering="crispEdges" aria-hidden="true"><path [attr.d]="heart" fill="currentColor" /></svg> RELATIONSHIP</button>
      <button type="button" role="radio" class="mode fr" [class.on]="mode() === 'friendship'" [attr.aria-checked]="mode() === 'friendship'" (click)="setMode('friendship')">
        <svg viewBox="0 0 9 9" width="12" height="12" shape-rendering="crispEdges" aria-hidden="true"><path [attr.d]="spark" fill="currentColor" /></svg> FRIENDSHIP</button>
    </div>
    <div class="pick">
      <label><span>CHARACTER A</span>
        <select (change)="a.set($any($event.target).value); clear()">
          @for (c of chars(); track c.id) { <option [value]="c.id" [selected]="c.id === a()">{{ c.name || 'UNNAMED' }}</option> }
        </select>
      </label>
      <span class="vs" [class.lit]="!!result()" [style.color]="result()?.tier?.color">
        <svg viewBox="0 0 9 9" width="22" height="22" shape-rendering="crispEdges" aria-hidden="true"><path [attr.d]="mode() === 'relationship' ? heart : spark" fill="currentColor" /></svg>
      </span>
      <label><span>CHARACTER B</span>
        <select (change)="b.set($any($event.target).value); clear()">
          @for (c of chars(); track c.id) { <option [value]="c.id" [selected]="c.id === b()">{{ c.name || 'UNNAMED' }}</option> }
        </select>
      </label>
    </div>
    <button type="button" class="btn accent" (click)="test()">TEST COMPATIBILITY</button>

    @if (result(); as r) {
      <div class="result">
        @if (r.same) {
          <p class="msg">THAT'S THE SAME CHARACTER. COMPATIBILITY WITH YOURSELF IS... COMPLICATED.</p>
        } @else {
          <div class="names">
            <span class="who"><span class="dot" [class.rainbow]="r.aRainbow" [style.background]="r.aRainbow ? null : r.aColor"></span><span [class.rainbow-text]="r.aRainbow" [style.color]="r.aRainbow ? null : r.aColor">{{ r.aName }}</span></span>
            <span class="x">{{ mode() === 'relationship' ? '♥' : '&' }}</span>
            <span class="who"><span class="dot" [class.rainbow]="r.bRainbow" [style.background]="r.bRainbow ? null : r.bColor"></span><span [class.rainbow-text]="r.bRainbow" [style.color]="r.bRainbow ? null : r.bColor">{{ r.bName }}</span></span>
          </div>
          <div class="score" [style.color]="r.tier!.color"><span class="num">{{ shownScore() }}%</span><span class="tier">{{ r.tier!.label }}</span></div>
          <div class="meter"><span [style.width.%]="fillTo()" [style.background]="r.tier!.color"></span></div>
          <p class="msg">{{ r.tier!.msg }}</p>
          <p class="flavor">{{ r.tier!.flavor }}</p>
        }
      </div>
    }
  `,
  styles: `
    .intro { margin: 0 0 20px; font-size: var(--ss-text-sm); letter-spacing: 1px; color: var(--ss-fg-faint); }
    .modes { display: flex; gap: 8px; margin-bottom: 18px; }
    .mode { display: inline-flex; gap: 8px; align-items: center; padding: 8px 12px; font-size: var(--ss-text-xs); letter-spacing: 1px; background: none; border: 1px solid var(--ss-line-dim); color: var(--ss-fg-dim);
      &.rel.on { color: #ff6eb4; border-color: #ff6eb4; background: rgb(255 110 180 / 0.08); }
      &.fr.on { color: #7ed7ff; border-color: #7ed7ff; background: rgb(126 215 255 / 0.08); } }
    .pick { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: end;
      label { display: grid; gap: 6px; font-size: var(--ss-text-xs); letter-spacing: 1px; color: var(--ss-fg-dim); min-width: 0; }
      select { padding: 7px; font-size: var(--ss-text-sm); background: var(--ss-panel); border: 1px solid var(--ss-line-dim); color: var(--ss-fg); min-width: 0; } }
    .vs { color: var(--ss-fg-faint); padding-bottom: 4px; &.lit { animation: beat 0.8s steps(2) infinite; } }
    @keyframes beat { 50% { scale: 1.25; } }
    .btn { margin-top: 18px; min-width: 200px; padding: 10px 14px; font-size: var(--ss-text-xs); letter-spacing: 1px; background: none; border: var(--ss-border) solid var(--ss-accent); color: var(--ss-accent);
      &:hover { background: var(--ss-accent); color: var(--ss-bg); } }
    .result { display: grid; gap: 12px; margin-top: 20px; padding: 18px; border: 2px solid var(--ss-panel-2); background: rgb(0 0 0 / 0.4); box-shadow: 4px 4px 0 #000; }
    .names { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: var(--ss-text-sm); }
    .who { display: inline-flex; gap: 6px; align-items: center; }
    .dot { width: 8px; height: 8px; }
    .x { color: var(--ss-fg-faint); }
    .score { display: flex; gap: 14px; align-items: baseline; .num { font-size: 28px; } .tier { font-size: var(--ss-text-md); letter-spacing: 3px; } }
    .meter { height: 12px; background: var(--ss-panel-2); border: 1px solid var(--ss-line-dim);
      span { display: block; height: 100%; transition: width 1s steps(20); background-image: repeating-linear-gradient(90deg, transparent 0 8px, rgb(0 0 0 / 0.35) 8px 10px); } }
    .msg { margin: 0; font-size: var(--ss-text-sm); letter-spacing: 1px; line-height: 1.8; }
    .flavor { margin: 0; font-size: var(--ss-text-xs); color: var(--ss-fg-faint); }
    .rainbow { animation: rbw-bg 2.5s linear infinite; } .rainbow-text { animation: rbw 2.5s linear infinite; }
    @keyframes rbw { 0%, 100% { color: hsl(0 100% 65%); } 33% { color: hsl(120 100% 65%); } 67% { color: hsl(240 100% 70%); } }
    @keyframes rbw-bg { 0%, 100% { background: hsl(0 100% 65%); } 33% { background: hsl(120 100% 65%); } 67% { background: hsl(240 100% 70%); } }
    @media (max-width: 560px) { .pick { grid-template-columns: 1fr; } .vs { justify-self: center; } }
  `,
})
export class CompatTester {
  private readonly store = inject(CharacterStore);
  protected readonly heart = HEART;
  protected readonly spark = SPARK;

  protected readonly chars = computed(() => this.store.characters().filter(c => !c.isPlaceholder));
  protected readonly mode = signal<Mode>('relationship');
  protected readonly a = signal('');
  protected readonly b = signal('');
  protected readonly result = signal<{
    same: boolean; score: number; tier?: CompatTier; aName?: string; bName?: string; aColor?: string; bColor?: string; aRainbow?: boolean; bRainbow?: boolean;
  } | null>(null);
  protected readonly shownScore = signal(0);
  protected readonly fillTo = signal(0);
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    // A defaults to the first character and B to another, once the list loads
    effect(() => {
      const list = this.chars();
      untracked(() => {
        if (!list.length) return;
        if (!list.some(c => c.id === this.a())) this.a.set(list[0].id);
        if (!list.some(c => c.id === this.b()) || this.b() === this.a()) this.b.set(list.find(c => c.id !== this.a())?.id ?? '');
      });
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected setMode(m: Mode): void { this.mode.set(m); this.clear(); }
  protected clear(): void { this.stop(); this.result.set(null); }

  protected test(): void {
    const idA = this.a(), idB = this.b();
    if (!idA || !idB) return;
    this.stop();
    if (idA === idB) { this.result.set({ same: true, score: 0 }); return; }
    // the old site kept each score in this browser too; it is the same hash either way
    const key = `compat_${[idA, idB].sort().join('::')}_${this.mode()}`;
    let score: number;
    try {
      const saved = localStorage.getItem(key);
      score = saved === null ? compatHash(key) % 101 : parseInt(saved, 10);
      if (saved === null) localStorage.setItem(key, String(score));
    } catch { score = compatHash(key) % 101; }
    const byId = this.store.byId();
    const ca = byId.get(idA), cb = byId.get(idB);
    const tier = TIERS[this.mode()].find(t => score >= t.min) || TIERS[this.mode()].at(-1)!;
    this.result.set({
      same: false, score, tier,
      aName: ca?.name || 'CHARACTER A', bName: cb?.name || 'CHARACTER B', aColor: ca?.color || '#888', bColor: cb?.color || '#888',
      aRainbow: NARA.test(ca?.name || ''), bRainbow: NARA.test(cb?.name || ''),
    });
    // the meter fills and the number counts up
    this.shownScore.set(0);
    this.fillTo.set(0);
    const step = Math.max(1, Math.ceil(score / 40));
    this.timers.push(setTimeout(() => {
      this.fillTo.set(score);
      const tick = () => {
        this.shownScore.update(n => Math.min(n + step, score));
        if (this.shownScore() < score) this.timers.push(setTimeout(tick, 25));
      };
      tick();
    }, 60));
  }

  private stop(): void {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }
}
