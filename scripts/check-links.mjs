#!/usr/bin/env node
// Live retailer-link checker. Run on a machine with normal internet access (the build sandbox blocks retailers):
//   node scripts/build.mjs && node scripts/check-links.mjs [--limit N] [--delay 1500] [--links file] [--origin-override http://127.0.0.1:PORT]
// Reads data/retailer-links.json (written by the build), requests each URL, and writes data/link-check.json.
// The next build then hides dead links and labels verified ones. Be polite: it is sequential with a delay, and retailers may block
// automated requests (reported as "blocked", never as dead). No credentials are used or stored.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const DATA = process.env.FM_DATA ?? 'data';
const LINKS = arg('links', path.join(DATA, 'retailer-links.json'));
const OUTFILE = path.join(ROOT, DATA, 'link-check.json');
const DELAY = +arg('delay', 1500), LIMIT = +arg('limit', 100000), OVERRIDE = arg('origin-override', null), TIMEOUT = +arg('timeout', 20000);
const today = process.env.FM_TODAY ?? new Date().toISOString().slice(0, 10);

const BLOCK = /Robot Check|Enter the characters you see below|Sorry, we just need to make sure you're not a robot|api-services-support@amazon\.com|captcha/i;
const words = (s) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !['this', 'that', 'with', 'from', 'book', 'books', 'amazon', 'edition'].includes(w));

export function judge({ status, body, title: expectTitle }) {
  if (status === 404 || status === 410) return { verdict: 'dead' };
  if (status === 429 || status === 403 || status === 503 || status >= 500) return { verdict: 'blocked' };
  if (status >= 200 && status < 300) {
    if (BLOCK.test(body)) return { verdict: 'blocked' };
    const page = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
    const want = words(expectTitle), have = new Set(words(page));
    const hits = want.filter((w) => have.has(w)).length;
    return { verdict: want.length === 0 || hits / want.length >= 0.5 ? 'live' : 'mismatch', pageTitle: page.slice(0, 140) };
  }
  return { verdict: 'error' };
}

async function main() {
  const all = JSON.parse(fs.readFileSync(path.isAbsolute(LINKS) ? LINKS : path.join(ROOT, LINKS), 'utf8')).links.slice(0, LIMIT);
  const prev = fs.existsSync(OUTFILE) ? JSON.parse(fs.readFileSync(OUTFILE, 'utf8')).results ?? {} : {};
  const results = { ...prev }; const tally = {};
  for (const [i, l] of all.entries()) {
    let target = l.url;
    if (OVERRIDE) { const u = new URL(l.url); target = OVERRIDE + u.pathname + u.search; }
    let r;
    try {
      const res = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ForbiddenMantraLinkCheck/1.0)', 'Accept-Language': 'en' } });
      r = judge({ status: res.status, body: await res.text(), title: l.title });
      r.status = res.status;
    } catch (e) { r = { verdict: 'error', error: String(e.cause?.code ?? e.name) }; }
    if (r.verdict !== 'error') results[l.url] = { ...r, checkedOn: today }; // errors leave any earlier result untouched
    tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
    console.log(`${String(i + 1).padStart(3)}/${all.length} ${r.verdict.padEnd(8)} ${r.status ?? r.error ?? ''} ${l.url}`);
    if (i < all.length - 1) await new Promise((x) => setTimeout(x, DELAY));
  }
  fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
  fs.writeFileSync(OUTFILE, JSON.stringify({ checkedOn: today, note: 'Results of scripts/check-links.mjs. dead = HTTP 404/410 (hidden by the build); blocked = retailer refused or showed a robot check (kept, not proof of anything); mismatch = page exists but its title does not resemble the book.', results }, null, 1));
  console.log('\n' + JSON.stringify(tally));
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
