'use strict';
// ============================================================
//  Service worker: installable app and offline play
// ============================================================
// The build writes this file to sw.js and puts a hash of every built file into the cache name, so each deploy
// has a new cache. main.js registers it only when the page is served over http(s); file:// never uses it.
const CACHE = 'eok-07bb7ae7e29f';
const FILES = ['index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

// A new version downloads in the background ('reload' skips the HTTP cache) and then waits until every page of
// the old version is closed, or until the main menu asks for it with 'skipWaiting'. A running game never reloads.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('eok-') && k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// The game's own files come from the cache first; the folder URL itself is index.html. Everything else, such as
// Google Fonts, goes to the network as usual, so offline the fonts fall back to the system fonts.
self.addEventListener('fetch', e => {
  const req = e.request, scope = self.registration.scope, url = req.url.split(/[?#]/)[0];
  if (req.method !== 'GET' || !url.startsWith(scope)) return;
  let file = url.slice(scope.length);
  if (file === '' && req.mode === 'navigate') file = 'index.html';
  if (!FILES.includes(file)) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(file)).then(r => r || fetch(req)));
});
