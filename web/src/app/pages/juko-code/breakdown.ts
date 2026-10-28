// JUKO! 0∞: the parts of the breakdown that are the page itself rather than
// pixels over it. After the drop the whole app gets kicked on a beat (a
// short shove that rings out, never a tilt, and never with reduced motion).
// Little corrupted windows open around the edges of the sheet (her portrait
// through broken filters, stderr, a stack trace, a hex dump, a progress bar
// that never gets there), sit there tearing now and then, and close. ATK,
// DEF, MAG and IQ read ∞ (the chrome draws it) and flash her real number for
// a moment, like the display cannot hold infinity.
import { sfx } from '../kit/sound';
import { ERRORS, pick } from './look';

type Kind = 'pfp' | 'err' | 'trace' | 'hex' | 'load';
const KINDS: Kind[] = ['pfp', 'pfp', 'err', 'trace', 'hex', 'load'];
const TITLES: Record<Kind, string[]> = {
  pfp: ['juko.exe', 'render0.dll', 'self.png'],
  err: ['stderr', 'exception.log', 'PANIC'],
  trace: ['stack.trace', 'call_0.inf', 'unwind'],
  hex: ['heapdump.bin', '0x00000000', 'core'],
  load: ['loop.sys', 'resolving...', 'NUL'],
};
const FILTERS = [
  'invert(1) hue-rotate(90deg) saturate(3)',
  'saturate(5) contrast(2.2) hue-rotate(40deg)',
  'hue-rotate(140deg) brightness(1.5) contrast(1.6)',
  'saturate(4) hue-rotate(-40deg) contrast(1.4)',
  'contrast(3) invert(1) hue-rotate(120deg)',
  'saturate(6) hue-rotate(200deg) brightness(1.3)',
];
const STATS = ['atk', 'def', 'mag', 'iq'];
/** What the kick shoves: the app's frame, not the layers over it. */
const SHELL = ['header.topbar', 'main.page', 'ss-theme-bar'];
const hexes = (n: number) => Array.from({ length: n }, () => '0123456789ABCDEF'[(Math.random() * 16) | 0]).join('');

interface Win { el: HTMLElement; kind: Kind; die: number }

export class Breakdown {
  private on = false;
  private wins: Win[] = [];
  private nextWin = 0; private nextTear = 0; private nextStat = 0;
  private kick = { t0: -99, dur: 0.4, tx: 0, ty: 0 };
  private kicked = false;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private calm: MediaQueryList | null = null;

  /** A frame of the breakdown at `tt` seconds (performance.now based). */
  tick(tt: number, sev: number, dropped: boolean, beat: number): void {
    if (!this.on) { this.on = true; this.nextWin = this.nextTear = this.nextStat = 0; this.kick = { t0: -99, dur: 0.4, tx: 0, ty: 0 }; }

    // the kick: on a beat (with a floor of random hits when nothing plays), and always a gap after it
    const k = this.kick, age = tt - k.t0;
    const calm = (this.calm ??= matchMedia('(prefers-reduced-motion: reduce)')).matches;
    if (dropped && !calm && age > k.dur + 0.75 && (beat > 0.62 ? Math.random() < 0.5 : Math.random() < 0.004 + sev * 0.006)) {
      const a = Math.random() * Math.PI * 2, mag = 5 + sev * 13;
      this.kick = { t0: tt, dur: 0.3 + Math.random() * 0.16, tx: Math.cos(a) * mag, ty: Math.sin(a) * mag * 0.55 };
    }
    const kk = this.kick, ka = tt - kk.t0;
    if (ka < kk.dur) {
      const p = ka / kk.dur, env = (1 - p) * (1 - p) * Math.cos(p * 13.5);
      this.shove(`translate(${(kk.tx * env).toFixed(2)}px,${(kk.ty * env).toFixed(2)}px)`);
    } else if (this.kicked) this.shove('');

    // the windows: they open, sit there, and close
    const want = Math.round(sev * 4);
    for (let i = this.wins.length - 1; i >= 0; i--) {
      const w = this.wins[i];
      if (tt > w.die || this.wins.length > want + 1) { this.wins.splice(i, 1); this.close(w.el); }
    }
    if (tt > this.nextWin) {
      this.nextWin = tt + (dropped ? 0.7 + Math.random() * 1.1 : 1.8 + Math.random() * 2.2);
      if (this.wins.length < want && this.open(tt, sev)) sfx('pop', { rate: 0.42 + Math.random() * 0.12, volume: 0.18 });
    }
    // now and then the picture inside one tears sideways for a moment
    if (tt > this.nextTear && this.wins.length) {
      this.nextTear = tt + (dropped ? 0.45 + Math.random() * 0.7 : 1.1 + Math.random() * 1.2);
      const el = this.wins[(Math.random() * this.wins.length) | 0].el;
      el.style.setProperty('--jw-tear', ((Math.random() - 0.5) * 26).toFixed(1) + 'px');
      el.classList.add('tear');
      this.later(() => el.classList.remove('tear'), 130);
    }
    // ∞ flashes back to her real number
    if (tt > this.nextStat) {
      this.nextStat = tt + (dropped ? 0.5 + Math.random() * 1.1 : 1.6 + Math.random() * 2.4);
      const row = document.querySelector<HTMLElement>(`ss-character-view .bars .row[data-stat='${pick(STATS)}']`);
      if (row && !row.hasAttribute('data-flash')) {
        row.setAttribute('data-flash', '');
        this.later(() => row.removeAttribute('data-flash'), 80 + Math.random() * (140 + sev * 200));
      }
    }
  }

