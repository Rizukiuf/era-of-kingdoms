'use strict';
// ============================================================
//  Game lifecycle, main loop, save / load, attract mode
// ============================================================
let lastCfg = null, attract = { t: 0, i: 0, tx: 0, ty: 0 }, autosaveT = 0;
function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function showLoading(msg) { $('loading').hidden = false; $('loadMsg').textContent = msg; $('loadEyebrow').textContent = t('ui.eyebrow'); }
function hideLoading() { $('loading').hidden = true; }

function startSkirmish(S) {
  const N = MAP_SIZES[S.size] || 80;
  const seed = S.seed ? hashStr(S.seed) : Math.floor(Math.random() * 1e9);
  const cfg = {
    N, mapType: S.map, seed, startRes: S.startRes, startAge: +S.startAge || 0, reveal: S.reveal, popCap: +S.popCap || 200,
    victory: S.victory, timeLimit: +S.timeLimit || 40, treaty: +S.treaty || 0,
    players: S.players.map(p => ({ name: p.human ? (p.name || t('setup.you')) : null, civ: p.civ, color: p.color, team: +p.team || 0, ai: p.human ? null : p.ai, human: !!p.human })),
  };
  launch(cfg);
}
function startTutorial() {
  const cfg = {
    N: 64, mapType: 'continental', seed: 7151, startRes: 'med', startAge: 0, reveal: 'normal', popCap: 200, victory: 'conquest', tutorial: true,
    players: [{ name: t('setup.you'), civ: 'majapahit', color: 0, team: 0, human: true }, { name: t('tut.enemy'), civ: 'franks', color: 1, team: 0, ai: 'passive' }],
  };
  launch(cfg, () => {
    for (const u of G.units) if (u.owner === 1) killEnt(u, -1, true);
    for (const b of G.blds) if (b.owner === 1) killEnt(b, -1, true);
    G.fx = [];
    cleanup();
    const s = G.starts[1];
    spawnBld('barracks', 1, s.x - 1, s.y - 1, true);
    spawnBld('house', 1, s.x + 3, s.y - 3, true);
    spawnBld('house', 1, s.x - 4, s.y + 2, true);
    for (let k = 0; k < 4; k++) spawnUnit('militia', 1, s.x + 2.5 + (k % 2) * .7, s.y + 2.5 + Math.floor(k / 2) * .7);
    G.players[1].alive = true;
    rebuildIndex();
  });
}
function launch(cfg, after) {
  showLoading(t('load.generating'));
  UI.screen = 'loading';
  setTimeout(() => {
    try {
      newGame(cfg);
      const used = new Set();
      for (const p of G.players) {
        if (!p.name) { let n = AI_NAMES[p.civ] || civName(p.civ); while (used.has(n)) n += ' II'; p.name = n; }
        used.add(p.name);
        if (p.human) p.autoReseed = Settings.autoReseed;
      }
      if (after) after();
      lastCfg = cfg;
      enterLoadedGame(true);
    } catch (e) { console.error(e); hideLoading(); UI.showMenu(); }
  }, 40);
}
function enterLoadedGame(fresh) {
  R.setup(G);
  if (fresh || !G.camSaved) {
    const tc = G.blds.find(b => b.owner === G.human && b.type === 'tc');
    if (tc) R.centerOn(tc.x + 2, tc.y + 3); else R.centerOn(G.N / 2, G.N / 2);
    R.cam.z = 1;
  }
  hideLoading();
  UI.enterGame();
  UI.paused = false;
  UI.speed = Settings.speed;
  autosaveT = G.time + 300;
  Audio2.startMusic(G.players[G.human].civ);
  if (fresh && !G.cfg.tutorial) UI.showBanner(civName(G.players[G.human].civ), t('map.' + G.mapType) + ' · ' + ageName(G.players[G.human].age), 4);
}
function restartGame() { if (lastCfg) { const c = Object.assign({}, lastCfg); if (c.tutorial) startTutorial(); else launch(c); } }
function quitToMenu() {
  UI.cancelMode(); UI.sel = []; UI.paused = false;
  $('banner').hidden = true; $('objectives').hidden = true;
  startAttract();
  UI.showMenu();
  Audio2.startMusic('majapahit');
}

