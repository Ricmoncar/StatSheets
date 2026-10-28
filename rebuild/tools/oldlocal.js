// Drives the OLD StatSheets site in headless Chromium against the local
// Firestore emulator instead of the live database, so the old pages can be
// looked at as often as needed without spending the project's read quota.
//
// - The emulator has to hold the old site's own collections: seed it with
//   OLD_SITE=1 node seed_emulator.js <snapshot-dir> fixtures
// - Each old HTML page is served with a few lines added after the Firestore
//   SDK, which point the first Firestore instance at the emulator and turn off
//   offline persistence (a cache in the browser would only get in the way).
// - The Firebase SDK comes from local npm copies (gstatic.com is blocked here).
// - Writes are aborted at the network level all the same, so a click can never
//   change even the local test data.
//
// Usage:
//   const { openOldLocal } = require('./oldlocal');
//   const { browser, page } = await openOldLocal({ path: 'index.html', width: 1920, height: 1080 });
// Needs a static server on the repo root: OLD_SITE_URL (default http://127.0.0.1:8765/).
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const NM = path.join(__dirname, 'node_modules');
const SDK = { '10.7.1': path.join(NM, 'firebase'), '10.12.0': path.join(NM, 'firebase-compat-1012') };
const BASE = process.env.OLD_SITE_URL || 'http://127.0.0.1:8765/';
const ROOT = path.join(__dirname, '..', '..');
const EMULATOR = (process.env.FS_EMULATOR || '127.0.0.1:8085').split(':');

const TO_EMULATOR = `<script>
(function () {
  var make = firebase.firestore, done = false;
  firebase.firestore = new Proxy(make, { apply: function (target, self, args) {
    var db = target.apply(self, args);
    if (!done) {
      done = true;
      db.useEmulator(${JSON.stringify(EMULATOR[0])}, ${+EMULATOR[1]});
      db.enablePersistence = function () { return Promise.resolve(); };
    }
    return db;
  } });
})();
</script>`;

async function openOldLocal({ path: pagePath = 'index.html', width = 1920, height = 1080, mobile = false, scale = 1, waitMs = 6000 } = {}) {
  const proxy = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: [
    '--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost',
    // through the proxy, Chromium cannot tell the emulator is a local address too, and refuses the page's requests to it
    '--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights',
  ] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile });
  const blocked = [];
  // only what has to be: routing every request also catches the emulator's CORS preflights, which then fail
  await context.route('https://www.gstatic.com/firebasejs/**', route => {
    const m = route.request().url().match(/firebasejs\/([\d.]+)\/([\w-]+\.js)/);
    const file = m && path.join(SDK[m[1]] || SDK['10.7.1'], m[2]);
    return file && fs.existsSync(file) ? route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) }) : route.abort();
  });
  // the live project is never reached, and the local data is never written
  await context.route(/googleapis\.com/, route => { blocked.push(route.request().method() + ' ' + route.request().url().slice(0, 140)); return route.abort(); });
  await context.route(/127\.0\.0\.1:8085\/.*(\/Write\/channel|:commit|:batchWrite|:beginTransaction|:rollback)/, route => { blocked.push('write ' + route.request().url().slice(0, 140)); return route.abort(); });
  // the old pages, with the SDK pointed at the emulator
  await context.route(url => url.href.startsWith(BASE) && /\.html$|\/$/.test(url.pathname), route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) return route.continue();
    const html = fs.readFileSync(file, 'utf8').replace(/(<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-firestore-compat\.js"><\/script>)/, '$1' + TO_EMULATOR);
    return route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(BASE + pagePath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(waitMs);
  return { browser, context, page, errors, blocked };
}

module.exports = { openOldLocal };
