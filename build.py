#!/usr/bin/env python3
"""
Era of Kingdoms — build script.

Bundles every module in src/ into one self-contained HTML file.

  python3 build.py                         -> index.html  (stand-alone page: open it or host it)
                                              + sw.js, manifest.webmanifest, icon.svg, icon-*.png
                                              (installable app with offline play when served over http(s))
  python3 build.py --fragment game.html    -> body fragment without <html>/<head>
                                              (for embedding into another page)

No dependencies beyond the Python 3 standard library.
"""
import hashlib
import json
import math
import pathlib
import re
import struct
import sys
import zlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src'

# Load order matters: later files use globals defined by earlier ones.
ORDER = [
    'data',       # game data: units, buildings, technologies, civilizations
    'util',       # math, seeded RNG, noise, A* pathfinding, storage helpers
    'i18n_ui',    # t(), setLang(), interface strings
    'map',        # map generator
    'sim',        # simulation core
    'cmd',        # commands (the only way UI and AI change the simulation)
    'ai',         # computer opponents
    'art_units',  # terrain texture, unit sprites
    'art_bld',    # building and resource sprites, icons
    'render',     # isometric renderer, fog, minimap
    'i18n_game',  # names and descriptions of game content
    'ui',         # menus, HUD, command card, input
    'audio',      # synthesized sound effects and generative music
    'main',       # lifecycle, main loop, save/load
]

DESCRIPTION = ('Era of Kingdoms: real-time medieval strategy game in the browser. '
               '8 civilizations, 4 ages, AI opponents, 7 languages.')


def bundle_js():
    parts = []
    for name in ORDER:
        text = (SRC / f'{name}.js').read_text(encoding='utf-8')
        text = re.sub(r"^'use strict';\s*", '', text)
        parts.append(f'// ---- {name}.js ----\n{text}')
    return "<script>\n'use strict';\n" + '\n'.join(parts) + '\n</script>\n'


def build_page(shell, script):
    marker = '<div id="app">'
    head, body = shell.split(marker, 1)
    return (
        '<!doctype html>\n'
        '<html lang="en">\n'
        '<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#0b0f1c">\n'
        f'<meta name="description" content="{DESCRIPTION}">\n'
        + HEAD_APP +
        '<style>html,body{height:100%}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
        + head.strip() + '\n'
        '</head>\n'
        '<body>\n'
        + marker + body.rstrip() + '\n'
        + script
        + '</body>\n'
        '</html>\n'
    )


# ---- installable app: icon PNGs, manifest, service worker ----
# The manifest link is not here: main.js adds it only over http(s), because on file:// fetching it is a CORS error.
HEAD_APP = (
    '<link rel="icon" href="icon.svg" type="image/svg+xml">\n'
    '<link rel="apple-touch-icon" href="icon-180.png">\n'
    '<meta name="mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-title" content="Kingdoms">\n'
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
)
ICON_SIZES = [180, 192, 512]
SS = 4  # icon samples per pixel side (4 x 4 = 16 per pixel)


def parse_icon(svg):
    """src/icon.svg may use only <rect>, <circle> and <polygon> with a solid fill, so that build.py and build.mjs
    can draw it into byte-identical PNGs. Only + - * / and sqrt are used on coordinates: they round the same way
    in Python and JavaScript."""
    svg = re.sub(r'<!--[\s\S]*?-->', '', svg)
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg)
    if not vb or vb.group(1) != vb.group(2):
        raise ValueError('src/icon.svg: viewBox must be "0 0 N N"')
    shapes = []
    for m in re.finditer(r'<(\w+)([^>]*)>', svg):
        tag = m.group(1)
        if tag in ('svg', 'title'):
            continue
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(2)))
        fill = a.get('fill', '')
        n = lambda k: float(a.get(k) or 0)
        if not re.fullmatch(r'#[0-9a-f]{6}', fill):
            raise ValueError(f'src/icon.svg: <{tag}> needs fill="#rrggbb"')
        s = {'tag': tag, 'rgb': [int(fill[i:i + 2], 16) for i in (1, 3, 5)]}
        if tag == 'rect':
            s.update(x=n('x'), y=n('y'), w=n('width'), h=n('height'))
        elif tag == 'circle':
            s.update(cx=n('cx'), cy=n('cy'), r=n('r'))
        elif tag == 'polygon':
            v = [float(p) for p in re.split(r'[\s,]+', a['points'].strip())]
            s['pts'] = [(v[i], v[i + 1]) for i in range(0, len(v) - 1, 2)]
        else:
            raise ValueError(f'src/icon.svg: <{tag}> is not supported (only rect, circle, polygon)')
        shapes.append(s)
    return {'size': int(vb.group(1)), 'shapes': shapes}


