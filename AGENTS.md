# AGENTS.md — instructions for AI coding agents

> Working instructions for AI coding agents (Claude Code and other agents that read AGENTS.md).
> The guide for people is README.md.

Era of Kingdoms is a real-time strategy game in the style of Age of Empires, written in plain JavaScript.
It runs entirely in the browser: no framework, no npm dependencies, no server. Graphics are drawn with Canvas 2D
and audio is synthesized with the Web Audio API. `build.py` / `build.mjs` concatenate `src/` into one `index.html`.

## Golden rules

1. **Edit `src/`, never `index.html` by hand.** `index.html` is generated. After changing anything in `src/`, run
   `node build.mjs` (or `python3 build.py`) and commit the regenerated `index.html` in the same commit.
   GitHub Pages serves `index.html`, and CI fails when it is out of date.
2. **No external dependencies.** No libraries, CDNs, image files or network calls. The only external resource is
   Google Fonts, which must keep working offline through the CSS fallback stacks.
3. **Every player-visible string goes through `t('key')`.** Add the text in all 7 languages, in this order:
   en, id, es, fr, de, pt, ja (`i18n_ui.js` for interface text, `i18n_game.js` for game content). If you cannot
   translate reliably, use English for that language and say so in the PR description.
4. **Simulation state changes only through the simulation.** Game time advances only in `stepGame()` with the
   fixed `STEP` (1/30 s). UI and AI change the world through `Cmd.*` in `cmd.js`. Inside `sim.js`, `ai.js` and
   `map.js`, use the seeded `rnd()` / `Rng`, not `Math.random()` (rendering code may use `Math.random()`).
5. **Keep saves loadable.** `serializeGame()` stores units, buildings and resources as JSON. New entity fields must
   be plain JSON values (no functions, Maps or object references) and need a sensible default when an older save
   lacks them (see `restoreGame()` and `rebuildIndex()`).
6. **Global-script style.** Every `src/*.js` file is a classic script sharing globals, loaded in the order of
   `ORDER` in `build.py` and `build.mjs`. A new file must be added to both lists, and to `SIM_ORDER` in
   `tools/sim-test.mjs` if the simulation needs it.
7. **Performance budget.** `node tools/sim-test.mjs 40 forest 112 4242 majapahit,japanese,ottomans,chinese,byzantines,mongols hard,hardest,hard,hardest,hard,hardest`
   should stay under about 100 ms CPU per game second.

## Commands

| Task | Command |
|---|---|
| Build `index.html` | `node build.mjs` or `python3 build.py` |
| Headless simulation test (run before every commit that touches `data`, `sim`, `cmd`, `ai` or `map`) | `node tools/sim-test.mjs 30` and `node tools/sim-test.mjs 30 rivers 96 7 majapahit,japanese,ottomans hard,hardest,normal` — both must end with `OK: no errors.` |
| Browser smoke test (one-time setup: `npm install --no-save playwright@1.56.0 && npx playwright install chromium`) | `node tools/browser-smoke.mjs` — must end with `OK: all … checks passed` |
| Play | open `index.html` in a browser |

There is no linter or formatter. Match the surrounding style: 2-space indent, single quotes, semicolons,
compact functions.

## Architecture

| File | Role |
|---|---|
| `src/data.js` | All game numbers: units `U`, buildings `B`, technologies `T`, civilizations `CIVS`, upgrade lines `LINES`, gather rates `GATHER`. |
| `src/util.js` | Math helpers, seeded `Rng`, value noise, binary heap, A* pathfinding (`PF`), localStorage helpers (`store`). |
| `src/map.js` | `genMap(G)`: terrain, water, player starts, fair resource placement, forests, relics, wildlife. |
| `src/sim.js` | Simulation core. Global state `G`. Entities have `k`: `'u'` unit, `'b'` building, `'r'` resource. `ST(owner, type)` returns effective stats after civ bonuses and techs. Unit behaviour lives in `ORD.<order>` handlers. Combat, projectiles, fog of war, victory and score are here too. |
| `src/cmd.js` | `Cmd.*`: the only entry points for player and AI actions (move, attack, gather, build, train, research, market, tribute, town bell). `placeBld()` and `canPlace()` handle construction. |
| `src/ai.js` | `AI.think(p)` runs every 15 ticks per computer player: economy, construction, research, army composition, defense, attack waves. Difficulty in `AI_LEVELS`; build plan in `AI_BUILD`; civ preferences in `AI_PREF`. |
| `src/art_units.js` | Terrain texture (`buildTerrain`), unit drawing (`UNIT_ART`, `drawHuman`, `drawHorse`, `drawSiege`, `drawShip`, `drawAnimal`), sprite cache. |
| `src/art_bld.js` | Building drawing per architecture style (`ARCH`: west, nusa, east, mideast) in `drawBld()`, trees and resources, command-card icons (`iconURL`, `glyph`). |
| `src/render.js` | Renderer `R`: isometric camera (64×32 tiles), depth sorting, fog, particles, minimap, picking. |
| `src/i18n_ui.js` / `src/i18n_game.js` | `t()`, `setLang()`, translation tables. |
| `src/ui.js` | `UI`: menus, skirmish setup, HUD, 5×3 command card with hotkeys, tooltips, mouse/keyboard/touch input, tech tree, scores, end screen, tutorial objectives (`TUT`). |
| `src/audio.js` | `Audio2`: synthesized sound effects and generative music per civilization scale. |
| `src/main.js` | Lifecycle, fixed-step main loop, save/load, attract-mode battle behind the main menu. |
| `src/shell.html` | Markup and CSS for menus and HUD. |

## Where common changes go

- Balance: numbers in `data.js`; AI behaviour constants at the top of `ai.js`. Verify with the sim test
  (age-up times and kills are printed at the end).
- New unit, technology, civilization, language or map: follow README section 7 (Adding content).
- Documentation, comments, commit messages and PR descriptions are written in English. Player-visible text is translated (rule 3).
- Visual change: `art_units.js` / `art_bld.js`. Sprites are cached by key; include every parameter that changes
  the drawing in the cache key.
- HUD or menu change: `ui.js` plus CSS in `shell.html`. Check the 760 px mobile breakpoint.

## Definition of done for a pull request

- One focused change per PR, on its own branch. Claude sessions push to `claude/...` branches (they cannot push to `main`); humans can use `feature/...` or `fix/...`. Changes reach `main` only through a reviewed pull request.
- `node build.mjs` run and `index.html` committed.
- Sim tests pass; for UI changes, the browser smoke test passes or you describe how you tested in a browser.
- New text translated in all 7 languages (or flagged in the PR).
- README / AGENTS.md updated when commands, structure, controls or behaviour change.
- PR description: what changed, why, how it was tested, screenshots for visual changes, open questions.

## Known gaps (candidate tasks)

Export/import of save files · transport ships and amphibious attacks · trade carts between markets ·
installable PWA for offline play · story campaign (Gajah Mada / Sumpah Palapa) · balance report across
civilizations · online multiplayer (lockstep over WebSocket; the simulation is already command-driven and fixed-step).
