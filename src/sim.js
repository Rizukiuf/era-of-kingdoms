'use strict';
// ============================================================
//  Simulation core
// ============================================================
let G = null;

function allied(a, b) {
  if (a === b) return true;
  if (a < 0 || b < 0) return false;
  const ta = G.players[a].team, tb = G.players[b].team;
  return ta > 0 && ta === tb;
}
function isEnemy(a, b) { return a >= 0 && b >= 0 && !allied(a, b); }
function hostile(u, t) {
  if (!t || t.dead || t.gIn) return false;
  if (t.k === 'r') return false;
  if (isEnemy(u.owner, t.owner)) return true;
  if (u.owner >= 0 && t.owner === -1 && t.k === 'u' && t.type === 'wolf') return true;
  if (u.owner === -1 && u.type === 'wolf' && t.owner >= 0 && t.k === 'u' && !U[t.type].animal) return true;
  return false;
}
const rnd = () => G.rng.next();
const byId = id => (id ? G.byId.get(id) : undefined);
const tIdx = (x, y) => Math.floor(y) * G.N + Math.floor(x);
const inMapXY = (x, y) => x >= 0 && y >= 0 && x < G.N && y < G.N;
const isVil = u => u.type === 'villager';
const isShip = u => u.sh === 1;

// ------------------------------------------------------------
// Stats with civilisation bonuses and technologies applied
// ------------------------------------------------------------
function fxMatches(fx, type, cls) {
  if (fx.not && cls.includes(fx.not)) return false;
  const w = fx.who;
  if (!w || w === 'all') return true;
  if (Array.isArray(w)) return w.some(x => x === type || cls.includes(x));
  return w === type || cls.includes(w);
}
function playerFx(p) {
  if (p._fx) return p._fx;
  const list = [].concat(CIVS[p.civ].fx);
  for (const id of p.techOrder) list.push(...T[id].fx);
  return (p._fx = list);
}
function ST(owner, type) {
  const d = defOf(type);
  if (owner < 0 || !G || !G.players[owner]) return d;
  const p = G.players[owner];
  let s = p.sc[type];
  if (s) return s;
  s = Object.assign({}, d);
  s.bonus = Object.assign({}, d.bonus); s.cost = Object.assign({}, d.cost);
  const cls = d.cls;
  for (const fx of playerFx(p)) {
    if (fx.t === 'stat' && fxMatches(fx, type, cls)) {
      if (fx.add != null) s[fx.stat] = (s[fx.stat] || 0) + fx.add;
      if (fx.mul != null) s[fx.stat] = (s[fx.stat] == null ? 1 : s[fx.stat]) * fx.mul;
    } else if (fx.t === 'cost' && fxMatches(fx, type, cls)) {
      for (const r in s.cost) if (!fx.res || fx.res === r) s.cost[r] = Math.round(s.cost[r] * fx.mul);
    } else if (fx.t === 'time' && fxMatches(fx, type, cls)) s.time *= fx.mul;
    else if (fx.t === 'pop' && fxMatches(fx, type, cls)) s.pop += fx.add;
    else if (fx.t === 'elite' && cls.includes('unique') && d.elite) for (const k in d.elite) s[k] = (s[k] || 0) + d.elite[k];
  }
  s.hp = Math.round(s.hp);
  if (s.acc > 1) s.acc = 1;
  if (d.isBld && p.flags.murderHoles) s.minRng = 0;
  if (s.recharge == null) s.recharge = 1;
  return (p.sc[type] = s);
}
function gatherRate(p, g) {
  if (!p.gr) {
    p.gr = Object.assign({}, GATHER);
    for (const fx of playerFx(p)) if (fx.t === 'gather') {
      if (fx.res === 'food') { for (const k of ['berry', 'hunt', 'farm', 'fish']) p.gr[k] *= fx.mul; }
      else p.gr[fx.res] *= fx.mul;
    }
  }
  return p.gr[g];
}
function carryCap(p, type) {
  let c = U[type].carry || 10;
  if (type === 'villager') for (const fx of playerFx(p)) if (fx.t === 'carry') c += fx.add;
  return c;
}
function buildMul(p) { let m = 1; for (const fx of playerFx(p)) if (fx.t === 'build') m *= fx.mul; return m; }
function farmFood(p) { let f = B.farm.food; for (const fx of playerFx(p)) if (fx.t === 'farm') f += fx.add; return f; }
function techCost(p, id) {
  const t = T[id], c = Object.assign({}, t.cost);
  if (!t.ageUp) for (const fx of CIVS[p.civ].fx) if (fx.t === 'techCost') for (const r in c) c[r] = Math.round(c[r] * fx.mul);
  return c;
}
function invalidate(p) { p.sc = {}; p.gr = null; p._fx = null; }

// ------------------------------------------------------------
// Entity creation & bookkeeping
// ------------------------------------------------------------
function regEnt(e) { G.byId.set(e.id, e); }
function spawnUnit(type, owner, x, y) {
  const s = ST(owner, type);
  const u = {
    id: G.nextId++, k: 'u', type, owner, x, y, px: x, py: y, r: U[type].r, sh: U[type].dom === 'w' ? 1 : 0, hp: s.hp, mhp: s.hp, dir: Math.PI * .25, fr: 1, back: 0,
    ord: { t: 'idle' }, q: [], path: null, pi: 0, cool: rnd() * .5, anim: rnd() * 2, act: 'idle', carry: 0, cres: null,
    stance: (U[type].cls.includes('villager') || U[type].cls.includes('monk') || U[type].animal) ? 'def' : 'agg',
    gx: x, gy: y, hx: x, hy: y, lastHit: -99, att: 0, gIn: 0, relic: 0, kills: 0, rest: 0, scanT: rnd() * .5,
    vx: 0, vy: 0, chkT: 0, chkX: x, chkY: y, appF: 0, flee: 0, setT: 0, born: G.time,
  };
  G.units.push(u); regEnt(u);
  return u;
}
function spawnBld(type, owner, tx, ty, built) {
  const d = B[type], s = ST(owner, type);
  const b = {
    id: G.nextId++, k: 'b', type, owner, x: tx, y: ty, w: d.w, h: d.h, hp: built ? s.hp : 1, mhp: s.hp, built: !!built, prog: built ? 1 : 0,
    q: [], rally: null, gar: [], relics: [], cool: 0, food: 0, bc: 0, seen: 0, born: G.time, lastHit: -99,
  };
  if (type === 'farm' && built) b.food = farmFood(G.players[owner]);
  G.blds.push(b); regEnt(b); gridAdd(b);
  return b;
}
function spawnRes(type, tx, ty, amt) {
  const k = RES_KIND[type];
  const point = type === 'carcass' || type === 'relic';
  const r = {
    id: G.nextId++, k: 'r', type, owner: -1, x: point ? tx : tx + .5, y: point ? ty : ty + .5,
    amt: amt != null ? amt : (k ? k.amt : 0), max: 0, v: Math.floor(hash2(tx | 0, ty | 0, 77) * 1000), carrier: 0, inB: 0,
  };
  r.max = r.amt;
  G.ress.push(r); regEnt(r);
  if (!point) gridAdd(r);
  return r;
}
function gridAdd(e) {
  const N = G.N;
  if (e.k === 'b') {
    const pass = B[e.type].pass;
    for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const i = y * N + x; G.occ[i] = e.id; if (!pass) G.block[i] = e.id;
    }
  } else if (e.k === 'r') {
    const i = tIdx(e.x, e.y); G.occ[i] = e.id; G.block[i] = e.id;
    const c = rchunk(e.x, e.y); if (!G.rch[c]) G.rch[c] = []; G.rch[c].push(e.id);
  }
}
function gridDel(e) {
  const N = G.N;
  if (e.k === 'b') {
    for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const i = y * N + x; if (G.occ[i] === e.id) G.occ[i] = -1; if (G.block[i] === e.id) G.block[i] = -1;
    }
  } else if (e.k === 'r' && e.type !== 'carcass' && e.type !== 'relic') {
    const i = tIdx(e.x, e.y); if (G.occ[i] === e.id) G.occ[i] = -1; if (G.block[i] === e.id) G.block[i] = -1;
    const c = G.rch[rchunk(e.x, e.y)]; if (c) { const j = c.indexOf(e.id); if (j >= 0) c.splice(j, 1); }
  }
}
const RCH = 8;
function rchunk(x, y) { const n = Math.ceil(G.N / RCH); return Math.floor(y / RCH) * n + Math.floor(x / RCH); }
function rebuildIndex() {
  G.byId = new Map();
  G.block.fill(-1); G.occ.fill(-1); G.rch = [];
  for (const arr of [G.units, G.blds, G.ress]) for (const e of arr) regEnt(e);
  for (const u of G.units) u.sh = U[u.type].dom === 'w' ? 1 : 0;
  for (const b of G.blds) gridAdd(b);
  for (const r of G.ress) if (r.type !== 'carcass' && r.type !== 'relic') gridAdd(r);
}

// ------------------------------------------------------------
// Passability
// ------------------------------------------------------------
function passLand(i, owner) {
  const t = G.terrain[i];
  if (t === TER.DEEP) return false;
  const b = G.block[i];
  if (b < 0) return true;
  const e = G.byId.get(b);
  return !!(e && e.k === 'b' && e.type === 'gate' && e.built && allied(e.owner, owner));
}
function passWater(i) { return G.terrain[i] === TER.DEEP && G.block[i] < 0; }
function passFor(u) {
  if (isShip(u)) return passWater;
  const o = u.owner;
  return i => passLand(i, o);
}
function passXYFor(u) {
  const pf = passFor(u), N = G.N;
  return (x, y) => x >= 0 && y >= 0 && x < N && y < N && pf(Math.floor(y) * N + Math.floor(x));
}
function nearestPassable(u, x, y, maxR) {
  const pf = passXYFor(u);
  if (pf(x, y)) return [x, y];
  for (let r = 1; r <= (maxR || 6); r++) {
    let best = null, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = Math.floor(x) + dx + .5, ny = Math.floor(y) + dy + .5;
      if (!pf(nx, ny)) continue;
      const d = dist(nx, ny, u.x, u.y);
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
    if (best) return best;
  }
  return null;
}

