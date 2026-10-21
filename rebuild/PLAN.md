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
- [ ] App shell, routing, sound engine, settings (performance mode, FPS cap, volume)

## Main app (index.html + script.js core)

- [ ] Sidebar: search, folders (shared collapse state, order), drag and drop, right-click menu
- [ ] Character view header: portrait, name, owner, level, gold, tags, forms
- [ ] Stats tab: bars, sub-stats, breakdown tooltips, radar chart, power level modal
- [ ] Traits: per-form ownership, trait widgets (situational triggers, duality, determination, perfect soul, cultivation stacks...), codex, roll overlay with auto-roll
- [ ] Inventory: items, icon picker, image icons, mods, equip
- [ ] Gold manager
- [ ] Editor: every field, alt forms, tags, avatar upload and compression
- [ ] Info tab: profile fields, media links, voice claims, theme song
- [ ] Music: per-character theme player and mini-player bar
- [ ] Abilities tab
- [ ] SOUL builder
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
