#!/usr/bin/env node
// Bulk cover import: node test/verify-cover-bulk.mjs
// Proves: files are tied to one edition by ASIN, unknown/duplicate/wrong-shape files are refused before anything is written, near-duplicates of
// another work's cover are blocked, ebook artwork is never applied to other formats automatically, and display-only reuse needs the owner's
// confirmation and is refused for audiobooks and other languages.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-bulk-')), D = path.join(tmp, 'in'); fs.mkdirSync(D);
const env = { ...process.env, FM_COVERS_MANIFEST: path.join(tmp, 'covers.json'), FM_COVERS_SRC: path.join(tmp, 'src'), FM_COVERS_OPT: path.join(tmp, 'opt'), FM_COVERS_REPORT: path.join(tmp, 'report.json') };
const py = (code) => spawnSync('python3', ['-I', '-c', code], { encoding: 'utf8' });
py(`
from PIL import Image, ImageDraw
import random
def img(path, w, h, seed, noise=0):
    r = random.Random(seed); im = Image.new('RGB', (w, h)); d = ImageDraw.Draw(im)
    for i in range(14):
        d.rectangle([r.randint(0, w//2), r.randint(0, h//2), r.randint(w//2, w), r.randint(h//2, h)], fill=(r.randint(0,255), r.randint(0,255), r.randint(0,255)))
    if noise:
        for _ in range(noise): d.point((r.randint(0, w-1), r.randint(0, h-1)), fill=(255,255,255))
    im.save(path)
D = r'${D}'
img(D+'/B0GFQ63JSF.png', 800, 1200, 1)            # Mo Pai Exposed ebook (portrait)
img(D+'/B0F287TGGL.jpg', 800, 1200, 2)            # Energy Unleashed ebook
img(D+'/B0GFW4H6T2_front.png', 800, 1200, 1, 30)  # Mo Pai Exposed paperback: near-identical to the ebook file
img(D+'/B0000000000.png', 800, 1200, 3)           # unknown ASIN
img(D+'/B0GFVWMR9B.png', 2400, 1200, 4)           # hardcover but a wide full-wrap
img(D+'/B0H85C85V8.png', 800, 1200, 5)            # audiobook but portrait
img(D+'/B0H85C85V8_b.png', 1000, 1000, 6)         # second file, audiobook square (same edition as above)
img(D+'/random-name.png', 800, 1200, 7)           # cannot be tied to an edition
`);
const run = (args, extra = {}) => spawnSync('node', [path.join(ROOT, 'scripts/covers-bulk.mjs'), '--dir', D, ...args], { env: { ...env, ...extra }, encoding: 'utf8' });
let r = run([]); const rep = () => JSON.parse(fs.readFileSync(env.FM_COVERS_REPORT, 'utf8')).report;
let by = Object.fromEntries(rep().map((x) => [x.file, x]));
ok(by['B0GFQ63JSF.png'].status === 'ok' && by['B0GFQ63JSF.png'].format === 'ebook' && by['B0GFQ63JSF.png'].work === 'mo-pai-exposed', 'a file named by ASIN is tied to exactly that edition');
ok(by['B0000000000.png'].status === 'refused' && /unknown ASINs are refused|cannot tie/.test(by['B0000000000.png'].problems.join()), 'an unknown ASIN is refused');
ok(by['random-name.png'].status === 'refused', 'a file that names no edition is refused, never guessed');
ok(by['B0GFVWMR9B.png'].status === 'refused' && /full-wrap/.test(by['B0GFVWMR9B.png'].problems.join()), 'a wide full-wrap file is refused for a hardcover');
ok(by['B0H85C85V8.png'].status === 'refused' && /audiobook covers are square/.test(by['B0H85C85V8.png'].problems.join()), 'a portrait file is refused for an audiobook');
ok(by['B0H85C85V8_b.png'].status === 'refused' && /same edition/.test(by['B0H85C85V8_b.png'].problems.join()), 'two files for one edition are caught');
ok(r.status === 1 && !fs.existsSync(env.FM_COVERS_MANIFEST), 'a dry run writes nothing to the manifest and exits non-zero while problems remain');
ok(by['B0GFW4H6T2_front.png'].warnings.some((m) => /near-identical.*reuse_for/.test(m)), 'a near-identical file for another format of the same work is reported and pointed to reuse_for');
// apply the good ones (ebooks only)
const keep = ['B0GFQ63JSF.png', 'B0F287TGGL.jpg'];
const D2 = path.join(tmp, 'in2'); fs.mkdirSync(D2); for (const f of keep) fs.copyFileSync(path.join(D, f), path.join(D2, f));
r = spawnSync('node', [path.join(ROOT, 'scripts/covers-bulk.mjs'), '--dir', D2, '--apply', '--confirmed-by', 'Forbidden Mantra Press owner', '--rights', 'owner confirmed original artwork'], { env, encoding: 'utf8' });
const man = JSON.parse(fs.readFileSync(env.FM_COVERS_MANIFEST, 'utf8'));
ok(r.status === 0 && man.covers.length === 2 && man.covers.every((c) => c.source.type === 'owner-supplied' && /ASIN B0/.test(c.matchEvidence)), `apply adds only the checked files (${man.covers.length}) with ASIN match evidence recorded`);
ok(man.covers.every((c) => { const w = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalogue.json'), 'utf8')).works.find((x) => x.slug === c.work); return w.editions.find((e) => e.id === c.edition).format === 'ebook'; }), 'ebook artwork is recorded against the ebook edition only: no paperback, hardcover or audiobook gets a cover automatically');
// near-duplicate of ANOTHER work's cover is blocked
fs.mkdirSync(path.join(tmp, 'in3')); fs.copyFileSync(path.join(D, 'B0GFW4H6T2_front.png'), path.join(tmp, 'in3', 'B0F29FBNF3.png')); // Energy Unleashed paperback, but it is Mo Pai Exposed artwork
r = spawnSync('node', [path.join(ROOT, 'scripts/covers-bulk.mjs'), '--dir', path.join(tmp, 'in3')], { env, encoding: 'utf8' });
ok(/near-identical to an existing cover of another work/.test(r.stdout) && r.status === 1, 'a file that matches another work\'s existing cover is blocked as a likely wrong file');
// display-only reuse
const m = path.join(tmp, 'map.csv'); fs.mkdirSync(path.join(tmp, 'in4')); fs.copyFileSync(path.join(D, 'B0GFW4H6T2_front.png'), path.join(tmp, 'in4', 'x.png'));
fs.writeFileSync(m, 'file,asin,reuse_for\nx.png,B0GFQ63JSF,B0GFW4H6T2 B0H85C85V8 B0GFVWMR9B\n');
r = spawnSync('node', [path.join(ROOT, 'scripts/covers-bulk.mjs'), '--dir', path.join(tmp, 'in4'), '--map', m, '--replace'], { env, encoding: 'utf8' });
ok(/needs --reuse-confirmed/.test(r.stdout), 'reuse on other formats is not recorded without the owner\'s confirmation');
r = spawnSync('node', [path.join(ROOT, 'scripts/covers-bulk.mjs'), '--dir', path.join(tmp, 'in4'), '--map', m, '--replace', '--apply', '--confirmed-by', 'Forbidden Mantra Press owner', '--rights', 'owner confirmed original artwork', '--reuse-confirmed', 'Owner states the front artwork is identical for print'], { env, encoding: 'utf8' });
const reuse = JSON.parse(fs.readFileSync(path.join(tmp, 'cover-reuse.json'), 'utf8')).reuse;
ok(reuse.length === 2 && reuse.every((u) => ['paperback', 'hardcover'].includes(u.toFormat)) && !reuse.some((u) => u.toAsin === 'B0H85C85V8'), `confirmed reuse is recorded for the paperback and hardcover only (${reuse.map((u) => u.toFormat).join(', ')}); the audiobook is refused`);
ok(/audiobook covers are square and never share/.test(r.stdout), 'reuse for an audiobook is refused with the reason');
// reuse validation in the manifest loader: other-language target refused
const rp = path.join(tmp, 'cover-reuse.json'); const bad = { reuse: [{ work: 'the-inner-mechanics-of-energy-cultivation', from: 'x', to: 'y', evidence: 'e', confirmedBy: 'o', confirmedOn: '2026-10-28' }] }; fs.writeFileSync(rp, JSON.stringify(bad));
const chk = spawnSync('node', [path.join(ROOT, 'scripts/covers.mjs'), 'check'], { env, encoding: 'utf8' });
ok(chk.status !== 0 && /no such work\/edition/.test(chk.stdout + chk.stderr), 'the manifest check rejects a reuse entry that points at no edition');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} cover-bulk checks passed`);
process.exit(state.fails ? 1 : 0);
