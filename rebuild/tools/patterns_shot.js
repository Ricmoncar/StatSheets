// node patterns_shot.js <out-dir>  (needs the build served on :8790)
// Opens the NEW CHARACTER editor, picks each background pattern in turn and
// screenshots its live preview (two frames apart, to see it move), then checks
// the STYLE tab and PERF mode. Writes <out-dir>/pat-<type>-<n>.png.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';

(async () => {
  const out = process.argv[2] || '.';
  const proxy = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto(`${BASE}/new`);
  const select = page.locator('select').filter({ has: page.locator('option[value="checkerboard"]') });
  await select.waitFor({ timeout: 20000 });
  const types = await select.locator('option').evaluateAll(os => os.map(o => o.value).filter(v => v !== 'none'));
  for (const type of types) {
    await select.selectOption(type);
    const prev = page.locator('.preview');
    await prev.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await prev.screenshot({ path: `${out}/pat-${type}-1.png` });
    await page.waitForTimeout(400);
    await prev.screenshot({ path: `${out}/pat-${type}-2.png` });
    const blank = await prev.locator('canvas').evaluate(cv => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
      return true;
    });
    if (blank) errors.push(`${type}: preview is blank`);
  }
  console.log(types.length + ' patterns');

  // PERF mode empties the canvas
  await page.locator('button', { hasText: /^\s*PERF\s*$/ }).click();
  await page.waitForTimeout(300);
  const perfBlank = await page.locator('.preview canvas').evaluate(cv => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
    return true;
  });
  if (!perfBlank) errors.push('PERF mode did not stop the pattern');
  await page.locator('button', { hasText: 'PERF: ON' }).click();

  // the SFX panel: volume and mute, saved under the old site's keys
  await page.locator('ss-sfx-control > button').click();
  const slider = page.locator('ss-sfx-control input[type=range]');
  await slider.evaluate(el => { el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('ss-sfx-control .mute').click();
  const saved = await page.evaluate(() => [localStorage.getItem('sfx_volume'), localStorage.getItem('sfx_muted')]);
  if (saved[0] !== '0.4' || saved[1] !== '1') errors.push('SFX settings not saved: ' + saved);
  await page.locator('ss-sfx-control .mute').click();
  await slider.evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.mouse.click(5, 600);
  if (await page.locator('ss-sfx-control .panel').count()) errors.push('SFX panel did not close on an outside click');

  await browser.close();
  console.log(errors.length ? 'ISSUES:\n' + errors.join('\n') : 'ok, every pattern draws, PERF stops them, the SFX panel saves, no page errors');
})().catch(e => { console.error('CRASH', e); process.exit(1); });
