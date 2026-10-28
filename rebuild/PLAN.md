# Rebuild plan and progress

How each area is done: read the old code for it once, write down what it does
(rules, limits, sounds, saved fields), port it, and check it against the old
site running side by side. Pure logic is checked number for number against
the old code on live data wherever possible (see `*.parity.spec.ts`).

Status: `[x]` done and checked, `[~]` in progress, `[ ]` not started.

## Foundations

- [x] Angular 22 app in `web/`, sandbox (`next_`) database copy, tooling
- [x] Data layer: live listener, field-level diff, three-way merge, `_rev` transaction (port of `saveData`)
- [x] Effective stats (items, traits, derived sub-stats): matches the old site on 212 live form cases
- [x] Trait rolls, odds, pity, fortune: identical hands to the old site on 400 seeded rolls
- [x] Stat bars and prestige tiers, power levels, accent presets, gold transactions
- [x] Design system: THE UNDERGROUND (`rebuild/design/`). The pixel engine in `core/pixel/` (palette, OKLCH accent ramps, sprites, 9-slice frames, textures, icons) paints everything to CSS variables at start-up, the accent follows the open character, and the `u-` building blocks in `styles.scss` (plus `ui/_underground.scss` mixins) are used across every ported screen. Seven generic patterns are drawn as animated scenes (`core/pixel/scenes.ts`)
- [x] App shell, routing, sound engine, PERF mode (shared `perf_mode` key), SFX volume panel (the old site had no FPS setting)

## Main app (index.html + script.js core)

- [x] Sidebar: search, folders with shared collapse, drafts, new/edit/delete folder, drag and drop of characters and folders (one batched write), right-click menu with edit/duplicate/delete/move (rebuild/tools/sidebar_e2e.js, 16 checks), chat button
- [x] Character view header: portrait, name, owner, power level, gold, bio, shared form switcher, edit, delete
- [x] Stats: bars, prestige tiers, sub-stats with diffs, SANITY, breakdown tooltips (parity-tested), radar chart, power level window (rebuild/tools/stats_e2e.js)
- [x] Traits: per-form ownership, every interactive trait card, roll overlay with form chooser and auto-roll (replay-tested), dealt face down with the old page's reels turning through trait names and slowing to land, a high card's tell, pixel bursts, rings and rays by rarity, and the card taken rising as the others fall away (rebuild/tools/roll_e2e.js), codex, roll history, cultivation window, per-trait stat tooltips (parity-tested against 224 live tooltips)
- [x] Inventory: items, icon picker, image icons, mods, passives, equip, copy and paste
- [x] Gold manager
- [x] Editor: every field, alt forms (12), tags (8), avatar compression, drafts, pattern settings with a live preview and the faint full-screen pattern behind; Gaster easter egg
- [x] Info tab: every profile field (saves as you type, never overwrites text being typed), markdown preview, [[glitch]] affiliations, soundtrack and voice-claim links with YouTube player and MP3 upload
- [x] Music: per-character theme player and mini-player bar (rebuild/tools/music_e2e.js: 20 checks)
- [x] Abilities tab: passives, ability cards with the six types, editor with image, text colour toolbar (rendered as text: the old renderer let HTML through)
- [x] SOUL builder: every layer (fill modes, palettes up to 8, nested soul, outline, shattered, monster, glow, heartbeat, cycle), presets, reset; the SVG is built from validated values only
- [x] Character chat: per-sender inbox, live, arrayUnion sends (rebuild/tools/chat_e2e.js)
- [x] Compare, tier list, leaderboard, height chart, status roller, suggestion box
- [x] Generic background patterns, redesigned in pixel art (all 15, old settings kept; rebuild/tools/patterns_shot.js), and the STYLE tab. Bouncing diamonds, falling pixels, scrolling lines, matrix rain, checkerboard, heartbeat and pulse rings now show the Underground scenes (wishing room, leaffall, waterfall, snowfall, puzzle floor, core pulse, echo ripples), keeping colour, count, speed and opacity

## Secondary pages

