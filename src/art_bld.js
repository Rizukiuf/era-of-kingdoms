'use strict';
// ============================================================
//  Procedural art — buildings, resources, icons
// ============================================================
const ARCH = {
  west:    { wall: ['#8a6a45', '#d8ccb0', '#9b978e', '#aaa69c'], roof: ['#a8904f', '#7a5a3a', '#8f3b2b', '#4f5866'], trim: '#3e2c1c', roofT: 'gable' },
  nusa:    { wall: ['#8a6a45', '#b4553a', '#b0503a', '#a74a32'], roof: ['#3c342c', '#3a3029', '#2f2722', '#2a231e'], trim: '#5a2a1a', roofT: 'meru', gold: true },
  east:    { wall: ['#8a6a45', '#c9b088', '#e6e1d4', '#ebe6da'], roof: ['#a8904f', '#56504a', '#3d4351', '#323a4a'], trim: '#3a2a20', roofT: 'curved' },
  mideast: { wall: ['#a8804f', '#d2b283', '#cbbd9e', '#ddd2b8'], roof: ['#a8904f', '#b89363', '#4c8c88', '#3f7c8c'], trim: '#6a4a2a', roofT: 'flat' },
};
const BH = { house: 52, mill: 70, lumber: 40, mining: 40, farm: 6, dock: 50, market: 52, university: 80, wonder: 170, barracks: 60, archery: 56, stable: 56, blacksmith: 64, siege: 64, monastery: 100, castle: 120, tc: 110, tower: 92, palisade: 28, wall: 34, gate: 44 };
const P3 = (x, y, z) => [(x - y) * 32, (x + y) * 16 - z];

