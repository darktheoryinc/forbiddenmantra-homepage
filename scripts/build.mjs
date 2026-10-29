#!/usr/bin/env node
// Static site build:  node scripts/build.mjs   ->  site/
// Reads <FM_DATA>/catalogue.json (from scripts/import.mjs), data/taxonomy.json, data/languages.json, <FM_DATA>/collections.json,
// config/site.json and i18n/*.json. Zero dependencies. Links end in index.html so output also works from file:// and sub-paths.
// Env: FM_DATA (default data), FM_OUT (default site), FM_CONFIG (alternate site.json, for tests), FM_FIXTURE=1 (marks a test build with fictional records),
//      AMAZON_TRACKING_ID[_<SUFFIX>] per marketplace (see config/site.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from './lib.mjs';
import * as promo from './promo.mjs';
import { loadCovers } from './covers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const DATA = process.env.FM_DATA ?? 'data';
const OUT = path.join(ROOT, process.env.FM_OUT ?? 'site');
const FIXTURE = !!process.env.FM_FIXTURE;
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cfg = rd(process.env.FM_CONFIG ?? 'config/site.json');
// tests (and one-off builds) may override siteUrl/analytics without editing the committed config
if (process.env.FM_CONFIG_OVERRIDE) { const o = JSON.parse(fs.readFileSync(path.resolve(process.env.FM_CONFIG_OVERRIDE), 'utf8')); for (const k of ['siteUrl', 'analytics', 'legal']) if (k in o) cfg[k] = k === 'siteUrl' ? o[k] : { ...cfg[k], ...o[k] }; }
const tax = rd('data/taxonomy.json');
const langReg = rd('data/languages.json');
const cat = rd(`${DATA}/catalogue.json`);
const staged = rd(`${DATA}/staged.json`).works;
const coll = rd(`${DATA}/collections.json`);
// scale settings (config/site.json "build"; FM_BUILD='{"pageSize":10}' overrides for tests)
const BUILD = { pageSize: 48, maxStaticBookPages: 6000, maxListingPages: 40, shardSize: 1500, authorPagesAllBelow: 2000, dynShardTarget: 60, ...(cfg.build ?? {}), ...(process.env.FM_BUILD ? JSON.parse(process.env.FM_BUILD) : {}) };

// ---------- retailer link checks (scripts/check-links.mjs writes data/link-check.json from a networked machine) ----------
const LINKCHECK = fs.existsSync(path.join(ROOT, DATA, 'link-check.json')) ? rd(`${DATA}/link-check.json`).results ?? {} : {};
const LINKLOG = []; // every outbound retail URL the site renders, for check-links.mjs

