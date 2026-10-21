import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { RARITY_LABEL } from '../../core/game/roll';
import { formatGold, overallPowerLevel } from '../../core/game/sheet';
import { effectiveStats, formTraits, getTraitDef, isShimmyful } from '../../core/game/stats';
import { sanityRow, substatRows } from '../../core/game/substats';
import { TRAITS } from '../../core/game/traits-data';
import { Panel } from '../../ui/panel';
import { GoldModal } from '../gold/gold-modal';
import { RollOverlay } from '../roll/roll-overlay';
import { TraitCard } from '../traits/trait-card';
import { StatBar } from '../../ui/stat-bar';

const MAIN = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'] as const;
const CLASSIC = /^Classic$/i;

/** The open character sheet: header, traits, stats and inventory panels. */
@Component({
  selector: 'ss-character-view',
  imports: [StatBar, Panel, DecimalPipe, GoldModal, RollOverlay, TraitCard],
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

  protected readonly items = computed(() => this.character().inventory || []);

  /** Which overlay is open over the sheet. */
  protected readonly open = signal<'roll' | 'gold' | null>(null);

  /** Switching form is shared: it saves activeFormIdx on the character, as on the old site. */
  protected switchForm(idx: number): void {
    if (idx === this.activeForm()) return;
    void this.store.update(this.character().id, c => { c.activeFormIdx = idx; });
  }

  protected notYet(what: string): void {
    this.notifier.notify(`${what}: NOT REBUILT YET`, 'info');
  }
}
