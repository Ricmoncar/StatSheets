// node roll_e2e.js [screenshot-dir]   (the e2e build on :8790, the Firestore emulator on :8085)
//
// THE TRAIT ROLL: the cards are dealt face down, the reels turn through
// trait names and slow before each card lands, in turn; a high card gives
// itself away first (the pity roll makes sure of one), lands with rays behind
// it; pity is counted and saved; taking a card plays out before the overlay
// closes and saves the trait; REROLL, Escape, AUTO roll and the form chooser
// work; performance mode keeps the rules and drops the show. The characters
// used are put back as they were.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';
const DOCS = 'http://127.0.0.1:8085/v1/projects/statsheets-3668d/databases/(default)/documents/';
const H = { 'content-type': 'application/json', authorization: 'Bearer owner' };

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

const plain = v => {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)]));
  return v.timestampValue;
};
const raw = async id => (await fetch(DOCS + 'next_characters/' + id, { headers: H })).json();
const char = async id => plain({ mapValue: { fields: (await raw(id)).fields } });
const put = (id, doc) => fetch(DOCS + 'next_characters/' + id, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: doc.fields }) });
const setPity = (id, n) => fetch(DOCS + 'next_characters/' + id + '?updateMask.fieldPaths=pity', { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { pity: { integerValue: n } } }) });

