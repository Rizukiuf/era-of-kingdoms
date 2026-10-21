#!/usr/bin/env node
// Era of Kingdoms — balance report (developer tool; no browser, no npm packages).
//
// Plays every 1v1 pairing of the chosen civilizations between computer players, in parallel worker threads,
// and prints a Markdown report: win rates with 95% intervals, a head-to-head matrix, age-up times, the most
// effective units, and how the matches ended. Progress goes to stderr, the report to stdout (and to --out).
//
//   node tools/balance-report.mjs [--games 4] [--minutes 40] [--map continental] [--size 80]
//                                 [--level hard] [--civs all] [--jobs N] [--seed 1] [--out report.md]
//
//   --games    matches per pairing; games 2k and 2k+1 play the same map with the start slots swapped (default 4)
//   --minutes  game minutes before a match is decided by score (default 40)
//   --map      continental|rivers|coastal|forest|savanna (default continental)
//   --size     map size in tiles: 64, 80, 96 or 112 (default 80)
//   --level    AI level of both players: easy|normal|hard|hardest (default hard)
//   --civs     all, or a comma list such as majapahit,britons,franks (default all)
//   --jobs     worker threads (default: CPU cores minus 1)
//   --seed     base seed; every map seed is derived from it (default 1)
//   --out      also write the report to this file
//
// Quick check (about a minute): node tools/balance-report.mjs --games 1 --minutes 25 --civs majapahit,britons,franks
//
// The same arguments give the same report, apart from the CPU time line: the simulation is deterministic, every
// match runs in a fresh VM context, and the results are sorted before they are counted. Unit statistics are
// collected here, by wrapping damage(), spawnTrained() and convertUnit() inside the VM; src/ is not changed.
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// the same files and order as SIM_ORDER in tools/sim-test.mjs
const SIM_ORDER = ['data', 'util', 'i18n_ui', 'map', 'sim', 'cmd', 'ai'];
const source = names => names.map(n => readFileSync(join(ROOT, 'src', n + '.js'), 'utf8').replace(/^'use strict';/, '')).join('\n');
// anything the game logs goes to stderr, so it never mixes with the report on stdout
const quiet = { log: (...a) => console.error(...a), warn: (...a) => console.error(...a), error: (...a) => console.error(...a), info() { }, debug() { } };

// ------------------------------------------------------------
// Worker: plays one match per message, each in a fresh VM context
// ------------------------------------------------------------
const MATCH = `
;globalThis.__match = function (opt) {
  const S = {};
  const rec = (pid, type) => S[pid + '|' + type] || (S[pid + '|' + type] = { pid, type, trained: 0, spent: 0, dmg: 0, kills: 0, razed: 0, conv: 0, killV: 0 });
  const sum = c => (c.food || 0) + (c.wood || 0) + (c.gold || 0) + (c.stone || 0);
  // damage dealt to enemy units and buildings, and what it killed, credited to the attacker's type
  // (a projectile whose shooter is gone passes a stand-in that keeps the type)
  const damage0 = damage;
  damage = function (t, dmg, src) {
    const hp = t.hp, was = t.dead;
    damage0(t, dmg, src);
    const so = src ? src.owner : -1;
    if (was || t.k === 'r' || !src || !src.type || so < 0 || t.owner < 0 || t.owner === so) return;
    const r = rec(so, src.type);
    r.dmg += Math.max(0, hp - Math.max(0, t.hp));
    if (t.dead) { if (t.k === 'u') r.kills++; else r.razed++; r.killV += unitValue(t.type); }
  };
  const spawnTrained0 = spawnTrained;
  spawnTrained = function (b, type) {
    const u = spawnTrained0(b, type);
    if (u) { const r = rec(b.owner, type); r.trained++; r.spent += sum(ST(b.owner, type).cost || {}); }
    return u;
  };
  // only monks convert; a converted unit counts like a kill of its value
  const convertUnit0 = convertUnit;
  convertUnit = function (t, owner) { const v = unitValue(t.type); convertUnit0(t, owner); const r = rec(owner, 'monk'); r.conv++; r.killV += v; };

  newGame({ N: opt.size, mapType: opt.map, seed: opt.seed, startRes: 'std', popCap: 200, victory: 'standard', reveal: 'normal',
    players: opt.civs.map((c, i) => ({ name: c, civ: c, color: i, team: 0, ai: opt.level })) });
  const steps = Math.round(opt.minutes * 60 / STEP), t0 = performance.now();
  for (let i = 0; i < steps && !G.over; i++) stepGame();
  const ms = performance.now() - t0;
  const score = G.players.map(p => calcScore(p).total);
  let winner = -1, how;
  if (G.over) {
    winner = G.winner === 'none' ? -1 : +G.winner.slice(1);
    const wonder = Object.values(G.wonders).some(w => w.owner === winner && w.t <= 0);
    how = winner < 0 ? 'draw' : wonder ? 'wonder' : G.relicHold && G.relicHold.t <= 0 ? 'relics' : 'conquest';
  } else {
    winner = score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1;
    how = winner < 0 ? 'draw' : 'score';
  }
  return { winner, how, time: G.time, ms, score, ageT: G.players.map(p => p.st.ageT.slice(1)), stats: Object.values(S) };
};`;

