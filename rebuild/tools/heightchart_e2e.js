// node heightchart_e2e.js [screenshot-dir]  (needs the build served on :8790; edits the
// next_ test data and puts it back: an entry is added and deleted, a height changed and restored)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

(async () => {
  const out = process.argv[2] || '.';
  const proxy = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await require('./e2e_guard')(page);   // only ever against the local emulator
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  /** Polls until fn() holds: the page redraws after the event that changed it, not during. */
  const until = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(50); } return false; };
  const text = l => l.textContent().then(t => (t || '').trim());

  await page.goto(BASE + '/utilities');
  await page.locator('.hc-btn').click();
  const hc = page.locator('ss-height-chart');
  await hc.locator('.char').first().waitFor({ timeout: 20000 });
  const n = await hc.locator('.char').count();
  check(n > 0, `the chart shows its characters (${n})`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/hc-open.png' });

  // units
  const firstLabel = (await hc.locator('.char .height').first().textContent()).trim();
  await hc.locator('.units .btn', { hasText: 'IN' }).click();
  await until(async () => /'\d+"$/.test(await text(hc.locator('.char .height').first())));
  const inLabel = (await hc.locator('.char .height').first().textContent()).trim();
  check(/cm$/.test(firstLabel) && /'\d+"$/.test(inLabel), `CM / IN switch the labels (${firstLabel} -> ${inLabel})`);
  await hc.locator('.units .btn', { hasText: 'CM' }).click();

  // zoom
  await hc.locator('.zoom .btn').last().click();
  check(await until(async () => await text(hc.locator('.zoom-val')) === '125%'), 'zoom in');
  await hc.locator('.zoom .btn').first().click();

  // add, edit, delete
  await hc.locator('.btn.accent', { hasText: '+ ADD' }).click();
  await hc.locator('.char', { hasText: 'CHARACTER' }).last().waitFor({ timeout: 5000 });
  check(await until(async () => (await hc.locator('.char').count()) === n + 1), '+ ADD adds one');
  const nameBox = hc.locator('.edit input[type=text]');
  await nameBox.fill('E2E TALL');
  await hc.locator('.edit input[type=number]').fill('250');
  await page.waitForTimeout(200);
  const added = hc.locator('.char', { hasText: 'E2E TALL' });
  check(await until(async () => await text(added.locator('.height')) === '250cm'), 'editing name and height redraws it');
  await page.screenshot({ path: out + '/hc-edit.png' });
  await hc.locator('.edit .btn', { hasText: /^AURA/ }).click();
  check(await until(async () => (await added.getAttribute('data-aura')) === 'blaze'), 'AURA cycles to blaze');
  await hc.locator('.edit .btn.danger').click();
  await page.waitForTimeout(700);
  check(await until(async () => (await hc.locator('.char').count()) === n), 'DELETE removes it');

  // select an existing one, and the import picker
  await hc.locator('.char').first().click();
  check(await until(async () => await hc.locator('.edit').count() === 1), 'clicking a character opens its editor');
  await hc.locator('.actions .btn', { hasText: 'IMPORT' }).click();
  check(await until(async () => (await hc.locator('.imp').count()) > 100), 'IMPORT lists the roster');
  await hc.locator('.import .search').fill('zzzz-none');
  check(await until(async () => /NO MATCH/.test(await hc.locator('.import').textContent())), 'and searches it');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check(await until(async () => await hc.locator('.import').count() === 0), 'Escape closes the picker first');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check(await until(async () => await page.locator('ss-height-chart').count() === 0), 'then the chart');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
