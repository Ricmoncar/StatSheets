// Replays the OLD site's pickTraitFromHand with seeded Math.random and a
// fixed Date.now on copies of a real character, so the Angular port can be
// required to make the same changes. Saves are blocked by the network guard.
//   node rebuild/tools/gen_pick_fixture.js -> web/src/testing/fixtures/picks.json
const fs = require('fs');
const path = require('path');
const { openOldSite } = require('./oldsite.js');
const OUT = path.resolve(__dirname, '../../web/src/testing/fixtures/picks.json');

(async () => {
  const { browser, page } = await openOldSite({ path: 'index.html', waitMs: 9000 });
  const data = await page.evaluate(() => {
    const mulberry32 = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const realRandom = Math.random, realNow = Date.now;
    const savedSave = saveData, savedView = viewChar, savedNotify = notify, savedSound = playSound, savedSeen = seenTraits.slice();
    // keep the old code from touching the screen or the database
    saveData = () => {}; viewChar = () => {}; notify = () => {}; playSound = () => {};
    const strip = c => { const x = JSON.parse(JSON.stringify(c)); delete x.avatar; (x.altForms || []).forEach(f => delete f.avatar); (x.abilities || []).forEach(a => delete a.image); (x.inventory || []).forEach(i => delete i.iconImage); return x; };
    const withForms = characters.find(c => (c.altForms || []).length >= 1 && (c.traits || []).length);
    const base = strip(withForms);
    const cultKey = Object.keys(TRAITS).find(k => TRAITS[k].cultivation);
    const dualKey = Object.keys(TRAITS).find(k => TRAITS[k].rarity === 'duality');
    const keys = ['brave', 'girlyopscurse', 'onlyatraitor', 'woetothee', 'determination', cultKey, dualKey, 'favored'];
    const cases = [];
    try {
      let seed = 1;
      for (const key of keys) for (const shimmyful of [false, true]) for (const formIdx of [0, 1]) {
        const c = JSON.parse(JSON.stringify(base));
        characters.push(c);           // the old code looks the character up by currentId
        const prevId = currentId; currentId = c.id = 'fixture-' + seed;
        _rollFormIdx = formIdx;
        Math.random = mulberry32(seed); Date.now = () => 1700000000000 + seed;
        pickTraitFromHand({ key, shimmyful });
        cases.push({ seed, key, shimmyful, formIdx, after: JSON.parse(JSON.stringify(c)) });
        characters.splice(characters.indexOf(c), 1); currentId = prevId;
        seed++;
      }
    } finally {
      Math.random = realRandom; Date.now = realNow;
      saveData = savedSave; viewChar = savedView; notify = savedNotify; playSound = savedSound;
      seenTraits = savedSeen; try { saveSeenTraits(); } catch (e) {}
      try { closeTraitRoll(); } catch (e) {}
    }
    return { base, cases };
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log(`wrote ${OUT}: ${data.cases.length} picks on ${data.base.name}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
