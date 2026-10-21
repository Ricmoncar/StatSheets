// The SOUL: an Undertale-style pixel heart with layered, composable options.
// Ported from the old script.js (INFO TAB: SOUL). The SVG markup is built
// here as a string; every value that reaches it is validated (colours must be
// hex, numbers are coerced), so a malformed soul in the database cannot inject
// markup.

/** Classic 40x36 pixel-heart geometry: [x, y, w, h] rows. */
export const SOUL_ROWS = [
  [4, 0, 12, 4], [24, 0, 12, 4],
  [0, 4, 18, 4], [22, 4, 18, 4],
  [0, 8, 40, 4], [0, 12, 40, 4],
  [2, 16, 36, 4], [4, 20, 32, 4],
  [8, 24, 24, 4], [12, 28, 16, 4], [16, 32, 8, 4],
];
/** Area centroid: scaling about it keeps layers concentric. */
const CX = 20, CY = 15.44;
export const SOUL_MAX_COLORS = 8;

export interface Soul {
  name: string;
  fill: string; colors: string[]; angle: number; cycle: boolean;
  inner: boolean; innerFill: string; innerColors: string[]; innerAngle: number; innerSize: number; innerOffsetY: number; innerMonster: boolean;
  outline: boolean; outlineColor: string; outlineWidth: number; outlineOffsetY: number;
  cracked: boolean; crackColor: string; crackSpread: number;
  monster: boolean; glow: number; pulse: boolean;
  [k: string]: unknown;
}

export const SOUL_DEFAULT: Soul = {
  name: 'Vessel',
  fill: 'solid', colors: ['#9e9e9e', '#ffffff'], angle: 0, cycle: false,
  inner: false, innerFill: 'solid', innerColors: ['#ffffff', '#9e9e9e'], innerAngle: 0, innerSize: 0.45, innerOffsetY: 0, innerMonster: false,
  outline: false, outlineColor: '#000000', outlineWidth: 2, outlineOffsetY: 0,
  cracked: false, crackColor: '#000000', crackSpread: 45,
  monster: false, glow: 12, pulse: false,
};

export const SOUL_FILL_MODES: [string, string][] = [
  ['solid', 'SOLID'], ['split', 'SPLIT'], ['gradient', 'BLEND'], ['stripes', 'STRIPES'], ['checker', 'CHECKER'], ['rainbow', 'RAINBOW'],
];
/** Fill modes the ANGLE slider steers. */
export const SOUL_ANGLED = ['split', 'gradient', 'stripes', 'rainbow'];
/** Fill modes that read only the first colour. */
export const SOUL_ONE_COLOR = ['solid'];

export const SOUL_PRESETS: { name: string; color: string; monster: boolean; fill?: string }[] = [
  { name: 'Vessel', color: '#9e9e9e', monster: false },
  { name: 'Determination', color: '#ff0000', monster: false },
  { name: 'Bravery', color: '#ff8000', monster: false },
  { name: 'Justice', color: '#ffff00', monster: false },
  { name: 'Kindness', color: '#00c000', monster: false },
  { name: 'Patience', color: '#00ffff', monster: false },
  { name: 'Integrity', color: '#0000ff', monster: false },
  { name: 'Perseverance', color: '#d400d4', monster: false },
  { name: 'Monster', color: '#ffffff', monster: true },
  { name: 'Rainbow', color: '#ff0000', monster: false, fill: 'rainbow' },
];
const SPECTRUM = [0, 40, 60, 130, 190, 235, 280, 330];

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const safeColor = (c: unknown, dflt: string) => (typeof c === 'string' && HEX.test(c) ? c : dflt);
const num = (v: unknown, dflt: number) => (Number.isFinite(Number(v)) ? Number(v) : dflt);
const MODES = new Set(SOUL_FILL_MODES.map(m => m[0]));

/** A stored soul with defaults filled in. Old souls carried flat colour pairs (color/color2). */
export function normalizeSoul(raw: Record<string, any> | null | undefined): Soul {
  const s: Soul = { ...SOUL_DEFAULT, ...(raw || {}) } as Soul;
  const pair = (arr: unknown, a: unknown, b: unknown, dflt: string[]) =>
    (Array.isArray(arr) && arr.length ? arr : [a || dflt[0], b || dflt[1]]).filter(c => typeof c === 'string').slice(0, SOUL_MAX_COLORS) as string[];
  s.colors = pair(raw?.['colors'], raw?.['color'], raw?.['color2'], SOUL_DEFAULT.colors);
  s.innerColors = pair(raw?.['innerColors'], raw?.['innerColor'], raw?.['innerColor2'], SOUL_DEFAULT.innerColors);
  if (!s.colors.length) s.colors = SOUL_DEFAULT.colors.slice();
  if (!s.innerColors.length) s.innerColors = SOUL_DEFAULT.innerColors.slice();
  delete s['color']; delete s['color2']; delete s['innerColor']; delete s['innerColor2'];
  return s;
}

