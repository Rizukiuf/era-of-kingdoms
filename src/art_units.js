'use strict';
// ============================================================
//  Procedural art — colours, terrain texture, units
// ============================================================
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function shade(h, f) { const [r, g, b] = hexRgb(h); return f >= 0 ? rgbHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgbHex(r * (1 + f), g * (1 + f), b * (1 + f)); }
function mix(a, b, t) { const A = hexRgb(a), Bc = hexRgb(b); return rgbHex(A[0] + (Bc[0] - A[0]) * t, A[1] + (Bc[1] - A[1]) * t, A[2] + (Bc[2] - A[2]) * t); }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }

const Art = { cache: new Map(), US: 2, BS: 1.5 };
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function makeSprite(w, h, ax, ay, s, fn) {
  const c = mkCanvas(w * s, h * s), ctx = c.getContext('2d');
  ctx.scale(s, s); ctx.translate(ax, ay);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  fn(ctx);
  return { c, ax, ay, w, h, s };
}
function poly(c, pts, fill, stroke, lw) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
}
function ln(c, x0, y0, x1, y1, col, w) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); if (col) c.strokeStyle = col; if (w) c.lineWidth = w; c.stroke(); }
function circ(c, x, y, r, fill, stroke, lw) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); } }
function ell(c, x, y, rx, ry, fill, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }

