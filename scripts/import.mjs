#!/usr/bin/env node
// Catalogue import pipeline.
//   node scripts/import.mjs
// Inputs : staging/verified/*.json   hand-verified works with per-record provenance (can be published)
//          staging/*.psv             bulk candidate rows (never published by this script; staged only)
// Outputs: data/catalogue.json       published works + authors (consumed by the site build)
//          data/staged.json          valid but not yet verified candidates (unpublished)
//          data/error-queue.json     records rejected with reasons (fix the source, re-run)
//          data/import-report.json   counts for the run
//          data/staged-editions.json candidate translations/editions of published works (unpublished)
//          data/edition-leads.json   reported-but-unverified editions (unpublished; never shown as stocked)
// Rules  : a record is published only if it is in staging/verified, passes validation, and carries >=1 dated source.
//          Non-English editions additionally need their own dated source per edition (no inferred translations).
//          Anything uncertain stays unpublished.
// Env    : FM_STAGING (default staging) and FM_DATA (output dir, default data) let tests run on fixtures.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const tax = rd('data/taxonomy.json');
const bios = rd('data/author-bios.json');
const cfg = rd('config/site.json');
const TODAY = cfg.catalogueAsOf;
const STAGING = process.env.FM_STAGING ?? 'staging';
const DATA = process.env.FM_DATA ?? 'data';
const langReg = rd('data/languages.json');
const LANGS = new Set(langReg.languages.map((l) => l.code));
const MARKETS = new Set(Object.keys(cfg.affiliate.marketplaces));

const deptIds = new Set(tax.departments.map((d) => d.id));
const tradIds = new Set(tax.traditions.map((t) => t.id));
const PSV_EXTRA_TRADS = new Set(['perennial']);

import { slugify } from './lib.mjs';
const normTitle = (t) => slugify(t.replace(/^(the|a|an)\s+/i, '')) || t.trim().toLowerCase(); // non-Latin titles keep their own text as the key

export function isbn13Valid(s) {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += +s[i] * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === +s[12];
}
export function isbn13to10(s) {
  if (!s.startsWith('978')) return null;
  const core = s.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +core[i] * (10 - i);
  const c = (11 - (sum % 11)) % 11;
  return core + (c === 10 ? 'X' : String(c));
}

const errors = [];
const queue = (record, stage, reasons, severity = 'error') => errors.push({ title: record.title, authors: record.authors, isbn13: record.isbn13 ?? record.editions?.map((e) => e.isbn13).filter(Boolean) ?? null, stage, severity, reasons, origin: record._origin });

function validateWork(w, { requireSources, allowNoId = false }) {
  const r = [];
  if (!w.title?.trim()) r.push('missing title');
  if (!w.authors?.length) r.push('missing authors');
  for (const s of w.subjects ?? []) if (!deptIds.has(s)) r.push(`unknown subject "${s}"`);
  if (!w.subjects?.length) r.push('no subjects');
  for (const t of w.tradition ?? []) if (!tradIds.has(t)) r.push(`unknown tradition "${t}"`);
  if (!tax.levels[w.level]) r.push(`bad level "${w.level}"`);
  if (!w.editions?.length) r.push('no editions');
  for (const e of w.editions ?? []) {
    if (!tax.formats[e.format]) r.push(`bad format "${e.format}"`);
    if (!LANGS.has(e.language)) r.push(`unknown language code "${e.language}" (add it to data/languages.json)`);
    for (const x of e.alsoLanguages ?? []) if (!LANGS.has(x)) r.push(`unknown alsoLanguages code "${x}"`);
    if (e.language !== 'en' && !(e.sources?.length && e.sources.every((x) => x.url && x.accessed))) r.push(`${e.language} edition (${e.format}) needs its own dated source; translated editions are never inferred from the English work`);
    if (e.marketplace && !MARKETS.has(e.marketplace)) r.push(`unknown edition marketplace "${e.marketplace}" (add it to config/site.json)`);
    for (const rt of e.retailers ?? []) if (rt.retailer === 'amazon' && rt.marketplace && !MARKETS.has(rt.marketplace)) r.push(`unknown Amazon marketplace "${rt.marketplace}" (add it to config/site.json)`);
    if (e.isbn13 && !isbn13Valid(e.isbn13)) r.push(`ISBN-13 checksum fails: ${e.isbn13}`);
    if (!allowNoId && !e.isbn13 && !e.asin && !(e.retailers?.length)) r.push(`edition (${e.format}) has no identifier (ISBN/ASIN)`);
  }
  if (w.originalLanguage && !LANGS.has(w.originalLanguage)) r.push(`unknown originalLanguage "${w.originalLanguage}"`);
  if (requireSources && !(w.sources?.length && w.sources.every((s) => s.url && s.accessed))) r.push('missing dated source/provenance');
  return r;
}

