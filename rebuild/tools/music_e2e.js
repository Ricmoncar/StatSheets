// node music_e2e.js [screenshot-dir]  (needs the build served on :8790)
// End-to-end check of the theme music: bar, MUSIC tab, form switch, start point, page leave, Juko.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';
const LEON = 'mp7jzxz2nx73sigtnfs';
const JUKO = 'mp7hhy9t0kdessfvqzkr';
const MP3 = require('path').resolve(__dirname, '../../sounds/juko-1.mp3');
const OUT = process.argv[2] || '.';   // where the screenshots go

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

(async () => {
  const proxy = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  // the songs live on Cloudinary, which this machine cannot reach: hand back a local mp3
  await ctx.route(/res\.cloudinary\.com/, r => r.fulfill({ path: MP3, contentType: 'audio/mpeg' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  const bar = page.locator('ss-theme-bar');
  const barState = () => bar.evaluate(el => el.classList.contains('visible') ? 'visible' : el.classList.contains('peeked') ? 'peeked' : 'hidden');

  await page.goto(`${BASE}/c/${LEON}`);
  await page.waitForSelector('ss-theme-bar.visible', { timeout: 20000 });
  check((await bar.locator('.title').textContent()).trim() === 'Leon', 'bar shows the base song title');
  check(/LEON/i.test(await bar.locator('.who').textContent()), 'bar shows the character');
  await page.waitForTimeout(800);
  check(await bar.locator('.eq').evaluate(e => e.classList.contains('u-anim')), 'equaliser runs while playing');
  await page.waitForTimeout(1200);
  check((await barState()) === 'peeked', 'bar tucks away after 1.5 s');
  await page.mouse.move(700, 880);
  await page.waitForTimeout(100);
  check((await barState()) === 'visible', 'bar comes back near the bottom edge');

  await bar.locator('.pp').click();
  await page.waitForTimeout(200);
  check(await bar.locator('.eq').evaluate(e => !e.classList.contains('u-anim')), 'pause stops the equaliser');
  await bar.locator('.pp').click();
  await page.waitForTimeout(300);
  check(!(await bar.locator('.eq').evaluate(e => e.classList.contains('paused'))), 'play resumes');

  // song title opens the MUSIC tab
  await bar.locator('.info').click();
  await page.waitForSelector('ss-music-tab');
  check((await page.locator('ss-music-tab .form').count()) === 2, 'MUSIC tab lists base and alt form');
  const startInp = page.locator('ss-music-tab .form').first().locator('.start input');
  const original = '0:00';   // Leon's live theme has no start point
  await startInp.fill('0:05');
  await startInp.press('Enter');
  await page.waitForTimeout(300);
  check(await page.locator('.toast', { hasText: 'START SET: 0:05' }).count() > 0, 'start time saves on Enter');
  check((await startInp.inputValue()) === '0:05', 'start input shows the new time');

  // volume
  await bar.hover();
  await bar.locator('.vol').evaluate(el => { el.value = '55'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check((await bar.locator('.vol-label').textContent()).trim() === '55', 'volume label follows the slider');

  // switching form changes the song
  const chips = page.locator('.forms .chip');
  const tab = name => page.locator('.tabs .tab', { hasText: name }).click();
  await tab('STATS');
  await chips.nth(1).click();
  await page.waitForTimeout(1500);
  await tab('MUSIC');
  const altTitle = (await bar.locator('.title').textContent()).trim();
  check(altTitle !== 'Leon' && altTitle.length > 0, `form switch plays the alt theme (${altTitle})`);
  check(/·/.test(await bar.locator('.who').textContent()), 'bar names the form');

  // a base card's PLAY loads the base song while the alt form is shown
  await page.locator('ss-music-tab .form').first().locator('.controls .btn').first().click();
  await page.waitForTimeout(1500);
  check((await bar.locator('.title').textContent()).trim() === 'Leon', 'card PLAY loads that form\'s song');
  await tab('STATS');
  await chips.nth(0).click();
  await page.waitForTimeout(500);
  await tab('MUSIC');

  // put the start time back
  await startInp.fill(original || '0:00');
  await startInp.press('Enter');
  await page.waitForTimeout(800);

  // ✕ hides the bar
  await bar.hover();
  await bar.locator('.stop').click();
  await page.waitForTimeout(200);
  check((await barState()) === 'hidden', '✕ hides the player');

  // Juko is locked
  await page.goto(`${BASE}/c/${JUKO}`);
  await page.waitForSelector('ss-theme-bar.visible', { timeout: 20000 });
  check(/JUKO/i.test(await bar.locator('.title').textContent()), `Juko plays his bundled theme (${(await bar.locator('.title').textContent()).trim()})`);
  await bar.locator('.info').click();
  await page.waitForSelector('ss-music-tab .locked');
  check(/DON'T CHANGE MY MUSIC/.test(await page.locator('ss-music-tab').textContent()), 'Juko\'s MUSIC tab is locked');
  check((await page.locator('ss-music-tab input[type=file]').count()) === 0, 'no upload controls for Juko');

  // leaving the sheet stops the music
  // the page links sit in the bar on wide screens and in the menu otherwise
  if (await page.locator('a.nav-link', { hasText: 'UTILITIES' }).isVisible()) await page.locator('a.nav-link', { hasText: 'UTILITIES' }).click();
  else { await page.locator('.more-btn').click(); await page.locator('.more-menu a', { hasText: 'UTILITIES' }).click(); }
  await page.waitForTimeout(500);
  check((await barState()) === 'hidden', 'music stops on other pages');

  await page.screenshot({ path: OUT + '/music-utilities.png' });
  await page.goto(`${BASE}/c/${LEON}`);
  await page.waitForSelector('ss-theme-bar.visible', { timeout: 20000 });
  await page.locator('.tabs .tab', { hasText: 'MUSIC' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/music-tab.png' });

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
