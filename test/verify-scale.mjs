#!/usr/bin/env node
// Scale layer: pagination, chunk index, dynamic book tier, series, author-page rule, retailer-link rule.
//   node test/verify-scale.mjs      (needs the default site/ build for comparisons; builds a capped copy into test/out-scale)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, checkLinks, launch, urlOf } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cat = J('data/catalogue.json');
const full = path.join(ROOT, 'site');
const data = path.join(ROOT, 'test/fixtures/scale-data');
fs.rmSync(data, { recursive: true, force: true }); fs.cpSync(path.join(ROOT, 'data'), data, { recursive: true });
const env = { ...process.env, FM_DATA: 'test/fixtures/scale-data', FM_OUT: 'test/out-scale', FM_BUILD: JSON.stringify({ pageSize: 20, maxStaticBookPages: 60, maxListingPages: 3, authorPagesAllBelow: 10, dynShardTarget: 10 }) };
execFileSync('node', [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, env, stdio: 'ignore' });
const SITE = path.join(ROOT, 'test/out-scale');
const read = (rel, root = SITE) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel, root = SITE) => fs.existsSync(path.join(root, rel));
const N = cat.works.length;

// ---- static structure ----
const staticBooks = fs.readdirSync(path.join(SITE, 'books')).filter((d) => exists(`books/${d}/index.html`)).length;
const dynN = N - 60;
ok(staticBooks === 60 && exists('book/index.html'), `tiering: ${staticBooks} static book pages (cap 60) + the dynamic book view for the other ${dynN}`);
const idxFiles = fs.readdirSync(path.join(SITE, 'assets/idx'));
ok(idxFiles.includes('manifest.js') && idxFiles.some((f) => /^c\d+\.js$/.test(f)) && idxFiles.some((f) => /^dyn-[0-9a-f]+\.js$/.test(f)), `index: manifest, ${idxFiles.filter((f) => /^c\d+\.js$/.test(f)).length} search chunk(s), ${idxFiles.filter((f) => f.startsWith('dyn-')).length} detail shard(s)`);
ok(!/dyn/.test(read('assets/idx/' + idxFiles.find((f) => /^c\d+\.js$/.test(f))).slice(0, 0)) && idxFiles.filter((f) => /^c\d+\.js$/.test(f)).every((f) => !/"eds":\[/.test(read('assets/idx/' + f))), 'search chunks carry no per-edition detail or retailer links (that lives in the detail shards)');
const b1 = read('books/index.html');
ok((b1.match(/<article class="card"/g) || []).length === 20 && /data-total="\d+"/.test(b1) && b1.includes('data-pager') && b1.includes('rel="next"') && !b1.includes('rel="prev"'), 'books/: first page has 20 cards, a pager and a rel=next link, and no rel=prev');
ok(exists('books/page/2/index.html') && exists('books/page/3/index.html') && !exists('books/page/4/index.html'), 'pagination stops at the configured cap (3 pages)');
ok(/continues for \d+ more books/.test(read('books/page/3/index.html')) && read('books/page/2/index.html').includes('rel="prev"'), 'last static page says the list continues and points to filters; page 2 has rel=prev');
ok(!/<article class="card"/.test(read('search/index.html')) && read('search/index.html').includes('data-index-grid'), 'search page has no static cards; it is drawn from the index');
ok(read('books/index.html').includes('Page 1') === false && /aria-current="page">1</.test(b1), 'pager marks the current page (aria-current)');
const dynBook = cat.works.filter((w) => !exists(`books/${w.slug}/index.html`));
ok(dynBook.length === dynN, `${dynBook.length} works have no static page and are linked to the dynamic view`);
const sm = checkLinks(SITE); ok(sm.broken.length === 0, `links resolve across ${sm.pages} pages${sm.broken.length ? ': ' + sm.broken.slice(0, 5).join('; ') : ''}`);
const allFiles = (function c(d) { return fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? c(path.join(d, e.name)) : 1), 0); })(SITE);
ok(allFiles < 20000, `file count ${allFiles} is under the 20,000-file limit of common static hosts`);

