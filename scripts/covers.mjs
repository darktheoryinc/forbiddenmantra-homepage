#!/usr/bin/env node
// Cover pipeline. Covers are copyrighted artwork, so a cover is accepted only when the exact file was supplied or licensed and that is recorded.
//   node scripts/covers.mjs audit                         write data/cover-audit.json, data/cover-audit.csv and docs/COVER-AUDIT.md
//   node scripts/covers.mjs check                         validate data/covers.json against the catalogue and files
//   node scripts/covers.mjs add --work SLUG --edition ID --file PATH --source-type TYPE --source "WHERE IT CAME FROM" --rights "BASIS FOR USE" --confirmed-by "NAME" [--isbn13 N] [--match-evidence "..."] [--confirmed-on YYYY-MM-DD]
// Source types: owner-supplied | publisher-permission | licensed-feed | public-domain. (Open Library, Google Books, Amazon and scraped pages are NOT accepted without a written licence: use licensed-feed and put the licence reference in --rights.)
// Env overrides for tests: FM_DATA, FM_COVERS_MANIFEST, FM_COVERS_SRC, FM_COVERS_OPT.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (rel) => path.join(ROOT, rel);
export const SOURCE_TYPES = ['owner-supplied', 'publisher-permission', 'licensed-feed', 'public-domain'];
export const paths = () => ({
  manifest: process.env.FM_COVERS_MANIFEST ? path.resolve(process.env.FM_COVERS_MANIFEST) : process.env.FM_DATA ? path.join(path.resolve(ROOT, process.env.FM_DATA), 'covers.json') : P('data/covers.json'),
  src: process.env.FM_COVERS_SRC ? path.resolve(process.env.FM_COVERS_SRC) : P('assets-src/covers'),
  opt: process.env.FM_COVERS_OPT ? path.resolve(process.env.FM_COVERS_OPT) : P('assets-src/covers-opt'),
  catalogue: path.join(process.env.FM_DATA ? path.resolve(ROOT, process.env.FM_DATA) : P('data'), 'catalogue.json'),
});
export const coverKey = (slug, editionId) => `${slug}__${editionId}`;
const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// Validate every manifest entry against the catalogue. Returns { errors, entries } where entries are safe to publish.
export function loadCovers({ allowFixture = !!process.env.FM_COVERS_ALLOW_FIXTURE } = {}) {
  const p = paths(); const errors = [], entries = [];
  if (!fs.existsSync(p.manifest)) return { errors, entries };
  const m = readJSON(p.manifest), cat = readJSON(p.catalogue), seen = new Set();
  const works = new Map(cat.works.map((w) => [w.slug, w]));
  for (const c of m.covers ?? []) {
    const id = `${c.work}/${c.edition}`, err = (t) => errors.push(`${id}: ${t}`);
    const w = works.get(c.work), e = w?.editions.find((x) => x.id === c.edition);
    if (!w || !e) { err('no such work/edition in the catalogue'); continue; }
    if (seen.has(id)) err('duplicate entry'); seen.add(id);
    if (c.fixture && !allowFixture) { err('fixture cover in a real build'); continue; }
    if (!SOURCE_TYPES.includes(c.source?.type)) err(`source type must be one of ${SOURCE_TYPES.join(', ')}`);
    if (!c.source?.description) err('source description missing');
    if (!c.rights?.basis || !c.rights?.confirmedBy || !/^\d{4}-\d{2}-\d{2}$/.test(c.rights?.confirmedOn ?? '')) err('rights basis, confirmedBy and confirmedOn are all required');
    if (e.isbn13) { if (c.isbn13 !== e.isbn13) err(`edition is ISBN-13 ${e.isbn13} but the cover entry says ${c.isbn13 ?? '(none)'}: a cover from another edition must not be used`); }
    else if (!c.matchEvidence) err('this edition has no ISBN-13 on record, so matchEvidence (how the cover was tied to this exact edition) is required');
    const key = coverKey(c.work, c.edition);
    for (const wdt of [240, 480]) { const f = path.join(p.opt, `${key}-${wdt}.webp`); if (wdt === 240 && !fs.existsSync(f)) err(`optimised file ${key}-240.webp is missing`); }
    if (!errors.some((x) => x.startsWith(id + ':'))) entries.push({ ...c, key, work: w, edition: e, has480: fs.existsSync(path.join(p.opt, `${key}-480.webp`)) });
  }
  // display-only reuse of confirmed identical front artwork (data/cover-reuse.json beside the manifest)
  const reuse = [], rp = path.join(path.dirname(p.manifest), 'cover-reuse.json');
  if (fs.existsSync(rp)) for (const u of readJSON(rp).reuse ?? []) {
    const id = `reuse ${u.work}/${u.to}`, err = (x) => errors.push(`${id}: ${x}`);
    const w = works.get(u.work), to = w?.editions.find((x) => x.id === u.to), from = w?.editions.find((x) => x.id === u.from), src = entries.find((c) => c.work.slug === u.work && c.edition.id === u.from);
    if (!w || !to || !from) { err('no such work/edition'); continue; }
    if (!src) { err('the source edition has no published cover'); continue; }
    if (to.language !== from.language) { err('a translation must not reuse another language\'s cover'); continue; }
    if (to.format === 'audiobook' || from.format === 'audiobook') { err('audiobook covers (square) never share artwork with other formats'); continue; }
    if (!u.evidence || !u.confirmedBy || !/^\d{4}-\d{2}-\d{2}$/.test(u.confirmedOn ?? '')) { err('evidence, confirmedBy and confirmedOn are required'); continue; }
    if (entries.some((c) => c.work.slug === u.work && c.edition.id === u.to)) { err('this edition has its own cover; reuse is not needed'); continue; }
    reuse.push({ ...u, work: w, edition: to, source: src });
  }
  return { errors, entries, reuse };
}

