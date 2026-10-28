#!/usr/bin/env node
// Bulk-add publisher-supplied cover files. Name each file by its edition's ISBN-13 (9780140447897.jpg) and put them in one folder.
//   node scripts/covers-import.mjs --dir DIR --publisher "Penguin Random House" --basis "written permission / terms URL" --confirmed-by "NAME" [--source-type publisher-permission] [--dry-run]
// Every file is matched to the one catalogue edition that carries that exact ISBN-13; files that match nothing are reported and skipped, never guessed.
// Adding goes through scripts/covers.mjs add, so all of its rights and size checks still apply.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : process.argv[i + 1]; };
const dir = arg('dir'), publisher = arg('publisher'), basis = arg('basis'), by = arg('confirmed-by'), type = arg('source-type') ?? 'publisher-permission', dry = process.argv.includes('--dry-run');
if (!dir || !publisher || !basis || !by) { console.error('usage: --dir DIR --publisher NAME --basis TEXT --confirmed-by NAME [--source-type TYPE] [--dry-run]'); process.exit(2); }
const dataDir = process.env.FM_DATA ? path.resolve(ROOT, process.env.FM_DATA) : path.join(ROOT, 'data');
const cat = JSON.parse(fs.readFileSync(path.join(dataDir, 'catalogue.json'), 'utf8'));
const byIsbn = new Map(); for (const w of cat.works) for (const e of w.editions ?? []) if (e.isbn13) byIsbn.set(e.isbn13, { w, e });
let added = 0, skipped = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const m = f.match(/^(\d{13})\.(jpe?g|png|webp)$/i); if (!m) { console.log(`skip ${f}: name must be <ISBN-13>.jpg|png|webp`); skipped++; continue; }
  const hit = byIsbn.get(m[1]); if (!hit) { console.log(`skip ${f}: no catalogue edition has ISBN-13 ${m[1]}`); skipped++; continue; }
  const label = `${hit.w.slug} ${hit.e.format} ${hit.e.id}`;
  if (dry) { console.log(`would add ${f} -> ${label}`); continue; }
  const r = spawnSync('node', [path.join(ROOT, 'scripts/covers.mjs'), 'add', '--work', hit.w.slug, '--edition', hit.e.id, '--file', path.join(dir, f), '--source-type', type, '--source', `${publisher} supplied file ${f}`, '--rights', basis, '--confirmed-by', by, '--isbn13', m[1]], { encoding: 'utf8', env: process.env });
  if (r.status === 0) { added++; console.log(`added ${f} -> ${label}`); } else { skipped++; console.log(`REFUSED ${f}: ${(r.stderr || r.stdout).trim().split('\n').pop()}`); }
}
console.log(dry ? 'dry run: nothing written' : `${added} added, ${skipped} skipped`);
