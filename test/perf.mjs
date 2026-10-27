#!/usr/bin/env node
// Load/latency measurements for a built site (typically the 25k SYNTHETIC build):
//   FM_DATA=test/fixtures/perf/data FM_OUT=test/out-perf node scripts/build.mjs && node test/perf.mjs test/out-perf [--json]
// Serves the site over local HTTP with gzip (like a CDN would) and drives Chromium at desktop and at a throttled mobile profile
// (CPU 4x slower, 1.6 Mbit/s down, 150 ms RTT). Timings are wall-clock from the user action to the result line updating.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.resolve(ROOT, process.argv[2] ?? 'test/out-perf');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const gz = new Map();
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(SITE, p); if (!f.startsWith(SITE) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  if (!gz.has(f)) gz.set(f, zlib.gzipSync(fs.readFileSync(f), { level: 6 }));
  const b = gz.get(f); res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': b.length, 'cache-control': 'public, max-age=3600' }); res.end(b);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch(); if (!browser) process.exit(1);
const idxDir = path.join(SITE, 'assets/idx'); const chunkFiles = fs.readdirSync(idxDir).filter((f) => /^c\d+\.js$/.test(f));
const gzSize = (f) => zlib.gzipSync(fs.readFileSync(f), { level: 6 }).length;
const sizes = {
  htmlGz: Object.fromEntries(['books/index.html', 'books/page/2/index.html', 'search/index.html', 'index.html', 'topics/fantasy/index.html'].filter((f) => fs.existsSync(path.join(SITE, f))).map((f) => [f, gzSize(path.join(SITE, f))])),
  searchIndex: { files: chunkFiles.length, rawBytes: chunkFiles.reduce((n, f) => n + fs.statSync(path.join(idxDir, f)).size, 0), gzipBytes: chunkFiles.reduce((n, f) => n + gzSize(path.join(idxDir, f)), 0) },
};
// pick queries from the data itself
const cat = JSON.parse(fs.readFileSync(path.resolve(ROOT, process.env.FM_DATA ?? 'data', 'catalogue.json'), 'utf8'));
const dynW = cat.works.find((w) => w.provenance?.synthetic) ?? cat.works[cat.works.length - 1];
const word = (w) => w.title.split(' ')[0];
const typo = (s) => s.length > 5 ? s.slice(0, 2) + s[3] + s[2] + s.slice(4) : s;
const mid = cat.works[Math.floor(cat.works.length / 2)];
const Q = { 'title (full)': mid.title, 'one word': word(mid).toLowerCase(), isbn: mid.editions[0].isbn13, typo: typo(word(dynW)), 'no match': 'zzzqxv' };
const out = { works: cat.works.length, sizes, runs: {} };
for (const [name, profile] of [['desktop', { viewport: { width: 1366, height: 900 }, cpu: 1, net: null }], ['mobile (4x CPU, 1.6 Mbit/s, 150 ms)', { viewport: { width: 390, height: 844 }, cpu: 4, net: { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8 } }]]) {
  const ctx = await browser.newContext({ viewport: profile.viewport, isMobile: profile.viewport.width < 500 }); const pg = await ctx.newPage();
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const cdp = await ctx.newCDPSession(pg);
  if (profile.net) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.net.latency, downloadThroughput: profile.net.down, uploadThroughput: profile.net.up }); }
  if (profile.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  const r = {}; const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const settled = () => pg.waitForFunction(() => { const c = document.querySelector('[data-count]'); return c && c.textContent && !/Loading/i.test(c.textContent); }, null, { timeout: 60000 });
  const nav = async (p) => { const t = Date.now(); await pg.goto(base + p, { waitUntil: 'load' }); const m = await pg.evaluate(() => { const n = performance.getEntriesByType('navigation')[0], fcp = performance.getEntriesByName('first-contentful-paint')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null }; }); return { ...m, wall: Date.now() - t }; };
  r.homeLoad = await nav('index.html');
  r.browsePageLoad = await nav('books/index.html');
  r.browsePage2Load = await nav('books/page/2/index.html');
  r.topicLoad = fs.existsSync(path.join(SITE, 'topics/fantasy/index.html')) ? await nav('topics/fantasy/index.html') : null;
  // cold search: first query on a fresh page loads the manifest + every chunk
  await pg.goto(base + 'search/index.html'); const bytes0 = await cdp.send('Performance.enable').then(() => 0);
  let t = Date.now(); await pg.fill('.filters input[name=q]', Q['one word']); const firstResults = pg.waitForSelector('[data-results] .card', { timeout: 60000 }).then(() => Date.now() - t); await settled(); r.searchColdFirstQueryMs = Date.now() - t; r.searchColdFirstResultsVisibleMs = await firstResults;
  r.searchColdCount = (await pg.locator('[data-count]').textContent()).trim();
  const heap = await cdp.send('Runtime.getHeapUsage'); r.jsHeapMBAfterIndexLoad = +(heap.usedSize / 1048576).toFixed(1);
  r.search = {};
  for (const [label, q] of Object.entries(Q)) { await pg.fill('.filters input[name=q]', ''); await pg.waitForTimeout(250); t = Date.now(); await pg.fill('.filters input[name=q]', q); await pg.waitForFunction((qq) => { const c = document.querySelector('[data-count]'); return c && /books? shown|Showing|^0 books/i.test(c.textContent) && document.querySelector('[data-results]') && !/Loading/i.test(c.textContent); }, q, { timeout: 60000 }); await pg.waitForTimeout(160); r.search[label] = { ms: Date.now() - t - 160 + 0, result: (await pg.locator('[data-count]').textContent()).trim() }; }
  // language + format filters over the whole index
  await pg.fill('.filters input[name=q]', ''); await pg.waitForTimeout(250); t = Date.now(); await pg.selectOption('.filters select[name=lang]', 'es'); await pg.waitForFunction(() => /books? shown|Showing|^0 books/i.test(document.querySelector('[data-count]').textContent)); r.filterLanguageMs = Date.now() - t; r.filterLanguageResult = (await pg.locator('[data-count]').textContent()).trim();
  await pg.selectOption('.filters select[name=lang]', ''); await pg.waitForTimeout(250);
  t = Date.now(); await pg.selectOption('.filters select[name=subject]', 'fantasy'); await pg.waitForFunction(() => /books? shown|Showing/i.test(document.querySelector('[data-count]').textContent)); r.filterSubjectMs = Date.now() - t;
  await pg.selectOption('.filters select[name=subject]', '');
  t = Date.now(); await pg.fill('.filters input[name=q]', word(mid).toLowerCase()); await pg.waitForTimeout(300); const before = await pg.locator('[data-results] .card').count(); if (await pg.isVisible('[data-more]')) { t = Date.now(); await pg.click('[data-more]'); await pg.waitForFunction((b) => document.querySelectorAll('[data-results] .card').length > b, before); r.showMoreMs = Date.now() - t; }
  // dynamic book view
  const dyn = cat.works.find((w) => !fs.existsSync(path.join(SITE, 'books', w.slug, 'index.html')));
  if (dyn) { t = Date.now(); await pg.goto(base + 'book/index.html?s=' + encodeURIComponent(dyn.slug)); await pg.waitForSelector('h1'); r.dynamicBookViewMs = Date.now() - t; }
  r.jsErrors = errs.length;
  out.runs[name] = r; await ctx.close();
}
await browser.close(); server.close();
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1)); else console.log(JSON.stringify(out, null, 1));
