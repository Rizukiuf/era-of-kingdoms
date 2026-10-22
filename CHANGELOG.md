# Changelog

All notable changes to Era of Kingdoms. Newest first. Pull request numbers refer to
https://github.com/Rizukiuf/era-of-kingdoms/pulls.

## [Unreleased]

### Added
- **Computer players use monks in battle** (#30, issue #25). From the Castle Age, Normal keeps 2 monks and Hard and
  Hardest keep 4. One collects relics while any are left; the others follow the army, convert valuable enemy units
  in range (unique units, siege, cavalry first, and never a unit another monk is already converting) and heal
  wounded soldiers. Easy still has no monks. Before, computer monks only carried relics and never converted a unit.
- **Color-blind mode and interface size** (#20, issue #8). Two new rows in **Settings**, applied at once in the menu
  and during a game, and remembered. **Color-blind mode** switches the 8 player colors to the Okabe–Ito palette,
  which stays distinguishable with protanopia, deuteranopia and tritanopia (in a simulation, the closest two player
  colors are now 10.9 CIEDE2000 apart instead of 2.3). Health bars go blue → yellow → magenta, good and bad messages
  get a check or a cross, and the other red/green signals (not enough resources, move and attack markers) turn blue
  and magenta. Saves keep their color numbers, so they are not affected. **Interface size** (Small / Normal /
  Large) scales the top bar, the bottom panel, tooltips, objectives, menus and windows, but not the map. Small is
  85 %, Large 120 %, a little less on phones in landscape so the top bar still fits (command buttons grow from 44
  to 48 px on an 844 × 390 phone).
- **Install as an app and play offline** (#19, issue #7). On the website, Chrome and Edge offer **Install** and Safari
  on iPhone/iPad can **Add to Home Screen**; the app opens full screen in landscape with its own icon. After the
  first visit the game starts without an internet connection, installed or in a browser tab (fonts fall back to
  the system fonts offline). A new version downloads in the background and never interrupts a running game: it
  starts with the next launch, or with the **New version available — restart to update** button in the main menu.
  Saves are kept. `index.html` opened from a file works exactly as before.
- **Export and import save files** (#18, issue #6). In the Save/Load window every slot that holds a save, the
  autosave included, has an **Export** button that downloads `era-of-kingdoms-<slot>-<yyyy-mm-dd-hhmm>.json`.
  **Import file** reads such a file into slot 1, 2 or 3 (an occupied slot asks for a second click), so a game can
  move to another browser or device; the slot then shows when the file was exported. The file is checked
  completely before anything is written: a file that is not a save, comes from a newer game version, or is
  damaged is refused with a message and leaves every slot as it was. Works offline and from `file://`.

### Fixed
- **Phones in landscape** (#27, issue #24): on phones 760 px wide or less held sideways, the battlefield had only 13–68 px of
  height left between the top bar and the bottom panel. The bottom panel now stays one row high, as on wider
  screens, so the map keeps about half the screen. For example, 740 × 360 goes from 53 to 180 px and 667 × 375 from 68
  to 195 px, with 40 px command buttons. On every screen 500 px tall or less, the top bar drops the gatherer counts
  and the clock, so it fits next to an iPhone notch. When it still does not fit, it takes a second row instead of
  letting items overlap. Large grows only as far as the HUD fits, notch included. Phones held upright look as before.
- **Computer players no longer stall in the Castle Age, and they use their unique unit** (#29, issue #23).
  - **Villagers:** when a villager cannot go where it is most needed (no room or wood for a farm), it goes to the
    next resource that is short instead of always to wood, so gold no longer runs dry.
  - **Wood for farms:** units leave enough wood in the bank for new farms while food is short.
  - **Monks** no longer spend the gold saved for an age-up.
  - **Saving for the Imperial Age** pauses for 30 s after every 150 s, and the castle keeps up to 8 unique units
    even while saving.
  - **Town bell:** villagers come out at most 60 s after it rings, so a few enemies camping in the base no longer
    stop the whole economy for minutes.

  Over 112 hard-vs-hard matches of 40 minutes, the computer players trained 2,595 unique units instead of 299
  (every civilization 191–445 instead of 3–131), and reached the Imperial Age in 53 of 224 games instead of 43.
- The main menu scrolls when the screen is shorter than the menu (phones in landscape, small laptop windows);
  its top and bottom were cut off before.
- Tooltips stay on screen when they fit neither above nor below their button, and on short screens the message
  feed drops its oldest messages instead of letting the newest slide under the bottom panel.
- Loading a save that cannot be restored now says so in the Save/Load window instead of silently returning to the
  main menu.
- The "Game saved." confirmation stays visible after saving into a slot (the window redrew over it).

### Project and tooling
- The main menu shows **v1.1.0-dev** instead of v1.0.0, so the website, which runs `main`, can be told apart from
  the 1.0.0 release. Exported save files carry the same version.
- New developer tool `tools/balance-report.mjs` (issue #9): plays every 1v1 pairing of the civilizations between
  computer players in parallel worker threads and prints a Markdown report with win rates (95% intervals and a
  head-to-head table), median age-up times, the most effective units (kill value per resource spent) and how the
  matches ended. Deterministic: the same arguments give the same report. It needs only Node.js, collects its unit
  statistics by wrapping game functions inside its VM, and is not part of CI.
- The build also writes `sw.js`, `manifest.webmanifest`, `icon.svg` and `icon-180/192/512.png` from `src/sw.js`,
  `src/manifest.webmanifest` and `src/icon.svg`; it draws the PNG icons itself, byte-identical from `build.mjs`
  and `build.py`. Both builds read sources with `\n` line endings, so a Windows checkout builds the same files.
  CI checks all built files and runs the new `tools/pwa-check.mjs` (install, offline and update test, 9 checks).
- Browser smoke test: 4 new checks (export download, broken files refused, export → delete → import into another
  slot → load, message when a load fails); 19 checks in total.
- Browser smoke test: 2 new checks for the display settings (Large interface size with minimap clicks and tooltips
  that still line up, color-blind mode that redraws the sprites, and switching both back); 21 checks in total.
- Browser smoke test: the farm check no longer fails in about one run out of ten (#22). The test pauses the game at a
  moment that depends on timing, and now and then a villager walking across the new field stood on the point it
  clicked; it now clicks a point of the farm that nothing covers.
- Browser smoke test: a check on a phone in landscape (740 × 360, touch) and upright (390 × 844); 22 checks in total (#27).
- Documentation (#26): README section 10 and AGENTS.md list the known gaps with their issues and point to the Roadmap
  (#17). The feature issue template names all built files, the changelog and the balance report; bug reports ask
  for the game version, how the game was opened and the display settings.

## [1.0.0] — 2026-10-21

First release, tagged `v1.0.0` with a GitHub release.

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
