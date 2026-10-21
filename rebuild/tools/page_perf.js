// node page_perf.js [page-character-id] [ordinary-character-id]   (needs the e2e build served on :8790 and the emulator)
//
// What a character page costs against an ordinary sheet: frames a second,
// how busy the main thread is, and long tasks, on a desktop and on a phone
// with its CPU slowed four times. Events come and go, so run it twice
// before believing a difference of a few points.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const B = 'http://127.0.0.1:8790/c/';
const PAGE = process.argv[2] || 'mtow23ogt9yab1yg7qr';     // Ivy, EVIL creature
const PLAIN = process.argv[3] || 'mp7grig28yapvrdxg4';     // Blackjack, no page of his own

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  const devices = [
    ['desktop', { viewport: { width: 1600, height: 900 } }, 1],
    ['phone 4x cpu', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 4],
  ];
  for (const [dev, opts, cpu] of devices) {
    for (const [name, id] of [['page', PAGE], ['ordinary', PLAIN]]) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      await require('./e2e_guard')(page);
      await page.addInitScript(() => { window.__lt = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt += e.duration; }).observe({ type: 'longtask', buffered: true }); });
      await page.goto(B + id);
      await page.locator('ss-character-view header.head').waitFor({ timeout: 60000 });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      if (!opts.isMobile) await page.mouse.move(1000, 400);
      await page.waitForTimeout(3000);
      await cdp.send('Performance.enable');
      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      const m0 = await metrics();
      const lt0 = await page.evaluate(() => window.__lt);
      const fps = await page.evaluate(ms => new Promise(res => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < ms) requestAnimationFrame(f); else res(Math.round(n * 1000 / ms)); }; requestAnimationFrame(f); }), 4000);
      const m1 = await metrics();
      rows.push({
        dev, page: name, fps,
        mainThreadBusy: ((m1.TaskDuration - m0.TaskDuration) / (m1.Timestamp - m0.Timestamp) * 100).toFixed(0) + '%',
        longTasks: Math.round(await page.evaluate(() => window.__lt) - lt0) + 'ms/4s',
      });
      await ctx.close();
    }
  }
  console.table(rows);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
