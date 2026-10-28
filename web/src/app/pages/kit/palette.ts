// A page's palette: a few named ramps, darkest first, each colour a palette
// index into a colour table (index 0 is clear). Ramps are what a page shades
// with: one step up is the lit side, one step down the shadow, and a whole
// region can be darkened or lit by stepping its indices along their ramps.
import { table } from '../raster';

export interface Palette {
  /** Index by name: the ramp's letter(s) and the step, e.g. 'k0' darkest of ramp k. */
  readonly C: Record<string, number>;
  /** The colours as given, by index ('' for 0). */
  readonly hex: readonly string[];
  /** The colour table for Screen.show (copy it before changing entries). */
  readonly table: Uint32Array;
  readonly n: number;
  /** A ramp's indices, darkest first. */
  ramp(name: string): number[];
  /** `n` steps lighter along its own ramp (darker for negative n), stopping at the ends. */
  shift(i: number, n: number): number;
  /** A map from every index to the one `n` steps along its ramp, for recolouring a whole region at once. */
  shiftMap(n: number): Uint8Array;
  /** The index nearest a colour (any '#rrggbb'), for drawing code that thinks in colours. */
  near(hex: string): number;
}

export function palette(ramps: Record<string, readonly string[]>): Palette {
  const hex: string[] = [''];
  const C: Record<string, number> = {};
  const rampIdx: Record<string, number[]> = {};
  for (const [name, cols] of Object.entries(ramps)) {
    rampIdx[name] = cols.map((h, k) => { C[name + k] = hex.length; hex.push(h); return hex.length - 1; });
  }
  if (hex.length > 256) throw new Error('a page palette holds at most 255 colours');
  const up = new Uint8Array(hex.length), dn = new Uint8Array(hex.length);
  for (const ids of Object.values(rampIdx)) ids.forEach((id, k) => { up[id] = ids[Math.min(ids.length - 1, k + 1)]; dn[id] = ids[Math.max(0, k - 1)]; });
  const rgb = hex.map(h => (h ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : [0, 0, 0]));
  const nearCache = new Map<string, number>();
  const shift = (i: number, n: number) => { for (; n > 0; n--) i = up[i]; for (; n < 0; n++) i = dn[i]; return i; };
  return {
    C, hex, table: table(hex), n: hex.length,
    ramp: name => rampIdx[name] || [],
    shift,
    shiftMap: n => { const m = new Uint8Array(hex.length); for (let i = 1; i < hex.length; i++) m[i] = shift(i, n); return m; },
    near(h: string): number {
      let v = nearCache.get(h);
      if (v !== undefined) return v;
      const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
      let best = 1, bd = Infinity;
      for (let i = 1; i < rgb.length; i++) {
        // weighted for the eye: green counts most, blue least
        const d = 3 * (rgb[i][0] - r) ** 2 + 4 * (rgb[i][1] - g) ** 2 + 2 * (rgb[i][2] - b) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      nearCache.set(h, best);
      return best;
    },
  };
}

/** A palette's colour table drained toward grey by `amount` (1 is fully grey), keeping each colour's lightness. */
export function greyTable(p: Palette, amount = 1): Uint32Array {
  return table(p.hex.map(h => {
    if (!h) return h;
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    const l = r * 0.299 + g * 0.587 + b * 0.114;
    const m = (c: number) => Math.round(c + (l - c) * amount).toString(16).padStart(2, '0');
    return '#' + m(r) + m(g) + m(b);
  }));
}
