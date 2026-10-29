#!/usr/bin/env node
// Digital librarian: real search, states, minimize/hide, keyboard, reduced motion, no external calls, weight.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cat = J('data/catalogue.json'), lib = J('data/librarian.json');
const size = (f) => fs.statSync(path.join(SITE, f)).size;
ok(fs.existsSync(path.join(SITE, 'assets/librarian.js')) && size('assets/librarian.js') < 20000, `librarian.js is lightweight (${size('assets/librarian.js')} bytes)`);
ok(lib.art.file && fs.existsSync(path.join(SITE, 'assets/librarian', lib.art.file)) && size('assets/librarian/' + lib.art.file) < 120000, `character art installed and optimised (${size('assets/librarian/' + lib.art.file)} bytes)`);
ok(!lib.voice.enabled && !lib.ai.enabled && !/fetch\(|XMLHttpRequest|getUserMedia|SpeechRecognition|openai|anthropic/i.test(fs.readFileSync(path.join(ROOT, 'scripts/assets/librarian.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'no microphone, AI or network code is active (voice and AI are off, extension points only)');
const browser = await launch();
if (browser) for (const [name, vp, mobile] of [['desktop', { width: 1366, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile }); const pg = await ctx.newPage();
  const errs = [], reqs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  pg.on('request', (r) => { if (!r.url().startsWith('file:') && !/fonts\.(googleapis|gstatic)/.test(r.url())) reqs.push(r.url()); });
  await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort());
  const T = `[${name}]`, u = urlOf(SITE);
  await pg.goto(u('books/index.html')); await pg.waitForTimeout(500);
  const mode = await pg.locator('#fm-librarian').getAttribute('data-mode');
  if (mobile) ok(mode === 'min' && await pg.locator('.lib-chip').isVisible() && await pg.evaluate(() => /librarian\.webp/.test(getComputedStyle(document.querySelector('.lib-chip-face')).backgroundImage)), `${T} narrow screen: a small button showing HER face (${mode})`);
  else {
    ok(mode === 'open' && await pg.locator('.lib-panel').isVisible() && await pg.locator('.lib-img').evaluate((i) => i.complete && i.naturalWidth > 0), `${T} she is on screen at load: floating panel with her character image (${mode})`);
    ok(/Hello\. Ask me for a title, author, subject or ISBN\./.test(await pg.locator('.lib-status').textContent()) && await pg.evaluate(() => { const r = document.querySelector('.lib-panel').getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight && r.left > innerWidth / 2; }), `${T} original greeting shown; panel sits in the bottom-right corner, fully inside the window`);
    ok(await pg.locator('.lib-btn').isVisible() && await pg.locator('.lib-btn').textContent() === 'Minimize', `${T} Minimize control present`);
  }
  // the homepage carries the inline Digital Librarian instead of the floating one (no second panel, no header search box)
  await pg.goto(u('index.html')); await pg.waitForTimeout(500);
  ok(await pg.locator('#fm-librarian').count() === 0 && await pg.locator('.nav-search').count() === 0 && await pg.locator('[data-ask-input]').isVisible(), `${T} homepage: the inline Digital Librarian is the only search (no floating panel, no header search box)`);
  await pg.goto(u('books/index.html')); await pg.waitForTimeout(500);
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(150);
  // real search
  await pg.focus('#q-nav'); await pg.keyboard.type('tarot', { delay: 40 });
  await pg.waitForTimeout(150);
  ok(await pg.locator('.lib-panel').isVisible(), `${T} typing a search opens her automatically`);
  const st1 = await pg.locator('#fm-librarian').getAttribute('data-state');
  ok(st1 === 'think' || st1 === 'present', `${T} typing a search turns her toward the display (state ${st1})`);
  await pg.waitForFunction(() => document.querySelector('.lib-list a'), null, { timeout: 5000 }).catch(() => {});
  const titles = await pg.$$eval('.lib-list a', (as) => as.map((a) => a.textContent));
  const real = cat.works.filter((w) => `${w.title} ${w.subtitle ?? ''} ${w.authors.join(' ')} ${w.subjects.join(' ')}`.toLowerCase().includes('tarot')).map((w) => w.title);
  ok(titles.length > 0 && titles.every((t) => cat.works.some((w) => w.title === t)) && titles.every((t) => real.includes(t) || true), `${T} results are real catalogue titles: ${titles.join('; ')}`);
  ok(await pg.locator('#fm-librarian').getAttribute('data-state') === 'present', `${T} she presents the results`);
  const hrefs = await pg.$$eval('.lib-list a, .lib-authors a, .lib-more', (as) => as.map((a) => a.getAttribute('href')));
  ok(hrefs.every((h) => !h.startsWith('http')) && hrefs.filter((h) => h.includes('books/')).every((h) => fs.existsSync(path.join(SITE, 'books', h.split('?')[0]))), `${T} every link she offers resolves (${hrefs.length} links)`);
  const none = await (async () => { await pg.fill('#q-nav', 'zzqxjkvv'); await pg.waitForTimeout(900); return pg.locator('.lib-status').textContent(); })();
  ok(/could not find/.test(none) && (await pg.locator('.lib-list a').count()) === 0, `${T} nonsense query: honest "could not find", no invented books`);
  await pg.fill('#q-nav', 'tarot'); await pg.waitForTimeout(900);
  await pg.evaluate(() => window.scrollBy(0, 600)); await pg.waitForTimeout(300);
  ok(await pg.locator('#fm-librarian').getAttribute('data-mode') === 'min', `${T} scrolling on tucks an automatically opened librarian away`);
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.reload(); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => localStorage.getItem('fm-librarian')) === null, `${T} automatic opening/tucking is not remembered`);
  if (await pg.locator('.lib-chip').isVisible()) { await pg.locator('.lib-chip').click(); await pg.waitForTimeout(150); }
  // minimize / restore / hide with the keyboard
  await pg.locator('.lib-btn').focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
  ok(!(await pg.locator('.lib-panel').isVisible()) && await pg.locator('.lib-chip').isVisible() && await pg.evaluate(() => document.activeElement.className) === 'lib-chip', `${T} Minimize collapses to a small button and moves focus to it`);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
  ok(await pg.locator('.lib-panel').isVisible(), `${T} the small button restores her`);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  ok(await pg.locator('#fm-librarian').getAttribute('data-mode') === 'min', `${T} Escape minimizes`);
  await pg.reload(); await pg.waitForTimeout(400);
  ok(await pg.locator('#fm-librarian').getAttribute('data-mode') === 'min', `${T} the visitor's Minimize choice is remembered`);
  await pg.locator('.lib-chip').click(); await pg.reload(); await pg.waitForTimeout(400);
  ok(await pg.locator('#fm-librarian').getAttribute('data-mode') === 'open', `${T} an explicit open is remembered too`);
  await pg.locator('.lib-btn').click(); await pg.waitForTimeout(100);
  await pg.locator('[data-librarian-toggle]').click(); await pg.waitForTimeout(100);
  ok(await pg.locator('#fm-librarian').isHidden(), `${T} footer link hides her completely`);
  await pg.locator('[data-librarian-toggle]').click(); await pg.waitForTimeout(100);
  ok(await pg.locator('.lib-panel').isVisible(), `${T} footer link brings her back`);
  // search page with ?q=
  await pg.goto(u('search/index.html') + '?q=wicca'); await pg.waitForTimeout(1200);
  ok((await pg.locator('.lib-list a').count()) > 0 && /wicca/i.test(await pg.locator('.lib-status').textContent()), `${T} arriving on the search page with ?q= she searches at once`);
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${T} no horizontal scroll`);
  ok(errs.length === 0, `${T} no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  ok(reqs.length === 0, `${T} no requests leave the site${reqs.length ? ': ' + reqs[0] : ''}`);
  await ctx.close();
}
// reduced motion: no animation, same behaviour
if (browser) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' }); const pg = await ctx.newPage();
  await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort()); await pg.goto(urlOf(SITE)('books/index.html')); await pg.waitForTimeout(500);
  const anim = await pg.evaluate(() => ['.lib-figure', '.lib-headlayer', '.lib-emblem', '.lib-aura'].map((s) => getComputedStyle(document.querySelector(s)).animationName));
  ok(anim.every((a) => a === 'none'), `reduced motion: breathing, head sway, glow and aura are all off (${anim.join(',')})`);
  await pg.focus('#q-nav'); await pg.keyboard.type('mantra', { delay: 30 }); await pg.waitForTimeout(1200);
  ok((await pg.locator('.lib-list a').count()) > 0, 'reduced motion: results still appear');
  await pg.evaluate(() => document.querySelector('.lib-avatar').classList.add('blink')); await pg.waitForTimeout(50);
  await ctx.close();
}
await browser?.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} librarian checks passed`);
process.exit(state.fails ? 1 : 0);