  /** Lets go of everything; `hard` drops it this instant rather than letting the windows collapse. */
  stop(hard: boolean): void {
    if (!this.on && !this.wins.length && !this.kicked) return;
    this.on = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const r of document.querySelectorAll('ss-character-view .bars .row[data-flash]')) r.removeAttribute('data-flash');
    if (this.kicked) this.shove('');
    const wins = this.wins;
    this.wins = [];
    for (const w of wins) {
      if (hard) w.el.remove();
      else { w.el.classList.add('out'); setTimeout(() => w.el.remove(), 300); }
    }
  }

  private shove(transform: string): void {
    this.kicked = !!transform;
    for (const sel of SHELL) { const el = document.querySelector<HTMLElement>(sel); if (el) el.style.transform = transform; }
  }
  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  private open(tt: number, sev: number): boolean {
    const up = this.wins.map(w => w.kind);
    let kind: Kind = 'err';
    for (let i = 0; i < 6; i++) { kind = pick(KINDS); if (!up.includes(kind)) break; }
    const avatar = document.querySelector<HTMLImageElement>('ss-character-view .head .portrait img')?.src;
    if (kind === 'pfp' && !avatar) kind = 'err';
    const el = document.createElement('div');
    el.className = 'pg-jk0-win ' + kind;
    el.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = '<span class="title"></span><span class="x">X</span>';
    bar.firstElementChild!.textContent = pick(TITLES[kind]);
    const body = document.createElement('div');
    body.className = 'body ' + (kind === 'pfp' || kind === 'load' ? kind : 'text');
    if (kind === 'pfp') {
      const img = document.createElement('img');
      img.src = avatar!; img.alt = ''; img.style.filter = pick(FILTERS);
      body.appendChild(img);
    } else {
      const lines: [string, boolean][] = kind === 'err' ? Array.from({ length: 5 }, () => [pick(ERRORS), Math.random() < 0.34])
        : kind === 'trace' ? [['at juko.loop ()', true], ...Array.from({ length: 5 }, (): [string, boolean] => [`  at loop (0:${hexes(2)})`, false]), ['  ... 0 more', false]]
        : kind === 'hex' ? Array.from({ length: 6 }, (): [string, boolean] => [`${hexes(4)} ${hexes(4)} ${hexes(4)}`, false])
        : [['resolving 0 / 0', false], ['', false], ['∞%', true]];
      for (const [s, hot] of lines) {
        const d = document.createElement('div');
        d.className = 'line' + (hot ? ' hot' : '');
        if (kind === 'load' && !s) { d.className = 'track'; d.innerHTML = '<i></i>'; } else d.textContent = s;
        body.appendChild(d);
      }
      if (kind === 'hex') body.classList.add('hex');
    }
    el.append(bar, body);
    // placed once, round the middle (where she is): the side gutters, or along the bottom
    const VW = innerWidth || 1280, VH = innerHeight || 720, sz = 96 + Math.random() * (VW < 760 ? 60 : 128), h = sz * 0.9, band = Math.random();
    let x: number, y: number;
    if (band < 0.4) { x = Math.random() * Math.max(1, VW * 0.26 - sz * 0.4) - sz * 0.18; y = VH * 0.1 + Math.random() * Math.max(1, VH * 0.74 - h); }
    else if (band < 0.8) { x = VW * 0.62 + Math.random() * Math.max(1, VW * 0.42 - sz * 0.6); y = VH * 0.08 + Math.random() * Math.max(1, VH * 0.76 - h); }
    else { x = Math.random() * Math.max(1, VW - sz); y = VH * 0.7 + Math.random() * Math.max(1, VH * 0.28 - h * 0.5); }
    // on the art grid, like everything else
    const px = VW <= 720 ? 2 : 3, snap = (v: number) => Math.round(v / px) * px;
    el.style.width = snap(sz) + 'px'; el.style.left = snap(x) + 'px'; el.style.top = snap(y) + 'px';
    el.style.setProperty('--jw-drift', (3.2 + Math.random() * 3.4).toFixed(2) + 's');
    el.style.setProperty('--jw-delay', (-Math.random() * 3).toFixed(2) + 's');
    document.body.appendChild(el);
    this.wins.push({ el, kind, die: tt + (2.6 + Math.random() * 3.4) * (1.4 - sev * 0.5) });
    return true;
  }
  private close(el: HTMLElement): void {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }
}
