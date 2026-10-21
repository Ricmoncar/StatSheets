// Screenshot any local HTML file (or http URL) at desktop and phone width.
//   node shoot.js <file.html|url> <out-prefix> [--wait=1500] [--full] [--scroll=0]
// Writes <out-prefix>-desktop.png (1920x1080) and <out-prefix>-mobile.png (390x844).
// --full captures the whole scrolling page; --scroll=N scrolls N px first.
// HTTPS (Google Fonts etc.) goes through the agent proxy; everything else is direct.
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const [target, prefix, ...rest] = process.argv.slice(2);
  if (!target || !prefix) { console.error('usage: node shoot.js <file|url> <out-prefix> [--wait=ms] [--full] [--scroll=px]'); process.exit(2); }
  const opt = Object.fromEntries(rest.map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
  const url = /^(https?|file):/.test(target) ? target : 'file://' + path.resolve(target);
  const proxy = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost'] });
  const errors = [];
  for (const [name, w, h, mobile] of [['desktop', 1920, 1080, false], ['mobile', 390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e));
    page.on('console', m => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(+(opt.wait || 1500));
    if (opt.scroll) { await page.evaluate(y => window.scrollTo(0, y), +opt.scroll); await page.waitForTimeout(400); }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) errors.push(name + `: horizontal overflow of ${overflow}px`);
    await page.screenshot({ path: `${prefix}-${name}.png`, fullPage: !!opt.full });
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? 'ISSUES:\n' + errors.join('\n') : 'ok, no page errors or overflow');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
