import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { FRAMES, FrameDef, paintFrame } from './frames';
import { Painter, canvas, rows } from './painter';
import { Colours, DEFAULT_ACCENT, FIXED, KEY } from './palette';
import { Ramp, ramp } from './ramp';
import { HEART9, SPRITES, SpriteDef } from './sprites';
import { TEXTURES, TextureDef } from './textures';

// an 11x12 rose on its stem, the old BK's Corner cursor in pixels
const ROSE = [
  '..00000....',
  '.0RRrRR0...',
  '0RKRRRrR0..',
  '0RrKKRRR0..',
  '0RRrRKrR0..',
  '.0RRRRR0...',
  '..00G00....',
  '.0G0G0.....',
  '0GG0G0.....',
  '.00.G0.....',
  '....G0.....',
  '....00.....',
];

/**
 * THE UNDERGROUND theme at runtime. Every sprite, 9-slice frame and tile is
 * drawn in code at art resolution and handed to CSS as a data URL variable
 * (--s-*, --f-*, --t-*), along with the accent ramps (--ac0..4, --sn0..3).
 * Changing the accent redraws only what uses it, so the whole page recolours
 * to the open character's colour.
 */
@Injectable({ providedIn: 'root' })
export class PixelTheme {
  private readonly doc = inject(DOCUMENT);
  private readonly root = this.doc.documentElement;
  /** Every variable the theme sets, written together by flush(). */
  private readonly vars = new Map<string, string>();
  private varSheet: HTMLStyleElement | null = null;
  private readonly colourMap: Colours = { ...FIXED, ...ramp(DEFAULT_ACCENT) } as Colours;
  private started = false;

  /** The current accent; bumps `version` whenever the ramps change, for canvases that draw with them. */
  readonly accent = signal(DEFAULT_ACCENT);
  readonly version = signal(0);

  /** The current palette, for painters outside CSS (radar, scenes, portraits). */
  colours(): Colours { return this.colourMap; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.applyRamp(ramp(DEFAULT_ACCENT));
    this.spriteClasses();
    this.renderAll(false);
    this.cursors();
    this.flush();
  }

  /** Recolours the theme to a character's colour, or back to the site's own with null. */
  setAccent(hex: string | null | undefined): void {
    const next = hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : DEFAULT_ACCENT;
    if (!this.started) this.start();
    if (next === this.accent()) return;
    this.accent.set(next);
    this.applyRamp(ramp(next));
    this.renderAll(true);
    this.flush();
    this.version.update(v => v + 1);
  }

  /** A painter on a fresh canvas, using the live palette. */
  painter(w: number, h: number): Painter { return new Painter(canvas(w, h), this.colourMap); }

  private applyRamp(r: Ramp): void {
    for (const k of ['ac0', 'ac1', 'ac2', 'ac3', 'ac4', 'sn0', 'sn1', 'sn2', 'sn3'] as const) {
      this.colourMap[k] = r[k];
      this.vars.set('--' + k, r[k]);
    }
    this.vars.set('--on-ac', r.on);
  }

  private setUrl(name: string, url: string): void { this.vars.set(name, `url("${url}")`); }

  /**
   * Writes every variable into one :root rule at once. (Setting about a hundred
   * long image URLs one by one on the root element restyled the whole page
   * for each, which a phone felt on every character it opened.)
   */
  private flush(): void {
    if (!this.varSheet) {
      this.varSheet = this.doc.createElement('style');
      this.varSheet.dataset['pixel'] = 'vars';
      this.doc.head.appendChild(this.varSheet);
    }
    this.varSheet.textContent = ':root{' + [...this.vars].map(([k, v]) => `${k}:${v}`).join(';') + '}';
  }

  private renderAll(accentOnly: boolean): void {
    for (const d of SPRITES) if (!accentOnly || d.acc) this.setUrl('--s-' + d.id, this.sprite(d));
    for (const d of FRAMES) if (!accentOnly || d.acc) this.setUrl('--f-' + d.id, this.frame(d));
    for (const d of TEXTURES) if (!accentOnly || d.acc) this.setUrl('--t-' + d.id, this.texture(d));
  }
  private sprite(d: SpriteDef): string {
    const P = this.painter(d.w * d.n, d.h);
    for (let f = 0; f < d.n; f++) { P.ox = f * d.w; d.draw(P, f); }
    return P.c.toDataURL();
  }
  private frame(d: FrameDef): string {
    const size = 2 * d.D + d.L, P = this.painter(size, size);
    paintFrame(P, size, size, d.D, d.fn);
    return P.c.toDataURL();
  }
  private texture(d: TextureDef): string {
    const P = this.painter(d.w, d.h);
    d.draw(P);
    return P.c.toDataURL();
  }

  /** .s-<id> sets a sprite's size, frame count and image; .anim steps through it. */
  private spriteClasses(): void {
    const doc = this.root.ownerDocument;
    const st = doc.createElement('style');
    st.dataset['pixel'] = 'sprites';
    st.textContent = SPRITES.map(d => `.s-${d.id}{--w:${d.w};--h:${d.h};--n:${d.n};--fps:${d.fps};--sheet:var(--s-${d.id});background-image:var(--sheet)}`).join('\n');
    doc.head.appendChild(st);
  }

  /** The SOUL as the cursor: red, red ringed in yellow over things you can press, cracked grey for disabled. */
  private cursors(): void {
    const heart = rows(HEART9);
    const ring = (fill: 'red' | 'mt2', edge: 'void' | 'yel', crack = false) => {
      const s = this.painter(11, 10);
      const on = (x: number, y: number) => y >= 0 && y < heart.length && x >= 0 && x < 9 && heart[y][x] === 'R';
      for (let y = -1; y <= 8; y++) for (let x = -1; x <= 9; x++) {
        if (on(x, y)) s.p(x + 1, y + 1, crack && y > 0 && (x === 4 || (x === 3 && y % 2) || (x === 5 && !(y % 2))) ? 'void' : fill);
        else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) s.p(x + 1, y + 1, edge);
      }
      const big = this.painter(33, 30);
      big.x.drawImage(s.c, 0, 0, 33, 30);
      return big.c.toDataURL();
    };
    this.vars.set('--cur-soul', `url("${ring('red', 'void')}") 16 14, auto`);
    this.vars.set('--cur-point', `url("${ring('red', 'yel')}") 16 14, pointer`);
    this.vars.set('--cur-no', `url("${ring('mt2', 'void', true)}") 16 14, not-allowed`);
    // BK's Corner keeps its rose: the bloom outlined in yellow over things you can press
    const rose = (hot: boolean) => {
      const s = this.painter(11, 12);
      ROSE.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') s.p(x, y, ch === '0' && hot && y < 7 ? 'yel' : KEY[ch]); }));
      const big = this.painter(33, 36);
      big.x.drawImage(s.c, 0, 0, 33, 36);
      return big.c.toDataURL();
    };
    const bloom = rose(false);
    this.vars.set('--i-rose', `url("${bloom}")`);
    this.vars.set('--cur-rose', `url("${bloom}") 4 4, auto`);
    this.vars.set('--cur-rose-hot', `url("${rose(true)}") 4 4, pointer`);
  }
}
