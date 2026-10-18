'use strict';
// ============================================================
//  Commands — the only way UI and AI change the simulation
// ============================================================
function canPlace(p, type, tx, ty, ignoreFog) {
  const d = B[type], N = G.N;
  if (tx < 0 || ty < 0 || tx + d.w > N || ty + d.h > N) return false;
  const vis = G.vis[p.id];
  let water = 0, land = 0;
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) {
    const i = y * N + x;
    if (!ignoreFog && vis[i] === 0) return false;
    const t = G.terrain[i];
    const w = t === TER.DEEP || t === TER.SHALLOW;
    if (w) water++; else land++;
    const o = G.occ[i];
    if (o >= 0) {
      const e = G.byId.get(o);
      if (!(type === 'gate' && e && e.k === 'b' && e.type === 'wall' && e.owner === p.id && e.built)) return false;
    }
  }
  if (d.water) {
    if (land) return false;
    // needs land on at least one side and deep water in front
    let shore = false, deep = false;
    for (let y = ty - 1; y <= ty + d.h; y++) for (let x = tx - 1; x <= tx + d.w; x++) {
      if (x >= tx && x < tx + d.w && y >= ty && y < ty + d.h) continue;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const t = G.terrain[y * N + x];
      if (t !== TER.DEEP && t !== TER.SHALLOW) shore = true;
      if (t === TER.DEEP) deep = true;
    }
    return shore && deep;
  }
  if (water) return false;
  return true;
}
function placeBld(p, type, tx, ty, builders, shift, free) {
  const s = ST(p.id, type);
  if (!free && !canAfford(p, s.cost)) return null;
  if (!canPlace(p, type, tx, ty, !p.human)) return null;
  if (B[type].age > p.age) return null;
  if (B[type].req && !(p.cnt[B[type].req] > 0)) return null;
  if (type === 'gate') { // replaces a wall segment
    const o = G.occ[ty * G.N + tx];
    if (o >= 0) { const w = G.byId.get(o); if (w) { killEnt(w, -1, true); } }
  }
  if (!free) pay(p, s.cost);
  const b = spawnBld(type, p.id, tx, ty, false);
  // push units out of the footprint
  for (const u of G.units) {
    if (u.dead || u.gIn) continue;
    if (u.x >= tx - .1 && u.x <= tx + b.w + .1 && u.y >= ty - .1 && u.y <= ty + b.h + .1 && !B[type].pass) {
      const sp = freeSpotNear(b, u, 0); u.x = u.px = sp[0]; u.y = u.py = sp[1]; u.path = null;
    }
  }
  if (builders && builders.length) Cmd.build(builders, b, shift);
  return b;
}
function wallTiles(x0, y0, x1, y1) {
  // 4-connected line so that units cannot slip through diagonal gaps
  const out = [];
  let x = x0, y = y0;
  out.push([x, y]);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
  let err = dx - dy;
  let guard = 0;
  while ((x !== x1 || y !== y1) && guard++ < 400) {
    const e2 = 2 * err;
    if (e2 > -dy && (Math.abs(e2 + dy) <= Math.abs(e2 - dx) || y === y1)) { err -= dy; x += sx; }
    else { err += dx; y += sy; }
    out.push([x, y]);
  }
  return out;
}

