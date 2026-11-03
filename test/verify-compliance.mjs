#!/usr/bin/env node
// Compliance remediation checks (2026-11-03): no Amazon-hosted images, no automated Amazon requests, covers only where rights are documented,
// affiliate links and disclosures intact, catalogue and key features preserved. Builds into test/out-compliance (gitignored).
//   node test/verify-compliance.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf, VIEWPORTS } from './lib.mjs';
import { scanPackage } from '../scripts/security-gate.mjs';
import { isAmazon } from '../scripts/check-links.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const AMZ_IMG = /media-amazon|ssl-images-amazon|images-na\.|images-eu\.|images-fe\.|images-amazon|fls-na\.amazon/i;

// ---- 1. source code: nothing can build or request an Amazon image address ----
for (const f of ['scripts/build.mjs', 'scripts/assets/app.js', 'scripts/assets/ask.js', 'scripts/assets/librarian.js', 'scripts/assets/voice.js', 'scripts/assets/style.css', 'scripts/make-wix-package.mjs']) {
  ok(!AMZ_IMG.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), `${f}: no Amazon image host or image-address builder`);
}
const approvals = J('config/approvals.json');
ok(approvals.amazonHostedCovers?.approved === false && approvals.amazonHostedCovers.withdrawnOn === '2026-11-03', 'config/approvals.json records the Amazon-hosted covers as withdrawn');

