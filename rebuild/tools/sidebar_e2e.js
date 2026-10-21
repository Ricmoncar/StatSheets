// node sidebar_e2e.js  (needs the build served on :8790; writes to the next_ test data
// and puts it back: a duplicate and a folder are made and deleted, and a drag is undone)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

(async () => {
  const proxy = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await require('./e2e_guard')(page);   // only ever against the local emulator
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto(BASE + '/');
  await page.waitForSelector('ss-sidebar .entry', { timeout: 20000 });
  const entry = name => page.locator('ss-sidebar .entry', { has: page.locator('.name', { hasText: new RegExp('^' + name + '$') }) });
  const confirmYes = () => page.locator('ss-confirm-host .u-opt', { hasText: 'CONFIRM' }).click();

  // ── the menu ──
  await entry('Katie').click({ button: 'right' });
  const menu = page.locator('ss-sidebar .menu');
  await menu.waitFor();
  await menu.locator('button', { hasText: 'NO FOLDER' }).waitFor({ timeout: 8000 }).catch(() => undefined);
  const items = (await menu.locator('button').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
  check(items[0].includes('EDIT') && items[1].includes('DUPLICATE') && items[2].includes('DELETE'), 'right click opens EDIT / DUPLICATE / DELETE');
  check(items.some(t => t.includes('NO FOLDER')), 'and MOVE TO FOLDER');
  check(await menu.locator('button').first().evaluate(b => b === document.activeElement), 'the first item has focus');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check((await menu.count()) === 0, 'Escape closes it');

  // ── duplicate, then delete the copy ──
  await entry('Katie').click({ button: 'right' });
  await menu.locator('button', { hasText: 'DUPLICATE' }).click();
  await entry('Katie \\(1\\)').waitFor({ timeout: 10000 });
  check(true, 'DUPLICATE makes "Katie (1)"');
  await entry('Katie \\(1\\)').click({ button: 'right' });
  await menu.locator('button', { hasText: 'DELETE' }).click();
  await confirmYes();
  await entry('Katie \\(1\\)').waitFor({ state: 'detached', timeout: 10000 });
  check(true, 'DELETE removes it after confirming');

  // ── a folder: create, file a character, unfile, delete ──
  await page.locator('ss-sidebar .head .icon').click();
  await page.locator('.folder-form input[type=text]').fill('E2E FOLDER');
  await page.locator('.folder-form .swatch').nth(2).click();
  await page.locator('.folder-form button[type=submit]').click();
  const folder = page.locator('ss-sidebar .folder', { has: page.locator('.folder-name', { hasText: 'E2E FOLDER' }) });
  await folder.waitFor({ timeout: 10000 });
  check(true, 'a new folder appears');
  await entry('Katie').click({ button: 'right' });
  await menu.locator('button', { hasText: 'E2E FOLDER' }).click();
  await folder.locator('.entry', { hasText: 'Katie' }).waitFor({ timeout: 10000 });
  check((await folder.locator('.count').textContent()).trim() === '1', 'MOVE TO FOLDER files the character');
  await folder.locator('.entry', { hasText: 'Katie' }).click({ button: 'right' });
  await menu.locator('button', { hasText: 'Travelers' }).click();
  const travelers = page.locator('ss-sidebar .folder', { has: page.locator('.folder-name', { hasText: 'Travelers' }) });
  await travelers.locator('.entry', { hasText: 'Katie' }).waitFor({ timeout: 10000 });
  check(true, 'and back');
  await folder.locator('.icon.danger').click({ force: true });
  await confirmYes();
  await folder.waitFor({ state: 'detached', timeout: 10000 });
  check(true, 'deleting the folder removes it');

  // ── drag: between rows, onto another folder, and back (both ends on screen) ──
  await page.locator('ss-sidebar .list').evaluate(l => { l.scrollTop = 0; });
  const names = async () => (await travelers.locator('.entry .name').allTextContents()).map(t => t.trim());
  const before = await names();
  const a = before[0], b = before[1];
  // after each drop, wait for the order (and the database's echo of it) to settle before the next
  const settle = async want => { const t = Date.now(); while (Date.now() - t < 8000 && JSON.stringify(await names()) !== JSON.stringify(want)) await page.waitForTimeout(100); await page.waitForTimeout(1200); return JSON.stringify(await names()) === JSON.stringify(want); };
  await entry(a).dragTo(entry(b), { targetPosition: { x: 40, y: 34 } });   // lower half: after
  check(await settle([b, a, ...before.slice(2)]), `drag reorders (${a} after ${b})`);
  await entry(a).dragTo(entry(b), { targetPosition: { x: 40, y: 4 } });    // upper half: before
  check(await settle(before), 'and drags back');

  const cappies = page.locator('ss-sidebar .folder', { has: page.locator('.folder-name', { hasText: 'Cappies' }) });
  const third = before[2];
  await entry(third).dragTo(cappies.locator('.folder-head'), { targetPosition: { x: 60, y: 30 } });
  await cappies.locator('.entry', { hasText: third }).waitFor({ timeout: 10000 });
  check(true, `dropping on a folder files the character (${third} into Cappies)`);
  await settle(before.filter(x => x !== third));
  await entry(third).dragTo(entry(before[1]), { targetPosition: { x: 40, y: 34 } });
  check(await settle(before), 'and dragging onto a row brings it back' + (process.env.V ? ' ' + JSON.stringify({ before, now: await names() }) : ''));

  // the order survives a reload (it was saved)
  await page.reload();
  await page.waitForSelector('ss-sidebar .entry', { timeout: 20000 });
  const saved = async () => JSON.stringify(await names()) === JSON.stringify(before);
  const t0 = Date.now(); while (Date.now() - t0 < 6000 && !(await saved())) await page.waitForTimeout(100);
  check(await saved(), 'the order is saved');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