function worker() {
  const script = new vm.Script(source(SIM_ORDER) + MATCH, { filename: 'era-of-kingdoms-sim.js' });
  parentPort.on('message', job => {
    try {
      const ctx = vm.createContext({ console: quiet, Math, Date, performance });
      script.runInContext(ctx);
      parentPort.postMessage(Object.assign({ id: job.id }, ctx.__match(job)));
    } catch (e) { parentPort.postMessage({ id: job.id, error: String(e && e.stack || e) }); }
  });
}

// ------------------------------------------------------------
// Main thread: schedule, collect, report
// ------------------------------------------------------------
async function main() {
  // game data and English names for the report
  const meta = vm.createContext({ console: quiet, Math, Date, performance });
  vm.runInContext(source(SIM_ORDER.concat('i18n_game')), meta);
  const D = vm.runInContext('({ CIV_IDS, CIVS, U, B, LINES, AI_LEVELS, MAP_TYPES, MAP_SIZES, name: k => t(k) })', meta);
  const opt = parseArgs(process.argv.slice(2), D);
  const unitName = type => D.name(D.U[type] ? 'unit.' + type : 'bld.' + type);
  const civName = c => D.name('civ.' + c);

  // every pairing, --games times; games 2k and 2k+1 share a map and swap the start slots
  const jobs = [];
  for (let a = 0; a < opt.civs.length; a++) for (let b = a + 1; b < opt.civs.length; b++) {
    for (let g = 0; g < opt.games; g++) {
      const pair = [opt.civs[a], opt.civs[b]], k = g >> 1;
      jobs.push({ id: jobs.length, k, civs: g % 2 ? [pair[1], pair[0]] : pair, seed: deriveSeed(opt.seed, pair, k),
        minutes: opt.minutes, map: opt.map, size: opt.size, level: opt.level });
    }
  }
  const threads = Math.min(opt.jobs, jobs.length), w = String(jobs.length).length;
  console.error(`Balance report: ${opt.civs.length} civilizations, ${jobs.length / opt.games} pairings × ${opt.games} games = ${jobs.length} matches ` +
    `of ${opt.minutes} min on ${opt.map} ${opt.size}, AI ${opt.level}, ${threads} worker threads`);

  const results = [], errors = [], t0 = Date.now();
  let next = 0, done = 0;
  await new Promise(allDone => {
    let running = threads;
    const feed = wk => { if (next < jobs.length) wk.postMessage(jobs[next++]); else wk.terminate(); };
    for (let i = 0; i < threads; i++) {
      const wk = new Worker(fileURLToPath(import.meta.url));
      wk.on('message', r => {
        const j = jobs[r.id], n = `[${String(++done).padStart(w)}/${jobs.length}] ${civName(j.civs[0])} vs ${civName(j.civs[1])}, map ${j.k + 1}`;
        if (r.error) { errors.push(`match ${r.id} (${j.civs.join(' vs ')}, seed ${j.seed}): ${r.error}`); console.error(`${n}: ERROR`); }
        else {
          results[r.id] = r;
          const won = r.winner < 0 ? 'draw' : civName(j.civs[r.winner]);
          console.error(`${n}: ${won} by ${r.how}${r.how === 'score' || r.how === 'draw' ? ' ' + r.score.join(':') : ''} at ${fmtMin(r.time)}  (${(r.ms / 1000).toFixed(1)} s)`);
        }
        feed(wk);
      });
      wk.on('error', e => { errors.push(String(e && e.stack || e)); });
      wk.on('exit', () => { if (--running === 0) allDone(); });
      feed(wk);
    }
  });
  console.error(`Done in ${Math.round((Date.now() - t0) / 1000)} s.\n`);

  const report = buildReport(opt, jobs, results.filter(Boolean), D, unitName, civName);
  process.stdout.write(report);
  if (opt.out) { writeFileSync(resolve(opt.out), report); console.error(`Report written to ${resolve(opt.out)}`); }
  if (errors.length) { console.error(`\nFAILED: ${errors.length} matches threw errors:\n` + errors.join('\n')); process.exitCode = 1; }
}

