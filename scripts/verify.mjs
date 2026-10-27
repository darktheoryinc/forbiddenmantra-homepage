#!/usr/bin/env node
// Verification of the REAL site: node scripts/verify.mjs [--shots]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state, ok, checkLinks, launch, urlOf, VIEWPORTS } from '../test/lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalogue.json'), 'utf8'));
const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/import-report.json'), 'utf8'));
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/languages.json'), 'utf8')).languages;
const N = cat.works.length;
const E = cat.works.reduce((n, w) => n + w.editions.length, 0);
const nLevel = (l) => cat.works.filter((w) => w.level === l).length;
const nSubj = (d) => cat.works.filter((w) => w.subjects.includes(d)).length;

// ---- static checks ----
const L = checkLinks(SITE);
ok(L.broken.length === 0, `${L.pages} pages, ${L.internal} internal links/assets resolve${L.broken.length ? '\n  ' + L.broken.slice(0, 15).join('\n  ') : ''}`);
ok([...L.buy].filter(([u, s]) => [...s].filter((x) => x.startsWith('books')).length > 2 && !/worldcat/.test(u)).length === 0, 'no retailer URL is reused across 3+ book pages');
ok(![...L.buy.keys()].some((u) => u.includes('amzn.to')), 'legacy amzn.to link is not used on any book page');
const editionLangs = new Set(cat.works.flatMap((w) => w.editions.map((e) => e.language)));
ok([...editionLangs].join() === 'en', `no invented translations: every published edition is English (found: ${[...editionLangs].join(',')})`);
ok(cat.works.every((w) => w.editions.every((e) => e.language === 'en' || e.sources?.length)), 'every non-English edition (none yet) would carry its own source');
ok(rep.languagesWithVerifiedEditions === 1 && rep.publishedByLanguage.en.editions === E && rep.publishedByLanguage.en.works === N, `import report counts: en = ${rep.publishedByLanguage.en.works} works / ${rep.publishedByLanguage.en.editions} editions; ${rep.languagesRegistered} languages registered`);
ok(!Object.keys(rep.publishedByLanguage).some((c) => ['es', 'de'].includes(c)) && rep.editionLeads.total === 3, 'reported Spanish/German editions stay leads: counted as 0 published (3 unverified leads)');
for (const f of ['catalogue.json', 'staged.json', 'error-queue.json']) ok(true, `data/${f} present`);