export function soulPrimary(s: Soul): string {
  return safeColor(s.colors?.[0], SOUL_DEFAULT.colors[0]);
}

function rects(): string {
  return SOUL_ROWS.map(r => `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/>`).join('');
}

function paint(defs: string[], id: string, mode: string, colors: string[], angle: unknown): string {
  const cs = (colors && colors.length ? colors : ['#000000']).slice(0, SOUL_MAX_COLORS).map(c => safeColor(c, '#000000'));
  const n = cs.length;
  const rot = `gradientTransform="rotate(${num(angle, 0)} 0.5 0.5)"`;
  const grad = (stops: string, x2: string | number, repeat = false) =>
    defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="0"${repeat ? ' spreadMethod="repeat"' : ''} ${rot}>${stops}</linearGradient>`);
  const bands = () => cs.map((c, i) => `<stop offset="${(i / n * 100).toFixed(4)}%" stop-color="${c}"/><stop offset="${((i + 1) / n * 100).toFixed(4)}%" stop-color="${c}"/>`).join('');
  if (mode === 'rainbow') {
    grad(SPECTRUM.map((h, i) => `<stop offset="${(i / (SPECTRUM.length - 1) * 100).toFixed(2)}%" stop-color="hsl(${h},100%,55%)"/>`).join(''), 1);
  } else if (mode === 'solid' || n === 1 || !MODES.has(mode)) {
    return cs[0];
  } else if (mode === 'split') {
    grad(bands(), 1);
  } else if (mode === 'gradient') {
    grad(cs.map((c, i) => `<stop offset="${(i / (n - 1) * 100).toFixed(4)}%" stop-color="${c}"/>`).join(''), 1);
  } else if (mode === 'stripes') {
    grad(bands(), (0.1 * n).toFixed(3), true);
  } else if (mode === 'checker') {
    const cell = 4, tile = cell * n;
    let cells = '';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) cells += `<rect x="${col * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="${cs[(r + col) % n]}"/>`;
    defs.push(`<pattern id="${id}" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">${cells}</pattern>`);
  }
  return `url(#${id})`;
}

/** Five hand-tuned shards from an off-centre impact: the same soul always shatters the same way. */
const FRACTURE = {
  origin: [18, 13] as [number, number],
  reach: 48,
  rays: [{ a: -74, j1: 2.4, j2: -1.7 }, { a: -6, j1: -2.7, j2: 2.1 }, { a: 58, j1: 1.9, j2: -2.5 }, { a: 128, j1: -2.1, j2: 1.6 }, { a: 199, j1: 2.5, j2: -1.9 }],
  twist: [1.4, -1.1, 0.9, -1.5, 1.2],
};

function shards(spread: number): { points: string; tf: string }[] {
  const [ox, oy] = FRACTURE.origin;
  const rays = FRACTURE.rays, R = FRACTURE.reach;
  const pt = (a: number, r: number, off: number): [number, number] => {
    const rad = a * Math.PI / 180, dx = Math.cos(rad), dy = Math.sin(rad);
    return [ox + dx * r - dy * off, oy + dy * r + dx * off];
  };
  const spine = rays.map(r => [pt(r.a, 7.5, r.j1), pt(r.a, 16, r.j2), pt(r.a, R, 0)]);
  return rays.map((ray, i) => {
    const n = (i + 1) % rays.length;
    const a0 = ray.a;
    let a1 = rays[n].a;
    while (a1 <= a0) a1 += 360;
    const steps = Math.max(2, Math.ceil((a1 - a0) / 30));
    const arc: [number, number][] = [];
    for (let k = 1; k < steps; k++) arc.push(pt(a0 + (a1 - a0) * k / steps, R, 0));
    const poly = [[ox, oy], ...spine[i], ...arc, ...spine[n].slice().reverse()];
    const mid = (a0 + a1) / 2 * Math.PI / 180;
    return {
      points: poly.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '),
      tf: `translate(${(Math.cos(mid) * spread).toFixed(2)} ${(Math.sin(mid) * spread).toFixed(2)}) rotate(${(FRACTURE.twist[i] * spread * 0.8).toFixed(2)} ${ox} ${oy})`,
    };
  });
}

let uidSeq = 0;

