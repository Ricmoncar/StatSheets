// Replays the OLD site's rollHand with a seeded Math.random, so the Angular
// port can be required to deal identical hands from the same seeds.
//   node rebuild/tools/gen_roll_fixture.js  ->  web/src/testing/fixtures/rolls.json
const fs = require('fs');
const path = require('path');
const { openOldSite } = require('./oldsite.js');
const OUT = path.resolve(__dirname, '../../web/src/testing/fixtures/rolls.json');

(async () => {
  const { browser, page } = await openOldSite({ path: 'index.html', waitMs: 4000 });
  const data = await page.evaluate(() => {
    const mulberry32 = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const realRandom = Math.random;
    const seen = Object.keys(TRAITS).filter((k, i) => i % 3 === 0);
    const savedSeen = seenTraits, savedFortune = _fortune, savedShimmy = _shimmyAll;
    seenTraits = seen;
    const cases = [];
    try {
      for (let seed = 1; seed <= 400; seed++) {
        const isPity = seed % 7 === 0;
        const fortune = seed % 5 === 0 ? (seed % 3) + 1 : 0;
        const shimmyAll = seed % 11 === 0;
        _fortune = fortune; _shimmyAll = shimmyAll;
        Math.random = mulberry32(seed);
        const hand = rollHand(isPity);
        cases.push({ seed, isPity, fortune, shimmyAll, hand });
      }
    } finally {
      Math.random = realRandom; seenTraits = savedSeen; _fortune = savedFortune; _shimmyAll = savedShimmy;
    }
    return { seen, cases };
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log(`wrote ${OUT}: ${data.cases.length} hands`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
