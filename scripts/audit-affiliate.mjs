#!/usr/bin/env node
// Affiliate link audit: node scripts/audit-affiliate.mjs [--json]
// Checks every Amazon purchase link RENDERED in site/ against the catalogue, offline (no Amazon requests):
//   1. host/marketplace and https         2. exactly one tag= that equals the configured ID for THAT marketplace (none elsewhere)
//   3. identity: the ASIN is the edition's own ASIN, or the ISBN-10 derived from the edition's own ISBN-13 (print books)
//   4. rel="sponsored noopener"           5. live-check verdict from data/link-check.json, if a networked check has been run
// Per-link class: verified (identity ok + source/live proof)  derived (identity ok, not live-proven)  search (needs a product page)  error
// Writes data/affiliate-audit.json. Exit code 1 on any error. Expected IDs come from env AMAZON_TRACKING_ID_<SUFFIX> or config/site.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.FM_DATA ?? 'data', SITE = path.join(ROOT, process.env.FM_OUT ?? 'site');
const J = (p, d = null) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return d; } };
const cfg = J('config/site.json'), cat = J(`${DATA}/catalogue.json`), lc = J(`${DATA}/link-check.json`, { results: {} }).results;
const expectTag = (m) => process.env[`AMAZON_TRACKING_ID_${m.replace(/^amazon\./, '').toUpperCase().replace(/\./g, '_')}`] || (m === 'amazon.com' && process.env.AMAZON_TRACKING_ID) || cfg.affiliate.marketplaces[m]?.trackingId || null;
const isbn13to10 = (s) => { if (!s?.startsWith('978')) return null; const c = s.slice(3, 12); let t = 0; for (let i = 0; i < 9; i++) t += +c[i] * (10 - i); const k = (11 - (t % 11)) % 11; return c + (k === 10 ? 'X' : k); };
const isbn10Valid = (s) => /^\d{9}[\dX]$/.test(s) && [...s].reduce((t, ch, i) => t + (ch === 'X' ? 10 : +ch) * (10 - i), 0) % 11 === 0;
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const works = new Map(cat.works.map((w) => [w.slug, w]));
const links = [];
// Books beyond the static-page cap are drawn client-side from assets/idx/*.js; their buy links are audited from that payload.
const dynLinks = new Map();
const idxDir = path.join(SITE, 'assets/idx');
if (fs.existsSync(idxDir)) for (const f of fs.readdirSync(idxDir).filter((x) => /^c\d+\.js$/.test(x))) {
  const recs = JSON.parse(fs.readFileSync(path.join(idxDir, f), 'utf8').replace(/^\(window\.FM_IDX=window\.FM_IDX\|\|\{\}\)\.c\d+=/, '').replace(/;\s*$/, ''));
  for (const r of recs) if (r[13]) dynLinks.set(r[0], r[13].eds.flatMap((e) => e.b.filter((b) => b[2]).map((b) => ({ href: b[1], rel: 'sponsored noopener noreferrer', isbn13: e.i13, market: b[3] }))));
}
for (const w of cat.works) {
  if (dynLinks.has(w.slug)) { for (const l of dynLinks.get(w.slug)) links.push({ work: w.id, workTitle: w.title, press: !!w.press, ...l }); continue; }
  const html = fs.readFileSync(path.join(SITE, 'books', w.slug, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<a class="btn" href="([^"]+)" target="_blank" rel="([^"]*)" data-track="buy" data-work="([^"]*)" data-isbn="([^"]*)" data-market="([^"]*)"/g)) {
    links.push({ work: w.id, workTitle: w.title, press: !!w.press, href: decode(m[1]), rel: m[2], isbn13: m[4], market: m[5] });
  }
}
const results = links.map((l) => {
  const issues = []; let cls = 'error';
  let u; try { u = new URL(l.href); } catch { return { ...l, class: 'error', issues: ['unparseable URL'] }; }
  const w = works.get(l.work) ?? cat.works.find((x) => x.id === l.work);
  const ed = w.editions.find((e) => (e.isbn13 ?? '') === l.isbn13 && (e.isbn13 || e.asin)) ?? w.editions.find((e) => !e.isbn13 && l.isbn13 === '') ;
  const market = u.hostname.replace(/^www\./, '');
  if (u.protocol !== 'https:') issues.push('not https');
  if (!/^amazon\./.test(market)) issues.push(`host ${u.hostname} is not an Amazon marketplace`);
  if (l.market && l.market !== market) issues.push(`link host ${market} differs from the edition's marketplace ${l.market}`);
  const tags = u.searchParams.getAll('tag'), want = expectTag(market);
  if (want) { if (tags.length === 0) issues.push(`missing tag (expected ${want})`); else if (tags.length > 1) issues.push('tag appears more than once'); else if (tags[0] !== want) issues.push(`wrong tag ${tags[0]} (expected ${want})`); }
  else if (tags.length) issues.push(`tag ${tags[0]} on ${market}, which has no configured ID`);
  if (!/sponsored/.test(l.rel) || !/noopener/.test(l.rel)) issues.push('rel must include sponsored and noopener');
  const dp = u.pathname.match(/\/dp\/([A-Z0-9]{10})(?:\/|$)/);
  const verdict = lc[`${u.origin}${u.pathname}`]?.verdict;
  if (dp) {
    const asin = dp[1];
    if (!ed) issues.push('cannot match link to an edition');
    else {
      const own = ed.asin === asin || (ed.retailers ?? []).some((r) => (r.url ?? '').includes(`/dp/${asin}`));
      const derived = ed.isbn13 && isbn13to10(ed.isbn13) === asin && isbn10Valid(asin) && ['paperback', 'hardcover'].includes(ed.format);
      if (!own && !derived) issues.push(`ASIN ${asin} is neither this edition's ASIN nor the ISBN-10 of ${ed.isbn13 ?? 'its ISBN'}`);
      else cls = own && (ed.retailers ?? []).some((r) => (r.url ?? '').includes(asin) && r.verification) || (ed.sources ?? []).some((x) => (x.url ?? '').includes(`/dp/${asin}`)) || verdict === 'live' ? 'verified' : 'derived';
      l.asin = asin; l.basis = own ? 'edition ASIN' : 'ISBN-10 of the edition';
    }
    if (verdict === 'dead') issues.push('live check found HTTP 404');
  } else if (u.pathname === '/s') cls = 'search';
  else issues.push('not a product (/dp/) or search link');
  return { ...l, edition: ed ? `${ed.format} ${ed.language} ${ed.isbn13 ?? ed.asin ?? ''}`.trim() : null, class: issues.length ? 'error' : cls, issues, verdict: verdict ?? null };
});
const per = cat.works.map((w) => {
  const r = results.filter((x) => x.work === w.id), hasErr = r.some((x) => x.class === 'error');
  const best = r.some((x) => x.class === 'verified') ? 'verified' : r.some((x) => x.class === 'derived') ? 'derived' : r.some((x) => x.class === 'search') ? 'search-only' : 'none';
  return { work: w.id, title: w.title, press: !!w.press, links: r.length, best, errors: hasErr };
});
const manualReview = cat.works.map((w) => {
  const p = per.find((x) => x.work === w.id), reasons = [];
  if (p.best === 'search-only' || p.best === 'none') reasons.push('only a search link: needs the edition\'s ASIN or ISBN');
  if (w.status === 'owner-listed' && w.editions.some((e) => !e.isbn13 && !e.asin)) reasons.push('owner-listed record: edition details unconfirmed');
  if (w.editions.some((e) => e.needsSecondSource)) reasons.push('an edition identifier comes from a single source');
  if (w.editions.some((e) => e.language === 'en' && ['ebook', 'audiobook'].includes(e.format) && !e.asin && !(e.retailers ?? []).length)) reasons.push('e-book/audiobook edition has no verified Amazon link');
  if (p.errors) reasons.push('link audit error');
  return reasons.length ? { work: w.id, title: w.title, reasons } : null;
}).filter(Boolean);
const count = (f) => per.filter(f).length;
const summary = {
  works: cat.works.length, purchaseLinks: results.length, tagsExpected: Object.fromEntries(Object.keys(cfg.affiliate.marketplaces).filter(expectTag).map((m) => [m, expectTag(m)])),
  linkClasses: results.reduce((a, r) => ((a[r.class] = (a[r.class] ?? 0) + 1), a), {}),
  linkErrors: results.filter((r) => r.class === 'error').length,
  worksWithValidTaggedProductLink: count((p) => !p.errors && (p.best === 'verified' || p.best === 'derived')),
  ofWhichSourceVerified: count((p) => !p.errors && p.best === 'verified'),
  ofWhichIdentityVerifiedOffline: count((p) => !p.errors && p.best === 'derived'),
  worksWithSearchLinkOnly: count((p) => p.best === 'search-only'),
  worksWithNoPurchaseLink: count((p) => p.best === 'none'),
  worksWithLinkErrors: count((p) => p.errors),
  recordsNeedingManualReview: manualReview.length,
  manualReviewByReason: manualReview.flatMap((m) => m.reasons).reduce((a, r) => ((a[r] = (a[r] ?? 0) + 1), a), {}),
  liveCheckPending: count((p) => !p.errors && p.best === 'derived'),
};
fs.writeFileSync(path.join(ROOT, DATA, 'affiliate-audit.json'), JSON.stringify({ summary, manualReview, works: per, links: results.map(({ href, rel, ...r }) => ({ ...r, url: href.replace(/([?&]tag=)[^&]*/, '$1…') })) }, null, 1));
if (process.argv.includes('--json')) console.log(JSON.stringify({ summary, works: per }, null, 1));
else {
  console.log(JSON.stringify(summary, null, 1));
  const errs = results.filter((r) => r.class === 'error'); const byIssue = {};
  for (const e of errs) for (const i of e.issues) byIssue[i.replace(/[A-Z0-9]{10}|\d{9}[\dX]|\(expected [^)]*\)|wrong tag \S+/g, '…')] = (byIssue[i.replace(/[A-Z0-9]{10}|\d{9}[\dX]|\(expected [^)]*\)|wrong tag \S+/g, '…')] ?? 0) + 1;
  if (errs.length) console.log('\nIssues by type:', JSON.stringify(byIssue, null, 1));
}
process.exit(results.some((r) => r.class === 'error') ? 1 : 0);
