#!/usr/bin/env node
// Static site build:  node scripts/build.mjs   ->  site/
// Reads data/catalogue.json (from scripts/import.mjs), data/taxonomy.json, data/collections.json, config/site.json.
// Zero dependencies. Links end in index.html so the output also works from file:// and from any sub-path.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cfg = rd('config/site.json');
const tax = rd('data/taxonomy.json');
const cat = rd('data/catalogue.json');
const staged = rd('data/staged.json').works;
const coll = rd('data/collections.json');
const TAG = process.env.AMAZON_TRACKING_ID || cfg.affiliate.trackingId || null;
const MARKET = cfg.affiliate.marketplace;

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const workById = new Map(cat.works.map((w) => [w.id, w]));
const authorById = new Map(cat.authors.map((a) => [a.id, a]));
const dept = new Map(tax.departments.map((d) => [d.id, d]));
const hub = new Map(tax.hubs.map((h) => [h.id, h]));
const trad = new Map(tax.traditions.map((t) => [t.id, t]));
const PERENNIAL = { id: 'perennial', name: 'Perennial Philosophy', intro: 'Writers who argue that the major mystical traditions share a common core. This is a contested position in academic study, and books in this group are labelled accordingly.' };
trad.set('perennial', PERENNIAL); tax.traditions.push(PERENNIAL);

// ---------- helpers ----------
let ROOT_PREFIX = './';
const href = (p) => `${ROOT_PREFIX}${p}${p.endsWith('/') ? 'index.html' : ''}`;
const write = (rel, html) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const depthPrefix = (rel) => '../'.repeat(rel.split('/').length - 1) || './';

const worksIn = (deptId) => cat.works.filter((w) => w.subjects.includes(deptId));
const worksInHub = (hubId) => cat.works.filter((w) => w.subjects.some((s) => dept.get(s).hubs.includes(hubId)));
const stagedIn = (deptId) => staged.filter((w) => w.subjects.includes(deptId)).length;
const stagedInHub = (hubId) => staged.filter((w) => w.subjects.some((s) => dept.get(s).hubs.includes(hubId))).length;
const primaryHub = (d) => hub.get(dept.get(d).hubs[0]);
const fmt = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const isbnFmt = (s) => s;

// ---------- retailer links ----------
function amazonURL(kind, v, title) {
  const base = kind === 'dp' ? `https://www.${MARKET}/dp/${v}` : `https://www.${MARKET}/s?k=${encodeURIComponent(v)}&i=stripbooks`;
  return TAG ? `${base}${base.includes('?') ? '&' : '?'}tag=${encodeURIComponent(TAG)}` : base;
}
function retailers(work, ed) {
  const out = [];
  for (const r of ed.retailers ?? []) {
    let url = r.url;
    if (r.retailer === 'amazon' && TAG && !/[?&]tag=/.test(url)) url += `${url.includes('?') ? '&' : '?'}tag=${encodeURIComponent(TAG)}`;
    out.push({ label: r.retailer === 'amazon' ? (ed.format === 'audiobook' ? 'Amazon (Audible)' : 'Amazon') : r.retailer === 'google-play' ? 'Google Play Books' : r.retailer, url, affiliate: r.retailer === 'amazon', status: r.verification === 'seen-in-search-results' ? `Link seen in search results on ${r.checkedOn}; live check pending` : `Verified ${r.checkedOn}` });
  }
  if (!out.some((o) => o.affiliate)) {
    if (ed.isbn10 && ['paperback', 'hardcover'].includes(ed.format) && !ed.noDerivedLink)
      out.push({ label: 'Amazon', url: amazonURL('dp', ed.isbn10), affiliate: true, status: 'Built from the ISBN-10; not yet confirmed live' });
    else if (work.press === 'fmp')
      out.push({ label: 'Search on Amazon', url: amazonURL('s', `${work.title} ${work.subtitle ?? ''} Forbidden Mantra Press`.replace(/\s+/g, ' ').trim()), affiliate: true, status: 'Search link; edition-specific ASIN still to be added' });
  }
  if (ed.isbn13) out.push({ label: 'Find in a library', url: `https://search.worldcat.org/search?q=bn%3A${ed.isbn13}`, affiliate: false, status: 'Non-commercial WorldCat ISBN lookup' });
  return out;
}

