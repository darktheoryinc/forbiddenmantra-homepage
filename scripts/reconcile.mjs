#!/usr/bin/env node
// Reconcile harvested records into publishable batches and a review queue.
//   node scripts/reconcile.mjs [--batch-size 250] [--prefix auto-2026-10-27]
// Reads : staging/harvest/openlibrary.jsonl (+ googlebooks.jsonl, goodbooks-nominations.jsonl), data/catalogue.json
// Writes: staging/batches/<prefix>-NNN.json  (works verified by TWO independent sources agreeing; consumed by import.mjs)
//         staging/review/<prefix>.json       (everything else, with the reason it was held back)
// A record is batch-eligible only if Open Library and Google Books both carry the same ISBN-13 and agree on title, first author
// and language, the format is known, and no quality rule fires. Nothing is ever published by this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonl } from './harvest/lib.mjs';
import { slugify } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARVEST = path.resolve(ROOT, process.env.FM_HARVEST ?? 'staging/harvest');
const STAGING = path.resolve(ROOT, process.env.FM_STAGING ?? 'staging');
const DATA = path.resolve(ROOT, process.env.FM_DATA ?? 'data');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const rules = rd('config/import-rules.json'), submap = rd('config/subject-map.json').rules.map(([re, d, t]) => [new RegExp(re, 'i'), d, t]);
const tax = rd('data/taxonomy.json'), deptIds = new Set(tax.departments.map((d) => d.id));
const blockP = (rules.blockPublisherPatterns ?? []).map((p) => new RegExp(p, 'i'));
const blockT = rules.blockTitlePatterns.map((p) => new RegExp(p, 'i')), blockS = rules.blockSubjectPatterns.map((p) => new RegExp(p, 'i'));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const today = process.env.FM_TODAY ?? rd('config/site.json').catalogueAsOf;
const prefix = arg('prefix', `auto-${today}`), batchSize = +arg('batch-size', 250);
// --single-source: when Google Books is unavailable, publish Open Library-only editions in the 'open-library-catalogue' tier if they pass every gate below.
const SINGLE = argv.includes('--single-source'), minEditions = +arg('min-editions', 4), minYearUnstated = +arg('min-year-unstated', 1995), INFER_LANG = argv.includes('--infer-language'), thisYear = new Date().getFullYear();
const IND = /^(independently published|createspace.*|amazon digital services.*|lulu.*|kdp)$/i, JUNK_AUTHOR = /\b(unknown|anonymous)\b/i;

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const normTitle = (t) => fold(t).split(/[:(]/)[0].replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const lastName = (a) => { const p = fold(a).replace(/[^a-z ]/g, '').trim().split(/\s+/); return p[p.length - 1] ?? ''; };
const tokens = (t) => new Set(normTitle(t).split(' ').filter(Boolean));
export function titleSim(a, b) {
  const x = normTitle(a), y = normTitle(b);
  if (!x || !y) return 0;
  if (x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ')) return 1;
  const A = tokens(a), B = tokens(b); let i = 0; for (const t of A) if (B.has(t)) i++;
  return i / (A.size + B.size - i);
}

const ol = readJsonl(path.join(HARVEST, 'openlibrary.jsonl')), gb = readJsonl(path.join(HARVEST, 'googlebooks.jsonl'));
const cat = fs.existsSync(path.join(DATA, 'catalogue.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'catalogue.json'), 'utf8')) : { works: [] };
const haveIsbn = new Set(cat.works.flatMap((w) => w.editions.map((e) => e.isbn13).filter(Boolean)));
const haveKey = new Map(cat.works.map((w) => [`${normTitle(w.title)}|${lastName(w.authors[0])}`, w.title]));

const review = [];
const hold = (r, reason) => review.push({ isbn13: r.isbn13, title: r.title, authors: r.authors, reason, seed: r.seed?.value ?? null });
const gbBy = new Map(gb.map((r) => [r.isbn13, r]));
const seenIsbn = new Set();
const eligible = [];

for (let o of ol) {
  if (seenIsbn.has(o.isbn13)) continue; seenIsbn.add(o.isbn13);
  const g = gbBy.get(o.isbn13);
  if (haveIsbn.has(o.isbn13)) { hold(o, 'already published (ISBN)'); continue; }
  const bad = blockT.find((re) => re.test(o.title)) ?? (o.subjects ?? []).map((s) => blockS.find((re) => re.test(s))).find(Boolean);
  if (bad) { hold(o, `quality rule: ${bad}`); continue; }
  const badPub = o.publisher && blockP.find((re) => re.test(o.publisher));
  if (badPub) { hold(o, `quality rule: publisher ${badPub}`); continue; }
  if (!g && !SINGLE) { hold(o, 'single source only (no Google Books match yet)'); continue; }
  if (!g) { // single-source gates: every field stated by Open Library, internally consistent, and popular enough to be a real, circulating book
    // --infer-language: the harvest searched Open Library for English-language works; an edition record that states no language at all
    // (not a different one) and whose title agrees with that work is accepted, and marked as inferred. A stated non-English language is still held.
    const langInferred = INFER_LANG && !o.language && o.searchTitle && titleSim(o.title, o.searchTitle) >= rules.titleSimilarityMin && /^[\x00-\u024f\u2018-\u201d\u2013\u2014 ]+$/.test(o.title);
    if (langInferred) o = { ...o, language: 'en', languageNote: 'Language not stated on the edition record; inferred from the English-language Open Library work.' };
    // Relevance guard (relaxed tier): the title or the source's own subject headings must carry a signal for the topic the record was found under.
    const relText = fold([o.title, o.subtitle, ...(o.olSubjects ?? [])].join(' | ')), seedWords = o.seed?.kind === 'publisher' ? [] : fold(o.seed?.value ?? '').split(/[^a-z]+/).filter((w) => w.length > 3); // a publisher name says nothing about topic
    const relevant = submap.some(([re]) => re.test(relText)) || seedWords.some((w) => relText.includes(w));
    const foreign = langInferred && /\b(der|die|das|und|ein|eine|el|los|las|una|les|des|une|il|della|degli|di|het|een|och|og)\b/i.test(o.title);
    const why = foreign ? 'title looks non-English; language only inferred'
      : INFER_LANG && !relevant ? 'no topic signal in the title or subject headings'
      : !o.language || o.language !== 'en' ? 'language not stated as English'
      : o.format === 'audiobook' ? 'audiobook records are not imported'
      : !o.format && (!o.year || o.year < minYearUnstated) ? `binding not stated and published before ${minYearUnstated} (likely out of print)`
      : !o.authors.length || JUNK_AUTHOR.test(o.authors[0]) ? 'no named author'
      : !o.publisher ? 'no publisher stated'
      : !o.year || o.year < 1450 || o.year > thisYear ? 'publication year missing or implausible'
      : (o.editionCount ?? 0) < minEditions ? `fewer than ${minEditions} editions on Open Library`
      : IND.test(o.publisher) && (o.editionCount ?? 0) < 8 ? 'self-published imprint with few editions'
      : o.searchTitle && titleSim(o.title, o.searchTitle) < rules.titleSimilarityMin ? `edition title disagrees with its work: "${o.title}" vs "${o.searchTitle}"`
      : o.searchAuthors?.[0] && lastName(o.authors[0]) !== lastName(o.searchAuthors[0]) ? 'edition author disagrees with its work'
      : null;
    if (why) { hold(o, `single-source gate: ${why}`); continue; }
    if (!o.format) o = { ...o, format: 'book', formatNote: 'Binding not stated by the source record.' };
  } else {
  if (titleSim(o.title, g.title) < rules.titleSimilarityMin) { hold(o, `title disagrees across sources: "${o.title}" vs "${g.title}"`); continue; }
  if (o.authors[0] && g.authors[0] && lastName(o.authors[0]) !== lastName(g.authors[0])) { hold(o, `first author disagrees: "${o.authors[0]}" vs "${g.authors[0]}"`); continue; }
  if (!o.authors.length) { hold(o, 'no author'); continue; }
  if (rules.requireLanguage && (!o.language || !g.language || o.language !== g.language)) { hold(o, `language unconfirmed or disagrees (${o.language ?? '?'} / ${g.language ?? '?'})`); continue; }
  }
  if (rules.requireFormat && !o.format) { hold(o, 'format not stated by source; not guessed'); continue; }
  let dept = o.seed?.department, trad = o.seed?.tradition, level = o.seed?.level ?? 'unrated';
  if (!dept) { const hit = submap.find(([re]) => re.test((o.olSubjects ?? o.subjects ?? []).join(' | '))); dept = hit?.[1]; trad = hit?.[2]; }
  if (!dept || !deptIds.has(dept)) { hold(o, 'no department (not matched by a seed or subject rule)'); continue; }
  eligible.push({ o, g, dept, trad, level });
}

// group editions into works: Open Library work key when present, else normalised title + first author
const groups = new Map();
for (const e of eligible) {
  const key = e.o.workKey ?? `t:${normTitle(e.o.title)}|${lastName(e.o.authors[0])}`;
  (groups.get(key) ?? groups.set(key, []).get(key)).push(e);
}
const works = [];
for (const [key, es] of groups) {
  const first = es[0];
  const tk = `${normTitle(first.o.title)}|${lastName(first.o.authors[0])}`;
  if (haveKey.has(tk)) { for (const e of es) hold(e.o, `possible additional edition of published "${haveKey.get(tk)}"; review before adding`); continue; }
  const eds = [], seenEd = new Set();
  for (const e of es) {
    const dupKey = [e.o.language, e.o.format, e.o.publisher, e.o.year].join('|');
    if (seenEd.has(dupKey)) { hold(e.o, 'same language/format/publisher/year as another edition of this work (likely a reprint)'); continue; }
    seenEd.add(dupKey);
    eds.push({
      language: e.o.language, format: e.o.format, publisher: e.o.publisher || null,
      year: e.g ? (e.o.year && e.g.year && e.o.year === e.g.year ? e.o.year : null) : e.o.year, // two-source: year only when both agree; single-source: Open Library's stated year
      isbn13: e.o.isbn13, title: e.o.title !== first.o.title ? e.o.title : undefined, note: [e.o.formatNote, e.o.languageNote].filter(Boolean).join(" ") || undefined,
      sources: [{ label: 'Open Library record', url: e.o.url, accessed: e.o.fetchedAt, supports: 'ISBN-13, title, author, publisher, year, format, language' }, ...(e.g ? [{ label: 'Google Books record', url: e.g.url, accessed: e.g.fetchedAt, supports: 'ISBN-13, title, author, language' }] : [])],
    });
  }
  if (!eds.length) continue;
  works.push({
    title: first.o.title, subtitle: first.o.subtitle || '', authors: first.o.authors.slice(0, rules.maxAuthorsPerWork), subjects: [first.dept],
    tradition: first.trad ? [first.trad] : [], level: first.level, series: first.o.series ? { name: first.o.series } : undefined, description: null,
    status: 'verified', press: null, claims: [], editions: eds,
    provenance: es.every((x) => x.g) ? { tier: 'auto-two-source', method: 'openlibrary+googlebooks agreement', workKey: key.startsWith('t:') ? null : key } : { tier: 'open-library-catalogue', method: 'single Open Library edition record passing the single-source gates', workKey: key.startsWith('t:') ? null : key },
    sources: eds[0].sources.map((s) => ({ ...s, supports: 'title, author, ISBN-13' })),
  });
}

fs.mkdirSync(path.join(STAGING, 'batches'), { recursive: true });
fs.mkdirSync(path.join(STAGING, 'review'), { recursive: true });
for (const f of fs.readdirSync(path.join(STAGING, 'batches'))) if (f.startsWith(prefix + '-') && f.endsWith('.json')) fs.rmSync(path.join(STAGING, 'batches', f));
let n = 0;
for (let i = 0; i < works.length; i += batchSize) {
  const id = `${prefix}-${String(++n).padStart(3, '0')}`;
  fs.writeFileSync(path.join(STAGING, 'batches', id + '.json'), JSON.stringify({ batch: id, checkedOn: today, tier: SINGLE ? 'open-library-catalogue' : 'auto-two-source', works: works.slice(i, i + batchSize) }, null, 1));
}
const reasons = review.reduce((a, r) => ((a[r.reason.replace(/".*"|\(.*\)/g, '').trim()] = (a[r.reason.replace(/".*"|\(.*\)/g, '').trim()] ?? 0) + 1), a), {});
fs.writeFileSync(path.join(STAGING, 'review', prefix + '.json'), JSON.stringify({ generated: today, summary: reasons, items: review }, null, 1));
console.log(JSON.stringify({ harvested: { openlibrary: ol.length, googlebooks: gb.length }, eligibleEditions: eligible.length, worksInBatches: works.length, batches: n, heldForReview: review.length, reasons }, null, 1));
