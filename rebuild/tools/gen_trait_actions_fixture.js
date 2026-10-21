// Replays the OLD site's trait-card actions with seeded Math.random on a copy
// of a real character and records the character after every step, so the
// Angular port can be required to end up in the same state.
//   node rebuild/tools/gen_trait_actions_fixture.js -> web/src/testing/fixtures/trait-actions.json
const fs = require('fs');
const path = require('path');
const { openOldSite } = require('./oldsite.js');
const OUT = path.resolve(__dirname, '../../web/src/testing/fixtures/trait-actions.json');

// each scenario: traits on the base form, shimmyful or not, and a list of steps
const SCENARIOS = [
  ['missingno', ['missingNo', 'missingNo']],
  ['glitch', ['glitch']],
  ['thousanddoors', ['doors', 'doors', 'doors', 'doorsUndo', 'doorsReset', 'doorsUndo']],
  ['anotherandanother', ['drunk:atkmag', 'drunk:defhp', 'drunk:atkmag']],
  ['perfectsoul', ['soul:1', 'soul:2', 'soulRemove:0', 'soulUndo', 'soulReset', 'soulUndo']],
  ['capitalist', ['capitalist', 'capitalist', 'capitalist']],
  ['determination', ['det:kills:1', 'det:kills:15', 'det:spares:-2', 'det:deaths:3', 'detState:hatred', 'detAbsorb:1', 'detAbsorb:2', 'detAbsorb:1', 'detRemove:1', 'detState:determined']],
  ['@duality', ['trigger:first', 'duality', 'duality']],
  ['@situational', ['trigger:first', 'trigger:first', 'trigger:first']],
  ['missingno', ['missingNo', 'remove']],
  ['thousanddoors', ['doors', 'remove']],
  ['perfectsoul', ['soul:1', 'remove']],
  ['determination', ['det:kills:2', 'remove']],
];

(async () => {
  const { browser, page } = await openOldSite({ path: 'index.html', waitMs: 2000 });
  await page.waitForFunction(() => typeof characters !== 'undefined' && characters.length > 100, null, { timeout: 60000 });
  const data = await page.evaluate((SCENARIOS) => {
    const mulberry32 = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const keep = { saveData, updateLiveStats, renderTraitsDisplay, notify, playSound, random: Math.random };
    saveData = () => {}; updateLiveStats = () => {}; renderTraitsDisplay = () => {}; notify = () => {}; playSound = () => {};
    const strip = c => { const x = JSON.parse(JSON.stringify(c)); delete x.avatar; delete x.altForms; x.activeFormIdx = 0; (x.abilities || []).forEach(a => delete a.image); (x.inventory || []).forEach(i => delete i.iconImage); return x; };
    const others = characters.filter(c => c.stats).slice(0, 3).map(strip);
    const dualKey = Object.keys(TRAITS).find(k => TRAITS[k].rarity === 'duality' && (TRAITS[k].situational || []).some(s => s.passive && s.passive.length && s.label.startsWith('HEAVENLY')));
    const sitKey = Object.keys(TRAITS).find(k => TRAITS[k].rarity !== 'duality' && (TRAITS[k].situational || []).some(s => s.passive && s.passive.length));
    const out = [];
    let seed = 100;
    try {
      for (const [rawKey, steps] of SCENARIOS) for (const shimmy of [false, true]) {
        const key = rawKey === '@duality' ? dualKey : rawKey === '@situational' ? sitKey : rawKey;
        const c = strip(characters.find(x => x.stats));
        c.id = 'fixture-' + seed; c.traits = [key]; c.shimmyfulTraits = shimmy ? [key] : [];
        c.gold = 123456; c.traitStacks = {}; c.traitTriggers = {}; c.dualityState = {};
        delete c.perfectSoulData; delete c.missingNoRolls; delete c.glitchRolls; delete c.thousandDoorsAccum; delete c.thousandDoorsHistory; delete c.drunkStats;
        characters.push(c); others.forEach(o => characters.push(o));
        const prevId = currentId; currentId = c.id;
        Math.random = mulberry32(seed);
        const start = JSON.parse(JSON.stringify(c));
        const after = [];
        for (const step of steps) {
          const [op, a, b] = step.split(':');
          if (op === 'missingNo') rollMissingNo();
          else if (op === 'glitch') rollGlitch();
          else if (op === 'doors') rollThousandDoors();
          else if (op === 'doorsUndo') undoThousandDoors();
          else if (op === 'doorsReset') resetThousandDoors();
          else if (op === 'drunk') rollAnotherandAnother(a);
          else if (op === 'soul') { _psSelectedChar = others[+a].name; absorbPerfectSoul(); }
          else if (op === 'soulRemove') removePerfectSoul(+a);
          else if (op === 'soulUndo') undoPerfectSoul();
          else if (op === 'soulReset') resetPerfectSoul();
          else if (op === 'capitalist') toggleCapitalistTrait();
          else if (op === 'det') adjustDetermination(key, a, +b);
          else if (op === 'detState') setDeterminationState(key, a);
          else if (op === 'detAbsorb') { const sel = document.createElement('select'); sel.id = 'det-absorb-picker'; const o = document.createElement('option'); o.value = others[+a].id; sel.appendChild(o); sel.value = others[+a].id; document.body.appendChild(sel); absorbCharacterStats(); sel.remove(); }
          else if (op === 'detRemove') removeAbsorbedStats(others[+a].id);
          else if (op === 'duality') { const ch = document.querySelector('.trait-chip[data-trait="' + key + '"]'); if (ch) ch.remove(); toggleDuality(key); }
          else if (op === 'trigger') { const sit = (getTraitDef(c, key).situational || []).find(s => s.passive && s.passive.length && (!TRAITS[key].rarity.includes('duality') || s.label.startsWith(((c.dualityState || {})[key] || 'heavenly').toUpperCase()))); toggleTraitTrigger(key + ':' + sit.id); }
          else if (op === 'remove') removeTrait(key);
          after.push(JSON.parse(JSON.stringify(c)));
        }
        out.push({ seed, key, shimmy, steps, start, after });
        characters.splice(characters.indexOf(c), 1); others.forEach(o => characters.splice(characters.indexOf(o), 1));
        currentId = prevId; seed++;
      }
    } finally {
      Math.random = keep.random; saveData = keep.saveData; updateLiveStats = keep.updateLiveStats; renderTraitsDisplay = keep.renderTraitsDisplay; notify = keep.notify; playSound = keep.playSound;
    }
    return { others, cases: out };
  }, SCENARIOS);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log(`wrote ${OUT}: ${data.cases.length} scenarios, ${data.cases.reduce((n, c) => n + c.after.length, 0)} steps`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
