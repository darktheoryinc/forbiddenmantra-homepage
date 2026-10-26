#!/usr/bin/env node
// Multilingual behaviour on FICTIONAL fixtures: node test/verify-multilingual.mjs [--shots]
// Builds fixtures -> test/fixtures/data, site -> test/out. Nothing here touches the real catalogue.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, checkLinks, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, FM_STAGING: 'test/fixtures/staging', FM_DATA: 'test/fixtures/data', FM_OUT: 'test/out', FM_FIXTURE: '1', AMAZON_TRACKING_ID_COM: 'fixture-com-20', AMAZON_TRACKING_ID_DE: 'fixture-de-21' };
const run = (f) => execFileSync('node', [path.join(ROOT, f)], { env, cwd: ROOT, encoding: 'utf8' });
run('test/make-fixtures.mjs'); run('scripts/import.mjs'); run('scripts/build.mjs');
const SITE = path.join(ROOT, 'test/out');
const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/data/import-report.json'), 'utf8'));
const q = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/data/error-queue.json'), 'utf8')).items;
const html = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');

// ---- import pipeline ----
const by = rep.publishedByLanguage;
ok(rep.published.works === 3 && rep.published.editions === 10, `import: 3 works / 10 editions published (rejected records excluded)`);
ok(by.en.editions === 4 && by.es.editions === 3 && by.es.works === 2 && by.de.editions === 1 && by.ar.editions === 1 && by.fr.editions === 1, `import: per-language editions en=${by.en.editions} es=${by.es.editions}(${by.es.works} works) de=${by.de.editions} ar=${by.ar.editions} fr=${by.fr.editions}`);
ok(by.sa.editions === 1 && by.sa.works === 1, 'import: bilingual edition (language en, alsoLanguages sa) also counts for Sanskrit');
ok(!by.it, 'import: an Italian lead is NOT counted as a published Italian edition');
ok(q.some((i) => /needs its own dated source/.test(i.reasons.join())), 'rejected: Spanish edition without its own source');
ok(q.some((i) => /unknown language code "xx"/.test(i.reasons.join())), 'rejected: unknown language code');
ok(q.some((i) => /not a published work/.test(i.reasons.join())), 'rejected: translation staged against a non-existent work');
ok(q.some((i) => i.severity === 'duplicate' && /already has a published es paperback/.test(i.reasons.join())), 'flagged: staged edition duplicates a published language+format');
ok(rep.stagedEditions === 1 && rep.editionLeads.total === 1, 'staged: 1 candidate German edition staged (unpublished); 1 lead kept (unpublished)');
const L = checkLinks(SITE);
ok(L.broken.length === 0, `fixture site: ${L.pages} pages, ${L.internal} internal links resolve${L.broken.length ? '\n  ' + L.broken.slice(0, 10).join('\n  ') : ''}`);
ok(!fs.existsSync(path.join(SITE, 'books/fixture-unsourced-translation')) && !fs.existsSync(path.join(SITE, 'books/fixture-bad-language')), 'rejected records have no pages');
ok(!/Fiktiver Begleiter|Traducción sin fuente/.test(Object.keys({}).length ? '' : fs.readdirSync(path.join(SITE, 'books')).map((d) => (fs.existsSync(path.join(SITE, 'books', d, 'index.html')) ? html(`books/${d}/index.html`) : '')).join('')), 'staged/rejected edition titles appear nowhere on book pages');

