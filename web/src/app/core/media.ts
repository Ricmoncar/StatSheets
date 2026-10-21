// Uploading and serving images and audio. Ported from the old script.js
// (THEME MUSIC PLAYER section: the Cloudinary accounts, _uploadMedia,
// _cldSwap, _cldImg, _cldAudio; AVATAR section: compressImage).
//
// Uploads are UNSIGNED: only cloud names and an unsigned preset appear here,
// never an API secret, because anything in this file is readable by anyone.
// Every upload is mirrored to the backup accounts at the same public id, so a
// failing account is replaced by swapping the cloud name in the URL.

export const CLOUDINARY = { cloud: 'dhdfz1iud', preset: 'statsheets' };
/** Hot backups, tried in this order. Each needs an unsigned preset named `statsheets`. */
export const CLOUDINARY_BACKUPS = [
  { cloud: 'duq37uaxf', preset: 'statsheets' },
  { cloud: 'dhlik6lkn', preset: 'statsheets' },
];
const IMAGEKIT = { publicKey: 'w5ddaqvugh', uploadUrl: 'https://upload.imagekit.io/api/v1/files/upload' };

export type ResourceType = 'image' | 'video';

/** The same Cloudinary URL on backup account `i`, or null when it is not a Cloudinary URL or already there. */
export function cldSwap(url: string | null | undefined, i = 0): string | null {
  const b = CLOUDINARY_BACKUPS[i];
  if (typeof url !== 'string' || !b) return null;
  const m = url.match(/res\.cloudinary\.com\/([^/]+)\//);
  if (!m || m[1] === b.cloud) return null;
  return url.replace('/' + m[1] + '/', '/' + b.cloud + '/');
}

/** Smaller delivery for plain Cloudinary image URLs (f_auto,q_auto; GIFs stay GIFs). Anything else passes through. */
export function cldImg<T>(url: T): T {
  if (typeof url !== 'string') return url;
  const m = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/i);
  if (!m || /(^|\/)(f_|q_|fl_|t_)/.test(m[2])) return url;
  const t = /\.gif($|\?)/i.test(m[2]) ? 'q_auto,fl_lossy' : 'f_auto,q_auto';
  return (m[1] + t + '/' + m[2]) as T;
}

/** Background music capped at 128k (inaudible for BGM, a big bandwidth cut). */
export function cldAudio<T>(url: T): T {
  if (typeof url !== 'string') return url;
  const m = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.*)$/i);
  if (!m || /(^|\/)(br_|q_|ac_|t_)/.test(m[2])) return url;
  return (m[1] + 'br_128k/' + m[2]) as T;
}

async function uploadTo(cloud: string, preset: string, file: Blob, type: ResourceType, pid: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);
  form.append('resource_type', type);
  if (pid) form.append('public_id', pid);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${type}/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

/** Cloudinary primary (mirrored to the backups), then each backup, then ImageKit. Resolves to the URL. */
export async function uploadMedia(file: Blob & { name?: string }, type: ResourceType, publicId?: string): Promise<string> {
  const pid = publicId || ('uploads/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
  try {
    const url = await uploadTo(CLOUDINARY.cloud, CLOUDINARY.preset, file, type, pid);
    for (const b of CLOUDINARY_BACKUPS) uploadTo(b.cloud, b.preset, file, type, pid).catch(() => { /* best effort */ });
    return url;
  } catch (err) {
    console.warn('[Upload] Cloudinary primary failed, trying the backups:', (err as Error).message);
  }
  for (const b of CLOUDINARY_BACKUPS) {
    try {
      const url = await uploadTo(b.cloud, b.preset, file, type, pid);
      for (const o of CLOUDINARY_BACKUPS) if (o !== b) uploadTo(o.cloud, o.preset, file, type, pid).catch(() => { /* best effort */ });
      return url;
    } catch (e) {
      console.warn('[Upload] Cloudinary backup ' + b.cloud + ' failed:', (e as Error).message);
    }
  }
  const fname = publicId ? publicId.split('/').pop() + (type === 'video' ? '.mp3' : '') : (file.name || `upload_${Date.now()}`);
  const folder = publicId ? '/' + publicId.split('/').slice(0, -1).join('/') : '/statsheets';
  const ik = new FormData();
  ik.append('file', file);
  ik.append('fileName', fname);
  ik.append('publicKey', IMAGEKIT.publicKey);
  ik.append('folder', folder);
  const res = await fetch(IMAGEKIT.uploadUrl, { method: 'POST', body: ik });
  if (!res.ok) throw new Error('ImageKit HTTP ' + res.status);
  const d = await res.json();
  if (!d.url) throw new Error(d.message || 'ImageKit: no URL');
  return d.url;
}

/** Shrinks an image to fit maxSide x maxSide and re-encodes it as JPEG; keeps the original if it cannot be read. */
export function compressImage(dataURL: string, maxSide = 512, quality = 0.82): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        if (width >= height) { height = Math.round(height * maxSide / width); width = maxSide; }
        else { width = Math.round(width * maxSide / height); height = maxSide; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

export function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
