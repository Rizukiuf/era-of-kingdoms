'use strict';
// ============================================================
//  Computer opponents
// ============================================================
const AI_LEVELS = {
  passive: { vil: 0, atk: 1e9, wave: 999, prod: 0, techs: 0, bell: false, counter: false, think: 1 },
  easy:    { vil: 28, atk: 17 * 60, wave: 8, prod: 1, techs: .35, bell: false, counter: false, think: 2, cooldown: 300 },
  normal:  { vil: 48, atk: 12 * 60, wave: 12, prod: 2, techs: .75, bell: true, counter: true, think: 1, cooldown: 220 },
  hard:    { vil: 70, atk: 9.5 * 60, wave: 15, prod: 3, techs: 1, bell: true, counter: true, think: .5, cooldown: 170 },
  hardest: { vil: 90, atk: 8 * 60, wave: 18, prod: 4, techs: 1, bell: true, counter: true, think: .5, cooldown: 140, cheat: 1.2 },
};
const AI_PREF = {
  majapahit: ['uu', 'spear', 'archer', 'knight', 'militia'],
  britons: ['uu', 'archer', 'spear', 'knight'],
  franks: ['knight', 'uu', 'militia', 'spear'],
  mongols: ['uu', 'cavArcher', 'scout', 'knight'],
  japanese: ['uu', 'militia', 'archer', 'knight'],
  ottomans: ['uu', 'handCannoneer', 'knight', 'archer'],
  byzantines: ['uu', 'skirm', 'spear', 'knight'],
  chinese: ['uu', 'archer', 'spear', 'knight'],
};
const AI_RATIO = [[.7, .3, 0, 0], [.42, .42, .12, .04], [.38, .38, .19, .05], [.36, .34, .25, .05]];
const AI_AGEVIL = [19, 27, 36];
const AI_ECO_TECH = [['loom'], ['wheelbarrow', 'doubleBit', 'horseCollar', 'goldMining', 'townWatch'], ['handcart', 'bowSaw', 'heavyPlow', 'goldShaft', 'stoneMining', 'gillnets'], ['twoManSaw', 'cropRotation', 'stoneShaft']];
const AI_MIL_TECH = [[], ['fletching', 'forging', 'scaleMail', 'bloodlines', 'paddedArcher', 'manAtArms', 'scaleBarding'],
  ['crossbowman', 'pikeman', 'longSwordsman', 'bodkin', 'ironCasting', 'chainMail', 'chainBarding', 'leatherArcher', 'husbandry', 'ballistics', 'masonry', 'thumbRing', 'eliteSkirmisher', 'lightCav', 'squires', 'murderHoles', 'fervor', 'sanctity'],
  ['eliteUU', 'arbalester', 'champion', 'halberdier', 'cavalier', 'bracer', 'blastFurnace', 'plateMail', 'plateBarding', 'ringArcher', 'chemistry', 'conscription', 'paladin', 'onager', 'cappedRam', 'heavyCavArcher', 'architecture', 'guardTower', 'hoardings']];
const AI_BUILD = [
  // [type, count, minVillagers]
  [['house', 0, 0], ['lumber', 1, 6], ['mill', 1, 8], ['mining', 1, 12], ['barracks', 1, 13], ['lumber', 2, 16], ['dock', 1, 14]],
  [['archery', 1, 0], ['blacksmith', 1, 0], ['stable', 1, 20], ['market', 1, 24], ['archery', 2, 26], ['mining', 2, 22], ['tower', 1, 24]],
  [['siege', 1, 0], ['university', 1, 28], ['castle', 1, 30], ['monastery', 1, 32], ['tc', 2, 34], ['barracks', 2, 36], ['stable', 2, 38]],
  [['castle', 2, 45], ['archery', 3, 50], ['stable', 3, 55], ['siege', 2, 50], ['tc', 3, 60], ['wonder', 1, 70]],
];

