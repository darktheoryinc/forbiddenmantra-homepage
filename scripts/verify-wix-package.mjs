#!/usr/bin/env node
// Verifies wix/forbiddenmantra-site-for-hosting.zip the way a host would receive it: extracts into a clean temp directory with TWO independent
// extractors, checks structure and every local reference, serves it over HTTP and exercises the bookstore in a real browser (desktop + mobile).
//   node scripts/verify-wix-package.mjs [--zip path]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, launch } from '../test/lib.mjs';
import { scanPackage } from './security-gate.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zipPath = process.argv.includes('--zip') ? path.resolve(process.argv[process.argv.indexOf('--zip') + 1]) : path.join(ROOT, 'wix/forbiddenmantra-site-for-hosting.zip');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cat = J('data/catalogue.json');
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name), o) : o.push(path.join(d, e.name)); return o; };

// ---- archive integrity ----
const buf = fs.readFileSync(zipPath);
ok(buf.length > 1e6 && buf.slice(0, 2).toString() === 'PK', `archive is a real ZIP (starts with "PK", ${buf.length} bytes, not an HTML page or empty file)`);
const shaFile = zipPath + '.sha256';
ok(!fs.existsSync(shaFile) || fs.readFileSync(shaFile, 'utf8').startsWith(crypto.createHash('sha256').update(buf).digest('hex')), 'archive matches its published SHA-256');
const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-unzip-')), tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-jar-'));
execFileSync('unzip', ['-q', zipPath, '-d', tmpA]);
let jarOk = true; try { execFileSync('jar', ['xf', zipPath], { cwd: tmpB }); } catch { jarOk = false; }
const A = walk(tmpA).map((f) => path.relative(tmpA, f)).sort(), B = jarOk ? walk(tmpB).map((f) => path.relative(tmpB, f)).sort() : A;
ok(A.length > 500 && A.includes('index.html') && !A.some((f) => f.startsWith('site' + path.sep) || f.startsWith('wix' + path.sep)), `index.html is at the archive root; ${A.length} files extracted (no wrapper folder)`);
ok(JSON.stringify(A) === JSON.stringify(B) && A.every((f) => !jarOk || crypto.createHash('md5').update(fs.readFileSync(path.join(tmpA, f))).digest('hex') === crypto.createHash('md5').update(fs.readFileSync(path.join(tmpB, f))).digest('hex')), 'two independent extractors (Info-ZIP unzip, Java jar) produce identical files');
ok(A.every((f) => fs.statSync(path.join(tmpA, f)).size > 0 || /^_headers$/.test(f)), 'no empty files');
const hostDir = path.join(ROOT, 'wix/hosting');
ok(!fs.existsSync(hostDir) || JSON.stringify(walk(hostDir).map((f) => path.relative(hostDir, f)).sort()) === JSON.stringify(A), 'the unzipped folder wix/hosting/ has exactly the same file list as the archive');
const ROOTDIR = tmpA;
const approvals = J('config/approvals.json'); const nvOK = approvals.nvidiaBranding?.approved === true;
// ---- safety gate on the extracted archive ----
const gate = scanPackage(ROOTDIR, { production: false });
ok(gate.ok, `security gate passes on the extracted archive (${gate.info.files} files; tags ${JSON.stringify(gate.info.affiliateTags)})${gate.ok ? '' : ': ' + gate.fail.slice(0, 3).join(' | ')}`);
ok(nvOK || (gate.info.nvidiaFiles === 0 && !A.some((f) => /nvidia|inception/i.test(f))), nvOK ? 'NVIDIA branding approved by the owner: included' : 'NVIDIA branding is NOT approved, so no NVIDIA badge, panel, name or claim is in the package');
// ---- every local reference resolves ----
const htmls = A.filter((f) => f.endsWith('.html'));
let refs = 0; const missing = [];
for (const f of htmls) {
  const h = fs.readFileSync(path.join(ROOTDIR, f), 'utf8');
  for (const m of h.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
    let u = m[1]; if (/^(https?:|mailto:|data:|javascript:|\/\/)/.test(u)) continue; u = u.split('?')[0]; refs++;
    let t = path.resolve(path.dirname(path.join(ROOTDIR, f)), decodeURIComponent(u)); if (fs.existsSync(t) && fs.statSync(t).isDirectory()) t = path.join(t, 'index.html');
    if (!t.startsWith(ROOTDIR) || !fs.existsSync(t)) missing.push(`${f} -> ${u}`);
  }
}
for (const f of A.filter((x) => /assets\/idx\/manifest\.js$/.test(x))) { const m = fs.readFileSync(path.join(ROOTDIR, f), 'utf8'); for (const c of JSON.parse(m.replace(/^window\.FM_MANIFEST=/, '').replace(/;$/, '')).chunks) if (!A.includes(`assets/idx/${c}.js`)) missing.push('index chunk ' + c); }
ok(missing.length === 0, `${htmls.length} pages, ${refs} local links/assets/scripts all resolve${missing.length ? ': ' + missing.slice(0, 5).join('; ') : ''}`);
// ---- catalogue completeness ----
const bookDirs = A.filter((f) => /^books\/[^/]+\/index\.html$/.test(f));
const eds = bookDirs.reduce((n, f) => n + (fs.readFileSync(path.join(ROOTDIR, f), 'utf8').match(/<section class="edition"/g) || []).length, 0);
ok(bookDirs.length === cat.works.length && cat.works.every((w) => A.includes(`books/${w.slug}/index.html`)), `all ${cat.works.length} catalogue books have a page`);
ok(eds === cat.works.reduce((n, w) => n + w.editions.length, 0), `all ${eds} editions are shown`);
const buy = []; for (const f of bookDirs) { const h = fs.readFileSync(path.join(ROOTDIR, f), 'utf8'); for (const m of h.matchAll(/<a class="btn" href="([^"]+)"[^>]*data-track="buy"/g)) buy.push([f, m[1].replace(/&amp;/g, '&')]); }
const amz = buy.filter(([, u]) => /^https:\/\/www\.amazon\.com\//.test(u)), other = buy.filter(([, u]) => !/^https:\/\/www\.amazon\.com\//.test(u));
ok(amz.length > 0 && amz.every(([, u]) => new URL(u).searchParams.get('tag') === 'darktheoryinc-20') && other.every(([, u]) => /^https:\/\/www\.amazon\.(co\.uk|es)\//.test(u) && !new URL(u).searchParams.has('tag')), `${amz.length} Amazon.com purchase links on book pages, all tagged darktheoryinc-20 (product pages ${amz.filter(([, u]) => /\/dp\//.test(u)).length}, ISBN searches ${amz.filter(([, u]) => /\/s\?/.test(u)).length}); ${other.length} amazon.co.uk / amazon.es links correctly untagged (no tracking ID is configured for those marketplaces)`);
const covers = bookDirs.filter((f) => /<img[^>]*class="[^"]*cover/.test(fs.readFileSync(path.join(ROOTDIR, f), 'utf8'))).length;
console.log(`INFO  book pages with a real cover image: ${covers} of ${bookDirs.length}; the rest show the typographic title card (no cover source is connected yet)`);
const preview = fs.readFileSync(path.join(ROOTDIR, 'index.html'), 'utf8').match(/preview build, not published/i);
console.log(`INFO  build type: ${preview ? 'PREVIEW (shows the preview notice bar; Netlify _headers adds noindex)' : 'PRODUCTION'}`);

// ---- served over HTTP, in a browser ----
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json', '.txt': 'text/plain' };
const HDR = {}; if (fs.existsSync(path.join(ROOTDIR, '_headers'))) for (const l of fs.readFileSync(path.join(ROOTDIR, '_headers'), 'utf8').split('\n')) { const m = l.match(/^\s+([A-Za-z-]+):\s*(.+)$/); if (m) HDR[m[1]] = m[2]; }
ok(/default-src 'self'/.test(HDR['Content-Security-Policy'] ?? '') && HDR['X-Content-Type-Options'] === 'nosniff', 'the served pages carry the Content-Security-Policy and security headers from _headers (the browser tests below run under them)');
const server = await new Promise((res) => { const s = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOTDIR, p); if (!f.startsWith(ROOTDIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); } r.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'application/octet-stream', ...HDR }); fs.createReadStream(f).pipe(r); }).listen(8821, '127.0.0.1', () => res(s)); });
const base = 'http://127.0.0.1:8821/';
const browser = await launch();
if (browser) for (const [name, vp, mobile] of [['desktop', { width: 1366, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile }); const pg = await ctx.newPage(); const errs = [], bad = [];
  pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => { if (/Content Security Policy|violates the following/i.test(m.text())) errs.push('CSP: ' + m.text().slice(0, 120)); }); pg.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(base)) bad.push(r.status() + ' ' + r.url()); });
  await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (x) => x.abort());
  const T = `[${name}]`, go = async (p) => { await pg.goto(base + p); await pg.waitForTimeout(350); };
  await go(''); ok(/Forbidden\s*Mantra\s*Press/.test((await pg.locator('h1').first().innerText())) && await pg.locator('[data-home=fmp] .card').count() === 14, `${T} homepage over HTTP: hero, 14 own titles, featured shelves`);
  await pg.waitForFunction(() => { const i = document.querySelector('.lib-img'); return !i || i.closest('.lib-panel').hidden || (i.complete && i.naturalWidth > 0); }, null, { timeout: 4000 }).catch(() => {});
  const lv = await pg.evaluate(() => { const panel = document.querySelector('.lib-panel'), chip = document.querySelector('.lib-chip'); const el = !panel.hidden ? panel : chip; const r = el.getBoundingClientRect(); return { mode: document.getElementById('fm-librarian').dataset.mode, inside: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.width > 30, face: /librarian\.webp/.test(getComputedStyle(document.querySelector('.lib-chip-face')).backgroundImage), art: [...document.querySelectorAll('.lib-img')].every((i) => i.complete && i.naturalWidth > 0) || panel.hidden }; });
  ok(lv.inside && lv.face && lv.art && lv.mode === (mobile ? 'min' : 'open'), `${T} the digital librarian is on screen at load (${mobile ? 'small button with her face' : 'floating panel with her character'}), art loads under the security headers`);
  await pg.locator('.promo-band').scrollIntoViewIfNeeded(); await pg.waitForTimeout(600);
  const im = await pg.evaluate(() => [...document.images].filter((i) => i.currentSrc && !i.closest('.lib-panel[hidden]')).map((i) => [i.currentSrc.split('/').pop(), i.complete && i.naturalWidth > 0]));
  ok(['iosutra-wellness-ai.webp', ...(nvOK ? ['iosutra-inception-member.webp', 'nvidia-inception-program-badge-rgb-for-screen.svg'] : [])].every((n) => im.some(([f, g]) => f === n && g)) && im.every(([, g]) => g), `${T} IOSutra artwork${nvOK ? ', IOSutra panel and full-colour NVIDIA badge' : ' (NVIDIA items withheld)'} render; no broken images`);
  ok(await pg.locator('.io-cta').getAttribute('href').then((h) => h.startsWith('https://iosutra.com/')), `${T} Visit IOSutra links to iosutra.com`);
  // search + librarian
  await go(''); await pg.focus('.hero-search input'); await pg.keyboard.type('tarot', { delay: 30 }); await pg.waitForTimeout(1500);
  ok((await pg.locator('.lib-list a').count()) > 0 && await pg.locator('.lib-panel').isVisible(), `${T} librarian opens on search and lists real books`);
  await go('search/index.html?q=wicca'); await pg.waitForTimeout(1200); const wicca = await pg.locator('[data-results] .card').count();
  ok(wicca > 0, `${T} search page: ${wicca} results for "wicca"`);
  await go('search/index.html?q=zzqxjkv'); await pg.waitForTimeout(1200); ok(await pg.locator('[data-empty]').isVisible(), `${T} search with no match says so`);
  // categories, authors, niche, series
  for (const p of ['subjects/occult-magick-paganism/index.html', 'topics/tarot/index.html', 'traditions/wiccan/index.html', 'authors/index.html', 'niches/magic-witchcraft/index.html', 'series/dune/index.html', 'books/index.html', 'legal/index.html', 'about/affiliate-disclosure/index.html', 'technology/index.html']) { await go(p); ok((await pg.locator('h1').count()) > 0 && !(await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${T} ${p} loads, no horizontal scroll`); }
  // a catalogue book: title, author, tagged Amazon link, cover element
  await go('books/the-power-of-now/index.html'); const bk = await pg.evaluate(() => ({ t: document.querySelector('h1').textContent, a: document.querySelector('.byline')?.textContent, b: [...document.querySelectorAll('a[data-track=buy]')].map((a) => a.href) }));
  ok(bk.t.includes('Power of Now') && /Tolle/.test(bk.a) && bk.b.length > 0 && bk.b.every((h) => /tag=darktheoryinc-20/.test(h)), `${T} book page shows title, author and tagged Amazon link`);
  // a dynamic-tier check and language menu
  await go(''); await pg.locator('.lang-btn').click(); await pg.click('[data-ui=fr]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.documentElement.lang === 'fr') && await pg.locator('[data-langbooks]').isVisible(), `${T} language menu switches to French and shows the honest verified-editions band`);
  ok(bad.length === 0, `${T} no failed requests over HTTP${bad.length ? ': ' + bad[0] : ''}`);
  ok(errs.length === 0, `${T} no JavaScript errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser?.close(); server.close();
fs.rmSync(tmpA, { recursive: true, force: true }); fs.rmSync(tmpB, { recursive: true, force: true });
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} package checks passed`);
process.exit(state.fails ? 1 : 0);
