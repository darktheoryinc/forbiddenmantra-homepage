#!/usr/bin/env node
// Niche guide pages + the build-time affiliate guard.
//   node test/verify-niches.mjs      (uses the default site/ build; the guard tests build into throwaway directories)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SITE = path.join(ROOT, 'site');
const cat = J('data/catalogue.json'), tax = J('data/taxonomy.json'), nd = J('data/niches.json');
const read = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8');
const ID = J('config/site.json').affiliate.marketplaces['amazon.com'].trackingId;

for (const n of nd.niches) {
  const depIds = new Set(tax.departments.map((d) => d.id));
  ok([...n.departments, ...n.shelves, ...n.relatedDepartments].every((d) => depIds.has(d)), `${n.id}: every department exists in the taxonomy`);
  const expected = cat.works.filter((w) => w.subjects.some((s) => n.departments.includes(s)));
  const html = read(`niches/${n.id}/index.html`);
  ok(expected.length > 0 && html.includes(`${expected.length} book`), `${n.id}: page lists ${expected.length} books derived from the catalogue`);
  ok(/<h1>/.test(html) && html.includes('Featured authors') && html.includes('Related subjects') && html.includes('data-filterbar') && html.includes('data-index-grid') || html.includes('data-filterable'), `${n.id}: hero, featured authors, related subjects, search/filters, grid`);
  ok(html.includes('From Forbidden Mantra Press') && html.includes('data-own="fmp"') || html.includes('does not currently publish'), `${n.id}: own-publication section is present and honest about coverage`);
  ok(html.includes('As an Amazon Associate'), `${n.id}: affiliate disclosure on the page`);
  ok((html.match(/href="https:\/\/www\.amazon\.com[^"]*"/g) || []).every((u) => u.includes(`tag=${ID}`)), `${n.id}: every Amazon link carries ${ID}`);
  ok((html.match(/<a class="btn"[^>]*amazon\.com[^>]*>/g) || []).every((a) => /rel="sponsored/.test(a) && /data-own=/.test(a) && /data-linktype=/.test(a)), `${n.id}: buy links are sponsored and carry tracking dimensions`);
}
ok(/Guides by interest/.test(read('index.html')) && read('index.html').includes('niches/magic-witchcraft/'), 'home links to the guides');

// ---- build-time guard: a broken tag must fail the build ----
const run = (cfgEdit, env = {}) => {
  const dir = path.join(ROOT, 'test/fixtures/guard-cfg'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const c = J('config/site.json'); cfgEdit(c); fs.writeFileSync(path.join(dir, 'site.json'), JSON.stringify(c));
  return spawnSync('node', [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, env: { ...process.env, ...env, FM_CONFIG: 'test/fixtures/guard-cfg/site.json', FM_OUT: 'test/out-guard', FM_DATA: 'test/fixtures/guard-data' }, encoding: 'utf8' });
};
fs.rmSync(path.join(ROOT, 'test/fixtures/guard-data'), { recursive: true, force: true }); fs.cpSync(path.join(ROOT, 'data'), path.join(ROOT, 'test/fixtures/guard-data'), { recursive: true });
const grep = fs.readFileSync(path.join(ROOT, 'scripts/build.mjs'), 'utf8');
if (/FM_CONFIG/.test(grep)) {
  let r = run((c) => { c.affiliate.marketplaces['amazon.com'].trackingId = 'wrongid-20'; });
  ok(r.status !== 0 && /AFFILIATE GUARD FAILED/.test(r.stderr), 'guard: a changed US tracking ID fails the build');
  r = run((c) => { c.affiliate.marketplaces['amazon.com'].trackingId = null; }, { AMAZON_TRACKING_ID: '', AMAZON_TRACKING_ID_COM: '' });
  ok(r.status !== 0 || /no ID configured/.test(r.stdout), 'guard: a missing US tracking ID does not pass silently');
  r = run((c) => { c.affiliate.marketplaces['amazon.co.uk'].trackingId = 'darktheoryinc-20'; });
  ok(r.status !== 0 && /US tracking ID is on amazon\.co\.uk/.test(r.stderr), 'guard: the US ID on a UK link fails the build');
} else console.log('SKIP guard tests: build.mjs has no FM_CONFIG override');

// ---- browser: niche page behaviour ----
const browser = await launch();
if (browser) for (const [name, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile' }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.route(/fonts\.(googleapis|gstatic)/, (x) => x.abort()); await pg.route(/^https?:\/\/(?!file)/, (x) => x.abort());
  for (const n of nd.niches) {
    await pg.goto(urlOf(SITE)(`niches/${n.id}/index.html`));
    await pg.waitForTimeout(400);
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok(sw, `[${name}] ${n.id}: no horizontal page scroll`);
    const total = await pg.locator('[data-count]').first().textContent().catch(() => '');
    await pg.fill('.filters input[name=q]', 'zzzznomatch'); await pg.waitForTimeout(500);
    const empty = await pg.locator('[data-empty]').first().isVisible().catch(() => false);
    ok(empty, `[${name}] ${n.id}: search with no match shows the empty state`);
    await pg.fill('.filters input[name=q]', ''); await pg.waitForTimeout(400);
  }
  ok(!errs.length, `[${name}] no JS errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
await browser?.close();
console.log(state.fails ? `\n${state.fails} check(s) FAILED, ${state.passes} passed` : `\nAll ${state.passes} niche checks passed`);
process.exit(state.fails ? 1 : 0);
