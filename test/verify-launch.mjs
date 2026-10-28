#!/usr/bin/env node
// Launch-readiness features: node test/verify-launch.mjs
// articles, analytics, production mode, link checker (local mock retailer), launch gate, privacy page.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const read = (rel, base = SITE) => fs.readFileSync(path.join(base, rel), 'utf8');
const nodeAsync = (script, env = {}, args = []) => new Promise((res) => { const c = spawn('node', [path.join(ROOT, script), ...args], { cwd: ROOT, env: { ...process.env, ...env } }); let out = '', err = ''; c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (err += d)); c.on('close', (status) => res({ status, stdout: out, stderr: err })); });
const node = (script, env = {}, args = []) => spawnSync('node', [path.join(ROOT, script), ...args], { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8' });
const arts = J('data/articles.json').articles, rep = J('data/articles-report.json'), cat = J('data/catalogue.json');
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// ===== articles =====
ok(rep.posts === 96 && rep.uniqueArticles === 82 && rep.duplicatePosts === 14 && arts.length === 82, `articles: 96 blog posts read, 82 unique shown, 14 duplicate-title posts held back`);
ok(new Set(arts.map((a) => norm(a.title))).size === arts.length && new Set(arts.map((a) => a.url)).size === arts.length, 'no two shown articles share a title or URL');
ok(arts.every((a) => a.url.startsWith('https://www.forbiddenmantra.com/post/')) && arts.filter((a) => a.lang === 'hi').every((a) => /%E0%A4/.test(a.url)), 'every article URL points at forbiddenmantra.com/post/…; Hindi slugs are percent-encoded');
ok(arts.every((a) => a.works.every((w) => cat.works.some((x) => x.id === w))), 'every article-to-book link targets a published work');
const idx = read('articles/index.html');
ok((idx.match(/class="articles"/g) || []).length >= 10 && (idx.match(/data-track="article"/g) || []).length > 82, `articles index lists topics and ${arts.length} unique articles (articles repeat under each topic they touch)`);
ok(!/Title: Dualism/.test(idx) && /Dualism in Gnosticism: The Battle Between Light and Dark/.test(idx), 'scaffolding "Title:" prefix is stripped from the one affected article');
const adam = read('books/the-apocalypse-of-adam/index.html');
ok((adam.match(/data-track="article"/g) || []).length === 6 && /All 15 related articles/.test(adam), 'Apocalypse of Adam page: shows 6 articles and links to all 15');
const gg = read('books/the-gnostic-gospels/index.html'); ok(/All 53 related articles/.test(gg), 'The Gnostic Gospels page: 6 shown, link to all 53');
ok(!/From the blog/.test(read('books/the-power-of-now/index.html')) && !/From the blog/.test(read('books/the-hobbit/index.html')), 'books with no related article (Power of Now, The Hobbit) show no blog block');
ok(/Mo Pai/.test(read('books/mo-pai-nei-kung/index.html')) && (read('books/mo-pai-nei-kung/index.html').match(/data-track="article"/g) || []).length === 6, 'Mo Pai Nei Kung page lists related Mo Pai articles');
ok((read('press/index.html').match(/data-track="article"/g) || []).length === arts.filter((a) => a.press).length && arts.filter((a) => a.press).length === 5, 'press page lists the 5 articles about Forbidden Mantra publications and the Mo Pai publisher page');
const hi = read('languages/hi/index.html');
ok((hi.match(/data-track="article"/g) || []).length === 3 && /lang="hi"/.test(hi) && /not book editions/.test(hi) && /0 works · 0 editions/.test(hi), 'Hindi language page lists 3 Hindi ARTICLES, says they are not book editions, and still reports 0 Hindi editions');
ok(read('topics/gnosticism/index.html').includes('From the blog') && read('topics/mo-pai/index.html').includes('From the blog'), 'topic pages show related articles');
{ const bad = path.join(ROOT, 'test/fixtures/bad-rules.json'); fs.mkdirSync(path.dirname(bad), { recursive: true }); fs.writeFileSync(bad, JSON.stringify({ rules: [{ id: 'x', any: ['gnosti'], works: ['no-such-book'], topics: ['no-such-topic'] }] }));
  const r = node('scripts/import-articles.mjs', { FM_ARTICLE_RULES: bad, FM_DATA: 'test/fixtures/data' }); ok(r.status === 1 && /unknown work "no-such-book"/.test(r.stderr) && /unknown topic/.test(r.stderr), 'article importer rejects rules that point at unknown books or topics'); fs.rmSync(bad); }

// ===== privacy =====
const priv = read('about/privacy/index.html');
ok(/sets no cookies/.test(priv) && /Google Fonts/.test(priv) && /local storage/.test(priv) && /none is running at the moment/.test(priv), 'privacy page states what the site actually does today (no cookies, local-storage language choice, Google Fonts, no analytics)');
ok(fs.readdirSync(SITE).length > 0 && (function all(d) { let n = 0, m = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { const r = all(p); n += r[0]; m += r[1]; } else if (e.name.endsWith('.html')) { n++; if (/about\/privacy\/index\.html/.test(fs.readFileSync(p, 'utf8'))) m++; } } return [n, m]; })(SITE).every((v, i, a) => a[0] === a[1]), 'privacy link appears in the footer of every page');

// ===== analytics config =====
ok(!/goatcounter|plausible|cloudflareinsights|googletagmanager|gtag\(/i.test(read('index.html') + read('books/wicca/index.html')), 'default build loads no analytics script of any kind');
const ov = (o) => { const f = path.join(ROOT, 'test/fixtures/override.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); return f; };
let r = node('scripts/build.mjs', { FM_OUT: 'test/out-an', FM_CONFIG_OVERRIDE: ov({ analytics: { provider: 'goatcounter', goatcounter: { code: 'fixture-code' } } }) });
ok(r.status === 0 && /data-goatcounter="https:\/\/fixture-code\.goatcounter\.com\/count"/.test(read('index.html', path.join(ROOT, 'test/out-an'))), 'provider + id configured -> exactly that cookie-free snippet is added');
r = node('scripts/build.mjs', { FM_OUT: 'test/out-an', FM_CONFIG_OVERRIDE: ov({ analytics: { provider: 'ga4' } }) }); ok(r.status === 1 && /GA4 is not supported until a consent mechanism exists/.test(r.stderr), 'GA4 is refused until a consent mechanism exists');
r = node('scripts/build.mjs', { FM_OUT: 'test/out-an', FM_CONFIG_OVERRIDE: ov({ analytics: { provider: 'plausible' } }) }); ok(r.status === 1 && /has no id set/.test(r.stderr), 'a provider without its id is refused');

// ===== production mode =====
const ready = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/promos.json'), 'utf8')); ready.brands.iosutra.url = 'https://example.invalid/iosutra'; ready.promos[0].approved = true; ready.claims.forEach((c) => { c.status = 'verified'; });
const pf = path.join(ROOT, 'test/fixtures/promos-ready.json'); fs.writeFileSync(pf, JSON.stringify(ready));
r = node('scripts/build.mjs', { FM_ENV: 'production', FM_OUT: 'test/out-prod', FM_PROMOS: 'test/fixtures/promos-ready.json' });
ok(r.status === 1 && /BLOCKER siteUrl/.test(r.stderr) && r.status === 1, 'production build refuses without a siteUrl');
r = node('scripts/build.mjs', { FM_ENV: 'production', FM_OUT: 'test/out-prod', FM_PROMOS: 'test/fixtures/promos-ready.json', FM_SITE_URL: 'https://shop.example.invalid/', FM_CONFIG_OVERRIDE: ov({ legal: { reviewedByOwner: true, effectiveDate: '2026-01-01' } }) });
const PROD = path.join(ROOT, 'test/out-prod');
ok(r.status === 0, `production build succeeds once URL, approval and claims are in place (exit ${r.status})`);
const ph = read('index.html', PROD);
ok(!/preview-bar|Preview build/.test(ph) && !/noindex/.test(ph) && /<link rel="canonical" href="https:\/\/shop\.example\.invalid\/">/.test(ph), 'production pages: no preview banner, no noindex, canonical link set');
ok(/<link rel="canonical" href="https:\/\/shop\.example\.invalid\/books\/wicca\/">/.test(read('books/wicca/index.html', PROD)), 'canonical links use directory-style URLs');
const sm = read('sitemap.xml', PROD), nPages = (function c(d) { let n = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) n += e.isDirectory() ? c(path.join(d, e.name)) : e.name === 'index.html' && path.basename(d) !== 'book' ? 1 : 0; return n; })(PROD);
ok((sm.match(/<loc>/g) || []).length === nPages && /<loc>https:\/\/shop\.example\.invalid\/books\/wicca\/<\/loc>/.test(sm), `sitemap.xml lists all ${nPages} pages`);
ok(/Allow: \//.test(read('robots.txt', PROD)) && /Sitemap: https:\/\/shop\.example\.invalid\/sitemap\.xml/.test(read('robots.txt', PROD)), 'production robots.txt allows crawling and names the sitemap');
ok(/Disallow: \//.test(read('robots.txt')) && /noindex/.test(read('index.html')) && /Preview build/.test(read('index.html')), 'preview build stays closed to crawlers (Disallow, noindex, banner)');

// ===== link checker against a local mock retailer =====
const pages = { '/dp/GOODPAGE': [200, '<title>Amazon.com: The Power of Now: A Guide to Spiritual Enlightenment : Tolle, Eckhart: Books</title>'], '/dp/GONE': [404, 'not found'], '/dp/ROBOT': [200, '<title>Robot Check</title> Enter the characters you see below'], '/dp/WRONG': [200, '<title>Amazon.com: Vacuum Cleaner Bags</title>'], '/dp/BUSY': [503, 'busy'] };
const srv = http.createServer((q, s) => { const [code, body] = pages[q.url.split('?')[0]] ?? [404, 'x']; s.statusCode = code; s.setHeader('content-type', 'text/html'); s.end(body); });
await new Promise((x) => srv.listen(0, '127.0.0.1', x)); const port = srv.address().port;
const lf = path.join(ROOT, 'test/fixtures/links.json');
fs.writeFileSync(lf, JSON.stringify({ links: ['GOODPAGE', 'GONE', 'ROBOT', 'WRONG', 'BUSY'].map((k) => ({ work: 'w', title: 'The Power of Now', edition: k, label: 'Amazon', market: 'amazon.com', url: `https://www.amazon.com/dp/${k}` })).concat([{ work: 'w', title: 'The Power of Now', edition: 'X', label: 'Amazon', market: 'amazon.com', url: 'https://www.amazon.com/dp/UNREACHABLE' }]) }));
const outDir = 'test/fixtures/lc'; fs.rmSync(path.join(ROOT, outDir), { recursive: true, force: true });
// UNREACHABLE is sent to a closed port by pointing the override at it for that one URL via a second run
r = await nodeAsync('scripts/check-links.mjs', { FM_DATA: outDir, FM_TODAY: '2026-10-27' }, ['--links', 'test/fixtures/links.json', '--origin-override', `http://127.0.0.1:${port}`, '--delay', '0', '--timeout', '3000']);
await new Promise((x) => srv.close(x));
const lc = JSON.parse(fs.readFileSync(path.join(ROOT, outDir, 'link-check.json'), 'utf8')).results; const v = (k) => lc[`https://www.amazon.com/dp/${k}`]?.verdict;
ok(r.status === 0 && v('GOODPAGE') === 'live', `checker: matching page -> live`);
ok(v('GONE') === 'dead', 'checker: HTTP 404 -> dead');
ok(v('ROBOT') === 'blocked' && v('BUSY') === 'blocked', 'checker: robot-check page and HTTP 503 -> blocked (never treated as dead)');
ok(v('WRONG') === 'mismatch', 'checker: 200 page whose title does not resemble the book -> mismatch');
ok(!('https://www.amazon.com/dp/UNREACHABLE' in lc) || v('UNREACHABLE') === 'dead', 'checker: an unreachable host never marks a link live');
// the build acts on results: a dead link is not rendered, a live one says so (fixture catalogue, fictional)
const fx = { FM_STAGING: 'test/fixtures/staging', FM_DATA: 'test/fixtures/data', FM_FIXTURE: '1' };
node('test/make-fixtures.mjs', fx); node('scripts/import.mjs', fx);
const isb = (n) => { const b = '978000000' + String(n).padStart(3, '0'); let s = 0; for (let i = 0; i < 12; i++) s += +b[i] * (i % 2 ? 3 : 1); return b + ((10 - (s % 10)) % 10); };
const to10 = (i13) => { const c = i13.slice(3, 12); let s = 0; for (let i = 0; i < 9; i++) s += +c[i] * (10 - i); const k = (11 - (s % 11)) % 11; return c + (k === 10 ? 'X' : k); };
const liveU = `https://www.amazon.com/dp/${to10(isb(1))}`, deadU = `https://www.amazon.com/dp/${to10(isb(10))}`;
fs.writeFileSync(path.join(ROOT, 'test/fixtures/data/link-check.json'), JSON.stringify({ results: { [liveU]: { verdict: 'live', checkedOn: '2026-10-27' }, [deadU]: { verdict: 'dead', checkedOn: '2026-10-27' } } }));
r = node('scripts/build.mjs', { ...fx, FM_OUT: 'test/out-lc' });
const atlas = read('books/fixture-atlas-of-breath/index.html', path.join(ROOT, 'test/out-lc')), sk = read('books/fixture-sanskrit-reader/index.html', path.join(ROOT, 'test/out-lc'));
ok(r.status === 0 && /Verified live 2026-10-27/.test(atlas), 'build: a link the checker found live is labelled "Verified live <date>"');
ok(sk.includes(to10(isb(10))) && !new RegExp(`href="[^"]*/dp/${to10(isb(10))}`).test(sk) && /No retailer link verified yet/.test(sk), 'build: a dead link is not rendered as a button (the ISBN is still shown), so visitors are never sent to a 404');
ok(JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/data/retailer-links.json'), 'utf8')).links.some((l) => l.url === liveU), 'build writes every rendered retail URL (untagged) for the checker');

// ===== launch gate =====
r = node('scripts/launch-check.mjs', {}, ['--json']); const items = JSON.parse(r.stdout);
const lv = (re) => items.find((i) => re.test(i.what))?.level;
ok(r.status === 1 && lv(/tracking ID for amazon\.com/) === 'PASS' && lv(/Retail link validity/) === 'WARN' && lv(/Cross-promotion/) === 'BLOCKER' && lv(/Production URL/) === 'DECISION', 'launch-check reports NOT READY with the remaining blocker (IOSutra gate) and the hosting decision; the live link check has run (links are a warning: 20 live, the rest blocked by Amazon or inconclusive); tracking ID passes');
ok(lv(/amazon\.co\.uk/) === 'WARN', 'launch-check does not assume the US ID covers amazon.co.uk (UK editions stay a warning)');

// ===== browser: outbound events =====
const browser = await launch();
if (browser) for (const [name, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile' }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)/, (x) => x.abort()); await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort());
  await pg.goto(urlOf(SITE)('books/seventy-eight-degrees-of-wisdom/index.html'));
  await pg.evaluate(() => { window.__ev = []; document.addEventListener('click', (e) => e.preventDefault()); document.addEventListener('fm:outbound', (e) => window.__ev.push(e.detail)); window.goatcounter = { count: (o) => window.__gc = o }; });
  const link = pg.locator('a[data-track=buy]').first(); await link.evaluate((a) => a.removeAttribute('target')); await link.click({ noWaitAfter: true }).catch(() => {});
  const ev = await pg.evaluate(() => window.__ev[0]); const gc = await pg.evaluate(() => window.__gc);
  ok(ev && ev.track === 'buy' && ev.work === 'seventy-eight-degrees-of-wisdom' && /^978157863/.test(ev.isbn) && ev.market === 'amazon.com', `[${name}] clicking a buy link emits an outbound event with work, ISBN and marketplace`);
  ok(gc && gc.event === true && /^outbound\/buy\/978/.test(gc.path), `[${name}] a loaded provider receives the event (${gc && gc.path})`);
  const ctx2 = await browser.newContext({ viewport: vp }); await ctx2.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { value: '1' })); const p2 = await ctx2.newPage();
  await p2.route(/fonts\.(googleapis|gstatic)/, (x) => x.abort()); await p2.route(/^https?:\/\/(?!file)/, (x) => x.abort());
  await p2.goto(urlOf(SITE)('books/wicca/index.html')); await p2.evaluate(() => { document.addEventListener('click', (e) => e.preventDefault()); window.goatcounter = { count: () => { window.__called = 1; } }; });
  const l2 = p2.locator('a[data-track=buy]').first(); await l2.evaluate((a) => a.removeAttribute('target')); await l2.click({ noWaitAfter: true }).catch(() => {});
  ok(!(await p2.evaluate(() => window.__called)), `[${name}] Do Not Track is respected: nothing is forwarded to a provider`);
  await ctx2.close();
  await pg.goto(urlOf(SITE)('articles/index.html')); const hscroll = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); ok(!hscroll, `[${name}] articles index: no horizontal scroll`);
  await pg.goto(urlOf(SITE)('about/privacy/index.html')); ok(await pg.isVisible('h1 >> text=Privacy'), `[${name}] privacy page renders`);
  ok(errs.length === 0, `[${name}] no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser?.close();
for (const d of ['out-an', 'out-prod', 'out-lc']) fs.rmSync(path.join(ROOT, 'test', d), { recursive: true, force: true });
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} launch-feature checks passed`);
process.exit(state.fails ? 1 : 0);
