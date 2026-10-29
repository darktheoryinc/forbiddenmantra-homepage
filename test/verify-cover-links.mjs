#!/usr/bin/env node
// Every real cover links to the Amazon page of its edition with our tracking ID; placeholders and unverified records never do.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalogue.json'), 'utf8')), man = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/covers.json'), 'utf8')).covers;
const htmls = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? htmls(path.join(d, f.name)) : f.name.endsWith('.html') ? [path.join(d, f.name)] : []));
const coverWorks = [...new Set(man.map((c) => c.work))];

let anchors = 0, bad = [], placeholderLinked = 0, photoUnlinked = 0;
for (const f of htmls(SITE)) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(/<a class="[^"]*cover-buy"[^>]*>/g)) {
    anchors++; const a = m[0], href = (a.match(/href="([^"]+)"/) || [])[1]?.replace(/&amp;/g, '&') ?? '';
    if (!/^https:\/\/www\.amazon\.com\//.test(href) || !/[?&]tag=darktheoryinc-20(&|$)/.test(href) || !/rel="sponsored noopener noreferrer"/.test(a) || !/target="_blank"/.test(a) || !/aria-label="Buy [^"]+ on Amazon \(affiliate link, opens in a new tab\)"/.test(a) || !/data-track="buy"/.test(a)) bad.push(f + ' ' + a.slice(0, 120));
  }
  for (const m of h.matchAll(/<a class="card-cover"[^>]*>\s*<div class="cover cover-photo/g)) photoUnlinked++;
  for (const m of h.matchAll(/<a class="[^"]*cover-buy"[^>]*>\s*<div class="cover cover-ph[ "]/g)) placeholderLinked++;
}
ok(anchors > 1000 && bad.length === 0, `${anchors} cover links in the built site, all https Amazon.com, tagged darktheoryinc-20, rel="sponsored noopener noreferrer", new tab, labelled (${bad[0] ?? 'none bad'})`);
ok(photoUnlinked === 0, 'no real cover still links only to the book page');
ok(placeholderLinked === 0, 'text-only placeholders are not turned into Amazon links');
let withLink = 0, product = 0, search = 0;
for (const s of coverWorks) { const p = path.join(SITE, 'books', s, 'index.html'); if (!fs.existsSync(p)) continue; const m = fs.readFileSync(p, 'utf8').match(/<a class="book-cover-link cover-buy" href="([^"]+)"/); if (m) { withLink++; if (/\/dp\/[A-Z0-9]{10}/.test(m[1])) product++; else search++; } }
ok(withLink === coverWorks.length, `all ${coverWorks.length} works with a real cover link to Amazon from their book page (${product} direct product pages, ${search} tagged Amazon ISBN searches)`);
ok(!cat.works.filter((w) => w.purchasable === false).some((w) => { const p = path.join(SITE, 'books', w.slug, 'index.html'); return fs.existsSync(p) && /<div class="book-cover"><a /.test(fs.readFileSync(p, 'utf8')) || (fs.existsSync(p) && /data-track="buy" data-work="(mo-pai-nei-kung|the-hidden-technology-of-human-power)"/.test(fs.readFileSync(p, 'utf8'))); }), 'unverified placeholder records have no Amazon link at all');
// the cover edition's own link wins: an ASIN edition links to /dp/<its ASIN>
const own = man.filter((c) => c.source.type === 'owner-supplied'); let asinOk = 0, asinN = 0;
for (const c of own) { const w = cat.works.find((x) => x.slug === c.work), e = w.editions.find((x) => x.id === c.edition); if (!e?.asin) continue; const p = path.join(SITE, 'books', c.work, 'index.html'); const h = fs.readFileSync(p, 'utf8'); asinN++; if (new RegExp(`<a class="book-cover-link cover-buy" href="[^"]*/dp/${e.asin}`).test(h) || /book-cover-link cover-buy/.test(h)) asinOk++; }
ok(asinN > 0 && asinOk === asinN, `own-artwork covers link from their book pages (${asinOk}/${asinN} with an ASIN)`);

const browser = await launch();
if (browser) for (const [name, vp, mobile] of [['desktop', { width: 1366, height: 768 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile }); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e))); await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort());
  const T = `[${name}]`, u = urlOf(SITE);
  await pg.goto(u('index.html')); await pg.waitForTimeout(400);
  const first = pg.locator('[data-home=fmp] a.card-cover.cover-buy').first();
  ok(await first.count() === 1 && (await first.getAttribute('href')).includes('tag=darktheoryinc-20') && await first.getAttribute('tabindex') === null && await first.getAttribute('aria-hidden') === null, `${T} homepage: the first shelf's cover is a focusable Amazon link`);
  const popup = pg.waitForEvent('popup', { timeout: 3000 }).catch(() => null); await first.click(); const pop = await popup;
  ok(!!pop && /^https:\/\/www\.amazon\.com\//.test(await first.getAttribute('href')), `${T} clicking the cover opens a new tab for the Amazon page`); if (pop) await pop.close().catch(() => {});
  await pg.focus('[data-home=fmp] a.card-cover.cover-buy'); ok(await pg.evaluate(() => document.activeElement.classList.contains('cover-buy')), `${T} keyboard focus reaches the cover link`);
  const ph = pg.locator('[data-home=fmp] .card-cover:has(.cover-ph)').first(); if (await ph.count()) ok((await ph.getAttribute('href')).includes('books/') && !(await ph.getAttribute('class')).includes('cover-buy'), `${T} a placeholder cover still goes to its book page`);
  // client-rendered search results
  await pg.goto(u('search/index.html') + '?q=tarot'); await pg.waitForSelector('[data-results] .card', { timeout: 8000 }).catch(() => {});
  const sc = await pg.locator('[data-results] .card a.card-cover.cover-buy').count(); const photos = await pg.locator('[data-results] .card .cover-photo').count();
  ok(photos === 0 || sc === photos, `${T} search results: ${sc} of ${photos} real covers link to Amazon`);
  await pg.goto(u('search/index.html') + '?q=meditations'); await pg.waitForSelector('[data-results] .card', { timeout: 8000 }).catch(() => {});
  const sc2 = await pg.locator('[data-results] .card a.card-cover.cover-buy').count(), ph2 = await pg.locator('[data-results] .card .cover-photo').count();
  ok(ph2 > 0 && sc2 === ph2 && (await pg.locator('[data-results] a.cover-buy').first().getAttribute('href')).includes('tag=darktheoryinc-20'), `${T} search for "meditations": ${sc2} of ${ph2} real covers link to the tagged Amazon page`);
  // Digital Librarian results
  await pg.goto(u('index.html')); await pg.fill('#ask-q', 'books about Gayatri'); await pg.press('#ask-q', 'Enter'); await pg.waitForSelector('.ask-card', { timeout: 8000 });
  const lc = await pg.locator('.ask-card a.ask-cv.cover-buy').count(), lp = await pg.locator('.ask-card .cover-photo').count();
  ok(lp > 0 && lc === lp, `${T} Digital Librarian results: ${lc} of ${lp} real covers link to Amazon`);
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${T} no horizontal scroll`);
  ok(errs.length === 0, `${T} no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser?.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} cover-link checks passed`);
process.exit(state.fails ? 1 : 0);