// ------------------------------------------------------------
// Terrain texture (map space, drawn through an affine iso transform)
// ------------------------------------------------------------
const TER_COL = {
  0: [96, 136, 56], 1: [74, 117, 45], 2: [137, 112, 72], 3: [210, 189, 136], 4: [86, 150, 160], 5: [36, 84, 124], 6: [158, 150, 84], 7: [66, 86, 40],
};
const TER_AMP = { 0: 18, 1: 16, 2: 18, 3: 10, 4: 6, 5: 5, 6: 18, 7: 18 };
function detailNoise(P) {
  // tileable value noise, P x P
  const out = new Float32Array(P * P);
  const oct = [[8, .5], [16, .3], [32, .2], [64, .12]];
  for (const [cells, amp] of oct) {
    const cs = P / cells;
    const lat = new Float32Array(cells * cells);
    for (let i = 0; i < lat.length; i++) lat[i] = Math.random();
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
      const gx = x / cs, gy = y / cs, xi = Math.floor(gx), yi = Math.floor(gy), fx = gx - xi, fy = gy - yi;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const a = lat[(yi % cells) * cells + xi % cells], b = lat[(yi % cells) * cells + (xi + 1) % cells];
      const c = lat[((yi + 1) % cells) * cells + xi % cells], d = lat[((yi + 1) % cells) * cells + (xi + 1) % cells];
      out[y * P + x] += (lerp(lerp(a, b, u), lerp(c, d, u), v) - .5) * amp;
    }
  }
  return out;
}
function buildTerrain(G) {
  const N = G.N;
  const T = clamp(Math.floor(3072 / N), 12, 32);
  const W = N * T;
  const cv = mkCanvas(W, W), ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, W), d = img.data;
  const ter = G.terrain;
  // water depth: distance to land
  const depth = new Float32Array(N * N).fill(9);
  const q = [];
  for (let i = 0; i < N * N; i++) if (ter[i] !== TER.DEEP && ter[i] !== TER.SHALLOW) { depth[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % N, y = (i / N) | 0;
    for (const [dx, dy] of DIRS4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const j = ny * N + nx; if (depth[j] > depth[i] + 1) { depth[j] = depth[i] + 1; q.push(j); } }
  }
  const P = 256, dn = Art.detail || (Art.detail = detailNoise(P));
  const tc = new Float32Array(N * N * 3), amp = new Float32Array(N * N), wat = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    let c = TER_COL[ter[i]];
    if (ter[i] === TER.DEEP) { const k = clamp((depth[i] - 1) / 4, 0, 1); c = [lerp(44, 22, k), lerp(96, 58, k), lerp(130, 100, k)]; }
    const v = (hash2(i % N, (i / N) | 0, G.seed) - .5) * 10 + (fbm((i % N) / 9, ((i / N) | 0) / 9, G.seed + 333, 3) - .5) * 26;
    tc[i * 3] = c[0] + v; tc[i * 3 + 1] = c[1] + v; tc[i * 3 + 2] = c[2] + v * .5;
    amp[i] = TER_AMP[ter[i]];
    wat[i] = ter[i] === TER.DEEP || ter[i] === TER.SHALLOW ? 1 : 0;
  }
  for (let v = 0; v < W; v++) {
    const my = v / T - .5;
    let j0 = Math.floor(my), fy = my - j0;
    for (let u = 0; u < W; u++) {
      const mx = u / T - .5;
      let i0 = Math.floor(mx), fx = mx - i0;
      const n = dn[(v & (P - 1)) * P + (u & (P - 1))];
      // noisy, slightly sharpened blending between tile colours
      let bx = clamp((fx - .5) * 1.7 + .5 + n * .55, 0, 1), by = clamp((fy - .5) * 1.7 + .5 + dn[((u + 97) & (P - 1)) * P + ((v + 31) & (P - 1))] * .55, 0, 1);
      const x0 = clamp(i0, 0, N - 1), x1 = clamp(i0 + 1, 0, N - 1), y0 = clamp(j0, 0, N - 1), y1 = clamp(j0 + 1, 0, N - 1);
      const a = y0 * N + x0, b = y0 * N + x1, c = y1 * N + x0, e = y1 * N + x1;
      const w00 = (1 - bx) * (1 - by), w10 = bx * (1 - by), w01 = (1 - bx) * by, w11 = bx * by;
      let r = tc[a * 3] * w00 + tc[b * 3] * w10 + tc[c * 3] * w01 + tc[e * 3] * w11;
      let g = tc[a * 3 + 1] * w00 + tc[b * 3 + 1] * w10 + tc[c * 3 + 1] * w01 + tc[e * 3 + 1] * w11;
      let bl = tc[a * 3 + 2] * w00 + tc[b * 3 + 2] * w10 + tc[c * 3 + 2] * w01 + tc[e * 3 + 2] * w11;
      const am = amp[a] * w00 + amp[b] * w10 + amp[c] * w01 + amp[e] * w11;
      const wt = wat[a] * w00 + wat[b] * w10 + wat[c] * w01 + wat[e] * w11;
      const grain = (((((u * 73856093) ^ (v * 19349663)) >>> 0) % 1021 / 1021 - .5) * .6 + n) * am;
      r += grain; g += grain; bl += grain * .7;
      // foam / wet sand along the shoreline
      if (wt > .3 && wt < .7) { const f = 1 - Math.abs(wt - .5) / .2; r += f * 34; g += f * 38; bl += f * 34; }
      else if (wt >= .7 && wt < .9) { r -= 6; g -= 2; }
      const k = (v * W + u) * 4;
      d[k] = r; d[k + 1] = g; d[k + 2] = bl; d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // painted details: grass tufts, pebbles, flowers
  const rng = new Rng(G.seed + 4);
  for (let i = 0; i < N * N * 3; i++) {
    const tx = rng.next() * N, ty = rng.next() * N;
    const t = ter[tIdxN(tx, ty, N)];
    const x = tx * T, y = ty * T;
    if (t === TER.GRASS || t === TER.LUSH || t === TER.FOREST) {
      ctx.strokeStyle = rng.chance(.5) ? 'rgba(40,70,20,.35)' : 'rgba(150,190,90,.3)'; ctx.lineWidth = T / 22;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * T * .05, y); ctx.lineTo(x + k * T * .05 - T * .05, y - T * .1); ctx.stroke(); }
      if (rng.chance(.04)) { ctx.fillStyle = rng.pick(['#e8d76a', '#f2f2f2', '#c96fd0', '#e8846b']); ctx.fillRect(x, y, T * .06, T * .06); }
    } else if (t === TER.DIRT || t === TER.DRY || t === TER.SAND) {
      if (rng.chance(.4)) { ctx.fillStyle = t === TER.SAND ? 'rgba(160,130,90,.35)' : 'rgba(80,60,40,.35)'; ctx.beginPath(); ctx.arc(x, y, T * .04, 0, 7); ctx.fill(); }
    }
  }
  return { canvas: cv, T };
}
function tIdxN(x, y, N) { return clamp(Math.floor(y), 0, N - 1) * N + clamp(Math.floor(x), 0, N - 1); }
function terrainMini(G) {
  const N = G.N, c = mkCanvas(N, N), ctx = c.getContext('2d'), img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const col = TER_COL[G.terrain[i]]; img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------
// Units
// ------------------------------------------------------------
const SKIN = ['#e0b48c', '#c8935f', '#a8703f', '#8a5a33'];
const CIV_SKIN = { majapahit: 2, britons: 0, franks: 0, mongols: 1, japanese: 1, ottomans: 1, byzantines: 1, chinese: 1 };
const UNIT_ART = {
  villager: { tunic: '#8b6a43', legs: '#5b4630', helm: 'none', weapon: 'none', sash: true },
  militia: { tunic: 'P', legs: '#5a4630', helm: 'cap', weapon: 'sword', shield: 'round' },
  manAtArms: { tunic: 'P', legs: '#555', armor: 'mail', helm: 'kettle', weapon: 'sword', shield: 'round' },
  longSwordsman: { tunic: 'P', legs: '#555', armor: 'mail', helm: 'great', weapon: 'longsword', shield: 'kite' },
  champion: { tunic: 'P', legs: '#666', armor: 'plate', helm: 'plume', weapon: 'longsword', shield: 'kite' },
  spearman: { tunic: 'P', legs: '#5a4630', helm: 'cap', weapon: 'spear' },
  pikeman: { tunic: 'P', legs: '#555', armor: 'mail', helm: 'kettle', weapon: 'pike' },
  halberdier: { tunic: 'P', legs: '#666', armor: 'plate', helm: 'great', weapon: 'halberd' },
  archer: { tunic: 'P', legs: '#4f5a33', helm: 'hood', weapon: 'bow', quiver: true },
  crossbowman: { tunic: 'P', legs: '#555', armor: 'mail', helm: 'kettle', weapon: 'xbow', quiver: true },
  arbalester: { tunic: 'P', legs: '#666', armor: 'plate', helm: 'great', weapon: 'xbow', quiver: true },
  skirmisher: { tunic: 'P', legs: '#6a5434', helm: 'none', weapon: 'javelin', shield: 'small' },
  eliteSkirmisher: { tunic: 'P', legs: '#6a5434', helm: 'cap', weapon: 'javelin', shield: 'small' },
  handCannoneer: { tunic: 'P', legs: '#444', helm: 'hat', weapon: 'gun' },
  monk: { tunic: '#7a5a3a', robe: true, helm: 'tonsure', weapon: 'staff', stole: true },
  bhayangkara: { tunic: 'P', legs: '#3b2a1e', armor: 'gold', helm: 'tekes', weapon: 'tombak', shield: 'round', skirt: '#a8322a' },
  longbowman: { tunic: 'P', legs: '#3e4f2a', helm: 'hood', weapon: 'longbow', quiver: true },
  throwingAxeman: { tunic: 'P', legs: '#5a4630', helm: 'none', beard: true, weapon: 'axe', shield: 'round' },
  samurai: { tunic: 'P', legs: '#2d2d3a', armor: 'lamellar', helm: 'kabuto', weapon: 'katana' },
  janissary: { tunic: 'P', legs: '#5d2a2a', helm: 'bork', weapon: 'gun' },
  chuKoNu: { tunic: 'P', legs: '#4a4030', armor: 'lamellar', helm: 'straw', weapon: 'xbow', quiver: true },
  scout: { mount: 'brown', tunic: 'P', helm: 'cap', weapon: 'sword' },
  lightCav: { mount: 'grey', tunic: 'P', helm: 'kettle', weapon: 'spear' },
  knight: { mount: 'dark', barding: 'P', tunic: 'P', armor: 'plate', helm: 'great', weapon: 'lance', shield: 'kite' },
  cavalier: { mount: 'dark', barding: 'P', tunic: 'P', armor: 'plate', helm: 'great', weapon: 'lance', shield: 'kite' },
  paladin: { mount: 'white', barding: 'P', tunic: 'P', armor: 'gold', helm: 'plume', weapon: 'lance', shield: 'kite' },
  cavArcher: { mount: 'brown', tunic: 'P', helm: 'hood', weapon: 'bow', quiver: true },
  heavyCavArcher: { mount: 'grey', tunic: 'P', armor: 'mail', helm: 'kettle', weapon: 'bow', quiver: true },
  mangudai: { mount: 'brown', tunic: 'P', helm: 'fur', weapon: 'bow', quiver: true },
  cataphract: { mount: 'dark', barding: 'scale', tunic: 'P', armor: 'lamellar', helm: 'great', weapon: 'lance' },
};
const HORSE = { brown: '#7a4f2c', dark: '#3c2a1f', grey: '#9a948a', white: '#d8d2c6' };

function drawHuman(c, a, col, pose) {
  // origin: feet; facing right. pose: {walk, atk, back, tool, carry, act}
  const pc = PCOLORS[col] || PCOLORS[6];
  const tunic = a.tunic === 'P' ? pc.c : a.tunic;
  const tunicD = shade(tunic, -.32);
  const skin = SKIN[a.skin != null ? a.skin : 1];
  const metal = '#a9adb3', metalD = '#6e737a', gold = '#d4a640';
  const w = pose.walk || 0, back = pose.back;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // legs
  if (!a.robe) {
    const leg = a.legs || '#4c3a28';
    c.strokeStyle = shade(leg, -.2); c.lineWidth = 2.1;
    ln(c, -.6, -8.5, -.6 - w * 2.4, -.8);
    c.strokeStyle = leg; ln(c, 1, -8.5, 1 + w * 2.4, -.8);
    c.fillStyle = '#2b2018';
    c.fillRect(-1.8 - w * 2.4, -1.4, 2.4, 1.4); c.fillRect(.2 + w * 2.4, -1.4, 2.4, 1.4);
  }
  if (a.skirt) poly(c, [[-3.4, -9], [3.4, -9], [4, -4.5], [-4, -4.5]], a.skirt);
  // quiver on the back
  if (a.quiver) { c.save(); c.translate(-2.6, -15); c.rotate(-.35); c.fillStyle = '#6b4325'; c.fillRect(-1.2, -1, 2.4, 7); c.fillStyle = '#ddd'; c.fillRect(-1, -2.4, .7, 1.6); c.fillRect(.2, -2.6, .7, 1.8); c.restore(); }
  // torso
  if (a.robe) {
    poly(c, [[-3.2, -17], [3.2, -17], [4.4, -.6], [-4.4, -.6]], tunic);
    poly(c, [[-.5, -17], [3.2, -17], [4.4, -.6], [.6, -.6]], shade(tunic, -.15));
    if (a.stole) { c.strokeStyle = pc.c; c.lineWidth = 1.3; ln(c, -1.2, -16.5, -1.6, -7); ln(c, 1.2, -16.5, 1.6, -7); }
  } else {
    poly(c, [[-3.2, -17.2], [3.2, -17.2], [3.6, -8], [-3.6, -8]], tunic);
    poly(c, [[.6, -17.2], [3.2, -17.2], [3.6, -8], [.9, -8]], tunicD);
    if (a.armor === 'mail') { c.fillStyle = rgba(metal, .85); c.fillRect(-3.2, -17.2, 6.4, 5.5); c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = -16.6; y < -12; y += 1.1) c.fillRect(-3, y, 6, .4); }
    if (a.armor === 'plate') { poly(c, [[-3.4, -17.3], [3.4, -17.3], [3.2, -10.5], [-3.2, -10.5]], metal); poly(c, [[.4, -17.3], [3.4, -17.3], [3.2, -10.5], [.6, -10.5]], metalD); c.fillStyle = tunic; c.fillRect(-3.4, -10.5, 6.8, 2.4); }
    if (a.armor === 'gold') { poly(c, [[-3.4, -17.3], [3.4, -17.3], [3.2, -11], [-3.2, -11]], gold); c.fillStyle = shade(gold, -.3); c.fillRect(.5, -17.3, 2.9, 6.3); }
    if (a.armor === 'lamellar') { c.fillStyle = shade(tunic, -.45); c.fillRect(-3.3, -17, 6.6, 7.5); c.fillStyle = 'rgba(255,255,255,.25)'; for (let y = -16.4; y < -10; y += 1.3) c.fillRect(-3.1, y, 6.2, .5); }
    c.fillStyle = '#3a2716'; c.fillRect(-3.6, -9.2, 7.2, 1.1);
    if (a.sash) { c.strokeStyle = pc.c; c.lineWidth = 1.4; ln(c, -3, -16.6, 3, -10.4); }
  }
  // carried goods
  if (pose.carry === 'wood') { c.fillStyle = '#8b5a2b'; c.save(); c.translate(-1, -18.5); c.rotate(-.25); c.fillRect(-4, -1.2, 8, 2.4); c.fillStyle = '#c99a5f'; circ(c, 4, 0, 1.2, '#c99a5f'); c.restore(); }
  if (pose.carry === 'food' || pose.carry === 'gold' || pose.carry === 'stone') { const cc = pose.carry === 'gold' ? '#e7c24a' : pose.carry === 'stone' ? '#9a9a96' : '#b88a4a'; circ(c, -3.2, -12.5, 2.6, '#7c5b34'); circ(c, -3.2, -13.6, 1.6, cc); }
  // head
  const hy = -20.2;
  circ(c, 0, hy, 3, skin);
  if (back) circ(c, 0, hy, 3, a.helm === 'tonsure' ? skin : '#3a2a1c');
  else { c.fillStyle = '#1c130c'; c.fillRect(1.3, hy - .9, .8, .9); if (a.beard) poly(c, [[-.6, hy + 1], [2.8, hy + .6], [1.4, hy + 3.6]], '#7a4a22'); }
  drawHelm(c, a.helm, hy, pc, back);
  // arms and weapon
  drawWeapon(c, a, pose, skin, pc, tunic);
  // shield in front
  if (a.shield && !back) drawShield(c, a.shield, pc);
  if (a.shield && back) { poly(c, [[-4.5, -16], [-1.2, -16], [-1.2, -10], [-4.5, -10]], shade(pc.c, -.2)); }
}
function drawHelm(c, h, hy, pc, back) {
  const metal = '#a8adb4', md = '#6c7178';
  switch (h) {
    case 'cap': c.beginPath(); c.arc(0, hy - .4, 3.1, Math.PI, 0); c.fillStyle = '#7a5a34'; c.fill(); break;
    case 'kettle': ell(c, 0, hy - 1.2, 4.4, 1.2, md); c.beginPath(); c.arc(0, hy - 1, 2.8, Math.PI, 0); c.fillStyle = metal; c.fill(); break;
    case 'great': poly(c, [[-3.2, hy - 3.6], [3.2, hy - 3.6], [3.3, hy + 2.6], [-3.3, hy + 2.6]], metal); poly(c, [[.6, hy - 3.6], [3.2, hy - 3.6], [3.3, hy + 2.6], [.6, hy + 2.6]], md); if (!back) { c.fillStyle = '#222'; c.fillRect(.4, hy - .6, 2.9, .8); } break;
    case 'plume': poly(c, [[-3.2, hy - 3.6], [3.2, hy - 3.6], [3.3, hy + 2.6], [-3.3, hy + 2.6]], metal); if (!back) { c.fillStyle = '#222'; c.fillRect(.4, hy - .6, 2.9, .8); } c.strokeStyle = pc.c; c.lineWidth = 2; ln(c, 0, hy - 3.6, -3.5, hy - 6.5); break;
    case 'hood': c.beginPath(); c.arc(0, hy - .2, 3.5, Math.PI * .85, Math.PI * 2.15); c.fillStyle = shade(pc.c, -.25); c.fill(); poly(c, [[-3.4, hy], [-4.6, hy + 4], [-1, hy + 2]], shade(pc.c, -.25)); break;
    case 'hat': ell(c, 0, hy - 2, 4.6, 1.2, '#2a2a2a'); poly(c, [[-2.4, hy - 2], [2.4, hy - 2], [1.8, hy - 5], [-1.8, hy - 5]], '#333'); break;
    case 'tonsure': c.beginPath(); c.arc(0, hy - .5, 3.1, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = '#5a3a20'; c.lineWidth = 1.2; c.stroke(); break;
    case 'tekes': poly(c, [[-3, hy - 1.6], [3, hy - 1.6], [2.2, hy - 5], [0, hy - 6.6], [-2.2, hy - 5]], '#d4a640'); c.fillStyle = '#a8322a'; c.fillRect(-.6, hy - 5, 1.2, 1.6); break;
    case 'kabuto': ell(c, 0, hy - 1.3, 4.6, 1.4, '#2a2a33'); c.beginPath(); c.arc(0, hy - 1, 3, Math.PI, 0); c.fillStyle = '#2f2f3a'; c.fill(); c.strokeStyle = '#d4a640'; c.lineWidth = .9; ln(c, -.5, hy - 3.2, -2.6, hy - 6); ln(c, .5, hy - 3.2, 2.6, hy - 6); break;
    case 'bork': poly(c, [[-2.6, hy - 2], [2.6, hy - 2], [2, hy - 8], [-3.2, hy - 7]], '#f0ece0'); poly(c, [[-3.2, hy - 7], [-2, hy - 8], [-5.5, hy - 2.5], [-6, hy - 4]], '#e2dccb'); c.fillStyle = '#d4a640'; c.fillRect(-2.6, hy - 2.6, 5.2, 1); break;
    case 'straw': poly(c, [[-5.4, hy - 1.2], [5.4, hy - 1.2], [0, hy - 5.4]], '#cdb06a'); ln(c, -5.4, hy - 1.2, 5.4, hy - 1.2, '#9a7f3e', .6); break;
    case 'fur': c.beginPath(); c.arc(0, hy - .8, 3.4, Math.PI, 0); c.fillStyle = '#6b4a2a'; c.fill(); poly(c, [[-1, hy - 3.6], [1, hy - 3.6], [0, hy - 6.2]], pc.c); break;
  }
}
function drawShield(c, k, pc) {
  if (k === 'round') { circ(c, -1.2, -12.6, 3.4, pc.c, shade(pc.c, -.45), .8); circ(c, -1.2, -12.6, .9, '#c9c3b0'); }
  else if (k === 'kite') { poly(c, [[-4, -16.2], [1.4, -16.2], [1.2, -11], [-1.3, -7], [-3.8, -11]], pc.c, shade(pc.c, -.5), .8); ln(c, -1.3, -15.8, -1.3, -8, '#f0e6c8', .9); ln(c, -3.6, -13, .9, -13); }
  else if (k === 'small') { poly(c, [[-3.4, -15], [.2, -15], [.2, -10], [-3.4, -10]], pc.c, shade(pc.c, -.5), .7); }
}
function drawWeapon(c, a, pose, skin, pc, tunic) {
  const wpn = a.weapon, act = pose.act, ap = pose.atk;
  const sx = 2.4, sy = -16; // shoulder
  const arm = (ang, len) => { const x = sx + Math.cos(ang) * len, y = sy + Math.sin(ang) * len; c.strokeStyle = shade(tunic, -.15); c.lineWidth = 1.9; ln(c, sx, sy, x, y); circ(c, x, y, 1, skin); return [x, y]; };
  const wood = '#7a5230', metal = '#cfd3d8';
  let tool = pose.tool;
  if (tool) {
    // villager tools swing during work
    const sw = act === 'gather' || act === 'build' || act === 'attack' ? Math.sin(ap * Math.PI * 2) : .3;
    const ang = -1.2 + sw * 1.1;
    const [hx, hy] = arm(ang, 4.6);
    c.save(); c.translate(hx, hy); c.rotate(ang + Math.PI / 2);
    if (tool === 'axe') { ln(c, 0, 1.5, 0, -6.5, wood, 1.2); poly(c, [[0, -6.5], [3, -7.5], [3, -4], [0, -5]], metal); }
    else if (tool === 'pick') { ln(c, 0, 1.5, 0, -6, wood, 1.2); c.strokeStyle = '#8a8f96'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, -3.5, 3.4, -2.6, -.5); c.stroke(); }
    else if (tool === 'hammer') { ln(c, 0, 1, 0, -5, wood, 1.1); c.fillStyle = '#777'; c.fillRect(-1.6, -6.4, 3.2, 1.8); }
    else if (tool === 'hoe') { ln(c, 0, 2, 0, -7, wood, 1.1); ln(c, 0, -7, 2.5, -6, '#888', 1.1); }
    else if (tool === 'spear') { ln(c, 0, 3, 0, -9, wood, 1.1); poly(c, [[0, -9], [-.8, -7.4], [.8, -7.4]], metal); }
    else if (tool === 'basket') { c.restore(); circ(c, 3.2, -10.6, 2.4, '#a07a44', '#6b4e28', .7); c.fillStyle = '#b13b3b'; circ(c, 2.8, -11.6, .7, '#b13b3b'); circ(c, 3.8, -11.4, .7, '#7a2a6a'); return; }
    c.restore();
    return;
  }
  if (wpn === 'none') { arm(1.3, 5); return; }
  if (wpn === 'sword' || wpn === 'longsword' || wpn === 'katana' || wpn === 'axe') {
    const atk = act === 'attack';
    const ang = atk ? (ap < .35 ? -2.2 + ap * 2 : -1.5 + (ap - .35) * 4.5) : .55;
    const [hx, hy] = arm(ang, 4.8);
    c.save(); c.translate(hx, hy); c.rotate(ang + (atk ? Math.PI * .5 : -.3));
    const L = wpn === 'longsword' ? 10 : wpn === 'katana' ? 9.5 : 7.5;
    if (wpn === 'axe') { ln(c, 0, 1, 0, -7, wood, 1.2); poly(c, [[0, -7], [2.8, -8.6], [2.8, -4.6], [0, -5.6]], metal); }
    else { ln(c, 0, 1, 0, -L, wpn === 'katana' ? '#e4e8ec' : metal, 1.2); ln(c, -1.6, 0, 1.6, 0, wpn === 'katana' ? '#222' : '#8a6a2a', 1.1); }
    c.restore();
    return;
  }
  if (wpn === 'spear' || wpn === 'pike' || wpn === 'halberd' || wpn === 'tombak' || wpn === 'lance') {
    const atk = act === 'attack';
    const thrust = atk ? Math.sin(Math.min(1, ap * 1.4) * Math.PI) * 3.5 : 0;
    const L = wpn === 'pike' ? 22 : wpn === 'lance' ? 20 : wpn === 'halberd' ? 17 : 15;
    const ang = wpn === 'lance' ? -.08 : (atk ? -.12 : -1.25);
    const [hx, hy] = arm(atk ? -.3 : .9, 4.2);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const bx = hx - dx * L * .35 + dx * thrust, by = hy - dy * L * .35 + dy * thrust;
    const tx = bx + dx * L, ty = by + dy * L;
    ln(c, bx, by, tx, ty, wood, 1.1);
    if (wpn === 'halberd') { c.save(); c.translate(tx, ty); c.rotate(ang); poly(c, [[-3, -.4], [-.5, -.4], [-1, -3.2], [-3, -2.6]], metal); poly(c, [[0, 0], [-2, -.6], [-2, .6]], metal); c.restore(); }
    else { c.save(); c.translate(tx, ty); c.rotate(ang); poly(c, [[1.8, 0], [-1.2, -1], [-1.2, 1]], metal); if (wpn === 'tombak') { c.fillStyle = '#a8322a'; c.fillRect(-2.6, -.8, 1.2, 1.6); } c.restore(); }
    return;
  }
  if (wpn === 'bow' || wpn === 'longbow') {
    const atk = act === 'attack';
    const draw = atk ? Math.max(0, 1 - ap * 2.5) : 0;
    const L = wpn === 'longbow' ? 10.5 : 7.5;
    const hx = sx + 4.2, hy = sy + .6;
    c.strokeStyle = shade(tunic, -.15); c.lineWidth = 1.9; ln(c, sx, sy, hx, hy);
    c.strokeStyle = '#6e4423'; c.lineWidth = 1.2; c.beginPath(); c.arc(hx - L * .55, hy, L * .62, -.95, .95); c.stroke();
    const strX = hx - L * .55 + Math.cos(.95) * L * .62 - draw * 3.4;
    ln(c, hx - L * .55 + Math.cos(.95) * L * .62, hy - Math.sin(.95) * L * .62, strX, hy, '#eee', .45);
    ln(c, strX, hy, hx - L * .55 + Math.cos(.95) * L * .62, hy + Math.sin(.95) * L * .62);
    if (draw > .1) ln(c, strX, hy, hx + 2, hy, '#d8c8a0', .7);
    return;
  }
  if (wpn === 'xbow') {
    const [hx, hy] = arm(.15, 4.4);
    c.save(); c.translate(hx, hy); c.rotate(-.05);
    ln(c, -2, 0, 6, 0, '#6e4423', 1.6);
    ln(c, 5, -3, 5, 3, '#555', 1);
    c.restore(); return;
  }
  if (wpn === 'javelin') {
    const atk = act === 'attack';
    const ang = atk ? -2 + ap * 3.4 : -1.4;
    const [hx, hy] = arm(atk ? ang : .9, 4.6);
    if (!atk || ap < .5) { ln(c, hx - 3, hy + 2.4, hx + 5, hy - 5, wood, .9); }
    return;
  }
  if (wpn === 'gun') {
    const [hx, hy] = arm(.05, 4.4);
    ln(c, hx - 4, hy + 1, hx + 7.5, hy - .4, '#3a2a1c', 1.6);
    ln(c, hx + 1, hy + .2, hx + 7.5, hy - .4, '#555', 1);
    if (act === 'attack' && ap < .18) { circ(c, hx + 9, hy - .5, 2, 'rgba(255,220,120,.9)'); circ(c, hx + 11, hy - 1.5, 2.6, 'rgba(200,200,200,.6)'); }
    return;
  }
  if (wpn === 'staff') {
    const lift = act === 'convert' || act === 'heal' ? -2.5 - Math.sin(pose.t * 6) : 0;
    const [hx, hy] = arm(act === 'convert' || act === 'heal' ? -1.1 : .9, 4.6);
    ln(c, hx, hy - 7 + lift, hx, hy + 5, '#8a6a3a', 1.1);
    if (act === 'convert' || act === 'heal') circ(c, hx, hy - 8 + lift, 1.6, act === 'heal' ? 'rgba(160,255,160,.85)' : 'rgba(255,230,120,.9)');
  }
}
function drawHorse(c, color, pose, barding, pc) {
  const body = HORSE[color] || HORSE.brown, dark = shade(body, -.35);
  const w = pose.walk || 0;
  c.lineCap = 'round';
  // legs
  const legs = [[-6.5, w], [-4.5, -w], [5, -w], [7, w]];
  c.strokeStyle = dark; c.lineWidth = 1.8;
  for (const [lx, s] of legs) ln(c, lx, -8, lx + s * 2.2, -.5);
  // body
  ell(c, 0, -10.5, 9, 4.2, body);
  ell(c, 1, -9.2, 7, 2.2, shade(body, -.15));
  // neck & head
  poly(c, [[6, -13], [8.5, -18.5], [11.5, -19], [10.5, -14.5], [8, -10]], body);
  poly(c, [[10, -19.5], [14.6, -17], [14, -15.4], [10.6, -16]], body);
  c.fillStyle = '#111'; c.fillRect(11.6, -18.4, .9, .9);
  ln(c, 7.5, -18, 6, -13.5, dark, 1.4);
  // tail
  ln(c, -8.6, -12, -11, -6.5 + w, dark, 1.6);
  if (barding === 'P') {
    poly(c, [[-8.5, -14], [8, -14.6], [9, -6.5], [-9, -6.2]], pc.c);
    c.strokeStyle = shade(pc.c, .4); c.lineWidth = .8; ln(c, -8.6, -6.4, 9, -6.6);
    c.fillStyle = '#f2e6b8'; for (let x = -6; x < 8; x += 4) circ(c, x, -10, .8, '#f2e6b8');
  } else if (barding === 'scale') {
    poly(c, [[-8.5, -14], [8, -14.6], [9, -7.5], [-9, -7.2]], '#8a8d92');
    c.fillStyle = 'rgba(0,0,0,.25)'; for (let y = -13.5; y < -8; y += 1.4) c.fillRect(-8.4, y, 17, .5);
  } else { poly(c, [[-3, -14.4], [3.2, -14.6], [2.5, -11], [-2.5, -11]], '#5a3a20'); }
}
function drawRiderBase(c, a, col, pose) {
  // rider sits on the horse back; reuse the human torso by translating
  c.save(); c.translate(-.5, -6.5);
  const b = Object.assign({}, a, { legs: null, robe: false });
  drawHumanUpper(c, b, col, pose);
  c.restore();
}
function drawHumanUpper(c, a, col, pose) {
  // human without legs (rider)
  const pc = PCOLORS[col] || PCOLORS[6];
  const tunic = a.tunic === 'P' ? pc.c : a.tunic;
  const skin = SKIN[a.skin != null ? a.skin : 1];
  if (a.quiver) { c.save(); c.translate(-2.6, -15); c.rotate(-.35); c.fillStyle = '#6b4325'; c.fillRect(-1.2, -1, 2.4, 7); c.restore(); }
  poly(c, [[-3, -17.2], [3, -17.2], [3.4, -9], [-3.4, -9]], tunic);
  poly(c, [[.6, -17.2], [3, -17.2], [3.4, -9], [.9, -9]], shade(tunic, -.32));
  if (a.armor === 'plate' || a.armor === 'mail') { poly(c, [[-3.2, -17.3], [3.2, -17.3], [3, -11.5], [-3, -11.5]], a.armor === 'plate' ? '#a9adb3' : rgba('#a9adb3', .85)); }
  if (a.armor === 'gold') poly(c, [[-3.2, -17.3], [3.2, -17.3], [3, -11.5], [-3, -11.5]], '#d4a640');
  if (a.armor === 'lamellar') { c.fillStyle = shade(tunic, -.45); c.fillRect(-3.1, -17, 6.2, 6.5); }
  // leg hanging
  ln(c, 1, -9.5, 2.4, -4.5, '#4a3a2a', 2);
  const hy = -20.2;
  circ(c, 0, hy, 3, skin);
  if (pose.back) circ(c, 0, hy, 3, '#3a2a1c'); else { c.fillStyle = '#1c130c'; c.fillRect(1.3, hy - .9, .8, .9); }
  drawHelm(c, a.helm, hy, pc, pose.back);
  drawWeapon(c, a, pose, skin, pc, tunic);
  if (a.shield && !pose.back) { c.save(); c.translate(0, 1); drawShield(c, a.shield, pc); c.restore(); }
}
function drawSiege(c, type, col, pose) {
  const pc = PCOLORS[col] || PCOLORS[6];
  const wood = '#8a5f35', woodD = '#5e3e20', metal = '#7d8288';
  const wheel = (x, y, r) => { circ(c, x, y, r, '#4a3220'); circ(c, x, y, r * .55, woodD); ln(c, x - r, y, x + r, y, '#3a2618', .6); ln(c, x, y - r, x, y + r); };
  if (type === 'ram' || type === 'cappedRam') {
    poly(c, [[-12, -6], [12, -6], [12, -10], [-12, -10]], woodD);
    poly(c, [[-12, -10], [12, -10], [7, -19], [-7, -19]], type === 'cappedRam' ? '#7c7f84' : '#8b6b42');
    poly(c, [[-7, -19], [7, -19], [5, -21], [-5, -21]], pc.c);
    const th = pose.act === 'attack' ? Math.sin(Math.min(1, pose.atk * 2) * Math.PI) * 3 : 0;
    ln(c, 9 + th, -9, 16 + th, -9, '#6a4426', 2.6); poly(c, [[16 + th, -11], [19 + th, -9], [16 + th, -7]], metal);
    wheel(-8, -3, 3); wheel(8, -3, 3);
  } else if (type === 'mangonel' || type === 'onager') {
    poly(c, [[-11, -4], [10, -4], [10, -7], [-11, -7]], wood);
    wheel(-7, -3, 2.6); wheel(7, -3, 2.6);
    ln(c, -2, -7, 1, -15, woodD, 2); ln(c, 3, -7, 1, -15, woodD, 2);
    const fire = pose.act === 'attack' && pose.atk < .4;
    const ang = fire ? -1.6 + pose.atk * 3 : .2;
    c.save(); c.translate(1, -12); c.rotate(-Math.PI / 2 + ang - .4);
    ln(c, 0, 0, 13, 0, '#6a4426', 1.8); circ(c, 13, 0, 2.2, type === 'onager' ? '#555' : '#6b4a2a');
    c.restore();
    c.fillStyle = pc.c; c.fillRect(-10, -8.5, 4, 1.5);
  } else if (type === 'trebuchet') {
    poly(c, [[-14, -3], [14, -3], [14, -6], [-14, -6]], wood);
    ln(c, -6, -6, 0, -30, woodD, 2.6); ln(c, 6, -6, 0, -30, woodD, 2.6);
    const ang = pose.act === 'attack' && pose.atk < .5 ? -2.4 + pose.atk * 5 : pose.act === 'setup' ? -.6 : .55;
    c.save(); c.translate(0, -28); c.rotate(ang);
    ln(c, -8, 0, 22, 0, '#6a4426', 2.2);
    poly(c, [[-10, -1], [-5, -1], [-5, 6], [-10, 6]], '#4a3a2a');
    c.restore();
    c.fillStyle = pc.c; c.fillRect(-13, -7.5, 5, 2);
    wheel(-11, -2, 2.2); wheel(11, -2, 2.2);
  } else if (type === 'bombard') {
    wheel(-3, -4, 4.6);
    poly(c, [[-12, -2], [-2, -7], [-1, -5], [-11, 0]], wood);
    c.save(); c.translate(-2, -8.5); c.rotate(-.1);
    poly(c, [[-6, -2.4], [12, -2], [12, 2], [-6, 2.4]], '#3d3f43');
    ln(c, 11, -2.6, 11, 2.6, '#55585d', 1.2);
    c.restore();
    c.fillStyle = pc.c; c.fillRect(-11, -3, 4, 1.4);
    if (pose.act === 'attack' && pose.atk < .2) { circ(c, 14, -9.5, 3, 'rgba(255,200,90,.9)'); circ(c, 18, -11, 4, 'rgba(190,190,190,.7)'); }
  }
}
function drawShip(c, type, col, pose) {
  const pc = PCOLORS[col] || PCOLORS[6];
  const hull = '#6b4526', hullD = '#4a2e18';
  const bob = Math.sin((pose.t || 0) * 2) * .6;
  c.translate(0, bob);
  const L = type === 'fishingShip' ? 13 : type === 'galleon' ? 22 : type === 'warGalley' ? 19 : 17;
  poly(c, [[-L, -6], [L + 3, -7], [L - 2, 0], [-L + 3, 0]], hull);
  poly(c, [[-L, -6], [L + 3, -7], [L + 2, -8.5], [-L - .5, -7.5]], shade(hull, .15));
  ln(c, -L + 2, -3, L, -3.5, hullD, .8);
  if (type === 'fishingShip') {
    ln(c, 0, -7, 0, -22, '#5a3a20', 1.2);
    poly(c, [[0.5, -21], [9, -10], [0.5, -9]], '#efe7d2');
    c.fillStyle = pc.c; c.fillRect(-.5, -23.5, 4, 2);
    c.strokeStyle = 'rgba(220,220,200,.6)'; c.lineWidth = .5; for (let i = 0; i < 4; i++) ln(c, -L + 1 + i * 2, -6.5, -L - 3 + i * 2, 1.5);
  } else {
    const masts = type === 'galleon' ? [-6, 6] : [0];
    for (const m of masts) {
      ln(c, m, -7, m, -32, '#5a3a20', 1.4);
      poly(c, [[m - 7, -29], [m + 7, -29], [m + 8, -14], [m - 8, -14]], '#efe7d2');
      c.fillStyle = pc.c; c.fillRect(m - 7.5, -23, 15.5, 3);
      c.fillStyle = pc.c; c.fillRect(m, -35, 5, 2.4);
    }
    if (type !== 'galleon') { c.strokeStyle = hullD; c.lineWidth = .8; for (let i = -3; i <= 3; i++) ln(c, i * 3.6, -2, i * 3.6 - 2 + Math.sin((pose.t || 0) * 4 + i) * 1.5, 3); }
  }
}
function drawAnimal(c, type, pose) {
  const w = pose.walk || 0;
  if (type === 'deer') {
    const b = '#9a6a3c';
    ln(c, -4, -6, -4 + w * 1.6, 0, '#5a3a20', 1.1); ln(c, -2.6, -6, -2.6 - w * 1.6, 0); ln(c, 3.5, -6, 3.5 - w * 1.6, 0); ln(c, 4.8, -6, 4.8 + w * 1.6, 0);
    ell(c, 0, -7.5, 6, 2.8, b); poly(c, [[4.5, -9], [6.5, -13], [8.5, -13], [7, -8]], b); poly(c, [[7.6, -13.5], [10.6, -12], [8, -11.4]], b);
    ln(c, 7, -13.6, 6, -17.5, '#d9c8a8', .7); ln(c, 6.4, -16, 4.6, -17.5); ln(c, 8, -13.6, 9, -17.2);
    circ(c, -5.5, -8.5, 1.2, '#efe6d6');
  } else if (type === 'boar') {
    const b = '#4a3426';
    ln(c, -4, -5, -4 + w, 0, '#2a1d14', 1.4); ln(c, -2, -5, -2 - w, 0); ln(c, 3, -5, 3 - w, 0); ln(c, 5, -5, 5 + w, 0);
    ell(c, 0, -6.5, 7, 3.6, b); poly(c, [[5, -9], [10, -6], [9.6, -4], [5, -4]], b);
    ln(c, 8.6, -5, 10, -7, '#efe6d6', .8); c.fillStyle = '#111'; c.fillRect(7, -7.5, .9, .9);
    ln(c, -5, -9.4, 4, -10, '#2a1d14', 1.2);
  } else if (type === 'wolf') {
    const b = '#7c7c7a';
    ln(c, -4, -5.5, -4 + w * 1.5, 0, '#4a4a48', 1.1); ln(c, -2.4, -5.5, -2.4 - w * 1.5, 0); ln(c, 3, -5.5, 3 - w * 1.5, 0); ln(c, 4.6, -5.5, 4.6 + w * 1.5, 0);
    ell(c, 0, -7, 6, 2.6, b); poly(c, [[4.6, -8.6], [7, -11.5], [10.5, -9], [7, -7]], b); poly(c, [[6.6, -11.4], [7.2, -13.6], [8, -11]], b);
    ln(c, -5.6, -7.6, -9, -9.5, b, 1.6); c.fillStyle = '#ffde59'; c.fillRect(8, -10, .9, .7);
  } else if (type === 'sheep') {
    ln(c, -3, -3.5, -3 + w, 0, '#333', 1); ln(c, -1, -3.5, -1 - w, 0); ln(c, 2, -3.5, 2 - w, 0); ln(c, 3.4, -3.5, 3.4 + w, 0);
    circ(c, -2, -6, 3, '#eeeae0'); circ(c, 1.6, -6.2, 3.2, '#f4f1e8'); circ(c, 0, -7.6, 2.6, '#f7f4ec');
    ell(c, 5, -6.8, 1.8, 1.4, '#2d2a28');
  }
}
// Sprite cache for units
function unitPose(u, t) {
  const fr = u.act;
  const p = { walk: 0, atk: 0, act: fr, back: u.back, t };
  if (fr === 'walk') p.walk = Math.sin(u.anim * 9 * (U[u.type].spd || 1));
  if (fr === 'attack' || fr === 'gather' || fr === 'build') p.atk = (u.anim % (fr === 'attack' ? Math.max(.6, ST(u.owner, u.type).rof) : .75)) / (fr === 'attack' ? .6 : .75);
  return p;
}
function unitFrameKey(u, t) {
  const d = U[u.type];
  let anim = u.act, f = 0;
  if (anim === 'walk') f = Math.floor((u.anim * 9 * (d.spd || 1)) / (Math.PI / 2)) % 4;
  else if (anim === 'attack') { const per = u.type === 'trebuchet' ? 1.6 : Math.min(.6, ST(u.owner, u.type).rof * .5); f = Math.min(3, Math.floor(u.anim / per * 4)); if (u.anim > per) anim = 'idle'; }
  else if (anim === 'gather' || anim === 'build') f = Math.floor(u.anim / .75 * 4) % 4;
  else if (anim === 'heal' || anim === 'convert') f = Math.floor(t * 4) % 4;
  else if (anim === 'setup') f = 0;
  else anim = 'idle';
  let tool = '', carry = '';
  if (u.type === 'villager') {
    const o = u.ord;
    if (u.act === 'build') tool = 'hammer';
    else if (o.t === 'gather' || u.act === 'gather') {
      const rt = o.rtype;
      tool = rt === 'tree' ? 'axe' : (rt === 'gold' || rt === 'stone') ? 'pick' : rt === 'farm' ? 'hoe' : rt === 'berry' ? 'basket' : (rt === 'deer' || rt === 'boar' || rt === 'sheep' || rt === 'carcass') ? 'spear' : '';
    } else if (u.act === 'attack') tool = 'spear';
    if (u.carry > 0 && u.act === 'walk') { carry = u.cres === 'wood' ? 'wood' : u.cres; tool = ''; }
  }
  return { anim, f, tool, carry };
}
function unitSprite(type, col, anim, f, back, tool, carry, skin) {
  const key = type + '|' + col + '|' + anim + '|' + f + '|' + (back ? 1 : 0) + '|' + tool + '|' + carry + '|' + (skin || 0);
  let s = Art.cache.get(key);
  if (s) return s;
  const d = U[type], a = Object.assign({}, UNIT_ART[d.art] || UNIT_ART[type] || UNIT_ART.villager, { skin: skin || 0 });
  const pose = { walk: anim === 'walk' ? [0, 1, 0, -1][f] : 0, atk: (anim === 'attack' || anim === 'gather' || anim === 'build') ? f / 4 : 0, act: anim, back, t: f * .25, tool, carry };
  const S = Art.US;
  if (d.animal) s = makeSprite(30, 26, 14, 22, S, c => drawAnimal(c, type, pose));
  else if (d.dom === 'w') s = makeSprite(60, 50, 28, 40, S, c => drawShip(c, type, col, pose));
  else if (d.cls.includes('siege')) s = makeSprite(52, 42, 24, 36, S, c => drawSiege(c, type, col, pose));
  else if (a && a.mount) s = makeSprite(40, 44, 18, 38, S, c => { drawHorse(c, a.mount, pose, a.barding, PCOLORS[col] || PCOLORS[6]); c.translate(0, -2); drawHumanUpper(c, a, col, pose); });
  else s = makeSprite(30, 34, 13, 30, S, c => drawHuman(c, a, col, pose));
  Art.cache.set(key, s);
  return s;
}
function corpseSprite(type, col) {
  const key = 'dead|' + type + '|' + col;
  let s = Art.cache.get(key);
  if (s) return s;
  const d = U[type];
  s = makeSprite(40, 24, 20, 16, Art.US, c => {
    if (d.cls.includes('siege') || d.dom === 'w') {
      c.strokeStyle = '#3a2a1c'; c.lineWidth = 2; ln(c, -12, -2, 10, 1); ln(c, -8, 2, 8, -3); ln(c, -4, -4, 3, 3); circ(c, 6, 0, 3, '#2a1d14');
    } else if (d.animal) { c.rotate(Math.PI / 2 * .95); c.translate(4, -2); drawAnimal(c, type, { walk: 0 }); }
    else { c.rotate(-Math.PI / 2); c.translate(4, 2); const a = UNIT_ART[d.art] || UNIT_ART.villager; if (a.mount) { drawHumanUpper(c, a, col, { act: 'idle' }); } else drawHuman(c, a, col, { act: 'idle', walk: 0 }); }
  });
  Art.cache.set(key, s);
  return s;
}
