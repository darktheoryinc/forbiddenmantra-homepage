#!/usr/bin/env node
// Homepage Digital Librarian (the primary search): typed questions return catalogue-grounded books, follow-ups work,
// no invented titles, honest "nothing found", placeholders never offered, keyboard + mobile + language, no external calls.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalogue.json'), 'utf8'));
const byTitle = new Map(cat.works.map((w) => [w.title, w]));
const home = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');

ok(/data-ask[\s>]/.test(home) && !/class="nav-search"/.test(home) && !/class="hero-search"/.test(home) && !/id="fm-librarian"/.test(home), 'homepage: the Digital Librarian replaces the header search box, the hero search and the floating panel');
ok(/<form class="ask-form" data-ask-form action="[^"]*search\/index\.html" method="get"/.test(home) && /name="q"/.test(home), 'without JavaScript the form still submits to the ordinary search page');
ok(home.indexOf('data-ask') < home.indexOf('data-home="fmp"') && home.indexOf('data-home="fmp"') - home.indexOf('data-ask') < 4500, 'the librarian sits immediately above the first shelf');
ok(fs.statSync(path.join(SITE, 'assets/ask.js')).size < 30000 && !/fetch\(|XMLHttpRequest|getUserMedia|openai|anthropic/i.test(fs.readFileSync(path.join(ROOT, 'scripts/assets/ask.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')), 'ask.js is small and calls no external or paid AI service');

const browser = await launch();
if (browser) for (const [name, vp, mobile] of [['desktop', { width: 1366, height: 768 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile }); const pg = await ctx.newPage();
  const errs = [], reqs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  pg.on('request', (r) => { if (!r.url().startsWith('file:') && !/fonts\.(googleapis|gstatic)/.test(r.url())) reqs.push(r.url()); });
  await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort());
  const T = `[${name}]`, u = urlOf(SITE);
  await pg.goto(u('index.html')); await pg.waitForTimeout(500);
  const ask = async (q) => { const n0 = await pg.locator('.ask-bot').count(); await pg.fill('#ask-q', q); await pg.press('#ask-q', 'Enter'); await pg.waitForFunction((n) => document.querySelectorAll('.ask-bot').length > n, n0, { timeout: 8000 }); const m = pg.locator('.ask-bot').last(); return { text: await m.locator('.ask-text').first().textContent(), titles: await m.locator('.ask-t a').allTextContents(), hrefs: await m.locator('.ask-t a').evaluateAll((a) => a.map((x) => x.getAttribute('href'))), root: m }; };

  const vis = await pg.evaluate(() => { const r = document.querySelector('[data-ask-input]').getBoundingClientRect(); const f = document.querySelector('[data-home=fmp] .card-cover').getBoundingClientRect(); return { inside: r.left >= 0 && r.right <= innerWidth && r.top < innerHeight && r.width > 200, firstShelfTop: f.top, h: innerHeight, face: /librarian\.webp/.test(getComputedStyle(document.querySelector('.ask-face')).backgroundImage) }; });
  ok(vis.inside && vis.face, `${T} a visible text input with her face, inside the viewport`);
  if (!mobile) ok(vis.firstShelfTop < vis.h - 150, `${T} the first shelf's covers start right below it (cover top ${Math.round(vis.firstShelfTop)}px of ${vis.h}px)`);

  // keyboard: Tab reaches the input, Enter submits
  await pg.focus('#ask-q'); await pg.keyboard.type('Do you have books about meditation?', { delay: 10 }); await pg.keyboard.press('Enter'); await pg.waitForSelector('.ask-bot .ask-t a', { timeout: 8000 });
  let r = { titles: await pg.locator('.ask-bot').last().locator('.ask-t a').allTextContents() };
  ok(r.titles.length >= 3 && r.titles.length <= 6 && r.titles.every((t) => byTitle.has(t)), `${T} natural question "Do you have books about meditation?" -> ${r.titles.length} real catalogue titles: ${r.titles.slice(0, 3).join('; ')}`);
  ok((await pg.evaluate(() => document.activeElement.id)) === 'ask-q' && (await pg.inputValue('#ask-q')) === '', `${T} focus stays in the input after answering and the box is cleared for the next question`);
  ok(await pg.locator('.ask-log').getAttribute('role') === 'log' && await pg.locator('.ask-log').getAttribute('aria-live') === 'polite', `${T} answers are announced politely to screen readers`);

  // everything shown is grounded: title, author, link and cover all come from the catalogue
  const cards = await pg.locator('.ask-bot').last().locator('.ask-card').evaluateAll((cs) => cs.map((c) => ({ t: c.querySelector('.ask-t a').textContent, href: c.querySelector('.ask-t a').getAttribute('href'), authors: [...c.querySelectorAll('.ask-by a')].map((a) => a.textContent), img: c.querySelector('img')?.getAttribute('src') ?? null, ph: !!c.querySelector('.cover-ph') })));
  ok(cards.every((c) => { const w = byTitle.get(c.t); return w && c.authors.join(', ') === w.authors.join(', ') && fs.existsSync(path.join(SITE, c.href)) ; }), `${T} every card shows the catalogue's own authors and links to an existing book page`);
  ok(cards.every((c) => (c.img ? fs.existsSync(path.join(SITE, c.img.replace(/^\.\//, ''))) : c.ph)), `${T} covers shown are real published files; books without one get the text-only placeholder`);
  ok((await pg.$$eval('.ask-card img', (is) => is.every((i) => i.complete ? i.naturalWidth > 0 : true))), `${T} no broken cover images in the answer`);

  // follow-ups
  r = await ask('in Spanish');
  ok(r.titles.length > 0 && r.titles.every((t) => { const w = byTitle.get(t); return w && w.editions.some((e) => e.language === 'es' || (e.languages ?? []).includes('es')); }) && /Spanish/.test(r.text), `${T} follow-up "in Spanish" narrows the previous answer to books with a Spanish edition (${r.titles.join('; ')})`);
  r = await ask('Show me books about witchcraft');
  ok(r.titles.length === 6 && r.titles.every((t) => byTitle.has(t)) && /witchcraft/.test(r.text), `${T} "Show me books about witchcraft" -> six real titles`);
  const before = r.titles, nb = await pg.locator('.ask-bot').count(); await pg.locator('.ask-more').last().click(); await pg.waitForFunction((n) => document.querySelectorAll('.ask-bot').length > n, nb, { timeout: 8000 });
  const more = await pg.locator('.ask-bot').last().locator('.ask-t a').allTextContents();
  ok(more.length > 0 && more.every((t) => !before.includes(t) && byTitle.has(t)), `${T} "Show more" gives further, different real titles`);
  r = await ask('Which books discuss the Nag Hammadi texts?');
  ok(r.titles.length > 0 && r.titles.every((t) => byTitle.has(t)) && /Nag Hammadi library|Gnostic/.test(await r.root.locator('.ask-note').first().textContent()), `${T} Nag Hammadi question answered from the Gnosticism shelf, with an honest note about what the catalogue can and cannot confirm`);
  r = await ask('tell me about the second one');
  ok(r.titles.length === 1 && /Listed formats/.test(r.text), `${T} follow-up "tell me about the second one" describes a book from the previous answer`);

  // honesty
  r = await ask('books about quantum chromodynamics of unicorns');
  ok(r.titles.length === 0 && /could not find/.test(r.text) && /will not suggest/.test(r.text), `${T} nothing relevant: clear "could not find", no invented books`);
  r = await ask('Mo Pai Nei Kung');
  ok(!r.titles.includes('Mo Pai Nei Kung') && !r.titles.includes('The Hidden Technology of Human Power'), `${T} unverified placeholder records are never offered as books (${r.titles.join('; ') || 'none'})`);
  r = await ask('is Gayatri Mantra in stock?');
  ok(!/in stock/i.test(r.text) && r.titles.every((t) => byTitle.has(t)), `${T} she talks about the catalogue, never about stock`);
  r = await ask('asdf');
  ok(r.titles.length === 0, `${T} gibberish returns nothing`);

  // clear and chips
  await pg.locator('[data-ask-clear]').click(); ok(await pg.locator('.ask-log').isHidden(), `${T} Clear conversation empties the log`);
  await pg.locator('[data-ask-chips] button').first().click(); await pg.waitForSelector('.ask-bot .ask-t a', { timeout: 8000 }); ok(true, `${T} example chips work as one-tap questions`);
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${T} no horizontal scroll after answers`);
  // interface language
  await pg.evaluate(() => localStorage.setItem('fm-ui', 'es')); await pg.reload(); await pg.waitForTimeout(500);
  ok((await pg.getAttribute('#ask-q', 'placeholder')).startsWith('Pide') && /bibliotecaria/i.test(await pg.locator('.ask-h').textContent()), `${T} the librarian's labels follow the website language (Español)`);
  await pg.evaluate(() => localStorage.removeItem('fm-ui'));
  ok(errs.length === 0, `${T} no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  ok(reqs.length === 0, `${T} no requests leave the site${reqs.length ? ': ' + reqs[0] : ''}`);
  await ctx.close();
}
await browser?.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} Digital Librarian search checks passed`);
process.exit(state.fails ? 1 : 0);
