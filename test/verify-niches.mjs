#!/usr/bin/env node
// Niche guide pages + the build-time affiliate guard.
//   node test/verify-niches.mjs      (uses the default site/ build; the guard tests build into throwaway directories)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SITE = path.join(ROOT, 'site');
const cat = J('data/catalogue.json'), tax = J('data/taxonomy.json'), nd = J('data/niches.json');
const read = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8');
const ID = J('config/site.json').affiliate.marketplaces['amazon.com'].trackingId;

for (const n of nd.niches) {
  const depIds = new Set(tax.departments.map((d) => d.id));
  ok([...n.departments, ...n.shelves, ...n.relatedDepartments].every((d) => depIds.has(d)), `${n.id}: every department exists in the taxonomy`);
  const expected = cat.works.filter((w) => w.subjects.some((s) => n.departments.includes(s)));
  const html = read(`niches/${n.id}/index.html`);
  ok(expected.length > 0 && html.includes(`${expected.length} book`), `${n.id}: page lists ${expected.length} books derived from the catalogue`);
  ok(/<h1>/.test(html) && html.includes('Featured authors') && html.includes('Related subjects') && html.includes('data-filterbar') && html.includes('data-index-grid') || html.includes('data-filterable'), `${n.id}: hero, featured authors, related subjects, search/filters, grid`);
  ok(html.includes('From Forbidden Mantra Press') && html.includes('data-own="fmp"') || html.includes('does not currently publish'), `${n.id}: own-publication section is present and honest about coverage`);
  ok(html.includes('As an Amazon Associate'), `${n.id}: affiliate disclosure on the page`);
  ok((html.match(/href="https:\/\/www\.amazon\.com[^"]*"/g) || []).every((u) => u.includes(`tag=${ID}`)), `${n.id}: every Amazon link carries ${ID}`);
  ok((html.match(/<a class="btn"[^>]*amazon\.com[^>]*>/g) || []).every((a) => /rel="sponsored/.test(a) && /data-own=/.test(a) && /data-linktype=/.test(a)), `${n.id}: buy links are sponsored and carry tracking dimensions`);
}
ok(/Guides by interest/.test(read('index.html')) && read('index.html').includes('niches/magic-witchcraft/'), 'home links to the guides');

// ---- legal pages, footer, disclosures ----
for (const [rel, h] of [['legal/index.html', 'Terms &amp; Policies'], ['legal/terms-refunds/index.html', 'Terms of Service / Refund Policy'], ['about/privacy/index.html', 'Privacy Policy'], ['about/affiliate-disclosure/index.html', 'Affiliate Disclosure'], ['contact/index.html', 'Contact'], ['network/index.html', 'Our network']]) ok(read(rel).includes(`<h1>${h}</h1>`), `${rel} loads with its heading`);
const homeH = read('index.html');
ok(homeH.includes('hero-disclosure') && homeH.includes('As an Amazon Associate I earn from qualifying purchases.'), 'homepage shows "As an Amazon Associate I earn from qualifying purchases." in the hero');
for (const href of ['legal/', 'legal/terms-refunds/', 'about/privacy/', 'about/affiliate-disclosure/', 'contact/', 'network/']) ok(homeH.includes(`href="./${href}index.html"`) && fs.existsSync(path.join(SITE, href, 'index.html')), `footer links to ${href} and it exists`);
ok(['https://iosutra.com', 'https://spiritualexpressionz.com', 'https://dogsrfun.com'].every((u) => homeH.includes(`href="${u}"`)), 'footer links to IOSutra, Spiritual Expressionz and Dogs R Fun');
ok(/class="aff-note-p[^>]*>As an Amazon Associate/.test(read('books/the-power-of-now/index.html')), 'book page shows the disclosure directly under the buy buttons');
// ---- homepage order and the "From Imagination to Publication" section ----
{
  const iHero = homeH.indexOf('<section class="hero">'), iPromo = homeH.indexOf('promo-band'), iStudio = homeH.indexOf('data-home="studio"'), iNext = homeH.indexOf('<section class="band"', iStudio);
  const firstBook = Math.min(...['data-home="guides"', 'class="hubs"', 'data-home="discovery"'].map((k) => homeH.indexOf(k)).filter((n) => n > 0));
  ok(iHero > 0 && iHero < iPromo && iPromo < iStudio && iStudio < firstBook, 'homepage order: hero/search, IOSutra promotion, From Imagination to Publication, then the book collections');
  const studio = homeH.slice(iStudio, homeH.indexOf('</section>', iStudio));
  ok(/From Imagination to Publication/.test(studio) && ['Research', 'Writing', 'Editing', 'Illustration', 'Formatting', 'Publishing preparation'].every((w) => studio.includes(`<h3>${w}</h3>`)), 'studio section names the six workflow stages');
  ok(/Coming soon/.test(studio) && !/<button|<form|<input|type="submit"|class="btn/.test(studio) && (studio.match(/<a /g) || []).length === 1, 'studio section is an honest "Coming soon": no buttons, forms or generate/buy actions (one contact link)');
  ok(!/\b(generate your|create your book now|order now|buy now|try it)\b/i.test(studio) && (studio.match(/Planned/g) || []).length === 6, 'every stage is labelled Planned and nothing is offered as available');
  ok(/iosutra\.com/.test(homeH.slice(iPromo, iStudio)) && homeH.slice(iPromo, iStudio).includes('Wellness and AI Technology') && homeH.slice(iPromo, iStudio).includes('does not imply that NVIDIA sponsors or endorses'), 'IOSutra promotion keeps its artwork heading, link and NVIDIA disclaimer');
  ok(/<img src="[^"]*iosutra-inception-member\.webp" width="288" height="99" alt="IOSutra, Inception Member"/.test(homeH) && !/io-nv-text|io-wordmark/.test(homeH.slice(iPromo, iStudio)), 'IOSutra panel is the original image at native proportions (not rebuilt in HTML text); no text-drawn NVIDIA or IOSutra logos');
  ok(/<div class="io-tile io-tile-nv"><img src="[^"]*nvidia-inception-program-badge-rgb-for-screen\.svg" alt="NVIDIA Inception Program badge" height="99"/.test(homeH) && !/official NVIDIA Inception badge is not installed/.test(homeH) && homeH.indexOf('iosutra-inception-member') < homeH.indexOf('nvidia-inception-program-badge'), 'official NVIDIA badge sits to the right of the IOSutra panel, no taller than it, and the preview placeholder note is gone');
  ok(['Space+Grotesk', 'Sora', 'Inter'].every((f) => homeH.includes(f)), 'Space Grotesk, Sora and Inter are loaded');
}
// ---- build-time guard: a broken tag must fail the build ----
const run = (cfgEdit, env = {}) => {
  const dir = path.join(ROOT, 'test/fixtures/guard-cfg'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const c = J('config/site.json'); cfgEdit(c); fs.writeFileSync(path.join(dir, 'site.json'), JSON.stringify(c));
  return spawnSync('node', [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, env: { ...process.env, ...env, FM_CONFIG: 'test/fixtures/guard-cfg/site.json', FM_OUT: 'test/out-guard', FM_DATA: 'test/fixtures/guard-data' }, encoding: 'utf8' });
};
fs.rmSync(path.join(ROOT, 'test/fixtures/guard-data'), { recursive: true, force: true }); fs.cpSync(path.join(ROOT, 'data'), path.join(ROOT, 'test/fixtures/guard-data'), { recursive: true });
const grep = fs.readFileSync(path.join(ROOT, 'scripts/build.mjs'), 'utf8');
if (/FM_CONFIG/.test(grep)) {
  let r = run((c) => { c.affiliate.marketplaces['amazon.com'].trackingId = 'wrongid-20'; });
  ok(r.status !== 0 && /AFFILIATE GUARD FAILED/.test(r.stderr), 'guard: a changed US tracking ID fails the build');
  r = run((c) => { c.affiliate.marketplaces['amazon.com'].trackingId = null; }, { AMAZON_TRACKING_ID: '', AMAZON_TRACKING_ID_COM: '' });
  ok(r.status !== 0 || /no ID configured/.test(r.stdout), 'guard: a missing US tracking ID does not pass silently');
  r = run((c) => { c.affiliate.marketplaces['amazon.co.uk'].trackingId = 'darktheoryinc-20'; });
  ok(r.status !== 0 && /US tracking ID is on amazon\.co\.uk/.test(r.stderr), 'guard: the US ID on a UK link fails the build');
} else console.log('SKIP guard tests: build.mjs has no FM_CONFIG override');

// ---- browser: niche page behaviour ----
const browser = await launch();
if (browser) for (const [name, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile' }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.route(/fonts\.(googleapis|gstatic)/, (x) => x.abort()); await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort());
  for (const n of nd.niches) {
    await pg.goto(urlOf(SITE)(`niches/${n.id}/index.html`));
    await pg.waitForTimeout(400);
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok(sw, `[${name}] ${n.id}: no horizontal page scroll`);
    const total = await pg.locator('[data-count]').first().textContent().catch(() => '');
    await pg.fill('.filters input[name=q]', 'zzzznomatch'); await pg.waitForTimeout(500);
    const empty = await pg.locator('[data-empty]').first().isVisible().catch(() => false);
    ok(empty, `[${name}] ${n.id}: search with no match shows the empty state`);
    await pg.fill('.filters input[name=q]', ''); await pg.waitForTimeout(400);
  }
  ok(!errs.length, `[${name}] no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser?.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} niche checks passed`);
process.exit(state.fails ? 1 : 0);
