import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EncyclopediaStore, StatusEffect } from '../core/data/encyclopedia-store';

interface Piece { text: string; status?: StatusEffect }

/**
 * Trait and item text: [NAME] becomes the character's name, and every status
 * effect named in the encyclopaedia is coloured, with its description on hover
 * (the old _applyCharName + _renderDescWithStatuses, without innerHTML).
 */
@Component({
  selector: 'ss-rich-desc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (p of pieces(); track $index) {@if (p.status) {<span class="status" [style.color]="p.status.color" [attr.data-tooltip]="p.status.desc" [title]="p.status.desc || ''">{{ p.text }}</span>} @else {{{ p.text }}}}`,
  styles: `
    :host { white-space: pre-wrap; overflow-wrap: anywhere; }
    .status { cursor: help; text-decoration: underline dotted; }
  `,
})
export class RichDesc {
  private readonly enc = inject(EncyclopediaStore);
  readonly text = input<string | undefined | null>('');
  readonly name = input<string | undefined | null>('');

  protected readonly pieces = computed<Piece[]>(() => {
    const raw = (this.text() || '').replace(/\[NAME\]/g, this.name() || '?');
    const map = this.enc.statusMap();
    if (!raw || !map.size) return [{ text: raw }];
    // longest names first so "BURNING II" wins over "BURNING"
    const names = [...map.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp('(' + names.map(n => '\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').join('|') + ')', 'gi');
    const out: Piece[] = [];
    let last = 0;
    for (const m of raw.matchAll(re)) {
      const at = m.index ?? 0;
      if (at > last) out.push({ text: raw.slice(last, at) });
      out.push({ text: m[0], status: map.get(m[0].toUpperCase()) });
      last = at + m[0].length;
    }
    if (last < raw.length) out.push({ text: raw.slice(last) });
    return out;
  });
}
