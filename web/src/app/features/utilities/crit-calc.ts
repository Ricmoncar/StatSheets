import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';

const SYMBOLS = ['#', '?', '!', 'X', 'O', '&'];

/** Rolls against a crit chance: a crit is x1.5 to x2.0, times the extra multiplier. */
@Component({
  selector: 'ss-crit-calc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fields">
      <label class="field"><span>CRIT CHANCE (%)</span>
        <input type="number" min="0" max="100" [value]="chance()" (input)="chance.set(+$any($event.target).value)" />
      </label>
      <label class="field"><span>EXTRA CRIT DMG (MULT)</span>
        <input type="number" min="1" step="0.1" [value]="extra()" (input)="extra.set(+$any($event.target).value)" />
      </label>
    </div>
    <div class="wrap">
      <output class="result" [attr.data-state]="state()" aria-live="polite">{{ shown() }}</output>
      <button type="button" class="btn accent" (click)="roll()" [disabled]="state() === 'rolling'">ROLL CRIT</button>
    </div>
    <p class="detail">{{ detail() }}</p>
  `,
  styles: `
    .fields { display: grid; gap: 12px; }
    .field { display: grid; gap: 6px; font-size: var(--ss-text-xs); letter-spacing: 1px; color: var(--ss-fg-dim);
      input { padding: 8px; font-size: var(--ss-text-sm); background: var(--ss-bg); border: 1px solid var(--ss-line-dim); color: var(--ss-fg); width: 100%; } }
    .wrap { display: grid; justify-items: center; gap: 18px; padding: 24px 0 4px; }
    .result { font-size: 40px; line-height: 1.2; color: var(--ss-accent); text-shadow: 3px 3px 0 rgb(255 0 255 / 0.45), -3px -3px 0 rgb(0 255 255 / 0.45);
      &[data-state='rolling'] { animation: jitter 0.1s steps(2) infinite; }
      &[data-state='crit'] { color: var(--ss-err); text-shadow: 4px 4px 0 #400; animation: pulse 0.8s steps(2) infinite; }
      &[data-state='miss'] { color: var(--ss-fg-faint); text-shadow: none; } }
    @keyframes jitter { 50% { translate: 2px -2px; } }
    @keyframes pulse { 50% { filter: brightness(1.6); } }
    .detail { margin: 10px 0 0; min-height: 1.6em; text-align: center; font-size: var(--ss-text-sm); color: var(--ss-fg-faint); }
    .btn { padding: 10px 14px; font-size: var(--ss-text-xs); letter-spacing: 1px; background: none; border: var(--ss-border) solid var(--ss-accent); color: var(--ss-accent);
      &:hover:not(:disabled) { background: var(--ss-accent); color: var(--ss-bg); } &:disabled { opacity: 0.5; } }
  `,
})
export class CritCalc {
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);

  protected readonly chance = signal(10);
  protected readonly extra = signal(1);
  protected readonly shown = signal('--');
  protected readonly detail = signal('');
  protected readonly state = signal<'idle' | 'rolling' | 'crit' | 'miss'>('idle');
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  protected roll(): void {
    const chance = this.chance() || 0;
    const extra = this.extra() || 1;
    this.sound.play('diceroll', { rate: 1.1 + Math.random() * 0.1, volume: 0.75 });
    this.state.set('rolling');
    this.detail.set('CALCULATING...');
    let ticks = 0;
    this.timer = setInterval(() => {
      this.shown.set(Math.random() > 0.4 ? (1.5 + Math.random() * 0.5).toFixed(2) : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      if (++ticks <= 40) return;
      clearInterval(this.timer);
      if (Math.random() * 100 <= chance) {
        const base = 1.5 + Math.random() * 0.5;
        this.shown.set('CRIT!');
        this.state.set('crit');
        this.detail.set(`Base: x${base.toFixed(2)} | Extra: x${extra} | FINAL: x${(base * extra).toFixed(2)}`);
        this.sound.play('max', { rate: 1.15, volume: 0.8 });
        this.notifier.notify('CRITICAL HIT!', 'err');
      } else {
        this.shown.set('MISS');
        this.state.set('miss');
        this.detail.set('Normal Damage (x1.00)');
        this.sound.play('minimum', { rate: 0.9, volume: 0.65 });
      }
    }, 50);
  }
}