// ------------------------------------------------------------
// Movement
// ------------------------------------------------------------
function requestPath(u, goal) {
  if (PF.budget <= 0) return false;
  const gd = distToRect(u.x, u.y, goal.x0, goal.y0, goal.x1, goal.y1);
  const cap = clamp(250 + gd * gd * 8, 400, 7000);
  const pts0 = PF.find(u.x, u.y, goal, passFor(u), cap);
  if (pts0 === null) { u.path = []; u.pi = 0; u.nopath = (u.nopath || 0) + 1; return true; }
  const pxy = passXYFor(u);
  let pts = smoothPath(u.x, u.y, pts0, pxy, Math.min(.25, u.r * .9));
  if (goal.px != null && pts0.complete && pxy(goal.px, goal.py)) {
    if (pts.length) pts[pts.length - 1] = [goal.px, goal.py]; else pts = [[goal.px, goal.py]];
  }
  u.path = pts; u.pi = 0; u.nopath = pts0.complete ? 0 : (u.nopath || 0) + 1;
  return true;
}
function speedOf(u) {
  const s = ST(u.owner, u.type);
  let sp = s.spd;
  if (!isShip(u) && G.terrain[tIdx(u.x, u.y)] === TER.SHALLOW) sp *= .72;
  return sp;
}
function face(u, dx, dy) {
  const sx = dx - dy, sy = (dx + dy) * .5;
  if (Math.abs(sx) + Math.abs(sy) < 1e-4) return;
  u.dir = Math.atan2(sy, sx);
  if (Math.abs(sx) > .02) u.fr = sx >= 0 ? 1 : -1;
  u.back = sy < -Math.abs(sx) * .25 ? 1 : 0;
}
function moveAlong(u, dt, cap) {
  const p = u.path;
  if (!p || u.pi >= p.length) return 'arrived';
  let sp = speedOf(u); if (cap) sp = Math.min(sp, cap);
  let rem = sp * dt;
  const pxy = passXYFor(u);
  while (rem > 1e-6 && u.pi < p.length) {
    const tx = p[u.pi][0], ty = p[u.pi][1];
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    face(u, dx, dy);
    let nx, ny;
    if (d <= rem) { nx = tx; ny = ty; rem -= d; u.pi++; }
    else { nx = u.x + dx / d * rem; ny = u.y + dy / d * rem; rem = 0; }
    if (tIdx(nx, ny) !== tIdx(u.x, u.y) && !pxy(nx, ny)) { u.path = null; return 'blocked'; }
    u.x = nx; u.y = ny;
  }
  u.act = 'walk';
  return u.pi >= p.length ? 'arrived' : 'moving';
}
function stepDirect(u, tx, ty, dt) {
  const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
  if (d < 1e-3) return true;
  const sp = Math.min(d, speedOf(u) * dt);
  const nx = u.x + dx / d * sp, ny = u.y + dy / d * sp;
  face(u, dx, dy);
  if (tIdx(nx, ny) !== tIdx(u.x, u.y) && !passXYFor(u)(nx, ny)) return false;
  u.x = nx; u.y = ny; u.act = 'walk';
  return true;
}
function targetRect(t) {
  if (t.k === 'b') {
    if (t.type === 'farm') return [t.x + 1.1, t.y + 1.1, t.x + t.w - 1.1, t.y + t.h - 1.1];
    return [t.x, t.y, t.x + t.w, t.y + t.h];
  }
  if (t.k === 'r' && t.type !== 'carcass' && t.type !== 'relic') { const x = Math.floor(t.x), y = Math.floor(t.y); return [x, y, x + 1, y + 1]; }
  return [t.x, t.y, t.x, t.y];
}
function gapTo(u, t) {
  const r = targetRect(t);
  let d = distToRect(u.x, u.y, r[0], r[1], r[2], r[3]) - u.r;
  if (t.k === 'u') d -= t.r;
  return d;
}
// returns 1 in range, 0 moving/waiting, -1 unreachable
function approach(u, t, range, dt, cap) {
  const g = gapTo(u, t);
  if (g <= range) { u.path = null; u.appF = 0; return 1; }
  const rect = targetRect(t);
  const tcx = (rect[0] + rect[2]) / 2, tcy = (rect[1] + rect[3]) / 2;
  const moved = t.k === 'u' && u.tgx != null && dist(tcx, tcy, u.tgx, u.tgy) > Math.max(1, g * .3);
  if (!u.path || moved || u.tgid !== t.id) {
    const point = rect[0] === rect[2] && rect[1] === rect[3];
    const goal = { x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3], d: Math.max(.5, range + u.r + (t.k === 'u' ? t.r : 0) + (point ? .95 : .45)) };
    if (!requestPath(u, goal)) return 0;
    u.tgx = tcx; u.tgy = tcy; u.tgid = t.id;
    if (u.nopath > 6) { u.nopath = 0; return -1; }
  }
  if (u.path && u.pi < u.path.length) {
    const r = moveAlong(u, dt, cap);
    if (r === 'blocked') { u.appF++; if (u.appF > 10) return -1; }
    return 0;
  }
  const c = closestOnRect(u.x, u.y, rect[0], rect[1], rect[2], rect[3]);
  if (!stepDirect(u, c[0], c[1], dt)) { u.path = null; u.appF++; if (u.appF > 10) return -1; }
  return 0;
}
function nextOrder(u) {
  u.path = null; u.appF = 0; u.tgid = 0;
  if (u.q.length) u.ord = u.q.shift(); else u.ord = { t: 'idle' };
}
function issue(u, ord, shift) {
  if (shift && (u.ord.t !== 'idle' || u.q.length)) { u.q.push(ord); return; }
  u.ord = ord; u.q = []; u.path = null; u.appF = 0; u.tgid = 0; u.setT = 0;
}

// ------------------------------------------------------------
// Unit spatial grid (rebuilt every tick)
// ------------------------------------------------------------
const UG = 3;
function buildUnitGrid() {
  const n = Math.ceil(G.N / UG);
  if (!G.ug || G.ug.length !== n * n) G.ug = Array.from({ length: n * n }, () => []);
  for (const c of G.ug) c.length = 0;
  for (const u of G.units) {
    if (u.dead || u.gIn) continue;
    const c = Math.floor(u.y / UG) * n + Math.floor(u.x / UG);
    if (G.ug[c]) G.ug[c].push(u);
  }
}
function unitsNear(x, y, r, fn) {
  const n = Math.ceil(G.N / UG);
  const x0 = Math.max(0, Math.floor((x - r) / UG)), x1 = Math.min(n - 1, Math.floor((x + r) / UG));
  const y0 = Math.max(0, Math.floor((y - r) / UG)), y1 = Math.min(n - 1, Math.floor((y + r) / UG));
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const c = G.ug[cy * n + cx];
    for (let i = 0; i < c.length; i++) { const u = c[i]; if (!u.dead && Math.abs(u.x - x) <= r + 1 && Math.abs(u.y - y) <= r + 1) { if (fn(u) === false) return; } }
  }
}
function bldsNear(x, y, r, fn) {
  for (const b of G.blds) {
    if (b.dead) continue;
    if (distToRect(x, y, b.x, b.y, b.x + b.w, b.y + b.h) <= r) if (fn(b) === false) return;
  }
}
function separate() {
  const n = Math.ceil(G.N / UG);
  for (let ci = 0; ci < G.ug.length; ci++) {
    const c = G.ug[ci]; if (!c.length) continue;
    const cx = ci % n, cy = (ci / n) | 0;
    for (let ny = cy - 1; ny <= cy + 1; ny++) for (let nx = cx - 1; nx <= cx + 1; nx++) {
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const c2 = G.ug[ny * n + nx];
      for (const a of c) for (const b of c2) {
        if (a.id >= b.id || a.dead || b.dead) continue;
        if (a.sh !== b.sh) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
        if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        let d = Math.hypot(dx, dy);
        if (d >= rr) continue;
        let ux, uy;
        if (d < 1e-4) { const ang = (a.id * 2.399) % 6.283; ux = Math.cos(ang); uy = Math.sin(ang); d = 0; } else { ux = dx / d; uy = dy / d; }
        const ov = (rr - d) * .5;
        const wa = a.act === 'walk' ? 1 : .35, wb = b.act === 'walk' ? 1 : .35;
        const s = wa + wb;
        pushU(a, -ux * ov * wa / s * 1.2, -uy * ov * wa / s * 1.2);
        pushU(b, ux * ov * wb / s * 1.2, uy * ov * wb / s * 1.2);
      }
    }
  }
}
function pushU(u, dx, dy) {
  const nx = clamp(u.x + dx, .05, G.N - .05), ny = clamp(u.y + dy, .05, G.N - .05);
  if (tIdx(nx, ny) === tIdx(u.x, u.y) || passXYFor(u)(nx, ny)) { u.x = nx; u.y = ny; }
}

