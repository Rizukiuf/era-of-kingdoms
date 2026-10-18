#!/usr/bin/env node
// Era of Kingdoms — browser smoke test (optional, needs Playwright).
//
// Opens index.html in headless Chromium, starts a skirmish, plays a few
// commands with the real mouse and keyboard, fast-forwards the match and
// fails if the page throws any error. Screenshots go to tools/screenshots/.
//
// One-time setup (in the project folder):
//   npm init -y
//   npm install --save-dev playwright
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
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });

await page.goto(pathToFileURL(join(ROOT, 'index.html')).href);
await page.waitForTimeout(3000);
await page.screenshot({ path: join(SHOTS, '1-menu.png') });

await page.click('[data-a="skirmish"]');
await page.waitForTimeout(500);
await page.click('[data-a="start"]');
await page.waitForTimeout(3000);

// select all villagers with a drag box, then right-click berries
const pts = await page.evaluate(() => G.units.filter(u => u.owner === G.human && u.type === 'villager').map(u => R.toScreen(u.x, u.y)));
const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
await page.mouse.move(Math.min(...xs) - 25, Math.min(...ys) - 45);
await page.mouse.down();
await page.mouse.move(Math.max(...xs) + 25, Math.max(...ys) + 12, { steps: 8 });
await page.mouse.up();
const berry = await page.evaluate(() => { const v = byId(UI.sel[0]); const r = findNearestRes(v.x, v.y, 'berry', 40, v); return r ? R.toScreen(r.x, r.y) : null; });
if (berry) await page.mouse.click(berry[0], berry[1] - 6, { button: 'right' });
const orders = await page.evaluate(() => UI.sel.map(id => byId(id).ord.t));
// select the town center and queue two villagers with hotkeys
await page.keyboard.press('h');
await page.keyboard.press('q');
await page.keyboard.press('q');
const queued = await page.evaluate(() => G.blds.find(b => b.owner === G.human && b.type === 'tc').q.length);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(SHOTS, '2-early-game.png') });

// fast-forward 15 minutes with the AI playing for the human too
await page.evaluate(() => { const p = G.players[G.human]; p.ai = 'hard'; for (let i = 0; i < 30 * 60 * 15; i++) stepGame(); p.ai = null; });
await page.waitForTimeout(1500);
await page.screenshot({ path: join(SHOTS, '3-after-15-min.png') });

// save and load round trip
const saved = await page.evaluate(() => saveGame('1'));
await page.evaluate(() => loadGame('1'));
await page.waitForTimeout(1500);

await browser.close();
const ok = errors.length === 0 && orders.every(o => o === 'gather') && queued === 2 && saved;
console.log('gather orders:', orders.join(', '));
console.log('villagers queued with H,Q,Q:', queued);
console.log('save worked:', saved);
console.log(errors.length ? 'Page errors:\n' + errors.join('\n') : 'No page errors.');
console.log(ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
