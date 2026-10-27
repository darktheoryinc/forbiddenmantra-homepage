#!/usr/bin/env node
// Amazon affiliate integrity: node test/verify-affiliate.mjs
// Proves: the US tracking ID is on every amazon.com purchase link and nowhere else, tagging never changes a destination, ASINs match
// editions, the audit catches deliberate corruption, disclosures are present, click events carry no personal data, and no Amazon
// images/prices/credentials are used.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site'), ID = 'darktheoryinc-20';
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cfg = J('config/site.json'), cat = J('data/catalogue.json');
const run = (script, env = {}, args = []) => spawnSync('node', [path.join(ROOT, script), ...args], { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8' });
const htmls = (base) => { const o = []; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? w(path.join(d, e.name)) : e.name.endsWith('.html') && o.push(path.join(d, e.name)); })(base); return o; };
const dec = (s) => s.replace(/&amp;/g, '&');

// ===== configuration =====
const mk = cfg.affiliate.marketplaces;
ok(mk['amazon.com'].trackingId === ID && mk['amazon.com'].enrolled === true && /owner/.test(mk['amazon.com'].trackingIdConfirmedBy), `config: amazon.com tracking ID is ${ID}, confirmed by the owner`);
const others = Object.entries(mk).filter(([k]) => k !== 'amazon.com');
ok(others.length === 17 && others.every(([, v]) => v.trackingId === null && v.enrolled === null), 'config: all 17 other marketplaces remain unconfigured (the US ID is not assumed to apply abroad)');
ok(/^As an Amazon Associate I earn from qualifying purchases\./.test(cfg.disclosure), 'config: disclosure begins with the standard Associates statement');

// ===== audit (real build) =====
let r = run('scripts/audit-affiliate.mjs', {}, ['--json']); const audit = JSON.parse(r.stdout).summary;
ok(r.status === 0 && audit.linkErrors === 0, `audit: ${audit.purchaseLinks} purchase links, ${audit.linkErrors} errors`);
ok(audit.worksWithValidTaggedProductLink + audit.worksWithSearchLinkOnly + audit.worksWithNoPurchaseLink === cat.works.length, `audit: every one of ${cat.works.length} works is accounted for (valid ${audit.worksWithValidTaggedProductLink}, search-only ${audit.worksWithSearchLinkOnly}, none ${audit.worksWithNoPurchaseLink})`);
ok(audit.worksWithValidTaggedProductLink >= 43 && audit.ofWhichSourceVerified >= 2 && audit.ofWhichSourceVerified + audit.ofWhichIdentityVerifiedOffline === audit.worksWithValidTaggedProductLink && cat.works.filter((w) => w.press).length === 12, `audit: ${audit.worksWithValidTaggedProductLink} works have a tagged product link (${audit.ofWhichSourceVerified} product page seen in a cited source, ${audit.ofWhichIdentityVerifiedOffline} matched offline to their own ISBN-10); ${audit.worksWithSearchLinkOnly} have only a labelled search link`);

// ===== every page: tag only on amazon.com, always ours =====
let amazonLinks = 0, taggedCom = 0, badTag = [], foreignTag = [];
const sourceLinks = [];
for (const f of htmls(SITE)) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(/href="(https?:\/\/(?:www\.)?amazon\.[^"]+)"/g)) {
    const u = new URL(dec(m[1])); amazonLinks++;
    const tags = u.searchParams.getAll('tag');
    if (tags.length) { if (u.hostname !== 'www.amazon.com') foreignTag.push(`${u.hostname}${u.pathname}`); else if (tags.length !== 1 || tags[0] !== ID) badTag.push(u.href); else taggedCom++; }
  }
}
ok(badTag.length === 0 && foreignTag.length === 0, `site: ${taggedCom} tagged amazon.com links across all pages; no other tag value and no tag on any other marketplace (${amazonLinks} Amazon links total)`);
// buy links specifically
let buyCom = 0, buyUk = 0, buyComUntagged = [], buyOther = [], noSponsored = [];
for (const f of htmls(path.join(SITE, 'books'))) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(/<a class="btn" href="([^"]+)" target="_blank" rel="([^"]*)" data-track="buy"/g)) {
    const u = new URL(dec(m[1])); if (!/sponsored/.test(m[2])) noSponsored.push(u.href);
    if (u.hostname === 'www.amazon.com') { buyCom++; if (u.searchParams.get('tag') !== ID) buyComUntagged.push(u.href); } else { buyUk++; if (u.searchParams.has('tag')) buyOther.push(u.href); }
  }
}
ok(buyCom > 60 && buyUk >= 1 && buyComUntagged.length === 0 && buyOther.length === 0, `buy buttons: all ${buyCom} amazon.com buttons carry ${ID}; the ${buyUk} non-US button(s) carry no tag`);
ok(noSponsored.length === 0, 'every affiliate button has rel="sponsored noopener noreferrer"');

