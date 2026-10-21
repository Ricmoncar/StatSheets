import { ChangeDetectionStrategy, Component, Directive, ElementRef, Injectable, computed, inject, input, signal } from '@angular/core';
import { Tip } from '../core/game/breakdown';
import { RichDesc } from './rich-desc';

/** The one tooltip on screen and where it is. */
@Injectable({ providedIn: 'root' })
export class TooltipService {
  readonly tip = signal<Tip | null>(null);
  readonly at = signal({ x: 0, y: 0 });
  show(tip: Tip | null, x: number, y: number): void { this.tip.set(tip); this.at.set({ x, y }); }
  move(x: number, y: number): void { if (this.tip()) this.at.set({ x, y }); }
  hide(): void { this.tip.set(null); }
}

/**
 * [ssTip]: a rich tooltip that follows the pointer, built only when shown
 * (pass a function to build it lazily, as the old site did for traits).
 * Keyboard focus shows it under the element.
 */
@Directive({
  selector: '[ssTip]',
  host: {
    '(mouseenter)': 'open($event)',
    '(mousemove)': 'tips.move($event.clientX, $event.clientY)',
    '(mouseleave)': 'tips.hide()',
    '(focusin)': 'focus()',
    '(focusout)': 'tips.hide()',
  },
})
export class TipDirective {
  readonly ssTip = input<Tip | null | (() => Tip | null)>(null);
  protected readonly tips = inject(TooltipService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private build(): Tip | null {
    const t = this.ssTip();
    return typeof t === 'function' ? t() : t;
  }
  protected open(e: MouseEvent): void { this.tips.show(this.build(), e.clientX, e.clientY); }
  protected focus(): void {
    const r = this.el.getBoundingClientRect();
    this.tips.show(this.build(), r.left, r.bottom);
  }
}

/** Draws the tooltip; lives once in the app shell. */
@Component({
  selector: 'ss-tooltip-host',
  imports: [RichDesc],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tips.tip(); as t) {
      <div class="tip" role="tooltip" [style.left.px]="tips.at().x" [style.top.px]="tips.at().y" [style.transform]="flip()" [attr.data-rarity]="t.rarity">
        <p class="title">{{ t.title }}</p>
        @if (t.desc) { <p class="desc"><ss-rich-desc [text]="t.desc" [name]="t.name" /></p> }
        @if (t.lines.length || t.total) {
          <dl class="lines">
            @for (l of t.lines; track $index) { <div class="line"><dt>{{ l.label }}</dt><dd [attr.data-tone]="l.tone">{{ l.value }}</dd></div> }
            @if (t.total; as tot) { <div class="line total"><dt>{{ tot.label }}</dt><dd>{{ tot.value }}</dd></div> }
          </dl>
        }
        @for (n of t.notes; track $index) { <p class="note">{{ n }}</p> }
      </div>
    }
  `,
  styles: `
    .tip {
      --r: var(--ss-fg);
      position: fixed; z-index: 90; min-width: min(200px, calc(100vw - 24px)); max-width: min(320px, calc(100vw - 24px)); padding: 10px 12px; pointer-events: none;
      display: grid; gap: 8px; font-size: var(--ss-text-xs); letter-spacing: 1px; line-height: 1.7;
      background: var(--ss-bg); border: var(--ss-border) solid var(--r); box-shadow: 4px 4px 0 #000;
      &[data-rarity='common'] { --r: var(--ss-common); }
      &[data-rarity='rare'] { --r: var(--ss-rare); }
      &[data-rarity='epic'] { --r: var(--ss-epic); }
      &[data-rarity='legendary'] { --r: var(--ss-legendary); }
      &[data-rarity='mythic'] { --r: var(--ss-mythic); }
      &[data-rarity='hexxed'] { --r: var(--ss-hexxed); }
      &[data-rarity='determined'] { --r: #ff2a2a; }
    }
    p { margin: 0; }
    .title { color: var(--r); font-size: var(--ss-text-sm); letter-spacing: 2px; }
    .desc { color: var(--ss-fg-dim); }
    .lines { margin: 0; display: grid; gap: 2px; }
    .line { display: flex; justify-content: space-between; gap: 16px; }
    dt { color: var(--ss-fg-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    dd { margin: 0; color: var(--ss-fg); &[data-tone='pos'] { color: var(--ss-ok); } &[data-tone='neg'] { color: var(--ss-err); } }
    .total { margin-top: 4px; padding-top: 4px; border-top: 1px dashed var(--ss-line-dim); dt, dd { color: var(--ss-accent); } }
    .note { color: var(--ss-fg-faint); }
  `,
})
export class TooltipHost {
  protected readonly tips = inject(TooltipService);

  constructor() {
    // touch has no mouseleave, and a scroll moves the element away from the tip
    const hide = () => this.tips.hide();
    document.addEventListener('touchstart', hide, { passive: true });
    document.addEventListener('wheel', hide, { passive: true });
  }
  /** Sits below-right of the pointer, flipping to stay on screen. */
  protected readonly flip = computed(() => {
    const { x, y } = this.tips.at();
    const left = x > innerWidth * 0.6, up = y > innerHeight * 0.55;
    return `translate(${left ? 'calc(-100% - 14px)' : '14px'}, ${up ? 'calc(-100% - 14px)' : '14px'})`;
  });
}