function parseArgs(argv, D) {
  const o = { games: 4, minutes: 40, map: 'continental', size: 80, level: 'hard', civs: 'all', jobs: Math.max(1, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 1), seed: 1, out: '' };
  const fail = msg => { console.error(`${msg}\nRun with --help for the options.`); process.exit(2); };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^#!.*\n/, '').replace(/^\/\/ ?/gm, ''));
      process.exit(0);
    }
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m || !(m[1] in o)) fail(`Unknown argument: ${argv[i]}`);
    const v = m[2] != null ? m[2] : argv[++i];
    if (v == null) fail(`Missing value for --${m[1]}`);
    o[m[1]] = typeof o[m[1]] === 'number' ? Number(v) : v;
  }
  const sizes = Object.values(D.MAP_SIZES), levels = Object.keys(D.AI_LEVELS).filter(l => l !== 'passive');
  if (!Number.isInteger(o.games) || o.games < 1) fail('--games must be a whole number, at least 1');
  if (!(o.minutes > 0)) fail('--minutes must be more than 0');
  if (!D.MAP_TYPES.includes(o.map)) fail(`--map must be one of ${D.MAP_TYPES.join(', ')}`);
  if (!sizes.includes(o.size)) fail(`--size must be one of ${sizes.join(', ')}`);
  if (!levels.includes(o.level)) fail(`--level must be one of ${levels.join(', ')}`);
  if (!Number.isInteger(o.jobs) || o.jobs < 1) fail('--jobs must be a whole number, at least 1');
  if (!Number.isInteger(o.seed)) fail('--seed must be a whole number');
  // always explicit civilizations: makePlayer() resolves 'random' with Math.random(), which is not repeatable
  o.civs = o.civs === 'all' ? D.CIV_IDS.slice() : [...new Set(o.civs.split(',').map(s => s.trim()).filter(Boolean))];
  const bad = o.civs.filter(c => !D.CIV_IDS.includes(c));
  if (bad.length) fail(`Unknown civilization: ${bad.join(', ')}. Choose from ${D.CIV_IDS.join(', ')}`);
  if (o.civs.length < 2) fail('--civs needs at least two civilizations');
  return o;
}