// ---------- components ----------
function hashHue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
function cover(w, big = false) {
  const hue = w.press ? 38 : hashHue(w.title);
  return `<div class="cover${big ? ' cover-lg' : ''}${w.press ? ' cover-fmp' : ''}" style="--h:${hue}" role="img" aria-label="Placeholder cover for ${esc(w.title)}. Official cover art is shown only where a permitted source is connected."><span class="cover-title">${esc(w.title)}</span><span class="cover-author">${esc(w.authors[0])}</span></div>`;
}
const authorLinks = (w) => w.authors.map((n) => `<a href="${href(`authors/${slugify(n)}/`)}">${esc(n)}</a>`).join(', ');
function searchBlob(w) {
  const ids = w.editions.flatMap((e) => [e.isbn13, e.isbn10, e.asin].filter(Boolean));
  return [w.title, w.subtitle, ...w.authors, ...w.subjects.map((s) => dept.get(s).name), ...(w.tradition ?? []).map((t) => trad.get(t)?.name), ...w.editions.map((e) => e.publisher), w.press ? 'forbidden mantra press' : '', ...ids].join(' ').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}
function card(w) {
  const fmts = [...new Set(w.editions.map((e) => e.format))];
  const langs = [...new Set(w.editions.map((e) => e.language))];
  return `<article class="card" data-title="${esc(w.title.toLowerCase())}" data-search="${esc(searchBlob(w))}" data-subjects="${w.subjects.join(' ')}" data-hubs="${[...new Set(w.subjects.flatMap((s) => dept.get(s).hubs))].join(' ')}" data-tradition="${(w.tradition ?? []).join(' ')}" data-lang="${langs.join(' ')}" data-format="${fmts.join(' ')}" data-level="${w.level}" data-press="${w.press ? 'fmp' : 'outside'}" data-author="${w.authors.map((a) => a.toLowerCase()).join(' ')}">
  <a class="card-cover" href="${href(`books/${w.slug}/`)}" tabindex="-1" aria-hidden="true">${cover(w)}</a>
  <div class="card-body">
    ${w.press ? '<span class="badge badge-fmp">Forbidden Mantra Press</span>' : ''}
    <h3 class="card-title"><a href="${href(`books/${w.slug}/`)}">${esc(w.title)}</a></h3>
    ${w.subtitle ? `<p class="card-sub">${esc(w.subtitle)}</p>` : ''}
    <p class="card-author">${authorLinks(w)}</p>
    <p class="card-meta">${fmts.map((f) => tax.formats[f]).join(' · ')} · ${langs.map((l) => tax.languages[l]).join(', ')} · ${tax.levels[w.level].split(' /')[0]}</p>
  </div>
</article>`;
}
const grid = (works, { filterable = true } = {}) => `<div class="grid" ${filterable ? 'data-filterable' : ''}>${works.map(card).join('')}</div>`;

