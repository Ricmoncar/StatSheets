// Records the OLD site's stat breakdown and trait tooltips for every live
// character (breakdowns on the base form, trait tooltips in every form), so
// the port's tooltips can be checked line for line.
//
//   node rebuild/tools/gen_tooltip_fixture.js
// Writes web/src/testing/fixtures/tooltips.json (git-ignored: live data).
const fs = require('fs');
const path = require('path');
const { openOldSite } = require('./oldsite.js');

const OUT = path.resolve(__dirname, '../../web/src/testing/fixtures/tooltips.json');

(async () => {
  const { browser, page, errors } = await openOldSite({ path: 'index.html', waitMs: 9000 });
  await page.waitForFunction(() => typeof characters !== 'undefined' && characters.length > 100, null, { timeout: 60000 });
  const data = await page.evaluate(() => {
    const strip = c => {
      const x = JSON.parse(JSON.stringify(c));
      delete x.avatar;
      (x.altForms || []).forEach(f => { delete f.avatar; });
      (x.abilities || []).forEach(a => { delete a.image; });
      (x.inventory || []).forEach(i => { delete i.iconImage; });
      return x;
    };
    const parse = html => {
      const box = document.createElement('div');
      box.innerHTML = html;
      return {
        title: (box.querySelector('.tt-header, .tt-header-main')?.textContent || '').trim(),
        lines: [...box.querySelectorAll('.tt-line')].map(l => [l.children[0].textContent.trim(), l.children[1].textContent.trim()]),
        notes: [...box.querySelectorAll('.tt-extra, .tt-note')].map(n => n.textContent.trim()),
      };
    };
    const chars = characters.map(strip);
    const breakdowns = {}, traits = {};
    for (const c of chars) {
      breakdowns[c.id] = {};
      const base = JSON.parse(JSON.stringify(c));
      base.activeFormIdx = 0;
      for (const s of ['hp', 'atk', 'def', 'mag', 'spd', 'iq']) breakdowns[c.id][s] = parse(buildStatBreakdownTooltip(base, s));
      traits[c.id] = {};
      for (let f = 0; f <= (c.altForms || []).length; f++) {
        const clone = JSON.parse(JSON.stringify(c));
        clone.activeFormIdx = f;
        traits[c.id][f] = {};
        for (const k of _formTraits(clone)) if (TRAITS[k]) traits[c.id][f][k] = parse(buildTraitTooltip(clone, k));
      }
    }
    return { generatedAt: Date.now(), chars, breakdowns, traits };
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  const n = Object.values(data.traits).reduce((a, forms) => a + Object.values(forms).reduce((b, t) => b + Object.keys(t).length, 0), 0);
  console.log(`wrote ${OUT}: ${data.chars.length} characters, ${n} trait tooltips; page errors: ${errors.length}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
