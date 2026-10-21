import { compressImage, readAsDataURL } from '../../core/media';

/** One picture in a character's gallery (characters/{id}/gallery/{imageId}). */
export interface GalleryImage { id: string; dataUrl: string; name?: string; uploadedAt?: number }

/**
 * Pictures are stored as base64 JPEGs inside the Firestore document, so each
 * one has to fit in a document (1 MB): ~540 KB of data leaves room for the rest.
 */
export const MAX_B64_LEN = 720000;

const STEPS = [
  { dim: 1400, q: 0.85 },
  { dim: 1200, q: 0.8 },
  { dim: 1000, q: 0.75 },
  { dim: 900, q: 0.7 },
  { dim: 800, q: 0.62 },
  { dim: 700, q: 0.52 },
  { dim: 600, q: 0.42 },
  { dim: 480, q: 0.35 },
];

/** Shrinks a picture step by step until it fits, as the old gallery did; the last resort is very small. */
export async function compressToFit(file: Blob): Promise<string> {
  const src = await readAsDataURL(file);
  for (const { dim, q } of STEPS) {
    const out = await compressImage(src, dim, q);
    if (out === src) throw new Error('could not read the image');   // compressImage hands back what it cannot decode
    if (out.length <= MAX_B64_LEN) return out;
  }
  return compressImage(src, 380, 0.28);
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** The label under a picture: its name, else when it was added (M/D H:MM). */
export function imageLabel(img: GalleryImage): string {
  if (img.name) return img.name;
  const d = new Date(img.uploadedAt || 0);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