// --- primitives ---
function bBox(c, x0, y0, x1, y1, z0, z1, col, tex, opt) {
  opt = opt || {};
  const L = [P3(x0, y1, z0), P3(x1, y1, z0), P3(x1, y1, z1), P3(x0, y1, z1)];
  const R = [P3(x1, y1, z0), P3(x1, y0, z0), P3(x1, y0, z1), P3(x1, y1, z1)];
  const Tp = [P3(x0, y0, z1), P3(x1, y0, z1), P3(x1, y1, z1), P3(x0, y1, z1)];
  poly(c, L, shade(col, -.04)); poly(c, R, shade(col, -.3));
  if (!opt.noTop) poly(c, Tp, opt.top || shade(col, .12));
  if (tex) faceTex(c, x0, y0, x1, y1, z0, z1, col, tex);
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = .6;
  ln(c, ...P3(x1, y1, z0), ...P3(x1, y1, z1));
}
function faceTex(c, x0, y0, x1, y1, z0, z1, col, tex) {
  const dk = 'rgba(0,0,0,.18)', lt = 'rgba(255,255,255,.12)';
  c.lineWidth = .6;
  if (tex === 'brick' || tex === 'stone') {
    const step = tex === 'brick' ? 3.2 : 5.5;
    let row = 0;
    for (let z = z0 + step; z < z1 - .5; z += step, row++) {
      c.strokeStyle = dk;
      ln(c, ...P3(x0, y1, z), ...P3(x1, y1, z)); ln(c, ...P3(x1, y1, z), ...P3(x1, y0, z));
      const seg = tex === 'brick' ? .22 : .38;
      for (let x = x0 + (row % 2 ? seg / 2 : 0); x < x1; x += seg) ln(c, ...P3(x, y1, z), ...P3(x, y1, Math.min(z1, z + step)));
      for (let y = y1 - (row % 2 ? seg / 2 : 0); y > y0; y -= seg) ln(c, ...P3(x1, y, z), ...P3(x1, y, Math.min(z1, z + step)));
    }
  } else if (tex === 'plank') {
    c.strokeStyle = dk;
    for (let x = x0 + .18; x < x1; x += .18) ln(c, ...P3(x, y1, z0), ...P3(x, y1, z1));
    for (let y = y1 - .18; y > y0; y -= .18) ln(c, ...P3(x1, y, z0), ...P3(x1, y, z1));
  } else if (tex === 'timber') {
    c.strokeStyle = '#4a3420'; c.lineWidth = 1.3;
    ln(c, ...P3(x0, y1, z0 + 1), ...P3(x1, y1, z0 + 1)); ln(c, ...P3(x0, y1, z1 - .6), ...P3(x1, y1, z1 - .6));
    ln(c, ...P3(x1, y1, z0 + 1), ...P3(x1, y0, z0 + 1)); ln(c, ...P3(x1, y1, z1 - .6), ...P3(x1, y0, z1 - .6));
    const n = Math.max(2, Math.round((x1 - x0) / .45));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; ln(c, ...P3(x, y1, z0), ...P3(x, y1, z1)); if (i < n && i % 2 === 0) ln(c, ...P3(x, y1, z0 + 1), ...P3(x0 + (x1 - x0) * (i + 1) / n, y1, z1 - .6)); }
    const m = Math.max(2, Math.round((y1 - y0) / .45));
    for (let i = 0; i <= m; i++) { const y = y1 - (y1 - y0) * i / m; ln(c, ...P3(x1, y, z0), ...P3(x1, y, z1)); }
  } else if (tex === 'mud') {
    c.fillStyle = dk;
    for (let i = 0; i < 18; i++) { const u = hash2(i, 3, 9), v = hash2(i, 7, 9); const p = P3(x0 + (x1 - x0) * u, y1, z0 + (z1 - z0) * v); c.fillRect(p[0], p[1], 1, 1); }
  }
  c.strokeStyle = lt; c.lineWidth = .8; ln(c, ...P3(x0, y1, z1), ...P3(x1, y1, z1));
}
function quadL(c, x0, y1, xa, xb, za, zb, fill) { poly(c, [P3(xa, y1, za), P3(xb, y1, za), P3(xb, y1, zb), P3(xa, y1, zb)], fill); }
function quadR(c, x1, ya, yb, za, zb, fill) { poly(c, [P3(x1, ya, za), P3(x1, yb, za), P3(x1, yb, zb), P3(x1, ya, zb)], fill); }
function doorL(c, x0, x1, y1, z0, w, h, col) { const m = (x0 + x1) / 2; quadL(c, 0, y1, m - w / 2, m + w / 2, z0, z0 + h, col || '#3a2616'); }
function windowsL(c, x0, x1, y1, z, n, col) { for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i + .5) / n; quadL(c, 0, y1, x - .08, x + .08, z, z + 5, col || '#2a2018'); } }
function windowsR(c, x1, y0, y1, z, n, col) { for (let i = 0; i < n; i++) { const y = y0 + (y1 - y0) * (i + .5) / n; quadR(c, x1, y - .08, y + .08, z, z + 5, col || '#1e1610'); } }
function roofGable(c, x0, y0, x1, y1, z, rh, col, alongX) {
  const o = .12; x0 -= o; y0 -= o; x1 += o; y1 += o;
  if (alongX) {
    const ym = (y0 + y1) / 2;
    poly(c, [P3(x0, y0, z), P3(x1, y0, z), P3(x1, ym, z + rh), P3(x0, ym, z + rh)], shade(col, -.18));
    poly(c, [P3(x0, y1, z), P3(x1, y1, z), P3(x1, ym, z + rh), P3(x0, ym, z + rh)], shade(col, .08));
    poly(c, [P3(x1, y1, z), P3(x1, y0, z), P3(x1, ym, z + rh)], shade(col, -.35));
    roofLines(c, [P3(x0, y1, z), P3(x1, y1, z), P3(x1, ym, z + rh), P3(x0, ym, z + rh)]);
  } else {
    const xm = (x0 + x1) / 2;
    poly(c, [P3(x0, y0, z), P3(x0, y1, z), P3(xm, y1, z + rh), P3(xm, y0, z + rh)], shade(col, -.1));
    poly(c, [P3(x1, y0, z), P3(x1, y1, z), P3(xm, y1, z + rh), P3(xm, y0, z + rh)], shade(col, -.25));
    poly(c, [P3(x0, y1, z), P3(x1, y1, z), P3(xm, y1, z + rh)], shade(col, .05));
    roofLines(c, [P3(x1, y1, z), P3(x1, y0, z), P3(xm, y0, z + rh), P3(xm, y1, z + rh)]);
  }
}
function roofLines(c, q) {
  c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = .6;
  for (let t = .2; t < 1; t += .2) ln(c, lerp(q[0][0], q[3][0], t), lerp(q[0][1], q[3][1], t), lerp(q[1][0], q[2][0], t), lerp(q[1][1], q[2][1], t));
}
function roofHip(c, x0, y0, x1, y1, z, rh, col, flare) {
  const o = flare ? .22 : .12; x0 -= o; y0 -= o; x1 += o; y1 += o;
  const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  const ridge = Math.min(x1 - x0, y1 - y0) * .0;
  const A = P3(xm - ridge, ym, z + rh), Bp = P3(xm + ridge, ym, z + rh);
  const lift = flare ? 4 : 0;
  const c00 = P3(x0, y0, z + lift), c10 = P3(x1, y0, z + lift), c11 = P3(x1, y1, z + lift), c01 = P3(x0, y1, z + lift);
  poly(c, [c00, c10, Bp, A], shade(col, -.25));
  poly(c, [c00, c01, A], shade(col, -.12));
  poly(c, [c01, c11, Bp, A], shade(col, .06));
  poly(c, [c11, c10, Bp], shade(col, -.32));
  if (flare) { c.strokeStyle = shade(col, .3); c.lineWidth = 1; ln(c, c01[0], c01[1], c11[0], c11[1]); ln(c, c11[0], c11[1], c10[0], c10[1]); }
}
function roofMeru(c, x0, y0, x1, y1, z, tiers, col, gold) {
  let rx0 = x0 - .15, ry0 = y0 - .15, rx1 = x1 + .15, ry1 = y1 + .15;
  const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  let zz = z;
  for (let i = 0; i < tiers; i++) {
    const h = 9 - i * 1.2;
    roofHip(c, rx0, ry0, rx1, ry1, zz, h, col, false);
    const sh = (rx1 - rx0) * .22;
    rx0 += sh; ry0 += sh; rx1 -= sh; ry1 -= sh;
    zz += h * .62;
    if (i < tiers - 1) bBox(c, rx0 + .05, ry0 + .05, rx1 - .05, ry1 - .05, zz - 3, zz + 2, '#4a3a2a', null, { noTop: true });
    zz += 2;
  }
  const top = P3(xm, ym, zz + 2);
  if (gold) { ln(c, top[0], top[1] + 3, top[0], top[1] - 7, '#d4a640', 1.6); circ(c, top[0], top[1] - 7.5, 1.4, '#e8c060'); }
}
function dome(c, xm, ym, z, r, col) {
  const p = P3(xm, ym, z);
  const rx = r * 45, ry = r * 22;
  const g = c.createLinearGradient(p[0] - rx, 0, p[0] + rx, 0);
  g.addColorStop(0, shade(col, .25)); g.addColorStop(.6, col); g.addColorStop(1, shade(col, -.35));
  c.beginPath(); c.ellipse(p[0], p[1], rx, ry, 0, 0, Math.PI); c.arc(p[0], p[1], rx, Math.PI, 0); c.fillStyle = g; c.fill();
  ln(c, p[0], p[1] - rx, p[0], p[1] - rx - 6, '#d4a640', 1.2); circ(c, p[0], p[1] - rx - 6.5, 1.2, '#e8c060');
}
function cyl(c, xm, ym, r, z0, z1, col, tex) {
  const b = P3(xm, ym, z0), t = P3(xm, ym, z1);
  const rx = r * 45, ry = r * 22.6;
  const g = c.createLinearGradient(b[0] - rx, 0, b[0] + rx, 0);
  g.addColorStop(0, shade(col, .05)); g.addColorStop(.45, shade(col, .1)); g.addColorStop(1, shade(col, -.38));
  c.beginPath(); c.moveTo(b[0] - rx, b[1]); c.ellipse(b[0], b[1], rx, ry, 0, Math.PI, 0, true); c.lineTo(t[0] + rx, t[1]); c.ellipse(t[0], t[1], rx, ry, 0, 0, Math.PI, true); c.closePath(); c.fillStyle = g; c.fill();
  if (tex) { c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = .6; for (let z = z0 + 5; z < z1; z += 5) { const q = P3(xm, ym, z); c.beginPath(); c.ellipse(q[0], q[1], rx, ry, 0, 0, Math.PI); c.stroke(); } }
  c.beginPath(); c.ellipse(t[0], t[1], rx, ry, 0, 0, Math.PI * 2); c.fillStyle = shade(col, .15); c.fill();
}
function cone(c, xm, ym, r, z, h, col) {
  const b = P3(xm, ym, z), rx = r * 48, ry = r * 24;
  const g = c.createLinearGradient(b[0] - rx, 0, b[0] + rx, 0); g.addColorStop(0, shade(col, .15)); g.addColorStop(1, shade(col, -.4));
  c.beginPath(); c.moveTo(b[0] - rx, b[1]); c.ellipse(b[0], b[1], rx, ry, 0, Math.PI, 0, true); c.lineTo(b[0], b[1] - h); c.closePath(); c.fillStyle = g; c.fill();
}
function crenel(c, x0, y0, x1, y1, z, col) {
  const s = .2;
  for (let x = x0; x < x1 - .01; x += s * 2) bBox(c, x, y1 - .14, Math.min(x1, x + s), y1, z, z + 4, col);
  for (let y = y1 - s; y > y0 + .01; y -= s * 2) bBox(c, x1 - .14, Math.max(y0, y - s), x1, y, z, z + 4, col);
}
function stilts(c, x0, y0, x1, y1, h, col) { for (const [x, y] of [[x0, y1], [x1, y1], [x1, y0]]) ln(c, ...P3(x, y, 0), ...P3(x, y, h), col || '#4a3220', 1.6); }
function groundPatch(c, w, h, col) { poly(c, [P3(.05, .05, 0), P3(w - .05, .05, 0), P3(w - .05, h - .05, 0), P3(.05, h - .05, 0)], col || 'rgba(110,86,56,.55)'); }
function roofFor(c, st, x0, y0, x1, y1, z, rh, col, big, ageI) {
  if (st.roofT === 'gable') roofGable(c, x0, y0, x1, y1, z, rh, col, (x1 - x0) >= (y1 - y0));
  else if (st.roofT === 'meru') roofMeru(c, x0, y0, x1, y1, z, big ? 3 : (ageI >= 2 ? 2 : 1), col, ageI >= 2);
  else if (st.roofT === 'curved') { roofHip(c, x0, y0, x1, y1, z, rh, col, ageI >= 1); if (big && ageI >= 2) { const s = (x1 - x0) * .25; bBox(c, x0 + s, y0 + s, x1 - s, y1 - s, z + rh * .55, z + rh * .55 + 8, '#e6e1d4', null); roofHip(c, x0 + s, y0 + s, x1 - s, y1 - s, z + rh * .55 + 8, rh * .7, col, true); } }
  else { // flat with parapet
    bBox(c, x0 - .05, y0 - .05, x1 + .05, y1 + .05, z, z + 3, shade(st.wall[Math.max(1, ageI)], -.08), null, { top: shade(st.wall[Math.max(1, ageI)], .02) });
    if (big && ageI >= 1) dome(c, (x0 + x1) / 2, (y0 + y1) / 2, z + 3, Math.min(x1 - x0, y1 - y0) * .3, st.roof[ageI >= 2 ? 2 : 1]);
  }
}
function hut(c, st, ageI, x0, y0, x1, y1, h, rh, opts) {
  opts = opts || {};
  const wallC = st.wall[ageI];
  const tex = ageI === 0 ? 'plank' : st === ARCH.west ? (ageI === 1 ? 'timber' : 'stone') : st === ARCH.nusa ? 'brick' : st === ARCH.east ? (ageI === 1 ? 'plank' : null) : (ageI >= 2 ? 'stone' : 'mud');
  if (opts.stilts) { stilts(c, x0, y0, x1, y1, opts.stilts); c.save(); c.translate(0, -opts.stilts); }
  bBox(c, x0, y0, x1, y1, 0, h, wallC, tex, { noTop: true });
  if (st === ARCH.east && ageI >= 2) { c.strokeStyle = '#3a2a20'; c.lineWidth = 1.2; ln(c, ...P3(x0, y1, h * .45), ...P3(x1, y1, h * .45)); ln(c, ...P3(x1, y1, h * .45), ...P3(x1, y0, h * .45)); }
  if (!opts.noDoor) doorL(c, x0, x1, y1, 0, Math.min(.36, (x1 - x0) * .3), Math.min(13, h * .62), opts.doorC);
  if (opts.win !== 0) { windowsR(c, x1, y0, y1, h * .45, opts.win || Math.max(1, Math.round((y1 - y0) * 1.2))); }
  roofFor(c, st, x0, y0, x1, y1, h, rh, st.roof[ageI], opts.big, ageI);
  if (opts.stilts) c.restore();
}
function props(c, kind, x, y) {
  const p = P3(x, y, 0);
  if (kind === 'logs') { for (let i = 0; i < 3; i++) { c.fillStyle = '#7a5230'; c.fillRect(p[0] - 10, p[1] - 4 - i * 3, 20 - i * 4, 3); circ(c, p[0] + 10 - i * 4, p[1] - 2.5 - i * 3, 1.6, '#c99a5f'); } }
  else if (kind === 'ore') { circ(c, p[0], p[1] - 3, 5, '#7a746a'); circ(c, p[0] + 4, p[1] - 2, 3.5, '#8a8478'); c.fillStyle = '#e8c24a'; c.fillRect(p[0] - 2, p[1] - 5, 2, 2); c.fillRect(p[0] + 3, p[1] - 3, 1.6, 1.6); }
  else if (kind === 'cart') { poly(c, [[p[0] - 7, p[1] - 9], [p[0] + 6, p[1] - 9], [p[0] + 5, p[1] - 3], [p[0] - 6, p[1] - 3]], '#6b4526'); circ(c, p[0] - 4, p[1] - 2, 2.4, '#3a2618'); circ(c, p[0] + 3, p[1] - 2, 2.4, '#3a2618'); circ(c, p[0], p[1] - 10, 3, '#8a8478'); }
  else if (kind === 'hay') { ell(c, p[0], p[1] - 3, 6, 4, '#c9a94a'); ell(c, p[0] - 1, p[1] - 4.5, 4, 2.5, '#dcbf62'); }
  else if (kind === 'target') { ln(c, p[0], p[1], p[0], p[1] - 9, '#5a3a20', 1.2); circ(c, p[0], p[1] - 12, 4.5, '#f0e6c8'); circ(c, p[0], p[1] - 12, 3, '#b13b3b'); circ(c, p[0], p[1] - 12, 1.3, '#f0e6c8'); }
  else if (kind === 'anvil') { poly(c, [[p[0] - 4, p[1] - 4], [p[0] + 4, p[1] - 4], [p[0] + 2, p[1] - 1], [p[0] - 2, p[1] - 1]], '#3d3f43'); c.fillStyle = '#55585d'; c.fillRect(p[0] - 5, p[1] - 6, 10, 2); }
  else if (kind === 'fence') { c.strokeStyle = '#6b4a2a'; c.lineWidth = 1.1; }
  else if (kind === 'dummy') { ln(c, p[0], p[1], p[0], p[1] - 12, '#6b4a2a', 1.4); ln(c, p[0] - 4, p[1] - 9, p[0] + 4, p[1] - 9); circ(c, p[0], p[1] - 13, 2, '#b89a6a'); }
  else if (kind === 'crates') { bBox(c, x - .15, y - .15, x + .1, y + .1, 0, 6, '#8a6a3a'); bBox(c, x + .1, y - .2, x + .3, y, 0, 5, '#9a7a4a'); }
  else if (kind === 'wheel') { c.strokeStyle = '#4a3220'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(p[0], p[1] - 5, 3, 5, 0, 0, 7); c.stroke(); ln(c, p[0], p[1] - 10, p[0], p[1]); }
  else if (kind === 'barrel') { cyl(c, x, y, .1, 0, 7, '#7a5230'); }
}
function fenceLine(c, xa, ya, xb, yb) {
  const n = Math.ceil(dist(xa, ya, xb, yb) / .25);
  c.strokeStyle = '#6b4a2a'; c.lineWidth = 1;
  for (let i = 0; i <= n; i++) { const x = lerp(xa, xb, i / n), y = lerp(ya, yb, i / n); ln(c, ...P3(x, y, 0), ...P3(x, y, 6)); }
  ln(c, ...P3(xa, ya, 5), ...P3(xb, yb, 5)); ln(c, ...P3(xa, ya, 2.5), ...P3(xb, yb, 2.5));
}

