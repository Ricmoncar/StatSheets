// node encyclopedia_e2e.js [screenshot-dir]   (the e2e build on :8790, the Firestore emulator on
// :8085 seeded with `OLD_SITE=1 node seed_emulator.js`, the old site on :8765 for the side-by-side checks)
//
// THE ENCYCLOPAEDIA in the new app: every index lists what the old page lists,
// in its order; the pages turn; places, statuses, chapters with their scenes
// and NPCs are written, edited and deleted as the old page did (the old page
// reads what this one writes); statuses drag into order and between folders;
// a write keeps an edit made meanwhile elsewhere; and the phone drawer works.
// enc/data is put back as it was at the end.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { openOldLocal } = require('./oldlocal');
const BASE = 'http://127.0.0.1:8790';
const DOCS = 'http://127.0.0.1:8085/v1/projects/statsheets-3668d/databases/(default)/documents/';
const H = { 'content-type': 'application/json', authorization: 'Bearer owner' };
const PNG = path.resolve(__dirname, '../../baddies/beebaddie.png');

const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

// ── the emulator, over REST, as the owner (past the rules) ──
const plain = v => {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)]));
  return undefined;
};
const raw = async p => { const r = await fetch(DOCS + p, { headers: H }); return r.status === 404 ? null : r.json(); };
const put = (p, doc) => fetch(DOCS + p, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: (doc && doc.fields) || {} }) });
const enc = async () => { const d = await raw('next_enc/data'); return d ? plain({ mapValue: { fields: d.fields } }) : {}; };
const characters = async () => {
  const out = [];
  let token = '';
  do {
    const r = await (await fetch(DOCS + 'next_characters?pageSize=300' + (token ? '&pageToken=' + token : ''), { headers: H })).json();
    for (const d of r.documents || []) out.push({ id: d.name.split('/').pop(), ...plain({ mapValue: { fields: d.fields } }) });
    token = r.nextPageToken || '';
  } while (token);
  return out.sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));
};

