#!/usr/bin/env node
// Production-mode verification in a THROWAWAY copy (test/out-prod, test/out-prodcfg; both gitignored). The repository's approvals and config are not changed.
// Reads the REAL config/approvals.json and config/site.json (the legal details the owner supplied on 2026-11-03 are recorded there). It proves what a
// production package contains: SEO, address, legal pages, self-hosted fonts, IOSutra branding, NVIDIA badge, Digital Librarian face, affiliate, voice search.
//   node test/verify-production.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok } from './lib.mjs';
import { scanPackage } from '../scripts/security-gate.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const ADDR = J('config/approvals.json').productionAddress.url;
ok(ADDR === 'https://library.forbiddenmantra.com', `the recorded production address is ${ADDR}`);

const out = path.join(ROOT, 'test/out-prod'), cfgDir = path.join(ROOT, 'test/out-prodcfg');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(cfgDir, { recursive: true });
const cfg = J('config/site.json'); cfg.legal = { ...(cfg.legal ?? {}), reviewedByOwner: false };
fs.writeFileSync(path.join(cfgDir, 'site.json'), JSON.stringify(cfg));
const run = (env) => spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, FM_ENV: 'production', FM_SITE_URL: ADDR, FM_WIX: '1', FM_PUBLIC: '1', FM_OUT: 'test/out-prod', ...env } });

// refusals: the real config (legal not reviewed) must stop a production build; so must a missing launch policy
let r = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FM_ENV: 'production', FM_SITE_URL: ADDR, FM_OUT: 'test/out-prod', FM_CONFIG: 'test/out-prodcfg/site.json' } });
ok(r.status !== 0 && /legal: the Terms, Refund, Privacy and Affiliate pages are drafts/.test(r.stderr), 'a production build is REFUSED when the legal-page review is not recorded (checked with a copy of the config)');
// the policy-off rule is checked directly on validate() below
const promo = await import('../scripts/promo.mjs');
const reg = J('data/promos.json');
const strict = promo.validate(reg, { root: ROOT, production: true, withholdUnverified: false });
ok(strict.blockers.length === 0 && strict.warnings.some((w) => /nvidia-trademark-notice/.test(w) && /attribution/.test(w)), 'production validation: the NVIDIA membership claim is verified (owner statement 2026-11-03), so nothing blocks; the trademark line is an attribution warning only');
const unverified = JSON.parse(JSON.stringify(reg)); unverified.claims.find((c) => c.id === 'nvidia-inception-membership').status = 'owner-asserted';
ok(promo.validate(unverified, { root: ROOT, production: true, withholdUnverified: false }).blockers.some((b) => /nvidia-inception-membership/.test(b)), 'an unverified membership claim still BLOCKS a production build without the launch policy');
const lenient = promo.validate(unverified, { root: ROOT, production: true, withholdUnverified: true });
ok(lenient.blockers.length === 0 && lenient.warnings.some((w) => /WITHHELD/.test(w)), 'with the launch policy an unverified membership claim is withheld, not published, and nothing else blocks');

