import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Panel } from '../../ui/panel';
import { CritCalc } from './crit-calc';
import { DiceRoller } from './dice-roller';
import { StatChecker } from './stat-checker';
import { StatusRoller } from './status-roller';
import { TierListBoard } from './tier-list';
import { Leaderboard } from './leaderboard';
import { CompatTester } from './compat-tester';
import { GeneralSuggestions, TraitSuggestions } from './suggestions';

/** UTILITIES & TOOLS (the old utilities.html), section by section. */
@Component({
  selector: 'ss-utilities-page',
  imports: [Panel, DiceRoller, CritCalc, StatChecker, StatusRoller, TraitSuggestions, GeneralSuggestions, TierListBoard, Leaderboard, CompatTester],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="title">UTILITIES &amp; TOOLS</h1>
    <div class="top">
      <div class="col">
        <ss-panel title="DICE ROLLER"><ss-dice-roller /></ss-panel>
        <ss-panel title="CRIT CALCULATOR"><ss-crit-calc /></ss-panel>
      </div>
      <ss-panel title="TIER LIST"><ss-tier-list /></ss-panel>
    </div>
    <ss-panel title="STAT CHECKER (SIMULATOR)"><ss-stat-checker /></ss-panel>
    <ss-panel title="STAT LEADERBOARD"><ss-leaderboard /></ss-panel>
    <ss-panel title="STATUS EFFECT ROLLER"><ss-status-roller /></ss-panel>
    <ss-panel title="COMPATIBILITY TESTER ✦"><ss-compat-tester /></ss-panel>
    <ss-panel title="GAME WORLDS"><p class="todo">NOT REBUILT YET</p></ss-panel>
    <ss-panel title="TRAIT SUGGESTION BOX"><ss-trait-suggestions /></ss-panel>
    <ss-panel title="GENERAL SUGGESTION BOX"><ss-general-suggestions /></ss-panel>
  `,
  styles: `
    :host { display: grid; gap: 24px; max-width: 1200px; margin: 0 auto; padding: 24px max(16px, env(safe-area-inset-right, 0px)) 80px max(16px, env(safe-area-inset-left, 0px)); }
    .title { margin: 0; font-size: var(--ss-text-lg); letter-spacing: 4px; color: var(--ss-accent); }
    .top { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; }
    .col { display: grid; gap: 20px; align-content: start; }
    .todo { margin: 0; padding: 24px; text-align: center; color: var(--ss-fg-faint); font-size: var(--ss-text-sm); letter-spacing: 1px; }
    @media (max-width: 860px) { .top { grid-template-columns: 1fr; } }
  `,
})
export class UtilitiesPage {}
