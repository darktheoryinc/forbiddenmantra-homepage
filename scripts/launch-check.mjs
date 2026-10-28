#!/usr/bin/env node
// Launch readiness: node scripts/launch-check.mjs [--json]
// Computes blockers from the repository state (config, catalogue, link checks, promos, articles). Exit code 1 if any BLOCKER.
//   BLOCKER  must be fixed before launch      DECISION  the owner must choose      WARN  should be fixed      PASS  verified
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as promo from './promo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p, d = null) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return d; } };
const cfg = J('config/site.json'), cat = J('data/catalogue.json'), rep = J('data/import-report.json'), q = J('data/error-queue.json', { items: [] }).items;
const lc = J('data/link-check.json', { results: {} }).results, links = J('data/retailer-links.json', { links: [] }).links;
const arts = J('data/articles-report.json'), reg = J('data/promos.json');
const items = []; const add = (level, area, what, detail = '') => items.push({ level, area, what, detail });

// hosting & URL
add(cfg.siteUrl || process.env.FM_SITE_URL ? 'PASS' : 'DECISION', 'Hosting', 'Production URL and host', cfg.siteUrl ? cfg.siteUrl : 'No siteUrl set and no deploy configuration exists. Choose a host (a free static host is enough) and set config/site.json "siteUrl".');
// affiliate
const tag = (m) => process.env[`AMAZON_TRACKING_ID_${m.replace(/^amazon\./, '').toUpperCase().replace(/\./g, '_')}`] || (m === 'amazon.com' && process.env.AMAZON_TRACKING_ID) || cfg.affiliate.marketplaces[m]?.trackingId;
add(tag('amazon.com') ? 'PASS' : 'BLOCKER', 'Revenue', 'Amazon Associates tracking ID for amazon.com', tag('amazon.com') ? 'set' : 'Not recovered. Without it no sale is attributed to you. See docs/AFFILIATE-AND-DEPLOYMENT.md.');
const ukUsed = links.some((l) => l.market === 'amazon.co.uk');
if (ukUsed) add(tag('amazon.co.uk') ? 'PASS' : 'WARN', 'Revenue', 'Tracking ID for amazon.co.uk (used by UK editions)', tag('amazon.co.uk') ? 'set' : 'Links work but earn nothing until an amazon.co.uk ID is set.');
const unknownMk = Object.entries(cfg.affiliate.marketplaces).filter(([, v]) => v.enrolled !== true).map(([k]) => k);
add(cfg.affiliate.marketplaces['amazon.com'].enrolled === true ? 'PASS' : 'WARN', 'Revenue', 'Associates enrollment (US confirmed)', `amazon.com confirmed by the owner. Unconfirmed, with no ID configured: ${unknownMk.length} other marketplaces (links there carry no tag, by design).`);
// affiliate audit (scripts/audit-affiliate.mjs, offline)
const aa = J('data/affiliate-audit.json');
if (aa) add(aa.summary.linkErrors === 0 ? 'PASS' : 'BLOCKER', 'Revenue', 'Affiliate link audit', `${aa.summary.purchaseLinks} purchase links, ${aa.summary.linkErrors} errors. ${aa.summary.worksWithValidTaggedProductLink} works have a tagged product link; ${aa.summary.worksWithSearchLinkOnly} have only a search link; ${aa.summary.recordsNeedingManualReview} records need manual review.`);
else add('WARN', 'Revenue', 'Affiliate link audit', 'Run scripts/audit-affiliate.mjs after a build.');
// link validity
const total = links.length, st = { live: 0, dead: 0, blocked: 0, mismatch: 0, inconclusive: 0, unchecked: 0 };
for (const l of links) st[lc[l.url]?.verdict ?? 'unchecked']++;
add(total && st.live === total ? 'PASS' : st.live + st.blocked === 0 ? 'BLOCKER' : 'WARN', 'Links', `Retail link validity (${total} URLs)`, `live ${st.live}, dead ${st.dead} (hidden), blocked ${st.blocked}, mismatch ${st.mismatch}, inconclusive ${st.inconclusive}, never checked ${st.unchecked}. Run scripts/check-links.mjs on a networked machine.`);
const noId = cat.works.filter((w) => w.press).flatMap((w) => w.editions).filter((e) => !e.isbn13 && !e.asin).length;
add(noId === 0 ? 'PASS' : 'WARN', 'Catalogue', 'Forbidden Mantra Press editions have identifiers', `${noId} editions have no ASIN/ISBN yet and use search links. Needs a KDP / Author Central export.`);
const nPress = cat.works.filter((w) => w.press).length, flagged = cat.works.filter((w) => w.reviewFlags?.length).map((w) => w.title);
add('WARN', 'Catalogue', 'Press titles still unconfirmed by owner', `Mo Pai Nei Kung, The Hidden Technology of Human Power and Forbidden Mantra have no confirmed edition data. ${nPress} press titles are listed; every one is owner-listed and none has independently verified publisher attribution. Flagged for owner confirmation: ${flagged.join('; ') || 'none'}.`);
const errs = q.filter((i) => i.severity === 'error').length;
add(errs === 0 ? 'PASS' : 'WARN', 'Catalogue', 'Import error queue', `${errs} errors, ${q.filter((i) => i.severity === 'duplicate').length} duplicates, ${q.filter((i) => i.severity === 'warning').length} warnings. ${rep.staged.works} candidates remain staged (unpublished).`);
// promo
const v = promo.validate(reg, { root: ROOT, production: true });
add(v.errors.length + v.blockers.length === 0 ? 'PASS' : 'BLOCKER', 'IOSutra', 'Cross-promotion gate', v.errors.concat(v.blockers).join(' | ') || 'clear');
// legal / privacy / analytics
add(fs.existsSync(path.join(ROOT, 'site/about/privacy/index.html')) ? 'WARN' : 'BLOCKER', 'Legal', 'Privacy page exists but needs owner/legal review', 'Describes current behaviour (no cookies, no analytics, Google Fonts). Add a real contact method, and update it before enabling analytics.');
add(cfg.analytics.provider ? 'PASS' : 'DECISION', 'Analytics', 'Analytics provider', cfg.analytics.provider ?? 'Off. Outbound clicks are already tagged; choose a cookie-free provider (e.g. GoatCounter, free) or none.');
// content
add(arts ? 'PASS' : 'WARN', 'Content', `Blog connections (${arts?.uniqueArticles ?? 0} articles linked)`, arts ? `${arts.duplicatePosts} duplicate-title posts on the blog are not shown; ${arts.flags.length} post has scaffolding text in its title. Connections are keyword suggestions, not editorial review.` : 'Run scripts/import-articles.mjs.');
add('WARN', 'Content', 'Interface translations are machine-drafted betas', 'es, fr, de, pt, it, ar, hi need native-speaker review before leaving beta.');
add('WARN', 'Strategy', 'October 26 expansion strategy document not in the repository', 'Work used the priorities in the request only. Add the document to docs/ for a fuller gap analysis.');

if (process.argv.includes('--json')) console.log(JSON.stringify(items, null, 1));
else {
  const order = { BLOCKER: 0, DECISION: 1, WARN: 2, PASS: 3 };
  for (const i of items.sort((a, b) => order[a.level] - order[b.level])) console.log(`${i.level.padEnd(8)} ${i.area.padEnd(10)} ${i.what}${i.detail ? '\n           ' + i.detail : ''}`);
  const n = (l) => items.filter((i) => i.level === l).length;
  console.log(`\n${n('BLOCKER')} blocker(s), ${n('DECISION')} owner decision(s), ${n('WARN')} warning(s), ${n('PASS')} passed. ${n('BLOCKER') + n('DECISION') ? 'NOT ready to launch.' : 'Ready.'}`);
}
process.exit(items.some((i) => i.level === 'BLOCKER' || i.level === 'DECISION') ? 1 : 0);
