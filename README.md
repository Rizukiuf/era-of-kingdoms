# Era of Kingdoms

**Play now: https://rizukiuf.github.io/era-of-kingdoms/**

A real-time strategy game in the style of *Age of Empires* that runs entirely in the browser, on desktop and on
phones. Gather resources, build a town, advance through four ages, and defeat computer opponents with
armies, siege engines and fleets.

There is no server, database or third-party library. Graphics are drawn in code with Canvas 2D, and sound
effects and music are synthesized with the Web Audio API. The whole game builds into a single `index.html`
file (about 530 KB) that also works offline.

Version 1.0.0 (first playable release).

---

## Contents

1. [Playing](#1-playing)
2. [Features](#2-features)
3. [Controls](#3-controls)
4. [Hosting your own copy](#4-hosting-your-own-copy)
5. [Project layout](#5-project-layout)
6. [Development](#6-development)
7. [Adding content](#7-adding-content)
8. [Testing](#8-testing)
9. [Contributing and working with AI agents](#9-contributing-and-working-with-ai-agents)
10. [Known limitations and ideas](#10-known-limitations-and-ideas)

---

## 1. Playing

### Online
Open **https://rizukiuf.github.io/era-of-kingdoms/** in a recent Chrome, Edge, Firefox or Safari. This
always runs the latest version of the `main` branch. On a phone, landscape orientation gives the most room.

### Offline
1. Download `index.html` from this repository (or **Code → Download ZIP** and extract it).
2. Double-click `index.html`. The game opens in your browser with no installation and no internet connection.

Notes:
- **Fonts.** When online, the game loads two fonts from Google Fonts. Offline it falls back to the system's
  serif and sans-serif fonts. It looks slightly different and plays the same.
- **Saved games** live in the browser's storage (localStorage), not in files. They exist only in that browser on
  that device, and clearing site data or using a private window removes them.
- Some browsers restrict storage for pages opened straight from a file (`file://`). If saving does not work,
  use a local server (below).

### Local server (optional)
Useful when saving does not work from a file, or to play on a phone over the same Wi-Fi network. Open a
terminal in the project folder and run **one** of:

```bash
python3 -m http.server 8000      # Python 3 (on Windows: py -m http.server 8000)
npx serve .                      # Node.js
```

Then open **http://localhost:8000**. From a phone or tablet on the same Wi-Fi, open
`http://<your-computer's-IP>:8000` (find the IP with `ipconfig` on Windows or `ip addr` / `ifconfig` on
macOS and Linux, for example `192.168.1.5`). If the phone cannot connect, allow Python or Node through the
computer's firewall.

---

## 2. Features

- **8 civilizations**, each with its own bonuses, unique unit, architecture style and musical scale:

  | Civilization | Unique unit | Architecture | Strength |
  |---|---|---|---|
  | Majapahit | Bhayangkara | Nusantara | Maritime economy, rice terraces, elite palace guard |
  | Britons | Longbowman | Western | Archers with the longest range |
  | Franks | Throwing Axeman | Western | Heavy cavalry and strong castles |
  | Mongols | Mangudai | East Asian | Fast horse archers, skilled hunters |
  | Japanese | Samurai | East Asian | Infantry that attacks faster |
  | Ottomans | Janissary | Middle Eastern | Gunpowder units and bombards |
  | Byzantines | Cataphract | Middle Eastern | Strong walls, cheap counter-units, healing monks |
  | Chinese | Chu Ko Nu | East Asian | Larger starting workforce, cheaper research |

- **4 ages** (Dark, Feudal, Castle, Imperial), **40 trainable units** (infantry, archers, cavalry, siege, monks,
  ships), **21 building types**, **71 technologies** and upgrade lines.
- **Combat model** with melee and pierce armor, attack bonuses against unit classes, projectiles that can miss,
  garrisoning, stances, monks that heal and convert, relics and wonders.
- **Skirmish setup:** up to 8 players with optional teams; 5 map types (Continental, Rivers, Coastal, Forest Kingdom,
  Savanna) in 4 sizes; 5 victory conditions (Standard, Conquest, Wonder race, Relics, Time limit); starting
  resources, starting age, map visibility, population limit and peace treaty options.
- **Computer opponents** at 4 difficulty levels (Easy, Normal, Hard, Hardest) that build an economy, research,
  counter your army composition, defend and attack in waves.
- **11-step interactive tutorial**, a how-to-play guide, a tech tree, score screens and statistics at the end.
- **Save and load:** 3 save slots plus an autosave.
- **7 languages:** English, Bahasa Indonesia, Español, Français, Deutsch, Português, 日本語.
- **Touch controls** and a phone layout, alongside mouse and keyboard with hotkeys.

---

## 3. Controls

| Input | Action |
|---|---|
| Left click / drag | Select a unit / select several |
| Right click | Move, gather, attack, build or repair, depending on the target |
| Shift | Queue orders, add to the selection, train 5 units at once |
| Double click / Ctrl+click | Select all units of that type on screen |
| Ctrl+1…9, then 1…9 | Create a control group, recall it (press twice to jump to it) |
| Q W E R T / A S D F G / Z X C V B | Command card buttons |
| A | Attack-move (military units) |
| H | Select the town center |
| . (period) | Next idle villager |
| Space | Jump to the last attack |
| Delete | Delete the selection |
| P / F3 | Pause |
| + / − | Game speed. The speed button in the top bar steps up on click and wraps from 3× back to 1×; right-click steps down |
| Arrow keys / screen edge / middle-button drag | Scroll the map |
| Mouse wheel | Zoom |
| Alt + right click | Garrison units in a building |
| Esc / F10 | Cancel / game menu |

**Selection panel** (bottom of the screen): click an icon in the production queue to cancel it and get the
resources back (the last item of a stack goes first). With several units selected, click a unit's icon to
select only that unit, Shift+click to remove it from the selection, or Ctrl+click to keep only units of that type.

**Touch screens:** tap to select and give orders, drag with one finger to scroll, pinch to zoom, long-press then
drag to box-select. Tap a command button to see its description (it hides after a few seconds). The tutorial
panel can be collapsed with **Hide**; on phones it starts collapsed and shows only the current objective, and
tapping it opens the full list.

---

## 4. Hosting your own copy

The game is a static site: hosting `index.html` is all it needs.

### GitHub Pages
This repository is published with GitHub Pages from the `main` branch. For your own fork:
1. Fork the repository, or create a **public** repository and upload the files (`index.html` must be at the root).
   On free accounts GitHub Pages works only for public repositories.
2. Go to **Settings → Pages**, choose **Source: Deploy from a branch**, branch **main**, folder **/ (root)**, and
   **Save**.
3. After a minute or two the game is at `https://<username>.github.io/<repository>/`. Every push to `main`
   updates it.

### Netlify Drop (no account needed)
1. Open **https://app.netlify.com/drop**.
2. Drag the project folder (or just `index.html`) onto the page.
3. You get an address like `https://random-name.netlify.app`. Create a free account and claim the site to keep it
   and to update it later (**Deploys** tab → drag the new version).

### itch.io
1. Create an account → **Upload new project** → *Kind of project*: **HTML**.
2. Upload `index.html` (a single file is fine) or a zip with `index.html` at the top level, and mark it to be
   played in the browser.
3. *Embed options*: **Click to launch in fullscreen** is recommended because the layout adapts to the screen. For
   *Embed in page*, use at least 1280 × 720 and enable the fullscreen button.
4. Tick **Mobile friendly**, set the visibility to *Public* and save.

### Others
Cloudflare Pages, Vercel, Firebase Hosting or any ordinary web host (cPanel/FTP): upload `index.html` to the
site's public folder.

---

## 5. Project layout

```
era-of-kingdoms/
├── index.html            ← the playable game (generated by the build; do not edit by hand)
├── README.md             ← this document
├── AGENTS.md             ← working instructions for AI coding agents
├── build.py              ← build script (Python 3): concatenates src/ into index.html
├── build.mjs             ← the same build in Node.js; produces an identical file
├── src/                  ← source code: make all changes here
│   ├── shell.html        ← HTML and CSS for menus and HUD
│   ├── data.js           ← game data: units, buildings, technologies, civilizations
│   ├── util.js           ← math helpers, seeded RNG, noise, A* pathfinding, storage helpers
│   ├── i18n_ui.js        ← t()/setLang() and interface text in 7 languages
│   ├── map.js            ← map generator
│   ├── sim.js            ← simulation core
│   ├── cmd.js            ← player and AI commands
│   ├── ai.js             ← computer opponents
│   ├── art_units.js      ← terrain texture and unit drawing
│   ├── art_bld.js        ← buildings, resources and command icons
│   ├── render.js         ← isometric renderer, fog of war, minimap, click picking
│   ├── i18n_game.js      ← names and descriptions of game content, guide, tutorial
│   ├── ui.js             ← menus, HUD, command card, input
│   ├── audio.js          ← synthesized sound effects and generative music
│   └── main.js           ← game lifecycle, main loop, save/load
├── tools/
│   ├── sim-test.mjs      ← headless AI-vs-AI simulation test (needs only Node.js)
│   └── browser-smoke.mjs ← automated test in a real browser (needs Playwright)
└── .github/              ← CI workflow, issue templates, pull request template
```

---

## 6. Development

Make every change in `src/`, then rebuild `index.html`:

```bash
node build.mjs        # Node.js
python3 build.py      # or Python 3 (Windows: py build.py)
```

Reload `index.html` in the browser to see the result, and keep the browser console (F12) open to catch errors.
Commit the regenerated `index.html` together with the source change: GitHub Pages serves that file, and CI fails
if it does not match `src/`.

The files in `src/` are classic scripts that share global variables, so their order matters. It is defined in
`ORDER` in both `build.py` and `build.mjs`; a new file must be added to both.
`python3 build.py --fragment name.html` writes a version without the `<html>`/`<head>` wrapper for embedding in
another page.

### Architecture

| Module | Responsibility |
|---|---|
| `data.js` | Every game number: unit stats (`U`), buildings (`B`), technologies (`T`), civilizations (`CIVS`), gather rates (`GATHER`), unit upgrade lines (`LINES`). |
| `sim.js` | Deterministic simulation with a fixed step of 30 ticks per game second (`STEP`): entities, unit orders (`ORD.*`), economy, combat, technologies (`ST()` returns stats after bonuses), fog of war, victory conditions and score. |
| `cmd.js` | `Cmd.*` is the only way the UI and the AI change the simulation: move, attack, build, train, research, market, tribute, town bell. |
| `ai.js` | `AI.think(p)` runs regularly for each computer player: economy, construction, research, army composition against the enemy, defense, attack waves. Difficulty levels are in `AI_LEVELS`. |
| `render.js` | Isometric camera (64 × 32 tiles), terrain as one large texture, depth sorting, fog, particles, minimap, and picking (what is under the cursor). |
| `art_*.js` | All graphics are drawn with Canvas code and cached as sprites. Units in `UNIT_ART`; buildings in `drawBld()` with 4 architecture styles (`ARCH`: west, nusa, east, mideast). |
| `ui.js` | Menus, skirmish setup, HUD, 5 × 3 command card (hotkeys Q–B), tooltips, mouse/keyboard/touch input, windows (tech tree, scores, end screen), tutorial. |
| `main.js` | `requestAnimationFrame` loop with a fixed-step accumulator, save/load (`serializeGame`/`restoreGame`), the AI battle behind the main menu. |

localStorage keys: `eok.settings`, `eok.setup`, `eok.tutCollapsed`, `eok.save.<slot>` and `eok.meta.<slot>`
(slots `auto`, `1`, `2`, `3`).

---

## 7. Adding content

**New unit**
1. `data.js`: add an entry to `U`, for example
   `elephantArcher: { cls: ['cavalry','archer'], hp: 200, atk: 7, at: 'p', a: [1, 3], rng: 5, rof: 2.5, spd: .8, los: 6, cost: { food: 120, gold: 80 }, time: 35, from: 'castle', age: 2, r: .4, proj: 'arrow', acc: .8, weak: ['spear','monk'] }`.
   Key fields: `at` attack type (`'m'` melee, `'p'` pierce/projectile), `a` armor `[melee, pierce]`, `bonus`
   attack bonus per class (for example `{ cavalry: 15 }`), `rng` range in tiles, `spd` tiles per second.
2. Add it to the building that trains it: `B.<building>.trains`.
3. `art_units.js`: add a drawing style to `UNIT_ART` (helmet, weapon, shield, horse and so on), or set `art:` to
   reuse an existing unit's look.
4. `i18n_game.js`: add the name to `addNames('unit.', { ... })` as
   `'English|Indonesia|Español|Français|Deutsch|Português|日本語'`.

**New technology:** an entry in `T` (`at` building, `age`, `cost`, `time`, `icon`, `req`, `fx`). Effect types for
`fx`: `stat` (change a stat with `add` or `mul`), `gather`, `carry`, `line` (upgrade a unit line), `cost`, `time`,
`build`, `farm`, `pop`, `flag`, `convRes`, `commission`, `tribute`, `elite`. Add its id to `B.<building>.techs` and
its name to `addNames('tech.', ...)`. The command card shows at most 10 buttons per building.

**New civilization:** an entry in `CIVS` (`uu` unique unit, `arch` building style, `music` scale from `SCALES` in
`audio.js`, `fx` bonuses), its unique unit in `U` (with `from: 'castle'` and `elite`), the texts `civ.<id>`,
`civ.<id>.r`, `civ.<id>.d` and `uu.<unit>` in `i18n_game.js`, AI army preferences in `AI_PREF` (`ai.js`) and a
leader name in `AI_NAMES` (`ui.js`).

**New language:** add the language code at the end of `LANG_ORDER` (`i18n_ui.js`) and to `LANGS` (`ui.js`), then add
the translation as an 8th column to every entry in `i18n_ui.js` and `i18n_game.js`. Missing translations fall back
to English.

**New map type:** add the name to `MAP_TYPES` (`map.js`), a terrain branch in `genMap()`, and the name `map.<id>` in
`i18n_ui.js`.

---

## 8. Testing

**Simulation test (no browser, nothing to install).** Plays AI-vs-AI matches with the real game code and prints
progress, age-up times and performance:

```bash
node tools/sim-test.mjs                         # 30 minutes, 2 players
node tools/sim-test.mjs 30 rivers 96 7 majapahit,japanese,ottomans hard,hardest,normal
```

Arguments: minutes, map type, map size in tiles, seed, civilizations, AI levels. Run it after every change to
`data.js`, `sim.js`, `cmd.js`, `ai.js` or `map.js`. `OK: no errors.` at the end means the match ran without a crash.

**Browser smoke test.** Opens `index.html` in headless Chromium and plays it with the real mouse and keyboard:
selecting and ordering villagers, hotkeys, a 15-minute fast-forward, save and load, clicking a unit standing
behind a building, the speed and pause buttons, quitting to the menu and continuing, and the tutorial panel.
It fails on any failed check or page error. One-time setup, then run:

```bash
npm install --no-save playwright@1.56.0
npx playwright install chromium
node build.mjs && node tools/browser-smoke.mjs
```

Screenshots are written to `tools/screenshots/` (ignored by git). `SMOKE_SEED=<text>` changes the map seed.

**Continuous integration.** `.github/workflows/ci.yml` runs the build check, three simulation tests and the browser
smoke test on every push to `main` or a `claude/...` branch, on every pull request, and on demand with
**Run workflow** in the **Actions** tab. Results appear in the Actions tab and as a green check or red cross on
pull requests. Do not merge a pull request whose CI is red.

---

## 9. Contributing and working with AI agents

Changes reach `main` only through pull requests:

1. **Describe the work** in an issue. The templates ask for the goal, the expected behaviour and when it counts
   as done (**Issues → New issue → Feature / change** or **Bug report**).
2. **Make the change on a branch**: `feature/...` or `fix/...` for people, `claude/...` for Claude sessions,
   which cannot push to `main`. Keep one focused change per branch.
3. **Open a pull request.** Its template asks what changed, how it was tested and for screenshots of visual changes.
4. **Wait for CI to pass**, review the change (and try it in the browser for gameplay or UI changes), then merge.
   GitHub Pages updates a minute or two later.

AI coding agents (Claude Code and others) read [`AGENTS.md`](AGENTS.md): the project's rules (edit `src/`, rebuild
`index.html`, no dependencies, every visible string in 7 languages, keep saves loadable), the commands to run and
the definition of done for a pull request. A good request to an agent names the goal, the expected behaviour and
any limits, just like a well-written issue; you can also point the agent at an issue directly.

---

## 10. Known limitations and ideas

- No online multiplayer yet. The simulation is already command-driven and fixed-step, which suits a lockstep
  model over WebSocket.
- No story campaign yet (for example Gajah Mada and the Palapa Oath).
- Graphics are drawn in code rather than by an artist; `art_*.js` could switch to PNG sprite sheets.
- No transport ships or amphibious attacks, and no trade carts between markets.
- Saves stay in the local browser; export/import of save files would allow moving between devices.
- Not yet installable as an app (PWA) or packaged for desktop/Android (Electron, Tauri, Capacitor).

All code, graphics and music were made for this project. The only outside resources are two Google Fonts
(Marcellus SC and Alegreya Sans, SIL Open Font License), loaded from the internet when available.
