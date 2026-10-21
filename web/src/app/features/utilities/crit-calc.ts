import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';

const SYMBOLS = ['#', '?', '!', 'X', 'O', '&'];

/** Rolls against a crit chance: a crit is x1.5 to x2.0, times the extra multiplier. */
import { Icon } from '../../ui/icon';

@Component({
  selector: 'ss-crit-calc',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fields">
      <label class="field"><span class="lbl">CRIT CHANCE (%)</span>
        <input type="number" min="0" max="100" [value]="chance()" (input)="chance.set(+$any($event.target).value)" />
      </label>
      <label class="field"><span class="lbl">EXTRA CRIT DMG (MULT)</span>
        <input type="number" min="1" step="0.1" [value]="extra()" (input)="extra.set(+$any($event.target).value)" />
      </label>
    </div>
    <div class="wrap">
      <output class="result" [attr.data-state]="state()" aria-live="polite">{{ shown() }}</output>
      <button type="button" class="btn u-btn primary" (click)="roll()" [disabled]="state() === 'rolling'"><ss-icon name="star" />ROLL CRIT</button>
    </div>
    <p class="detail">{{ detail() }}</p>
  `,
  styles: `
    @use 'underground' as u;
    .fields { display: grid; gap: var(--p4); }
    .field { display: grid; gap: var(--p2); .lbl { @include u.label; } input { width: 100%; @include u.field; } }
    .wrap { display: grid; justify-items: center; gap: var(--p5); padding: var(--p6) 0 var(--p1); }
    // the result in big battle numbers: a hit in white, a CRIT in red that throbs, a miss greyed out
    .result { font: var(--fs-big) / 1 var(--f-body); color: var(--c-white); text-shadow: var(--p1) var(--p1) 0 var(--ac1);
      &[data-state='rolling'] { animation: jitter 0.1s steps(2) infinite; }
      &[data-state='crit'] { color: var(--c-red); text-shadow: var(--p1) var(--p1) 0 var(--c-red-d); animation: pulse 0.8s steps(2) infinite; }
      &[data-state='miss'] { color: var(--t-off); text-shadow: none; } }
    @keyframes jitter { 50% { translate: var(--px) calc(-1 * var(--px)); } }
    @keyframes pulse { 50% { color: var(--c-yel); } }
    .detail { margin: var(--p3) 0 0; min-height: var(--lh-body); text-align: center; font: var(--fs-body) / var(--lh-body) var(--f-body); color: var(--c-mute); }
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
