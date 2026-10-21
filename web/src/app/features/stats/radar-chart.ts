import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Painter } from '../../core/pixel/painter';
import { PixelTheme } from '../../core/pixel/pixel-theme.service';
import { STAT_HARD_MAX } from '../../core/game/sheet';

const KEYS = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'] as const;
const COLORS: Record<string, string> = { hp: '#45d65a', atk: '#ff7a1e', def: '#8fb4e0', mag: '#dcb4ff', spd: '#ffe23b', iq: '#6fd2ff' };
const SIZE = 84, C = 42, RAD = 26;   // past the cap a vertex reaches 1.5 x RAD = 39, still inside
const angle = (i: number) => -Math.PI / 2 + ((Math.PI * 2) / KEYS.length) * i;

/**
 * Below the cap a square-root curve, so weak characters still show (athlete
 * level sits near 22% of the ring); past it log-compressed, so the shape
 * keeps growing but slows down fast. The outer ring is Mountain Level.
 */
export function radarNorm(value: number, stat: string): number {
  const v = value / STAT_HARD_MAX[stat];
  if (v <= 0) return 0;
  if (v <= 1) return Math.sqrt(v);
  return Math.min(1 + 0.35 * Math.log2(v), 1.5);
}

/** The stat radar (the old toggleable chart under the bars), drawn as pixel art and easing to new values. */
@Component({
  selector: 'ss-radar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" role="img" [attr.aria-label]="summary()">
      <canvas #cv width="84" height="84"></canvas>
      @for (l of labels(); track l.key) {
        <span class="rl" [class.over]="l.over" [style.left]="'calc(' + l.lx + ' * var(--px))'" [style.top]="'calc(' + l.ly + ' * var(--px))'" [style.--sc]="l.color">
          <b>{{ l.label }}</b><small>{{ l.over ? '▲' : '' }}{{ l.pct }}%</small>
        </span>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; width: calc(132 * var(--px)); max-width: 100%; height: calc(120 * var(--px)); margin: 0 auto; }
    canvas { position: absolute; left: calc(24 * var(--px)); top: calc(18 * var(--px)); width: calc(84 * var(--px)); height: calc(84 * var(--px)); }
    .rl { position: absolute; display: grid; justify-items: center; gap: var(--p1); transform: translate(-50%, -50%); white-space: nowrap;
      b { font: var(--fs-ui) / 1 var(--f-ui); font-weight: 400; color: var(--sc); }
      small { font: var(--fs-small) / 1 var(--f-body); color: var(--c-mute); }
      &.over small { color: var(--c-em3); } }
  `,
})
export class RadarChart {
  readonly charId = input.required<string>();
  /** Kept for callers; the radar now takes the page's accent ramp like everything else. */
  readonly color = input('#888888');
  readonly stats = input.required<Record<string, number>>();

  private readonly theme = inject(PixelTheme);
  private readonly cv = viewChild<ElementRef<HTMLCanvasElement>>('cv');

  /** The values drawn, easing toward the real ones. */
  private readonly shown = signal<Record<string, number>>({});
  private lastId: string | null = null;
  private raf = 0;

  protected readonly shape = computed(() => {
    const v = this.shown();
    return KEYS.map(k => radarNorm(v[k] || 0, k));
  });

  /** Labels stay put and show the real numbers. */
  protected readonly labels = computed(() => {
    const s = this.stats();
    return KEYS.map((k, i) => {
      const raw = (s[k] || 0) / STAT_HARD_MAX[k];
      return { key: k, lx: (66 + Math.cos(angle(i)) * 56).toFixed(1), ly: (60 + Math.sin(angle(i)) * 52).toFixed(1), label: k.toUpperCase(), color: COLORS[k], pct: Math.round(raw * 100), over: raw > 1.005 };
    });
  });
  protected readonly summary = computed(() => 'Stat radar: ' + this.labels().map(l => `${l.label} ${l.pct}%`).join(', '));

  constructor() {
    effect(() => {
      const id = this.charId();
      const target = Object.fromEntries(KEYS.map(k => [k, this.stats()[k] || 0]));
      untracked(() => this.ease(id, target));
    });
    // redraw whenever the shape eases or the accent changes
    afterRenderEffect(() => { const n = this.shape(); this.theme.version(); const c = this.cv()?.nativeElement; if (c) this.draw(c, n); });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  /** Rings and spokes in dashes, the shape filled with an accent checker, vertices as 2x2 blocks (sparkling past the cap). */
  private draw(cv: HTMLCanvasElement, norm: number[]): void {
    const P = new Painter(cv, this.theme.colours());
    P.x.clearRect(0, 0, SIZE, SIZE);
    const pt = (i: number, r: number): [number, number] => [Math.round(C + Math.cos(angle(i)) * r), Math.round(C + Math.sin(angle(i)) * r)];
    for (let i = 0; i < KEYS.length; i++) { const [x, y] = pt(i, RAD); P.line(C, C, x, y, 'ink3', 2); }
    [0.25, 0.5, 0.75, 1].forEach(f => {
      for (let i = 0; i < KEYS.length; i++) { const a = pt(i, RAD * f), b = pt((i + 1) % KEYS.length, RAD * f); P.line(a[0], a[1], b[0], b[1], f === 1 ? 'ash' : 'ink3', f === 1 ? 0 : 2); }
    });
    const poly = norm.map((n, i) => pt(i, RAD * n));
    P.poly(poly, (x, y) => ((x + y) & 1 ? 'ac1' : 'ac0'), SIZE);
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; P.line(a[0], a[1], b[0], b[1], 'ac3'); }
    poly.forEach(([x, y], i) => {
      const over = norm[i] > 1;
      P.r(x - 1, y - 1, 2, 2, (COLORS[KEYS[i]] as `#${string}`));
      if (over) { P.p(x - 2, y - 1, 'yel'); P.p(x + 1, y - 1, 'yel'); P.p(x - 1, y - 3, 'yel'); P.p(x - 1, y + 1, 'yel'); }
    });
    P.p(C, C, 'ash');
  }

  /** A new character snaps into place; changes to the same one ease in. */
  private ease(id: string, target: Record<string, number>): void {
    cancelAnimationFrame(this.raf);
    if (id !== this.lastId || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.lastId = id;
      this.shown.set(target);
      return;
    }
    const tick = () => {
      let settled = true;
      const next = { ...this.shown() };
      for (const k of KEYS) {
        const diff = target[k] - (next[k] || 0);
        if (Math.abs(diff) < 0.05) next[k] = target[k];
        else { next[k] = (next[k] || 0) + diff * 0.1; settled = false; }
      }
      this.shown.set(next);
      if (!settled) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}
