'use strict';
// ============================================================
//  Renderer
// ============================================================
const UNIT_SCALE = 1.4;
const R = {
  cv: null, ctx: null, dpr: 1, W: 0, H: 0,
  cam: { x: 0, y: 0, z: 1 }, terrain: null, mini: null, fogCv: null, fogCtx: null, fogImg: null, fogT: 0,
  hits: [], marks: [], parts: [], pings: [], t: 0, lastFrame: 0, hover: null, ghost: null, box: null, clouds: [],
  init(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.resize();
    for (let i = 0; i < 5; i++) this.clouds.push({ x: Math.random(), y: Math.random(), r: .25 + Math.random() * .25, s: .004 + Math.random() * .004 });
  },
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = this.cv.clientWidth, H = this.cv.clientHeight;
    if (W !== this.W || H !== this.H || dpr !== this.dpr) {
      this.W = W; this.H = H; this.dpr = dpr;
      this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    }
  },
  setup(G) {
    this.terrain = buildTerrain(G);
    this.mini = terrainMini(G);
    const N = G.N;
    this.fogCv = mkCanvas(N, N); this.fogCtx = this.fogCv.getContext('2d'); this.fogImg = this.fogCtx.createImageData(N, N);
    this.marks = []; this.parts = []; this.pings = []; this.hits = [];
    this.updateFog(true);
  },
  centerOn(x, y) { this.cam.x = isoX(x, y); this.cam.y = isoY(x, y); this.clampCam(); },
  clampCam() {
    if (!G) return;
    const N = G.N;
    this.cam.z = clamp(this.cam.z, .45, 2.2);
    // keep the view centre inside the map diamond
    let wx = this.cam.x / TW + this.cam.y / TH, wy = this.cam.y / TH - this.cam.x / TW;
    const m = 3;
    wx = clamp(wx, m, N - m); wy = clamp(wy, m, N - m);
    this.cam.x = isoX(wx, wy); this.cam.y = isoY(wx, wy);
  },
  // screen <-> world
  toScreen(x, y, z) { const c = this.cam; return [(isoX(x, y) - c.x) * c.z + this.W / 2, (isoY(x, y) - (z || 0) - c.y) * c.z + this.H / 2]; },
  toWorld(sx, sy) {
    const c = this.cam;
    const px = (sx - this.W / 2) / c.z + c.x, py = (sy - this.H / 2) / c.z + c.y;
    return [px / TW + py / TH, py / TH - px / TW];
  },
  mapTransform(ctx, unit) {
    // affine transform: map tile coords -> screen (unit = 1 tile)
    const c = this.cam, d = this.dpr, z = c.z;
    ctx.setTransform(d * z * TW / 2 * unit, d * z * TH / 2 * unit, -d * z * TW / 2 * unit, d * z * TH / 2 * unit, d * (this.W / 2 - z * c.x), d * (this.H / 2 - z * c.y));
  },
  updateFog(force) {
    if (!G || !this.fogImg) return;
    const hv = G.human >= 0 ? G.vis[G.human] : null;
    const d = this.fogImg.data, N = G.N;
    const all = G.cfg.reveal === 'all' || G.cfg.attract || !hv;
    for (let i = 0; i < N * N; i++) {
      const v = all ? 2 : hv[i];
      d[i * 4] = 6; d[i * 4 + 1] = 8; d[i * 4 + 2] = 14;
      d[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 120 : 255;
    }
    this.fogCtx.putImageData(this.fogImg, 0, 0);
  },
  visibleRange() {
    const pts = [this.toWorld(0, 0), this.toWorld(this.W, 0), this.toWorld(0, this.H), this.toWorld(this.W, this.H)];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [Math.floor(x0) - 2, Math.floor(y0) - 2, Math.ceil(x1) + 6, Math.ceil(y1) + 6];
  },
  frame(alpha, dtReal) {
    this.resize();
    const ctx = this.ctx, c = this.cam, d = this.dpr, W = this.W, H = this.H;
    this.t += dtReal;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#070a12'; ctx.fillRect(0, 0, W, H);
    if (!G || !this.terrain) return;
    const N = G.N, hv = G.human >= 0 && !G.cfg.attract ? G.vis[G.human] : null;
    const seeAll = !hv || G.cfg.reveal === 'all';
    const vis = (x, y) => seeAll || hv[tIdx(x, y)] === 2;
    const explored = (x, y) => seeAll || hv[tIdx(x, y)] > 0;
    // --- terrain ---
    ctx.imageSmoothingEnabled = true;
    this.mapTransform(ctx, 1 / this.terrain.T);
    ctx.drawImage(this.terrain.canvas, 0, 0);
    const [vx0, vy0, vx1, vy1] = this.visibleRange();
    // --- ground layer in map space ---
    this.mapTransform(ctx, 1);
    this.drawWater(ctx, vx0, vy0, vx1, vy1, explored);
    for (const dc of G.decals) {
      if (dc.x < vx0 || dc.x > vx1 || dc.y < vy0 || dc.y > vy1 || !explored(dc.x, dc.y)) continue;
      const age = G.time - dc.t;
      if (dc.k === 'rubble') {
        const a = clamp(1 - age / 90, 0, 1); if (a <= 0) continue;
        ctx.fillStyle = `rgba(60,48,36,${.55 * a})`; ctx.fillRect(dc.x + .1, dc.y + .1, dc.w - .2, dc.h - .2);
        ctx.fillStyle = `rgba(110,100,90,${.7 * a})`;
        for (let i = 0; i < dc.w * dc.h * 3; i++) ctx.fillRect(dc.x + hash2(i, dc.x, 1) * dc.w, dc.y + hash2(i, dc.y, 2) * dc.h, .14, .1);
      } else if (dc.k === 'stump') { ctx.fillStyle = '#5a3c22'; ctx.beginPath(); ctx.arc(dc.x, dc.y, .11, 0, 7); ctx.fill(); ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.arc(dc.x - .02, dc.y - .02, .07, 0, 7); ctx.fill(); }
    }
    // farms and building ground
    for (const b of G.blds) {
      if (b.dead || b.x > vx1 || b.y > vy1 || b.x + b.w < vx0 || b.y + b.h < vy0) continue;
      if (!(allied(b.owner, Math.max(0, G.human)) || seeAll || (b.seen & (1 << G.human)) || vis(b.x + b.w / 2, b.y + b.h / 2))) continue;
      if (b.type === 'farm') this.drawFarm(ctx, b);
    }
    // selection rings & rally
    this.drawSelectionGround(ctx);
    // corpses
    // --- sprites ---
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const list = [];
    const stampSeen = new Set();
    for (let ty = Math.max(0, vy0); ty <= Math.min(N - 1, vy1); ty++) for (let tx = Math.max(0, vx0); tx <= Math.min(N - 1, vx1); tx++) {
      const o = G.occ[ty * N + tx];
      if (o < 0 || stampSeen.has(o)) continue;
      stampSeen.add(o);
      const e = G.byId.get(o);
      if (!e || e.dead) continue;
      if (e.k === 'r') { if (explored(e.x, e.y)) list.push({ e, dp: e.x + e.y }); }
      else if (e.type !== 'farm') {
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        if (allied(e.owner, Math.max(0, G.human)) || seeAll || vis(cx, cy) || (e.seen & (1 << G.human))) list.push({ e, dp: cx + cy });
      }
    }
    for (const g of G.ghosts) list.push({ ghost: g, dp: g.x + g.w / 2 + g.y + g.h / 2 });
    for (const r of G.ress) {
      if (r.dead || (r.type !== 'carcass' && r.type !== 'relic') || r.inB || r.carrier) continue;
      if (r.x < vx0 || r.x > vx1 || r.y < vy0 || r.y > vy1 || !vis(r.x, r.y)) continue;
      list.push({ e: r, dp: r.x + r.y - .3 });
    }
    for (const u of G.units) {
      if (u.dead || u.gIn || u.x < vx0 || u.x > vx1 || u.y < vy0 || u.y > vy1) continue;
      if (!(u.owner === G.human || seeAll || vis(u.x, u.y) || allied(u.owner, G.human))) continue;
      list.push({ e: u, dp: u.x + u.y });
    }
    for (const f of G.fx) if (f.k === 'corpse' && f.x >= vx0 && f.x <= vx1 && f.y >= vy0 && f.y <= vy1 && explored(f.x, f.y)) list.push({ corpse: f, dp: f.x + f.y - .5 });
    // units standing just behind a building (on its -x / -y side) must sort before it
    const N2 = G.N;
    const behind = (x, y, dp) => {
      const tx = Math.floor(x), ty = Math.floor(y);
      const own = tx >= 0 && ty >= 0 && tx < N2 && ty < N2 ? G.occ[ty * N2 + tx] : -1;
      for (let k = 0; k < 3; k++) {
        const nx = tx + (k !== 1 ? 1 : 0), ny = ty + (k !== 0 ? 1 : 0);
        if (nx >= N2 || ny >= N2) continue;
        const o = G.occ[ny * N2 + nx];
        if (o < 0 || o === own) continue;
        const b = G.byId.get(o);
        if (!b || b.k !== 'b' || b.type === 'farm') continue;
        const bk = b.x + b.w / 2 + b.y + b.h / 2 - .01;
        if (bk < dp) dp = bk;
      }
      return dp;
    };
    for (const it of list) {
      if (it.e && it.e.k === 'u') it.dp = behind(it.e.x, it.e.y, it.dp);
      else if (it.corpse) it.dp = behind(it.corpse.x, it.corpse.y, it.dp);
    }
    list.sort((a, b) => a.dp - b.dp);
    this.hits = [];
    for (const it of list) {
      if (it.corpse) this.drawCorpse(ctx, it.corpse);
      else if (it.ghost) this.drawBuilding(ctx, it.ghost, true);
      else if (it.e.k === 'u') this.drawUnit(ctx, it.e, alpha);
      else if (it.e.k === 'b') this.drawBuilding(ctx, it.e, false);
      else this.drawRes(ctx, it.e);
    }
    // --- projectiles & particles ---
    this.drawProjectiles(ctx, vis);
    this.drawParticles(ctx, dtReal, vis);
    // cloud shadows
    if (!Settings.lowFx) this.drawClouds(ctx);
    // --- fog ---
    if (!seeAll) {
      this.fogT -= dtReal;
      if (this.fogT <= 0) { this.fogT = .1; this.updateFog(); }
      ctx.imageSmoothingEnabled = true;
      this.mapTransform(ctx, 1);
      ctx.drawImage(this.fogCv, 0, 0);
      // hard edge for unexplored outer area
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    // --- overlays ---
    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.drawOverlays(ctx, vis);
  },
  drawWater(ctx, x0, y0, x1, y1, explored) {
    if (Settings.lowFx) return;
    const N = G.N, t = this.t;
    ctx.lineWidth = .045; ctx.lineCap = 'round';
    let n = 0;
    for (let y = Math.max(0, y0); y <= Math.min(N - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(N - 1, x1); x++) {
      const tt = G.terrain[y * N + x];
      if (tt !== TER.DEEP && tt !== TER.SHALLOW) continue;
      if (++n > 1600) return;
      const h = hash2(x, y, 11);
      const ph = t * .6 + h * 6.28;
      const a = (Math.sin(ph) * .5 + .5) * (tt === TER.DEEP ? .22 : .16);
      ctx.strokeStyle = `rgba(200,230,240,${a})`;
      const ox = x + .15 + h * .5 + Math.sin(t * .4 + h * 9) * .08, oy = y + .2 + hash2(x, y, 12) * .6;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + .28, oy - .02); ctx.stroke();
    }
  },
  drawFarm(ctx, b) {
    const f = b.built ? clamp(b.food / farmFood(G.players[b.owner]), 0, 1) : 0;
    ctx.fillStyle = '#6b4a2c'; ctx.fillRect(b.x + .1, b.y + .1, b.w - .2, b.h - .2);
    ctx.strokeStyle = '#4e3520'; ctx.lineWidth = .05;
    for (let i = 0; i < 8; i++) { const y = b.y + .25 + i * .34; ctx.beginPath(); ctx.moveTo(b.x + .15, y); ctx.lineTo(b.x + b.w - .15, y); ctx.stroke(); }
    if (b.built) {
      const rows = 8, prog = b.prog;
      const crop = f > .5 ? '#6fa43a' : f > .2 ? '#b8a840' : '#c9a14a';
      ctx.fillStyle = crop;
      for (let i = 0; i < rows; i++) {
        if (i / rows > f + .1) continue;
        const y = b.y + .2 + i * .34;
        for (let k = 0; k < 14; k++) ctx.fillRect(b.x + .2 + k * .19, y - .05, .1, .1);
      }
      void prog;
    } else {
      ctx.fillStyle = 'rgba(160,120,70,.6)'; ctx.fillRect(b.x + .1, b.y + .1, (b.w - .2) * b.prog, b.h - .2);
    }
    ctx.strokeStyle = 'rgba(40,28,16,.6)'; ctx.lineWidth = .04; ctx.strokeRect(b.x + .1, b.y + .1, b.w - .2, b.h - .2);
  },
  drawSelectionGround(ctx) {
    const sel = UI.sel;
    const t = this.t;
    for (const id of sel) {
      const e = byId(id);
      if (!e || e.dead || e.gIn) continue;
      const col = e.owner === G.human ? '#7cf27c' : e.owner < 0 ? '#f2e27c' : allied(e.owner, G.human) ? '#7cc8f2' : '#f27c7c';
      ctx.strokeStyle = col; ctx.lineWidth = .06;
      if (e.k === 'u') { ctx.beginPath(); ctx.arc(e.x, e.y, e.r + .14, 0, 7); ctx.stroke(); }
      else if (e.k === 'b') { ctx.strokeRect(e.x + .02, e.y + .02, e.w - .04, e.h - .04); }
      else if (e.k === 'r') { ctx.beginPath(); ctx.arc(e.x, e.y, .55, 0, 7); ctx.stroke(); }
      if (e.k === 'b' && e.owner === G.human && e.rally) {
        ctx.setLineDash([.15, .12]); ctx.strokeStyle = 'rgba(240,230,190,.7)'; ctx.lineWidth = .04;
        ctx.beginPath(); ctx.moveTo(e.x + e.w / 2, e.y + e.h / 2); ctx.lineTo(e.rally.x, e.rally.y); ctx.stroke(); ctx.setLineDash([]);
      }
      if (e.k === 'u' && e.owner === G.human && (e.ord.t === 'move' || e.ord.t === 'amove' || e.q.length)) {
        ctx.fillStyle = 'rgba(240,230,190,.7)';
        const pts = [e.ord].concat(e.q).filter(o => o.x != null);
        for (const o of pts) { ctx.beginPath(); ctx.arc(o.x, o.y, .07, 0, 7); ctx.fill(); }
      }
    }
    // hovered entity ring
    const h = this.hover;
    if (h && !h.dead && !UI.sel.includes(h.id) && h.k !== 'r') {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = .04;
      if (h.k === 'u') { ctx.beginPath(); ctx.arc(h.x, h.y, h.r + .12, 0, 7); ctx.stroke(); }
      else if (h.k === 'b') ctx.strokeRect(h.x, h.y, h.w, h.h);
    }
    // command markers
    for (const m of this.marks) {
      const a = 1 - (t - m.t) / .6; if (a <= 0) continue;
      ctx.strokeStyle = m.col.replace('A', a.toFixed(2)); ctx.lineWidth = .06;
      ctx.beginPath(); ctx.arc(m.x, m.y, .2 + (1 - a) * .35, 0, 7); ctx.stroke();
    }
    this.marks = this.marks.filter(m => t - m.t < .6);
    // building placement ghost footprint
    const gh = this.ghost;
    if (gh) for (const p of gh.tiles) {
      ctx.fillStyle = p.ok ? 'rgba(110,230,110,.28)' : 'rgba(240,80,70,.35)';
      ctx.fillRect(p.x, p.y, gh.w, gh.h);
      ctx.strokeStyle = p.ok ? 'rgba(160,255,160,.8)' : 'rgba(255,120,110,.9)'; ctx.lineWidth = .04; ctx.strokeRect(p.x, p.y, gh.w, gh.h);
    }
  },
  spriteAt(ctx, s, wx, wy, scale, flip, alpha, zOff) {
    const c = this.cam;
    const sx = (isoX(wx, wy) - c.x) * c.z + this.W / 2, sy = (isoY(wx, wy) - c.y - (zOff || 0)) * c.z + this.H / 2;
    const k = c.z * (scale || 1);
    const w = s.w * k, h = s.h * k; // logical sprite units are screen pixels at zoom 1
    if (sx + w < -50 || sx - w > this.W + 50 || sy + h < -50 || sy - h > this.H + 80) return null;
    if (alpha != null && alpha < 1) ctx.globalAlpha = alpha;
    if (flip) { ctx.save(); ctx.translate(sx, sy); ctx.scale(-1, 1); ctx.drawImage(s.c, -s.ax * k, -s.ay * k, w, h); ctx.restore(); }
    else ctx.drawImage(s.c, sx - s.ax * k, sy - s.ay * k, w, h);
    if (alpha != null && alpha < 1) ctx.globalAlpha = 1;
    return [sx - s.ax * k, sy - s.ay * k, w, h, sx, sy];
  },
  shadow(ctx, wx, wy, rx, ry) {
    const [sx, sy] = this.toScreen(wx, wy); const z = this.cam.z;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(sx + 1.5 * z, sy + .5 * z, rx * z, ry * z, 0, 0, 7); ctx.fill();
  },
  drawUnit(ctx, u, alpha) {
    const x = lerp(u.px, u.x, alpha), y = lerp(u.py, u.y, alpha);
    const d = U[u.type];
    const fk = unitFrameKey(u, this.t);
    const p = u.owner >= 0 ? G.players[u.owner] : null;
    const col = p ? p.color : 6;
    const skin = p ? CIV_SKIN[p.civ] : 1;
    const s = unitSprite(u.type, col, fk.anim, fk.f, u.back && !d.animal && d.dom !== 'w' && !d.cls.includes('siege') ? 1 : 0, fk.tool, fk.carry, skin);
    const big = (d.cls.includes('siege') || d.dom === 'w' ? 14 : (UNIT_ART[d.art] || {}).mount ? 11 : 6) * UNIT_SCALE;
    if (d.dom !== 'w') this.shadow(ctx, x, y, big, big * .45);
    else { const [sx, sy] = this.toScreen(x, y); ctx.strokeStyle = 'rgba(220,240,255,.35)'; ctx.lineWidth = this.cam.z; ctx.beginPath(); ctx.ellipse(sx, sy, 20 * this.cam.z, 6 * this.cam.z, 0, 0, 7); ctx.stroke(); }
    const flip = u.fr < 0;
    const r = this.spriteAt(ctx, s, x, y, UNIT_SCALE, flip, 1);
    if (!r) return;
    if (u.relic) { const rs = resSprite('relic', 0); this.spriteAt(ctx, rs, x, y, .5, false, 1, 24); }
    this.hits.push({ e: u, x: r[0], y: r[1], w: r[2], h: r[3] });
  },
  drawCorpse(ctx, f) {
    const a = clamp(1 - f.t / f.life, 0, 1) * (f.t < .5 ? f.t * 2 : 1);
    const p = f.owner >= 0 ? G.players[f.owner] : null;
    const s = corpseSprite(f.type, p ? p.color : 6);
    this.spriteAt(ctx, s, f.x, f.y, UNIT_SCALE, f.fr < 0, a * .9);
  },
  drawBuilding(ctx, b, ghost) {
    const d = B[b.type], p = G.players[b.owner];
    const arch = CIVS[p.civ].arch;
    const age = Math.min(3, p.age);
    const ageI = b.type === 'house' || b.type === 'mill' || b.type === 'lumber' || b.type === 'mining' ? Math.min(age, 3) : age;
    const wx = b.x, wy = b.y;
    let r, hs = null, cut = 0; // hs: the sprite clicks are tested against; cut: logical px hidden at its top
    const fill = ghost ? .55 : 1;
    if (b.type === 'palisade' || b.type === 'wall' || b.type === 'gate') this.shadow(ctx, wx + .5, wy + .5, 18, 7);
    if (!b.built && !ghost) {
      const fs = foundationSprite(b.type);
      r = this.spriteAt(ctx, fs, wx, wy, 1, false, 1);
      if (b.prog > .02) {
        const s = bldSprite(b.type, arch, ageI);
        const c = this.cam, z = c.z;
        const sx = (isoX(wx, wy) - c.x) * z + this.W / 2, sy = (isoY(wx, wy) - c.y) * z + this.H / 2;
        hs = s; cut = (1 - b.prog) * s.ay; // logical px of the sprite still hidden above ground
        ctx.globalAlpha = .92;
        ctx.drawImage(s.c, 0, cut * s.s, s.c.width, s.c.height - cut * s.s, sx - s.ax * z, sy - s.ay * z + cut * z, s.w * z, s.h * z - cut * z);
        ctx.globalAlpha = 1;
        // scaffolding
        ctx.strokeStyle = 'rgba(120,80,40,.9)'; ctx.lineWidth = Math.max(1, c.z);
        const top = Math.max(8, (BH[b.type] || 40) * b.prog * .8);
        for (const [x, y] of [[0, d.h], [d.w, d.h], [d.w, 0]]) { const p0 = this.toScreen(wx + x, wy + y), p1 = this.toScreen(wx + x, wy + y, top); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
      }
    } else {
      const s = bldSprite(b.type, arch, ageI);
      r = this.spriteAt(ctx, s, wx, wy, 1, false, fill);
      if (r && !ghost) this.buildingLive(ctx, b, arch);
      hs = s;
    }
    if (r && !ghost) {
      this.hits.push({ e: b, x: r[0], y: r[1], w: r[2], h: r[3], bld: true, s: hs, cut, ox: r[4], oy: r[5] });
    }
  },
  buildingLive(ctx, b, arch) {
    const d = B[b.type], p = G.players[b.owner], pc = PCOLORS[p.color];
    const z = this.cam.z, t = this.t;
    // flag
    if (!['house', 'farm', 'palisade', 'wall', 'gate', 'lumber', 'mining'].includes(b.type)) {
      const H = (BH[b.type] || 50);
      const fx = b.x + d.w * .82, fy = b.y + d.h * .18;
      const [sx, sy] = this.toScreen(fx, fy, b.type === 'tower' ? H * .78 : H * .45);
      const ph = 22 * z;
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = Math.max(1, 1.2 * z);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - ph); ctx.stroke();
      ctx.fillStyle = pc.c; ctx.beginPath();
      ctx.moveTo(sx, sy - ph);
      for (let i = 0; i <= 6; i++) { const xx = sx + i * 2 * z, yy = sy - ph + Math.sin(t * 5 + i * .9 + b.id) * 1.2 * z; ctx.lineTo(xx, yy); }
      for (let i = 6; i >= 0; i--) { const xx = sx + i * 2 * z, yy = sy - ph + 7 * z + Math.sin(t * 5 + i * .9 + b.id) * 1.2 * z; ctx.lineTo(xx, yy); }
      ctx.closePath(); ctx.fill();
    }
    // windmill sails
    if (b.type === 'mill' && arch === 'west' && b.built) {
      const [sx, sy] = this.toScreen(b.x + 1.25, b.y + 1.55, 40);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * .8);
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = 'rgba(235,225,200,.95)'; ctx.fillRect(2 * z, -2 * z, 20 * z, 4.5 * z); ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = z; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(23 * z, 0); ctx.stroke(); }
      ctx.restore();
    }
    // chimney smoke
    if ((b.type === 'blacksmith' || (b.type === 'house' && arch === 'west')) && b.built && Math.random() < .08 && !Settings.lowFx) {
      const pos = b.type === 'blacksmith' ? [b.x + .7, b.y + .7, 56] : [b.x + 1.3, b.y + .6, 46];
      this.parts.push({ k: 'puff', x: pos[0], y: pos[1], z: pos[2], t: 0, life: 2.5, vx: .05, vy: -.02 });
    }
  },
  drawRes(ctx, r) {
    if (r.type === 'tree') {
      const kind = G.mapType === 'savanna' ? (r.v % 3 === 0 ? 'palm' : 'dry') : (G.terrain[tIdx(r.x, r.y)] === TER.SAND ? 'palm' : (r.v % 5 < 2 ? 'pine' : 'leaf'));
      const s = treeSprite(r.v % 6, kind);
      this.shadow(ctx, r.x + .15, r.y + .05, 14, 6);
      const sway = 0;
      const res = this.spriteAt(ctx, s, r.x + sway, r.y, .85 + (r.v % 7) * .04, r.v % 2 === 0, 1);
      if (res) this.hits.push({ e: r, x: res[0] + res[2] * .25, y: res[1] + res[3] * .3, w: res[2] * .5, h: res[3] * .7 });
    } else if (r.type === 'fish') {
      const [sx, sy] = this.toScreen(r.x, r.y);
      const z = this.cam.z, t = this.t;
      ctx.fillStyle = 'rgba(20,40,60,.55)';
      for (let i = 0; i < 4; i++) { const a = t * .8 + i * 1.6 + r.v; ctx.beginPath(); ctx.ellipse(sx + Math.cos(a) * 10 * z, sy + Math.sin(a) * 5 * z, 4 * z, 1.6 * z, Math.cos(a), 0, 7); ctx.fill(); }
      ctx.strokeStyle = `rgba(220,240,255,${.25 + Math.sin(t * 2 + r.v) * .15})`; ctx.lineWidth = z;
      ctx.beginPath(); ctx.ellipse(sx, sy, 14 * z, 6 * z, 0, 0, 7); ctx.stroke();
      this.hits.push({ e: r, x: sx - 16 * z, y: sy - 8 * z, w: 32 * z, h: 16 * z });
    } else if (r.type === 'carcass') {
      const sp = corpseSprite(r.anim || 'deer', 6);
      const res = this.spriteAt(ctx, sp, r.x, r.y, UNIT_SCALE, false, 1);
      if (res) this.hits.push({ e: r, x: res[0], y: res[1], w: res[2], h: res[3] });
    } else {
      const s = resSprite(r.type, r.v);
      const sc = r.type === 'relic' ? .55 : (.75 + .25 * clamp(r.amt / (r.max || 1), 0, 1));
      if (r.type === 'relic') { const [sx, sy] = this.toScreen(r.x, r.y); const g = ctx.createRadialGradient(sx, sy - 6, 0, sx, sy - 6, 22 * this.cam.z); g.addColorStop(0, 'rgba(255,220,120,.35)'); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 30, sy - 36, 60, 60); }
      const res = this.spriteAt(ctx, s, r.x, r.y, sc, r.v % 2 === 0, 1);
      if (res) this.hits.push({ e: r, x: res[0], y: res[1], w: res[2], h: res[3] });
    }
  },
  drawProjectiles(ctx, vis) {
    const z = this.cam.z;
    for (const pr of G.proj) {
      const k = pr.t / pr.dur;
      const x = lerp(pr.x0, pr.x1, k), y = lerp(pr.y0, pr.y1, k);
      if (!vis(x, y)) continue;
      const h = (pr.z0 * (1 - k) + Math.sin(k * Math.PI) * pr.arc) * 32;
      const [sx, sy] = this.toScreen(x, y, h);
      if (pr.kind === 'arrow' || pr.kind === 'bolt') {
        const k2 = Math.min(1, k + .03), x2 = lerp(pr.x0, pr.x1, k2), y2 = lerp(pr.y0, pr.y1, k2), h2 = (pr.z0 * (1 - k2) + Math.sin(k2 * Math.PI) * pr.arc) * 32;
        const [ex, ey] = this.toScreen(x2, y2, h2);
        const a = Math.atan2(ey - sy, ex - sx), L = (pr.kind === 'bolt' ? 6 : 8) * z;
        ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = Math.max(1, z * 1.1);
        ctx.beginPath(); ctx.moveTo(sx - Math.cos(a) * L, sy - Math.sin(a) * L); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = Math.max(1, z); ctx.beginPath(); ctx.moveTo(sx - Math.cos(a) * L, sy - Math.sin(a) * L); ctx.lineTo(sx - Math.cos(a) * L * .7, sy - Math.sin(a) * L * .7); ctx.stroke();
      } else if (pr.kind === 'ball') { ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(sx, sy, 1.6 * z, 0, 7); ctx.fill(); }
      else if (pr.kind === 'stone' || pr.kind === 'boulder') {
        const [gx, gy] = this.toScreen(x, y); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(gx, gy, 3 * z, 1.4 * z, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#6e6a62'; ctx.beginPath(); ctx.arc(sx, sy, (pr.kind === 'boulder' ? 4.5 : 3.2) * z, 0, 7); ctx.fill();
      } else if (pr.kind === 'axe') { ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.t * 18); ctx.strokeStyle = '#6a4426'; ctx.lineWidth = 1.5 * z; ctx.beginPath(); ctx.moveTo(-4 * z, 0); ctx.lineTo(4 * z, 0); ctx.stroke(); ctx.fillStyle = '#ccc'; ctx.fillRect(2 * z, -2.5 * z, 2.5 * z, 3 * z); ctx.restore(); }
    }
  },
  drawParticles(ctx, dt, vis) {
    const z = this.cam.z;
    // sim-time particles
    for (const f of G.fx) {
      if (f.k === 'corpse') continue;
      if (!vis(f.x, f.y)) continue;
      const k = clamp(f.t / f.life, 0, 1);
      if (f.t < 0) continue;
      if (f.k === 'smoke') {
        const [sx, sy] = this.toScreen(f.x, f.y, (f.z || 10) + k * 40);
        const r = (f.big ? 10 : 6) * (0.6 + k) * z;
        ctx.fillStyle = `rgba(70,66,60,${.4 * (1 - k)})`; ctx.beginPath(); ctx.arc(sx + k * 8 * z, sy, r, 0, 7); ctx.fill();
      } else if (f.k === 'fire') {
        const [sx, sy] = this.toScreen(f.x, f.y, (f.z || 10) + k * 12);
        const r = 4 * (1 - k * .6) * z;
        ctx.fillStyle = `rgba(255,${(180 - k * 120) | 0},60,${.85 * (1 - k)})`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      } else if (f.k === 'dust' || f.k === 'boom') {
        const [sx, sy] = this.toScreen(f.x, f.y, k * 10);
        const r = (f.k === 'boom' ? (f.big ? 22 : 14) : 6) * (.4 + k) * z;
        if (f.k === 'boom' && k < .25) { ctx.fillStyle = `rgba(255,200,90,${.7 * (1 - k * 4)})`; ctx.beginPath(); ctx.arc(sx, sy, r * .6, 0, 7); ctx.fill(); }
        ctx.fillStyle = `rgba(150,128,96,${.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      } else if (f.k === 'stuck') {
        const [sx, sy] = this.toScreen(f.x, f.y);
        ctx.strokeStyle = `rgba(60,40,24,${1 - k})`; ctx.lineWidth = Math.max(1, z);
        const a = f.a + Math.PI * .25;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(a) * 5 * z, sy - 4 * z); ctx.stroke();
      } else if (f.k === 'conv') {
        const [sx, sy] = this.toScreen(f.x, f.y, 10 + k * 20);
        ctx.strokeStyle = `rgba(255,230,140,${1 - k})`; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.arc(sx, sy, (6 + k * 16) * z, 0, 7); ctx.stroke();
      }
    }
    // render-only particles
    const keep = [];
    for (const p of this.parts) {
      p.t += dt; if (p.t >= p.life) continue; keep.push(p);
      if (!vis(p.x, p.y)) continue;
      const k = p.t / p.life;
      const [sx, sy] = this.toScreen(p.x + p.vx * p.t * 10, p.y + p.vy * p.t * 10, p.z + k * 30);
      ctx.fillStyle = `rgba(200,200,200,${.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(sx, sy, (3 + k * 7) * z, 0, 7); ctx.fill();
    }
    this.parts = keep.length > 300 ? keep.slice(-300) : keep;
  },
  drawClouds(ctx) {
    const N = G.N, t = this.t;
    for (const c of this.clouds) {
      const x = ((c.x + t * c.s) % 1.3 - .15) * N, y = ((c.y + t * c.s * .6) % 1.3 - .15) * N;
      const [sx, sy] = this.toScreen(x, y);
      const r = c.r * N * 32 * this.cam.z * .5;
      if (sx + r < 0 || sx - r > this.W || sy + r < 0 || sy - r > this.H) continue;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, 'rgba(10,20,30,.13)'); g.addColorStop(1, 'rgba(10,20,30,0)');
      ctx.fillStyle = g; ctx.save(); ctx.translate(sx, sy); ctx.scale(1, .5); ctx.translate(-sx, -sy); ctx.fillRect(sx - r, sy - r, r * 2, r * 2); ctx.restore();
    }
  },
  drawOverlays(ctx, vis) {
    const z = this.cam.z;
    // HP bars
    const mode = Settings.hpBars;
    const sel = new Set(UI.sel);
    const bar = (e, sx, sy, w) => {
      const f = clamp(e.hp / e.mhp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(sx - w / 2 - 1, sy - 1, w + 2, 5);
      ctx.fillStyle = f > .6 ? '#5bd15b' : f > .3 ? '#e6c229' : '#e04a3a'; ctx.fillRect(sx - w / 2, sy, w * f, 3);
      if (e.k === 'b' && !e.built) { ctx.fillStyle = '#7ab0ff'; ctx.fillRect(sx - w / 2, sy + 3.5, w * e.prog, 2); }
    };
    for (const h of this.hits) {
      const e = h.e;
      if (e.k === 'r') continue;
      const show = sel.has(e.id) || mode === 'all' || (mode === 'damaged' && e.hp < e.mhp - .5) || (e === this.hover);
      if (!show) continue;
      if (e.k === 'u') { const [sx, sy] = this.toScreen(e.x, e.y); bar(e, sx, sy - (U[e.type].cls.includes('siege') || isShip(e) ? 42 : (UNIT_ART[U[e.type].art] || {}).mount ? 40 : 30) * z * UNIT_SCALE, 22 * z); }
      else { const [sx, sy] = this.toScreen(e.x + e.w / 2, e.y + e.h / 2, (BH[e.type] || 40) * .8 + 12); bar(e, sx, sy - 6, Math.max(26, e.w * 16) * z); }
    }
    // resource amount when selected
    for (const id of UI.sel) {
      const e = byId(id); if (!e || e.dead) continue;
      if (e.k === 'b' && e.owner === G.human && e.rally) {
        const [sx, sy] = this.toScreen(e.rally.x, e.rally.y);
        ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 18 * z); ctx.stroke();
        ctx.fillStyle = PCOLORS[G.players[G.human].color].c; ctx.beginPath(); ctx.moveTo(sx, sy - 18 * z); ctx.lineTo(sx + 10 * z, sy - 14 * z); ctx.lineTo(sx, sy - 10 * z); ctx.fill();
      }
    }
    // placement ghost sprite
    const gh = this.ghost;
    if (gh && gh.tiles.length && G.human >= 0) {
      const arch = CIVS[G.players[G.human].civ].arch;
      const s = gh.type === 'farm' ? null : bldSprite(gh.type, arch, Math.min(3, G.players[G.human].age));
      if (s) for (const p of gh.tiles.slice(0, 60)) this.spriteAt(ctx, s, p.x, p.y, 1, false, .55);
    }
    // alert pings
    const t = this.t;
    this.pings = this.pings.filter(p => t - p.t < 4);
    for (const p of this.pings) {
      const [sx, sy] = this.toScreen(p.x, p.y);
      const k = ((t - p.t) % 1);
      ctx.strokeStyle = `rgba(255,90,70,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, (10 + k * 40) * z, (5 + k * 20) * z, 0, 0, 7); ctx.stroke();
    }
    // drag box
    if (this.box) { const b = this.box; ctx.strokeStyle = 'rgba(160,255,160,.9)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(160,255,160,.08)'; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.strokeRect(b.x0 + .5, b.y0 + .5, b.x1 - b.x0, b.y1 - b.y0); }
  },
  // is the building sprite of hit h opaque at screen point (sx, sy)? Alpha masks are built once per sprite.
  solidAt(h, sx, sy) {
    const s = h.s, z = this.cam.z;
    const lx = Math.floor(s.ax + (sx - h.ox) / z), ly = Math.floor(s.ay + (sy - h.oy) / z); // logical sprite px
    if (lx < 0 || ly < 0 || lx >= s.w || ly >= s.h || ly < h.cut) return false;
    if (!s.mask) {
      const W = s.c.width, H = s.c.height, k = s.s, mw = Math.ceil(s.w), mh = Math.ceil(s.h);
      const m = new Uint8Array(mw * mh);
      try {
        const d = s.c.getContext('2d').getImageData(0, 0, W, H).data;
        for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
          // a logical pixel is solid if any device pixel in it is fairly opaque
          let a = 0;
          for (let yy = Math.floor(y * k); yy < Math.min(H, Math.ceil((y + 1) * k)) && a < 140; yy++)
            for (let xx = Math.floor(x * k); xx < Math.min(W, Math.ceil((x + 1) * k)); xx++) { const v = d[(yy * W + xx) * 4 + 3]; if (v > a) a = v; }
          m[y * mw + x] = a >= 140 ? 1 : 0;
        }
      } catch (e) { m.fill(1); }
      s.mask = { m, w: mw };
    }
    return s.mask.m[ly * s.mask.w + lx] === 1;
  },
  pick(sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (sx < h.x || sy < h.y || sx > h.x + h.w || sy > h.y + h.h) continue;
      if (h.bld) {
        // a building is hit on its ground footprint or on a solid pixel of its picture,
        // not on the empty margin, shadow or smoke around it
        const b = h.e;
        if (wx >= b.x && wy >= b.y && wx <= b.x + b.w && wy <= b.y + b.h) return b;
        if (h.s && this.solidAt(h, sx, sy)) return b;
        continue;
      }
      return h.e;
    }
    // farms lie flat on the ground and are not in the sprite hit list: pick them by the tile under the cursor
    return this.farmAt(wx, wy);
  },
  farmAt(wx, wy) {
    if (!G || !G.occ) return null;
    const tx = Math.floor(wx), ty = Math.floor(wy);
    if (tx < 0 || ty < 0 || tx >= G.N || ty >= G.N) return null;
    const f = G.byId.get(G.occ[ty * G.N + tx]);
    if (!f || f.dead || f.k !== 'b' || f.type !== 'farm') return null;
    // only farms the player can see (the same rule as drawing them)
    const hv = G.human >= 0 && !G.cfg.attract ? G.vis[G.human] : null;
    if (!hv || G.cfg.reveal === 'all' || allied(f.owner, G.human) || (f.seen & (1 << G.human)) || hv[tIdx(f.x + f.w / 2, f.y + f.h / 2)] === 2) return f;
    return null;
  },
  // ---------------- minimap ----------------
  drawMini(mc) {
    if (!G || !this.mini) return;
    const ctx = mc.getContext('2d');
    const W = mc.width, H = mc.height, N = G.N;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sx = W / (2 * N), sy = H / (2 * N);
    const T = (x, y) => [W / 2 + (x - y) * sx, (x + y) * sy];
    ctx.setTransform(sx, sy, -sx, sy, W / 2, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mini, 0, 0);
    const hv = G.human >= 0 && !G.cfg.attract ? G.vis[G.human] : null;
    const seeAll = !hv || G.cfg.reveal === 'all';
    // resources
    for (const r of G.ress) {
      if (r.dead || r.inB || r.carrier) continue;
      if (!seeAll && hv[tIdx(r.x, r.y)] === 0) continue;
      if (r.type === 'tree') { ctx.fillStyle = '#244a1c'; ctx.fillRect(r.x - .5, r.y - .5, 1, 1); }
      else if (r.type === 'gold') { ctx.fillStyle = '#f2cf4a'; ctx.fillRect(r.x - .6, r.y - .6, 1.2, 1.2); }
      else if (r.type === 'stone') { ctx.fillStyle = '#c9c9c3'; ctx.fillRect(r.x - .6, r.y - .6, 1.2, 1.2); }
      else if (r.type === 'berry') { ctx.fillStyle = '#c03a4a'; ctx.fillRect(r.x - .5, r.y - .5, 1, 1); }
      else if (r.type === 'relic') { ctx.fillStyle = '#ffffff'; ctx.fillRect(r.x - .8, r.y - .8, 1.6, 1.6); }
      else if (r.type === 'fish') { ctx.fillStyle = '#9fd6f0'; ctx.fillRect(r.x - .5, r.y - .5, 1, 1); }
    }
    for (const b of G.blds) {
      if (b.dead) continue;
      if (!seeAll && !allied(b.owner, G.human) && !(b.seen & (1 << G.human))) continue;
      ctx.fillStyle = PCOLORS[G.players[b.owner].color].c;
      ctx.fillRect(b.x - .2, b.y - .2, b.w + .4, b.h + .4);
    }
    for (const u of G.units) {
      if (u.dead || u.gIn) continue;
      if (u.owner < 0) { if (U[u.type].animal && (seeAll || hv[tIdx(u.x, u.y)] === 2)) { ctx.fillStyle = '#d8c8a0'; ctx.fillRect(u.x - .5, u.y - .5, 1, 1); } continue; }
      if (!seeAll && !allied(u.owner, G.human) && hv[tIdx(u.x, u.y)] !== 2) continue;
      ctx.fillStyle = PCOLORS[G.players[u.owner].color].l;
      ctx.fillRect(u.x - .9, u.y - .9, 1.8, 1.8);
    }
    if (!seeAll) { ctx.drawImage(this.fogCv, 0, 0); }
    // camera
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const corners = [this.toWorld(0, 0), this.toWorld(this.W, 0), this.toWorld(this.W, this.H), this.toWorld(0, this.H)].map(([x, y]) => T(x, y));
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); corners.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.stroke();
    // pings
    const t = this.t;
    for (const p of this.pings) { const [x, y] = T(p.x, p.y); const k = (t - p.t) % 1; ctx.strokeStyle = `rgba(255,80,60,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 3 + k * 10, 0, 7); ctx.stroke(); }
    // border
    ctx.strokeStyle = 'rgba(192,154,91,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); [T(0, 0), T(N, 0), T(N, N), T(0, N)].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.stroke();
  },
  miniToWorld(mc, mx, my) {
    const N = G.N, W = mc.clientWidth, H = mc.clientHeight;
    const sx = W / (2 * N), sy = H / (2 * N);
    const px = (mx - W / 2) / sx, py = my / sy;
    return [(px + py) / 2, (py - px) / 2];
  },
};
