#!/usr/bin/env node
// Era of Kingdoms — installable app and offline check (needs Playwright, like browser-smoke.mjs).
//
// Serves a copy of the built files under a sub-path, as GitHub Pages does (/era-of-kingdoms/), from a small
// node:http server with GitHub Pages' 10-minute HTTP cache, and checks in headless Chromium that:
//   - index.html alone, opened from file://, has no manifest link and no console errors
//   - over http the manifest loads without errors and Chromium reports no installability errors
//   - the service worker caches every file of the app
//   - with the network off and the server not answering, a reload still reaches the main menu
//   - a new deploy downloads in the background without reloading a running game; the main menu then offers
//     the update, and pressing it loads the new version, deletes the old cache and keeps the saves
//
// One-time setup: see browser-smoke.mjs. Run:
//   node build.mjs && node tools/pwa-check.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN_CI = !!process.env.GITHUB_ACTIONS;
const FILES = ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', webmanifest: 'application/manifest+json', svg: 'image/svg+xml', png: 'image/png' };
const PREFIX = '/era-of-kingdoms/';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok && IN_CI) console.log(`::error title=PWA check::${name}${detail ? ' — ' + detail : ''}`);
}

// the site: a copy of the built files, so a "new deploy" can be written without touching the repository
const site = mkdtempSync(join(tmpdir(), 'eok-pwa-'));
for (const f of FILES) copyFileSync(join(ROOT, f), join(site, f));
let down = false;
const server = createServer((req, res) => {
  if (down) { req.socket.destroy(); return; }
  const path = req.url.split('?')[0];
  const file = path === PREFIX ? 'index.html' : path.startsWith(PREFIX) ? path.slice(PREFIX.length) : '';
  if (!FILES.includes(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[file.split('.').pop()], 'cache-control': 'max-age=600' });
  res.end(readFileSync(join(site, file)));
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}${PREFIX}`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const watch = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text()) && !(down && /ERR_|net::|Failed to load resource/.test(m.text()))) errors.push(m.text()); });
};
const toMenu = page => page.waitForFunction(() => typeof UI !== 'undefined' && UI.screen === 'menu', null, { timeout: 30000 });

try {
  // 1) index.html on its own from disk, as after a download
  const alone = mkdtempSync(join(tmpdir(), 'eok-file-'));
  copyFileSync(join(ROOT, 'index.html'), join(alone, 'index.html'));
  const filePage = await browser.newPage();
  watch(filePage);
  await filePage.goto(pathToFileURL(join(alone, 'index.html')).href);
  await toMenu(filePage);
  await filePage.waitForTimeout(1000);
  const fileState = await filePage.evaluate(() => ({ manifest: !!document.querySelector('link[rel="manifest"]'), sw: typeof swReg !== 'undefined' && !!swReg }));
  check('index.html alone from file:// has no manifest and no service worker', !fileState.manifest && !fileState.sw, JSON.stringify(fileState));
  check('index.html alone from file:// logs no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await filePage.close();

  // 2) first visit over http
  const context = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await context.newPage();
  watch(page);
  await page.goto(BASE);
  await toMenu(page);
  const cdp = await context.newCDPSession(page);
  await page.waitForFunction(() => !!document.querySelector('link[rel="manifest"]'), null, { timeout: 10000 });
  const man = await cdp.send('Page.getAppManifest');
  const inst = await cdp.send('Page.getInstallabilityErrors');
  const instErrors = inst.installabilityErrors.map(e => e.errorId);
  check('manifest loads without errors and the app is installable', man.errors.length === 0 && !!man.data && instErrors.length === 0,
    [...man.errors.map(e => e.message), ...instErrors].join(', ') || `${JSON.parse(man.data).name}, start ${man.manifest?.startUrl}`);

  const cacheName = /const CACHE = '([^']+)'/.exec(readFileSync(join(site, 'sw.js'), 'utf8'))[1];
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    const files = await Promise.all(keys.map(async k => (await (await caches.open(k)).keys()).map(r => r.url.slice(r.url.lastIndexOf('/') + 1))));
    return { keys, files: files[0] || [] };
  });
  const missing = FILES.filter(f => f !== 'sw.js' && !cached.files.includes(f));
  check('service worker caches every file of the app', cached.keys.length === 1 && cached.keys[0] === cacheName && missing.length === 0,
    `${cached.keys.join(', ')}${missing.length ? '; missing ' + missing.join(', ') : ''}`);

  // 3) offline: no network and the server does not answer
  down = true;
  await context.setOffline(true);
  await page.reload();
  const offlineMenu = await toMenu(page).then(() => true, () => false);
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  check('offline reload reaches the main menu', offlineMenu && controlled, `menu ${offlineMenu}, served by service worker ${controlled}`);
  await context.setOffline(false);
  down = false;

  // 4) a new deploy while a game runs
  await page.click('[data-a="skirmish"]');
  await page.click('[data-a="start"]');
  await page.waitForFunction(() => UI.screen === 'game' && G && !G.cfg.attract, null, { timeout: 30000 });
  await page.evaluate(() => { saveGame(1); window.__sameDocument = true; });
  writeFileSync(join(site, 'index.html'), readFileSync(join(site, 'index.html'), 'utf8').replace(/const GAME_VERSION = '([^']*)'/, "const GAME_VERSION = '$1-next'"));
  writeFileSync(join(site, 'sw.js'), readFileSync(join(site, 'sw.js'), 'utf8').replace(cacheName, 'eok-next'));
  const tBefore = await page.evaluate(() => G.time);
  await page.evaluate(() => swReg.update());
  const waiting = await page.waitForFunction(() => swReg.waiting, null, { timeout: 30000 }).then(() => true, () => false);
  await page.waitForTimeout(1000);
  const during = await page.evaluate(t0 => ({ same: window.__sameDocument === true, screen: UI.screen, advanced: G.time > t0, menu: !$('menu').hidden }), tBefore);
  check('a new deploy downloads in the background and the running game keeps going', waiting && during.same && during.screen === 'game' && during.advanced && !during.menu,
    `waiting ${waiting}, ${JSON.stringify(during)}`);

  // 5) the main menu offers the update; pressing it loads the new version and keeps the saves
  await page.click('#btnMenu');
  await page.click('#modal [data-a="quit"]');
  await page.click('#modal [data-a="quit"]');
  await toMenu(page);
  const offered = await page.waitForFunction(() => { const b = document.getElementById('btnUpdate'); return b && !b.hidden && b.offsetParent; }, null, { timeout: 5000 }).then(() => true, () => false);
  check('the main menu offers the update', offered);
  if (offered) {
    await Promise.all([page.waitForEvent('framenavigated'), page.click('#btnUpdate')]);
    await toMenu(page);
    const after = await page.evaluate(async () => ({ version: GAME_VERSION, caches: await caches.keys(), save: !!localStorage.getItem('eok.save.1'), button: !document.getElementById('btnUpdate').hidden }));
    check('the update loads the new version, deletes the old cache and keeps the saves',
      /-next$/.test(after.version) && after.caches.join() === 'eok-next' && after.save && !after.button, JSON.stringify(after));
  }
  await page.screenshot({ path: join(ROOT, 'tools', 'screenshots', 'pwa-menu.png') }).catch(() => { });
} catch (e) {
  check('test ran to the end', false, (e && e.message || String(e)).split('\n')[0]);
}

await browser.close();
server.close();
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\nFAILED: ${failed} of ${results.length} checks` : `\nOK: all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
