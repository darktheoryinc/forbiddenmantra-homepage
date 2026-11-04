#!/usr/bin/env node
// Verification for the redesign. Read-only apart from writing preview images to redesign/previews/.
//   FM_LIBRARY_DIR=<unzipped compliant library preview> AXE_PATH=<axe.min.js> node redesign/verify.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
let fails = 0, passes = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passes++ : fails++; };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-redesign-'));
const build = (name, extra = []) => { const out = path.join(TMP, name); const r = spawnSync('node', [path.join(HERE, 'build.mjs'), '--out', out, ...extra], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); return out; };
const DIST = build('default.html');
const orig = fs.readFileSync(path.join(ROOT, 'forbiddenmantra-homepage.html'), 'utf8');
const origStripped = path.join(TMP, 'orig-stripped.html'); fs.writeFileSync(origStripped, orig.split('\n').filter((l) => !/^```(html)?\s*$/.test(l)).join('\n'));
const url = (f) => 'file://' + f;

// ---- 1. backups and original files ----
const BACKUP = '83ae92e6a2ca5953f0a27e4c9a6dc7dde5a5bc7f';
ok(git('rev-parse', 'origin/backup/original-forbiddenmantra') === BACKUP && git('rev-parse', 'origin/main') === BACKUP, `GitHub backup branch and main both still at ${BACKUP.slice(0, 8)} (original commit)`);
ok(git('diff', '--name-only', 'origin/main', '--', '.', ':!redesign').split('\n').filter(Boolean).length === 0, 'this branch changes nothing outside redesign/ (the original homepage, Velo snippet, files.zip and README are untouched)');
ok(git('diff', '--quiet', 'origin/main', '--', 'forbiddenmantra-homepage.html', 'wix-velo-page-code.js', 'files.zip', 'README.md') === '' , 'original files are byte-identical to the backup');

// ---- 2. content preservation ----
const browser = await chromium.launch();
const probe = async (file) => { const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } }); const pg = await ctx.newPage(); await pg.route(/^https?:\/\//, (r) => r.abort()); await pg.goto(url(file)); await pg.waitForTimeout(400);
  const r = await pg.evaluate(() => { const strip = (root) => { const c = root.cloneNode(true); c.querySelectorAll('[data-fm-new]').forEach((n) => n.remove()); return c; };
    const body = strip(document.body), head = strip(document.head);
    const links = [...body.querySelectorAll('a[href]')].map((a) => [a.getAttribute('href'), a.getAttribute('target') || '', a.textContent.replace(/\s+/g, ' ').trim(), a.className]);
    return { body: body.innerHTML.replace(/\s+/g, ' ').trim(), head: head.innerHTML.replace(/\s+/g, ' ').trim(), links, text: body.textContent.replace(/\s+/g, ' ').trim() }; });
  await ctx.close(); return r; };
const A = await probe(origStripped), B = await probe(DIST);
ok(A.body === B.body, 'the page body with the new components removed is identical to the original body (every book card, title, genre line, nav item, hero text, footer line and the Amazon Associates statement)');
ok(A.head === B.head, 'the original <head> (title, viewport, fonts, original styles) is identical');
ok(JSON.stringify(A.links) === JSON.stringify(B.links) && A.links.length === 18, `all ${A.links.length} original links are preserved with the same address, target and text`);
const hrefs = A.links.map((l) => l[0]); ok(hrefs.filter((h) => h === 'https://amzn.to/4tX3ogd').length === 17 && hrefs.includes('https://www.forbiddenmantra.com/blog'), 'the 17 original Amazon short links (amzn.to/4tX3ogd) and the blog link are unchanged');
ok(/As an Amazon Associate, Forbidden Mantra Press earns from qualifying purchases\./.test(B.text) && B.text.includes('© 2025 Forbidden Mantra Press'), 'the affiliate disclosure and copyright line are present');
ok(!/```/.test(B.text) && /```/.test(orig), 'the three stray Markdown fence lines that would print as visible text are the only thing removed from the original');

// ---- 3. no Amazon image requests; nothing else external except the original fonts ----
const seen = []; const ctx0 = await browser.newContext({ viewport: { width: 1366, height: 900 } }); const pg0 = await ctx0.newPage(); await pg0.route(/^https?:\/\//, (r) => { seen.push(r.request().url()); r.abort(); }); await pg0.goto(url(DIST)); await pg0.waitForTimeout(800);
const html = fs.readFileSync(DIST, 'utf8');
ok(!seen.some((u) => /amazon|amzn|media-amazon/i.test(u)) && !/media-amazon|ssl-images-amazon|images-amazon/i.test(html), `no Amazon image request or address (${seen.length} external requests attempted: ${[...new Set(seen.map((u) => new URL(u).hostname))].join(', ') || 'none'}; only the original Google Fonts link)`);
ok([...html.matchAll(/<img[^>]+src="([^"]+)"/g)].every((m) => m[1].startsWith('data:image/')), 'every image is an embedded asset (no remote images at all)');
await ctx0.close();

// ---- 4. components: Atma search, IOSutra Pay As You Go, NVIDIA badge ----
const dec = (re) => { const m = html.match(re); return m ? Buffer.from(m[1], 'base64') : null; };
const badge = dec(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/), logo = dec(/data:image\/webp;base64,([A-Za-z0-9+/=]+)"[^>]*alt="IOSutra/), face = dec(/class="fm-face" src="data:image\/webp;base64,([A-Za-z0-9+/=]+)"/);
ok(badge && sha(badge) === sha(fs.readFileSync(path.join(HERE, 'assets-src/nvidia-inception-badge.svg'))) && sha(badge) === 'd2f1fc25616ba02933506b21fa668289169e58ac4c76b5f7f209f2632f289f2e', 'the NVIDIA Inception badge is the official file, byte-for-byte unmodified (sha256 d2f1fc25…)');
ok(logo && sha(logo) === 'd494859bd29df98d707a96a2082a9cbcc5bdd9cb33393b15150958b8e359b5dc', 'the IOSutra logo panel is the existing owner-supplied file, unmodified (sha256 d494859b…)');
ok(face && face.length < 8000, 'the Atma face is a small crop of the existing librarian.webp (not a new character)');
const note = html.match(/<p>IOSutra is a member of the NVIDIA Inception program\.[^<]*<a/)?.[0] ?? '';
ok(/This membership applies to IOSutra only\. It does not extend to Forbidden Mantra Press or this bookstore, and it does not imply that NVIDIA sponsors or endorses either\. NVIDIA and NVIDIA Inception are trademarks of NVIDIA Corporation\./.test(note) && !/powered by NVIDIA|NVIDIA partner|NVIDIA-certified|NVIDIA-backed|in partnership with NVIDIA|NVIDIA-approved|endorsed by NVIDIA/i.test(html.replace(/does not imply that NVIDIA sponsors or endorses/g, '')), 'NVIDIA wording is the approved membership, no-endorsement and trademark text, with no prohibited phrasing');
const cfgFile = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
ok(cfgFile.libraryBaseUrl === '' && cfgFile.iosutraPaygUrl === '', 'committed configuration leaves the Library address and the Pay As You Go address EMPTY (nothing invented, private preview never linked)');

// Library search against the real compliant library, served locally
const LIB = process.env.FM_LIBRARY_DIR;
if (LIB && fs.existsSync(path.join(LIB, 'search/index.html'))) {
  const srv = http.createServer((q, s) => { let p = path.join(LIB, decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html'); if (!fs.existsSync(p)) { s.statusCode = 404; return s.end(); } const t = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }[path.extname(p)] ?? 'application/octet-stream'; s.setHeader('content-type', t); s.end(fs.readFileSync(p)); }).listen(0); await new Promise((r) => srv.on('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`; const withLib = build('with-library.html', ['--library-base', base]);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } }); const pg = await ctx.newPage(); await pg.goto(url(withLib));
  await pg.fill('#fm-q', 'kundalini awakening'); const [pop] = await Promise.all([ctx.waitForEvent('page'), pg.click('.fm-search button')]); await pop.waitForLoadState('domcontentloaded'); await pop.waitForTimeout(2500);
  const shown = await pop.locator('[data-count]').first().textContent().catch(() => ''); const titles = await pop.$$eval('.grid:not([hidden]) > .card .card-title', (e) => e.map((x) => x.textContent.trim()));
  ok(pop.url() === `${base}/search/index.html?q=kundalini+awakening`, `Atma search opens the library's real search page with the query: ${pop.url().replace(base, '<library>')}`);
  ok(titles.length > 0 && titles.some((t) => /kundalini/i.test(t)), `the library shows matching books for the spoken or typed query (${titles.length} results, e.g. "${titles[0]}"; ${shown.trim()})`);
  await ctx.close(); srv.close();
} else console.log('SKIP  library search test: set FM_LIBRARY_DIR to the unzipped compliant library preview');
{ // empty configuration: no navigation
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } }); const pg = await ctx.newPage(); let popped = false; ctx.on('page', () => { popped = true; }); await pg.goto(url(DIST));
  await pg.fill('#fm-q', 'tarot'); await pg.click('.fm-search button'); await pg.waitForTimeout(400);
  ok(!popped && /opens soon/.test(await pg.locator('[data-fm-search-note]').textContent()) && pg.url() === url(DIST), 'with no library address configured the search shows a polite notice and goes nowhere (no invalid destination)');
  await pg.fill('#fm-q', ''); await pg.click('.fm-search button'); ok(/Type a title/.test(await pg.locator('[data-fm-search-note]').textContent()), 'an empty search asks for a query');
  ok((await pg.locator('[data-fm-payg]').getAttribute('aria-disabled')) === 'true' && (await pg.locator('[data-fm-payg-cta]').getAttribute('aria-disabled')) === 'true', 'Pay As You Go (menu link and call to action) is shown as "Soon" and links nowhere until its verified address is configured');
  await pg.click('[data-fm-payg]', { force: true }); await pg.waitForTimeout(300); ok(pg.url() === url(DIST) && !popped, 'clicking the unconfigured Pay As You Go does nothing');
  await ctx.close();
  const withPay = build('with-payg.html', ['--payg-url', 'https://example.invalid/payg-test']); const c2 = await browser.newContext(); const p2 = await c2.newPage(); await p2.goto(url(withPay));
  const a = p2.locator('[data-fm-payg]'); ok((await a.getAttribute('href')) === 'https://example.invalid/payg-test' && (await a.getAttribute('target')) === '_blank' && /noopener/.test(await a.getAttribute('rel')) && !(await a.getAttribute('aria-disabled')) && (await p2.locator('[data-fm-soon]').first().isHidden()), 'once a verified https address is configured, Pay As You Go becomes a normal new-tab link (test value only; nothing committed)');
  await c2.close();
  const c3 = await browser.newContext(); const p3 = await c3.newPage(); await p3.goto(url(build('http-payg.html', ['--payg-url', 'http://insecure.example/x']))); ok((await p3.locator('[data-fm-payg]').getAttribute('aria-disabled')) === 'true', 'a non-https address is refused'); await c3.close();
}