(async () => {
  const out = process.argv[2] || '.';
  const savedNew = await raw('next_enc/data'), savedOld = await raw('enc/data');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  // pictures on Cloudinary: the bee comes back; an upload gets a made-up address
  await ctx.route(/res\.cloudinary\.com/, r => r.fulfill({ path: PNG, contentType: 'image/png' }));
  let uploads = 0;
  await ctx.route(/api\.cloudinary\.com|upload\.imagekit\.io/, r => {
    if (!/dhdfz1iud/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });   // the mirrors
    uploads++;
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secure_url: `https://res.cloudinary.com/dhdfz1iud/image/upload/e2e-${uploads}.png` }) });
  });
  await ctx.route(/youtube\.com\/embed/, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>video</p>' }));
  const page = await ctx.newPage();
  await require('./e2e_guard')(page);   // only ever against the local emulator
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(60); } return false; };
  const tab = async t => { await page.locator('.tabs .tab', { hasText: new RegExp('^\\s*' + t + '\\s*$') }).click(); await page.waitForTimeout(150); };
  const tocNames = () => page.locator('.toc .toc-item .txt').allTextContents().then(a => a.map(s => s.trim()));
  const pinfo = async () => (await page.locator('.pinfo').textContent()).replace(/\s+/g, ' ').trim();
  const dialog = () => page.locator('ss-modal .dialog');
  const fill = (ph, v) => dialog().getByPlaceholder(ph, { exact: false }).first().fill(v);
  const select = (label, v) => dialog().locator('label.ff', { hasText: label }).locator('select').selectOption(v);
  const save = t => dialog().locator('.u-btn.primary', { hasText: t }).click();
  const opens = name => until(async () => (await page.locator('.content .name').first().textContent().catch(() => '')).trim() === name);

  try {
    await page.goto(BASE + '/encyclopedia');
    await page.waitForSelector('.toc .toc-item', { timeout: 20000 });
    await page.waitForTimeout(500);

    // ── every index lists what the old page lists, in its order ──
    const sections = [['characters', 'CHARACTERS'], ['places', 'PLACES'], ['statuses', 'STATUS FX'], ['memories', 'MEMORIES'], ['items', 'ITEMS'], ['npcs', 'NPCS']];
    const fresh = {};
    for (const [, t] of sections) {
      await tab(t);
      if (t === 'MEMORIES') { await page.locator('.mode', { hasText: 'ALL' }).click(); await page.waitForTimeout(100); }
      fresh[t] = await tocNames();
    }
    let old = null;
    try {
      const o = await openOldLocal({ path: 'encyclopedia.html', width: 1600, height: 900, waitMs: 4000 });
      old = {};
      for (const [s, t] of sections) {
        old[t] = await o.page.evaluate(s => {
          switchSection(s);
          if (s === 'memories') setMemViewMode('all');
          return [...document.querySelectorAll('#enc-toc .enc-toc-txt')].map(e => e.textContent.trim());
        }, s);
      }
      await o.browser.close();
    } catch (e) { console.log('(old page not reachable, the side-by-side checks are skipped: ' + String(e).slice(0, 100) + ')'); }
    if (old) for (const [, t] of sections) {
      const a = fresh[t], b = old[t];
      check(a.length > 0 && a.length === b.length && a.every((x, i) => x === b[i]), `${t}: the index lists what the old page lists, in its order (${a.length} here, ${b.length} there${a.length === b.length ? '' : ''})` + (a.every((x, i) => x === b[i]) ? '' : `; first difference: "${a.find((x, i) => x !== b[i])}" / "${b.find((x, i) => x !== a[i])}"`));
    }
    const chars = await characters();
    check(fresh['CHARACTERS'].length === chars.length, `every character is in the index (${chars.length})`);
    const itemCount = chars.reduce((n, c) => n + (c.inventory || []).length, 0);
    check(fresh['ITEMS'].length === itemCount, `every item in every bag is in the index (${itemCount})`);

    // ── turning the pages ──
    await tab('CHARACTERS');
    const n = chars.length;
    check(await pinfo() === `1 / ${n}`, 'the first character is open: ' + await pinfo());
    check((await page.locator('.content .name.big').textContent()).trim() === (chars[0].name || 'UNNAMED'), 'its name heads the page');
    const st = chars[0].stats || {};
    const shown = await page.locator('.sbar .sv').allTextContents();
    check(shown.join(',') === [st.hp || 0, st.atk || 0, st.def || 0, st.mag || 0, st.spd || 0, st.iq ?? 50].join(','), 'its stats are its own: ' + shown.join(','));
    await page.locator('.foot .pg', { hasText: 'NEXT' }).click();
    check(await until(async () => await pinfo() === `2 / ${n}`), 'NEXT turns to the second');
    check((await page.locator('.content .name.big').textContent()).trim() === (chars[1].name || 'UNNAMED'), 'and shows the second character');
    await page.keyboard.press('ArrowLeft');
    check(await until(async () => await pinfo() === `1 / ${n}`), 'the left arrow key turns back');
    check(await page.locator('.foot .pg', { hasText: 'PREV' }).isDisabled(), 'PREV does nothing on the first page');
    await page.locator('.toc .toc-item').nth(4).click();
    check(await until(async () => await pinfo() === `5 / ${n}`), 'a name in the index opens that page');
    check(await page.locator('.toc .toc-item').nth(4).evaluate(e => e.classList.contains('on')), 'and the index marks it');
    await page.screenshot({ path: out + '/enc-character.png' });

    // ── places: written, edited (a picture, a soundtrack), deleted ──
    await tab('PLACES');
    const placesBefore = (await enc()).places.length;
    await page.locator('.left-ft .u-btn', { hasText: 'NEW PLACE' }).click();
    await dialog().waitFor();
    await save('SAVE PLACE');
    await page.waitForTimeout(300);
    check(await dialog().isVisible() && (await enc()).places.length === placesBefore, 'a place without a name is not saved');
    await fill('Shattered Spire', 'E2E PLACE');
    await fill('Northern Wastes', 'E2E REGION');
    await select('TYPE', 'RUIN');
    await fill('What does this place look like', 'A place for testing.');
    await dialog().locator('.u-btn', { hasText: 'ADD TRACK' }).click();
    await dialog().locator('.st-lbl').fill('THEME');
    await dialog().locator('.st-url').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await dialog().locator('input[type=file]').setInputFiles(PNG);
    check(await until(async () => /^data:image\/png/.test(await dialog().locator('.img-preview img').getAttribute('src').catch(() => ''))), 'a small picture is kept in the document itself');
    await save('SAVE PLACE');
    check(await until(async () => (await enc()).places.some(p => p.name === 'E2E PLACE')), 'the new place is saved');
    let place = (await enc()).places.find(p => p.name === 'E2E PLACE');
    check(place && place.region === 'E2E REGION' && place.type === 'RUIN' && place.desc === 'A place for testing.' && /^data:image\/png/.test(place.image || '') && place.soundtracks?.length === 1 && place.soundtracks[0].label === 'THEME' && !!place.id,
      'with everything the editor had: ' + JSON.stringify({ ...place, image: (place?.image || '').slice(0, 20) }));
    check(await until(async () => await pinfo() === `${placesBefore + 1} / ${placesBefore + 1}`) && await opens('E2E PLACE'), 'and the page turns to it');
    await page.locator('.track-hd').click();
    check(await until(async () => /youtube\.com\/embed\/dQw4w9WgXcQ/.test(await page.locator('.embed iframe').getAttribute('src').catch(() => ''))), 'its soundtrack opens as a YouTube player');
    await page.locator('.content .actions .u-btn', { hasText: /^\s*EDIT\s*$/ }).click();
    await dialog().waitFor();
    check(await dialog().getByPlaceholder('Shattered Spire').inputValue() === 'E2E PLACE', 'EDIT opens the place as it is');
    await fill('Shattered Spire', 'E2E PLACE TWO');
    // a big picture would take the document past Firestore's limit: it goes to Cloudinary instead
    await dialog().locator('input[type=file]').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(1100000, 7) });
    check(await until(async () => /res\.cloudinary\.com\/dhdfz1iud\/image\/upload\/e2e-/.test(await dialog().locator('.img-preview img').getAttribute('src').catch(() => ''))), 'a big picture is uploaded instead');
    await save('SAVE PLACE');
    check(await until(async () => (await enc()).places.some(p => p.name === 'E2E PLACE TWO')), 'the edit is saved');
    const placesNow = (await enc()).places;
    const edited = placesNow.find(p => p.name === 'E2E PLACE TWO');
    check(placesNow.length === placesBefore + 1 && edited.id === place.id && /cloudinary/.test(edited.image), 'in place, not as a new one, with the uploaded picture');
    place = edited;

    // ── statuses: written, put in folders, dragged ──
    await tab('STATUS FX');
    await page.locator('.left-ft .u-btn', { hasText: 'NEW STATUS' }).click();
    await dialog().waitFor();
    await fill('Burning', 'E2E STATUS');
    await select('TYPE', 'BUFF');
    await dialog().locator('.sw[aria-label="#44aaff"]').click();
    await dialog().locator('.sp').nth(3).click();
    await select('SHAPE', 'star');
    await fill('What does this status do', 'Tests things.');
    await fill('3 turns', '2 turns');
    check(await dialog().locator('.preview .star:not(.dim)').count() === 4, 'the preview shows the stars picked');
    await save('SAVE STATUS');
    check(await until(async () => (await enc()).statuses.some(s => s.name === 'E2E STATUS')), 'the new status is saved');
    let statuses = (await enc()).statuses;
    let status = statuses.find(s => s.name === 'E2E STATUS');
    check(status.type === 'BUFF' && status.folder === 'GOOD' && status.color === '#44aaff' && status.stars === 4 && status.shape === 'star' && status.duration === '2 turns', 'with what the editor had, in the POSITIVE folder: ' + JSON.stringify(status));
    const group = f => page.locator('.toc .group').filter({ has: page.locator('.group-title', { hasText: f }) });
    check(await opens('E2E STATUS'), 'the page turns to it');
    check((await group('POSITIVE').locator('.toc-item .txt').allTextContents()).map(s => s.trim()).pop() === 'E2E STATUS', 'the index shows it last of the positive ones');
    check(await page.locator('.content .stars .star').count() === 4, 'its page shows four stars');
    // dragged onto the NEGATIVE folder: it moves there, after the last negative one
    await page.locator('.toc-item', { hasText: 'E2E STATUS' }).dragTo(page.locator('.group-title', { hasText: 'NEGATIVE' }));
    check(await until(async () => (await enc()).statuses.find(s => s.name === 'E2E STATUS')?.folder === 'BAD'), 'dragged onto NEGATIVE, it moves to that folder');
    statuses = (await enc()).statuses;
    const lastBad = statuses.map((s, i) => ({ s, i })).filter(x => (x.s.folder || (x.s.type === 'DEBUFF' ? 'BAD' : x.s.type === 'BUFF' ? 'GOOD' : 'NEUTRAL')).toUpperCase() === 'BAD').pop();
    check(lastBad.s.name === 'E2E STATUS', 'after the last of them');
    check(await until(async () => (await group('NEGATIVE').locator('.toc-item .txt').allTextContents()).map(s => s.trim()).pop() === 'E2E STATUS'), 'and the index shows it there');
    check((await page.locator('.content .name').first().textContent()).trim() === 'E2E STATUS', 'the page it was open on stays open');
    // dragged onto the status above it (both in view: a drag cannot scroll the index here): it goes just before it
    const bads = group('NEGATIVE').locator('.toc-item'), above = bads.nth((await bads.count()) - 2);
    const aboveName = (await above.locator('.txt').textContent()).trim();
    await page.locator('.toc-item', { hasText: 'E2E STATUS' }).dragTo(above);
    check(await until(async () => { const l = (await enc()).statuses; const i = l.findIndex(s => s.name === 'E2E STATUS'); return i >= 0 && l[i + 1]?.name === aboveName; }), `dragged onto ${aboveName}, it goes just before it`);
    check((await page.locator('.content .name').first().textContent()).trim() === 'E2E STATUS', 'and its page is still the one open');
    await page.locator('.group-title', { hasText: 'POSITIVE' }).click();
    check(await until(async () => await group('POSITIVE').locator('.toc-item').count() === 0), 'a folder closes');
    await page.locator('.group-title', { hasText: 'POSITIVE' }).click();
    status = (await enc()).statuses.find(s => s.name === 'E2E STATUS');

    // ── a write keeps what was written meanwhile elsewhere ──
    await tab('NPCS');
    await page.locator('.left-ft .u-btn', { hasText: 'NEW NPC' }).click();
    await dialog().waitFor();
    await fill('The Archivist', 'E2E NPC');
    await fill('Merchant', 'E2E ROLE');
    await select('ALIGNMENT', 'ALLY');
    await dialog().locator('.sw[aria-label="#5aaae0"]').click();
    {
      // another tab adds a place while this editor is open
      const d = await raw('next_enc/data');
      d.fields.places.arrayValue.values.push({ mapValue: { fields: { id: { stringValue: 'e2eothertab' }, name: { stringValue: 'OTHER TAB PLACE' } } } });
      await put('next_enc/data', d);
    }
    await save('SAVE NPC');
    check(await until(async () => (await enc()).npcs.some(x => x.name === 'E2E NPC')), 'the new NPC is saved');
    const npc = (await enc()).npcs.find(x => x.name === 'E2E NPC');
    check(npc.role === 'E2E ROLE' && npc.alignment === 'ALLY' && npc.color === '#5aaae0', 'with what the editor had');
    check(await opens('E2E NPC'), 'the page turns to it');
    check((await enc()).places.some(p => p.name === 'OTHER TAB PLACE'), 'and the place another tab added meanwhile is kept');
    check(await page.locator('.content .badge').allTextContents().then(a => a.map(s => s.trim()).join(',')) === 'E2E ROLE,ALLY', 'its page shows its role and alignment');

    // ── memories: a chapter, its characters and its scenes ──
    await tab('MEMORIES');
    const memBefore = (await enc()).memories.length;
    await page.locator('.left-ft .u-btn', { hasText: 'NEW CHAPTER' }).click();
    await dialog().waitFor();
    await fill('Night of Falling Stars', 'E2E CHAPTER');
    await fill('Arc I', 'E2E ARC');
    await fill('Year 302', 'Year 1');
    const linked = chars[2];
    await dialog().locator('.cp', { hasText: linked.name }).first().click();
    check(await until(async () => await dialog().locator('.cp.on').count() === 1), 'a character ticks');
    await save('SAVE CHAPTER');
    check(await until(async () => (await enc()).memories.some(m => m.title === 'E2E CHAPTER')), 'the new chapter is saved');
    let mem = (await enc()).memories.find(m => m.title === 'E2E CHAPTER');
    check(mem.arc === 'E2E ARC' && mem.date === 'Year 1' && JSON.stringify(mem.characterIds) === JSON.stringify([linked.id]) && (mem.scenes || []).length === 0, 'linked to the character ticked: ' + JSON.stringify(mem));
    check(await opens('E2E CHAPTER'), 'the page turns to it');
    await page.locator('.mode', { hasText: 'BY CHARACTER' }).click();
    const charGroup = page.locator('.toc .group').filter({ has: page.locator('.group-title .cname', { hasText: new RegExp('^\\s*' + linked.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }) });
    check(await until(async () => await charGroup.locator('.toc-item', { hasText: 'E2E CHAPTER' }).count() === 1), `the index puts it under ${linked.name}`);
    await page.locator('.content .add-scene .u-btn').click();
    await page.locator('.scene-form textarea').fill('Something happened.');
    await page.locator('.scene-form input').fill('E2E SCENE');
    await page.locator('.scene-form .u-btn.primary').click();
    check(await until(async () => ((await enc()).memories.find(m => m.title === 'E2E CHAPTER').scenes || []).length === 1), 'a scene is added');
    check(await until(async () => (await page.locator('.scene .scene-title').allTextContents()).map(s => s.trim()).includes('E2E SCENE')), 'and shows on the page');
    await page.locator('.scene').filter({ hasText: 'E2E SCENE' }).locator('.u-btn', { hasText: 'EDIT' }).click();
    check(await page.locator('.scene-form textarea').inputValue() === 'Something happened.', 'EDIT opens the scene as it is');
    await page.locator('.scene-form textarea').fill('Something else happened.');
    await page.locator('.scene-form .u-btn.primary', { hasText: 'UPDATE SCENE' }).click();
    check(await until(async () => (await enc()).memories.find(m => m.title === 'E2E CHAPTER').scenes[0]?.text === 'Something else happened.'), 'the scene is updated');
    // editing the chapter keeps its scenes
    await page.locator('.content .actions .u-btn', { hasText: 'EDIT CHAPTER' }).click();
    await dialog().waitFor();
    await fill('Night of Falling Stars', 'E2E CHAPTER TWO');
    await save('SAVE CHAPTER');
    check(await until(async () => (await enc()).memories.some(m => m.title === 'E2E CHAPTER TWO')), 'the chapter is renamed');
    mem = (await enc()).memories.find(m => m.title === 'E2E CHAPTER TWO');
    check((mem.scenes || []).length === 1 && (await enc()).memories.length === memBefore + 1, 'and keeps its scene');
    await page.locator('.mem-search').fill('zzzz no one');
    check(await until(async () => (await page.locator('.toc-empty').textContent().catch(() => '')).includes('NO MATCHES')), 'searching for no one finds no one');
    await page.locator('.mem-search').fill(linked.name.slice(0, 3));
    check(await until(async () => await page.locator('.toc .group').count() >= 1), 'searching by name finds them');
    await page.locator('.mem-search').fill('');
    await page.screenshot({ path: out + '/enc-memory.png' });

    // ── the old page reads what this one wrote ──
    if (old) {
      await put('enc/data', await raw('next_enc/data'));
      const o = await openOldLocal({ path: 'encyclopedia.html', width: 1600, height: 900, waitMs: 4000 });
      const seen = await o.page.evaluate(() => {
        const names = s => { switchSection(s); return [...document.querySelectorAll('#enc-toc .enc-toc-txt')].map(e => e.textContent.trim()); };
        const r = { places: names('places'), statuses: names('statuses'), npcs: names('npcs') };
        switchSection('memories'); setMemViewMode('all'); r.memories = [...document.querySelectorAll('#enc-toc .enc-toc-txt')].map(e => e.textContent.trim());
        const i = encMemories.findIndex(m => m.title === 'E2E CHAPTER TWO');
        encGoTo(i);
        r.scene = document.getElementById('enc-content-scroll')?.textContent || document.body.textContent;
        return r;
      });
      await o.browser.close();
      check(seen.places.includes('E2E PLACE TWO') && seen.statuses.includes('E2E STATUS') && seen.npcs.includes('E2E NPC') && seen.memories.includes('E2E CHAPTER TWO'), 'the old page lists the place, status, NPC and chapter written here');
      check(/Something else happened\./.test(seen.scene), 'and shows the chapter\'s scene');
    }

    // ── deleting ──
    await page.locator('.scene').filter({ hasText: 'E2E SCENE' }).locator('.u-btn.danger').click();
    check(await until(async () => ((await enc()).memories.find(m => m.title === 'E2E CHAPTER TWO')?.scenes || []).length === 0), 'a scene is removed');
    const del = async (t, what, gone) => {
      await tab(t);
      if (t === 'MEMORIES') await page.locator('.mode', { hasText: 'ALL' }).click();
      await page.locator('.toc .toc-item', { hasText: what }).first().click();
      await page.locator('.content .actions .u-btn.danger').click();
      await page.locator('ss-modal .dialog .u-btn.danger', { hasText: 'DELETE' }).click();
      check(await until(async () => gone(await enc())), `${what} is deleted`);
    };
    await del('PLACES', 'E2E PLACE TWO', d => !d.places.some(p => p.id === place.id));
    await del('PLACES', 'OTHER TAB PLACE', d => !d.places.some(p => p.id === 'e2eothertab'));
    await del('STATUS FX', 'E2E STATUS', d => !d.statuses.some(s => s.id === status.id));
    await del('NPCS', 'E2E NPC', d => !d.npcs.some(x => x.id === npc.id));
    await del('MEMORIES', 'E2E CHAPTER TWO', d => !d.memories.some(m => m.id === mem.id));
    const after = await enc(), before = plain({ mapValue: { fields: savedNew.fields } });
    check(['places', 'statuses', 'memories', 'npcs'].every(k => JSON.stringify(after[k].map(x => x.id)) === JSON.stringify(before[k].map(x => x.id))), 'and every list is back as it was');
    check(Object.keys(after).sort().join(',') === 'memories,npcs,places,statuses', 'the document keeps only the four lists, as the old page wrote it');

    // ── Escape closes an editor ──
    await tab('NPCS');
    await page.locator('.left-ft .u-btn', { hasText: 'NEW NPC' }).click();
    await dialog().waitFor();
    await page.keyboard.press('Escape');
    check(await until(async () => !(await dialog().isVisible().catch(() => false))), 'Escape closes an editor');

    // ── a phone: the index is a drawer ──
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const m = await phone.newPage();
    await require('./e2e_guard')(m);
    await m.goto(BASE + '/encyclopedia');
    await m.waitForSelector('.toc .toc-item', { state: 'attached', timeout: 20000 });
    await m.waitForTimeout(400);
    check(await m.evaluate(() => document.documentElement.scrollWidth) <= 390, 'on a phone nothing is wider than the screen');
    check(!(await m.locator('.left').isVisible()), 'the index is put away');
    await m.locator('.toc-btn').click();
    check(await until(async () => await m.locator('.left.open').isVisible()), 'INDEX opens it');
    await m.screenshot({ path: out + '/enc-phone-index.png' });
    await m.locator('.toc .toc-item').nth(2).click();
    check(await until(async () => !(await m.locator('.left.open').count())), 'picking a name puts it away');
    check(await until(async () => (await m.locator('.pinfo').textContent()).replace(/\s+/g, ' ').trim().startsWith('3 /')), 'and opens that page');
    await m.locator('.tabs .tab', { hasText: 'PLACES' }).click();
    check(await until(async () => (await m.locator('.idx-label').textContent()).trim() === 'PLACES'), 'the bookmarks along the bottom change the section');
    await m.screenshot({ path: out + '/enc-phone.png' });
    await phone.close();

    check(!errors.length, 'no errors on the page' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    bad.push('the run stopped: ' + String(e && e.stack || e).slice(0, 400));
    await page.screenshot({ path: out + '/enc-failure.png' }).catch(() => {});
  } finally {
    await put('next_enc/data', savedNew);
    if (savedOld) await put('enc/data', savedOld);
    await browser.close();
  }
  for (const s of ok) console.log('  ok   ' + s);
  for (const s of bad) console.log('  FAIL ' + s);
  console.log(`${ok.length} passed, ${bad.length} failed`);
  process.exit(bad.length ? 1 : 0);
})();
