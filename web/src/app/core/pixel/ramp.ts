import { RampKey } from './palette';

/** The two ramps one accent colour produces, and the text colour that reads on ac2. */
export type Ramp = Record<RampKey, string> & { on: string };

const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Hex to OKLCH: [lightness 0-1, chroma, hue in degrees]. */
export function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

/** OKLCH to hex, pulling chroma in until the colour fits the sRGB gamut. */
export function oklch(L: number, C: number, H: number): string {
  for (let i = 0; i < 60; i++) {
    const h = (H * Math.PI) / 180, A = C * Math.cos(h), B = C * Math.sin(h);
    const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
    const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
    const s_ = L - 0.0894841775 * A - 1.291485548 * B;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (rgb.every(v => v >= -0.0005 && v <= 1.0005) || C < 0.002)
      return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, toGam(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('');
    C *= 0.93;
  }
  return '#808080';
}

/** Moves hue h a fraction a of the way toward hue t, the short way round. */
const hueTo = (h: number, t: number, a: number) => (h + (((t - h + 540) % 360) - 180) * a + 360) % 360;

const relLum = (hex: string) => { const [r, g, b] = hexToRgb(hex).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/**
 * One accent colour becomes two ramps: ac0-ac4 (deep shadow to pale light,
 * with shadows leaning violet and lights leaning gold, as in pixel art) and
 * sn0-sn3, a low-chroma stone tinted by the accent.
 */
export function ramp(hex: string): Ramp {
  const [L, C, H] = toOklch(/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex) ? hex : '#ff8000');
  const Lb = Math.min(0.86, Math.max(0.6, L));
  const sH = hueTo(H, 300, 0.2), sc = Math.min(C, 0.12) * 0.5;
  const r = {
    ac0: oklch(0.2, Math.min(C, 0.09), hueTo(H, 290, 0.25)),
    ac1: oklch(0.38, C * 0.72, hueTo(H, 290, 0.14)),
    ac2: oklch(Lb, C, H),
    ac3: oklch(Math.max(0.82, Lb + 0.07), C * 0.72, hueTo(H, 95, 0.12)),
    ac4: oklch(0.945, C * 0.38, hueTo(H, 95, 0.2)),
    sn0: oklch(0.16, sc * 0.7, sH), sn1: oklch(0.28, sc * 0.85, sH), sn2: oklch(0.4, sc, sH), sn3: oklch(0.56, sc * 0.9, sH),
  };
  return { ...r, on: contrast(r.ac2, '#000000') >= contrast(r.ac2, '#ffffff') ? '#000000' : '#ffffff' };
}
