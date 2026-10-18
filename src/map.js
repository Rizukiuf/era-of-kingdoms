'use strict';
// ============================================================
//  Map generation
//  Terrain codes: 0 grass, 1 lush grass, 2 dirt, 3 sand, 4 shallows, 5 deep water, 6 dry grass, 7 forest floor
// ============================================================
const TER = { GRASS: 0, LUSH: 1, DIRT: 2, SAND: 3, SHALLOW: 4, DEEP: 5, DRY: 6, FOREST: 7 };
const MAP_TYPES = ['continental', 'rivers', 'coastal', 'forest', 'savanna'];
const MAP_SIZES = { tiny: 64, small: 80, medium: 96, large: 112 };

function genMap(G) {
  const N = G.N, rng = new Rng(G.seed * 7 + 13), seed = G.seed | 0, type = G.mapType;
  const ter = G.terrain;
  const idx = (x, y) => y * N + x;
  const inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const np = G.players.length;
  const dry = type === 'savanna';

  // ---- base terrain ----
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = fbm(x / 14, y / 14, seed, 4), n2 = fbm(x / 6, y / 6, seed + 99, 3);
    let t = TER.GRASS;
    if (dry) { t = n < .42 ? TER.SAND : n < .58 ? TER.DRY : TER.GRASS; if (n2 > .66) t = TER.DIRT; }
    else { if (n2 > .63) t = TER.LUSH; if (n < .3) t = TER.DIRT; }
    ter[idx(x, y)] = t;
  }

  // ---- player start positions ----
  const cx = N / 2, cy = N / 2;
  const a0 = rng.next() * Math.PI * 2;
  let radius = N * .36;
  const starts = [];
  let seaDir = null;
  if (type === 'coastal') {
    seaDir = rng.int(0, 3); // which edge is sea: 0 = low x, 1 = high x, 2 = low y, 3 = high y
  }
  // order players so that teammates sit next to each other
  const order = G.players.map((p, i) => i).sort((a, b) => (G.players[a].team || 99 + a) - (G.players[b].team || 99 + b));
  for (let k = 0; k < np; k++) {
    const ang = a0 + Math.PI * 2 * k / np;
    let px = cx + Math.cos(ang) * radius, py = cy + Math.sin(ang) * radius;
    if (seaDir !== null) { // squash the circle away from the sea
      if (seaDir === 0) px = cx + (px - cx) * .55 + N * .12; if (seaDir === 1) px = cx + (px - cx) * .55 - N * .12;
      if (seaDir === 2) py = cy + (py - cy) * .55 + N * .12; if (seaDir === 3) py = cy + (py - cy) * .55 - N * .12;
    }
    starts[order[k]] = { x: Math.round(px), y: Math.round(py), ang };
  }
  const nearStart = (x, y, r) => starts.some(s => dist(x, y, s.x, s.y) < r);

  // ---- water ----
  const setWater = (x, y, deep) => { if (!inMap(x, y)) return; const i = idx(x, y); if (deep) ter[i] = TER.DEEP; else if (ter[i] !== TER.DEEP) ter[i] = TER.SHALLOW; };
  if (type === 'continental' || type === 'savanna' || type === 'forest') {
    const lakes = type === 'continental' ? 2 + Math.floor(np / 2) + rng.int(0, 1) : type === 'savanna' ? np : 1;
    for (let l = 0; l < lakes; l++) {
      let lx, ly, tries = 0, r = type === 'continental' ? rng.range(4, 7.5) : rng.range(2.5, 4.5);
      do { lx = rng.range(6, N - 6); ly = rng.range(6, N - 6); tries++; } while (tries < 80 && nearStart(lx, ly, r + 13));
      if (tries >= 80) continue;
      for (let y = Math.floor(ly - r - 3); y <= ly + r + 3; y++) for (let x = Math.floor(lx - r - 3); x <= lx + r + 3; x++) {
        if (!inMap(x, y)) continue;
        const d = dist(x, y, lx, ly) / (r * (.75 + .5 * vnoise(x / 3, y / 3, seed + l * 31)));
        if (d < .8) setWater(x, y, true); else if (d < 1) setWater(x, y, false);
      }
    }
  }
  if (type === 'coastal') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const e = [x, N - 1 - x, y, N - 1 - y][seaDir];
      const w = N * .2 + (fbm(x / 9, y / 9, seed + 5, 3) - .5) * 10;
      if (e < w - 1.5) setWater(x, y, true); else if (e < w) setWater(x, y, false);
    }
    // a couple of small islands with gold
    for (let k = 0; k < 2; k++) {
      let ix, iy, tries = 0;
      do { ix = rng.int(4, N - 5); iy = rng.int(4, N - 5); tries++; } while (tries < 200 && ter[idx(ix, iy)] !== TER.DEEP);
      if (tries < 200) for (let y = iy - 2; y <= iy + 2; y++) for (let x = ix - 2; x <= ix + 2; x++) if (inMap(x, y) && dist(x, y, ix, iy) < 2.3) ter[idx(x, y)] = TER.SAND;
    }
  }
  if (type === 'rivers') {
    for (let k = 0; k < np; k++) {
      const ang = a0 + Math.PI * 2 * k / np + Math.PI / np;
      const len = N * .75;
      for (let s = 0; s < len; s += .5) {
        const wob = (vnoise(s / 7, k * 13, seed + 3) - .5) * 6;
        const px = cx + Math.cos(ang) * s - Math.sin(ang) * wob, py = cy + Math.sin(ang) * s + Math.cos(ang) * wob;
        const ford = (s > len * .28 && s < len * .36) || (s > len * .62 && s < len * .7) || s < 4;
        const w = 1.6 + vnoise(s / 5, k, seed + 9) * .8;
        for (let y = Math.floor(py - w - 1); y <= py + w + 1; y++) for (let x = Math.floor(px - w - 1); x <= px + w + 1; x++) {
          if (!inMap(x, y)) continue;
          const d = dist(x + .5, y + .5, px, py);
          if (d < w) { const i = idx(x, y); if (ford) { if (ter[i] !== TER.DEEP) ter[i] = TER.SHALLOW; } else ter[i] = TER.DEEP; }
          else if (d < w + 1 && ter[idx(x, y)] !== TER.DEEP) ter[idx(x, y)] = TER.SHALLOW;
        }
      }
    }
    // re-assert fords (later arms may have overwritten)
  }
  // sand beaches next to water
  const isWater = i => ter[i] === TER.DEEP || ter[i] === TER.SHALLOW;
  const beach = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y); if (isWater(i)) continue;
    for (const [dx, dy] of DIRS8) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && ter[idx(nx, ny)] === TER.SHALLOW || (inMap(nx, ny) && ter[idx(nx, ny)] === TER.DEEP)) { beach[i] = 1; break; } }
  }
  for (let i = 0; i < N * N; i++) if (beach[i] && (type !== 'rivers' || rng.chance(.6))) ter[i] = TER.SAND;

  // clear player bases of water
  for (const s of starts) for (let y = s.y - 9; y <= s.y + 9; y++) for (let x = s.x - 9; x <= s.x + 9; x++) {
    if (!inMap(x, y)) continue; const d = dist(x, y, s.x, s.y);
    if (d < 8.5 && isWater(idx(x, y))) ter[idx(x, y)] = dry ? TER.DRY : TER.GRASS;
    if (d < 4) ter[idx(x, y)] = dry ? TER.DIRT : (ter[idx(x, y)] === TER.SAND ? TER.GRASS : ter[idx(x, y)]);
  }

  // ---- static placement helpers ----
  const occ = new Uint8Array(N * N); // generation-time occupancy
  const landFree = (x, y) => inMap(x, y) && !occ[idx(x, y)] && !isWater(idx(x, y));
  for (const s of starts) for (let y = s.y - 3; y <= s.y + 3; y++) for (let x = s.x - 3; x <= s.x + 3; x++) if (inMap(x, y)) occ[idx(x, y)] = 2;
  function blob(sx, sy, count, okFn) {
    if (!okFn(sx, sy)) return null;
    const out = [[sx, sy]], seen = new Set([idx(sx, sy)]);
    let guard = 0;
    while (out.length < count && guard++ < count * 30) {
      const [bx, by] = out[rng.int(0, out.length - 1)];
      const [dx, dy] = DIRS4[rng.int(0, 3)];
      const nx = bx + dx, ny = by + dy;
      if (!inMap(nx, ny) || seen.has(idx(nx, ny)) || !okFn(nx, ny)) continue;
      seen.add(idx(nx, ny)); out.push([nx, ny]);
    }
    return out.length >= Math.ceil(count * .7) ? out : null;
  }
  function placeCluster(s, d0, d1, count, okFn, fn) {
    for (let tries = 0; tries < 120; tries++) {
      const ang = rng.next() * Math.PI * 2, d = rng.range(d0, d1 + tries * .05);
      const x = Math.round(s.x + Math.cos(ang) * d), y = Math.round(s.y + Math.sin(ang) * d);
      const tiles = blob(x, y, count, okFn);
      if (!tiles) continue;
      // keep clear of other resource clusters by one tile
      if (tiles.some(([tx, ty]) => DIRS8.some(([dx, dy]) => inMap(tx + dx, ty + dy) && occ[idx(tx + dx, ty + dy)] === 1 && !tiles.some(q => q[0] === tx + dx && q[1] === ty + dy)))) continue;
      for (const [tx, ty] of tiles) { occ[idx(tx, ty)] = 1; fn(tx, ty); }
      return tiles;
    }
    return null;
  }
  const farFromOthers = (x, y, me, r) => starts.every((s, i) => i === me || dist(x, y, s.x, s.y) > r);

  // ---- per-player resources (fair) ----
  starts.forEach((s, pi) => {
    const ok = (min) => (x, y) => landFree(x, y) && dist(x, y, s.x, s.y) > min && farFromOthers(x, y, pi, 12);
    placeCluster(s, 6.5, 8, 6, ok(5), (x, y) => spawnRes('berry', x, y));
    placeCluster(s, 8.5, 10.5, 7, ok(6), (x, y) => spawnRes('gold', x, y));
    placeCluster(s, 15, 18, 6, ok(10), (x, y) => spawnRes('gold', x, y));
    placeCluster(s, 9.5, 11.5, 5, ok(7), (x, y) => spawnRes('stone', x, y));
    placeCluster(s, 15, 18, 4, ok(10), (x, y) => spawnRes('stone', x, y));
    // two woodlines
    for (let k = 0; k < 2; k++) placeCluster(s, 7.5 + k * 4, 9.5 + k * 4, 24, (x, y) => landFree(x, y) && dist(x, y, s.x, s.y) > 6 && farFromOthers(x, y, pi, 10), (x, y) => { spawnRes('tree', x, y); ter[idx(x, y)] = dry && rng.chance(.5) ? ter[idx(x, y)] : TER.FOREST; });
    // wildlife
    for (let k = 0; k < 6; k++) { const a = rng.next() * 6.283, d = rng.range(3.6, 5.6); const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d; if (landFree(Math.floor(x), Math.floor(y))) spawnUnit('sheep', pi, x, y); }
    for (let k = 0; k < 2; k++) { const sh = placeCluster(s, 8, 11, 1, ok(7), () => { }); if (sh) { spawnUnit('sheep', pi, sh[0][0] + .3, sh[0][1] + .5); spawnUnit('sheep', pi, sh[0][0] + .8, sh[0][1] + .6); } }
    const herd = placeCluster(s, 10, 13, 1, ok(8), () => { });
    if (herd) for (let k = 0; k < 4; k++) spawnUnit('deer', -1, herd[0][0] + .5 + rng.range(-1.5, 1.5), herd[0][1] + .5 + rng.range(-1.5, 1.5));
    for (let k = 0; k < 2; k++) { const b = placeCluster(s, 9, 12, 1, ok(8), () => { }); if (b) spawnUnit('boar', -1, b[0][0] + .5, b[0][1] + .5); }
  });

  // ---- forests ----
  const dens = { continental: .63, rivers: .64, coastal: .63, forest: .5, savanna: .73 }[type];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    if (occ[i] || isWater(i) || ter[i] === TER.SAND && !dry) continue;
    if (nearStart(x, y, type === 'forest' ? 11 : 13)) continue;
    const d = fbm(x / 9, y / 9, seed + 7, 4);
    if (d > dens || (rng.chance(.012) && !nearStart(x, y, 8))) {
      occ[i] = 1; spawnRes('tree', x, y);
      if (d > dens) ter[i] = dry ? TER.DRY : TER.FOREST;
    }
  }
  // carve corridors from each player to the centre so nothing is sealed in by trees
  const carve = [];
  for (const s of starts) {
    const steps = Math.ceil(dist(s.x, s.y, cx, cy));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, wob = (vnoise(k / 6, s.x, seed + 21) - .5) * 4;
      const px = lerp(s.x, cx, t) + wob, py = lerp(s.y, cy, t) - wob;
      for (let y = Math.floor(py - 1.6); y <= py + 1.6; y++) for (let x = Math.floor(px - 1.6); x <= px + 1.6; x++) if (inMap(x, y)) carve.push(idx(x, y));
    }
  }
  // remove trees in carved tiles
  const carveSet = new Set(carve);
  for (const e of G.ress) if (e.type === 'tree' && carveSet.has(idx(Math.floor(e.x), Math.floor(e.y))) && !nearStart(e.x, e.y, 7.5)) e.dead = true;
  G.ress = G.ress.filter(e => !e.dead);
  for (const i of carveSet) if (occ[i] === 1) occ[i] = 0;
  for (const e of G.ress) { const i = idx(Math.floor(e.x), Math.floor(e.y)); if (carveSet.has(i)) occ[i] = 1; }

  // ---- neutral resources ----
  const free = (x, y) => landFree(x, y) && !nearStart(x, y, 14);
  for (let k = 0; k < np + 1; k++) {
    for (let tries = 0; tries < 100; tries++) {
      const x = rng.int(4, N - 5), y = rng.int(4, N - 5);
      const t = blob(x, y, rng.chance(.6) ? 6 : 4, free);
      if (!t) continue;
      const kind = rng.chance(.65) ? 'gold' : 'stone';
      for (const [tx, ty] of t) { occ[idx(tx, ty)] = 1; spawnRes(kind, tx, ty); }
      break;
    }
  }
  // relics
  const nRelics = G.N >= 96 ? 7 : 5;
  for (let k = 0, guard = 0; k < nRelics && guard < 500; guard++) {
    const x = rng.int(3, N - 4), y = rng.int(3, N - 4);
    if (!landFree(x, y) || nearStart(x, y, 16)) continue;
    occ[idx(x, y)] = 3; spawnRes('relic', x, y); k++;
  }
  // wolves
  const nWolves = type === 'forest' ? 4 : 2;
  for (let k = 0, guard = 0; k < nWolves && guard < 300; guard++) {
    const x = rng.int(3, N - 4), y = rng.int(3, N - 4);
    if (!landFree(x, y) || nearStart(x, y, 20)) continue;
    for (let j = 0; j < 2; j++) spawnUnit('wolf', -1, x + .5 + j * .6, y + .5);
    k++;
  }
  // extra deer herds in open country
  for (let k = 0, guard = 0; k < np && guard < 300; guard++) {
    const x = rng.int(3, N - 4), y = rng.int(3, N - 4);
    if (!landFree(x, y) || nearStart(x, y, 18)) continue;
    for (let j = 0; j < 3; j++) spawnUnit('deer', -1, x + .5 + rng.range(-1, 1), y + .5 + rng.range(-1, 1));
    k++;
  }
  // fish in deep water near shores
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = idx(x, y); if (ter[i] !== TER.DEEP || occ[i]) continue;
    let nearLand = false, allDeep = true;
    for (const [dx, dy] of DIRS8) { const t = ter[idx(x + dx, y + dy)]; if (t !== TER.DEEP) allDeep = false; }
    for (let yy = y - 3; yy <= y + 3 && !nearLand; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (inMap(xx, yy) && !isWater(idx(xx, yy))) { nearLand = true; break; }
    if (allDeep && nearLand && rng.chance(.035)) { occ[i] = 1; spawnRes('fish', x, y); }
  }
  G.starts = starts;
}