// ---- 2. the automated link checker never requests Amazon ----
ok(['https://www.amazon.com/dp/1577314808?tag=x-20', 'https://www.amazon.co.uk/s?k=1', 'https://amzn.to/abc', 'https://a.co/d/abc', 'https://m.media-amazon.com/images/P/x.jpg', 'https://images-na.ssl-images-amazon.com/x.jpg'].every(isAmazon) && !isAmazon('https://bookshop.org/x') && !isAmazon('https://www.worldcat.org/search?q=1'), 'check-links treats every Amazon address (amazon.*, amzn.*, a.co, image hosts) as off limits and leaves other retailers alone');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-cl-')); const lf = path.join(tmp, 'links.json'); fs.writeFileSync(lf, JSON.stringify({ links: [{ url: 'https://www.amazon.com/dp/1577314808?tag=darktheoryinc-20', title: 'x' }, { url: 'http://127.0.0.1:9/unreachable', title: 'y' }] }));
  const r = spawnSync('node', ['scripts/check-links.mjs', '--links', lf, '--delay', '0', '--timeout', '800'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FM_DATA: path.relative(ROOT, tmp) } });
  ok(r.status === 0 && /1\/1/.test(r.stdout) && !/amazon\.com/.test(r.stdout), 'running check-links on a list that contains an Amazon link processes only the non-Amazon link (the Amazon link is never requested)');
  fs.rmSync(tmp, { recursive: true, force: true });
}
{
  const t = fs.readFileSync(path.join(ROOT, 'scripts/check-links.mjs'), 'utf8');
  ok(/\.filter\(\(l\) => OVERRIDE \|\| !isAmazon\(l\.url\)\)/.test(t) && /if \(isAmazon\(target\)\)/.test(t), 'check-links filters Amazon links before the loop and again immediately before each request');
  const others = ['scripts/harvest.mjs', 'scripts/covers-bulk.mjs', 'scripts/amazon-cover-plan.mjs', 'scripts/asin-hints.mjs', 'scripts/audit-affiliate.mjs'].map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
  ok(others.every(([, s]) => !/fetch\(\s*[`'"]https?:\/\/[^`'"]*amazon/i.test(s)), 'no other script fetches an Amazon address');
}

// ---- 3. a real build contains no Amazon image address anywhere ----
const OUT = 'test/out-compliance', out = path.join(ROOT, OUT);
fs.rmSync(out, { recursive: true, force: true });
const b = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, FM_OUT: OUT, FM_PUBLIC: '1', FM_WIX: '1' } });
ok(b.status === 0, `build succeeds${b.status === 0 ? '' : ': ' + (b.stderr || b.stdout).slice(-300)}`);
if (b.status === 0) {
  const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } })(out);
  const rel = (f) => path.relative(out, f).split(path.sep).join('/');
  let hits = 0, remoteImg = 0, recA = 0; const sample = [];
  for (const f of files) {
    if (!/\.(html|js|css|json|svg|txt)$/.test(f)) continue;
    const t = fs.readFileSync(f, 'utf8');
    if (AMZ_IMG.test(t)) { hits++; if (sample.length < 3) sample.push(rel(f)); }
    if (f.endsWith('.html')) { for (const m of t.matchAll(/<img[^>]+src="([^"]+)"/g)) if (/^(https?:)?\/\//.test(m[1])) remoteImg++; }
    if (f.includes('assets/idx/') && /[{,]a:"[A-Z0-9]{10}"/.test(t)) recA++;
  }
  ok(hits === 0, `no file in the built site contains an Amazon image address (${files.length} files scanned; hits ${hits} ${sample.join(', ')})`);
  ok(remoteImg === 0, `no <img> in any page points to another website (${remoteImg})`);
  ok(recA === 0, 'the search index holds no Amazon image identifiers');
  const g = scanPackage(out, { production: false });
  ok(g.ok, `security gate passes on the build${g.ok ? '' : ': ' + g.fail.slice(0, 3).join(' | ')}`);

  // ---- 4. covers: only documented rights are published; the rest are title-and-author cards ----
  const m = J('data/covers.json').covers; const pub = new Set(files.filter((f) => /assets\/covers\/.+-240\.webp$/.test(rel(f))).map((f) => path.basename(f).replace(/-240\.webp$/, '')));
  const key = (c) => `${c.work}__${c.edition}`;
  const published = m.filter((c) => pub.has(key(c))), withheld = m.filter((c) => !pub.has(key(c)));
  ok(published.length > 0 && published.every((c) => c.source.type === 'owner-supplied' && c.rights?.confirmedBy && /^\d{4}-\d{2}-\d{2}$/.test(c.rights.confirmedOn)), `every published cover is owner-supplied artwork with a recorded rights confirmation (${published.length} published)`);
  ok(withheld.length === 67 && withheld.every((c) => c.source.type === 'publisher-permission' && c.rights?.specificPermission !== true), `the ${withheld.length} stored covers that rely on general publisher terms are not published`);
  const prh = withheld[0], prhPage = fs.readFileSync(path.join(out, `books/${prh.work}/index.html`), 'utf8');
  ok(/class="cover cover-ph/.test(prhPage) && !new RegExp(`${key(prh)}-240`).test(prhPage), `a book that had a publisher cover (${prh.work}) now shows a title-and-author card`);
  const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  ok((home.match(/class="cover cover-ph/g) ?? []).length > 3, 'the homepage shows title-and-author cards for books without a documented cover');

  // ---- 5. preserved: catalogue, affiliate links, disclosures, privacy, features ----
  const cat = J('data/catalogue.json');
  ok(cat.works.length === 16711 && cat.works.reduce((n, w) => n + w.editions.length, 0) === 31061 && cat.authors.length === 10967, 'catalogue: 16,711 works, 31,061 editions, 10,967 authors');
  const prot = new Set(J('config/protected-original-isbns.json').isbns), have = new Set(cat.works.flatMap((w) => w.editions.map((e) => e.isbn13 ?? e.asin)));
  ok([...prot].every((i) => have.has(i)), 'all original edition identifiers are still in the catalogue');
  const book = fs.readFileSync(path.join(out, 'books/the-power-of-now/index.html'), 'utf8');
  ok(/href="https:\/\/www\.amazon\.com\/[^"]*tag=darktheoryinc-20"/.test(book) && /rel="sponsored/.test(book) && /As an Amazon Associate I earn from qualifying purchases\./.test(book), 'a book page keeps its tagged Amazon link (tag darktheoryinc-20, rel=sponsored) and the Associates statement');
  const tags = new Set(); let links = 0;
  for (const f of files.filter((x) => x.endsWith('.html'))) for (const mm of fs.readFileSync(f, 'utf8').matchAll(/amazon\.com[^"'<>\s]*[?&]tag=([A-Za-z0-9_-]+)/g)) { tags.add(mm[1]); links++; }
  ok(links > 5000 && tags.size === 1 && tags.has('darktheoryinc-20'), `all ${links} Amazon links carry only the tracking ID darktheoryinc-20`);
  const priv = fs.readFileSync(path.join(out, 'about/privacy/index.html'), 'utf8');
  ok(!/Amazon.s image servers|m\.media-amazon/i.test(priv) && /Retailer and partner links/.test(priv), 'the Privacy page no longer describes Amazon-loaded covers and still explains retailer links');
  ok(/data-ask-form/.test(home) && /class="ask-face"/.test(home) && fs.existsSync(path.join(out, 'assets/voice.js')) && /data-promo="iosutra-technology"/.test(home) && fs.existsSync(path.join(out, 'assets/partner/nvidia-inception-program-badge-rgb-for-screen.svg')), 'Digital Librarian, voice search, IOSutra promotion and the NVIDIA badge are still present');

  // ---- 6. browser: no Amazon request is attempted on any kind of page ----
  const browser = await launch();
  if (browser) for (const [name, vp] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile' }); const pg = await ctx.newPage();
    const external = []; await pg.route(/^https?:\/\//, (r) => { external.push(r.request().url()); r.abort(); });
    const url = (p) => pathToHref(p);
    const pathToHref = (p) => { const [a, q] = p.split('?'); return urlOf(out)(a) + (q ? '?' + q : ''); };
    const visit = async (p, after) => { await pg.goto(url(p)); await pg.waitForTimeout(500); if (after) await after(); };
    await visit('index.html', async () => { await pg.fill('#ask-q', 'books about tarot'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(1200); });
    await visit('books/index.html', async () => { await pg.fill('.filters input[name=q]', 'kundalini'); await pg.waitForTimeout(1500); });
    await visit('search/index.html?q=yoga', async () => { await pg.waitForTimeout(1500); });
    await visit('books/the-power-of-now/index.html');
    await visit('book/index.html?s=' + encodeURIComponent(cat.works.find((w) => w.provenance?.workKey)?.slug ?? 'the-power-of-now'));
    await visit('niches/magic-witchcraft/index.html', async () => { await pg.waitForTimeout(800); });
    await visit('topics/ceremonial-magic/index.html');
    const amz = external.filter((u) => /amazon|amzn/i.test(u));
    ok(amz.length === 0, `[${name}] no request to any Amazon address while loading the homepage (and asking the Librarian), All Books (and searching), search results, a book page, the dynamic book page, a guide and a topic page (${external.length} external requests attempted, ${amz.length} to Amazon${amz[0] ? ': ' + amz[0] : ''})`);
    ok(external.every((u) => !/images?\./i.test(new URL(u).hostname)), `[${name}] no image request leaves the site`);
    await ctx.close();
  }
  if (browser) await browser.close();
}
fs.rmSync(out, { recursive: true, force: true });
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} compliance checks passed`);
process.exit(state.fails ? 1 : 0);