// --- per-building composition ---
function drawBld(c, type, archK, ageI) {
  const st = ARCH[archK] || ARCH.west;
  const W = st.wall[ageI], R = st.roof[ageI];
  const g = ARCH.nusa === st && ageI >= 2;
  switch (type) {
    case 'farm': {
      poly(c, [P3(.1, .1, 0), P3(2.9, .1, 0), P3(2.9, 2.9, 0), P3(.1, 2.9, 0)], '#6b4a2c');
      for (let i = 0; i < 8; i++) {
        const y = .3 + i * .33;
        c.strokeStyle = '#4e3520'; c.lineWidth = 1; ln(c, ...P3(.2, y, 0), ...P3(2.8, y, 0));
        for (let k = 0; k < 9; k++) { const p = P3(.3 + k * .3, y - .05, 0); ell(c, p[0], p[1] - 2, 2.2, 3, i % 2 ? '#7cae3e' : '#8fbf48'); }
      }
      fenceLine(c, .05, 2.95, 2.95, 2.95); fenceLine(c, 2.95, .05, 2.95, 2.95);
      break;
    }
    case 'house':
      groundPatch(c, 2, 2);
      if (st === ARCH.nusa && ageI <= 1) { hut(c, st, ageI, .35, .35, 1.65, 1.65, 14, 22, { stilts: 7, win: 1 }); }
      else hut(c, st, ageI, .3, .3, 1.7, 1.7, 20, 18, {});
      if (st === ARCH.west) bBox(c, 1.2, .5, 1.4, .7, 30, 44, '#7a6a5a');
      props(c, 'barrel', 1.85, 1.2);
      break;
    case 'mill':
      groundPatch(c, 2, 2);
      if (st === ARCH.west) { cyl(c, 1, 1, .55, 0, 46, ageI >= 2 ? W : '#d8ccb0', true); cone(c, 1, 1, .62, 46, 18, R); }
      else if (st === ARCH.nusa) { hut(c, st, Math.max(1, ageI), .45, .45, 1.55, 1.55, 14, 28, { stilts: 12, noDoor: true, win: 0 }); }
      else if (st === ARCH.mideast) { cyl(c, 1, 1, .62, 0, 26, W, true); dome(c, 1, 1, 26, .55, st.roof[ageI >= 2 ? 2 : 1]); }
      else { hut(c, st, ageI, .4, .4, 1.6, 1.6, 22, 20, { win: 1 }); }
      props(c, 'hay', 1.85, .4);
      break;
    case 'lumber':
      groundPatch(c, 2, 2);
      for (const [x, y] of [[.3, .3], [1.7, .3], [.3, 1.4], [1.7, 1.4]]) ln(c, ...P3(x, y, 0), ...P3(x, y, 20), '#5a3a20', 1.6);
      roofGable(c, .2, .2, 1.8, 1.5, 20, 12, st.roof[Math.min(ageI, 1)], true);
      props(c, 'logs', 1.1, 1.75); props(c, 'logs', .6, 1.0);
      break;
    case 'mining':
      groundPatch(c, 2, 2, 'rgba(100,90,80,.55)');
      for (const [x, y] of [[.3, .3], [1.6, .3], [.3, 1.3], [1.6, 1.3]]) ln(c, ...P3(x, y, 0), ...P3(x, y, 18), '#5a3a20', 1.6);
      roofGable(c, .2, .2, 1.7, 1.4, 18, 11, st.roof[Math.min(ageI, 1)], true);
      props(c, 'cart', 1.3, 1.75); props(c, 'ore', .5, 1.6);
      break;
    case 'dock':
      bBox(c, .1, .1, 2.9, 2.9, -4, 3, '#7a5530', 'plank');
      for (const [x, y] of [[.1, 2.9], [1.5, 2.9], [2.9, 2.9], [2.9, 1.5]]) ln(c, ...P3(x, y, -8), ...P3(x, y, 3), '#4a3220', 2);
      hut(c, st, ageI, .4, .4, 1.6, 1.6, 18, 18, { win: 1 });
      ln(c, ...P3(2.4, .7, 3), ...P3(2.4, .7, 40), '#5a3a20', 1.6); ln(c, ...P3(2.4, .7, 38), ...P3(2.4, 2.2, 30), '#5a3a20', 1.2);
      props(c, 'crates', 2.2, 2.2);
      break;
    case 'market': {
      groundPatch(c, 3, 3, 'rgba(150,120,80,.45)');
      hut(c, st, ageI, .3, .3, 1.6, 1.4, 22, 16, { win: 1 });
      const aw = ['#b8312b', '#2f6fb0', '#d4a640'];
      [[1.9, .4], [1.9, 1.7], [.6, 2]].forEach(([x, y], i) => {
        for (const [px, py] of [[x, y], [x + .8, y], [x + .8, y + .7]]) ln(c, ...P3(px, py, 0), ...P3(px, py, 14), '#5a3a20', 1.1);
        poly(c, [P3(x - .05, y - .05, 14), P3(x + .85, y - .05, 14), P3(x + .85, y + .75, 11), P3(x - .05, y + .75, 11)], aw[i]);
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.2; for (let k = .15; k < .8; k += .3) ln(c, ...P3(x + k, y - .05, 14), ...P3(x + k, y + .75, 11));
        props(c, 'crates', x + .4, y + .5);
      });
      break;
    }
    case 'university':
      groundPatch(c, 3, 3, 'rgba(160,150,130,.5)');
      if (st === ARCH.nusa) { // pendopo: open pillared hall
        bBox(c, .3, .3, 2.7, 2.7, 0, 4, '#8a7a6a', 'stone');
        for (let i = 0; i <= 3; i++) { ln(c, ...P3(.5 + i * .65, 2.5, 4), ...P3(.5 + i * .65, 2.5, 26), '#6a3a20', 2); ln(c, ...P3(2.5, .5 + i * .65, 4), ...P3(2.5, .5 + i * .65, 26), '#5a2a18', 2); }
        roofMeru(c, .3, .3, 2.7, 2.7, 26, 3, R, true);
      } else {
        hut(c, st, ageI, .3, .3, 2.7, 2.2, 30, 22, { big: true, win: 3 });
        if (st === ARCH.west) { bBox(c, 2.0, 2.0, 2.7, 2.7, 0, 58, W, 'stone'); roofHip(c, 2.0, 2.0, 2.7, 2.7, 58, 22, R); }
        else if (st === ARCH.mideast) { cyl(c, 2.35, 2.4, .25, 0, 62, W, true); dome(c, 2.35, 2.4, 62, .26, st.roof[2]); }
      }
      break;
    case 'barracks':
      groundPatch(c, 3, 3);
      hut(c, st, ageI, .3, .3, 2.7, 1.7, 24, 20, { win: 3 });
      fenceLine(c, .3, 2.8, 2.8, 2.8); fenceLine(c, 2.8, 2.8, 2.8, 1.9);
      props(c, 'dummy', 1.2, 2.3); props(c, 'dummy', 2.2, 2.35);
      break;
    case 'archery':
      groundPatch(c, 3, 3);
      hut(c, st, ageI, .3, .3, 1.8, 2.6, 22, 18, { win: 2 });
      props(c, 'target', 2.5, .8); props(c, 'target', 2.5, 1.9);
      break;
    case 'stable':
      groundPatch(c, 3, 3, 'rgba(120,96,60,.55)');
      hut(c, st, ageI, .3, .3, 2.7, 1.6, 22, 20, { win: 3, doorC: '#2a1a0c' });
      fenceLine(c, .3, 2.8, 2.8, 2.8); fenceLine(c, 2.8, 1.8, 2.8, 2.8);
      props(c, 'hay', 1.0, 2.3); props(c, 'hay', 2.1, 2.2);
      break;
    case 'blacksmith':
      groundPatch(c, 3, 3, 'rgba(90,80,70,.55)');
      hut(c, st, ageI, .3, .3, 2.4, 2.2, 24, 20, { win: 2 });
      bBox(c, .5, .5, .9, .9, 0, 54, '#6d655d', 'stone');
      props(c, 'anvil', 2.6, 2.6); props(c, 'barrel', 2.75, 1.4);
      break;
    case 'siege':
      groundPatch(c, 3, 3);
      hut(c, st, ageI, .3, .3, 2.7, 2.3, 28, 22, { win: 2, doorC: '#2a1a0c' });
      props(c, 'wheel', 2.9, 2.6); props(c, 'logs', 1.6, 2.75);
      break;
    case 'monastery':
      groundPatch(c, 3, 3, 'rgba(170,160,140,.5)');
      if (st === ARCH.nusa) { // candi
        bBox(c, .3, .3, 2.7, 2.7, 0, 8, '#a14a33', 'brick');
        bBox(c, .65, .65, 2.35, 2.35, 8, 34, '#b0503a', 'brick');
        doorL(c, .65, 2.35, 2.35, 8, .35, 16, '#2a1410');
        bBox(c, .9, .9, 2.1, 2.1, 34, 48, '#a14a33', 'brick');
        bBox(c, 1.1, 1.1, 1.9, 1.9, 48, 60, '#9a4430', 'brick');
        cone(c, 1.5, 1.5, .32, 60, 30, '#8f3f2c');
        const tp = P3(1.5, 1.5, 90); circ(c, tp[0], tp[1], 2, '#d4a640');
      } else if (st === ARCH.east) {
        hut(c, st, Math.max(2, ageI), .3, .8, 2.0, 2.7, 22, 18, { win: 2, big: false });
        // pagoda
        let z = 0, s = .45;
        for (let i = 0; i < 4; i++) { bBox(c, 2.1 - s, .2 + .45 - s, 2.1 + s, .2 + .45 + s, z, z + 12, '#e6e1d4'); roofHip(c, 2.1 - s - .1, .65 - s - .1, 2.1 + s + .1, .65 + s + .1, z + 12, 7, '#3d4351', true); z += 16; s *= .82; }
      } else if (st === ARCH.mideast) {
        hut(c, st, Math.max(2, ageI), .4, .4, 2.6, 2.6, 26, 0, { big: true, win: 2 });
        cyl(c, .55, 2.5, .16, 0, 78, '#e3d8c0', true); cone(c, .55, 2.5, .18, 78, 14, '#3f7c8c');
      } else {
        hut(c, st, Math.max(2, ageI), .3, .7, 2.7, 2.2, 28, 24, { win: 3 });
        bBox(c, .3, 2.1, .95, 2.75, 0, 66, '#a8a49a', 'stone');
        roofHip(c, .3, 2.1, .95, 2.75, 66, 26, '#4f5866');
        const tp = P3(.62, 2.42, 98); ln(c, tp[0], tp[1], tp[0], tp[1] - 8, '#d4a640', 1.2); ln(c, tp[0] - 3, tp[1] - 5, tp[0] + 3, tp[1] - 5);
      }
      break;
    case 'tc':
      bBox(c, .1, .1, 3.9, 3.9, 0, 5, ageI >= 2 ? '#9a958c' : '#8a6a45', ageI >= 2 ? 'stone' : 'plank', { top: ageI >= 2 ? '#a8a398' : '#a08458' });
      c.save(); c.translate(0, -5);
      hut(c, st, ageI, .5, .5, 3.5, 3.0, 30, 28, { big: true, win: 3 });
      if (st === ARCH.west) { bBox(c, 2.6, 2.4, 3.5, 3.4, 0, 66, W, ageI >= 2 ? 'stone' : 'timber'); roofHip(c, 2.6, 2.4, 3.5, 3.4, 66, 26, R); }
      else if (st === ARCH.nusa) { bBox(c, 2.5, 2.5, 3.4, 3.4, 0, 30, W, 'brick'); roofMeru(c, 2.5, 2.5, 3.4, 3.4, 30, 3, R, ageI >= 2); }
      else if (st === ARCH.east) { bBox(c, 2.5, 2.4, 3.5, 3.4, 0, 46, W, null); roofHip(c, 2.4, 2.3, 3.6, 3.5, 46, 12, R, true); bBox(c, 2.7, 2.6, 3.3, 3.2, 54, 70, W); roofHip(c, 2.6, 2.5, 3.4, 3.3, 70, 12, R, true); }
      else { cyl(c, 3.0, 3.0, .38, 0, 64, W, true); dome(c, 3.0, 3.0, 64, .38, st.roof[Math.max(1, ageI)]); }
      c.restore();
      break;
    case 'castle': {
      const wallC = st === ARCH.nusa ? '#a94d33' : st === ARCH.mideast ? '#cdb994' : st === ARCH.east ? '#8e8a82' : '#97938a';
      const tex = st === ARCH.nusa ? 'brick' : 'stone';
      bBox(c, .3, .3, 3.7, 3.7, 0, 34, wallC, tex, { top: shade(wallC, -.2) });
      crenel(c, .3, .3, 3.7, 3.7, 34, wallC);
      doorL(c, .3, 3.7, 3.7, 0, .6, 22, '#2a1a10');
      if (st === ARCH.east) {
        bBox(c, 1.0, 1.0, 3.0, 3.0, 34, 50, '#ebe6da'); roofHip(c, .9, .9, 3.1, 3.1, 50, 10, '#323a4a', true);
        bBox(c, 1.3, 1.3, 2.7, 2.7, 56, 70, '#ebe6da'); roofHip(c, 1.2, 1.2, 2.8, 2.8, 70, 10, '#323a4a', true);
        bBox(c, 1.6, 1.6, 2.4, 2.4, 76, 88, '#ebe6da'); roofHip(c, 1.5, 1.5, 2.5, 2.5, 88, 14, '#323a4a', true);
      } else {
        for (const [x, y] of [[.5, .5], [3.5, .5], [.5, 3.5], [3.5, 3.5]]) {
          if (st === ARCH.nusa) { bBox(c, x - .42, y - .42, x + .42, y + .42, 0, 48, wallC, 'brick'); roofMeru(c, x - .42, y - .42, x + .42, y + .42, 48, 2, '#2f2722', true); }
          else { cyl(c, x, y, .45, 0, 50, wallC, true); if (st === ARCH.west) cone(c, x, y, .5, 50, 26, '#4f5866'); else if (st === ARCH.mideast) dome(c, x, y, 50, .36, '#3f7c8c'); }
        }
        bBox(c, 1.3, 1.3, 2.7, 2.7, 34, 70, shade(wallC, .05), tex);
        if (st === ARCH.nusa) roofMeru(c, 1.3, 1.3, 2.7, 2.7, 70, 3, '#2a231e', true);
        else crenel(c, 1.3, 1.3, 2.7, 2.7, 70, wallC);
      }
      break;
    }
    case 'tower':
      if (st === ARCH.east || st === ARCH.nusa) {
        bBox(c, .1, .1, .9, .9, 0, 60, ageI >= 2 ? W : '#8a6a45', st === ARCH.nusa ? 'brick' : 'plank');
        if (st === ARCH.nusa) roofMeru(c, .05, .05, .95, .95, 60, 2, R, ageI >= 2); else roofHip(c, .0, .0, 1.0, 1.0, 60, 16, R, true);
      } else {
        const wc = ageI >= 2 ? (st === ARCH.mideast ? '#cdb994' : '#97938a') : '#8a6a45';
        cyl(c, .5, .5, .42, 0, 62, wc, true);
        if (st === ARCH.west) cone(c, .5, .5, .5, 62, 26, R); else { cyl(c, .5, .5, .48, 62, 68, wc); dome(c, .5, .5, 68, .3, st.roof[2]); }
      }
      break;
    case 'palisade':
      c.strokeStyle = '#7a5230'; c.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const x = .15 + i * .23, y = .85 - i * .23; const b = P3(x, y, 0), t = P3(x, y, 24); ln(c, b[0], b[1], t[0], t[1]); poly(c, [[t[0] - 1.6, t[1]], [t[0] + 1.6, t[1]], [t[0], t[1] - 4]], '#8a6a45'); }
      break;
    case 'wall': {
      const wc = st === ARCH.nusa ? '#a94d33' : st === ARCH.mideast ? '#cdb994' : '#97938a';
      bBox(c, .08, .08, .92, .92, 0, 26, wc, st === ARCH.nusa ? 'brick' : 'stone');
      crenel(c, .08, .08, .92, .92, 26, wc);
      break;
    }
    case 'gate': {
      const wc = st === ARCH.nusa ? '#a94d33' : st === ARCH.mideast ? '#cdb994' : '#97938a';
      bBox(c, .05, .05, .95, .95, 0, 34, wc, st === ARCH.nusa ? 'brick' : 'stone');
      quadL(c, 0, .95, .28, .72, 0, 20, '#3a2414'); quadR(c, .95, .28, .72, 0, 20, '#2a180c');
      if (st === ARCH.nusa) roofMeru(c, .05, .05, .95, .95, 34, 2, '#2a231e', true); else crenel(c, .05, .05, .95, .95, 34, wc);
      break;
    }
    case 'wonder':
      if (st === ARCH.nusa) { // stepped temple-mountain with stupas
        for (let i = 0; i < 5; i++) { const s = .2 + i * .42; bBox(c, s, s, 5 - s, 5 - s, i * 14, i * 14 + 14, i % 2 ? '#8f8a80' : '#9c978c', 'stone'); }
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const x = 2.5 + Math.cos(a) * 1.05, y = 2.5 + Math.sin(a) * 1.05; dome(c, x, y, 70, .16, '#8f8a80'); }
        dome(c, 2.5, 2.5, 70, .55, '#9c978c');
      } else if (st === ARCH.east) {
        bBox(c, .3, .3, 4.7, 4.7, 0, 8, '#8a8378', 'stone');
        let z = 8, s = 1.7;
        for (let i = 0; i < 6; i++) { bBox(c, 2.5 - s, 2.5 - s, 2.5 + s, 2.5 + s, z, z + 16, i % 2 ? '#b8312b' : '#e6e1d4'); roofHip(c, 2.5 - s - .25, 2.5 - s - .25, 2.5 + s + .25, 2.5 + s + .25, z + 16, 10, '#323a4a', true); z += 22; s *= .8; }
      } else if (st === ARCH.mideast) {
        bBox(c, .4, .4, 4.6, 4.6, 0, 40, '#ddd2b8', 'stone', { top: '#cfc3a8' });
        dome(c, 2.5, 2.5, 40, 1.35, '#3f7c8c');
        for (const [x, y] of [[.5, .5], [4.5, .5], [.5, 4.5], [4.5, 4.5]]) { cyl(c, x, y, .18, 0, 110, '#ece4cf', true); cone(c, x, y, .2, 110, 18, '#3f7c8c'); }
      } else {
        bBox(c, .4, .9, 4.6, 4.1, 0, 60, '#a8a49a', 'stone');
        roofGable(c, .4, .9, 4.6, 4.1, 60, 40, '#4f5866', true);
        for (const y of [1.0, 3.2]) { bBox(c, 3.6, y, 4.6, y + .9, 0, 110, '#aaa69c', 'stone'); cone(c, 4.1, y + .45, .55, 110, 45, '#4f5866'); }
        c.fillStyle = '#3a5a9a'; c.beginPath(); const rp = P3(4.6, 2.5, 60); c.ellipse(rp[0] - 3, rp[1] - 12, 8, 12, 0, 0, Math.PI * 2); c.fill();
      }
      break;
  }
}
function bldSprite(type, archK, ageI) {
  const key = 'B|' + type + '|' + archK + '|' + ageI;
  let s = Art.cache.get(key);
  if (s) return s;
  const d = B[type];
  const H = BH[type] || 60;
  const w = (d.w + d.h) * 32 + 30, h = (d.w + d.h) * 16 + H + 30;
  s = makeSprite(w, h, d.h * 32 + 15, H + 15, Art.BS, c => drawBld(c, type, archK, ageI));
  Art.cache.set(key, s);
  return s;
}
function foundationSprite(type) {
  const key = 'F|' + type;
  let s = Art.cache.get(key);
  if (s) return s;
  const d = B[type];
  const w = (d.w + d.h) * 32 + 30, h = (d.w + d.h) * 16 + 40;
  s = makeSprite(w, h, d.h * 32 + 15, 25, Art.BS, c => {
    groundPatch(c, d.w, d.h, 'rgba(120,96,64,.6)');
    c.strokeStyle = '#d8c8a0'; c.lineWidth = 1; c.setLineDash([3, 3]);
    poly(c, [P3(0, 0, 0), P3(d.w, 0, 0), P3(d.w, d.h, 0), P3(0, d.h, 0)], null, '#e8dcb8', 1);
    c.setLineDash([]);
    for (const [x, y] of [[0, 0], [d.w, 0], [d.w, d.h], [0, d.h]]) ln(c, ...P3(x, y, 0), ...P3(x, y, 8), '#7a5230', 1.6);
    for (let i = 0; i < d.w * 2; i++) { const x = .3 + hash2(i, d.w, 3) * (d.w - .6), y = .3 + hash2(i, d.h, 4) * (d.h - .6); c.fillStyle = '#9a7a4a'; const p = P3(x, y, 0); c.fillRect(p[0] - 5, p[1] - 1.5, 10, 2.4); }
  });
  Art.cache.set(key, s);
  return s;
}