// ===== tagging never changes the destination =====
const clean = new Set(J('data/retailer-links.json').links.map((l) => l.url));
const strip = (href) => { const u = new URL(dec(href)); u.searchParams.delete('tag'); return u.toString().replace(/\?$/, ''); };
let drift = [], n = 0;
for (const f of htmls(path.join(SITE, 'books'))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/<a class="btn" href="([^"]+)" target="_blank" rel="[^"]*" data-track="buy"/g)) { n++; const s = strip(m[1]); const cands = [...clean]; if (!cands.some((c) => new URL(c).pathname === new URL(s).pathname && new URL(c).hostname === new URL(s).hostname)) drift.push(s); }
ok(n > 0 && drift.length === 0, `removing the tag from all ${n} buttons gives exactly the product paths the catalogue produced before (no destination changed)`);
// identity examples
const hp = fs.readFileSync(path.join(SITE, 'books/harry-potter-and-the-philosophers-stone/index.html'), 'utf8').replace(/&amp;/g, '&');
ok(hp.includes(`https://www.amazon.com/dp/059035342X?tag=${ID}`) && hp.includes('https://www.amazon.co.uk/dp/1408855658"') , 'Harry Potter: US edition -> amazon.com/dp/059035342X with our tag; UK edition -> amazon.co.uk/dp/1408855658 with no tag');
const aoa = fs.readFileSync(path.join(SITE, 'books/the-apocalypse-of-adam/index.html'), 'utf8').replace(/&amp;/g, '&');
ok(aoa.includes(`https://www.amazon.com/Apocalypse-Adam-Forbidden-Mantra-Press/dp/B0H8MQN9WK?tag=${ID}`), 'Apocalypse of Adam audiobook: tagged link keeps the exact product URL and ASIN seen in the source');
// every dp ASIN is the edition's own ASIN or ISBN-10
const to10 = (s) => { if (!s.startsWith('978')) return null; const c = s.slice(3, 12); let t = 0; for (let i = 0; i < 9; i++) t += +c[i] * (10 - i); const k = (11 - (t % 11)) % 11; return c + (k === 10 ? 'X' : k); };
let mism = 0, checked = 0;
for (const w of cat.works) {
  const h = fs.readFileSync(path.join(SITE, 'books', w.slug, 'index.html'), 'utf8').replace(/&amp;/g, '&');
  for (const m of h.matchAll(/href="https:\/\/www\.amazon\.[a-z.]+\/(?:[^"?]*\/)?dp\/([A-Z0-9]{10})[^"]*" target="_blank" rel="[^"]*" data-track="buy" data-work="[^"]*" data-isbn="([^"]*)"/g)) {
    checked++; const ed = w.editions.find((e) => e.isbn13 === m[2] || (!m[2] && e.asin === m[1]));
    if (!ed || !(ed.asin === m[1] || to10(ed.isbn13 ?? '') === m[1])) mism++;
  }
}
ok(checked >= 54 && mism === 0, `${checked} product links: each ASIN is the edition's own ASIN or the ISBN-10 computed from its own ISBN-13`);

// ===== the audit catches corruption =====
const OUT = path.join(ROOT, 'test/out-aff'); fs.rmSync(OUT, { recursive: true, force: true });
run('scripts/build.mjs', { FM_OUT: 'test/out-aff' });
const page = path.join(OUT, 'books/the-power-of-now/index.html'), orig = fs.readFileSync(page, 'utf8');
const mutate = (from, to) => { fs.writeFileSync(page, orig.replace(from, to)); const x = run('scripts/audit-affiliate.mjs', { FM_OUT: 'test/out-aff' }, ['--json']); return { status: x.status, out: x.stdout }; };
let m = mutate('/dp/1577314808?tag=darktheoryinc-20', '/dp/1577314808'); ok(m.status === 1, 'audit FAILS when a tag is missing');
m = mutate('tag=darktheoryinc-20', 'tag=someoneelse-20'); ok(m.status === 1, 'audit FAILS on a wrong tracking ID');
m = mutate('?tag=darktheoryinc-20', '?tag=darktheoryinc-20&tag=darktheoryinc-20'); ok(m.status === 1, 'audit FAILS on a duplicated tag');
m = mutate('/dp/1577314808', '/dp/0141439846'); ok(m.status === 1, 'audit FAILS when the ASIN belongs to a different book (Dracula\'s ISBN-10 on The Power of Now)');
m = mutate('https://www.amazon.com/dp/1577314808', 'https://www.amazon.de/dp/1577314808'); ok(m.status === 1, 'audit FAILS when a link points at another marketplace but carries the US tag');
m = mutate('rel="sponsored noopener noreferrer" data-track="buy"', 'rel="noopener" data-track="buy"'); ok(m.status === 1, 'audit FAILS when rel="sponsored" is missing');
fs.writeFileSync(page, orig); m = run('scripts/audit-affiliate.mjs', { FM_OUT: 'test/out-aff' }, ['--json']); ok(m.status === 0, 'audit passes again on the unmodified page');
fs.rmSync(OUT, { recursive: true, force: true });

