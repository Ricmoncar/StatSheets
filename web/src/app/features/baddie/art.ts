// SPIN A BADDIE in pixels: the old page's dice, eggs and pets (old-art.ts)
// reduced to pixel sprites, and the small things drawn as pixels from the
// start (the coin, the cursors, the sparks a click throws, the marks on a
// modified baddie). Everything is made once, on first use, and kept.
import { grid, hex, pixelate, strip, svgImage } from '../../core/pixel/pixelate';
import { PETS } from './data';
import { PET_BODY, burgerSVG, diceSVG, eggSVG, petPaint } from './old-art';

/** A sprite strip, for the app's .u-spr: one frame or several side by side. */
export interface Sprite { url: string; w: number; h: number; n: number; fps: number }

const INK = '#12081a';
const cache = new Map<string, Promise<Sprite>>();
function once(key: string, make: () => Promise<Sprite>): Promise<Sprite> {
  let p = cache.get(key);
  if (!p) cache.set(key, p = make());
  return p;
}
const still = (c: HTMLCanvasElement): Sprite => ({ url: c.toDataURL(), w: c.width, h: c.height, n: 1, fps: 1 });

/** How big a pet is, in art pixels. */
export const PET_PX = 20;

// ── the forest egg's pets had no drawings of their own (the old page showed their emoji): drawn here in the same manner ──
const FOREST: Record<string, string> = {
  Fox: `<path d="M14 14 L22 30 L10 28Z" fill="#c4621c"/><path d="M50 14 L42 30 L54 28Z" fill="#c4621c"/><path d="M16 18 L21 28 L14 27Z" fill="#3a1a08"/><path d="M48 18 L43 28 L50 27Z" fill="#3a1a08"/>
    <ellipse cx="32" cy="34" rx="18" ry="15" fill="#e08a3c"/><path d="M18 36 Q32 30 46 36 Q40 52 32 54 Q24 52 18 36Z" fill="#fff2e0"/>
    <circle cx="25" cy="32" r="2.6" fill="#1a0e06"/><circle cx="39" cy="32" r="2.6" fill="#1a0e06"/><ellipse cx="32" cy="44" rx="3" ry="2.2" fill="#1a0e06"/>`,
  Deer: `<path d="M22 16 L18 4 M18 10 L12 6 M42 16 L46 4 M46 10 L52 6" stroke="#7a5228" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="16" cy="24" rx="7" ry="4" fill="#a97c48" transform="rotate(-25 16 24)"/><ellipse cx="48" cy="24" rx="7" ry="4" fill="#a97c48" transform="rotate(25 48 24)"/>
    <ellipse cx="32" cy="34" rx="14" ry="16" fill="#c9a06a"/><ellipse cx="32" cy="44" rx="8" ry="7" fill="#efdcbc"/>
    <circle cx="26" cy="31" r="2.6" fill="#1a0e06"/><circle cx="38" cy="31" r="2.6" fill="#1a0e06"/><ellipse cx="32" cy="42" rx="3" ry="2.2" fill="#2a1a0c"/>
    <circle cx="22" cy="24" r="1.2" fill="#fff4e0"/><circle cx="42" cy="26" r="1.2" fill="#fff4e0"/>`,
  Owl: `<path d="M16 14 L22 22 L14 24Z" fill="#7a5a36"/><path d="M48 14 L42 22 L50 24Z" fill="#7a5a36"/>
    <ellipse cx="32" cy="36" rx="18" ry="20" fill="#b8946a"/><ellipse cx="32" cy="44" rx="11" ry="11" fill="#e8d4b0"/>
    <path d="M24 42 L26 46 M30 46 L32 50 M36 42 L38 46" stroke="#a07a4c" stroke-width="1.6"/>
    <circle cx="24" cy="28" r="7" fill="#fff4dc"/><circle cx="40" cy="28" r="7" fill="#fff4dc"/>
    <circle cx="24" cy="28" r="3.6" fill="#f0a020"/><circle cx="40" cy="28" r="3.6" fill="#f0a020"/><circle cx="24" cy="28" r="1.8" fill="#140a02"/><circle cx="40" cy="28" r="1.8" fill="#140a02"/>
    <path d="M30 33 L34 33 L32 38Z" fill="#e08a1c"/>`,
  Hedgehog: `<path d="M8 40 L12 26 L18 32 L20 18 L27 26 L32 14 L37 26 L44 18 L46 32 L52 26 L56 40Z" fill="#5a4026"/>
    <ellipse cx="32" cy="40" rx="22" ry="13" fill="#9a7a52"/><path d="M14 40 L18 30 L22 36 L26 28 L30 36 L34 28 L38 36 L42 30 L46 38" stroke="#6a4e30" stroke-width="2" fill="none"/>
    <ellipse cx="48" cy="44" rx="10" ry="8" fill="#e6cfa4"/><circle cx="50" cy="42" r="2" fill="#140a02"/><circle cx="57" cy="45" r="2" fill="#2a1a0c"/>
    <ellipse cx="22" cy="53" rx="3" ry="2" fill="#6a4e30"/><ellipse cx="40" cy="53" rx="3" ry="2" fill="#6a4e30"/>`,
  Mushroom: `<path d="M8 32 Q8 10 32 10 Q56 10 56 32 Q32 38 8 32Z" fill="#d84a3a"/><circle cx="20" cy="22" r="4" fill="#fff4ec"/><circle cx="34" cy="16" r="3.4" fill="#fff4ec"/>
    <circle cx="46" cy="24" r="4" fill="#fff4ec"/><circle cx="28" cy="27" r="2.4" fill="#fff4ec"/>
    <path d="M20 33 Q32 37 44 33 L42 52 Q32 56 22 52Z" fill="#f2e2c8"/><circle cx="28" cy="42" r="2.2" fill="#2a1a0c"/><circle cx="36" cy="42" r="2.2" fill="#2a1a0c"/>
    <path d="M29 47 Q32 49 35 47" stroke="#2a1a0c" stroke-width="1.4" fill="none"/>`,
  Treant: `<rect x="24" y="34" width="16" height="22" rx="3" fill="#7a5228"/><path d="M24 54 L18 60 M40 54 L46 60 M30 56 L28 61 M34 56 L36 61" stroke="#5a3a1a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="20" r="14" fill="#4faa5a"/><circle cx="18" cy="28" r="10" fill="#3f9450"/><circle cx="46" cy="28" r="10" fill="#3f9450"/><circle cx="26" cy="14" r="7" fill="#6cc46c"/>
    <circle cx="28" cy="42" r="2.4" fill="#f0e6a0"/><circle cx="36" cy="42" r="2.4" fill="#f0e6a0"/><path d="M28 48 Q32 50 36 48" stroke="#2a1608" stroke-width="1.6" fill="none"/>
    <circle cx="40" cy="12" r="2" fill="#ffe27a"/><circle cx="14" cy="24" r="1.6" fill="#ffe27a"/>`,
};

