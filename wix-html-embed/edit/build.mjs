#!/usr/bin/env node
// Builds forbiddenmantra-store-edited.html from a COPY of the verbatim original (../forbiddenmantra-store-original.html, never modified).
// Only three kinds of change are made: (1) colour values of the existing theme variables, (2) the Atma Library Browser, (3) the two-logo row.
//   node build.mjs [--library-url https://...] [--out file]      (--library-url is for local testing only)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const orig = fs.readFileSync(path.join(ROOT, 'forbiddenmantra-store-original.html'), 'utf8');
let html = orig;
const must = (c, m) => { if (!c) { console.error('ANCHOR PROBLEM: ' + m); process.exit(1); } };

// ---- 1. theme: new VALUES for existing variables (names, order, layout and every other rule untouched) ----
const LIGHT = { '--color-bg': '#f7f1e4', '--color-surface': '#fffdf8', '--color-surface-2': '#ece9d8', '--color-border': 'rgba(176,141,77,.32)', '--color-text': '#1d3a35', '--color-text-muted': '#4f6862', '--color-primary': '#165c48', '--color-primary-dark': '#0f4636', '--color-primary-soft': '#d9e9df', '--shadow-sm': '0 4px 18px rgba(24,63,59,.10)', '--shadow-md': '0 18px 42px rgba(24,63,59,.18)' };
const DARK = { '--color-bg': '#0f2c29', '--color-surface': '#143632', '--color-surface-2': '#1a403b', '--color-border': 'rgba(216,180,107,.28)', '--color-text': '#f1e9d6', '--color-text-muted': '#c3d4cd', '--color-primary': '#d8b46b', '--color-primary-dark': '#efd79c', '--color-primary-soft': '#1f4a42', '--shadow-sm': '0 1px 2px rgba(0,0,0,.25)', '--shadow-md': '0 8px 28px rgba(0,0,0,.4)' };
const changes = [];
function themeBlock(startMarker, values) {
  const s = html.indexOf(startMarker); must(s > -1, startMarker);
  const e = html.indexOf('}', s); let block = html.slice(s, e);
  for (const [name, val] of Object.entries(values)) {
    const re = new RegExp(`(^|\\n)(\\s*)${name.replace(/[-]/g, '\\-')}:([^;]+);`);
    const m = block.match(re); must(m, `${name} in ${startMarker}`);
    const oldLine = `${m[2]}${name}:${m[3]};`, newLine = `${m[2]}${name}:${val};`;
    block = block.replace(oldLine, newLine); changes.push({ old: oldLine, new: newLine, in: startMarker.trim() });
  }
  html = html.slice(0, s) + block + html.slice(e);
}
themeBlock(':root, [data-theme="light"] {', LIGHT);
themeBlock('[data-theme="dark"] {', DARK);
const dtOld = '[data-theme="dark"] .topbar{background:rgba(29,26,23,.88)}', dtNew = '[data-theme="dark"] .topbar{background:rgba(20,54,50,.9)}';
must(html.split(dtOld).length === 2, 'dark topbar rule'); html = html.replace(dtOld, dtNew); changes.push({ old: dtOld, new: dtNew, in: 'dark topbar colour' });

// ---- 2 + 3. additions (every added element carries data-fm-new) ----
const rd = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');
const b64 = (f, mime) => `data:${mime};base64,${fs.readFileSync(path.join(HERE, 'assets-src', f)).toString('base64')}`;
let block = rd('fm-atma.html').replace('{{ATMA_FACE}}', b64('atma-face.webp', 'image/webp')).replace('{{NVIDIA_BADGE}}', b64('nvidia-inception-badge.svg', 'image/svg+xml')).replace('{{IOSUTRA_LOGO}}', b64('iosutra-logo-panel.webp', 'image/webp'));
let js = rd('fm-atma.js'); if (arg('library-url')) js = js.replace('var FM_LIBRARY_URL = "";', `var FM_LIBRARY_URL = ${JSON.stringify(arg('library-url'))};`);
const inserts = [];
const insertBefore = (anchor, text, label) => { must(html.split(anchor).length === 2, `unique anchor: ${label}`); html = html.replace(anchor, text + anchor); inserts.push({ label, text }); };
insertBefore('</head>', `<style data-fm-new>\n${rd('fm-atma.css')}</style>\n`, 'style block');
insertBefore('<section class="search-strip container" id="topics">', block, 'Atma browser and logo row');
insertBefore('</body>', `<script data-fm-new>\n${js}</script>\n`, 'launch switch script');

const out = arg('out', path.join(ROOT, 'forbiddenmantra-store-edited.html'));
fs.writeFileSync(out, html);
fs.writeFileSync(path.join(HERE, 'changes.json'), JSON.stringify({ replacedLines: changes }, null, 1));
console.log(`wrote ${path.relative(ROOT, out)} (${Buffer.byteLength(html)} bytes, sha256 ${crypto.createHash('sha256').update(html).digest('hex')}); ${changes.length} theme values changed, ${inserts.length} blocks added`);
console.log(`original sha256 ${crypto.createHash('sha256').update(orig).digest('hex')}`);
