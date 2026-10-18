#!/usr/bin/env node
// Era of Kingdoms — browser smoke test (optional, needs Playwright).
//
// Opens index.html in headless Chromium, starts a skirmish on a fixed map seed,
// plays a few commands with the real mouse and keyboard, fast-forwards the
// match, saves and loads, and fails if any check fails or the page throws.
// Screenshots go to tools/screenshots/.
//
// One-time setup (in the project folder):
//   npm install --no-save playwright
//   npx playwright install chromium
// Run:
//   node build.mjs && node tools/browser-smoke.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'tools', 'screenshots');
const SEED = process.env.SMOKE_SEED || 'smoke-test';
const IN_CI = !!process.env.GITHUB_ACTIONS;
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok && IN_CI) console.log(`::error title=Browser smoke test::${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });

try {
  await page.goto(pathToFileURL(join(ROOT, 'index.html')).href);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.screen === 'menu', null, { timeout: 30000 });
  await page.screenshot({ path: join(SHOTS, '1-menu.png') });
  check('main menu loads', true);

  // skirmish with a fixed map seed so every run sees the same start
  await page.click('[data-a="skirmish"]');
  await page.fill('[data-k="seed"]', SEED);
  await page.click('[data-a="start"]');
  await page.waitForFunction(() => UI.screen === 'game' && G && !G.cfg.attract, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  check('skirmish starts', true, 'seed ' + SEED);

  // helper in the page: a screen point where clicking hits exactly this entity
  await page.evaluate(() => {
    window.__pointOn = id => {
      const e = byId(id); if (!e) return null;
      const [x, y] = R.toScreen(e.x, e.y);
      for (const dy of [-14, -10, -18, -6, -22, -2]) for (const dx of [0, 3, -3, 6, -6]) {
        if (R.pick(x + dx, y + dy) === e) return [x + dx, y + dy];
      }
      return null;
    };
  });

  // 1) click one villager, shift-click the others
  const vilIds = await page.evaluate(() => G.units.filter(u => u.owner === G.human && u.type === 'villager').map(u => u.id));
  for (let i = 0; i < vilIds.length; i++) {
    const pt = await page.evaluate(id => window.__pointOn(id), vilIds[i]);
    if (!pt) continue;
    if (i === 0) await page.mouse.click(pt[0], pt[1]);
    else { await page.keyboard.down('Shift'); await page.mouse.click(pt[0], pt[1]); await page.keyboard.up('Shift'); }
  }
  const sel = await page.evaluate(() => UI.sel.map(id => byId(id).type));
  check('click + shift-click selects the villagers', sel.length === vilIds.length && sel.every(t => t === 'villager'), `selected: ${sel.join(', ') || 'nothing'}`);

  // 2) right-click a berry bush -> villagers gather
  const berryPt = await page.evaluate(() => {
    const v = byId(UI.sel[0]);
    const bushes = G.ress.filter(r => r.type === 'berry' && !r.dead).sort((a, b) => dist(a.x, a.y, v.x, v.y) - dist(b.x, b.y, v.x, v.y));
    for (const r of bushes) {
      const [x, y] = R.toScreen(r.x, r.y);
      if (x < 20 || y < 60 || x > R.W - 20 || y > R.H - 200) continue;
      for (const dy of [-8, -5, -11, -3]) for (const dx of [0, 4, -4]) if (R.pick(x + dx, y + dy) === r) return [x + dx, y + dy];
    }
    return null;
  });
  if (berryPt) await page.mouse.click(berryPt[0], berryPt[1], { button: 'right' });
  const orders = await page.evaluate(() => UI.sel.map(id => byId(id).ord.t + ':' + (byId(id).ord.rtype || '')));
  check('right-click on berries gives a gather order', !!berryPt && orders.length > 0 && orders.every(o => o === 'gather:berry'), berryPt ? orders.join(', ') : 'no clickable berry bush on screen');

  // 3) drag-box selection picks own units
  const box = await page.evaluate(ids => ids.map(id => R.toScreen(byId(id).x, byId(id).y)), vilIds);
  const xs = box.map(p => p[0]), ys = box.map(p => p[1]);
  await page.mouse.move(Math.min(...xs) - 20, Math.min(...ys) - 40);
  await page.mouse.down();
  await page.mouse.move(Math.max(...xs) + 20, Math.max(...ys) + 10, { steps: 8 });
  await page.mouse.up();
  const boxSel = await page.evaluate(() => UI.sel.map(id => byId(id)).filter(Boolean).map(e => e.owner === G.human && e.k === 'u'));
  check('drag-box selects own units', boxSel.length > 0 && boxSel.every(Boolean), `${boxSel.length} selected`);

  // 4) hotkeys: H selects the town center, Q twice queues two villagers
  await page.keyboard.press('h');
  await page.keyboard.press('q');
  await page.keyboard.press('q');
  const queued = await page.evaluate(() => G.blds.find(b => b.owner === G.human && b.type === 'tc').q.length);
  check('H, Q, Q queues two villagers', queued === 2, `queue length ${queued}`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(SHOTS, '2-early-game.png') });

  // 5) fast-forward 15 minutes with the AI also playing for the human
  const after = await page.evaluate(() => {
    const p = G.players[G.human]; p.ai = 'hard';
    for (let i = 0; i < 30 * 60 * 15; i++) stepGame();
    p.ai = null;
    return { time: Math.round(G.time), vil: p.vil, age: p.age };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOTS, '3-after-15-min.png') });
  check('15-minute fast-forward runs', after.time >= 900 && after.vil > 10, `time ${after.time}s, villagers ${after.vil}, age ${after.age}`);

  // 6) save and load round trip
  const before = await page.evaluate(() => ({ u: G.units.length, b: G.blds.length }));
  const saved = await page.evaluate(() => saveGame('1'));
  await page.evaluate(() => loadGame('1'));
  await page.waitForFunction(() => UI.screen === 'game', null, { timeout: 30000 });
  const loaded = await page.evaluate(() => ({ u: G.units.length, b: G.blds.length }));
  check('save and load round trip', saved && Math.abs(loaded.u - before.u) <= 3 && Math.abs(loaded.b - before.b) <= 2, `before ${JSON.stringify(before)}, after ${JSON.stringify(loaded)}`);
} catch (e) {
  check('test ran to the end', false, (e && e.message || String(e)).split('\n')[0]);
}

await browser.close();
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\nFAILED: ${failed} of ${results.length} checks` : `\nOK: all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
