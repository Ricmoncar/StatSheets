// node admin_e2e.js [screenshot-dir]  (needs the build served on :8790; edits the next_
// test data with throwaway trait keys and puts everything back)
// End-to-end check of ADMIN: the password gate, the trait editor, quick stats,
// renaming, the bulk operations and the overview.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8790';
const OUT = process.argv[2] || '.';

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

(async () => {
  const proxy = (process.env.HTTPS_PROXY || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const browser = await chromium.launch({ args: ['--proxy-server=https=' + proxy, '--proxy-bypass-list=127.0.0.1;localhost'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(80); } return false; };
  const confirm = async (yes = true) => { await page.locator('.u-opt', { hasText: yes ? 'CONFIRM' : 'CANCEL' }).click(); };
  const toast = re => until(async () => (await page.locator('.toast, [class*=toast]').allTextContents()).some(t => re.test(t)));
  const row = name => page.locator('tbody tr').filter({ has: page.locator('.who', { hasText: new RegExp('^' + name + '$', 'i') }) });
  const chipsOf = async name => row(name).locator('.tchips .chip').allTextContents();
  const statsOf = async name => (await row(name).locator('.st').textContent()).split('/').map(s => +s.trim());

  // ── the gate ──
  await page.goto(BASE + '/admin');
  await page.locator('.gate input').waitFor({ timeout: 15000 });
  check(await page.locator('ss-panel').count() === 0, 'nothing shows before the password');
  await page.locator('.gate input').fill('wrong');
  await page.keyboard.press('Enter');
  check(await until(async () => /WRONG PASSWORD/.test(await page.locator('.gate-err').textContent())), 'a wrong password is refused');
  check(await page.locator('.gate input').inputValue() === '', 'and the field is cleared');
  await page.locator('.gate input').fill('maxshimmy');
  await page.locator('.gate button').click();
  await page.locator('ss-panel').first().waitFor({ timeout: 5000 });
  check(true, 'the right password opens the panel');
  await page.reload();
  check(await page.locator('ss-panel').first().waitFor({ timeout: 8000 }).then(() => true, () => false), 'the session remembers it');
  check(await until(async () => /\d+ CHARACTERS LOADED/.test(await page.locator('.sub').textContent()), 15000), 'counts the characters');
  const total = +(await page.locator('.sub').textContent()).match(/(\d+)/)[1];

  // ── picking ──
  await page.locator('.picker input').fill('cappy');
  check(await until(async () => { const n = await page.locator('.cc .cname').allTextContents(); return n.length >= 2 && n.every(t => /cappy/i.test(t)); }), 'search narrows the list');
  await page.locator('.picker input').fill('');
  const NAME = 'Bizzy';
  await page.locator('.cc').filter({ has: page.locator('.cname', { hasText: /^Bizzy$/ }) }).click();
  const traits0 = await chipsOf(NAME);
  check(await until(async () => (await page.locator('.traits .chip').count()) === traits0.length), `the editor shows the character's ${traits0.length} traits`);

  // ── add, save, remove, save ──
  await page.locator('.add input[type=text]').fill('  E2E Trait ');
  await page.locator('.add .u-tog').click();
  await page.locator('.add .u-btn').click();
  check(await until(async () => (await page.locator('.traits .chip.shimmy', { hasText: 'e2etrait' }).count()) === 1), 'a typed key is added as lower case with no spaces, shimmyful');
  check(/UNSAVED/.test(await page.locator('.traits .msg').textContent()), 'unsaved changes are flagged');
  await page.locator('.traits .u-btn', { hasText: 'SAVE TRAITS' }).click();
  check(await until(async () => (await chipsOf(NAME)).some(t => /e2etrait.*✦/.test(t))), 'SAVE TRAITS stores it (the overview shows it)');
  check(await until(async () => /SAVED/.test(await page.locator('.traits .msg').textContent())), 'and says SAVED');
  await page.locator('.traits .chip', { hasText: 'e2etrait' }).locator('.chip-x').click();
  await page.locator('.traits .u-btn', { hasText: 'SAVE TRAITS' }).click();
  check(await until(async () => JSON.stringify(await chipsOf(NAME)) === JSON.stringify(traits0)), 'removing it and saving puts the traits back');
  await page.locator('.traits .u-btn', { hasText: 'CLEAR ALL' }).click();
  await confirm();
  check(await until(async () => (await page.locator('.traits .chip').count()) === 0), 'CLEAR ALL empties the editor (after asking)');
  await page.locator('.cc').filter({ has: page.locator('.cname', { hasText: /^Bizzy$/ }) }).click();
  check(await until(async () => (await page.locator('.traits .chip').count()) === traits0.length), 'choosing the character again discards it');

  // ── quick stats ──
  const st0 = await statsOf(NAME);
  const hp = page.locator('.stat', { hasText: 'HP' }).locator('input');
  check(+(await hp.inputValue()) === st0[0], 'quick stats show the base stats');
  await hp.fill(String(st0[0] + 7));
  await page.locator('.u-btn', { hasText: 'SAVE STATS' }).click();
  check(await until(async () => (await statsOf(NAME))[0] === st0[0] + 7), 'SAVE STATS writes the stat');
  await hp.fill(String(st0[0]));
  await page.locator('.u-btn', { hasText: 'SAVE STATS' }).click();
  check(await until(async () => (await statsOf(NAME))[0] === st0[0]), 'and back');

  // ── rename ──
  await page.locator('input[aria-label="New name"]').fill('Bizzy E2E');
  await page.locator('.u-btn', { hasText: 'RENAME' }).click();
  check(await until(async () => await row('Bizzy E2E').count() === 1), 'RENAME renames');
  await page.locator('input[aria-label="New name"]').fill(NAME);
  await page.locator('.u-btn', { hasText: 'RENAME' }).click();
  check(await until(async () => await row(NAME).count() === 1), 'and back');
  await page.screenshot({ path: `${OUT}/admin.png`, fullPage: false });

  // ── every character ──
  await page.locator('#bulk-key').fill('e2ebulk');
  await page.locator('.u-btn', { hasText: 'GIVE TO ALL CHARS' }).click();
  await confirm();
  // the test data has one character (Ruina) whose document is already at Firestore's 1 MB limit:
  // it cannot take the trait, and must not stop everyone else getting it
  check(await until(async () => /GAVE "e2ebulk" TO \d+ CHARS/.test(await page.locator('.bulk .msg').first().textContent()), 30000), 'GIVE TO ALL gives a trait to everyone');
  const gave = +(await page.locator('.bulk .msg').first().textContent()).match(/TO (\d+) CHARS/)[1];
  check(gave >= total - 1, `all but the oversized character got it (${gave} of ${total})`);
  if (gave < total) check(await toast(/COULD NOT UPDATE 1: Ruina \(too big\)/), 'the one that could not take it is named');
  check(await until(async () => (await page.locator('.tchips .chip', { hasText: 'e2ebulk' }).count()) === gave), 'every row that got it shows it');
  await page.locator('.u-btn', { hasText: 'REMOVE FROM ALL' }).click();
  await confirm();
  check(await until(async () => (await page.locator('.tchips .chip', { hasText: 'e2ebulk' }).count()) === 0, 30000), 'REMOVE FROM ALL takes it away again');
  await page.locator('#nuke-key').fill('nobodyhasthis');
  await page.locator('.u-btn', { hasText: 'NUKE' }).click();
  await confirm();
  check(await toast(/NO CHARACTERS HAD THAT TRAIT/), 'nuking a trait nobody has says so');
  const chips0 = await page.locator('.tchips .chip').count();
  await page.locator('.u-btn', { hasText: 'WIPE EVERYONE' }).click();
  await confirm(true);
  await confirm(false);
  await page.waitForTimeout(800);
  check(await page.locator('.tchips .chip').count() === chips0, 'WIPE EVERYONE needs a second confirmation');

  // ── overview ──
  await row('Cappy').locator('.u-btn').click();
  check(await until(async () => /Cappy/i.test(await page.locator('.traits .mini-h').textContent())), 'EDIT in the overview loads that character');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
  if (bad.length) { console.log('FAIL ' + bad.length + '\n  ' + bad.join('\n  ')); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
