import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CharacterStore } from '../../../core/data/character-store';
import { Character } from '../../../core/data/models';
import { PatternCanvas } from '../../../ui/pattern-canvas';
import { EntryRows } from './entry-rows';
import { GameDocs, filled } from './game-docs';
import { GamePicker } from './game-picker';

interface Ability { name: string; text: string }
interface Page { passives: Ability[]; actives: Ability[] }
interface NmtDoc { pages: Page[] }

const blank = (): Ability[] => [{ name: '', text: '' }];
const coerce = (a: unknown): Ability[] =>
  Array.isArray(a) && a.length ? a.map(e => (e && typeof e === 'object' ? e : { name: '', text: e || '' })) as Ability[] : blank();
function normalize(raw: Partial<NmtDoc> | undefined): NmtDoc {
  const pages = Array.isArray(raw?.pages) && raw!.pages.length ? raw!.pages : [{ passives: blank(), actives: blank() }];
  return { ...raw, pages: pages.map(p => ({ ...p, passives: coerce(p?.passives), actives: coerce(p?.actives) })) };
}
const hasAny = (p: Page) => [...p.passives, ...p.actives].some(e => (e.name || e.text || '').trim());

/** NO MORE TIME: passive and active kits, in as many loadouts as you like. */
@Component({
  selector: 'ss-game-nmt',
  imports: [GamePicker, PatternCanvas, EntryRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="desc-line">What if your character was in No More Time? Design their passive &amp; active kit.</p>
    <ss-game-picker [selected]="sel()" [dotFor]="dot" (pick)="select($event)" />
    @if (char(); as c) {
      @let d = doc();
      @let pg = d.pages[Math.min(page(), d.pages.length - 1)];
      <div class="work" [style.--nc]="c.color || '#888'">
        @if (mode() === 'view') {
          <article class="card">
            <ss-pattern-canvas [type]="c.pattern?.type" [params]="c.pattern?.params" />
            <div class="inner">
              <div class="hero">
                <div class="avatar">@if (c.avatar) { <img [src]="c.avatar" alt="" /> } @else { <span class="init">{{ (c.name || '?')[0].toUpperCase() }}</span> }</div>
                <div class="hero-text"><span class="cname">{{ c.name || 'UNNAMED' }}</span><span class="tag" style="color:#9b5cf0">NO MORE TIME</span></div>
              </div>
              <div class="rule"></div>
              <div class="sections">
                @for (blk of [{ k: 'passive', label: 'PASSIVE', list: pg.passives, color: '#00ccbb', bullet: '◆' }, { k: 'active', label: 'ACTIVE', list: pg.actives, color: '#ffaa44', bullet: '⚡' }]; track blk.k) {
                  @let shown = filledList(blk.list);
                  @if (shown.length) {
                    <div [style.--sc]="blk.color">
                      <div class="sec-head">{{ blk.label }}</div>
                      @for (e of shown; track $index) {
                        <div class="entry"><span class="bullet">{{ blk.bullet }}</span><div class="body">
                          @if (e.name) { <span class="ename">{{ e.name }}</span> }
                          @if (e.text) { <span class="etext">{{ e.text }}</span> }
                        </div></div>
                      }
                    </div>
                  }
                }
                @if (!anyIn(pg)) { <p class="empty">NO DATA. CLICK EDIT TO ADD.</p> }
              </div>
              <div class="footer">
                <span class="pager">
                  <button type="button" class="btn" (click)="step(-1)" [disabled]="page() === 0" aria-label="Previous loadout">&#9664;</button>
                  LOADOUT {{ page() + 1 }} / {{ d.pages.length }}
                  <button type="button" class="btn" (click)="step(1)" [disabled]="page() >= d.pages.length - 1" aria-label="Next loadout">&#9654;</button>
                </span>
                <button type="button" class="btn" (click)="mode.set('edit')">EDIT</button>
              </div>
            </div>
          </article>
        } @else {
          <div class="ed-head">
            <span class="ed-av">@if (c.avatar) { <img [src]="c.avatar" alt="" /> } @else { <span class="init">{{ (c.name || '?')[0] }}</span> }</span>
            <span class="ed-name">{{ c.name || 'UNNAMED' }}</span>
            <span class="status" [attr.data-s]="docs.state()">{{ docs.state() === 'saving' ? 'SAVING...' : docs.state() === 'saved' ? '✓ SAVED' : '' }}</span>
            <button type="button" class="btn accent" (click)="mode.set('view')">VIEW</button>
          </div>
          <div class="pager" style="margin-bottom:16px;flex-wrap:wrap">
            <button type="button" class="btn" (click)="step(-1)" [disabled]="page() === 0" aria-label="Previous loadout">&#9664;</button>
            LOADOUT {{ page() + 1 }} / {{ d.pages.length }}
            <button type="button" class="btn" (click)="step(1)" [disabled]="page() >= d.pages.length - 1" aria-label="Next loadout">&#9654;</button>
            <button type="button" class="btn" (click)="addPage()">+ LOADOUT</button>
            @if (d.pages.length > 1) { <button type="button" class="btn danger" (click)="deletePage()">&#10005; LOADOUT</button> }
          </div>
          @for (k of kinds; track k) {
            @let list = k === 'passive' ? pg.passives : pg.actives;
            <div class="section">
              <span class="sec-title">{{ k.toUpperCase() }}{{ list.length !== 1 ? 'S' : '' }}</span>
              <ss-entry-rows [items]="list" descKey="text" [namePh]="k === 'passive' ? 'Passive name...' : 'Active name...'" [addLabel]="k.toUpperCase()"
                (edit)="editRow(k, $event.i, $event.field, $event.value)" (add)="addRow(k)" (remove)="removeRow(k, $event)" />
            </div>
          }
        }
      </div>
    }
  `,
  styleUrl: './game-shared.scss',
})
export class NmtGame {
  private readonly store = inject(CharacterStore);
  protected readonly docs = new GameDocs<NmtDoc>('nmt', normalize);
  protected readonly kinds = ['passive', 'active'] as const;
  protected readonly sel = signal<string | null>(null);
  protected readonly mode = signal<'view' | 'edit'>('view');
  protected readonly page = signal(0);
  protected readonly char = computed(() => (this.sel() ? this.store.byId().get(this.sel()!) ?? null : null));
  protected readonly doc = computed(() => { this.docs.docs(); return this.sel() ? this.docs.get(this.sel()!) : normalize(undefined); });
  protected readonly Math = Math;
  protected readonly filledList = (l: Ability[]) => filled(l, 'text');
  protected readonly anyIn = hasAny;
  protected readonly dot = (c: Character) => {
    const d = this.docs.docs()[c.id];
    return d && Array.isArray(d.pages) && normalize(d).pages.some(hasAny) ? c.color || '#888' : null;
  };

  protected select(id: string): void {
    if (this.sel() !== id) { this.page.set(0); this.mode.set('view'); }
    this.sel.set(id);
  }
  protected step(dir: number): void {
    this.page.set(Math.max(0, Math.min(this.doc().pages.length - 1, this.page() + dir)));
  }
  private edit(change: (pg: Page, d: NmtDoc) => void): void {
    const id = this.sel();
    if (id) this.docs.edit(id, d => change(d.pages[Math.min(this.page(), d.pages.length - 1)], d));
  }
  protected editRow(k: 'passive' | 'active', i: number, field: string, value: string): void {
    this.edit(pg => { const e = (k === 'passive' ? pg.passives : pg.actives)[i]; if (e) (e as unknown as Record<string, string>)[field] = value; });
  }
  protected addRow(k: 'passive' | 'active'): void { this.edit(pg => (k === 'passive' ? pg.passives : pg.actives).push({ name: '', text: '' })); }
  protected removeRow(k: 'passive' | 'active', i: number): void {
    this.edit(pg => { const a = k === 'passive' ? pg.passives : pg.actives; if (a.length <= 1) a[0] = { name: '', text: '' }; else a.splice(i, 1); });
  }
  protected addPage(): void {
    this.edit((_, d) => { d.pages.push({ passives: blank(), actives: blank() }); });
    this.page.set(this.doc().pages.length - 1);
  }
  protected deletePage(): void {
    const at = this.page();
    this.edit((_, d) => { if (d.pages.length > 1) d.pages.splice(at, 1); });
    this.page.set(Math.min(at, this.doc().pages.length - 1));
  }
}
