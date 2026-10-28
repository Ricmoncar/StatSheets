// A page's sound effects: the old pages called playSound; this plays the same
// files from sounds/ at the site's own volume, and not at all while muted (the
// same settings SoundService keeps).
import { environment } from '../../../environments/environment';

export function sfx(name: string, { rate = 1, volume = 1 }: { rate?: number; volume?: number } = {}): void {
  try {
    if (localStorage.getItem('sfx_muted') === '1') return;
    const v = Number(localStorage.getItem('sfx_volume') ?? 1);
    const a = new Audio(`${environment.assetBase}sounds/${name}.mp3`);
    a.volume = Math.max(0, Math.min(1, volume * (Number.isFinite(v) ? v : 1)));
    a.playbackRate = Math.max(0.1, Math.min(4, rate));
    a.play().catch(() => { /* no sound before the first interaction */ });
  } catch { /* storage or audio unavailable */ }
}