// ------------------------------------------------------------
// New game
// ------------------------------------------------------------
const START_RES = {
  std: { food: 200, wood: 200, gold: 100, stone: 200 },
  med: { food: 500, wood: 500, gold: 500, stone: 500 },
  high: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
};
function makePlayer(i, pc, cfg) {
  const civ = pc.civ === 'random' ? CIV_IDS[Math.floor(Math.random() * CIV_IDS.length)] : pc.civ;
  const p = {
    id: i, name: pc.name, civ, color: pc.color, team: pc.team || 0, ai: pc.ai || null, human: !!pc.human,
    res: Object.assign({}, START_RES[cfg.startRes || 'std']), age: 0, aging: false, techs: {}, techOrder: [], researching: {},
    line: {}, flags: {}, sc: {}, gr: null, pop: 0, cap: 0, alive: true, convRes: 1, commission: .3, tributeFee: .3,
    bell: false, market: { food: 100, wood: 100, stone: 100 }, cnt: {}, cntAll: {}, idle: [], vil: 0, mil: 0,
    st: { gath: { food: 0, wood: 0, gold: 0, stone: 0 }, killsU: 0, lostU: 0, razed: 0, lostB: 0, killV: 0, razeV: 0, techs: 0, techV: 0, conv: 0, trained: 0, built: 0, trib: 0, ageT: [0, null, null, null], wonders: 0, hist: [], feudal: 0 },
    alertT: -99, housedT: -99, known: {}, aiS: null,
  };
  for (const l in LINES) p.line[l] = LINES[l][0];
  for (const fx of CIVS[civ].fx) if (fx.t === 'start') p.res[fx.res] = Math.max(0, p.res[fx.res] + fx.add);
  for (const fx of CIVS[civ].fx) if (fx.t === 'commission') p.commission = fx.set;
  return p;
}
function newGame(cfg) {
  const N = cfg.N;
  G = {
    v: 1, cfg, N, seed: cfg.seed, mapType: cfg.mapType, terrain: new Uint8Array(N * N), time: 0, tick: 0, nextId: 1,
    units: [], blds: [], ress: [], byId: new Map(), players: [], rng: new Rng((cfg.seed ^ 0x9e3779b9) >>> 0),
    block: new Int32Array(N * N).fill(-1), occ: new Int32Array(N * N).fill(-1), rch: [],
    vis: [], proj: [], fx: [], ghosts: [], decals: [], events: [], sfx: [], wonders: {}, relicHold: null,
    over: false, winner: -1, human: -1, dirty: false, visT: 0, secT: 0, aiT: 0, ug: null,
  };
  PF.init(N);
  G.players = cfg.players.map((pc, i) => makePlayer(i, pc, cfg));
  G.human = G.players.findIndex(p => p.human);
  genMap(G);
  // starting age
  const sa = cfg.startAge || 0;
  for (const p of G.players) {
    if (sa > 0) {
      p.age = sa;
      for (const id of ['feudal', 'castle', 'imperial'].slice(0, sa)) { p.techs[id] = true; }
      for (let a = 1; a <= sa; a++) p.st.ageT[a] = 0;
    }
  }
  // starting units
  G.players.forEach((p, i) => {
    const s = G.starts[i];
    spawnBld('tc', i, s.x - 2, s.y - 2, true);
    let nv = 3;
    for (const fx of CIVS[p.civ].fx) if (fx.t === 'startVil') nv += fx.add;
    if (cfg.tutorial && p.human) nv = 3;
    for (let k = 0; k < nv; k++) {
      const a = s.ang + Math.PI + (k - (nv - 1) / 2) * .45;
      spawnUnit('villager', i, s.x + Math.cos(a) * 2.9, s.y + Math.sin(a) * 2.9);
    }
    const a = s.ang + Math.PI * .5;
    spawnUnit('scout', i, s.x + Math.cos(a) * 3.2, s.y + Math.sin(a) * 3.2);
    if (sa >= 2) for (let k = 0; k < 2; k++) spawnUnit('villager', i, s.x + 3 - k * .6, s.y + 3);
    // advanced starts come with houses for the extra population
    let houses = sa >= 2 ? 3 : sa === 1 ? 1 : 0;
    for (let r = 5; r <= 9 && houses > 0; r++) for (let k = 0; k < 12 && houses > 0; k++) {
      const ang = s.ang + Math.PI + k * Math.PI / 6;
      const hx = Math.round(s.x + Math.cos(ang) * r) - 1, hy = Math.round(s.y + Math.sin(ang) * r) - 1;
      if (canPlace(p, 'house', hx, hy, true) && !G.units.some(u => u.x >= hx - .3 && u.x <= hx + 2.3 && u.y >= hy - .3 && u.y <= hy + 2.3)) { spawnBld('house', i, hx, hy, true); houses--; }
    }
  });
  rebuildIndex();
  // vision groups (allies share vision)
  const groups = {};
  G.players.forEach((p, i) => {
    const key = p.team > 0 ? 't' + p.team : 'p' + i;
    if (!groups[key]) groups[key] = new Uint8Array(N * N);
    G.vis[i] = groups[key];
  });
  G.visGroups = Object.values(groups);
  if (cfg.reveal === 'explored' || cfg.attract) for (const v of G.visGroups) v.fill(1);
  census();
  updateVis();
  return G;
}

// ------------------------------------------------------------
// Census: population, counts, idle lists
// ------------------------------------------------------------
function census() {
  for (const p of G.players) {
    p.pop = 0; p.cap = 0; p.cnt = {}; p.cntAll = {}; p.idle = []; p.vil = 0; p.mil = 0;
    p.gathN = { food: 0, wood: 0, gold: 0, stone: 0, build: 0 };
  }
  G.work = new Map();
  for (const u of G.units) {
    if (u.dead || u.owner < 0) continue;
    const p = G.players[u.owner], d = U[u.type];
    if (u.ord.t === 'gather' && u.ord.id) G.work.set(u.ord.id, (G.work.get(u.ord.id) || 0) + 1);
    p.pop += d.pop;
    p.cnt[u.type] = (p.cnt[u.type] || 0) + 1;
    if (u.type === 'villager') {
      p.vil++;
      if (u.ord.t === 'idle' && !u.q.length && !u.gIn) p.idle.push(u);
      if (u.ord.t === 'gather') { const r = byId(u.ord.id); const rk = r ? resKindOf(r) : null; if (rk) p.gathN[rk.res]++; }
      else if (u.ord.t === 'build' || u.ord.t === 'repair') p.gathN.build++;
    } else if (d.pop && !d.animal && u.type !== 'fishingShip') p.mil++;
  }
  for (const b of G.blds) {
    if (b.dead) continue;
    const p = G.players[b.owner];
    p.cntAll[b.type] = (p.cntAll[b.type] || 0) + 1;
    if (b.built) { p.cnt[b.type] = (p.cnt[b.type] || 0) + 1; p.cap += ST(b.owner, b.type).pop; }
  }
  for (const p of G.players) p.cap = Math.min(p.cap, G.cfg.popCap || MAX_POP);
}
function resKindOf(r) {
  if (r.k === 'r') return RES_KIND[r.type];
  if (r.k === 'b' && r.type === 'farm') return RES_KIND.farm;
  if (r.k === 'u' && U[r.type].food) return RES_KIND.carcass;
  return null;
}

// ------------------------------------------------------------
// Visibility / fog of war
// ------------------------------------------------------------
const CIRC = [];
function circOffsets(r) {
  r = Math.min(24, Math.max(1, Math.round(r)));
  if (CIRC[r]) return CIRC[r];
  const o = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * .6) o.push(dx, dy);
  return (CIRC[r] = o);
}
function stamp(v, x, y, r) {
  const N = G.N, o = circOffsets(r), cx = Math.floor(x), cy = Math.floor(y);
  for (let k = 0; k < o.length; k += 2) {
    const tx = cx + o[k], ty = cy + o[k + 1];
    if (tx >= 0 && ty >= 0 && tx < N && ty < N) v[ty * N + tx] = 2;
  }
}
function updateVis() {
  const all = G.cfg.reveal === 'all' || G.cfg.attract;
  for (const v of G.visGroups) {
    if (all) v.fill(2);
    else for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
  }
  if (!all) {
    for (const u of G.units) {
      if (u.dead || u.gIn || u.owner < 0) continue;
      stamp(G.vis[u.owner], u.x, u.y, ST(u.owner, u.type).los);
    }
    for (const b of G.blds) {
      if (b.dead || b.type === 'palisade' || b.type === 'wall') continue;
      stamp(G.vis[b.owner], b.x + b.w / 2, b.y + b.h / 2, ST(b.owner, b.type).los + b.w / 2);
    }
    for (const b of G.blds) if (b.type === 'palisade' || b.type === 'wall') stamp(G.vis[b.owner], b.x + .5, b.y + .5, 1.5);
  }
  // mark buildings as seen by each vision group
  G.players.forEach((p, pi) => {
    const v = G.vis[pi];
    for (const b of G.blds) {
      if (b.dead || allied(b.owner, pi)) continue;
      if (v[tIdx(b.x + b.w / 2, b.y + b.h / 2)] === 2 || v[tIdx(b.x, b.y)] === 2) {
        b.seen |= (1 << pi);
        if (p.ai) p.known[b.id] = { x: b.x + b.w / 2, y: b.y + b.h / 2, type: b.type, owner: b.owner };
      }
    }
  });
  if (G.human >= 0) {
    const v = G.vis[G.human];
    G.ghosts = G.ghosts.filter(g => v[tIdx(g.x + g.w / 2, g.y + g.h / 2)] !== 2);
  }
}
function visibleTo(pi, x, y) { return pi < 0 || G.vis[pi][tIdx(x, y)] === 2; }

// ------------------------------------------------------------
// Main step
// ------------------------------------------------------------
function stepGame() {
  const dt = STEP;
  G.time += dt; G.tick++;
  PF.budget = 40000;
  buildUnitGrid();
  if (G.tick % 3 === 0 || !G.work) census();
  for (const u of G.units) { u.px = u.x; u.py = u.y; }
  for (let i = 0; i < G.units.length; i++) { const u = G.units[i]; if (!u.dead && !u.gIn) updateUnit(u, dt); }
  separate();
  for (let i = 0; i < G.blds.length; i++) { const b = G.blds[i]; if (!b.dead) updateBld(b, dt); }
  updateProj(dt);
  updateFx(dt);
  G.visT -= dt; if (G.visT <= 0) { G.visT = .25; updateVis(); }
  G.secT -= dt; if (G.secT <= 0) { G.secT = 1; perSecond(); }
  if (typeof AI !== 'undefined') for (const p of G.players) if (p.ai && p.alive && (G.tick + p.id * 7) % 15 === 0) AI.think(p);
  if (G.dirty && G.tick % 15 === 0) cleanup();
}
function cleanup() {
  G.dirty = false;
  const keep = e => { if (e.dead) { G.byId.delete(e.id); return false; } return true; };
  G.units = G.units.filter(keep); G.blds = G.blds.filter(keep); G.ress = G.ress.filter(keep);
}

// ------------------------------------------------------------
// Unit behaviour
// ------------------------------------------------------------
function updateUnit(u, dt) {
  if (u.cool > 0) u.cool -= dt;
  if (u.rest > 0) u.rest -= dt;
  if (u.flee > 0) u.flee -= dt;
  u.anim += dt;
  const d = U[u.type];
  const prevAct = u.act;
  if (d.animal && u.owner < 0) animalAI(u, dt);
  else (ORD[u.ord.t] || ORD.idle)(u, u.ord, dt);
  // stuck detection while walking
  if (u.act === 'walk') {
    u.chkT += dt;
    if (u.chkT > 1.2) {
      if (dist(u.x, u.y, u.chkX, u.chkY) < .12) { u.path = null; u.stk = (u.stk || 0) + 1; if (u.stk > 5 && (u.ord.t === 'move' || u.ord.t === 'amove')) { u.stk = 0; nextOrder(u); } }
      else u.stk = 0;
      u.chkT = 0; u.chkX = u.x; u.chkY = u.y;
    }
  } else { u.chkT = 0; u.chkX = u.x; u.chkY = u.y; }
  if (u.relic) { const r = byId(u.relic); if (r) { r.x = u.x; r.y = u.y; } }
  u.vx = (u.x - u.px) / dt; u.vy = (u.y - u.py) / dt;
  if (prevAct !== u.act && u.act !== 'walk') u.anim = 0;
}

