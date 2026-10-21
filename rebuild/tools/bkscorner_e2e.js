// node bkscorner_e2e.js [screenshot-dir]  (needs the build served on :8790; adds a request
// and a board image to the next_ test data, then deletes both)
// End-to-end check of BK'S CORNER: requests (filters, creating with characters and
// references, completing, finished art, more references, the lightbox, deleting) and the
// shared board (adding with linked characters, the mirror in their galleries, renaming,
// relinking, deleting).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const BASE = 'http://127.0.0.1:8790';
const PNG = path.resolve(__dirname, '../../baddies/beebaddie.png');
const PNG2 = path.resolve(__dirname, '../../baddies/bossbaddie.png');
const OUT = process.argv[2] || '.';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

(async () => {
  const proxy = (process.env.HTTPS_PROXY || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await require('./e2e_guard')(page);   // only ever against the local emulator
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(80); } return false; };
  const toast = re => until(async () => (await page.locator('.toast').allTextContents()).some(t => re.test(t)));
  const confirm = () => page.locator('.u-opt', { hasText: 'CONFIRM' }).click();
  const pickChar = async (modal, name) => modal.locator('.opt').filter({ has: page.locator('.nm', { hasText: new RegExp('^' + name + '$') }) }).click();
  const modal = page.locator('ss-modal');

  await page.goto(BASE + '/bkscorner');
  await page.locator('.card').first().waitFor({ timeout: 20000 });
  check(true, 'requests load');
  const count = await page.locator('.count').textContent();
  check(/^\d+\/\d+ DONE$/.test(count), `the count reads ${count}`);
  const [done0, total0] = count.match(/\d+/g).map(Number);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('ss-bk-corner-page')).cursor.includes('url(')), 'the rose is the cursor here');

  // ── filters ──
  await page.locator('.filters .chip', { hasText: 'PENDING' }).click();
  check(await until(async () => { const s = await page.locator('.card .status').allTextContents(); return s.length === total0 - done0 && s.every(t => t === 'PENDING'); }), 'PENDING shows only pending requests');
  await page.locator('.filters .chip', { hasText: 'COMPLETED' }).click();
  check(await until(async () => { const s = await page.locator('.card .status').allTextContents(); return s.length === done0 && s.every(t => t === 'DONE'); }), 'COMPLETED shows only finished ones');
  await page.locator('.filters .chip', { hasText: 'ALL' }).click();

  // ── a new request ──
  await page.locator('.u-btn', { hasText: 'NEW ART REQUEST' }).click();
  await modal.waitFor();
  await modal.locator('.u-btn', { hasText: 'CREATE REQUEST' }).click();
  check(await toast(/GIVE IT A TITLE FIRST/), 'a request needs a title');
  await modal.locator('.f-title').fill('E2E REQUEST');
  await modal.locator('textarea').fill('draw\nthis');
  await pickChar(modal, 'Snaps');
  check(await until(async () => await modal.locator('.opt.on').count() === 1), 'picking a character ticks it');
  await modal.locator('.in-ref').setInputFiles([PNG, PNG2]);
  check(await until(async () => await modal.locator('.thumb').count() === 2), 'reference pictures are staged');
  await modal.locator('.thumb .x').nth(1).click();
  check(await until(async () => await modal.locator('.thumb').count() === 1), 'and one can be taken off again');
  await modal.locator('.u-btn', { hasText: 'CREATE REQUEST' }).click();
  check(await toast(/ART REQUEST CREATED/), 'CREATE REQUEST saves it');
  const card = page.locator('.card', { hasText: 'E2E REQUEST' });
  check(await until(async () => await card.count() === 1), 'its card appears');
  check(await card.locator('ss-char-chip', { hasText: 'Snaps' }).count() === 1 && await card.locator('.pic img').count() === 1, 'with the character and the reference as cover');
  check(await until(async () => (await page.locator('.count').textContent()) === `${done0}/${total0 + 1} DONE`), 'the count goes up');

  // ── its detail ──
  await card.click();
  await modal.locator('.detail').waitFor({ timeout: 10000 });
  check(/REFERENCES \(1\)/.test(await modal.locator('.detail').textContent()), 'the detail shows the reference');
  check(/^draw\nthis$/.test(await modal.locator('.desc').textContent()), 'and the description with its line break');
  check(await modal.locator('.u-btn', { hasText: 'UPLOAD FINISHED ART' }).isDisabled(), 'finished art waits for the request to be completed');
  await modal.locator('.u-btn', { hasText: 'MARK AS COMPLETED' }).click();
  check(await until(async () => (await modal.locator('.status').textContent()) === 'COMPLETED'), 'MARK AS COMPLETED');
  await modal.locator('.in-result').setInputFiles(PNG2);
  check(await until(async () => await modal.locator('.result img').count() === 1, 15000), 'the finished art uploads');
  check(await until(async () => (await card.locator('.status').textContent()) === 'DONE'), 'the card shows DONE');
  await modal.locator('.in-more').setInputFiles(PNG);
  check(await until(async () => /REFERENCES \(2\)/.test(await modal.locator('.detail').textContent()), 15000), 'ADD REFERENCES adds another');
  await modal.locator('.ref').first().click();
  const lb = page.locator('.lightbox');
  check(await until(async () => await lb.count() === 1 && (await lb.locator('.lb-count').textContent()).trim() === '1 / 2'), 'a reference opens full size with a counter');
  await page.keyboard.press('ArrowRight');
  check(await until(async () => (await lb.locator('.lb-count').textContent()).trim() === '2 / 2'), 'arrow keys move through the references');
  await page.keyboard.press('Escape');
  check(await until(async () => await lb.count() === 0) && await modal.count() === 1, 'Escape closes the picture, not the request');
  await page.screenshot({ path: `${OUT}/bk-detail.png` });
  await modal.locator('.u-btn', { hasText: 'MARK AS PENDING' }).click();
  check(await until(async () => (await modal.locator('.status').textContent()) === 'PENDING'), 'MARK AS PENDING');
  await modal.locator('.u-btn', { hasText: 'DELETE REQUEST' }).click();
  await confirm();
  check(await until(async () => await card.count() === 0), 'DELETE REQUEST removes it (after asking)');
  check(await until(async () => await modal.count() === 0), 'and closes the dialog');

  // ── the board ──
  await page.locator('.u-tab', { hasText: 'GALLERY' }).click();
  await page.locator('.card').first().waitFor({ timeout: 20000 });
  const imgs0 = await page.locator('.card').count();
  check(/^\d+ IMAGES?$/.test(await page.locator('.count').textContent()), 'the board counts its images');
  await page.locator('.u-btn', { hasText: 'ADD IMAGES' }).click();
  await modal.waitFor();
  await modal.locator('.u-btn', { hasText: 'ADD TO GALLERY' }).click();
  check(await toast(/PICK AT LEAST ONE IMAGE/), 'adding needs an image');
  await modal.locator('.in-up').setInputFiles(PNG);
  await until(async () => await modal.locator('.thumb').count() === 1);
  await pickChar(modal, 'Snaps');
  await modal.locator('.u-btn', { hasText: 'ADD TO GALLERY' }).click();
  check(await toast(/ADDED & SYNCED TO GALLERY/), 'adding with a linked character syncs it');
  const tile = page.locator('.card', { hasText: 'beebaddie' });
  check(await until(async () => await tile.count() === 1 && await page.locator('.card').count() === imgs0 + 1), 'the new picture is on the board, named after its file');
  check((await tile.locator('.synced').textContent()).includes('1'), 'marked as linked to one character');

  await tile.click();
  await modal.locator('.big-pic').waitFor();
  check(/Linked to 1 character/.test(await modal.locator('.sync-note').textContent()), 'the picture says where it is linked');
  await modal.locator('.field input[type=text]').first().fill('E2E BOARD');
  await pickChar(modal, 'Katie');
  check(await until(async () => /Linked to 2 characters/.test(await modal.locator('.sync-note').textContent())), 'linking another updates the note');
  await modal.locator('.u-btn', { hasText: 'SAVE CHANGES' }).click();
  check(await toast(/SAVED/), 'SAVE CHANGES');
  const tile2 = page.locator('.card', { hasText: 'E2E BOARD' });
  check(await until(async () => await tile2.count() === 1), 'the new name shows');
  await page.screenshot({ path: `${OUT}/bk-board.png` });

  // the mirrors: both characters' galleries have it, under the new name
  const inGallery = async name => {
    await page.goto(BASE + '/gallery');
    await page.locator('.char', { hasText: new RegExp('^' + name, 'i') }).first().click();
    await modal.locator('.pics, .empty').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    const has = await modal.locator('.cap', { hasText: 'E2E BOARD' }).count();
    return has;
  };
  check(await inGallery('Snaps') === 1, "it is in the first character's gallery");
  check(await inGallery('Katie') === 1, "and the second one's, renamed");

  await page.goto(BASE + '/bkscorner');
  await page.locator('.u-tab', { hasText: 'GALLERY' }).click();
  await tile2.waitFor({ timeout: 20000 });
  await tile2.click();
  await pickChar(modal, 'Snaps');
  await modal.locator('.u-btn', { hasText: 'SAVE CHANGES' }).click();
  await toast(/SAVED/);
  await tile2.click();
  check(/Linked to 1 character/.test(await modal.locator('.sync-note').textContent()), 'unlinking a character');
  await modal.locator('.u-btn', { hasText: 'DELETE IMAGE' }).click();
  await confirm();
  check(await until(async () => await tile2.count() === 0), 'DELETE IMAGE removes it from the board');
  check(await inGallery('Snaps') === 0, 'the unlinked character no longer has it');
  check(await inGallery('Katie') === 0, 'and deleting took it out of the linked one');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
