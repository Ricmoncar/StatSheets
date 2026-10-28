// A page that moves to its character's song. The theme plays on the app's own
// audio element, which is left alone (wiring it into an analyser can silence
// it for good when the file is on another origin); instead a copy of the same
// bundled file is decoded once and reduced to a loudness envelope, and the
// page reads it at the element's current time. Steady passages sit near zero
// and hits spike (the old pages' AC-coupled "beat"); with no envelope, a
// gentle made-up one keeps time with the playback.
import { environment } from '../../../environments/environment';
import { themeAudio } from '../../core/theme-music.service';

interface Envelope { bps: number; env: Float32Array; flux: Float32Array }

let ac: AudioContext | null = null;
const cache = new Map<string, Promise<Envelope | null>>();

function envelope(file: string): Promise<Envelope | null> {
  let p = cache.get(file);
  if (!p) {
    p = (async () => {
      try {
        ac ??= new AudioContext();
        const r = await fetch(environment.assetBase + file);
        if (!r.ok) return null;
        const buf = await ac.decodeAudioData(await r.arrayBuffer());
        const bps = 30, win = Math.max(1, Math.floor(buf.sampleRate / bps));
        const c0 = buf.getChannelData(0), c1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
        const n = Math.floor(c0.length / win), env = new Float32Array(n), flux = new Float32Array(n);
        let mx = 1e-6, fmx = 1e-6;
        for (let i = 0; i < n; i++) {
          let s = 0;
          for (let j = 0, o = i * win; j < win; j++) { let v = c0[o + j]; if (c1) v = (v + c1[o + j]) * 0.5; s += v * v; }
          env[i] = Math.sqrt(s / win);
          if (env[i] > mx) mx = env[i];
        }
        for (let i = 0; i < n; i++) env[i] /= mx;
        for (let i = 1; i < n; i++) { const d = Math.max(0, env[i] - env[i - 1]); flux[i] = d; if (d > fmx) fmx = d; }
        for (let i = 0; i < n; i++) flux[i] = Math.min(1, flux[i] / fmx);
        return { bps, env, flux };
      } catch { return null; }
    })();
    cache.set(file, p);
  }
  return p;
}

export class SongPulse {
  /** Smoothed loudness, onset strength, the slow baseline and the beat (how far above it), all 0..1. */
  level = 0; onset = 0; base = 0; beat = 0;
  playing = false;
  private env: Envelope | null = null;
  private file = '';

  /** `file` is the bundled copy (under sounds/) of the song to follow. */
  follow(file: string): void {
    if (file === this.file) return;
    this.file = file; this.env = null;
    envelope(file).then(e => { if (this.file === file) this.env = e; });
  }

  /** Whether the theme now playing is this file. */
  isPlaying(file = this.file): boolean {
    const a = themeAudio.el;
    return !!a && !a.paused && !a.ended && a.src.endsWith(file);
  }
  /** The song's own clock, while it is this file playing. */
  time(): number | null { const a = themeAudio.el; return this.isPlaying() && a ? a.currentTime : null; }

  sample(dt: number): void {
    const a = themeAudio.el;
    const playing = this.playing = !!(a && !a.paused && !a.ended && a.currentTime > 0);
    let target = 0, onset = 0;
    if (playing && a) {
      const e = this.env && this.isPlaying() ? this.env : null;
      if (e) {
        const i = Math.floor(a.currentTime * e.bps);
        if (i >= 0 && i < e.env.length) { target = e.env[i]; onset = e.flux[i]; }
      } else {
        const tt = a.currentTime;
        target = Math.max(0, Math.min(1, 0.5 + 0.25 * Math.sin(tt * 6.3) + 0.15 * Math.sin(tt * 9.4) + 0.12 * Math.sin(tt * 3.1)));
        onset = Math.max(0, Math.sin(tt * 6.3)) * 0.3;
      }
    }
    this.level += (target - this.level) * Math.min(1, dt * (target > this.level ? 30 : 14));
    this.onset = Math.max(this.onset * (1 - Math.min(1, dt * 7)), onset);
    this.base += (this.level - this.base) * Math.min(1, dt * 0.7);
    const beat = Math.min(1, Math.max(0, this.level - this.base) * 3.4 + this.onset * 0.95);
    this.beat = beat > this.beat ? beat : this.beat + (beat - this.beat) * Math.min(1, dt * 6);
  }
}
