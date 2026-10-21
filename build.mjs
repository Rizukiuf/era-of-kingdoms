#!/usr/bin/env node
// Era of Kingdoms — build script (Node.js alternative to build.py, same output).
//
//   node build.mjs                        -> index.html  (stand-alone page)
//                                            + sw.js, manifest.webmanifest, icon.svg, icon-*.png (installable app)
//   node build.mjs --fragment game.html   -> body fragment without <html>/<head>
//
// No npm packages needed. Requires Node 16 or newer.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const ORDER = ['data', 'util', 'i18n_ui', 'map', 'sim', 'cmd', 'ai', 'art_units', 'art_bld', 'render', 'i18n_game', 'ui', 'audio', 'main'];
// Sources are read with \n line endings (as Python's read_text does), so a Windows checkout with CRLF builds the
// same files, and the same service worker cache name, as Linux.
const readSrc = name => readFileSync(join(SRC, name), 'utf8').replace(/\r\n?/g, '\n');
const DESCRIPTION = 'Era of Kingdoms: real-time medieval strategy game in the browser. 8 civilizations, 4 ages, AI opponents, 7 languages.';

function bundleJs() {
  const parts = ORDER.map(name => {
    const text = readSrc(`${name}.js`).replace(/^'use strict';\s*/, '');
    return `// ---- ${name}.js ----\n${text}`;
  });
  return "<script>\n'use strict';\n" + parts.join('\n') + '\n</script>\n';
}

function buildPage(shell, script) {
  const marker = '<div id="app">';
  const i = shell.indexOf(marker);
  const head = shell.slice(0, i), body = shell.slice(i + marker.length);
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + '<meta name="theme-color" content="#0b0f1c">\n'
    + `<meta name="description" content="${DESCRIPTION}">\n`
    + HEAD_APP
    + '<style>html,body{height:100%}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    + head.trim() + '\n</head>\n<body>\n'
    + marker + body.trimEnd() + '\n'
    + script
    + '</body>\n</html>\n';
}

// ---- installable app: icon PNGs, manifest, service worker ----
// The manifest link is not here: main.js adds it only over http(s), because on file:// fetching it is a CORS error.
const HEAD_APP = '<link rel="icon" href="icon.svg" type="image/svg+xml">\n'
  + '<link rel="apple-touch-icon" href="icon-180.png">\n'
  + '<meta name="mobile-web-app-capable" content="yes">\n'
  + '<meta name="apple-mobile-web-app-capable" content="yes">\n'
  + '<meta name="apple-mobile-web-app-title" content="Kingdoms">\n'
  + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n';
const ICON_SIZES = [180, 192, 512];
const SS = 4; // icon samples per pixel side (4 x 4 = 16 per pixel)

// src/icon.svg may use only <rect>, <circle> and <polygon> with a solid fill, so that build.mjs and build.py
// can draw it into byte-identical PNGs. Only + - * / and sqrt are used on coordinates: they round the same way
// in JavaScript and Python.
function parseIcon(svg) {
  svg = svg.replace(/<!--[\s\S]*?-->/g, '');
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  if (!vb || vb[1] !== vb[2]) throw new Error('src/icon.svg: viewBox must be "0 0 N N"');
  const shapes = [];
  for (const m of svg.matchAll(/<(\w+)([^>]*)>/g)) {
    const tag = m[1];
    if (tag === 'svg' || tag === 'title') continue;
    const a = {};
    for (const p of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) a[p[1]] = p[2];
    const fill = a.fill || '', n = k => Number(a[k] || 0);
    if (!/^#[0-9a-f]{6}$/.test(fill)) throw new Error(`src/icon.svg: <${tag}> needs fill="#rrggbb"`);
    const s = { tag, rgb: [1, 3, 5].map(i => parseInt(fill.slice(i, i + 2), 16)) };
    if (tag === 'rect') Object.assign(s, { x: n('x'), y: n('y'), w: n('width'), h: n('height') });
    else if (tag === 'circle') Object.assign(s, { cx: n('cx'), cy: n('cy'), r: n('r') });
    else if (tag === 'polygon') {
      const v = a.points.trim().split(/[\s,]+/).map(Number);
      s.pts = []; for (let i = 0; i + 1 < v.length; i += 2) s.pts.push([v[i], v[i + 1]]);
    } else throw new Error(`src/icon.svg: <${tag}> is not supported (only rect, circle, polygon)`);
    shapes.push(s);
  }
  return { size: Number(vb[1]), shapes };
}

// [x0, x1) pixel intervals where shape s covers the horizontal line y (pixel units; nonzero fill rule)
function iconSpans(s, k, y) {
  if (s.tag === 'rect') return y >= s.y * k && y < (s.y + s.h) * k ? [[s.x * k, (s.x + s.w) * k]] : [];
  if (s.tag === 'circle') {
    const cx = s.cx * k, dy = y - s.cy * k, r = s.r * k;
    if (dy * dy >= r * r) return [];
    const d = Math.sqrt(r * r - dy * dy);
    return [[cx - d, cx + d]];
  }
  const xs = [], n = s.pts.length;
  for (let i = 0; i < n; i++) {
    const x0 = s.pts[i][0] * k, y0 = s.pts[i][1] * k, x1 = s.pts[(i + 1) % n][0] * k, y1 = s.pts[(i + 1) % n][1] * k;
    if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) xs.push([x0 + (y - y0) * (x1 - x0) / (y1 - y0), y1 > y0 ? 1 : -1]);
  }
  xs.sort((a, b) => a[0] - b[0]);
  const out = []; let w = 0, start = 0;
  for (const [x, d] of xs) {
    if (w === 0) start = x;
    w += d;
    if (w === 0) out.push([start, x]);
  }
  return out;
}