function editionRows() {
  const cat = readJSON(paths().catalogue), rows = [];
  const { entries } = loadCovers();
  const have = new Map(entries.map((c) => [`${c.work.slug}/${c.edition.id}`, c]));
  for (const w of cat.works) for (const e of w.editions) {
    const idn = e.isbn13 ? `ISBN-13 ${e.isbn13}` : e.isbn10 ? `ISBN-10 ${e.isbn10}` : e.asin ? `ASIN ${e.asin}` : 'no identifier on record';
    const c = have.get(`${w.slug}/${e.id}`);
    rows.push({ work: w.slug, title: w.title, authors: w.authors.join('; '), press: w.press === 'fmp', edition: e.id, format: e.format, language: e.language, publisher: e.publisher ?? '', year: e.year ?? '', identifier: idn, hasIsbn13: !!e.isbn13, status: c ? 'cover verified' : 'missing',
      need: c ? '' : w.press === 'fmp' ? `cover file for this ${e.format} edition from the owner${e.isbn13 ? '' : ' (and its ISBN/ASIN, to prove the match)'}` : `cover for this ${e.format} edition (${e.publisher ?? 'publisher unknown'}${e.year ? ' ' + e.year : ''}) with permission or licence${e.isbn13 ? '' : ', plus an identifier to match it'}` });
  }
  return rows;
}

function audit() {
  const rows = editionRows(), cat = readJSON(paths().catalogue), done = rows.filter((r) => r.status !== 'missing');
  const works = new Set(rows.map((r) => r.work)), worksWith = new Set(done.map((r) => r.work));
  const fmp = rows.filter((r) => r.press), pub = {};
  for (const r of rows.filter((x) => !x.press)) pub[r.publisher || '(publisher not recorded)'] = (pub[r.publisher || '(publisher not recorded)'] ?? 0) + 1;
  const sum = { generated: new Date().toISOString().slice(0, 10), works: works.size, editions: rows.length, coversVerified: done.length, worksWithCover: worksWith.size, editionsMissing: rows.length - done.length,
    withIsbn13: rows.filter((r) => r.hasIsbn13).length, withoutIsbn13: rows.filter((r) => !r.hasIsbn13).length, ownTitleEditions: fmp.length, ownTitleEditionsWithCover: fmp.filter((r) => r.status !== 'missing').length };
  fs.writeFileSync(P('data/cover-audit.json'), JSON.stringify({ summary: sum, rows }, null, 1) + '\n');
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  fs.writeFileSync(P('data/cover-audit.csv'), ['work,title,authors,own_title,edition_id,format,language,publisher,year,identifier,status,needed', ...rows.map((r) => [r.work, r.title, r.authors, r.press ? 'yes' : 'no', r.edition, r.format, r.language, r.publisher, r.year, r.identifier, r.status, r.need].map(q).join(','))].join('\n') + '\n');
  const topPub = Object.entries(pub).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `| ${k} | ${v} |`).join('\n');
  const own = fmp.map((r) => `| ${r.title} | ${r.format} | ${r.identifier} | ${r.status} | ${r.need || '-'} |`).join('\n');
  fs.writeFileSync(P('docs/COVER-AUDIT.md'), `# Cover audit (${sum.generated})

Source of truth: \`data/covers.json\` (manifest) checked against \`data/catalogue.json\`. Regenerate with \`node scripts/covers.mjs audit\`. Per-edition detail: \`data/cover-audit.csv\`.

| | |
|---|---|
| Books (works) | ${sum.works} |
| Editions | ${sum.editions} |
| **Authentic covers added and verified** | **${sum.coversVerified}** (${sum.worksWithCover} books) |
| Editions still missing a cover | ${sum.editionsMissing} |
| Editions with an ISBN-13 (can be matched exactly) | ${sum.withIsbn13} |
| Editions without an ISBN-13 | ${sum.withoutIsbn13} |
| Own Forbidden Mantra Press editions | ${sum.ownTitleEditions} (${sum.ownTitleEditionsWithCover} with cover) |

## Why none have been added yet
* No cover file exists anywhere in the project or was supplied, and covers were deliberately never copied from retailers or scraped.
* This environment cannot reach Open Library, Google Books, Amazon, publisher sites or archive.org (every connection is refused), so no cover could be fetched or checked even from permitted sources.
* A cover is copyrighted artwork. The only routes that are legally clean are: (1) files **you** own (all own-title covers), (2) **publisher permission** (press/media kits or written licence), (3) a **licensed feed**, (4) public-domain editions. Open Library's cover service and Amazon's product API each have their own terms and are not used without your decision and, for Amazon, your Associates API credentials.

## Own titles (priority)
| Title | Format | Identifier on record | Status | Needed |
|---|---|---|---|---|
${own}

## Third-party editions by publisher (where a permission request would go)
| Publisher | Editions needing a cover |
|---|---|
${topPub}

## How a cover gets in
1. You (or a publisher) supply the exact image file for one edition.
2. \`node scripts/covers.mjs add --work SLUG --edition ID --file PATH --source-type owner-supplied --source "where it came from" --rights "why we may use it" --confirmed-by "your name"\` (plus \`--isbn13\` for editions with an ISBN-13, or \`--match-evidence\` where there is none).
3. The script refuses a cover whose ISBN does not match that edition, strips metadata, makes 240 px and 480 px WebP copies, and records the rights evidence. The build shows the image, and the security gate refuses any cover file that is not in the manifest with its rights recorded.
`);
  console.log(`audit: ${sum.coversVerified}/${sum.editions} editions have a verified cover; ${sum.editionsMissing} missing (${sum.withoutIsbn13} have no ISBN-13)`);
}

