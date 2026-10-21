import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Character } from '../../core/data/models';
import { isGenericPattern, withDefaults } from '../../core/game/pattern-draw';
import { GENERIC_PATTERNS } from '../../core/game/patterns';
import { Panel } from '../../ui/panel';
import { PatternCanvas } from '../../ui/pattern-canvas';
import { Icon } from '../../ui/icon';

/** The STYLE tab: the character's background pattern and its settings. */
@Component({
  selector: 'ss-style-tab',
  imports: [Panel, PatternCanvas, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-panel title="BACKGROUND PATTERN">
      <a actions class="edit u-btn sm" [routerLink]="['/edit', character().id]"><ss-icon name="pencil" />CHANGE</a>
      <p class="label">PATTERN: <span>{{ label() }}</span></p>
      @if (generic()) {
        <div class="preview u-fr u-slate"><ss-pattern-canvas [type]="type()" [params]="character().pattern?.params" /></div>
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
    .label { margin: 0 0 var(--p4); font: var(--fs-ui) / 1 var(--f-ui); color: var(--c-mute); text-transform: uppercase; span { color: var(--ac3); } }
    .preview { position: relative; height: calc(48 * var(--px)); margin-bottom: var(--p5); overflow: hidden; background-color: var(--c-void); box-shadow: var(--hard); }
    .params { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(60 * var(--px))), 1fr)); gap: 0 var(--p8); margin: 0; }
    .row { display: flex; gap: var(--p2); align-items: baseline; justify-content: space-between; padding: var(--p1) 0; border-bottom: var(--px) solid var(--c-ink2); }
    dt { font: var(--fs-ui) / 20px var(--f-ui); color: var(--c-mute); text-transform: uppercase; }
    dd { margin: 0; display: inline-flex; gap: var(--p2); align-items: center; font: var(--fs-num) / 1 var(--f-body); color: var(--c-white); }
    .swatch { width: var(--p4); height: var(--p4); box-shadow: 0 0 0 var(--px) var(--c-void), 0 0 0 var(--p2) var(--c-ash); }
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
