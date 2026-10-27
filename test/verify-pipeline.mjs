#!/usr/bin/env node
// Import-pipeline integrity on FICTIONAL records served by a local mock of Open Library / Google Books.
//   node test/verify-pipeline.mjs      (no network, no keys; nothing here touches the real catalogue)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok } from './lib.mjs';
import { isbn10to13, toIsbn13, createClient, checkpoint } from '../scripts/harvest/lib.mjs';
import { parseCsv, parseGoodbooksCsv } from '../scripts/harvest/adapters.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FX = path.join(ROOT, 'test/fixtures/pipeline');
fs.rmSync(FX, { recursive: true, force: true });
for (const d of ['harvest', 'staging/verified', 'staging/batches', 'data']) fs.mkdirSync(path.join(FX, d), { recursive: true });
const mk = (n) => { const core = '978' + String(100000000 + n).padStart(9, '0'); let s = 0; for (let i = 0; i < 12; i++) s += +core[i] * (i % 2 ? 3 : 1); return core + ((10 - (s % 10)) % 10); };
const I = { a1: mk(1), a2: mk(2), blocked: mk(3), lonely: mk(4), conflict: mk(5), nofmt: mk(6), exists: mk(7), spanish: mk(8) };

// ---- unit checks ----
ok(toIsbn13('0-306-40615-2') === '9780306406157' && toIsbn13('9780306406158') === null && isbn10to13('0306406152') === '9780306406157', 'isbn: 10->13 conversion and checksum rejection');
ok(parseCsv('a,b\n"x, y","say ""hi"""\n')[1][1] === 'say "hi"', 'csv: quoted commas and escaped quotes');
const gbRows = parseGoodbooksCsv(`title,original_title,authors,isbn13,original_publication_year,ratings_count\nT,Orig,"A. Writer, B. Other",9.78030640615e+12,1999.0,50\nU,,Z,,2000,5\n`, { minRatings: 10 });
ok(gbRows.length === 1 && gbRows[0].authors.length === 1 && gbRows[0].source === 'goodbooks10k', 'goodbooks: only nominations above the ratings floor; first author only; marked as discovery source');

// ---- mock servers ----
const olDetails = (isbn, over = {}) => ({ bib_key: 'ISBN:' + isbn, info_url: 'https://openlibrary.org/books/OLfixture' + isbn, details: { title: 'The Fictional Breath', authors: [{ name: 'Ana Placeholder' }], publishers: ['Fixture Press'], publish_date: '2010', physical_format: 'Paperback', languages: [{ key: '/languages/eng' }], works: [{ key: '/works/OLFIX1W' }], subjects: ['Yoga'], ...over } });
const OL = { [I.a1]: olDetails(I.a1), [I.a2]: olDetails(I.a2, { physical_format: 'Hardcover', publisher: 'x', publishers: ['Fixture Press'], publish_date: 'March 2015', works: [{ key: '/works/OLFIX1W' }] }),
  [I.blocked]: olDetails(I.blocked, { title: 'Summary of The Fictional Breath', works: [{ key: '/works/OLFIX2W' }] }), [I.lonely]: olDetails(I.lonely, { title: 'A Lonely Book', authors: [{ name: 'Lee Solo' }], works: [{ key: '/works/OLFIX3W' }] }),
  [I.conflict]: olDetails(I.conflict, { title: 'Conflict Of Titles', authors: [{ name: 'Cy Clash' }], works: [{ key: '/works/OLFIX4W' }] }), [I.nofmt]: olDetails(I.nofmt, { title: 'No Format Given', authors: [{ name: 'Fay Blank' }], physical_format: undefined, works: [{ key: '/works/OLFIX5W' }] }),
  [I.exists]: olDetails(I.exists, { title: 'Already Here', authors: [{ name: 'Old Hand' }], works: [{ key: '/works/OLFIX6W' }] }), [I.spanish]: olDetails(I.spanish, { title: 'El Aliento Ficticio', authors: [{ name: 'Ana Placeholder' }], languages: [{ key: '/languages/spa' }], works: [{ key: '/works/OLFIX7W' }] }) };
