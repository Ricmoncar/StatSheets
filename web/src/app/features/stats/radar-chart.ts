import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { STAT_HARD_MAX } from '../../core/game/sheet';

const KEYS = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'] as const;
const COLORS: Record<string, string> = { hp: '#44dd77', atk: '#ff4444', def: '#4499ff', mag: '#ff44ff', spd: '#ffcc00', iq: '#00bbcc' };
const CX = 150, CY = 155, R = 95;
const angle = (i: number) => -Math.PI / 2 + ((Math.PI * 2) / KEYS.length) * i;
const at = (i: number, frac: number): [number, number] => [CX + Math.cos(angle(i)) * R * frac, CY + Math.sin(angle(i)) * R * frac];
const pts = (arr: [number, number][]) => arr.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');

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

/** The stat radar (the old toggleable chart under the bars), easing to new values. */
@Component({
  selector: 'ss-radar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 300 310" role="img" [attr.aria-label]="summary()">
      @for (r of rings; track $index) { <polygon [attr.points]="r.points" fill="none" [attr.stroke]="r.edge ? '#2a2a2a' : '#191919'" [attr.stroke-dasharray]="r.edge ? null : '3 3'" shape-rendering="crispEdges" /> }
      @for (s of spokes; track $index) { <line [attr.x1]="cx" [attr.y1]="cy" [attr.x2]="s[0]" [attr.y2]="s[1]" stroke="#1c1c1c" shape-rendering="crispEdges" /> }
      <polygon [attr.points]="shape().points" [attr.fill]="color()" fill-opacity="0.16" [attr.stroke]="color()" stroke-opacity="0.85" stroke-width="2" stroke-linejoin="miter" shape-rendering="crispEdges" />
      @for (d of shape().dots; track d.key) { <rect [attr.x]="d.x - 3" [attr.y]="d.y - 3" width="6" height="6" [attr.fill]="d.color" stroke="#000" shape-rendering="crispEdges" /> }
      <rect [attr.x]="cx - 1" [attr.y]="cy - 1" width="2" height="2" fill="#2a2a2a" />
      @for (l of labels(); track l.key) {
        <text [attr.x]="l.x" [attr.y]="l.y - 5" [attr.text-anchor]="l.anchor" dominant-baseline="middle" font-size="8" letter-spacing="1.5" [attr.fill]="l.color">{{ l.label }}</text>
        <text [attr.x]="l.x" [attr.y]="l.y + 7" [attr.text-anchor]="l.anchor" dominant-baseline="middle" font-size="6.5" [attr.fill]="l.over ? l.color : '#555'">{{ l.over ? '▲' : '' }}{{ l.pct }}%</text>
      }
    </svg>
  `,
  styles: `
    :host { display: block; max-width: 340px; margin: 0 auto; }
    svg { display: block; width: 100%; height: auto; font-family: inherit; overflow: visible; }
  `,
})
export class RadarChart {
  readonly charId = input.required<string>();
  readonly color = input('#888888');
  readonly stats = input.required<Record<string, number>>();

  protected readonly cx = CX;
  protected readonly cy = CY;
  protected readonly rings = [0.25, 0.5, 0.75, 1].map(f => ({ points: pts(KEYS.map((_, i) => at(i, f))), edge: f === 1 }));
  protected readonly spokes = KEYS.map((_, i) => at(i, 1.05));

  /** The values drawn, easing toward the real ones. */
  private readonly shown = signal<Record<string, number>>({});
  private lastId: string | null = null;
  private raf = 0;

  protected readonly shape = computed(() => {
    const v = this.shown();
    const norm = KEYS.map(k => radarNorm(v[k] || 0, k));
    return {
      points: pts(norm.map((n, i) => at(i, n))),
      dots: norm.map((n, i) => { const [x, y] = at(i, n); return { key: KEYS[i], x, y, color: COLORS[KEYS[i]] }; }),
    };
  });

  /** Labels stay put and show the real numbers. */
  protected readonly labels = computed(() => {
    const s = this.stats();
    return KEYS.map((k, i) => {
      const [x, y] = at(i, 1.26);
      const raw = (s[k] || 0) / STAT_HARD_MAX[k];
      return { key: k, x, y, anchor: x < CX - 8 ? 'end' : x > CX + 8 ? 'start' : 'middle', label: k.toUpperCase(), color: COLORS[k], pct: Math.round(raw * 100), over: raw > 1.005 };
    });
  });
  protected readonly summary = computed(() => 'Stat radar: ' + this.labels().map(l => `${l.label} ${l.pct}%`).join(', '));

  constructor() {
    effect(() => {
      const id = this.charId();
      const target = Object.fromEntries(KEYS.map(k => [k, this.stats()[k] || 0]));
      untracked(() => this.ease(id, target));
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
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
