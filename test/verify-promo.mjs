#!/usr/bin/env node
// Cross-promotion (IOSutra) checks: node test/verify-promo.mjs [--shots]
// Part 1: static + browser checks on the real site build.  Part 2: gate behaviour (badge, production, wording lint) using
// temporary registries built into test/out-promo-*. Nothing here publishes anything.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, checkLinks, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const reg0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/promos.json'), 'utf8'));
const read = (rel, base = SITE) => fs.readFileSync(path.join(base, rel), 'utf8');
const allHtml = (base = SITE) => { const o = []; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? w(path.join(d, e.name)) : e.name.endsWith('.html') && o.push(path.join(d, e.name)); })(base); return o; };
const MEMBER = 'IOSutra is a member of the NVIDIA Inception program.';

// ===== Part 1: real build =====
const home = read('index.html'), tech = read('technology/index.html'), book = read('books/the-power-of-now/index.html');
ok(/<section class="band promo-band"[^>]*data-promo="iosutra-technology"/.test(home) && /<h2 id="promo-iosutra-technology-h" class="promo-name io-title">Wellness and AI Technology<\/h2>/.test(home), 'home: IOSutra section present');
ok(home.includes('The future of health, wellbeing and abundance') && tech.includes('AI-powered business software platform'), 'home carries the Wellness and AI Technology presentation; the technology page describes IOSutra as an "AI-powered business software platform"');
const pages = allHtml();
const withFooter = pages.filter((p) => fs.readFileSync(p, 'utf8').includes('class="foot-promo"')).length;
ok(withFooter === pages.length, `footer reference on all ${pages.length} pages (found ${withFooter})`);
ok(pages.every((p) => { const h = fs.readFileSync(p, 'utf8'); return !h.includes(MEMBER) || /NVIDIA sponsors or endorses/.test(h); }), 'every page that states the membership also states that it does not imply NVIDIA sponsorship or endorsement');
{ // layout: the NVIDIA badge, membership line and non-endorsement sit INSIDE the one IOSutra ad card, between two bookshelves
  const card = home.slice(home.indexOf('<div class="promo-card io-card'), home.indexOf('</section>', home.indexOf('<div class="promo-card io-card')));
  const at = (re) => home.search(re);
  ok(/nvidia-inception-program-badge[^"]*\.svg/.test(card) && card.includes('class="io-member"') && /does not imply that NVIDIA sponsors or endorses either/.test(card), 'home: NVIDIA badge, membership line and non-endorsement are inside the IOSutra ad card');
  ok(!home.replace(card, '').includes('nvidia-inception-program-badge') && !/NVIDIA/.test(home.replace(card, '').replace(/<footer[\s\S]*<\/footer>/, '').replace(/<[^>]+>/g, ' ')), 'home: the badge appears only within the ad card (no separate NVIDIA section)');
  ok(at(/data-home="fmp"/) > 0 && at(/data-home="fmp"/) < at(/class="band promo-band"/) && at(/class="band promo-band"/) < at(/data-home="featured"/), 'home: bookshelf above the IOSutra ad and another immediately below it');
  ok(/data-home="fmp"[\s\S]*?class="card-buy"/.test(home.slice(0, at(/class="band promo-band"/))) && /class="card-buy"/.test(home.slice(at(/data-home="featured"/), at(/data-home="featured"/) + 20000)), 'home: both shelves show covers/titles with shopping links');
}
ok(home.includes(MEMBER) && tech.includes(MEMBER) && book.includes(MEMBER), 'exact membership statement on home, technology page and footer');
ok(/does not extend to Forbidden Mantra Press or this bookstore/.test(home), 'home: membership explicitly scoped to IOSutra, not Forbidden Mantra Press');

// wording lint across the whole site: strip approved strings, nothing NVIDIA may remain
const allowed = ['Preview note: the official NVIDIA Inception badge is not installed (asset and usage approval pending), so only the membership statement is shown.', MEMBER, ...reg0.claims.filter((c) => c.id !== 'nvidia-inception-membership').flatMap((c) => [c.text, c.short]), reg0.externalLinks.nvidiaInception.label, reg0.externalLinks.nvidiaInception.url];
const decode = (h) => h.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
let leaks = [];
for (const p of pages) { let h = decode(fs.readFileSync(p, 'utf8')); h = h.replace(/<(script|style)[\s\S]*?<\/\1>/g, ''); for (const a of allowed) h = h.split(a).join(''); if (/nvidia/i.test(h.replace(/<[^>]+>/g, ' '))) leaks.push(path.relative(SITE, p)); }
ok(leaks.length === 0, `NVIDIA is named only in approved wording on all pages${leaks.length ? ' (leaks: ' + leaks.slice(0, 3).join(', ') + ')' : ''}`);
const banned = reg0.claims.flatMap((c) => c.prohibitedVariants ?? []);
ok(!pages.some((p) => banned.some((b) => decode(fs.readFileSync(p, 'utf8')).toLowerCase().includes(b.toLowerCase()))), `no prohibited wording anywhere (${banned.length} phrases checked)`);
const OKFILES = /^(iosutra-wellness-ai\.webp|iosutra-inception-member\.webp|nvidia-inception-program-badge-rgb-for-screen\.svg)$/;
const partner = fs.existsSync(path.join(SITE, 'assets/partner')) ? fs.readdirSync(path.join(SITE, 'assets/partner')) : [];
const OFFICIAL = 'nvidia-inception-program-badge-rgb-for-screen.svg';
ok(!/nvidia/i.test(fs.readdirSync(path.join(SITE, 'assets')).join(' ')) && partner.every((f) => OKFILES.test(f)) && [...(home.split('promo-band')[1] ?? '').matchAll(/<img[^>]*src="([^"]+)"/gi)].filter((m) => !/assets\/(brand|covers)\//.test(m[1])).every((m) => /(iosutra-wellness-ai\.webp|iosutra-inception-member\.webp|nvidia-inception-program-badge-rgb-for-screen\.svg)$/.test(m[1])), 'the only images are the IOSutra artwork and panel and the official NVIDIA badge file');
ok(Buffer.compare(fs.readFileSync(path.join(SITE, 'assets/partner', OFFICIAL)), fs.readFileSync(path.join(ROOT, 'assets-src/partner', OFFICIAL))) === 0 && reg0.brands.iosutra.badges.nvidiaInception.displayHeightPx <= reg0.brands.iosutra.logo.height, 'official NVIDIA badge is published byte-for-byte unmodified and is displayed no taller than the IOSutra panel');
ok(!/76b900/i.test(read('assets/style.css') + home), "no NVIDIA green or imitation of NVIDIA's visual style");
ok(!/sutra\.ai/i.test(pages.map((p) => fs.readFileSync(p, 'utf8')).join('')) && [...new Set(pages.flatMap((p) => [...fs.readFileSync(p, 'utf8').matchAll(/https?:\/\/[^"'\s<]*iosutra[^"'\s<]*/gi)].map((m) => new URL(m[0].replace(/&amp;/g, '&')).origin)))].every((o) => o === 'https://iosutra.com'), 'every IOSutra link goes to https://iosutra.com (the unrelated sutra.ai is not used)');
ok(!/btn-pending|link to be added/i.test(pages.map((p) => fs.readFileSync(p, 'utf8')).join('')) && (home.match(/href="https:\/\/iosutra\.com\/[^"]*"/g) || []).length >= 3, 'no placeholder anywhere; home links the image, the logo tile and the Visit IOSutra button to iosutra.com');
const ext = [...home.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)].map((m) => m[0]).filter((a) => /nvidia/i.test(a));
ok(ext.length === 1 && /href="https:\/\/www\.nvidia\.com\/en-us\/startups\/"/.test(ext[0]) && /rel="noopener noreferrer"/.test(ext[0]) && /target="_blank"/.test(ext[0]), 'home: one outbound NVIDIA link, to the official Inception page, opens in new tab with noopener noreferrer');
ok(!/rel="[^"]*sponsored/.test(home.split('promo-band')[1].split('</section>')[0]), 'promo links are not marked as affiliate/sponsored links');
const L = checkLinks(SITE); ok(L.broken.length === 0, `site links resolve (${L.pages} pages, ${L.internal} internal links) including the new technology page`);

// production gate on the real registry
const LEGALOV = path.join(ROOT, 'test/fixtures/legal-ok.json'); fs.mkdirSync(path.dirname(LEGALOV), { recursive: true }); fs.writeFileSync(LEGALOV, JSON.stringify({ legal: { reviewedByOwner: true, effectiveDate: '2026-01-01' } }));
const run = (env) => spawnSync('node', [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, env: { ...process.env, ...(env.FM_ENV === 'production' && env.FM_PROMOS ? { FM_CONFIG_OVERRIDE: LEGALOV } : {}), ...(env.FM_PROMOS ? { FM_SITE_URL: 'https://shop.example.invalid' } : {}), ...env }, encoding: 'utf8' });
let r = run({ FM_ENV: 'production', FM_OUT: 'test/out-promo-prod' });
ok(r.status === 1 && /BLOCKER promo iosutra-technology: not approved/.test(r.stderr) && /BLOCKER claim "nvidia-inception-membership" is owner-asserted/.test(r.stderr) && /BLOCKER claim "nvidia-trademark-notice"/.test(r.stderr) && /BLOCKER siteUrl/.test(r.stderr), 'production build REFUSES to run today and lists every blocker together: no owner approval, unverified membership claim, unconfirmed trademark wording, no production siteUrl');
ok(!fs.existsSync(path.join(ROOT, 'test/out-promo-prod')), 'refused production build wrote no output');
r = run({ FM_OUT: 'test/out-promo-prev' });
ok(r.status === 0 && /promo warning/.test(r.stderr), 'preview build succeeds and prints the same items as warnings');

// ===== Part 2: gate behaviour with temporary registries =====
const TMP = path.join(ROOT, 'test/fixtures'); fs.mkdirSync(TMP, { recursive: true });
const variant = (mut, name) => { const r = JSON.parse(JSON.stringify(reg0)); mut(r); const f = `test/fixtures/promos-${name}.json`; fs.writeFileSync(path.join(ROOT, f), JSON.stringify(r)); return f; };
const ready = (r) => { r.brands.iosutra.url = 'https://example.invalid/iosutra'; r.promos[0].approved = true; r.claims.forEach((c) => { c.status = 'verified'; c.verifiedOn = '2026-10-26'; }); };
const png = (w, h) => { // plain gold rectangle, a TEST placeholder (not any real mark)
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const b = Buffer.concat([Buffer.from(ty), d]); const o = Buffer.alloc(4); o.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(b)); return Buffer.concat([o, b, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from([201, 168, 76])))]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]); };
const PARTNER = path.join(ROOT, 'assets-src/partner'), TESTASSET = path.join(PARTNER, 'test-only-badge.png');
const cleanup = () => { fs.rmSync(TESTASSET, { force: true }); fs.rmSync(path.join(ROOT, 'test/out-promo-a'), { recursive: true, force: true }); for (const n of ['b', 'c', 'd', 'e', 'f', 'g', 'h']) fs.rmSync(path.join(ROOT, `test/out-promo-${n}`), { recursive: true, force: true }); };
try {
  // a) everything ready, no badge: production passes, link is tagged
  let f = variant(ready, 'a'); r = run({ FM_PROMOS: f, FM_ENV: 'production', FM_OUT: 'test/out-promo-a' });
  ok(r.status === 0, `a) ready registry builds in PRODUCTION mode (exit ${r.status}${r.status ? ': ' + r.stderr.slice(0, 200) : ''})`);
  const ah = read('index.html', path.join(ROOT, 'test/out-promo-a')), af = read('books/the-power-of-now/index.html', path.join(ROOT, 'test/out-promo-a'));
  const m = ah.match(/<a class="btn io-cta" href="(https:\/\/example\.invalid\/iosutra[^"]*)" target="_blank" rel="noopener noreferrer"[^>]*>Visit IOSutra/);
  ok(!!m, 'a) "Visit IOSutra" is a real prominent link (new tab, noopener noreferrer)');
  const u = new URL(m[1].replace(/&amp;/g, '&')); ok(u.searchParams.get('utm_source') === 'forbidden-mantra-press' && u.searchParams.get('utm_medium') === 'cross-promo' && u.searchParams.get('utm_campaign') === 'iosutra-technology' && u.searchParams.get('utm_content') === 'home', `a) outbound link carries campaign tags: ${u.search}`);
  ok(/<a href="https:\/\/example\.invalid\/iosutra[^"]*utm_content=footer/.test(af.replace(/&amp;/g, '&')), 'a) footer name links to IOSutra with utm_content=footer');
  ok(!/btn-pending/.test(ah) && (!fs.existsSync(path.join(ROOT, 'test/out-promo-a/assets/partner')) || fs.readdirSync(path.join(ROOT, 'test/out-promo-a/assets/partner')).every((f) => OKFILES.test(f))), 'a) no placeholder once URL set; still no NVIDIA badge (only the IOSutra artwork)');
  // b) badge enabled, no asset
  f = variant((r) => { ready(r); Object.assign(r.brands.iosutra.badges.nvidiaInception, { enabled: true, asset: 'missing.png', licenseConfirmed: true, guidelinesUrl: 'https://example.invalid/g', guidelinesReviewedOn: '2026-10-26' }); }, 'b'); r = run({ FM_PROMOS: f, FM_OUT: 'test/out-promo-b' });
  ok(r.status === 1 && /asset file not found/.test(r.stderr), 'b) badge enabled with a missing asset file -> build fails');
  // c) badge enabled, asset present but licence not confirmed
  fs.mkdirSync(PARTNER, { recursive: true }); fs.writeFileSync(TESTASSET, png(160, 56));
  f = variant((r) => { ready(r); Object.assign(r.brands.iosutra.badges.nvidiaInception, { enabled: true, asset: 'test-only-badge.png', licenseConfirmed: false, guidelinesUrl: 'https://example.invalid/g', guidelinesReviewedOn: '2026-10-26' }); }, 'c'); r = run({ FM_PROMOS: f, FM_OUT: 'test/out-promo-c' });
  ok(r.status === 1 && /licenseConfirmed is not true/.test(r.stderr), 'c) badge with asset but licence NOT confirmed -> build fails');
  f = variant((r) => { ready(r); Object.assign(r.brands.iosutra.badges.nvidiaInception, { enabled: true, asset: 'test-only-badge.png', licenseConfirmed: true, guidelinesUrl: null, guidelinesReviewedOn: null }); }, 'd'); r = run({ FM_PROMOS: f, FM_OUT: 'test/out-promo-d' });
  ok(r.status === 1 && /guidelinesUrl missing/.test(r.stderr) && /guidelinesReviewedOn missing/.test(r.stderr), 'd) badge without a recorded guidelines review -> build fails');
  // e) fully authorised (TEST asset): renders unaltered, with alt text, inside the membership panel only
  f = variant((r) => { ready(r); Object.assign(r.brands.iosutra.badges.nvidiaInception, { enabled: true, asset: 'test-only-badge.png', licenseConfirmed: true, guidelinesUrl: 'https://example.invalid/g', guidelinesReviewedOn: '2026-10-26' }); }, 'e'); r = run({ FM_PROMOS: f, FM_ENV: 'production', FM_OUT: 'test/out-promo-e' });
  ok(r.status === 0, `e) fully authorised badge passes the gate (exit ${r.status})`);
  const eh = read('index.html', path.join(ROOT, 'test/out-promo-e'));
  ok(/<div class="io-tile io-tile-nv"><img src="(\.\/)?assets\/partner\/test-only-badge\.png" alt="NVIDIA Inception Program badge" height="99" style="height:99px;width:auto"><\/div>/.test(eh) && fs.existsSync(path.join(ROOT, 'test/out-promo-e/assets/partner/test-only-badge.png')), 'e) badge rendered with alt text, fixed height, auto width (no distortion), asset copied unmodified');
  ok(Buffer.compare(fs.readFileSync(TESTASSET), fs.readFileSync(path.join(ROOT, 'test/out-promo-e/assets/partner/test-only-badge.png'))) === 0, 'e) badge file is byte-identical to the supplied asset');
  ok(/<img src=[^>]*test-only-badge/.test(eh) && eh.indexOf('test-only-badge') < eh.indexOf('does not extend to Forbidden Mantra Press'), 'e) badge sits in IOSutra\'s membership tile, above the separation notice, never in the bookstore header or footer');
  ok(!/pf-badge/.test(read('books/the-power-of-now/index.html', path.join(ROOT, 'test/out-promo-e'))), 'e) footer reference stays text-only (no badge outside the section)');
  // g) membership claim without separation claim
  f = variant((r) => { ready(r); r.promos[0].claims = ['nvidia-inception-membership']; }, 'g'); r = run({ FM_PROMOS: f, FM_OUT: 'test/out-promo-g' });
  ok(r.status === 1 && /must be accompanied by the "no-endorsement" claim/.test(r.stderr), 'g) membership claim without the no-endorsement claim -> build fails');
  // h) prohibited wording
  f = variant((r) => { ready(r); r.brands.iosutra.blurb = 'IOSutra is powered by NVIDIA.'; }, 'h'); r = run({ FM_PROMOS: f, FM_OUT: 'test/out-promo-h' });
  ok(r.status === 1 && /prohibited wording "powered by NVIDIA"/.test(r.stderr), 'h) copy saying "powered by NVIDIA" -> build fails');
  f = variant((r) => { ready(r); r.brands.iosutra.url = 'http://insecure.invalid'; }, 'f'); r = run({ FM_PROMOS: f, FM_OUT: 'test/out-promo-f' });
  ok(r.status === 1 && /url must be https/.test(r.stderr), 'f) non-https IOSutra URL -> build fails');
} finally { cleanup(); for (const n of 'abcdefgh') fs.rmSync(path.join(TMP, `promos-${n}.json`), { force: true }); fs.rmSync(path.join(ROOT, 'test/out-promo-prev'), { recursive: true, force: true }); }

// ===== browser =====
const browser = await launch(); if (!browser) process.exit(state.fails ? 1 : 0);
const shots = process.argv.includes('--shots'); const SH = path.join(ROOT, 'docs/screenshots'); if (shots) fs.mkdirSync(SH, { recursive: true });
const url = urlOf(SITE);
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgbOf = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
for (const [name, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile', deviceScaleFactor: 1 }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const T = `[${name}]`; const hscroll = () => pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await pg.goto(url('index.html'));
  const sec = pg.locator('.promo-band'); await sec.scrollIntoViewIfNeeded();
  ok(await sec.isVisible() && await pg.locator('.promo-name').isVisible(), `${T} IOSutra section visible`);
  if (shots) await sec.screenshot({ path: path.join(SH, `${name}-iosutra-section.png`) });
  const media = await pg.locator('.io-media').boundingBox(), panel = await pg.locator('.io-panel').boundingBox();
  ok(panel.y >= media.y + media.height - 2 && Math.abs(panel.x - media.x) < 4 && media.height >= 140, `${T} image area sits above the text panel and is not collapsed (${Math.round(media.height)}px tall)`);
  const hrefs = await pg.$$eval('.promo-band a[data-track=promo]', (as) => as.map((a) => a.href.split('?')[0])); ok(hrefs.filter((h) => h === 'https://iosutra.com/').length === 3 && (await pg.locator('.io-cta').boundingBox()).height >= 44, `${T} image, logo tile and VISIT IOSUTRA button all link to iosutra.com; button is at least 44px tall`);
  const card = await pg.locator('.promo-card').boundingBox(); ok(card.x >= 0 && card.x + card.width <= vp.width + 1, `${T} card fits the viewport (${Math.round(card.width)}px of ${vp.width})`);
  ok(await pg.evaluate(() => [...document.querySelectorAll('.promo-card *:not(.sr)')].every((e) => e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).display === 'inline')), `${T} no clipped or overflowing text inside the card`);
  ok(!(await hscroll()), `${T} no horizontal scroll on home`);
  ok(await pg.locator('.io-member').textContent().then((t) => t.trim() === MEMBER), `${T} membership statement reads exactly: "${MEMBER}"`);
  const cs = await pg.evaluate(() => { const g = (s) => getComputedStyle(document.querySelector(s)); return { pend: g('.io-cta').color, main: g('.io-member').color, tm: g('.io-legal').color, desc: g('.io-sub').color, kick: g('.io-title').color }; });
  const base = [23, 65, 60];
  const cr = Object.fromEntries(['pend', 'main', 'tm', 'desc', 'kick'].map((k) => [k, contrast(rgbOf(cs[k]), base)]));
  delete cr.pend; ok(Object.values(cr).every((v) => v >= 4.5), `${T} text contrast >= 4.5:1 on the card (${Object.entries(cr).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', ')})`);
  await pg.click('.io-more a'); ok(pg.url().endsWith('technology/index.html'), `${T} "About this section" opens the technology page`);
  if (shots) await pg.screenshot({ path: path.join(SH, `${name}-technology-page.png`), fullPage: true });
  ok(await pg.isVisible('text=What the membership statement means') && await pg.isVisible('text=NVIDIA and NVIDIA Inception are trademarks of NVIDIA Corporation.'), `${T} technology page explains the statement and carries the trademark notice`);
  ok(!(await hscroll()), `${T} no horizontal scroll on technology page`);
  // footer reference
  await pg.goto(url('books/the-power-of-now/index.html'));
  const fp = pg.locator('.foot-promo'); await fp.scrollIntoViewIfNeeded();
  const sizes = await pg.evaluate(() => ({ foot: parseFloat(getComputedStyle(document.querySelector('.foot-promo p')).fontSize), body: parseFloat(getComputedStyle(document.querySelector('.desc')).fontSize) }));
  ok(sizes.foot < sizes.body && await fp.isVisible(), `${T} footer reference is visible and smaller than body text (${sizes.foot}px vs ${sizes.body}px)`);
  ok(/member of the NVIDIA Inception program\. This does not imply NVIDIA sponsors or endorses Forbidden Mantra Press\./.test((await fp.textContent()).replace(/\s+/g, ' ')), `${T} footer pairs the membership statement with the no-endorsement line`);
  if (shots) await pg.locator('.site-footer').screenshot({ path: path.join(SH, `${name}-footer-iosutra.png`) });
  await fp.locator('a >> text=Details').click(); ok(pg.url().includes('technology/'), `${T} footer "Details" link works`);
  // interface language switching must not alter the legal wording
  await pg.goto(url('index.html')); await pg.locator('.lang-btn').click(); await pg.click('[data-ui=es]');
  ok(await pg.locator('.io-member').textContent().then((t) => t.trim() === MEMBER) && (await pg.locator('.promo-band').getAttribute('lang')) === 'en', `${T} membership statement stays in English (lang="en") when the website language is Spanish`);
  await pg.locator('.lang-btn').click(); await pg.click('[data-ui=ar]'); ok(!(await hscroll()), `${T} no horizontal scroll with Arabic interface`);
  ok(errs.length === 0, `${T} no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} promo checks passed`);
process.exit(state.fails ? 1 : 0);
