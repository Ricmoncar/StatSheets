import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { adjustStacks, codexSections, cultivationPreview, cultivationRows, historyDate, setStacks } from '../../core/game/codex';
import { readFortune } from '../../core/game/roll';
import { SeenTraits } from '../../core/game/seen-traits.service';
import { Modal } from '../../ui/modal';
import { RichDesc } from '../../ui/rich-desc';

/** TRAIT CODEX: every rarity, how many of its traits this browser has seen, and the seen ones by role. */
@Component({
  selector: 'ss-codex-modal',
  imports: [Modal, RichDesc],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-modal title="TRAIT CODEX" width="900px" (closed)="closed.emit()">
      @for (s of sections(); track s.rarity) {
        <section class="sec" [attr.data-rarity]="s.rarity">
          <header class="sec-head">
            @if (s.rarity === 'duality') {
              <span class="tag split">HEAVENLY / HELLFORGED ({{ s.seen }}/{{ s.total }})</span>
            } @else {
              <span class="tag">{{ s.label }} ({{ s.seen }}/{{ s.total }})</span>
            }
            <span class="chance">{{ s.chance }}% chance</span>
          </header>
          @for (g of s.groups; track g.role) {
            @if (g.label) { <span class="role">{{ g.label }}</span> }
            <div class="entries">
              @for (t of g.traits; track t.key) {
                @if (s.rarity === 'duality') {
                  <div class="entry duality">
                    <div class="side heaven"><span class="side-label">HEAVENLY</span><span class="name">{{ t.def['heavenly']?.name || t.def.name }}</span><span class="desc"><ss-rich-desc [text]="t.def['heavenly']?.desc || t.def.desc" /></span></div>
                    <span class="yy" aria-hidden="true">&#9775;</span>
                    <div class="side hell"><span class="side-label">HELLFORGED</span><span class="name">{{ t.def['hellforged']?.name || t.def.name }}</span><span class="desc"><ss-rich-desc [text]="t.def['hellforged']?.desc || t.def.desc" /></span></div>
                  </div>
                } @else if (s.rarity === 'determined') {
                  <div class="entry">
                    <span class="name">{{ t.def.name }}</span>
                    <span class="desc"><ss-rich-desc [text]="t.def.desc" /></span>
                    <span class="paths"><span>10 KILLS &rarr; <b class="hatred">HATRED</b></span><span>10 SPARES &rarr; <b class="mercy">MERCYFUL</b></span></span>
                  </div>
                } @else {
                  <div class="entry" data-sfx-hover>
                    <span class="name">{{ t.def.name }}</span>
                    <span class="desc"><ss-rich-desc [text]="t.def.desc" /></span>
                  </div>
                }
              }
            </div>
          } @empty {
            <p class="none u-empty">NOTHING UNLOCKED YET</p>
          }
        </section>
      }
    </ss-modal>
  `,
  styleUrl: './trait-modals.scss',
})
export class CodexModal {
  private readonly seen = inject(SeenTraits);
  readonly closed = output<void>();
  protected readonly sections = computed(() => codexSections(this.seen.seen(), readFortune(safeStorage()).level));
}

/** SCALING: stack counters for each cultivation trait the form on screen has, with the stat delta they give. */
@Component({
  selector: 'ss-cultivation-modal',
  imports: [Modal, RichDesc, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-modal title="CULTIVATION" width="720px" (closed)="closed.emit()">
      @for (r of rows(); track r.key) {
        <section class="cult" [attr.data-rarity]="r.rarity" data-sfx-hover>
          <header class="sec-head"><span class="tag">{{ r.rarity.toUpperCase() }}</span><span class="name">{{ r.def.name }}</span></header>
          <span class="desc"><ss-rich-desc [text]="r.def.desc" [name]="character().name" /></span>
          <span class="stack-label">{{ r.label }}</span>
          <div class="counter">
            <button type="button" class="mini u-btn sm" (click)="adjust(r.key, -10)">--</button>
            <button type="button" class="mini u-btn sm" (click)="adjust(r.key, -1)">-</button>
            <input type="number" min="0" [max]="r.max" [value]="r.stacks" (input)="set(r.key, $any($event.target).value)" [attr.aria-label]="r.label" />
            <button type="button" class="mini u-btn sm" (click)="adjust(r.key, 1)">+</button>
            <button type="button" class="mini u-btn sm" (click)="adjust(r.key, 10)">++</button>
          </div>
          <input type="range" min="0" [max]="r.max" [value]="r.stacks" (input)="set(r.key, $any($event.target).value)" [attr.aria-label]="r.label + ' slider'" />
          <div class="preview">
            <span class="ptitle">SCALED STAT DELTA</span>
            @for (p of preview(r.key); track p.label) {
              <span class="prow"><span>{{ p.label }}</span><span [class.pos]="p.diff > 0" [class.neg]="p.diff <= 0">{{ p.diff > 0 ? '+' : '' }}{{ p.diff | number: (p.pct ? '1.1-1' : '1.0-0') }}{{ p.pct ? '%' : '' }}</span></span>
            } @empty { <span class="prow"><span>-</span><span>-</span></span> }
          </div>
        </section>
      }
    </ss-modal>
  `,
  styleUrl: './trait-modals.scss',
})
export class CultivationModal implements OnDestroy {
  private readonly store = inject(CharacterStore);
  readonly character = input.required<Character>();
  readonly closed = output<void>();
  protected readonly rows = computed(() => cultivationRows(this.character()));
  protected readonly preview = (key: string) => cultivationPreview(this.character(), key);

  // A slider drag fires dozens of times a second and each save is a database
  // write (Starry reached 2,708 revisions that way): the screen follows every
  // tick, the save happens once, 400 ms after the last one.
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Record<string, unknown> = {};

  protected adjust(key: string, delta: number): void {
    this.flush();
    void this.store.update(this.character().id, c => adjustStacks(c, key, delta));
  }

  protected set(key: string, val: unknown): void {
    this.pending[key] = val;
    this.store.patchLocal(this.character().id, c => setStacks(c, key, val));
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }

  private flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const vals = this.pending;
    this.pending = {};
    if (!Object.keys(vals).length) return;
    void this.store.update(this.character().id, c => { for (const [k, v] of Object.entries(vals)) setStacks(c, k, v); });
  }

  ngOnDestroy(): void { this.flush(); }
}

/** ROLL HISTORY: the last 50 traits taken, newest first. */
@Component({
  selector: 'ss-roll-history-modal',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-modal title="ROLL HISTORY" width="520px" (closed)="closed.emit()">
      @for (h of history(); track $index) {
        <div class="hist" [attr.data-rarity]="h.rarity">
          <span class="hr">{{ (h.rarity || '').toUpperCase() }}</span>
          <span class="hn">{{ h.name }}</span>
          <span class="hd">{{ date(h.ts) }}</span>
        </div>
      } @empty {
        <p class="none u-empty">NO ROLLS YET</p>
      }
    </ss-modal>
  `,
  styleUrl: './trait-modals.scss',
})
export class RollHistoryModal {
  readonly character = input.required<Character>();
  readonly closed = output<void>();
  protected readonly history = computed(() => this.character().traitHistory || []);
  protected readonly date = historyDate;
}

function safeStorage(): Storage | null {
  try { return localStorage; } catch { return null; }
}
