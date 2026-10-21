import { afterRemove, afterReorder, emptyPlaylist, fmtDuration, fromDoc, moveSong, nextInQueue, prevInQueue, queueFrom, reshuffle, titleFromFile, toDoc, Song } from './playlist';

const songs: Song[] = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id.toUpperCase(), url: 'u/' + id, duration: null }));
// a "random" that always picks the first slot, so a shuffle is a fixed permutation
const first = () => 0;

describe('playlist', () => {
  it('reads stored documents the way the old page did', () => {
    expect(fromDoc(undefined, 'Katie')).toEqual(emptyPlaylist('Katie'));
    expect(emptyPlaylist(undefined).title).toBe("Unknown's Playlist");
    const p = fromDoc({ title: 'T', songs: [{ id: 'x', title: 'X', url: 'u', duration: 61 }, { id: 'y', url: 'v' }], image: '' }, 'K');
    expect(p).toEqual({ title: 'T', description: '', image: null, songs: [
      { id: 'x', title: 'X', url: 'u', duration: 61 }, { id: 'y', title: '', url: 'v', duration: null },
    ] });
    expect(fromDoc({ songs: 'nope' }, 'K').songs).toEqual([]);
    expect(toDoc(p, 5)).toEqual({ ...p, updatedAt: 5 });
  });

  it('formats durations and titles', () => {
    expect(fmtDuration(null)).toBe('0:00');
    expect(fmtDuration(65)).toBe('1:05');
    expect(fmtDuration(3725.9)).toBe('1:02:05');
    expect(titleFromFile('My Song.final.mp3')).toBe('My Song.final');
  });

  it('builds the queue in order or shuffled with the chosen song first', () => {
    expect(queueFrom(songs, 2, false)).toEqual({ ids: ['a', 'b', 'c', 'd'], pos: 2 });
    expect(queueFrom(songs, 9, false).pos).toBe(3);
    const q = queueFrom(songs, 2, true, first);
    expect(q.pos).toBe(0);
    expect(q.ids[0]).toBe('c');
    expect([...q.ids].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(queueFrom([], 0, true)).toEqual({ ids: [], pos: 0 });
  });

  it('moves through the queue, wrapping or reshuffling at the end', () => {
    const q = { ids: ['a', 'b', 'c', 'd'], pos: 3 };
    expect(nextInQueue({ ...q, pos: 1 }, songs, false)).toEqual({ ids: q.ids, pos: 2 });
    expect(nextInQueue(q, songs, false)).toEqual({ ids: q.ids, pos: 0 });
    const re = nextInQueue(q, songs, true, first);
    expect(re.pos).toBe(0);
    expect([...re.ids].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(prevInQueue({ ids: q.ids, pos: 0 })).toEqual({ ids: q.ids, pos: 3 });
  });

  it('keeps the current song when shuffle is toggled', () => {
    const on = reshuffle({ ids: ['a', 'b', 'c', 'd'], pos: 1 }, songs, true, first);
    expect(on.ids[on.pos]).toBe('b');
    expect(on.pos).toBe(0);
    expect(reshuffle(on, songs, false)).toEqual({ ids: ['a', 'b', 'c', 'd'], pos: 1 });
  });

  it('reorders songs and keeps the queue on the same song', () => {
    const moved = moveSong(songs, 0, 2);
    expect(moved.map(s => s.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveSong(songs, 0, 9)).toEqual(songs);
    expect(afterReorder({ ids: ['a', 'b', 'c', 'd'], pos: 0 }, moved, false)).toEqual({ ids: ['b', 'c', 'a', 'd'], pos: 2 });
    const shuf = { ids: ['d', 'a', 'c', 'b'], pos: 1 };
    expect(afterReorder(shuf, moved, true)).toBe(shuf);
  });

  it('drops removed songs from the queue', () => {
    expect(afterRemove({ ids: ['a', 'b', 'c'], pos: 2 }, 'a')).toEqual({ ids: ['b', 'c'], pos: 1 });
    expect(afterRemove({ ids: ['a', 'b', 'c'], pos: 0 }, 'c')).toEqual({ ids: ['a', 'b'], pos: 0 });
    expect(afterRemove({ ids: ['a', 'b', 'c'], pos: 2 }, 'c')).toEqual({ ids: ['a', 'b'], pos: 1 });
    expect(afterRemove({ ids: ['a'], pos: 0 }, 'z')).toEqual({ ids: ['a'], pos: 0 });
  });
});