// ------------------------------------------------------------
// Resources
// ------------------------------------------------------------
function treeSprite(v, kind) {
  const key = 'T|' + kind + '|' + v;
  let s = Art.cache.get(key);
  if (s) return s;
  const r = new Rng(v * 31 + 7);
  s = makeSprite(64, 84, 32, 76, Art.US * .75, c => {
    const trunk = '#5a3c22';
    if (kind === 'pine') {
      ln(c, 0, 0, 0, -16, trunk, 3);
      const g = ['#1f4a2a', '#2a5a32', '#356a3a'];
      for (let i = 0; i < 4; i++) { const y = -12 - i * 12, w = 17 - i * 3.5; poly(c, [[-w, y], [w, y], [0, y - 18]], g[i % 3]); poly(c, [[0, y], [w, y], [0, y - 18]], shade(g[i % 3], -.25)); }
    } else if (kind === 'palm') {
      c.strokeStyle = '#7a5a36'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(6, -24, 2, -48); c.stroke();
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .5; c.strokeStyle = i % 2 ? '#2f6a2a' : '#3e7d32'; c.lineWidth = 3; c.beginPath(); c.moveTo(2, -48); c.quadraticCurveTo(2 + Math.cos(a) * 14, -48 + Math.sin(a) * 10 - 4, 2 + Math.cos(a) * 22, -48 + Math.sin(a) * 6 + 10); c.stroke(); }
      circ(c, 2, -46, 3, '#6a4a24');
    } else {
      ln(c, 0, 0, 0, -20, trunk, 3.4); ln(c, 0, -14, -6, -24, trunk, 2); ln(c, 0, -16, 6, -26, trunk, 2);
      const base = kind === 'dry' ? ['#6f7a2a', '#7f8a32', '#8e9a3c'] : ['#2f5a24', '#3b6a2c', '#4a7a34'];
      for (let i = 0; i < 9; i++) { const x = r.range(-12, 12), y = r.range(-44, -22), rr = r.range(7, 11); circ(c, x, y, rr, base[i % 3]); }
      for (let i = 0; i < 6; i++) { const x = r.range(-8, 12), y = r.range(-42, -26); circ(c, x, y, r.range(3, 6), shade(base[2], .18)); }
      for (let i = 0; i < 4; i++) { const x = r.range(-12, 10), y = r.range(-30, -22); circ(c, x, y, r.range(4, 7), shade(base[0], -.25)); }
    }
  });
  Art.cache.set(key, s);
  return s;
}
function resSprite(type, v) {
  const key = 'R|' + type + '|' + (v % 4);
  let s = Art.cache.get(key);
  if (s) return s;
  const r = new Rng(v * 13 + 1);
  s = makeSprite(64, 48, 32, 28, Art.US * .75, c => {
    if (type === 'gold' || type === 'stone') {
      const base = type === 'gold' ? ['#7d7466', '#8c8476', '#6c6458'] : ['#8e8e8a', '#a2a29c', '#76766f'];
      for (let i = 0; i < 6; i++) { const x = r.range(-13, 13), y = r.range(-8, 4), rr = r.range(5, 9); poly(c, [[x - rr, y + 2], [x - rr * .6, y - rr * .7], [x + rr * .3, y - rr], [x + rr, y - rr * .2], [x + rr * .8, y + 2]], base[i % 3]); poly(c, [[x + rr * .3, y - rr], [x + rr, y - rr * .2], [x + rr * .8, y + 2], [x + rr * .1, y + 2]], shade(base[i % 3], -.25)); }
      if (type === 'gold') for (let i = 0; i < 9; i++) { const x = r.range(-13, 13), y = r.range(-12, 2); c.fillStyle = i % 2 ? '#f2cf55' : '#d9a92e'; c.fillRect(x, y, 2.4, 2); }
    } else if (type === 'berry') {
      for (let i = 0; i < 5; i++) circ(c, r.range(-10, 10), r.range(-12, -3), r.range(5, 8), i % 2 ? '#2e5a2a' : '#3a6a30');
      for (let i = 0; i < 16; i++) circ(c, r.range(-12, 12), r.range(-15, -2), 1.3, i % 3 ? '#b8233b' : '#6a2a7a');
    } else if (type === 'relic') {
      poly(c, [[-6, -2], [6, -2], [6, -10], [-6, -10]], '#c9a43a'); poly(c, [[-6, -10], [6, -10], [3, -14], [-3, -14]], '#e6c24e');
      poly(c, [[2, -2], [6, -2], [6, -10], [2, -10]], '#a8862a'); c.fillStyle = '#7a2a8a'; c.fillRect(-2, -8, 2.4, 3);
    }
  });
  Art.cache.set(key, s);
  return s;
}