// ------------------------------------------------------------
// Attract mode: an AI battle plays behind the main menu
// ------------------------------------------------------------
function startAttract() {
  const civs = CIV_IDS.slice().sort(() => Math.random() - .5);
  const n = Math.random() < .5 ? 2 : 3;
  const cfg = {
    N: 60, mapType: ['continental', 'rivers', 'savanna', 'forest'][Math.floor(Math.random() * 4)], seed: Math.floor(Math.random() * 1e9),
    startRes: 'high', startAge: 1, reveal: 'all', popCap: 90, victory: 'conquest', attract: true,
    players: civs.slice(0, n).map((c, i) => ({ name: AI_NAMES[c], civ: c, color: i, team: 0, ai: 'hard' })),
  };
  newGame(cfg);
  for (let i = 0; i < 30 * 70; i++) stepGame();
  R.setup(G);
  attract.t = 0; attract.i = 0;
  const s = G.starts[0]; R.centerOn(s.x, s.y + 2); R.cam.z = 1.15;
  attract.tx = R.cam.x; attract.ty = R.cam.y;
}
function attractCamera(dt) {
  attract.t -= dt;
  if (attract.t <= 0) {
    attract.t = 11;
    // follow the action: an army in the field, else a base
    const army = G.units.filter(u => !u.dead && u.owner >= 0 && u.type !== 'villager' && !U[u.type].animal && u.ord.t !== 'idle');
    let x, y;
    if (army.length && Math.random() < .6) { const u = army[Math.floor(Math.random() * army.length)]; x = u.x; y = u.y; }
    else { const s = G.starts[attract.i++ % G.starts.length]; x = s.x + 1; y = s.y + 2; }
    attract.tx = isoX(x, y); attract.ty = isoY(x, y);
  }
  const k = 1 - Math.pow(.6, dt);
  R.cam.x += (attract.tx - R.cam.x) * k * .35; R.cam.y += (attract.ty - R.cam.y) * k * .35;
  R.clampCam();
}

// ------------------------------------------------------------
// Save / load
// ------------------------------------------------------------
function serializeGame() {
  const groups = G.visGroups;
  const strip = p => {
    const o = Object.assign({}, p);
    o.sc = {}; o.gr = null; o._fx = null; o.idle = [];
    if (o.aiS) { o.aiS = Object.assign({}, o.aiS); delete o.aiS.tcs; }
    return o;
  };
  return JSON.stringify({
    v: 1, cfg: G.cfg, N: G.N, seed: G.seed, mapType: G.mapType, time: G.time, tick: G.tick, nextId: G.nextId, rs: G.rng.s,
    terrain: b64FromBytes(G.terrain), units: G.units, blds: G.blds, ress: G.ress, players: G.players.map(strip),
    vis: groups.map(v => b64FromBytes(Uint8Array.from(v, x => x ? 1 : 0))), visIdx: G.players.map(p => groups.indexOf(G.vis[p.id])),
    decals: G.decals, wonders: G.wonders, relicHold: G.relicHold, human: G.human, starts: G.starts, ghosts: G.ghosts, over: G.over, winner: G.winner,
    tutStep: G.tutStep || 0, tutDone: !!G.tutDone, cam: { x: R.cam.x, y: R.cam.y, z: R.cam.z }, groups: UI.groups,
  });
}
function restoreGame(d) {
  const N = d.N;
  G = {
    v: 1, cfg: d.cfg, N, seed: d.seed, mapType: d.mapType, terrain: bytesFromB64(d.terrain), time: d.time, tick: d.tick, nextId: d.nextId,
    units: d.units, blds: d.blds, ress: d.ress, byId: new Map(), players: d.players, rng: new Rng(1),
    block: new Int32Array(N * N).fill(-1), occ: new Int32Array(N * N).fill(-1), rch: [], vis: [], proj: [], fx: [], ghosts: d.ghosts || [], decals: d.decals || [],
    events: [], sfx: [], wonders: d.wonders || {}, relicHold: d.relicHold, over: d.over, winner: d.winner, human: d.human, dirty: false,
    visT: 0, secT: 0, aiT: 0, ug: null, starts: d.starts, tutStep: d.tutStep, tutDone: d.tutDone, camSaved: true,
  };
  G.rng.s = d.rs;
  PF.init(N);
  const groups = d.vis.map(b => bytesFromB64(b));
  G.visGroups = groups;
  G.vis = d.visIdx.map(i => groups[i]);
  for (const p of G.players) { p.sc = {}; p.gr = null; p._fx = null; p.idle = []; p.cnt = p.cnt || {}; p.cntAll = p.cntAll || {}; }
  rebuildIndex();
  census();
  updateVis();
  UI.groups = d.groups || {};
  return d.cam;
}
function saveGame(slot) {
  if (!G || G.cfg.attract) return false;
  try {
    const s = serializeGame();
    localStorage.setItem('eok.save.' + slot, s);
    const p = G.players[G.human];
    store('eok.meta.' + slot, { civ: p.civ, map: G.mapType, age: p.age, time: G.time, date: Date.now() });
    return true;
  } catch (e) { return false; }
}
function loadGame(slot) {
  let raw = null;
  try { raw = localStorage.getItem('eok.save.' + slot); } catch (e) { }
  if (!raw) { UI.showMenu(); return; }
  showLoading(t('load.loading'));
  UI.screen = 'loading';
  setTimeout(() => {
    try {
      const d = JSON.parse(raw);
      const cam = restoreGame(d);
      lastCfg = G.cfg;
      enterLoadedGame(false);
      if (cam) { R.cam.x = cam.x; R.cam.y = cam.y; R.cam.z = cam.z; }
      UI.feed(t('msg.loaded'), 'good');
    } catch (e) { console.error(e); hideLoading(); startAttract(); UI.showMenu(); }
  }, 40);
}

