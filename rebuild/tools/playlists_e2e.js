// node playlists_e2e.js [screenshot-dir]  (needs the build served on :8790; edits the
// next_ test data and puts it back)
// End-to-end check of PLAYLISTS: picking a character, playback and the player
// bar, shuffle / repeat / mute, reordering by keyboard and by dragging, in-place
// title and description edits, song and cover uploads (mocked) and removal.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const BASE = 'http://127.0.0.1:8790';
const CAPPY = 'mp85oi5f0qnzqt16pa2';       // seven songs, all with lengths
const BLACKJACK = 'mp7grig28yapvrdxg4';    // an empty playlist with a description
// a short sound repeated into about a minute of audio (mp3 frames join end to end)
const MP3 = Buffer.concat(Array(12).fill(require('fs').readFileSync(path.resolve(__dirname, '../../sounds/minimum.mp3'))));
const PNG = path.resolve(__dirname, '../../baddies/beebaddie.png');
const OUT = process.argv[2] || '.';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

(async () => {
  const proxy = (process.env.HTTPS_PROXY || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  // songs and covers live on Cloudinary, which this machine cannot reach: hand back local files,
  // and answer uploads with a made-up address
  await ctx.route(/res\.cloudinary\.com/, r => r.fulfill(/\/image\//.test(r.request().url()) ? { path: PNG, contentType: 'image/png' } : { body: MP3, contentType: 'audio/mpeg' }));
  let uploads = 0;
  await ctx.route(/api\.cloudinary\.com/, r => {
    const image = /\/image\/upload/.test(r.request().url());
    if (!/dhdfz1iud/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });   // the mirrors
    uploads++;
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secure_url: `https://res.cloudinary.com/dhdfz1iud/${image ? 'image' : 'video'}/upload/e2e-${uploads}.${image ? 'png' : 'mp3'}` }) });
  });
  const page = await ctx.newPage();
  await require('./e2e_guard')(page);   // only ever against the local emulator
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (process.env.V) console.log('[' + m.type() + '] ' + m.text()); if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  /** Polls until fn() holds: the page redraws after the event that changed it, not during. */
  const until = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(50); } return false; };
  const title = () => page.locator('.now-title').textContent();
  const pressed = l => page.locator(`.player [aria-label="${l}"]`).getAttribute('aria-pressed');
  const pickChar = async name => { await page.locator('.entry').filter({ has: page.locator('.name', { hasText: new RegExp('^' + name + '$', 'i') }) }).click(); await page.locator('.head .title').waitFor({ timeout: 10000 }); };
  const titles = () => page.locator('.song .stitle').allTextContents();

  await page.goto(BASE + '/playlists');
  await page.locator('.entry').first().waitFor({ timeout: 15000 });
  check(/SELECT A CHARACTER/.test(await page.locator('.hint').textContent()), 'asks for a character first');
  check(await page.locator('a[href$="/playlists"][aria-current]').count() === 1 || await page.locator('.more-btn').count() === 1, 'nav marks PLAYLISTS');

  // ── a playlist with songs ──
  await pickChar('CAPPY');
  check(await page.locator('.head .title').textContent() === "Cappy's Playlist", 'shows the playlist title');
  check(await page.locator('.song').count() === 7, 'lists the seven songs');
  check(/7 SONGS/.test(await page.locator('.meta').textContent()) && /TOTAL/.test(await page.locator('.meta').textContent()), 'meta shows the count and total time');
  check(await page.locator('.entry.active .name').textContent() === 'Cappy', 'the character is marked in the list');
  const order0 = await titles();
  await page.screenshot({ path: `${OUT}/playlists.png` });

  // ── playback ──
  check(await page.locator('.player').count() === 0, 'no player before anything plays');
  await page.locator('.song .stitle').nth(1).click();
  await page.locator('.player').waitFor({ timeout: 5000 });
  check(await until(async () => await title() === order0[1]), 'the bar shows the song clicked');
  check(await page.locator('.now-by').textContent() === 'Cappy', 'and the character');
  check(await page.locator('.song').nth(1).evaluate(e => e.classList.contains('now')), 'the playing row is marked');
  const playing = await page.locator('.player .pp[aria-label="Pause"]').waitFor({ timeout: 5000 }).then(() => true, () => false);
  check(playing, 'it plays (button turns to pause)');
  check(await page.locator('.entry.active .eq').count() === 1, 'the list shows who is playing');
  await page.locator('.player [aria-label="Next"]').click();
  check(await until(async () => await title() === order0[2]), 'NEXT goes to the next song');
  await page.locator('.player [aria-label="Previous"]').click();
  check(await until(async () => await title() === order0[1]), 'PREVIOUS goes back');
  await page.locator('.player .pp').click();
  check(await page.locator('.player .pp[aria-label="Play"]').waitFor({ timeout: 3000 }).then(() => true, () => false), 'pause');
  await page.locator('.player .pp').click();
  check(await page.locator('.player .pp[aria-label="Pause"]').waitFor({ timeout: 3000 }).then(() => true, () => false), 'and play again');
  await page.waitForTimeout(1200);
  check(await until(async () => await page.locator('.player .t').first().textContent() !== '0:00', 5000), 'the time runs');
  await page.locator('.player .seek').evaluate(el => { el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check(await until(async () => /^0:0[01]$/.test(await page.locator('.player .t').first().textContent())), 'seeking moves the time');

  await page.locator('.player [aria-label="Shuffle"]').click();
  check(await until(async () => await pressed('Shuffle') === 'true'), 'shuffle switches on');
  check(await title() === order0[1], 'and the song carries on');
  const seen = new Set();
  for (let i = 0; i < 7; i++) { const was = await title(); await page.locator('.player [aria-label="Next"]').click(); await until(async () => await title() !== was, 1500); seen.add(await title()); }
  check(seen.size >= 5, `shuffled NEXT walks through the playlist (${seen.size} different)`);
  await page.locator('.player [aria-label="Shuffle"]').click();
  check(await until(async () => await pressed('Shuffle') === 'false'), 'shuffle switches off');
  await page.locator('.player [aria-label="Repeat"]').click();
  check(await until(async () => await pressed('Repeat') === 'true'), 'repeat switches on');
  await page.locator('.player [aria-label="Repeat"]').click();
  await until(async () => await pressed('Repeat') === 'false');
  await page.locator('.player [aria-label="Mute"]').click();
  check(await until(async () => await page.locator('.player [aria-label="Unmute"]').count() === 1), 'mute');
  await page.locator('.player .vol input').evaluate(el => { el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check(await until(async () => await page.locator('.player [aria-label="Mute"]').count() === 1), 'moving the volume unmutes');
  await page.screenshot({ path: `${OUT}/playlists-playing.png` });

  // ── reorder: keyboard, then dragging, each put back ──
  await page.locator('.song .grip').nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  let now = await titles();
  check(now[0] === order0[1] && now[1] === order0[0], 'ArrowDown on the grip moves a song down');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(100);
  check(JSON.stringify(await titles()) === JSON.stringify(order0), 'ArrowUp moves it back');
  await page.locator('.song').nth(0).dragTo(page.locator('.song').nth(2));
  await page.waitForTimeout(150);
  now = await titles();
  check(now[2] === order0[0] && now[0] === order0[1], 'dragging moves a song');
  await page.locator('.song').nth(2).dragTo(page.locator('.song').nth(0));
  await page.waitForTimeout(150);
  check(JSON.stringify(await titles()) === JSON.stringify(order0), 'and dragging it back restores the order');
  await page.waitForTimeout(1000);   // the save

  // ── browsing elsewhere keeps the music ──
  await pickChar('BLACKJACK');
  check(await page.locator('.now-by').textContent() === 'Cappy', 'another playlist leaves the player on the song');
  check(await page.locator('.song').count() === 0 && /NO SONGS YET/.test(await page.locator('.songs').textContent()), 'an empty playlist says so');

  // ── title and description in place ──
  const title0 = await page.locator('.head .title').textContent();
  await page.locator('.head .title').click();
  await page.locator('.title-in').fill('E2E MIX');
  await page.keyboard.press('Enter');
  check(await page.locator('.head .title').textContent() === 'E2E MIX', 'renaming in place');
  await page.locator('.head .title').click();
  await page.locator('.title-in').fill('NOPE');
  await page.keyboard.press('Escape');
  check(await page.locator('.head .title').textContent() === 'E2E MIX', 'Escape leaves the title as it was');
  await page.locator('.head .title').click();
  await page.locator('.title-in').fill('   ');
  await page.keyboard.press('Enter');
  check(await page.locator('.head .title').textContent() === 'Untitled Playlist', 'a blank title becomes Untitled Playlist');
  const desc0 = (await page.locator('.head .desc').textContent()).trim();
  await page.locator('.head .desc').click();
  await page.locator('.desc-in').fill('two\nlines');
  await page.locator('.head .cover').focus();   // blur saves
  check(await page.locator('.head .desc').evaluate(e => e.textContent) === 'two\nlines', 'the description keeps its line breaks');
  await page.waitForTimeout(1200);
  await page.reload();
  await page.locator('.entry').first().waitFor({ timeout: 15000 });
  await pickChar('BLACKJACK');
  check(await page.locator('.head .title').textContent() === 'Untitled Playlist', 'the edits are saved');
  await page.locator('.head .title').click();
  await page.locator('.title-in').fill(title0);
  await page.keyboard.press('Enter');
  await page.locator('.head .desc').click();
  await page.locator('.desc-in').fill(desc0 === 'Add a description...' ? '' : desc0);
  await page.locator('.head .cover').focus();

  // ── uploads (mocked) ──
  await page.locator('.in-audio').setInputFiles([{ name: 'E2E Song.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3') }, { name: 'Second.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3') }]);
  const added = await page.locator('.song', { hasText: 'Second' }).waitFor({ timeout: 8000 }).then(() => true, () => false);
  check(added && JSON.stringify(await titles()) === JSON.stringify(['E2E Song', 'Second']), 'uploaded songs join the list, titled after the file');
  await page.locator('.in-img').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: require('fs').readFileSync(PNG) });
  const cover = await page.waitForFunction(() => /e2e-\d+\.png/.test(document.querySelector('.head .cover img')?.getAttribute('src') || ''), null, { timeout: 8000 }).then(() => true, () => false);
  check(cover, 'a new cover shows');
  for (const t of ['Second', 'E2E Song']) {
    await page.locator('.song', { hasText: t }).locator('.del').click();
    await page.locator('.u-opt', { hasText: 'CONFIRM' }).click();
    await page.locator('.song', { hasText: t }).waitFor({ state: 'detached', timeout: 4000 }).catch(() => undefined);
  }
  check(await page.locator('.song').count() === 0, 'removing songs (after asking)');
  await page.waitForTimeout(1200);

  // put the cover back as it was (no cover) straight in the emulator's test data
  const restored = await page.evaluate(async ({ id }) => {
    const u = `http://127.0.0.1:8085/v1/projects/statsheets-3668d/databases/(default)/documents/next_playlists/${id}?updateMask.fieldPaths=image`;
    const r = await fetch(u, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer owner' }, body: JSON.stringify({ fields: { image: { nullValue: null } } }) });
    return r.ok;
  }, { id: BLACKJACK });
  check(restored, 'test cover removed again');

  // ── leaving stops the music ──
  await page.locator('a[href$="/utilities"]').first().click().catch(async () => page.goto(BASE + '/utilities'));
  await page.waitForTimeout(500);
  check(await page.locator('ss-playlists-page').count() === 0, 'left the page');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
