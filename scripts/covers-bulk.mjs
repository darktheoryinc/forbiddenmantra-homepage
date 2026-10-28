#!/usr/bin/env node
// Bulk cover import for owner-supplied original artwork.
//   node scripts/covers-bulk.mjs --dir DIR [--map map.csv]                       dry run: writes data/drafts/covers-bulk-report.json and prints it
//   node scripts/covers-bulk.mjs --dir DIR [--map map.csv] --apply --confirmed-by "NAME" --rights "BASIS"
//                                                                                 adds every file that passed, through scripts/covers.mjs add
// How a file is tied to ONE edition (never guessed):
//   1. the map row: file,asin[,reuse_for,note]       2. the file name is the edition's ASIN (B0GFW4H6T2.jpg, B0GFW4H6T2_front.png)
//   3. <work-slug>.<language>.<ext> (e.g. mo-pai-exposed.en.png) which means that work's EBOOK in that language, if it has exactly one
// Checks before anything is written: known ASIN; one file per edition; no identical or near-identical files in the batch or against another
// work's existing cover; shape fits the format (portrait for ebook/paperback/hardcover, square for audiobook; a wide full-wrap file is refused);
// at least 600 px on the short side is advised (smaller is a warning). Never replaces an existing cover unless --replace is given.
// Display-only reuse (identical front artwork on other formats) is recorded separately, only with --reuse-confirmed "TEXT" and a reuse_for column;
// see data/cover-reuse.json. Audiobooks and other languages are never reuse targets.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : process.argv[i + 1]; };
const flag = (n) => process.argv.includes('--' + n);
const dir = arg('dir');
if (!dir) { console.error('usage: --dir DIR [--map map.csv] [--apply --confirmed-by NAME --rights BASIS] [--replace] [--reuse-confirmed TEXT]'); process.exit(2); }
const dataDir = process.env.FM_DATA ? path.resolve(ROOT, process.env.FM_DATA) : path.join(ROOT, 'data');
const manifestPath = process.env.FM_COVERS_MANIFEST ? path.resolve(process.env.FM_COVERS_MANIFEST) : path.join(dataDir, 'covers.json');
const reusePath = process.env.FM_COVERS_REUSE ? path.resolve(process.env.FM_COVERS_REUSE) : path.join(path.dirname(manifestPath), 'cover-reuse.json');
const reportPath = process.env.FM_COVERS_REPORT ? path.resolve(process.env.FM_COVERS_REPORT) : path.join(dataDir, 'drafts/covers-bulk-report.json');
const srcDir = process.env.FM_COVERS_SRC ? path.resolve(process.env.FM_COVERS_SRC) : path.join(ROOT, 'assets-src/covers');
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const cat = J(path.join(dataDir, 'catalogue.json'));
const manifest = fs.existsSync(manifestPath) ? J(manifestPath) : { covers: [] };
const byAsin = new Map(), bySlug = new Map();
for (const w of cat.works) { bySlug.set(w.slug, w); for (const e of w.editions) if (e.asin) byAsin.set(e.asin, { w, e }); }
const haveCover = new Map(manifest.covers.map((c) => [`${c.work}/${c.edition}`, c]));
const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
// optional map
const rows = new Map();
if (arg('map')) {
  const lines = fs.readFileSync(arg('map'), 'utf8').split(/\r?\n/).filter(Boolean); const head = lines.shift().split(',').map((x) => x.trim().toLowerCase());
  for (const l of lines) { const v = l.split(','); const o = Object.fromEntries(head.map((h, i) => [h, (v[i] ?? '').trim()])); if (o.file) rows.set(o.file, o); }
}
const insp = files.length ? JSON.parse(execFileSync('python3', ['-I', path.join(ROOT, 'scripts/cover_inspect.py'), ...files.map((f) => path.join(dir, f))], { encoding: 'utf8', maxBuffer: 1 << 26 })) : [];
// fingerprints of covers we already hold (originals in assets-src/covers)
const known = [];
if (fs.existsSync(srcDir)) { const fs2 = fs.readdirSync(srcDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)); if (fs2.length) for (const r of JSON.parse(execFileSync('python3', ['-I', path.join(ROOT, 'scripts/cover_inspect.py'), ...fs2.map((f) => path.join(srcDir, f))], { encoding: 'utf8', maxBuffer: 1 << 26 }))) if (r.dhash) known.push({ ...r, work: path.basename(r.path).split('__')[0] }); }
const ham = (a, b) => { let x = BigInt('0x' + a) ^ BigInt('0x' + b), n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
const report = []; const seenEd = new Map(), seenHash = new Map(), batchDh = [];
for (const r of insp) {
  const name = path.basename(r.path), row = rows.get(name) ?? {}; const out = { file: name, status: 'ok', problems: [], warnings: [] };
  const refuse = (m) => { out.status = 'refused'; out.problems.push(m); }; const warn = (m) => out.warnings.push(m);
  if (r.error) { refuse(`unreadable image: ${r.error}`); report.push(out); continue; }
  out.size = `${r.width}x${r.height}`; out.shape = r.shape;
  // identify the one edition
  let hit = null; const stem = name.replace(/\.[^.]+$/, '');
  if (row.asin) hit = byAsin.get(row.asin) ?? null;
  else { const m = stem.match(/^(B0[A-Z0-9]{8})(?:[_-].*)?$/i); if (m) hit = byAsin.get(m[1].toUpperCase()) ?? null;
    else { const m2 = stem.match(/^(.+?)\.([a-z]{2,3})$/); if (m2 && bySlug.has(m2[1])) { const w = bySlug.get(m2[1]), c = w.editions.filter((e) => e.language === m2[2] && e.format === 'ebook'); if (c.length === 1) hit = { w, e: c[0] }; else refuse(`'${m2[1]}' has ${c.length} ${m2[2]} ebook editions: name the file by the edition's ASIN`); } } }
  if (!hit && !out.problems.length) refuse('cannot tie this file to one edition: name it by the edition ASIN (B0….jpg) or list it in the map file; unknown ASINs are refused');
  if (hit) {
    const { w, e } = hit; out.work = w.slug; out.edition = e.id; out.asin = e.asin ?? null; out.language = e.language; out.format = e.format; out.title = w.title;
    const key = `${w.slug}/${e.id}`;
    if (haveCover.has(key) && !flag('replace')) refuse('this edition already has a cover (use --replace to swap it)');
    if (seenEd.has(key)) refuse(`two files in this batch are for the same edition (also ${seenEd.get(key)})`); else seenEd.set(key, name);
    if (r.shape === 'wide') refuse(`wide image (${out.size}): looks like a full-wrap print cover or banner. Send the front panel only`);
    else if (e.format === 'audiobook' && r.shape !== 'square') refuse(`audiobook covers are square; this is ${r.shape}`);
    else if (e.format !== 'audiobook' && r.shape === 'square') refuse(`square image for a ${e.format} edition: square covers are for audiobooks`);
    else if (r.shape === 'other') refuse(`shape ${out.size} is not a book cover`);
    if (r.flags.includes('small')) warn('under 600 px on the short side: usable but soft on large screens');
    if (seenHash.has(r.sha256)) refuse(`identical file to ${seenHash.get(r.sha256)} in this batch (same artwork for two editions needs a reuse_for entry, not two uploads)`); else seenHash.set(r.sha256, name);
    for (const k of known) { const d = ham(r.dhash, k.dhash); if (d <= 6 && k.work !== w.slug) refuse(`near-identical to an existing cover of another work (${k.work}, distance ${d}): wrong file?`); else if (d <= 6) warn(`near-identical to the existing cover ${path.basename(k.path)}: same artwork, check it is not a duplicate upload`); }
    for (const b of batchDh) { const d = ham(r.dhash, b.dhash); if (d <= 6 && b.work !== w.slug) warn(`near-identical to ${b.file} (another work in this batch, distance ${d})`); else if (d <= 6) warn(`near-identical to ${b.file} (same work in this batch): if it is the same front artwork for another format, list it as reuse_for instead of a second upload`); }
    batchDh.push({ dhash: r.dhash, file: name, work: w.slug });
    out.reuseFor = row.reuse_for ? row.reuse_for.split(/[ ;|]+/).filter(Boolean) : [];
  }
  report.push(out);
}
// reuse validation (display only)
const reuse = [];
for (const o of report) for (const asin of o.reuseFor ?? []) {
  const t = byAsin.get(asin); const bad = (m) => { o.status = o.status === 'refused' ? 'refused' : 'warn'; o.warnings.push(`reuse for ${asin} not recorded: ${m}`); };
  if (!t) { bad('unknown ASIN'); continue; }
  const src = byAsin.get(o.asin); if (t.w.slug !== src.w.slug) { bad('different work'); continue; }
  if (t.e.language !== src.e.language) { bad('different language: a translation has its own artwork'); continue; }
  if (t.e.format === 'audiobook' || src.e.format === 'audiobook') { bad('audiobook covers are square and never share artwork'); continue; }
  if (t.e.id === src.e.id) { bad('same edition'); continue; }
  if (!arg('reuse-confirmed')) { bad('needs --reuse-confirmed "owner statement that the front artwork is identical"'); continue; }
  reuse.push({ work: src.w.slug, from: src.e.id, to: t.e.id, fromAsin: o.asin, toAsin: asin, toFormat: t.e.format, evidence: arg('reuse-confirmed'), confirmedBy: arg('confirmed-by') ?? null, confirmedOn: new Date().toISOString().slice(0, 10) });
}
const summary = { files: report.length, ok: report.filter((r) => r.status === 'ok').length, warn: report.filter((r) => r.status === 'warn').length, refused: report.filter((r) => r.status === 'refused').length, reuseRecorded: reuse.length };
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({ summary, applied: flag('apply'), report }, null, 1) + '\n');
console.log(JSON.stringify(summary)); for (const r of report) console.log(`${r.status.toUpperCase().padEnd(7)} ${r.file}${r.title ? ' -> ' + r.title + ' (' + r.language + ' ' + r.format + ' ' + (r.asin ?? '') + ')' : ''}${r.problems.concat(r.warnings).map((m) => '\n          - ' + m).join('')}`);
if (!flag('apply')) { console.log('dry run: nothing written'); process.exit(summary.refused ? 1 : 0); }
const by = arg('confirmed-by'), rights = arg('rights'); if (!by || !rights) { console.error('--apply needs --confirmed-by and --rights'); process.exit(2); }
let added = 0;
for (const r of report.filter((x) => x.status !== 'refused')) {
  const args = ['add', '--work', r.work, '--edition', r.edition, '--file', path.join(dir, r.file), '--source-type', 'owner-supplied', '--source', `Owner-supplied original file ${r.file} (bulk import)`, '--rights', rights, '--confirmed-by', by, '--match-evidence', `Owner-supplied file ${r.file}, tied to this edition by its ASIN ${r.asin} (${r.language} ${r.format}); checked for shape, size and duplicates by scripts/covers-bulk.mjs`];
  if (flag('replace')) { /* covers.mjs add replaces the entry for the same edition */ }
  const x = spawnSync('node', [path.join(ROOT, 'scripts/covers.mjs'), ...args], { env: process.env, encoding: 'utf8' });
  if (x.status === 0) { added++; console.log(x.stdout.trim()); } else { r.status = 'refused'; r.problems.push((x.stderr || x.stdout).trim().split('\n').pop()); console.log(`REFUSED ${r.file}: ${r.problems.at(-1)}`); }
}
const okSrc = new Set(report.filter((x) => x.status !== 'refused').map((x) => x.asin)); for (let i = reuse.length - 1; i >= 0; i--) if (!okSrc.has(reuse[i].fromAsin)) reuse.splice(i, 1);
if (reuse.length) { const cur = fs.existsSync(reusePath) ? J(reusePath) : { _doc: 'Display-only reuse of confirmed identical front artwork. Edition records are unchanged. Audiobooks and other languages are never targets.', reuse: [] }; for (const u of reuse) if (!cur.reuse.some((x) => x.work === u.work && x.to === u.to)) cur.reuse.push(u); fs.writeFileSync(reusePath, JSON.stringify(cur, null, 1) + '\n'); console.log(`recorded ${reuse.length} display-reuse entr${reuse.length === 1 ? 'y' : 'ies'} in ${path.relative(ROOT, reusePath)}`); }
fs.writeFileSync(reportPath, JSON.stringify({ summary, applied: true, report }, null, 1) + '\n');
console.log(`${added} cover(s) added`);
