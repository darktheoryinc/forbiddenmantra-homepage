#!/usr/bin/env node
// Automated accessibility audit with axe-core (not a repo dependency):
//   AXE_PATH=/path/to/node_modules/axe-core/axe.min.js node test/a11y.mjs [--all]
// Fails on any violation of impact serious/critical (and lists moderate/minor). Automated checks find roughly a third of
// accessibility problems; they do not replace manual keyboard and screen-reader testing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state, ok, launch, urlOf, VIEWPORTS } from './lib.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (n) => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : process.argv[i + 1]; };
const SITE = path.join(ROOT, argOf('site') ?? 'site');
const AXE = process.env.AXE_PATH; if (!AXE || !fs.existsSync(AXE)) { console.log('SKIP a11y: set AXE_PATH to axe.min.js (npm i axe-core in a scratch directory)'); process.exit(0); }
const axeSrc = fs.readFileSync(AXE, 'utf8');
const all = []; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? w(path.join(d, e.name)) : e.name === 'index.html' && all.push(path.relative(SITE, path.join(d, e.name))); })(SITE);
const sample = ['index.html', 'books/index.html', 'search/index.html', 'books/harry-potter-and-the-philosophers-stone/index.html', 'books/the-apocalypse-of-adam/index.html', 'books/the-power-of-now/index.html', 'authors/index.html', 'authors/neil-gaiman/index.html', 'subjects/fantasy-folklore-fiction/index.html', 'topics/gnosticism/index.html', 'traditions/gnostic/index.html', 'collections/harry-potter-discovery/index.html', 'paths/fantasy-where-to-begin/index.html', 'languages/index.html', 'languages/es/index.html', 'languages/en/index.html', 'press/index.html', 'articles/index.html', 'technology/index.html', 'about/privacy/index.html', 'about/affiliate-disclosure/index.html', 'about/catalogue-standards/index.html'];
sample.push('books/page/2/index.html', 'series/the-kingkiller-chronicle/index.html', 'search/index.html?q=wicca', 'books/index.html?lang=en&format=paperback');
const targets = argOf('only') ? argOf('only').split(',') : process.argv.includes('--all') ? all : sample;
const browser = await launch(); if (!browser) process.exit(0);
const url = urlOf(SITE); const seen = new Map();
for (const [name, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile' }); const pg = await ctx.newPage();
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  for (const t of targets) {
    const [tp, tq] = t.split('?'); await pg.goto(url(tp) + (tq ? '?' + tq : '')); if (tq) await pg.waitForTimeout(700); await pg.addScriptTag({ content: axeSrc });
    const res = await pg.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]?.trim()), count: v.nodes.length })));
    for (const v of res) { const k = `${v.id}`; const e = seen.get(k) ?? { ...v, pages: new Set(), total: 0 }; e.pages.add(`${name}:${t}`); e.total += v.count; seen.set(k, e); }
  }
  await ctx.close();
}
await browser.close();
const list = [...seen.values()];
for (const v of list) console.log(`${(v.impact ?? '').toUpperCase().padEnd(9)} ${v.id}: ${v.help} (${v.total} nodes on ${v.pages.size} page views)\n            e.g. ${v.nodes[0]}`);
ok(list.filter((v) => ['serious', 'critical'].includes(v.impact)).length === 0, `axe-core: no serious or critical violations across ${targets.length} pages at desktop and mobile widths`);
ok(list.length === 0, `axe-core: no violations of any impact (${list.length} rule(s) triggered)`);
console.log(state.fails ? `\n${state.fails} check(s) FAILED` : '\nAll accessibility checks passed');
process.exit(state.fails ? 1 : 0);