const Cmd = {
  move(units, x, y, o) {
    o = o || {};
    units = units.filter(u => u && !u.dead && !u.gIn && u.k === 'u');
    if (!units.length) return;
    x = clamp(x, .3, G.N - .3); y = clamp(y, .3, G.N - .3);
    const t = o.amove ? 'amove' : 'move';
    if (units.length === 1) {
      const u = units[0];
      const p = nearestPassable(u, x, y, 6) || [x, y];
      issue(u, { t, x: p[0], y: p[1] }, o.shift);
      u.gx = p[0]; u.gy = p[1];
      return;
    }
    let cx = 0, cy = 0;
    for (const u of units) { cx += u.x; cy += u.y; } cx /= units.length; cy /= units.length;
    let dx = x - cx, dy = y - cy; const dd = Math.hypot(dx, dy);
    if (dd < .5) { dx = 1; dy = 1; } dx /= dd || 1; dy /= dd || 1;
    if (dd < .5) { dx = .707; dy = .707; }
    const px = -dy, py = dx;
    const rank = u => { const c = U[u.type].cls; if (c.includes('siege')) return 3; if (u.type === 'monk') return 2; if (ST(u.owner, u.type).rng > 1) return 1; return 0; };
    const sorted = units.slice().sort((a, b) => rank(a) - rank(b) || ((a.x - cx) * px + (a.y - cy) * py) - ((b.x - cx) * px + (b.y - cy) * py));
    const cols = Math.max(2, Math.ceil(Math.sqrt(units.length * 1.6)));
    const spacing = units.some(u => U[u.type].cls.includes('cavalry') || U[u.type].cls.includes('siege') || isShip(u)) ? 1.05 : .82;
    let minSpd = 9;
    for (const u of units) minSpd = Math.min(minSpd, ST(u.owner, u.type).spd);
    const keep = o.formation !== false && dd > 6 && units.length <= 60;
    sorted.forEach((u, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const inRow = Math.min(cols, sorted.length - row * cols);
      const off = (col - (inRow - 1) / 2) * spacing;
      let tx = x + px * off - dx * row * spacing, ty = y + py * off - dy * row * spacing;
      tx = clamp(tx, .3, G.N - .3); ty = clamp(ty, .3, G.N - .3);
      const p = nearestPassable(u, tx, ty, 4) || [x, y];
      issue(u, { t, x: p[0], y: p[1], spd: keep ? minSpd : 0 }, o.shift);
      u.gx = p[0]; u.gy = p[1];
    });
  },
  attack(units, t, shift) {
    for (const u of units) {
      if (!u || u.dead || u.gIn) continue;
      const s = ST(u.owner, u.type);
      if (u.type === 'monk' && t.k === 'u' && isEnemy(u.owner, t.owner)) { issue(u, { t: 'convert', id: t.id }, shift); continue; }
      if (!s.atk) { issue(u, { t: 'move', x: t.x, y: t.y }, shift); continue; }
      if (s.onlyBld && t.k === 'u' && !U[t.type].cls.includes('siege')) { issue(u, { t: 'move', x: t.x, y: t.y }, shift); continue; }
      issue(u, { t: 'attack', id: t.id, force: allied(u.owner, t.owner) }, shift);
      u.gx = u.x; u.gy = u.y;
    }
  },
  gather(units, r, shift) {
    for (const u of units) {
      if (!u || u.dead || u.gIn) continue;
      if (isVil(u) || (u.type === 'fishingShip' && r.type === 'fish')) {
        const rk = resKindOf(r);
        if (rk && u.cres && u.cres !== rk.res) { u.carry = 0; }
        issue(u, { t: 'gather', id: r.id, ph: 'go', rtype: r.k === 'b' ? 'farm' : r.type }, shift);
      }
    }
  },
  build(units, b, shift) {
    for (const u of units) if (u && !u.dead && !u.gIn && isVil(u)) issue(u, { t: b.built ? 'repair' : 'build', id: b.id }, shift);
  },
  garrison(units, b) {
    for (const u of units) if (u && !u.dead && !u.gIn && canGarrisonType(u, b)) issue(u, { t: 'garrison', id: b.id }, false);
  },
  ungarrison(b, uid) {
    if (uid) return ejectAll(b, u => u.id === uid);
    return ejectAll(b);
  },
  stop(units) { for (const u of units) if (u && !u.dead) { u.ord = { t: 'idle' }; u.q = []; u.path = null; u.gx = u.x; u.gy = u.y; } },
  stance(units, s) { for (const u of units) if (u && !u.dead) { u.stance = s; u.gx = u.x; u.gy = u.y; if (s === 'none' && u.ord.t === 'attack' && u.ord.auto) nextOrder(u); } },
  patrol(units, x, y) {
    for (const u of units) if (u && !u.dead && !u.gIn) { issue(u, { t: 'amove', x, y, bx: u.x, by: u.y, patrol: true }, false); }
  },
  ground(units, x, y) { for (const u of units) if (u && !u.dead && ST(u.owner, u.type).ground) issue(u, { t: 'ground', x, y }, false); },
  dropRelic(units) { for (const u of units) if (u && u.relic) dropRelic(u); },
  del(ents) {
    for (const e of ents) {
      if (!e || e.dead) continue;
      if (e.k === 'b' && !e.built && e.prog < .01) addRes(G.players[e.owner], ST(e.owner, e.type).cost);
      if (e.k === 'u' && e.gIn) { const b = byId(e.gIn); if (b) b.gar = b.gar.filter(i => i !== e.id); e.gIn = 0; }
      killEnt(e, -1);
    }
  },
  rally(b, x, y, id) { if (b && !b.dead) b.rally = { x, y, id: id || 0 }; },
  train(b, key, n) {
    const p = G.players[b.owner];
    let done = 0;
    for (let k = 0; k < (n || 1); k++) {
      if (!b.built || b.q.length >= 15) break;
      if (!unitAvailable(p, key)) break;
      const type = resolveTrain(p, key);
      const s = ST(p.id, type);
      if (!canAfford(p, s.cost)) break;
      pay(p, s.cost);
      b.q.push({ k: 'u', key, type, t: 0 });
      done++;
    }
    return done;
  },
  research(b, id) {
    const p = G.players[b.owner];
    if (!b.built || b.q.length >= 15 || !techAvailable(p, id)) return false;
    const t = T[id];
    if (t.ageUp && !ageReqMet(p)) return false;
    const c = techCost(p, id);
    if (!canAfford(p, c)) return false;
    pay(p, c);
    p.researching[id] = b.id;
    if (t.ageUp) p.aging = true;
    b.q.push({ k: 't', id, t: 0 });
    return true;
  },
  cancel(b, qi) {
    const it = b.q[qi];
    if (!it) return;
    b.q.splice(qi, 1);
    refundItem(G.players[b.owner], it);
  },
  bell(p) {
    p.bell = !p.bell;
    if (p.bell) {
      for (const u of G.units) {
        if (u.dead || u.owner !== p.id || !isVil(u) || u.gIn) continue;
        let best = null, bd = 30;
        for (const b of G.blds) {
          if (b.dead || !b.built || b.owner !== p.id || !B[b.type].garrison) continue;
          if (b.gar.length + (b.inbound || 0) >= B[b.type].garrison) continue;
          const d = distToRect(u.x, u.y, b.x, b.y, b.x + b.w, b.y + b.h);
          if (d < bd) { bd = d; best = b; }
        }
        if (best) { best.inbound = (best.inbound || 0) + 1; u.bellPrev = u.ord.t === 'garrison' ? null : JSON.parse(JSON.stringify(u.ord)); issue(u, { t: 'garrison', id: best.id }, false); }
      }
      for (const b of G.blds) b.inbound = 0;
    } else {
      for (const b of G.blds) {
        if (b.dead || b.owner !== p.id) continue;
        const out = ejectAll(b, u => isVil(u));
        for (const u of out) { if (u.bellPrev && u.bellPrev.t !== 'idle') { u.ord = u.bellPrev; u.path = null; } u.bellPrev = null; }
      }
      for (const u of G.units) if (!u.dead && u.owner === p.id && isVil(u) && u.ord.t === 'garrison') { u.ord = u.bellPrev || { t: 'idle' }; u.bellPrev = null; u.path = null; }
    }
  },
  market(p, res, buy) {
    if (!p.cnt.market) return false;
    const price = p.market[res];
    if (buy) {
      const cost = Math.round(price * (1 + p.commission));
      if (p.res.gold < cost) return false;
      p.res.gold -= cost; p.res[res] += 100;
      p.market[res] = Math.min(9999, price + 5);
    } else {
      if (p.res[res] < 100) return false;
      const gain = Math.round(price * (1 - p.commission));
      p.res[res] -= 100; p.res.gold += gain;
      p.market[res] = Math.max(20, price - 5);
    }
    return true;
  },
  tribute(p, to, res, amt) {
    const q = G.players[to];
    if (!q || !q.alive || to === p.id || !p.cnt.market) return false;
    const fee = Math.ceil(amt * p.tributeFee);
    if (p.res[res] < amt + fee) return false;
    p.res[res] -= amt + fee; q.res[res] += amt; p.st.trib += amt;
    pushEvent('tribute', to, { from: p.id, res, amt });
    return true;
  },
  // context command (right click)
  smart(units, x, y, ent, o) {
    o = o || {};
    const shift = o.shift;
    const rest = [];
    for (const u of units) {
      if (!u || u.dead || u.gIn) continue;
      const s = ST(u.owner, u.type);
      const vil = isVil(u);
      if (ent && !ent.dead) {
        const e = ent;
        // enemy
        if (e.k !== 'r' && e.owner >= 0 && isEnemy(u.owner, e.owner)) {
          if (u.type === 'monk' && e.k === 'u') { issue(u, { t: 'convert', id: e.id }, shift); continue; }
          if (s.atk > 0 && !(s.onlyBld && e.k === 'u' && !U[e.type].cls.includes('siege'))) { issue(u, { t: 'attack', id: e.id }, shift); u.gx = u.x; u.gy = u.y; continue; }
        }
        // wildlife
        if (e.k === 'u' && e.owner === -1) {
          if (vil && U[e.type].food) { Cmd.gather([u], e, shift); continue; }
          if (s.atk > 0 && !s.onlyBld) { issue(u, { t: 'attack', id: e.id }, shift); continue; }
        }
        // own sheep
        if (e.k === 'u' && e.owner === u.owner && U[e.type].animal && vil) { Cmd.gather([u], e, shift); continue; }
        // resources
        if (e.k === 'r') {
          if (e.type === 'relic') { if (u.type === 'monk' && !u.relic && !e.carrier && !e.inB) { issue(u, { t: 'relic', id: e.id }, shift); continue; } }
          else if (vil && e.type !== 'fish') { Cmd.gather([u], e, shift); continue; }
          else if (u.type === 'fishingShip' && e.type === 'fish') { Cmd.gather([u], e, shift); continue; }
        }
        // healing
        if (e.k === 'u' && u.type === 'monk' && allied(u.owner, e.owner) && e.hp < e.mhp && e !== u) { issue(u, { t: 'heal', id: e.id }, shift); continue; }
        // own / allied buildings
        if (e.k === 'b' && allied(u.owner, e.owner)) {
          const d = B[e.type];
          if (vil && e.owner === u.owner && !e.built) { issue(u, { t: 'build', id: e.id }, shift); continue; }
          if (vil && e.type === 'farm' && e.owner === u.owner) { Cmd.gather([u], e, shift); continue; }
          if (vil && e.built && e.hp < e.mhp) { issue(u, { t: 'repair', id: e.id }, shift); continue; }
          if (u.type === 'monk' && u.relic && e.type === 'monastery' && e.built) { issue(u, { t: 'relicIn', id: e.id }, shift); continue; }
          if ((vil || u.type === 'fishingShip') && u.carry > 0 && d.drop.includes(u.cres) && e.built && e.owner === u.owner) {
            const prev = u.ord.t === 'gather' ? u.ord : null;
            issue(u, { t: 'gather', id: prev ? prev.id : 0, ph: 'drop', drop: e.id, rtype: prev ? prev.rtype : null }, shift); continue;
          }
          if (e.owner === u.owner && e.built && d.garrison && (o.alt || (vil && p_bell(u))) && canGarrisonType(u, e)) { issue(u, { t: 'garrison', id: e.id }, shift); continue; }
        }
      }
      rest.push(u);
    }
    if (rest.length) Cmd.move(rest, x, y, { shift, amove: o.amove });
    return rest.length;
  },
};
function p_bell(u) { return G.players[u.owner].bell; }
function canGarrisonType(u, b) {
  const d = B[b.type];
  if (!d.garrison || b.owner !== u.owner) return false;
  return d.gcls.some(c => U[u.type].cls.includes(c));
}
