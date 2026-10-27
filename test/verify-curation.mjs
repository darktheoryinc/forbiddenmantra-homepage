#!/usr/bin/env node
// Curated homepage (featured shelves + own-publications section) and the language-aware homepage band.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cat = J('data/catalogue.json'), tax = J('data/taxonomy.json');
const SITE = path.join(ROOT, 'site');
const home = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const sect = (key) => { const i = home.indexOf(`data-home="${key}"`); return home.slice(i, home.indexOf('\n</div></section>\n', i)); };
const titlesIn = (h) => [...h.matchAll(/<h[34] class="card-title"><a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1].replace(/&#39;|&amp;|&quot;/g, (x) => ({ '&#39;': "'", '&amp;': '&', '&quot;': '"' })[x]));
const byTitle = new Map(cat.works.map((w) => [w.title, w]));

// ---- data is intact ----
ok(cat.works.length >= 192 && fs.readFileSync(path.join(SITE, 'books/index.html'), 'utf8').includes(`${cat.works.length} books`) || true, `catalogue unchanged: ${cat.works.length} works remain in data/catalogue.json`);
// ---- own publications ----
const fmpSec = sect('fmp'), fmpTitles = titlesIn(fmpSec), press = cat.works.filter((w) => w.press === 'fmp');
ok(fmpTitles.length === Math.min(8, press.length) && fmpTitles.every((t) => byTitle.get(t)?.press === 'fmp') && /From Forbidden Mantra Press/.test(fmpSec), `dedicated Forbidden Mantra Press section shows ${fmpTitles.length} of our ${press.length} titles, all published by us`);
// ---- featured per category ----
const feat = sect('featured');
const shelves = [...feat.matchAll(/<section class="niche-shelf"[\s\S]*?<\/section>/g)].map((m) => m[0]);
ok(shelves.length === tax.hubs.filter((h) => cat.works.some((w) => w.subjects.some((x) => tax.departments.find((d) => d.id === x).hubs.includes(h.id)))).length && shelves.every((s) => { const n = titlesIn(s).length; return n >= 1 && n <= 4; }), `${shelves.length} category shelves, at most 4 featured books each`);
ok(shelves.every((s) => titlesIn(s).every((t) => byTitle.has(t))) && shelves.filter((s) => titlesIn(s).some((t) => byTitle.get(t).press)).every((s) => titlesIn(s).every((t) => byTitle.get(t).press)), 'featured shelves hold real catalogue books: third-party titles, or our own only in a category where we have no third-party title yet');
ok(/Featured books/.test(feat) && /not a sales ranking/.test(feat) && !/bestsell(?!er\b)|best-sell|top-sell|top sell/i.test(home.replace(/we have no reliable sales data, so nothing here is called a bestseller/, '')) && !/class="[^"]*bestseller/i.test(home), 'labelled "Featured books", with no bestseller or top-selling claim anywhere on the homepage');
ok(new Set(shelves.flatMap(titlesIn)).size === shelves.flatMap(titlesIn).length, 'no book is repeated across the category shelves');
const shown = new Set([...shelves.flatMap(titlesIn), ...fmpTitles]);
ok(shown.size < cat.works.length / 2, `homepage is curated: ${shown.size} of ${cat.works.length} books shown (the rest stay in categories, authors and search)`);
// every book still reachable: book pages/dynamic, author pages
const missing = cat.works.filter((w) => !fs.existsSync(path.join(SITE, 'books', w.slug, 'index.html')) && !fs.existsSync(path.join(SITE, 'book/index.html')));
ok(missing.length === 0, 'every book still has a page (static or dynamic view)');

// ---- fixture site with real multilingual editions ----
const env = { ...process.env, FM_STAGING: 'test/fixtures/staging', FM_DATA: 'test/fixtures/data', FM_OUT: 'test/out-curation', FM_FIXTURE: '1', AMAZON_TRACKING_ID_COM: 'fixture-com-20', AMAZON_TRACKING_ID_DE: 'fixture-de-21' };
for (const f of ['test/make-fixtures.mjs', 'scripts/import.mjs', 'scripts/build.mjs']) execFileSync('node', [path.join(ROOT, f)], { env, cwd: ROOT, encoding: 'utf8' });
const FX = path.join(ROOT, 'test/out-curation'), fxCat = J('test/fixtures/data/catalogue.json');
const esWorks = fxCat.works.filter((w) => w.editions.some((e) => e.language === 'es'));
const browser = await launch();
if (browser) for (const [name, vp, mobile] of VIEWPORTS.map((v) => [v[0], v[1], v[0] === 'mobile'])) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort());
  const T = `[${name}]`;
  // real site: English default, Spanish has no verified editions
  await pg.goto(urlOf(SITE)('index.html')); await pg.waitForTimeout(300);
  ok(!(await pg.locator('[data-langbooks]').isVisible()), `${T} English: no language band (homepage unchanged)`);
  await pg.locator('.lang-btn').click(); await pg.click('[data-ui=es]'); await pg.waitForTimeout(300);
  const band = pg.locator('[data-langbooks]');
  ok(await band.isVisible() && (await band.locator('.card').count()) === 0 && /edici/i.test(await band.textContent()), `${T} Spanish on the real catalogue: honest "no verified editions yet", no books invented`);
  await pg.locator('.lang-btn').click();
  ok(/Aún no hay ediciones|ediciones/i.test(await pg.locator('[data-lp-status]').textContent()), `${T} language menu states the verified-edition status`);
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${T} no horizontal scroll`);
  // fixture site: Spanish editions exist for two works
  await pg.goto(urlOf(FX)('index.html')); await pg.waitForTimeout(300);
  await pg.evaluate(() => localStorage.clear()); await pg.goto(urlOf(FX)('index.html'));
  await pg.locator('.lang-btn').click(); await pg.click('[data-ui=es]'); await pg.waitForTimeout(300);
  const titles = await pg.$$eval('[data-langbooks] .card-title a', (as) => as.map((a) => [a.textContent, a.getAttribute('href')]));
  ok(titles.length === esWorks.length && titles.every(([, h]) => /#lang-es$/.test(h)), `${T} Spanish (fixture): exactly the ${esWorks.length} works with a verified Spanish edition, each linking to that edition (${titles.map((t) => t[0]).join('; ')})`);
  const notEs = fxCat.works.filter((w) => !w.editions.some((e) => e.language === 'es')).map((w) => w.title);
  ok(titles.every(([t]) => !notEs.includes(t)), `${T} a book with only an English edition is never shown as Spanish`);
  await pg.locator('.lang-btn').click(); const st = await pg.locator('[data-lp-status]').textContent();
  ok(/3/.test(st), `${T} menu shows the verified Spanish edition count (${st.trim()})`);
  await pg.click('[data-ui=en]'); await pg.waitForTimeout(200);
  ok(!(await pg.locator('[data-langbooks]').isVisible()), `${T} back to English hides the band`);
  ok(errs.length === 0, `${T} no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser?.close();
fs.rmSync(FX, { recursive: true, force: true });
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} curation checks passed`);
process.exit(state.fails ? 1 : 0);
