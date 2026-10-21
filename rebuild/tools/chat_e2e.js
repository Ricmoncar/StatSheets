// node chat_e2e.js  (needs the build served on :8790; sends a message in the next_
// test data, so refresh it afterwards: copy_to_sandbox.py --write --only=characters --no-subs)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

(async () => {
  const proxy = (process.env.HTTPS_PROXY || 'http://127.0.0.1:32937').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await require('./e2e_guard')(page);   // only ever against the local emulator
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto(BASE + '/');
  await page.waitForSelector('ss-sidebar .entry', { timeout: 20000 });
  const row = page.locator('ss-sidebar .row', { has: page.locator('.name', { hasText: /^Katie$/ }) });
  await row.hover();
  await row.locator('.chat').click();
  const modal = page.locator('ss-chat-modal ss-modal');   // the host has no box of its own
  await modal.waitFor();
  check(/MESSAGES FOR KATIE/.test(await modal.textContent()), 'the chat opens on Katie\'s inbox');
  const before = await modal.locator('.msg').count();

  await modal.locator('button[type=submit]').click();
  await page.waitForTimeout(150);
  check(await page.locator('.toast', { hasText: 'SELECT WHO IS TYPING FIRST' }).count() > 0, 'sending needs a sender');

  const sender = await modal.locator('select option').nth(1).getAttribute('value');
  await modal.locator('select').selectOption(sender);
  const text = 'e2e hello ' + Date.now();
  await modal.locator('input[type=text]').fill(text);
  await modal.locator('input[type=text]').press('Enter');
  await modal.locator('.msg', { hasText: text }).waitFor({ timeout: 10000 });
  check((await modal.locator('.msg').count()) === before + 1, 'the message appears');
  check((await modal.locator('input[type=text]').inputValue()) === '', 'the box clears');

  // a second tab sees it live
  const other = await ctx.newPage();
  await other.goto(BASE + '/');
  await other.waitForSelector('ss-sidebar .entry', { timeout: 20000 });
  const row2 = other.locator('ss-sidebar .row', { has: other.locator('.name', { hasText: /^Katie$/ }) });
  await row2.hover();
  await row2.locator('.chat').click();
  await other.locator('ss-chat-modal .msg', { hasText: text }).waitFor({ timeout: 10000 });
  check(true, 'another tab shows it');

  // filter by sender
  await modal.locator('.conv').nth(1).click();
  check((await modal.locator('.conv.on').count()) === 1, 'a sender filter can be picked');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check((await modal.count()) === 0, 'Escape closes it');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
