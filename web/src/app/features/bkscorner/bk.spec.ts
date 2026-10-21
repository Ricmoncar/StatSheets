import { ArtRequest, cardCover, doneLabel, fileTitle, filterRequests, fmtDate, linkChanges, syncNote } from './bk';

const reqs: ArtRequest[] = [
  { id: 'a', completed: true, resultCover: 'R', refCover: 'F' },
  { id: 'b', completed: false, refCover: 'F' },
  { id: 'c', completed: true, refCover: 'F' },
];

describe("BK's Corner", () => {
  it('filters and counts requests', () => {
    expect(filterRequests(reqs, 'all').length).toBe(3);
    expect(filterRequests(reqs, 'pending').map(r => r.id)).toEqual(['b']);
    expect(filterRequests(reqs, 'completed').map(r => r.id)).toEqual(['a', 'c']);
    expect(doneLabel(reqs)).toBe('2/3 DONE');
    expect(doneLabel([])).toBe('');
  });

  it('covers a card with the finished art once there is some', () => {
    expect(reqs.map(cardCover)).toEqual(['R', 'F', 'F']);
    expect(cardCover({ id: 'x' })).toBe('');
  });

  it('works out which character galleries change', () => {
    expect(linkChanges(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], remove: ['a'], stay: ['b'] });
    expect(linkChanges(undefined, ['x'])).toEqual({ add: ['x'], remove: [], stay: [] });
  });

  it('words things as the old page did', () => {
    expect(fmtDate(new Date(2026, 5, 8).getTime())).toBe('6/8/26');
    expect(syncNote(1)).toBe('Linked to 1 character: this image appears on its Gallery page.');
    expect(syncNote(2)).toBe('Linked to 2 characters: this image appears on their Gallery pages.');
    expect(fileTitle('art.final.png')).toBe('art.final');
  });
});
