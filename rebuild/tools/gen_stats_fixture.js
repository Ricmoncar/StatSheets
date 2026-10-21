// Records the OLD site's effective stats for every live character in every
// form, so the Angular port can be checked against them number for number.
//
//   node rebuild/tools/gen_stats_fixture.js
// Writes web/src/testing/fixtures/stats.json (git-ignored: it holds live data).
// Needs the static server and the Firebase copies described in rebuild/README.md.
const fs = require('fs');
const path = require('path');
const { openOldSite } = require('./oldsite.js');

const OUT = path.resolve(__dirname, '../../web/src/testing/fixtures/stats.json');

(async () => {
  const { browser, page, errors } = await openOldSite({ path: 'index.html', waitMs: 9000 });
  const data = await page.evaluate(() => {
    // images do not affect stats; drop them to keep the fixture small
    const strip = c => {
      const x = JSON.parse(JSON.stringify(c));
      delete x.avatar;
      (x.altForms || []).forEach(f => { delete f.avatar; });
      (x.abilities || []).forEach(a => { delete a.image; });
      (x.inventory || []).forEach(i => { delete i.iconImage; });
      return x;
    };
    const chars = characters.map(strip);
    const results = {};
    for (const c of chars) {
      results[c.id] = {};
      const forms = (c.altForms || []).length;
      for (let f = 0; f <= forms; f++) {
        const clone = JSON.parse(JSON.stringify(c));
        clone.activeFormIdx = f;
        results[c.id][f] = getEffectiveStats(clone);
      }
    }
    return { generatedAt: Date.now(), chars, results };
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  const cases = Object.values(data.results).reduce((n, r) => n + Object.keys(r).length, 0);
  console.log(`wrote ${OUT}: ${data.chars.length} characters, ${cases} form cases; page errors: ${errors.length}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