// FNV-1a over the base seed, the pairing and the map number: a pairing plays the same maps whichever other
// civilizations are in the run
function deriveSeed(seed, pair, k) {
  let h = 2166136261;
  for (const ch of `${seed}|${pair.join('|')}|${k}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 1000000000;
}

// ------------------------------------------------------------
// Report
// ------------------------------------------------------------
const fmtMin = s => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = x => Math.round(x * 100) + '%';
const num = x => Math.round(x).toLocaleString('en-US');
// Wilson score interval: wide on small samples, so 3 wins in 4 games does not read as a sure 75%
function wilson(w, n) {
  const z = 1.96, p = w / n, d = 1 + z * z / n, c = p + z * z / (2 * n), e = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - e) / d), Math.min(1, (c + e) / d)];
}
// Markdown table; right: per column, true for right-aligned numbers
const table = (head, rows, right) => [head, head.map((_, i) => right[i] ? '---:' : '---'), ...rows].map(r => '| ' + r.join(' | ') + ' |').join('\n');

function buildReport(opt, jobs, res, D, unitName, civName) {
  const civs = opt.civs, out = [];
  out.push('# Era of Kingdoms balance report',
    `${res.length} matches: ${civs.length} civilizations, every pairing ${opt.games}× (start slots swapped on each map), ` +
    `${opt.minutes} minutes on ${opt.map} ${opt.size}×${opt.size}, both players AI "${opt.level}", standard victory.\n` +
    `Arguments: \`--games ${opt.games} --minutes ${opt.minutes} --map ${opt.map} --size ${opt.size} --level ${opt.level} --civs ${civs.join(',')} --seed ${opt.seed}\``);

  // 1. win rates and head to head; a draw counts half for each side
  const W = {}, N = {}, H = {};
  for (const c of civs) { W[c] = 0; N[c] = 0; H[c] = {}; for (const d of civs) H[c][d] = [0, 0]; }
  for (const r of res) {
    const [a, b] = jobs[r.id].civs, wa = r.winner === 0 ? 1 : r.winner === 1 ? 0 : .5;
    W[a] += wa; W[b] += 1 - wa; N[a]++; N[b]++;
    H[a][b][0] += wa; H[a][b][1]++; H[b][a][0] += 1 - wa; H[b][a][1]++;
  }
  const rate = c => N[c] ? W[c] / N[c] : 0;
  const byWin = civs.slice().sort((x, y) => rate(y) - rate(x) || civs.indexOf(x) - civs.indexOf(y));
  out.push('## 1. Win rate',
    table(['Civilization', 'Wins', 'Games', 'Win rate', '95% interval'], byWin.map(c => {
      const [lo, hi] = N[c] ? wilson(W[c], N[c]) : [0, 1];
      return [civName(c), String(W[c]), String(N[c]), pct(rate(c)), `${pct(lo)}–${pct(hi)}`];
    }), [0, 1, 1, 1, 1]),
    `With ${N[civs[0]]} games per civilization, win rates whose intervals overlap can differ by chance alone.`,
    '**Head to head:** wins of the row civilization against the column civilization (a draw counts ½).',
    table(['', ...byWin.map(civName)], byWin.map(c => [`**${civName(c)}**`, ...byWin.map(d => c === d ? '—' : `${H[c][d][0]}/${H[c][d][1]}`)]), [0, ...byWin.map(() => 1)]));

  // 2. age-up times
  const ageRow = c => [civName(c), ...[0, 1, 2].map(a => {
    const ts = [];
    for (const r of res) jobs[r.id].civs.forEach((x, i) => { if (x === c && r.ageT[i][a] != null) ts.push(r.ageT[i][a] / 60); });
    return ts.length ? `${median(ts).toFixed(1)} (${ts.length}/${N[c]})` : `— (0/${N[c]})`;
  })];
  out.push('## 2. Age-up times', 'Median game minute of reaching each age, over the matches where it was reached (reached / games).',
    table(['Civilization', 'Feudal', 'Castle', 'Imperial'], byWin.map(ageRow), [0, 1, 1, 1]));

  // 3. units; upgrade lines are combined because an upgrade turns the units in the field into the next type
  const line = {};
  for (const l in D.LINES) for (const t of D.LINES[l]) line[t] = l;
  const uu = new Set(civs.map(c => D.CIVS[c].uu));
  const add = (m, k, s) => { const r = m[k] || (m[k] = { trained: 0, spent: 0, dmg: 0, kills: 0, razed: 0, conv: 0, killV: 0 }); for (const f in r) r[f] += s[f]; };
  const units = {}, unique = {}, blds = {};
  for (const r of res) for (const s of r.stats) {
    if (!D.U[s.type]) { add(blds, s.type, s); continue; }
    if (uu.has(s.type)) add(unique, jobs[r.id].civs[s.pid] + '|' + s.type, s);
    add(units, line[s.type] ? 'line:' + line[s.type] : s.type, s);
  }
  const eff = s => s.spent ? s.killV / s.spent : -1;
  const byEff = (a, b) => eff(b[1]) - eff(a[1]) || b[1].killV - a[1].killV || (a[0] < b[0] ? -1 : 1);
  const kills = s => num(s.kills) + (s.razed ? ` + ${num(s.razed)} bld` : '') + (s.conv ? ` + ${num(s.conv)} conv` : '');
  const unitRow = (name, s) => [name, num(s.trained), num(s.spent), num(s.dmg), kills(s), num(s.killV), s.spent ? eff(s).toFixed(2) : '—'];
  const head = ['Unit', 'Trained', 'Resources spent', 'Damage dealt', 'Kills', 'Kill value', 'Kill value / cost'];
  const lineName = members => `${unitName(members[0])} line (${members.slice(1).map(unitName).join(', ')})`;
  out.push('## 3. Most effective units',
    'All civilizations together, sorted by kill value / cost. **Kill value** is the resource cost of the enemy units and buildings a unit ' +
    'killed; a monk\'s conversions count with the cost of the converted unit. Upgrade lines are combined, because an upgrade turns the ' +
    'units already in the field into the next type. Damage to animals is not counted. Units that start the game were not trained, ' +
    'so a type with only those has no ratio ("—").',
    table(head, Object.entries(units).sort(byEff).map(([k, s]) => unitRow(k.startsWith('line:') ? lineName(D.LINES[k.slice(5)]) : unitName(k), s)), [0, 1, 1, 1, 1, 1, 1]),
    '**Unique units** per civilization:',
    Object.keys(unique).length
      ? table(['Civilization', ...head], Object.entries(unique).sort(byEff).map(([k, s]) => [civName(k.split('|')[0]), ...unitRow(unitName(k.split('|')[1]), s)]), [0, 0, 1, 1, 1, 1, 1, 1])
      : '_None was trained: unique units come from the castle, in the Castle Age._');
  if (Object.keys(blds).length) {
    out.push('**Buildings that shoot** (towers, castles and town centers, including the arrows of their garrison):',
      table(['Building', 'Damage dealt', 'Kills', 'Kill value'], Object.entries(blds).sort((a, b) => b[1].killV - a[1].killV || (a[0] < b[0] ? -1 : 1))
        .map(([k, s]) => [unitName(k), num(s.dmg), kills(s), num(s.killV)]), [0, 1, 1, 1]));
  }

  // 4. matches
  const how = {};
  for (const r of res) how[r.how] = (how[r.how] || 0) + 1;
  const lens = res.map(r => r.time / 60), gameS = res.reduce((s, r) => s + r.time, 0), ms = res.reduce((s, r) => s + r.ms, 0);
  const ends = { conquest: 'conquest', wonder: 'wonder', relics: 'relics', score: `by score at ${opt.minutes} min`, draw: 'draw (equal score)' };
  out.push('## 4. Matches',
    `- Length: median ${median(lens).toFixed(1)} min, shortest ${Math.min(...lens).toFixed(1)}, longest ${Math.max(...lens).toFixed(1)}.\n` +
    `- Ended: ${Object.keys(ends).filter(k => how[k]).map(k => `${ends[k]} ${how[k]}×`).join(', ')}.\n` +
    `- CPU time: ${(ms / gameS).toFixed(1)} ms per game second (wall clock inside the worker threads; changes from run to run).`);
  return out.join('\n\n') + '\n';
}

if (isMainThread) await main(); else worker();
