// Shared helper for driving the OLD StatSheets site in headless Chromium.
// - gstatic.com is blocked in this container: Firebase SDK files are served
//   from local npm copies instead (10.7.1 and 10.12.0 are both installed).
// - Every Firestore WRITE is aborted at the network level, so nothing a
//   script clicks can change the real database. Reads go through.
// - Fonts load from Google Fonts; Cloudinary is blocked (missing media is expected).
//
// Usage:
//   const { openOldSite } = require('<this file>');
//   const { browser, page } = await openOldSite({ path: 'index.html', width: 1920, height: 1080 });
//   ... await page.screenshot({ path: 'x.jpg', quality: 80 }) ...
//   await browser.close();
// Requires a static server on the repo root: OLD_SITE_URL (default http://127.0.0.1:8765/).
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const NM = path.join(__dirname, 'node_modules');
const SDK = {
  '10.7.1': path.join(NM, 'firebase'),
  '10.12.0': path.join(NM, 'firebase-compat-1012'),
};
const BASE = process.env.OLD_SITE_URL || 'http://127.0.0.1:8765/';

function isWrite(url, method) {
  if (!/googleapis\.com/.test(url)) return false;
  if (/\/Write\/channel/.test(url)) return true;
  if (/:(commit|batchWrite|beginTransaction|rollback)\b/.test(url)) return true;
  if (method === 'PATCH' || method === 'DELETE') return true;
  return false;
}

async function openOldSite({ path: pagePath = 'index.html', width = 1920, height = 1080, mobile = false, waitMs = 6000 } = {}) {
  // Only HTTPS goes through the agent proxy (it accepts CONNECT tunnels only);
  // plain HTTP to the local static server goes direct.
  const proxyHostPort = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({
    args: ['--proxy-server=https=' + proxyHostPort, '--proxy-bypass-list=127.0.0.1;localhost'],
  });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const blocked = [];
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    const m = url.match(/^https:\/\/www\.gstatic\.com\/firebasejs\/([\d.]+)\/([\w-]+\.js)/);
    if (m) {
      const dir = SDK[m[1]] || SDK['10.7.1'];
      const file = path.join(dir, m[2]);
      if (fs.existsSync(file)) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
      }
    }
    if (isWrite(url, req.method())) {
      blocked.push(req.method() + ' ' + url.slice(0, 140));
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + pagePath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(waitMs);
  return { browser, context, page, errors, blocked };
}

module.exports = { openOldSite, isWrite };
