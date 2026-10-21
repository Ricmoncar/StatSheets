// node mobile_perf.js [out-dir] [--fast]  (needs the e2e build served on :8790 and the emulator)
//
// Loads pages the way a mid-range phone would: 390x844 at 3x, touch, the CPU
// slowed 4x and, unless --fast, a "slow 4G" connection (1.6 Mbit/s down, 150 ms),
// the profile Lighthouse uses for mobile. For each page it reports how long
// until it is usable, the main thread time lost to long tasks while loading
// and while sitting idle, the frame rate idle and while scrolling, the data
// downloaded, the JS heap and the number of DOM nodes.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';
const out = process.argv[2] || '.';
const fast = process.argv.includes('--fast');

const PAGES = [
  { name: 'character', path: '/c/mp7grig28yapvrdxg4', ready: 'ss-character-view .head', scroll: 'ss-main-page .view' },
  { name: 'utilities', path: '/utilities', ready: 'ss-dice-roller', scroll: null },
  { name: 'gallery', path: '/gallery', ready: '.char', scroll: null },
  { name: 'playlists', path: '/playlists', ready: '.entry', scroll: '.side .list' },
  { name: 'bkscorner', path: '/bkscorner', ready: '.card', scroll: null },
];

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const p of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await require('./e2e_guard')(page);
    // fresh start for the page under test: no cache from the guard's visit
    await ctx.clearCookies();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    if (!fast) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    let bytes = 0;
    cdp.on('Network.dataReceived', e => { bytes += e.encodedDataLength || 0; });
    await page.addInitScript(() => {
      window.__lt = 0;
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt += e.duration; }).observe({ type: 'longtask', buffered: true });
    });
    // the guard's page left IndexedDB behind: clear it so data comes from the server
    await page.evaluate(async () => { for (const d of await indexedDB.databases()) indexedDB.deleteDatabase(d.name); });

    const t0 = Date.now();
    await page.goto(BASE + p.path);
    const ok = await page.locator(p.ready).first().waitFor({ timeout: 180000 }).then(() => true, () => false);
    const readyMs = Date.now() - t0;
    await page.waitForTimeout(1500);
    const loadLong = await page.evaluate(() => window.__lt);
    const fps = ms => page.evaluate(ms => new Promise(res => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < ms) requestAnimationFrame(f); else res(Math.round(n * 1000 / ms)); }; requestAnimationFrame(f); }), ms);
    const lt1 = await page.evaluate(() => window.__lt);
    const idleFps = await fps(4000);
    const idleLong = Math.round(await page.evaluate(() => window.__lt) - lt1);
    let scrollFps = null;
    if (p.scroll && await page.locator(p.scroll).count()) {
      const go = page.locator(p.scroll).first().evaluate(el => new Promise(res => { let y = 0; const f = () => { y += 40; el.scrollTop = y; if (y < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }));
      scrollFps = await fps(2500);
      await go.catch(() => {});
    }
    const mem = await page.evaluate(() => ({ heap: Math.round((performance.memory?.usedJSHeapSize || 0) / 1048576), nodes: document.getElementsByTagName('*').length }));
    await page.screenshot({ path: `${out}/mobile-${p.name}.png` });
    results.push({ page: p.name, ready: ok ? (readyMs / 1000).toFixed(1) + 's' : 'TIMEOUT', loadBlocked: Math.round(loadLong) + 'ms', idleBlocked: idleLong + 'ms/4s', idleFps, scrollFps, downloadMB: (bytes / 1048576).toFixed(1), heapMB: mem.heap, domNodes: mem.nodes });
    await ctx.close();
  }
  await browser.close();
  console.table(results);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
