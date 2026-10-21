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
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

  // 6c) farms lie flat on the ground: clicking one selects it, and right-clicking it with a villager sends
  //     the villager to farm it
  const farm = await page.evaluate(() => {
    const pl = G.players[G.human], tc = G.blds.find(b => b.owner === G.human && b.type === 'tc');
    let f = null;
    for (let r = 4; r < 14 && !f; r++) for (let dx = -r; dx <= r && !f; dx++) for (const dy of [-r, r]) {
      if (!f && canPlace(pl, 'farm', tc.x + dx, tc.y + dy)) f = spawnBld('farm', G.human, tc.x + dx, tc.y + dy, true);
    }
    if (!f) return null;
    const u = G.units.find(v => v.owner === G.human && v.type === 'villager' && !v.gIn);
    R.centerOn(f.x + f.w / 2, f.y + f.h / 2); R.cam.z = 1.2; UI.paused = true;
    return { id: f.id, v: u.id };
  });
  let farmSel = [], farmOrd = 'no farm placed';
  if (farm) {
    await page.waitForTimeout(300);
    const corner = await page.evaluate(id => { const f = byId(id); return R.toScreen(f.x + .5, f.y + f.h - .5); }, farm.id); // away from any farmer
    await page.mouse.click(corner[0], corner[1]);
    farmSel = await page.evaluate(() => UI.sel.slice());
    await page.evaluate(id => UI.select([id], false), farm.v);
    await page.mouse.click(corner[0], corner[1], { button: 'right' });
    farmOrd = await page.evaluate(id => { const u = byId(id); return u.ord.t + ':' + (u.ord.rtype || ''); }, farm.v);
  }
  await page.evaluate(() => { UI.paused = false; });
  check('click selects a farm, right-click sends a villager to farm it',
    !!farm && farmSel.length === 1 && farmSel[0] === farm.id && farmOrd === 'gather:farm',
    `farm click → ${farmSel.join(',') || 'nothing'}, villager order → ${farmOrd}`);

  // 6d) display settings, through the in-game Settings window: Large interface size and color-blind mode apply at once,
  //     minimap clicks and tooltips still line up with the zoomed HUD, the choice is saved, and Normal / Off restore
  //     the look (the villager sprite and icon are drawn again, pixel for pixel as before)
  const setOpt = (k, v) => page.click(`#modal [data-a="set"][data-k="${k}"][data-v="${v}"]`, { timeout: 5000 });
  const look = () => page.evaluate(() => ({
    btn: Math.round(document.querySelector('#cmdgrid .cb:not(.empty)').getBoundingClientRect().height),
    c1: PCOLORS[1].c, cb1: typeof PCOLORS_CB === 'undefined' ? null : PCOLORS_CB[1].c, spr: unitSprite('villager', 1, 'idle', 0, 0, '', '', 0).c.toDataURL(), icon: iconURL('unit', 'villager', 1),
    cls: document.body.className,
  }));
  let disp = null;
  try {
    await page.evaluate(() => { UI.select([G.blds.find(b => b.owner === G.human && b.type === 'tc').id], false); UI.updateHUD(); });
    const before = await look();
    await page.click('#btnMenu'); await page.click('#modal [data-a="settings"]');
    await setOpt('uiScale', 'large'); await setOpt('cb', 'true');
    await page.click('#modal [data-a="close"]');
    await page.evaluate(() => UI.updateHUD());
    const on = await look();
    const saved = await page.evaluate(() => store('eok.settings'));
    // click the minimap where world point (45%, 55%) is drawn: the camera must center there
    const mini = await page.evaluate(() => {
      const r = document.getElementById('minimap').getBoundingClientRect(), N = G.N, wx = N * .45, wy = N * .55;
      return { x: r.left + r.width / 2 + (wx - wy) * r.width / (2 * N), y: r.top + (wx + wy) * r.height / (2 * N), wx, wy };
    });
    await page.mouse.click(mini.x, mini.y);
    const cam = await page.evaluate(() => [R.cam.x / TW + R.cam.y / TH, R.cam.y / TH - R.cam.x / TW]);
    const miniOff = Math.hypot(cam[0] - mini.wx, cam[1] - mini.wy);
    // the tooltip of the first command button sits right above it
    const bb = await page.locator('#cmdgrid .cb:not(.empty)').first().boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForTimeout(300);
    const tip = await page.locator('#tooltip').boundingBox();
    const tipOk = !!tip && tip.y + tip.height <= bb.y + 1 && tip.y + tip.height >= bb.y - 20 && tip.x <= bb.x + bb.width / 2 && bb.x + bb.width / 2 <= tip.x + tip.width;
    await page.mouse.move(5, 300);
    await page.click('#btnMenu'); await page.click('#modal [data-a="settings"]');
    await setOpt('uiScale', 'normal'); await setOpt('cb', 'false');
    await page.click('#modal [data-a="close"]');
    await page.evaluate(() => UI.updateHUD());
    const off = await look();
    disp = {
      size: `button ${before.btn} → ${on.btn} → ${off.btn}px, minimap click ${miniOff.toFixed(1)} tiles off, tooltip ${tipOk ? 'above the button' : 'misplaced ' + JSON.stringify(tip)}`,
      sizeOk: on.btn >= before.btn * 1.15 && off.btn === before.btn && /ui-zoom/.test(on.cls) && !/ui-zoom/.test(off.cls) && miniOff < 1.5 && tipOk,
      color: `PCOLORS[1] ${before.c1} → ${on.c1} → ${off.c1}, sprite ${on.spr !== before.spr ? 'redrawn' : 'NOT redrawn'} → ${off.spr === before.spr ? 'restored' : 'NOT restored'}, icon ${on.icon !== before.icon && off.icon === before.icon ? 'redrawn and restored' : 'WRONG'}, saved ${JSON.stringify({ cb: saved.cb, uiScale: saved.uiScale })}`,
      colorOk: on.c1 !== before.c1 && on.c1 === on.cb1 && off.c1 === before.c1 && on.spr !== before.spr && off.spr === before.spr
        && on.icon !== before.icon && off.icon === before.icon && saved.cb === true && saved.uiScale === 'large' && /cvd/.test(on.cls) && !/cvd/.test(off.cls),
    };
  } catch (e) { disp = (e && e.message || String(e)).split('\n')[0]; }
  check('interface size Large enlarges the HUD, minimap clicks and tooltips line up, Normal restores it',
    typeof disp === 'object' && disp.sizeOk, typeof disp === 'object' ? disp.size : disp);
  check('color-blind mode swaps the player colors and redraws the sprites, Off restores them, the choice is saved',
    typeof disp === 'object' && disp.colorOk, typeof disp === 'object' ? disp.color : disp);
  if (await page.evaluate(() => !document.getElementById('modal').hidden)) await page.click('#modal [data-a="close"]');

  // 6e) save files, all through the in-game Save/Load window: slot 2 holds an older game, slot 1 the current one
  const game = await page.evaluate(() => {
    saveGame('2');
    for (let i = 0; i < 30 * 20; i++) stepGame();
    saveGame('1');
    const p = G.players[G.human];
    return { u: G.units.length, b: G.blds.length, time: G.time, res: JSON.stringify(p.res) };
  });
  const slotsNow = () => page.evaluate(() => ['1', '2'].map(s => [localStorage.getItem('eok.save.' + s), localStorage.getItem('eok.meta.' + s)]));
  const [slot1, slot2] = await slotsNow();
  await page.click('#btnMenu');
  await page.click('#modal [data-a="saveload"]');
  const fileDir = mkdtempSync(join(tmpdir(), 'eok-smoke-'));
  const pickFile = async file => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click('#modal [data-a="import"]', { timeout: 5000 })]);
    await chooser.setFiles(file);
  };
  const noteIs = (key, params) => page.waitForFunction(([key, params]) => document.getElementById('loadNote')?.textContent === t(key, params), [key, params], { timeout: 5000 }).then(() => true, () => false);
  const note = () => page.evaluate(() => document.getElementById('loadNote')?.textContent || '');

  //   Export on slot 1 downloads the save wrapped in a small header
  let exp = null;
  try {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#modal [data-a="export"][data-s="1"]', { timeout: 5000 })]);
    const file = join(fileDir, dl.suggestedFilename());
    await dl.saveAs(file);
    exp = { name: dl.suggestedFilename(), file, text: readFileSync(file, 'utf8') };
    exp.f = JSON.parse(exp.text);
  } catch (e) { }
  const version = await page.evaluate(() => GAME_VERSION);
  check('Export downloads a save slot as a .json file',
    !!exp && /^era-of-kingdoms-1-\d{4}-\d\d-\d\d-\d{4}\.json$/.test(exp.name) && exp.f.format === 'era-of-kingdoms-save' && exp.f.saveVersion === 1
      && exp.f.gameVersion === version && Math.abs(exp.f.exportedAt - Date.now()) < 10 * 60e3 && JSON.stringify(exp.f.save) === slot1[0],
    exp ? `${exp.name}, ${Math.round(exp.text.length / 1024)} KB` : 'no download');

  //   broken files are refused with a reason, and no slot changes
  const broken = exp ? [
    ['cut-off file', exp.text.slice(0, exp.text.length >> 1), 'pm.importDamaged'],
    ['other JSON', '{"hello":"world"}', 'pm.importBad'],
    ['newer version', JSON.stringify(Object.assign({}, exp.f, { saveVersion: 99, gameVersion: '9.9.9' })), 'pm.importNewer'],
    ['unknown unit type', exp.text.replace('"type":"villager"', '"type":"<img src=x onerror=alert(1)>"'), 'pm.importDamaged'],
  ] : [];
  const refused = [];
  for (const [what, text, key] of broken) {
    try { await pickFile({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(text) }); } catch (e) { refused.push(what + ': no import button'); continue; }
    const shown = await noteIs(key, { v: '9.9.9' }), picking = await page.locator('#modal [data-a="importTo"]').count();
    refused.push(`${what}: ${shown && !picking ? 'refused' : 'NOT refused (' + (await note() || 'no message') + ')'}`);
  }
  const untouched = JSON.stringify(await slotsNow()) === JSON.stringify([slot1, slot2]);
  check('broken save files are refused with a message and change no slot',
    broken.length > 0 && refused.every(r => r.endsWith(': refused')) && untouched,
    `${refused.join(', ') || 'no export file to break'}; slots ${untouched ? 'unchanged' : 'CHANGED'}`);

  //   delete slot 1, import the file into occupied slot 2 (confirm twice) and load it: the same game comes back
  let imp = 'no export file';
  if (exp) {
    try {
      await page.click('#modal [data-a="del"][data-s="1"]'); await page.click('#modal [data-a="del"][data-s="1"]');
      await pickFile(exp.file);
      await page.click('#modal [data-a="importTo"][data-s="2"]', { timeout: 5000 });
      const askFirst = (await page.textContent('#modal [data-a="importTo"][data-s="2"]')) === (await page.evaluate(() => t('pm.confirmReplace')))
        && (await slotsNow())[1][0] === slot2[0];
      await page.click('#modal [data-a="importTo"][data-s="2"]');
      const done = await noteIs('pm.importOk', { n: '2' });
      const [s1, s2] = await slotsNow(), meta = JSON.parse(s2[1] || 'null');
      // capture the game the moment it is restored, before the main loop moves it on
      await page.evaluate(() => {
        const enter = enterLoadedGame;
        window.enterLoadedGame = f => { enter(f); const p = G.players[G.human]; window.__restored = { u: G.units.length, b: G.blds.length, time: G.time, res: JSON.stringify(p.res) }; window.enterLoadedGame = enter; };
      });
      await page.click('#modal [data-a="load"][data-s="2"]');
      await page.waitForFunction(() => UI.screen === 'game' && window.__restored, null, { timeout: 30000 });
      const back = await page.evaluate(() => window.__restored);
      imp = { askFirst, done, slot1Empty: s1[0] === null, slot2IsFile: s2[0] === slot1[0], meta: !!meta && meta.time === game.time && meta.date === exp.f.exportedAt, sameGame: JSON.stringify(back) === JSON.stringify(game) };
    } catch (e) { imp = (e && e.message || String(e)).split('\n')[0]; }
  }
  check('export → delete → import into another slot → load gives the same game',
    typeof imp === 'object' && Object.values(imp).every(Boolean), typeof imp === 'object' ? JSON.stringify(imp) : imp);
  if (await page.evaluate(() => !document.getElementById('modal').hidden)) await page.click('#modal [data-a="close"]');

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

  // 11) a save that passes as a slot but cannot be restored says so instead of silently showing the menu
  await page.evaluate(() => {
    localStorage.setItem('eok.save.3', '{"v":1,"N":80}');
    localStorage.setItem('eok.meta.3', JSON.stringify({ civ: 'franks', map: 'rivers', age: 1, time: 60, date: Date.now() }));
  });
  const errorsBefore = errors.length;
  await page.click('#btnMenu');
  await page.click('#modal [data-a="saveload"]');
  await page.click('#modal [data-a="load"][data-s="3"]');
  const failNote = await page.waitForFunction(() => UI.screen === 'menu' && !document.getElementById('modal').hidden
    && document.getElementById('loadNote')?.textContent === t('pm.loadFail'), null, { timeout: 10000 }).then(() => true, () => false);
  errors.splice(errorsBefore); // the failed restore is logged on purpose
  check('a save that fails to load shows a message', failNote, failNote ? '' : `screen ${await page.evaluate(() => UI.screen)}, note "${await note()}"`);
} catch (e) {
  check('test ran to the end', false, (e && e.message || String(e)).split('\n')[0]);
}

await browser.close();
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\nFAILED: ${failed} of ${results.length} checks` : `\nOK: all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