// ---- static markup: affiliate per marketplace ----
const atlas = html('books/fixture-atlas-of-breath/index.html');
const buy = [...atlas.matchAll(/<a class="btn" href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
ok(buy.length === 6 && new Set(buy).size === 6, `atlas: 6 distinct Amazon destinations for 7 editions`);
ok(/No retailer link verified yet/.test(atlas), 'atlas: the English e-book (no verified retailer) says so instead of getting an invented link');
ok(buy.some((u) => u.includes('amazon.es/dp/FIXTURES01') && !/tag=/.test(u)) && buy.some((u) => u.includes('amazon.ae/dp/FIXTUREAR1') && !/tag=/.test(u)) && buy.some((u) => u.includes('amazon.fr/dp/FIXTUREFR1') && !/tag=/.test(u)), 'marketplaces without a tracking ID (.es .ae .fr) produce untagged links');
ok(buy.some((u) => u.includes('amazon.de/dp/FIXTUREDE1') && u.includes('tag=fixture-de-21')), 'amazon.de link carries the amazon.de tracking ID');
ok(buy.some((u) => /amazon\.com\/dp\/\w+\?tag=fixture-com-20/.test(u)) && !buy.some((u) => u.includes('amazon.de') && u.includes('fixture-com-20')), 'amazon.com links carry the .com tag, and the .com tag never leaks onto .de');
ok(!buy.some((u) => u.includes('amazon.es') && u.includes('tag=')), 'Spanish-marketplace link is not given another marketplace’s tag');
ok(/Amazon\.de|Amazon\.es|Amazon\.fr|Amazon\.ae/.test(atlas), 'button labels name the marketplace (Amazon.de, Amazon.es …)');
const groups = [...atlas.matchAll(/class="lang-group" id="lang-(\w+)"/g)].map((m) => m[1]);
ok(groups.join() === 'en,es,de,ar,fr', `edition groups by language: ${groups.join(', ')}`);
ok(/dir="rtl" lang="ar"|lang="ar" dir="rtl"/.test(atlas) && atlas.includes('أطلس النفس الوهمي'), 'Arabic edition is marked lang="ar" dir="rtl" and shows its own title');
ok(atlas.includes('Atlas Ficticio del Aliento') && atlas.includes('Fixture Translator'), 'Spanish edition shows its own title and translator');
ok(atlas.includes('FIXTURE source for es-paperback'), 'each non-English edition lists its own source under “Sources and verification”');
ok(html('index.html').includes('TEST FIXTURE BUILD'), 'fixture builds are visibly labelled as test data');
const lang = html('languages/index.html');
ok(/English[\s\S]{0,200}3 works · 4 editions/.test(lang) && /Español[\s\S]{0,200}2 works · 3 editions/.test(lang) && /italiano|Italiano/.test(lang) && /Italiano[\s\S]{0,200}no verified editions yet/.test(lang), 'languages index shows computed counts; Italian (lead only) reads “no verified editions yet”');

// ---- browser ----
const browser = await launch(); if (!browser) process.exit(state.fails ? 1 : 0);
const shots = process.argv.includes('--shots'); const SH = path.join(ROOT, 'docs/screenshots'); if (shots) fs.mkdirSync(SH, { recursive: true });
const url = urlOf(SITE);
for (const [name, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile', deviceScaleFactor: 1 }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const T = `[fixture ${name}]`;
  const visible = () => pg.$$eval('.card:not([hidden])', (c) => c.map((x) => x.querySelector('.card-title').textContent.trim()));
  const meta = () => pg.$$eval('.card:not([hidden]) .card-meta', (c) => c.map((x) => x.textContent.trim()));
  const hscroll = () => pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const snap = async (f, full = false) => shots && pg.screenshot({ path: path.join(SH, `fixture-${name}-${f}.png`), fullPage: full });
  const sel = (k, v) => pg.selectOption(`select[name=${k}]`, v);

  await pg.goto(url('books/index.html')); await snap('books');
  const og = await pg.locator('select[name=lang] optgroup').evaluateAll((g) => g.map((x) => [...x.querySelectorAll('option')].map((o) => o.textContent.replace(/\s+/g, ' ').trim())));
  ok(og[0].length === 6 && og[0][0].startsWith('English (3)') && og[0].some((t) => t.startsWith('Español · Spanish (2)')) && og[0].some((t) => t.startsWith('संस्कृतम् · Sanskrit (1)')), `${T} filter lists ${og[0].length} languages with editions (${og[0].slice(0, 3).join(' | ')} …) and ${og[1].length} marked none`);
  ok(!og[0].some((t) => t.includes('Italiano')) && og[1].some((t) => t.includes('Italiano') && t.endsWith('(0)')), `${T} Italian (lead only) stays under "None yet" with (0)`);
  await sel('lang', 'es'); ok((await visible()).length === 2, `${T} language=Spanish -> 2 works`);
  ok((await visible()).includes('Atlas Ficticio del Aliento') && (await visible()).includes('Guía Compañera Ficticia'), `${T} Spanish view shows the Spanish edition titles: ${(await visible()).join(' / ')}`);
  ok((await meta()).every((m) => /Spanish/.test(m) && !/English/.test(m)), `${T} card meta shows only Spanish formats/language: ${(await meta()).join(' || ')}`);
  await sel('format', 'ebook'); ok((await visible()).join() === 'Atlas Ficticio del Aliento', `${T} Spanish + e-book -> only the work with a Spanish e-book (the companion has an English e-book and a Spanish paperback, so it must NOT match)`);
  await sel('format', 'paperback'); ok((await visible()).length === 2, `${T} Spanish + paperback -> 2`);
  await sel('format', 'audiobook'); ok((await visible()).length === 0 && /No verified Spanish editions match/.test(await pg.locator('[data-empty-text]').textContent()), `${T} Spanish + audiobook -> empty state names Spanish`);
  await sel('lang', 'fr'); ok((await visible()).join() === 'Atlas fictif du souffle', `${T} French + audiobook -> French title`);
  await sel('format', ''); await sel('lang', 'en'); await sel('format', 'paperback'); ok((await visible()).length === 2 && !(await visible()).includes('Fixture Companion Guide'), `${T} English + paperback -> 2 (companion excluded: its English edition is an e-book)`);
  await sel('format', ''); await sel('lang', 'sa'); ok((await visible()).join() === 'Fixture Sanskrit Reader', `${T} Sanskrit -> bilingual edition found`);
  await sel('lang', 'ar'); ok((await visible()).join() === 'أطلس النفس الوهمي', `${T} Arabic -> Arabic title`);
  await sel('lang', 'it'); ok((await visible()).length === 0 && await pg.isVisible('[data-empty]'), `${T} Italian -> empty state (a lead is not an edition)`);
  await sel('lang', 'es'); const href = await pg.locator('.card:not([hidden]) .card-title a').first().getAttribute('href'); ok(href.endsWith('#lang-es'), `${T} Spanish card links to that language's edition group (${href.split('/').slice(-2).join('/')})`);
  await sel('lang', ''); await pg.fill('.filters input[name=q]', 'ficticia'); ok((await visible()).length === 2, `${T} search finds works by an edition's Spanish title or publisher ("ficticia")`);
  await pg.fill('.filters input[name=q]', 'aliento'); ok((await visible()).join() === 'Fixture Atlas of Breath', `${T} search by a word only in a translated edition title ("aliento") finds the work`);
  await pg.fill('.filters input[name=q]', 'Fixture Translator'); ok((await visible()).length === 1, `${T} search finds by translator`);
  await pg.fill('.filters input[name=q]', 'español'); ok((await visible()).length === 2, `${T} search by language endonym ("español") finds Spanish-edition works`);
  await pg.fill('.filters input[name=q]', 'Fiktiver Begleiter'); ok((await visible()).length === 0, `${T} staged (unpublished) German edition is not searchable`);

  await pg.goto(url('books/fixture-atlas-of-breath/index.html')); await snap('book', true);
  ok((await pg.locator('.lang-group').count()) === 5 && (await pg.locator('.edition').count()) === 7, `${T} book page: 7 editions in 5 language groups`);
  await pg.click('.avail a >> text=Español'); ok(pg.url().endsWith('#lang-es'), `${T} language chip jumps to the Spanish group`);
  ok(!(await hscroll()), `${T} multi-language book page: no horizontal scroll`);
  await pg.goto(url('languages/es/index.html')); await snap('lang-es', true);
  ok((await pg.locator('.card').count()) === 2 && /2 works · 3 editions/.test(await pg.locator('.stats').first().textContent()), `${T} Spanish page: 2 works, 3 editions`);
  ok((await pg.locator('.card-title a').first().textContent()).includes('Ficticio'), `${T} Spanish page cards use Spanish titles`);
  await pg.goto(url('languages/it/index.html')); ok(await pg.isVisible('[data-lang-empty]') && (await pg.locator('.card').count()) === 0, `${T} Italian page: empty state despite a reported lead`);
  await pg.goto(url('topics/yoga/index.html')); ok((await pg.locator('.lang-chips a').count()) >= 3, `${T} subject page lists the languages available within it`);
  await pg.goto(url('topics/yoga/index.html') + '?lang=es'); ok((await visible()).length === 2, `${T} subject page + ?lang=es -> language filter inside an existing subject`);
  await pg.goto(url('authors/fixture-author-one/index.html')); ok((await pg.locator('select[name=lang]').count()) === 1, `${T} author page has a language filter`); await sel('lang', 'de'); ok((await visible()).length === 1, `${T} author page: German -> 1`);
  await pg.goto(url('collections/fixture-collection/index.html')); await sel('lang', 'es'); ok((await visible()).length === 2, `${T} collection page: Spanish -> 2`);
  await pg.goto(url('traditions/secular/index.html')); await sel('lang', 'fr'); ok((await visible()).length === 1, `${T} tradition page: French -> 1`);
  await pg.goto(url('index.html')); await pg.locator('.lang-btn').click();
  const panelBooks = await pg.locator('.lp-books').first().locator('li').allTextContents();
  ok(panelBooks.length === 6 && panelBooks.some((t) => /Español\s*3 editions/.test(t.replace(/\s+/g, ' '))) && panelBooks.some((t) => /English\s*4 editions/.test(t.replace(/\s+/g, ' '))), `${T} dropdown "Books by language" shows ${panelBooks.length} languages with edition counts: ${panelBooks.map((t) => t.replace(/\s+/g, ' ').trim()).join(', ')}`);
  await pg.click('[data-ui=ar]'); await pg.goto(url('books/fixture-atlas-of-breath/index.html')); await snap('ui-ar-book', true);
  ok(!(await hscroll()), `${T} Arabic interface on a multi-language book page: no horizontal scroll`);
  ok((await pg.locator('.edition[lang=ar]').getAttribute('dir')) === 'rtl', `${T} Arabic edition stays rtl while the page content is LTR`);
  ok(errs.length === 0, `${T} no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} fixture checks passed`);
process.exit(state.fails ? 1 : 0);
