// node juko_e2e.js [screenshot-dir]   (the e2e build on :8790, the emulator on :8085)
//
// Juko's code garden, beyond what pages_e2e checks for every page: Juko the
// cat follows the pointer on her own little canvas and a click puffs code
// tokens; every panel is ringed with code; an equalizer stands under the
// sheet; the song's three variables reach the sheet; and in 0∞ the page
// breaks down (the class that restyles the app, ∞ stats that flash back to
// the real number, the black vignette, and after the drop the windows and
// the kick), then lets go of all of it on the way back to the base form and
// on leaving the page.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';
const DOCS = 'http://127.0.0.1:8085/v1/projects/statsheets-3668d/databases/(default)/documents/';
const H = { 'content-type': 'application/json', authorization: 'Bearer owner' };
const JUKO = 'mp7hhy9t0kdessfvqzkr', PLAIN = 'mp89ltov0gprvsjawsw';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);
const formOf = async id => (await (await fetch(DOCS + 'next_characters/' + id + '?mask.fieldPaths=activeFormIdx', { headers: H })).json()).fields?.activeFormIdx;
const setForm = (id, f) => fetch(DOCS + 'next_characters/' + id + '?updateMask.fieldPaths=activeFormIdx', { method: 'PATCH', headers: H, body: JSON.stringify({ fields: f === undefined ? {} : { activeFormIdx: typeof f === 'object' ? f : { integerValue: f } } }) });