const GB = (isbn, over = {}) => ({ items: [{ id: 'gb' + isbn, volumeInfo: { title: 'The Fictional Breath', authors: ['Ana Placeholder'], publisher: 'Fixture Press', publishedDate: '2010-05-01', language: 'en', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }], ...over } }] });
const GBD = { [I.a1]: GB(I.a1), [I.a2]: GB(I.a2, { publishedDate: '2016' }), [I.blocked]: GB(I.blocked, { title: 'Summary of The Fictional Breath' }), [I.conflict]: GB(I.conflict, { title: 'Totally Different Title', authors: ['Cy Clash'] }),
  [I.nofmt]: GB(I.nofmt, { title: 'No Format Given', authors: ['Fay Blank'] }), [I.exists]: GB(I.exists, { title: 'Already Here', authors: ['Old Hand'] }), [I.spanish]: GB(I.spanish, { title: 'El Aliento Ficticio', language: 'es' }) };
let olHits = 0, flaky = true, gbQuota = true; const hits = { ol: 0, gb: 0, retry: 0 };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const send = (c, b, h = {}) => { res.writeHead(c, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(b)); };
  if (u.pathname === '/search.json') {
    hits.ol++; if (flaky) { flaky = false; hits.retry++; return send(429, {}, { 'retry-after': '0' }); }
    const q = u.searchParams.get('q');
    if (q.includes('yoga')) return send(200, { docs: [{ key: '/works/OLFIX1W', title: 'The Fictional Breath', author_name: ['Ana Placeholder'], isbn: [I.a1, I.a2, '9780000000000'], subject: ['Yoga'] }, { key: '/works/OLFIX2W', title: 'Summary of The Fictional Breath', author_name: ['Ana Placeholder'], isbn: [I.blocked] }, { key: '/works/OLFIX3W', title: 'A Lonely Book', author_name: ['Lee Solo'], isbn: [I.lonely] }, { key: '/works/OLFIX4W', title: 'Conflict Of Titles', author_name: ['Cy Clash'], isbn: [I.conflict] }, { key: '/works/OLFIX5W', title: 'No Format Given', author_name: ['Fay Blank'], isbn: [I.nofmt] }, { key: '/works/OLFIX6W', title: 'Already Here', author_name: ['Old Hand'], isbn: [I.exists] }, { key: '/works/OLFIX7W', title: 'El Aliento Ficticio', author_name: ['Ana Placeholder'], isbn: [I.spanish] }] });
    return send(200, { docs: [] });
  }
  if (u.pathname === '/api/books') { const out = {}; for (const k of u.searchParams.get('bibkeys').split(',')) if (OL[k.slice(5)]) out[k] = OL[k.slice(5)]; return send(200, out); }
  if (u.pathname === '/volumes') { hits.gb++; const isbn = u.searchParams.get('q').replace('isbn:', ''); return send(200, GBD[isbn] ?? {}); }
  send(404, {});
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const env = { ...process.env, FM_HARVEST: 'test/fixtures/pipeline/harvest', FM_STAGING: 'test/fixtures/pipeline/staging', FM_DATA: 'test/fixtures/pipeline/data', FM_OL_BASE: base, FM_GB_BASE: base, FM_TODAY: '2026-10-27', FM_CONTACT_EMAIL: 'fixture@example.invalid' };
const node = (args, e = {}) => new Promise((resolve) => { const p = spawn('node', args, { cwd: ROOT, env: { ...env, ...e } }); let out = '', err = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d)); p.on('close', (code) => resolve({ code, out, err })); });
const seeds = path.join(FX, 'seeds.json'); fs.writeFileSync(seeds, JSON.stringify({ seeds: [{ kind: 'subject', value: 'yoga', department: 'yoga', tradition: 'hindu', level: 'unrated' }, { kind: 'subject', value: 'nothing', department: 'yoga', tradition: 'hindu', level: 'unrated' }] }));
// fixture catalogue so "already published" and "possible extra edition" paths run
fs.writeFileSync(path.join(FX, 'data/catalogue.json'), JSON.stringify({ works: [{ title: 'Already Here', authors: ['Old Hand'], editions: [{ isbn13: I.exists }] }] }));

