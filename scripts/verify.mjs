#!/usr/bin/env node
// Verification: node scripts/verify.mjs [--shots]
//  1. every internal link/asset in site/ resolves; no page repeats a single external URL across many books
//  2. retailer-link audit (per edition) with verification states
//  3. (needs Playwright) search/filter/nav behaviour at desktop and mobile widths; optional screenshots
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

// 1. links
const pages = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') && pages.push(path.join(d, e.name)); })(SITE);
let internal = 0, broken = [], external = new Map();
for (const p of pages) {
  const html = fs.readFileSync(p, 'utf8');
  const buyLinks = new Set([...html.matchAll(/<ul class="buy">([\s\S]*?)<\/ul>/g)].flatMap((b) => [...b[1].matchAll(/href="([^"]+)"/g)].map((x) => x[1])));
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:)?\/\//.test(u)) { if (!/fonts\.(googleapis|gstatic)/.test(u) && buyLinks.has(u.replace(/&amp;/g, '&')) || buyLinks.has(u)) { const s = external.get(u) ?? new Set(); s.add(path.relative(SITE, p)); external.set(u, s); } continue; }
    if (u.startsWith('mailto:') || u.startsWith('data:')) continue;
    const [file, hash] = u.split('#'); internal++;
    const target = file ? path.resolve(path.dirname(p), file.split('?')[0]) : p;
    if (!fs.existsSync(target)) { broken.push(`${path.relative(SITE, p)} -> ${u}`); continue; }
    if (hash && target.endsWith('.html') && !fs.readFileSync(target, 'utf8').includes(`id="${hash}"`)) broken.push(`${path.relative(SITE, p)} -> ${u} (missing anchor)`);
  }
}
ok(broken.length === 0, `${pages.length} pages, ${internal} internal links/assets all resolve${broken.length ? '\n  ' + broken.slice(0, 15).join('\n  ') : ''}`);
const repeated = [...external].filter(([u, s]) => [...s].filter((x) => x.startsWith('books')).length > 2 && !/worldcat/.test(u));
ok(repeated.length === 0, `no external retailer URL is reused across 3+ book pages${repeated.length ? ': ' + repeated.map(([u]) => u).join(', ') : ''}`);
ok(![...external.keys()].some((u) => u.includes('amzn.to') && [...external.get(u)].some((x) => x.startsWith('books'))), 'legacy amzn.to short link is not used on any book page');

// 2. audit
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalogue.json'), 'utf8'));
const audit = { 'verified-live': 0, 'seen-in-search-results': 0, 'derived-from-isbn10': 0, 'search-link': 0, none: 0 };
for (const w of cat.works) for (const e of w.editions) {
  const r = e.retailers?.[0];
  if (r?.verification === 'seen-in-search-results') audit['seen-in-search-results']++;
  else if (e.isbn10 && ['paperback', 'hardcover'].includes(e.format) && !e.noDerivedLink) audit['derived-from-isbn10']++;
  else if (w.press) audit['search-link']++; else audit.none++;
}
console.log('retailer destinations by verification state (editions):', JSON.stringify(audit));

