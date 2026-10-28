#!/usr/bin/env node
// Discovery / launch-readiness features: node test/verify-discovery.mjs [--shots]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state, ok, checkLinks, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cat = J('data/catalogue.json'), tax = J('data/taxonomy.json'), col = J('data/collections.json'), rep = J('data/import-report.json');
const read = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8');
const pages = []; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? w(path.join(d, e.name)) : e.name.endsWith('.html') && pages.push(path.join(d, e.name)); })(SITE);
const byId = new Map(cat.works.map((w) => [w.id, w]));

// ===== catalogue integrity =====
const withSrc = cat.works.filter((w) => w.sources?.length && w.sources.every((s) => s.url && s.accessed));
ok(withSrc.length === cat.works.length, `every one of ${cat.works.length} published works has dated provenance`);
ok(cat.works.every((w) => w.editions.every((e) => !e.isbn13 || /^\d{13}$/.test(e.isbn13))), 'every ISBN-13 is well-formed (checksums enforced by the importer)');
const isbns = cat.works.flatMap((w) => w.editions.map((e) => e.isbn13).filter(Boolean));
ok(new Set(isbns).size === isbns.length, `no ISBN appears twice (${isbns.length} unique)`);
ok(tax.hubs.some((h) => h.id === 'fantasy-folklore-fiction') && ['fantasy', 'supernatural-fiction', 'folklore-fairy-tales', 'philosophy'].every((d) => tax.departments.some((x) => x.id === d)), 'new hub and departments exist (fantasy, supernatural & gothic fiction, folklore, philosophy)');
const per = (d) => cat.works.filter((w) => w.subjects.includes(d)).length;
ok(['fantasy', 'supernatural-fiction', 'folklore-fairy-tales', 'philosophy'].every((d) => per(d) >= 3), `new departments are populated: fantasy ${per('fantasy')}, supernatural ${per('supernatural-fiction')}, folklore ${per('folklore-fairy-tales')}, philosophy ${per('philosophy')}`);
ok(cat.works.filter((w) => w.press).length >= 18 && ['the-apocalypse-of-adam', 'mo-pai-nei-kung', 'kebra-nagast', 'forbidden-mantra'].every((id) => byId.has(id)), 'all 12 original Forbidden Mantra Press records are preserved (press titles have only grown)');
ok(['the-power-of-now', 'when-things-fall-apart', 'the-gnostic-gospels', 'seventy-eight-degrees-of-wisdom'].every((id) => byId.has(id)), 'the original 11 outside-author records are preserved');
const hp = byId.get('harry-potter-and-the-philosophers-stone');
ok(hp && hp.editions.length === 2 && hp.editions[0].title === "Harry Potter and the Sorcerer's Stone" && hp.editions[1].marketplace === 'amazon.co.uk', 'Harry Potter: one work, US and UK editions with their own titles, ISBNs and marketplaces');
ok(JSON.stringify(cat).match(/Hogwarts|Wizarding World|Warner Bros/i) === null, 'no franchise trademarks or artwork beyond titles are used in catalogue data');
const hpPage = read('books/harry-potter-and-the-philosophers-stone/index.html').replace(/&amp;/g, '&');
ok(/amazon\.com\/dp\/059035342X/.test(hpPage) && /amazon\.co\.uk\/dp\/1408855658/.test(hpPage), 'HP page: US edition links to amazon.com, UK edition to amazon.co.uk, each by its own ISBN-10');
ok(/not affiliated with, authorized by or endorsed by the author, the publishers or the rights holders of Harry Potter/.test(hpPage), 'HP page carries the independence notice');
const nonOfficial = pages.filter((p) => /official (harry potter|rowling|warner)|authorized (harry potter|retailer|reseller)|licensed (by|from) (warner|rowling|scholastic|bloomsbury)/i.test(fs.readFileSync(p, 'utf8')));
ok(nonOfficial.length === 0, 'no page claims official, licensed or authorized status for any franchise');
for (const c of col.collections.filter((x) => /potter|fantasy|myth|gothic/.test(x.id))) ok(read(`collections/${c.id}/index.html`).includes('not affiliated with, authorized by or endorsed by'), `collection "${c.title}" shows the independence disclaimer`);
for (const p of col.paths.filter((x) => /fantasy|potter/.test(x.id))) ok(read(`paths/${p.id}/index.html`).includes('not affiliated with, authorized by or endorsed by'), `path "${p.title}" shows the independence disclaimer`);
ok([...col.collections.flatMap((c) => c.works), ...col.paths.flatMap((p) => p.steps.map((s) => s.work))].every((id) => byId.has(id)), 'every collection and path entry is a published work (nothing staged leaks in)');
ok(read('index.html').includes('Seven subject hubs') && /Discover by story/.test(read('index.html')) && /If You Love Harry Potter/.test(read('index.html')), 'home: seven hubs and a "Discover by story" band with the Harry Potter discovery collection');
const L = checkLinks(SITE); ok(L.broken.length === 0, `links resolve across ${L.pages} pages (${L.internal} internal)`);
ok(rep.staged.works > 0 && rep.published.works === cat.works.length, `unverified material stays staged: ${rep.staged.works} staged vs ${rep.published.works} published`);