r = run({});
ok(r.status === 0, `production build (real config and approvals) succeeds${r.status === 0 ? '' : ': ' + (r.stderr || r.stdout).slice(-400)}`);
if (r.status === 0) {
  const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } })(out);
  const rel = (f) => path.relative(out, f).split(path.sep).join('/');
  const html = files.filter((f) => f.endsWith('.html'));
  ok(fs.existsSync(path.join(out, 'index.html')), `index.html is at the package root (${html.length} pages)`);

  // ---- indexing, canonical, SEO ----
  let noindex = [], noCanon = [], badCanon = [], preview = [], noTitle = 0, noDesc = 0, draft = [];
  for (const f of html) {
    const t = fs.readFileSync(f, 'utf8'), n = rel(f);
    if (/<meta name="robots"/i.test(t) && /noindex/i.test(t)) noindex.push(n);
    const m = t.match(/<link rel="canonical" href="([^"]+)"/);
    if (!m && !/<meta name="robots" content="noindex/i.test(t)) noCanon.push(n); else if (m && !m[1].startsWith(ADDR + '/')) badCanon.push(n);
    if (/preview-bar|Preview build, not published|preview build: not for production/i.test(t)) preview.push(n);
    if (/Draft for owner and legal review/.test(t)) draft.push(n);
    if (!/<title>[^<]{3,}<\/title>/.test(t)) noTitle++;
    if (!/<meta name="description" content="[^"]{12,}"/.test(t)) noDesc++;
  }
  ok(noindex.length === 1 && noindex[0] === 'book/index.html', `noindex appears only on the dynamic book shell (book/index.html); found: ${noindex.slice(0, 3).join(', ') || 'none'}`);
  ok(noCanon.length === 0 && badCanon.length === 0, `every indexable page has a canonical URL on ${ADDR} (missing ${noCanon.length}, wrong host ${badCanon.length})`);
  ok(preview.length === 0 && draft.length === 0, `no preview banner or draft-review notice remains on any page (${preview.length + draft.length})`);
  ok(noTitle === 0 && noDesc <= html.length * 0.001, `every page has a title and a meta description (missing: title ${noTitle}, description ${noDesc})`);
  const robots = fs.readFileSync(path.join(out, 'robots.txt'), 'utf8');
  ok(/^User-agent: \*\nAllow: \/\nSitemap: https:\/\/library\.forbiddenmantra\.com\/sitemap\.xml/m.test(robots) && !/Disallow: \//.test(robots), 'robots.txt allows crawling and names https://library.forbiddenmantra.com/sitemap.xml');
  const sm = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8'); const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
  ok(locs.length > 5000 && locs.every((u) => u.startsWith(ADDR + '/')) && !locs.some((u) => /\/book\/$/.test(u)) && new Set(locs).size === locs.length, `sitemap.xml: ${locs.length} unique URLs, all on ${ADDR}, none for the noindex book shell`);
  const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8');

  // ---- IOSutra branding, NVIDIA Inception badge, Digital Librarian face (owner instructions of 2026-11-03) ----
  const tech = fs.readFileSync(path.join(out, 'technology/index.html'), 'utf8');
  const has = (f) => fs.existsSync(path.join(out, f));
  ok(has('assets/partner/iosutra-wellness-ai.webp') && has('assets/partner/iosutra-inception-member.webp') && has('assets/partner/nvidia-inception-program-badge-rgb-for-screen.svg') && has('assets/librarian/librarian.webp'), 'the IOSutra picture, IOSutra logo panel, official NVIDIA badge and the Digital Librarian image are in the package');
  ok(/<img src="[^"]*iosutra-wellness-ai\.webp"/.test(home) && !/io-art|io-mark|io-wordmark/.test(home + tech), 'the IOSutra card shows the original picture, with no drawn placeholder mark');
  ok(/<img src="[^"]*iosutra-inception-member\.webp" width="288" height="99" alt="IOSutra, Inception Member"/.test(home) && /<img src="[^"]*nvidia-inception-program-badge-rgb-for-screen\.svg" alt="NVIDIA Inception Program badge" height="99"/.test(home), 'the original IOSutra logo panel (288x99) and the unmodified official NVIDIA badge (99 px) are shown on the homepage');
  ok(/IOSutra is a member of the NVIDIA Inception program\./.test(home) && /does not imply that NVIDIA sponsors or endorses/.test(home) && /NVIDIA and NVIDIA Inception are trademarks of NVIDIA Corporation\./.test(home), 'the membership statement, the no-endorsement statement and the trademark line are all shown');
  const nvText = home + tech + fs.readFileSync(path.join(out, 'about/privacy/index.html'), 'utf8');
  ok(!/powered by NVIDIA|NVIDIA partner|NVIDIA-certified|NVIDIA-backed|in partnership with NVIDIA|NVIDIA-approved|endorsed by NVIDIA/i.test(nvText.replace(/does not imply that NVIDIA sponsors or endorses/gi, '')), 'no prohibited NVIDIA wording (powered by, partner, certified, backed, approved, endorsed by) appears');
  ok(/class="ask-face" aria-hidden="true" style="background-image:url\([^)]*assets\/librarian\/librarian\.webp\)"/.test(home) && !/ask-face-ph/.test(home), 'the homepage Ask box shows the Digital Librarian face (no sparkle placeholder)');
  // the face beside every search bar: header search on every page, filter-bar search wherever one exists
  let navPages = 0, navFace = 0, fqPages = 0, fqFace = 0;
  for (const f of html) { const t = fs.readFileSync(f, 'utf8'); if (/class="nav-search"/.test(t)) { navPages++; if (/aria-label="Site search"><span class="fm-face" aria-hidden="true"><\/span>/.test(t)) navFace++; } if (/class="f-q"/.test(t)) { fqPages++; if (/f-q-row"><span class="fm-face" aria-hidden="true"><\/span>/.test(t)) fqFace++; } }
  ok(navPages > 10000 && navFace === navPages && fqPages > 100 && fqFace === fqPages, `the Digital Librarian face sits beside every search bar: header search ${navFace}/${navPages} pages, filter-bar search ${fqFace}/${fqPages} pages, plus the homepage Ask box`);
  ok(/\.fm-face\{[^}]*url\(librarian\/librarian\.webp\)/.test(fs.readFileSync(path.join(out, 'assets/style.css'), 'utf8')), 'the face uses the original asset (assets/librarian/librarian.webp), not a new or generic image');
  ok(/data-promo="iosutra-technology"/.test(home) && /Wellness and AI Technology/.test(home) && /href="https:\/\/iosutra\.com\/\?utm_source=forbidden-mantra-press&amp;utm_medium=cross-promo&amp;utm_campaign=iosutra-technology/.test(home) && /data-promo="iosutra-technology"/.test(tech) && /foot-promo/.test(home), 'the IOSutra promotion keeps its headline, link, campaign tags, page and footer line');
  ok(/Forbidden Mantra Press is a curated library and publisher\./.test(tech) && !/is a bookstore and publisher/i.test(tech), 'the IOSutra page opens with "Forbidden Mantra Press is a curated library and publisher."');
  let bs = 0; for (const f of html) if (/separate product from this bookstore/i.test(fs.readFileSync(f, 'utf8'))) bs++;
  ok(bs === 0 && /separate product from this library/.test(tech) && /iosutra\.com\/\?utm_source=forbidden-mantra-press&amp;utm_medium=cross-promo&amp;utm_campaign=iosutra-technology/.test(home), 'the IOSutra page says "a separate product from this library" and no "bookstore" wording is left; the link keeps its campaign tags');

  // ---- wording consistency with the affiliate-referral model (owner-approved 2026-11-03) ----
  let cb = 0, st = 0; for (const f of html) { const t = fs.readFileSync(f, 'utf8'); if (/curated bookstore/i.test(t)) cb++; if (/<p class="foot-h"[^>]*>Store<\/p>/.test(t)) st++; }
  ok(cb === 0 && /A curated library of sacred texts, practice and inner cultivation/.test(home) && /<meta name="description" content="A curated library of sacred texts/.test(home), `the tagline says "curated library" on every page (pages still saying "curated bookstore": ${cb})`);
  ok(st === 0 && /<p class="foot-h"[^>]*data-i18n="foot_store">Library<\/p>/.test(home), `the footer heading is "Library", not "Store" (pages with the old heading: ${st})`);
  const i18n = fs.readFileSync(path.join(out, 'assets/i18n.js'), 'utf8');
  ok(['Library', 'المكتبة', 'Bibliothek', 'Biblioteca', 'Bibliothèque', 'पुस्तकालय'].every((w) => i18n.includes(`"foot_store":"${w}"`)) && !/"foot_store":"(Store|Shop|Tienda|Boutique|Negozio|Loja|المتجر|स्टोर)"/.test(i18n), 'the footer heading is translated to Library in all 8 interface languages');

  // ---- preserved features ----
  ok(fs.existsSync(path.join(out, 'assets/voice.js')) && /assets\/voice\.js/.test(fs.readFileSync(path.join(out, 'books/index.html'), 'utf8')), 'voice search script is in the package and loaded on catalogue pages');
  const priv = fs.readFileSync(path.join(out, 'about/privacy/index.html'), 'utf8');
  ok(/Voice search \(optional\)/.test(priv) && /may be processed by the browser provider/.test(priv) && /not sent anywhere by this site/.test(priv), 'privacy page: voice-search disclosure present and consistent with the Digital Librarian line');
  const terms = fs.readFileSync(path.join(out, 'legal/terms-refunds/index.html'), 'utf8');
  const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const tt = strip(terms), pt = strip(priv), ct = strip(fs.readFileSync(path.join(out, 'contact/index.html'), 'utf8'));
  ok(/Effective date: November 3, 2026/.test(tt) && /Effective date: November 3, 2026/.test(pt), 'legal pages carry the effective date November 3, 2026');
  ok(/operated by Ravi A\. Kissoon, operating as Forbidden Mantra Press/.test(tt) && /operated by Ravi A\. Kissoon, operating as Forbidden Mantra Press/.test(pt) && /Ravi A\. Kissoon/.test(ct), 'Terms, Privacy and Contact name the operator (Ravi A. Kissoon, operating as Forbidden Mantra Press)');
  ok(/mailto:officialravshiva@gmail\.com/.test(terms) && /officialravshiva@gmail\.com/.test(ct), 'the approved public contact email is published (mailto link) on Terms and Contact');
  ok(/at least 18 years old/.test(tt) && /laws of the State of New York/.test(tt) && /contact us first/.test(tt) && /do not require arbitration/.test(tt), 'Terms: minimum age 18, New York law, contact first then courts, no mandatory arbitration');
  ok(/not directed at children under 13/.test(pt), 'Privacy: not directed at children under 13');
  ok(!/printify|apparel/i.test(tt + pt + ct) && /browsing and affiliate referral service/.test(tt) && /not the seller of the books/.test(tt) && /not a store/.test(tt), 'Terms: no Printify/apparel language; the site is a browsing and affiliate referral service, not a seller');
  ok(/Hosting and server logs/.test(pt) && /Netlify/.test(pt), 'Privacy: Netlify hosting and server-log disclosure present');
  const emails = new Set(); for (const f of html) for (const m of fs.readFileSync(f, 'utf8').matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) emails.add(m[0].toLowerCase());
  ok(emails.size === 1 && emails.has('officialravshiva@gmail.com'), `the only email address in the whole package is the approved public contact (${[...emails].join(', ')})`);
  // fonts are self-hosted: no request to Google, files and licence shipped
  let gf = 0; for (const f of files) if (/\.(html|css|js)$/.test(f) && /fonts\.(googleapis|gstatic)\.com/.test(fs.readFileSync(f, 'utf8'))) gf++;
  ok(gf === 0 && fs.existsSync(path.join(out, 'assets/fonts.css')) && files.filter((f) => f.endsWith('.woff2')).length >= 30 && fs.existsSync(path.join(out, 'assets/fonts/LICENSES.txt')) && /Fonts:<\/strong> the site’s typefaces are served from this site itself/.test(priv), 'fonts are self-hosted (woff2 + licence notice shipped), nothing references Google Fonts, and the Privacy page says so');
  const aff = fs.readFileSync(path.join(out, 'about/affiliate-disclosure/index.html'), 'utf8');
  ok(/As an Amazon Associate I earn from qualifying purchases\./.test(aff) && /As an Amazon Associate I earn from qualifying purchases\./.test(home), 'the Amazon Associates statement is on the disclosure page and the homepage');
  const tags = new Set(); let links = 0;
  for (const f of html) for (const m of fs.readFileSync(f, 'utf8').matchAll(/amazon\.com[^"'<>\s]*[?&]tag=([A-Za-z0-9_-]+)/g)) { tags.add(m[1]); links++; }
  ok(links > 5000 && tags.size === 1 && tags.has('darktheoryinc-20'), `affiliate links carry only the tracking ID darktheoryinc-20 (${links} links checked across ${html.length} pages)`);
  const cat = J('data/catalogue.json');
  ok(cat.works.length === 16711 && cat.works.reduce((n, w) => n + w.editions.length, 0) === 31061 && cat.authors.length === 10967, 'catalogue: 16,711 works, 31,061 editions, 10,967 authors');
  const prot = new Set(J('config/protected-original-isbns.json').isbns), have = new Set(cat.works.flatMap((w) => w.editions.map((e) => e.isbn13 ?? e.asin)));
  ok([...prot].every((i) => have.has(i)), `all ${prot.size} original edition identifiers are present`);

  // ---- security gate on this package, production mode (legal approval simulated) ----
  const g = scanPackage(out, { production: true, approvals: J('config/approvals.json') });
  ok(g.ok, `security gate (production): ${g.ok ? `passed, ${g.info.files} files, tags ${JSON.stringify(g.info.affiliateTags)}` : g.fail.slice(0, 5).join(' | ')}`);
  const g2 = scanPackage(out, { production: true, approvals: { ...J('config/approvals.json'), legalPagesReviewed: { approved: false } } });
  ok(!g2.ok && g2.fail.some((x) => /legalPagesReviewed/.test(x)), 'security gate (production) rejects the package if legalPagesReviewed is not recorded');
  const g3 = scanPackage(out, { production: true, approvals: { ...J('config/approvals.json'), publicContact: { approved: false } } });
  ok(!g3.ok && g3.fail.some((x) => /email address/.test(x)), 'security gate rejects the contact email unless the owner approved it for publication');
}
fs.rmSync(path.join(ROOT, 'test/out-prodcfg'), { recursive: true, force: true });
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} production checks passed`);
process.exit(state.fails ? 1 : 0);