// ---------- ingest hand-verified works ----------
const works = new Map(); // key -> work
const isbnIndex = new Map(); // isbn13 -> work key
function addWork(w, origin) {
  const key = `${normTitle(w.title)}|${slugify(w.authors[0])}`;
  const dupISBN = (w.editions ?? []).map((e) => e.isbn13).filter((i) => i && isbnIndex.has(i));
  if (works.has(key) || dupISBN.length) {
    queue({ ...w, _origin: origin }, 'dedup', [`duplicate of published work "${works.get(key)?.title ?? works.get(isbnIndex.get(dupISBN[0]))?.title}"`], 'duplicate');
    return false;
  }
  works.set(key, w);
  for (const e of w.editions) if (e.isbn13) isbnIndex.set(e.isbn13, key);
  return true;
}

const srcPolicy = rd('config/sources.json').policy;
const SLD_TLDS = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu']);
const hostOf = (u) => { // registrable name, with country suffixes stripped and common ownership merged (see config/sources.json hostOwnerGroups)
  try {
    const parts = new URL(u).hostname.replace(/^www\./, '').split('.');
    let i = parts.length - 1; // drop tld
    if (i > 0 && SLD_TLDS.has(parts[i - 1]) && parts[i].length === 2) i--; // co.uk, com.au
    const name = parts[Math.max(0, i - 1)];
    return srcPolicy.hostOwnerGroups?.[name] ?? name;
  } catch { return null; }
};
let nVerifiedIn = 0, nBatchIn = 0;
const batchTally = {};

function ingest(raw, origin, { batch = null } = {}) {
  const w = { ...raw, _origin: origin };
  const ownerListed = w.status === 'owner-listed';
  const problems = validateWork(w, { requireSources: true, allowNoId: ownerListed });
  if (w.series && !(typeof w.series.name === 'string' && w.series.name.trim())) problems.push('series needs a name');
  if (batch) {
    // batch works are bulk-verified: identity must be corroborated by >= minDistinctHostsForBatchPublish independent hosts
    // an edition without enough independent sources is held back on its own; the work is published with the editions that pass
    const thin = w.editions.filter((e) => new Set((e.sources ?? []).map((x) => hostOf(x.url)).filter(Boolean)).size < srcPolicy.minDistinctHostsForBatchPublish);
    if (thin.length && thin.length < w.editions.length) {
      queue({ ...w, editions: thin }, 'validate', thin.map((e) => `edition ${e.isbn13 ?? '(no ISBN)'} needs ${srcPolicy.minDistinctHostsForBatchPublish} independent source hosts of its own; held back, the other edition(s) of this work are published`), 'warning');
      w.editions = w.editions.filter((e) => !thin.includes(e));
    } else for (const e of thin) problems.push(`edition ${e.isbn13 ?? '(no ISBN)'} needs ${srcPolicy.minDistinctHostsForBatchPublish} independent source hosts of its own; found ${new Set((e.sources ?? []).map((x) => hostOf(x.url)).filter(Boolean)).size}`);
    if (w.press) problems.push('batch imports cannot create Forbidden Mantra Press titles');
    if (!w.editions.every((e) => e.isbn13)) problems.push('batch editions need an ISBN-13');
  }
  if (problems.length) { queue(w, 'validate', problems); return; }
  if (ownerListed) for (const e of w.editions) if (!e.isbn13 && !e.asin) queue({ ...w, isbn13: null }, 'identifiers', [`owner-listed ${e.format}${e.language !== 'en' ? ' (' + e.language + ')' : ''} edition has no ASIN/ISBN yet; retailer link not verified`], 'warning');
  const ids = w.editions.map((e) => e.id ?? e.isbn13 ?? e.asin).filter(Boolean);
  if (new Set(ids).size !== ids.length) { queue(w, 'validate', ['two editions of this work share an identifier']); return; }
  w.editions = w.editions.map((e, i) => ({ ...e, id: `${e.id ?? e.isbn13 ?? e.asin ?? `ed${i + 1}`}`, isbn10: e.isbn13 ? isbn13to10(e.isbn13) : null }));
  w.provenance ??= { tier: 'hand-verified' };
  if (addWork(w, w._origin)) batchTally[w.provenance.tier] = (batchTally[w.provenance.tier] ?? 0) + 1;
}

