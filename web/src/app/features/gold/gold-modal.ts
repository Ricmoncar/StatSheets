import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { formatGold, transactGold } from '../../core/game/sheet';
import { Modal } from '../../ui/modal';

/** The treasury: balance, add or remove gold with a note, and the history (latest 200). */
@Component({
  selector: 'ss-gold-modal',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-modal title="TREASURY" width="520px" (closed)="closed.emit()">
      <div class="balance">
        <span class="label">BALANCE</span>
        <span class="amount" [class.neg]="(character().gold || 0) < 0">{{ fmt(character().gold || 0) }} G</span>
      </div>
      <div class="controls">
        <label class="field">
          <span>AMOUNT</span>
          <input type="number" min="0" step="1" placeholder="0" [value]="amount()" (input)="amount.set($any($event.target).value)" (keydown.enter)="go(1)" />
        </label>
        <label class="field">
          <span>NOTE (OPTIONAL)</span>
          <input type="text" maxlength="80" placeholder="e.g. Bought a sword" [value]="note()" (input)="note.set($any($event.target).value)" />
        </label>
        <div class="buttons">
          <button type="button" class="btn ok" (click)="go(1)">+ ADD</button>
          <button type="button" class="btn danger" (click)="go(-1)">- REMOVE</button>
        </div>
      </div>
      <div class="history">
        @for (tx of history(); track tx.ts + ':' + $index) {
          <div class="tx" [class.neg]="tx.amount < 0" data-sfx-hover>
            <span class="tx-amount">{{ tx.amount >= 0 ? '+' : '-' }}{{ fmt(tx.amount) }} G</span>
            <span class="tx-note">{{ tx.note }}</span>
            <span class="tx-meta">{{ when(tx.ts) }}<br />{{ fmt(tx.balance) }} G bal.</span>
          </div>
        } @empty {
          <p class="none">NO TRANSACTIONS YET</p>
        }
      </div>
    </ss-modal>
  `,
  styles: `
    .balance { display: grid; gap: 6px; justify-items: center; padding-bottom: 16px; }
    .label { font-size: var(--ss-text-xs); color: var(--ss-fg-dim); }
    .amount { font-size: var(--ss-text-xl); color: var(--ss-gold); &.neg { color: var(--ss-err); } }
    .controls { display: grid; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--ss-line-dim); }
    .field { display: grid; gap: 6px; font-size: var(--ss-text-xs); color: var(--ss-fg-dim); }
    input { background: var(--ss-panel); border: 1px solid var(--ss-line-dim); padding: 8px; font-size: var(--ss-text-sm); color: var(--ss-fg); }
    .buttons { display: flex; gap: 8px; }
    .btn { flex: 1; padding: 10px; background: none; font-size: var(--ss-text-sm); border: var(--ss-border) solid; &.ok { color: var(--ss-ok); } &.danger { color: var(--ss-err); } }
    .history { display: grid; gap: 8px; padding-top: 16px; max-height: 40vh; overflow-y: auto; }
    .tx { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; font-size: var(--ss-text-xs); padding: 8px; border: 1px solid var(--ss-panel-2); }
    .tx-amount { color: var(--ss-ok); }
    .tx.neg .tx-amount { color: var(--ss-err); }
    .tx-note { color: var(--ss-fg); overflow-wrap: anywhere; }
    .tx-meta { color: var(--ss-fg-faint); text-align: right; font-size: var(--fs-ui); line-height: 1.8; }
    .none { text-align: center; color: var(--ss-fg-faint); font-size: var(--ss-text-sm); }
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