const ORD = {};
ORD.idle = (u, o, dt) => {
  u.act = 'idle';
  u.scanT -= dt;
  if (u.scanT > 0) return;
  u.scanT = .45 + rnd() * .25;
  const s = ST(u.owner, u.type);
  if (u.type === 'monk') {
    if (u.relic) return;
    const t = findHealTarget(u, s.los);
    if (t) u.ord = { t: 'heal', id: t.id, auto: true };
    return;
  }
  if (isVil(u) || u.type === 'fishingShip' || !s.atk || u.stance === 'none') return;
  // defensive units drift back to their guard spot
  if (u.stance === 'def' && dist(u.x, u.y, u.gx, u.gy) > 1.5) { u.ord = { t: 'move', x: u.gx, y: u.gy }; return; }
  const range = u.stance === 'stand' ? s.rng + .5 : s.los;
  const t = findTarget(u, range);
  if (t) u.ord = { t: 'attack', id: t.id, auto: true };
};
ORD.move = (u, o, dt) => {
  if (!u.path) {
    if (!requestPath(u, { x0: o.x, y0: o.y, x1: o.x, y1: o.y, d: .55, px: o.x, py: o.y })) { u.act = 'idle'; return; }
    if (!u.path.length) { nextOrder(u); u.gx = u.x; u.gy = u.y; return; }
  }
  const r = moveAlong(u, dt, o.spd);
  if (r === 'arrived') { u.gx = u.x; u.gy = u.y; nextOrder(u); }
  else if (r === 'blocked') { o.f = (o.f || 0) + 1; if (o.f > 8) nextOrder(u); }
};
ORD.amove = (u, o, dt) => {
  u.scanT -= dt;
  if (u.scanT <= 0) {
    u.scanT = .4 + rnd() * .2;
    const s = ST(u.owner, u.type);
    const t = s.atk > 0 ? findTarget(u, s.los + 1, true) : null;
    if (t) { u.q.unshift(o); u.ord = { t: 'attack', id: t.id, auto: true }; u.path = null; return; }
  }
  ORD.move(u, o, dt);
  if (u.ord.t === 'idle' && o.patrol) { // patrol: bounce between the two points
    u.ord = { t: 'amove', x: o.bx, y: o.by, bx: o.x, by: o.y, patrol: true };
  }
};
ORD.attack = (u, o, dt) => {
  const t = byId(o.id);
  const s = ST(u.owner, u.type);
  if (!t || t.dead || t.gIn || t.k === 'r' || (t.k === 'u' && t.owner === u.owner && u.owner >= 0) || (t.owner >= 0 && allied(t.owner, u.owner) && !o.force) || !s.atk) { nextOrder(u); return; }
  if (s.onlyBld && t.k === 'u' && !U[t.type].cls.includes('siege')) { nextOrder(u); return; }
  // lose track of targets hidden in fog
  if (t.k === 'u' && u.owner >= 0 && !visibleTo(u.owner, t.x, t.y)) { nextOrder(u); return; }
  // defensive: do not chase too far
  if (o.auto && u.stance === 'def' && dist(u.x, u.y, u.gx, u.gy) > 7) { u.ord = { t: 'move', x: u.gx, y: u.gy }; u.q = []; u.path = null; return; }
  const ranged = s.rng > 0;
  const range = ranged ? s.rng : (t.k === 'u' ? .3 : .42);
  const g = gapTo(u, t);
  if (ranged && s.minRng && g < s.minRng) {
    if (u.stance === 'stand' || o.auto) { nextOrder(u); return; }
    // step back
    const dx = u.x - t.x, dy = u.y - t.y, d = Math.hypot(dx, dy) || 1;
    if (!stepDirect(u, u.x + dx / d, u.y + dy / d, dt)) nextOrder(u);
    return;
  }
  if (g > range) {
    if (u.stance === 'stand' && o.auto) { nextOrder(u); return; }
    u.setT = 0;
    const r = approach(u, t, range, dt);
    if (r < 0) nextOrder(u);
    return;
  }
  u.path = null;
  face(u, t.x - u.x, t.y - u.y);
  if (s.setup && u.setT < s.setup) { u.setT += dt; u.act = 'setup'; return; }
  u.act = 'attack';
  if (u.cool <= 0) {
    doAttack(u, s, t);
    u.cool = s.rof; u.anim = 0;
  }
};
ORD.ground = (u, o, dt) => {
  const s = ST(u.owner, u.type);
  if (!s.ground) { nextOrder(u); return; }
  const g = dist(u.x, u.y, o.x, o.y) - u.r;
  if (g > s.rng) { const fake = { k: 'p', x: o.x, y: o.y, r: 0, id: -1 }; approach(u, fake, s.rng, dt); u.setT = 0; return; }
  u.path = null; face(u, o.x - u.x, o.y - u.y);
  if (s.setup && u.setT < s.setup) { u.setT += dt; u.act = 'setup'; return; }
  u.act = 'attack';
  if (u.cool <= 0) { fireAt(u, s, null, o.x, o.y); u.cool = s.rof; u.anim = 0; }
};
ORD.gather = (u, o, dt) => {
  const p = G.players[u.owner];
  let t = byId(o.id);
  // live animal: hunt it first
  if (t && t.k === 'u' && !t.dead) {
    if (!U[t.type].food || isShip(u)) { nextOrder(u); return; }
    o.lx = t.x; o.ly = t.y; o.rtype = t.type;
    const r = approach(u, t, .3, dt);
    if (r < 0) { nextOrder(u); return; }
    if (r === 1) { u.act = 'attack'; face(u, t.x - u.x, t.y - u.y); if (u.cool <= 0) { doAttack(u, ST(u.owner, u.type), t); u.cool = 1.5; u.anim = 0; } }
    return;
  }
  if (t && t.k === 'u' && t.dead) t = null;
  if (!t || t.dead || (t.k === 'r' && t.amt <= 0) || (t.k === 'b' && (t.type !== 'farm' || !t.built || t.owner !== u.owner))) {
    // look for a replacement of the same kind nearby
    const nt = findReplacement(u, o);
    if (!nt) { if (u.carry > 0) { o.ph = 'drop'; o.id = 0; t = null; } else { nextOrder(u); return; } }
    else { o.id = nt.id; t = nt; o.ph = u.carry >= carryCap(p, u.type) ? 'drop' : (o.ph === 'drop' ? 'drop' : 'go'); }
  }
  const rk = t ? resKindOf(t) : RES_KIND[o.rtype] || null;
  if (rk && u.cres && u.cres !== rk.res && u.carry > 0) { u.carry = 0; }
  if (t) { o.rtype = t.k === 'b' ? 'farm' : t.type; o.lx = t.x; o.ly = t.y; }
  if (o.ph === 'drop') { doDrop(u, o, dt, rk ? rk.res : u.cres); return; }
  // go / work — spread out instead of crowding one resource
  if (t.k === 'r' && WORK_CAP[t.type] && (G.tick + u.id) % 12 === 0 && (G.work.get(t.id) || 0) > WORK_CAP[t.type] && gapTo(u, t) > .8) {
    const alt = t.type === 'carcass' ? null : findNearestRes(t.x, t.y, t.type, 6, u, WORK_CAP[t.type]);
    if (alt) { G.work.set(t.id, G.work.get(t.id) - 1); G.work.set(alt.id, (G.work.get(alt.id) || 0) + 1); o.id = alt.id; t = alt; u.path = null; }
  }
  const range = t.k === 'b' ? .05 : (t.type === 'carcass' ? .3 : .42);
  const r = approach(u, t, range, dt);
  if (r < 0) { o.bad = (o.bad || 0) + 1; if (o.bad > 2) { nextOrder(u); return; } o.id = 0; return; }
  if (r === 0) return;
  // working
  u.act = 'gather';
  if (t.k === 'b') { const c = [t.x + t.w / 2, t.y + t.h / 2]; face(u, c[0] - u.x, c[1] - u.y); } else face(u, t.x - u.x, t.y - u.y);
  u.cres = rk.res;
  const cap = carryCap(p, u.type);
  let take = gatherRate(p, rk.g) * dt;
  if (t.k === 'b') { take = Math.min(take, t.food, cap - u.carry); t.food -= take; }
  else { take = Math.min(take, t.amt, cap - u.carry); t.amt -= take; }
  u.carry += take;
  if (rk.g === 'wood' || rk.g === 'gold' || rk.g === 'stone') if (u.anim > .7) { u.anim = 0; if (rnd() < .5) G.sfx.push({ s: rk.g === 'wood' ? 'chop' : 'mine', x: u.x, y: u.y }); }
  if (t.k === 'b' && t.food <= 0) { farmExhausted(t, u); return; }
  if (t.k === 'r' && t.amt <= 0) { depleted(t); }
  if (u.carry >= cap - 1e-6) { o.ph = 'drop'; u.path = null; }
};
function findReplacement(u, o) {
  const x = o.lx != null ? o.lx : u.x, y = o.ly != null ? o.ly : u.y;
  const rt = o.rtype;
  if (!rt) return null;
  if (rt === 'farm') return null;
  if (rt === 'carcass' || rt === 'deer' || rt === 'boar' || rt === 'sheep') {
    let best = null, bd = 6;
    for (const r of G.ress) if (!r.dead && r.type === 'carcass' && r.amt > 0) { const d = dist(r.x, r.y, x, y); if (d < bd) { bd = d; best = r; } }
    if (!best && rt !== 'carcass') { // hunted animal died elsewhere: look for its carcass
      for (const r of G.ress) if (!r.dead && r.type === 'carcass' && r.amt > 0 && dist(r.x, r.y, x, y) < 3) return r;
    }
    return best;
  }
  return findNearestRes(x, y, rt, 9, u);
}
function hasAccess(r, ship) {
  const N = G.N, tx = Math.floor(r.x), ty = Math.floor(r.y);
  for (const [dx, dy] of DIRS8) {
    const x = tx + dx, y = ty + dy;
    if (x < 0 || y < 0 || x >= N || y >= N) continue;
    const i = y * N + x;
    if (ship ? passWater(i) : (G.terrain[i] !== TER.DEEP && G.block[i] < 0)) return true;
  }
  return false;
}
const WORK_CAP = { tree: 2, berry: 3, gold: 3, stone: 3, fish: 2, carcass: 5 };
function findNearestRes(x, y, type, maxD, u, maxWork) {
  const n = Math.ceil(G.N / RCH), cx = Math.floor(x / RCH), cy = Math.floor(y / RCH);
  const ship = u && isShip(u);
  let best = null, bd = maxD;
  const rings = Math.ceil(maxD / RCH) + 1;
  for (let ring = 0; ring <= rings; ring++) {
    for (let yy = cy - ring; yy <= cy + ring; yy++) for (let xx = cx - ring; xx <= cx + ring; xx++) {
      if (Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) !== ring) continue;
      if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
      const c = G.rch[yy * n + xx]; if (!c) continue;
      for (const id of c) {
        const r = G.byId.get(id);
        if (!r || r.dead || r.type !== type || r.amt <= 0) continue;
        if (maxWork != null && G.work && (G.work.get(r.id) || 0) >= maxWork) continue;
        const d = dist(r.x, r.y, x, y);
        if (d < bd && hasAccess(r, ship)) { bd = d; best = r; }
      }
    }
    if (best && ring * RCH > bd + RCH) break;
  }
  return best;
}
function findDrop(u, res) {
  let best = null, bd = 1e9;
  const ship = isShip(u);
  for (const b of G.blds) {
    if (b.dead || !b.built || b.owner !== u.owner) continue;
    const d = B[b.type];
    if (!d.drop.includes(res)) continue;
    if (ship !== (b.type === 'dock')) continue;
    const dd = distToRect(u.x, u.y, b.x, b.y, b.x + b.w, b.y + b.h);
    if (dd < bd) { bd = dd; best = b; }
  }
  return best;
}
function doDrop(u, o, dt, res) {
  res = res || u.cres;
  let b = byId(o.drop);
  if (!b || b.dead || !b.built) { b = findDrop(u, res); o.drop = b ? b.id : 0; u.path = null; }
  if (!b) { u.act = 'idle'; o.ph = 'go'; if (!o.id) nextOrder(u); return; }
  const r = approach(u, b, .45, dt);
  if (r < 0) { o.drop = 0; o.dropF = (o.dropF || 0) + 1; if (o.dropF > 3) nextOrder(u); return; }
  if (r === 0) return;
  deposit(u);
  o.ph = 'go'; o.drop = 0; u.path = null;
}
function deposit(u) {
  if (u.carry <= 0 || !u.cres) return;
  const p = G.players[u.owner];
  const amt = u.carry * (p.ai === 'hardest' ? 1.2 : 1);
  p.res[u.cres] += amt; p.st.gath[u.cres] += amt;
  u.carry = 0;
}
function depleted(r) {
  if (r.dead) return;
  r.dead = true; G.dirty = true; gridDel(r);
  if (r.type === 'tree') G.decals.push({ k: 'stump', x: r.x, y: r.y, t: G.time, v: r.v });
}
function farmExhausted(f, u) {
  const p = G.players[f.owner];
  const tx = f.x, ty = f.y;
  killEnt(f, -1, true);
  const cost = ST(f.owner, 'farm').cost;
  if (p.autoReseed !== false && canAfford(p, cost)) {
    pay(p, cost);
    const nf = spawnBld('farm', f.owner, tx, ty, false);
    u.ord = { t: 'build', id: nf.id }; u.path = null;
  } else {
    if (p.human) pushEvent('farmGone', f.owner, { x: tx + 1.5, y: ty + 1.5 });
    nextOrder(u);
  }
}
ORD.build = (u, o, dt) => {
  const b = byId(o.id);
  if (!b || b.dead || b.owner !== u.owner) { nextOrder(u); return; }
  if (b.built) {
    if (o.t === 'build') { afterBuild(u, b); return; }
  }
  const range = b.type === 'farm' ? .3 : .42;
  const r = approach(u, b, range, dt);
  if (r < 0) { nextOrder(u); return; }
  if (r === 0) return;
  u.act = 'build';
  face(u, b.x + b.w / 2 - u.x, b.y + b.h / 2 - u.y);
  b.bc++;
  if (u.anim > .55) { u.anim = 0; if (rnd() < .5) G.sfx.push({ s: 'hammer', x: u.x, y: u.y }); }
};
ORD.repair = (u, o, dt) => {
  const b = byId(o.id);
  if (!b || b.dead || !b.built || b.hp >= b.mhp || !allied(b.owner, u.owner)) { nextOrder(u); return; }
  const r = approach(u, b, .42, dt);
  if (r < 0) { nextOrder(u); return; }
  if (r === 0) return;
  u.act = 'build'; face(u, b.x + b.w / 2 - u.x, b.y + b.h / 2 - u.y);
  const p = G.players[u.owner], s = ST(b.owner, b.type);
  const hpRate = Math.max(8, b.mhp / s.time * 1.5) * dt;
  // repairing costs half the build cost per full HP
  const frac = hpRate / b.mhp;
  const need = {};
  for (const k in s.cost) need[k] = s.cost[k] * .5 * frac;
  if (!canAfford(p, need)) { nextOrder(u); return; }
  pay(p, need);
  b.hp = Math.min(b.mhp, b.hp + hpRate);
  if (u.anim > .55) { u.anim = 0; if (rnd() < .5) G.sfx.push({ s: 'hammer', x: u.x, y: u.y }); }
};
function afterBuild(u, b) {
  nextOrder(u);
  if (u.ord.t !== 'idle') return;
  const d = B[b.type];
  if (b.type === 'farm') { u.ord = { t: 'gather', id: b.id, ph: 'go' }; return; }
  const want = d.drop.length === 1 ? d.drop[0] : null;
  if (b.type === 'lumber' || b.type === 'mining' || b.type === 'mill') {
    const types = b.type === 'lumber' ? ['tree'] : b.type === 'mining' ? ['gold', 'stone'] : ['berry'];
    let best = null;
    for (const ty of types) { const r = findNearestRes(b.x + b.w / 2, b.y + b.h / 2, ty, 8, u); if (r && (!best || dist(r.x, r.y, u.x, u.y) < dist(best.x, best.y, u.x, u.y))) best = r; }
    if (best) { u.ord = { t: 'gather', id: best.id, ph: 'go' }; return; }
  }
  // help nearby construction
  let nb = null, nd = 10;
  for (const ob of G.blds) if (!ob.dead && !ob.built && ob.owner === u.owner) { const dd = dist(ob.x, ob.y, u.x, u.y); if (dd < nd) { nd = dd; nb = ob; } }
  if (nb) u.ord = { t: 'build', id: nb.id };
  void want;
}
ORD.garrison = (u, o, dt) => {
  const b = byId(o.id);
  if (!b || b.dead || !b.built || !canGarrison(u, b)) { nextOrder(u); return; }
  const r = approach(u, b, .45, dt);
  if (r < 0) { nextOrder(u); return; }
  if (r === 1) enterBld(u, b);
};
function canGarrison(u, b) {
  const d = B[b.type];
  if (!d.garrison || !allied(b.owner, u.owner) || b.owner !== u.owner) return false;
  if (b.gar.length >= d.garrison) return false;
  return d.gcls.some(c => U[u.type].cls.includes(c));
}
function enterBld(u, b) {
  if (isVil(u) && u.carry > 0 && B[b.type].drop.includes(u.cres)) deposit(u);
  b.gar.push(u.id); u.gIn = b.id; u.path = null; u.ord = { t: 'idle' }; u.q = []; u.act = 'idle';
  G.sfx.push({ s: 'garrison', x: u.x, y: u.y, p: u.owner });
}
function ejectAll(b, filterFn) {
  const out = [];
  b.gar = b.gar.filter(id => {
    const u = byId(id);
    if (!u || u.dead) return false;
    if (filterFn && !filterFn(u)) return true;
    out.push(u); return false;
  });
  out.forEach((u, k) => {
    u.gIn = 0;
    const sp = freeSpotNear(b, u, k);
    u.x = u.px = sp[0]; u.y = u.py = sp[1];
    u.ord = { t: 'idle' };
    if (b.rally && !b.dead) u.ord = { t: 'move', x: b.rally.x + (k % 4) * .4, y: b.rally.y + Math.floor(k / 4) * .4 };
  });
  return out;
}
function freeSpotNear(b, u, k) {
  const pxy = passXYFor(u);
  const tx = b.rally ? b.rally.x : b.x + b.w + 1, ty = b.rally ? b.rally.y : b.y + b.h + 1;
  const cands = [];
  for (let r = 0; r < 4; r++) {
    for (let y = b.y - 1 - r; y <= b.y + b.h + r; y++) for (let x = b.x - 1 - r; x <= b.x + b.w + r; x++) {
      if (x >= b.x - r && x < b.x + b.w + r && y >= b.y - r && y < b.y + b.h + r) continue;
      if (pxy(x + .5, y + .5)) cands.push([x + .5, y + .5]);
    }
    if (cands.length) break;
  }
  if (!cands.length) return [b.x + b.w / 2, b.y + b.h + .5];
  cands.sort((a, c) => dist(a[0], a[1], tx, ty) - dist(c[0], c[1], tx, ty));
  const c = cands[Math.min(cands.length - 1, (k || 0) % 3)];
  return [c[0] + (rnd() - .5) * .3, c[1] + (rnd() - .5) * .3];
}
// --- monks ---
function findHealTarget(u, r) {
  let best = null, bd = r;
  unitsNear(u.x, u.y, r, t => {
    if (t === u || t.dead || t.hp >= t.mhp || !allied(t.owner, u.owner) || U[t.type].cls.includes('siege') || isShip(t) || U[t.type].animal) return;
    const d = dist(u.x, u.y, t.x, t.y); if (d < bd) { bd = d; best = t; }
  });
  return best;
}
ORD.heal = (u, o, dt) => {
  const t = byId(o.id);
  if (!t || t.dead || t.gIn || t.hp >= t.mhp || !allied(t.owner, u.owner) || u.relic) { nextOrder(u); return; }
  const r = approach(u, t, 3.5, dt);
  if (r < 0) { nextOrder(u); return; }
  if (r === 0) return;
  u.act = 'heal'; face(u, t.x - u.x, t.y - u.y);
  t.hp = Math.min(t.mhp, t.hp + ST(u.owner, u.type).heal * dt * 1.2);
};
ORD.convert = (u, o, dt) => {
  const t = byId(o.id);
  if (!t || t.dead || t.gIn || t.k !== 'u' || !isEnemy(u.owner, t.owner) || U[t.type].noConvert || u.relic) { nextOrder(u); return; }
  if (u.rest > 0) { u.act = 'idle'; return; }
  const s = ST(u.owner, u.type);
  const r = approach(u, t, s.rng, dt);
  if (r < 0) { nextOrder(u); return; }
  if (r === 0) { o.ct = 0; return; }
  u.act = 'convert'; face(u, t.x - u.x, t.y - u.y);
  if (!o.ct) { o.ct = 0; o.need = (4 + rnd() * 6) * G.players[t.owner].convRes * (U[t.type].cls.includes('monk') ? 1.4 : 1); G.sfx.push({ s: 'wololo', x: u.x, y: u.y }); }
  o.ct += dt;
  if (o.ct >= o.need) {
    convertUnit(t, u.owner);
    u.rest = 62 * s.recharge;
    nextOrder(u);
  }
};
function convertUnit(t, owner) {
  const old = t.owner;
  G.players[old].st.lostU++;
  G.players[owner].st.conv++;
  if (t.relic) dropRelic(t);
  const ratio = t.hp / t.mhp;
  t.owner = owner; t.ord = { t: 'idle' }; t.q = []; t.path = null; t.gx = t.x; t.gy = t.y;
  t.mhp = ST(owner, t.type).hp; t.hp = Math.max(1, ratio * t.mhp);
  G.fx.push({ k: 'conv', x: t.x, y: t.y, t: 0, life: 1.2 });
  pushEvent('converted', old, { x: t.x, y: t.y });
}
ORD.relic = (u, o, dt) => {
  const r = byId(o.id);
  if (!r || r.dead || r.carrier || r.inB || u.type !== 'monk' || u.relic) { nextOrder(u); return; }
  const a = approach(u, r, .3, dt);
  if (a < 0) { nextOrder(u); return; }
  if (a === 1) { r.carrier = u.id; u.relic = r.id; nextOrder(u); G.sfx.push({ s: 'relic', x: u.x, y: u.y, p: u.owner }); }
};
ORD.relicIn = (u, o, dt) => {
  const b = byId(o.id);
  if (!b || b.dead || !b.built || b.type !== 'monastery' || !u.relic || !allied(b.owner, u.owner)) { nextOrder(u); return; }
  const a = approach(u, b, .45, dt);
  if (a < 0) { nextOrder(u); return; }
  if (a === 1) {
    const r = byId(u.relic);
    if (r) { r.carrier = 0; r.inB = b.id; b.relics.push(r.id); }
    u.relic = 0; nextOrder(u);
    G.sfx.push({ s: 'relic', x: u.x, y: u.y, p: u.owner });
    pushEvent('relicStored', b.owner, { x: b.x + 1.5, y: b.y + 1.5 });
  }
};
function dropRelic(u) {
  const r = byId(u.relic);
  if (r) { r.carrier = 0; r.x = u.x; r.y = u.y; }
  u.relic = 0;
}

