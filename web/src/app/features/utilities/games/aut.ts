import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CharacterStore } from '../../../core/data/character-store';
import { Character } from '../../../core/data/models';
import { PatternCanvas } from '../../../ui/pattern-canvas';
import { GameDocs } from './game-docs';
import { GamePicker } from './game-picker';

interface Move { name: string; input: string; desc: string }
interface AutDoc { standName: string; tier: string; playstyle: string; stats: Record<string, number>; moves: Move[] }

const TIERS = ['S', 'A', 'B', 'C', 'D'];
const TIER_COLORS: Record<string, string> = { S: '#f5c518', A: '#4499ff', B: '#44dd88', C: '#ffaa33', D: '#888888' };
const PLAYSTYLES: Record<string, string> = { rushdown: 'RUSHDOWN', zoner: 'ZONER', defensive: 'DEFENSIVE', technical: 'TECHNICAL', balanced: 'BALANCED' };
const STATS = [['damage', 'DAMAGE'], ['speed', 'SPEED'], ['range', 'RANGE'], ['combo', 'COMBO']] as const;

function normalize(raw: Partial<AutDoc> | undefined): AutDoc {
  const d = { ...(raw || {}) } as AutDoc;
  d.standName = d.standName || '';
  d.tier = d.tier || 'B';
  d.playstyle = d.playstyle || 'balanced';
  d.stats = d.stats || { damage: 5, speed: 5, range: 5, combo: 5 };
  d.moves = Array.isArray(d.moves) && d.moves.length
    ? d.moves.map(m => (m && typeof m === 'object' ? m : { name: '', input: '', desc: (m as unknown as string) || '' }))
    : [{ name: '', input: '', desc: '' }];
  return d;
}

