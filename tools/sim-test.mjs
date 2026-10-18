#!/usr/bin/env node
// Era of Kingdoms — headless simulation test (no browser, no npm packages).
//
// Runs computer players against each other using the real game code and prints
// progress, age-up times and performance. Use it after changing data.js, sim.js
// or ai.js to catch crashes and balance problems quickly.
//
//   node tools/sim-test.mjs [minutes] [map] [size] [seed] [civs] [levels]
//
//   minutes  game minutes to simulate            (default 30)
//   map      continental|rivers|coastal|forest|savanna   (default continental)
//   size     64 | 80 | 96 | 112                   (default 80)
//   seed     any integer                          (default 1234)
//   civs     comma list, e.g. majapahit,franks    (default majapahit,britons)
//   levels   comma list of AI levels, e.g. hard,normal   (default hard,hard)
//
// Example: node tools/sim-test.mjs 40 rivers 96 7 majapahit,japanese,ottomans hard,hardest,normal
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIM_ORDER = ['data', 'util', 'i18n_ui', 'map', 'sim', 'cmd', 'ai'];
const code = SIM_ORDER.map(n => readFileSync(join(ROOT, 'src', n + '.js'), 'utf8').replace(/^'use strict';/, '')).join('\n');

const [minutes = '30', mapType = 'continental', size = '80', seed = '1234', civArg = 'majapahit,britons', lvlArg = 'hard,hard'] = process.argv.slice(2);
const civs = civArg.split(','), levels = lvlArg.split(',');

const ctx = vm.createContext({ console, btoa, atob, Math, Date, performance });
vm.runInContext(code + `
;globalThis.runTest = function (opt) {
  const cfg = { N: opt.N, mapType: opt.map, seed: opt.seed, startRes: 'std', popCap: 200, victory: 'standard', reveal: 'normal',
    players: opt.civs.map((c, i) => ({ name: c, civ: c, color: i, team: 0, ai: opt.levels[i] || 'hard' })) };
  newGame(cfg);
  const t0 = Date.now();
  const steps = Math.round(opt.minutes * 60 / STEP);
  for (let i = 1; i <= steps; i++) {
    stepGame();
    if (i % Math.round(60 * 5 / STEP) === 0 || i === steps) {
      console.log(fmtTime(G.time).padStart(5), G.players.map(p =>
        (p.civ.slice(0, 8) + ':').padEnd(10) + 'age ' + p.age + ' vil ' + String(p.vil).padStart(2) + ' army ' + String(p.mil).padStart(3) +
        ' pop ' + String(p.pop).padStart(3) + '/' + String(p.cap).padStart(3) + (p.alive ? '' : ' DEFEATED')).join('  |  '));
    }
    if (G.over) { console.log('Game over at ' + fmtTime(G.time) + ', winner: ' + G.winner); break; }
  }
  console.log('\\nAge-up times (min):');
  for (const p of G.players) console.log('  ' + p.civ.padEnd(11) + p.st.ageT.slice(1).map(t => t == null ? '  -' : String(Math.round(t / 60)).padStart(3)).join(' ') +
    '   kills ' + p.st.killsU + '   score ' + calcScore(p).total);
  console.log('\\nPerformance: ' + ((Date.now() - t0) / G.time).toFixed(1) + ' ms CPU per game second, ' + G.units.length + ' units, ' + G.blds.length + ' buildings at the end');
};`, ctx);

try {
  ctx.runTest({ minutes: +minutes, map: mapType, N: +size, seed: +seed, civs, levels });
  console.log('\nOK: no errors.');
} catch (e) {
  console.error('\nFAILED:', e && e.stack || e);
  process.exit(1);
}