// --- target acquisition ---
function findTarget(u, range, preferUnits) {
  const s = ST(u.owner, u.type);
  let best = null, bs = 1e9;
  if (!s.onlyBld && !U[u.type].cls.includes('treb')) {
    unitsNear(u.x, u.y, range, t => {
      if (!hostile(u, t)) return;
      const d = dist(u.x, u.y, t.x, t.y);
      if (d > range + t.r) return;
      if (s.minRng && d < s.minRng + t.r) return;
      if (!isShip(u) && isShip(t) && s.rng < 1) return;
      if (isShip(u) && !isShip(t) && s.rng < 1) return;
      let sc = d;
      const ts = U[t.type];
      if (ts.animal) sc += 4;
      if (ts.cls.includes('villager')) sc += 1.2;
      if (t.att === u.id) sc -= 2;
      if (sc < bs) { bs = sc; best = t; }
    });
  }
  if (best) return best;
  if (U[u.type].cls.includes('villager') || u.type === 'monk') return null;
  bldsNear(u.x, u.y, range, b => {
    if (!isEnemy(u.owner, b.owner) || B[b.type].wall) return;
    if (isShip(u) !== !!B[b.type].water && s.rng < 1) return;
    const d = distToRect(u.x, u.y, b.x, b.y, b.x + b.w, b.y + b.h);
    if (s.minRng && d < s.minRng) return;
    if (d < bs) { bs = d; best = b; }
  });
  return best;
}