/** Pets the old page drew on a canvas every frame: their frames, and how long one loop takes. */
const CANVAS_PETS: Record<string, { frames: number; period: number; zoom?: number; dx?: number; alpha?: number }> = {
  // the phoenix and the constellation fish are thin and glowing: drawn a little larger, and their faint parts kept
  Phoenix: { frames: 6, period: 0.84, zoom: 2.3, dx: -4, alpha: 60 }, Tiki: { frames: 6, period: 0.7 }, Muffin: { frames: 8, period: 4.2 },
  ShooShi: { frames: 8, period: 4.2 }, Parasite: { frames: 8, period: 5.2 }, CosmicFish: { frames: 6, period: 1.26, zoom: 1.2, alpha: 40 },
};

/** A pet, as a sprite strip: its own drawing, reduced; the ones that moved keep moving. */
export function petSprite(type: string): Promise<Sprite> {
  return once('pet:' + type, async () => {
    const P = PET_PX, opts = { outline: INK, k: 5 };
    const cp = CANVAS_PETS[type];
    if (cp) {
      const frames: HTMLCanvasElement[] = [];
      const z = cp.zoom || 1;
      for (let i = 0; i < cp.frames; i++) {
        const t = 10 + (i / cp.frames) * cp.period;
        frames.push(pixelate(ctx => { ctx.translate(P / 2 + (cp.dx || 0), P / 2); ctx.scale(z, z); ctx.translate(-P / 2, -P / 2); petPaint(ctx, type, P, P, t); }, P, P, { ...opts, alpha: cp.alpha ?? 128 }));
      }
      return { url: strip(frames), w: P, h: P, n: cp.frames, fps: cp.frames / cp.period };
    }
    const body = PET_BODY[type as keyof typeof PET_BODY] ?? FOREST[type];
    if (!body) return still(pixelate(() => undefined, P, P));
    const draw = (img: HTMLImageElement) => pixelate(ctx => ctx.drawImage(img, 0, 0, P, P), P, P, opts);
    // wings that flapped: up and down
    if (body.includes('bd-flap')) {
      const up = await svgImage(body, '0 0 64 64');
      const down = await svgImage(body.replace(/class="bd-flap"/g, 'style="transform-box:fill-box;transform-origin:center;transform:scaleY(.62) rotate(-3deg)"'), '0 0 64 64');
      return { url: strip([draw(up), draw(down)]), w: P, h: P, n: 2, fps: 3 };
    }
    // SHIMMY's burst of rays turns
    if (body.includes('bd-spin-svg')) {
      const frames: HTMLCanvasElement[] = [];
      for (let i = 0; i < 4; i++) {
        const a = (i * 360) / 16 / 4;
        frames.push(draw(await svgImage(body.replace('class="bd-spin-svg"', `transform="rotate(${a} 32 32)"`), '0 0 64 64')));
      }
      return { url: strip(frames), w: P, h: P, n: 4, fps: 4 };
    }
    return still(draw(await svgImage(body, '0 0 64 64')));
  });
}