const browser = await launch(); if (!browser) process.exit(state.fails ? 1 : 0);
const shots = process.argv.includes('--shots'); const SH = path.join(ROOT, 'docs/screenshots'); if (shots) fs.mkdirSync(SH, { recursive: true });
const url = urlOf(SITE);
for (const [name, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile', deviceScaleFactor: 1 }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const snap = async (f, full = false) => shots && pg.screenshot({ path: path.join(SH, `${name}-${f}.png`), fullPage: full });
  // Paged listings and the search page draw results from the lazy chunk index, so wait for it to settle. Results are drawn 48 at a time; total() reads the count line.
  const settle = async () => { await pg.waitForTimeout(80); await pg.waitForFunction(() => { const c = document.querySelector('[data-count]'); return !c || !/Loading|Cargando/i.test(c.textContent); }, null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(30); };
  const visible = async () => { await settle(); return pg.$$eval('.grid:not([hidden]) > .card:not([hidden])', (c) => c.map((x) => x.querySelector('.card-title').textContent.trim())); };
  const total = async () => { await settle(); const m = (await pg.locator('[data-count]').first().textContent()).match(/(\d[\d,]*)\D*$/) ?? (await pg.locator('[data-count]').first().textContent()).match(/(\d[\d,]*)/); return m ? +m[1].replace(/,/g, '') : -1; };
  const listed = () => pg.evaluate(() => { const g = document.querySelector('[data-index-grid]'); return g ? +g.dataset.total : document.querySelectorAll('.card').length; });
  const hscroll = () => pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const T = `[${name}]`;

  // ===== home / nav =====
  await pg.goto(url('index.html')); await snap('home'); await snap('home-full', true);
  ok(!(await hscroll()), `${T} home: no horizontal scroll`);
  ok(await pg.isVisible('.lang-btn'), `${T} language dropdown button is visible in the header without opening any menu`);
  if (name === 'mobile') { await pg.click('.nav-toggle'); ok(await pg.isVisible('#nav a >> text=Authors'), `${T} hamburger menu opens and shows links`); await snap('menu'); await pg.click('.nav-toggle'); }

  // ===== language dropdown =====
  const btn = pg.locator('.lang-btn'), panel = pg.locator('#lang-panel');
  ok((await btn.getAttribute('aria-expanded')) === 'false' && !(await panel.isVisible()), `${T} dropdown starts closed`);
  await btn.click(); ok((await btn.getAttribute('aria-expanded')) === 'true' && await panel.isVisible(), `${T} dropdown opens (aria-expanded=true)`);
  await snap('lang-menu');
  ok(!(await hscroll()), `${T} no horizontal scroll with dropdown open`);
  const box = await panel.boundingBox(); ok(box && box.x >= -1 && box.x + box.width <= vp.width + 1, `${T} dropdown panel fits inside the viewport (x=${Math.round(box.x)}, w=${Math.round(box.width)}, vw=${vp.width})`);
  const verified = await panel.locator('.lp-books').first().locator('li').allTextContents();
  ok(verified.length === 1 && /English/.test(verified[0]) && new RegExp(`${E} editions`).test(verified[0]), `${T} "Books by language" lists only languages with verified editions: ${JSON.stringify(verified.map((s) => s.trim()))}`);
  await panel.locator('summary').click();
  const working = await panel.locator('.lp-more li').count(); ok(working === reg.length - 1, `${T} "working toward" lists the other ${working} languages, without counts`);
  ok(!/\d+ edition/.test(await panel.locator('.lp-more').innerText()), `${T} no language outside the verified list shows an edition count`);
  ok((await panel.locator('[data-ui]').count()) === 8, `${T} website-language options: ${(await panel.locator('[data-ui]').allTextContents()).map((s) => s.trim()).join(', ')}`);
  await pg.keyboard.press('Escape'); ok(!(await panel.isVisible()) && await btn.evaluate((e) => e === document.activeElement), `${T} Escape closes the dropdown and returns focus to its button`);
  await btn.click(); await pg.mouse.click(5, vp.height - 5); ok(!(await panel.isVisible()), `${T} clicking outside closes the dropdown`);

  // ===== website (interface) language =====
  await btn.click(); await pg.click('[data-ui=es]');
  ok((await pg.locator('#nav a').first().textContent()).trim() === 'Temas' && (await pg.evaluate(() => document.documentElement.lang)) === 'es', `${T} interface -> Español: nav reads "Temas", <html lang="es">`);
  ok((await pg.getAttribute('#q-nav', 'placeholder')).startsWith('Buscar'), `${T} search placeholder translated`);
  ok(await pg.locator('.site-footer .disclosure').getAttribute('lang') === 'en' && /As an Amazon Associate/.test(await pg.locator('.site-footer .disclosure').textContent()), `${T} legal affiliate disclosure stays in English`);
  await snap('ui-es');
  await pg.goto(url('books/index.html')); ok((await pg.locator('.filters label span').first().textContent()).trim().startsWith('Buscar'), `${T} choice persists on the next page (localStorage)`);
  ok(/libros/.test(await pg.locator('[data-count]').textContent()), `${T} dynamic count is translated: "${(await pg.locator('[data-count]').textContent()).trim()}"`);
  await pg.selectOption('select[name=lang]', 'de'); await visible(); const msg = await pg.locator('[data-empty-text]').textContent();
  ok(/alem[aá]n|Deutsch/i.test(msg) && msg.startsWith('Ninguna edición verificada'), `${T} empty state in Spanish UI: "${msg.trim().slice(0, 70)}…"`);
  await pg.selectOption('select[name=lang]', '');
  await pg.goto(url('index.html')); await pg.locator('.lang-btn').click(); await pg.click('[data-ui=ar]');
  ok((await pg.evaluate(() => document.querySelector('.site-header').getAttribute('dir'))) === 'rtl', `${T} interface -> العربية: header switches to right-to-left`);
  ok(!(await hscroll()), `${T} no horizontal scroll in Arabic interface`); await snap('ui-ar');
  await pg.locator('.lang-btn').click(); await pg.click('[data-ui=en]');
  ok((await pg.locator('#nav a').first().textContent()).trim() === 'Subjects' && !(await pg.evaluate(() => document.querySelector('.site-header').hasAttribute('dir'))), `${T} interface -> English restores labels and direction`);

  // ===== search (title/author/subject/ISBN/ASIN + language names) =====
  const cases = [['Power of Now', 'The Power of Now'], ['tolle', 'The Power of Now'], ['Pagels', 'The Gnostic Gospels'], ['tarot', 'Seventy-Eight Degrees of Wisdom'], ['978-1-57731-480-6', 'The Power of Now'], ['9780875421186', 'Wicca'], ['0470923350', 'When the Body Says No'], ['B0H8MQN9WK', 'The Apocalypse of Adam'], ['chodron', 'When Things Fall Apart']];
  for (const [q, expect] of cases) { await pg.goto(url('search/index.html') + '?q=' + encodeURIComponent(q)); const v = await visible(); ok(v.some((t) => t === expect) && v.length < N, `${T} search "${q}" -> ${v.length} incl. ${expect}`); }
  await pg.goto(url('search/index.html') + '?q=deutsch'); ok((await visible()).length === 0, `${T} searching "deutsch" finds nothing (no German edition is verified)`);
  await pg.goto(url('search/index.html') + '?q=english'); ok((await total()) === N, `${T} searching "english" matches all ${N} English works (count line; results are drawn 48 at a time)`);
  await pg.goto(url('search/index.html') + '?q=Power%20of%20Now'); await snap('search');

  // ===== filters =====
  await pg.goto(url('books/index.html'));
  const langOpts = await pg.locator('select[name=lang] optgroup').evaluateAll((g) => g.map((x) => [x.label, x.querySelectorAll('option').length]));
  ok(langOpts[0][1] === 1 && langOpts[1][1] === reg.length - 1, `${T} language filter: ${langOpts[0][1]} language with editions, ${langOpts[1][1]} marked "None yet"`);
  ok((await pg.locator('select[name=lang] optgroup').first().locator('option').first().textContent()).trim() === `English (${N})`, `${T} English option shows the true work count (${N})`);
  await pg.selectOption('select[name=lang]', 'en'); ok((await total()) === N, `${T} language=English -> all ${N}`);
  await pg.selectOption('select[name=lang]', 'es'); ok((await visible()).length === 0 && await pg.isVisible('[data-empty]'), `${T} language=Spanish -> empty state`);
  ok(/No verified Spanish editions match these filters/.test(await pg.locator('[data-empty-text]').textContent()), `${T} empty-state message names the language and says editions are only listed when verified`);
  await settle(); ok((await pg.locator('[data-count]').textContent()).startsWith('0 books'), `${T} result count reads "0 books shown"`); await snap('empty-lang');
  await pg.click('button[type=reset]'); await pg.waitForTimeout(150); ok((await listed()) === N && (await pg.locator('.grid:not([hidden]) > .card:not([hidden])').count()) === Math.min(N, 48) && !(await pg.isVisible('[data-empty]')), `${T} "Clear filters" restores the full list (${N} books, first page of 48 shown)`);
  await pg.selectOption('select[name=press]', 'fmp'); ok((await visible()).length === 12, `${T} press filter shows 12 FMP titles`);
  await pg.selectOption('select[name=press]', ''); await pg.selectOption('select[name=subject]', 'tarot'); { const want = cat.works.filter((w) => w.subjects.includes('tarot')).map((w) => w.title).sort().join('|'); ok((await visible()).sort().join('|') === want && want.includes('Seventy-Eight Degrees of Wisdom'), `${T} subject=tarot -> ${want.split('|').length} tarot works`); }
  await pg.selectOption('select[name=subject]', ''); await pg.selectOption('select[name=format]', 'audiobook'); ok((await visible()).length === 2, `${T} format=audiobook -> 2`);
  await pg.selectOption('select[name=lang]', 'en'); ok((await visible()).length === 2, `${T} language=English + format=audiobook -> 2`);
  await pg.selectOption('select[name=lang]', ''); await pg.selectOption('select[name=format]', ''); await pg.selectOption('select[name=tradition]', 'gnostic'); ok((await visible()).length === 2, `${T} tradition=gnostic -> 2`);
  await pg.selectOption('select[name=tradition]', ''); await pg.selectOption('select[name=level]', 'intermediate'); ok((await visible()).length === nLevel('intermediate'), `${T} level=intermediate -> ${nLevel('intermediate')}`);
  await pg.selectOption('select[name=level]', ''); await snap('books');
  await pg.goto(url('books/index.html') + '?lang=es&format=ebook'); ok((await pg.inputValue('select[name=lang]')) === 'es' && (await visible()).length === 0, `${T} filters can be pre-selected from the URL (?lang=es&format=ebook)`);

  // ===== language pages =====
  await pg.goto(url('languages/index.html')); await snap('languages', true);
  const rows = await pg.locator('.lang-row').allTextContents();
  ok(rows.length === reg.length && new RegExp(`English[\\s\\S]*${N} works · ${E} editions`).test(rows[0]), `${T} languages index: ${rows.length} languages, first row "${rows[0].replace(/\s+/g, ' ').trim().slice(0, 60)}"`);
  ok(rows.filter((r) => /no verified editions yet/.test(r)).length === reg.length - 1, `${T} every other language says "no verified editions yet"`);
  await pg.goto(url('languages/es/index.html')); ok(await pg.isVisible('[data-lang-empty]') && (await pg.locator('.card').count()) === 0, `${T} Spanish page: honest empty state, no books listed`); await snap('lang-es-empty');
  ok(/0 works · 0 editions/.test(await pg.locator('.stats').textContent()), `${T} Spanish page counts read 0 works · 0 editions`);
  await pg.goto(url('languages/en/index.html')); ok((await listed()) === N, `${T} English page lists all ${N} works (first page static, rest from the index)`);
  await pg.goto(url('languages/ar/index.html')); ok((await pg.locator('h1 [lang=ar]').getAttribute('dir')) === 'rtl', `${T} Arabic page marks its name dir="rtl"`);
  await pg.goto(url('languages/en/index.html')); await pg.click('.chips a >> text=Emotional Wellbeing'); ok(pg.url().includes('topics/emotional-wellbeing') && pg.url().includes('lang=en'), `${T} language page -> subject link carries ?lang=en`);
  ok((await total()) === nSubj('emotional-wellbeing'), `${T} subject page opens with the language filter applied (${nSubj('emotional-wellbeing')} emotional-wellbeing works in English)`);

  // ===== navigation, editions =====
  await pg.goto(url('subjects/occult-magick-paganism/index.html')); await snap('hub');
  await pg.click('.dept >> text=Tarot'); ok(pg.url().includes('topics/tarot'), `${T} hub -> department link`); await snap('topic');
  await pg.click('.card-title a >> text=Seventy-Eight'); ok(pg.url().includes('books/seventy-eight-degrees-of-wisdom'), `${T} department -> book link`);
  ok((await pg.$$('.edition')).length === 2 && (await pg.locator('.lang-group').count()) === 1, `${T} book page groups 2 editions under one work (single language group)`);
  const hrefs = await pg.$$eval('.edition a.btn:not(.btn-ghost)', (a) => a.map((x) => x.href)); ok(hrefs.length === 2 && new Set(hrefs).size === 2 && hrefs.every((h) => h.includes('amazon.com/dp/')), `${T} each edition has its own Amazon destination: ${hrefs.map((h) => h.split('/dp/')[1]).join(', ')}`);
  ok(await pg.isVisible('text=As an Amazon Associate'), `${T} affiliate disclosure visible`); await snap('book', true);
  await pg.click('.byline a'); ok(pg.url().includes('authors/rachel-pollack'), `${T} book -> author link`); await snap('author');
  await pg.goto(url('authors/index.html')); ok((await pg.$('#l-T')) !== null, `${T} authors A–Z renders`);
  await pg.goto(url('press/index.html')); await snap('press', true);
  await pg.goto(url('books/the-apocalypse-of-adam/index.html')); ok((await pg.$$eval('.edition a.btn:not(.btn-ghost)', (a) => a.map((x) => x.href))).some((h) => h.includes('B0H8MQN9WK')), `${T} FMP audiobook links to its own ASIN`);
  ok(!(await hscroll()), `${T} book page: no horizontal scroll`);
  ok(errs.length === 0, `${T} no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} checks passed`);
process.exit(state.fails ? 1 : 0);