// --- animals ---
function animalAI(u, dt) {
  const d = U[u.type];
  if (u.ord.t === 'attack') { ORD.attack(u, u.ord, dt); return; }
  if (u.ord.t === 'move') { ORD.move(u, u.ord, dt); return; }
  u.act = 'idle';
  u.scanT -= dt;
  if (u.scanT > 0) return;
  u.scanT = .5 + rnd() * .5;
  if (d.animal === 'wolf') {
    let tgt = null, bd = d.los;
    unitsNear(u.x, u.y, d.los, t => { if (hostile(u, t)) { const dd = dist(u.x, u.y, t.x, t.y); if (dd < bd) { bd = dd; tgt = t; } } });
    if (tgt) { u.ord = { t: 'attack', id: tgt.id, auto: true }; return; }
  }
  if (d.animal === 'boar' && u.att && G.time - u.lastHit < 6) {
    const a = byId(u.att);
    if (a && !a.dead && !a.gIn) { u.ord = { t: 'attack', id: a.id, auto: true, force: true }; return; }
  }
  if (d.animal === 'flee' && u.flee > 0) {
    const a = byId(u.att);
    if (a) { const dx = u.x - a.x, dy = u.y - a.y, dd = Math.hypot(dx, dy) || 1; const tx = clamp(u.x + dx / dd * 2, 1, G.N - 1), ty = clamp(u.y + dy / dd * 2, 1, G.N - 1); u.ord = { t: 'move', x: tx, y: ty, spd: d.spd * .55 }; }
    return;
  }
  if (rnd() < .06) {
    const tx = clamp(u.hx + (rnd() - .5) * 4, 1, G.N - 1), ty = clamp(u.hy + (rnd() - .5) * 4, 1, G.N - 1);
    if (passLand(tIdx(tx, ty), -1)) u.ord = { t: 'move', x: tx, y: ty, spd: d.spd * .4 };
  }
}

// ------------------------------------------------------------
// Combat
// ------------------------------------------------------------
function calcDmg(s, t) {
  const ts = ST(t.owner, t.type);
  let base = s.atk - (s.at === 'm' ? ts.armM : ts.armP);
  if (base < 0) base = 0;
  let bonus = 0;
  for (const k in s.bonus) if (ts.cls.includes(k)) bonus += s.bonus[k];
  return Math.max(1, base + bonus);
}
function doAttack(u, s, t) {
  if (s.rng > 0 && s.proj) {
    for (let k = 0; k < (s.shots || 1); k++) fireAt(u, s, t, null, null, k);
    G.sfx.push({ s: s.proj === 'ball' ? 'gun' : (s.proj === 'stone' || s.proj === 'boulder') ? 'catapult' : 'bow', x: u.x, y: u.y });
  } else {
    damage(t, calcDmg(s, t), u);
    G.sfx.push({ s: U[u.type].cls.includes('siege') ? 'ram' : (t.k === 'b' ? 'hitBld' : 'sword'), x: u.x, y: u.y });
  }
}
function fireAt(src, s, t, gx, gy, k) {
  const P = PROJ[s.proj] || PROJ.arrow;
  const sx = src.k === 'b' ? src.x + src.w / 2 : src.x, sy = src.k === 'b' ? src.y + src.h / 2 : src.y;
  let tx, ty, isB = false;
  if (t) {
    if (t.k === 'b') { isB = true; const c = closestOnRect(sx, sy, t.x + .3, t.y + .3, t.x + t.w - .3, t.y + t.h - .3); tx = c[0] + (rnd() - .5) * .5; ty = c[1] + (rnd() - .5) * .5; }
    else { tx = t.x; ty = t.y; }
  } else { tx = gx; ty = gy; }
  let d = dist(sx, sy, tx, ty);
  const owner = src.owner;
  // ballistics: lead moving targets
  if (t && t.k === 'u' && owner >= 0 && G.players[owner].flags.ballistics) {
    const tt = d / P.spd; tx += (t.vx || 0) * tt; ty += (t.vy || 0) * tt; d = dist(sx, sy, tx, ty);
  }
  let acc = s.acc;
  if (s.accUnit && t && t.k === 'u') acc = s.accUnit;
  if (isB) acc = Math.max(acc, .92);
  if (k) acc *= .85;
  if (t && rnd() > acc) { // miss
    const a = rnd() * Math.PI * 2, m = .45 + rnd() * (.5 + d * .06);
    tx += Math.cos(a) * m; ty += Math.sin(a) * m;
  }
  const dur = Math.max(.12, d / P.spd);
  const z0 = src.k === 'b' ? (src.type === 'castle' ? 2.6 : src.type === 'tower' ? 2.4 : 1.6) : (isShip(src) ? .5 : (U[src.type].cls.includes('cavalry') ? .55 : .42));
  G.proj.push({ x0: sx, y0: sy, z0, x1: tx, y1: ty, t: 0, dur, arc: P.arc * d + .1, kind: s.proj, owner, atk: s.atk, at: s.at, bonus: s.bonus, area: s.area || 0, ff: !!s.ff, tid: t ? t.id : 0, src: src.id, stype: src.type });
}
function updateProj(dt) {
  if (!G.proj.length) return;
  const keep = [];
  for (const pr of G.proj) {
    pr.t += dt;
    if (pr.t >= pr.dur) impact(pr); else keep.push(pr);
  }
  G.proj = keep;
}
function impact(pr) {
  const s = { atk: pr.atk, at: pr.at, bonus: pr.bonus };
  const src = byId(pr.src) || { owner: pr.owner, id: pr.src, type: pr.stype, x: pr.x0, y: pr.y0, k: 'x' };
  if (pr.area > 0) {
    const R = pr.area;
    unitsNear(pr.x1, pr.y1, R + .5, t => {
      if (t.dead || t.gIn || t.k !== 'u') return;
      if (!pr.ff && !isEnemy(pr.owner, t.owner)) return;
      if (t.owner === -1 && U[t.type].animal && !pr.ff) return;
      const d = dist(t.x, t.y, pr.x1, pr.y1) - t.r;
      if (d > R) return;
      const f = d < R * .5 ? 1 : .5;
      damage(t, Math.max(1, Math.round(calcDmg(s, t) * f)), src);
    });
    bldsNear(pr.x1, pr.y1, R, b => { if (pr.ff || isEnemy(pr.owner, b.owner)) damage(b, calcDmg(s, b), src); });
    G.fx.push({ k: 'boom', x: pr.x1, y: pr.y1, t: 0, life: .8, big: pr.kind === 'boulder' });
    G.sfx.push({ s: 'impact', x: pr.x1, y: pr.y1 });
    return;
  }
  const t = byId(pr.tid);
  let hit = null;
  if (t && !t.dead && !t.gIn) {
    if (t.k === 'b') { if (distToRect(pr.x1, pr.y1, t.x, t.y, t.x + t.w, t.y + t.h) < .4) hit = t; }
    else if (dist(pr.x1, pr.y1, t.x, t.y) < t.r + .2) hit = t;
  }
  if (!hit) {
    unitsNear(pr.x1, pr.y1, .6, o => { if (!hit && !o.dead && !o.gIn && isEnemy(pr.owner, o.owner) && dist(o.x, o.y, pr.x1, pr.y1) < o.r + .1) hit = o; });
  }
  if (hit) {
    damage(hit, calcDmg(s, hit), src);
    if (pr.kind === 'ball' || pr.kind === 'boulder') G.fx.push({ k: 'dust', x: pr.x1, y: pr.y1, t: 0, life: .6 });
  } else {
    if (pr.kind === 'arrow' || pr.kind === 'bolt') G.fx.push({ k: 'stuck', x: pr.x1, y: pr.y1, t: 0, life: 6, a: Math.atan2(pr.y1 - pr.y0, pr.x1 - pr.x0) });
    else G.fx.push({ k: 'dust', x: pr.x1, y: pr.y1, t: 0, life: .6 });
  }
}
function damage(t, dmg, src) {
  if (t.dead || G.over && G.cfg.attract) return;
  if (t.k === 'r') return;
  t.hp -= dmg;
  t.lastHit = G.time;
  const so = src ? src.owner : -1;
  if (t.k === 'u') {
    t.att = src && src.id > 0 ? src.id : t.att;
    if (U[t.type].animal === 'flee') t.flee = 1.2;
  }
  if (t.owner >= 0 && so !== t.owner && (so >= 0 || (src && src.type === 'wolf'))) underAttack(t);
  if (t.hp <= 0) { killEnt(t, so); return; }
  // retaliation
  if (t.k === 'u' && src && src.k === 'u' && !src.dead && t.owner >= 0) {
    const ts = ST(t.owner, t.type);
    const idle = t.ord.t === 'idle';
    if (ts.atk > 0 && t.stance !== 'none' && hostile(t, src)) {
      if (isVil(t)) {
        if ((idle || t.ord.t === 'gather') && U[src.type].animal) { t.q = []; if (t.ord.t === 'gather') t.q.push(t.ord); t.ord = { t: 'attack', id: src.id, auto: true }; t.path = null; }
      } else if (idle && t.type !== 'monk' && (t.stance !== 'stand' || gapTo(t, src) <= ts.rng + .3)) {
        t.ord = { t: 'attack', id: src.id, auto: true }; t.path = null;
      }
    }
    // nearby idle soldiers respond
    if (G.time - (t.helpT || -9) > 1) {
      t.helpT = G.time;
      unitsNear(t.x, t.y, 6, f => {
        if (f.owner !== t.owner || f.ord.t !== 'idle' || isVil(f) || f.stance !== 'agg' || f.type === 'monk') return;
        const fs = ST(f.owner, f.type);
        if (fs.atk > 0 && hostile(f, src) && (!fs.onlyBld)) { f.ord = { t: 'attack', id: src.id, auto: true }; f.path = null; }
      });
    }
  }
}
function underAttack(t) {
  const p = G.players[t.owner];
  if (G.time - p.alertT > 18) {
    p.alertT = G.time;
    pushEvent(t.k === 'b' ? 'bldAttacked' : (isVil(t) ? 'vilAttacked' : 'underAttack'), t.owner, { x: t.x + (t.w || 0) / 2, y: t.y + (t.h || 0) / 2, snd: 'alert' });
  }
  p.lastAttack = { x: t.x + (t.w || 0) / 2, y: t.y + (t.h || 0) / 2, t: G.time };
}
function unitValue(type) { const c = defOf(type).cost || {}; return (c.food || 0) + (c.wood || 0) + (c.gold || 0) + (c.stone || 0); }
function killEnt(e, killer, silent) {
  if (e.dead) return;
  e.dead = true; G.dirty = true;
  const kp = killer >= 0 ? G.players[killer] : null;
  if (e.k === 'u') {
    if (e.relic) dropRelic(e);
    if (e.owner >= 0) {
      G.players[e.owner].st.lostU++;
      if (kp && killer !== e.owner) { kp.st.killsU++; kp.st.killV += unitValue(e.type); }
    }
    const d = U[e.type];
    if (d.food) spawnRes('carcass', e.x, e.y, d.food).anim = e.type;
    G.fx.push({ k: 'corpse', type: e.type, owner: e.owner, x: e.x, y: e.y, fr: e.fr, t: 0, life: d.cls.includes('siege') || isShip(e) ? 14 : 28 });
    if (!silent) G.sfx.push({ s: d.cls.includes('siege') ? 'crash' : isShip(e) ? 'crash' : (d.animal ? 'thud' : 'die'), x: e.x, y: e.y });
  } else if (e.k === 'b') {
    gridDel(e);
    ejectAll(e);
    for (const rid of e.relics) { const r = byId(rid); if (r) { r.inB = 0; r.x = e.x + e.w / 2 + (rnd() - .5); r.y = e.y + e.h + .3; } }
    e.relics = [];
    for (const it of e.q) refundItem(G.players[e.owner], it);
    e.q = [];
    const p = G.players[e.owner];
    if (!silent) {
      p.st.lostB++;
      if (kp && killer !== e.owner) { kp.st.razed++; kp.st.razeV += unitValue(e.type); }
      if (e.type !== 'farm') {
        G.decals.push({ k: 'rubble', x: e.x, y: e.y, w: e.w, h: e.h, t: G.time });
        for (let i = 0; i < 6 + e.w * 3; i++) G.fx.push({ k: 'smoke', x: e.x + rnd() * e.w, y: e.y + rnd() * e.h, t: -rnd() * .6, life: 2 + rnd() * 2, big: 1 });
        G.sfx.push({ s: 'collapse', x: e.x + e.w / 2, y: e.y + e.h / 2 });
        if (G.human >= 0 && (e.seen & (1 << G.human)) && !allied(e.owner, G.human) && !visibleTo(G.human, e.x + e.w / 2, e.y + e.h / 2)) G.ghosts.push({ type: e.type, owner: e.owner, x: e.x, y: e.y, w: e.w, h: e.h, built: e.built });
        pushEvent('bldLost', e.owner, { x: e.x + e.w / 2, y: e.y + e.h / 2, type: e.type });
      }
    }
    if (G.wonders[e.id]) { delete G.wonders[e.id]; pushEvent('wonderLost', -1, { owner: e.owner }); }
    if (e.type === 'monastery') checkRelicHold();
  } else if (e.k === 'r') gridDel(e);
}
function refundItem(p, it) {
  if (it.k === 'u') addRes(p, ST(p.id, it.type).cost);
  else { addRes(p, techCost(p, it.id)); delete p.researching[it.id]; if (T[it.id].ageUp) p.aging = false; }
}

