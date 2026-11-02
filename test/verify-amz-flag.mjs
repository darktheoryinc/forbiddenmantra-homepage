#!/usr/bin/env node
// Amazon-hosted covers (owner-approved instruction, config/approvals.json amazonHostedCovers): shown only for sold works without a verified stored cover,
// only as the exact Amazon image URL loaded by the browser (nothing stored), removable with FM_AMAZON_COVERS=off, and policed by the security gate.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanPackage } from '../scripts/security-gate.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, passes = 0; const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? passes++ : fails++; };
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalogue.json'), 'utf8')), cov = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/covers.json'), 'utf8')).covers.map((c) => c.work));
const approvals = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/approvals.json'), 'utf8'));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const rd = (f) => fs.readFileSync(f, 'utf8');
const PAT = /^https:\/\/m\.media-amazon\.com\/images\/P\/[A-Z0-9]{10}\.01\._SCLZZZZZZZ_\.jpg$/;

ok(approvals.amazonHostedCovers?.approved === true && approvals.amazonHostedCovers.basis === 'owner-instruction', 'the owner\'s instruction is recorded in config/approvals.json');
const SITE = path.join(ROOT, 'site');
const htmls = walk(SITE).filter((f) => f.endsWith('.html'));
const found = new Map(); // work slug -> image id
for (const f of htmls) { const m = f.match(/books\/([^/]+)\/index\.html$/); if (!m) continue; const t = rd(f); const x = t.split('class="book-cover"')[1]?.slice(0, 1200).match(/data-amz-cover="([A-Z0-9]{10})"/); if (x) found.set(m[1], x[1]); }
const withCover = cat.works.filter((w) => cov.has(w.slug)), noCover = cat.works.filter((w) => !cov.has(w.slug) && w.purchasable !== false);
const eligible = (w) => ['ebook', 'paperback', 'hardcover', 'book'].some((f) => w.editions.some((e) => e.format === f && (e.asin || e.isbn10)));
ok(found.size > 100, `${found.size} static book pages show an Amazon-hosted cover over the placeholder`);
ok([...found.keys()].every((s) => !cov.has(s)), 'a work with a verified stored cover never gets an Amazon-hosted image');
ok(cat.works.filter((w) => w.editions.every((e) => e.format === 'audiobook')).every((w) => !found.has(w.slug)), 'audiobook-only works never get one');
ok(cat.works.filter((w) => w.purchasable === false).every((w) => !found.has(w.slug)), 'unverified placeholder records never get one');
const urls = htmls.flatMap((f) => [...rd(f).matchAll(/<img class="amz-img" src="([^"]+)"/g)].map((m) => m[1]));
ok(urls.length > 100 && urls.every((u) => PAT.test(u)), `all ${urls.length} Amazon image references use the exact approved URL pattern (no query strings, no other host)`);
ok(htmls.every((f) => { const t = rd(f); return !/ssl-images-amazon|fls-na\.amazon/.test(t); }), 'no legacy Amazon image host, tracking pixel or widget');
ok(walk(path.join(SITE, 'assets')).filter((f) => /\.(webp|jpe?g|png|gif)$/i.test(f) && f.includes('/covers/')).length === 2 * JSON.parse(rd(path.join(ROOT, 'data/covers.json'))).covers.length, 'no Amazon image was downloaded into the site: stored covers are exactly the verified ones');
ok(htmls.filter((f) => /data-amz-cover/.test(rd(f))).every((f) => /referrerpolicy="no-referrer"/.test(rd(f))), 'Amazon images are requested without a referrer');
const off = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, FM_AMAZON_COVERS: 'off', FM_OUT: 'test/out-amz-off' }, encoding: 'utf8' });
const offFiles = walk(path.join(ROOT, 'test/out-amz-off')).filter((f) => /\.html$|assets\/idx\//.test(f)); // app.js and ask.js hold the inert loader
ok(off.status === 0 && offFiles.every((f) => !/media-amazon\.com\/images|{"a":"[A-Z0-9]{10}"}/.test(rd(f))), 'FM_AMAZON_COVERS=off removes every Amazon image reference (the switch works)');
const pkgOf = (name, files) => { const d = path.join(ROOT, 'test/out-amz-gate', name); fs.rmSync(d, { recursive: true, force: true }); for (const [p, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true }); fs.writeFileSync(path.join(d, p), c); } return d; };
const good = '<!doctype html><title>t</title><div class="cover"><img src="https://m.media-amazon.com/images/P/B0GFQ63JSF.01._SCLZZZZZZZ_.jpg" alt="x"></div>';
const bad = '<!doctype html><title>t</title><img src="https://m.media-amazon.com/images/I/71qT0s9oDxL._SY522_.jpg" alt="x">';
const g1 = scanPackage(pkgOf('good', { 'index.html': good }), { approvals: { amazonHostedCovers: { approved: true } } });
const g2 = scanPackage(pkgOf('noapproval', { 'index.html': good }), { approvals: {} });
const g3 = scanPackage(pkgOf('badpattern', { 'index.html': bad }), { approvals: { amazonHostedCovers: { approved: true } } });
ok(!g1.fail.some((x) => /Amazon-hosted/.test(x)), 'the security gate accepts the approved URL pattern when the approval is recorded');
ok(g2.fail.some((x) => /Amazon-hosted/.test(x)), 'the security gate rejects it when the approval is not recorded');
ok(g3.fail.some((x) => /Amazon-hosted/.test(x)), 'the security gate rejects any other Amazon image URL even with the approval');
console.log(fails ? `\n${fails} check(s) FAILED, ${passes} passed` : `\nAll ${passes} Amazon-hosted-cover checks passed`);
process.exit(fails ? 1 : 0);
