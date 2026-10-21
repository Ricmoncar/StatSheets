# StatSheets rebuild (Angular + pixel-art redesign)

Work in progress. The live site is still the old one at the repo root and is
not affected by anything in `web/` or `rebuild/`.

- `web/`: the new Angular 22 app.
- `rebuild/tools/`: helpers for the rebuild (see below).
- `rebuild/design/`: the competing design directions and their judging.

## Phases

1. Everything except the characters' custom pages, redesigned in a pixel-art
   Undertale style, with every feature of the old site kept.
2. The custom character pages.

The new site is previewed at `/StatSheets/next/` and runs on a **separate copy
of the database**: every top-level collection is prefixed `next_`
(`next_characters`, `next_folders`, ...). Nothing done in the preview touches
the real data. Only the cutover build uses the real collections.

## Data safety rules the new client follows

- Saves are field-level diffs against the baseline the object was loaded from,
  merged in a transaction with the database's current copy, written with
  `_rev + 1` (see `web/src/app/core/data/merge.ts` and `character-store.ts`,
  ported line for line from the old `saveData`). The Firestore rules refuse
  any character update that does not carry exactly that revision.
- The new app uses its own Firebase app name (`statsheets-v2`) so its offline
  cache in IndexedDB is separate from the old site's on the same origin.

## Tooling in the cloud container

Angular 22 needs Node 22.22.3+ or 24.15+. The container ships 22.22.0, so get a
newer Node from the npm registry (nodejs.org itself may be blocked):

    mkdir -p /tmp/node24 && cd /tmp/node24 && npm init -y && npm install node-linux-x64@24.22.0
    export PATH=/tmp/node24/node_modules/node-linux-x64/bin:$PATH

Then in `web/`: `npm ci`, `npx ng build`, `npx ng test --watch=false`.

### End-to-end tests: local emulator only

The `next_` copy keeps test writes away from the real data, but it lives in
the same Firebase project, and every read counts against the project's daily
free quota, which the live site needs. A day of test runs used all of it once
and the live site could not load until the quota reset. So the `*_e2e.js`
tests run against a local Firestore emulator, and refuse to start otherwise
(`tools/e2e_guard.js` checks for the e2e build and blocks any request to the
real Firestore).

    # once: the emulator (Java 21 is in the container; checksum from firebase-tools' downloadableEmulatorInfo.json)
    curl -LO https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar
    java -Xmx4g -jar cloud-firestore-emulator-v1.22.0.jar --host 127.0.0.1 --port 8085 \
      --project_id statsheets-3668d --rules firestore.rules &
    # the data: a read-only snapshot, with big inline pictures scaled down
    # (full-size avatars made the emulator run out of memory), plus fixtures
    python3 rebuild/tools/slim_snapshot.py <snapshot-dir> <slim-dir>
    node rebuild/tools/seed_emulator.js <slim-dir> rebuild/tools/fixtures
    # the app built against it, served on :8790, then any test
    (cd web && npx ng build -c e2e)
    node rebuild/tools/stats_e2e.js <screenshot-dir>

Reseed between runs when a test leaves something behind; it replaces
everything in the emulator.

### Porting a character page (phase 2)

A page in the old `script.js` is a background drawn on `#pattern-canvas`, an
overlay canvas over the window, and a block of CSS in `style.css`
(`CHARACTER_PAGES.md` at the root is the manual they were built by). In the
new app (`web/src/app/pages/`):

1. **The code, nearly verbatim.** Copy the page's section of `script.js` into
   `pages/<key>/<key>.ts` with `// @ts-nocheck`, and mark every change
   `[port]`. Do the copy with a script that asserts each substitution's count
   (`tools/port_ivy_evil.py` is the pattern), not by hand. What the old code reached for
   outside itself comes from `pages/host.ts`: `_activeFormName`, the layout
   cache (`_lyRect`, `_lyGen`), the page canvas (`worldCanvas()` for
   `document.getElementById('pattern-canvas')`), the interface it moves or
   tears (`interfaceTargets()`), and what counts as a control. Export
   `drawBackground`, `resetBackground` and, if it has one, `startOverlay` /
   `stopOverlay`.
2. **Moving the interface goes on `translate`**, not `transform`: the music bar
   and the phone drawer slide on their own transforms, and the two compose.
3. **Register it** in `pages/registry.ts`: who gets it (name and form), the
   accent the whole interface takes (the old `--char-color`), how strongly the
   world shows behind the sheet (the old page canvas opacity), and whether it
   draws its own cursor. The code is a lazy import, so it is downloaded only
   when that character is opened.
4. **The chrome** goes in `pages/<key>/_chrome.scss`, keyed on
   `ss-character-view[data-page='<key>']`, and redrawn in the pixel style
   rather than copied: hard steps instead of soft gradients and glows,
   `scale` / `translate` rather than `transform` in animations.
5. **Touch screens** have no pointer for a cursor to sit on: draw no cursor
   there, but let a tap do what a click does.

`ss-world-canvas` runs it: the background at 30 frames a second (15 on
phones), stopped off screen and in performance mode, and the overlay started
and stopped with the page. An e2e test per page (`tools/ivy_e2e.js` is the
pattern) checks it turns on, that clicks on controls still work, performance
mode, and that leaving the page puts the interface back exactly.

### Driving the OLD site headless (`tools/oldsite.js`)

gstatic.com is blocked in the container, so the helper serves the Firebase SDK
from local npm copies, and it aborts every Firestore write at the network
level so exploring the old site can never change real data. Setup next to it:

    cd rebuild/tools && npm init -y && npm install firebase@10.7.1 firebase-compat-1012@npm:firebase@10.12.0
    (cd ../.. && python3 -m http.server 8765 --bind 127.0.0.1 &)

`tools/shoot.js <file|url> <prefix>` screenshots a page at 1920x1080 and 390x844.
Both use the globally installed Playwright with the pre-installed Chromium.

### Refreshing the sandbox copy (`tools/copy_to_sandbox.py`)

Reads every real collection (GET only) and writes it into the `next_`
collections. Refuses any write path outside `next_`. Run without arguments for
a dry run, with `--write` to copy. It reads the whole database, so it spends
the same daily quota as the live site: run it rarely.
