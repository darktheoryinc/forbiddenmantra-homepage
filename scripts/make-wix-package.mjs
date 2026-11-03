#!/usr/bin/env node
// Builds the Wix package: the full site plus the small Wix embed helper.
//   node scripts/make-wix-package.mjs            -> wix/forbiddenmantra-site-for-hosting.zip  and the same files unzipped in wix/hosting/   (PREVIEW build)
//   FM_ENV=production FM_SITE_URL=https://... node scripts/make-wix-package.mjs                (PRODUCTION build; refuses until the launch blockers are cleared)
// The zip is made with Info-ZIP (`zip -X`: plain deflate, forward-slash paths, directory entries, no Unix extras), index.html first, then
// verified by scripts/verify-wix-package.mjs. wix/hosting/ holds the identical files for drag-and-drop of a FOLDER (Netlify Drop accepts a folder or a zip).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { scanPackage } from './security-gate.mjs';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prod = process.env.FM_ENV === 'production';
if (prod) { // the address the pages are built for must be the address the owner recorded
  const rec = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/approvals.json'), 'utf8')).productionAddress?.url ?? null; } catch { return null; } })();
  const want = (process.env.FM_SITE_URL ?? rec ?? '').replace(/\/$/, '');
  if (rec && want !== rec.replace(/\/$/, '')) { console.error(`REFUSED: FM_SITE_URL (${want}) differs from the production address recorded in config/approvals.json (${rec}).`); process.exit(1); }
}
const stage = path.join(ROOT, 'test/out-wixpkg');
fs.rmSync(stage, { recursive: true, force: true });
execFileSync('node', [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, env: { ...process.env, FM_WIX: '1', FM_PUBLIC: '1', FM_OUT: 'test/out-wixpkg' }, stdio: 'inherit' });
// Netlify reads _headers: a preview must not be indexed by search engines. (A production package leaves indexing to the owner's decision.)
// Production keeps the robots.txt the build wrote (Allow + the Sitemap line for the recorded domain); previews are closed to crawlers.
if (!prod || !fs.existsSync(path.join(stage, 'robots.txt'))) fs.writeFileSync(path.join(stage, 'robots.txt'), prod ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
// Security headers for hosts that read _headers (Netlify, Cloudflare Pages). No frame-ancestors on purpose: it would block the Wix embed if a Wix preview domain were missed.
const AMZ_IMG = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/approvals.json'), 'utf8')).amazonHostedCovers?.approved === true && process.env.FM_AMAZON_COVERS !== 'off'; } catch { return false; } })();
const SEC = `  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:${AMZ_IMG ? ' https://m.media-amazon.com' : ''}; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'\n`;
fs.writeFileSync(path.join(stage, '_headers'), `/*\n${SEC}${prod ? '' : '  X-Robots-Tag: noindex, nofollow\n'}`);
// SAFETY GATE: nothing is zipped or copied into wix/ unless the package passes.
const gate = scanPackage(stage, { production: prod });
console.log(`security gate: ${gate.info.files} files, NVIDIA-related files ${gate.info.nvidiaFiles}, tags ${JSON.stringify(gate.info.affiliateTags)}`);
if (!gate.ok) { console.error(`SECURITY GATE FAILED (${gate.fail.length}); no package written:\n  ` + gate.fail.slice(0, 30).join('\n  ')); fs.rmSync(stage, { recursive: true, force: true }); process.exit(1); }
const zip = path.join(ROOT, 'wix/forbiddenmantra-site-for-hosting.zip'), hosting = path.join(ROOT, 'wix/hosting');
fs.mkdirSync(path.dirname(zip), { recursive: true }); fs.rmSync(zip, { force: true }); fs.rmSync(hosting, { recursive: true, force: true });
execFileSync('zip', ['-q', '-X', '-9', zip, 'index.html'], { cwd: stage });
execFileSync('zip', ['-q', '-r', '-X', '-9', zip, '.', '-x', 'index.html'], { cwd: stage });
fs.cpSync(stage, hosting, { recursive: true });
fs.rmSync(stage, { recursive: true, force: true });
const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
fs.writeFileSync(path.join(ROOT, 'wix/forbiddenmantra-site-for-hosting.zip.sha256'), `${sha}  forbiddenmantra-site-for-hosting.zip\n`);
console.log(`wrote ${path.relative(ROOT, zip)} (${fs.statSync(zip).size} bytes, sha256 ${sha.slice(0, 16)}…) and wix/hosting/ (${prod ? 'PRODUCTION' : 'PREVIEW'} build)`);
