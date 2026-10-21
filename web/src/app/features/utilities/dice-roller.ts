import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { Ink, Painter } from '../../core/pixel/painter';
import { PixelTheme } from '../../core/pixel/pixel-theme.service';
import { Icon } from '../../ui/icon';

type Tier = 'low' | 'mid' | 'high' | 'max';
const DURATION = 2200;   // ms of tumbling
const FAST = 45, SLOW = 380;   // the scramble's gap between face changes, start to end

/** The die body by tier: bone while tumbling and for an ordinary roll, red for a bad one, cyan for a good one, gold for the top face. */
const BODY: Record<string, Ink> = { low: 'red', mid: 'bone', high: 'ec2', max: 'em3' };

/**
 * The dice roller: a pixel d20 tumbles centre screen while its number
 * scrambles (fast, then easing off), then lands coloured by how good the
 * roll was, with the result said in a dialogue line. Click anywhere to put
 * it back.
 */
@Component({
  selector: 'ss-dice-roller',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="field"><span class="lbl">SIDES</span>
      <input type="number" min="2" max="999" [value]="sides()" (input)="sides.set(+$any($event.target).value)" />
    </label>
    <div class="wrap">
      <div class="stage" [class.cinematic]="cinematic()" [class.land]="tier() !== null" [attr.data-tier]="tier()">
        <canvas #die width="26" height="28" aria-hidden="true"></canvas>
        <b class="n" aria-live="polite">{{ faces()[0] }}</b>
      </div>
      @if (line()) { <p class="say u-say">{{ line() }}</p> }
      <button type="button" class="btn u-btn primary" (click)="roll()" [disabled]="rolling()"><ss-icon name="dice" />ROLL DICE</button>
    </div>
    @if (cinematic()) { <div class="overlay u-scrim" (click)="dismiss()" title="Click to close"></div> }
  `,
  styles: `
    @use 'underground' as u;
    .field { display: grid; gap: var(--p2); .lbl { @include u.label; } input { width: 100%; @include u.field; } }
    .wrap { display: grid; justify-items: center; gap: var(--p5); padding: var(--p6) 0 var(--p2); }
    .stage { position: relative; width: calc(26 * var(--px)); height: calc(28 * var(--px)); }
    .stage canvas { width: 100%; height: 100%; }
    .n { position: absolute; inset: 0; display: grid; place-items: center; padding-top: var(--p2); font: 700 var(--fs-plaque) / 1 var(--f-display); color: var(--c-void); }
    .stage.cinematic { position: fixed; z-index: 81; top: 50%; left: 50%; translate: -50% -50%; scale: 3; pointer-events: none; }
    .stage.land { animation: land 0.5s steps(5) forwards; }
    @keyframes land { from { scale: 1.5; filter: brightness(2); } }
    .stage.cinematic.land { animation: land-big 0.5s steps(5) forwards; }
    @keyframes land-big { from { scale: 4.5; filter: brightness(2); } }
    .overlay { position: fixed; inset: 0; z-index: 80; cursor: var(--cur-point, pointer); animation: fade 0.3s steps(3); }
    @keyframes fade { from { opacity: 0; } }
    .say { margin: 0; text-align: center; font-size: var(--fs-body); }
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
  /** "* You rolled a 17." once it lands. */
  protected readonly line = signal('');
  /** Which way up the die is drawn; flips with every face change while it tumbles. */
  private readonly flip = signal(0);
  private readonly die = viewChild<ElementRef<HTMLCanvasElement>>('die');
  private readonly theme = inject(PixelTheme);
  private raf = 0;

  constructor() {
    afterRenderEffect(() => { const c = this.die()?.nativeElement; if (c) this.draw(c, this.flip(), this.tier()); });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  /** A d20 seen face on: a hexagon with the top triangle lit, turned over when tumbling. */
  private draw(cv: HTMLCanvasElement, tumble: number, tier: Tier | null): void {
    const P = new Painter(cv, this.theme.colours());
    P.x.clearRect(0, 0, 26, 28);
    const V: [number, number][] = [[13, 0], [25, 7], [25, 20], [13, 27], [0, 20], [0, 7]];
    P.poly(V, tumble ? 'mute' : BODY[tier || 'mid'], 28);
    const tri: [number, number][] = tumble ? [[13, 22], [21, 8], [5, 8]] : [[13, 5], [21, 19], [5, 19]];
    P.poly(tri, tier === 'max' && !tumble ? 'yel' : 'white', 28);
    for (let i = 0; i < 6; i++) P.line(V[i][0], V[i][1], V[(i + 1) % 6][0], V[(i + 1) % 6][1], 'void');
    tri.forEach((a, i) => { const b = tri[(i + 1) % 3]; P.line(a[0], a[1], b[0], b[1], 'mute'); });
    (tumble ? [[0, 3], [1, 1], [2, 5]] : [[0, 0], [1, 2], [2, 4]]).forEach(([t, v]) => P.line(tri[t][0], tri[t][1], V[v][0], V[v][1], 'mute'));
  }

  protected roll(): void {
    const sides = Math.max(2, Math.floor(this.sides()) || 20);
    this.sound.play('diceroll', { rate: 0.95 + Math.random() * 0.1, volume: 0.9 });
    this.cinematic.set(true);
    this.tier.set(null);
    this.line.set('');
    this.rolling.set(true);
    const start = performance.now();
    let last = start;
    const frame = (now: number) => {
      const progress = Math.min((now - start) / DURATION, 1);
      const gap = FAST + (1 - Math.pow(1 - progress, 3)) * (SLOW - FAST);
      if (now - last >= gap) {
        this.faces.set(this.faces().map(() => Math.floor(Math.random() * sides) + 1));
        this.flip.update(f => 1 - f);
        last = now;
      }
      if (progress < 1) { this.raf = requestAnimationFrame(frame); return; }
      const result = Math.floor(Math.random() * sides) + 1;
      const pct = result / sides;
      this.faces.set([result, '', '', '', '', '']);
      this.flip.set(0);
      this.rolling.set(false);
      this.line.set(`* You rolled a ${result}.${result === sides ? ' DETERMINATION.' : result === 1 ? ' ...yikes.' : ''}`);
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