// ---------- blog articles (scripts/import-articles.mjs) ----------
const ART = fs.existsSync(path.join(ROOT, DATA, 'articles.json')) ? rd(`${DATA}/articles.json`).articles : [];
const artFor = { work: (id) => ART.filter((a) => a.works.includes(id)), topic: (id) => ART.filter((a) => a.topics.includes(id)), press: () => ART.filter((a) => a.press), lang: (c) => ART.filter((a) => a.lang === c) };
const artList = (list, limit = 6) => `<ul class="articles" lang="en">${list.slice(0, limit).map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener" data-track="article" data-slug="${esc(a.slug)}"${a.lang !== 'en' ? ` lang="${a.lang}"` : ''}>${esc(a.title)}<span class="sr"> (opens in a new tab)</span></a> <span class="a-date">${a.published}</span>${a.lang !== 'en' ? ` <span class="tag">${esc(LANG.get(a.lang)?.endonym ?? a.lang)}</span>` : ''}</li>`).join('')}</ul>`;
const artBlock = (list, limit, more) => list.length ? `<h2 lang="en">From the blog</h2><p class="note-sm" lang="en">Articles from the Forbidden Mantra blog that relate to this page. Suggested by topic; the blog is a separate site.</p>${artList(list, limit)}${list.length > limit ? `<p lang="en"><a href="${href('articles/')}${more ?? ''}">All ${list.length} related articles →</a></p>` : ''}` : '';

// ---------- cross-promotion (scripts/promo.mjs) ----------
const PROMOS = promo.loadRegistry(path.join(ROOT, process.env.FM_PROMOS ?? 'data/promos.json'));
const PRODUCTION = process.env.FM_ENV === 'production';
const SITE_URL = (process.env.FM_SITE_URL ?? cfg.siteUrl ?? '').replace(/\/+$/, '');
// analytics: off unless exactly one provider is configured with its id
const ANALYTICS = (() => {
  const a = cfg.analytics ?? {}, p = a.provider;
  if (!p) return { snippet: '', provider: null };
  if (p === 'ga4') { console.error('ERROR analytics: GA4 is not supported until a consent mechanism exists.'); process.exit(1); }
  const need = { goatcounter: a.goatcounter?.code, plausible: a.plausible?.domain, cloudflare: a.cloudflare?.token }[p];
  if (!need) { console.error(`ERROR analytics: provider "${p}" has no id set in config/site.json.`); process.exit(1); }
  const snippet = { goatcounter: `<script data-goatcounter="https://${esc(need)}.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>`, plausible: `<script defer data-domain="${esc(need)}" src="https://plausible.io/js/script.js"></script>`, cloudflare: `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${esc(need)}"}'></script>` }[p];
  if (!snippet) { console.error(`ERROR analytics: unknown provider "${p}".`); process.exit(1); }
  return { snippet, provider: p };
})();
{
  const v = promo.validate(PROMOS, { root: ROOT, production: PRODUCTION });
  v.warnings.forEach((w) => console.warn(`promo warning: ${w}`));
  if (PRODUCTION && cfg.legal && !cfg.legal.reviewedByOwner) v.blockers.push('legal: the Terms, Refund, Privacy and Affiliate pages are drafts. Owner/legal review is required; then set config/site.json legal.reviewedByOwner true and legal.effectiveDate.');
  if (PRODUCTION && !/^https:\/\/[^/]+/.test(SITE_URL)) v.blockers.push('siteUrl: set config/site.json "siteUrl" (or FM_SITE_URL) to the https address the site will be served from; canonical links and the sitemap need it.');
  if (v.errors.length || v.blockers.length) {
    [...v.errors.map((e) => `ERROR   ${e}`), ...v.blockers.map((b) => `BLOCKER ${b}`)].forEach((m) => console.error(m));
    console.error(`\nBuild stopped: ${v.errors.length} error(s), ${v.blockers.length} launch blocker(s).`);
    process.exit(1);
  }
}
const promoView = (placement, id = 'iosutra-technology') => promo.resolve(PROMOS, id, placement, { root: ROOT });
const APPROVALS = fs.existsSync(path.join(ROOT, 'config/approvals.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'config/approvals.json'), 'utf8')) : {};
// FM_PUBLIC=1 (set by the hosting-package script): anything whose owner approval is not recorded in config/approvals.json is withheld from the output.
const PUBLIC_OUT = !!process.env.FM_PUBLIC, NVIDIA_OK = !PUBLIC_OUT || APPROVALS.nvidiaBranding?.approved === true;
const promoCtx = { root: ROOT, production: PRODUCTION, nvidia: NVIDIA_OK, href: (p) => href(p), asset: (f) => `${ROOT_PREFIX}assets/partner/${f}` };
const placed = (placement) => PROMOS.promos.filter((p) => p.placements?.[placement]?.enabled);

// ---------- languages & interface locales ----------
const LANG = new Map(langReg.languages.map((l) => [l.code, l]));
const lname = (c) => { const l = LANG.get(c); return l ? (l.endonym === l.name ? l.name : `${l.endonym} · ${l.name}`) : c; };
const en = rd('i18n/en.json');
const locales = { en };
for (const f of fs.readdirSync(path.join(ROOT, 'i18n')).filter((x) => x.endsWith('.json') && x !== 'en.json')) locales[f.slice(0, -5)] = rd(`i18n/${f}`);
const uiLocales = Object.keys(locales).filter((c) => LANG.has(c));
const missingKeys = Object.fromEntries(Object.entries(locales).map(([c, d]) => [c, Object.keys(en).filter((k) => !(k in d))]));
for (const [c, m] of Object.entries(missingKeys)) if (m.length) console.warn(`i18n/${c}.json is missing ${m.length} key(s); English is used as fallback: ${m.join(', ')}`);
const S = (k, tag = 'span') => `<${tag} data-i18n="${k}">${esc(en[k])}</${tag}>`;   // translatable text node
const A = (attr, k) => `${attr}="${esc(en[k])}" data-i18n-${attr}="${k}"`;          // translatable attribute
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);

// ---------- affiliate ----------
const AFF = cfg.affiliate;
const tagFor = (m) => {
  const suffix = m.replace(/^amazon\./, '').toUpperCase().replace(/\./g, '_');
  return process.env[`AMAZON_TRACKING_ID_${suffix}`] || (m === 'amazon.com' && process.env.AMAZON_TRACKING_ID) || AFF.marketplaces[m]?.trackingId || null;
};
const withTag = (url, m) => { const t = tagFor(m); return t && !/[?&]tag=/.test(url) ? `${url}${url.includes('?') ? '&' : '?'}tag=${encodeURIComponent(t)}` : url; };
// Source citations that point at Amazon: US links carry our tag (so they cannot divert a sale from the buy buttons) and are marked sponsored;
// other marketplaces have no configured tracking ID, so they stay untagged and are labelled as such. All open in a new tab (Amazon refuses framing).
const srcLink = (s) => {
  const m = (s.url.match(/^https?:\/\/(?:www\.)?(amazon\.[a-z.]+)\//i) ?? [])[1]?.toLowerCase();
  if (!m) return /^https?:/.test(s.url) ? `<a href="${esc(s.url)}" rel="noopener noreferrer">${esc(s.label)}</a>` : esc(s.label);
  return tagFor(m)
    ? `<a href="${esc(withTag(s.url, m))}" rel="sponsored noopener noreferrer" target="_blank">${esc(s.label)}</a> <span class="note-sm" lang="en">(Amazon link, affiliate-tracked)</span>`
    : `<a href="${esc(s.url)}" rel="noopener noreferrer" target="_blank">${esc(s.label)}</a> <span class="note-sm" lang="en">(${esc(m)}: not affiliate-tracked)</span>`;
};
const tagStatus = Object.fromEntries(Object.keys(AFF.marketplaces).map((m) => [m, !!tagFor(m)]));

// ---------- model ----------
const dept = new Map(tax.departments.map((d) => [d.id, d]));
const hub = new Map(tax.hubs.map((h) => [h.id, h]));
const trad = new Map(tax.traditions.map((t) => [t.id, t]));
const PERENNIAL = { id: 'perennial', name: 'Perennial Philosophy', intro: 'Writers who argue that the major mystical traditions share a common core. This is a contested position in academic study, and books in this group are labelled accordingly.' };
if (!trad.has('perennial')) { trad.set('perennial', PERENNIAL); tax.traditions.push(PERENNIAL); }
const workById = new Map(cat.works.map((w) => [w.id, w]));
const edLangs = (e) => [e.language, ...(e.alsoLanguages ?? [])];
const _wl = new WeakMap();
const wLangs = (w) => { let v = _wl.get(w); if (!v) _wl.set(w, (v = [...new Set(w.editions.flatMap(edLangs))])); return v; };
const FORMAT_ORDER = ['hardcover', 'paperback', 'ebook', 'audiobook'];

// ---------- scale model: static/dynamic tiers, index chunks, series, author pages ----------
const sortTitle = (w) => w.title.toLowerCase().replace(/^(the|a|an)\s+/, '');
const rankTier = (w) => (w.press ? 0 : ({ 'hand-verified': 1, 'web-corroborated': 2, 'auto-two-source': 3 }[w.provenance?.tier] ?? 1));
const staticSet = new Set([...cat.works].sort((a, b) => rankTier(a) - rankTier(b)).slice(0, BUILD.maxStaticBookPages).map((w) => w.id));
const isDyn = (w) => !staticSet.has(w.id);
const hubIx = new Map(tax.hubs.map((h, i) => [h.id, i]));
const chunkOf = new Map();
const orderedWorks = [...cat.works].sort((a, b) => hubIx.get(dept.get(a.subjects[0]).hubs[0]) - hubIx.get(dept.get(b.subjects[0]).hubs[0]) || (a.subjects[0] < b.subjects[0] ? -1 : a.subjects[0] > b.subjects[0] ? 1 : 0) || (sortTitle(a) < sortTitle(b) ? -1 : sortTitle(a) > sortTitle(b) ? 1 : 0));
orderedWorks.forEach((w, i) => chunkOf.set(w.id, 'c' + String(Math.floor(i / BUILD.shardSize) + 1).padStart(2, '0')));
const authorPage = new Set(cat.authors.filter((a) => cat.works.length <= BUILD.authorPagesAllBelow || a.workIds.length >= 2 || a.workIds.some((id) => workById.get(id).press)).map((a) => a.id));
const seriesMap = new Map();
for (const w of cat.works) if (w.series?.name) { const id = slugify(w.series.name); (seriesMap.get(id) ?? seriesMap.set(id, { id, name: w.series.name, works: [] }).get(id)).works.push(w); }
for (const sr of seriesMap.values()) sr.works.sort((a, b) => (a.series.number ?? 1e9) - (b.series.number ?? 1e9) || (sortTitle(a) < sortTitle(b) ? -1 : 1));
const byDept = new Map(); for (const w of cat.works) for (const d of w.subjects) (byDept.get(d) ?? byDept.set(d, []).get(d)).push(w);
const byAuthor = new Map(cat.authors.map((a) => [a.id, a.workIds.map((id) => workById.get(id))]));
function relatedFor(w) {
  const out = [];
  const add = (list, rot = 0) => { for (let i = 0; i < list.length && out.length < 4; i++) { const o = list[(i + rot) % list.length]; if (o.id !== w.id && !out.includes(o)) out.push(o); } };
  if (w.series?.name) add(seriesMap.get(slugify(w.series.name)).works);
  for (const n of w.authors) add(byAuthor.get(slugify(n)) ?? []);
  let h = 0; for (const c of w.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  for (const d of w.subjects) add(byDept.get(d), h % byDept.get(d).length);
  return out;
}

const langStats = new Map(langReg.languages.map((l) => [l.code, { works: new Set(), editions: 0, formats: new Set() }]));
for (const w of cat.works) for (const e of w.editions) for (const c of edLangs(e)) { const s = langStats.get(c) ?? (langStats.set(c, { works: new Set(), editions: 0, formats: new Set() }), langStats.get(c)); s.works.add(w.id); s.editions++; s.formats.add(e.format); }
const factSummary = (w) => {
  const fm = [...new Set(w.editions.map((e) => tax.formats[e.format].toLowerCase()))], lg = wLangs(w).map((c) => LANG.get(c)?.name ?? c);
  const pubs = [...new Set(w.editions.map((e) => e.publisher).filter(Boolean))];
  return `${w.title} by ${w.authors.join(' and ')}. Filed under ${w.subjects.map((s) => dept.get(s).name).join(' and ')}. Catalogued in ${fm.join(' and ')} (${lg.join(', ')})${pubs.length ? `, from ${pubs.slice(0, 3).join(', ')}` : ''}. We have not written a description for this title yet; the details below come from the cited sources.`;
};
const descOf = (w) => w.description || factSummary(w);
const nWorks = (c) => langStats.get(c)?.works.size ?? 0;
const nEds = (c) => langStats.get(c)?.editions ?? 0;
const stocked = langReg.languages.filter((l) => nEds(l.code) > 0).sort((a, b) => nWorks(b.code) - nWorks(a.code) || langReg.languages.indexOf(a) - langReg.languages.indexOf(b));
const unstocked = langReg.languages.filter((l) => nEds(l.code) === 0);
const totalEditions = cat.works.reduce((n, w) => n + w.editions.length, 0);

// ---------- helpers ----------
let ROOT_PREFIX = './';
const href = (p) => `${ROOT_PREFIX}${p}${p.endsWith('/') ? 'index.html' : ''}`;
const write = (rel, html) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const depthPrefix = (rel) => '../'.repeat(rel.split('/').length - 1) || './';
const worksIn = (deptId) => cat.works.filter((w) => w.subjects.includes(deptId));
const worksInHub = (hubId) => cat.works.filter((w) => w.subjects.some((s) => dept.get(s).hubs.includes(hubId)));
const LIB = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/librarian.json'), 'utf8'));
const LIB_ART = LIB.art?.file && LIB.art.rightsConfirmed && fs.existsSync(path.join(ROOT, 'assets-src/librarian', LIB.art.file)) ? LIB.art : null;
// ---------- verified covers (data/covers.json; empty until covers are supplied or licensed; see docs/COVERS.md) ----------
const COVERS = loadCovers();
if (COVERS.errors.length) { console.error('COVER MANIFEST ERRORS:\n  ' + COVERS.errors.join('\n  ')); process.exit(1); }
const coverOfWork = new Map(), coverOfEdition = new Map();
for (const c of COVERS.entries) coverOfEdition.set(`${c.work.slug}/${c.edition.id}`, c);
const reuseOfWork = new Map(); // works whose confirmed identical front artwork is also shown for other editions (display only)
for (const r of COVERS.reuse ?? []) { const a = reuseOfWork.get(r.work.slug) ?? []; a.push(r.edition.format); reuseOfWork.set(r.work.slug, a); }
for (const w of cat.works) { const c = w.editions.map((e) => coverOfEdition.get(`${w.slug}/${e.id}`)).find(Boolean); if (c) coverOfWork.set(w.slug, c); }
const coverRec = (c, w = null) => { if (!c) return 0; const rec = [c.key, c.sizes?.[240]?.w ?? 240, c.sizes?.[240]?.h ?? 360, c.has480 ? 1 : 0]; const b = w ? coverBuy(w, c) : null; if (b) rec.push(b.url); return rec; }; // 5th element: the tagged Amazon page of the cover's edition
const NETWORK = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/network.json'), 'utf8')).sites;
const NICHES = fs.existsSync(path.join(ROOT, DATA, 'niches.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, DATA, 'niches.json'), 'utf8')).niches : [];
const nicheById = new Map(NICHES.map((n) => [n.id, n]));
for (const n of NICHES) for (const d of [...n.departments, ...(n.shelves ?? []), ...(n.relatedDepartments ?? [])]) if (!dept.has(d)) throw new Error('niches.json: ' + n.id + ' references unknown department ' + d);
const nicheWorksOf = (n) => { const set = new Set(n.departments); return orderedWorks.filter((w) => w.subjects.some((x) => set.has(x))); };
const stagedIn = (deptId) => staged.filter((w) => w.subjects.includes(deptId)).length;
const stagedInHub = (hubId) => staged.filter((w) => w.subjects.some((s) => dept.get(s).hubs.includes(hubId))).length;
const primaryHub = (d) => hub.get(dept.get(d).hubs[0]);
const fmt = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- retailer links (marketplace-aware) ----------
const mkt = (r) => r.marketplace ?? (r.retailer === 'amazon' ? AFF.defaultMarketplace : null);
const amazonLabel = (m, ed) => (m === 'amazon.com' ? (ed.format === 'audiobook' ? 'Amazon (Audible)' : 'Amazon') : `Amazon.${m.slice(7)}${ed.format === 'audiobook' ? ' (Audible)' : ''}`);
function retailersRaw(work, ed) {
  const out = [];
  if (work.purchasable === false) return out; // unverified placeholder: no purchase link of any kind
  for (const r of ed.retailers ?? []) {
    const m = mkt(r);
    out.push({ label: r.retailer === 'amazon' ? amazonLabel(m, ed) : r.retailer === 'google-play' ? 'Google Play Books' : r.retailer, url: r.retailer === 'amazon' ? withTag(r.url, m) : r.url, affiliate: r.retailer === 'amazon', market: r.retailer === 'amazon' ? m : null, status: r.verification === 'owner-catalogue' ? `Listed in the owner's own bookstore catalogue on ${r.checkedOn}; live check pending` : r.verification === 'seen-in-search-results' ? `Link seen in search results on ${r.checkedOn}; live check pending` : `Verified ${r.checkedOn}` });
  }
  if (!out.some((o) => o.affiliate) && ed.language === 'en') {
    const m = ed.marketplace ?? AFF.defaultMarketplace; // UK editions etc. can name their own marketplace
    // A /dp/ link built from an ISBN-10 is an assumption, so it is limited to the hand-verified tier. Bulk-imported editions get a product
    // link only when that exact product page appeared in a cited source; otherwise a clearly labelled ISBN search link.
    const trusted = !!work.press || (work.provenance?.tier ?? 'hand-verified') === 'hand-verified';
    const seen = ed.isbn10 && (ed.sources ?? []).find((x) => new RegExp(`^https://(?:www\\.|us\\.)?amazon\\.com/[^?#]*dp/${ed.isbn10}(?:[/?#]|$)`).test(x.url));
    const candUrl = ed.isbn10 && ['paperback', 'hardcover'].includes(ed.format) && m === 'amazon.com' ? `https://www.amazon.com/dp/${ed.isbn10}` : null;
    const confirmed = candUrl && LINKCHECK[candUrl]?.verdict === 'live';
    const searchTag = AFF.searchLinks === 'untagged' ? (u) => u : (u) => withTag(u, m), searchAff = AFF.searchLinks !== 'untagged';
    if (!seen && !trusted && confirmed) out.push({ label: 'Amazon', url: withTag(candUrl, 'amazon.com'), affiliate: true, market: 'amazon.com', status: `Product page confirmed by the link check on ${LINKCHECK[candUrl].checkedOn}` });
    else if (seen) out.push({ label: 'Amazon', url: withTag(`https://www.amazon.com${new URL(seen.url).pathname}`, 'amazon.com'), affiliate: true, market: 'amazon.com', status: `Product page seen in a cited source on ${seen.accessed}; live check pending` });
    else if (!trusted && ed.isbn13) out.push({ label: 'Search on Amazon', url: searchTag(`https://www.${m}/s?k=${ed.isbn13}&i=stripbooks`), affiliate: searchAff, market: m, status: 'ISBN search link; no product page has been verified for this edition' });
    else if (ed.isbn10 && ['paperback', 'hardcover'].includes(ed.format) && !ed.noDerivedLink)
      out.push({ label: 'Amazon', url: withTag(`https://www.${m}/dp/${ed.isbn10}`, m), affiliate: true, market: m, status: 'Built from the ISBN-10; not yet confirmed live' });
    else if (work.press === 'fmp')
      out.push({ label: 'Search on Amazon', url: withTag(`https://www.${m}/s?k=${encodeURIComponent(`${work.title} ${work.subtitle ?? ''} Forbidden Mantra Press`.replace(/\s+/g, ' ').trim())}&i=stripbooks`, m), affiliate: true, market: m, status: 'Search link; edition-specific ASIN still to be added' });
  }
  if (ed.isbn13) out.push({ label: S('btn_library'), labelIsHtml: true, url: `https://search.worldcat.org/search?q=bn%3A${ed.isbn13}`, affiliate: false, library: true, status: 'Non-commercial WorldCat ISBN lookup' });
  return out;
}

// Apply link-check results: dead links are not rendered; verified ones say so; every retail URL is logged for the checker.
const TAGLOG = []; // every affiliate URL the site renders, for the build-time tag guard
const linkKind = (r) => (r.library ? 'library' : /\/dp\/[A-Z0-9]{10}/.test(r.url) ? 'product' : /amazon\.[a-z.]+\/s\?/.test(r.url) ? 'search' : 'link');
function retailers(work, ed, { log = true } = {}) {
  const out = [];
  const raw = retailersRaw(work, ed);
  // a candidate product page for search-only print editions: opt-in input to scripts/check-links.mjs --include-candidates
  if (log && !work.press && ed.isbn10 && ['paperback', 'hardcover'].includes(ed.format) && ed.language === 'en' && !raw.some((r) => linkKind(r) === 'product' && r.affiliate))
    LINKLOG.push({ work: work.id, title: `${ed.title ?? work.title}`, edition: ed.id ?? ed.isbn13 ?? '', label: 'candidate product page (ISBN-10)', market: 'amazon.com', url: `https://www.amazon.com/dp/${ed.isbn10}`, candidate: true });
  for (const r of raw) {
    r.kind = linkKind(r);
    if (r.library) { out.push(r); continue; }
    const clean = r.url.replace(/([?&])tag=[^&]*&?/, '$1').replace(/[?&]$/, '');
    if (log) LINKLOG.push({ work: work.id, title: `${ed.title ?? work.title}`, edition: ed.id ?? ed.isbn13 ?? '', label: r.label, market: r.market ?? null, url: clean });
    const lc = LINKCHECK[clean];
    if (r.market && r.affiliate && !tagFor(r.market)) r.label += ' (no affiliate tracking)';
    if (lc?.verdict === 'dead') continue;
    if (lc?.verdict === 'live') r.status = `Verified live ${lc.checkedOn}`;
    else if (lc?.verdict === 'blocked') r.status += `; automated check on ${lc.checkedOn} was blocked by the retailer`;
    else if (lc?.verdict === 'mismatch') r.status += `; check on ${lc.checkedOn} found a page whose title did not match`;
    if (r.affiliate && log) TAGLOG.push({ work: work.id, url: r.url, market: r.market, kind: r.kind });
    out.push(r);
  }
  return out;
}

// ---------- components ----------
function hashHue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
// A real cover links to the matching Amazon product page with our tracking ID: the cover's own edition first, else another edition of the same work.
function coverBuy(w, entry) {
  if (!entry || w.purchasable === false) return null;
  for (const ed of [w.editions.find((e) => e.id === entry.edition.id), ...w.editions].filter(Boolean)) {
    const r = retailers(w, ed, { log: false }).find((x) => x.affiliate && x.market === 'amazon.com');
    if (r) return { url: r.url, asin: ed.asin ?? '', kind: r.kind, own: ed.id === entry.edition.id };
  }
  return null;
}
const coverAnchor = (w, title, inner, cls) => {
  const b = coverBuy(w, coverOfWork.get(w.slug));
  return b ? `<a class="${cls} cover-buy" href="${esc(b.url)}" target="_blank" rel="sponsored noopener noreferrer" data-track="buy" data-work="${esc(w.slug)}"${b.asin ? ` data-asin="${esc(b.asin)}"` : ''} aria-label="${esc(`Buy ${title} on Amazon (affiliate link, opens in a new tab)`)}">${inner}</a>` : null;
};
function cover(w, big = false, title = w.title, entry = coverOfWork.get(w.slug)) {
  if (entry) {
    const k = entry.key, w240 = entry.sizes?.[240]?.w ?? 240, h240 = entry.sizes?.[240]?.h ?? 360, base = `${ROOT_PREFIX}assets/covers/${k}`;
    const alt = `Cover of ${title} by ${w.authors.join(', ')} (${entry.edition.format} edition)`;
    return `<div class="cover cover-photo${big ? ' cover-lg' : ''}${w.press ? ' cover-fmp' : ''}"><img src="${base}-240.webp"${entry.has480 ? ` srcset="${base}-240.webp 240w, ${base}-480.webp 480w" sizes="${big ? '300px' : '(max-width:760px) 45vw, 240px'}"` : ''} width="${w240}" height="${h240}" alt="${esc(alt)}" loading="lazy" decoding="async"></div>`;
  }
  const hue = w.press ? 38 : hashHue(w.title);
  const sz = title.length > 70 ? ' ph-s' : title.length > 40 ? ' ph-m' : '';
  return `<div class="cover cover-ph${big ? ' cover-lg' : ''}${w.press ? ' cover-fmp' : ''}" style="--h:${hue}" role="img" aria-label="Text placeholder for the cover of ${esc(title)}. The original cover art is not available yet."><span class="ph-orn" aria-hidden="true">✦</span><span class="cover-title ph-t${sz}">${esc(title)}</span><span class="cover-author">${esc(w.authors[0])}</span><span class="ph-cap" aria-hidden="true">Cover art coming</span></div>`;
}
const authorHref = (n) => (authorPage.has(slugify(n)) ? href(`authors/${slugify(n)}/`) : `${href('search/')}?q=${encodeURIComponent(n)}`);
const authorLinks = (w) => w.authors.map((n) => `<a href="${authorHref(n)}">${esc(n)}</a>`).join(', ');
const bookHref = (w, ctx = null) => (isDyn(w) ? `${href('book/')}?s=${encodeURIComponent(w.slug)}` : href(`books/${w.slug}/`)) + (ctx ? `#lang-${ctx}` : '');
function searchBlob(w) {
  const ids = w.editions.flatMap((e) => [e.isbn13, e.isbn10, e.asin].filter(Boolean));
  const langs = wLangs(w).flatMap((c) => [LANG.get(c)?.name, LANG.get(c)?.endonym, c.length > 2 ? c : null]);
  return [w.title, w.subtitle, ...w.editions.flatMap((e) => [e.title, e.subtitle, e.translator]), ...w.authors, ...w.subjects.map((s) => dept.get(s).name), ...(w.tradition ?? []).map((t) => trad.get(t)?.name), ...w.editions.map((e) => e.publisher), ...langs, w.press ? 'forbidden mantra press' : '', ...ids].filter(Boolean).join(' ').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}
// ctxLang: render the card as seen from a language page (that language's title/formats; link to its edition group)
// Homepage shelves show one tagged Amazon.com buy button per book (same URL as on the book page; silent so the audit logs list each link once).
function homeBuy(w) {
  for (const ed of w.editions) {
    const r = retailers(w, ed, { log: false }).find((x) => x.affiliate && x.market === 'amazon.com');
    if (r) return `<p class="card-buy"><a class="btn btn-buy" href="${esc(r.url)}" target="_blank" rel="sponsored noopener noreferrer" data-track="buy" data-work="${esc(w.slug)}">Buy on Amazon<span class="sr"> (affiliate link, opens in a new tab): ${esc(w.title)}</span></a></p>`;
  }
  return '';
}
function card(w, ctxLang = null, hl = 'h3', slim = false, buy = false, tag = null) {
  const eds = ctxLang ? w.editions.filter((e) => edLangs(e).includes(ctxLang)) : w.editions;
  const fmts = [...new Set(eds.map((e) => e.format))];
  const langs = [...new Set(eds.flatMap(edLangs))];
  const t = (ctxLang && eds.find((e) => e.title)?.title) || w.title;
  const sub = ctxLang ? (eds.find((e) => e.title)?.subtitle ?? '') : w.subtitle;
  const dataEd = w.editions.map((e) => ({ l: edLangs(e), f: e.format, t: e.title ?? '' }));
  const link = bookHref(w, ctxLang);
  return `<article class="card"${slim ? '' : ` data-title="${esc(w.title.toLowerCase())}" data-search="${esc(searchBlob(w))}" data-subjects="${w.subjects.join(' ')}" data-hubs="${[...new Set(w.subjects.flatMap((s) => dept.get(s).hubs))].join(' ')}" data-tradition="${(w.tradition ?? []).join(' ')}" data-level="${w.level}" data-press="${w.press ? 'fmp' : 'outside'}" data-author="${w.authors.map((a) => a.toLowerCase()).join(' ')}" data-ed="${esc(JSON.stringify(dataEd))}"${ctxLang ? ` data-ctx="${ctxLang}"` : ''} data-slug="${w.slug}" data-wtitle="${esc(w.title)}"`}>
  ${(coverOfWork.has(w.slug) && coverAnchor(w, t, cover(w, false, t), 'card-cover')) || `<a class="card-cover" href="${link}" tabindex="-1" aria-hidden="true">${cover(w, false, t)}</a>`}
  <div class="card-body">
    ${tag ? `<span class="badge badge-tag">${esc(tag)}</span>` : ''}${w.press ? '<span class="badge badge-fmp">Forbidden Mantra Press</span>' : ''}
    <${hl} class="card-title"><a href="${link}" title="${esc(t)}"${t !== w.title ? ` lang="${ctxLang}"` : ''}>${esc(t)}</a></${hl}>
    ${sub ? `<p class="card-sub">${esc(sub)}</p>` : ''}
    <p class="card-author">${authorLinks(w)}</p>
    <p class="card-meta">${fmts.map((f) => tax.formats[f]).join(' · ')} · ${langs.map((c) => LANG.get(c)?.name ?? c).join(', ')} · ${tax.levels[w.level].split(' /')[0]}</p>
    ${buy ? homeBuy(w) : ''}
  </div>
</article>`;
}
// paged: this grid shows one static page of a longer list. The filter bar then works from the lazy-loaded chunk index (see app.js), not from these cards.
const gridNote = (works, buy) => (!buy && works.some((w) => coverOfWork.has(w.slug) && coverBuy(w, coverOfWork.get(w.slug))) ? `<p class="disclosure sm" data-grid-note lang="en">${esc(cfg.disclosure.split('. ')[0])}. Book covers on this page link to Amazon (affiliate links).</p>` : '');
const grid = (works, { filterable = true, ctxLang = null, hl = 'h3', paged = null, buy = false, tag = null } = {}) => gridNote(works, buy) + (paged
  ? `<div class="grid" data-index-grid data-shards="${paged.shards.join(' ')}" data-scope='${esc(JSON.stringify(paged.scope))}' data-total="${paged.total}" data-per="${BUILD.pageSize}" data-root="${ROOT_PREFIX}"${ctxLang ? ` data-ctx="${ctxLang}"` : ''} data-hl="${hl}">${works.map((w) => card(w, ctxLang, hl, true)).join('')}</div>
<div class="grid" data-results hidden></div><p class="more" data-more-wrap hidden><button type="button" class="btn btn-ghost" data-more data-i18n="show_more">${esc(en.show_more)}</button></p>`
  : `<div class="grid" ${filterable ? 'data-filterable' : ''}>${works.map((w) => card(w, ctxLang, hl, false, buy, tag ? tag(w) : null)).join('')}</div>`);
function pager(rel, p, n) {
  if (n < 2) return '';
  const u = (k) => href(k === 1 ? rel : `${rel}page/${k}/`);
  const nums = [...new Set([1, 2, p - 2, p - 1, p, p + 1, p + 2, n - 1, n].filter((k) => k >= 1 && k <= n))].sort((a, b) => a - b);
  let prev = 0, items = '';
  for (const k of nums) { if (k - prev > 1) items += '<li class="gap" aria-hidden="true">…</li>'; items += k === p ? `<li><span aria-current="page">${k}</span></li>` : `<li><a href="${u(k)}">${k}</a></li>`; prev = k; }
  return `<nav class="pager" aria-label="Pagination" data-pager>${p > 1 ? `<a rel="prev" href="${u(p - 1)}">← Previous</a>` : '<span class="dim">← Previous</span>'}<ol>${items}</ol>${p < n ? `<a rel="next" href="${u(p + 1)}">Next →</a>` : '<span class="dim">Next →</span>'}</nav>`;
}
// Paginated listing: writes page 1 at <rel>index.html and the rest at <rel>page/N/. A list that fits on one page keeps the plain filterable grid.
function listing({ rel, works, scope, page: { body, ...pageOpts }, ctxLang = null, hl = 'h2' }) {
  const per = BUILD.pageSize, full = Math.max(1, Math.ceil(works.length / per)), n = Math.min(full, BUILD.maxListingPages), paged = works.length > per, truncated = full > n;
  const shards = paged ? [...new Set(works.map((w) => chunkOf.get(w.id)))].sort() : [];
  for (let p = 1; p <= n; p++) {
    const prel = p === 1 ? `${rel}index.html` : `${rel}page/${p}/index.html`;
    const last = pageOpts.crumbs[pageOpts.crumbs.length - 1];
    page(prel, {
      ...pageOpts, title: p > 1 ? `${pageOpts.title} · page ${p}` : pageOpts.title,
      crumbs: p > 1 ? [...pageOpts.crumbs.slice(0, -1), [last[0], rel], [`Page ${p}`]] : pageOpts.crumbs,
      links: paged ? () => [p > 1 && `<link rel="prev" href="${href(p === 2 ? rel : `${rel}page/${p - 1}/`)}">`, p < n && `<link rel="next" href="${href(`${rel}page/${p + 1}/`)}">`].filter(Boolean).join('\n') : '',
      body: () => body({ grid: grid(paged ? works.slice((p - 1) * per, p * per) : works, { ctxLang, hl, paged: paged ? { scope, shards, total: works.length } : null }), nav: pager(rel, p, n) + (truncated && p === n ? `<p class="note-sm" lang="en">This list continues for ${(works.length - n * per).toLocaleString('en-US')} more books. Use the filters or search above to reach them.</p>` : ''), p, n, paged }),
    });
  }
}

function langOptions(ctxWorks) {
  const n = (c) => ctxWorks.filter((w) => wLangs(w).includes(c)).length;
  const avail = langReg.languages.filter((l) => n(l.code) > 0).sort((a, b) => n(b.code) - n(a.code) || langReg.languages.indexOf(a) - langReg.languages.indexOf(b));
  const none = langReg.languages.filter((l) => n(l.code) === 0);
  const o = (l) => `<option value="${l.code}" data-name="${esc(l.name)}" data-endonym="${esc(l.endonym)}">${esc(lname(l.code))} (${n(l.code)})</option>`;
  return `<option value="" data-i18n="f_all_lang">${esc(en.f_all_lang)}</option>
      <optgroup ${A('label', 'f_lang_avail')}>${avail.map(o).join('')}</optgroup>
      <optgroup ${A('label', 'f_lang_unavail')}>${none.map(o).join('')}</optgroup>`;
}
// filterBar/langChips are pure functions of the work list, and a long list is rendered once per page, so they are memoised on the list.
const memoOn = (fn) => { const m = new WeakMap(); return (ctx, opts = {}) => { let b = m.get(ctx); if (!b) m.set(ctx, (b = new Map())); const k = JSON.stringify(opts); if (!b.has(k)) b.set(k, fn(ctx, opts)); return b.get(k); }; };
const filterBar = memoOn(filterBarRaw);
function filterBarRaw(ctx, { subjects = true, traditions = true, press = true, q = true, lang = true } = {}) {
  const fopts = Object.entries(tax.formats).map(([k, v]) => `<option value="${k}" data-i18n="fmt_${k}">${esc(en['fmt_' + k] ?? v)}</option>`).join('');
  const lopts = Object.entries(tax.levels).map(([k, v]) => `<option value="${k}" data-i18n="lvl_${k}">${esc(en['lvl_' + k] ?? v)}</option>`).join('');
  return `<form class="filters" role="search" aria-label="Filter books" data-filterbar onsubmit="return false">
  ${q ? `<label class="f-q">${S('f_q')}<input type="search" name="q" autocomplete="off" ${A('placeholder', 'f_q_ph')}></label>` : ''}
  ${subjects ? `<label>${S('f_subject')}<select name="subject"><option value="" data-i18n="f_all_subjects">${esc(en.f_all_subjects)}</option>${tax.departments.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label>` : ''}
  ${traditions ? `<label>${S('f_tradition')}<select name="tradition"><option value="" data-i18n="f_all_traditions">${esc(en.f_all_traditions)}</option>${tax.traditions.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>` : ''}
  ${lang ? `<label>${S('f_language')}<select name="lang">${langOptions(ctx)}</select></label>` : ''}
  <label>${S('f_format')}<select name="format"><option value="" data-i18n="f_any">${esc(en.f_any)}</option>${fopts}</select></label>
  <label>${S('f_level')}<select name="level"><option value="" data-i18n="f_any">${esc(en.f_any)}</option>${lopts}</select></label>
  ${press ? `<label>${S('f_source')}<select name="press"><option value="" data-i18n="f_all_books">${esc(en.f_all_books)}</option><option value="fmp" data-i18n="f_fmp">${esc(en.f_fmp)}</option><option value="outside" data-i18n="f_outside">${esc(en.f_outside)}</option></select></label>` : ''}
  <button type="reset" class="btn-link" data-i18n="f_clear">${esc(en.f_clear)}</button>
  <p class="f-count" role="status" aria-live="polite" data-count></p>
</form>`;
}
const emptyMsg = () => `<p class="empty" hidden data-empty><span data-empty-text data-i18n="empty_filters">${esc(en.empty_filters)}</span><span class="suggest" data-suggest></span></p>`;
const langChips = memoOn(langChipsRaw);
function langChipsRaw(works) {
  const cs = langReg.languages.map((l) => [l, works.filter((w) => wLangs(w).includes(l.code)).length]).filter(([, n]) => n > 0);
  return cs.length ? `<p class="lang-chips"><span class="lc-h" data-i18n="f_language">${esc(en.f_language)}</span> ${cs.map(([l, n]) => `<a class="tag" href="?lang=${l.code}" lang="${l.code}">${esc(l.endonym)}<span class="sr"> (${esc(l.name)})</span> <span class="n">${n}</span></a>`).join('')}</p>` : '';
};

// ---------- language menu (header) ----------
const GLOBE = '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const CHEV = '<svg class="ic chev" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
function langMenu() {
  return `<div class="langmenu" data-langmenu>
  <button class="lang-btn" type="button" aria-expanded="false" aria-controls="lang-panel">${GLOBE}<span class="lang-cur" data-ui-code>EN</span><span class="lang-word" data-i18n="lang_btn">${esc(en.lang_btn)}</span>${CHEV}</button>
  <div id="lang-panel" class="lang-panel" hidden>
    <section aria-labelledby="lp-site">
      <h2 id="lp-site" data-i18n="lang_site_h">${esc(en.lang_site_h)}</h2>
      <p class="lp-note" data-i18n="lang_site_note">${esc(en.lang_site_note)}</p>
      <p class="lp-status" data-lp-status role="status" aria-live="polite"></p>
      <ul class="lp-ui">${uiLocales.map((c) => `<li><button type="button" data-ui="${c}" lang="${c}" aria-pressed="${c === 'en'}">${esc(LANG.get(c).endonym)}${langReg.languages.find((l) => l.code === c).interface === 'beta' ? ` <small data-i18n="lang_beta">${esc(en.lang_beta)}</small>` : ''}</button></li>`).join('')}</ul>
    </section>
    <section aria-labelledby="lp-books">
      <h2 id="lp-books" data-i18n="lang_books_h">${esc(en.lang_books_h)}</h2>
      <p class="lp-note" data-i18n="lang_books_note">${esc(en.lang_books_note)}</p>
      <ul class="lp-books">${stocked.map((l) => `<li><a href="${href(`languages/${l.code}/`)}" lang="${l.code}" dir="${l.dir}">${esc(l.endonym)}</a><span class="n" data-count-ed="${nEds(l.code)}">${fmt(nEds(l.code), 'edition', 'editions')}</span></li>`).join('')}</ul>
      <details class="lp-more"><summary><span data-i18n="lang_working_h">${esc(en.lang_working_h)}</span> (${unstocked.length})</summary>
        <ul class="lp-books dim">${unstocked.map((l) => `<li><a href="${href(`languages/${l.code}/`)}" lang="${l.code}" dir="${l.dir}">${esc(l.endonym)}</a></li>`).join('')}</ul></details>
      <p class="lp-all"><a href="${href('languages/')}" data-i18n="lang_all_link">${esc(en.lang_all_link)}</a></p>
    </section>
  </div>
</div>`;
}

const NAV = [['nav_subjects', 'subjects/'], ['nav_traditions', 'traditions/'], ['nav_authors', 'authors/'], ['nav_paths', 'paths/'], ['nav_collections', 'collections/'], ['nav_press', 'press/'], ['nav_iosutra', 'technology/']];
const anyUntagged = Object.values(tagStatus).every((v) => !v);
function layout({ title, rel, desc, body, crumbs = [], jsonld = null, current = '', links = '', noindex = false, homeAsk = false }) {
  ROOT_PREFIX = depthPrefix(rel);
  const page = body();
  const bc = crumbs.length ? `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${href('')}" data-i18n="home">${esc(en.home)}</a></li>${crumbs.map(([l, u]) => `<li>${u ? `<a href="${href(u)}">${esc(l)}</a>` : `<span aria-current="page">${esc(l)}</span>`}</li>`).join('')}</ol></nav>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}${title.includes('Forbidden Mantra') ? '' : ' · Forbidden Mantra Press'}</title>
<meta name="description" content="${esc(desc ?? cfg.tagline)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : PRODUCTION ? `<link rel="canonical" href="${SITE_URL}/${rel.replace(/index\.html$/, '')}">` : '<meta name="robots" content="noindex, nofollow"><!-- preview build: not for production -->'}
<link rel="icon" href="${ROOT_PREFIX}assets/brand/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="${ROOT_PREFIX}assets/brand/favicon-32.png"><link rel="icon" type="image/png" sizes="16x16" href="${ROOT_PREFIX}assets/brand/favicon-16.png"><link rel="apple-touch-icon" sizes="180x180" href="${ROOT_PREFIX}assets/brand/apple-touch-icon-180.png">
<meta name="theme-color" content="#183F3B">
<link rel="stylesheet" href="${ROOT_PREFIX}assets/style.css">
${typeof links === 'function' ? links() : links}
${ANALYTICS.snippet}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;500;600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Cormorant+Garamond:wght@500;600&family=Montserrat:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<a class="skip" href="#main" data-i18n="skip">${esc(en.skip)}</a>
${FIXTURE ? '<div class="preview-bar fixture-bar" role="region" aria-label="Test fixture notice">TEST FIXTURE BUILD. Every record on this site is fictional and exists only to test multilingual behaviour. Never publish.</div>' : ''}
${PRODUCTION ? '' : `<div class="preview-bar" role="region" aria-label="Preview notice">Preview build, not published. Catalogue as of ${cfg.catalogueAsOf}. ${anyUntagged ? 'Amazon links carry no Associates tracking ID yet.' : ''}</div>`}
<header class="site-header">
  <div class="wrap header-in${homeAsk ? ' no-search' : ''}">
    <a class="logo" href="${href('')}" aria-label="Forbidden Mantra Press, home"><picture><source media="(max-width:520px)" srcset="${ROOT_PREFIX}assets/brand/logo-header-mobile.png 1x, ${ROOT_PREFIX}assets/brand/logo-header-mobile-2x.png 2x"><img src="${ROOT_PREFIX}assets/brand/logo-header-desktop.png" srcset="${ROOT_PREFIX}assets/brand/logo-header-desktop.png 1x, ${ROOT_PREFIX}assets/brand/logo-header-desktop-2x.png 2x" width="325" height="56" alt="Forbidden Mantra"></picture></a>
    ${homeAsk ? '' : `<form class="nav-search" action="${href('search/')}" method="get" role="search" aria-label="Site search"><label class="sr" for="q-nav" data-i18n="search_label">${esc(en.search_label)}</label><input id="q-nav" type="search" name="q" ${A('placeholder', 'search_ph')}><button type="submit" data-i18n="search_btn">${esc(en.search_btn)}</button></form>`}
    ${langMenu()}
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav" type="button"><span class="sr" data-i18n="menu">${esc(en.menu)}</span><span aria-hidden="true">☰</span></button>
    <nav id="nav" class="nav" aria-label="Main">
      <ul>${NAV.map(([k, u]) => `<li><a href="${href(u)}"${current === u ? ' aria-current="page"' : ''} data-i18n="${k}">${esc(en[k])}</a></li>`).join('')}</ul>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1" lang="en">
<div class="wrap">${bc}</div>
${page}
</main>
<footer class="site-footer">
  <div class="wrap foot-grid">
    <div><p class="foot-brand"><img src="${ROOT_PREFIX}assets/brand/logo-full-stacked-480h.png" width="391" height="150" alt="Forbidden Mantra Press" loading="lazy"></p><p>A curated bookstore of sacred texts, practice and inner cultivation.</p></div>
    <div><p class="foot-h" data-i18n="foot_browse">${esc(en.foot_browse)}</p><ul>${tax.hubs.map((h) => `<li><a href="${href(`subjects/${h.id}/`)}">${esc(h.name)}</a></li>`).join('')}</ul></div>
    <div><p class="foot-h" data-i18n="foot_store">${esc(en.foot_store)}</p><ul><li><a href="${href('books/')}" data-i18n="foot_all_books">${esc(en.foot_all_books)}</a></li><li><a href="${href('languages/')}" data-i18n="foot_languages">${esc(en.foot_languages)}</a></li>${ART.length ? `<li><a href="${href('articles/')}">Articles</a></li>` : ''}<li><a href="${href('press/')}">Forbidden Mantra Press</a></li><li><a href="${href('about/catalogue-standards/')}" data-i18n="foot_verify">${esc(en.foot_verify)}</a></li><li><a href="${href('about/affiliate-disclosure/')}" data-i18n="foot_affiliate">${esc(en.foot_affiliate)}</a></li>${LIB.enabled ? '<li><button type="button" class="btn-link" data-librarian-toggle lang="en">Hide digital librarian</button></li>' : ''}</ul></div>
    <div><p class="foot-h">Terms &amp; policies</p><ul><li><a href="${href('legal/')}">Terms &amp; Policies</a></li><li><a href="${href('legal/terms-refunds/')}">Terms of Service / Refund Policy</a></li><li><a href="${href('about/privacy/')}">Privacy Policy</a></li><li><a href="${href('about/affiliate-disclosure/')}">Affiliate Disclosure</a></li><li><a href="${href('contact/')}">Contact</a></li></ul></div>
    <div><p class="foot-h">Our network</p><ul>${NETWORK.map((n) => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" data-track="network" data-site="${esc(n.id)}">${esc(n.name)}<span class="sr"> (opens in a new tab)</span></a></li>`).join('')}<li><a href="${href('network/')}">About our network</a></li></ul></div>
  </div>
  <div class="wrap">${placed('footer').map((p) => promo.renderFooter(promoView('footer', p.id), promoCtx)).join('')}<p class="disclosure" lang="en">${esc(cfg.disclosure)}</p><p class="copy">© 2025–2026 Forbidden Mantra Press</p></div>
</footer>
${rel === 'index.html' ? `<script>window.FM_LANGBOOKS=${JSON.stringify(LANGBOOKS).replace(/</g, '\\u003c')};</script>\n` : ''}<script src="${ROOT_PREFIX}assets/i18n.js"></script>
<script src="${ROOT_PREFIX}assets/app.js"></script>${homeAsk ? `\n<script src="${ROOT_PREFIX}assets/ask.js" defer></script>` : ''}${process.env.FM_WIX ? `\n<script src="${ROOT_PREFIX}assets/wix-embed.js" defer></script>` : ''}
${LIB.enabled && !homeAsk ? `<div id="fm-librarian" hidden data-root="${ROOT_PREFIX}" data-config='${esc(JSON.stringify({ art: LIB_ART ? { ...LIB_ART, src: ROOT_PREFIX + 'assets/librarian/' + LIB_ART.file } : null, voice: LIB.voice, ai: { enabled: LIB.ai?.enabled }, startMinimizedBelowPx: LIB.startMinimizedBelowPx }))}'></div><script src="${ROOT_PREFIX}assets/librarian.js" defer></script>` : ''}
</body>
</html>`;
}
const page = (rel, opts) => write(rel, layout({ ...opts, rel }));

// ---------- output setup ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'scripts/assets/style.css'), path.join(OUT, 'assets/style.css'));
fs.copyFileSync(path.join(ROOT, 'scripts/assets/app.js'), path.join(OUT, 'assets/app.js'));
fs.copyFileSync(path.join(ROOT, 'scripts/assets/librarian.js'), path.join(OUT, 'assets/librarian.js'));
fs.copyFileSync(path.join(ROOT, 'scripts/assets/ask.js'), path.join(OUT, 'assets/ask.js'));
if (COVERS.entries.length) {
  const covDir = process.env.FM_COVERS_OPT ? path.resolve(process.env.FM_COVERS_OPT) : path.join(ROOT, 'assets-src/covers-opt');
  fs.mkdirSync(path.join(OUT, 'assets/covers'), { recursive: true });
  for (const c of COVERS.entries) for (const wd of c.has480 ? [240, 480] : [240]) fs.copyFileSync(path.join(covDir, `${c.key}-${wd}.webp`), path.join(OUT, 'assets/covers', `${c.key}-${wd}.webp`));
  console.log(`covers: ${COVERS.entries.length} verified cover(s) published`);
}
fs.mkdirSync(path.join(OUT, 'assets/brand'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'assets-src/logo/proposal'))) if (/^(logo-|favicon|apple-touch)/.test(f)) fs.copyFileSync(path.join(ROOT, 'assets-src/logo/proposal', f), path.join(OUT, 'assets/brand', f.replace('@2x', '-2x'))); // no '@' in published names (the security gate reads name@host as an email address)
if (process.env.FM_WIX) fs.copyFileSync(path.join(ROOT, 'scripts/assets/wix-embed.js'), path.join(OUT, 'assets/wix-embed.js'));
if (LIB_ART) { fs.mkdirSync(path.join(OUT, 'assets/librarian'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'assets-src/librarian', LIB_ART.file), path.join(OUT, 'assets/librarian', LIB_ART.file)); }
const i18nOut = { dict: Object.fromEntries(Object.entries(locales).map(([c, d]) => [c, Object.fromEntries(Object.entries(d).filter(([k]) => k !== '_meta'))])), langs: Object.fromEntries(langReg.languages.map((l) => [l.code, { name: l.name, endonym: l.endonym, dir: l.dir }])), ui: uiLocales };
write('assets/i18n.js', `window.FM_I18N=${JSON.stringify(i18nOut)};`);

// ---------- curated homepage selections ----------
// No sales data is available, so nothing is called a bestseller. "Featured" = an editorial-interest score from the catalogue itself:
// owner-curated home list, appearances in collections/reading paths, extra verified editions, and an author page. data/featured.json can override any category by slug.
const FEATURED_OVERRIDE = fs.existsSync(path.join(ROOT, DATA, 'featured.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, DATA, 'featured.json'), 'utf8')) : {};
const inColl = new Map();
for (const c of coll.collections) for (const id of c.works ?? []) inColl.set(id, (inColl.get(id) ?? 0) + 1);
for (const pth of coll.paths) for (const st of pth.steps ?? []) { const id = st.work ?? st.id ?? st; if (typeof id === 'string') inColl.set(id, (inColl.get(id) ?? 0) + 1); }
const homeIx = new Map((coll.featured?.home ?? []).map((id, i) => [id, i]));
const featScore = (w) => (homeIx.has(w.id) ? 4 : 0) + Math.min(3, inColl.get(w.id) ?? 0) + Math.min(2, w.editions.length - 1) + (w.authors.some((a) => authorPage.has(slugify(a))) ? 1 : 0) + ((w.provenance?.tier ?? 'hand-verified') === 'hand-verified' ? 1 : 0);
function pickFeatured(pool, n, distinctAuthors = true, exclude = new Set()) {
  const out = [], used = new Set();
  const fresh = pool.filter((w) => !exclude.has(w.id)); if (fresh.length >= Math.min(n, 2)) pool = fresh; // a book is featured in one category when another good one is available
  for (const w of [...pool].sort((a, b) => featScore(b) - featScore(a) || (a.slug < b.slug ? -1 : 1))) { if (out.length >= n) break; if (distinctAuthors && w.authors.some((a) => used.has(a))) continue; out.push(w); w.authors.forEach((a) => used.add(a)); }
  return out;
}
const featuredForHub = (hubId, n = 4, exclude = new Set()) => {
  const o = FEATURED_OVERRIDE.hubs?.[hubId];
  if (o) return o.map((id) => workById.get(id) ?? cat.works.find((w) => w.slug === id)).filter(Boolean).slice(0, n);
  const third = worksInHub(hubId).filter((w) => !w.press);
  return pickFeatured(third.length ? third : worksInHub(hubId), n, true, exclude); // a category with only our own books shows those
};
const LANGBOOKS = Object.fromEntries(stocked.map((l) => {
  const pool = cat.works.filter((w) => w.editions.some((e) => edLangs(e).includes(l.code)));
  const top = pickFeatured(pool, 8, false);
  return [l.code, { n: nEds(l.code), works: nWorks(l.code), href: `languages/${l.code}/index.html`, books: top.map((w) => { const e = w.editions.find((x) => edLangs(x).includes(l.code)); return { s: w.slug, t: e?.title || w.title, a: w.authors.join(', '), p: w.press ? 1 : 0, h: (isDyn(w) ? `book/index.html?s=${encodeURIComponent(w.slug)}` : `books/${w.slug}/index.html`) + `#lang-${l.code}`, c: w.subjects[0], v: coverRec(coverOfEdition.get(`${w.slug}/${e.id}`), w) }; }) }];
}));
const fmpWorks = cat.works.filter((w) => w.press === 'fmp');
const HL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/highlights.json'), 'utf8'));
const hlEvidence = new Set(HL.bestsellerEvidence ?? []); // owner-supplied sales evidence only; nothing else may be called a bestseller
const hlTag = (w) => (hlEvidence.has(w.slug) ? 'Bestseller' : 'Featured');
const hlOrder = new Map((HL.featured ?? []).map((sl, ix) => [sl, ix]));
const hlShelf = [...fmpWorks.filter((w) => w.purchasable !== false)].sort((a, b) => (hlOrder.has(a.slug) ? hlOrder.get(a.slug) : 99) - (hlOrder.has(b.slug) ? hlOrder.get(b.slug) : 99) || (coverOfWork.has(b.slug) ? 1 : 0) - (coverOfWork.has(a.slug) ? 1 : 0)).slice(0, 14);
const hlAllEvidenced = hlShelf.length > 0 && hlShelf.every((w) => hlEvidence.has(w.slug));
const moPaiWorks = [...new Map([...(HL.moPai.order ?? []).map((sl) => cat.works.find((w) => w.slug === sl)).filter(Boolean), ...cat.works.filter((w) => w.subjects.includes(HL.moPai.subject))].filter((w) => w.purchasable !== false).map((w) => [w.slug, w])).values()];
const outside = cat.works.filter((w) => !w.press);
const langSummary = `${fmt(cat.works.length, 'work', 'works')} · ${fmt(totalEditions, 'edition', 'editions')} · ${fmt(stocked.length, 'language with verified editions', 'languages with verified editions')}`;

// ---------- home ----------
page('index.html', {
  title: 'Forbidden Mantra Press', desc: cfg.tagline, homeAsk: true,
  body: () => `
<h1 class="sr">Forbidden Mantra Press: a curated bookstore of sacred texts, practice and inner cultivation</h1>
<section class="ask" data-ask data-root="${ROOT_PREFIX}" aria-labelledby="ask-h"><div class="wrap">
  <div class="ask-bar">
    ${LIB_ART ? `<span class="ask-face" aria-hidden="true" style="background-image:url(${ROOT_PREFIX}assets/librarian/${LIB_ART.file})"></span>` : '<span class="ask-face ask-face-ph" aria-hidden="true">✦</span>'}
    <div class="ask-main">
      <h2 id="ask-h" class="ask-h" data-i18n="ask_title">${esc(en.ask_title)}</h2>
      <form class="ask-form" data-ask-form action="${href('search/')}" method="get" role="search" aria-label="${esc(en.ask_title)}"><label class="sr" for="ask-q" data-i18n="ask_title">${esc(en.ask_title)}</label><input id="ask-q" class="ask-input" data-ask-input type="text" name="q" autocomplete="off" enterkeyhint="search" spellcheck="false" dir="auto" ${A('placeholder', 'ask_ph')}><button class="btn ask-btn" type="submit" data-i18n="ask_btn">${esc(en.ask_btn)}</button></form>
      <p class="ask-chips" data-ask-chips lang="en"><span class="ask-try">Try:</span> <button type="button" data-q="Do you have books about meditation?">Meditation</button> <button type="button" data-q="Show me books about witchcraft">Witchcraft</button> <button type="button" data-q="Which books discuss the Nag Hammadi texts?">Nag Hammadi texts</button> <button type="button" data-q="Books about Mo Pai">Mo Pai</button></p>
    </div>
  </div>
  <p class="sr" role="status" aria-live="polite" data-ask-status></p>
  <div class="ask-log" data-ask-log role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation with the digital librarian" tabindex="0" hidden></div>
  <p class="ask-foot"><span class="disclosure" lang="en">${esc(cfg.disclosure.split('. ')[0])}. <a href="${href('about/affiliate-disclosure/')}">Affiliate disclosure</a></span> <button type="button" class="ask-clear" data-ask-clear hidden>Clear conversation</button></p>
</div></section>
<section class="band" data-home="fmp" aria-labelledby="fmp-h"><div class="wrap">
  <div class="split"><h2 id="fmp-h">${hlAllEvidenced ? 'Bestsellers' : 'Featured'} from Forbidden Mantra Press</h2><a href="${href('press/')}">All ${fmpWorks.length} press titles →</a></div>
  ${grid(hlShelf, { filterable: false, buy: true, tag: hlTag })}
  <p class="lede-sm shelf-note">Books published by us, kept apart from the third-party titles further down.${hlEvidence.size ? '' : ' We call a book a bestseller only when we hold sales evidence for it; until then these are simply featured.'}</p>
</div></section>
${moPaiWorks.length ? `<section class="band alt" data-home="mopai" aria-labelledby="mopai-h"><div class="wrap">
  <div class="split"><h2 id="mopai-h">Mo Pai Collection</h2><a href="${href(`topics/${HL.moPai.subject}/`)}">All Mo Pai books →</a></div>
  <p class="lede-sm">The Mo Pai books gathered in one place. Each title keeps its own editions and languages.</p>
  ${grid(moPaiWorks, { filterable: false, buy: true, tag: hlTag })}
</div></section>` : ''}
${placed('home').map((p) => promo.renderHome(promoView('home', p.id), promoCtx)).join('')}
<section class="band alt" data-home="featured" aria-labelledby="feat-h"><div class="wrap">
  <div class="split"><h2 id="feat-h">Featured books</h2><a href="${href('books/')}">Browse all ${cat.works.length} books →</a></div>
  <p class="lede-sm">A small selection from each category. This is not a sales ranking: we have no reliable sales data, so nothing here is called a bestseller. The whole catalogue stays searchable.</p>
  ${(() => { const taken = new Set(); return tax.hubs.map((hb) => { const ws = featuredForHub(hb.id, 6, taken); ws.forEach((w) => taken.add(w.id)); return ws.length ? `<section class="niche-shelf" aria-labelledby="fh-${hb.id}"><div class="split"><h3 id="fh-${hb.id}">${esc(hb.name)}</h3><a href="${href(`subjects/${hb.id}/`)}">All ${worksInHub(hb.id).length} books →</a></div><div class="grid" data-hub-shelf="${hb.id}">${ws.map((w) => card(w, null, 'h4', true, true)).join('')}</div></section>` : ''; }).join(''); })()}
</div></section>
<section class="band studio dark" id="imagination" aria-labelledby="studio-h" lang="en" data-home="studio">
  <div class="wrap">
    <p class="studio-kicker"><span>Our vision</span><span class="soon-chip">Coming soon</span></p>
    <h2 id="studio-h" class="studio-title">From Imagination to Publication</h2>
    <p class="studio-lede">We are exploring how AI-assisted tools could help an author carry a book from a first idea to a manuscript that is ready to publish. This is a roadmap, not a service: nothing on this site generates, sells or publishes a book today.</p>
    <ol class="studio-steps" aria-label="Possible workflow, in planned order">
      <li><span class="step-no" aria-hidden="true">01</span><h3>Research</h3><p>Gather and organise sources, quotations and background notes, with the origin of each one kept so the author can check it.</p><span class="plan-tag">Planned</span></li>
      <li><span class="step-no" aria-hidden="true">02</span><h3>Writing</h3><p>Outline chapters and draft passages that the author directs, rewrites and approves.</p><span class="plan-tag">Planned</span></li>
      <li><span class="step-no" aria-hidden="true">03</span><h3>Editing</h3><p>Suggest improvements to clarity, consistency and style for the author to accept or reject.</p><span class="plan-tag">Planned</span></li>
      <li><span class="step-no" aria-hidden="true">04</span><h3>Illustration</h3><p>Explore visual ideas and artwork for interiors and covers, subject to rights and review.</p><span class="plan-tag">Planned</span></li>
      <li><span class="step-no" aria-hidden="true">05</span><h3>Formatting</h3><p>Prepare the text for print and e-book layouts.</p><span class="plan-tag">Planned</span></li>
      <li><span class="step-no" aria-hidden="true">06</span><h3>Publishing preparation</h3><p>Assemble the checklist of metadata, identifiers and files a retailer asks for.</p><span class="plan-tag">Planned</span></li>
    </ol>
    <p class="studio-soon" role="note"><span class="soon-dot" aria-hidden="true"></span><strong>Book creation tools: coming soon.</strong> There is nothing to try or buy yet. <a href="${href('contact/')}">Tell us what you would like to see</a>.</p>
  </div>
</section>
<section class="band alt" data-home="langbooks" data-langbooks hidden aria-live="polite"><div class="wrap"></div></section>
<section class="band"><div class="wrap">
  <h2>${['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][tax.hubs.length] ?? tax.hubs.length} subject hubs</h2>
  <div class="hubs">${tax.hubs.map((h) => { const n = worksInHub(h.id).length; return `<a class="hub" href="${href(`subjects/${h.id}/`)}"><h3>${esc(h.name)}</h3><p>${esc(h.tagline)}</p><span class="hub-n">${fmt(n, 'book', 'books')} · ${fmt(tax.departments.filter((d) => d.hubs.includes(h.id)).length, 'department', 'departments')}</span></a>`; }).join('')}</div>
</div></section>
${NICHES.length ? `<section class="band" data-home="guides"><div class="wrap"><div class="split"><h2>Guides by interest</h2><a href="${href('niches/')}">All guides →</a></div><div class="depts">${NICHES.map((n) => `<a class="dept" href="${href('niches/' + n.id + '/')}"><h3>${esc(n.name)}</h3><p>${esc(n.tagline)}</p><span class="hub-n">${fmt(nicheWorksOf(n).length, 'book', 'books')}</span></a>`).join('')}</div></div></section>` : ''}
<section class="band alt" data-home="discovery"><div class="wrap">
  <div class="split"><h2>Discover by story</h2><a href="${href('collections/')}">All collections →</a></div>
  <p class="lede-sm">Fantasy, myth and the supernatural, with independent recommendations for readers who love particular books or authors.</p>
  <div class="paths">${['harry-potter-discovery', 'major-fantasy-authors', 'myth-retold', 'gothic-supernatural'].map((id) => coll.collections.find((c) => c.id === id)).filter(Boolean).map((c) => `<a class="path" href="${href(`collections/${c.id}/`)}"><h3>${esc(c.title)}</h3><p>${esc(c.blurb)}</p><span class="hub-n">${fmt(c.works.length, 'book', 'books')}</span></a>`).join('')}</div>
</div></section>
<section class="band alt"><div class="wrap">
  <div class="split"><h2>Start reading</h2><a href="${href('paths/')}">All reading paths →</a></div>
  <div class="paths">${coll.paths.slice(0, 3).map((p) => `<a class="path" href="${href(`paths/${p.id}/`)}"><p class="eyebrow">${esc(p.audience)}</p><h3>${esc(p.title)}</h3><p>${esc(p.blurb)}</p></a>`).join('')}</div>
</div></section>
<section class="band"><div class="wrap">
  <div class="split"><h2>Authors</h2><a href="${href('authors/')}">Authors A–Z →</a></div>
  <p class="lede-sm">Every author in the catalogue has a page listing their books. <a href="${href('authors/')}">Browse authors A–Z</a> or use the search box above.</p>
</div></section>
<section class="band alt"><div class="wrap">
  <div class="split"><h2 data-i18n="lang_books_h">${esc(en.lang_books_h)}</h2><a href="${href('languages/')}" data-i18n="lang_all_link">${esc(en.lang_all_link)}</a></div>
  <p class="lede-sm">${stocked.length === 1 ? `Every verified edition so far is in ${esc(stocked[0].name)}. ` : ''}We add a language to the shelf only when a specific edition has been verified with its own identifier and source. ${unstocked.length} more languages are set up and waiting for verified editions.</p>
  <ul class="langs-home">${stocked.map((l) => `<li><a class="lang-tile" href="${href(`languages/${l.code}/`)}" lang="${l.code}" dir="${l.dir}"><span class="lt-name">${esc(l.endonym)}</span><span class="lt-n">${fmt(nWorks(l.code), 'book', 'books')} · ${fmt(nEds(l.code), 'edition', 'editions')}</span></a></li>`).join('')}</ul>
</div></section>
<section class="band alt"><div class="wrap narrow">
  <h2>How the catalogue is built</h2>
  <p>Every listed book has a named source for its title, author, edition and identifier. Books we cannot yet confirm are held back rather than shown. We do not display prices, ratings or bestseller badges unless they come from a source we are permitted to use. <a href="${href('about/catalogue-standards/')}">Read our standards</a>.</p>
</div></section>`,
});

// ---------- browse + search ----------
const allChunks = [...new Set(chunkOf.values())].sort();
listing({
  rel: 'books/', works: cat.works, scope: { k: 'all' },
  page: {
    title: 'All books', desc: 'Browse the full Forbidden Mantra Press catalogue.', crumbs: [['All books']], current: 'books/',
    body: ({ grid: G, nav }) => `
<section class="band"><div class="wrap">
  <h1>All books</h1><p class="lede-sm">Browse by subject, tradition, book language, format and reading level, or search by title, author, subject or ISBN.</p>
  <p class="stats">${langSummary}</p>
  ${filterBar(cat.works)}
  ${G}${nav}
  ${emptyMsg()}
  <p class="note">The catalogue is growing. ${staged.length} further outside editions are staged and will be published once each title, edition and identifier is confirmed against a source.</p>
</div></section>`,
  },
});
// The search page has no static cards: results are drawn from the lazy-loaded chunk index.
page('search/index.html', {
  title: 'Search', desc: 'Search by title, author, subject or ISBN.', crumbs: [['Search']],
  body: () => `
<section class="band"><div class="wrap">
  <h1>Search the catalogue</h1><p class="lede-sm">Search by title, author, subject or ISBN. ISBNs can be typed with or without hyphens. Language names work too.</p>
  <p class="stats">${langSummary}</p>
  ${filterBar(cat.works)}
  <p class="note" data-search-prompt>${cat.works.length.toLocaleString('en-US')} books are searchable. Start typing, or choose a filter. <a href="${href('books/')}">Browse all books</a> instead.</p>
  ${grid([], { hl: 'h2', paged: { scope: { k: 'all' }, shards: allChunks, total: cat.works.length } })}
  ${emptyMsg()}
</div></section>`,
});

// ---------- languages ----------
const langBlock = (l) => {
  const n = nWorks(l.code), e = nEds(l.code);
  return `<li class="lang-row${n ? '' : ' none'}"><a href="${href(`languages/${l.code}/`)}" lang="${l.code}" dir="${l.dir}">${esc(l.endonym)}</a> <span class="ln">${esc(l.name)}</span> <span class="lc">${n ? `${fmt(n, 'work', 'works')} · ${fmt(e, 'edition', 'editions')}` : 'no verified editions yet'}</span> <span class="lui">${l.interface === 'none' ? '' : `website: ${l.interface === 'beta' ? 'beta' : 'complete'}`}</span></li>`;
};
page('languages/index.html', {
  title: 'Languages', crumbs: [['Languages']], desc: 'Books by publication language.',
  body: () => `<section class="band"><div class="wrap"><h1 data-i18n="foot_languages">${esc(en.foot_languages)}</h1>
<p class="lede-sm">Two different things are called “language” here. The <strong>website language</strong> (menu in the header) changes menus, labels and buttons. The <strong>book language</strong> is the language an edition is actually published in. Counts below are verified editions only, and a language with zero is shown as not yet available.</p>
<p class="stats">${langSummary}</p>
<h2>With verified editions</h2><ul class="lang-list">${stocked.map(langBlock).join('')}</ul>
${Object.entries(langReg.groups).map(([g, label]) => { const ls = unstocked.filter((l) => l.group === g); return ls.length ? `<h2>${esc(label)}: not yet available</h2><ul class="lang-list">${ls.map(langBlock).join('')}</ul>` : ''; }).join('')}
</div></section>`,
});
for (const l of langReg.languages) {
  const ws = cat.works.filter((w) => wLangs(w).includes(l.code));
  const byDept = tax.departments.map((d) => [d, ws.filter((w) => w.subjects.includes(d.id)).length]).filter(([, n]) => n > 0);
  const stat = langStats.get(l.code);
  listing({ rel: `languages/${l.code}/`, works: ws, ctxLang: l.code, scope: { k: 'lang', v: l.code }, page: {
    title: `Books in ${l.name}`, desc: ws.length ? `${ws.length} works in ${l.name}.` : `No verified ${l.name} editions yet.`, crumbs: [['Languages', 'languages/'], [l.name]],
    body: ({ grid: G, nav }) => `<section class="band"><div class="wrap">
<p class="eyebrow">${esc(langReg.groups[l.group])}</p>
<h1><span lang="${l.code}" dir="${l.dir}">${esc(l.endonym)}</span>${l.endonym !== l.name ? ` <small class="h1-sub">${esc(l.name)}</small>` : ''}</h1>
${ws.length ? `<p class="stats">${fmt(ws.length, 'work', 'works')} · ${fmt(stat.editions, 'edition', 'editions')} · ${[...stat.formats].sort((a, b) => FORMAT_ORDER.indexOf(a) - FORMAT_ORDER.indexOf(b)).map((f) => tax.formats[f]).join(', ')}</p>
<p class="lede-sm">Each book below has at least one verified edition published in ${esc(l.name)}. Open a book to see that edition’s own ISBN, format and retailer link.</p>
<h2>By subject</h2><ul class="chips">${byDept.map(([d, n]) => `<li><a href="${href(`topics/${d.id}/`)}?lang=${l.code}">${esc(d.name)}</a> <span>${n}</span></li>`).join('')}</ul>
<h2>Books</h2>${filterBar(ws, { lang: false })}${G}${nav}${emptyMsg()}`
 : `<p class="stats">0 works · 0 editions</p>
<div class="empty" data-lang-empty><p><strong>We have no verified ${esc(l.name)} editions yet.</strong></p><p>A language is shown as available only when a specific edition has been verified with its own ISBN or ASIN, format, retailer link and dated source. We do not infer translations from the English books.</p><p><a class="btn btn-ghost" href="${href('books/')}">Browse all books</a> <a class="btn btn-ghost" href="${href('languages/')}">All languages</a></p></div>`}
${artFor.lang(l.code).length ? `<h2 lang="en">Articles in ${esc(l.name)}</h2><p class="note-sm" lang="en">These are blog articles, not book editions. Books in ${esc(l.name)} are listed only when a specific edition has been verified.</p>${artList(artFor.lang(l.code), 20)}` : ''}
</div></section>`,
  }});
}

// ---------- subjects ----------
page('subjects/index.html', {
  title: 'Subjects', crumbs: [['Subjects']], current: 'subjects/', desc: `${tax.hubs.length} subject hubs and ${tax.departments.length} departments.`,
  body: () => `<section class="band"><div class="wrap"><h1 data-i18n="nav_subjects">${esc(en.nav_subjects)}</h1>${tax.hubs.map((h) => `<div class="hub-block"><h2><a href="${href(`subjects/${h.id}/`)}">${esc(h.name)}</a></h2><p>${esc(h.tagline)}</p><ul class="chips">${tax.departments.filter((d) => d.hubs.includes(h.id)).map((d) => `<li><a href="${href(`topics/${d.id}/`)}">${esc(d.name)}</a> <span>${worksIn(d.id).length}</span></li>`).join('')}</ul></div>`).join('')}</div></section>`,
});
for (const h of tax.hubs) {
  const ds = tax.departments.filter((d) => d.hubs.includes(h.id));
  const ws = worksInHub(h.id);
  const fm = ws.filter((w) => w.press);
  listing({ rel: `subjects/${h.id}/`, works: ws, scope: { k: 'hub', v: h.id }, page: {
    title: h.name, desc: h.tagline, crumbs: [['Subjects', 'subjects/'], [h.name]],
    body: ({ grid: G, nav }) => `<section class="banner"><div class="wrap"><h1>${esc(h.name)}</h1><p class="lede-sm">${esc(h.intro)}</p></div></section><section class="band"><div class="wrap">
<h2>Departments</h2>
<div class="depts">${ds.map((d) => `<a class="dept" href="${href(`topics/${d.id}/`)}"><h3>${esc(d.name)}</h3><p>${esc(d.intro.split('. ')[0])}.</p><span class="hub-n">${fmt(worksIn(d.id).length, 'book', 'books')}${stagedIn(d.id) ? ` · ${stagedIn(d.id)} in review` : ''}</span></a>`).join('')}</div>
${fm.length ? `<h2>From Forbidden Mantra Press</h2>${grid(fm, { filterable: false })}` : ''}
<h2>All books in this hub</h2>
${ws.length ? langChips(ws) + filterBar(ws, { subjects: false, q: false }) + G + nav + emptyMsg() : `<p class="note">No books are published in this hub yet. ${stagedInHub(h.id)} are staged for verification.</p>`}
</div></section>`,
  }});
}
for (const d of tax.departments) {
  const ws = worksIn(d.id);
  const sameHub = tax.departments.filter((x) => x.id !== d.id && x.hubs.some((hh) => d.hubs.includes(hh)));
  listing({ rel: `topics/${d.id}/`, works: ws, scope: { k: 'dept', v: d.id }, page: {
    title: d.name, desc: d.intro.split('. ')[0] + '.', crumbs: [['Subjects', 'subjects/'], [primaryHub(d.id).name, `subjects/${primaryHub(d.id).id}/`], [d.name]],
    body: ({ grid: G, nav }) => `<section class="banner"><div class="wrap"><p class="eyebrow">${d.hubs.map((hh) => esc(hub.get(hh).name)).join(' · ')}</p><h1>${esc(d.name)}</h1><p class="lede-sm">${esc(d.intro)}</p></div></section><section class="band"><div class="wrap">
${ws.length ? langChips(ws) + filterBar(ws, { subjects: false, q: false }) + G + nav + emptyMsg() : `<p class="note">No books are published in this department yet. ${stagedIn(d.id) ? `${stagedIn(d.id)} candidate titles are in review.` : 'Candidate titles have not yet been staged.'}</p>`}
${artBlock(artFor.topic(d.id), 6, `#t-${d.id}`)}
<h2>Related departments</h2><ul class="chips">${sameHub.map((x) => `<li><a href="${href(`topics/${x.id}/`)}">${esc(x.name)}</a></li>`).join('')}</ul>
</div></section>`,
  }});
}

// ---------- niche landing pages (data/niches.json) ----------
const buyBtn = (w) => {
  for (const e of w.editions) {
    const r = retailers(w, e).find((x) => x.affiliate && !x.library);
    if (r) return '<a class="btn" href="' + esc(r.url) + '" target="_blank" rel="sponsored noopener noreferrer" data-track="buy" data-work="' + esc(w.slug) + '" data-isbn="' + (e.isbn13 ?? '') + '" data-market="' + (r.market ?? '') + '" data-linktype="' + r.kind + '" data-cat="' + w.subjects[0] + '" data-own="' + (w.press ? 'fmp' : 'third-party') + '">Buy on Amazon (affiliate link)<span class="sr"> (opens in a new tab)</span></a>';
  }
  return '';
};
page('niches/index.html', {
  title: 'Guides by interest', crumbs: [['Guides']], desc: 'Curated landing pages for the main interests in the catalogue.',
  body: () => '<section class="band"><div class="wrap"><h1>Guides by interest</h1><p class="lede-sm">Curated starting points. Each guide gathers a part of the catalogue with its authors, series, related subjects and articles.</p><div class="depts">' + NICHES.map((n) => '<a class="dept" href="' + href('niches/' + n.id + '/') + '"><h2>' + esc(n.name) + '</h2><p>' + esc(n.tagline) + '</p><span class="hub-n">' + fmt(nicheWorksOf(n).length, 'book', 'books') + '</span></a>').join('') + '</div></div></section>',
});
for (const n of NICHES) {
  const ws = nicheWorksOf(n), depSet = new Set(n.departments);
  const own = ws.filter((w) => w.press);
  const fallback = !own.length ? (n.fmpFallback ?? []).map((id) => workById.get(id)).filter(Boolean) : [];
  const picks = own.length ? own : fallback;
  // featured authors: most books in the niche, or any Forbidden Mantra Press author
  const ac = new Map(); for (const w of ws) for (const a of w.authors) ac.set(a, (ac.get(a) ?? 0) + 1);
  const authors = [...ac].filter(([a, c]) => authorPage.has(slugify(a)) && (c >= 2 || ws.some((w) => w.press && w.authors.includes(a)))).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8);
  const sers = [...seriesMap.values()].map((sr) => ({ sr, k: sr.works.filter((w) => w.subjects.some((x) => depSet.has(x))).length })).filter((x) => x.k >= 2).sort((a, b) => b.k - a.k).slice(0, 6);
  const shelfDeps = (n.shelves ?? []).filter((d) => ws.some((w) => w.subjects.includes(d)));
  const shelf = (d) => { const list = ws.filter((w) => w.subjects.includes(d)).sort((a, b) => (b.press ? 1 : 0) - (a.press ? 1 : 0)).slice(0, 8); return '<section class="niche-shelf" aria-labelledby="sh-' + d + '"><div class="split"><h3 id="sh-' + d + '">' + esc(dept.get(d).name) + '</h3><a href="' + href('topics/' + d + '/') + '">All ' + fmt(worksIn(d).length, 'book', 'books') + ' →</a></div><div class="shelf" role="region" tabindex="0" aria-label="' + esc(dept.get(d).name) + ' books, scroll sideways">' + list.map((w) => card(w, null, 'h4', true)).join('') + '</div></section>'; };
  const arts = [...new Map(n.departments.flatMap((d) => artFor.topic(d)).map((a) => [a.slug, a])).values()];
  const relDeps = [...new Set([...n.departments, ...(n.relatedDepartments ?? [])])].filter((d) => worksIn(d).length);
  const shelves = () => (shelfDeps.length ? shelfDeps.map(shelf).join('') : '');
  listing({ rel: 'niches/' + n.id + '/', works: ws, scope: { k: 'depts', v: n.departments }, page: {
    title: n.name, desc: n.tagline, crumbs: [['Guides', 'niches/'], [n.name]],
    body: ({ grid: G, nav }) => '<section class="hero hero-sm niche-hero"><div class="wrap"><p class="eyebrow">Guide</p><h1>' + esc(n.name) + '</h1><p class="lede">' + esc(n.intro) + '</p><p class="hero-links"><span class="status">' + fmt(ws.length, 'book', 'books') + ' · ' + fmt(own.length, 'Forbidden Mantra Press title', 'Forbidden Mantra Press titles') + '</span></p></div></section>' +
      '<section class="band"><div class="wrap">' +
      (picks.length ? '<section class="niche-fmp" aria-labelledby="nf-h" data-own-section><h2 id="nf-h">From Forbidden Mantra Press</h2>' + (own.length ? '<p class="note-sm">Books published by us. Buying through the Amazon links below earns us both the publisher royalty and an affiliate commission.</p>' : '<p class="note-sm">' + esc(n.fmpFallbackNote) + '</p>') + '<div class="fmp-picks">' + picks.map((w) => '<div class="fmp-pick">' + card(w, null, 'h3', true) + '<p class="pick-buy">' + buyBtn(w) + '</p></div>').join('') + '</div></section>' : '') +
      shelves() +
      (authors.length ? '<h2>Featured authors</h2><ul class="chips">' + authors.map(([a, c]) => '<li><a href="' + authorHref(a) + '">' + esc(a) + '</a> <span>' + c + '</span></li>').join('') + '</ul>' : '') +
      (sers.length ? '<h2>Series</h2><ul class="chips">' + sers.map((x) => '<li><a href="' + href('series/' + x.sr.id + '/') + '">' + esc(x.sr.name) + '</a> <span>' + x.k + '</span></li>').join('') + '</ul>' : '') +
      '<h2>Browse and search this guide</h2>' + langChips(ws) + filterBar(ws, { subjects: false }) + G + nav + emptyMsg() +
      '<p class="note-sm" lang="en">' + esc(cfg.disclosure) + ' Purchase links are on each book page and are labelled.</p>' +
      '<h2>Related subjects</h2><ul class="chips">' + relDeps.map((d) => '<li><a href="' + href('topics/' + d + '/') + '">' + esc(dept.get(d).name) + '</a></li>').join('') + '</ul>' +
      ((n.related ?? []).length ? '<h2>Related guides</h2><ul class="chips">' + n.related.map((id) => nicheById.get(id)).filter(Boolean).map((x) => '<li><a href="' + href('niches/' + x.id + '/') + '">' + esc(x.name) + '</a></li>').join('') + '</ul>' : '') +
      artBlock(arts, 6, '#t-' + n.departments[0]) + '</div></section>',
  }});
}

// ---------- traditions ----------
page('traditions/index.html', {
  title: 'Traditions', crumbs: [['Traditions']], current: 'traditions/', desc: 'Browse by tradition.',
  body: () => `<section class="band"><div class="wrap"><h1 data-i18n="nav_traditions">${esc(en.nav_traditions)}</h1><p class="lede-sm">Traditions are kept distinct. A book on Taoist internal alchemy is not filed with Hindu tantra, and Gnostic texts are not mixed with Christian mystical writing. Where a book is a modern adaptation or draws on several sources, its page says so.</p>
<div class="depts">${tax.traditions.map((t) => `<a class="dept" href="${href(`traditions/${t.id}/`)}"><h2>${esc(t.name)}</h2><p>${esc(t.intro)}</p><span class="hub-n">${fmt(cat.works.filter((w) => (w.tradition ?? []).includes(t.id)).length, 'book', 'books')}</span></a>`).join('')}</div></div></section>`,
});
for (const t of tax.traditions) {
  const ws = cat.works.filter((w) => (w.tradition ?? []).includes(t.id));
  listing({ rel: `traditions/${t.id}/`, works: ws, scope: { k: 'trad', v: t.id }, page: {
    title: t.name, desc: t.intro, crumbs: [['Traditions', 'traditions/'], [t.name]],
    body: ({ grid: G, nav }) => `<section class="banner"><div class="wrap"><h1>${esc(t.name)}</h1><p class="lede-sm">${esc(t.intro)}</p></div></section><section class="band"><div class="wrap">${ws.length ? langChips(ws) + filterBar(ws, { traditions: false, q: false }) + G + nav + emptyMsg() : '<p class="note">No books are published under this tradition yet.</p>'}</div></section>`,
  }});
}

// ---------- authors ----------
// Small catalogues list every author on one page. Large ones get one page per initial letter (paged), and authors with a single book
// link to a search for their name instead of owning a page, which keeps the file count down.
const authorList = cat.authors.filter((a) => authorPage.has(a.id));
const letters = [...new Set(authorList.map((a) => a.sortName[0].toUpperCase()))].sort();
const authorRow = (a) => `<li><a href="${href(`authors/${a.id}/`)}">${esc(a.sortName)}</a> <span>${fmt(a.workIds.length, 'book', 'books')}</span></li>`;
const LETTER_PAGE = BUILD.authorsPerPage ?? 400;
if (authorList.length <= LETTER_PAGE) {
  page('authors/index.html', {
    title: 'Authors A–Z', crumbs: [['Authors']], current: 'authors/', desc: 'Authors A to Z.',
    body: () => `<section class="band"><div class="wrap"><h1>${S('nav_authors')} A–Z</h1>
<nav class="az" aria-label="Jump to letter">${letters.map((l) => `<a href="#l-${l}">${l}</a>`).join('')}</nav>
${letters.map((l) => `<h2 id="l-${l}">${l}</h2><ul class="authors">${authorList.filter((a) => a.sortName[0].toUpperCase() === l).map(authorRow).join('')}</ul>`).join('')}
</div></section>`,
  });
} else {
  page('authors/index.html', {
    title: 'Authors A–Z', crumbs: [['Authors']], current: 'authors/', desc: 'Authors A to Z.',
    body: () => `<section class="band"><div class="wrap"><h1>${S('nav_authors')} A–Z</h1><p class="lede-sm">${fmt(authorList.length, 'author page', 'author pages')}. Choose an initial.</p>
<nav class="az" aria-label="Choose a letter">${letters.map((l) => `<a href="${href(`authors/letter/${l.toLowerCase()}/`)}">${l}</a>`).join('')}</nav></div></section>`,
  });
  for (const l of letters) {
    const as = authorList.filter((a) => a.sortName[0].toUpperCase() === l), n = Math.ceil(as.length / LETTER_PAGE);
    for (let p = 1; p <= n; p++) {
      const base = `authors/letter/${l.toLowerCase()}/`;
      page(p === 1 ? `${base}index.html` : `${base}page/${p}/index.html`, {
        title: `Authors: ${l}${p > 1 ? ' · page ' + p : ''}`, crumbs: [['Authors', 'authors/'], [`${l}${p > 1 ? ' · page ' + p : ''}`]], desc: `Authors whose names begin with ${l}.`,
        body: () => `<section class="band"><div class="wrap"><h1>${l}</h1><nav class="az" aria-label="Choose a letter">${letters.map((x) => `<a href="${href(`authors/letter/${x.toLowerCase()}/`)}"${x === l ? ' aria-current="page"' : ''}>${x}</a>`).join('')}</nav><ul class="authors">${as.slice((p - 1) * LETTER_PAGE, p * LETTER_PAGE).map(authorRow).join('')}</ul>${pager(base, p, n)}</div></section>`,
      });
    }
  }
}
for (const a of authorList) {
  const ws = a.workIds.map((id) => workById.get(id));
  listing({ rel: `authors/${a.id}/`, works: ws, scope: { k: 'author', v: a.name }, page: {
    title: a.name, desc: a.bio ?? `Books by ${a.name}`, crumbs: [['Authors', 'authors/'], [a.name]],
    body: ({ grid: G, nav }) => `<section class="band"><div class="wrap"><h1>${esc(a.name)}</h1>${a.bio ? `<p class="lede-sm">${esc(a.bio)}</p>` : a.workIds.some((id) => workById.get(id).press) ? '<p class="note">Author profile pending. The author credit on Forbidden Mantra Press titles is being confirmed with the publisher.</p>' : ''}<h2>Books</h2>${langChips(ws)}${filterBar(ws, { subjects: false, traditions: false, press: false, q: false })}${G}${nav}${emptyMsg()}</div></section>`,
  }});
}

// ---------- series ----------
if (seriesMap.size) {
  const sl = [...seriesMap.values()].sort((a, b) => (sortTitle({ title: a.name }) < sortTitle({ title: b.name }) ? -1 : 1));
  page('series/index.html', {
    title: 'Series', crumbs: [['Series']], desc: 'Book series in the catalogue.',
    body: () => `<section class="band"><div class="wrap"><h1>Series</h1><p class="lede-sm">Series are shown only where a source states the series and, where known, the book’s number in it.</p><ul class="authors">${sl.map((x) => `<li><a href="${href(`series/${x.id}/`)}">${esc(x.name)}</a> <span>${fmt(x.works.length, 'book', 'books')}</span></li>`).join('')}</ul></div></section>`,
  });
  for (const x of sl) listing({ rel: `series/${x.id}/`, works: x.works, scope: { k: 'series', v: x.name }, page: {
    title: `${x.name} (series)`, crumbs: [['Series', 'series/'], [x.name]], desc: `Books in the ${x.name} series.`,
    body: ({ grid: G, nav }) => `<section class="band"><div class="wrap"><h1>${esc(x.name)}</h1><p class="lede-sm">${fmt(x.works.length, 'book', 'books')} in this series that are in the catalogue, in series order where the number is known. Missing numbers mean those books are not catalogued yet.</p>${G}${nav}</div></section>`,
  }});
}

// ---------- books ----------
const jsonLdEd = (w, e) => ({ '@type': 'Book', name: e.title ?? w.title, bookFormat: { paperback: 'Paperback', hardcover: 'Hardcover', ebook: 'EBook', audiobook: 'AudiobookFormat' }[e.format], isbn: e.isbn13 || undefined, inLanguage: e.language, translator: e.translator ? { '@type': 'Person', name: e.translator } : undefined, publisher: e.publisher ? { '@type': 'Organization', name: e.publisher } : undefined });
for (const w of cat.works) {
  if (isDyn(w)) continue;
  const related = relatedFor(w);
  const groups = [...new Set(w.editions.map((e) => e.language))].map((c) => [c, w.editions.filter((e) => e.language === c).sort((a, b) => FORMAT_ORDER.indexOf(a.format) - FORMAT_ORDER.indexOf(b.format))]);
  const multi = groups.length > 1;
  const markets = new Set();
  const edHtml = (e) => {
    const eh = multi ? 'h4' : 'h3';
    const rs = retailers(w, e); rs.forEach((r) => r.market && markets.add(r.market));
    const L = LANG.get(e.language);
    return `<section class="edition" id="ed-${esc(e.id ?? e.isbn13 ?? e.asin ?? '')}" aria-label="${esc(tax.formats[e.format])} edition, ${esc(L?.name ?? e.language)}${e.year ? ', ' + e.year : ''}${e.isbn13 ? ', ISBN ' + e.isbn13 : ''}" lang="${e.language}" dir="${L?.dir ?? 'ltr'}">
    ${(() => { const ec = coverOfEdition.get(`${w.slug}/${e.id}`); return ec && ec.key !== coverOfWork.get(w.slug)?.key ? `<div class="ed-cover">${cover(w, false, e.title ?? w.title, ec)}</div>` : ''; })()}
    <${eh}><span data-i18n="fmt_${e.format}">${esc(tax.formats[e.format])}</span> · <span lang="en" dir="ltr">${esc(L?.endonym ?? e.language)}${L && L.endonym !== L.name ? ` (${esc(L.name)})` : ''}</span></${eh}>
    ${e.title ? `<p class="ed-title">${esc(e.title)}${e.subtitle ? `: <em>${esc(e.subtitle)}</em>` : ''}</p>` : ''}
    <dl lang="en" dir="ltr">${e.credit ? `<dt>Credited as</dt><dd>${esc(e.credit)}</dd>` : ''}${e.translator ? `<dt data-i18n="l_translator">Translator</dt><dd>${esc(e.translator)}</dd>` : ''}${e.publisher ? `<dt data-i18n="l_publisher">Publisher</dt><dd>${esc(e.publisher)}</dd>` : ''}${e.year ? `<dt data-i18n="l_year">Year</dt><dd>${e.year}</dd>` : ''}${e.isbn13 ? `<dt>ISBN-13</dt><dd>${e.isbn13}</dd>` : ''}${e.isbn10 ? `<dt>ISBN-10</dt><dd>${e.isbn10}</dd>` : ''}${e.asin ? `<dt>ASIN</dt><dd>${e.asin}</dd>` : ''}${e.alsoLanguages?.length ? `<dt>Also in</dt><dd>${e.alsoLanguages.map((c) => esc(LANG.get(c)?.name ?? c)).join(', ')}</dd>` : ''}</dl>
    ${e.note ? `<p class="note-sm" lang="en" dir="ltr">${esc(e.note)}</p>` : ''}
    ${e.needsSecondSource ? '<p class="note-sm flag" lang="en" dir="ltr">Identifier reported by a single source; awaiting corroboration.</p>' : ''}
    <ul class="buy" lang="en" dir="ltr">${rs.some((r) => !r.library) ? '' : (w.purchasable === false ? '<li class="status">Not offered for sale: unverified placeholder.</li>' : '<li class="status">No retailer link verified yet.</li>')}${rs.map((r) => `<li><a class="${r.affiliate ? 'btn' : 'btn btn-ghost'}" href="${esc(r.url)}" target="_blank" rel="${r.affiliate ? 'sponsored ' : ''}noopener noreferrer" data-track="${r.affiliate ? 'buy' : r.library ? 'library' : 'link'}" data-work="${w.slug}" data-isbn="${e.isbn13 ?? ''}" data-asin="${e.asin ?? ''}" data-market="${r.market ?? ''}" data-linktype="${r.kind}" data-cat="${w.subjects[0]}" data-own="${w.press ? 'fmp' : 'third-party'}">${r.labelIsHtml ? r.label : esc(r.label)}<span class="sr"> (opens in a new tab)</span></a><span class="status">${esc(r.status)}</span></li>`).join('') || '<li class="status">No retailer link verified yet.</li>'}</ul>${rs.some((r) => r.affiliate) ? `<p class="aff-note-p note-sm" lang="en">${esc(cfg.disclosure.split('. ')[0])}. <a href="${href('about/affiliate-disclosure/')}">Affiliate disclosure</a></p>` : ''}
  </section>`;
  };
  const groupIds = new Set(groups.map(([c]) => c));
  // secondary languages of bilingual editions (alsoLanguages) get their own anchors so card links like #lang-sa resolve
  const aliasAnchors = (eds) => [...new Set(eds.flatMap((e) => e.alsoLanguages ?? []))].filter((c) => !groupIds.has(c)).map((c) => `<span id="lang-${c}"></span>`).join('');
  const editionsHtml = multi
    ? groups.map(([c, eds]) => `<div class="lang-group" id="lang-${c}">${aliasAnchors(eds)}<h3 class="lg-h"><span lang="${c}" dir="${LANG.get(c)?.dir ?? 'ltr'}">${esc(LANG.get(c)?.endonym ?? c)}</span> <small>${esc(LANG.get(c)?.name ?? c)}</small></h3><div class="editions">${eds.map(edHtml).join('')}</div></div>`).join('')
    : `<div class="lang-group" id="lang-${groups[0][0]}">${aliasAnchors(groups[0][1])}<div class="editions">${groups[0][1].map(edHtml).join('')}</div></div>`;
  const edSources = w.editions.filter((e) => e.sources?.length);
  page(`books/${w.slug}/index.html`, {
    title: w.title + (w.subtitle ? `: ${w.subtitle}` : ''), desc: descOf(w).split('. ')[0] + '.', crumbs: [['All books', 'books/'], [w.title]],
    jsonld: { '@context': 'https://schema.org', '@type': 'Book', name: w.title, author: w.authors.map((n) => ({ '@type': 'Person', name: n })), inLanguage: [...new Set(w.editions.map((e) => e.language))], workExample: w.editions.map((e) => jsonLdEd(w, e)) },
    body: () => `<article class="band"><div class="wrap book">
  <div class="book-cover">${(coverOfWork.has(w.slug) && coverAnchor(w, w.title, cover(w, true), 'book-cover-link')) || cover(w, true)}${(() => { const ce = coverOfWork.get(w.slug); if (!ce) return ''; const same = w.editions.filter((e) => e.id !== ce.edition.id), ru = [...new Set(reuseOfWork.get(w.slug) ?? [])]; return `<p class="cover-note" lang="en">Cover of the ${esc(LANG.get(ce.edition.language)?.name ?? ce.edition.language)} ${esc(ce.edition.format)} edition${ru.length ? `; the owner confirms the same front artwork is used for the ${esc(ru.join(' and '))} edition${ru.length > 1 ? 's' : ''}` : ''}${same.length > ru.length ? '; other editions may use different artwork.' : '.'}</p>`; })()}</div>
  <div class="book-main">
    ${w.press ? '<span class="badge badge-fmp">Forbidden Mantra Press</span>' : ''}
    <h1>${esc(w.title)}</h1>${w.placeholder ? `<p class="placeholder-note" role="note" lang="en"><strong>Unverified placeholder.</strong> ${esc(w.placeholderNote ?? 'No publication has been verified for this entry.')}</p>` : ''}${w.subtitle ? `<p class="subtitle">${esc(w.subtitle)}</p>` : ''}
    <p class="byline">by ${authorLinks(w)}</p>
    ${w.series?.name ? `<p class="series">${w.series.number ? `Book ${w.series.number} of ` : 'Part of '}<a href="${href(`series/${slugify(w.series.name)}/`)}">${esc(w.series.name)}</a></p>` : ''}
    <p class="meta-row"><span>${esc(tax.levels[w.level])}</span>${(w.tradition ?? []).map((t) => `<a class="tag" href="${href(`traditions/${t}/`)}">${esc(trad.get(t).name)}</a>`).join('')}</p>
    ${multi ? `<p class="avail" aria-label="Available languages"><span data-i18n="f_language">${esc(en.f_language)}</span>: ${groups.map(([c]) => `<a class="tag" href="#lang-${c}" lang="${c}">${esc(LANG.get(c)?.endonym ?? c)}</a>`).join('')}</p>` : ''}
    <p class="desc">${esc(descOf(w))}</p>
    ${w.status === 'owner-listed' ? `<p class="note">Edition details for this title are being confirmed with the publisher. Retailer links marked “search” will be replaced by edition-specific links.</p>` : ''}
    ${w.thirdPartyNotice ? `<p class="note note-tm" lang="en">${esc(w.thirdPartyNotice)}</p>` : ''}
    ${(w.claims ?? []).filter((c) => c.display).map((c) => `<p class="claim"><strong>Historical note:</strong> ${esc(c.text)}. <span>Per publisher and bookseller listings; not a current ranking.</span></p>`).join('')}
    <h2 data-i18n="h_subjects">${esc(en.h_subjects)}</h2>
    <ul class="chips">${w.subjects.map((s) => `<li><a href="${href(`topics/${s}/`)}">${esc(dept.get(s).name)}</a></li>`).join('')}</ul>
    ${artBlock(artFor.work(w.id), 6)}
  </div>
</div>
<div class="wrap">
  <h2 data-i18n="h_editions">${esc(en.h_editions)}</h2>
  <p class="note-sm">Editions of the same work are grouped here${multi ? ', by the language each is published in' : ''}. Each has its own identifier and retailer destination.</p>
  ${editionsHtml}
  <p class="note-sm">Prices, availability and ratings are not shown: they appear only through a permitted, maintained source, and none is connected to this preview yet. A cover image appears only where we hold a verified permission for that exact edition.</p>
  <details class="sources"><summary data-i18n="h_sources">${esc(en.h_sources)}</summary><ul>${w.sources.map((s) => `<li>${srcLink(s)}, supports ${esc(s.supports)}; accessed ${s.accessed}.</li>`).join('')}${edSources.flatMap((e) => e.sources.map((s) => `<li>${esc(LANG.get(e.language)?.name ?? e.language)} ${esc(tax.formats[e.format].toLowerCase())} edition: ${srcLink(s)}, supports ${esc(s.supports ?? 'edition details')}; accessed ${s.accessed}.</li>`)).join('')}</ul></details>
  <p class="disclosure sm" lang="en">${esc(cfg.disclosure)}</p>
  ${[...markets].filter((m) => AFF.marketplaces[m]?.disclosure).map((m) => `<p class="disclosure sm" lang="en">${esc(AFF.marketplaces[m].disclosure)}</p>`).join('')}
  ${related.length ? `<h2 data-i18n="h_related">${esc(en.h_related)}</h2>${grid(related, { filterable: false })}` : ''}
</div></article>`,
  });
}

// ---------- chunk index (client search and filters) + dynamic book view ----------
// Static pages exist for the first maxStaticBookPages books (press and hand-verified first). The rest are drawn client-side by book/index.html from the same
// chunk files the search uses, so the file count stays under common static-host limits.
const normS = (x) => String(x ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const IDX = { depts: tax.departments.map((d) => d.id), trads: tax.traditions.map((t) => t.id), langs: langReg.languages.map((l) => l.code), fmts: Object.keys(tax.formats), levels: Object.keys(tax.levels) };
const ixOf = (arr) => new Map(arr.map((v, i) => [v, i]));
const dIx = ixOf(IDX.depts), tIx = ixOf(IDX.trads), lIx = ixOf(IDX.langs), fIx = ixOf(IDX.fmts), vIx = ixOf(IDX.levels);
function qxOf(w) {
  const base = new Set(normS([w.title, w.subtitle, ...w.authors, ...w.subjects.map((x) => dept.get(x).name), ...(w.tradition ?? []).map((x) => trad.get(x)?.name), ...wLangs(w).flatMap((c) => [LANG.get(c)?.name, LANG.get(c)?.endonym, c.length > 2 ? c : null]), w.press ? 'forbidden mantra press' : ''].filter(Boolean).join(' ')).split(/[^a-z0-9]+/).filter(Boolean));
  return [...new Set(searchBlob(w).split(/\s+/).filter((t) => /[a-z0-9]/.test(t) && !base.has(t.replace(/[^a-z0-9]/g, '')) && !base.has(t)))].join(' ');
}
function dynPayload(w) {
  return { d: descOf(w), tm: w.thirdPartyNotice ?? '', src: w.sources.map((x) => [x.label, x.url, x.accessed, x.supports ?? '']),
    eds: w.editions.map((e) => ({ l: e.language, f: e.format, t: e.title ?? '', tr: e.translator ?? '', pub: e.publisher ?? '', y: e.year ?? 0, i13: e.isbn13 ?? '', i10: e.isbn10 ?? '', a: e.asin ?? '', n: e.note ?? '',
      b: retailers(w, e).map((r) => [r.label, r.url, r.affiliate ? 1 : 0, r.market ?? '', r.status, r.library ? 1 : 0, r.kind]), s: (e.sources ?? []).map((x) => [x.label, x.url, x.accessed, x.supports ?? '']) })) };
}
const recOf = (w) => [w.slug, w.title, w.subtitle ?? '', w.authors.join(';'), w.authors.map((n) => (authorPage.has(slugify(n)) ? 1 : 0)).join(''), w.subjects.map((x) => dIx.get(x)), (w.tradition ?? []).map((x) => tIx.get(x)),
  vIx.get(w.level), w.press ? 1 : 0, w.editions.map((e) => [edLangs(e).map((c) => lIx.get(c)), fIx.get(e.format), e.title ?? '']), qxOf(w), isDyn(w) ? 1 : 0, w.series?.name ? [w.series.name, w.series.number ?? 0] : 0, coverRec(coverOfWork.get(w.slug), w)];
const fnv = (x) => { let h = 0x811c9dc5; for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const nDyn = cat.works.filter(isDyn).length, DYN_SHARDS = Math.max(1, Math.min(256, Math.ceil(nDyn / BUILD.dynShardTarget)));
const dynShard = (slug) => (fnv(slug) % DYN_SHARDS).toString(16).padStart(2, '0');
{
  const byChunk = new Map();
  for (const w of orderedWorks) (byChunk.get(chunkOf.get(w.id)) ?? byChunk.set(chunkOf.get(w.id), []).get(chunkOf.get(w.id))).push(recOf(w));
  for (const [name, recs] of byChunk) write(`assets/idx/${name}.js`, `(window.FM_IDX=window.FM_IDX||{}).${name}=${JSON.stringify(recs)};`);
  // books without a static page: record + full detail, sharded by a hash of the slug so one book view loads one small file
  const dynBy = new Map();
  for (const w of cat.works) if (isDyn(w)) (dynBy.get(dynShard(w.slug)) ?? dynBy.set(dynShard(w.slug), {}).get(dynShard(w.slug)))[w.slug] = [...recOf(w), dynPayload(w)];
  for (const [k, o] of dynBy) write(`assets/idx/dyn-${k}.js`, `(window.FM_DYN=window.FM_DYN||{})[${JSON.stringify(k)}]=${JSON.stringify(o)};`);
  write('assets/idx/manifest.js', `window.FM_MANIFEST=${JSON.stringify({ v: 1, hidden: cat.works.filter((w) => w.purchasable === false).map((w) => w.slug), total: cat.works.length, chunks: [...byChunk.keys()], depts: IDX.depts, deptNames: tax.departments.map((d) => d.name), hubs: Object.fromEntries(tax.hubs.map((h) => [h.id, tax.departments.map((d, i) => (d.hubs.includes(h.id) ? i : -1)).filter((i) => i >= 0)])), trads: IDX.trads, tradNames: tax.traditions.map((t) => t.name), langs: IDX.langs, fmts: IDX.fmts, levels: IDX.levels, authorPages: cat.works.length <= BUILD.authorPagesAllBelow ? 'all' : 'flags', dynShards: DYN_SHARDS, pageSize: BUILD.pageSize, disclosure: cfg.disclosure })};`);
}
page('book/index.html', {
  title: 'Book', desc: 'Book details.', crumbs: [['All books', 'books/'], ['Book']], noindex: true,
  body: () => `<article class="band" data-dyn-book data-root="${ROOT_PREFIX}"><div class="wrap"><h1 class="sr">Book details</h1><p class="note" data-dyn-status>Loading book details…</p><noscript><p class="note">This page needs JavaScript. <a href="${href('books/')}">Browse all books</a> or <a href="${href('search/')}">search</a> for the title.</p></noscript></div></article>`,
});

// ---------- press ----------
page('press/index.html', {
  title: 'Forbidden Mantra Press', current: 'press/', crumbs: [['Forbidden Mantra Press']], desc: 'Books from Forbidden Mantra Press.',
  body: () => `<section class="hero hero-sm"><div class="wrap"><p class="eyebrow">Our imprint</p><h1>Forbidden Mantra Press</h1><p class="lede">Sacred texts and practice guides: the Forbidden Mantra Series on Sanskrit mantras, Nag Hammadi and Ethiopian texts, Hindu epic material, and internal-energy cultivation.</p></div></section>
<section class="band"><div class="wrap">
  ${langChips(fmpWorks)}${filterBar(fmpWorks, { press: false, q: false })}${grid(fmpWorks, { hl: 'h2' })}
  ${emptyMsg()}
  <div class="note"><p><strong>Catalogue status.</strong> ${fmpWorks.length} Forbidden Mantra Press titles are listed here. More titles and editions are added only once each one has been verified.</p></div>
  ${artBlock(artFor.press(), 6)}
  <p><a class="btn btn-ghost" href="${esc(cfg.affiliate.legacyStoreLink)}" target="_blank" rel="sponsored noopener noreferrer">Visit our Amazon storefront<span class="sr"> (opens in a new tab)</span></a> <span class="status">Existing store link, kept until edition links are complete.</span></p>
</div></section>`,
});

// ---------- paths + collections ----------
page('paths/index.html', {
  title: 'Reading paths', current: 'paths/', crumbs: [['Reading paths']], desc: 'Beginner reading paths.',
  body: () => `<section class="band"><div class="wrap"><h1 data-i18n="nav_paths">${esc(en.nav_paths)}</h1><p class="lede-sm">Short sequences that tell you what to read first and why. Paths grow as more titles pass verification.</p><div class="paths">${coll.paths.map((p) => `<a class="path" href="${href(`paths/${p.id}/`)}"><p class="eyebrow">${esc(p.audience)}</p><h2>${esc(p.title)}</h2><p>${esc(p.blurb)}</p><span class="hub-n">${fmt(p.steps.length, 'book', 'books')}</span></a>`).join('')}</div></div></section>`,
});
for (const p of coll.paths) page(`paths/${p.id}/index.html`, {
  title: p.title, desc: p.blurb, crumbs: [['Reading paths', 'paths/'], [p.title]],
  body: () => `<section class="band"><div class="wrap narrow"><p class="eyebrow">${esc(p.audience)}</p><h1>${esc(p.title)}</h1><p class="lede-sm">${esc(p.blurb)}</p>${p.disclaimer ? `<p class="note note-tm" lang="en">${esc(p.disclaimer)}</p>` : ''}<ol class="steps">${p.steps.map((s, i) => { const w = workById.get(s.work); return `<li><div class="step-n" aria-hidden="true">${i + 1}</div><div>${card(w, null, 'h2')}<p class="why">${esc(s.why)}</p></div></li>`; }).join('')}</ol></div></section>`,
});
page('collections/index.html', {
  title: 'Collections', current: 'collections/', crumbs: [['Collections']], desc: 'Curated collections.',
  body: () => `<section class="band"><div class="wrap"><h1 data-i18n="nav_collections">${esc(en.nav_collections)}</h1><div class="paths">${coll.collections.map((c) => `<a class="path" href="${href(`collections/${c.id}/`)}"><h2>${esc(c.title)}</h2><p>${esc(c.blurb)}</p><span class="hub-n">${fmt(c.works.length, 'book', 'books')}</span></a>`).join('')}</div></div></section>`,
});
for (const c of coll.collections) {
  const ws = c.works.map((id) => workById.get(id));
  page(`collections/${c.id}/index.html`, {
    title: c.title, desc: c.blurb, crumbs: [['Collections', 'collections/'], [c.title]],
    body: () => `<section class="band"><div class="wrap"><h1>${esc(c.title)}</h1><p class="lede-sm">${esc(c.blurb)}</p>${c.disclaimer ? `<p class="note note-tm" lang="en">${esc(c.disclaimer)}</p>` : ''}${langChips(ws)}${filterBar(ws, { subjects: false, traditions: false, press: false, q: false })}${grid(ws, { hl: 'h2' })}${emptyMsg()}</div></section>`,
  });
}

// ---------- articles index ----------
if (ART.length) {
  const topicsWith = tax.departments.filter((d) => artFor.topic(d.id).length);
  page('articles/index.html', {
    title: 'Articles', crumbs: [['Articles']], desc: 'Articles from the Forbidden Mantra blog, organised by topic.',
    body: () => `<section class="band"><div class="wrap" lang="en"><h1>Articles</h1><p class="lede-sm">${ART.length} articles from the Forbidden Mantra blog, organised by topic and connected to the books they relate to. Articles appear under every topic they touch. The blog is a separate site; links open in a new tab.</p>
<nav class="az" aria-label="Jump to topic">${topicsWith.map((d) => `<a href="#t-${d.id}">${esc(d.name)} (${artFor.topic(d.id).length})</a>`).join('')}</nav>
${topicsWith.map((d) => `<h2 id="t-${d.id}">${esc(d.name)}</h2>${artList(artFor.topic(d.id), 100)}`).join('')}
${artFor.lang('hi').length ? `<h2 id="t-hi">हिन्दी (Hindi)</h2>${artList(artFor.lang('hi'), 20)}` : ''}</div></section>`,
  });
}

// ---------- technology & innovation (cross-promotion) ----------
for (const p of placed('page')) page(`${p.placements.page.path}index.html`, {
  title: 'Technology and innovation', crumbs: [['Technology & innovation']], desc: `${PROMOS.brands[p.brand].name}, our ${PROMOS.brands[p.brand].descriptor.toLowerCase()}.`,
  body: () => promo.renderPage(promoView('page', p.id), promoCtx),
});
// authorised partner badge assets are copied only when the gate in scripts/promo.mjs allows them
for (const b of Object.values(PROMOS.brands)) for (const bd of [b.hero, b.logo].filter(Boolean)) {
  if (promo.assetState(bd, ROOT).ok && !(bd === b.logo && !NVIDIA_OK)) { fs.mkdirSync(path.join(OUT, 'assets/partner'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'assets-src/partner', bd.asset), path.join(OUT, 'assets/partner', bd.asset)); }
}
for (const b of Object.values(PROMOS.brands)) for (const bd of Object.values(b.badges ?? {})) {
  if (NVIDIA_OK && promo.badgeState(bd, ROOT).ok) { fs.mkdirSync(path.join(OUT, 'assets/partner'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'assets-src/partner', bd.asset), path.join(OUT, 'assets/partner', bd.asset)); }
}

// ---------- about ----------
// ---------- legal pages, contact, network ----------
const LEGAL = cfg.legal ?? {};
const reviewBar = () => (PRODUCTION ? '' : '<p class="note legal-review" role="note" lang="en"><strong>Draft for owner and legal review.</strong> ' + esc(LEGAL.reviewNote ?? '') + ' This notice appears in preview builds only.</p>');
const legalHead = (t) => '<section class="band"><div class="wrap narrow prose" lang="en"><h1>' + t + '</h1>' + reviewBar();
const ORIG = 'https://www.forbiddenmantra.com/';
page('legal/index.html', {
  title: 'Terms & Policies', crumbs: [['Terms & Policies']], desc: 'Terms of service, refund policy, privacy policy and affiliate disclosure.',
  body: () => legalHead('Terms &amp; Policies') + '<p>These pages explain how this bookstore works and what we promise. Forbidden Mantra Press is a catalogue and discovery site: it does not sell books itself, take payments or keep accounts.</p><ul class="legal-list"><li><a href="' + href('legal/terms-refunds/') + '"><strong>Terms of Service / Refund Policy</strong></a>: using the site, who sells and fulfils orders, returns and refunds.</li><li><a href="' + href('about/privacy/') + '"><strong>Privacy Policy</strong></a>: what the site does and does not do with your data.</li><li><a href="' + href('about/affiliate-disclosure/') + '"><strong>Affiliate Disclosure</strong></a>: how Amazon Associates links work.</li><li><a href="' + href('contact/') + '"><strong>Contact</strong></a>: how to reach us.</li></ul><p class="disclosure" lang="en">' + esc(cfg.disclosure) + '</p></div></section>',
});
page('legal/terms-refunds/index.html', {
  title: 'Terms of Service / Refund Policy', crumbs: [['Terms & Policies', 'legal/'], ['Terms of Service / Refund Policy']], desc: 'Terms of use, who fulfils orders, and returns and refunds.',
  body: () => legalHead('Terms of Service / Refund Policy') + `<p>Welcome to the Forbidden Mantra Press bookstore. By using this site you agree to these terms.</p>
<h2>Using this website</h2><p>You agree to use the site only for lawful purposes and in accordance with these terms. Misuse of the site may result in loss of access.</p>
<h2>What this site is</h2><p>This site is a curated catalogue of books, with our own publications and books from other publishers. It has no shopping cart, checkout or customer accounts. Buttons on book pages lead to other companies’ websites, mainly Amazon, where any purchase takes place.</p>
<h2>Orders, payment and fulfilment</h2><p>Books are bought, paid for and fulfilled by the retailer you choose, not by Forbidden Mantra Press, and the retailer’s own terms govern that transaction. This site does not process or store payment information for those orders.</p>
<h2>Returns and refunds</h2><p>Books ordered through Amazon are covered by <a href="https://www.amazon.com/returns" rel="noopener noreferrer">Amazon’s returns and refund policy</a>; contact the retailer’s customer service for any order problem, because only the retailer can change or refund an order. Made-to-order items sold on our original store (for example apparel fulfilled through Printify) are generally non-refundable unless they arrive defective or damaged in shipping; see the terms on <a href="${ORIG}" rel="noopener noreferrer">forbiddenmantra.com</a> for those items.</p>
<h2>Catalogue information</h2><p>We check book details against published sources and say where a detail is unverified. We do not show prices, availability or ratings. Check the retailer’s page for the current edition, price and format before you buy.</p>
<h2>Affiliate links</h2><p>Some links to Amazon are affiliate links. See the <a href="${href('about/affiliate-disclosure/')}">Affiliate Disclosure</a>.</p>
<h2>Ownership and reuse</h2><p>Content on this site that we wrote is owned by Forbidden Mantra Press, and no part may be reused or reproduced without our express written consent. Book titles, author names, cover images and trademarks belong to their owners; their appearance here does not imply endorsement.</p>
<h2>Third-party sites</h2><p>Links to other sites, including retailers and our <a href="${href('network/')}">sister sites</a>, are provided for convenience. We are not responsible for their content or practices.</p>
<h2>Limitation of liability</h2><p>Forbidden Mantra Press is not responsible for delays, damages or losses resulting from third-party vendors, shipping errors or platform issues beyond our control.</p>
<h2>Changes</h2><p>We may update these terms. Updates are posted on this page with a new effective date.</p>
<p class="note-sm">Effective date: ${esc(LEGAL.effectiveDate ?? 'to be set when the owner approves this page')}.</p></div></section>`,
});
page('contact/index.html', {
  title: 'Contact', crumbs: [['Contact']], desc: 'How to contact Forbidden Mantra Press.',
  body: () => `<section class="band"><div class="wrap narrow prose" lang="en"><h1>Contact</h1>${reviewBar()}<p>For questions about Forbidden Mantra Press, our books or this site, use the contact options on our main website: <a href="${ORIG}" rel="noopener noreferrer" target="_blank">forbiddenmantra.com<span class="sr"> (opens in a new tab)</span></a>.</p><p>For problems with an order, contact the retailer you bought from. We cannot see or change orders placed with Amazon or other retailers.</p><p>Questions about IOSutra go to <a href="${esc(PROMOS.brands.iosutra.url)}" rel="noopener noreferrer" target="_blank">iosutra.com<span class="sr"> (opens in a new tab)</span></a>.</p></div></section>`,
});
page('network/index.html', {
  title: 'Our network', crumbs: [['Our network']], desc: 'Other websites from the Forbidden Mantra team.',
  body: () => `<section class="band"><div class="wrap narrow prose" lang="en"><h1>Our network</h1><p>Forbidden Mantra Press is part of a small group of sites run by the same team. Each is a separate site with its own content and policies.</p><ul class="legal-list">${NETWORK.map((n) => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" data-track="network" data-site="${esc(n.id)}"><strong>${esc(n.name)}</strong><span class="sr"> (opens in a new tab)</span></a>${n.blurb ? ': ' + esc(n.blurb) : ''}</li>`).join('')}</ul><p><a href="${href('technology/')}">About IOSutra</a></p></div></section>`,
});
page('about/privacy/index.html', {
  title: 'Privacy Policy', crumbs: [['Terms & Policies', 'legal/'], ['Privacy Policy']], desc: 'What this site does and does not do with your data.',
  body: () => legalHead('Privacy Policy') + `<p>This page describes how this bookstore works today. The bookstore has no accounts, checkout, forms or comments, does not ask for personal information, and sets no cookies of its own.</p>
<ul>
<li><strong>Your choices stay in your browser.</strong> If you pick a website language, the site remembers it in your browser’s local storage on your own device. It is never sent to us. The same goes for whether you have minimized or hidden the digital librarian.</li>
<li><strong>Digital librarian:</strong> the animated guide searches the book index that your browser downloads from this site. What you type into it or into the search boxes is not sent anywhere, and it uses no cookies, microphone or outside service.</li>
<li><strong>Analytics:</strong> ${ANALYTICS.provider ? `the site uses ${esc(ANALYTICS.provider)}, a cookie-free analytics service, to count visits and outbound clicks (which book, category and type of link). It does not record who you are.` : 'none is running at the moment. If this changes, this page will say which service is used and what it records.'} The site does not run analytics when your browser sends Do Not Track.</li>
<li><strong>Fonts:</strong> the site loads its typefaces from Google Fonts, so your browser contacts Google when a page loads and Google receives your IP address and browser details under its own privacy policy.</li>
<li><strong>Retailer and partner links:</strong> buttons for Amazon and other retailers, the Forbidden Mantra blog, our sister sites and IOSutra lead away from this site. Those sites have their own privacy practices. When you follow an Amazon affiliate link, Amazon can tell that the visit came from us and may set its own cookies; see the <a href="${href('about/affiliate-disclosure/')}">Affiliate Disclosure</a>. Links to IOSutra carry campaign tags (the name of this site and the page) in the address.</li>
<li><strong>Library links</strong> go to WorldCat’s public search and carry only a book’s ISBN.</li>
<li><strong>Our main website.</strong> <a href="https://www.forbiddenmantra.com/" rel="noopener noreferrer">forbiddenmantra.com</a> is a separate site with its own features and its own privacy practices.</li>
</ul>
<p>Questions about this page: see <a href="${href('contact/')}">Contact</a>.</p></div></section>`,
});
page('about/affiliate-disclosure/index.html', {
  title: 'Affiliate Disclosure', crumbs: [['Terms & Policies', 'legal/'], ['Affiliate Disclosure']], desc: 'How we use Amazon Associates affiliate links.',
  body: () => legalHead('Affiliate Disclosure') + `<p class="disclosure-lead"><strong>${esc(cfg.disclosure.split('. ')[0])}.</strong></p>
<p>Forbidden Mantra Press participates in the Amazon Services LLC Associates Program, an affiliate advertising program that lets sites earn fees by linking to Amazon.com. Buttons marked “Amazon” or “Search on Amazon” lead to Amazon.com and include our Associates tracking ID. If you buy through them we may earn a commission at no extra cost to you.</p>
<ul>
<li><strong>Which links.</strong> Amazon.com links on book pages and guides. “Amazon” buttons go to a specific product page; “Search on Amazon” buttons open an Amazon search for the book’s ISBN, and we are checking with Amazon which links qualify. Tracking IDs are specific to each marketplace, so links to other Amazon stores are untagged unless we hold that store’s own tracking ID.</li>
<li><strong>Our own books and others.</strong> Some titles are published by Forbidden Mantra Press, and we also earn publisher royalties on those. Books from other publishers are marked as such.</li>
<li><strong>Independence.</strong> Books are chosen for the catalogue by subject and quality of sources, not by commission. We do not show prices, availability or ratings.</li>
<li><strong>Library and other links.</strong> Library lookups, article links and links to our other sites are not affiliate links.</li>
</ul>
<p>The statement above appears on every page. See also the <a href="${href('legal/terms-refunds/')}">Terms of Service / Refund Policy</a> and <a href="${href('about/privacy/')}">Privacy Policy</a>.</p></div></section>`,
});
page('about/catalogue-standards/index.html', {
  title: 'How we verify books', crumbs: [['How we verify books']], desc: 'Catalogue standards.',
  body: () => `<section class="band"><div class="wrap narrow prose" lang="en"><h1>How we verify books</h1>
<p>A book appears in the catalogue only when its title, author, edition and identifier are backed by dated sources, and its record keeps them (see “Sources and verification” on each book page). Titles checked by hand carry at least one dated source. Titles added in bulk need <strong>two independent sources for each edition</strong>: bookseller sites owned by the same company count as one, and an edition with only one is held back.</p>
<ul><li><strong>Editions of one work are grouped.</strong> Paperback, hardcover, e-book, audiobook and different language editions each keep their own identifier and retailer link.</li>
<li><strong>Languages are never inferred.</strong> A language counts as available only when a specific edition published in that language has been verified, with its own source. We do not assume a translation exists because the work is popular, and we do not list machine translations as editions.</li>
<li><strong>Website language is separate from book language.</strong> The website language only changes menus, labels and buttons; book descriptions stay in English. The book language is the language an edition is published in.</li>
<li><strong>Uncertain records stay unpublished.</strong> Records with a failed ISBN checksum, a missing identifier or conflicting details go to a review queue.</li>
<li><strong>Descriptions are our own, or absent.</strong> We write original summaries and do not copy competing bookstores or publishers. Where we have not written one, the page says so and shows only a plain summary of the verified facts.</li><li><strong>Purchase links are not assumed.</strong> A product link is shown only when that exact product page appeared in a cited source; otherwise the button is a labelled search for the ISBN.</li>
<li><strong>No unverified claims.</strong> Bestseller badges, ratings and prices appear only when drawn from a source we are permitted to use. Historical honours are labelled as historical and are never presented as current rankings.</li>
<li><strong>Traditions are kept distinct.</strong> Books are placed under the tradition they actually teach.</li></ul></div></section>`,
});

// ---------- affiliate tag guard: the build fails if an eligible US link lacks the ID or a non-US link carries it ----------
{
  const usId = tagFor('amazon.com'), pinned = AFF.requiredTrackingIds?.['amazon.com'];
  const bad = [];
  if (pinned && !FIXTURE && !process.env.FM_ALLOW_TAG_OVERRIDE && usId !== pinned) bad.push(`amazon.com tracking ID is "${usId ?? 'unset'}" but config/site.json pins "${pinned}"`);
  if (PRODUCTION && !usId) bad.push('production build without an amazon.com tracking ID');
  const seen = new Set(); let us = 0, usOk = 0; const byKind = {}, nonUs = {};
  for (const t of TAGLOG) {
    const key = t.work + '|' + t.url; if (seen.has(key)) continue; seen.add(key);
    let u; try { u = new URL(t.url); } catch { bad.push(`unparseable affiliate URL for ${t.work}: ${t.url}`); continue; }
    const host = u.hostname.replace(/^www\./, ''), tag = u.searchParams.get('tag'), want = AFF.marketplaces[host] ? tagFor(host) : null;
    if (host === 'amazon.com') {
      us++; byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
      if (usId && tag === usId) usOk++; else if (usId) bad.push(`${t.work}: US link without the tracking ID (${t.url})`);
    } else {
      nonUs[host] = (nonUs[host] ?? 0) + 1;
      if (usId && tag === usId) bad.push(`${t.work}: the US tracking ID is on ${host} (${t.url})`);
      else if (tag !== want && !(tag === null && !want)) bad.push(`${t.work}: ${host} link has tag "${tag}" but its marketplace ID is "${want}"`);
    }
  }
  fs.mkdirSync(path.join(ROOT, DATA), { recursive: true });
  fs.writeFileSync(path.join(ROOT, DATA, 'affiliate-guard.json'), JSON.stringify({ generated: cfg.catalogueAsOf, trackingId: usId, eligibleUsLinks: us, taggedCorrectly: usOk, percentCorrect: us ? +(100 * usOk / us).toFixed(2) : null, usLinksByKind: byKind, nonUsLinks: nonUs, violations: bad.length }, null, 1));
  if (bad.length) { console.error(`AFFILIATE GUARD FAILED (${bad.length}):\n  ` + bad.slice(0, 20).join('\n  ')); process.exit(1); }
  console.log(`affiliate guard: ${usOk}/${us} eligible amazon.com links carry ${usId ?? '(no ID configured)'}; non-US links: ${JSON.stringify(nonUs)}`);
}
fs.mkdirSync(path.join(ROOT, DATA), { recursive: true });
fs.writeFileSync(path.join(ROOT, DATA, 'retailer-links.json'), JSON.stringify({ generated: cfg.catalogueAsOf, note: 'Every outbound retail URL rendered by the site (untagged). Input for scripts/check-links.mjs.', links: (() => { const seen = new Set(); return LINKLOG.filter((l) => !seen.has(l.url) && seen.add(l.url)); })() }, null, 1));
write('assets/catalogue.json', JSON.stringify({ generated: cat.generated, works: cat.works.length, editions: totalEditions, languages: Object.fromEntries(stocked.map((l) => [l.code, { works: nWorks(l.code), editions: nEds(l.code) }])) }));
// robots.txt and sitemap.xml: previews are closed to crawlers; production gets a sitemap built from the pages generated above
{
  const urls = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'index.html' && path.relative(OUT, d) !== 'book' && urls.push(path.relative(OUT, d).split(path.sep).join('/')); })(OUT);
  if (PRODUCTION) {
    write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
    write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.sort().map((u) => `<url><loc>${SITE_URL}/${u ? u + '/' : ''}</loc><lastmod>${cfg.catalogueAsOf}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  } else write('robots.txt', 'User-agent: *\nDisallow: /\n');
}
const nPages = (function count(d) { return fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : e.name.endsWith('.html') ? 1 : 0), 0); })(OUT);
console.log(`built ${nPages} pages -> ${path.relative(ROOT, OUT)}/  (works=${cat.works.length}, editions=${totalEditions}, authors=${cat.authors.length}, languages with editions=${stocked.length}/${langReg.languages.length}, ui locales=${uiLocales.join(',')}, tracking IDs set for: ${Object.entries(tagStatus).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'})`);
