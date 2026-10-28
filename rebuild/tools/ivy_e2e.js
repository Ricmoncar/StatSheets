// node ivy_e2e.js [screenshot-dir]  (needs the e2e build served on :8790 and the emulator)
//
// Ivy · EVIL creature, the first character page made for the new site: the
// ballroom behind the sheet, the rapier and the frame over the window, the
// interface thumping and tearing in whole pixels, the events, and everything
// put back when you leave.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';
const IVY = 'mtow23ogt9yab1yg7qr';      // EVIL creature is her active form in the fixtures
const OTHER = 'mp7grig28yapvrdxg4';     // Blackjack, who has no page of his own

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);
const until = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await require('./e2e_guard')(page);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const state = () => page.evaluate(() => ({
    dataPage: document.querySelector('ss-character-view')?.getAttribute('data-page') || null,
    world: !!document.querySelector('ss-world-canvas'),
    overlay: !!document.getElementById('pg-ivy_evil'),
    ownCursor: document.documentElement.classList.contains('pg-own-cursor'),
    masked: [...document.querySelectorAll('*')].filter(e => e.style && e.style.maskImage).length,
    swayed: [...document.querySelectorAll('*')].filter(e => e.style && e.style.translate).length,
  }));

  await page.goto(BASE + '/c/' + IVY);
  await page.locator('ss-world-canvas').waitFor({ timeout: 30000 });
  await page.mouse.move(1100, 420);
  await page.waitForTimeout(2500);
  let s = await state();
  check(s.dataPage === 'ivy_evil' && s.world && s.overlay, 'her EVIL form opens on her own page: the hall behind, the overlay over the window');
  check(s.ownCursor && await page.evaluate(() => getComputedStyle(document.body).cursor) === 'none', 'the rapier replaces the system cursor');
  const px = await page.evaluate(() => {
    const c = document.querySelector('ss-world-canvas canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) { r += d[i]; g += d[i + 1]; n++; }
    return { r: r / n, g: g / n };
  });
  check(px.r > 6 && px.r > px.g * 1.5, `the hall is drawn, and red (mean r ${px.r.toFixed(1)}, g ${px.g.toFixed(1)})`);
  let most = 0;
  // the blocks in sight that are off the middle (the rest stay put: a block moved out of sight is work for nobody)
  await until(async () => { most = Math.max(most, (await state()).swayed); return most >= 3; }, 4000);
  check(most >= 3, `the sheet thumps on the heartbeat (${most} blocks moved a pixel)`);
  const art = await page.evaluate(() => { const c = document.querySelector('ss-world-canvas canvas'); return [c.width, Math.ceil(c.getBoundingClientRect().width / 3)]; });
  check(art[0] === art[1], `the room is drawn at art resolution, one canvas pixel per art pixel (${art[0]} wide)`);
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ac2').trim());
  check(/^#?[a-f0-9]{6}$/i.test(accent) && parseInt(accent.replace('#', '').slice(0, 2), 16) > parseInt(accent.replace('#', '').slice(2, 4), 16) * 2, `the interface takes her red (--ac2 ${accent})`);
  await page.screenshot({ path: out + '/ivy-desk.png' });

  // the events: each one starts on demand, and the room shows it
  const mean = () => page.evaluate(() => {
    const c = document.querySelector('ss-world-canvas canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 31) { r += d[i]; g += d[i + 1]; n++; }
    return { r: r / n, g: g / n };
  });
  const force = n => page.evaluate(n => document.getElementById('pg-ivy_evil').force(n), n);
  const calm = await mean();
  await force('bleed'); await page.waitForTimeout(1900);
  const drained = await mean();
  check(drained.r / Math.max(1, drained.g) < (calm.r / Math.max(1, calm.g)) * 0.6, `bleed drains the colour out of the room (red to green ${(calm.r / calm.g).toFixed(1)} -> ${(drained.r / Math.max(1, drained.g)).toFixed(1)})`);
  await force('hunger'); await page.waitForTimeout(2900);
  const dark = await mean();
  check(dark.r < calm.r * 0.6, `hunger puts the candles out (mean red ${calm.r.toFixed(0)} -> ${dark.r.toFixed(0)})`);
  for (const n of ['sweep', 'bloom', 'waltz', 'shatter', 'mirror']) { await force(n); await page.waitForTimeout(1300); }
  await page.waitForTimeout(4000);
  check(errors.length === 0, 'every event runs without an error');

  // a cut through the window, and it heals
  await page.mouse.click(1300, 700);
  check(await until(async () => (await state()).masked >= 4, 1000), 'a click on nothing cuts through the interface');
  await page.waitForTimeout(150);
  await page.screenshot({ path: out + '/ivy-cut.png' });
  check(await until(async () => (await state()).masked === 0, 4000), 'and the wound closes again');

  // but a click on a control is a click, not a cut
  await page.locator('ss-character-view .sheet > .tabs .u-tab', { hasText: 'INFO' }).click();
  await page.waitForTimeout(200);
  s = await state();
  check(s.masked === 0, 'clicking a control does not cut');
  check(await page.locator('ss-character-view .sheet > .tabs .u-tab.on', { hasText: 'INFO' }).count() === 1, 'and the click lands (INFO opens)');
  await page.locator('ss-character-view .sheet > .tabs .u-tab', { hasText: 'STATS' }).click();

  // performance mode turns the page's drawing off and back on
  const perf = page.locator('header.topbar [aria-label^="Performance mode"]');
  await perf.click();
  await page.waitForTimeout(400);
  s = await state();
  check(!s.overlay && !s.ownCursor, 'performance mode stops the overlay and gives the cursor back');
  await perf.click();
  check(await until(async () => (await state()).overlay), 'and turning it off starts it again');

  // leaving puts everything back
  await page.goto(BASE + '/c/' + IVY);   // a clean start for the leave test
  await page.locator('ss-world-canvas').waitFor({ timeout: 30000 });
  await page.mouse.move(1100, 420);
  await page.waitForTimeout(1500);
  await page.mouse.click(1300, 700);     // leave mid-cut, the worst case
  await page.waitForTimeout(200);
  await page.locator('ss-sidebar .entry', { hasText: 'BLACKJACK' }).first().click();
  await until(async () => page.url().includes(OTHER), 5000);
  await page.waitForTimeout(600);
  s = await state();
  check(!s.world && !s.overlay && !s.ownCursor && s.dataPage === null, 'leaving her page takes the hall, the overlay and the blade away');
  check(s.masked === 0 && s.swayed === 0, `and puts the interface back exactly (${s.masked} masked, ${s.swayed} moved)`);
  check(await page.locator('ss-main-page ss-pattern-canvas.bg').count() === 1, 'the next character gets the generic background again');

  // her base form has no page; the EVIL form does
  await page.goto(BASE + '/c/' + IVY);
  await page.locator('ss-world-canvas').waitFor({ timeout: 30000 });
  await page.locator('ss-character-view .forms .chip', { hasText: 'BASE' }).click();
  check(await until(async () => (await state()).dataPage === null && !(await state()).world, 5000), 'her base form is an ordinary sheet');
  await page.locator('ss-character-view .forms .chip', { hasText: 'EVIL' }).click();
  check(await until(async () => (await state()).dataPage === 'ivy_evil' && (await state()).overlay, 8000), 'and switching back to EVIL brings the page back');

  // a phone: the hall shows behind the sheet, a tap still cuts, and no blade is drawn without a pointer
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await require('./e2e_guard')(phone);
  phone.on('pageerror', e => errors.push('phone: ' + e));
  await phone.goto(BASE + '/c/' + IVY);
  await phone.locator('ss-world-canvas').waitFor({ timeout: 30000 });
  await phone.waitForTimeout(2000);
  const shown = await phone.evaluate(() => { const r = document.querySelector('ss-world-canvas').getBoundingClientRect(); return r.width > 300 && r.height > 500; });
  check(shown, 'on a phone the hall fills the screen behind the sheet');
  await phone.screenshot({ path: out + '/ivy-phone.png' });
  // an empty corner of the header: not a control, so a tap there is meant for the page
  const hero = await phone.locator('ss-character-view .hero').boundingBox();
  const tx = hero.x + hero.width - 20, ty = hero.y + 14;
  check(await phone.evaluate(([x, y]) => document.elementFromPoint(x, y)?.classList.contains('hero'), [tx, ty]), 'the tap point is the empty header');
  await phone.touchscreen.tap(tx, ty);
  check(await until(() => phone.evaluate(() => [...document.querySelectorAll('*')].some(e => e.style && e.style.maskImage)), 1500), 'a tap on nothing cuts, as a click does');
  await phone.waitForTimeout(150);
  await phone.screenshot({ path: out + '/ivy-phone-cut.png' });

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  console.log('PASS', ok.length); for (const o of ok) console.log('  ' + o);
  if (bad.length) { console.log('FAIL', bad.length); for (const b of bad) console.log('  ' + b); }
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