(async () => {
  const out = process.argv[2] || '.';
  // one character without forms, one with
  const list = (await (await fetch(DOCS + 'next_characters?pageSize=300&mask.fieldPaths=name&mask.fieldPaths=altForms', { headers: H })).json()).documents;
  const hasForms = d => (d.fields?.altForms?.arrayValue?.values || []).length > 0;
  const plainId = list.find(d => !hasForms(d)).name.split('/').pop(), formsId = list.find(hasForms).name.split('/').pop();
  const saved = { [plainId]: await raw(plainId), [formsId]: await raw(formsId) };

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await require('./e2e_guard')(page);   // only ever against the local emulator
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(40); } return false; };
  const overlay = page.locator('ss-roll-overlay');
  const cards = overlay.locator('button.card');
  const title = async () => (await overlay.locator('.title').textContent().catch(() => '')).trim();
  const open = async id => {
    await page.goto(BASE + '/c/' + id);
    await page.waitForSelector('button[title="Roll for a new trait"]', { timeout: 20000 });
    await page.waitForTimeout(600);
    // a recorder: when each card changes phase, and when each reel turns
    await page.evaluate(() => {
      window.__roll = { t0: 0, phases: [], ticks: [[], [], []] };
      new MutationObserver(ms => {
        const now = performance.now();
        for (const m of ms) {
          const card = m.target.closest?.('ss-roll-overlay button.card');
          if (!card) continue;
          const i = [...card.parentElement.children].indexOf(card);
          if (m.type === 'attributes' && m.attributeName === 'data-phase') window.__roll.phases.push([i, card.dataset.phase, Math.round(now - window.__roll.t0)]);
          if (m.type === 'childList' && [...m.addedNodes].some(n => n.classList?.contains('strip'))) window.__roll.ticks[i].push(Math.round(now - window.__roll.t0));
        }
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase'] });
    });
  };
  const roll = async () => { await page.evaluate(() => { window.__roll.t0 = performance.now(); window.__roll.phases = []; window.__roll.ticks = [[], [], []]; }); await page.click('button[title="Roll for a new trait"]'); };
  const ready = () => until(async () => await overlay.locator('.cards.ready').count() === 1, 8000);

  try {
    // ── an ordinary roll ──
    await setPity(plainId, 10);
    await open(plainId);
    await roll();
    check(await until(async () => await cards.count() === 3 && (await cards.evaluateAll(cs => cs.every(c => c.dataset.phase === 'back')))), 'three cards are dealt, face down');
    const names = new Set();
    for (let i = 0; i < 16; i++) { names.add(await overlay.locator('button.card').first().locator('.strip .name').textContent().catch(() => '')); await page.waitForTimeout(45); }
    names.delete('');
    check(names.size >= 4, `the first reel turns through trait names (${names.size} seen: ${[...names].slice(0, 4).join(', ')})`);
    check(await cards.first().isDisabled(), 'the cards cannot be taken while they are dealt');
    check(await overlay.locator('.u-btn.primary', { hasText: 'REROLL' }).isDisabled(), 'nor rerolled');
    check(await ready(), 'the hand is ready');
    const rec = await page.evaluate(() => window.__roll);
    const landed = [0, 1, 2].map(i => (rec.phases.find(p => p[0] === i && p[1] === 'face') || [])[2]);
    check(landed.every(Boolean) && landed[0] < landed[1] && landed[1] < landed[2] && Math.abs(landed[0] - 1400) < 250 && Math.abs(landed[2] - 2500) < 250, 'the cards land in turn, as on the old page: ' + landed.join(', ') + ' ms');
    const gaps = rec.ticks[2].slice(1).map((t, i) => t - rec.ticks[2][i]);
    const early = gaps.slice(0, 4).reduce((a, b) => a + b, 0) / 4, late = gaps.slice(-3).reduce((a, b) => a + b, 0) / 3;
    check(gaps.length >= 8 && late > early * 1.8, `each reel slows as it comes to land (the third: ${Math.round(early)} ms a turn at first, ${Math.round(late)} at the end, ${gaps.length + 1} turns)`);
    check(await title() === 'YOUR TRAIT HAND', 'YOUR TRAIT HAND');
    check(await overlay.locator('.cta:not(.hidden)').count() === 3, 'each card says TAKE IT');
    const doc1 = await char(plainId);
    const shownPity = Number(await overlay.locator('.pity-count').textContent());
    check(doc1.pity === shownPity && (shownPity === 11 || shownPity < 11), `pity is counted and saved (${shownPity})`);
    await page.screenshot({ path: out + '/roll-hand.png' });

    // REROLL deals a new hand
    await overlay.locator('.u-btn.primary', { hasText: 'REROLL' }).click();
    check(await until(async () => (await cards.evaluateAll(cs => cs.map(c => c.dataset.phase))).includes('back') || (await cards.evaluateAll(cs => cs.map(c => c.dataset.phase))).includes('reel')), 'REROLL deals again');
    check(await ready(), 'and the new hand is ready');

    // taking a card: it rises, the others fall away, then the overlay closes and the trait is saved
    const before = JSON.stringify((await char(plainId)).traits || []);
    await cards.nth(1).click();
    check(await until(async () => await overlay.locator('.card.picked').count() === 1 && await overlay.locator('.card.dropped').count() === 2, 1000), 'the card taken rises and the others fall away');
    await page.waitForTimeout(250);
    check(await overlay.count() === 1, 'the overlay stays while it plays out');
    check(await until(async () => await overlay.count() === 0, 2000), 'then closes');
    check(await until(async () => JSON.stringify((await char(plainId)).traits || []) !== before), 'and the trait is saved');

    // Escape puts the hand away
    await roll();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    check(await until(async () => await overlay.count() === 0, 1500), 'Escape puts the hand away mid-deal');

    // ── a pity roll: a high card tells, lands with rays and a flash ──
    await setPity(plainId, 99);
    await open(plainId);
    await roll();
    check(await until(async () => await title() === 'PITY ROLL!'), 'the 100th roll is the PITY ROLL');
    let told = false, tense = false;
    for (let i = 0; i < 70 && !(told && tense); i++) {
      told = told || await overlay.locator('button.card[data-tell="hard"], button.card[data-tell="hex"]').count() > 0;
      tense = tense || await overlay.locator('.backdrop.tense').count() > 0;
      await page.waitForTimeout(40);
    }
    check(told, 'a high card gives itself away before it lands');
    check(tense, 'and the room darkens');
    check(await until(async () => await overlay.locator('.glare').count() > 0, 3000), 'it lands with a flash');
    check(await ready(), 'the hand is ready');
    const rarities = await cards.evaluateAll(cs => cs.map(c => c.dataset.rarity));
    check(rarities.some(r => ['legendary', 'mythic', 'hexxed', 'duality', 'determined'].includes(r)), 'with legendary or better in it: ' + rarities.join(', '));
    await page.waitForTimeout(300);
    const rayPixels = await overlay.locator('canvas.fx-back').evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
    check(rayPixels > 200, `rays turn behind it (${rayPixels} pixels)`);
    check(Number(await overlay.locator('.pity-count').textContent()) === 0 && (await char(plainId)).pity === 0, 'and pity is reset');
    await page.screenshot({ path: out + '/roll-pity.png' });
    await page.keyboard.press('Escape');

    // ── AUTO roll stops on a notable hand ──
    await setPity(plainId, 10);
    await open(plainId);
    await roll();
    await overlay.locator('.u-btn', { hasText: 'AUTO' }).click();
    await overlay.locator('.ar', { hasText: 'RARE' }).click();
    check(await until(async () => (await title()) === '★ NOTABLE ROLL', 30000), 'AUTO rolls until a notable hand (rare or better here)');
    check(await overlay.locator('.card.notable').count() >= 1, 'and marks the cards it stopped for');
    await page.keyboard.press('Escape');

    // ── a character with forms: which form first ──
    await open(formsId);
    await roll();
    check(await until(async () => await overlay.locator('.form-row').count() >= 2), 'a character with forms is asked which form first');
    await overlay.locator('.form-row').nth(1).click();
    check(await until(async () => await cards.count() === 3), 'and the hand is dealt for it');
    check(/for /i.test(await overlay.locator('.sub').textContent()), 'saying which form');
    check(await ready(), 'it lands');
    await page.keyboard.press('Escape');

    // ── performance mode: the same roll, without the show ──
    await page.evaluate(() => localStorage.setItem('perf_mode', '1'));
    await setPity(plainId, 99);
    await open(plainId);
    await roll();
    check(await until(async () => await overlay.evaluate(e => e.classList.contains('quiet'))), 'in performance mode the roll is quiet');
    check(await ready(), 'and still deals a hand');
    const quietRays = await overlay.locator('canvas.fx-back').evaluate(c => c.width);
    check(quietRays === 300 || quietRays === 0, 'with nothing drawn behind it');
    const t = Date.now();
    await cards.first().click();
    check(await until(async () => await overlay.count() === 0, 1000) && Date.now() - t < 900, 'and taking a card closes it at once');
    await page.evaluate(() => localStorage.removeItem('perf_mode'));

    // ── a phone ──
    await page.setViewportSize({ width: 390, height: 844 });
    await setPity(plainId, 10);
    await open(plainId);
    await roll();
    check(await ready(), 'on a phone the hand is dealt and lands');
    check(await page.evaluate(() => document.documentElement.scrollWidth) <= 390, 'and fits across the screen');
    await page.screenshot({ path: out + '/roll-phone.png' });
    await page.keyboard.press('Escape');

    check(!errors.length, 'no errors on the page' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    bad.push('the run stopped: ' + String(e && e.stack || e).slice(0, 400));
    await page.screenshot({ path: out + '/roll-failure.png' }).catch(() => {});
  } finally {
    await browser.close();
    for (const [id, doc] of Object.entries(saved)) await put(id, doc);
  }
  for (const s of ok) console.log('  ok   ' + s);
  for (const s of bad) console.log('  FAIL ' + s);
  console.log(`${ok.length} passed, ${bad.length} failed`);
  process.exit(bad.length ? 1 : 0);
})();
