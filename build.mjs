#!/usr/bin/env node
// Era of Kingdoms — build script (Node.js alternative to build.py, same output).
//
//   node build.mjs                        -> index.html  (stand-alone page)
//   node build.mjs --fragment game.html   -> body fragment without <html>/<head>
//
// No npm packages needed. Requires Node 16 or newer.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const ORDER = ['data', 'util', 'i18n_ui', 'map', 'sim', 'cmd', 'ai', 'art_units', 'art_bld', 'render', 'i18n_game', 'ui', 'audio', 'main'];
const DESCRIPTION = 'Era of Kingdoms: real-time medieval strategy game in the browser. 8 civilizations, 4 ages, AI opponents, 7 languages.';

function bundleJs() {
  const parts = ORDER.map(name => {
    const text = readFileSync(join(SRC, `${name}.js`), 'utf8').replace(/^'use strict';\s*/, '');
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
    + '<style>html,body{height:100%}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    + head.trim() + '\n</head>\n<body>\n'
    + marker + body.trimEnd() + '\n'
    + script
    + '</body>\n</html>\n';
}

const argv = process.argv.slice(2);
const shell = readFileSync(join(SRC, 'shell.html'), 'utf8');
const script = bundleJs();
let out, content;
const f = argv.indexOf('--fragment');
if (f >= 0) { out = resolve(argv[f + 1] || join(ROOT, 'game-fragment.html')); content = shell.trimEnd() + '\n' + script; }
else { out = join(ROOT, 'index.html'); content = buildPage(shell, script); }
writeFileSync(out, content, 'utf8');
console.log(`Wrote ${out} (${Math.floor(Buffer.byteLength(content) / 1024)} KB)`);
