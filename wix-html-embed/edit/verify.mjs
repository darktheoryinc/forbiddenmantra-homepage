#!/usr/bin/env node
// Source-level and browser verification of the edited store page against the verbatim original.
//   FM_UPLOAD=<the uploaded original> FM_LIBRARY_DIR=<unzipped library preview> AXE_PATH=<axe.min.js> node verify.mjs
// The browser tests mock the Supabase catalog (the sandbox cannot reach it) and stand in for Amazon cover images with a blank PNG (TEST ONLY; the delivered file is not changed by this).
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
const ORIG = path.join(ROOT, 'forbiddenmantra-store-original.html'), EDIT = path.join(ROOT, 'forbiddenmantra-store-edited.html');
const orig = fs.readFileSync(ORIG, 'utf8'), edit = fs.readFileSync(EDIT, 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-store-'));

// ---------- 1. the master is untouched ----------
if (process.env.FM_UPLOAD && fs.existsSync(process.env.FM_UPLOAD)) ok(fs.readFileSync(process.env.FM_UPLOAD).equals(fs.readFileSync(ORIG)), 'the master copy is byte-identical to the file you uploaded');
ok(sha(fs.readFileSync(ORIG)) === fs.readFileSync(ORIG + '.sha256', 'utf8').split(/\s+/)[0], 'the master copy matches its recorded SHA-256 (d6374651…)');
let gitOk = false; try { execFileSync('git', ['diff', '--quiet', 'backup/wix-html-embed-2026-11-04', '--', 'wix-html-embed/forbiddenmantra-store-original.html'], { cwd: ROOT }); gitOk = true; } catch {}
ok(gitOk, 'the master copy in this branch is identical to the backup branch backup/wix-html-embed-2026-11-04');

// ---------- 2. reverse the three approved changes and get the original back exactly ----------
const changes = JSON.parse(fs.readFileSync(path.join(HERE, 'changes.json'), 'utf8')).replacedLines;
let back = edit;
const strip = (re, label) => { const n = (back.match(re) ?? []).length; back = back.replace(re, ''); return [label, n]; };
const stripped = [strip(/<style data-fm-new>[\s\S]*?<\/style>\n/, 'style block'), strip(/<section class="container fm-atma-wrap" data-fm-new[\s\S]*?<\/section>\n/, 'Atma browser + logo row'), strip(/<script data-fm-new>[\s\S]*?<\/script>\n/, 'launch switch script')];
for (const c of changes) { const parts = back.split(c.new); if (parts.length !== 2) { back = null; break; } back = parts.join(c.old); }
ok(stripped.every(([, n]) => n === 1) && back === orig, `removing the 3 added blocks and restoring the ${changes.length} changed colour values gives back the ORIGINAL file exactly (byte for byte)`);
const dfile = path.join(TMP, 'diff.txt'); const d = spawnSync('diff', ['-u', ORIG, EDIT], { encoding: 'utf8', maxBuffer: 1 << 28 }).stdout;
const removed = d.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')), added = d.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
const expectedRemoved = new Set(changes.map((c) => c.old.trim()));
ok(removed.length === changes.length && removed.every((l) => expectedRemoved.has(l.slice(1).trim())), `line diff: only ${removed.length} lines of the original differ (the theme colour values: ${changes.filter((c) => /--color|--shadow/.test(c.old)).length} variables + 1 dark-header colour); nothing else was removed or altered`);
ok(removed.every((l) => /--color-|--shadow-|\.topbar/.test(l)), 'every changed original line is a colour, shadow or header-colour value');

// ---------- 3. invariants of the original content and code ----------
const big = (t) => t.split('\n').find((l) => l.length > 100000) ?? '';
ok(big(orig) && sha(big(orig)) === sha(big(edit)), 'the embedded brand-logo image (910 KB Base64 line) is byte-identical');
const mainScript = (t) => [...t.matchAll(/<script(?![^>]*data-fm-new)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
ok(mainScript(orig) === mainScript(edit) && mainScript(orig).length > 10000, `all original JavaScript (${mainScript(orig).length} characters: catalog loading, rendering, filters, search, language menu, theme toggle, modal, resize messaging) is byte-identical`);
const urls = (t) => [...t.matchAll(/https?:\/\/[^"'\s<>)`]+/g)].map((m) => m[0]).filter((u) => !/iosutra\.com/.test(u));
const blocksRe = [/<style data-fm-new>[\s\S]*?<\/style>\n/, /<section class="container fm-atma-wrap" data-fm-new[\s\S]*?<\/section>\n/, /<script data-fm-new>[\s\S]*?<\/script>\n/];
const addedText = blocksRe.map((re) => (edit.match(re) ?? [''])[0]).join('\n');
const ou = urls(orig), eu = urls(blocksRe.reduce((t, re) => t.replace(re, ''), edit));
const newUrls = [...new Set([...addedText.matchAll(/https?:\/\/[^"'\s<>)`]+/g)].map((m) => m[0]))];
ok(JSON.stringify([...new Set(ou)].sort()) === JSON.stringify([...new Set(eu)].sort()) && ou.length === eu.length, `every original URL is preserved unchanged (${ou.length} URLs, ${new Set(ou).size} unique: Amazon links, cover-address builder, Supabase address, brand links); the only new addresses are https://iosutra.com and, in a comment, the future library address`);
ok(newUrls.every((u) => /^https:\/\/(iosutra\.com|library\.forbiddenmantra\.com)$/.test(u)), `the added blocks contain no other web addresses (found: ${newUrls.join(', ')})`);
ok(/m\.media-amazon\.com\/images\/P\/\$\{encodeURIComponent\(asin\)\}\.01\.L\.jpg/.test(edit) && /row\.cover_url/.test(edit) && /amazon\.com\/dp\/\$\{encodeURIComponent\(asin\)\}/.test(edit), 'the existing cover and Amazon-link logic is present and unchanged (as instructed: book covers and links are not touched)');
const ids = (t) => [...t.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
ok(ids(orig).every((i) => ids(edit).includes(i)) && (orig.match(/<img\b/g) ?? []).length + 3 === (edit.match(/<img\b/g) ?? []).length, `every original element ID is still present; exactly 3 images were added (Atma face, NVIDIA badge, IOSutra logo)`);
ok((orig.match(/postMessage/g) ?? []).length === (edit.match(/postMessage/g) ?? []).length && /type: 'wixHeight'/.test(edit) && /type: 'setHeight'/.test(edit), 'the parent-page resize messaging (wixHeight and setHeight) is unchanged');
ok(['fonts.googleapis.com', 'supabase.co'].every((h) => orig.includes(h) && edit.includes(h)), 'fonts and the Supabase catalog source are unchanged');
ok(!/nvidia|iosutra/i.test(orig) && (edit.match(/data-fm-new/g) ?? []).length === 3, 'the original had no NVIDIA or IOSutra content; all additions are marked data-fm-new (3 blocks)');

// ---------- 4. browser tests (mocked catalog; blank stand-in for cover images) ----------
const rows = [
 ['The Apocalypse of Adam', 'Emily K Patel', 'Gnostic Texts', 'en', 'A visionary Gnostic text from the Nag Hammadi tradition.', 'B0AAA00001', [{ format: 'ebook', asin: 'B0AAA00001', published_at: '2026-10-01' }, { format: 'paperback', asin: '1234567890' }]],
 ['Mo Pai Nei Kung', 'Emily K Patel', 'Mo Pai', 'en', 'Internal energy cultivation in the Mo Pai tradition.', 'B0AAA00002', [{ format: 'ebook', asin: 'B0AAA00002', published_at: '2026-09-12' }]],
 ['Kundalini Awakening', 'Emily K Patel', 'Kundalini', 'en', 'Kundalini energy and the subtle body.', 'B0AAA00003', [{ format: 'audiobook', asin: 'B0AAA00003', published_at: '2026-08-01' }]],
 ['Tantra and Sacred Union', 'Emily K Patel', 'Tantra', 'es', 'Tantra practice explained.', 'B0AAA00004', [{ format: 'ebook', asin: 'B0AAA00004', published_at: '2026-07-01' }]],
 ['The Hermetic Path', 'Emily K Patel', 'Hermeticism', 'de', 'Hermeticism for modern seekers.', 'B0AAA00005', [{ format: 'paperback', asin: 'B0AAA00005' }]],
 ['Forbidden Mantra', 'Forbidden Mantra Press', 'Mantra', 'hi', 'Mantra and transformation.', 'B0AAA00006', [{ format: 'ebook', asin: 'B0AAA00006', published_at: '2026-06-01' }]],
 ['Hidden Technology of Human Power', 'Emily K Patel', 'Energy Cultivation', 'en', 'Biofield and energy systems for energy cultivation.', 'B0AAA00007', [{ format: 'ebook', asin: 'B0AAA00007', published_at: '2026-05-01' }]],
 ['Gnostic Gospels Explained', 'Emily K Patel', 'Gnosticism', 'fr', 'Gnosticism and the early texts.', 'B0AAA00008', [{ format: 'ebook', asin: 'B0AAA00008', published_at: '2026-04-01' }]],
].map(([title, author, series, language, description, primary_asin, editions]) => ({ slug: title.toLowerCase().replace(/\W+/g, '-'), title, author, series, language, description, primary_asin, editions: JSON.stringify(editions), cover_url: null }));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const browser = await chromium.launch();
const newPage = async (vp, theme, record) => {
  const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 500 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); pg.errs = errs; pg.ctx = ctx; pg.reqs = [];
  await pg.route(/^https?:\/\//, (r) => { const u = r.request().url(); pg.reqs.push(u);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (/supabase\.co\/rest\/v1\/catalog/.test(u)) return r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(rows) });
    if (/media-amazon\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    return r.abort(); });
  return pg;
};
const go = async (pg, file, theme) => { await pg.goto('file://' + file); await pg.waitForSelector('#catalogGrid .card, #catalogGrid p', { timeout: 8000 }).catch(() => {}); if (theme === 'dark') await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await pg.waitForTimeout(500); };
const snap = (pg) => pg.evaluate(() => ['#topGrid', '#newGrid', '#energyGrid', '#catalogGrid', '#heroBook', '#featuredTitle', '#featuredDescription', '#featuredAmazonLink'].map((s) => { const e = document.querySelector(s); return e ? (e.outerHTML.replace(/\s+/g, ' ')) : 'MISSING ' + s; }).join('\n'));
{
  const a = await newPage({ width: 1366, height: 900 }), b = await newPage({ width: 1366, height: 900 });
  await go(a, ORIG); await go(b, EDIT);
  const sa = await snap(a), sb = await snap(b); const cards = await b.locator('#catalogGrid .card').count();
  ok(sa === sb && cards >= 8, `rendered catalog is identical in the original and the edited page: hero, featured book, top sellers, new releases, energy shelf and all ${cards} catalog cards (titles, authors, covers, links, buttons)`);
  const ext = (p) => [...new Set(p.reqs.map((u) => new URL(u).hostname))].sort().join(',');
  ok(ext(a) === ext(b), `no new network requests: both pages contact only ${ext(b)}`);
  // identical behaviour after the same interactions
  const act = async (pg) => { await pg.fill('#searchInput', 'tantra'); await pg.waitForTimeout(250); const s1 = await pg.locator('#catalogGrid .card').count(); await pg.fill('#searchInput', ''); await pg.click('.filter-chip[data-filter="Kundalini"]'); await pg.waitForTimeout(400); const s2 = await pg.locator('#catalogGrid .card').count(); await pg.click('#languageNavButton'); const dd = await pg.locator('#languageDropdown').isVisible(); await pg.click('[data-nav-language="hi"]'); await pg.waitForTimeout(300); const s3 = await pg.locator('#catalogGrid .card').count(); await pg.click('[data-theme-toggle]'); const th = await pg.evaluate(() => document.documentElement.getAttribute('data-theme')); await pg.click('#viewFeatured'); await pg.waitForTimeout(400); const pagesOpened = pg.ctx.pages().length; return [s1, s2, dd, s3, th, pagesOpened].join('|'); };
  const ra = await act(a), rb = await act(b); ok(ra === rb && ra.endsWith('|2'), `search, topic filter, language menu, theme toggle and the featured-book button behave identically in both (${rb})`);
  ok(a.errs.length === 0 && b.errs.length === 0, 'no script errors on either page');
  await a.ctx.close(); await b.ctx.close();
}
// ---------- 5. new components ----------
{
  const pg = await newPage({ width: 1366, height: 900 }); await go(pg, EDIT);
  const st = await pg.evaluate(() => ({ soon: !document.getElementById('fmLibSoon').hidden && getComputedStyle(document.getElementById('fmLibSoon')).display !== 'none' && document.getElementById('fmLibSoon').textContent.trim(), dis: document.getElementById('fmLibQ').disabled && document.querySelector('#fmLibForm button').disabled, action: document.getElementById('fmLibForm').getAttribute('action'), face: (() => { const i = document.querySelector('.fm-atma-face'); return i.complete && i.naturalWidth > 0; })() }));
  ok(st.soon === 'Library Opens Soon' && st.dis && st.action === null && st.face, 'Atma Library Browser shows "Library Opens Soon", is disabled, has no destination, and shows Atma\'s face');
  await pg.evaluate(() => document.getElementById('fmLibForm').dispatchEvent(new Event('submit', { cancelable: true }))); await pg.waitForTimeout(200); ok(pg.url().startsWith('file:') && pg.ctx.pages().length === 1, 'submitting while inactive goes nowhere (no inactive domain, no private Netlify address)');
  ok(!/netlify\.app/.test(edit) && !/library\.forbiddenmantra\.com/.test(edit.replace(/e\.g\.[^\n]*library\.forbiddenmantra\.com[^\n]*/, '')), 'no Netlify address, and the future library address appears only in the explanatory comment next to the switch');
  const logo = await pg.evaluate(() => [...document.querySelectorAll('.fm-brands img')].map((i) => ({ alt: i.alt, ok: i.complete && i.naturalWidth > 0, h: Math.round(i.getBoundingClientRect().height), x: Math.round(i.getBoundingClientRect().left), href: i.closest('a')?.getAttribute('href') ?? null, target: i.closest('a')?.getAttribute('target') ?? null, rel: i.closest('a')?.getAttribute('rel') ?? null })));
  ok(logo.length === 2 && logo[0].alt === 'NVIDIA Inception Program' && logo[1].alt.startsWith('IOSutra') && logo.every((l) => l.ok) && logo[0].x < logo[1].x && Math.abs(logo[0].h - logo[1].h) <= 1, 'two real logo images sit side by side (NVIDIA Inception first, IOSutra beside it), same height, both decoded');
  ok(logo[1].href === 'https://iosutra.com' && logo[1].target === '_blank' && /noopener/.test(logo[1].rel) && /noreferrer/.test(logo[1].rel) && logo[0].href === null, 'the IOSutra logo links to https://iosutra.com in a new tab with rel="noopener noreferrer"');
  const dec = (re) => { const m = edit.match(re); return m ? Buffer.from(m[1], 'base64') : null; };
  ok(sha(dec(/<img src="data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)"/)) === 'd2f1fc25616ba02933506b21fa668289169e58ac4c76b5f7f209f2632f289f2e' && sha(dec(/<img src="data:image\/webp;base64,([A-Za-z0-9+/=]+)" width="151"/)) === 'd494859bd29df98d707a96a2082a9cbcc5bdd9cb33393b15150958b8e359b5dc', 'both logo files are the existing assets, byte-for-byte unmodified (NVIDIA badge sha256 d2f1fc25…, IOSutra panel sha256 d494859b…)');
  await pg.ctx.close();
  const LIB = process.env.FM_LIBRARY_DIR;
  if (LIB && fs.existsSync(path.join(LIB, 'search/index.html'))) {
    const srv = http.createServer((q, s) => { let p = path.join(LIB, decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html'); if (!fs.existsSync(p)) { s.statusCode = 404; return s.end(); } const t = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }[path.extname(p)] ?? 'application/octet-stream'; s.setHeader('content-type', t); s.end(fs.readFileSync(p)); }).listen(0); await new Promise((r) => srv.on('listening', r));
    const base = `http://127.0.0.1:${srv.address().port}`; const live = path.join(TMP, 'live-switch.html'); execFileSync('node', [path.join(HERE, 'build.mjs'), '--library-url', base, '--out', live]);
    const pg2 = await newPage({ width: 1366, height: 900 }); await go(pg2, live);
    await pg2.fill('#fmLibQ', 'kundalini awakening'); const [pop] = await Promise.all([pg2.ctx.waitForEvent('page'), pg2.click('#fmLibForm button')]); await pop.waitForLoadState('domcontentloaded'); await pop.waitForTimeout(2200);
    const titles = await pop.$$eval('.grid:not([hidden]) > .card .card-title', (e) => e.map((x) => x.textContent.trim()));
    ok(pop.url() === `${base}/search/index.html?q=kundalini+awakening` && titles.some((t) => /kundalini/i.test(t)), `after changing the one switch line, search opens the library's real search page and shows matching books (${titles.length} results); the "Opens Soon" pill is hidden: ${await pg2.evaluate(() => document.getElementById('fmLibSoon').hidden)}`);
    await pg2.ctx.close(); srv.close();
  } else console.log('SKIP  live-switch test: set FM_LIBRARY_DIR');
  // the shipped file keeps the switch empty
  ok(/var FM_LIBRARY_URL = "";/.test(edit), 'the delivered file ships with the switch EMPTY (library inactive)');
}
// ---------- 6. layouts, themes, contrast ----------
fs.mkdirSync(path.join(HERE, 'previews'), { recursive: true });
const axe = process.env.AXE_PATH && fs.existsSync(process.env.AXE_PATH) ? process.env.AXE_PATH : null;
const contrast = async (pg) => { if (!axe) return null; await pg.addScriptTag({ path: axe }); return pg.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2aa'] }); const bad = r.violations.filter((v) => v.id === 'color-contrast'); return { total: r.violations.reduce((n, v) => n + v.nodes.length, 0), contrast: bad.reduce((n, v) => n + v.nodes.length, 0), newOnes: bad.flatMap((v) => v.nodes).filter((n) => /fm-/.test(n.html)).length }; }); };
for (const theme of ['light', 'dark']) for (const [name, vp] of [['desktop-1366', { width: 1366, height: 900 }], ['tablet-768', { width: 768, height: 1024 }], ['mobile-390', { width: 390, height: 844 }], ['mobile-360', { width: 360, height: 740 }]]) {
  const a = await newPage(vp), b = await newPage(vp); await go(a, ORIG, theme); await go(b, EDIT, theme);
  const ov = await a.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), ev = await b.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const vis = await b.evaluate(() => ['.fm-atma', '.fm-atma-face', '.fm-brand-tile', '.fm-atma-form input'].every((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 20 && r.left >= -1 && r.right <= window.innerWidth + 1; }));
  const ca = await contrast(a), cb = await contrast(b);
  ok(ev <= Math.max(ov, 1) && vis, `[${theme} ${name}] no new sideways scroll (original ${ov}px, edited ${ev}px) and the Atma browser and both logos are fully visible${cb ? `; contrast problems: original ${ca.contrast}, edited ${cb.contrast}, in the new components ${cb.newOnes}` : ''}`);
  if (cb) ok(cb.newOnes === 0 && cb.contrast <= ca.contrast, `[${theme} ${name}] readable contrast: the edit adds no contrast failures (edited ${cb.contrast} vs original ${ca.contrast})`);
  if (name === 'desktop-1366' || name === 'mobile-390') { await b.screenshot({ path: path.join(HERE, `previews/edited-${theme}-${name}.png`), fullPage: true }); await a.screenshot({ path: path.join(HERE, `previews/original-${theme}-${name}.png`), fullPage: true }); }
  await a.ctx.close(); await b.ctx.close();
}
// ---------- 7. Wix iframe messaging ----------
{
  const mk = (src) => `<!doctype html><body style="margin:0"><iframe id="html3" src="${src}" style="width:100%;height:300px;border:0"></iframe><script>window.msgs=[];window.addEventListener('message',function(e){var d=e.data;if(!d)return;window.msgs.push(d.type);if(d.type==='wixHeight'||d.type==='setHeight'){var h=Number(d.height);if(h>100&&h<20000)document.getElementById('html3').style.height=h+'px';}});</script></body>`;
  const res = {}; for (const [k, f] of [['orig', ORIG], ['edit', EDIT]]) { const par = path.join(TMP, `p-${k}.html`); fs.writeFileSync(par, mk('file://' + f)); const pg = await newPage({ width: 1200, height: 800 }); await pg.goto('file://' + par); await pg.waitForTimeout(2500); res[k] = await pg.evaluate(() => ({ types: [...new Set(window.msgs)].sort().join(','), h: Math.round(document.getElementById('html3').getBoundingClientRect().height) })); await pg.ctx.close(); }
  ok(res.edit.types === 'setHeight,wixHeight' && res.orig.types === res.edit.types && res.edit.h > res.orig.h && res.edit.h - res.orig.h < 400, `inside a simulated Wix HTML element both pages send the same two resize messages and the parent resizes the frame to the content (original ${res.orig.h} px, edited ${res.edit.h} px: the extra height is the new Atma row)`);
}
await browser.close(); fs.rmSync(TMP, { recursive: true, force: true });
console.log(fails ? `\n${fails} check(s) FAILED, ${passes} passed` : `\nAll ${passes} preservation checks passed`);
process.exit(fails ? 1 : 0);