// ---- shipped config must reference real taxonomy ids ----
{ const tax = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/taxonomy.json'), 'utf8')); const D = new Set(tax.departments.map((d) => d.id)), T = new Set(tax.traditions.map((t) => t.id));
  const sd = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/seeds/subjects.json'), 'utf8')).seeds; const sm = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/subject-map.json'), 'utf8')).rules;
  const bad = [...sd.filter((s) => !D.has(s.department) || !T.has(s.tradition) || !tax.levels[s.level]).map((s) => s.value), ...sm.filter(([, d, t]) => !D.has(d) || !T.has(t)).map((r) => r[0])];
  ok(bad.length === 0, `config: ${sd.length} seeds and ${sm.length} subject rules reference only real departments, traditions and levels${bad.length ? ': ' + bad.join(', ') : ''}`); }

// ---- compliance gate ----
const gate = await node(['scripts/harvest.mjs', 'discover', '--seeds', seeds]);
ok(gate.code === 2 && /terms are marked unreviewed/.test(gate.err) && hits.ol === 0, 'compliance: harvest refuses a source whose terms are unreviewed (no request sent)');
const nokey = await node(['scripts/harvest.mjs', 'verify', '--accept-terms'], { FM_GB_BASE: '' });
ok(nokey.code === 2 && /GOOGLE_BOOKS_API_KEY/.test(nokey.err), 'compliance: Google Books verify refuses to run without an API key');

