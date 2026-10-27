#!/usr/bin/env node
// Builds the Wix package: the full site plus the small Wix embed helper, zipped for upload to any static host.
//   node scripts/make-wix-package.mjs            -> wix/forbiddenmantra-site-for-hosting.zip   (preview build, shows the preview notice bar)
//   FM_ENV=production FM_SITE_URL=https://... node scripts/make-wix-package.mjs   (production build; refuses until the launch blockers are cleared)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'test/out-wixpkg');
execFileSync('node', [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, env: { ...process.env, FM_WIX: '1', FM_OUT: 'test/out-wixpkg' }, stdio: 'inherit' });
const zip = path.join(ROOT, 'wix/forbiddenmantra-site-for-hosting.zip');
fs.mkdirSync(path.dirname(zip), { recursive: true }); fs.rmSync(zip, { force: true });
execFileSync('python3', ['-c', `import zipfile,os,sys
z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED,compresslevel=9)
for r,d,f in sorted(os.walk(sys.argv[1])):
    for x in sorted(f):
        p=os.path.join(r,x); z.write(p,os.path.relpath(p,sys.argv[1]))
z.close()`, out, zip]);
fs.rmSync(out, { recursive: true, force: true });
console.log(`wrote ${path.relative(ROOT, zip)} (${(fs.statSync(zip).size / 1e6).toFixed(1)} MB)`);
