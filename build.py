#!/usr/bin/env python3
"""
Era of Kingdoms — build script.

Bundles every module in src/ into one self-contained HTML file.

  python3 build.py                         -> index.html  (stand-alone page: open it or host it)
  python3 build.py --fragment game.html    -> body fragment without <html>/<head>
                                              (for embedding into another page)

No dependencies beyond the Python 3 standard library.
"""
import pathlib
import re
import sys

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
        '<style>html,body{height:100%}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
        + head.strip() + '\n'
        '</head>\n'
        '<body>\n'
        + marker + body.rstrip() + '\n'
        + script
        + '</body>\n'
        '</html>\n'
    )


def main(argv):
    shell = (SRC / 'shell.html').read_text(encoding='utf-8')
    script = bundle_js()
    if '--fragment' in argv:
        i = argv.index('--fragment')
        out = pathlib.Path(argv[i + 1]) if i + 1 < len(argv) else ROOT / 'game-fragment.html'
        content = shell.rstrip() + '\n' + script
    else:
        out = ROOT / 'index.html'
        content = build_page(shell, script)
    out.write_text(content, encoding='utf-8')
    print(f'Wrote {out} ({len(content.encode("utf-8")) // 1024} KB)')


if __name__ == '__main__':
    main(sys.argv[1:])