- [x] Utilities: dice roller, crit calculator, stat checker, status roller (pixel status orbs), trait and general suggestion boxes, shared tier lists, stat leaderboard in five views, compatibility tester (rebuild/tools/utilities_e2e.js), height chart (rebuild/tools/heightchart_e2e.js), game worlds: NO MORE TIME, ASYM HORROR, AUT, LOL, CRTL (rebuild/tools/games_e2e.js)
- [x] Encyclopaedia: ported in the pixel style at `/encyclopedia` (features/encyclopedia): the codex with the index on the left page and the entry on the right, a bookmark per section; characters and items from the characters, places, statuses (folders, dragged into order), chapters with their scenes and NPCs written to enc/data as the old page wrote it, each write a transaction so an edit made meanwhile elsewhere is kept; every index lists what the old page lists, in its order, and the old page reads what this one writes (rebuild/tools/encyclopedia_e2e.js)
- [x] Gallery: character cards with server-counted picture badges, upload by picking or dropping (compressed to fit a document), rename, delete, lightbox with arrow keys (rebuild/tools/gallery_e2e.js)
- [x] Playlists: every character's playlist with cover, title and description edited in place, MP3 uploads, reordering by dragging or the keyboard, and a player bar with shuffle, repeat, seek, volume and mute; playback follows the playlist it started in (rebuild/tools/playlists_e2e.js)
- [x] Spin a Baddie: ported in the pixel style at `/baddie` (features/baddie): every tab and rule of baddie.html, the same save keys in the browser (an old save loads as it is), the old drawings of dice, eggs and pets reduced to pixel sprites, themes as pixel backdrops (rebuild/tools/baddie_e2e.js)
- [x] BK's Corner: art requests (filters, create with characters and references, complete, finished art, more references, delete) and the shared board that mirrors linked pictures into character galleries; the rose cursor kept as pixel art (rebuild/tools/bkscorner_e2e.js)
- [x] Admin: the old password gate (remembered for the session), trait editor with three-way merged saves, quick stat override, rename, give / remove / nuke / wipe for every character (a batch that fails is retried one character at a time, and the ones that still fail are named), overview table (rebuild/tools/admin_e2e.js)
- [x] sq.html, test.html: left as they are. Nothing links to them (sq.html is a hidden code-gated page; test.html is a GIF generator whose gifs and fonts collections are empty); they keep working at their own addresses

## Phase 2

- [~] Custom character pages, and the features that live inside them
  (Nara's shared paint canvas, Sel's shooting star counter, games, scoreboards).
  Each page is remade from scratch in the pixel style, case by case: see "Building a
  character page" in README.md.
  - [x] Ivy · EVIL creature (the test page), remade: a ruined rococo ballroom behind the
        sheet (rose window and moon, red chandelier that drips into a pool, mirror, piano,
        candles, moonlight), eight events (lunge, bleed, sweep, bloom, hunger, waltz,
        shatter, mirror), the rapier cursor, cuts through the interface, the heartbeat
        shoving the sheet, thorned portrait and lacquer chrome (rebuild/tools/ivy_e2e.js)
  - [x] The kit every page is built from (pages/kit) and one test for them all
        (rebuild/tools/pages_e2e.js); the old page as reference (rebuild/tools/old_page_ref.js)
  - [x] Bizzy: the hive (pulsing comb, honey cells, light shafts, drips, seven bees on the
        old flights, pollen), the bee cursor with its trail and orbiting swarm, petal and
        pollen bursts, two workers loose over the sheet, comb panels and a honey name
  - [x] Riegen · Phoenix: the burning sky and the phoenix, the feather cursor and its embers
  - [x] Fury: the fire hall (five fire channels, lava floor, banners, the footfall and the
        roar), the chip cursor, eruptions, burning corners and vines, lava chrome
  - [x] Sorrow: Fury's fire drained grey and pouring down, the googly-eyed doner wrap
  - [x] Juko! · Code Garden, base and 0∞ on one page: code rain with tickers, snippets,
        bokeh and light bands moving to her song; Juko the cat following the pointer; a
        ring of streaming code round every panel; the equalizer under the sheet; the
        song driving the chrome's glow. 0∞: the 22-second intro vignette, the corrupted
        rain, static, tears and tracking bar, the boom at the drop, the swaying border,
        the kick, the corrupted windows, ∞ stats (rebuild/tools/juko_e2e.js)
  - [x] Juko · 1, the void: the prism (the one light) with its rings, spokes and shafts
        through the span overhead, the field of digits coming at you and resolving to 1,
        chains of digits, the wreck of the garden, debris going past, seven events
        (comet, eclipse, garden, cascade, constellation, wingbeat, zero); over the
        window the far field, the arms of digits, sparks and the spectrum fringe; her
        curved sword (dark steel with rainbow borders, an eye cut through it, a spiked guard,
        a gem, a wrapped grip and a prism pommel) as the pointer's companion

## Cutover

- [~] `/next/` preview: `rebuild/tools/build_next.sh` builds it into `next/` (base href `/StatSheets/next/`, addresses after `#/` so a reload works on Pages); live once `next/` is on `main`
- [ ] Live build (`environment.live.ts`, real collections) and GitHub Pages
      switched to build from GitHub Actions
- [ ] Redirect stubs for old page URLs (`utilities.html` and so on), but NOT for the pages kept as they are: sq.html, test.html, and encyclopedia.html and baddie.html stay served too (old bookmarks, and its saves live in this origin either way), which must stay served along with the files they load (encyclopedia.js, traits.js, style.css, gifshot.min.js, sounds/, baddies/)
