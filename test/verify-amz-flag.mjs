#!/usr/bin/env node
// The Amazon-hosted cover flag is OFF by default, preview-only, refused for public builds, and blocked by the security gate.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanPackage } from '../scripts/security-gate.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, passes = 0; const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? passes++ : fails++; };
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalogue.json'), 'utf8')), cov = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/covers.json'), 'utf8')).covers.map((c) => c.work));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const mention = (dir) => walk(dir).filter((f) => /\.(html|js|css|json)$/.test(f) && /media-amazon\.com|ssl-images-amazon\.com/.test(fs.readFileSync(f, 'utf8'))).length;

ok(mention(path.join(ROOT, 'site')) === 0, 'default build: no page, script or style references an Amazon-hosted image host');
const OUT = 'test/out-amz';
let r = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, FM_AMAZON_COVERS: 'preview', FM_OUT: OUT }, encoding: 'utf8' });
ok(r.status === 0, 'preview flag build succeeds (local dev build only)');
const press = fs.readFileSync(path.join(ROOT, OUT, 'press/index.html'), 'utf8');
const asins = new Set([...press.matchAll(/data-amz-preview="([A-Z0-9]{10})"/g)].map((m) => m[1]));
const eligible = cat.works.filter((w) => w.press && w.purchasable !== false && !cov.has(w.slug) && w.editions.some((e) => ['ebook', 'paperback', 'hardcover'].includes(e.format) && e.asin));
ok(eligible.length === 89, `eligible Press works without a verified cover: ${eligible.length} (expected 89)`);
const all = new Set(); for (const f of walk(path.join(ROOT, OUT)).filter((f) => f.endsWith('.html'))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/data-amz-preview="([A-Z0-9]{10})"/g)) all.add(m[1]);
const want = new Set(eligible.map((w) => { for (const fm of ['ebook', 'paperback', 'hardcover']) { const e = w.editions.find((x) => x.format === fm && x.asin); if (e) return e.asin; } }));
ok(all.size === 89 && [...want].every((a) => all.has(a)) && [...all].every((a) => want.has(a)), `preview shows exactly the 89 expected ASINs and no others (${all.size})`);
const imgs = walk(path.join(ROOT, OUT)).filter((f) => f.endsWith('.html')).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/<img class="amz-img" src="([^"]+)"/g)].map((m) => m[1]));
ok(imgs.every((u) => /^https:\/\/m\.media-amazon\.com\/images\/P\/[A-Z0-9]{10}\.01\._SCLZZZZZZZ_\.jpg$/.test(u)), 'every preview image is a plain Amazon URL loaded by the browser (nothing stored)');
ok(!fs.existsSync(path.join(ROOT, OUT, 'assets/covers')) || fs.readdirSync(path.join(ROOT, OUT, 'assets/covers')).every((f) => /-(240|480)\.webp$/.test(f)) && fs.readdirSync(path.join(ROOT, OUT, 'assets/covers')).length === 2 * fs.readdirSync(path.join(ROOT, 'assets-src/covers-opt')).filter((f) => f.endsWith('-240.webp')).length, 'no Amazon image file was added to the published cover folder');
const coveredLeak = [...cov].filter((sl) => { const f = path.join(ROOT, OUT, 'books', sl, 'index.html'); return fs.existsSync(f) && /data-amz-preview/.test(fs.readFileSync(f, 'utf8').split('class="book-cover"')[1]?.slice(0, 600) ?? ''); });
ok(coveredLeak.length === 0, `works with a verified cover never show an Amazon-hosted image (${cov.size} checked)`);
const pub = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, FM_AMAZON_COVERS: 'preview', FM_PUBLIC: '1', FM_OUT: 'test/out-amz-public' }, encoding: 'utf8' });
ok(pub.status !== 0 && /refused for public/.test(pub.stderr), 'the flag is refused for public builds');
const prod = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, FM_AMAZON_COVERS: 'preview', FM_ENV: 'production', FM_OUT: 'test/out-amz-public' }, encoding: 'utf8' });
ok(prod.status !== 0, 'the flag is refused for production builds');
const gate = scanPackage(path.join(ROOT, OUT), { production: false });
ok(!gate.ok && gate.fail.some((x) => /Amazon-hosted image/.test(x)), 'the security gate fails a package that contains an Amazon-hosted image');
console.log(fails ? `\n${fails} check(s) FAILED, ${passes} passed` : `\nAll ${passes} Amazon-hosted-cover flag checks passed`);
process.exit(fails ? 1 : 0);
