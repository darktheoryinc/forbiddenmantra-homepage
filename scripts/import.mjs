#!/usr/bin/env node
// Catalogue import pipeline.
//   node scripts/import.mjs
// Inputs : staging/verified/*.json   hand-verified works with per-record provenance (can be published)
//          staging/*.psv             bulk candidate rows (never published by this script; staged only)
// Outputs: data/catalogue.json       published works + authors (consumed by the site build)
//          data/staged.json          valid but not yet verified candidates (unpublished)
//          data/error-queue.json     records rejected with reasons (fix the source, re-run)
//          data/import-report.json   counts for the run
// Rules  : a record is published only if it is in staging/verified, passes validation, and carries >=1 dated source.
//          Anything uncertain stays unpublished.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const tax = rd('data/taxonomy.json');
const bios = rd('data/author-bios.json');
const TODAY = rd('config/site.json').catalogueAsOf;

const deptIds = new Set(tax.departments.map((d) => d.id));
const tradIds = new Set(tax.traditions.map((t) => t.id));
const PSV_EXTRA_TRADS = new Set(['perennial']);

import { slugify } from './lib.mjs';
const normTitle = (t) => slugify(t.replace(/^(the|a|an)\s+/i, ''));

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
    if (!tax.languages[e.language]) r.push(`bad language "${e.language}"`);
    if (e.isbn13 && !isbn13Valid(e.isbn13)) r.push(`ISBN-13 checksum fails: ${e.isbn13}`);
    if (!allowNoId && !e.isbn13 && !e.asin && !(e.retailers?.length)) r.push(`edition (${e.format}) has no identifier (ISBN/ASIN)`);
  }
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

const verifiedDir = path.join(ROOT, 'staging/verified');
let nVerifiedIn = 0;
for (const f of fs.readdirSync(verifiedDir).filter((x) => x.endsWith('.json')).sort()) {
  const doc = rd(`staging/verified/${f}`);
  for (const raw of doc.works) {
    nVerifiedIn++;
    const w = { ...raw, _origin: `staging/verified/${f}` };
    const ownerListed = w.status === 'owner-listed';
    const problems = validateWork(w, { requireSources: true, allowNoId: ownerListed });
    if (problems.length) { queue(w, 'validate', problems); continue; }
    if (ownerListed) for (const e of w.editions) if (!e.isbn13 && !e.asin) queue({ ...w, isbn13: null }, 'identifiers', [`owner-listed ${e.format}${e.language !== 'en' ? ' (' + e.language + ')' : ''} edition has no ASIN/ISBN yet; retailer link not verified`], 'warning');
    w.editions = w.editions.map((e, i) => ({ ...e, id: `${e.isbn13 ?? e.asin ?? `ed${i + 1}`}`, isbn10: e.isbn13 ? isbn13to10(e.isbn13) : null }));
    addWork(w, w._origin);
  }
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
const seenStaged = new Map();
let nPsv = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'staging')).filter((x) => x.endsWith('.psv')).sort()) {
  for (const row of parsePSV(fs.readFileSync(path.join(ROOT, 'staging', f), 'utf8'))) {
    nPsv++;
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
  const slug = slugify(w.title);
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
  if (/press$/i.test(n)) return n;
  const parts = n.replace(/\(.*\)/, '').trim().split(/\s+/);
  const last = parts.pop();
  return `${last}, ${parts.join(' ')}`.trim();
}
const authors = [...authorMap.values()].sort((a, b) => a.sortName.localeCompare(b.sortName, 'en'));

const catalogue = { generated: TODAY, works: finalWorks, authors };
fs.writeFileSync(path.join(ROOT, 'data/catalogue.json'), JSON.stringify(catalogue, null, 1));
fs.writeFileSync(path.join(ROOT, 'data/staged.json'), JSON.stringify({ generated: TODAY, note: 'Valid candidates. NOT published: ISBNs/titles are unverified until corroborated by a dated source.', works: staged.map(({ _origin, ...r }) => ({ ...r, origin: _origin })) }, null, 1));
fs.writeFileSync(path.join(ROOT, 'data/error-queue.json'), JSON.stringify({ generated: TODAY, items: errors }, null, 1));

const outsidePub = finalWorks.filter((w) => !w.press);
const report = {
  generated: TODAY,
  input: { verifiedRecords: nVerifiedIn, candidateRows: nPsv },
  published: { works: finalWorks.length, editions: finalWorks.reduce((n, w) => n + w.editions.length, 0), outsideWorks: outsidePub.length, fmpWorks: finalWorks.length - outsidePub.length, authors: authors.length },
  staged: { works: staged.length, withIsbn: staged.filter((s) => s.editions[0].isbn13).length, missingIsbn: staged.filter((s) => !s.editions[0].isbn13).length },
  errorQueue: { total: errors.length, byStage: errors.reduce((a, e) => ((a[e.stage] = (a[e.stage] ?? 0) + 1), a), {}), bySeverity: errors.reduce((a, e) => ((a[e.severity] = (a[e.severity] ?? 0) + 1), a), {}) },
};
fs.writeFileSync(path.join(ROOT, 'data/import-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