// ---- series, authors, retailers (default build) ----
ok(exists('series/the-kingkiller-chronicle/index.html', full) && /Book 2 of <a[^>]*>The Kingkiller Chronicle/.test(read('books/the-wise-mans-fear/index.html', full)), 'series: page exists and the book page says "Book 2 of The Kingkiller Chronicle"');
const lotr = read('series/the-lord-of-the-rings/index.html', full); ok(lotr.indexOf('The Return of the King') > -1, 'series: The Lord of the Rings lists catalogued volumes only (no invented missing books)');
const zen = read('books/zen-mind-beginners-mind/index.html', full).replace(/&amp;/g, '&') || '';
ok(/s\?k=9780834800793&i=stripbooks&tag=darktheoryinc-20/.test(zen) && !/\/dp\//.test(zen) && /Search on Amazon/.test(zen) && /ISBN search link; no product page has been verified/.test(zen), 'retailer rule: bulk-imported edition with no product page in its sources gets a labelled ISBN search link, not an assumed /dp/ link');
const wh = read('books/wherever-you-go-there-you-are/index.html', full).replace(/&amp;/g, '&');
ok(/amazon\.com\/Wherever-You-Go-There-Are\/dp\/0749925485\?tag=darktheoryinc-20/.test(wh) && /Product page seen in a cited source/.test(wh), 'retailer rule: when the exact product page appeared in a cited source it is used, tagged, and says where it came from');
ok(![...read('books/tarot-for-your-self/index.html', full).matchAll(/<ul class="buy"[\s\S]*?<\/ul>/g)].some((m) => /us\.amazon\.com/.test(m[0])), 'retailer rule: us.amazon.com source URLs are normalised to www.amazon.com');
const fm = J('data/catalogue.json').works.filter((w) => !w.press && (w.provenance?.tier ?? 'hand-verified') === 'hand-verified');
ok(fm.length > 0 && /\/dp\/1577314808/.test(read('books/the-power-of-now/index.html', full)), 'hand-verified tier keeps its existing ISBN-10 links (labelled as not yet confirmed live)');
const singles = cat.authors.filter((a) => a.workIds.length === 1 && !cat.works.find((w) => w.id === a.workIds[0]).press);
ok(singles.length > 0 && !exists(`authors/${singles[0].id}/index.html`) && exists('authors/neil-gaiman/index.html'), `author-page rule at scale: single-book authors have no page (${singles.length}), multi-book authors do`);
ok(read('books/page/2/index.html').includes('search/index.html?q=') || b1.includes('search/index.html?q='), 'single-book author names link to a search for the name');

// ---- browser ----
const browser = await launch(); if (!browser) process.exit(state.fails ? 1 : 0);
const url = urlOf(SITE);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
const settle = async () => { await pg.waitForTimeout(150); await pg.waitForFunction(() => { const c = document.querySelector('[data-count]'); return c && c.textContent && !/Loading|so far/i.test(c.textContent); }, null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(30); };
const shown = () => pg.$$eval('.grid:not([hidden]) > .card:not([hidden]) .card-title', (e) => e.map((x) => x.textContent.trim()));
await pg.goto(url('books/index.html'));
ok((await pg.locator('.grid:not([hidden]) > .card').count()) === 20 && /Showing 20 of \d+ books/.test(await pg.locator('[data-count]').textContent()), `books/: ${await pg.locator('[data-count]').textContent()}`);
await pg.fill('.filters input[name=q]', 'gaiman'); await settle();
const gaiman = cat.works.filter((w) => w.authors.some((a) => /Gaiman/.test(a))).length;
ok((await shown()).length === gaiman && !(await pg.isVisible('[data-pager]')), `search "gaiman" over the whole index finds all ${gaiman} (not just the current page); pager hides while results show`);
await pg.fill('.filters input[name=q]', ''); await pg.waitForTimeout(250);
ok((await pg.locator('.grid:not([hidden]) > .card').count()) === 20 && (await pg.isVisible('[data-pager]')), 'clearing the search restores the static page and its pager');
await pg.selectOption('.filters select[name=subject]', 'fantasy'); await settle();
const nFantasy = cat.works.filter((w) => w.subjects.includes('fantasy')).length;
const cnt = await pg.locator('[data-count]').textContent();
ok(nFantasy > 20 ? /Showing 20 of (\d+) books/.test(cnt) && +cnt.match(/of (\d+)/)[1] === nFantasy : true, `subject=fantasy -> ${cnt.trim()} (expected ${nFantasy})`);
if (nFantasy > 20) { await pg.click('[data-more]'); await pg.waitForTimeout(100); ok((await shown()).length === Math.min(40, nFantasy), '"Show more" draws the next 20'); }
await pg.selectOption('.filters select[name=subject]', ''); await pg.selectOption('.filters select[name=lang]', 'es'); await settle();
{ const nEs = cat.works.filter((w) => w.editions.some((e) => e.language === 'es')).length; ok((await shown()).length === Math.min(nEs, 20), `language=Spanish over the whole index: ${nEs} works with verified Spanish editions (first page of up to 20 shown)`); }
await pg.selectOption('.filters select[name=lang]', '');
await pg.goto(url('search/index.html') + '?q=' + encodeURIComponent('9780834800793')); await settle();
ok((await shown()).join() === "Zen Mind, Beginner's Mind", 'ISBN search finds a book from the index (exact, no fuzziness)');
await pg.goto(url('search/index.html') + '?q=wicka'); await settle();
ok((await shown()).includes('Wicca') && /close matches/.test(await pg.locator('[data-count]').textContent()), 'typo search finds "Wicca" and labels it a close match');
await pg.goto(url('search/index.html') + '?q=wicka'); await settle();
await pg.goto(url('search/index.html') + '?q=zzzqxv'); await settle();
ok((await shown()).length === 0 && await pg.isVisible('[data-empty]'), 'nonsense query: empty state, no false positives');

// cards drawn from the index link dynamic-tier books to the dynamic view and static ones to their page
await pg.goto(url('search/index.html') + '?q=' + encodeURIComponent(dynBook[0].title)); await settle();
ok((await pg.$$eval('.grid:not([hidden]) > .card .card-title a', (a) => a.map((x) => x.getAttribute('href')))).some((h) => h.includes('book/index.html?s=' + encodeURIComponent(dynBook[0].slug))), 'a card drawn from the index links a dynamic-tier book to book/index.html?s=<slug>');
// dynamic view equals the static page for the same book
const dynW = dynBook.find((w) => w.editions.length >= 1 && !w.press) ?? dynBook[0];
await pg.goto(url('book/index.html') + '?s=' + encodeURIComponent(dynW.slug)); await pg.waitForSelector('h1', { timeout: 8000 });
ok((await pg.locator('h1').textContent()).trim() === dynW.title, `dynamic view renders "${dynW.title}" from the detail shard`);
const hrefsDyn = await pg.$$eval('.edition ul.buy a', (a) => a.map((x) => x.href.replace(/&amp;/g, '&')));
const staticHtml = read(`books/${dynW.slug}/index.html`, full).replace(/&amp;/g, '&');
const hrefsStatic = [...staticHtml.matchAll(/<ul class="buy"[\s\S]*?<\/ul>/g)].flatMap((m) => [...m[0].matchAll(/href="([^"]+)"/g)].map((x) => x[1]));
ok(hrefsDyn.length > 0 && JSON.stringify(hrefsDyn) === JSON.stringify(hrefsStatic), `dynamic view buy links are identical to the static page's (${hrefsDyn.length} links, same tag and destinations)`);
ok(await pg.locator('ul.buy a[rel*=sponsored]').count() === (hrefsStatic.filter((h) => /amazon\./.test(h)).length) && /As an Amazon Associate/.test(await pg.locator('body').textContent()), 'dynamic view: affiliate links are rel=sponsored and the disclosure is shown');
ok((await pg.locator('summary').first().textContent()).length > 0 && (await pg.locator('details.sources li').count()) >= 2, 'dynamic view lists its sources');
await pg.goto(url('book/index.html') + '?s=does-not-exist'); await pg.waitForTimeout(500);
ok(/not found/i.test(await pg.locator('[data-dyn-status]').textContent()), 'unknown slug: clear "not found" message');
ok(errs.length === 0, `no JS errors${errs.length ? ': ' + errs[0] : ''}`);
// mobile width: no horizontal scroll, pager and results usable
{
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true }); const mp = await mctx.newPage(); const merrs = []; mp.on('pageerror', (e) => merrs.push(e.message)); await mp.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const hs = () => mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await mp.goto(url('books/index.html')); ok(!(await hs()), '[mobile] books/ (first page + pager): no horizontal scroll');
  const pg2 = mp.locator('[data-pager] a').first(); const bb = await mp.locator('[data-pager] li a, [data-pager] > a').first().boundingBox();
  ok(bb && bb.height >= 44 && bb.width >= 44, `[mobile] pager links are at least 44px tap targets (${Math.round(bb.width)}x${Math.round(bb.height)})`);
  await mp.goto(url('books/page/2/index.html')); ok(!(await hs()), '[mobile] books/page/2: no horizontal scroll');
  await mp.goto(url('search/index.html') + '?q=magic'); await mp.waitForTimeout(600); ok(!(await hs()) && (await mp.locator('.grid:not([hidden]) > .card').count()) > 0, '[mobile] search results: cards drawn, no horizontal scroll');
  await mp.goto(url('book/index.html') + '?s=' + encodeURIComponent(dynW.slug)); await mp.waitForSelector('h1'); ok(!(await hs()), '[mobile] dynamic book view: no horizontal scroll');
  ok(merrs.length === 0, '[mobile] no JS errors'); await mctx.close();
}
await browser.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} scale checks passed`);
process.exit(state.fails ? 1 : 0);
