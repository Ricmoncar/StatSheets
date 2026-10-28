// node seed_emulator.js <snapshot-dir> [more dirs...]   (FS_EMULATOR=host:port, default 127.0.0.1:8085)
//
// Loads JSON snapshots (one <collection>.json per collection, as written by a
// read-only REST snapshot: [{ __id, __updateTime, ...fields }]; a subcollection
// is a file named like characters__<id>__gallery.json) into the local Firestore
// emulator as the next_ test collections, replacing what is there. Pass
// slim_snapshot.py's copy of the data, then fixtures/ for what tests expect.
//
// OLD_SITE=1 also loads the same data under the old site's own collection
// names (characters, not next_characters), for driving the old site against
// the emulator (tools/oldlocal.js) instead of the live database.
//
// The end-to-end tests run against the emulator, never the real project: the
// test copy (next_) shares the project's daily read quota with the live site,
// and a day of test runs used it all up.
const fs = require('fs');
const path = require('path');

const PROJECT = 'statsheets-3668d';
const dirs = process.argv.slice(2);
const host = process.env.FS_EMULATOR || '127.0.0.1:8085';
if (!dirs.length) { console.error('usage: node seed_emulator.js <snapshot-dir> [more dirs...]'); process.exit(2); }
const ROOT = `http://${host}/v1/projects/${PROJECT}/databases/(default)/documents`;
// "owner" skips the security rules, as the emulator allows for setup scripts
const HEADERS = { 'content-type': 'application/json', authorization: 'Bearer owner' };

function value(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  // beyond 2^53 (some gold balances are) a number was stored as a double
  if (typeof v === 'number') return Number.isSafeInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: fields(v) } };
}
function fields(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith('__')).map(([k, v]) => [k, value(v)]));
}

async function clear() {
  const r = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  if (!r.ok) throw new Error('clear failed: ' + r.status);
}

async function commit(writes) {
  const r = await fetch(`${ROOT.replace(/\/documents$/, '/documents:commit')}`, { method: 'POST', headers: HEADERS, body: JSON.stringify({ writes }) });
  if (!r.ok) throw new Error(`commit failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
}

(async () => {
  await clear();
  for (const dir of dirs) for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const docs = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!Array.isArray(docs) || !docs.length) continue;
    for (const prefix of process.env.OLD_SITE ? ['next_', ''] : ['next_']) {
      const col = prefix + path.basename(file, '.json').replace(/__/g, '/');
      // a few documents per request: some hold pictures close to the 1 MB limit
      let batch = [], bytes = 0;
      for (const d of docs) {
        const w = { update: { name: `projects/${PROJECT}/databases/(default)/documents/${col}/${d.__id}`, fields: fields(d) } };
        const size = JSON.stringify(w).length;
        if (batch.length && (bytes + size > 4_000_000 || batch.length >= 200)) { await commit(batch); batch = []; bytes = 0; }
        batch.push(w); bytes += size;
      }
      if (batch.length) await commit(batch);
      console.log(`${col}: ${docs.length}`);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
