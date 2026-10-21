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
      <div class="tip u-fr u-frost u-snowcap" role="tooltip" [style.left.px]="tips.at().x" [style.top.px]="tips.at().y" [style.transform]="flip()" [attr.data-rarity]="t.rarity" [style.--r]="t.color">
        @if (t.image) { <img class="pic" [src]="t.image" alt="" /> }
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
      --r: var(--c-fr1);
      position: fixed; z-index: 90; min-width: min(calc(70 * var(--px)), calc(100vw - 24px)); max-width: min(calc(120 * var(--px)), calc(100vw - 24px)); padding: var(--p2) var(--p4) var(--p3); pointer-events: none;
      display: grid; gap: var(--p2); font: var(--fs-body) / var(--lh-body) var(--f-body); color: var(--c-bone); box-shadow: var(--hard);
      &[data-rarity='common'] { --r: var(--ss-common); }
      &[data-rarity='rare'] { --r: var(--ss-rare); }
      &[data-rarity='epic'] { --r: var(--ss-epic); }
      &[data-rarity='legendary'] { --r: var(--ss-legendary); }
      &[data-rarity='mythic'] { --r: var(--ss-mythic); }
      &[data-rarity='hexxed'] { --r: var(--ss-hexxed); }
      &[data-rarity='determined'] { --r: var(--c-red); }
    }
    p { margin: 0; }
    .pic { width: calc(18 * var(--px)); height: calc(18 * var(--px)); object-fit: cover; box-shadow: 0 0 0 var(--px) var(--c-void), 0 0 0 var(--p2) var(--r); }
    .title { color: var(--r); font: var(--fs-ui) / 20px var(--f-ui); text-transform: uppercase; }
    .desc { color: var(--c-bone); }
    .lines { margin: 0; display: grid; gap: 0; }
    .line { display: flex; justify-content: space-between; gap: var(--p8); }
    dt { color: var(--c-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    dd { margin: 0; color: var(--c-white); text-align: right; &[data-tone='pos'] { color: var(--good); } &[data-tone='neg'] { color: var(--bad); } }
    .total { margin-top: var(--p1); padding-top: var(--p1); border-top: var(--px) dashed var(--c-fr0); dt, dd { color: var(--c-fr1); } }
    .note { color: var(--c-mute); }
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
    return `translate(${left ? 'calc(-100% - 14px)' : '14px'}, ${up ? 'calc(-100% - 14px)' : '28px'})`;   // room below for the snow
  });
}
