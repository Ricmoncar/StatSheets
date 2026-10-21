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
- [ ] Design system (waiting on the chosen direction in `rebuild/design/`)
- [~] App shell, routing, sound engine (done); settings (performance mode, FPS cap, volume UI) not yet

## Main app (index.html + script.js core)

- [~] Sidebar: search, folders with shared collapse, drafts (done); drag and drop, right-click menu, chat button not yet
- [x] Character view header: portrait, name, owner, power level, gold, bio, shared form switcher, edit, delete
- [~] Stats: bars, prestige tiers, sub-stats with diffs, SANITY (done); breakdown tooltips, radar chart, power level modal not yet
- [~] Traits: per-form ownership, every interactive trait card, roll overlay with form chooser and auto-roll (replay-tested), codex, roll history, cultivation window (done); per-trait stat tooltips not yet
- [x] Inventory: items, icon picker, image icons, mods, passives, equip, copy and paste
- [x] Gold manager
- [x] Editor: every field, alt forms (12), tags (8), avatar compression, drafts, pattern settings; Gaster easter egg (pattern preview waits for the redesigned patterns)
- [x] Info tab: every profile field (saves as you type, never overwrites text being typed), markdown preview, [[glitch]] affiliations, soundtrack and voice-claim links with YouTube player and MP3 upload
- [x] Music: per-character theme player and mini-player bar (rebuild/tools/music_e2e.js: 20 checks)
- [x] Abilities tab: passives, ability cards with the six types, editor with image, text colour toolbar (rendered as text: the old renderer let HTML through)
- [x] SOUL builder: every layer (fill modes, palettes up to 8, nested soul, outline, shattered, monster, glow, heartbeat, cycle), presets, reset; the SVG is built from validated values only
- [ ] Character chat
- [ ] Compare, tier list, leaderboard, height chart, status roller, suggestion box
- [ ] Generic background patterns, redesigned in pixel art

## Secondary pages

- [ ] Utilities
- [ ] Encyclopaedia
- [ ] Gallery
- [ ] Playlists
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