// ===== disclosures =====
const statement = 'As an Amazon Associate I earn from qualifying purchases.';
const all = htmls(SITE); const without = all.filter((f) => !fs.readFileSync(f, 'utf8').includes(statement));
ok(without.length === 0, `the Associates statement appears in the footer of all ${all.length} pages`);
const bookNoDisc = htmls(path.join(SITE, 'books')).filter((f) => /data-track="buy"/.test(fs.readFileSync(f, 'utf8')) && !/<p class="disclosure sm"[^>]*>As an Amazon Associate I earn/.test(fs.readFileSync(f, 'utf8')));
ok(bookNoDisc.length === 0, 'every book page with an Amazon link also shows the disclosure next to the buy buttons');
ok(/tracking IDs are specific to each marketplace/i.test(fs.readFileSync(path.join(SITE, 'about/affiliate-disclosure/index.html'), 'utf8')), 'affiliate disclosure page explains that IDs are per marketplace');

// ===== licensing: no Amazon images, prices, ratings; no credentials =====
const blob = all.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
ok(!/media-amazon\.com|images-na\.ssl-images-amazon|ssl-images-amazon|m\.media-amazon|fls-na\.amazon/.test(blob), 'no Amazon-hosted image, tracking pixel or widget is loaded');
ok(!/\$\s?\d{1,3}\.\d{2}|price:\s*\$|★|stars? rating|customer reviews/i.test(blob.replace(/<script[\s\S]*?<\/script>/g, '')), 'no price, availability, star rating or review text is displayed');
const repoText = ['config/site.json', 'data/promos.json', 'scripts/build.mjs', 'scripts/import.mjs'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
ok(!/AKIA[0-9A-Z]{12,}|secretKey|credentialSecret|client_secret|password\s*[:=]/i.test(repoText) && !fs.existsSync(path.join(ROOT, '.env')), 'no API credentials, secrets or .env file in the repository');
ok(JSON.stringify(cfg.affiliate.marketplaces).split(ID).length === 2 && cfg.affiliate.requiredTrackingIds['amazon.com'] === ID, 'the tracking ID is set once for the marketplace and pinned once as the required ID');

// ===== click tracking collects no personal data =====
const browser = await launch();
if (browser) for (const [name, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile' }); const pg = await ctx.newPage();
  await pg.route(/fonts\.(googleapis|gstatic)/, (x) => x.abort()); await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort());
  await pg.goto(urlOf(SITE)('books/the-power-of-now/index.html'));
  await pg.evaluate(() => { window.__ev = []; document.addEventListener('click', (e) => e.preventDefault()); document.addEventListener('fm:outbound', (e) => window.__ev.push(e.detail)); });
  const a = pg.locator('a[data-track=buy]').first(); await a.click({ noWaitAfter: true }).catch(() => {});
  const ev = await pg.evaluate(() => window.__ev[0]); const cookie = await pg.evaluate(() => document.cookie); const ls = await pg.evaluate(() => Object.keys(localStorage));
  ok(ev && JSON.stringify(Object.keys(ev).sort()) === JSON.stringify(['cat', 'href', 'isbn', 'linktype', 'market', 'own', 'page', 'track', 'work']), `[${name}] click event contains only: ${Object.keys(ev || {}).sort().join(', ')}`);
  ok(ev && ev.href.includes(`tag=${ID}`) && ev.work === 'the-power-of-now' && ev.isbn === '9781577314806' && ev.market === 'amazon.com', `[${name}] event identifies the book, ISBN and marketplace (no user identifiers)`);
  ok(cookie === '' && ls.every((k) => k === 'fm-ui'), `[${name}] no cookies set; local storage holds nothing but the optional language choice`);
  await ctx.close();
}
await browser?.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} affiliate checks passed`);
process.exit(state.fails ? 1 : 0);