// ------------------------------------------------------------
// Main loop
// ------------------------------------------------------------
let lastT = performance.now(), acc = 0, miniT = 0;
function loop(now) {
  const dt = Math.min(.1, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  try {
    if (G && UI.screen !== 'loading') {
      const inMenu = UI.screen === 'menu';
      const running = inMenu || (UI.screen === 'game' && !UI.paused && $('modal').hidden);
      if (running) {
        acc += dt * (inMenu ? 1 : UI.speed);
        let n = 0;
        while (acc >= STEP && n < 12) { stepGame(); acc -= STEP; n++; }
        if (n >= 12) acc = 0;
      }
      if (inMenu) attractCamera(dt); else UI.scrollCamera(dt);
      R.frame(clamp(acc / STEP, 0, 1), dt);
      if (UI.screen === 'game') {
        UI.processEvents();
        Audio2.processSfx();
        UI.hudT -= dt;
        if (UI.hudT <= 0) { UI.hudT = .15; UI.updateHUD(); }
        miniT -= dt;
        if (miniT <= 0) { miniT = .12; R.drawMini($('minimap')); }
        if (UI.pendingEnd && now > UI.pendingEnd) { UI.pendingEnd = 0; UI.showEnd(); }
        if (!G.over && G.time > autosaveT) { autosaveT = G.time + 300; saveGame('auto'); }
      } else { G.events = []; G.sfx = []; }
      if (G.cfg.attract && (G.attractEnded || G.time > 1200)) startAttract();
    }
  } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}

function boot(hot) {
  UI.init();
  showLoading(t('load.preparing'));
  setTimeout(() => {
    try {
      if (hot && hot.save) {
        const cam = restoreGame(JSON.parse(hot.save));
        lastCfg = G.cfg; enterLoadedGame(false);
        if (cam) { R.cam.x = cam.x; R.cam.y = cam.y; R.cam.z = cam.z; }
      } else {
        startAttract();
        hideLoading();
        UI.showMenu();
      }
    } catch (e) { console.error(e); startAttract(); hideLoading(); UI.showMenu(); }
    requestAnimationFrame(loop);
  }, 30);
}
try { window.claude?.hot?.snapshot?.(() => ({ save: G && !G.cfg.attract && UI.screen === 'game' ? serializeGame() : null })); } catch (e) { }
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot(window.claude?.hot?.data ?? {});
