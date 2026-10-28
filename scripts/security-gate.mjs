#!/usr/bin/env node
// Deployment safety gate. Scans a generated hosting package (a directory) and REJECTS it (exit 1) if it holds secrets, private data,
// non-public file types, approval-gated material without a recorded approval, or (for production) anything still marked as preview.
//   node scripts/security-gate.mjs <dir> [--production]
// Public affiliate tracking IDs (darktheoryinc-20) and public retailer/citation URLs are normal and are allowed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCovers } from './covers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ALLOWED_EXT = new Set(['.html', '.js', '.css', '.json', '.webp', '.svg', '.txt']);
export const ALLOWED_AFFILIATE_TAGS = new Set(['darktheoryinc-20']);
const ALLOWED_DOT = new Set(['_headers']);
const MAX_FILE = 5 * 1024 * 1024;
// Credential-shaped strings (NOT plain words: "secret" and "token" appear in book titles and prose).
const SECRET_RES = [
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/], ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/], ['Stripe key', /\b[sr]k_(live|test)_[0-9A-Za-z]{16,}\b/],
  ['GitHub token', /\b(gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{20,})\b/], ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/], ['JWT', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['NVIDIA API key', /\bnvapi-[0-9A-Za-z_-]{20,}/], ['Amazon API credential', /\bamzn1\.(application-oa2-client|oa2-cs)\.[0-9a-f]{20,}/],
  ['credential assignment', /\b(api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*["'][A-Za-z0-9\/+_=.-]{12,}["']/i],
  ['long hex/base64 secret', /\b(?:secret|token|key)["']?\s*[:=]\s*["'][0-9a-f]{32,}["']/i],
];
const PRIVATE_RES = [
  ['email address', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/], ['local file path', /(\/home\/[a-z]|\/root\/|\/tmp\/claude|C:\\Users\\|\/Users\/[a-z])/],
  ['internal tool reference', /(claude\.ai\/(code|artifact)|session_0[0-9A-Za-z]{10,}|\.claude\/|anthropic\.com\/|Co-Authored-By)/i], ['localhost/loopback URL', /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d+\.\d+\.\d+)/],
  ['private repository reference', /github\.com\/darktheoryinc\//i],
];
const DANGEROUS_JS = [['eval()', /\beval\s*\(/], ['new Function()', /\bnew\s+Function\s*\(/], ['document.write', /\bdocument\.write\s*\(/], ['string timer', /\bset(Timeout|Interval)\s*\(\s*["'`]/]];
const PREVIEW_MARKERS = [/preview build, not published/i, /<!-- preview build: not for production/i, /Draft for owner and legal review/i, /Preview note:/i, /TEST FIXTURE BUILD/i];

export function scanPackage(dir, { production = false, approvals = null, publicOut = true, coverKeys = null } = {}) {
  const fail = [], warn = [], info = {};
  const add = (list, sev, file, what) => list.push(`${sev} ${file}: ${what}`);
  const files = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } }; walk(dir);
  info.files = files.length;
  const rel = (f) => path.relative(dir, f).split(path.sep).join('/');
  const ap = approvals ?? (fs.existsSync(path.join(ROOT, 'config/approvals.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'config/approvals.json'), 'utf8')) : {});
  const ok = (k) => ap[k]?.approved === true;
  const verifiedKeys = coverKeys ?? new Set(loadCovers({ allowFixture: false }).entries.map((c) => c.key));
  const tags = new Set(); const hosts = new Set(); let nvidiaHits = 0, previewHits = 0;
  if (!files.some((f) => rel(f) === 'index.html')) add(fail, 'HIGH', 'index.html', 'missing at the package root');
  for (const f of files) {
    const r = rel(f), base = path.basename(f), ext = path.extname(f).toLowerCase(), st = fs.statSync(f);
    if (r.startsWith('assets/covers/')) { const m = base.match(/^(.+)-(240|480)\.webp$/); if (!m || !verifiedKeys.has(m[1])) add(fail, 'HIGH', r, 'cover image with no verified manifest entry (source and rights evidence are required in data/covers.json)'); }
    if (r.split('/').some((s) => s.startsWith('.') && !ALLOWED_DOT.has(s)) || /(^|\/)\.(env|git|ds_store|npmrc)|\.(map|pem|key|p12|pfx|env|log|bak|zip|md|mjs|py|sh|ts|sql|csv|psv|yml|yaml)$/i.test(r)) add(fail, 'CRITICAL', r, 'non-public / sensitive file type or hidden file');
    else if (r.startsWith('assets/brand/') && (ext === '.png' || ext === '.ico')) { /* owner-approved logo and favicon files */ }
    else if (!ALLOWED_EXT.has(ext) && !ALLOWED_DOT.has(base)) add(fail, 'HIGH', r, `file type ${ext || '(none)'} is not on the public allow-list`);
    if (st.size > MAX_FILE) add(fail, 'MEDIUM', r, `unexpectedly large (${st.size} bytes)`);
    if (st.size === 0) add(fail, 'MEDIUM', r, 'empty file');
    if (!['.html', '.js', '.css', '.json', '.svg', '.txt'].includes(ext) && !ALLOWED_DOT.has(base)) continue;
    const t = fs.readFileSync(f, 'utf8');
    for (const [n, re] of SECRET_RES) if (re.test(t)) add(fail, 'CRITICAL', r, `possible ${n} (value not shown)`);
    for (const [n, re] of PRIVATE_RES) if (re.test(t)) add(fail, 'HIGH', r, `contains a ${n}`);
    if (ext === '.js') for (const [n, re] of DANGEROUS_JS) if (re.test(t)) add(fail, 'MEDIUM', r, `uses ${n}`);
    if (ext === '.html') {
      for (const m of t.matchAll(/<script[^>]+src=["'](https?:)?\/\/[^"']+/gi)) add(fail, 'HIGH', r, 'loads a script from another website');
      if (/<iframe|<object|<embed/i.test(t)) add(fail, 'HIGH', r, 'contains an iframe/object/embed');
      for (const m of t.matchAll(/<form[^>]+action=["']https?:\/\/[^"']+/gi)) add(fail, 'HIGH', r, 'form posts to another website');
      for (const m of t.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](https?:\/\/[^"']+)/gi)) if (!/^https:\/\/fonts\.googleapis\.com\//.test(m[1])) add(fail, 'HIGH', r, 'stylesheet from an unapproved host');
      for (const m of t.matchAll(/\btag=([A-Za-z0-9_-]+)/g)) tags.add(m[1]);
      for (const m of t.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) hosts.add(m[1]);
      for (const m of t.matchAll(/\shttp:\/\/(?!www\.w3\.org|schema\.org)[A-Za-z0-9.-]+/g)) add(warn, 'LOW', r, `non-HTTPS link ${m[0].trim()}`);
    }
    if (/nvidia/i.test(t) || /nvidia/i.test(r)) nvidiaHits++;
    if (/iosutra-inception-member/.test(r)) nvidiaHits++;
    if (PREVIEW_MARKERS.some((re) => re.test(t))) previewHits++;
  }
  for (const tg of tags) if (!ALLOWED_AFFILIATE_TAGS.has(tg)) add(fail, 'HIGH', '(package)', `unknown Amazon tracking tag "${tg}"`);
  info.affiliateTags = [...tags]; info.externalHosts = hosts.size;
  // approval-gated material
  if (!ok('nvidiaBranding') && nvidiaHits) add(fail, 'HIGH', '(package)', `${nvidiaHits} file(s) carry NVIDIA branding, the Inception badge or the membership claim, but config/approvals.json has no nvidiaBranding approval`);
  // production gate
  if (production) {
    for (const k of ['nvidiaBranding', 'iosutraPromotion', 'iosutraArtworkRights', 'librarianArtworkRights', 'legalPagesReviewed', 'productionAddress']) if (!ok(k)) add(fail, 'BLOCKER', '(production)', `approval "${k}" is not recorded in config/approvals.json`);
    if (previewHits) add(fail, 'BLOCKER', '(production)', `${previewHits} file(s) still carry preview/draft markers`);
    if (!ap.productionAddress?.url) add(fail, 'BLOCKER', '(production)', 'no production address recorded');
  } else if (previewHits) add(warn, 'INFO', '(package)', `${previewHits} file(s) carry preview/draft markers (fine for a preview, blocked for production)`);
  info.nvidiaFiles = nvidiaHits; info.previewMarkedFiles = previewHits;
  return { ok: fail.length === 0, fail, warn, info };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2]; if (!dir) { console.error('usage: node scripts/security-gate.mjs <dir> [--production]'); process.exit(2); }
  const r = scanPackage(path.resolve(dir), { production: process.argv.includes('--production') });
  console.log(`security gate: ${r.info.files} files scanned, affiliate tags ${JSON.stringify(r.info.affiliateTags)}, NVIDIA-related files ${r.info.nvidiaFiles}, preview-marked files ${r.info.previewMarkedFiles}`);
  r.warn.slice(0, 10).forEach((w) => console.log('  ' + w));
  if (!r.ok) { console.error(`SECURITY GATE FAILED (${r.fail.length}):`); r.fail.slice(0, 40).forEach((f) => console.error('  ' + f)); process.exit(1); }
  console.log('security gate PASSED');
}
