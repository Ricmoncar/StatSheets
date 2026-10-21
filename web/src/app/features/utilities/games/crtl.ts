import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CharacterStore } from '../../../core/data/character-store';
import { Character } from '../../../core/data/models';
import { NgTemplateOutlet } from '@angular/common';
import { EntryRows } from './entry-rows';
import { GameDocs, Named, filled, namedList } from './game-docs';
import { GamePicker } from './game-picker';

type Kind = 'pattern' | 'item' | 'passive';
interface CrtlDoc { type: 'entity' | 'class'; speed: number; hp: number; attackPatterns: Named[]; passives: Named[]; items: Named[] }

function normalize(raw: Partial<CrtlDoc> | undefined): CrtlDoc {
  const d = { ...(raw || {}) } as CrtlDoc;
  if (d.type !== 'class' && d.type !== 'entity') d.type = 'entity';
  d.speed = Math.max(1, Math.min(5, Math.round(typeof d.speed === 'number' ? d.speed : 3)));
  d.hp = Math.max(50, Math.min(300, Math.round(typeof d.hp === 'number' ? d.hp : 100)));
  d.attackPatterns = namedList(d.attackPatterns);
  d.passives = namedList(d.passives);
  d.items = namedList(d.items);
  return d;
}
const ENTITY = '#dd4455', CLASS = '#36c98a';