/** The soul as an SVG string, `px` wide. */
export function buildSoulSvg(soul: Soul, px: number): string {
  const uid = 's' + (++uidSeq);
  const clipId = 'soulclip-' + uid;
  const r = rects();
  const defs = [`<clipPath id="${clipId}">${r}</clipPath>`];

  const bodyPaint = paint(defs, 'soulbody-' + uid, soul.fill, soul.colors, soul.angle);
  let contents = `<rect x="0" y="0" width="40" height="36" fill="${bodyPaint}" clip-path="url(#${clipId})"/>`;
  if (soul.inner) {
    const innerPaint = paint(defs, 'soulinner-' + uid, soul.innerFill, soul.innerColors, soul.innerAngle);
    const sc = Math.max(0.15, Math.min(0.85, num(soul.innerSize, 0.45) || 0.45));
    const iy = (CY + num(soul.innerOffsetY, 0)).toFixed(2);
    const spin = soul.innerMonster ? '<g transform="rotate(180 20 18)">' : '<g>';
    contents += `<g transform="translate(${CX} ${iy}) scale(${sc}) translate(${-CX} ${-CY})">${spin}<rect x="0" y="0" width="40" height="36" fill="${innerPaint}" clip-path="url(#${clipId})"/></g></g>`;
  }
  // hue cycling rides on the paint only, so outline and cracks keep their colour
  if (soul.cycle) contents = `<g class="soul-cycle">${contents}</g>`;

  const outlineLayer = soul.outline
    ? `<g transform="translate(${CX} ${(CY + num(soul.outlineOffsetY, 0)).toFixed(2)}) scale(${(1 + (num(soul.outlineWidth, 2) || 2) * 0.028).toFixed(4)}) translate(${-CX} ${-CY})" fill="${safeColor(soul.outlineColor, '#000000')}">${r}</g>`
    : '';

  let body = '';
  if (soul.cracked) {
    const spread = 0.15 + Math.max(0, Math.min(100, num(soul.crackSpread ?? 45, 45))) / 100 * 1.5;
    body += `<rect x="0" y="0" width="40" height="36" fill="${safeColor(soul.crackColor, '#000000')}" clip-path="url(#${clipId})"/>`;
    shards(spread).forEach((sh, i) => {
      const sid = `soulshard-${uid}-${i}`;
      defs.push(`<clipPath id="${sid}"><polygon points="${sh.points}"/></clipPath>`);
      body += `<g transform="${sh.tf}"><g clip-path="url(#${sid})">${outlineLayer}${contents}</g></g>`;
    });
  } else {
    body += outlineLayer + contents;
  }

  const primary = soulPrimary(soul);
  const glow = Math.max(0, num(soul.glow, 0));
  const g1 = glow * px / 300;
  const style = glow > 0 ? `filter:drop-shadow(0 0 ${g1.toFixed(2)}px ${primary}) drop-shadow(0 0 ${(g1 * 2).toFixed(2)}px ${primary});` : '';
  const spin = soul.monster ? ' transform="rotate(180 20 18)"' : '';
  const w = Math.round(num(px, 72));
  return `<svg class="soul-svg${soul.pulse ? ' beat' : ''}" viewBox="0 0 40 36" width="${w}" height="${Math.round(w * 0.9)}" style="${style}" xmlns="http://www.w3.org/2000/svg"><defs>${defs.join('')}</defs><g${spin}>${body}</g></svg>`;
}

/** "SOLID · NESTED · CRACKED" */
export function soulDesc(s: Soul): string {
  const bits = [(SOUL_FILL_MODES.find(m => m[0] === s.fill) || SOUL_FILL_MODES[0])[1]];
  if (s.cycle) bits.push('CYCLING');
  if (s.inner) bits.push(s.innerMonster ? 'NESTED MONSTER' : 'NESTED');
  if (s.outline) bits.push('OUTLINED');
  if (s.cracked) bits.push('CRACKED');
  if (s.monster) bits.push('MONSTER');
  return bits.join(' · ');
}

/** Which conditional control rows apply to the current soul. */
export function soulWhen(s: Soul, when: string): boolean {
  switch (when) {
    case 'angle': return SOUL_ANGLED.includes(s.fill);
    case 'inner': return !!s.inner;
    case 'innerangle': return !!s.inner && SOUL_ANGLED.includes(s.innerFill);
    case 'outline': return !!s.outline;
    case 'cracked': return !!s.cracked;
    default: return true;
  }
}

export function soulNumLabel(key: string, val: number): string {
  if (key === 'angle' || key === 'innerAngle') return val + '°';
  if (key === 'innerSize') return Math.round(val * 100) + '%';
  if (key === 'innerOffsetY' || key === 'outlineOffsetY') return (val > 0 ? '+' : '') + val;
  return String(val);
}

function hexFromHsl(h: number, sat: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * sat;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  const hx = (v: number) => Math.round(Math.max(0, Math.min(255, (v + m) * 255))).toString(16).padStart(2, '0');
  return '#' + hx(seg[0]) + hx(seg[1]) + hx(seg[2]);
}

export function shiftHue(hex: string, deg: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const l = (mx + mn) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return hexFromHsl((h + deg) % 360, sat, l);
}

/** A new palette slot: 50 degrees on from the last colour, or a fresh hue when the last has none. */
export function nextColor(pal: string[]): string {
  const last = pal[pal.length - 1];
  const shifted = shiftHue(last, 50);
  if (shifted.toLowerCase() !== String(last).toLowerCase()) return shifted;
  return hexFromHsl((pal.length * 47) % 360, 0.85, 0.55);
}
