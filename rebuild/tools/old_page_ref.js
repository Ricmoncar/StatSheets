// node old_page_ref.js <out-dir> <page-key> [...]   (old site on :8765, emulator seeded with OLD_SITE=1)
//
// The reference for remaking a character page: opens its character (in the
// form that has the page) on the old site, against the emulator, and saves a
// desktop screenshot, one of the background alone, and what the page set on
// the interface: the background's opacity and --char-color.
const fs = require('fs');
const { openOldLocal } = require('./oldlocal');
const map = require('./fixtures/pages_map.json').pages;

(async () => {
  const [out, ...keys] = process.argv.slice(2);
  const { browser, page } = await openOldLocal({ path: 'index.html', width: 1600, height: 900, waitMs: 2500 });
  await page.waitForFunction(() => typeof characters !== 'undefined' && characters.length > 0, null, { timeout: 30000 });
  for (const key of keys) {
    const who = (map[key] || [])[0];
    if (!who) { console.log(key, 'not in the map'); continue; }
    await page.evaluate(({ id, form }) => { const c = characters.find(x => x.id === id); if (c) c.activeFormIdx = form; viewChar(id); }, who);
    await page.mouse.move(1100, 420);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/${key}-old.png` });
    const info = await page.evaluate(() => {
      const pc = document.getElementById('pattern-canvas'), cv = document.getElementById('char-view');
      return {
        opacity: pc ? getComputedStyle(pc).opacity : null,
        charColor: cv ? cv.style.getPropertyValue('--char-color') || getComputedStyle(cv).getPropertyValue('--char-color') : null,
        classes: cv ? cv.className : '',
        overlays: [...document.querySelectorAll('body > canvas, body > div[id*="overlay"], canvas[id*="overlay"]')].map(e => e.id).filter(Boolean),
        bg: pc ? pc.toDataURL() : null,
      };
    });
    if (info.bg) fs.writeFileSync(`${out}/${key}-old-bg.png`, Buffer.from(info.bg.split(',')[1], 'base64'));
    delete info.bg;
    console.log(key, JSON.stringify({ who: who.name + (who.formName ? ' · ' + who.formName : ''), ...info }));
  }
  await browser.close();
})();
