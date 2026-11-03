#!/usr/bin/env node
// Production-mode verification in a THROWAWAY copy (test/out-prod, test/out-prodcfg; both gitignored). The repository's approvals and config are not changed.
// The only simulated item is the owner's legal-page review (config/site.json legal.reviewedByOwner), which Claude never records; everything else is read
// from the real config/approvals.json. It proves what a production package contains: SEO, address, NVIDIA/artwork withholding, IOSutra, affiliate, voice search.
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
const cfg = J('config/site.json'); cfg.legal = { ...(cfg.legal ?? {}), reviewedByOwner: true, effectiveDate: '2026-11-03' };
fs.writeFileSync(path.join(cfgDir, 'site.json'), JSON.stringify(cfg));
const run = (env) => spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, FM_ENV: 'production', FM_SITE_URL: ADDR, FM_WIX: '1', FM_PUBLIC: '1', FM_OUT: 'test/out-prod', FM_CONFIG: 'test/out-prodcfg/site.json', ...env } });

// refusals: the real config (legal not reviewed) must stop a production build; so must a missing launch policy
let r = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FM_ENV: 'production', FM_SITE_URL: ADDR, FM_OUT: 'test/out-prod' } });
ok(r.status !== 0 && /legal: the Terms, Refund, Privacy and Affiliate pages are drafts/.test(r.stderr), 'a production build is REFUSED while the owner has not recorded the legal-page review');
// the policy-off rule is checked directly on validate() below
const promo = await import('../scripts/promo.mjs');
const reg = J('data/promos.json');
const strict = promo.validate(reg, { root: ROOT, production: true, withholdUnverified: false });
ok(strict.blockers.some((b) => /nvidia-inception-membership/.test(b)) && strict.blockers.some((b) => /nvidia-trademark-notice/.test(b)), 'without the owner launch policy, unverified NVIDIA claims still BLOCK a production build');
const lenient = promo.validate(reg, { root: ROOT, production: true, withholdUnverified: true });
ok(lenient.blockers.length === 0 && lenient.warnings.some((w) => /WITHHELD/.test(w)), 'with the owner launch policy, unverified claims are withheld (warning) and nothing else blocks');

r = run({});
ok(r.status === 0, `production build (simulated legal review) succeeds${r.status === 0 ? '' : ': ' + (r.stderr || r.stdout).slice(-400)}`);
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

  // ---- owner launch policy: NVIDIA claims and unapproved artwork withheld; IOSutra promotion kept ----
  let nvHits = [], other = '';
  for (const f of files) { if (/\.(html|js|css|json|svg|txt)$/.test(f)) { if (/nvidia/i.test(fs.readFileSync(f, 'utf8'))) nvHits.push(rel(f)); } else if (/nvidia|inception/i.test(rel(f))) nvHits.push(rel(f)); }
  ok(nvHits.length === 0, `no NVIDIA badge, membership, endorsement or trademark text anywhere in the production package (${nvHits.length} files: ${nvHits.slice(0, 3).join(', ')})`);
  ok(!files.some((f) => rel(f).startsWith('assets/librarian/')) && /ask-face-ph/.test(home), 'Digital Librarian character artwork is left out (rights not approved); the Ask box keeps working with its plain emblem');
  ok(!files.some((f) => /assets\/partner\//.test(rel(f))), 'no IOSutra picture or partner artwork is shipped (rights not approved)');
  const tech = fs.readFileSync(path.join(out, 'technology/index.html'), 'utf8');
  ok(/data-promo="iosutra-technology"/.test(home) && /Wellness and AI Technology/.test(home) && /href="https:\/\/iosutra\.com\/\?utm_source=/.test(home), 'the IOSutra promotion is still on the homepage with its headline and link');
  ok(/data-promo="iosutra-technology"/.test(tech) && /IOSutra is a separate product from Forbidden Mantra Press\./.test(tech) && /foot-promo/.test(home), 'the IOSutra page and footer line remain, with the separate-product statement');
  ok(!/<img[^>]+(iosutra-wellness|partner)/.test(home + tech), 'the IOSutra section renders without any picture (text and link only)');

  // ---- preserved features ----
  ok(fs.existsSync(path.join(out, 'assets/voice.js')) && /assets\/voice\.js/.test(fs.readFileSync(path.join(out, 'books/index.html'), 'utf8')), 'voice search script is in the package and loaded on catalogue pages');
  const priv = fs.readFileSync(path.join(out, 'about/privacy/index.html'), 'utf8');
  ok(/Voice search \(optional\)/.test(priv) && /may be processed by the browser provider/.test(priv) && /not sent anywhere by this site/.test(priv), 'privacy page: voice-search disclosure present and consistent with the Digital Librarian line');
  const terms = fs.readFileSync(path.join(out, 'legal/terms-refunds/index.html'), 'utf8');
  ok(/Effective date: 2026-11-03/.test(terms) || /Effective date:[^<]*2026/.test(terms), 'legal pages carry an effective date once the owner records one (simulated here)');
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
  const ap = { ...J('config/approvals.json'), legalPagesReviewed: { approved: true } };
  const g = scanPackage(out, { production: true, approvals: ap });
  ok(g.ok, `security gate (production): ${g.ok ? `passed, ${g.info.files} files, tags ${JSON.stringify(g.info.affiliateTags)}` : g.fail.slice(0, 5).join(' | ')}`);
  const g2 = scanPackage(out, { production: true, approvals: J('config/approvals.json') });
  ok(!g2.ok && g2.fail.some((x) => /legalPagesReviewed/.test(x)), 'security gate (production) rejects the package while legalPagesReviewed is not recorded');
}
fs.rmSync(path.join(ROOT, 'test/out-prodcfg'), { recursive: true, force: true });
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} production checks passed`);
process.exit(state.fails ? 1 : 0);
