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
- [x] Traits: per-form ownership, every interactive trait card, roll overlay with form chooser and auto-roll (replay-tested), codex, roll history, cultivation window, per-trait stat tooltips (parity-tested against 224 live tooltips)
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
- [ ] Encyclopaedia
- [x] Gallery: character cards with server-counted picture badges, upload by picking or dropping (compressed to fit a document), rename, delete, lightbox with arrow keys (rebuild/tools/gallery_e2e.js)
- [x] Playlists: every character's playlist with cover, title and description edited in place, MP3 uploads, reordering by dragging or the keyboard, and a player bar with shuffle, repeat, seek, volume and mute; playback follows the playlist it started in (rebuild/tools/playlists_e2e.js)
- [ ] Spin a Baddie
- [ ] BK's Corner
- [ ] Admin
- [ ] sq.html, test.html (find out if still used)

## Phase 2

- [ ] Custom character pages, and the features that live inside them
  (Nara's shared paint canvas, Sel's shooting star counter, games, scoreboards)

## Cutover

- [ ] `/next/` preview on `main` (built with base href `/StatSheets/next/`)
- [ ] Live build (`environment.live.ts`, real collections) and GitHub Pages
      switched to build from GitHub Actions
- [ ] Redirect stubs for old page URLs (`utilities.html` and so on)