/** AUT (Beyond Limits): a stand, a tier, a playstyle, four stats and a moveset. */
@Component({
  selector: 'ss-game-aut',
  imports: [GamePicker, PatternCanvas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="desc-line">Your character enters the arena. Set their stand, build out their moveset, and earn their tier.</p>
    <ss-game-picker [selected]="sel()" [dotFor]="dot" (pick)="select($event)" />
    @if (char(); as c) {
      @let d = doc();
      <div class="work" [style.--nc]="c.color || '#888'">
        @if (mode() === 'view') {
          <article class="card">
            <ss-pattern-canvas [type]="c.pattern?.type" [params]="c.pattern?.params" />
            <div class="inner">
              <div class="hero">
                <div class="avatar">@if (c.avatar) { <img [src]="c.avatar" alt="" /> } @else { <span class="init">{{ (c.name || '?')[0].toUpperCase() }}</span> }</div>
                <div class="hero-text">
                  <span class="cname">{{ c.name || 'UNNAMED' }}</span>
                  @if (d.standName) { <span class="stand">{{ d.standName }}</span> }
                  <span class="tag" style="color:#e0961a">{{ playstyles[d.playstyle] || 'BALANCED' }}</span>
                </div>
                <span class="tier" [style.--t]="tierColors[d.tier] || '#44cc88'">{{ d.tier || 'B' }}</span>
              </div>
              <div class="rule"></div>
              <div class="sections">
                <div class="stats">
                  @for (s of stats; track s[0]) {
                    @let v = statOf(d, s[0]);
                    <span class="slabel">{{ s[1] }}</span>
                    <span class="track"><span [style.width.%]="v * 10"></span></span>
                    <span class="sval">{{ v }}</span>
                  }
                </div>
                <div>
                  <div class="sec-head" style="--sc:var(--nc)">MOVESET</div>
                  @for (m of shownMoves(d); track $index; let i = $index) {
                    <div class="entry" style="--sc:var(--nc)"><span class="input">{{ m.input || 'M' + (i + 1) }}</span><div class="body">
                      @if (m.name) { <span class="ename">{{ m.name }}</span> }
                      @if (m.desc) { <span class="etext">{{ m.desc }}</span> }
                    </div></div>
                  } @empty { <p class="empty">NO MOVES SET. CLICK EDIT.</p> }
                </div>
              </div>
              <div class="footer"><span></span><button type="button" class="btn" (click)="mode.set('edit')">EDIT</button></div>
            </div>
          </article>
        } @else {
          <div class="ed-head">
            <span class="ed-av">@if (c.avatar) { <img [src]="c.avatar" alt="" /> } @else { <span class="init">{{ (c.name || '?')[0] }}</span> }</span>
            <span class="ed-name">{{ c.name || 'UNNAMED' }}</span>
            <span class="status" [attr.data-s]="docs.state()">{{ docs.state() === 'saving' ? 'SAVING...' : docs.state() === 'saved' ? '✓ SAVED' : '' }}</span>
            <button type="button" class="btn accent" (click)="mode.set('view')">VIEW</button>
          </div>
          <div class="section"><span class="sec-title">STAND / SPEC NAME</span>
            <input class="text-in" type="text" maxlength="60" placeholder="e.g. Star Platinum, Sharpshooter..." [value]="d.standName" (input)="set(x => x.standName = $any($event.target).value)" />
          </div>
          <div class="section"><span class="sec-title">TIER</span>
            <div class="chips">@for (t of tiers; track t) { <button type="button" [class.on]="d.tier === t" [style.--tc]="tierColors[t]" (click)="set(x => x.tier = t)">{{ t }}</button> }</div>
          </div>
          <div class="section"><span class="sec-title">PLAYSTYLE</span>
            <div class="chips">@for (p of playstyleKeys; track p) { <button type="button" [class.on]="d.playstyle === p" (click)="set(x => x.playstyle = p)">{{ playstyles[p] }}</button> }</div>
          </div>
          <div class="section"><span class="sec-title">STATS</span>
            @for (s of stats; track s[0]) {
              <label class="slider"><span>{{ s[1] }}</span><input type="range" min="1" max="10" [value]="statOf(d, s[0])" (input)="setStat(s[0], +$any($event.target).value)" /><b>{{ statOf(d, s[0]) }}</b></label>
            }
          </div>
          <div class="section"><span class="sec-title">MOVESET</span>
            @for (m of d.moves; track $index; let i = $index) {
              <div class="move">
                <div class="mfields">
                  <span class="mtop">
                    <input class="text-in in" type="text" maxlength="8" placeholder="Input" [value]="m.input || ''" (input)="editMove(i, 'input', $any($event.target).value)" />
                    <input class="text-in" type="text" maxlength="60" placeholder="Move name..." [value]="m.name || ''" (input)="editMove(i, 'name', $any($event.target).value)" />
                  </span>
                  <textarea class="text-in" rows="2" placeholder="Description..." [value]="m.desc || ''" (input)="editMove(i, 'desc', $any($event.target).value)"></textarea>
                </div>
                <button type="button" class="btn danger" (click)="removeMove(i)" aria-label="Remove move">&#10005;</button>
              </div>
            }
            <button type="button" class="btn" style="justify-self:start" (click)="addMove()">+ MOVE</button>
          </div>
        }
      </div>
    }
  `,
  styleUrls: ['./game-shared.scss'],
  styles: `
    .stand { font-size: var(--ss-text-sm); color: rgb(255 255 255 / 0.6); }
    .tier { --t: #44cc88; width: 54px; height: 54px; flex: none; display: grid; place-items: center; font-size: 24px; color: var(--t); border: 3px solid var(--t); background: color-mix(in srgb, var(--t) 10%, transparent); box-shadow: 4px 4px 0 #000; text-shadow: 3px 3px 0 #000; }
    .stats { display: grid; grid-template-columns: 9ch 1fr 3ch; gap: 8px 12px; align-items: center; }
    .slabel { font-size: var(--fs-ui); color: var(--ss-fg-faint); }
    .track { height: 8px; background: var(--ss-panel-2); span { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--nc) 0 9%, transparent 9% 10%); transition: width 0.6s steps(10); } }
    .sval { font-size: var(--ss-text-sm); text-align: right; color: var(--ss-fg-dim); }
    .input { flex: none; min-width: 34px; padding: 3px 6px; font-size: var(--fs-ui); text-align: center; color: var(--sc); border: 1px solid var(--sc); background: color-mix(in srgb, var(--sc) 10%, transparent); }
    .slider { display: grid; grid-template-columns: 9ch 1fr 3ch; gap: 10px; align-items: center; font-size: var(--fs-ui); color: var(--ss-fg-faint);
      input { accent-color: var(--nc); } b { font-weight: normal; font-size: var(--ss-text-sm); text-align: right; color: var(--ss-fg-dim); } }
    .move { display: flex; gap: 8px; align-items: flex-start; }
    .mfields { flex: 1; min-width: 0; display: grid; gap: 4px; }
    .mtop { display: flex; gap: 4px; .in { width: 74px; flex: none; } }
  `,
})
export class AutGame {
  private readonly store = inject(CharacterStore);
  protected readonly docs = new GameDocs<AutDoc>('beyondLimits', normalize);
  protected readonly tiers = TIERS;
  protected readonly tierColors = TIER_COLORS;
  protected readonly playstyles = PLAYSTYLES;
  protected readonly playstyleKeys = Object.keys(PLAYSTYLES);
  protected readonly stats = STATS;
  protected readonly sel = signal<string | null>(null);
  protected readonly mode = signal<'view' | 'edit'>('view');
  protected readonly char = computed(() => (this.sel() ? this.store.byId().get(this.sel()!) ?? null : null));
  protected readonly doc = computed(() => { this.docs.docs(); return this.sel() ? this.docs.get(this.sel()!) : normalize(undefined); });
  protected readonly statOf = (d: AutDoc, k: string) => Math.max(1, Math.min(10, +d.stats[k] || 5));
  protected readonly shownMoves = (d: AutDoc) => d.moves.filter(m => m.name || m.desc);
  protected readonly dot = (c: Character) => {
    const d = this.docs.docs()[c.id];
    return d && (d.standName || (d.moves || []).some(m => m && (m.name || m.desc))) ? c.color || '#888' : null;
  };

  protected select(id: string): void {
    if (this.sel() !== id) this.mode.set('view');
    this.sel.set(id);
  }
  protected set(change: (d: AutDoc) => void): void {
    const id = this.sel();
    if (id) this.docs.edit(id, change);
  }
  protected setStat(k: string, v: number): void { this.set(d => { d.stats = { ...d.stats, [k]: v }; }); }
  protected editMove(i: number, field: keyof Move, v: string): void { this.set(d => { if (d.moves[i]) d.moves[i][field] = v; }); }
  protected addMove(): void { this.set(d => d.moves.push({ name: '', input: '', desc: '' })); }
  protected removeMove(i: number): void {
    this.set(d => { if (d.moves.length <= 1) d.moves[0] = { name: '', input: '', desc: '' }; else d.moves.splice(i, 1); });
  }
}