(async () => {
  const out = process.argv[2] || '.';
  const was = await formOf(JUKO);
  await setForm(JUKO, 0);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await require('./e2e_guard')(page);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const until = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await page.waitForTimeout(80); } return false; };
  const st = () => page.evaluate(() => {
    const view = document.querySelector('ss-character-view');
    const root = document.getElementById('pg-juko_code');
    const cvs = root ? [...root.querySelectorAll('canvas')] : [];
    const big = cvs[0], cat = cvs[1];
    const lit = c => { if (!c || !c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
    const eq = document.querySelector('ss-main-page .stage > canvas.pg-jk-eq');
    const row = document.querySelector("ss-character-view .bars .row[data-stat='atk'] .num");
    return {
      page: view?.getAttribute('data-page') || null,
      overlay: !!root,
      catShown: cat ? getComputedStyle(cat).visibility === 'visible' : false,
      catLit: lit(cat), bigLit: big && getComputedStyle(big).visibility === 'visible' ? lit(big) : 0,
      bigW: big?.width || 0, bigH: big?.height || 0,
      eq: !!eq, eqLit: lit(eq),
      glow: view?.style.getPropertyValue('--juko-glow') || '',
      nameText: document.querySelector('ss-character-view .head .name')?.getAttribute('data-text') ?? null,
      fx: !!document.querySelector('ss-character-view .head .portrait .pg-jk-fx'),
      inf: document.documentElement.classList.contains('pg-juko-0inf'),
      numSize: row ? getComputedStyle(row).fontSize : '',
      numBefore: row ? getComputedStyle(row, '::before').width : '',
      wins: document.querySelectorAll('.pg-jk0-win').length,
      flashes: document.querySelectorAll('ss-character-view .bars .row[data-flash]').length,
      kicked: ['header.topbar', 'main.page', 'ss-theme-bar'].some(s => document.querySelector(s)?.style.transform),
    };
  });
  /** How many overlay pixels lie along a panel's edge band (the ring of code). */
  const ringPixels = () => page.evaluate(() => {
    const c = document.querySelector('#pg-juko_code canvas');
    const p = document.querySelector('ss-character-view ss-panel')?.getBoundingClientRect();
    if (!c || !p || getComputedStyle(c).visibility !== 'visible') return 0;
    const px = innerWidth / c.width > 2.5 ? 3 : 2, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    // down the panel's left edge, below its title, as far as the window shows
    const x0 = Math.floor(p.left / px), y0 = Math.floor(p.top / px) + 12, y1 = Math.min(c.height - 30, Math.floor(p.bottom / px) - 4);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x0 + 7; x++) if (d[(y * c.width + x) * 4 + 3]) n++;
    return n;
  });

  try {
    await page.goto(BASE + '/c/' + JUKO);
    await page.locator('ss-character-view').waitFor({ timeout: 30000 });
    check(await until(async () => (await st()).page === 'juko_code', 8000), 'Juko! opens on her code garden');
    await page.mouse.move(900, 500);
    await page.mouse.move(1000, 520, { steps: 6 });
    check(await until(async () => { const s = await st(); return s.catShown && s.catLit > 200; }), 'Juko the cat follows the pointer');
    check(await until(async () => (await st()).eq && (await st()).eqLit > 0), 'the equalizer stands under the sheet');
    const s0 = await st();
    check(s0.glow !== '', 'the song reaches the sheet (--juko-glow is set)');
    check(s0.nameText === 'Juko!', 'the name carries its text for the split copies');
    check(s0.fx, 'the portrait has its sheen and </> tag');
    check(await until(async () => (await ringPixels()) > 20), 'the panels are ringed with code');
    check(!s0.inf && s0.wins === 0, 'the base form does not break down');
    // a click: she squishes and puffs tokens
    await page.mouse.click(1100, 420);   // the blank middle of the header, away from any control
    await page.waitForTimeout(120);
    check((await st()).bigLit > 0, 'a click throws code tokens');
    await page.screenshot({ path: `${out}/juko-base.png` });

    // 0∞
    await setForm(JUKO, 1);
    check(await until(async () => (await st()).inf, 6000), '0∞ restyles the app (html.pg-juko-0inf)');
    const s1 = await st();
    check(s1.page === 'juko_code' && s1.overlay, 'the same page carries on into 0∞');
    check(await until(async () => { const s = await st(); return s.numSize === '0px' && parseFloat(s.numBefore) > 0; }), 'ATK reads ∞');
    await page.waitForTimeout(1500);
    const vig = await page.evaluate(() => {
      const c = document.querySelector('#pg-juko_code canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0, k = 0;
      for (let i = 0; i < d.length; i += 4 * 97) { k++; if (d[i + 3] && d[i] < 8 && d[i + 1] < 8 && d[i + 2] < 8) n++; }
      return n / k;
    });
    check(vig > 0.3, `the intro's black vignette covers the page (${vig.toFixed(2)})`);
    await page.screenshot({ path: `${out}/juko-0inf-intro.png` });
    // jump the clock to the drop
    await page.evaluate(() => document.getElementById('pg-juko_code').force('drop'));
    check(await until(async () => (await st()).wins > 0, 9000), 'after the drop, corrupted windows open round the sheet');
    check(await until(async () => (await st()).flashes > 0, 6000), '∞ flashes back to the real number');
    check(await until(async () => (await st()).kicked, 9000), 'the app gets kicked');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/juko-0inf-drop.png` });

    // back to the base form: everything lets go
    await setForm(JUKO, 0);
    check(await until(async () => { const s = await st(); return !s.inf && s.wins === 0 && !s.kicked && s.flashes === 0; }, 6000), 'back in the base form the breakdown lets go');

    // leaving the page puts the sheet back
    await page.goto(BASE + '/c/' + PLAIN);
    await page.locator('ss-character-view').waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    const s2 = await page.evaluate(() => ({
      eq: !!document.querySelector('.pg-jk-eq'), overlay: !!document.getElementById('pg-juko_code'),
      glow: document.querySelector('ss-character-view')?.style.getPropertyValue('--juko-glow') || '',
      text: document.querySelector('ss-character-view .head .name')?.getAttribute('data-text') ?? null,
      fx: !!document.querySelector('.pg-jk-fx'), inf: document.documentElement.classList.contains('pg-juko-0inf'),
    }));
    check(!s2.eq && !s2.overlay && !s2.glow && s2.text === null && !s2.fx && !s2.inf, 'leaving her page puts everything back');
    check(!errors.length, 'no errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    bad.push('crashed: ' + e.message);
  } finally {
    await setForm(JUKO, was);
    await browser.close();
  }
  for (const m of ok) console.log('  ok  ' + m);
  for (const m of bad) console.log('  BAD ' + m);
  console.log(`${ok.length} passed, ${bad.length} failed`);
  process.exit(bad.length ? 1 : 0);
})();
