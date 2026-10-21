import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { EncyclopediaStore, StatusEffect } from '../../core/data/encyclopedia-store';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { StatusOrb } from '../../ui/status-orb';

const TYPES = ['ALL', 'BUFF', 'DEBUFF', 'UNIQUE', 'PASSIVE', 'NEUTRAL'] as const;
const TYPE_COLORS: Record<string, string> = { BUFF: '#44ff88', DEBUFF: '#ff4444', NEUTRAL: '#aaaaaa', PASSIVE: '#cc99ff', UNIQUE: '#ffcc44' };

import { Icon } from '../../ui/icon';

/** Rolls a random status effect from the encyclopaedia, optionally of one type. */
@Component({
  selector: 'ss-status-roller',
  imports: [StatusOrb, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="intro">Roll a random status effect from your encyclopedia. Filter by type to narrow the pool.</p>
    <div class="types" role="group" aria-label="Type">
      @for (t of types; track t) {
        <button type="button" class="type" [class.on]="type() === t" [style.--t]="color(t)" [attr.aria-pressed]="type() === t" (click)="type.set(t)">{{ t }}</button>
      }
    </div>
    <p class="pool">{{ pool().length }} STATUS EFFECT{{ pool().length !== 1 ? 'S' : '' }} IN POOL</p>
    <button type="button" class="btn accent u-btn primary" (click)="roll()" [disabled]="rolling()"><ss-icon name="dice" />ROLL STATUS EFFECT</button>
    @if (shown(); as s) {
      <div class="result u-fr u-slate" [class.scrambling]="rolling()" [style.--s]="s.color || '#aaa'">
        <ss-status-orb [shape]="$any(s['shape'])" [color]="s.color || '#aaa'" [size]="56" />
        <div class="info">
          <div class="top">
            <span class="name" [style.color]="s.color || '#ccc'">{{ s.name || '???' }}</span>
            <span class="badge" [style.--t]="color(s.type || 'NEUTRAL')">{{ s.type || 'NEUTRAL' }}</span>
          </div>
          @if (!rolling()) { <p class="desc">{{ s.desc }}</p> }
        </div>
      </div>
      @if (!rolling()) { <button type="button" class="btn u-btn" (click)="roll()"><ss-icon name="dice" />REROLL</button> }
    }
  `,
  styles: `
    .intro { margin: 0 0 var(--p5); font: var(--fs-body) / var(--lh-body) var(--f-body); color: var(--c-mute); }
    .types { display: flex; flex-wrap: wrap; gap: var(--p2); margin-bottom: var(--p5); }
    .type { --t: var(--c-white); padding: var(--p1) var(--p3); font: var(--fs-ui) / 20px var(--f-ui); color: var(--t); background: var(--c-ink2); box-shadow: inset var(--px) 0 0 var(--t);
      &:hover { color: var(--c-yel); }
      &.on { color: var(--c-void); background: var(--t); box-shadow: 0 0 0 var(--px) var(--c-void); } }
    .pool { margin: 0 0 var(--p4); font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-mute); }
    // the effect that came up, on a slate tile edged in its colour
    .result { --s: #aaa; display: flex; gap: var(--p6); align-items: center; margin: var(--p6) 0 var(--p4); padding: var(--p4) var(--p5); box-shadow: var(--hard), inset var(--p1) 0 0 var(--s);
      &.scrambling ss-status-orb { animation: shake 0.1s steps(2) infinite; } }
    @keyframes shake { 50% { translate: var(--px) 0; } }
    .info { flex: 1; min-width: 0; display: grid; gap: var(--p2); }
    .top { display: flex; gap: var(--p3); align-items: center; flex-wrap: wrap; }
    .name { font: 700 var(--fs-plaque) / 1 var(--f-display); letter-spacing: -0.125em; text-shadow: var(--p1) var(--p1) 0 var(--c-void); text-transform: uppercase; }
    .badge { --t: #aaa; padding: var(--p1) var(--p2); font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-void); background: var(--t); }
    .desc { margin: 0; font: var(--fs-body) / var(--lh-body) var(--f-body); color: var(--c-bone); white-space: pre-wrap; }
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
