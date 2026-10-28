// node baddie_e2e.js [screenshot-dir]   (the e2e build on :8790; the old site on :8765 for the save check)
//
// SPIN A BADDIE in the new app: every tab does what the old page did, and a
// save made by the old page (baddie.html) loads here as it is. The game keeps
// its save in the browser, so nothing here touches Firestore.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';
const OLD = process.env.OLD_SITE_URL || 'http://127.0.0.1:8765/';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);
const until = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch();

  // ── a save from the old page ──
  let oldSave = null;
  try {
    const old = await browser.newPage();
    await old.goto(OLD + 'baddie.html');
    await old.waitForFunction(() => typeof S !== 'undefined' && S && Array.isArray(S.baddies), null, { timeout: 15000 });
    oldSave = await old.evaluate(() => {
      S.coins = 123456789;
      for (let i = 0; i < 12; i++) doOneRoll();
      S.pets.list.push({ id: 9001, type: 'Dog', born: Date.now(), mode: 'move' });
      S.pets.equipped.push(9001);
      save(true);
      return localStorage.getItem('baddie_save_v2');
    });
    await old.close();
  } catch (e) { console.log('(old page not reachable, the save check is skipped: ' + String(e).slice(0, 80) + ')'); }

  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await require('./e2e_guard')(page);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('baddie_save_v2') || 'null'));
  // the page saves when it is left, so the save is changed with the page closed
  const editSave = async (fn, path = '/baddie') => {
    await page.goto(BASE + '/utilities');
    await page.evaluate(fn);
    await page.goto(BASE + path);
    await page.waitForSelector('.bd-top', { timeout: 20000 });
  };
  const tab = async name => { await page.locator('.bd-tabs .u-tab', { hasText: new RegExp('^\\s*' + name + '\\s*$') }).click(); await page.waitForTimeout(150); };

  if (oldSave) {
    await page.goto(BASE + '/utilities');
    await page.evaluate(s => localStorage.setItem('baddie_save_v2', s), oldSave);
    await page.goto(BASE + '/baddie');
    await page.waitForSelector('.bd-top', { timeout: 20000 });
    const st = await page.evaluate(() => document.querySelector('[data-test=coins]').textContent);
    const want = JSON.parse(oldSave);
    check(/123/.test(st) && (await page.locator('.bd-top .stat .val.plain').textContent()).trim() === String(want.baddies.length), `a save from the old page loads as it is (${st} coins, ${want.baddies.length} baddies)`);
    await tab('PETS');
    check(await page.locator('.petcard .nm', { hasText: 'Dog' }).count() === 1, 'and its pets come with it');
  }

  // ── a fresh game with money to spend ──
  await editSave(() => { localStorage.removeItem('baddie_save_v2'); localStorage.removeItem('baddie_slots_v2'); });
  check((await page.locator('[data-test=coins]').textContent()).trim() === '50', 'a new game starts with 50 coins');
  check(await page.locator('.bd-tabs .u-tab').count() === 8, 'all eight tabs are there');
  await page.screenshot({ path: out + '/bd-start.png' });

  // roll
  await page.click('[data-test=roll]');
  check(await until(() => page.locator('.ov .land').count().then(n => n === 1), 4000), 'ROLL scrambles names and lands a baddie');
  await page.screenshot({ path: out + '/bd-landed.png' });
  await page.click('[data-test=roll-again]');
  await until(() => page.locator('.ov .rolling').count().then(n => n === 1), 2000);
  await until(() => page.locator('.ov .rolling').count().then(n => n === 0), 4000);
  await page.locator('.ov .u-btn', { hasText: 'CONTINUE' }).click();
  check(await until(() => page.locator('.grid .bd-baddie').count().then(n => n === 2), 2000), 'both pulls show under RECENT PULLS');
  check((await save()).baddies.length === 2, 'and both are saved');

  // give the game money through test mode (as the old page's ?test=1 did)
  await page.goto(BASE + '/baddie?test=1');
  await page.waitForSelector('.cheat', { timeout: 10000 });
  check(true, 'test mode opens with ?test=1');
  await page.locator('.cheat button', { hasText: '+ 1Qa COINS' }).click();
  await page.locator('.cheat select').first().selectOption('Godly');
  await page.locator('.cheat select').nth(1).selectOption('Golden');
  await page.locator('.cheat button', { hasText: 'GIVE BADDIE' }).click();
  const s1 = await save();
  check(s1.coins > 1e14 && s1.baddies.some(b => b.rarity === 'Godly' && b.modifier === 'Golden'), 'the cheat panel gives coins and a baddie');

  // plot
  await tab('PLOT');
  await page.locator('.u-btn', { hasText: 'AUTO PLACE BEST' }).click();
  check((await save()).baddies.filter(b => b.placed).length === 3, 'AUTO PLACE BEST fills the plot with the best');
  const c0 = (await save()).coins;
  await page.waitForTimeout(2200);
  check((await save()).coins > c0, 'placed baddies earn coins every second');
  await page.locator('.slot.buy').click();
  check((await save()).plotsBought === 1, 'a plot can be bought');
  // a baddie's own menu: upgrade, crack, sell
  await page.locator('.slot.full .bd-baddie').first().click();
  await page.locator('ss-modal .u-btn', { hasText: /^\s*UPGRADE/ }).click();
  check((await save()).upgrades.length === 1, 'UPGRADE starts the timer');
  await page.locator('.cheat button', { hasText: 'FINISH UPGRADE NOW' }).click();
  check((await save()).baddies.some(b => b.level === 1), 'and finishing it raises the level');
  await page.locator('.slot.full .bd-baddie').first().click();
  await page.locator('ss-modal .u-btn', { hasText: /^\s*CRACK/ }).click();
  const s2 = await save();
  check(s2.crackUntil > Date.now() && s2.baddies.some(b => b.overUntil > Date.now()), 'CRACK sends it into overdrive and starts the cooldown');
  await page.screenshot({ path: out + '/bd-plot.png' });

  // inventory: sort, pages, sell
  for (let i = 0; i < 3; i++) await page.locator('.cheat button', { hasText: 'GIVE BADDIE' }).click();
  await tab('INVENTORY');
  const nb = (await save()).baddies.length;
  check(await until(() => page.locator('.tagged').count().then(n => n === nb), 2000), 'the inventory shows every baddie');
  check(await page.locator('.tagged .placed').count() === 3, 'the placed ones are marked');
  await page.locator('.dd-btn').first().click();
  await page.locator('.dd-menu .u-menu-item', { hasText: 'SORT: NEWEST' }).click();
  check(await until(async () => (await page.locator('.dd-btn').first().textContent()).includes('NEWEST'), 2000), 'the sort can be changed');
  await page.locator('.u-btn', { hasText: 'SELL ALL UNPLACED' }).click();
  await page.locator('ss-modal .u-btn', { hasText: 'CONFIRM SELL' }).click();
  check((await save()).baddies.length === 3, 'SELL ALL UNPLACED keeps only the placed ones');

  // shop
  await tab('SHOP');
  await page.locator('.tile', { hasText: 'Stone Die' }).locator('.u-btn', { hasText: 'BUY' }).click();
  check((await save()).dice.includes(1) && (await save()).activeDie === 1, 'a die can be bought, and is selected');
  await page.locator('.tile', { hasText: 'Luck Elixir' }).locator('.u-btn', { hasText: 'LV2' }).click();
  check((await save()).potions.some(p => p.type === 'luck' && p.mult === 1.5), 'a potion can be bought');
  await page.locator('.tile', { hasText: 'Gilded Arrow' }).locator('.u-btn', { hasText: 'BUY' }).click();
  const cur = await page.evaluate(() => getComputedStyle(document.querySelector('ss-baddie-page')).getPropertyValue('--cur-soul'));
  check((await save()).cursors.active === 'gold' && /data:image\/png/.test(cur), 'a cursor can be bought, and becomes the pointer');
  await page.locator('.tile', { hasText: 'Fury' }).locator('.u-btn', { hasText: 'BUY' }).click();
  await page.waitForTimeout(400);
  check((await save()).themes.active === 'fury' && await page.locator('ss-baddie-page[data-theme=fury]').count() === 1, 'a theme can be bought, and the page changes to it');
  await page.screenshot({ path: out + '/bd-shop.png' });
  await page.locator('.tile', { hasText: 'AUTO ROLL' }).locator('.u-btn').click();
  check(await until(() => page.locator('.auto').count().then(n => n === 1), 2000), 'AUTO ROLL can be bought, and opens its window');
  await page.locator('.auto .u-btn', { hasText: 'START' }).click();
  check(await until(async () => /^[1-9]\d* ROLLS/.test(await page.locator('.auto-foot span').first().textContent()), 6000), 'auto roll rolls on its own');
  await page.locator('.auto .u-btn', { hasText: 'STOP' }).click();
  await page.locator('.tile', { hasText: "CAPPY'S MILK" }).locator('.u-btn').click();
  await page.locator('ss-modal .pickable').first().click();
  check((await save()).baddies.some(b => b.modifier === 'Cappyfied'), "Cappy's Milk cappyfies a baddie");

  // pets
  await tab('PETS');
  await page.locator('.tile', { hasText: 'Common Egg' }).locator('.u-btn').click();
  check(await until(() => page.locator('.ov .egg-pop').count().then(n => n === 1), 4000), 'an egg hatches');
  await page.screenshot({ path: out + '/bd-hatch.png' });
  await page.locator('.ov .u-btn', { hasText: 'NICE' }).click();
  check((await save()).pets.list.length === 1 && (await save()).pets.equipped.length === 1, 'the pet is kept, and equipped');
  check(await until(() => page.locator('.bd-pet').count().then(n => n === 1), 3000), 'and it floats round the page');
  await page.locator('.petcard .u-btn', { hasText: 'EQUIPPED' }).click();
  check((await save()).pets.equipped.length === 0 && await until(() => page.locator('.bd-pet').count().then(n => n === 0), 2000), 'unequipping takes it off the page');

  // index
  await tab('INDEX');
  const disc = (await page.locator('.bd-card .bd-sub').first().textContent()).trim();
  check(/^\d+ \/ 72 DISCOVERED$/.test(disc), `the index counts what has been found (${disc})`);
  const claims = await page.locator('.itile .claim').count();
  await page.locator('.itile .claim').first().click();
  check(await until(() => page.locator('.itile .claim').count().then(n => n === claims - 1), 2000), 'an index reward can be claimed once');

  // blackjack
  await tab('BLACKJACK');
  await page.locator('.betrow .u-btn', { hasText: '+1K' }).click();
  const before = (await save()).coins;
  await page.locator('.felt .u-btn', { hasText: 'DEAL' }).click();
  await page.waitForTimeout(200);
  check(await until(() => page.locator('.cards').nth(1).locator('.pcard').count().then(n => n >= 2), 2000), 'DEAL deals two cards each');
  if (await page.locator('.felt .u-btn', { hasText: 'STAND' }).isEnabled()) await page.locator('.felt .u-btn', { hasText: 'STAND' }).click();
  check(await until(async () => /win|lose|push/.test(await page.locator('.bj-msg').getAttribute('class')), 6000), 'the hand is settled');
  check((await save()).coins !== before || /push/.test(await page.locator('.bj-msg').getAttribute('class')), 'and the bet is paid or lost');
  await page.screenshot({ path: out + '/bd-bj.png' });

  // saves
  await tab('SAVES');
  await page.locator('.slotcard .u-btn', { hasText: 'SAVE HERE' }).first().click();
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('baddie_slots_v2'))[0]?.code?.startsWith('BAD1.')), 'a save slot holds a BAD1 code');
  const kept = (await save()).baddies.length;
  await page.locator('.u-btn', { hasText: 'COPY CURRENT AS CODE' }).click();
  const code = await page.locator('ss-modal textarea').inputValue();
  await page.locator('ss-modal button[aria-label=Close]').click();
  check(code.startsWith('BAD1.'), 'the current game can be copied as a code');
  await page.locator('.u-btn', { hasText: 'RESET CURRENT GAME' }).click();
  await page.locator('ss-modal .u-btn', { hasText: 'YES, WIPE' }).click();
  check((await save()).baddies.length === 0, 'RESET CURRENT GAME wipes it');
  await page.locator('textarea.code').fill(code);
  await page.locator('.u-btn', { hasText: 'LOAD CODE' }).click();
  check((await save()).baddies.length === kept, `and the code brings it back (${kept} baddies)`);
  await page.locator('.u-btn', { hasText: /^\s*CLAIM\s*$/ }).click();
  check((await save()).daily.streak === 1, 'the daily reward can be claimed');
  await editSave(() => { const s = JSON.parse(localStorage.getItem('baddie_save_v2')); s.maxRarityEver = 6; localStorage.setItem('baddie_save_v2', JSON.stringify(s)); });
  await tab('SAVES');
  await page.locator('.u-btn', { hasText: 'REBIRTH NOW' }).click();
  const s3 = await save();
  check(s3.rebirths === 1 && s3.baddies.length === 0 && s3.coins === 0 && s3.themes.owned.includes('fury'), 'REBIRTH resets the run and keeps the themes');

  // a phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await require('./e2e_guard')(phone);
  phone.on('pageerror', e => errors.push('phone: ' + e));
  await phone.goto(BASE + '/baddie');
  await phone.waitForSelector('.bd-top', { timeout: 20000 });
  await phone.waitForTimeout(800);
  const wide = await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  check(wide, 'on a phone nothing runs off the side');
  await phone.screenshot({ path: out + '/bd-phone.png', fullPage: true });

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  console.log('PASS', ok.length); for (const o of ok) console.log('  ' + o);
  if (bad.length) { console.log('FAIL', bad.length); for (const b of bad) console.log('  ' + b); }
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
