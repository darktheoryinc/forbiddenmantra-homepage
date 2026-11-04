#!/usr/bin/env node
// Builds the redesigned homepage embed from the ORIGINAL file (../forbiddenmantra-homepage.html, never edited).
//   node redesign/build.mjs [--library-base https://...] [--payg-url https://...] [--out path]
// The original markup is kept byte for byte except for three stray Markdown fence lines ("```html" / "```") that were pasted into the file and would
// print as visible text inside the Wix HTML element. Everything new is added with data-fm-new so a test can strip it and prove the original is unchanged.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const rd = (p) => fs.readFileSync(path.join(HERE, p), 'utf8');
const b64 = (p, mime) => `data:${mime};base64,${fs.readFileSync(path.join(HERE, p)).toString('base64')}`;
const cfg = JSON.parse(rd('config.json'));
if (arg('library-base')) cfg.libraryBaseUrl = arg('library-base');
if (arg('payg-url')) cfg.iosutraPaygUrl = arg('payg-url');
const { _doc, ...runtimeCfg } = cfg;

const original = fs.readFileSync(path.join(ROOT, 'forbiddenmantra-homepage.html'), 'utf8');
let html = original.split('\n').filter((l) => !/^```(html)?\s*$/.test(l)).join('\n'); // only the pasted fence lines are removed
const must = (s, label) => { if (!html.includes(s)) { console.error(`anchor not found: ${label}`); process.exit(1); } };
const swap = (anchor, withText, label) => { must(anchor, label); html = html.replace(anchor, withText); };

const assets = { '{{ATMA_FACE}}': b64('assets-src/atma-face.webp', 'image/webp'), '{{IOSUTRA_LOGO}}': b64('assets-src/iosutra-logo-panel.webp', 'image/webp'), '{{NVIDIA_BADGE}}': b64('assets-src/nvidia-inception-badge.svg', 'image/svg+xml') };
const fill = (t) => Object.entries(assets).reduce((s, [k, v]) => s.split(k).join(v), t);

swap('</head>', `<style id="fm-redesign" data-fm-new>\n${rd('theme.css')}</style>\n</head>`, 'head end');
const blog = '<li><a href="https://www.forbiddenmantra.com/blog" target="_blank">Blog</a></li>\n';
swap(blog, blog + rd('nav-item.html'), 'Blog nav item');
swap('</nav>\n', '</nav>\n' + fill(rd('header.html')), 'nav end');
swap('</footer>', fill(rd('footer-notice.html')) + '</footer>', 'footer end');
swap('</body>', `<script data-fm-new>window.FM_CONFIG=${JSON.stringify(runtimeCfg)};</script>\n<script data-fm-new>\n${rd('embed.js')}</script>\n</body>`, 'body end');

const out = arg('out', path.join(HERE, 'dist/forbiddenmantra-homepage.redesign.html'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(ROOT, out)} (${Buffer.byteLength(html)} bytes, sha256 ${crypto.createHash('sha256').update(html).digest('hex')})`);
console.log(`original unchanged: sha256 ${crypto.createHash('sha256').update(original).digest('hex')}`);