function arg(name) { const i = process.argv.indexOf('--' + name); return i < 0 ? null : process.argv[i + 1]; }
function add() {
  const p = paths(); const need = ['work', 'edition', 'file', 'source-type', 'source', 'rights', 'confirmed-by'];
  const miss = need.filter((n) => !arg(n)); if (miss.length) { console.error('missing: ' + miss.map((m) => '--' + m).join(' ')); process.exit(2); }
  const cat = readJSON(p.catalogue), w = cat.works.find((x) => x.slug === arg('work')), e = w?.editions.find((x) => x.id === arg('edition'));
  if (!e) { console.error('no such work/edition'); process.exit(2); }
  const entry = { work: w.slug, edition: e.id, ...(arg('isbn13') ? { isbn13: arg('isbn13') } : {}), source: { type: arg('source-type'), description: arg('source') }, rights: { basis: arg('rights'), confirmedBy: arg('confirmed-by'), confirmedOn: arg('confirmed-on') ?? new Date().toISOString().slice(0, 10) }, ...(arg('match-evidence') ? { matchEvidence: arg('match-evidence') } : {}) };
  const key = coverKey(w.slug, e.id), ext = path.extname(arg('file')).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) { console.error('cover must be jpg, png or webp'); process.exit(2); }
  const m = fs.existsSync(p.manifest) ? readJSON(p.manifest) : { schema: 1, covers: [] };
  const trial = { ...m, covers: [...m.covers.filter((c) => !(c.work === entry.work && c.edition === entry.edition)), entry] };
  // validate before touching anything
  const err = []; if (e.isbn13 && entry.isbn13 !== e.isbn13) err.push(`edition is ISBN-13 ${e.isbn13}; pass --isbn13 ${e.isbn13} only if the supplied file really is the cover of that edition`);
  if (!e.isbn13 && !entry.matchEvidence) err.push('this edition has no ISBN-13: pass --match-evidence "how this file is tied to this exact edition"');
  if (!SOURCE_TYPES.includes(entry.source.type)) err.push(`--source-type must be one of ${SOURCE_TYPES.join(', ')}`);
  if (err.length) { console.error('REFUSED:\n  ' + err.join('\n  ')); process.exit(1); }
  fs.mkdirSync(p.src, { recursive: true }); fs.mkdirSync(p.opt, { recursive: true });
  const dest = path.join(p.src, key + ext); fs.copyFileSync(arg('file'), dest);
  let r; try { r = JSON.parse(execFileSync('python3', ['-I', P('scripts/optimize_cover.py'), dest, path.join(p.opt, key)], { encoding: 'utf8' })); } catch (x) { fs.rmSync(dest, { force: true }); console.error('REFUSED: ' + (x.stdout || x.message).toString().trim()); process.exit(1); }
  entry.file = path.relative(ROOT, dest); entry.original = r.original; entry.sizes = { 240: r['240'], ...(r['480'] ? { 480: r['480'] } : {}) };
  trial.covers = trial.covers.map((c) => (c.work === entry.work && c.edition === entry.edition ? entry : c));
  fs.writeFileSync(p.manifest, JSON.stringify(trial, null, 2) + '\n');
  console.log(`added cover for ${w.title} [${e.format} ${e.id}] -> ${path.relative(ROOT, p.opt)}/${key}-240.webp`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2];
  if (cmd === 'audit') audit();
  else if (cmd === 'check') { const r = loadCovers(); r.errors.forEach((e) => console.error('ERROR ' + e)); console.log(`${r.entries.length} cover(s) valid, ${r.errors.length} error(s)`); process.exit(r.errors.length ? 1 : 0); }
  else if (cmd === 'add') add();
  else { console.error('usage: node scripts/covers.mjs audit|check|add ...'); process.exit(2); }
}
