import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { Tip } from '../../core/game/breakdown';
import { effectiveStats } from '../../core/game/stats';
import { TipDirective } from '../../ui/tooltip';

type View = 'list' | 'radar' | 'bars' | 'radial' | 'lines';
const VIEWS: View[] = ['list', 'radar', 'bars', 'radial', 'lines'];
const STAT_KEYS = ['avg', 'hp', 'atk', 'def', 'mag', 'spd', 'iq', 'heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'];
const LABELS: Record<string, string> = {
  avg: 'BALANCED', hp: 'HP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD', iq: 'IQ', heal_pow: 'HEAL', crit_rate: 'CRIT%', crit_dmg: 'CRIT DMG',
  status_res: 'STATUS RES', dexterity: 'DEX', resilience: 'RESIL', true_dmg: 'TRUE DMG', lifesteal: 'LIFESTEAL', cooldown_red: 'CDR',
};
const SUBS = new Set(['heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red']);
const SIX = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'];
const AVG = ['hp', 'atk', 'def', 'mag', 'spd'];
const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];
const GLYPHS = '▓▒░█▌▐■□#%&@!?<>/\\|0123456789*';
const CLASSIC = /^Classic$/i;
const W = 520;

interface Entry { c: Character; vals: Record<string, number>; classic: boolean }

/**
 * BALANCED: the geometric mean of HP, ATK, DEF, MAG and SPD (each at least
 * 1), nudged by IQ^0.01. Anything else is the effective stat itself.
 */
function statsOf(c: Character): Record<string, number> {
  const e = effectiveStats(c) as unknown as Record<string, number>;
  const vals: Record<string, number> = {};
  for (const k of STAT_KEYS) vals[k] = k === 'avg' ? 0 : e[k] || 0;
  const geo = Math.pow(AVG.reduce((p, s) => p * Math.max(e[s] || 0, 1), 1), 1 / AVG.length);
  vals['avg'] = geo * Math.pow(Math.max(e['iq'] || 1, 1), 0.01);
  return vals;
}

const f1 = (v: number) => v.toFixed(1);

/**
 * The stat leaderboard in five views. Classic is unrankable: pinned to the
 * end of every view, its numbers scrambled into glitch glyphs.
 */