const AI = {
  init(p) {
    const L = AI_LEVELS[p.ai] || AI_LEVELS.normal;
    const tc = G.blds.find(b => b.owner === p.id && b.type === 'tc');
    const base = tc ? { x: tc.x + 2, y: tc.y + 2 } : { x: G.N / 2, y: G.N / 2 };
    p.aiS = {
      L, base, nextEco: 0, nextMil: 0, nextBuild: 0, nextTech: 0, nextAtk: Math.max(L.atk, (G.cfg.treaty || 0) * 60),
      wave: 0, attacking: false, atkIds: [], atkTarget: null, atkStart: 0, rebalanceT: 30, scoutT: 0, scoutI: 0,
      threatT: -99, bellT: -99, seen: { cavalry: 0, archer: 0, infantry: 0, siege: 0 }, seenT: 0, marketT: 0, relicT: 0, fishT: 0,
      rally: { x: base.x + (G.N / 2 - base.x) * .2, y: base.y + (G.N / 2 - base.y) * .2 },
    };
  },
  think(p) {
    if (!p.aiS) AI.init(p);
    const S = p.aiS, L = S.L;
    if (p.ai === 'passive') { AI.defend(p, S, true); return; }
    const now = G.time;
    const mine = G.units.filter(u => !u.dead && u.owner === p.id);
    const vils = mine.filter(u => u.type === 'villager');
    const army = mine.filter(u => U[u.type].pop && u.type !== 'villager' && u.type !== 'fishingShip' && u.type !== 'monk' && !U[u.type].animal);
    const blds = G.blds.filter(b => !b.dead && b.owner === p.id);
    S.tcs = blds.filter(b => b.type === 'tc' && b.built);
    if (S.tcs.length) S.base = { x: S.tcs[0].x + 2, y: S.tcs[0].y + 2 };
    if (now >= S.nextEco) { S.nextEco = now + L.think; AI.economy(p, S, vils, blds); }
    if (now >= S.nextBuild) { S.nextBuild = now + L.think * 2; AI.construct(p, S, vils, blds); }
    if (now >= S.nextTech) { S.nextTech = now + 3; AI.research(p, S, blds, vils.length); }
    if (now >= S.nextMil) { S.nextMil = now + L.think; AI.military(p, S, army, blds, vils.length); AI.defend(p, S, false, army, vils); AI.attack(p, S, army); }
    if (now >= S.scoutT) { S.scoutT = now + 12; AI.scout(p, S, mine); }
    if (now >= S.relicT) { S.relicT = now + 2; AI.monks(p, S, mine, blds); }
    if (now >= S.fishT) { S.fishT = now + 5; AI.fish(p, S, mine, blds); }
    if (now >= S.marketT) { S.marketT = now + 15; AI.trade(p); }
  },

  // ---------------- economy ----------------
  economy(p, S, vils, blds) {
    const L = S.L;
    // villagers
    const ageId = ['feudal', 'castle', 'imperial'][p.age];
    const ageReady = ageId && !p.aging && techAvailable(p, ageId) && vils.length >= Math.min(L.vil - 2, AI_AGEVIL[p.age]) && ageReqMet(p);
    if (ageReady && canAfford(p, techCost(p, ageId))) {
      const tc = S.tcs.slice().sort((a, b) => a.q.length - b.q.length)[0];
      if (tc) Cmd.research(tc, ageId);
    }
    for (const tc of S.tcs) {
      const queued = tc.q.filter(i => i.k === 'u').length;
      const ac = ageReady ? techCost(p, ageId) : null;
      const hold = ac && p.res.food >= ac.food - 160 && p.res.food < ac.food;
      if (!hold && vils.length + queued < L.vil && queued < 2 && p.res.food >= 50) Cmd.train(tc, 'villager');
    }
    // idle villagers
    const ratio = AI_RATIO[p.age].slice();
    if (AI.wantStone(p)) { ratio[3] += .08; ratio[0] -= .04; ratio[1] -= .04; }
    const total = vils.length || 1;
    const cur = Object.assign({}, p.gathN);
    // the resource furthest below its share first; when it has no free spot (no room for a farm, no wood for one,
    // no free mine), the next one, so villagers do not all end up on wood while gold is short
    const byNeed = () => RES.map((r, i) => [r, ratio[i] * total - (cur[r] || 0), ratio[i]]).filter(x => x[2] > 0).sort((a, b) => b[1] - a[1]);
    for (const u of p.idle) {
      for (const [r] of byNeed()) if (AI.assign(p, S, u, r)) { cur[r] = (cur[r] || 0) + 1; break; }
    }
    // rebalance
    S.rebalanceT -= S.L.think;
    if (S.rebalanceT <= 0) {
      S.rebalanceT = 20;
      const want = RES.map((r, i) => ratio[i] * total);
      let surplus = -1, sv = 0;
      RES.forEach((r, i) => { const d = (cur[r] || 0) - want[i]; if (d > sv) { sv = d; surplus = i; } });
      const short = RES.map((r, i) => [r, want[i] - (cur[r] || 0)]).filter(([, d]) => d >= 2).sort((a, b) => b[1] - a[1]);
      if (surplus >= 0 && sv >= 2 && short.length) {
        const mv = vils.filter(u => { if (u.ord.t !== 'gather') return false; const r = byId(u.ord.id); if (!r || r.k === 'b') return false; const rk = resKindOf(r); return rk && rk.res === RES[surplus]; }).slice(0, Math.min(3, Math.floor(sv)));
        for (const u of mv) for (const [r] of short) if (AI.assign(p, S, u, r)) { cur[r] = (cur[r] || 0) + 1; break; }
      }
    }
  },
  // resources units and monks must leave in the bank:
  // - wood for new farms while fewer villagers work food than its share (units used to spend every log, so farms,
  //   and with them the age-ups, waited);
  // - the next age once the villager count and the age requirements are met. In the Castle Age, saving for the
  //   Imperial Age (1000 food, 800 gold) pauses for 30 s after every 150 s, so a slow economy or a siege of the
  //   base cannot stop every unit that costs gold for good.
  reserve(p, S) {
    const res = {};
    const farmsShort = Math.floor(AI_RATIO[p.age][0] * p.vil - (p.gathN.food || 0));
    if ((p.cnt.mill || 0) > 0 && farmsShort >= 2) res.wood = 60 * Math.min(3, farmsShort);
    const ageId = ['feudal', 'castle', 'imperial'][p.age];
    const saving = ageId && p.vil >= AI_AGEVIL[p.age] - 2 && !p.aging && ageReqMet(p);
    if (!saving) { S.saveT = null; return res; }
    if (S.saveT == null) S.saveT = G.time;
    if (p.age < 2 || (G.time - S.saveT) % 180 < 150) for (const [r, n] of Object.entries(techCost(p, ageId))) res[r] = (res[r] || 0) + n;
    return res;
  },
  wantStone(p) { return p.age >= 1 && (p.cntAll.castle || 0) < (p.age >= 3 ? 2 : 1) && p.res.stone < 650; },
  assign(p, S, u, res) {
    const base = S.base;
    if (res === 'food') {
      const drops = G.blds.filter(b => !b.dead && b.built && b.owner === p.id && B[b.type].drop.includes('food') && b.type !== 'dock');
      const wk = id => G.work.get(id) || 0;
      const nearDrop = (x, y, r) => drops.some(d => distToRect(x, y, d.x, d.y, d.x + d.w, d.y + d.h) < r);
      const carc = G.ress.filter(r => !r.dead && r.type === 'carcass' && r.amt > 25 && wk(r.id) < 5 && nearDrop(r.x, r.y, 6)).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
      if (carc) { Cmd.gather([u], carc, false); G.work.set(carc.id, wk(carc.id) + 1); return true; }
      const sheep = G.units.filter(a => !a.dead && a.type === 'sheep' && a.owner === p.id && wk(a.id) < 3 && nearDrop(a.x, a.y, 8)).sort((a, b) => dist(a.x, a.y, base.x, base.y) - dist(b.x, b.y, base.x, base.y))[0];
      if (sheep && !G.ress.some(r => !r.dead && r.type === 'carcass' && r.anim === 'sheep' && r.amt > 25 && wk(r.id) < 5 && nearDrop(r.x, r.y, 6))) { Cmd.gather([u], sheep, false); G.work.set(sheep.id, wk(sheep.id) + 1); return true; }
      for (const d of drops) {
        const r = findNearestRes(d.x + d.w / 2, d.y + d.h / 2, 'berry', 8, u, 3);
        if (r) { Cmd.gather([u], r, false); G.work.set(r.id, wk(r.id) + 1); return true; }
      }
      if (p.age <= 1) {
        const ok = a => !a.dead && nearDrop(a.x, a.y, 7) && G.vis[p.id][tIdx(a.x, a.y)] > 0;
        if (p.ai !== 'easy' && p.vil >= 8) {
          const boar = G.units.find(a => a.type === 'boar' && ok(a));
          if (boar && wk(boar.id) < 4) { Cmd.gather([u], boar, false); G.work.set(boar.id, wk(boar.id) + 1); return true; }
        }
        const deer = G.units.find(a => a.type === 'deer' && ok(a));
        if (deer && wk(deer.id) < 3) { Cmd.gather([u], deer, false); G.work.set(deer.id, wk(deer.id) + 1); return true; }
      }
      // farms without a farmer
      const farms = G.blds.filter(b => !b.dead && b.owner === p.id && b.type === 'farm' && b.built);
      const worked = new Set(G.units.filter(v => !v.dead && v.owner === p.id && v.ord.t === 'gather').map(v => v.ord.id));
      const free = farms.find(f => !worked.has(f.id));
      if (free) { Cmd.gather([u], free, false); return true; }
      const unbuilt = G.blds.find(b => !b.dead && b.owner === p.id && b.type === 'farm' && !b.built && !G.units.some(v => v.owner === p.id && v.ord.t === 'build' && v.ord.id === b.id));
      if (unbuilt) { Cmd.build([u], unbuilt, false); return true; }
      if ((p.cnt.mill || 0) > 0 && p.res.wood >= 60) {
        const spot = AI.farmSpot(p, S);
        if (spot) { const b = placeBld(p, 'farm', spot[0], spot[1], [u], false); if (b) return true; }
        else if (AI.newMill(p, S, u)) return true;
      }
      return false;
    }
    const type = res === 'wood' ? 'tree' : res;
    const campT = res === 'wood' ? 'lumber' : 'mining';
    const drops = G.blds.filter(b => !b.dead && b.owner === p.id && (B[b.type].drop.includes(res) || (b.type === campT && !b.built)) && b.type !== 'dock');
    let best = null, bd = 1e9;
    for (const d of drops) {
      const r = findNearestRes(d.x + d.w / 2, d.y + d.h / 2, type, 7, u, WORK_CAP[type]);
      if (r) { const dd = dist(r.x, r.y, d.x + d.w / 2, d.y + d.h / 2) + dist(r.x, r.y, u.x, u.y) * .2; if (dd < bd) { bd = dd; best = r; } }
    }
    if (best) { Cmd.gather([u], best, false); G.work.set(best.id, (G.work.get(best.id) || 0) + 1); return true; }
    // need a new camp near the nearest resource
    const r = findNearestRes(base.x, base.y, type, G.N, u);
    if (!r) return false;
    const pending = G.blds.some(b => !b.dead && b.owner === p.id && b.type === campT && !b.built);
    if (!pending && canAfford(p, ST(p.id, campT).cost)) {
      const spot = AI.spotNear(p, campT, r.x, r.y, 1, 4);
      if (spot) { placeBld(p, campT, spot[0], spot[1], [u], false); return true; }
    }
    Cmd.gather([u], r, false);
    return true;
  },
  farmSpot(p, S) {
    const anchors = G.blds.filter(b => !b.dead && b.owner === p.id && b.built && (b.type === 'tc' || b.type === 'mill'));
    let best = null;
    for (const a of anchors) {
      for (let y = a.y - 3; y <= a.y + a.h; y++) for (let x = a.x - 3; x <= a.x + a.w; x++) {
        const d = distToRect(x + 1.5, y + 1.5, a.x, a.y, a.x + a.w, a.y + a.h);
        if (d > 2.6) continue;
        if (!canPlace(p, 'farm', x, y, true) || !AI.noResNear(x, y, 3, 3, 0)) continue;
        if (!best || d < best[2]) best = [x, y, d];
      }
      if (best) return best;
    }
    return null;
  },
  newMill(p, S, u) {
    if (G.blds.some(b => !b.dead && b.owner === p.id && b.type === 'mill' && !b.built)) return false;
    if (!canAfford(p, ST(p.id, 'mill').cost)) return false;
    // an open patch with room for farms on every side
    for (let r = 7; r <= 22; r += 3) {
      for (let k = 0; k < 16; k++) {
        const ang = rnd() * Math.PI * 2;
        const x = Math.round(S.base.x + Math.cos(ang) * r) - 1, y = Math.round(S.base.y + Math.sin(ang) * r) - 1;
        let ok = true;
        for (let yy = y - 3; yy < y + 5 && ok; yy++) for (let xx = x - 3; xx < x + 5 && ok; xx++) {
          if (!inMapXY(xx, yy)) { ok = false; break; }
          const i = yy * G.N + xx;
          if (G.occ[i] >= 0 || G.terrain[i] === TER.DEEP || G.terrain[i] === TER.SHALLOW) ok = false;
        }
        if (ok && placeBld(p, 'mill', x, y, [u], false)) return true;
      }
    }
    return false;
  },
  noResNear(tx, ty, w, h, pad) {
    for (let y = ty - pad; y < ty + h + pad; y++) for (let x = tx - pad; x < tx + w + pad; x++) {
      if (!inMapXY(x, y)) continue;
      const o = G.occ[y * G.N + x];
      if (o >= 0) { const e = G.byId.get(o); if (e && e.k === 'r' && e.type !== 'tree') return false; }
    }
    return true;
  },
  clearAround(tx, ty, w, h) {
    for (let y = ty - 1; y <= ty + h; y++) for (let x = tx - 1; x <= tx + w; x++) {
      if (x >= tx && x < tx + w && y >= ty && y < ty + h) continue;
      if (!inMapXY(x, y)) continue;
      const o = G.occ[y * G.N + x];
      if (o >= 0) { const e = G.byId.get(o); if (e && e.k === 'b' && e.type !== 'farm') return false; }
      if (G.terrain[y * G.N + x] === TER.DEEP) return false;
    }
    return true;
  },
  spot(p, type, cx, cy, r0, r1) {
    const d = B[type];
    for (let r = r0; r <= r1; r++) {
      const ring = [];
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (Math.abs(Math.max(Math.abs(x + d.w / 2 - cx), Math.abs(y + d.h / 2 - cy)) - r) > .6) continue;
        ring.push([x, y]);
      }
      for (let i = ring.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ring[i], ring[j]] = [ring[j], ring[i]]; }
      for (const [x, y] of ring) {
        if (!canPlace(p, type, x, y, true)) continue;
        if (type !== 'farm' && !AI.clearAround(x, y, d.w, d.h)) continue;
        if (type !== 'farm' && !AI.noResNear(x, y, d.w, d.h, 2)) continue;
        return [x, y];
      }
    }
    return null;
  },
  spotNear(p, type, rx, ry, r0, r1) {
    const d = B[type];
    let best = null, bd = 1e9;
    for (let y = Math.floor(ry - r1 - d.h); y <= ry + r1; y++) for (let x = Math.floor(rx - r1 - d.w); x <= rx + r1; x++) {
      const dd = distToRect(rx, ry, x, y, x + d.w, y + d.h);
      if (dd < r0 - .01 || dd > r1) continue;
      if (!canPlace(p, type, x, y, true) || !AI.clearAround(x, y, d.w, d.h)) continue;
      const sc = dd + dist(x, y, p.aiS.base.x, p.aiS.base.y) * .05;
      if (sc < bd) { bd = sc; best = [x, y]; }
    }
    return best;
  },
  builderFor(p, x, y, n) {
    const cands = G.units.filter(u => !u.dead && !u.gIn && u.owner === p.id && u.type === 'villager' && u.ord.t !== 'build' && !(u.ord.t === 'gather' && byId(u.ord.id) && byId(u.ord.id).type === 'farm'));
    cands.sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
    return cands.slice(0, n);
  },
  construct(p, S, vils, blds) {
    const L = S.L;
    if (!vils.length) return;
    // houses
    const building = (t) => (p.cntAll[t] || 0) - (p.cnt[t] || 0);
    const margin = p.age === 0 ? 4 : p.age === 1 ? 6 : 10;
    const popCap = G.cfg.popCap || MAX_POP;
    if (p.cap - p.pop <= margin && p.cap < popCap && building('house') < (p.age >= 2 ? 2 : 1) && p.res.wood >= 25) {
      const spot = AI.spot(p, 'house', S.base.x, S.base.y, 8, 18) || AI.spot(p, 'house', S.base.x, S.base.y, 18, 28);
      if (spot) { const bs = AI.builderFor(p, spot[0], spot[1], 1); if (bs.length) { placeBld(p, 'house', spot[0], spot[1], bs, false); return; } }
    }
    if (p.pop < 6) return;
    // building plan
    for (let a = 0; a <= p.age; a++) {
      for (const [type, cnt, minV] of AI_BUILD[a]) {
        if (type === 'house') continue;
        if (vils.length < minV) continue;
        if ((p.cntAll[type] || 0) >= cnt) continue;
        if (type === 'wonder' && !(G.cfg.victory === 'standard' || G.cfg.victory === 'wonder')) continue;
        if (type === 'dock' && !AI.waterNear(S)) continue;
        if (type === 'tc' && p.ai === 'easy') continue;
        if ((type === 'barracks' || type === 'archery' || type === 'stable' || type === 'siege') && (p.cntAll[type] || 0) >= L.prod) continue;
        const d = B[type];
        if (d.req && !(p.cnt[d.req] > 0)) continue;
        if (d.age > p.age) continue;
        if (building(type) > 0) continue;
        const s = ST(p.id, type);
        if (!canAfford(p, s.cost)) { if (d.qual && !ageReqMet(p)) return; continue; } // save for buildings the next age needs
        let spot = null;
        if (type === 'lumber' || type === 'mining' || type === 'mill') {
          const rt = type === 'lumber' ? 'tree' : type === 'mining' ? (p.cntAll.mining ? 'stone' : 'gold') : 'berry';
          const r = findNearestRes(S.base.x, S.base.y, rt, 22, { type: 'villager', owner: p.id });
          if (r && dist(r.x, r.y, S.base.x, S.base.y) > 5) spot = AI.spotNear(p, type, r.x, r.y, 1, 3);
          if (!spot && type === 'mill') spot = AI.spot(p, type, S.base.x, S.base.y, 4, 9);
          if (!spot) continue;
        } else if (type === 'dock') {
          spot = AI.dockSpot(p, S);
        } else if (type === 'tower') {
          spot = AI.spot(p, type, S.base.x + (rnd() - .5) * 12, S.base.y + (rnd() - .5) * 12, 2, 8);
        } else if (type === 'tc') {
          const r = findNearestRes(S.base.x + (rnd() - .5) * 30, S.base.y + (rnd() - .5) * 30, 'gold', 30, { type: 'villager', owner: p.id });
          spot = r ? AI.spotNear(p, type, r.x, r.y, 2, 6) : null;
        } else spot = AI.spot(p, type, S.base.x, S.base.y, 9, 22);
        if (!spot) continue;
        const nb = type === 'castle' || type === 'tc' ? 4 : type === 'wonder' ? 10 : type === 'dock' ? 2 : 2;
        const bs = AI.builderFor(p, spot[0] + d.w / 2, spot[1] + d.h / 2, nb);
        if (!bs.length) return;
        const b = placeBld(p, type, spot[0], spot[1], bs, false);
        if (b && B[type].trains.length) b.rally = { x: S.rally.x, y: S.rally.y, id: 0 };
        return;
      }
    }
    // keep foundations staffed
    for (const b of blds) {
      if (b.built || b.type === 'farm') continue;
      const n = G.units.filter(u => u.owner === p.id && (u.ord.t === 'build') && u.ord.id === b.id).length;
      if (n === 0) { const bs = AI.builderFor(p, b.x, b.y, 1); if (bs.length) Cmd.build(bs, b, false); }
    }
  },
  waterNear(S) {
    if (S.water != null) return S.water;
    let n = 0;
    for (let y = Math.floor(S.base.y - 18); y <= S.base.y + 18; y++) for (let x = Math.floor(S.base.x - 18); x <= S.base.x + 18; x++) if (inMapXY(x, y) && G.terrain[y * G.N + x] === TER.DEEP) n++;
    return (S.water = n > 40);
  },
  dockSpot(p, S) {
    let best = null, bd = 1e9;
    for (let y = Math.floor(S.base.y - 20); y <= S.base.y + 20; y++) for (let x = Math.floor(S.base.x - 20); x <= S.base.x + 20; x++) {
      if (!inMapXY(x, y)) continue;
      const d = dist(x, y, S.base.x, S.base.y);
      if (d >= bd) continue;
      if (canPlace(p, 'dock', x, y, true)) { bd = d; best = [x, y]; }
    }
    return best;
  },
  research(p, S, blds, nv) {
    const L = S.L;
    const ageId = ['feudal', 'castle', 'imperial'][p.age];
    const saving = ageId && nv >= AI_AGEVIL[p.age] - 3 && !p.aging && ageReqMet(p);
    const lists = [];
    for (let a = 0; a <= p.age; a++) lists.push(...AI_ECO_TECH[a], ...AI_MIL_TECH[a]);
    let n = 0;
    for (const id of lists) {
      if (rnd() > L.techs && !AI_ECO_TECH.flat().includes(id)) continue;
      if (!techAvailable(p, id)) continue;
      if (id === 'loom' && nv < 14) continue;
      const t = T[id];
      const b = blds.find(x => x.type === t.at && x.built && x.q.length === 0);
      if (!b) continue;
      const c = techCost(p, id);
      // keep a cushion for the next age
      const reserve = saving ? techCost(p, ageId) : {};
      const ok = RES.every(r => !c[r] || (p.res[r] || 0) - c[r] >= (reserve[r] || 0));
      if (!ok) continue;
      if (Cmd.research(b, id)) { n++; if (n >= 2) return; }
    }
  },
  // ---------------- military ----------------
  military(p, S, army, blds, nv) {
    const L = S.L;
    if (!L.prod) return;
    // what has the enemy been fielding?
    if (G.time - S.seenT > 6) {
      S.seenT = G.time;
      const seen = { cavalry: 0, archer: 0, infantry: 0, siege: 0 };
      const v = G.vis[p.id];
      for (const u of G.units) {
        if (u.dead || !isEnemy(p.id, u.owner) || v[tIdx(u.x, u.y)] !== 2) continue;
        for (const c of U[u.type].cls) if (seen[c] != null) seen[c]++;
      }
      for (const k in seen) S.seen[k] = S.seen[k] * .7 + seen[k];
    }
    const prodB = blds.filter(b => b.built && (b.type === 'barracks' || b.type === 'archery' || b.type === 'stable' || b.type === 'castle' || b.type === 'siege'));
    const reserve = AI.reserve(p, S);
    const vilReserve = nv < L.vil ? 60 : 0;
    const pref = AI_PREF[p.civ] || ['militia', 'archer', 'spear'];
    const sieges = army.filter(u => U[u.type].cls.includes('siege')).length;
    for (const b of prodB) {
      if (b.q.length >= 2) continue;
      let options = B[b.type].trains.filter(k => unitAvailable(p, k));
      if (!options.length) continue;
      // choose by counters and civ preference
      let pick = null, ps = -1e9;
      for (const k of options) {
        const type = resolveTrain(p, k), d = U[type];
        let sc = 0;
        const pi = pref.indexOf(k); if (pi >= 0) sc += 6 - pi;
        if (L.counter) {
          if (d.bonus.cavalry) sc += S.seen.cavalry * .6;
          if (d.bonus.archer) sc += S.seen.archer * .6;
          if (d.bonus.infantry) sc += S.seen.infantry * .4;
          if (d.cls.includes('cavalry')) sc += S.seen.archer * .25 + S.seen.siege * .5 - S.seen.cavalry * .15;
          if (d.cls.includes('archer') && !d.cls.includes('skirm')) sc += S.seen.infantry * .3 - S.seen.archer * .1;
        }
        if (d.cls.includes('siege') || k === 'trebuchet') { sc = (sieges < (p.age >= 3 ? 4 : 2) && S.wave > 0) ? 4 : -99; if (k === 'mangonel' && S.seen.archer < 6) sc -= 3; }
        if (d.cls.includes('monk')) sc = -99;
        if (k === 'scout' && p.age >= 2) sc -= 4;
        const c = ST(p.id, type).cost;
        if ((c.gold || 0) > 0 && p.res.gold < 150) sc -= 4;
        sc += rnd() * 2;
        if (sc > ps) { ps = sc; pick = k; }
      }
      if (!pick || ps < -50) continue;
      const c = ST(p.id, resolveTrain(p, pick)).cost;
      // the castle keeps a core of unique units even while the economy saves for the next age
      const keep = b.type === 'castle' && pick === 'uu' && (p.cnt[CIVS[p.civ].uu] || 0) < 8 ? {} : reserve;
      const ok = RES.every(r => !c[r] || (p.res[r] || 0) - c[r] >= ((keep[r] || 0) + (r === 'food' ? vilReserve : 0)));
      if (ok) Cmd.train(b, pick);
    }
  },
  defend(p, S, passive, army, vils) {
    const v = G.vis[p.id];
    let threat = null, nThreat = 0;
    const centers = G.blds.filter(b => !b.dead && b.owner === p.id && (b.type === 'tc' || b.type === 'castle' || b.type === 'barracks')).slice(0, 4);
    for (const c of centers) {
      unitsNear(c.x + c.w / 2, c.y + c.h / 2, 16, u => {
        if (!isEnemy(p.id, u.owner) || u.gIn || U[u.type].animal) return;
        if (U[u.type].cls.includes('villager')) return;
        nThreat++; if (!threat) threat = u;
      });
    }
    if (passive) return;
    if (threat) {
      S.threatT = G.time;
      const defenders = (army || []).filter(u => !S.atkIds.includes(u.id) || dist(u.x, u.y, threat.x, threat.y) < 25);
      for (const u of defenders) if (u.ord.t === 'idle' || (u.ord.t === 'move' && !S.attacking)) Cmd.move([u], threat.x, threat.y, { amove: true });
      // ring the bell when our army is clearly outmatched, but not again within 2 minutes of the last release
      if (S.L.bell && !p.bell && nThreat >= 4 && defenders.length < nThreat * .6 && G.time - (S.bellOffT || -999) > 120) { Cmd.bell(p); S.bellT = G.time; }
      // villagers fight back if desperate (feudal rush defence)
      if (!S.L.bell && nThreat >= 3 && vils) for (const u of vils.slice(0, 6)) if (u.ord.t === 'gather' && dist(u.x, u.y, threat.x, threat.y) < 6) Cmd.attack([u], threat, false);
    }
    // villagers go back to work 12 s after the last threat, and after 60 s at the latest: a few enemies camping in
    // the base used to keep the whole economy hidden for many minutes
    if (p.bell && (G.time - S.threatT > 12 || G.time - S.bellT > 60)) { Cmd.bell(p); S.bellOffT = G.time; }
  },
  attack(p, S, army) {
    const L = S.L;
    const now = G.time;
    if (G.cfg.treaty && now < G.cfg.treaty * 60) return;
    if (S.attacking) {
      const alive = S.atkIds.map(byId).filter(u => u && !u.dead);
      S.atkIds = alive.map(u => u.id);
      let tgt = S.atkTarget && (S.atkTarget.id ? byId(S.atkTarget.id) : null);
      if (!tgt || tgt.dead) {
        const nt = AI.pickTarget(p, S, alive[0] || S.base);
        S.atkTarget = nt;
        tgt = nt ? byId(nt.id) : null;
      }
      if (alive.length < Math.max(3, S.atkSize * .25) || !S.atkTarget || now - S.atkStart > 420) {
        // retreat and regroup
        Cmd.move(alive, S.rally.x, S.rally.y, {});
        S.attacking = false; S.atkIds = [];
        S.nextAtk = now + L.cooldown * (.8 + rnd() * .4);
        return;
      }
      const tx = S.atkTarget.x, ty = S.atkTarget.y;
      for (const u of alive) {
        if (u.ord.t === 'idle' || (u.ord.t === 'move' && dist(u.ord.x, u.ord.y, tx, ty) > 4)) {
          if (U[u.type].cls.includes('siege') && tgt) Cmd.attack([u], tgt, false);
          else Cmd.move([u], tx + (rnd() - .5) * 3, ty + (rnd() - .5) * 3, { amove: true });
        }
      }
      return;
    }
    if (now < S.nextAtk) return;
    const ready = army.filter(u => !u.gIn && U[u.type].cls.indexOf('ship') < 0);
    const need = L.wave + S.wave * 3;
    if (ready.length < Math.min(need, (G.cfg.popCap || MAX_POP) * .35)) { if (now - S.nextAtk > 300 && ready.length >= L.wave * .7) { /* attack anyway */ } else return; }
    const t = AI.pickTarget(p, S, S.base);
    if (!t) return;
    S.attacking = true; S.wave++; S.atkStart = now; S.atkTarget = t;
    const keep = Math.min(3, Math.floor(ready.length * .15));
    const go = ready.slice(keep);
    S.atkIds = go.map(u => u.id); S.atkSize = go.length;
    Cmd.move(go, t.x, t.y, { amove: true });
  },
  pickTarget(p, S, from) {
    let best = null, bd = 1e9;
    for (const id in p.known) {
      const k = p.known[id], b = byId(+id);
      if (!b || b.dead) { delete p.known[id]; continue; }
      if (!isEnemy(p.id, b.owner) || B[b.type].wall) continue;
      let d = dist(from.x, from.y, k.x, k.y);
      if (b.type === 'wonder') d -= 40;
      if (b.type === 'tc' || b.type === 'castle') d -= 4;
      if (b.type === 'farm' || b.type === 'house') d += 6;
      if (d < bd) { bd = d; best = { id: b.id, x: k.x, y: k.y }; }
    }
    if (best) return best;
    // fall back to the start location of the nearest living enemy
    for (const q of G.players) {
      if (!q.alive || !isEnemy(p.id, q.id)) continue;
      const s = G.starts[q.id];
      const d = dist(from.x, from.y, s.x, s.y);
      if (d < bd) { bd = d; best = { id: 0, x: s.x, y: s.y }; }
    }
    if (best && !best.id) {
      // scan for any visible enemy building near there
      const b = G.blds.find(b => !b.dead && isEnemy(p.id, b.owner) && dist(b.x, b.y, best.x, best.y) < 10);
      if (b) best.id = b.id;
    }
    return best;
  },
  scout(p, S, mine) {
    const sc = mine.find(u => (u.type === 'scout' || u.type === 'lightCav') && u.ord.t === 'idle' && !S.atkIds.includes(u.id));
    if (!sc) return;
    const pts = [];
    const b = S.base;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; pts.push([b.x + Math.cos(a) * 13, b.y + Math.sin(a) * 13]); }
    for (const q of G.players) if (isEnemy(p.id, q.id)) pts.push([G.starts[q.id].x, G.starts[q.id].y]);
    pts.push([G.N / 2, G.N / 2]);
    const pt = pts[S.scoutI++ % pts.length];
    Cmd.move([sc], clamp(pt[0], 1, G.N - 1), clamp(pt[1], 1, G.N - 1), {});
  },
  // Monks: one collects relics while any are left on the map; the others go with the army, convert valuable enemy
  // units in range (cavalry, unique units, siege) and heal the wounded. Normal keeps 2 monks, Hard and Hardest 4.
  monks(p, S, mine, blds) {
    if (p.ai === 'easy' || p.age < 2) return;
    const mon = blds.find(b => b.type === 'monastery' && b.built);
    const monks = mine.filter(u => u.type === 'monk' && !u.gIn);
    if (mon && monks.length < (p.ai === 'normal' ? 2 : 4) && mon.q.length === 0 && p.res.gold > 250 + (AI.reserve(p, S).gold || 0)) Cmd.train(mon, 'monk');
    if (!monks.length) return;
    const v = G.vis[p.id];
    const relics = G.ress.filter(r => r.type === 'relic' && !r.dead && !r.carrier && !r.inB && v[tIdx(r.x, r.y)] > 0);
    let keeper = byId(S.relicMonk);
    if (!keeper || keeper.dead || keeper.owner !== p.id) keeper = null;
    if (!keeper && (relics.length || monks.some(m => m.relic))) { keeper = monks.find(m => m.relic) || monks[0]; S.relicMonk = keeper.id; }
    if (keeper && !relics.length && !keeper.relic && keeper.ord.t !== 'relicIn') { keeper = null; S.relicMonk = 0; }
    if (keeper && keeper.ord.t === 'idle') {
      if (keeper.relic) { if (mon) Cmd.smart([keeper], mon.x, mon.y, mon); }
      else {
        let best = null, bd = 1e9;
        for (const r of relics) { const d = dist(r.x, r.y, keeper.x, keeper.y); if (d < bd) { bd = d; best = r; } }
        if (best && bd < 45) issue(keeper, { t: 'relic', id: best.id }, false);
      }
    }
    // where the army is: the attack group while attacking, else the soldiers at home, else the rally point
    const group = S.attacking ? S.atkIds.map(byId).filter(u => u && !u.dead) : mine.filter(u => !u.gIn && U[u.type].pop && !U[u.type].animal && u.type !== 'villager' && u.type !== 'monk' && !isShip(u));
    const cx = group.length ? group.reduce((a, u) => a + u.x, 0) / group.length : S.rally.x;
    const cy = group.length ? group.reduce((a, u) => a + u.y, 0) / group.length : S.rally.y;
    const taken = new Set(monks.filter(m => m.ord.t === 'convert').map(m => m.ord.id));
    for (const m of monks) {
      if (m === keeper || m.ord.t === 'convert' || m.ord.t === 'heal') continue;
      if (m.rest <= 0) {
        let tgt = null, tv = 99;
        unitsNear(m.x, m.y, 10, u => {
          if (!isEnemy(p.id, u.owner) || u.gIn || U[u.type].noConvert || taken.has(u.id) || v[tIdx(u.x, u.y)] !== 2) return;
          const c = U[u.type].cls, val = unitValue(u.type) + (c.includes('unique') || c.includes('siege') ? 100 : c.includes('cavalry') ? 50 : 0);
          if (val > tv || (val === tv && tgt && dist(u.x, u.y, m.x, m.y) < dist(tgt.x, tgt.y, m.x, m.y))) { tv = val; tgt = u; }
        });
        if (tgt) { issue(m, { t: 'convert', id: tgt.id }, false); taken.add(tgt.id); continue; }
      }
      let hurt = null, hv = 0;
      unitsNear(m.x, m.y, 8, u => { if (u.owner === p.id && u !== m && !u.gIn && !U[u.type].cls.includes('siege') && !isShip(u) && u.hp < u.mhp * .7 && u.mhp - u.hp > hv) { hv = u.mhp - u.hp; hurt = u; } });
      if (hurt) { issue(m, { t: 'heal', id: hurt.id }, false); continue; }
      if (dist(m.x, m.y, cx, cy) > 6 && (m.ord.t === 'idle' || (m.ord.t === 'move' && dist(m.ord.x, m.ord.y, cx, cy) > 6))) Cmd.move([m], cx + (rnd() - .5) * 2, cy + (rnd() - .5) * 2, {});
    }
  },
  fish(p, S, mine, blds) {
    const dock = blds.find(b => b.type === 'dock' && b.built);
    if (!dock) return;
    const ships = mine.filter(u => u.type === 'fishingShip');
    const want = p.ai === 'easy' ? 2 : p.ai === 'normal' ? 4 : 6;
    if (ships.length < want && dock.q.length === 0 && p.res.wood >= 75) Cmd.train(dock, 'fishingShip');
    for (const s of ships) {
      if (s.ord.t !== 'idle') continue;
      const f = findNearestRes(dock.x + 1.5, dock.y + 1.5, 'fish', 25, s);
      if (f) Cmd.gather([s], f, false);
    }
    // warships when enemies have them
    if (p.ai !== 'easy' && p.age >= 1) {
      const war = mine.filter(u => U[u.type].cls.includes('warship')).length;
      const enemyShips = G.units.filter(u => !u.dead && isEnemy(p.id, u.owner) && isShip(u) && G.vis[p.id][tIdx(u.x, u.y)] === 2).length;
      if (enemyShips > war && dock.q.length < 2 && canAfford(p, ST(p.id, p.line.galley).cost)) Cmd.train(dock, 'galley');
    }
  },
  trade(p) {
    if (!p.cnt.market || p.ai === 'easy') return;
    for (const r of ['food', 'wood', 'stone']) {
      if (p.res[r] > 1200 && p.res.gold < 600) Cmd.market(p, r, false);
      if (p.res.gold > 1200 && p.res[r] < 150 && r !== 'stone') Cmd.market(p, r, true);
    }
  },
};
