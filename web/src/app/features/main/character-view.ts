import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { ConfirmService } from '../../core/confirm.service';
import { SoundService } from '../../core/sound.service';
import { Router } from '@angular/router';
import { RARITY_LABEL } from '../../core/game/roll';
import { formatGold, overallPowerLevel } from '../../core/game/sheet';
import { effectiveStats, formTraits, getTraitDef, isShimmyful } from '../../core/game/stats';
import { sanityRow, substatRows } from '../../core/game/substats';
import { TRAITS } from '../../core/game/traits-data';
import { Panel } from '../../ui/panel';
import { GoldModal } from '../gold/gold-modal';
import { RollOverlay } from '../roll/roll-overlay';
import { TraitCard } from '../traits/trait-card';
import { InventoryPanel } from '../inventory/inventory-panel';
import { InfoTab } from '../info/info-tab';
import { AbilitiesTab } from '../abilities/abilities-tab';
import { SoulEditor } from '../soul/soul-editor';
import { CodexModal, CultivationModal, RollHistoryModal } from '../traits/trait-modals';
import { cultivationRows } from '../../core/game/codex';
import { StatBar } from '../../ui/stat-bar';
import { MusicTab } from '../music/music-tab';
import { StyleTab } from '../style/style-tab';
import { ThemeMusic } from '../../core/theme-music.service';

const MAIN = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'] as const;
const CLASSIC = /^Classic$/i;

/** The open character sheet: header, traits, stats and inventory panels. */
@Component({
  selector: 'ss-character-view',
  imports: [StatBar, Panel, DecimalPipe, GoldModal, RollOverlay, TraitCard, InventoryPanel, InfoTab, AbilitiesTab, SoulEditor, CodexModal, CultivationModal, RollHistoryModal, MusicTab, StyleTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './character-view.html',
  styleUrl: './character-view.scss',
})
export class CharacterView {
  private readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);

  readonly character = input.required<Character>();
  protected readonly main = MAIN;
  protected readonly rarityLabel = RARITY_LABEL;

  protected readonly eff = computed(() => effectiveStats(this.character()));
  protected readonly pl = computed(() => overallPowerLevel(this.eff()));
  protected readonly gold = computed(() => formatGold(this.character().gold || 0));
  protected readonly subRows = computed(() => substatRows(this.character(), this.eff()));
  protected readonly sanity = computed(() => sanityRow(this.character()));

  /** The active form's portrait, falling back to the base one. */
  protected readonly avatar = computed(() => {
    const c = this.character();
    const idx = c.activeFormIdx || 0;
    return (idx > 0 && c.altForms?.[idx - 1]?.avatar) || c.avatar || null;
  });

  /** BASE (GHOST for Classic) plus each alternate form; empty without forms. */
  protected readonly forms = computed(() => {
    const c = this.character();
    const alt = c.altForms || [];
    if (!alt.length) return [];
    const base = CLASSIC.test(c.name || '') ? 'GHOST' : 'BASE';
    return [base, ...alt.map((f, i) => f.name || `FORM ${i + 1}`)];
  });
  protected readonly activeForm = computed(() => this.character().activeFormIdx || 0);

  protected readonly traits = computed(() => {
    const c = this.character();
    return formTraits(c).map(key => {
      const def = getTraitDef(c, key);
      // shimmyful variants carry no rarity of their own: it is always the base trait's
      const rarity = (TRAITS[key]?.rarity || def?.rarity || 'common') as string;
      return { key, name: def?.name || key, rarity, desc: def?.desc || '', shimmyful: isShimmyful(c, key) };
    });
  });


  protected readonly tabs = [
    { key: 'stats', label: 'STATS' }, { key: 'style', label: 'STYLE' }, { key: 'info', label: 'INFO' },
    { key: 'music', label: 'MUSIC' }, { key: 'abilities', label: 'ABILITIES' },
  ] as const;
  protected readonly tab = signal<'stats' | 'style' | 'info' | 'music' | 'abilities'>('stats');

  /** Which overlay is open over the sheet. */
  protected readonly open = signal<'roll' | 'gold' | 'codex' | 'history' | 'cultivation' | 'soul' | null>(null);
  protected readonly hasCultivation = computed(() => cultivationRows(this.character()).length > 0);

  constructor() {
    // the mini-player's song title opens this tab
    const music = inject(ThemeMusic);
    effect(() => {
      if (!music.wantTab()) return;
      this.tab.set('music');
      music.wantTab.set(false);
    });
  }

  /** Switching form is shared: it saves activeFormIdx on the character, as on the old site. */
  protected switchForm(idx: number): void {
    if (idx === this.activeForm()) return;
    void this.store.update(this.character().id, c => { c.activeFormIdx = idx; });
  }

  private readonly confirm = inject(ConfirmService);
  private readonly sound = inject(SoundService);
  private readonly router = inject(Router);

  protected edit(): void {
    void this.router.navigate(['/edit', this.character().id]);
  }

  /** Deletes after the old question; the page then opens the start character. */
  protected async remove(): Promise<void> {
    const c = this.character();
    if (!(await this.confirm.ask(`DELETE "${c.name}"?\n\nThis cannot be undone.`))) return;
    this.sound.play('delete');
    this.notifier.notify('DELETED', 'err');
    await this.router.navigate(['/']);
    void this.store.remove(c.id);
  }

  protected notYet(what: string): void {
    this.notifier.notify(`${what}: NOT REBUILT YET`, 'info');
  }
}
