// node utilities_e2e.js [screenshot-dir]  (needs the build served on :8790; writes nothing)
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

  await page.goto(BASE + '/utilities');
  await page.waitForSelector('ss-dice-roller');
  await page.screenshot({ path: out + '/util-top.png' });

  // dice
  await page.locator('ss-dice-roller input').fill('6');
  await page.locator('ss-dice-roller button').click();
  await page.waitForTimeout(400);
  check(await page.locator('ss-dice-roller .stage.cinematic').count() === 1, 'the die rolls centre screen');
  await page.screenshot({ path: out + '/util-dice-rolling.png' });
  await page.waitForSelector('ss-dice-roller .cube.land', { timeout: 6000 });
  const face = (await page.locator('ss-dice-roller .face').first().textContent()).trim();
  check(+face >= 1 && +face <= 6, `it lands on 1..6 (${face})`);
  check(await page.locator('.toast', { hasText: 'DICE ROLLED: ' + face }).count() > 0, 'and says so');
  await page.locator('ss-dice-roller .overlay').click();
  await page.waitForTimeout(150);
  check(await page.locator('ss-dice-roller .stage.cinematic').count() === 0, 'a click puts it back');

  // crit
  await page.locator('ss-crit-calc input').first().fill('100');
  await page.locator('ss-crit-calc button').click();
  await page.waitForSelector('ss-crit-calc .result[data-state="crit"], ss-crit-calc .result[data-state="miss"]', { timeout: 6000 });
  check((await page.locator('ss-crit-calc .result').textContent()).trim() === 'CRIT!', '100% crit chance always crits');
  check(/FINAL: x\d/.test(await page.locator('ss-crit-calc .detail').textContent()), 'with the multiplier shown');

  // tier list (moves one character and puts it back)
  await page.waitForSelector('ss-tier-list .tab', { timeout: 15000 });
  check((await page.locator('ss-tier-list .row').count()) === 6, 'the tier list has rows S to F');
  const poolChip = page.locator('ss-tier-list .pool .chip').first();
  const who = (await poolChip.locator('.name').textContent()).trim();
  await poolChip.click();
  await page.locator('ss-tier-list .row').first().locator('.slots').click();
  const inS = page.locator('ss-tier-list .row').first().locator('.chip', { hasText: who });
  await inS.waitFor({ timeout: 5000 });
  check(true, `click a chip, then a row: ${who} goes to S`);
  await inS.dragTo(page.locator('ss-tier-list .row').nth(1).locator('.slots'));
  const inA = page.locator('ss-tier-list .row').nth(1).locator('.chip', { hasText: who });
  await inA.waitFor({ timeout: 5000 });
  check(true, 'dragging moves it to A');
  await inA.hover();
  await page.locator('ss-tooltip-host .tip').waitFor({ timeout: 3000 });
  check(/HP/.test(await page.locator('ss-tooltip-host .tip').textContent()), 'a chip shows its stats on hover');
  await page.locator('ss-tier-list').screenshot({ path: out + '/util-tiers.png' });
  await inA.click();
  await page.locator('ss-tier-list .pool').click({ position: { x: 5, y: 5 } });
  await page.locator('ss-tier-list .pool .chip', { hasText: who }).first().waitFor({ timeout: 5000 });
  check(await page.locator('ss-tier-list .row .chip', { hasText: who }).count() === 0, 'and back to UNRANKED');

  // stat checker
  const atk = page.locator('ss-stat-checker .row').nth(1);
  await atk.locator('.math input').nth(0).fill('40');
  await atk.locator('.math input').nth(1).fill('2');
  check((await atk.locator('.res b').textContent()).trim() === '100', '(10 + 40) x 2 / 1 = 100');
  check(/CRIT CHANCE:\s*1\.5%/.test(await page.locator('ss-stat-checker .subs').textContent()), 'and the derived crit chance follows (1.5%)');

  // status roller
  await page.waitForFunction(() => /\d+ STATUS EFFECT/.test(document.querySelector('ss-status-roller .pool')?.textContent || '') && !/^0 /.test(document.querySelector('ss-status-roller .pool').textContent), null, { timeout: 15000 });
  const poolAll = await page.locator('ss-status-roller .pool').textContent();
  await page.locator('ss-status-roller .type', { hasText: /^BUFF$/ }).click();
  const poolBuff = await page.locator('ss-status-roller .pool').textContent();
  check(parseInt(poolBuff) < parseInt(poolAll), `filtering narrows the pool (${parseInt(poolAll)} -> ${parseInt(poolBuff)})`);
  await page.locator('ss-status-roller .btn.accent').click();
  await page.waitForSelector('ss-status-roller .result:not(.scrambling)', { timeout: 6000 });
  check(/^BUFF$/.test((await page.locator('ss-status-roller .badge').textContent()).trim()), 'a BUFF is rolled');
  await page.locator('ss-status-roller').scrollIntoViewIfNeeded();
  await page.locator('ss-status-roller').screenshot({ path: out + '/util-status.png' });

  // suggestions: the checks before sending (nothing is sent)
  await page.locator('ss-trait-suggestions button[type=submit]').click();
  await page.waitForTimeout(150);
  check((await page.locator('ss-trait-suggestions .status').textContent()).includes('TRAIT NAME IS REQUIRED'), 'a trait suggestion needs a name');
  await page.locator('ss-general-suggestions button[type=submit]').click();
  await page.waitForTimeout(150);
  check((await page.locator('ss-general-suggestions .status').textContent()).includes('WRITE SOMETHING FIRST'), 'a general one needs text');
  await page.waitForSelector('ss-trait-suggestions .count, ss-trait-suggestions .none', { timeout: 15000 });
  check(true, 'the suggestion list loads');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
