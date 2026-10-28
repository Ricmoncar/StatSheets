// node old_pages_map.js > pages.json   (old site served on :8765, emulator seeded with OLD_SITE=1)
//
// Which character (and which form) gets which custom page on the old site:
// reads the page-type ladder out of script.js and runs its predicates on
// every character and every form in the local data.
const fs = require('fs');
const path = require('path');
const { openOldLocal } = require('./oldlocal');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'script.js'), 'utf8');
const ladder = src.match(/const ptype = (_isNaraBlue\(c\)[^;]*);/)[1];
const pairs = [...ladder.matchAll(/(_is\w+)\(c\) \? '(\w+)'/g)].map(m => [m[1], m[2]]);

(async () => {
  const { browser, page } = await openOldLocal({ waitMs: 1000 });
  await page.waitForFunction(() => typeof characters !== 'undefined' && characters.length > 0, null, { timeout: 30000 });
  const out = await page.evaluate(pairs => {
    const map = {};
    for (const ch of characters) {
      const forms = [0, ...(ch.altForms || []).map((_, i) => i + 1)];
      for (const f of forms) {
        const c = { ...ch, activeFormIdx: f };
        const hit = pairs.find(([fn]) => { try { return window[fn] && window[fn](c); } catch { return false; } });
        if (!hit) continue;
        (map[hit[1]] ||= []).push({ id: ch.id, name: ch.name, form: f, formName: f ? (ch.altForms[f - 1]?.name || '') : '' });
      }
    }
    return map;
  }, pairs);
  const missing = pairs.map(p => p[1]).filter(k => !out[k]);
  console.log(JSON.stringify({ pages: out, missing }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
