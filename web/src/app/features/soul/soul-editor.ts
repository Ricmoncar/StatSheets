import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import {
  SOUL_FILL_MODES, SOUL_MAX_COLORS, SOUL_ONE_COLOR, SOUL_PRESETS, Soul, nextColor, normalizeSoul, soulDesc, soulNumLabel, soulPrimary, soulWhen,
} from '../../core/game/soul';
import { NgTemplateOutlet } from '@angular/common';
import { Modal } from '../../ui/modal';
import { Icon } from '../../ui/icon';
import { SoulView } from './soul-view';

type Scope = 'body' | 'inner';

/**
 * The SOUL editor (the old buildSoulEditorBody). Every option stacks. Changes
 * save 600 ms after the last one; opening the editor and touching nothing
 * writes nothing.
 */
@Component({
  selector: 'ss-soul-editor',
  imports: [Modal, SoulView, NgTemplateOutlet, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './soul-editor.html',
  styleUrl: './soul-editor.scss',
})
export class SoulEditor implements OnInit, OnDestroy {
  private readonly store = inject(CharacterStore);
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);

  readonly character = input.required<Character>();
  readonly closed = output<void>();

  protected readonly s = signal<Soul>(normalizeSoul(null));
  protected readonly modes = SOUL_FILL_MODES;
  protected readonly presets = SOUL_PRESETS;
  protected readonly desc = computed(() => soulDesc(this.s()));
  protected readonly primary = computed(() => soulPrimary(this.s()));
  protected readonly when = (w: string) => soulWhen(this.s(), w);
  protected readonly numLabel = soulNumLabel;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  ngOnInit(): void {
    this.s.set(normalizeSoul((this.character().info as any)?.soul));
    this.sound.play('characterclick', { volume: 0.5 });
  }

  protected palette(scope: Scope): string[] {
    return scope === 'inner' ? this.s().innerColors : this.s().colors;
  }
  protected canAdd(scope: Scope): boolean {
    const mode = scope === 'inner' ? this.s().innerFill : this.s().fill;
    return mode !== 'rainbow' && !SOUL_ONE_COLOR.includes(mode) && this.palette(scope).length < SOUL_MAX_COLORS;
  }

  protected set(key: keyof Soul, val: unknown): void {
    this.s.update(s => ({ ...s, [key]: val }));
    this.persist();
  }
  protected toggle(key: keyof Soul): void {
    this.set(key, !this.s()[key]);
    this.sound.play('click', { volume: 0.35 });
  }
  protected setName(v: string): void { this.set('name', v.slice(0, 32)); }

  protected setColor(scope: Scope, i: number, v: string): void {
    const pal = [...this.palette(scope)];
    pal[i] = v;
    this.set(scope === 'inner' ? 'innerColors' : 'colors', pal);
  }
  protected addColor(scope: Scope): void {
    const pal = this.palette(scope);
    if (pal.length >= SOUL_MAX_COLORS) return;
    this.set(scope === 'inner' ? 'innerColors' : 'colors', [...pal, nextColor(pal)]);
    this.sound.play('pop', { volume: 0.4 });
  }
  protected removeColor(scope: Scope, i: number): void {
    const pal = this.palette(scope);
    if (pal.length <= 1) return;
    this.set(scope === 'inner' ? 'innerColors' : 'colors', pal.filter((_, j) => j !== i));
    this.sound.play('click', { volume: 0.35 });
  }

  /** A preset sets the name, the FIRST colour (extra palette entries stay), monster, and rainbow's fill. */
  protected preset(i: number): void {
    const p = SOUL_PRESETS[i];
    this.s.update(s => ({ ...s, name: p.name, colors: [p.color, ...s.colors.slice(1)], monster: !!p.monster, ...(p.fill ? { fill: p.fill } : {}) }));
    this.persist();
    this.sound.play('characterchange', { volume: 0.4 });
  }

  protected reset(): void {
    this.s.set(normalizeSoul(null));
    this.persist();
    this.sound.play('cancel', { volume: 0.5 });
    this.notifier.notify('SOUL RESET', 'ok');
  }

  private persist(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 600);
  }

  private flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.dirty) return;
    this.dirty = false;
    const soul = this.s();
    void this.store.update(this.character().id, c => { c.info = c.info || {}; (c.info as any).soul = soul; });
  }

  ngOnDestroy(): void { this.flush(); }
}
