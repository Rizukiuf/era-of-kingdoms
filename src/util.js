'use strict';
// ============================================================
//  Utilities: math, RNG, noise, heap, A* pathfinding
// ============================================================
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const sgn = v => v < 0 ? -1 : 1;
function distToRect(px, py, x0, y0, x1, y1) {
  const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
  const dy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
  return Math.hypot(dx, dy);
}
function closestOnRect(px, py, x0, y0, x1, y1) { return [clamp(px, x0, x1), clamp(py, y0, y1)]; }
// world (tile units) -> iso world-pixel space
const isoX = (x, y) => (x - y) * (TW / 2);
const isoY = (x, y) => (x + y) * (TH / 2);

// --- seeded RNG with serialisable state ---
class Rng {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
}

// --- value noise / fbm ---
function hash2(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, seed, oct = 4) {
  let s = 0, a = .5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f, seed + i * 17) * a; n += a; a *= .5; f *= 2; }
  return s / n;
}

// --- binary min-heap of int ids keyed by external Float32Array ---
class Heap {
  constructor(key) { this.a = []; this.key = key; }
  clear() { this.a.length = 0; }
  get size() { return this.a.length; }
  push(i) {
    const a = this.a, k = this.key; a.push(i);
    let n = a.length - 1;
    while (n > 0) { const p = (n - 1) >> 1; if (k[a[p]] <= k[a[n]]) break; const t = a[p]; a[p] = a[n]; a[n] = t; n = p; }
  }
  pop() {
    const a = this.a, k = this.key, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let n = 0; const L = a.length;
      for (;;) {
        const l = 2 * n + 1, r = l + 1; let m = n;
        if (l < L && k[a[l]] < k[a[m]]) m = l;
        if (r < L && k[a[r]] < k[a[m]]) m = r;
        if (m === n) break;
        const t = a[m]; a[m] = a[n]; a[n] = t; n = m;
      }
    }
    return top;
  }
}

// --- A* on the tile grid ---
const PF = {
  N: 0, g: null, f: null, came: null, open: null, closed: null, stamp: 1, heap: null, budget: 0,
  init(N) {
    this.N = N;
    const S = N * N;
    this.g = new Float32Array(S); this.f = new Float32Array(S);
    this.came = new Int32Array(S); this.open = new Uint32Array(S); this.closed = new Uint32Array(S);
    this.stamp = 1; this.heap = new Heap(this.f);
  },
  // goal: {x0,y0,x1,y1,d} rectangle (tile units) and acceptable distance from tile centre
  // pass(i) -> boolean
  find(sx, sy, goal, pass, maxNodes) {
    const N = this.N;
    if (!N) return null;
    const stx = clamp(Math.floor(sx), 0, N - 1), sty = clamp(Math.floor(sy), 0, N - 1);
    const st = this.stamp = (this.stamp + 1) >>> 0;
    const g = this.g, f = this.f, came = this.came, open = this.open, closed = this.closed, heap = this.heap;
    heap.clear();
    const hfun = (tx, ty) => {
      const cx = tx + .5, cy = ty + .5;
      const dx = Math.abs(cx - clamp(cx, goal.x0, goal.x1)), dy = Math.abs(cy - clamp(cy, goal.y0, goal.y1));
      const oct = dx > dy ? dx + .4142 * dy : dy + .4142 * dx;
      return oct;
    };
    const s = sty * N + stx;
    g[s] = 0; f[s] = hfun(stx, sty); came[s] = -1; open[s] = st; heap.push(s);
    let best = s, bestH = f[s], expanded = 0;
    const cap = maxNodes || N * N;
    let found = -1;
    while (heap.size) {
      const c = heap.pop();
      if (closed[c] === st) continue;
      closed[c] = st;
      const cx = c % N, cy = (c / N) | 0;
      const h = hfun(cx, cy);
      if (h <= goal.d) { found = c; break; }
      if (h < bestH || (h === bestH && g[c] < g[best])) { best = c; bestH = h; }
      if (++expanded > cap) break;
      for (let k = 0; k < 8; k++) {
        const dx = DIRS8[k][0], dy = DIRS8[k][1];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const ni = ny * N + nx;
        if (closed[ni] === st) continue;
        if (!pass(ni)) continue;
        if (dx && dy && (!pass(cy * N + nx) || !pass(ny * N + cx))) continue;
        const ng = g[c] + (dx && dy ? 1.4142 : 1);
        if (open[ni] === st && ng >= g[ni]) continue;
        open[ni] = st; g[ni] = ng; came[ni] = c;
        f[ni] = ng + hfun(nx, ny) * 1.05;
        heap.push(ni);
      }
    }
    this.budget -= expanded;
    const end = found >= 0 ? found : best;
    if (end === s) { if (found < 0) return null; const e = []; e.complete = true; return e; }
    const tiles = [];
    for (let c = end; c !== -1 && c !== s; c = came[c]) tiles.push(c);
    tiles.reverse();
    const pts = tiles.map(c => [c % N + .5, ((c / N) | 0) + .5]);
    pts.complete = found >= 0;
    return pts;
  },
};
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Straight-line walkability with a little clearance, used for path smoothing
function lineWalkable(ax, ay, bx, by, passXY, rad) {
  const d = dist(ax, ay, bx, by);
  const n = Math.max(1, Math.ceil(d / .2));
  const r = rad || .2;
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    if (!passXY(x - r, y - r) || !passXY(x + r, y - r) || !passXY(x - r, y + r) || !passXY(x + r, y + r)) return false;
  }
  return true;
}
function smoothPath(sx, sy, pts, passXY, rad) {
  if (!pts || pts.length < 2) return pts;
  const out = [];
  let cx = sx, cy = sy, i = 0;
  while (i < pts.length) {
    let j = i;
    while (j + 1 < pts.length && j - i < 40 && lineWalkable(cx, cy, pts[j + 1][0], pts[j + 1][1], passXY, rad)) j++;
    out.push(pts[j]);
    cx = pts[j][0]; cy = pts[j][1];
    i = j + 1;
  }
  out.complete = pts.complete;
  return out;
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  const p = n => (n < 10 ? '0' : '') + n;
  return (h ? h + ':' + p(m) : p(m)) + ':' + p(s);
}
function b64FromBytes(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return btoa(s);
}
function bytesFromB64(b) {
  const s = atob(b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return v === undefined ? null : false; } }
function storeDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
