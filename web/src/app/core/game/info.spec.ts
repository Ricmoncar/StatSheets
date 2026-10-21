import { describe, expect, it } from 'vitest';
import { affiliationPieces, platformOf, renderMarkdown, youTubeId } from './info';

describe('info helpers', () => {
  it('renders the supported markdown and escapes everything else', () => {
    expect(renderMarkdown('# Title\n**bold** and *it*\n- a\n- b\n> q\n---\n<script>x</script>')).toBe(
      '<h3>Title</h3><p><strong>bold</strong> and <em>it</em></p><ul><li>a</li><li>b</li></ul><blockquote>q</blockquote><hr><p>&lt;script&gt;x&lt;/script&gt;</p>');
    expect(renderMarkdown('  ')).toContain('empty');
  });

  it('splits [[glitch]] text out of affiliations', () => {
    expect(affiliationPieces('The [[VOID]] guild')).toEqual([
      { text: 'The ', glitch: false }, { text: 'VOID', glitch: true }, { text: ' guild', glitch: false }]);
  });

  it('finds YouTube ids and platforms', () => {
    expect(youTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
    expect(youTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youTubeId('https://open.spotify.com/track/x')).toBeNull();
    expect(platformOf('https://open.spotify.com/track/x')).toBe('spotify');
    expect(platformOf('')).toBe('none');
  });
});
