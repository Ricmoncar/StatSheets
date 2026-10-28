// node pages_e2e.js [screenshot-dir] [page-key ...]   (the e2e build on :8790, the emulator on :8085)
//
// Every character page made so far, the same checks for each: the character
// (in the form that has the page, set on the character for the run) opens on
// its page; the world is drawn at art resolution, fills the window and moves;
// the page's overlay (pg-<key>) starts with it; performance mode takes the
// drawing and the overlay away and gives them back; leaving for a character
// without a page puts everything back; and on a phone the world fills the
// screen. Pages not made yet are listed and skipped. fixtures/pages_map.json
// (from old_pages_map.js) says which character and form each page belongs to.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const map = require('./fixtures/pages_map.json').pages;
const BASE = 'http://127.0.0.1:8790';
const DOCS = 'http://127.0.0.1:8085/v1/projects/statsheets-3668d/databases/(default)/documents/';
const H = { 'content-type': 'application/json', authorization: 'Bearer owner' };
const PLAIN = 'mp89ltov0gprvsjawsw';    // Jemma, who has no page of her own
// pages that keep still on purpose (none yet)
const STILL = new Set([]);

const ok = [], bad = [], skipped = [];
const check = (cond, what) => (cond ? ok : bad).push(what);
const formOf = async id => (await (await fetch(DOCS + 'next_characters/' + id + '?mask.fieldPaths=activeFormIdx', { headers: H })).json()).fields?.activeFormIdx;
const setForm = (id, f) => fetch(DOCS + 'next_characters/' + id + '?updateMask.fieldPaths=activeFormIdx', { method: 'PATCH', headers: H, body: JSON.stringify({ fields: f === undefined ? {} : { activeFormIdx: typeof f === 'object' ? f : { integerValue: f } } }) });

(async () => {
  const out = process.argv[2] || '.';
  const only = new Set(process.argv.slice(3));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await require('./e2e_guard')(page);
  let errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const until = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await page.waitForTimeout(80); } return false; };
  const state = key => page.evaluate(key => ({
    dataPage: document.querySelector('ss-character-view')?.getAttribute('data-page') || null,
    world: !!document.querySelector('ss-world-canvas'),
    overlay: !!document.getElementById('pg-' + key),
    ownCursor: document.documentElement.classList.contains('pg-own-cursor'),
    moved: [...document.querySelectorAll('*')].filter(e => e.style && (e.style.translate || e.style.maskImage)).length,
  }), key);
  const world = () => page.evaluate(() => {
    const c = document.querySelector('ss-world-canvas canvas');
    if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let filled = 0, n = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4 * 53) { n++; if (d[i + 3]) filled++; sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7 + i) % 1e9; }
    return { w: c.width, css: c.getBoundingClientRect().width, filled: filled / n, sum };
  });

  for (const [key, owners] of Object.entries(map)) {
    if (only.size && !only.has(key)) continue;
    const who = owners[0];
    const was = await formOf(who.id);
    await setForm(who.id, who.form);
    errors = [];
    try {
      await page.goto(BASE + '/c/' + who.id);
      await page.locator('ss-character-view').waitFor({ timeout: 30000 });
      if (!(await until(async () => (await state(key)).dataPage === key, 4000))) { skipped.push(key); continue; }
      const label = `${key} (${who.name}${who.formName ? ' · ' + who.formName : ''})`;
      await page.mouse.move(1100, 420);
      check(await until(async () => { const w = await world(); return w && w.filled > 0.9; }, 8000), `${label}: the world is drawn behind the sheet`);
      const a = await world();
      await page.waitForTimeout(700);
      const b = await world();
      check(a.w === Math.ceil(a.css / 3), `${label}: at art resolution (${a.w} wide)`);
      if (!STILL.has(key)) check(a.sum !== b.sum, `${label}: and it moves`);
      const s = await state(key);
      check(s.world && s.overlay, `${label}: its overlay is over the window`);
      await page.screenshot({ path: `${out}/${key}.png` });

      const perf = page.locator('header.topbar [aria-label^="Performance mode"]');
      await perf.click();
      await page.waitForTimeout(400);
      const p = await state(key), pw = await world();
      check(!p.overlay && !p.ownCursor && pw && pw.filled === 0, `${label}: performance mode stops the drawing and the overlay`);
      await perf.click();
      check(await until(async () => (await state(key)).overlay), `${label}: and they come back`);

      await page.goto(BASE + '/c/' + PLAIN);
      await page.locator('ss-character-view').waitFor({ timeout: 30000 });
      await page.waitForTimeout(500);
      const l = await state(key);
      check(!l.world && !l.overlay && !l.ownCursor && l.dataPage === null && l.moved === 0, `${label}: leaving puts everything back`);
      check(!errors.length, `${label}: no errors` + (errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''));
    } finally {
      await setForm(who.id, was);
    }
  }

  // a phone, for the pages asked for (or the first few)
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await require('./e2e_guard')(phone);
  const done = Object.keys(map).filter(k => !skipped.includes(k) && (!only.size || only.has(k))).slice(0, only.size ? 99 : 3);
  for (const key of done) {
    const who = map[key][0], was = await formOf(who.id);
    await setForm(who.id, who.form);
    try {
      await phone.goto(BASE + '/c/' + who.id);
      await phone.locator('ss-world-canvas').waitFor({ timeout: 30000 });
      await phone.waitForTimeout(1500);
      const r = await phone.evaluate(() => { const c = document.querySelector('ss-world-canvas canvas'); const b = c.getBoundingClientRect(); return { w: b.width, h: b.height, art: c.width }; });
      check(r.w >= 380 && r.h > 500 && r.art === Math.ceil(r.w / 2), `${key} on a phone: the world fills the screen, at the phone's art size (${r.art} wide)`);
      await phone.screenshot({ path: `${out}/${key}-phone.png` });
    } finally { await setForm(who.id, was); }
  }

  await browser.close();
  for (const s of ok) console.log('  ok   ' + s);
  for (const s of bad) console.log('  FAIL ' + s);
  console.log(`${ok.length} passed, ${bad.length} failed; not made yet: ${skipped.length}${skipped.length && only.size ? ' (' + skipped.join(', ') + ')' : ''}`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
