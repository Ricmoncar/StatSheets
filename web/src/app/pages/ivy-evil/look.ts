// IVY · EVIL CREATURE: the palette, the sprites, and the one clock both
// layers keep time by.
//
// THE CLAIM. A rococo ballroom where the party is long over and something is
// still dancing. Every inch of gilt has gone to blood, the chandelier burns
// red and drips, the floor is polished black and red and gives everything
// back upside down, and the moon behind the rose window is the colour of
// the rest of it. Elegance on top, hunger underneath, and the hunger is
// winning.
//
// ONE LIGHT, AND ITS RIVAL. The moon is behind the rose window, so the room
// is backlit: the glass glows, the chandelier hangs in front of it as a
// silhouette, and the moonlight falls in a cone onto the floor. The candles
// are the only light on the near side of anything.
//
// TWO COLOURS AND A THIRD FOR CUTTING. Red-black and red, and white kept for
// the edges that open things: the keys, the candles, the crystal, the blade.
// Blood is its own ramp, so when the colour drains out of the room, the
// blood is the one thing that keeps it.
import { mix, grey, sprite, table } from '../raster';

const HEX: [string, string][] = [
  ['', ''],
  // K: the dark of the room, lacquer and velvet in shadow (warm black)
  ['k0', '#040102'], ['k1', '#0c0407'], ['k2', '#16080d'], ['k3', '#241017'], ['k4', '#3a1a23'],
  // R: everything that was gilt once
  ['r0', '#2b050c'], ['r1', '#4a0a14'], ['r2', '#74101f'], ['r3', '#a6162b'], ['r4', '#d61c30'], ['r5', '#ff564a'], ['r6', '#ffa08a'],
  // B: blood
  ['b0', '#55060f'], ['b1', '#93101f'], ['b2', '#d0142b'], ['b3', '#ff3d4d'],
  // W: bone and white
  ['w0', '#6f5a60'], ['w1', '#c9b3b6'], ['w2', '#ffe9ea'], ['w3', '#ffffff'],
  // F: flame
  ['f0', '#ff5a1e'], ['f1', '#ffa53c'], ['f2', '#ffe7a0'],
  // N: the night outside, cold against the warm room
  ['n0', '#06040e'], ['n1', '#0f0a20'], ['n2', '#1b1134'], ['n3', '#2c1642'], ['n4', '#46194a'],
  // G: stained glass, wine to rose
  ['g0', '#2a0515'], ['g1', '#5e0a28'], ['g2', '#a3143c'], ['g3', '#e3335a'], ['g4', '#ff8399'], ['g5', '#ffcbd4'],
  // M: the moon
  ['m0', '#6a0f17'], ['m1', '#bf2a1f'], ['m2', '#ff6a45'], ['m3', '#ffc7a2'],
];

/** Palette index by name. */
export const C: Record<string, number> = Object.fromEntries(HEX.map(([n], i) => [n, i]).filter(([n]) => n));
export const N_COLOURS = HEX.length;
/** The palette as it is, before any event touches it. */
export const BASE = table(HEX.map(([, h]) => h));

/** Every index's neighbour one step lighter and one step darker in its own ramp. */
export const UP = new Uint8Array(N_COLOURS), DN = new Uint8Array(N_COLOURS);
for (const ramp of ['k', 'r', 'b', 'w', 'f', 'n', 'g', 'm']) {
  const ids = HEX.map(([n], i) => [n, i] as const).filter(([n]) => n && n[0] === ramp).map(([, i]) => i);
  ids.forEach((id, k) => { UP[id] = ids[Math.min(ids.length - 1, k + 1)]; DN[id] = ids[Math.max(0, k - 1)]; });
}
/** `n` steps lighter (or darker for negative n). */
export function shift(i: number, n: number): number {
  for (; n > 0; n--) i = UP[i];
  for (; n < 0; n++) i = DN[i];
  return i;
}
const inRamp = (i: number, r: string) => HEX[i][0][0] === r;