/** A die, at s art pixels. */
export function dieSprite(id: number, s = 16): Promise<Sprite> {
  return once(`die:${id}:${s}`, async () => {
    const img = await svgImage(diceSVG(id, 48));
    return still(pixelate(ctx => ctx.drawImage(img, 0, 0, s, s), s, s, { outline: INK, k: 6 }));
  });
}

export function eggSprite(type: string): Promise<Sprite> {
  return once('egg:' + type, async () => {
    const img = await svgImage(eggSVG(type, 48));
    return still(pixelate(ctx => ctx.drawImage(img, 0, 0, 16, 20), 16, 20, { outline: INK, k: 6 }));
  });
}

export function burgerSprite(): Promise<Sprite> {
  return once('burger', async () => {
    const img = await svgImage(burgerSVG(24));
    return still(pixelate(ctx => ctx.drawImage(img, 0, 0, 9, 9), 9, 9, { outline: INK, k: 6 }));
  });
}

// ── drawn as pixels from the start ──

/** The coin, turning: face, three quarters, edge, three quarters. */
export const COIN: Sprite = (() => {
  const map = { o: '#8a5a06', y: '#ffc23c', l: '#fff0b0', d: '#c8860c', w: '#fff7d6' };
  const frames = [
    grid(`
..ooo..
.olyyo.
olyyydo
oyywydo
oyyyddo
.oyddo.
..ooo..`, map),
    grid(`
..ooo..
..oyyo.
.olyydo
.oywydo
.oyyddo
..oddo.
..ooo..`, map),
    grid(`
...o...
...o...
...d...
...d...
...d...
...o...
...o...`, map),
    grid(`
..ooo..
.oyyo..
olyydo.
oydwyo.
oyyddo.
.oddo..
..ooo..`, map),
  ];
  return { url: strip(frames), w: 7, h: 7, n: 4, fps: 4 / 4.5 * 4 };
})();

/** The cursors: an arrow, a heart and a star, each coloured as its old SVG was. Pixels are 2 CSS pixels; the point is the top left. */
const ARROW = `
X...........
XX..........
XWX.........
XWWX........
XWWWX.......
XWWWWX......
XWWWWWX.....
XWWWWWWX....
XWWWWXXXX...
XWXWWX......
XX.XWWX.....
X...XWWX....
.....XX.....`;
const HEART = `
.XXX...XXX.
XWWWX.XWWWX
XWWWWXWWWWX
XWWWWWWWWWX
XWWWWWWWWWX
.XWWWWWWWX.
..XWWWWWX..
...XWWWX...
....XWX....
.....X.....`;
const STAR = `
.....X.....
....XWX....
....XWX....
XXXXWWWXXXX
.XWWWWWWWX.
..XWWWWWX..
..XWWXWWX..
.XWWX.XWWX.
.XXX...XXX.`;
function shade(rows: string, top: string, bottom: string, edge: string): HTMLCanvasElement {
  const lines = rows.split('\n').filter(l => l.length), [r0, g0, b0] = hex(top), [r1, g1, b1] = hex(bottom);
  const c = document.createElement('canvas');
  c.width = Math.max(...lines.map(l => l.length)); c.height = lines.length;
  const x = c.getContext('2d')!;
  lines.forEach((l, y) => {
    const f = y / Math.max(1, lines.length - 1);
    for (let i = 0; i < l.length; i++) {
      if (l[i] === 'X') x.fillStyle = edge;
      else if (l[i] === 'W') x.fillStyle = `rgb(${Math.round(r0 + (r1 - r0) * f)},${Math.round(g0 + (g1 - g0) * f)},${Math.round(b0 + (b1 - b0) * f)})`;
      else continue;
      x.fillRect(i, y, 1, 1);
    }
  });
  return c;
}
function scaled(c: HTMLCanvasElement, k: number): string {
  const o = document.createElement('canvas');
  o.width = c.width * k; o.height = c.height * k;
  const x = o.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(c, 0, 0, o.width, o.height);
  return o.toDataURL();
}
const CURSOR_LOOK: Record<string, [string, string, string, string]> = {
  //          shape    top        bottom     edge
  classic: ['arrow', '#ffffff', '#ffffff', '#000000'],
  gold: ['arrow', '#fff1b0', '#e0941c', '#6a4a06'],
  gem: ['arrow', '#e8fdff', '#3fb8e0', '#2188a6'],
  flame: ['arrow', '#ffe24a', '#ff3b00', '#7a1800'],
  heart: ['heart', '#ff9ad4', '#ff5bb0', '#a01860'],
  star: ['star', '#fff8c8', '#ffe070', '#a06a00'],
  void: ['arrow', '#c79bff', '#3a1070', '#e6d6ff'],
  matrix: ['arrow', '#0a2a12', '#0a2a12', '#00ff66'],
  rainbow: ['arrow', '#ff4d6d', '#4aa3ff', '#ffffff'],
  cosmic: ['arrow', '#d6ffff', '#0a3a6a', '#eafcff'],
};
const cursorCache = new Map<string, { url: string; img: string }>();
/** A cursor as CSS (url and hot spot), and the same picture for the shop. */
export function cursorArt(id: string): { css: string; img: string } {
  let c = cursorCache.get(id);
  if (!c) {
    const [shape, top, bottom, edge] = CURSOR_LOOK[id] || CURSOR_LOOK['classic'];
    let pic = shade(shape === 'heart' ? HEART : shape === 'star' ? STAR : ARROW, top, bottom, edge);
    if (id === 'rainbow') pic = rainbowArrow();
    c = { url: scaled(pic, 2), img: pic.toDataURL() };
    cursorCache.set(id, c);
  }
  return { css: `url("${c.url}") 0 0`, img: c.img };
}
function rainbowArrow(): HTMLCanvasElement {
  // the prism pointer ran red through green to blue
  const lines = ARROW.split('\n').filter(l => l.length), cols = ['#ff4d6d', '#ff8a3d', '#ffe24a', '#7CFF4A', '#2bd9d9', '#4aa3ff', '#b15cff'];
  const c = document.createElement('canvas');
  c.width = 12; c.height = lines.length;
  const x = c.getContext('2d')!;
  lines.forEach((l, y) => { for (let i = 0; i < l.length; i++) { if (l[i] === '.') continue; x.fillStyle = l[i] === 'X' ? '#ffffff' : cols[Math.floor(((i + y) / 22) * cols.length) % cols.length]; x.fillRect(i, y, 1, 1); } });
  return c;
}