// ------------------------------------------------------------
// Buildings
// ------------------------------------------------------------
function updateBld(b, dt) {
  const p = G.players[b.owner], d = B[b.type];
  if (!b.built) {
    if (b.bc > 0) {
      const s = ST(b.owner, b.type);
      const rate = (b.bc + 2) / 3 / s.time * buildMul(p);
      const dp = Math.min(1 - b.prog, rate * dt);
      b.prog += dp;
      b.hp = Math.min(b.mhp, b.hp + b.mhp * dp);
      b.bc = 0;
      if (b.prog >= 1 - 1e-9) completeBld(b);
    }
    return;
  }
  // production / research
  if (b.q.length) {
    const it = b.q[0];
    if (it.k === 'u') {
      const type = resolveTrain(p, it.key);
      const s = ST(b.owner, type);
      if (p.pop + s.pop > p.cap || p.pop >= (G.cfg.popCap || MAX_POP)) {
        it.wait = true;
        if (p.human && G.time - p.housedT > 25) { p.housedT = G.time; pushEvent(p.cap >= (G.cfg.popCap || MAX_POP) ? 'popMax' : 'housed', b.owner, { x: b.x + b.w / 2, y: b.y + b.h / 2 }); }
      } else {
        it.wait = false;
        it.t += dt;
        if (it.t >= s.time) {
          b.q.shift();
          const u = spawnTrained(b, type);
          if (u) { p.pop += s.pop; p.st.trained++; }
        }
      }
    } else {
      const tt = T[it.id];
      it.t += dt;
      if (it.t >= tt.time) { b.q.shift(); applyTech(p, it.id); }
    }
  }
  // relics produce gold
  if (b.relics.length) p.res.gold += b.relics.length * .5 * dt;
  // garrisoned units slowly heal
  if (b.gar.length && G.tick % 30 === 0) for (const id of b.gar) { const u = byId(id); if (u && u.hp < u.mhp) u.hp = Math.min(u.mhp, u.hp + 1); }
  // arrows
  if (d.arrows) {
    if (b.cool > 0) b.cool -= dt;
    else {
      const s = ST(b.owner, b.type);
      const nArrows = s.arrows + b.gar.filter(id => { const u = byId(id); return u && (U[u.type].cls.includes('villager') || U[u.type].cls.includes('infantry') || U[u.type].cls.includes('archer')); }).length;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rng = s.rng + b.w / 2;
      const targets = [];
      const tgt = b.atkTgt ? byId(b.atkTgt) : null;
      if (tgt && !tgt.dead && !tgt.gIn && isEnemy(b.owner, tgt.owner) && distToRect(tgt.x, tgt.y, b.x, b.y, b.x + b.w, b.y + b.h) <= s.rng + .5) targets.push(tgt);
      else {
        b.atkTgt = 0;
        unitsNear(cx, cy, rng, u => {
          if (!hostile({ owner: b.owner, type: b.type }, u)) return;
          const dd = distToRect(u.x, u.y, b.x, b.y, b.x + b.w, b.y + b.h);
          if (dd > s.rng + .3 || (s.minRng && dd < s.minRng)) return;
          if (isShip(u) && b.type === 'tc' && false) return;
          targets.push(u);
        });
        targets.sort((a, c) => (U[a.type].cls.includes('villager') ? 1 : 0) - (U[c.type].cls.includes('villager') ? 1 : 0) || dist(a.x, a.y, cx, cy) - dist(c.x, c.y, cx, cy));
      }
      if (targets.length) {
        for (let k = 0; k < nArrows; k++) fireAt(b, Object.assign({}, s, { proj: 'arrow', acc: .8 }), targets[k % Math.min(3, targets.length)]);
        G.sfx.push({ s: 'bow', x: cx, y: cy });
        b.cool = s.rof;
      } else b.cool = .4;
    }
  }
}
function completeBld(b) {
  b.built = true; b.prog = 1;
  const p = G.players[b.owner];
  const s = ST(b.owner, b.type);
  b.mhp = s.hp; b.hp = Math.max(b.hp, s.hp * .99); b.hp = Math.min(b.hp, b.mhp);
  if (b.type === 'farm') b.food = farmFood(p);
  p.st.built++;
  if (b.type !== 'farm' && b.type !== 'palisade' && b.type !== 'wall') pushEvent('bldDone', b.owner, { x: b.x + b.w / 2, y: b.y + b.h / 2, type: b.type, snd: 'built' });
  if (b.type === 'wonder') {
    G.wonders[b.id] = { owner: b.owner, t: G.cfg.wonderTime || 300 };
    p.st.wonders++;
    pushEvent('wonderBuilt', -1, { owner: b.owner, x: b.x + 2.5, y: b.y + 2.5, snd: 'fanfare' });
  }
}
function resolveTrain(p, key) {
  if (key === 'uu') return CIVS[p.civ].uu;
  if (LINES[key]) return p.line[key];
  return key;
}
function spawnTrained(b, type) {
  const fake = { owner: b.owner, type, r: U[type].r, x: 0, y: 0, sh: U[type].dom === 'w' ? 1 : 0 };
  const sp = freeSpotNear(b, fake, 0);
  const u = spawnUnit(type, b.owner, sp[0], sp[1]);
  u.gx = u.x; u.gy = u.y;
  if (b.rally) {
    const t = b.rally.id ? byId(b.rally.id) : null;
    if (t && !t.dead && isVil(u) && (t.k === 'r' && RES_KIND[t.type] && t.type !== 'relic' || (t.k === 'b' && t.type === 'farm' && t.built))) u.ord = { t: 'gather', id: t.id, ph: 'go' };
    else if (t && !t.dead && isVil(u) && t.k === 'b' && !t.built && t.owner === u.owner) u.ord = { t: 'build', id: t.id };
    else if (t && !t.dead && t.k === 'u' && t.owner === u.owner) u.ord = { t: 'move', x: t.x, y: t.y };
    else u.ord = { t: 'move', x: b.rally.x + (rnd() - .5) * .8, y: b.rally.y + (rnd() - .5) * .8 };
  }
  G.sfx.push({ s: 'trained', x: u.x, y: u.y, p: u.owner, type });
  return u;
}

