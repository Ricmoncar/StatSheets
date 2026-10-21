import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { formatGold, transactGold } from '../../core/game/sheet';
import { Modal } from '../../ui/modal';
import { Icon } from '../../ui/icon';

/** The treasury: balance, add or remove gold with a note, and the history (latest 200). */
@Component({
  selector: 'ss-gold-modal',
  imports: [Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-modal title="TREASURY" width="560px" (closed)="closed.emit()">
      <div class="balance">
        <span class="label">BALANCE</span>
        <span class="amount" [class.neg]="(character().gold || 0) < 0"><i class="u-spr s-coin u-anim" style="--sc: 2" aria-hidden="true"></i>{{ fmt(character().gold || 0) }}<small>G</small></span>
      </div>
      <div class="controls">
        <label class="field">
          <span class="lbl">AMOUNT</span>
          <input type="number" min="0" step="1" placeholder="0" [value]="amount()" (input)="amount.set($any($event.target).value)" (keydown.enter)="go(1)" />
        </label>
        <label class="field">
          <span class="lbl">NOTE (OPTIONAL)</span>
          <input type="text" maxlength="80" placeholder="e.g. Bought a sword" [value]="note()" (input)="note.set($any($event.target).value)" />
        </label>
        <div class="buttons">
          <button type="button" class="btn ok u-btn primary" (click)="go(1)"><ss-icon name="plus" />ADD</button>
          <button type="button" class="btn danger u-btn danger" (click)="go(-1)"><ss-icon name="minus" />REMOVE</button>
        </div>
      </div>
      <div class="history">
        @for (tx of history(); track tx.ts + ':' + $index) {
          <div class="tx" [class.neg]="tx.amount < 0" data-sfx-hover>
            <i class="u-spr ti" [class.s-coin-s]="tx.amount >= 0" [class.s-heart7]="tx.amount < 0" aria-hidden="true"></i>
            <span class="tx-note">{{ tx.note || (tx.amount >= 0 ? 'Gold added' : 'Gold removed') }}</span>
            <span class="tx-when">{{ when(tx.ts) }}</span>
            <span class="tx-amount">{{ tx.amount >= 0 ? '+' : '-' }}{{ fmt(tx.amount) }} G<small>{{ fmt(tx.balance) }} G</small></span>
          </div>
        } @empty {
          <div class="none u-empty"><i class="u-spr s-coin u-anim" aria-hidden="true"></i>NO TRANSACTIONS YET</div>
        }
      </div>
    </ss-modal>
  `,
  styles: `
    @use 'underground' as u;
    .balance { display: grid; gap: var(--p2); justify-items: center; padding-bottom: var(--p5); }
    .label, .lbl { @include u.label; }
    .label { color: var(--c-mute); }
    .amount { display: inline-flex; align-items: center; gap: var(--p3); font: var(--fs-big) / 1 var(--f-body); color: var(--c-yel); text-shadow: var(--p1) var(--p1) 0 var(--c-gd);
      small { font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-em3); text-shadow: none; }
      &.neg { color: var(--c-red); text-shadow: var(--p1) var(--p1) 0 var(--c-red-d); } }
    .controls { display: grid; gap: var(--p4); padding-bottom: var(--p5); background: var(--t-rule) 0 100% / calc(8 * var(--px)) var(--px) repeat-x; }
    .field { display: grid; gap: var(--p2); }
    input { @include u.field; }
    .buttons { display: flex; gap: var(--p3); .u-btn { flex: 1; } }
    .history { display: grid; padding-top: var(--p3); max-height: 40vh; overflow-y: auto; }
    .tx { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0 var(--p3); align-items: center; padding: var(--p2) 0; border-bottom: var(--px) dashed var(--c-ink3); }
    .ti { grid-row: 1 / 3; }
    .tx-note { grid-column: 2; font: var(--fs-body) / 1.2 var(--f-body); color: var(--c-bone); overflow-wrap: anywhere; }
    .tx-when { grid-column: 2; font: var(--fs-ui) / 20px var(--f-ui); color: var(--c-mute); }
    .tx-amount { grid-row: 1 / 3; grid-column: 3; text-align: right; font: var(--fs-num) / 1 var(--f-body); color: var(--good); white-space: nowrap;
      small { display: block; font: var(--fs-small) / 20px var(--f-body); color: var(--c-mute); } }
    .tx.neg .tx-amount { color: var(--bad); }
  `,
})
export class GoldModal {
  private readonly store = inject(CharacterStore);
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);

  readonly character = input.required<Character>();
  readonly closed = output<void>();
  protected readonly amount = signal('');
  protected readonly note = signal('');
  protected readonly history = computed(() => this.character().goldHistory || []);
  protected readonly fmt = formatGold;

  protected go(direction: 1 | -1): void {
    const r = transactGold(this.character(), direction, this.amount(), this.note(), Date.now());
    if ('error' in r) { this.notifier.notify(r.error, 'err'); return; }
    void this.store.update(this.character().id, c => { c.gold = r.gold; c.goldHistory = r.goldHistory; });
    this.sound.play('save', { rate: direction > 0 ? 1.1 : 0.9, volume: 0.8 });
    this.amount.set('');
    this.note.set('');
  }

  protected when(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' '
      + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
}