// ---- 5. layouts, images, accessibility ----
fs.mkdirSync(path.join(HERE, 'previews'), { recursive: true });
for (const [name, vp] of [['desktop-1366', { width: 1366, height: 900 }], ['laptop-1024', { width: 1024, height: 800 }], ['tablet-768', { width: 768, height: 1024 }], ['mobile-390', { width: 390, height: 844 }], ['mobile-360', { width: 360, height: 740 }]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 500 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); await pg.route(/^https?:\/\//, (r) => r.abort()); await pg.goto(url(DIST)); await pg.waitForTimeout(500);
  const m = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, imgs: [...document.images].map((i) => [i.alt.slice(0, 20), i.complete && i.naturalWidth > 0]), vis: ['.fm-search', '.fm-face', '.fm-tile-iosutra', '.fm-tile-nv', '[data-fm-payg-cta]', '.nav-links', '.btn-primary'].every((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 20 && r.right <= window.innerWidth + 1 && r.left >= -1; }) }));
  ok(m.sw <= m.iw + 1 && m.vis && m.imgs.every((x) => x[1]) && errs.length === 0, `[${name}] no sideways scroll, Atma search, IOSutra, Pay As You Go and NVIDIA are all fully visible, every image decodes, no script errors`);
  if (name === 'desktop-1366' || name === 'mobile-390') await pg.screenshot({ path: path.join(HERE, `previews/redesign-${name}.png`), fullPage: true });
  await ctx.close();
}
for (const [name, vp] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) { const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile' }); const pg = await ctx.newPage(); await pg.route(/^https?:\/\//, (r) => r.abort()); await pg.goto(url(origStripped)); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(HERE, `previews/original-${name}.png`), fullPage: true }); await ctx.close(); }
if (process.env.AXE_PATH && fs.existsSync(process.env.AXE_PATH)) {
  for (const [name, vp] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile' }); const pg = await ctx.newPage(); await pg.route(/^https?:\/\//, (r) => r.abort()); await pg.goto(url(DIST)); await pg.addScriptTag({ path: process.env.AXE_PATH });
    const res = await pg.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => `${v.id}:${v.nodes.length}`));
    ok(res.length === 0, `[${name}] axe accessibility (WCAG 2 A/AA)${res.length ? ': ' + res.join(', ') : ': no violations'}`); await ctx.close();
  }
} else console.log('SKIP  axe: set AXE_PATH');