// ------------------------------------------------------------
// Icons for the command card (cached data URLs)
// ------------------------------------------------------------
const ICON_BG = { eco: ['#5c4a24', '#8a7136'], mil: ['#5a2420', '#8a3a30'], tech: ['#203a5a', '#2f5a86'], age: ['#3e2a5a', '#6a4a96'], cmd: ['#2a3330', '#46544e'] };
function iconURL(kind, id, col) {
  const key = 'I|' + kind + '|' + id + '|' + col;
  const hit = Art.cache.get(key);
  if (hit) return hit;
  const S = 64, cv = mkCanvas(S, S), c = cv.getContext('2d');
  const bgk = kind === 'unit' ? 'mil' : kind === 'bld' ? (B[id] && B[id].cat === 'mil' ? 'mil' : 'eco') : kind === 'tech' ? (T[id] && T[id].ageUp ? 'age' : 'tech') : 'cmd';
  const bg = ICON_BG[bgk];
  const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, bg[1]); g.addColorStop(1, bg[0]);
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.strokeRect(1, 1, S - 2, S - 2);
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (kind === 'unit') {
    const sp = unitSprite(id, col, 'idle', 0, 0, '', '', 1);
    const sc = U[id].dom === 'w' ? .9 : U[id].cls.includes('siege') ? 1.05 : (UNIT_ART[U[id].art] || {}).mount ? 1.3 : 1.7;
    c.drawImage(sp.c, S / 2 - sp.ax * sc, S * .9 - sp.ay * sc, sp.w * sc, sp.h * sc);
  } else if (kind === 'bld') {
    const sp = bldSprite(id, col, 2);
    const sc = Math.min(S / sp.w, S / sp.h) * 1.05;
    c.drawImage(sp.c, (S - sp.w * sc) / 2, (S - sp.h * sc) / 2 + 2, sp.w * sc, sp.h * sc);
  } else glyph(c, id, S);
  const url = cv.toDataURL();
  Art.cache.set(key, url);
  return url;
}
function glyph(c, id, S) {
  c.save(); c.translate(S / 2, S / 2); c.scale(S / 64, S / 64);
  const L = '#f1e6c8', D = '#2a1f14', M = '#c9cdd3', Gd = '#e0b44c';
  const s = (col, w) => { c.strokeStyle = col; c.lineWidth = w; };
  const f = col => { c.fillStyle = col; };
  const sword = (rot, col) => { c.save(); c.rotate(rot); poly(c, [[-2.5, 12], [2.5, 12], [2.5, -18], [0, -22], [-2.5, -18]], col || M); poly(c, [[-9, 12], [9, 12], [9, 15.5], [-9, 15.5]], Gd); poly(c, [[-2, 15], [2, 15], [2, 22], [-2, 22]], '#6a4426'); c.restore(); };
  const shieldG = (col) => { poly(c, [[-14, -16], [14, -16], [13, 2], [0, 18], [-13, 2]], col || '#5a7ab0', D, 2); };
  const arrowG = (n) => { for (let i = 0; i < n; i++) { c.save(); c.translate((i - (n - 1) / 2) * 8, 0); c.rotate(-.5); s(L, 2.5); ln(c, 0, 16, 0, -14); poly(c, [[0, -20], [-4, -12], [4, -12]], M); poly(c, [[0, 12], [-4, 18], [0, 16], [4, 18]], '#c33'); c.restore(); } };
  const roman = n => { f(L); c.font = 'bold 13px serif'; c.textAlign = 'center'; c.fillText(['', 'I', 'II', 'III'][n] || '', 18, 26); };
  const base = id.replace(/\d$/, '');
  const lvl = +(id.match(/\d$/) || [1])[0];
  switch (base) {
    case 'age': { f(Gd); poly(c, [[-16, 10], [16, 10], [13, -4], [6, 4], [0, -12], [-6, 4], [-13, -4]], Gd, D, 2); c.font = 'bold 15px serif'; f(L); c.textAlign = 'center'; c.fillText(['', 'II', 'III', 'IV'][lvl], 0, 26); break; }
    case 'loom': circ(c, 0, 0, 16, '#b58a5a', D, 2); s(D, 1.5); for (let i = -12; i <= 12; i += 6) ln(c, i, -12, i, 12); for (let i = -12; i <= 12; i += 6) ln(c, -12, i, 12, i); break;
    case 'wheel': circ(c, 0, 0, 16, null, '#c9a46a', 4); s('#c9a46a', 2.5); for (let a = 0; a < 6.28; a += 1.05) ln(c, 0, 0, Math.cos(a) * 15, Math.sin(a) * 15); circ(c, 0, 0, 4, '#8a6a3a'); break;
    case 'cart': poly(c, [[-18, -8], [18, -8], [14, 6], [-14, 6]], '#a07a44', D, 2); circ(c, -9, 10, 6, '#5a3a20', D, 1.5); circ(c, 9, 10, 6, '#5a3a20', D, 1.5); break;
    case 'eye': ell(c, 0, 0, 18, 10, L); circ(c, 0, 0, 7, '#3a6aa0'); circ(c, 0, 0, 3, D); if (id === 'eye2') roman(2); break;
    case 'plow': s('#c9a46a', 4); ln(c, -16, -14, 8, 6); poly(c, [[4, 2], [18, 8], [8, 16]], M, D, 1.5); roman(id === 'plow2' ? 2 : 1); break;
    case 'sickle': s(M, 4); c.beginPath(); c.arc(4, -2, 14, -2.6, .8); c.stroke(); s('#8a5a30', 4); ln(c, -4, 14, -12, 20); break;
    case 'axe': s('#8a5a30', 4); ln(c, -12, 18, 8, -14); poly(c, [[2, -16], [16, -20], [14, -4], [4, -8]], M, D, 1.5); break;
    case 'saw': poly(c, [[-18, -6], [16, -10], [16, 2], [-18, 6]], M, D, 1.5); s(D, 1); for (let x = -16; x < 16; x += 4) ln(c, x, 5, x + 2, 9); poly(c, [[16, -12], [22, -12], [22, 4], [16, 4]], '#8a5a30'); roman(id === 'saw2' ? 2 : 1); break;
    case 'pick': case 'pickS': s('#8a5a30', 4); ln(c, -10, 18, 6, -8); s(M, 4.5); c.beginPath(); c.arc(4, -2, 15, -2.5, -.6); c.stroke(); if (base === 'pickS') circ(c, -12, -12, 6, '#9a9a96'); else circ(c, -12, -12, 6, '#e7c24a'); break;
    case 'shaft': case 'shaftS': poly(c, [[-14, 18], [-8, -14], [8, -14], [14, 18]], '#5a4a3a', D, 2); poly(c, [[-6, 18], [-3, -6], [3, -6], [6, 18]], '#1a1410'); circ(c, 12, -16, 5, base === 'shaftS' ? '#9a9a96' : '#e7c24a'); break;
    case 'net': s(L, 1.5); for (let i = -14; i <= 14; i += 7) { ln(c, i, -14, i + 4, 14); ln(c, -14, i, 14, i + 4); } ell(c, 4, 4, 8, 4, '#4a8ab0'); break;
    case 'coin': circ(c, -4, 2, 13, Gd, D, 2); circ(c, 6, -4, 13, '#f0c95a', D, 2); f(D); c.font = 'bold 14px serif'; c.textAlign = 'center'; c.fillText('$', 6, 1); break;
    case 'scales': s(Gd, 3); ln(c, 0, -16, 0, 16); ln(c, -16, -10, 16, -10); ln(c, -10, 18, 10, 18); c.beginPath(); c.arc(-14, 0, 6, 0, Math.PI); c.stroke(); c.beginPath(); c.arc(14, 0, 6, 0, Math.PI); c.stroke(); break;
    case 'brick': for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) poly(c, [[-18 + k * 12 + (r % 2) * 6, -14 + r * 8], [-8 + k * 12 + (r % 2) * 6, -14 + r * 8], [-8 + k * 12 + (r % 2) * 6, -8 + r * 8], [-18 + k * 12 + (r % 2) * 6, -8 + r * 8]], '#b0503a', D, 1); if (id === 'brick2') roman(2); break;
    case 'target': circ(c, 0, 0, 17, L); circ(c, 0, 0, 12, '#b13b3b'); circ(c, 0, 0, 7, L); circ(c, 0, 0, 3, '#b13b3b'); s('#8a5a30', 2.5); ln(c, 14, -14, 2, -2); break;
    case 'holes': poly(c, [[-16, 18], [-16, -10], [-10, -18], [10, -18], [16, -10], [16, 18]], '#97938a', D, 2); f(D); c.fillRect(-10, -6, 5, 10); c.fillRect(5, -6, 5, 10); c.fillRect(-3, 4, 6, 14); break;
    case 'crane': s('#8a5a30', 3.5); ln(c, -12, 18, -12, -16); ln(c, -14, -14, 16, -14); ln(c, 12, -14, 12, 4); poly(c, [[6, 4], [18, 4], [18, 12], [6, 12]], '#97938a', D, 1.5); break;
    case 'flask': poly(c, [[-5, -18], [5, -18], [5, -6], [16, 16], [-16, 16], [-5, -6]], '#7ab0d0', D, 2); poly(c, [[-11, 6], [11, 6], [16, 16], [-16, 16]], '#4ac07a'); break;
    case 'up': poly(c, [[0, -18], [16, 2], [6, 2], [6, 18], [-6, 18], [-6, 2], [-16, 2]], Gd, D, 2); break;
    case 'boot': poly(c, [[-8, -18], [4, -18], [4, 6], [16, 8], [16, 16], [-8, 16]], '#8a5a30', D, 2); break;
    case 'ring': circ(c, 0, 0, 13, null, Gd, 5); circ(c, 0, -13, 4, '#b13b3b'); break;
    case 'horse': case 'horse2': c.save(); c.translate(-2, 10); c.scale(1.6, 1.6); drawHorse(c, base === 'horse2' ? 'grey' : 'brown', { walk: 0 }, null, PCOLORS[0]); c.restore(); if (base === 'horse2') roman(2); break;
    case 'sword': case 'sword2': case 'sword3': sword(.5); roman(lvl); break;
    case 'mail': case 'mail2': case 'mail3': shieldG(M); s(D, 1); for (let y = -12; y < 12; y += 4) ln(c, -12, y, 12, y); roman(lvl); break;
    case 'bard': case 'bard2': case 'bard3': shieldG('#8a5a30'); c.save(); c.scale(.8, .8); c.translate(0, 4); drawHorse(c, 'dark', { walk: 0 }, null, PCOLORS[0]); c.restore(); roman(lvl); break;
    case 'arrow': case 'arrow2': case 'arrow3': arrowG(lvl); break;
    case 'pad': case 'pad2': case 'pad3': poly(c, [[-14, -16], [14, -16], [16, 16], [-16, 16]], '#8a6a3a', D, 2); s(D, 1); for (let y = -10; y < 16; y += 6) ln(c, -14, y, 14, y); roman(lvl); break;
    case 'sandal': poly(c, [[-6, -18], [6, -18], [8, 18], [-8, 18]], '#a07a44', D, 2); s(D, 2); ln(c, -6, -6, 6, -2); ln(c, -6, 4, 6, 8); break;
    case 'halo': circ(c, 0, 6, 10, '#e0b48c', D, 1.5); c.strokeStyle = Gd; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -10, 12, 4, 0, 0, 7); c.stroke(); break;
    case 'lamp': poly(c, [[-14, 6], [14, 6], [8, 14], [-8, 14]], Gd, D, 2); poly(c, [[0, -18], [5, -6], [0, 2], [-5, -6]], '#ffb23a'); break;
    case 'book': poly(c, [[-18, -12], [0, -8], [18, -12], [18, 14], [0, 18], [-18, 14]], '#7a2a2a', D, 2); s(L, 2); ln(c, 0, -8, 0, 18); break;
    case 'crown': poly(c, [[-16, 12], [16, 12], [16, -6], [8, 2], [0, -14], [-8, 2], [-16, -6]], Gd, D, 2); circ(c, 0, 2, 3, '#b13b3b'); break;
    case 'castle': poly(c, [[-16, 16], [-16, -6], [-10, -6], [-10, -12], [-4, -12], [-4, -6], [4, -6], [4, -12], [10, -12], [10, -6], [16, -6], [16, 16]], '#97938a', D, 2); f(D); c.fillRect(-4, 4, 8, 12); break;
    case 'drum': ell(c, 0, -6, 15, 6, '#c9a46a'); poly(c, [[-15, -6], [15, -6], [15, 10], [-15, 10]], '#b13b3b', D, 1.5); ell(c, 0, -6, 15, 6, '#e8d8b0'); s('#8a5a30', 2.5); ln(c, 8, -24, 2, -10); break;
    case 'tower': case 'tower2': poly(c, [[-10, 18], [-10, -10], [-14, -10], [-14, -18], [14, -18], [14, -10], [10, -10], [10, 18]], '#97938a', D, 2); roman(base === 'tower2' ? 2 : 1); break;
    // commands
    case 'stop': poly(c, [[-8, -18], [8, -18], [18, -8], [18, 8], [8, 18], [-8, 18], [-18, 8], [-18, -8]], '#b13b3b', L, 2); break;
    case 'del': s('#e05a4a', 5); ln(c, -14, -14, 14, 14); ln(c, 14, -14, -14, 14); break;
    case 'garrison': poly(c, [[-16, 18], [-16, -4], [0, -18], [16, -4], [16, 18]], '#8a6a3a', D, 2); poly(c, [[0, 4], [8, -4], [8, 12]], Gd); s(Gd, 3); ln(c, -14, 4, 4, 4); break;
    case 'ungarrison': poly(c, [[-16, 18], [-16, -4], [0, -18], [16, -4], [16, 18]], '#8a6a3a', D, 2); poly(c, [[16, 4], [8, -4], [8, 12]], Gd); s(Gd, 3); ln(c, -2, 4, 14, 4); break;
    case 'bell': poly(c, [[-14, 10], [-10, -8], [0, -16], [10, -8], [14, 10]], Gd, D, 2); circ(c, 0, 14, 4, Gd); break;
    case 'agg': sword(.6); sword(-.6); break;
    case 'def': shieldG('#4a6a9a'); sword(0, '#ddd'); break;
    case 'stand': s(L, 4); ln(c, -14, 16, 14, 16); poly(c, [[-4, 14], [4, 14], [4, -12], [-4, -12]], M); circ(c, 0, -16, 5, '#e0b48c'); break;
    case 'none': circ(c, 0, 0, 16, null, '#e05a4a', 4); ln(c, -11, 11, 11, -11); break;
    case 'amove': sword(.7); poly(c, [[-18, 14], [-6, 4], [-6, 10], [6, 10], [6, 18], [-6, 18]], Gd); break;
    case 'patrol': s(Gd, 3); c.beginPath(); c.arc(0, 0, 13, -2.6, 2.2); c.stroke(); poly(c, [[-6, 15], [-14, 8], [-12, 18]], Gd); break;
    case 'ground': circ(c, 0, 0, 16, null, '#e05a4a', 3); circ(c, 0, 0, 6, '#e05a4a'); break;
    case 'drop': poly(c, [[-8, -18], [8, -18], [8, 2], [16, 2], [0, 18], [-16, 2], [-8, 2]], Gd, D, 2); break;
    case 'repair': s('#8a5a30', 4); ln(c, -14, 16, 6, -4); poly(c, [[2, -8], [14, -16], [18, -10], [6, -2]], M, D, 1.5); break;
    case 'ecoB': poly(c, [[-16, 16], [-16, -2], [0, -16], [16, -2], [16, 16]], '#c9a46a', D, 2); f(D); c.fillRect(-4, 4, 8, 12); break;
    case 'milB': poly(c, [[-16, 16], [-16, -6], [-10, -6], [-10, -12], [-4, -12], [-4, -6], [4, -6], [4, -12], [10, -12], [10, -6], [16, -6], [16, 16]], '#b05040', D, 2); sword(.6, '#ddd'); break;
    case 'back': poly(c, [[-16, 0], [0, -14], [0, -6], [16, -6], [16, 6], [0, 6], [0, 14]], L, D, 1.5); break;
    case 'buy': case 'sell': { const col = { food: '#d06a4a', wood: '#8a5a30', stone: '#9a9a96' }[id.split('_')[1]] || L; circ(c, -6, 4, 12, col, D, 2); circ(c, 10, -8, 8, Gd, D, 1.5); poly(c, base === 'buy' ? [[-6, -22], [2, -14], [-14, -14]] : [[-6, 26], [2, 18], [-14, 18]], L); break; }
    case 'rally': s('#8a5a30', 2.5); ln(c, -8, 18, -8, -18); poly(c, [[-8, -18], [14, -10], [-8, -2]], '#e0b44c'); break;
    case 'tribute': circ(c, 0, 0, 14, Gd, D, 2); s(L, 3); ln(c, -18, 0, 18, 0); poly(c, [[18, 0], [10, -6], [10, 6]], L); break;
    case 'flag': s('#8a5a30', 2.5); ln(c, -8, 18, -8, -18); poly(c, [[-8, -18], [14, -10], [-8, -2]], '#4a8ab0'); break;
    default: circ(c, 0, 0, 14, '#888');
  }
  c.restore();
}
