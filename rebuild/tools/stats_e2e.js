// node stats_e2e.js [screenshot-dir]  (needs the build served on :8790)
// The stat breakdown and trait tooltips, the radar chart and the power level window.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';
const ADALIN = 'mprml5c7lazz7zrtmf';   // a Cutlass (ATK +80) and Voidborn in the test data

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

  await page.goto(`${BASE}/c/${ADALIN}`);
  await page.waitForSelector('ss-stat-bar', { timeout: 20000 });
  const tip = page.locator('ss-tooltip-host .tip');

  const atkDiff = page.locator('.row', { hasText: 'ATK' }).locator('.diff');
  check(/\(\+\d+/.test(await atkDiff.textContent()), 'ATK shows its (+diff)');
  await atkDiff.hover();
  await tip.waitFor();
  const t1 = await tip.textContent();
  check(/ATK BREAKDOWN/.test(t1) && /Cutlass/.test(t1) && /TOTAL/.test(t1), 'ATK breakdown lists base, the item and the total');
  await page.screenshot({ path: out + '/stats-breakdown.png' });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(100);
  check((await tip.count()) === 0, 'tooltip hides on leave');

  await page.locator('ss-trait-card').first().hover();
  await tip.waitFor();
  const t2 = await tip.textContent();
  check(/•/.test(t2), `trait tooltip shows rarity and name (${(await tip.locator('.title').textContent()).trim()})`);
  await page.mouse.move(5, 5);

  await page.locator('button[aria-label="Stat radar chart"]').click();
  await page.waitForSelector('ss-radar-chart svg');
  check((await page.locator('ss-radar-chart text').count()) === 12, 'radar draws six labels with percentages');
  check((await page.locator('ss-radar-chart rect').count()) >= 6, 'radar marks each stat');
  await page.locator('ss-radar-chart').scrollIntoViewIfNeeded();
  await page.locator('ss-radar-chart').screenshot({ path: out + '/stats-radar.png' });

  await page.locator('button[aria-label="Power level reference"]').click();
  await page.waitForSelector('ss-power-modal .tier');
  check((await page.locator('ss-power-modal .tier').count()) === 8, 'power window lists eight tiers');
  check((await page.locator('ss-power-modal .tier.here').count()) === 1, 'the character\'s tier is marked');
  check(/MOUNTAIN LEVEL[\s\S]*HP: 850-1250/.test(await page.locator('ss-power-modal').textContent()), 'top tier runs to the hard cap');
  await page.screenshot({ path: out + '/stats-power.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check((await page.locator('ss-power-modal').count()) === 0, 'Escape closes it');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