/** The little shapes a click throws, one per cursor's glyph, 5 by 5, drawn in one colour. */
const GLYPHS: Record<string, string> = {
  '•': `
.....
.XXX.
.XXX.
.XXX.
.....`,
  '◆': `
..X..
.XXX.
XXXXX
.XXX.
..X..`,
  '❖': `
..X..
.X.X.
X.X.X
.X.X.
..X..`,
  '🔥': `
..X..
.XX..
.XXX.
XXXXX
.XXX.`,
  '♥': `
XX.XX
XXXXX
XXXXX
.XXX.
..X..`,
  '✦': `
..X..
..X..
XXXXX
..X..
..X..`,
  '✧': `
..X..
.X.X.
X...X
.X.X.
..X..`,
  '1': `
.XX..
..X..
..X..
..X..
.XXX.`,
  '✨': `
X..X.
.....
..X..
.XXX.
..X..`,
  '☄': `
....X
...XX
X.XX.
.XX..
XXX..`,
};
export function glyphMask(g: string): string { return GLYPHS[g] || GLYPHS['•']; }

/** Small marks for the modifiers that wear one (as CSS images, drawn in their colours). */
export const MOD_MARKS: Record<string, string> = {};
function mark(rows: string, map: Record<string, string>): string { return grid(rows, map).toDataURL(); }
export function modMarks(): Record<string, string> {
  if (Object.keys(MOD_MARKS).length) return MOD_MARKS;
  MOD_MARKS['heart'] = mark(`
.X.X.
XXXXX
XXXXX
.XXX.
..X..`, { X: '#ff5bb0' });
  MOD_MARKS['moon'] = mark(`
..XXX.
.XXo..
XXo...
XXo...
XXXo..
.XXXX.
..XXX.`, { X: '#dfe6ff', o: '#8aa6ff' });
  MOD_MARKS['star'] = mark(`
..X..
..X..
XXwXX
..X..
..X..`, { X: '#ffe27a', w: '#ffffff' });
  MOD_MARKS['flame'] = mark(`
...X....X...
..XX...XX..X
.XXXX.XXX.XX
XXyXXXXyXXXX
XyyyXXyyyXyX`, { X: '#ff5a2b', y: '#ffd24a' });
  MOD_MARKS['drop'] = mark(`
..X..
.XXX.
XXwXX
XXXXX
.XXX.`, { X: '#4ad6ff', w: '#e8faff' });
  MOD_MARKS['milk'] = mark(`
XXXXXXXX
XXwXXXwX
.XX.XX.X
.X..X...
.X......`, { X: '#fff4fb', w: '#ff66dd' });
  return MOD_MARKS;
}

/** A pet's colour, for when its sprite is not ready yet. */
export const petCol = (type: string) => PETS[type]?.col || '#888';