// ===== browser =====
const browser = await launch(); if (!browser) process.exit(state.fails ? 1 : 0);
const shots = process.argv.includes('--shots'); const SH = path.join(ROOT, 'docs/screenshots'); if (shots) fs.mkdirSync(SH, { recursive: true });
const url = urlOf(SITE);
for (const [name, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile', deviceScaleFactor: 1 }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const T = `[${name}]`;
  const hscroll = () => pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const results = async (q, extra = '') => { await pg.goto(url('search/index.html') + '?q=' + encodeURIComponent(q) + extra); await pg.waitForTimeout(80); await pg.waitForFunction(() => { const c = document.querySelector('[data-count]'); return !c || !/Loading/i.test(c.textContent); }, null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(30); return pg.$$eval('.grid:not([hidden]) > .card:not([hidden]) .card-title', (e) => e.map((x) => x.textContent.trim())); };
  const snap = async (f, full = false) => shots && pg.screenshot({ path: path.join(SH, `${name}-${f}.png`), fullPage: full });

  // typo-tolerant search
  const typos = [['harry poter', "Harry Potter and the Sorcerer's Stone"], ['tolkein', 'The Hobbit'], ['hobit', 'The Hobbit'], ['jonathon strange', 'Jonathan Strange & Mr Norrell'], ['nietzche', 'Thus Spoke Zarathustra'], ['dracual', 'Dracula'], ['sanderon', 'Mistborn: The Final Empire'], ['gnostik gospels', 'The Gnostic Gospels'], ['mistbron', 'Mistborn: The Final Empire'], ['game of throns', 'A Game of Thrones'], ['shirly jackson', 'The Haunting of Hill House'], ['wizzard of earthsea', 'A Wizard of Earthsea'], ['sorcerers stone', "Harry Potter and the Sorcerer's Stone"], ['tarott', 'Seventy-Eight Degrees of Wisdom']];
  for (const [q, expect] of typos) { const r = await results(q); ok(r.includes(expect) && r.length <= 8, `${T} typo "${q}" finds ${expect} (${r.length} result${r.length === 1 ? '' : 's'})`); }
  let r = await results('hobit'); ok((await pg.locator('[data-count]').textContent()).includes('close matches'), `${T} close-match results are labelled as such`);
  r = await results('hobbit'); ok(!(await pg.locator('[data-count]').textContent()).includes('close matches'), `${T} exact matches are not labelled "close"`);
  r = await results('xqzvw'); ok(r.length === 0 && await pg.isVisible('[data-empty]'), `${T} nonsense query returns nothing (no false positives)`);
  r = await results('9781577314806'); ok(r.join() === 'The Power of Now', `${T} ISBNs are never fuzzy-matched: exact only`);
  r = await results('9781577314807'); ok(r.length === 0, `${T} a wrong ISBN (one digit off) finds nothing`);
  r = await results('potter'); { const firstNon = r.findIndex((t) => !/potter/i.test(t)); ok(r.length > 0 && /potter/i.test(r[0]) && r.includes("Harry Potter and the Sorcerer's Stone") && (firstNon === -1 || r.slice(firstNon).every((t) => !/potter/i.test(t))), `${T} title matches rank before other matches for "potter"`); }
  r = await results('magic'); ok(/magic/i.test(r[0]) && /magic/i.test(r[1]), `${T} results with the word in the title rank first for "magic": ${r.slice(0, 3).join(' | ')}`);
  r = await results('tolkein', '&lang=es'); const sg = (await pg.locator('[data-suggest]').textContent()).trim();
  ok(r.length === 0 && /tolkien/.test(sg), `${T} "did you mean" appears when filters leave nothing: "${sg}"`);
  await pg.click('[data-suggest] button'); ok((await pg.inputValue('.filters input[name=q]')) === 'tolkien', `${T} clicking the suggestion fills the search box`);
  await pg.goto(url('search/index.html')); ok(await pg.evaluate(() => document.activeElement && document.activeElement.name === 'q' && !!document.activeElement.closest('.filters')), `${T} search page puts the cursor in the search box`);
  await pg.fill('.filters input[name=q]', 'witchy'); await snap('search-typo');

  // nav + home + collections
  await pg.goto(url('index.html')); await snap('home-discovery', true);
  if (name === 'mobile') await pg.click('.nav-toggle');
  ok(await pg.locator('#nav a', { hasText: 'IOSutra' }).isVisible(), `${T} IOSutra appears in the main navigation`);
  ok(!(await hscroll()), `${T} no horizontal scroll with the extra nav item`);
  await pg.locator('#nav a', { hasText: 'IOSutra' }).click(); ok(pg.url().includes('technology/'), `${T} IOSutra nav item opens the technology page`);
  await pg.goto(url('collections/harry-potter-discovery/index.html')); await snap('collection-hp', true);
  ok(await pg.isVisible('.note-tm') && (await pg.locator('.card').count()) === 9, `${T} Harry Potter discovery collection: 9 published books and the disclaimer`);
  await pg.goto(url('subjects/fantasy-folklore-fiction/index.html')); ok(await pg.isVisible('h1 >> text=Fantasy, Folklore') && (await pg.locator('.dept').count()) === tax.departments.filter((d) => d.hubs.includes('fantasy-folklore-fiction')).length, `${T} Fantasy hub lists all ${tax.departments.filter((d) => d.hubs.includes('fantasy-folklore-fiction')).length} of its departments`);
  await pg.goto(url('authors/neil-gaiman/index.html')); { const n = cat.works.filter((w) => w.authors.some((a) => /Gaiman/.test(a))).length; ok((await pg.locator('.card').count()) === n, `${T} author page groups all ${n} Gaiman books`); }
  await pg.goto(url('topics/philosophy/index.html')); { const n = cat.works.filter((w) => w.subjects.includes('philosophy')).length; ok((await pg.locator('.card').count()) === Math.min(n, 48) && (await pg.evaluate(() => { const g = document.querySelector('[data-index-grid]'); return g ? +g.dataset.total : document.querySelectorAll('.card').length; })) === n, `${T} philosophy department lists all ${n} books`); }
  ok(errs.length === 0, `${T} no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} discovery checks passed`);
process.exit(state.fails ? 1 : 0);
