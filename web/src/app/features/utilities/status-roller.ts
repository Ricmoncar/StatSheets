import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { EncyclopediaStore, StatusEffect } from '../../core/data/encyclopedia-store';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { StatusOrb } from '../../ui/status-orb';

const TYPES = ['ALL', 'BUFF', 'DEBUFF', 'UNIQUE', 'PASSIVE', 'NEUTRAL'] as const;
const TYPE_COLORS: Record<string, string> = { BUFF: '#44ff88', DEBUFF: '#ff4444', NEUTRAL: '#aaaaaa', PASSIVE: '#cc99ff', UNIQUE: '#ffcc44' };

/** Rolls a random status effect from the encyclopaedia, optionally of one type. */
@Component({
  selector: 'ss-status-roller',
  imports: [StatusOrb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="intro">Roll a random status effect from your encyclopedia. Filter by type to narrow the pool.</p>
    <div class="types" role="group" aria-label="Type">
      @for (t of types; track t) {
        <button type="button" class="type" [class.on]="type() === t" [style.--t]="color(t)" [attr.aria-pressed]="type() === t" (click)="type.set(t)">{{ t }}</button>
      }
    </div>
    <p class="pool">{{ pool().length }} STATUS EFFECT{{ pool().length !== 1 ? 'S' : '' }} IN POOL</p>
    <button type="button" class="btn accent" (click)="roll()" [disabled]="rolling()">&#9860; ROLL STATUS EFFECT</button>
    @if (shown(); as s) {
      <div class="result" [class.scrambling]="rolling()" [style.--s]="s.color || '#aaa'">
        <ss-status-orb [shape]="$any(s['shape'])" [color]="s.color || '#aaa'" [size]="56" />
        <div class="info">
          <div class="top">
            <span class="name" [style.color]="s.color || '#ccc'">{{ s.name || '???' }}</span>
            <span class="badge" [style.--t]="color(s.type || 'NEUTRAL')">{{ s.type || 'NEUTRAL' }}</span>
          </div>
          @if (!rolling()) { <p class="desc">{{ s.desc }}</p> }
        </div>
      </div>
      @if (!rolling()) { <button type="button" class="btn" (click)="roll()">&#8634; REROLL</button> }
    }
  `,
  styles: `
    .intro { margin: 0 0 18px; font-size: var(--ss-text-sm); letter-spacing: 1px; color: var(--ss-fg-faint); }
    .types { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
    .type { --t: var(--ss-fg); padding: 5px 8px; font-size: var(--ss-text-xs); letter-spacing: 1px; background: none; border: 1px solid color-mix(in srgb, var(--t) 30%, transparent); color: var(--t);
      &.on { border-color: var(--t); background: color-mix(in srgb, var(--t) 15%, transparent); } }
    .pool { margin: 0 0 14px; font-size: var(--ss-text-sm); letter-spacing: 2px; color: var(--ss-fg-faint); }
    .btn { padding: 10px 14px; font-size: var(--ss-text-xs); letter-spacing: 1px; background: none; border: var(--ss-border) solid var(--ss-fg-dim); color: var(--ss-fg);
      &.accent { border-color: var(--ss-accent); color: var(--ss-accent); &:hover:not(:disabled) { background: var(--ss-accent); color: var(--ss-bg); } }
      &:disabled { opacity: 0.5; } }
    .result { --s: #aaa; display: flex; gap: 20px; align-items: center; margin: 24px 0 12px; padding: 18px 20px;
      border: 2px solid color-mix(in srgb, var(--s) 45%, transparent); background: color-mix(in srgb, var(--s) 7%, transparent);
      &.scrambling ss-status-orb { animation: shake 0.1s steps(2) infinite; } }
    @keyframes shake { 50% { translate: 2px 0; } }
    .info { flex: 1; min-width: 0; display: grid; gap: 8px; }
    .top { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .name { font-size: 11px; }
    .badge { --t: #aaa; font-size: 7px; letter-spacing: 2px; padding: 3px 8px; border: 1px solid color-mix(in srgb, var(--t) 40%, transparent); color: var(--t); }
    .desc { margin: 0; font-size: var(--ss-text-sm); letter-spacing: 1px; line-height: 1.8; color: var(--ss-fg-dim); white-space: pre-wrap; }
  `,
})
export class StatusRoller {
  private readonly enc = inject(EncyclopediaStore);
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);

  protected readonly types = TYPES;
  protected readonly type = signal<string>('ALL');
  protected readonly pool = computed(() => {
    const all = this.enc.statuses();
    return this.type() === 'ALL' ? all : all.filter(s => (s.type || 'NEUTRAL') === this.type());
  });
  protected readonly shown = signal<StatusEffect | null>(null);
  protected readonly rolling = signal(false);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  protected color(t: string): string {
    return TYPE_COLORS[t] || 'var(--ss-fg)';
  }

  protected roll(): void {
    if (this.rolling()) return;
    const pool = this.pool();
    if (!pool.length) { this.notifier.notify('No status effects in pool!', 'err'); return; }
    this.rolling.set(true);
    this.sound.play('diceroll', { rate: 0.9 + Math.random() * 0.2, volume: 0.7 });
    let ticks = 0;
    const pick = () => pool[Math.floor(Math.random() * pool.length)];
    this.timer = setInterval(() => {
      if (++ticks > 40) {
        clearInterval(this.timer);
        const final = pick();
        this.shown.set(final);
        this.rolling.set(false);
        this.sound.play('rolldone', { rate: 0.8, volume: 0.8 });
        this.notifier.notify('STATUS EFFECT: ' + (final.name || '???'));
        return;
      }
      // holds each preview longer as it slows towards the end
      if (Math.random() < (ticks / 40) ** 2) return;
      this.shown.set(pick());
    }, 55);
  }
}