def icon_spans(s, k, y):
    """[x0, x1) pixel intervals where shape s covers the horizontal line y (pixel units; nonzero fill rule)."""
    if s['tag'] == 'rect':
        return [(s['x'] * k, (s['x'] + s['w']) * k)] if s['y'] * k <= y < (s['y'] + s['h']) * k else []
    if s['tag'] == 'circle':
        cx, dy, r = s['cx'] * k, y - s['cy'] * k, s['r'] * k
        if dy * dy >= r * r:
            return []
        d = math.sqrt(r * r - dy * dy)
        return [(cx - d, cx + d)]
    xs, pts = [], s['pts']
    for i in range(len(pts)):
        x0, y0 = pts[i][0] * k, pts[i][1] * k
        x1, y1 = pts[(i + 1) % len(pts)][0] * k, pts[(i + 1) % len(pts)][1] * k
        if y0 <= y < y1 or y1 <= y < y0:
            xs.append((x0 + (y - y0) * (x1 - x0) / (y1 - y0), 1 if y1 > y0 else -1))
    xs.sort(key=lambda c: c[0])
    out, w, start = [], 0, 0
    for x, d in xs:
        if w == 0:
            start = x
        w += d
        if w == 0:
            out.append((start, x))
    return out


def draw_icon(icon, size):
    """RGB pixels of the icon at size x size, each row starting with PNG filter byte 0."""
    k, W, N = size / icon['size'], size * SS, SS * SS
    rgb = [s['rgb'] for s in icon['shapes']]
    raw, memo = bytearray(), {}
    for py in range(size):
        rows = []
        for j in range(SS):
            row = bytearray(b'\xff') * W
            for si, s in enumerate(icon['shapes']):
                for x0, x1 in icon_spans(s, k, py + (j + 0.5) / SS):
                    a = min(W, max(0, math.ceil(x0 * SS - 0.5)))
                    b = min(W, max(0, math.ceil(x1 * SS - 0.5)))
                    if b > a:
                        row[a:b] = bytes((si,)) * (b - a)
            if 255 in row:
                raise ValueError('src/icon.svg must cover the whole square (the icon has no transparency)')
            rows.append(bytes(row))
        raw.append(0)
        for px in range(0, W, SS):
            key = b''.join(r[px:px + SS] for r in rows)
            pixel = memo.get(key)
            if pixel is None:
                c = [0, 0, 0]
                for v in key:
                    c[0] += rgb[v][0]
                    c[1] += rgb[v][1]
                    c[2] += rgb[v][2]
                pixel = memo[key] = bytes((v * 2 + N) // (2 * N) for v in c)
            raw += pixel
    return bytes(raw)


# zlib stream with one fixed-Huffman deflate block. zlib.compress is not used because Python and Node ship
# different zlib builds that compress to different bytes; this greedy encoder gives the same bytes in both.
LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073,
             4097, 6145, 8193, 12289, 16385, 24577]
DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]


