// A character's playlist (playlists/{charId}), ported from the old
// playlists.html. The play queue holds song ids, so reordering or deleting
// songs keeps it pointing at the right ones.

export interface Song { id: string; title: string; url: string; duration: number | null }
export interface Playlist { title: string; description: string; image: string | null; songs: Song[] }

export const UNTITLED = 'Untitled Playlist';

export function emptyPlaylist(charName: string | undefined): Playlist {
  return { title: `${charName || 'Unknown'}'s Playlist`, description: '', image: null, songs: [] };
}

/** A stored document (or nothing) as a playlist; anything malformed falls back to the defaults. */
export function fromDoc(raw: Record<string, unknown> | undefined, charName: string | undefined): Playlist {
  if (!raw) return emptyPlaylist(charName);
  const songs = Array.isArray(raw['songs']) ? (raw['songs'] as Partial<Song>[]) : [];
  return {
    title: typeof raw['title'] === 'string' ? raw['title'] : '',
    description: typeof raw['description'] === 'string' ? raw['description'] : '',
    image: typeof raw['image'] === 'string' && raw['image'] ? raw['image'] : null,
    songs: songs.filter(s => s && typeof s === 'object').map(s => ({
      id: String(s.id || ''), title: String(s.title || ''), url: String(s.url || ''),
      duration: typeof s.duration === 'number' && s.duration > 0 ? s.duration : null,
    })),
  };
}

/** The document as the old page saved it (a full set). */
export function toDoc(p: Playlist, now: number) {
  return {
    title: p.title || '',
    description: p.description || '',
    image: p.image || null,
    songs: p.songs.map(s => ({ id: s.id || '', title: s.title || '', url: s.url || '', duration: s.duration || null })),
    updatedAt: now,
  };
}

export function songId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** A file name without its extension, as a song title. */
export function titleFromFile(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

/** "M:SS", or "H:MM:SS" past an hour; nothing gives 0:00. */
export function fmtDuration(sec: number | null | undefined): string {
  if (!sec || isNaN(sec)) return '0:00';
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function totalSeconds(p: Playlist): number {
  return p.songs.reduce((a, s) => a + (s.duration || 0), 0);
}

/** Fisher-Yates, as on the old page. */
export function shuffle<T>(list: T[], rand = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Queue { ids: string[]; pos: number }

/** The queue for playing song `idx`: in list order, or that song first and the rest shuffled. */
export function queueFrom(songs: Song[], idx: number, shuffled: boolean, rand = Math.random): Queue {
  const ids = songs.map(s => s.id);
  if (!ids.length) return { ids: [], pos: 0 };
  idx = Math.max(0, Math.min(ids.length - 1, idx));
  if (shuffled) return { ids: [ids[idx], ...shuffle(ids.filter((_, i) => i !== idx), rand)], pos: 0 };
  return { ids, pos: idx };
}

/** After the last song: a fresh shuffle when shuffling, else back to the first. */
export function nextInQueue(q: Queue, songs: Song[], shuffled: boolean, rand = Math.random): Queue {
  if (!q.ids.length) return q;
  if (q.pos + 1 < q.ids.length) return { ids: q.ids, pos: q.pos + 1 };
  if (shuffled && songs.length > 1) return { ids: shuffle(songs.map(s => s.id), rand), pos: 0 };
  return { ids: q.ids, pos: 0 };
}

export function prevInQueue(q: Queue): Queue {
  if (!q.ids.length) return q;
  return { ids: q.ids, pos: (q.pos - 1 + q.ids.length) % q.ids.length };
}

/** Shuffle switched on or off mid-play: the current song stays and the rest follow the new order. */
export function reshuffle(q: Queue, songs: Song[], shuffled: boolean, rand = Math.random): Queue {
  const cur = q.ids[q.pos];
  if (!q.ids.length || cur === undefined) return q;
  const ids = songs.map(s => s.id);
  if (shuffled) return { ids: [cur, ...shuffle(ids.filter(id => id !== cur), rand)], pos: 0 };
  return { ids, pos: Math.max(0, ids.indexOf(cur)) };
}

/** The songs with one moved from `from` to `to`. */
export function moveSong(songs: Song[], from: number, to: number): Song[] {
  const a = [...songs];
  if (from === to || from < 0 || from >= a.length || to < 0 || to >= a.length) return a;
  const [m] = a.splice(from, 1);
  a.splice(to, 0, m);
  return a;
}

/** After a reorder: list order follows the list; a shuffled queue keeps its order. */
export function afterReorder(q: Queue, songs: Song[], shuffled: boolean): Queue {
  if (!q.ids.length || shuffled) return q;
  const cur = q.ids[q.pos];
  const ids = songs.map(s => s.id);
  return { ids, pos: Math.max(0, ids.indexOf(cur)) };
}

/** After a song is removed: it leaves the queue, which keeps pointing at the same song where it can. */
export function afterRemove(q: Queue, id: string): Queue {
  const i = q.ids.indexOf(id);
  if (i < 0) return q;
  const ids = q.ids.filter(x => x !== id);
  const pos = i < q.pos ? q.pos - 1 : Math.min(q.pos, Math.max(0, ids.length - 1));
  return { ids, pos };
}
