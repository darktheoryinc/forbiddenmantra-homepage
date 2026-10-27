#!/usr/bin/env node
// Resumable, rate-limited harvest. Run on a machine with network access; output is staged, never published.
//   node scripts/harvest.mjs discover --seeds config/seeds/subjects.json [--pages 2] [--accept-terms]   Open Library: seed -> works -> editions
//   node scripts/harvest.mjs verify   [--limit 500]                                                    Google Books second-source check for each harvested ISBN
//   node scripts/harvest.mjs goodbooks --file books.csv [--min-ratings 20000]                           candidate nominations (discovery only)
// Env: FM_HARVEST (output dir, default staging/harvest), FM_CONTACT_EMAIL (User-Agent), GOOGLE_BOOKS_API_KEY,
//      FM_OL_BASE / FM_GB_BASE (override hosts; used by tests). Re-running resumes from the checkpoint.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, checkpoint, appendJsonl, readJsonl } from './harvest/lib.mjs';
import { openlibrary, googlebooks, parseGoodbooksCsv } from './harvest/adapters.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.env.FM_HARVEST ?? 'staging/harvest');
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/sources.json'), 'utf8')).sources;
const [cmd, ...rest] = process.argv.slice(2);
const arg = (n, d) => { const i = rest.indexOf('--' + n); return i < 0 ? d : (rest[i + 1]?.startsWith('--') || rest[i + 1] === undefined ? true : rest[i + 1]); };
const today = process.env.FM_TODAY ?? new Date().toISOString().slice(0, 10);
if (process.env.FM_OL_BASE) openlibrary.base = process.env.FM_OL_BASE;
if (process.env.FM_GB_BASE) googlebooks.base = process.env.FM_GB_BASE;

function requireTerms(name) {
  if (!sources[name].termsReviewed && !arg('accept-terms', false)) {
    console.error(`Refusing to call ${name}: its terms are marked unreviewed in config/sources.json (${sources[name].termsUrl}).\nRead them, then set termsReviewed: true or pass --accept-terms for this run.`);
    process.exit(2);
  }
}
const ua = `ForbiddenMantraPress-catalogue/1.0 (${process.env.FM_CONTACT_EMAIL ?? 'contact not set'})`;

async function discover() {
  requireTerms('openlibrary');
  const seeds = JSON.parse(fs.readFileSync(path.resolve(ROOT, arg('seeds', 'config/seeds/subjects.json')), 'utf8')).seeds;
  const pages = +arg('pages', 1), perDoc = +arg('isbns-per-work', 3);
  const client = createClient({ rps: sources.openlibrary.rateLimit.rps, cacheDir: path.join(OUT, '.cache/ol'), userAgent: ua });
  const cp = checkpoint(path.join(OUT, 'openlibrary.checkpoint.json'));
  const outFile = path.join(OUT, 'openlibrary.jsonl');
  let added = 0, skipped = 0;
  if (arg('nominations', false)) { // look up goodbooks nominations by ISBN (discovery -> edition detail), 20 per request
    const nom = readJsonl(path.join(OUT, 'goodbooks-nominations.jsonl')).filter((r) => r.isbn13);
    for (let i = 0; i < nom.length; i += 20) {
      const unit = `nominations:${i}`;
      if (cp.has(unit)) { skipped++; continue; }
      try {
        const recs = openlibrary.parseLookup(await client.getJson(openlibrary.lookupUrl(nom.slice(i, i + 20).map((r) => r.isbn13))), today).map((r) => ({ ...r, seed: { kind: 'nomination', value: 'goodbooks10k' } }));
        appendJsonl(outFile, recs); added += recs.length; cp.mark(unit, { n: recs.length });
      } catch (err) { console.error(`stopped at ${unit}: ${err.message}`); break; }
    }
    console.log(JSON.stringify({ command: 'discover --nominations', recordsAdded: added, ...client.stats })); return;
  }
  for (const seed of seeds) for (let page = 1; page <= pages; page++) {
    const unit = `${seed.kind}:${seed.value}:p${page}`;
    if (cp.has(unit)) { skipped++; continue; }
    try {
      const docs = openlibrary.parseSearch(await client.getJson(openlibrary.searchUrl({ ...seed, page })));
      if (!docs.length) { cp.mark(unit, { works: 0 }); break; }
      for (const d of docs) {
        const isbns = d.isbns.slice(0, perDoc);
        if (!isbns.length) continue;
        const recs = openlibrary.parseLookup(await client.getJson(openlibrary.lookupUrl(isbns)), today).map((r) => ({ ...r, workKey: r.workKey ?? d.workKey, seed: { ...seed, department: seed.department, level: seed.level }, olSubjects: d.subjects }));
        appendJsonl(outFile, recs); added += recs.length;
      }
      cp.mark(unit, { works: docs.length });
    } catch (err) { console.error(`stopped at ${unit}: ${err.message}`); console.error('Progress is saved; re-run to resume.'); break; }
  }
  console.log(JSON.stringify({ command: 'discover', recordsAdded: added, unitsSkippedFromCheckpoint: skipped, ...client.stats }));
}

async function verify() {
  requireTerms('googlebooks');
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key && !process.env.FM_GB_BASE) { console.error('GOOGLE_BOOKS_API_KEY is not set. Anonymous calls have a zero quota. Create a free key and export it; never commit it.'); process.exit(2); }
  const limit = +arg('limit', sources.googlebooks.rateLimit.dailyQuota);
  const ol = readJsonl(path.join(OUT, 'openlibrary.jsonl'));
  const outFile = path.join(OUT, 'googlebooks.jsonl');
  const cp = checkpoint(path.join(OUT, 'googlebooks.checkpoint.json'));
  const client = createClient({ rps: sources.googlebooks.rateLimit.rps, cacheDir: path.join(OUT, '.cache/gb'), userAgent: ua });
  let n = 0, found = 0;
  for (const isbn of [...new Set(ol.map((r) => r.isbn13))]) {
    if (cp.has(isbn)) continue;
    if (n++ >= limit) { console.log('daily limit reached; re-run tomorrow to continue'); break; }
    try {
      const recs = googlebooks.parseIsbn(await client.getJson(googlebooks.isbnUrl(isbn, key)), isbn, today);
      if (recs.length) { appendJsonl(outFile, recs.slice(0, 1)); found++; }
      cp.mark(isbn, { found: recs.length > 0 });
    } catch (err) { console.error(`stopped at ${isbn}: ${err.message}`); break; }
  }
  console.log(JSON.stringify({ command: 'verify', checked: n, foundInGoogleBooks: found, ...client.stats }));
}

function goodbooks() {
  const file = arg('file', null);
  if (!file || file === true) { console.error('--file books.csv required'); process.exit(2); }
  const rows = parseGoodbooksCsv(fs.readFileSync(path.resolve(file), 'utf8'), { minRatings: +arg('min-ratings', 0) });
  const outFile = path.join(OUT, 'goodbooks-nominations.jsonl');
  fs.rmSync(outFile, { force: true });
  appendJsonl(outFile, rows);
  console.log(JSON.stringify({ command: 'goodbooks', nominations: rows.length, withValidIsbn13: rows.filter((r) => r.isbn13).length, note: 'discovery only: not counted as verification' }));
}

({ discover, verify, goodbooks }[cmd] ?? (() => { console.error('usage: harvest.mjs discover|verify|goodbooks'); process.exit(2); }))();