const verifiedDir = path.join(ROOT, STAGING, 'verified');
for (const f of fs.readdirSync(verifiedDir).filter((x) => x.endsWith('.json')).sort()) {
  const doc = rd(`${STAGING}/verified/${f}`);
  for (const raw of doc.works) { nVerifiedIn++; ingest(raw, `${STAGING}/verified/${f}`); }
}

// ---------- bulk batches: staging/batches/*.json (from reconcile.mjs) and *.vpsv (web-corroborated rows) ----------
// .vpsv columns: title|subtitle|authors|publisher|year|isbn13|format|language|subjects|tradition|level|series|seriesNo|sources|checked|note
// Rows sharing title + first author become ONE work with several editions. 'sources' are space-separated URLs; two or more distinct hosts required.
function vpsvWorks(text, file) {
  const byKey = new Map();
  const [head, ...lines] = text.trim().split('\n').filter((l) => !l.startsWith('#'));
  const cols = head.split('|');
  lines.forEach((l, i) => {
    const v = l.split('|'); const r = {}; cols.forEach((c, j) => (r[c] = (v[j] ?? '').trim()));
    const authors = r.authors.split(';').map((a) => a.trim()).filter(Boolean);
    const key = `${normTitle(r.title)}|${slugify(authors[0] ?? '')}`;
    const accessed = r.checked || TODAY;
    const ed = { language: r.language || 'en', format: r.format, publisher: r.publisher || null, year: r.year ? +r.year : null, isbn13: r.isbn13 || null, ...(r.note ? { note: r.note } : {}), sources: r.sources.split(/\s+/).filter(Boolean).map((url) => ({ label: 'Corroborating record', url, accessed, supports: 'ISBN-13, title, author' })) };
    if (!byKey.has(key)) byKey.set(key, { title: r.title, subtitle: r.subtitle || '', authors, subjects: r.subjects.split(';').filter(Boolean), tradition: r.tradition ? r.tradition.split(';') : [], level: r.level || 'unrated', series: r.series ? { name: r.series, ...(r.seriesNo ? { number: +r.seriesNo } : {}) } : undefined, description: null, status: 'verified', press: null, claims: [], editions: [], sources: ed.sources, provenance: { tier: 'web-corroborated', method: 'ISBN, title and author seen together on independent hosts', batchFile: file } });
    byKey.get(key).editions.push(ed);
  });
  return [...byKey.values()];
}
const batchDir = path.join(ROOT, STAGING, 'batches');
if (fs.existsSync(batchDir)) for (const f of fs.readdirSync(batchDir).sort()) {
  const works = f.endsWith('.json') ? rd(`${STAGING}/batches/${f}`).works : f.endsWith('.vpsv') ? vpsvWorks(fs.readFileSync(path.join(batchDir, f), 'utf8'), f) : null;
  if (!works) continue;
  for (const raw of works) { nBatchIn++; ingest(raw, `${STAGING}/batches/${f}`, { batch: f }); }
}

