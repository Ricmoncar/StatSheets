# STATSHEETS

An Undertale-inspired retro character manager for tabletop games, OC tracking, and worldbuilding. Built with vanilla HTML/CSS/JS — no frameworks, no install.

**Live site:** https://ricmoncar.github.io/StatSheets/

---

## Features

### Characters
- Create, edit, and delete characters
- Custom avatar image upload
- Custom accent color with 16 presets
- Bio text field
- 10 animated background patterns per character, each fully configurable:
  - Animated Checkerboard, Scrolling Lines, Matrix Rain, Bouncing Diamonds
  - Pulse Rings, Static Noise, Falling Pixels, Scan Wave, Animated Crosshatch, Heartbeat/ECG

### Stats & Sub-stats
- Core stats: HP, ATK, DEF, MAG, SPD (with animated segment bars)
- Sub-stats: Crit Rate, Crit DMG, Heal Power, Status Resistance, Dexterity, Resilience, True DMG, Lifesteal, Cooldown Reduction
- Power Level reference chart

### Inventory System
- Add items with names, descriptions, icons (80+ emoji options), and custom images
- Item stat modifiers (add, multiply, divide) applied to any stat or sub-stat
- Equip/unequip items — stats update live with animated diffs

### Trait System
- Roll a hand of 3 traits per roll — pick one to keep
- 6 rarity tiers: Common, Rare, Epic, Legendary, Mythic, Hexxed
- 80+ unique traits across all rarities, each with passive and active effects
- **Pity system** — every roll builds pity; at 100 pity you get a guaranteed Legendary+ roll
  - Hexxed resets pity to 0 / Mythic reduces by 80 / Legendary reduces by 40
- **Trait Codex** — tracks every trait you've discovered
- **Cultivation** — scaling traits that grow stronger over time

### Treasury
- Per-character gold balance displayed next to their name
- Add or remove gold with optional notes
- Full transaction history (last 200 entries) with timestamps and running balance
- Gold cannot go below 0

### Real-Time Sync
- All character data is stored in Firebase Firestore
- Changes sync live across all open tabs and devices — no refresh needed
- Anyone with the link can view and edit characters simultaneously

### Sound Effects
- Full interactive audio across the entire site: clicks, hovers, equips, saves, deletes, character switches, trait rolls, rarity reveals, dice rolls, and more
- Pitch variation on click and hover sounds for a more natural feel
- Secret: name a character **Gaster** for a surprise

### Utilities Page
- **Dice Roller** — animated 3D cube, cinematic roll, highlights max/min results
- **Crit Calculator** — roll crit chance with configurable crit damage multiplier
- **Stat Checker** — standalone simulator to test stat formulas

### Settings
- Canvas animation FPS cap (15 / 30 / 60 / unlimited / off)
- Toggle rarity chip animations on/off for performance

---

## Tech
- Vanilla HTML, CSS, JavaScript — no build step, no dependencies
- Firebase Firestore for real-time cloud sync
- Press Start 2P font (Google Fonts)
- Deployed via GitHub Pages
