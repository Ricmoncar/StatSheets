// Every end-to-end test calls this first. It refuses to go on unless the build
// served on :8790 is the e2e build (`ng build -c e2e`), whose data is the local
// Firestore emulator (seed it with seed_emulator.js). Any other build talks to
// the real project, whose daily quota the live site shares; a day of test runs
// used all of it once.
module.exports = async function requireEmulator(page, base = 'http://127.0.0.1:8790') {
  // and should anything still try the real project, it does not get through
  await page.route(/firestore\.googleapis\.com/, r => { console.error('BLOCKED a call to the real Firestore: ' + r.request().url().slice(0, 120)); r.abort(); });
  await page.goto(base + '/utilities');
  const label = await page.locator('.sandbox').textContent({ timeout: 15000 }).catch(() => '');
  if (!/LOCAL EMULATOR/.test(label || '')) {
    console.error('REFUSING TO RUN: the build on :8790 is not the e2e build (ng build -c e2e), so it would use the real Firebase project.');
    process.exit(3);
  }
};
