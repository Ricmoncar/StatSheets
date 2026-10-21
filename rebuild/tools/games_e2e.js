// node games_e2e.js [screenshot-dir]  (needs the build served on :8790; types into the
// next_ test data and puts the old text back)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

(async () => {
  const out = process.argv[2] || '.';
  const only = process.argv[3] || '';
  const proxy = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ddragon/.test(m.text())) errors.push(m.text()); });

  await page.goto(BASE + '/utilities');
  const gw = page.locator('ss-game-worlds');
  await gw.scrollIntoViewIfNeeded();

  /** Opens a game tab, picks the first character with a dot, checks view and an edit round trip. */
  async function game(tab, sel, field, opts = {}) {
    if (only && only !== tab) return;
    await gw.locator('.tab', { hasText: tab }).click();
    const host = gw.locator(sel);
    await host.locator('.card').first().waitFor({ timeout: 15000 });
    const withDot = host.locator('ss-game-picker .card:has(.dot)');
    // the game's documents load when its tab opens; wait for the marks rather than a fixed time
    if (opts.marks !== false) await withDot.first().waitFor({ timeout: 8000 }).catch(() => undefined);
    else await page.waitForTimeout(800);
    const n = await withDot.count();
    if (opts.marks !== false) check(n > 0, `${tab}: characters with something filled in are marked (${n})`);
    await (n ? withDot.first() : host.locator('ss-game-picker .card').first()).click();
    await host.locator('article.card').waitFor({ timeout: 5000 });
    check(true, `${tab}: the view card opens`);
    await host.locator('article.card').screenshot({ path: `${out}/game-${tab.replace(/\W+/g, '').toLowerCase()}.png` });
    if (opts.view) await opts.view(host);
    await host.locator('.footer .btn', { hasText: 'EDIT' }).click();
    const box = host.locator(field).first();
    await box.waitFor({ timeout: 5000 });
    const before = await box.inputValue();
    await box.fill(before + ' e2e');
    await page.waitForTimeout(100);
    check(/SAVING/.test(await host.locator('.status').textContent()), `${tab}: typing shows SAVING`);
    const saved = await host.locator('.status', { hasText: 'SAVED' }).waitFor({ timeout: 6000 }).then(() => true, () => false);
    check(saved, `${tab}: then SAVED`);
    await box.fill(before);
    await host.locator('.status', { hasText: 'SAVED' }).waitFor({ timeout: 6000 }).catch(() => undefined);
    if (opts.edit) await opts.edit(host);
    await host.locator('.ed-head .btn', { hasText: 'VIEW' }).click();
    await host.locator('article.card').waitFor({ timeout: 5000 });
  }

  await game('NO MORE TIME', 'ss-game-nmt', 'ss-entry-rows input', {
    edit: async h => {
      const pages = async () => (await h.locator('.pager').first().textContent()).match(/\/\s*(\d+)/)[1];
      const n0 = +(await pages());
      await h.locator('.btn', { hasText: '+ LOADOUT' }).click();
      await page.waitForTimeout(150);
      check(+(await pages()) === n0 + 1, 'NMT: + LOADOUT adds a page');
      await h.locator('.btn.danger', { hasText: 'LOADOUT' }).click();
      await page.waitForTimeout(150);
      check(+(await pages()) === n0, 'NMT: and removes it');
      await page.waitForTimeout(1300);
    },
  });

  // the test data has no filled-in CRTL pages, so nothing is marked there
  await game('CRTL', 'ss-game-crtl', 'ss-entry-rows input', {
    marks: false,
    edit: async h => {
      const t = h.locator('.toggle button');
      const was = await h.locator('.toggle button.on').textContent();
      await t.filter({ hasNotText: was.trim().slice(2) }).click();
      const flipped = await h.locator('.toggle button.on', { hasNotText: was.trim().slice(2) }).waitFor({ timeout: 2000 }).then(() => true, () => false);
      check(flipped, 'CRTL: ENTITY / CLASS toggle');
      await t.filter({ hasText: was.trim().slice(2) }).click();
      await h.locator('.status', { hasText: 'SAVED' }).waitFor({ timeout: 6000 }).catch(() => undefined);
      await page.waitForTimeout(1300);
    },
  });

  await game('AUT', 'ss-game-aut', '.text-in', {
    view: async h => check(await h.locator('.tier, .stat, .sname, .cname').count() > 0, 'AUT: view shows the stand'),
  });

  await game('LOL', 'ss-game-lol', '.slot-sec .text-in', {
    edit: async h => {
      await h.locator('.slot').first().click();
      const pk = await h.locator('.picker .empty, .picker .opt').first().waitFor({ timeout: 5000 }).then(() => true, () => false);
      check(pk, 'LOL: the item picker opens');
      await h.locator('.slot').first().click();
      check(await h.locator('.picker').waitFor({ state: 'detached', timeout: 2000 }).then(() => true, () => false), 'LOL: and closes');
      const lvl = h.locator('.chips button', { hasText: 'TOP' });
      check(await lvl.count() === 1, 'LOL: role chips');
    },
    view: async h => {
      const r = h.locator('.lvl input');
      if (await r.count()) { await r.fill('18'); check(/18/.test(await h.locator('.lvl b').textContent()), 'LOL: level slider'); }
    },
  });

  await game('ASYM HORROR', 'ss-game-fh', 'ss-entry-rows input', {
    view: async h => check(/HUNTER|SURVIVOR/.test(await h.locator('.role').first().textContent()), 'FH: role badge'),
    edit: async h => {
      const n0 = await h.locator('.lms-edit').count();
      await h.locator('.btn', { hasText: /SPECIAL LMS/ }).first().click();
      await page.waitForTimeout(200);
      check(await h.locator('.lms-edit').count() === n0 + 1, 'FH: + SPECIAL LMS adds a match-up');
      await h.locator('.lms-edit').last().locator('.btn.danger').first().click();
      await page.waitForTimeout(200);
      check(await h.locator('.lms-edit').count() === n0, 'FH: and removes it');
      await page.waitForTimeout(1300);
    },
  });

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