@Component({
  selector: 'ss-leaderboard',
  imports: [TipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class Leaderboard {
  private readonly store = inject(CharacterStore);

  protected readonly views = VIEWS;
  protected readonly statKeys = STAT_KEYS;
  protected readonly labels = LABELS;
  protected readonly rankColors = RANK_COLORS;
  protected readonly W = W;
  protected readonly view = signal<View>('list');
  protected readonly stat = signal('avg');
  /** Ticks while Classic is on the board, re-rolling its glyphs. */
  private readonly tick = signal(0);

  private readonly entries = computed<Entry[]>(() =>
    this.store.characters().filter(c => !c.isPlaceholder).map(c => ({ c, vals: statsOf(c), classic: CLASSIC.test(c.name || '') })));
  private readonly ranked = computed(() => this.entries().filter(e => !e.classic));
  private readonly classics = computed(() => this.entries().filter(e => e.classic));

  /** Sorted by the chosen stat, every Classic last. */
  protected readonly sorted = computed(() => {
    const s = this.stat();
    return [...[...this.ranked()].sort((a, b) => b.vals[s] - a.vals[s]), ...this.classics()];
  });

  constructor() {
    let timer: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      clearInterval(timer);
      if (this.classics().length) timer = setInterval(() => this.tick.update(n => n + 1), 110);
    });
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected glitch(n: number): string {
    this.tick();
    let s = '';
    for (let i = 0; i < n; i++) s += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    return s;
  }
  protected glitchWidth(full: number): number {
    this.tick();
    return full * (0.22 + Math.random() * 0.66);
  }

  protected fmt(v: number): string {
    const r = +v.toFixed(1);
    return (r % 1 === 0 ? String(r) : r.toFixed(1)) + (SUBS.has(this.stat()) ? '%' : '');
  }

  protected tip(e: Entry): () => Tip {
    return () => ({
      title: e.c.name || '?', color: e.c.color || '#888', image: e.c.avatar || null, notes: [],
      lines: SIX.map(s => ({ label: LABELS[s], value: e.vals[s].toFixed(0) })),
    });
  }

  // ── bars ──
  protected readonly bars = computed(() => {
    const rows = this.sorted(), s = this.stat();
    const max = Math.max(...this.ranked().map(e => e.vals[s]), 1);
    const pad = { l: 112, r: 56, t: 14 }, rowH = 16, pw = W - pad.l - pad.r;
    let rank = 0;
    return {
      h: pad.t + rows.length * rowH + 10, pad, pw, rowH,
      rows: rows.map((e, i) => {
        const y = pad.t + i * rowH;
        const bw = Math.max((e.vals[s] / max) * pw, 1);
        if (e.classic) return { e, y, bw, label: '?', color: '' };
        rank++;
        return { e, y, bw, label: '#' + rank, color: RANK_COLORS[rank - 1] || '' };
      }),
    };
  });

  // ── radar: the top 15 by BALANCED, each stat as a percentile among them ──
  protected readonly radar = computed(() => {
    const CAP = 15, H = 360, cx = W / 2, cy = H / 2, R = 134;
    const cls = this.classics();
    const others = [...this.ranked()].sort((a, b) => b.vals['avg'] - a.vals['avg']);
    const room = Math.max(1, CAP - cls.length);
    const rk = others.slice(0, room);
    const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / SIX.length;
    const n = Math.max(rk.length, 1);
    const pct = new Map<string, Map<Entry, number>>();
    for (const s of SIX) pct.set(s, new Map([...rk].sort((a, b) => a.vals[s] - b.vals[s]).map((e, i) => [e, n > 1 ? i / (n - 1) : 0.5])));
    const pt = (i: number, r: number) => `${f1(cx + r * Math.cos(ang(i)))},${f1(cy + r * Math.sin(ang(i)))}`;
    const shown = [...rk, ...cls];
    return {
      h: H, cx, cy,
      rings: [0.25, 0.5, 0.75, 1].map(t => ({ t, points: SIX.map((_, i) => pt(i, R * t)).join(' ') })),
      spokes: SIX.map((_, i) => ({ x: f1(cx + R * Math.cos(ang(i))), y: f1(cy + R * Math.sin(ang(i))) })),
      labels: SIX.map((s, i) => {
        const c = Math.cos(ang(i));
        return { label: LABELS[s], max: Math.max(...shown.map(e => e.vals[s])).toFixed(0), x: f1(cx + (R + 18) * c), y: cy + (R + 18) * Math.sin(ang(i)), anchor: c > 0.1 ? 'start' : c < -0.1 ? 'end' : 'middle' };
      }),
      polys: shown.map(e => ({ e, points: SIX.map((s, i) => pt(i, (e.classic ? 0.5 + 0.08 * Math.sin(i * 1.7) : pct.get(s)!.get(e) ?? 0.5) * R)).join(' ') })),
      note: others.length > room ? `TOP ${CAP} BY AVG · ${this.entries().length} TOTAL` : '',
    };
  });

  // ── radial: one wedge per character, its length the stat ──
  protected readonly radial = computed(() => {
    const rows = this.sorted(), s = this.stat();
    const max = Math.max(...this.ranked().map(e => e.vals[s]), 1);
    const H = 420, cx = W / 2, cy = H / 2, ri = 52, ro = 196, n = rows.length, TAU = Math.PI * 2;
    const gap = Math.min(0.032, (TAU / Math.max(n, 1)) * 0.1);
    const xy = (r: number, a: number) => `${f1(cx + r * Math.cos(a))},${f1(cy + r * Math.sin(a))}`;
    return {
      h: H, cx, cy, ri,
      rings: [0.33, 0.66, 1].map(t => ri + t * (ro - ri)),
      arcs: rows.map((e, i) => {
        const t = e.classic ? 0.6 : e.vals[s] / max;
        const r = ri + t * (ro - ri);
        const a0 = -Math.PI / 2 + (i / n) * TAU + gap / 2, a1 = -Math.PI / 2 + ((i + 1) / n) * TAU - gap / 2;
        const la = a1 - a0 > Math.PI ? 1 : 0;
        return { e, t, d: `M ${xy(ri, a0)} L ${xy(r, a0)} A ${f1(r)},${f1(r)} 0 ${la},1 ${xy(r, a1)} L ${xy(ri, a1)} A ${ri},${ri} 0 ${la},0 ${xy(ri, a0)} Z` };
      }),
    };
  });

  // ── lines: parallel coordinates over the six stats ──
  protected readonly lines = computed(() => {
    const H = 300, pad = { l: 38, r: 38, t: 42, b: 38 }, ph = H - pad.t - pad.b;
    const base = this.ranked().length ? this.ranked() : this.entries();
    const min: Record<string, number> = {}, max: Record<string, number> = {};
    for (const s of SIX) { const vs = base.map(e => e.vals[s]); min[s] = Math.min(...vs); max[s] = Math.max(...vs); }
    const ax = (i: number) => pad.l + (i / (SIX.length - 1)) * (W - pad.l - pad.r);
    const y = (s: string, v: number) => Math.max(pad.t, Math.min(pad.t + ph, pad.t + (1 - (v - min[s]) / (max[s] - min[s] || 1)) * ph));
    const all = [...this.ranked(), ...this.classics()];   // Classic drawn last, on top
    return {
      h: H, top: pad.t, bottom: pad.t + ph,
      axes: SIX.map((s, i) => ({ x: ax(i), label: LABELS[s], max: max[s].toFixed(0), min: min[s].toFixed(0), ticks: [0.25, 0.5, 0.75].map(t => pad.t + t * ph) })),
      paths: all.map(e => {
        const pts = SIX.map((s, i) => [ax(i), e.classic ? pad.t + ph * 0.5 : y(s, e.vals[s])]);
        return { e, d: 'M ' + pts.map(p => `${f1(p[0])},${f1(p[1])}`).join(' L '), pts };
      }),
    };
  });
}
