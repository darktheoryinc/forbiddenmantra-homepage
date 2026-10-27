#!/usr/bin/env node
// Blog-to-book connections.
//   node scripts/import-articles.mjs [staging/articles-wix-<date>.psv]
// Input : a pipe-separated export of published blog posts (slug|published|title), plus data/article-links.json (keyword rules).
// Output: data/articles.json (canonical articles with topics/works), data/articles-report.json (duplicates, unmatched, flags).
// Rules : posts with an identical normalised title are duplicates; the newest is canonical and the rest are listed in the report and
//         never shown. Rules must reference published works and known departments. The blog itself is never modified.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const DATA = process.env.FM_DATA ?? 'data';
const input = process.argv[2] ?? fs.readdirSync(path.join(ROOT, 'staging')).filter((f) => /^articles-.*\.psv$/.test(f)).sort().pop();
const BASE = 'https://www.forbiddenmantra.com/post/';
const cat = rd(`${DATA}/catalogue.json`), tax = rd('data/taxonomy.json'), rules = JSON.parse(fs.readFileSync(path.resolve(process.env.FM_ARTICLE_RULES ?? path.join(ROOT, 'data/article-links.json')), 'utf8')).rules;
const works = new Set(cat.works.map((w) => w.id)), depts = new Set(tax.departments.map((d) => d.id));

const errors = [];
for (const r of rules) {
  for (const w of r.works ?? []) if (!works.has(w)) errors.push(`rule ${r.id}: unknown work "${w}"`);
  for (const t of r.topics ?? []) if (!depts.has(t)) errors.push(`rule ${r.id}: unknown topic "${t}"`);
  if (!r.any?.length) errors.push(`rule ${r.id}: no match terms`);
}
const text = fs.readFileSync(path.join(ROOT, input.startsWith('staging/') ? input : `staging/${input}`), 'utf8').trim().split('\n');
const rows = text.slice(1).map((l, i) => { const [slug, published, ...t] = l.split('|'); return { slug, published, title: t.join('|'), _row: i + 2 }; });
for (const r of rows) {
  if (!r.slug || !/^\d{4}-\d{2}-\d{2}$/.test(r.published) || !r.title) errors.push(`row ${r._row}: malformed`);
}
if (new Set(rows.map((r) => r.slug)).size !== rows.length) errors.push('duplicate slugs in input');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

const norm = (t) => t.toLowerCase().replace(/^title:\s*/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const groups = new Map();
for (const r of rows) { const k = norm(r.title); (groups.get(k) ?? groups.set(k, []).get(k)).push(r); }
const articles = [], duplicates = [], unmatched = [], flags = [];
for (const g of groups.values()) {
  g.sort((a, b) => b.published.localeCompare(a.published) || a.slug.length - b.slug.length);
  const [canon, ...dups] = g;
  for (const d of dups) duplicates.push({ slug: d.slug, title: d.title, duplicateOf: canon.slug, published: d.published });
  const title = canon.title.replace(/^Title:\s*/, '');
  if (/^Title:/.test(canon.title)) flags.push({ slug: canon.slug, issue: 'title begins with "Title:" (scaffolding text); shown without it' });
  const hay = canon.title.toLowerCase();
  const hit = rules.filter((r) => r.any.some((a) => hay.includes(a.toLowerCase())));
  const a = {
    slug: canon.slug, url: BASE + encodeURIComponent(canon.slug), title, published: canon.published,
    lang: /[ऀ-ॿ]/.test(canon.title) ? 'hi' : 'en',
    works: [...new Set(hit.flatMap((r) => r.works ?? []))], topics: [...new Set(hit.flatMap((r) => r.topics ?? []))],
    press: hit.some((r) => r.press), rules: hit.map((r) => r.id),
    duplicateCount: dups.length,
  };
  if (!a.works.length && !a.topics.length && !a.press) unmatched.push({ slug: a.slug, title });
  articles.push(a);
}
articles.sort((x, y) => y.published.localeCompare(x.published) || x.title.localeCompare(y.title));
const report = {
  source: input, posts: rows.length, uniqueArticles: articles.length, duplicatePosts: duplicates.length,
  hindi: articles.filter((a) => a.lang === 'hi').length, linkedToWorks: articles.filter((a) => a.works.length).length, linkedToTopics: articles.filter((a) => a.topics.length).length, pressOnly: articles.filter((a) => a.press && !a.works.length && !a.topics.length).length,
  unmatched, flags, duplicates,
  worksWithArticles: Object.fromEntries([...new Set(articles.flatMap((a) => a.works))].sort().map((w) => [w, articles.filter((a) => a.works.includes(w)).length])),
  note: 'Posts read from the Wix blog (read-only API) on 2026-10-27; transcription verified against the live list by checksum. Connections are keyword-rule suggestions, not editorial review.',
};
fs.writeFileSync(path.join(ROOT, DATA, 'articles.json'), JSON.stringify({ source: input, base: BASE, articles }, null, 1));
fs.writeFileSync(path.join(ROOT, DATA, 'articles-report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, duplicates: `${duplicates.length} listed in data/articles-report.json`, unmatched: unmatched.length }, null, 1));
