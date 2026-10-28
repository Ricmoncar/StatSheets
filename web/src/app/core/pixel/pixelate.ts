// Vector art into pixel art. The art is drawn several times larger than the
// sprite, then each block of the big drawing becomes one pixel of the sprite,
// taking the colour most of the block has (not the average: an average is the
// soft edge pixel art never has). A block mostly empty stays empty, and what
// is left can get a one-pixel outline. Used where a page's own drawings were
// vectors and must stay recognisably themselves in the pixel style.

export interface PixelateOptions {
  /** How much larger the art is drawn before it is reduced (4 by default). */
  k?: number;
  /** A one-pixel outline round the sprite, or null for none. */
  outline?: string | null;
  /** How much of a block must be covered for its pixel to be drawn (0.5 by default). */
  cover?: number;
  /** How opaque a pixel of the drawing must be to count as covered (128 of 255 by default; lower keeps faint, glowing art). */
  alpha?: number;
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Draws with `draw` at k times w x h (the context is already scaled by k) and reduces it to w x h. */
export function pixelate(draw: (ctx: CanvasRenderingContext2D) => void, w: number, h: number, { k = 4, outline = null, cover = 0.5, alpha = 128 }: PixelateOptions = {}): HTMLCanvasElement {
  const big = canvas(w * k, h * k), bx = big.getContext('2d', { willReadFrequently: true })!;
  bx.scale(k, k);
  draw(bx);
  const src = bx.getImageData(0, 0, w * k, h * k).data;
  const out = canvas(w, h), ox = out.getContext('2d')!, img = ox.createImageData(w, h), d = img.data;
  const need = Math.max(1, Math.round(k * k * cover));
  const counts = new Map<number, number[]>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    counts.clear();
    let opaque = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const o = ((y * k + j) * w * k + (x * k + i)) * 4;
      if (src[o + 3] < alpha) continue;
      opaque++;
      const key = ((src[o] >> 4) << 8) | ((src[o + 1] >> 4) << 4) | (src[o + 2] >> 4);
      const c = counts.get(key);
      if (c) { c[0]++; c[1] += src[o]; c[2] += src[o + 1]; c[3] += src[o + 2]; } else counts.set(key, [1, src[o], src[o + 1], src[o + 2]]);
    }
    if (opaque < need) continue;
    let best: number[] | null = null;
    for (const c of counts.values()) if (!best || c[0] > best[0]) best = c;
    const o = (y * w + x) * 4;
    d[o] = Math.round(best![1] / best![0]); d[o + 1] = Math.round(best![2] / best![0]); d[o + 2] = Math.round(best![3] / best![0]); d[o + 3] = 255;
  }
  if (outline) {
    const [r, g, b] = hex(outline), filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] === 255;
    const add: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) add.push((y * w + x) * 4);
    for (const o of add) { d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 254; }   // 254: outline, not art
  }
  ox.putImageData(img, 0, 0);
  return out;
}

export function hex(c: string): [number, number, number] {
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** An SVG drawing (markup with or without its <svg>), ready to draw on a canvas. */
export function svgImage(svg: string, viewBox?: string): Promise<HTMLImageElement> {
  const markup = svg.trim().startsWith('<svg') ? svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"') : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${svg}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  return img.decode().then(() => img, () => img);
}

/** Frames side by side, as one image for a sprite strip. */
export function strip(frames: HTMLCanvasElement[]): string {
  const w = frames[0].width, h = frames[0].height, c = canvas(w * frames.length, h), x = c.getContext('2d')!;
  frames.forEach((f, i) => x.drawImage(f, i * w, 0));
  return c.toDataURL();
}

/**
 * A sprite drawn from rows of characters: each character is a colour from
 * `map` ('.' and ' ' are clear). For the small things too simple to draw as
 * vectors first (cursors, glyphs, coins).
 */
export function grid(rows: string, map: Record<string, string>): HTMLCanvasElement {
  const lines = rows.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.length);
  const w = Math.max(...lines.map(l => l.length)), h = lines.length;
  const c = canvas(w, h), x = c.getContext('2d')!;
  lines.forEach((l, y) => { for (let i = 0; i < l.length; i++) { const col = map[l[i]]; if (col) { x.fillStyle = col; x.fillRect(i, y, 1, 1); } } });
  return c;
}