// ---- 6. auto-height in a simulated Wix HTML element (parent page listening for the two message names) ----
{
  const parent = path.join(TMP, 'parent.html');
  const mk = (src) => `<!doctype html><body style="margin:0"><iframe id="html3" src="${src}" style="width:100%;height:300px;border:0"></iframe><script>window.msgs=[];window.addEventListener('message',function(e){var d=e.data;if(!d)return;window.msgs.push(d.type);if(d.type==='wixHeight'||d.type==='setHeight'){var h=Number(d.height);if(h>100&&h<20000)document.getElementById('html3').style.height=h+'px';}});</script></body>`;
  const ctxo = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  fs.writeFileSync(parent, mk(url(origStripped))); const po = await ctxo.newPage(); await po.route(/^https?:\/\//, (r) => r.abort()); await po.goto(url(parent)); await po.waitForTimeout(1500);
  const typesO = await po.evaluate(() => [...new Set(window.msgs)]);
  const oldSnippet = fs.readFileSync(path.join(ROOT, 'wix-velo-page-code.js'), 'utf8');
  ok(typesO.length === 1 && typesO[0] === 'wixHeight' && /type === 'setHeight'/.test(oldSnippet), 'ROOT CAUSE FOUND: the original embed posts "wixHeight" but the original Velo snippet only acts on "setHeight", so the embed height is never applied (verified from the two original files)');
  fs.writeFileSync(parent, mk(url(DIST))); const pn = await ctxo.newPage(); await pn.route(/^https?:\/\//, (r) => r.abort()); await pn.goto(url(parent)); await pn.waitForTimeout(1500);
  const typesN = await pn.evaluate(() => [...new Set(window.msgs)]); const hN = await pn.evaluate(() => document.getElementById('html3').getBoundingClientRect().height);
  ok(typesN.includes('wixHeight') && typesN.includes('setHeight') && hN > 1500, `the redesigned embed posts both message names and the parent resizes it to its content (${Math.round(hN)} px)`);
  await ctxo.close();
}
await browser.close();
const velo = fs.readFileSync(path.join(HERE, 'velo/page-code.js'), 'utf8');
ok(/\$w\('#html3'\)\.onMessage\(/.test(velo) && /wixHeight/.test(velo) && /setHeight/.test(velo), 'the corrected Velo snippet uses the documented HtmlComponent onMessage() and accepts both message names');
fs.rmSync(TMP, { recursive: true, force: true });
console.log(fails ? `\n${fails} check(s) FAILED, ${passes} passed` : `\nAll ${passes} redesign checks passed`);
process.exit(fails ? 1 : 0);
