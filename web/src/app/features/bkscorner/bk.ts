// BK's Corner (the old bkscorner.html): art requests with their reference
// images and finished art, and a shared image board whose pictures can be
// linked to characters, which mirrors them into those characters' galleries.
import { compressImage, readAsDataURL } from '../../core/media';

/** art_requests/{id}; the images live in its `images` subcollection. */
export interface ArtRequest {
  id: string;
  title?: string;
  description?: string;
  charIds?: string[];
  completed?: boolean;
  completedAt?: number | null;
  createdAt?: number;
  refCount?: number;
  /** Small JPEGs kept on the request itself, so the cards draw without the images. */
  refCover?: string;
  resultCover?: string;
}

/** art_requests/{id}/images/{imageId}: a reference, or the finished art. */
export interface RequestImage { id: string; dataUrl: string; kind: 'ref' | 'result'; order?: number; addedAt?: number }

/** bk_gallery/{id} */
export interface BoardImage { id: string; dataUrl: string; thumb?: string; name?: string; charIds?: string[]; uploadedAt?: number }

export type RequestFilter = 'all' | 'pending' | 'completed';

export function filterRequests(list: ArtRequest[], f: RequestFilter): ArtRequest[] {
  if (f === 'pending') return list.filter(r => !r.completed);
  if (f === 'completed') return list.filter(r => r.completed);
  return list;
}

/** "3/10 DONE", or nothing while there are no requests. */
export function doneLabel(list: ArtRequest[]): string {
  return list.length ? `${list.filter(r => r.completed).length}/${list.length} DONE` : '';
}

/** The card picture: the finished art once there is some, else the first reference. */
export function cardCover(r: ArtRequest): string {
  return (r.completed && r.resultCover) || r.refCover || '';
}

/** M/D/YY, as the old page wrote dates. */
export function fmtDate(ts: number | null | undefined): string {
  const d = new Date(ts || 0);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

/** Which character galleries a board image must be added to and removed from. */
export function linkChanges(oldIds: string[] | undefined, newIds: string[] | undefined): { add: string[]; remove: string[]; stay: string[] } {
  const o = new Set(oldIds || []), n = new Set(newIds || []);
  return { add: [...n].filter(id => !o.has(id)), remove: [...o].filter(id => !n.has(id)), stay: [...n].filter(id => o.has(id)) };
}

export function syncNote(n: number): string {
  return n
    ? `Linked to ${n} character${n !== 1 ? 's' : ''}: this image appears on ${n !== 1 ? 'their' : 'its'} Gallery page${n !== 1 ? 's' : ''}.`
    : 'Not linked to any character. Link some to push this image into the main Gallery.';
}

/** A small cover JPEG (420px) for a card. */
export async function makeThumb(file: Blob): Promise<string> {
  return compressImage(await readAsDataURL(file), 420, 0.6);
}

export function fileTitle(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}