// ── sprites ──
const S = (g: string, m: Record<string, string>) => sprite(g, Object.fromEntries(Object.entries(m).map(([k, v]) => [k, C[v]])));
const ROSEMAP = { o: 'r1', d: 'r2', m: 'r4', l: 'r5', h: 'r6', k: 'k4' };
export const ROSE5 = S(`
.omo.
omlmo
mlhdm
omdmo
.omo.`, ROSEMAP);
export const ROSE7 = S(`
..ooo..
.odmmo.
odmllmo
omlhdmo
omdlmmo
.ommmo.
..ooo..`, ROSEMAP);
/** A rose bud and an open rose, for the vines (the bud first). */
export const BUD = S(`
.m.
odo
.o.`, ROSEMAP);
export const FLAME = [`
.h.
.h.
mhm
mhm
lml
.l.`, `
h..
.h.
mhm
mhm
lml
.l.`, `
..h
.h.
mhm
mhm
lml
.l.`].map(g => S(g, { h: 'f2', m: 'f1', l: 'f0' }));
export const FLAME_SM = [`
.h
mh
lm`, `
h.
hm
ml`].map(g => S(g, { h: 'f2', m: 'f1', l: 'f0' }));
export const SPLASH = [`
..b..
.bBb.`, `
b...b
.bBb.`, `
b...b
.....
.b.b.`].map(g => S(g, { b: 'b2', B: 'b3' }));
export const EYE = S(`
.eEe.
eEWEe
.eEe.`, { e: 'b1', E: 'b3', W: 'w3' });
/** A capital's volute, the left one (mirror for the right). */
export const VOLUTE = S(`
.ddddd.
dlllmmd
dmoodmd
dmdldmd
.dmmmd.
..ddd..`, { d: 'r1', l: 'r4', m: 'r3', o: 'r2' });
/** The cartouche on top of each window. */
export const CARTOUCHE = S(`
...l...
..lml..
.lmdml.
lmd.dml
.ld.dl.
..ddd..`, { l: 'r4', m: 'r3', d: 'r1' });
/** The figure in the mirror: her silhouette, which is not in the room. */
export const FIGURE = S(`
..oo.....oo..
.oooo...oooo.
oooooooooooo.
.ooooooooooo.
..ooooooooo..
..oo.eo.eo...
..oooooooo...
...oooooo....
.oooooooooo..
oooooooooooo.
oooooooooooo.
.oooooooooo..
..oooooooo...
...oooooo....
...oooooo....
..oooooooo...
.oooooooooo..
.oooooooooooo
oooooooooooo.
ooooooooooooo
oooooooooooo.
.o.o.o.o.o.o.
....o..o.....
....o..o.....`, { o: 'k0', e: 'b3' });

// ── the clock ──
export type EventName = 'lunge' | 'bleed' | 'sweep' | 'bloom' | 'hunger' | 'waltz' | 'shatter' | 'mirror';
const EVENTS: [EventName, number][] = [
  ['lunge', 1.0],     // a cut across the whole window
  ['bleed', 4.2],     // the colour drains out of everything but the blood, and floods back
  ['sweep', 4.0],     // the chandelier swings, and the light goes with it
  ['bloom', 6.5],     // thorned roses grow over the room and the frame, open, and wither
  ['hunger', 4.6],    // the candles go out one by one; something looks back; all relight at once
  ['waltz', 6.5],     // two of them turn across the floor, and the floor has them too
  ['shatter', 3.4],   // the rose window cracks, sheds glass, and mends
  ['mirror', 4.0],    // there is someone in the mirror who is not in the room
];
const VIOLENT = new Set<EventName>(['lunge', 'shatter', 'hunger']);
const rnd = (i: number) => { const x = Math.sin(i * 91.7 + 47.13) * 43758.5453; return x - Math.floor(x); };

export interface Happening { name: EventName; t0: number; d: number; p: number; r0: number; r1: number; r2: number }

/**
 * The page's one clock, ticked by whichever layer draws first in a frame:
 * the heartbeat (two thumps, then a wait), the scheduled events (one at a
 * time, every few seconds, never the same twice running), and the colour
 * table everything is shown through.
 */
