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

  // 6b) a villager standing just north of (behind) the town center can still be clicked,
  //     and clicking the town center's roof still selects the town center
  const behindPt = await page.evaluate(() => {
    const tc = G.blds.find(b => b.owner === G.human && b.type === 'tc');
    const u = G.units.find(v => v.owner === G.human && v.type === 'villager' && !v.gIn);
    u.x = u.px = tc.x + tc.w / 2; u.y = u.py = tc.y - .9; u.ord = { t: 'idle' }; u.path = null;
    R.centerOn(tc.x + 2, tc.y + 1); R.cam.z = 1.2; UI.paused = true;
    return { id: u.id, tc: tc.id };
  });
  await page.waitForTimeout(300);
  const vPt = await page.evaluate(id => { const u = byId(id); const [x, y] = R.toScreen(u.x, u.y); return [x, y - 9 * R.cam.z]; }, behindPt.id); // the villager's body
  if (vPt) await page.mouse.click(vPt[0], vPt[1]);
  const pickedV = await page.evaluate(() => UI.sel.slice());
  const roofPt = await page.evaluate(id => { const b = byId(id); const [x, y] = R.toScreen(b.x + b.w / 2, b.y + b.h / 2); return [x, y - 50 * R.cam.z]; }, behindPt.tc);
  await page.mouse.click(roofPt[0], roofPt[1]);
  const pickedTc = await page.evaluate(() => UI.sel.slice());
  await page.evaluate(() => { UI.paused = false; });
  check('villager behind the town center is clickable, roof still selects the town center',
    !!vPt && pickedV.length === 1 && pickedV[0] === behindPt.id && pickedTc.length === 1 && pickedTc[0] === behindPt.tc,
    `villager ${behindPt.id} click → ${pickedV.join(',') || 'nothing'}, town center ${behindPt.tc} roof click → ${pickedTc.join(',') || 'nothing'}`);

  // 7) the speed button cycles 1× → 1.5× → 2× → 3× and wraps back to 1×
  const speeds = [];
  for (let i = 0; i < 5; i++) { await page.click('#btnSpeed'); speeds.push(await page.evaluate(() => UI.speed)); }
  check('speed button wraps from 3× back to 1×', speeds.includes(3) && speeds[speeds.indexOf(3) + 1] === 1, speeds.join(' → '));

  // 8) pause, quit to the main menu, Continue: the game runs and no PAUSE badge is left over
  await page.evaluate(() => { UI.speed = 1; saveGame('auto'); });
  await page.keyboard.press('p');
  const pausedBadge = await page.evaluate(() => UI.paused && !!document.getElementById('pausebadge'));
  await page.click('#btnMenu');
  await page.click('#modal [data-a="quit"]');
  await page.click('#modal [data-a="quit"]');
  await page.waitForFunction(() => UI.screen === 'menu', null, { timeout: 30000 });
  await page.click('[data-a="continue"]');
  await page.waitForFunction(() => UI.screen === 'game' && !G.cfg.attract, null, { timeout: 30000 });
  const t0 = await page.evaluate(() => G.time);
  await page.waitForTimeout(1000);
  const resumed = await page.evaluate(t0 => ({ paused: UI.paused, badge: !!document.getElementById('pausebadge'), ran: G.time > t0 }), t0);
  await page.click('#btnPause');
  const repaused = await page.evaluate(() => UI.paused && !!document.getElementById('pausebadge'));
  await page.click('#btnPause');
  check('no stale PAUSE after quit → Continue, pause button still works',
    pausedBadge && !resumed.paused && !resumed.badge && resumed.ran && repaused,
    `paused before quit: ${pausedBadge}, after continue: ${JSON.stringify(resumed)}, pause button: ${repaused}`);

  // 9) every click on the pause button registers while the game runs (the HUD refreshes many times a second)
  const pb = await page.locator('#btnPause').boundingBox();
  let toggled = 0;
  for (let i = 0; i < 20; i++) {
    const was = await page.evaluate(() => UI.paused);
    await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await page.mouse.down(); await page.waitForTimeout(60 + (i * 37) % 180); await page.mouse.up();
    if ((await page.evaluate(() => UI.paused)) !== was) toggled++;
  }
  check('pause button registers every click', toggled === 20, `${toggled}/20 clicks`);

  // 10) the tutorial panel can be hidden and shown again
  await page.evaluate(() => { try { localStorage.removeItem('eok.tutCollapsed'); } catch (e) { } startTutorial(); });
  await page.waitForFunction(() => UI.screen === 'game' && G.cfg.tutorial && !document.getElementById('objectives').hidden, null, { timeout: 30000 });
  const tutH = () => page.evaluate(() => Math.round(document.getElementById('objectives').getBoundingClientRect().height));
  const hOpen = await tutH();
  await page.click('#objectives [data-a="tut-toggle"]');
  const hHidden = await tutH();
  await page.click('#objectives [data-a="tut-toggle"]');
  const hBack = await tutH();
  check('tutorial panel can be hidden and shown', hHidden < hOpen / 2 && hBack === hOpen, `height ${hOpen} → ${hHidden} → ${hBack}px`);
} catch (e) {
  check('test ran to the end', false, (e && e.message || String(e)).split('\n')[0]);
}

await browser.close();
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\nFAILED: ${failed} of ${results.length} checks` : `\nOK: all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