function filterBar({ subjects = true, traditions = true, press = true } = {}, { q = true } = {}) {
  const opts = (map) => Object.entries(map).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  return `<form class="filters" role="search" aria-label="Filter books" data-filterbar onsubmit="return false">
  ${q ? `<label class="f-q"><span>Search title, author, subject or ISBN</span><input type="search" name="q" autocomplete="off" placeholder="e.g. Tolle, tarot, 9781577314806"></label>` : ''}
  ${subjects ? `<label><span>Subject</span><select name="subject"><option value="">All subjects</option>${tax.departments.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label>` : ''}
  ${traditions ? `<label><span>Tradition</span><select name="tradition"><option value="">All traditions</option>${tax.traditions.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>` : ''}
  <label><span>Language</span><select name="lang"><option value="">Any</option>${opts(tax.languages)}</select></label>
  <label><span>Format</span><select name="format"><option value="">Any</option>${opts(tax.formats)}</select></label>
  <label><span>Reading level</span><select name="level"><option value="">Any</option>${opts(tax.levels)}</select></label>
  ${press ? `<label><span>Source</span><select name="press"><option value="">All books</option><option value="fmp">Forbidden Mantra Press</option><option value="outside">Other publishers</option></select></label>` : ''}
  <button type="reset" class="btn-link">Clear filters</button>
  <p class="f-count" role="status" aria-live="polite" data-count></p>
</form>`;
}

const NAV = [['Subjects', 'subjects/'], ['Traditions', 'traditions/'], ['Authors', 'authors/'], ['Reading paths', 'paths/'], ['Collections', 'collections/'], ['Press', 'press/']];
function layout({ title, rel, desc, body, crumbs = [], jsonld = null, current = '' }) {
  ROOT_PREFIX = depthPrefix(rel);
  const page = body();
  const bc = crumbs.length ? `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${href('')}">Home</a></li>${crumbs.map(([l, u]) => `<li>${u ? `<a href="${href(u)}">${esc(l)}</a>` : `<span aria-current="page">${esc(l)}</span>`}</li>`).join('')}</ol></nav>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}${title.includes('Forbidden Mantra') ? '' : ' · Forbidden Mantra Press'}</title>
<meta name="description" content="${esc(desc ?? cfg.tagline)}">
<meta name="robots" content="noindex, nofollow"><!-- preview build: remove before production -->
<link rel="stylesheet" href="${ROOT_PREFIX}assets/style.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;500;600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="preview-bar" role="note">Preview build, not published. Catalogue as of ${cfg.catalogueAsOf}. ${TAG ? '' : 'Amazon links carry no Associates tracking ID yet.'}</div>
<header class="site-header">
  <div class="wrap header-in">
    <a class="logo" href="${href('')}">Forbidden Mantra Press</a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav" type="button"><span class="sr">Menu</span><span aria-hidden="true">☰</span></button>
    <nav id="nav" class="nav" aria-label="Main">
      <ul>${NAV.map(([l, u]) => `<li><a href="${href(u)}"${current === u ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul>
      <form class="nav-search" action="${href('search/')}" method="get" role="search"><label class="sr" for="q-nav">Search the catalogue</label><input id="q-nav" type="search" name="q" placeholder="Search title, author, ISBN"><button type="submit">Search</button></form>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
<div class="wrap">${bc}</div>
${page}
</main>
<footer class="site-footer">
  <div class="wrap foot-grid">
    <div><p class="foot-brand">Forbidden Mantra Press</p><p>A curated bookstore of sacred texts, practice and inner cultivation.</p></div>
    <div><p class="foot-h">Browse</p><ul>${tax.hubs.map((h) => `<li><a href="${href(`subjects/${h.id}/`)}">${esc(h.name)}</a></li>`).join('')}</ul></div>
    <div><p class="foot-h">Store</p><ul><li><a href="${href('books/')}">All books</a></li><li><a href="${href('press/')}">Forbidden Mantra Press</a></li><li><a href="${href('about/catalogue-standards/')}">How we verify books</a></li><li><a href="${href('about/affiliate-disclosure/')}">Affiliate disclosure</a></li></ul></div>
  </div>
  <div class="wrap"><p class="disclosure">${esc(cfg.disclosure)}</p><p class="copy">© 2025–2026 Forbidden Mantra Press</p></div>
</footer>
<script src="${ROOT_PREFIX}assets/app.js"></script>
</body>
</html>`;
}
const page = (rel, opts) => write(rel, layout({ ...opts, rel }));

// ---------- pages ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'scripts/assets/style.css'), path.join(OUT, 'assets/style.css'));
fs.copyFileSync(path.join(ROOT, 'scripts/assets/app.js'), path.join(OUT, 'assets/app.js'));

const fmpWorks = cat.works.filter((w) => w.press === 'fmp');
const outside = cat.works.filter((w) => !w.press);

// home
page('index.html', {
  title: 'Forbidden Mantra Press', desc: cfg.tagline, current: '',
  body: () => `
<section class="hero">
  <div class="wrap">
    <p class="eyebrow">Ancient wisdom · Hidden knowledge · Inner power</p>
    <h1>Forbidden<br>Mantra Press</h1>
    <p class="lede">A curated bookstore of sacred texts, practice and inner cultivation, from our own press and from established authors in every tradition we shelve.</p>
    <form class="hero-search" action="${href('search/')}" method="get" role="search"><label class="sr" for="q-hero">Search the catalogue</label><input id="q-hero" type="search" name="q" placeholder="Search by title, author, subject or ISBN"><button class="btn" type="submit">Search</button></form>
    <p class="hero-links"><a class="btn btn-ghost" href="${href('press/')}">Forbidden Mantra Press books</a> <a class="btn btn-ghost" href="${href('books/')}">Browse the catalogue</a> <a class="btn btn-ghost" href="${href('paths/')}">Beginner reading paths</a></p>
  </div>
</section>
<section class="band"><div class="wrap">
  <h2>Six subject hubs</h2>
  <div class="hubs">${tax.hubs.map((h) => { const n = worksInHub(h.id).length; return `<a class="hub" href="${href(`subjects/${h.id}/`)}"><h3>${esc(h.name)}</h3><p>${esc(h.tagline)}</p><span class="hub-n">${fmt(n, 'book', 'books')} · ${fmt(tax.departments.filter((d) => d.hubs.includes(h.id)).length, 'department', 'departments')}</span></a>`; }).join('')}</div>
</div></section>
<section class="band alt"><div class="wrap">
  <div class="split"><h2>From Forbidden Mantra Press</h2><a href="${href('press/')}">All press titles →</a></div>
  ${grid(fmpWorks.slice(0, 4), { filterable: false })}
</div></section>
<section class="band"><div class="wrap">
  <div class="split"><h2>Start reading</h2><a href="${href('paths/')}">All reading paths →</a></div>
  <div class="paths">${coll.paths.slice(0, 3).map((p) => `<a class="path" href="${href(`paths/${p.id}/`)}"><p class="eyebrow">${esc(p.audience)}</p><h3>${esc(p.title)}</h3><p>${esc(p.blurb)}</p></a>`).join('')}</div>
</div></section>
<section class="band alt"><div class="wrap">
  <div class="split"><h2>Established authors</h2><a href="${href('authors/')}">Authors A–Z →</a></div>
  ${grid(outside.slice(0, 8), { filterable: false })}
</div></section>
<section class="band"><div class="wrap narrow">
  <h2>How the catalogue is built</h2>
  <p>Every listed book has a named source for its title, author, edition and identifier. Books we cannot yet confirm are held back rather than shown. We do not display prices, ratings or bestseller badges unless they come from a source we are permitted to use. <a href="${href('about/catalogue-standards/')}">Read our standards</a>.</p>
</div></section>`,
});

// all books + search
const browseBody = (heading, intro) => () => `
<section class="band"><div class="wrap">
  <h1>${heading}</h1><p class="lede-sm">${intro}</p>
  ${filterBar()}
  ${grid(cat.works)}
  <p class="empty" hidden data-empty>No books match those filters. Try clearing a filter or searching a different spelling.</p>
  <p class="note">The catalogue is growing. ${staged.length} further outside editions are staged and will be published once each title, edition and identifier is confirmed against a source.</p>
</div></section>`;
page('books/index.html', { title: 'All books', desc: 'Browse the full Forbidden Mantra Press catalogue.', crumbs: [['All books']], current: 'books/', body: browseBody('All books', 'Browse by subject, tradition, language, format and reading level, or search by title, author, subject or ISBN.') });
page('search/index.html', { title: 'Search', desc: 'Search by title, author, subject or ISBN.', crumbs: [['Search']], body: browseBody('Search the catalogue', 'Search by title, author, subject or ISBN. ISBNs can be typed with or without hyphens.') });

// subjects
page('subjects/index.html', {
  title: 'Subjects', crumbs: [['Subjects']], current: 'subjects/', desc: 'Six subject hubs and 29 departments.',
  body: () => `<section class="band"><div class="wrap"><h1>Subjects</h1>${tax.hubs.map((h) => `<div class="hub-block"><h2><a href="${href(`subjects/${h.id}/`)}">${esc(h.name)}</a></h2><p>${esc(h.tagline)}</p><ul class="chips">${tax.departments.filter((d) => d.hubs.includes(h.id)).map((d) => `<li><a href="${href(`topics/${d.id}/`)}">${esc(d.name)}</a> <span>${worksIn(d.id).length}</span></li>`).join('')}</ul></div>`).join('')}</div></section>`,
});
for (const h of tax.hubs) {
  const ds = tax.departments.filter((d) => d.hubs.includes(h.id));
  const ws = worksInHub(h.id);
  const fm = ws.filter((w) => w.press);
  page(`subjects/${h.id}/index.html`, {
    title: h.name, desc: h.tagline, crumbs: [['Subjects', 'subjects/'], [h.name]],
    body: () => `<section class="band"><div class="wrap"><h1>${esc(h.name)}</h1><p class="lede-sm">${esc(h.intro)}</p>
<h2>Departments</h2>
<div class="depts">${ds.map((d) => `<a class="dept" href="${href(`topics/${d.id}/`)}"><h3>${esc(d.name)}</h3><p>${esc(d.intro.split('. ')[0])}.</p><span class="hub-n">${fmt(worksIn(d.id).length, 'book', 'books')}${stagedIn(d.id) ? ` · ${stagedIn(d.id)} in review` : ''}</span></a>`).join('')}</div>
${fm.length ? `<h2>From Forbidden Mantra Press</h2>${grid(fm, { filterable: false })}` : ''}
<h2>All books in this hub</h2>
${ws.length ? filterBar({ subjects: false }, { q: false }) + grid(ws) + '<p class="empty" hidden data-empty>No books match those filters.</p>' : `<p class="note">No books are published in this hub yet. ${stagedInHub(h.id)} are staged for verification.</p>`}
</div></section>`,
  });
}
for (const d of tax.departments) {
  const ws = worksIn(d.id);
  const rel = d.related ?? [];
  const sameHub = tax.departments.filter((x) => x.id !== d.id && x.hubs.some((hh) => d.hubs.includes(hh)));
  page(`topics/${d.id}/index.html`, {
    title: d.name, desc: d.intro.split('. ')[0] + '.', crumbs: [['Subjects', 'subjects/'], [primaryHub(d.id).name, `subjects/${primaryHub(d.id).id}/`], [d.name]],
    body: () => `<section class="band"><div class="wrap"><p class="eyebrow">${d.hubs.map((hh) => esc(hub.get(hh).name)).join(' · ')}</p><h1>${esc(d.name)}</h1><p class="lede-sm">${esc(d.intro)}</p>
${ws.length ? filterBar({ subjects: false }, { q: false }) + grid(ws) + '<p class="empty" hidden data-empty>No books match those filters.</p>' : `<p class="note">No books are published in this department yet. ${stagedIn(d.id) ? `${stagedIn(d.id)} candidate titles are in review.` : 'Candidate titles have not yet been staged.'}</p>`}
<h2>Related departments</h2><ul class="chips">${sameHub.map((x) => `<li><a href="${href(`topics/${x.id}/`)}">${esc(x.name)}</a></li>`).join('')}</ul>
</div></section>`,
  });
}

// traditions
page('traditions/index.html', {
  title: 'Traditions', crumbs: [['Traditions']], current: 'traditions/', desc: 'Browse by tradition.',
  body: () => `<section class="band"><div class="wrap"><h1>Traditions</h1><p class="lede-sm">Traditions are kept distinct. A book on Taoist internal alchemy is not filed with Hindu tantra, and Gnostic texts are not mixed with Christian mystical writing. Where a book is a modern adaptation or draws on several sources, its page says so.</p>
<div class="depts">${tax.traditions.map((t) => `<a class="dept" href="${href(`traditions/${t.id}/`)}"><h3>${esc(t.name)}</h3><p>${esc(t.intro)}</p><span class="hub-n">${fmt(cat.works.filter((w) => (w.tradition ?? []).includes(t.id)).length, 'book', 'books')}</span></a>`).join('')}</div></div></section>`,
});
for (const t of tax.traditions) {
  const ws = cat.works.filter((w) => (w.tradition ?? []).includes(t.id));
  page(`traditions/${t.id}/index.html`, {
    title: t.name, desc: t.intro, crumbs: [['Traditions', 'traditions/'], [t.name]],
    body: () => `<section class="band"><div class="wrap"><h1>${esc(t.name)}</h1><p class="lede-sm">${esc(t.intro)}</p>${ws.length ? filterBar({ traditions: false }, { q: false }) + grid(ws) + '<p class="empty" hidden data-empty>No books match those filters.</p>' : '<p class="note">No books are published under this tradition yet.</p>'}</div></section>`,
  });
}

// authors
const letters = [...new Set(cat.authors.map((a) => a.sortName[0].toUpperCase()))];
page('authors/index.html', {
  title: 'Authors A–Z', crumbs: [['Authors']], current: 'authors/', desc: 'Authors A to Z.',
  body: () => `<section class="band"><div class="wrap"><h1>Authors A–Z</h1>
<nav class="az" aria-label="Jump to letter">${letters.map((l) => `<a href="#l-${l}">${l}</a>`).join('')}</nav>
${letters.map((l) => `<h2 id="l-${l}">${l}</h2><ul class="authors">${cat.authors.filter((a) => a.sortName[0].toUpperCase() === l).map((a) => `<li><a href="${href(`authors/${a.id}/`)}">${esc(a.sortName)}</a> <span>${fmt(a.workIds.length, 'book', 'books')}</span></li>`).join('')}</ul>`).join('')}
</div></section>`,
});
for (const a of cat.authors) {
  const ws = a.workIds.map((id) => workById.get(id));
  page(`authors/${a.id}/index.html`, {
    title: a.name, desc: a.bio ?? `Books by ${a.name}`, crumbs: [['Authors', 'authors/'], [a.name]],
    body: () => `<section class="band"><div class="wrap"><h1>${esc(a.name)}</h1>${a.bio ? `<p class="lede-sm">${esc(a.bio)}</p>` : '<p class="note">Author profile pending. The author credit on Forbidden Mantra Press titles is being confirmed with the publisher.</p>'}<h2>Books</h2>${grid(ws, { filterable: false })}</div></section>`,
  });
}

// books
for (const w of cat.works) {
  const related = cat.works.filter((o) => o.id !== w.id && o.subjects.some((s) => w.subjects.includes(s))).slice(0, 4);
  const fmts = [...new Set(w.editions.map((e) => e.format))];
  page(`books/${w.slug}/index.html`, {
    title: w.title + (w.subtitle ? `: ${w.subtitle}` : ''), desc: w.description.split('. ')[0] + '.', crumbs: [['All books', 'books/'], [w.title]],
    jsonld: { '@context': 'https://schema.org', '@type': 'Book', name: w.title, author: w.authors.map((n) => ({ '@type': 'Person', name: n })), inLanguage: 'en', workExample: w.editions.map((e) => ({ '@type': 'Book', bookFormat: { paperback: 'Paperback', hardcover: 'Hardcover', ebook: 'EBook', audiobook: 'AudiobookFormat' }[e.format], isbn: e.isbn13 || undefined, inLanguage: e.language, publisher: e.publisher ? { '@type': 'Organization', name: e.publisher } : undefined })) },
    body: () => `<article class="band"><div class="wrap book">
  <div class="book-cover">${cover(w, true)}</div>
  <div class="book-main">
    ${w.press ? '<span class="badge badge-fmp">Forbidden Mantra Press</span>' : ''}
    <h1>${esc(w.title)}</h1>${w.subtitle ? `<p class="subtitle">${esc(w.subtitle)}</p>` : ''}
    <p class="byline">by ${authorLinks(w)}</p>
    <p class="meta-row"><span>${tax.levels[w.level]}</span>${(w.tradition ?? []).map((t) => `<a class="tag" href="${href(`traditions/${t}/`)}">${esc(trad.get(t).name)}</a>`).join('')}</p>
    <p class="desc">${esc(w.description)}</p>
    ${w.status === 'owner-listed' ? `<p class="note">Edition details for this title are being confirmed with the publisher. Retailer links marked “search” will be replaced by edition-specific links.</p>` : ''}
    ${(w.claims ?? []).filter((c) => c.display).map((c) => `<p class="claim"><strong>Historical note:</strong> ${esc(c.text)}. <span>Per publisher and bookseller listings; not a current ranking.</span></p>`).join('')}
    <h2>Subjects</h2>
    <ul class="chips">${w.subjects.map((s) => `<li><a href="${href(`topics/${s}/`)}">${esc(dept.get(s).name)}</a></li>`).join('')}</ul>
  </div>
</div>
<div class="wrap">
  <h2>Editions</h2>
  <p class="note-sm">Editions of the same work are grouped here. Each has its own identifier and retailer destination.</p>
  <div class="editions">${w.editions.map((e) => `<section class="edition" aria-label="${esc(tax.formats[e.format])} edition">
    <h3>${esc(tax.formats[e.format])} · ${esc(tax.languages[e.language])}</h3>
    <dl>${e.publisher ? `<dt>Publisher</dt><dd>${esc(e.publisher)}</dd>` : ''}${e.year ? `<dt>Year</dt><dd>${e.year}</dd>` : ''}${e.isbn13 ? `<dt>ISBN-13</dt><dd>${e.isbn13}</dd>` : ''}${e.isbn10 ? `<dt>ISBN-10</dt><dd>${e.isbn10}</dd>` : ''}${e.asin ? `<dt>ASIN</dt><dd>${e.asin}</dd>` : ''}</dl>
    ${e.note ? `<p class="note-sm">${esc(e.note)}</p>` : ''}
    ${e.needsSecondSource ? '<p class="note-sm flag">Identifier reported by a single source; awaiting corroboration.</p>' : ''}
    <ul class="buy">${retailers(w, e).map((r) => `<li><a class="${r.affiliate ? 'btn' : 'btn btn-ghost'}" href="${esc(r.url)}" target="_blank" rel="${r.affiliate ? 'sponsored ' : ''}noopener noreferrer">${esc(r.label)}<span class="sr"> (opens in a new tab)</span></a><span class="status">${esc(r.status)}</span></li>`).join('') || '<li class="status">No retailer link verified yet.</li>'}</ul>
  </section>`).join('')}</div>
  <p class="note-sm">Prices, availability, ratings and cover images are not shown: they appear only through a permitted, maintained source, and none is connected to this preview yet.</p>
  <details class="sources"><summary>Sources and verification</summary><ul>${w.sources.map((s) => `<li>${/^https?:/.test(s.url) ? `<a href="${esc(s.url)}" rel="noopener noreferrer">${esc(s.label)}</a>` : esc(s.label)}, supports ${esc(s.supports)}; accessed ${s.accessed}.</li>`).join('')}</ul></details>
  <p class="disclosure sm">${esc(cfg.disclosure)}</p>
  ${related.length ? `<h2>Related books</h2>${grid(related, { filterable: false })}` : ''}
</div></article>`,
  });
}

// press
page('press/index.html', {
  title: 'Forbidden Mantra Press', current: 'press/', crumbs: [['Forbidden Mantra Press']], desc: 'Books from Forbidden Mantra Press.',
  body: () => `<section class="hero hero-sm"><div class="wrap"><p class="eyebrow">Our imprint</p><h1>Forbidden Mantra Press</h1><p class="lede">Sacred texts and practice guides: the Forbidden Mantra Series on Sanskrit mantras, Nag Hammadi and Ethiopian texts, Hindu epic material, and internal-energy cultivation.</p></div></section>
<section class="band"><div class="wrap">
  ${filterBar({ press: false }, { q: false })}${grid(fmpWorks)}
  <p class="empty" hidden data-empty>No books match those filters.</p>
  <div class="note"><p><strong>Catalogue status.</strong> Amazon lists the Forbidden Mantra Series as 41 books; ${fmpWorks.length} titles are published here so far. The remaining titles, additional formats and the Spanish and German editions are waiting on an export of the Amazon KDP/Author Central catalogue so that each edition gets its own verified link.</p></div>
  <p><a class="btn btn-ghost" href="${esc(cfg.affiliate.legacyStoreLink)}" target="_blank" rel="sponsored noopener noreferrer">Visit our Amazon storefront<span class="sr"> (opens in a new tab)</span></a> <span class="status">Existing store link, kept until edition links are complete.</span></p>
</div></section>`,
});

// paths + collections
page('paths/index.html', {
  title: 'Reading paths', current: 'paths/', crumbs: [['Reading paths']], desc: 'Beginner reading paths.',
  body: () => `<section class="band"><div class="wrap"><h1>Beginner reading paths</h1><p class="lede-sm">Short sequences that tell you what to read first and why. Paths grow as more titles pass verification.</p><div class="paths">${coll.paths.map((p) => `<a class="path" href="${href(`paths/${p.id}/`)}"><p class="eyebrow">${esc(p.audience)}</p><h3>${esc(p.title)}</h3><p>${esc(p.blurb)}</p><span class="hub-n">${fmt(p.steps.length, 'book', 'books')}</span></a>`).join('')}</div></div></section>`,
});
for (const p of coll.paths) page(`paths/${p.id}/index.html`, {
  title: p.title, desc: p.blurb, crumbs: [['Reading paths', 'paths/'], [p.title]],
  body: () => `<section class="band"><div class="wrap narrow"><p class="eyebrow">${esc(p.audience)}</p><h1>${esc(p.title)}</h1><p class="lede-sm">${esc(p.blurb)}</p><ol class="steps">${p.steps.map((s, i) => { const w = workById.get(s.work); return `<li><div class="step-n" aria-hidden="true">${i + 1}</div><div>${card(w)}<p class="why">${esc(s.why)}</p></div></li>`; }).join('')}</ol></div></section>`,
});
page('collections/index.html', {
  title: 'Collections', current: 'collections/', crumbs: [['Collections']], desc: 'Curated collections.',
  body: () => `<section class="band"><div class="wrap"><h1>Curated collections</h1><div class="paths">${coll.collections.map((c) => `<a class="path" href="${href(`collections/${c.id}/`)}"><h3>${esc(c.title)}</h3><p>${esc(c.blurb)}</p><span class="hub-n">${fmt(c.works.length, 'book', 'books')}</span></a>`).join('')}</div></div></section>`,
});
for (const c of coll.collections) page(`collections/${c.id}/index.html`, {
  title: c.title, desc: c.blurb, crumbs: [['Collections', 'collections/'], [c.title]],
  body: () => `<section class="band"><div class="wrap"><h1>${esc(c.title)}</h1><p class="lede-sm">${esc(c.blurb)}</p>${grid(c.works.map((id) => workById.get(id)), { filterable: false })}</div></section>`,
});

// about
page('about/affiliate-disclosure/index.html', {
  title: 'Affiliate disclosure', crumbs: [['Affiliate disclosure']], desc: 'How we use affiliate links.',
  body: () => `<section class="band"><div class="wrap narrow prose"><h1>Affiliate disclosure</h1><p>${esc(cfg.disclosure)}</p><p>Buttons marked “Amazon” lead to Amazon.com. When we have an Amazon Associates tracking ID configured, those links include it, and we earn a small commission on qualifying purchases at no cost to you. Links to library lookups are non-commercial.</p><p>We do not show Amazon prices, availability or ratings unless they come through Amazon’s permitted programmes, and then only with the date and time they were retrieved.</p></div></section>`,
});
page('about/catalogue-standards/index.html', {
  title: 'How we verify books', crumbs: [['How we verify books']], desc: 'Catalogue standards.',
  body: () => `<section class="band"><div class="wrap narrow prose"><h1>How we verify books</h1>
<p>A book appears in the catalogue only when its title, author, edition and identifier agree across at least one dated source, and its record keeps that source (see “Sources and verification” on each book page).</p>
<ul><li><strong>Editions are grouped under one work.</strong> Paperback, hardcover, e-book, audiobook and different language editions each keep their own identifier and retailer link.</li>
<li><strong>Uncertain records stay unpublished.</strong> Records with a failed ISBN checksum, a missing identifier or conflicting details go to a review queue.</li>
<li><strong>Descriptions are our own.</strong> We write original summaries and do not copy competing bookstores.</li>
<li><strong>No unverified claims.</strong> Bestseller badges, ratings and prices appear only when drawn from a source we are permitted to use. Historical honours (such as awards) are labelled as historical and are never presented as current rankings.</li>
<li><strong>Traditions are kept distinct.</strong> Books are placed under the tradition they actually teach.</li></ul></div></section>`,
});

// machine-readable index for the client (also useful for debugging)
write('assets/catalogue.json', JSON.stringify({ generated: cat.generated, works: cat.works.length }));

const nPages = (function count(d) { return fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : e.name.endsWith('.html') ? 1 : 0), 0); })(OUT);
console.log(`built ${nPages} pages -> site/  (works=${cat.works.length}, authors=${cat.authors.length}, tracking ID ${TAG ? 'set' : 'NOT set'})`);
