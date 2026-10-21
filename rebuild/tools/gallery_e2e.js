// node gallery_e2e.js [screenshot-dir]  (needs the build served on :8790; adds one
// picture to a next_ character's gallery, renames it and deletes it again)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

(async () => {
  const out = process.argv[2] || '.';
  const proxy = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto(BASE + '/gallery');
  const cards = page.locator('.grid .char');
  await cards.first().waitFor({ timeout: 15000 });
  const n = await cards.count();
  check(n > 5, `every character has a card (${n})`);
  const badges = await page.locator('.char .count').first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  check(badges, 'picture counts show before a gallery is opened');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/gallery.png` });

  // the smallest gallery that has pictures (they are big base64 documents), else the first card
  const sizes = await page.locator('.char').evaluateAll(els => els.map(e => +((e.querySelector('.count')?.textContent || '').match(/\d+/) || [0])[0]));
  const pick = sizes.reduce((best, v, i) => (v > 0 && (best < 0 || v < sizes[best]) ? i : best), -1);
  const card = cards.nth(Math.max(0, pick));
  const badgeOf = async () => +(((await card.locator('.count').textContent().catch(() => '0')) || '0').match(/\d+/) || [0])[0];
  const count0 = await badgeOf();
  const name = (await card.locator('.name').textContent()).trim();
  await card.click();
  const modal = page.locator('ss-modal .dialog');
  await modal.waitFor({ timeout: 5000 });
  check((await modal.locator('.bar').textContent()).includes(name), `the gallery opens with the name (${name})`);
  await modal.locator('.pics').waitFor({ timeout: 40000 });
  const pics = modal.locator('.pic');
  const p0 = await pics.count();
  check(p0 === count0, `as many pictures as the badge said (${p0} / ${count0})`);

  // add one (a 300x200 PNG drawn here)
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 200;
    const g = c.getContext('2d'); g.fillStyle = '#ff0'; g.fillRect(0, 0, 300, 200); g.fillStyle = '#000'; g.fillRect(40, 40, 60, 60);
    return c.toDataURL('image/png').split(',')[1];
  });
  await modal.locator('input[type=file]').setInputFiles({ name: 'e2e-test.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  const added = await page.locator('.toast', { hasText: 'IMAGE ADDED!' }).waitFor({ timeout: 10000 }).then(() => true, () => false);
  check(added, 'a picked file is added');
  await page.waitForFunction(k => document.querySelectorAll('ss-modal .pic').length === k, p0 + 1, { timeout: 8000 }).catch(() => undefined);
  check(await pics.count() === p0 + 1, 'and shows up in the grid');
  check(await badgeOf() === p0 + 1, 'and the badge counts it');
  const mine = pics.last();
  check((await mine.locator('.cap').textContent()).trim() === 'e2e-test.png', 'labelled with its file name');
  const src = await mine.locator('img').getAttribute('src');
  check(src.startsWith('data:image/jpeg'), 'stored as a JPEG');

  // rename: Escape keeps the name, Enter saves
  await mine.hover();
  await mine.locator('.act', { hasText: 'REN' }).click();
  await mine.locator('.rename').fill('ignored');
  await mine.locator('.rename').press('Escape');
  check(await modal.count() === 1 && (await mine.locator('.cap').textContent()).trim() === 'e2e-test.png', 'Escape in the rename box cancels and keeps the gallery open');
  await mine.hover();
  await mine.locator('.act', { hasText: 'REN' }).click();
  await mine.locator('.rename').fill('E2E RENAMED');
  await mine.locator('.rename').press('Enter');
  const renamed = await page.locator('.toast', { hasText: 'RENAMED!' }).waitFor({ timeout: 6000 }).then(() => true, () => false);
  check(renamed && (await mine.locator('.cap').textContent()).trim() === 'E2E RENAMED', 'Enter renames it');

  // full size
  await mine.locator('img').click();
  const lb = page.locator('.lightbox');
  await lb.waitFor({ timeout: 3000 });
  check((await lb.locator('.lb-count').textContent()).trim() === `${p0 + 1} / ${p0 + 1}`, 'the lightbox shows it with a counter');
  check((await lb.locator('.lb-name').textContent()).trim() === 'E2E RENAMED', 'and its name');
  if (p0 > 0) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    check((await lb.locator('.lb-count').textContent()).trim() === `1 / ${p0 + 1}`, 'arrow keys wrap around');
    await page.keyboard.press('ArrowLeft');
  }
  await page.screenshot({ path: `${out}/gallery-lightbox.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(await lb.count() === 0 && await modal.count() === 1, 'Escape closes the lightbox only');
  await page.screenshot({ path: `${out}/gallery-modal.png` });

  // delete: cancel first, then confirm
  await mine.hover();
  await mine.locator('.act', { hasText: 'DEL' }).click();
  await page.locator('ss-confirm-host .u-opt', { hasText: 'CANCEL' }).click();
  await page.waitForTimeout(300);
  check(await pics.count() === p0 + 1, 'cancelling the delete keeps it');
  await mine.hover();
  await mine.locator('.act', { hasText: 'DEL' }).click();
  await page.locator('ss-confirm-host .u-opt', { hasText: 'CONFIRM' }).click();
  const gone = await page.locator('.toast', { hasText: 'IMAGE DELETED' }).waitFor({ timeout: 6000 }).then(() => true, () => false);
  await page.waitForTimeout(300);
  check(gone && await pics.count() === p0, 'confirming deletes it');

  // a drop with no pictures in it
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.items.add(new File(['hi'], 'note.txt', { type: 'text/plain' }));
    document.querySelector('.drop').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  check(await page.locator('.toast', { hasText: 'NO IMAGE FILES IN DROP' }).waitFor({ timeout: 3000 }).then(() => true, () => false), 'dropping a non-picture says so');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(await modal.count() === 0, 'Escape closes the gallery');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on a phone');
  await page.screenshot({ path: `${out}/gallery-mobile.png` });

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
