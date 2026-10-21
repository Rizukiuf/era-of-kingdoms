# Changelog

All notable changes to Era of Kingdoms. Newest first. Pull request numbers refer to
https://github.com/Rizukiuf/era-of-kingdoms/pulls.

## [Unreleased]

### Added
- **Export and import save files** (#18, issue #6). In the Save/Load window every slot that holds a save, the
  autosave included, has an **Export** button that downloads `era-of-kingdoms-<slot>-<yyyy-mm-dd-hhmm>.json`.
  **Import file** reads such a file into slot 1, 2 or 3 (an occupied slot asks for a second click), so a game can
  move to another browser or device; the slot then shows when the file was exported. The file is checked
  completely before anything is written: a file that is not a save, comes from a newer game version, or is
  damaged is refused with a message and leaves every slot as it was. Works offline and from `file://`.

### Fixed
- Loading a save that cannot be restored now says so in the Save/Load window instead of silently returning to the
  main menu.
- The "Game saved." confirmation stays visible after saving into a slot (the window redrew over it).

### Project and tooling
- Browser smoke test: 4 new checks (export download, broken files refused, export → delete → import into another
  slot → load, message when a load fails); 19 checks in total.

## [1.0.0] — not yet tagged

First release. Everything below is on `main`; the `v1.0.0` tag and GitHub release have not been created yet.

### Fixed since the first prototype (found in playtesting)
- **Farms are clickable** (#4). Farms are drawn flat on the ground and were missing from the click hit list, so
  they could not be selected and right-clicking an empty farm with villagers only walked them there.
  `R.pick` now falls back to the farm on the tile under the cursor.
- **Buildings are clicked only where they are drawn** (#2). The click area was the whole sprite rectangle above
  the footprint (about 2.4× the visible town center), which hid units standing north or west of buildings.
  Buildings are now hit on their footprint or on an opaque pixel of their sprite.
- **PAUSED text no longer blocks clicks** (#2) on the map underneath it while paused.
- **HUD buttons register every click** (#1). The pause icon was replaced on every HUD refresh, so clicks were
  dropped (about 5 in 40 worked). The selection panel is no longer rebuilt while pressed.
- **Selection panel buttons work** (#1): clicking a production queue icon cancels it with a refund; clicking a unit
  icon in a group selection selects it (Shift removes it, Ctrl keeps that type).
- **Speed button wraps** 1× → 1.5× → 2× → 3× → 1× (#1); right-click steps down.
- **No stale PAUSED overlay** after quitting to the menu and continuing (#1); loading always starts unpaused.
- **Tutorial panel can be hidden** (#1); it starts collapsed on phones and remembers the choice.
- Opening the tech tree, scores or settings no longer unpauses a manually paused game (#1).
- Edge scrolling works at the top and bottom of the screen (#1).
- Touch tooltips on command buttons hide after a few seconds (#1).
- Destroying the bandit camp ends the tutorial even if earlier objectives were skipped (#1).

### Project and tooling
- Documentation, issue and pull request templates in English (#3); `AGENTS.md` for AI coding agents.
- CI on every push to `main` or `claude/**` and on every pull request: build check, three AI-vs-AI simulations,
  and a browser smoke test (15 checks, including a regression check for each bug above).
- Published with GitHub Pages: https://rizukiuf.github.io/era-of-kingdoms/

### First prototype
- Real-time strategy in the browser: 8 civilizations, 4 ages, 40 trainable units, 21 building types,
  71 technologies, 5 map types, 5 victory conditions, AI at 4 difficulty levels, an 11-step tutorial,
  save/load, 7 languages, touch controls. Single `index.html`, no dependencies.
