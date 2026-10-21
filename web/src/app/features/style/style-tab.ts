import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Character } from '../../core/data/models';
import { isGenericPattern, withDefaults } from '../../core/game/pattern-draw';
import { GENERIC_PATTERNS } from '../../core/game/patterns';
import { Panel } from '../../ui/panel';
import { PatternCanvas } from '../../ui/pattern-canvas';

/** The STYLE tab: the character's background pattern and its settings. */
@Component({
  selector: 'ss-style-tab',
  imports: [Panel, PatternCanvas, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-panel title="BACKGROUND PATTERN">
      <a actions class="edit" [routerLink]="['/edit', character().id]">&#9998; CHANGE</a>
      <p class="label">PATTERN: <span>{{ label() }}</span></p>
      @if (generic()) {
        <div class="preview"><ss-pattern-canvas [type]="type()" [params]="character().pattern?.params" /></div>
        <dl class="params">
          @for (r of rows(); track r.id) {
            <div class="row">
              <dt>{{ r.label }}</dt>
              <dd>
                @if (r.color) { <span class="swatch" [style.background]="r.value"></span> }
                {{ r.value }}
              </dd>
            </div>
          }
        </dl>
      }
    </ss-panel>
  `,
  styles: `
    .label { margin: 0 0 14px; font-size: var(--fs-body); span { color: var(--ss-accent); } }
    .edit { font-size: var(--ss-text-xs); padding: 5px 8px; border: 1px solid var(--ss-line-dim); color: var(--ss-fg); text-decoration: none; &:hover { border-color: var(--ss-accent); color: var(--ss-accent); } }
    .preview { position: relative; height: 140px; margin-bottom: 14px; border: 1px solid var(--ss-line-dim); background: var(--ss-bg); }
    .params { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px 16px; margin: 0; }
    .row { display: flex; gap: 8px; align-items: center; font-size: var(--ss-text-sm); }
    dt { color: var(--ss-fg-faint); &::after { content: ':'; } }
    dd { margin: 0; display: inline-flex; gap: 6px; align-items: center; color: #ccc; }
    .swatch { width: 10px; height: 10px; border: 1px solid var(--ss-line-dim); }
  `,
})
export class StyleTab {
  readonly character = input.required<Character>();

  protected readonly type = computed(() => this.character().pattern?.type || 'none');
  protected readonly generic = computed(() => isGenericPattern(this.type()));
  protected readonly label = computed(() => GENERIC_PATTERNS[this.type()]?.label || 'None');
  protected readonly rows = computed(() => {
    const values = withDefaults(this.type(), this.character().pattern?.params);
    return (GENERIC_PATTERNS[this.type()]?.params || []).map(p => ({
      id: p.id, label: p.label, value: String(values[p.id]), color: p.type === 'color',
    }));
  });
}