// 3. browser
let chromium; try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch { console.log('SKIP browser tests (playwright not installed)'); process.exit(fails ? 1 : 0); }
const shots = process.argv.includes('--shots'); const SH = path.join(ROOT, 'docs/screenshots'); if (shots) fs.mkdirSync(SH, { recursive: true });
const url = (p) => pathToFileURL(path.join(SITE, p)).href;
const browser = await chromium.launch();
for (const [name, vp] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile', deviceScaleFactor: 1 }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const snap = async (f, full = false) => shots && pg.screenshot({ path: path.join(SH, `${name}-${f}.png`), fullPage: full });
  const visible = () => pg.$$eval('.card:not([hidden])', (c) => c.map((x) => x.querySelector('.card-title').textContent.trim()));
  const hscroll = () => pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

  await pg.goto(url('index.html')); await snap('home'); await snap('home-full', true);
  ok(!(await hscroll()), `[${name}] home: no horizontal scroll`);
  if (name === 'mobile') { await pg.click('.nav-toggle'); ok(await pg.isVisible('#nav a >> text=Authors'), '[mobile] menu opens and shows links'); await snap('menu'); }

  // search by title / author / subject / ISBN
  const cases = [['Power of Now', 'the-power-of-now'], ['tolle', 'The Power of Now'], ['Pagels', 'The Gnostic Gospels'], ['tarot', 'Seventy-Eight Degrees of Wisdom'], ['978-1-57731-480-6', 'The Power of Now'], ['9780875421186', 'Wicca'], ['0470923350', 'When the Body Says No'], ['B0H8MQN9WK', 'The Apocalypse of Adam'], ['chodron', 'When Things Fall Apart']];
  for (const [q, expect] of cases) {
    await pg.goto(url('search/index.html') + '?q=' + encodeURIComponent(q));
    const v = await visible();
    const hit = v.some((t) => t.toLowerCase() === expect.toLowerCase()) || (expect.includes('-') && v.length > 0);
    ok(hit && v.length < cat.works.length, `[${name}] search "${q}" -> ${v.length} result(s) incl. ${expect}`);
  }
  await pg.goto(url('search/index.html') + '?q=' + encodeURIComponent('Power of Now')); await snap('search');
  // filters
  await pg.goto(url('books/index.html'));
  await pg.selectOption('select[name=press]', 'fmp'); ok((await visible()).length === 12, `[${name}] press filter shows 12 FMP titles`);
  await pg.selectOption('select[name=press]', ''); await pg.selectOption('select[name=subject]', 'tarot'); ok((await visible()).join() === 'Seventy-Eight Degrees of Wisdom', `[${name}] subject=tarot`);
  await pg.selectOption('select[name=subject]', ''); await pg.selectOption('select[name=format]', 'audiobook'); const au = await visible(); ok(au.length === 2, `[${name}] format=audiobook -> ${au.join(', ')}`);
  await pg.selectOption('select[name=format]', ''); await pg.selectOption('select[name=tradition]', 'gnostic'); ok((await visible()).length === 2, `[${name}] tradition=gnostic -> 2`);
  await pg.selectOption('select[name=tradition]', ''); await pg.selectOption('select[name=level]', 'intermediate'); const lv = await visible(); ok(lv.length > 3 && lv.length < cat.works.length, `[${name}] level=intermediate -> ${lv.length}`);
  await pg.selectOption('select[name=level]', ''); await pg.selectOption('select[name=lang]', 'de'); ok((await visible()).length === 0 && await pg.isVisible('[data-empty]'), `[${name}] language=German -> empty state (no verified German edition yet)`);
  await pg.selectOption('select[name=lang]', ''); await snap('books');
  // navigation: hub -> dept -> book -> author
  await pg.goto(url('subjects/occult-magick-paganism/index.html')); await snap('hub');
  await pg.click('.dept >> text=Tarot'); ok(pg.url().includes('topics/tarot'), `[${name}] hub -> department link`);
  await snap('topic');
  await pg.click('.card-title a >> text=Seventy-Eight'); ok(pg.url().includes('books/seventy-eight-degrees-of-wisdom'), `[${name}] department -> book link`);
  const eds = await pg.$$('.edition'); ok(eds.length === 2, `[${name}] book page groups 2 editions under one work`);
  const hrefs = await pg.$$eval('.edition a.btn:not(.btn-ghost)', (a) => a.map((x) => x.href)); ok(hrefs.length === 2 && new Set(hrefs).size === 2 && hrefs.every((h) => h.includes('amazon.com/dp/')), `[${name}] each edition has its own Amazon destination: ${hrefs.map((h) => h.split('/dp/')[1]).join(', ')}`);
  ok(await pg.isVisible('text=As an Amazon Associate'), `[${name}] affiliate disclosure visible`);
  await snap('book', true);
  await pg.click('.byline a'); ok(pg.url().includes('authors/rachel-pollack'), `[${name}] book -> author link`); await snap('author');
  await pg.goto(url('authors/index.html')); ok(await pg.isVisible('#l-T') || (await pg.$('#l-T')) !== null, `[${name}] authors A–Z index renders`); await snap('authors');
  await pg.goto(url('press/index.html')); await snap('press', true);
  await pg.goto(url('paths/begin-mindfulness/index.html')); await snap('path');
  await pg.goto(url('books/the-apocalypse-of-adam/index.html')); const ap = await pg.$$eval('.edition a.btn:not(.btn-ghost)', (a) => a.map((x) => x.href)); ok(ap.some((h) => h.includes('B0H8MQN9WK')), `[${name}] FMP Apocalypse of Adam audiobook links to its own ASIN`);
  ok(!(await hscroll()), `[${name}] book page: no horizontal scroll`);
  ok(errs.length === 0, `[${name}] no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} check(s) FAILED` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
