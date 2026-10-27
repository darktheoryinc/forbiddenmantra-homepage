#!/usr/bin/env node
// SYNTHETIC catalogue for load testing only: node scripts/synth-catalogue.mjs --n 25000 --out test/fixtures/perf/data
// Copies the real data directory, then appends N invented works (pseudo-words, valid-checksum 979/978 ISBNs that identify no real book, one
// source URL under example.invalid). Output is gitignored (test/fixtures) and must never be published. Deterministic for a given --n.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), arg = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const N = +arg('n', 25000), OUT = path.resolve(ROOT, arg('out', 'test/fixtures/perf/data'));
fs.rmSync(OUT, { recursive: true, force: true }); fs.cpSync(path.join(ROOT, 'data'), OUT, { recursive: true });
const cat = JSON.parse(fs.readFileSync(path.join(OUT, 'catalogue.json'), 'utf8')), tax = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/taxonomy.json'), 'utf8'));
let seed = 12345; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const syl = ['ka', 'lo', 'mi', 'ra', 'ven', 'tor', 'sha', 'lun', 'dre', 'ath', 'el', 'gor', 'ni', 'su', 'ol', 'ber', 'ia', 'zan', 'mor', 'fei', 'qua', 'hel', 'ust', 'pra', 'ion'];
const word = (min = 2, max = 4) => { let w = ''; for (let i = 0, n = min + Math.floor(rnd() * (max - min + 1)); i < n; i++) w += pick(syl); return w[0].toUpperCase() + w.slice(1); };
const lastNames = Array.from({ length: Math.round(N * 0.45) }, () => word(2, 3));
const firstNames = Array.from({ length: 400 }, () => word(1, 2));
const authorPool = Array.from({ length: Math.round(N * 0.5) }, () => `${pick(firstNames)} ${pick(lastNames)}`);
const seriesNames = Array.from({ length: Math.round(N * 0.03) }, () => `The ${word()} ${pick(['Cycle', 'Chronicle', 'Saga', 'Codex', 'Trilogy'])}`);
const deptW = tax.departments.map((d) => [d.id, ['fantasy', 'epic-fantasy', 'urban-fantasy', 'horror', 'speculative-fiction', 'personal-growth', 'mythology', 'philosophy', 'comparative-religion'].includes(d.id) ? 6 : 1]);
const tot = deptW.reduce((n, [, w]) => n + w, 0); const pickDept = () => { let r = rnd() * tot; for (const [d, w] of deptW) if ((r -= w) <= 0) return d; return deptW[0][0]; };
const trads = tax.traditions.map((t) => t.id), formats = ['paperback', 'hardcover', 'ebook', 'audiobook'];
const chk13 = (c12) => { let s = 0; for (let i = 0; i < 12; i++) s += +c12[i] * (i % 2 ? 3 : 1); return c12 + ((10 - (s % 10)) % 10); };
const to10 = (s) => { const c = s.slice(3, 12); let t = 0; for (let i = 0; i < 9; i++) t += +c[i] * (10 - i); const k = (11 - (t % 11)) % 11; return c + (k === 10 ? 'X' : k); };
const used = new Set(cat.works.flatMap((w) => w.editions.map((e) => e.isbn13).filter(Boolean)));
const isbn = (i) => { for (let k = 0; ; k++) { const c = chk13((rnd() < 0.5 ? '978' : '979') + String(Math.floor(rnd() * 1e9)).padStart(9, '0')); if (!used.has(c)) { used.add(c); return c; } } };
const slugs = new Set(cat.works.map((w) => w.slug)); const authorMap = new Map(cat.authors.map((a) => [a.id, a]));
for (let i = 0; i < N; i++) {
  const title = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => word()).join(' '); let slug = slugify(title); if (slugs.has(slug)) slug += '-' + i; slugs.add(slug);
  const aName = authorPool[Math.floor(authorPool.length * Math.pow(rnd(), 2.2))], d = pickDept(), nEd = 1 + (rnd() < 0.35 ? 1 : 0) + (rnd() < 0.1 ? 1 : 0), lang = rnd() < 0.03 ? 'es' : 'en';
  const editions = Array.from({ length: nEd }, (_, k) => { const i13 = isbn(); return { language: lang, format: formats[Math.min(3, k + (rnd() < 0.2 ? 1 : 0))], publisher: `${word()} Press`, year: 1980 + Math.floor(rnd() * 45), isbn13: i13, id: i13, isbn10: i13.startsWith('978') ? to10(i13) : null, sources: [{ label: 'SYNTHETIC', url: `https://a.example.invalid/${i13}`, accessed: '2026-10-27', supports: 'synthetic' }, { label: 'SYNTHETIC', url: `https://b.example.invalid/${i13}`, accessed: '2026-10-27', supports: 'synthetic' }] }; });
  const series = rnd() < 0.12 ? { name: pick(seriesNames), number: 1 + Math.floor(rnd() * 8) } : undefined;
  const w = { id: slug, slug, title, subtitle: rnd() < 0.3 ? `${word()} ${word()}` : '', authors: [aName], subjects: rnd() < 0.3 ? [d, pickDept()].filter((x, k, a) => a.indexOf(x) === k) : [d], tradition: [pick(trads)], level: 'unrated', press: null, status: 'verified', description: null, claims: [], editions, series, sources: editions[0].sources, provenance: { tier: 'auto-two-source', synthetic: true }, authorIds: [slugify(aName)] };
  cat.works.push(w);
  const id = slugify(aName); if (!authorMap.has(id)) { const a = { id, name: aName, sortName: `${aName.split(' ').pop()}, ${aName.split(' ')[0]}`, bio: null, workIds: [] }; authorMap.set(id, a); cat.authors.push(a); } authorMap.get(id).workIds.push(slug);
}
cat.authors.sort((a, b) => a.sortName.localeCompare(b.sortName, 'en'));
fs.writeFileSync(path.join(OUT, 'catalogue.json'), JSON.stringify(cat));
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), works: cat.works.length, authors: cat.authors.length, editions: cat.works.reduce((n, w) => n + w.editions.length, 0), note: 'SYNTHETIC: for load tests only' }));