// ---------- ingest bulk candidates (stage only) ----------
function parsePSV(text) {
  const [head, ...lines] = text.trim().split('\n');
  const cols = head.split('|');
  return lines.map((l, i) => {
    const v = l.split('|');
    const o = { _row: i + 2 };
    cols.forEach((c, j) => (o[c] = (v[j] ?? '').trim()));
    return o;
  });
}
const staged = [];
const stagedEditions = [];
const seenStaged = new Map();
let nPsv = 0;
for (const f of fs.readdirSync(path.join(ROOT, STAGING)).filter((x) => x.endsWith('.psv') && !x.startsWith('articles-')).sort()) {
  for (const row of parsePSV(fs.readFileSync(path.join(ROOT, STAGING, f), 'utf8'))) {
    nPsv++;
    // Optional columns: translationOf (slug of a published work), editionTitle, translator. A row naming translationOf is a
    // candidate EDITION of that work, never a new work; it is staged for verification, not published.
    if (row.translationOf) {
      const parent = [...works.values()].find((x) => slugify(x.title) === row.translationOf);
      const e = { language: row.language, format: row.format, title: row.editionTitle || null, translator: row.translator || null, publisher: row.publisher, year: row.year ? +row.year : null, isbn13: row.isbn13 || null, sources: [{ label: 'Candidate row (unverified)', url: `${STAGING}/${f}#row${row._row}`, accessed: TODAY, supports: 'candidate only' }] };
      const rec = { title: row.editionTitle || row.title, authors: parent?.authors ?? [], isbn13: e.isbn13, _origin: `${STAGING}/${f}:${row._row}` };
      const problems = [];
      if (!parent) problems.push(`translationOf "${row.translationOf}" is not a published work`);
      if (!LANGS.has(e.language)) problems.push(`unknown language code "${e.language}"`);
      if (!tax.formats[e.format]) problems.push(`bad format "${e.format}"`);
      if (e.isbn13 && !isbn13Valid(e.isbn13)) problems.push(`ISBN-13 checksum fails: ${e.isbn13}`);
      if (!e.isbn13) problems.push('translated edition needs an ISBN-13 (or ASIN) before it can be staged');
      if (e.isbn13 && [...works.values()].some((x) => x.editions.some((y) => y.isbn13 === e.isbn13))) problems.push('ISBN already published');
      const dupEd = parent?.editions.find((x) => x.language === e.language && x.format === e.format);
      if (!problems.length && dupEd) queue(rec, 'dedup', [`work already has a published ${e.language} ${e.format} edition (${dupEd.isbn13 ?? dupEd.asin ?? 'no id'}); this is a possible duplicate or a new printing to review`], 'duplicate');
      else if (problems.length) queue(rec, 'validate', problems); else stagedEditions.push({ workId: row.translationOf, edition: e, status: 'staged-needs-verification' });
      continue;
    }
    const w = {
      title: row.title, subtitle: row.subtitle, authors: row.authors.split(';').map((a) => a.trim()).filter(Boolean),
      subjects: row.subjects.split(';').filter(Boolean), tradition: row.tradition ? [row.tradition] : [], level: row.level,
      editions: [{ format: row.format, language: row.language, publisher: row.publisher, year: row.year ? +row.year : null, isbn13: row.isbn13 || null }],
      sources: [{ label: 'Editorial shortlist (candidate; details unverified)', url: `staging/${f}#row${row._row}`, accessed: TODAY, supports: 'candidate only' }],
      _origin: `staging/${f}:${row._row}`,
    };
    const problems = validateWork(w, { requireSources: false, allowNoId: true }).filter((p) => !(p.includes('unknown tradition') && PSV_EXTRA_TRADS.has(w.tradition[0])));
    if (problems.length) { queue(w, 'validate', problems); continue; }
    const key = `${normTitle(w.title)}|${slugify(w.authors[0])}`;
    const isbn = w.editions[0].isbn13;
    if (works.has(key) || (isbn && isbnIndex.has(isbn))) {
      // same title+author already published: either a duplicate row or an extra edition to review
      const pub = works.get(key) ?? works.get(isbnIndex.get(isbn));
      const known = pub.editions.some((e) => e.isbn13 === isbn);
      queue(w, 'dedup', [known ? `already published as "${pub.title}"` : `possible additional edition of published "${pub.title}" (ISBN ${isbn} not in its edition list)`], 'duplicate');
      continue;
    }
    const dupStaged = (isbn && seenStaged.get(isbn)) || seenStaged.get(key);
    if (dupStaged) { queue(w, 'dedup', [`duplicate of staged row ${dupStaged}`], 'duplicate'); continue; }
    seenStaged.set(key, w._origin); if (isbn) seenStaged.set(isbn, w._origin);
    w.status = isbn ? 'staged-needs-verification' : 'staged-missing-isbn';
    w.editions[0].isbn10 = isbn ? isbn13to10(isbn) : null;
    if (!isbn) queue(w, 'identifiers', ['no ISBN-13 supplied; cannot be published until an ISBN/ASIN is confirmed from a source'], 'warning');
    staged.push(w);
  }
}

// ---------- finalise ----------
const finalWorks = [...works.values()].map((w) => {
  const slug = w.slug ?? slugify(w.title); // an explicit slug keeps an existing URL stable when a title is corrected
  const { _origin, ...rest } = w;
  return { id: slug, slug, ...rest, authorIds: w.authors.map(slugify) };
});
// slug uniqueness
const seen = new Set();
for (const w of finalWorks) { if (seen.has(w.slug)) { w.slug = w.id = `${w.slug}-${slugify(w.authors[0])}`; } seen.add(w.slug); }

