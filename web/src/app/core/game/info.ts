// Helpers for the INFO tab. Ported from the old script.js (INFO TAB sections:
// renderMarkdown, inlineMarkdown, _affiliationHtml, getYouTubeId,
// getPlatformIcon, the media link list).

export interface MediaLink { title: string; url: string; note: string; audio?: string; fileName?: string; [k: string]: unknown }
export type LinkList = 'soundtrack' | 'voiceclaims';
/** Voice claim uploads, same cap as theme songs. */
export const MEDIA_MAX_MB = 20;

/** Profile fields and their limits, in the order they appear. */
export const INFO_LINE_FIELDS = [
  { key: 'age', label: 'AGE', max: 32, section: 'IDENTITY' },
  { key: 'pronouns', label: 'PRONOUNS', max: 32, section: 'IDENTITY' },
  { key: 'race', label: 'RACE / SPECIES', max: 48, section: 'IDENTITY' },
  { key: 'height', label: 'HEIGHT', max: 24, section: 'IDENTITY' },
  { key: 'origin', label: 'HOMETOWN / ORIGIN', max: 64, section: 'ORIGIN' },
  { key: 'occupation', label: 'OCCUPATION / ROLE', max: 48, section: 'ORIGIN' },
] as const;

export const INFO_TEXT_FIELDS = [
  { key: 'personality', label: 'PERSONALITY', rows: 3, placeholder: 'Describe their personality... **bold**, *italic*, # heading', section: 'PROFILE' },
  { key: 'goals', label: 'GOALS / MOTIVATIONS', rows: 3, placeholder: 'What drives them?', section: 'PROFILE' },
  { key: 'fears', label: 'FEARS / WEAKNESSES', rows: 3, placeholder: 'What do they fear?', section: 'PROFILE' },
  { key: 'bio', label: 'BIO', rows: 7, placeholder: "Write the character's story... supports **bold**, *italic*, # headings, - lists, > quotes", section: 'LORE' },
  { key: 'notes', label: 'NOTES', rows: 3, placeholder: 'Extra notes, lore details, references...', section: 'LORE' },
] as const;

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** **bold**, *italic*, ~~strike~~, `code`, applied after escaping. */
export function inlineMarkdown(raw: string): string {
  let s = escape(raw);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
  s = s.replace(/`(.+?)`/g, '<code>$1</code>');
  return s;
}

/** The small markdown the info fields support. Input is escaped first, so it cannot inject tags. */
export function renderMarkdown(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return '<span class="md-empty">: empty: </span>';
  let html = '';
  let inList = false;
  const close = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const line of raw.split('\n')) {
    if (/^### /.test(line)) { close(); html += `<h5>${inlineMarkdown(line.slice(4))}</h5>`; continue; }
    if (/^## /.test(line)) { close(); html += `<h4>${inlineMarkdown(line.slice(3))}</h4>`; continue; }
    if (/^# /.test(line)) { close(); html += `<h3>${inlineMarkdown(line.slice(2))}</h3>`; continue; }
    if (/^> /.test(line)) { close(); html += `<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`; continue; }
    if (/^---+$/.test(line.trim())) { close(); html += '<hr>'; continue; }
    if (/^[-*] /.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inlineMarkdown(line.slice(2))}</li>`; continue; }
    close();
    if (!line.trim()) { html += '<br>'; continue; }
    html += `<p>${inlineMarkdown(line)}</p>`;
  }
  close();
  return html;
}

/** Affiliation text, split so that [[like this]] can be shown glitching. */
export function affiliationPieces(v: string): { text: string; glitch: boolean }[] {
  const out: { text: string; glitch: boolean }[] = [];
  let last = 0;
  for (const m of v.matchAll(/\[\[(.+?)\]\]/g)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: v.slice(last, at), glitch: false });
    out.push({ text: m[1], glitch: true });
    last = at + m[0].length;
  }
  if (last < v.length) out.push({ text: v.slice(last), glitch: false });
  return out;
}

export function hasGlitch(v: string | null | undefined): boolean {
  return /\[\[.+?\]\]/.test(v || '');
}

export function youTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function platformOf(url: string | null | undefined): 'youtube' | 'spotify' | 'link' | 'none' {
  if (!url) return 'none';
  if (/youtu\.?be/.test(url)) return 'youtube';
  if (/spotify/.test(url)) return 'spotify';
  return 'link';
}
