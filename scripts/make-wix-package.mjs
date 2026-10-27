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
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prod = process.env.FM_ENV === 'production';
const stage = path.join(ROOT, 'test/out-wixpkg');
fs.rmSync(stage, { recursive: true, force: true });
execFileSync('node', [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, env: { ...process.env, FM_WIX: '1', FM_OUT: 'test/out-wixpkg' }, stdio: 'inherit' });
// Netlify reads _headers: a preview must not be indexed by search engines. (A production package leaves indexing to the owner's decision.)
if (!prod) fs.writeFileSync(path.join(stage, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
fs.writeFileSync(path.join(stage, 'robots.txt'), prod ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
const zip = path.join(ROOT, 'wix/forbiddenmantra-site-for-hosting.zip'), hosting = path.join(ROOT, 'wix/hosting');
fs.mkdirSync(path.dirname(zip), { recursive: true }); fs.rmSync(zip, { force: true }); fs.rmSync(hosting, { recursive: true, force: true });
execFileSync('zip', ['-q', '-X', '-9', zip, 'index.html'], { cwd: stage });
execFileSync('zip', ['-q', '-r', '-X', '-9', zip, '.', '-x', 'index.html'], { cwd: stage });
fs.cpSync(stage, hosting, { recursive: true });
fs.rmSync(stage, { recursive: true, force: true });
const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
fs.writeFileSync(path.join(ROOT, 'wix/forbiddenmantra-site-for-hosting.zip.sha256'), `${sha}  forbiddenmantra-site-for-hosting.zip\n`);
console.log(`wrote ${path.relative(ROOT, zip)} (${fs.statSync(zip).size} bytes, sha256 ${sha.slice(0, 16)}…) and wix/hosting/ (${prod ? 'PRODUCTION' : 'PREVIEW'} build)`);