const authorMap = new Map();
for (const w of finalWorks) w.authors.forEach((name, i) => {
  const id = slugify(name);
  if (!authorMap.has(id)) authorMap.set(id, { id, name, sortName: sortName(name), bio: bios[name] ?? null, workIds: [] });
  authorMap.get(id).workIds.push(w.id);
});
function sortName(n) {
  if (/(press|library)$/i.test(n)) return n; // institutions keep their name
  const parts = n.replace(/\(.*\)/, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0]; // single names (Plato, Seneca)
  const last = parts.pop();
  return `${last}, ${parts.join(' ')}`.trim();
}
const authors = [...authorMap.values()].sort((a, b) => a.sortName.localeCompare(b.sortName, 'en'));

// ---------- edition leads (reported, unverified; never published) ----------
const leadsFile = path.join(ROOT, STAGING, 'edition-leads.json');
const leads = [];
if (fs.existsSync(leadsFile)) for (const l of JSON.parse(fs.readFileSync(leadsFile, 'utf8')).leads) {
  const probs = [];
  if (!finalWorks.some((w) => w.id === l.workId)) probs.push(`lead references unknown work "${l.workId}"`);
  if (!LANGS.has(l.language)) probs.push(`unknown language "${l.language}"`);
  if (!l.source?.url || !l.source?.accessed) probs.push('lead has no dated source');
  if (probs.length) queue({ title: `lead: ${l.workId}`, authors: [], _origin: leadsFile }, 'leads', probs); else leads.push({ ...l, status: 'reported-unverified' });
}

const catalogue = { generated: TODAY, works: finalWorks, authors };
fs.writeFileSync(path.join(ROOT, DATA, 'catalogue.json'), JSON.stringify(catalogue, null, 1));
fs.writeFileSync(path.join(ROOT, DATA, 'staged-editions.json'), JSON.stringify({ generated: TODAY, note: 'Candidate editions (translations/other formats) of published works. NOT published.', editions: stagedEditions }, null, 1));
fs.writeFileSync(path.join(ROOT, DATA, 'edition-leads.json'), JSON.stringify({ generated: TODAY, note: 'Editions reported by a source but not verified. NOT published and NOT counted as stocked.', leads }, null, 1));
fs.writeFileSync(path.join(ROOT, DATA, 'staged.json'), JSON.stringify({ generated: TODAY, note: 'Valid candidates. NOT published: ISBNs/titles are unverified until corroborated by a dated source.', works: staged.map(({ _origin, ...r }) => ({ ...r, origin: _origin })) }, null, 1));
fs.writeFileSync(path.join(ROOT, DATA, 'error-queue.json'), JSON.stringify({ generated: TODAY, items: errors }, null, 1));

const outsidePub = finalWorks.filter((w) => !w.press);
const byLang = {};
for (const w of finalWorks) for (const e of w.editions) for (const code of [e.language, ...(e.alsoLanguages ?? [])]) {
  const b = (byLang[code] ??= { editions: 0, works: new Set() });
  b.editions++; b.works.add(w.id);
}
const publishedByLanguage = Object.fromEntries(Object.entries(byLang).sort().map(([k, v]) => [k, { works: v.works.size, editions: v.editions }]));
const leadsByLanguage = leads.reduce((a, l) => ((a[l.language] = (a[l.language] ?? 0) + 1), a), {});
const report = {
  generated: TODAY,
  input: { verifiedRecords: nVerifiedIn, batchRecords: nBatchIn, candidateRows: nPsv },
  publishedByProvenance: batchTally,
  published: { works: finalWorks.length, editions: finalWorks.reduce((n, w) => n + w.editions.length, 0), outsideWorks: outsidePub.length, fmpWorks: finalWorks.length - outsidePub.length, authors: authors.length },
  publishedByLanguage,
  languagesRegistered: langReg.languages.length,
  languagesWithVerifiedEditions: Object.keys(publishedByLanguage).length,
  stagedEditions: stagedEditions.length,
  editionLeads: { total: leads.length, byLanguage: leadsByLanguage, note: 'reported but unverified; not published, not counted as stocked' },
  staged: { works: staged.length, withIsbn: staged.filter((s) => s.editions[0].isbn13).length, missingIsbn: staged.filter((s) => !s.editions[0].isbn13).length },
  errorQueue: { total: errors.length, byStage: errors.reduce((a, e) => ((a[e.stage] = (a[e.stage] ?? 0) + 1), a), {}), bySeverity: errors.reduce((a, e) => ((a[e.severity] = (a[e.severity] ?? 0) + 1), a), {}) },
};
fs.writeFileSync(path.join(ROOT, DATA, 'import-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
