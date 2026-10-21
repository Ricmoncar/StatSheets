import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';

type Tier = 'low' | 'mid' | 'high' | 'max';
const DURATION = 2200;   // ms of tumbling
const FAST = 45, SLOW = 380;   // the scramble's gap between face changes, start to end

/**
 * The dice roller: a die of any number of sides tumbles centre screen while
 * its faces scramble (fast, then easing off), then lands coloured by how
 * good the roll was. Click anywhere to put it back.
 */
@Component({
  selector: 'ss-dice-roller',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="field"><span>SIDES</span>
      <input type="number" min="2" max="999" [value]="sides()" (input)="sides.set(+$any($event.target).value)" />
    </label>
    <div class="wrap">
      <div class="stage" [class.cinematic]="cinematic()">
        <div class="cube" [class.tumble]="rolling()" [class.land]="tier() !== null" [attr.data-tier]="tier()">
          @for (f of faces(); track $index; let i = $index) { <div class="face" [attr.data-face]="i">{{ f }}</div> }
        </div>
      </div>
      <button type="button" class="btn accent" (click)="roll()" [disabled]="rolling()">ROLL DICE</button>
    </div>
    @if (cinematic()) { <div class="overlay" (click)="dismiss()" title="Click to close"></div> }
  `,
  styles: `
    .field { display: grid; gap: 6px; font-size: var(--ss-text-xs); color: var(--ss-fg-dim);
      input { padding: 8px; font-size: var(--ss-text-sm); background: var(--ss-bg); border: 1px solid var(--ss-line-dim); color: var(--ss-fg); width: 100%; } }
    .wrap { display: grid; justify-items: center; gap: 18px; padding: 24px 0 8px; }
    .stage { width: 80px; height: 80px; display: grid; place-items: center; perspective: 600px; }
    .stage.cinematic { position: fixed; z-index: 81; top: 50%; left: 50%; translate: -50% -50%; scale: 2.5; pointer-events: none; }
    .overlay { position: fixed; inset: 0; z-index: 80; background: rgb(0 0 0 / 0.88); cursor: pointer; animation: fade 0.3s; }
    @keyframes fade { from { opacity: 0; } }
    .cube { --c: var(--ss-accent); width: 60px; height: 60px; position: relative; transform-style: preserve-3d; }
    .face {
      position: absolute; inset: 0; display: grid; place-items: center; backface-visibility: hidden;
      font-size: var(--fs-voice); color: var(--c); background: var(--ss-panel);
      border: 4px solid var(--c); box-shadow: inset 4px 4px 0 rgb(255 255 255 / 0.08), inset -4px -4px 0 rgb(0 0 0 / 0.5);
      &[data-face='0'] { transform: rotateY(0deg) translateZ(30px); }
      &[data-face='1'] { transform: rotateY(180deg) translateZ(30px); }
      &[data-face='2'] { transform: rotateY(90deg) translateZ(30px); }
      &[data-face='3'] { transform: rotateY(-90deg) translateZ(30px); }
      &[data-face='4'] { transform: rotateX(90deg) translateZ(30px); }
      &[data-face='5'] { transform: rotateX(-90deg) translateZ(30px); }
    }
    // tumbles in coarse steps, like a sprite's frames
    .cube.tumble { animation: tumble 1.8s steps(36) infinite; }
    @keyframes tumble { to { transform: rotateX(973deg) rotateY(843deg) rotateZ(500deg); } }
    .cube.land { animation: land 0.5s steps(5) forwards; }
    @keyframes land { from { scale: 1.5; filter: brightness(2); } }
    .cube[data-tier='low'] { --c: #ff3333; }
    .cube[data-tier='high'] { --c: #00ffff; .face { box-shadow: 0 0 0 2px #003a3a, inset 4px 4px 0 rgb(255 255 255 / 0.12); } }
    .cube[data-tier='max'] { --c: #ff8000; .face { color: #fff; background: #3a1d00; } }
    .btn { padding: 10px 14px; font-size: var(--ss-text-xs); background: none; border: var(--ss-border) solid var(--ss-accent); color: var(--ss-accent);
      &:hover:not(:disabled) { background: var(--ss-accent); color: var(--ss-bg); } &:disabled { opacity: 0.5; } }
  `,
})
export class DiceRoller {
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);

  protected readonly sides = signal(20);
  protected readonly faces = signal<(string | number)[]>(['--', '', '', '', '', '']);
  protected readonly rolling = signal(false);
  protected readonly cinematic = signal(false);
  protected readonly tier = signal<Tier | null>(null);
  private raf = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  protected roll(): void {
    const sides = Math.max(2, Math.floor(this.sides()) || 20);
    this.sound.play('diceroll', { rate: 0.95 + Math.random() * 0.1, volume: 0.9 });
    this.cinematic.set(true);
    this.tier.set(null);
    this.rolling.set(true);
    const start = performance.now();
    let last = start;
    const frame = (now: number) => {
      const progress = Math.min((now - start) / DURATION, 1);
      const gap = FAST + (1 - Math.pow(1 - progress, 3)) * (SLOW - FAST);
      if (now - last >= gap) {
        this.faces.set(this.faces().map(() => Math.floor(Math.random() * sides) + 1));
        last = now;
      }
      if (progress < 1) { this.raf = requestAnimationFrame(frame); return; }
      const result = Math.floor(Math.random() * sides) + 1;
      const pct = result / sides;
      this.faces.set([result, '', '', '', '', '']);
      this.rolling.set(false);
      this.tier.set(result === sides ? 'max' : pct >= 0.75 ? 'high' : pct <= 0.25 ? 'low' : 'mid');
      if (result === sides) this.sound.play('max', { volume: 0.9 });
      else if (result === 1) this.sound.play('minimum', { volume: 0.9 });
      else this.sound.play('rolldone', { rate: 0.7 + pct * 0.8, volume: 0.85 });
      this.notifier.notify('DICE ROLLED: ' + result);
    };
    this.raf = requestAnimationFrame(frame);
  }

  protected dismiss(): void {
    if (!this.rolling()) this.cinematic.set(false);
  }
}