// ------------------------------------------------------------
// Technology
// ------------------------------------------------------------
function applyTech(p, id) {
  const t = T[id];
  p.techs[id] = true; p.techOrder.push(id);
  delete p.researching[id];
  p.st.techs++;
  const c = techCost(p, id); p.st.techV += (c.food || 0) + (c.wood || 0) + (c.gold || 0) + (c.stone || 0);
  // remember max HP before to adjust current HP
  invalidate(p);
  for (const fx of t.fx) {
    if (fx.t === 'age') {
      p.age = fx.n; p.aging = false; p.st.ageT[fx.n] = G.time;
      pushEvent('ageUp', -1, { owner: p.id, age: fx.n, snd: 'fanfare' });
    } else if (fx.t === 'line') {
      p.line[fx.line] = fx.to;
      for (const u of G.units) if (!u.dead && u.owner === p.id && u.type === fx.from) { const r = u.hp / u.mhp; u.type = fx.to; u.mhp = ST(p.id, fx.to).hp; u.hp = Math.max(1, r * u.mhp); }
    } else if (fx.t === 'flag') p.flags[fx.k] = true;
    else if (fx.t === 'convRes') p.convRes *= fx.mul;
    else if (fx.t === 'commission') p.commission = Math.min(p.commission, fx.set);
    else if (fx.t === 'tribute') p.tributeFee = fx.set;
  }
  refreshMaxHp(p);
  if (!t.ageUp) pushEvent('researched', p.id, { tech: id, snd: 'research' });
}
function refreshMaxHp(p) {
  for (const arr of [G.units, G.blds]) for (const e of arr) {
    if (e.dead || e.owner !== p.id) continue;
    const m = ST(p.id, e.type).hp;
    if (m !== e.mhp) { if (e.k === 'b' && !e.built) { e.hp = e.hp * m / e.mhp; } else e.hp = Math.max(1, e.hp + (m - e.mhp)); e.mhp = m; }
  }
}
function techAvailable(p, id) {
  const t = T[id];
  if (!t || p.techs[id] || p.researching[id]) return false;
  if (t.ageUp) return p.age === t.age && !p.aging;
  if (p.age < t.age) return false;
  for (const r of t.req) if (!p.techs[r]) return false;
  for (const fx of t.fx) if (fx.t === 'line' && p.line[fx.line] !== fx.from) return false;
  if (id === 'eliteUU' && p.flags.elite) return false;
  return true;
}
function techVisible(p, id) {
  // whether the button shows at all (possibly disabled for age)
  const t = T[id];
  if (p.techs[id]) return false;
  if (t.ageUp) return p.age === t.age;
  for (const fx of t.fx) if (fx.t === 'line' && p.line[fx.line] !== fx.from) return false;
  for (const r of t.req) if (!p.techs[r] && !p.researching[r]) return false;
  return true;
}
function ageReqMet(p) {
  // two qualifying buildings from the current age (a castle counts as two)
  const types = new Set();
  let n = 0;
  for (const b of G.blds) {
    if (b.dead || !b.built || b.owner !== p.id) continue;
    const d = B[b.type];
    if (!d.qual || d.age !== p.age) continue;
    if (types.has(b.type)) continue;
    types.add(b.type); n += d.qual2 ? 2 : 1;
  }
  return n >= 2;
}
function unitAvailable(p, key) {
  const type = resolveTrain(p, key);
  const d = U[type];
  if (!d) return false;
  if (p.age < d.age) return false;
  if (d.req && !p.techs[d.req]) return false;
  return true;
}

// ------------------------------------------------------------
// Resources helpers
// ------------------------------------------------------------
function canAfford(p, cost) { for (const k in cost) if ((p.res[k] || 0) + 1e-6 < cost[k]) return false; return true; }
function pay(p, cost) { for (const k in cost) p.res[k] -= cost[k]; }
function addRes(p, cost) { for (const k in cost) p.res[k] += cost[k]; }

// ------------------------------------------------------------
// Events
// ------------------------------------------------------------
function pushEvent(k, p, data) { G.events.push(Object.assign({ k, p, t: G.time }, data || {})); if (G.events.length > 200) G.events.shift(); }

// ------------------------------------------------------------
// Effects (particles, corpses) — simulation-time
// ------------------------------------------------------------
function updateFx(dt) {
  if (G.fx.length) {
    const keep = [];
    for (const f of G.fx) { f.t += dt; if (f.t < f.life) keep.push(f); }
    G.fx = keep.length > 1500 ? keep.slice(keep.length - 1500) : keep;
  }
  // smoke & fire from damaged buildings
  if (G.tick % 6 === 0 && !(G.cfg.lowFx)) for (const b of G.blds) {
    if (b.dead || !b.built || b.type === 'farm' || B[b.type].wall) continue;
    const r = b.hp / b.mhp;
    if (r < .66 && rnd() < (r < .33 ? .9 : .4)) G.fx.push({ k: 'fire', x: b.x + .2 + rnd() * (b.w - .4), y: b.y + .2 + rnd() * (b.h - .4), t: 0, life: .9 + rnd() * .6, z: 10 + rnd() * 18 });
    if (r < .5 && rnd() < .5) G.fx.push({ k: 'smoke', x: b.x + rnd() * b.w, y: b.y + rnd() * b.h, t: 0, life: 2.5 + rnd() * 2, z: 20 });
  }
  if (G.decals.length > 400) G.decals.splice(0, G.decals.length - 400);
}

// ------------------------------------------------------------
// Per-second bookkeeping: carcass decay, victory, score
// ------------------------------------------------------------
function perSecond() {
  for (const r of G.ress) if (r.type === 'carcass' && !r.dead) { r.amt -= .12; if (r.amt <= 0) depleted(r); }
  for (const p of G.players) if (p.st.ageT[1] == null && p.age >= 1) p.st.ageT[1] = G.time;
  checkVictory();
  if (Math.floor(G.time) % 10 === 0) for (const p of G.players) p.score = calcScore(p);
  if (Math.floor(G.time) % 20 === 0) for (const p of G.players) { const sc = calcScore(p); p.st.hist.push([Math.round(G.time), sc.total, sc.mil, sc.eco, sc.tech, p.pop]); if (p.st.hist.length > 500) p.st.hist.splice(0, 2); }
}
function calcScore(p) {
  const g = p.st.gath;
  const mil = Math.round((p.st.killV + p.st.razeV * 1.5) / 10);
  const eco = Math.round((g.food + g.wood + g.gold + g.stone) / 10 + p.st.trib / 10);
  const tech = Math.round(p.st.techV / 10 + p.age * 50);
  const soc = Math.round(p.st.wonders * 500 + relicsHeldBy(p.id) * 30);
  return { mil, eco, tech, soc, total: mil + eco + tech + soc };
}
function relicsHeldBy(pid) { let n = 0; for (const b of G.blds) if (!b.dead && b.owner === pid) n += b.relics.length; return n; }
function checkRelicHold() {
  const total = G.ress.filter(r => r.type === 'relic' && !r.dead).length;
  if (!total) return;
  const byTeam = {};
  for (const b of G.blds) if (!b.dead && b.relics.length) { const key = teamKey(b.owner); byTeam[key] = (byTeam[key] || 0) + b.relics.length; }
  for (const k in byTeam) if (byTeam[k] === total) {
    if (!G.relicHold || G.relicHold.team !== k) { G.relicHold = { team: k, t: G.cfg.relicTime || 200, owner: +k.slice(1) }; pushEvent('relicsAll', -1, { owner: G.relicHold.owner }); }
    return;
  }
  if (G.relicHold) pushEvent('relicsLost', -1, {});
  G.relicHold = null;
}
function teamKey(pid) { const p = G.players[pid]; return p.team > 0 ? 't' + p.team : 'p' + pid; }
function checkVictory() {
  if (G.over) return;
  const vc = G.cfg.victory || 'standard';
  // defeat
  for (const p of G.players) {
    if (!p.alive) continue;
    let alive = false;
    for (const u of G.units) if (!u.dead && u.owner === p.id && !U[u.type].animal) { alive = true; break; }
    if (!alive) for (const b of G.blds) if (!b.dead && b.owner === p.id && !B[b.type].wall && b.type !== 'farm' && b.type !== 'house') { alive = true; break; }
    if (!alive) {
      p.alive = false;
      pushEvent('defeated', -1, { owner: p.id, snd: p.human ? 'defeat' : 'alert' });
      for (const u of G.units) if (u.owner === p.id && !u.dead) killEnt(u, -1, true);
      for (const b of G.blds) if (b.owner === p.id && !b.dead) killEnt(b, -1, true);
    }
  }
  const alive = G.players.filter(p => p.alive);
  const teams = new Set(alive.map(p => teamKey(p.id)));
  let winner = null;
  if (teams.size <= 1 && G.players.length > 1) winner = alive.length ? teamKey(alive[0].id) : 'none';
  // wonder
  if (!winner && (vc === 'standard' || vc === 'wonder')) {
    for (const id in G.wonders) {
      const w = G.wonders[id];
      w.t -= 1;
      if (w.t <= 0) { winner = teamKey(w.owner); break; }
    }
  }
  // relics
  if (!winner && (vc === 'standard' || vc === 'relics')) {
    if (G.tick % 90 === 0 || G.relicHold) checkRelicHold();
    if (G.relicHold) { G.relicHold.t -= 1; if (G.relicHold.t <= 0) winner = G.relicHold.team; }
  }
  // time limit
  if (!winner && vc === 'time' && G.cfg.timeLimit && G.time >= G.cfg.timeLimit * 60) {
    let best = null, bs = -1;
    const ts = {};
    for (const p of G.players) { const k = teamKey(p.id); ts[k] = (ts[k] || 0) + calcScore(p).total; }
    for (const k in ts) if (ts[k] > bs) { bs = ts[k]; best = k; }
    winner = best;
  }
  if (G.cfg.tutorial && winner && winner === teamKey(G.human) && !G.tutDone) winner = null;
  if (winner && !G.cfg.attract) {
    G.over = true; G.winner = winner;
    for (const p of G.players) p.score = calcScore(p);
    const humanWon = G.human >= 0 && teamKey(G.human) === winner;
    pushEvent(humanWon ? 'victory' : 'defeat', -1, { snd: humanWon ? 'victory' : 'defeat' });
  } else if (winner && G.cfg.attract) G.attractEnded = true;
}