// ---- discover (with a 429 + Retry-After first) ----
const d1 = await node(['scripts/harvest.mjs', 'discover', '--seeds', seeds, '--accept-terms']);
const j1 = JSON.parse(d1.out.trim().split('\n').pop());
const olRows = fs.readFileSync(path.join(FX, 'harvest/openlibrary.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
ok(d1.code === 0 && hits.retry === 1 && j1.retries >= 1 && olRows.length === 8, `discover: recovered from 429 (retries=${j1.retries}); ${olRows.length} edition records; invalid ISBN 9780000000000 never looked up`);
ok(olRows.every((r) => !('description' in r) && !('cover' in r) && !('price' in r)), 'discover: no descriptions, covers or prices are stored');
const before = hits.ol;
const d2 = await node(['scripts/harvest.mjs', 'discover', '--seeds', seeds, '--accept-terms']);
ok(hits.ol === before && JSON.parse(d2.out.trim().split('\n').pop()).unitsSkippedFromCheckpoint === 2, 'resume: a second run skips completed units via checkpoint (0 new requests)');

// ---- verify with Google Books ----
const v = await node(['scripts/harvest.mjs', 'verify', '--accept-terms', '--limit', '100']);
const gbRows2 = fs.readFileSync(path.join(FX, 'harvest/googlebooks.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
ok(v.code === 0 && gbRows2.length === 7, `verify: ${gbRows2.length} Google Books matches (the lonely ISBN has none)`);
const g0 = hits.gb; await node(['scripts/harvest.mjs', 'verify', '--accept-terms']);
ok(hits.gb === g0, 'resume: verify does not re-query ISBNs already checked');

// ---- circuit breaker + client unit ----
let calls = 0; const c = createClient({ rps: 1000, breakAfter: 2, maxRetries: 0, fetchImpl: async () => { calls++; return { ok: false, status: 429, headers: new Map() }; } });
let msg = ''; for (let i = 0; i < 4; i++) { try { await c.getJson('http://x/' + i); } catch (e) { msg = e.message; } }
ok(calls === 2 && /circuit open/.test(msg), `client: circuit opens after 2 consecutive failures (made ${calls} calls, then stopped)`);
const cpf = path.join(FX, 'cp.json'); { const k = checkpoint(cpf); k.mark('a'); k.mark('b'); } ok(checkpoint(cpf).count() === 2 && checkpoint(cpf).has('a'), 'checkpoint: persists across instances');

// ---- web-corroborated .vpsv batch ----
fs.writeFileSync(path.join(FX, 'staging/batches/web-fixture.vpsv'), [
  '# fixture rows',
  'title|subtitle|authors|publisher|year|isbn13|format|language|subjects|tradition|level|series|seriesNo|sources|checked',
  `Two Host Book||Pat Probe|Fixture Press|2001|${mk(20)}|paperback|en|mindfulness|buddhist|beginner|Probe Series|1|https://example-a.invalid/x https://example-b.invalid/y|2026-10-27`,
  `Two Host Book||Pat Probe|Fixture Press|2002|${mk(21)}|hardcover|en|mindfulness|buddhist|beginner|Probe Series|1|https://example-a.invalid/x2 https://example-b.invalid/y2|2026-10-27`,
  `One Host Book||Pat Probe|Fixture Press|2003|${mk(22)}|paperback|en|mindfulness|buddhist|beginner|||https://example-a.invalid/only|2026-10-27`,
  `Bad Checksum||Pat Probe|Fixture Press|2003|9781234567890|paperback|en|mindfulness|buddhist|beginner|||https://example-a.invalid/q https://example-b.invalid/q|2026-10-27`,
].join('\n'));

// ---- reconcile + import ----
const rec = await node(['scripts/reconcile.mjs', '--batch-size', '1', '--prefix', 'auto-fixture']);
const rj = JSON.parse(rec.out);
const review = JSON.parse(fs.readFileSync(path.join(FX, 'staging/review/auto-fixture.json'), 'utf8'));
const why = (re) => review.items.some((i) => re.test(i.reason));
ok(rec.code === 0 && rj.worksInBatches === 2 && rj.batches === 2, `reconcile: ${rj.worksInBatches} works eligible (Fictional Breath with 2 editions, Spanish edition), split into ${rj.batches} batches of <=1`);
ok(why(/quality rule/) && why(/single source only/) && why(/title disagrees/) && why(/format not stated/) && why(/already published \(ISBN\)/), 'reconcile: blocked title, single-source, conflicting title, unknown format and already-published ISBN all held for review with reasons');
const b1 = JSON.parse(fs.readFileSync(path.join(FX, 'staging/batches/auto-fixture-001.json'), 'utf8')).works.concat(JSON.parse(fs.readFileSync(path.join(FX, 'staging/batches/auto-fixture-002.json'), 'utf8')).works);
const breath = b1.find((w) => w.title === 'The Fictional Breath');
ok(breath?.editions.length === 2 && breath.editions[0].year === 2010 && breath.editions[1].year === null, 'reconcile: two ISBNs of one work grouped as editions; year kept only where both sources agree (2010 yes, 2015 vs 2016 no)');
ok(b1.every((w) => w.description === null && w.provenance.tier === 'auto-two-source'), 'reconcile: no description copied; provenance tier recorded');

const imp = await node(['scripts/import.mjs']);
const cat = JSON.parse(fs.readFileSync(path.join(FX, 'data/catalogue.json'), 'utf8'));
const eq = JSON.parse(fs.readFileSync(path.join(FX, 'data/error-queue.json'), 'utf8')).items;
const titles = cat.works.map((w) => w.title).sort();
ok(imp.code === 0 && JSON.stringify(titles) === JSON.stringify(['El Aliento Ficticio', 'The Fictional Breath', 'Two Host Book']), `import: published exactly the verified works (${titles.join('; ')})`);
const thb = cat.works.find((w) => w.title === 'Two Host Book');
ok(thb.editions.length === 2 && thb.series?.name === 'Probe Series' && thb.provenance.tier === 'web-corroborated', 'import: .vpsv rows with the same title+author become one work with two editions, series kept');
ok(eq.some((i) => /needs 2 independent source hosts of its own; found 1/.test(i.reasons.join())) && eq.some((i) => /checksum fails/.test(i.reasons.join())), 'import: single-host and bad-checksum batch rows rejected into the error queue');
ok(cat.works.find((w) => w.title === 'El Aliento Ficticio').editions[0].language === 'es', 'import: Spanish edition published with its own two sources (language from sources, not inferred)');
ok(!cat.works.some((w) => /Already Here|Summary of|Lonely|Conflict|No Format/.test(w.title)), 'import: held-back records never reach the catalogue');
server.close();
console.log(`\n${state.passes} passed, ${state.fails} failed`);
process.exit(state.fails ? 1 : 0);
