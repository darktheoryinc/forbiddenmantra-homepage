#!/usr/bin/env node
// Wix package: serves the Wix build from one origin and embeds it in an iframe from ANOTHER origin (as Wix does with "Embed a site"),
// then checks that images, scripts, search, librarian, language menu, internal navigation and affiliate links all work inside the frame.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, launch } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test/out-wix');
execFileSync('node', [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, env: { ...process.env, FM_WIX: '1', FM_OUT: 'test/out-wix' }, stdio: 'ignore' });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json', '.txt': 'text/plain' };
const serve = (root, port) => new Promise((res) => { const s = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end('nf'); } r.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(port, '127.0.0.1', () => res(s)); });
const wrap = path.join(ROOT, 'test/fixtures/wix-wrap'); fs.mkdirSync(wrap, { recursive: true });
const frameHtml = (sandbox) => `<!doctype html><html><body style="margin:0"><iframe id="f" src="http://127.0.0.1:8811/index.html" ${sandbox ? `sandbox="${sandbox}"` : ''} style="border:0;width:100%;height:100vh" title="Forbidden Mantra Press"></iframe></body></html>`;
fs.writeFileSync(path.join(wrap, 'plain.html'), frameHtml('')); fs.writeFileSync(path.join(wrap, 'sandbox.html'), frameHtml('allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox'));
const s1 = await serve(OUT, 8811), s2 = await serve(wrap, 8812);
const served = fs.readFileSync(path.join(OUT, 'assets/partner/nvidia-inception-program-badge-rgb-for-screen.svg'), 'utf8');
ok(/76b900/i.test(served) && served.length === 13114 && Buffer.compare(fs.readFileSync(path.join(OUT, 'assets/partner/nvidia-inception-program-badge-rgb-for-screen.svg')), fs.readFileSync(path.join(ROOT, 'assets-src/partner/nvidia-inception-program-badge-rgb-for-screen.svg'))) === 0, 'the badge in the Wix package is the official full-colour file, byte-identical (green #76b900, 13,114 bytes)');
const browser = await launch();
if (browser) for (const [variant, page] of [['iframe from another origin', 'plain.html'], ['sandboxed iframe (no storage)', 'sandbox.html']]) for (const [name, vp, mobile] of [['desktop', { width: 1366, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile }); const pg = await ctx.newPage(); const errs = [], bad = [], msgs = [];
  pg.on('pageerror', (e) => errs.push(String(e))); pg.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1')) bad.push(r.status() + ' ' + r.url()); });
  await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (x) => x.abort());
  await pg.addInitScript(() => { window.__m = []; window.addEventListener('message', (e) => { if (e.data && e.data.type) window.__m.push(e.data); }); });
  await pg.goto(`http://127.0.0.1:8812/${page}`); await pg.waitForTimeout(1200);
  const T = `[${variant}, ${name}]`, fr = pg.frameLocator('#f'), frame = pg.frames().find((f) => f.url().includes('8811'));
  ok(!!frame && (await fr.locator('h1').first().textContent()).includes('Forbidden'), `${T} bookstore loads inside the frame`);
  const imgs = await frame.evaluate(() => [...document.images].filter((i) => i.getBoundingClientRect().width > 0 || i.currentSrc).map((i) => [i.currentSrc.split('/').pop(), i.complete && i.naturalWidth > 0]));
  await frame.evaluate(() => document.querySelector('.promo-band').scrollIntoView()); await pg.waitForTimeout(500);
  const imgs2 = await frame.evaluate(() => [...document.images].map((i) => [i.currentSrc.split('/').pop(), i.complete && i.naturalWidth > 0]));
  ok(['iosutra-wellness-ai.webp', 'iosutra-inception-member.webp', 'nvidia-inception-program-badge-rgb-for-screen.svg'].every((n) => imgs2.some(([f, good]) => f === n && good)), `${T} IOSutra artwork, IOSutra panel and the full-colour NVIDIA badge all load`);
  ok(await frame.evaluate(() => document.documentElement.classList.contains('in-wix-frame')) && (await pg.evaluate(() => window.__m.some((m) => m.type === 'setHeight' && m.height > 500))), `${T} embed helper reports the page height to Wix in the original setHeight format`);
  // search + librarian inside the frame
  await frame.evaluate(() => window.scrollTo(0, 0)); await fr.locator('.hero-search input').click(); await pg.keyboard.type('tarot', { delay: 40 }); await pg.waitForTimeout(1500);
  const lib = await frame.evaluate(() => ({ open: !document.querySelector('.lib-panel').hidden, titles: [...document.querySelectorAll('.lib-list a')].map((a) => a.textContent) }));
  ok(lib.open && lib.titles.length > 0, `${T} typing a search opens the librarian and she finds real books (${lib.titles.slice(0, 2).join('; ')})`);
  // affiliate + external links
  const ext = await frame.evaluate(() => [...document.querySelectorAll('a[href^="http"]')].filter((a) => !a.href.includes('127.0.0.1')).map((a) => [a.target, a.href]));
  ok(ext.length > 0 && ext.every(([t]) => t === '_blank'), `${T} every external link (IOSutra, NVIDIA, partners) opens in a new tab, so Amazon/IOSutra are never framed (${ext.length} links)`);
  // internal navigation stays in the frame and the book page carries the tagged Amazon link
  await frame.goto('http://127.0.0.1:8811/books/the-power-of-now/index.html'); await pg.waitForTimeout(500);
  const amz = await frame.evaluate(() => [...document.querySelectorAll('a[data-track=buy]')].map((a) => [a.target, a.rel, a.href]));
  ok(amz.length > 0 && amz.every(([t, r, h]) => t === '_blank' && /sponsored/.test(r) && /[?&]tag=darktheoryinc-20/.test(h)), `${T} book page: ${amz.length} Amazon buttons, new tab, sponsored, tag=darktheoryinc-20`);
  await frame.goto('http://127.0.0.1:8811/search/index.html?q=wicca'); await pg.waitForTimeout(1500);
  ok((await frame.evaluate(() => document.querySelectorAll('[data-results] .card').length)) > 0, `${T} the search page works inside the frame (?q=wicca)`);
  await frame.goto('http://127.0.0.1:8811/index.html'); await pg.waitForTimeout(400);
  await fr.locator('.lang-btn').click(); await fr.locator('[data-ui=de]').click(); await pg.waitForTimeout(300);
  ok(await frame.evaluate(() => document.documentElement.lang === 'de'), `${T} the language dropdown switches the interface language`);
  ok(bad.length === 0, `${T} no failed asset requests${bad.length ? ': ' + bad[0] : ''}`);
  ok(errs.length === 0, `${T} no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser?.close(); s1.close(); s2.close();
fs.rmSync(OUT, { recursive: true, force: true }); fs.rmSync(wrap, { recursive: true, force: true });
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} Wix-embed checks passed`);
process.exit(state.fails ? 1 : 0);