def zlib_stream(data, dists):
    out = bytearray(b'\x78\x01')
    acc = nb = 0

    def bits(v, n):
        nonlocal acc, nb
        acc |= v << nb
        nb += n
        while nb >= 8:
            out.append(acc & 255)
            acc >>= 8
            nb -= 8

    def code(c, n):  # Huffman codes are stored most significant bit first
        r = 0
        for _ in range(n):
            r = (r << 1) | (c & 1)
            c >>= 1
        bits(r, n)

    def sym(v):
        if v < 144:
            code(0x30 + v, 8)
        elif v < 256:
            code(0x190 + v - 144, 9)
        elif v < 280:
            code(v - 256, 7)
        else:
            code(0xc0 + v - 280, 8)

    def find(base, v):
        i = len(base) - 1
        while base[i] > v:
            i -= 1
        return i

    def match(pos, d):  # longest l <= 258 with data[pos:pos + l] == data[pos - d:pos - d + l]
        lo, hi = 0, min(258, len(data) - pos)
        if data[pos:pos + hi] == data[pos - d:pos - d + hi]:
            return hi
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if data[pos:pos + mid] == data[pos - d:pos - d + mid]:
                lo = mid
            else:
                hi = mid
        return lo

    bits(1, 1)  # last block
    bits(1, 2)  # fixed Huffman codes
    pos = 0
    while pos < len(data):
        length = dist = 0
        for d in dists:
            if d <= pos:
                l = match(pos, d)
                if l > length:
                    length, dist = l, d
        if length < 3:
            sym(data[pos])
            pos += 1
            continue
        li, di = find(LEN_BASE, length), find(DIST_BASE, dist)
        sym(257 + li)
        bits(length - LEN_BASE[li], LEN_EXTRA[li])
        code(di, 5)
        bits(dist - DIST_BASE[di], DIST_EXTRA[di])
        pos += length
    sym(256)
    if nb:
        out.append(acc & 255)
    return bytes(out) + struct.pack('>I', zlib.adler32(data))


def png(size, raw):
    def chunk(kind, body):
        t = kind + body
        return struct.pack('>I', len(body)) + t + struct.pack('>I', zlib.crc32(t))
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib_stream(raw, [3, size * 3 + 1])) + chunk(b'IEND', b''))


def app_files(page):
    """Every file of the installable app, index.html first. The service worker's cache name is a hash of all of
    them, so each deploy changes sw.js and the browser downloads the new version."""
    files = [('index.html', page.encode('utf-8'))]
    # read_text gives \n line endings, like readSrc() in build.mjs, so a CRLF checkout builds the same files
    manifest = (SRC / 'manifest.webmanifest').read_text(encoding='utf-8')
    json.loads(manifest)
    files.append(('manifest.webmanifest', manifest.encode('utf-8')))
    svg = (SRC / 'icon.svg').read_text(encoding='utf-8')
    icon = parse_icon(svg)
    files.append(('icon.svg', svg.encode('utf-8')))
    for size in ICON_SIZES:
        files.append((f'icon-{size}.png', png(size, draw_icon(icon, size))))
    sw = (SRC / 'sw.js').read_text(encoding='utf-8')
    h = hashlib.sha256()
    for _, data in files:
        h.update(data)
    h.update(sw.encode('utf-8'))
    files.append(('sw.js', sw.replace('%BUILD%', h.hexdigest()[:12]).encode('utf-8')))
    return files


def main(argv):
    shell = (SRC / 'shell.html').read_text(encoding='utf-8')
    script = bundle_js()
    if '--fragment' in argv:
        i = argv.index('--fragment')
        out = pathlib.Path(argv[i + 1]) if i + 1 < len(argv) else ROOT / 'game-fragment.html'
        outputs = [(out, (shell.rstrip() + '\n' + script).encode('utf-8'))]
    else:
        outputs = [(ROOT / name, data) for name, data in app_files(build_page(shell, script))]
    for out, data in outputs:
        out.write_bytes(data)
        print(f'Wrote {out} ({len(data) // 1024} KB)')


if __name__ == '__main__':
    main(sys.argv[1:])