/** CONTROL: an ENTITY (speed, attack patterns) or a CLASS (HP, items), both with passives. */
@Component({
  selector: 'ss-game-crtl',
  imports: [GamePicker, EntryRows, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="desc-line">Your character enters Control. Are they an ENTITY or a CLASS?</p>
    <ss-game-picker [selected]="sel()" [dotFor]="dot" (pick)="select($event)" />
    @if (char(); as c) {
      @let d = doc();
      @let ent = d.type === 'entity';
      @let acc = ent ? entityColor : classColor;
      <div class="work" [style.--nc]="c.color || '#888'">
        @if (mode() === 'view') {
          <article class="card" [style.--nc]="acc">
            <div class="inner">
              <div class="hero">
                <div class="avatar">@if (c.avatar) { <img [src]="c.avatar" alt="" /> } @else { <span class="init">{{ (c.name || '?')[0].toUpperCase() }}</span> }</div>
                <div class="hero-text">
                  <span class="cname" [style.color]="c.color || '#888'">{{ c.name || 'UNNAMED' }}</span>
                  <span class="badge" [style.--sc]="acc">{{ ent ? '⚠ ENTITY' : '◉ CLASS' }}</span>
                  <span class="tag">CONTROL</span>
                </div>
              </div>
              <div class="rule"></div>
              <div class="sections">
                @if (ent) {
                  <div><div class="sec-head" style="--sc:#777">SPEED</div><span class="stars">@for (n of five; track n) { <span [class.on]="n <= d.speed">&#9733;</span> }</span></div>
                } @else {
                  <div><div class="sec-head" style="--sc:#777">HP <b [style.color]="acc">{{ d.hp }}</b></div><div class="hp"><span [style.width.%]="(d.hp - 50) / 250 * 100"></span></div></div>
                }
                @for (blk of ent ? [{ t: 'ATTACK PATTERNS', l: d.attackPatterns, b: '⚔', c: acc }] : [{ t: 'ITEMS', l: d.items, b: '✦', c: acc }]; track blk.t) {
                  <ng-container *ngTemplateOutlet="block; context: { $implicit: blk }" />
                }
                <ng-container *ngTemplateOutlet="block; context: { $implicit: { t: 'PASSIVES', l: d.passives, b: '◆', c: '#8a8a96' } }" />
                @if (!hasAny(d)) { <p class="empty">NO DATA. CLICK EDIT TO ADD.</p> }
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
          <div class="toggle">
            <button type="button" [class.on]="ent" [style.--tc]="entityColor" (click)="set(x => x.type = 'entity')">&#9888; ENTITY</button>
            <button type="button" [class.on]="!ent" [style.--tc]="classColor" (click)="set(x => x.type = 'class')">&#9673; CLASS</button>
          </div>
          @if (ent) {
            <div class="section"><span class="sec-title">SPEED</span>
              <span class="stars edit">@for (n of five; track n) { <button type="button" [class.on]="n <= d.speed" (click)="set(x => x.speed = n)" [attr.aria-label]="'Speed ' + n">&#9733;</button> }</span>
            </div>
            <div class="section"><span class="sec-title">ATTACK PATTERNS</span>
              <ss-entry-rows [items]="d.attackPatterns" namePh="Pattern name..." descPh="How the attack works..." [max]="6" addLabel="PATTERN"
                (edit)="editRow('pattern', $event)" (add)="addRow('pattern')" (remove)="removeRow('pattern', $event)" />
            </div>
          } @else {
            <div class="section"><span class="sec-title">HP <span style="color:#555">(50 - 300)</span></span>
              <span class="hp-row"><input type="range" min="50" max="300" step="5" [value]="d.hp" (input)="set(x => x.hp = +$any($event.target).value)" aria-label="HP" /><b>{{ d.hp }} HP</b></span>
              <div class="hp"><span [style.width.%]="(d.hp - 50) / 250 * 100"></span></div>
            </div>
            <div class="section"><span class="sec-title">ITEMS</span>
              <ss-entry-rows [items]="d.items" namePh="Item name..." descPh="What the item does..." [max]="6" addLabel="ITEM"
                (edit)="editRow('item', $event)" (add)="addRow('item')" (remove)="removeRow('item', $event)" />
            </div>
          }
          <div class="section"><span class="sec-title">PASSIVES</span>
            <ss-entry-rows [items]="d.passives" namePh="Passive name..." descPh="What the passive does..." [max]="6" addLabel="PASSIVE"
              (edit)="editRow('passive', $event)" (add)="addRow('passive')" (remove)="removeRow('passive', $event)" />
          </div>
        }
      </div>
    }
    <ng-template #block let-blk>
      @let shown = filledList(blk.l);
      @if (shown.length) {
        <div [style.--sc]="blk.c">
          <div class="sec-head">{{ blk.t }}</div>
          @for (e of shown; track $index) {
            <div class="entry"><span class="bullet">{{ blk.b }}</span><div class="body">
              @if (e.name) { <span class="ename">{{ e.name }}</span> }
              @if (e.desc) { <span class="etext">{{ e.desc }}</span> }
            </div></div>
          }
        </div>
      }
    </ng-template>
  `,
  styleUrls: ['./game-shared.scss'],
  styles: `
    .badge { justify-self: start; padding: 3px 9px; font-size: var(--fs-ui); color: var(--sc); border: 1px solid var(--sc); }
    .stars { display: flex; gap: 6px; font-size: var(--fs-voice); line-height: 1; color: #2a2a2a;
      .on { color: #ffd24a; text-shadow: 2px 2px 0 #4a3a00; }
      &.edit button { padding: 0; font-size: var(--fs-voice); background: none; border: 0; color: #2a2a2a; &.on { color: #ffd24a; text-shadow: 2px 2px 0 #4a3a00; } } }
    .hp { height: 10px; background: var(--ss-panel-2); border: 1px solid var(--ss-line-dim);
      span { display: block; height: 100%; background: repeating-linear-gradient(90deg, #36c98a 0 6px, #2a9e6c 6px 8px); } }
    .hp-row { display: flex; gap: 12px; align-items: center; input { flex: 1; accent-color: #36c98a; } b { font-weight: normal; font-size: var(--ss-text-sm); color: #36c98a; } }
    .sec-head b { font-weight: normal; }
  `,
})
export class CrtlGame {
  private readonly store = inject(CharacterStore);
  protected readonly docs = new GameDocs<CrtlDoc>('crtl', normalize);
  protected readonly entityColor = ENTITY;
  protected readonly classColor = CLASS;
  protected readonly five = [1, 2, 3, 4, 5];
  protected readonly sel = signal<string | null>(null);
  protected readonly mode = signal<'view' | 'edit'>('view');
  protected readonly char = computed(() => (this.sel() ? this.store.byId().get(this.sel()!) ?? null : null));
  protected readonly doc = computed(() => { this.docs.docs(); return this.sel() ? this.docs.get(this.sel()!) : normalize(undefined); });
  protected readonly filledList = (l: Named[]) => filled(l);
  protected readonly hasAny = (d: CrtlDoc) => filled(d.type === 'entity' ? d.attackPatterns : d.items).length + filled(d.passives).length > 0;
  protected readonly dot = (c: Character) => {
    const raw = this.docs.docs()[c.id];
    if (!raw) return null;
    const d = normalize(raw);
    return filled(d.attackPatterns).length + filled(d.passives).length + filled(d.items).length ? (d.type === 'class' ? CLASS : ENTITY) : null;
  };

  protected select(id: string): void {
    if (this.sel() !== id) this.mode.set('view');
    this.sel.set(id);
  }
  protected set(change: (d: CrtlDoc) => void): void {
    const id = this.sel();
    if (id) this.docs.edit(id, d => { change(d); Object.assign(d, normalize(d)); });
  }
  private list(d: CrtlDoc, k: Kind): Named[] { return k === 'pattern' ? d.attackPatterns : k === 'item' ? d.items : d.passives; }
  protected editRow(k: Kind, e: { i: number; field: string; value: string }): void {
    this.set(d => { const x = this.list(d, k)[e.i]; if (x) (x as unknown as Record<string, string>)[e.field] = e.value; });
  }
  protected addRow(k: Kind): void { this.set(d => { const a = this.list(d, k); if (a.length < 6) a.push({ name: '', desc: '' }); }); }
  protected removeRow(k: Kind, i: number): void {
    this.set(d => { const a = this.list(d, k); a.splice(i, 1); if (!a.length) a.push({ name: '', desc: '' }); });
  }
}
