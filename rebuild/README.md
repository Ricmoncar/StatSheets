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

### Building a character page (phase 2)

Each custom page is remade from scratch in the pixel style, one at a time:
the same idea as the old page (`CHARACTER_PAGES.md` at the root describes
them, and `script.js` / `style.css` still hold the old code to look at), but
drawn anew rather than copied. Everything lives in `web/src/app/pages/`;
`ivy-evil/` is the worked example.

1. **Pixels only, through a palette.** `pages/raster.ts` is the toolkit: a
   `Raster` holds palette indices (0 is clear) and draws with whole-pixel
   primitives (lines, ovals, polygons, lit tubes, sprites from strings,
   outlines, ordered dither); a `Screen` shows it on a canvas through a
   colour table. Drains, darkness and flashes are edits to that table, not
   redraws. Everything is drawn at art resolution (`artPx()` from
   `pages/host.ts`: 3 CSS pixels to an art pixel, 2 on phones) and scaled up
   pixelated, so the page's pixels are the interface's.
2. **Three files per page.** `look.ts`: the palette in ramps (with the
   lighter / darker neighbour of every colour, for shading), the sprites, and
   one clock that both layers keep time by (heartbeat, scheduled events, the
   colour table for the frame). A background file (Ivy's `hall.ts`): bakes
   everything that never moves into layers once per size, and per frame
   copies them and adds only what moves. An overlay file (Ivy's `blade.ts`):
   whatever the page draws over the whole window, the cursor, and anything
   it does to the interface.
3. **Keep frames cheap**, because a phone feels every one:
   - bake what does not move; keep a light's or a shape's pixels the first
     time it is drawn at a size, and reuse them wherever it moves;
   - split the overlay into small canvases shown again only when they change
     (corners, edge strips, the cursor moved with a CSS transform), and draw
     the full-window layer only while something is on it;
   - on phones (`SMALL` in `host.ts`) the overlay draws in the background's
     frames (the page module calls it from `drawBackground`), 15 a second;
   - never run a CSS animation of a layout property (height, width, top) on
     the sheet: it repaints the page every frame. Step it from the page's own
     frames with an attribute instead (Ivy's blood drop, `data-drip`);
   - restyle as few elements as possible: put a flag class on the two
     elements that flare, not on the sheet; give the blocks you move
     `will-change: translate` in the chrome; leave blocks that are out of
     sight where they are.
   `tools/page_perf.js` is how to tell: main thread busy against an ordinary
   sheet, on a desktop and on a phone at 4x CPU.
4. **Moving the interface goes on `translate`**, not `transform` (the music
   bar and the phone drawer slide on their own transforms, and the two
   compose), always in whole art pixels. `interfaceTargets()` lists what a
   page may move or tear; `isInteractive()` says what is a control, and a
   click on a control must stay a click.
5. **Register it** in `pages/registry.ts`: who gets it (name and form), the
   accent the whole interface takes, how strongly the world shows behind the
   sheet, and whether it draws its own cursor. The module is a lazy import
   exporting `drawBackground`, `resetBackground` and, if it has one,
   `startOverlay` / `stopOverlay`, so it is downloaded only when that
   character is opened.
6. **The chrome** goes in `pages/<key>/_chrome.scss`, keyed on
   `ss-character-view[data-page='<key>']`: hard steps instead of soft
   gradients and glows. A sprite the chrome needs (a frame, a rose) can be
   drawn by the page with its own palette and handed over as a CSS variable.
7. **Touch screens** have no pointer for a cursor to sit on: draw no cursor
   there, but let a tap do what a click does.

`ss-world-canvas` runs it: the background at 30 frames a second (15 on
phones), stopped off screen and in performance mode, and the overlay started
and stopped with the page.

**The kit** (`pages/kit/`) is what most pages are built from: `palette()`
(named ramps, darkest first, with `shift` along a ramp and `near` for a
colour the old code used), `paint.ts` (dithered gradients, glows, tints,
vignettes, stars, the old pages' kind of hash, a 3x5 pixel font for words in
the world), `sceneModule()` (a Scene with `size`, `draw` and `colours`
becomes the module the world canvas runs), `PageOverlay` (the full-window
layer: pointer, clicks, a cursor layer of its own, and `force(name)` for
tests; its root is `#pg-<key>`) and the `chrome()` mixin (the sheet in six
of the page's colours, with the page's own touches in its content block).
`pages/bizzy-bees/` is the plainest example.

**To remake an old page**: `tools/old_page_ref.js <dir> <key>` opens it on
the old site against the emulator and saves a screenshot, the background on
its own, and the opacity and colour it set. Its code is in `script.js`
(the `_draw...Pattern` function, its overlay and its chrome toggle) and
`style.css` (its `-ui`, `-name`, `-pfp` blocks). `tools/pages_e2e.js [dir]
[key...]` checks every page made so far the same way: it opens on its page,
the world is drawn at art resolution and moves, its overlay is up,
performance mode stops and restarts them, leaving puts everything back, and
a phone shows it; `tools/fixtures/pages_map.json` (from `old_pages_map.js`)
says whose page is whose. A page with more to it (events, cuts through the
interface) also gets a test of its own, as `tools/ivy_e2e.js` does.

### The old site against the emulator (`tools/oldlocal.js`)

To look at an old page as often as needed without spending the live
project's read quota: seed the emulator with the old collection names too
(`OLD_SITE=1 node seed_emulator.js <snapshot-dir> fixtures`), serve the repo
root on :8765, and open pages with `openOldLocal()`. It points the old
site's Firestore at the emulator and aborts writes (the Encyclopaedia's own
named app included). `tools/old_pages_map.js` lists which character and form
gets which custom page on the old site. `tools/encyclopedia_e2e.js` uses it to
hold the new Encyclopaedia's indexes against the old page's, and to check the
old page reads what the new one writes.

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