export class Clock {
  t = 0;
  /** 0..1, peaks on each thump. */
  pulse = 0;
  /** Counts thumps; a layer reacts once per new count. */
  thumps = 0;
  ev: Happening | null = null;
  /** What the events are doing to the world, 0..1. */
  drain = 0; dark = 0; swing = 0; flash = 0;
  /** The colours to show with this frame. */
  readonly colours = BASE.slice();
  readonly still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private last = -1;
  private next = 0;
  private lastName: EventName | '' = '';
  private hb = 0;
  /** Starts an event now (a click can ask for a cut, a test for anything). */
  force: EventName | null = null;

  tick(t: number): void {
    if (t === this.last) return;
    const dt = this.last < 0 ? 0.016 : Math.min(0.1, Math.max(0, t - this.last));
    this.last = t;
    this.t = t;

    // the heartbeat: two thumps a beat, the second softer, at 42 a minute
    const ph = (t * 0.70) % 1;
    const was = this.hb;
    this.hb = ph;
    if ((was > ph) || (was < 0.17 && ph >= 0.17)) this.thumps++;
    this.pulse = Math.max(Math.exp(-ph * 14), Math.exp(-Math.max(0, ph - 0.17) * 14) * 0.66);

    // the events
    let e = this.ev;
    if (this.force && e) this.ev = e = null;   // a forced event does not wait its turn
    if (e) { e.p = (t - e.t0) / e.d; if (e.p >= 1) { this.ev = e = null; this.next = t + 4 + rnd(t * 13.1) * 5; } }
    if (!e && this.next === 0) this.next = t + 3 + rnd(t) * 2;
    if (!e && (this.force || t >= this.next)) {
      let pick: [EventName, number] | undefined = this.force ? EVENTS.find(x => x[0] === this.force) : undefined;
      for (let k = 0; !pick && k < 16; k++) {
        const c = EVENTS[Math.floor(rnd(t * 7.7 + k * 3.1) * EVENTS.length)];
        if (c[0] !== this.lastName && !(this.still && VIOLENT.has(c[0]))) pick = c;
      }
      this.force = null;
      if (pick) {
        this.lastName = pick[0];
        this.ev = e = { name: pick[0], t0: t, d: pick[1], p: 0, r0: rnd(t * 17.7), r1: rnd(t * 29.3), r2: rnd(t * 41.9) };
      }
    }
    const k = Math.min(1, dt * 4);
    const is = (n: EventName) => e?.name === n;
    const p = e?.p ?? 0;
    this.drain = is('bleed') ? (p < 0.25 ? p / 0.25 : p < 0.62 ? 1 : 1 - (p - 0.62) / 0.38) : this.drain * (1 - k);
    this.dark = is('hunger') ? (p < 0.72 ? Math.min(1, p / 0.6) : 0) : this.dark * (1 - k * 2);
    this.flash = is('hunger') && p >= 0.72 ? Math.pow(1 - (p - 0.72) / 0.28, 2) : 0;
    this.swing = is('sweep') ? Math.sin(p * Math.PI * 3) * Math.sin(Math.PI * p) : this.swing * (1 - k);
    this.paint();
  }

  /** The colour table for this frame: the glass and the moon breathe on the pulse, events drain, darken and flash. */
  private paint(): void {
    const c = this.colours;
    c.set(BASE);
    const glow = this.pulse * 0.45 * (1 - this.dark);
    for (let i = 1; i < N_COLOURS; i++) {
      let v = c[i];
      if ((inRamp(i, 'g') || inRamp(i, 'm')) && glow > 0.01) v = mix(v, BASE[UP[i]], glow);
      if (this.drain > 0.01 && !inRamp(i, 'b')) v = mix(v, grey(v), this.drain);
      if (this.dark > 0.01 && !inRamp(i, 'b') && i !== C['w3']) v = mix(v, BASE[C['k0']], this.dark * 0.88);
      if (this.flash > 0.01) v = mix(v, BASE[UP[UP[i]]], this.flash * 0.7);
      c[i] = v;
    }
  }
}

/** The one clock for the page, shared by the hall and the overlay. */
export const clock = new Clock();