// RGB pixels of the icon at size x size, each row starting with PNG filter byte 0
function drawIcon(icon, size) {
  const k = size / icon.size, W = size * SS, N = SS * SS, stride = size * 3 + 1;
  const raw = new Uint8Array(size * stride), row = new Uint8Array(W), rows = [];
  for (let py = 0; py < size; py++) {
    for (let j = 0; j < SS; j++) {
      row.fill(255);
      icon.shapes.forEach((s, si) => {
        for (const [x0, x1] of iconSpans(s, k, py + (j + 0.5) / SS)) {
          row.fill(si, Math.min(W, Math.max(0, Math.ceil(x0 * SS - 0.5))), Math.min(W, Math.max(0, Math.ceil(x1 * SS - 0.5))));
        }
      });
      if (row.includes(255)) throw new Error('src/icon.svg must cover the whole square (the icon has no transparency)');
      rows[j] = row.slice();
    }
    let o = py * stride + 1;
    for (let px = 0; px < size; px++) {
      const c = [0, 0, 0];
      for (const r of rows) for (let i = px * SS; i < px * SS + SS; i++) { const rgb = icon.shapes[r[i]].rgb; c[0] += rgb[0]; c[1] += rgb[1]; c[2] += rgb[2]; }
      for (const v of c) raw[o++] = Math.floor((v * 2 + N) / (2 * N));
    }
  }
  return raw;
}

// zlib stream with one fixed-Huffman deflate block. zlib itself is not used because Node and Python ship
// different zlib builds that compress to different bytes; this greedy encoder gives the same bytes in both.
const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
function zlibStream(data, dists) {
  const out = [0x78, 0x01]; let acc = 0, nb = 0;
  const bits = (v, n) => { acc |= v << nb; nb += n; while (nb >= 8) { out.push(acc & 255); acc >>>= 8; nb -= 8; } };
  const code = (c, n) => { let r = 0; for (let i = 0; i < n; i++) { r = (r << 1) | (c & 1); c >>= 1; } bits(r, n); };
  const sym = v => v < 144 ? code(0x30 + v, 8) : v < 256 ? code(0x190 + v - 144, 9) : v < 280 ? code(v - 256, 7) : code(0xc0 + v - 280, 8);
  const find = (base, v) => { let i = base.length - 1; while (base[i] > v) i--; return i; };
  bits(1, 1); bits(1, 2); // last block, fixed Huffman codes
  for (let pos = 0; pos < data.length;) {
    let len = 0, dist = 0;
    for (const d of dists) {
      if (d > pos) continue;
      let l = 0;
      while (l < 258 && pos + l < data.length && data[pos + l] === data[pos + l - d]) l++;
      if (l > len) { len = l; dist = d; }
    }
    if (len < 3) { sym(data[pos++]); continue; }
    const li = find(LEN_BASE, len), di = find(DIST_BASE, dist);
    sym(257 + li); bits(len - LEN_BASE[li], LEN_EXTRA[li]);
    code(di, 5); bits(dist - DIST_BASE[di], DIST_EXTRA[di]);
    pos += len;
  }
  sym(256);
  if (nb) out.push(acc & 255);
  let a = 1, b = 0;
  for (const v of data) { a = (a + v) % 65521; b = (b + a) % 65521; }
  out.push(b >> 8, b & 255, a >> 8, a & 255);
  return Uint8Array.from(out);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const v of buf) c = CRC_TABLE[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function png(size, raw) {
  const chunk = (type, body) => {
    const t = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(body)]), b = Buffer.alloc(8 + body.length + 4);
    b.writeUInt32BE(body.length, 0); t.copy(b, 4); b.writeUInt32BE(crc32(t), 8 + body.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlibStream(raw, [3, size * 3 + 1])), chunk('IEND', [])]);
}

// Every file of the installable app, index.html first. The service worker's cache name is a hash of all of
// them, so each deploy changes sw.js and the browser downloads the new version.
function appFiles(page) {
  const files = [['index.html', Buffer.from(page, 'utf8')]];
  const manifest = readSrc('manifest.webmanifest');
  JSON.parse(manifest);
  files.push(['manifest.webmanifest', Buffer.from(manifest, 'utf8')]);
  const svg = readSrc('icon.svg'), icon = parseIcon(svg);
  files.push(['icon.svg', Buffer.from(svg, 'utf8')]);
  for (const size of ICON_SIZES) files.push([`icon-${size}.png`, png(size, drawIcon(icon, size))]);
  const sw = readSrc('sw.js'), h = createHash('sha256');
  for (const [, data] of files) h.update(data);
  h.update(sw, 'utf8');
  files.push(['sw.js', Buffer.from(sw.split('%BUILD%').join(h.digest('hex').slice(0, 12)), 'utf8')]);
  return files;
}

const argv = process.argv.slice(2);
const shell = readSrc('shell.html');
const script = bundleJs();
const f = argv.indexOf('--fragment');
const outputs = f >= 0 ? [[resolve(argv[f + 1] || join(ROOT, 'game-fragment.html')), Buffer.from(shell.trimEnd() + '\n' + script, 'utf8')]]
  : appFiles(buildPage(shell, script)).map(([name, data]) => [join(ROOT, name), data]);
for (const [out, data] of outputs) {
  writeFileSync(out, data);
  console.log(`Wrote ${out} (${Math.floor(data.length / 1024)} KB)`);
}
