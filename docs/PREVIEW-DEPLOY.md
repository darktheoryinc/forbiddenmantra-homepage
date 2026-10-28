# Netlify preview: update instructions (NOT executed)

Nothing here has been run against Netlify, Wix or DNS. Approval is required before any step marked **[needs approval]**.

## What is known about unrivaled-liger-1baec4.netlify.app
- **Not inspectable from this environment.** The network policy returns 403 for netlify.app, so its live content, deploy history, claim status and settings could not be read. Nothing below about the live site is verified.
- **Repository evidence of what was last uploaded:** the package in `wix/` was built at commit `8f14416` and contains 198 works / 230 editions and 580 files. The repository now has **311 works / 632 editions** and a preview build of 913 files. If the hosted site is that package, it is **stale**. Confirm by opening the site and checking the catalogue count.
- **Deployment method (from `wix/INSTALL-IN-WIX.md`):** Netlify Drop (app.netlify.com/drop), drag in the ZIP or the extracted folder `wix/hosting/` (top level contains `index.html`). It is a static site: **no build command, publish directory = the ZIP/folder root**. There is no `netlify.toml` in the repository; headers come from the package's `_headers` file.

## Build (what makes the new package) [needs approval: it rewrites wix/ and the ZIP]
```
node scripts/import.mjs            # only if staging changed; data/catalogue.json is already committed
node scripts/make-wix-package.mjs  # preview build: public (FM_PUBLIC=1), noindex, runs the security gate, writes wix/forbiddenmantra-site-for-hosting.zip + wix/hosting/ + .sha256
node scripts/verify-wix-package.mjs
```
A dry run of the same build into `test/out-prev` passed the security gate (913 files, only tag `darktheoryinc-20`, all pages noindex). Production (`FM_ENV=production FM_SITE_URL=...`) refuses until the approvals in `config/approvals.json` are recorded; it is not needed for a preview.

## Deploy [needs approval]
1. Run the build above (after approval). 2. Open the existing site in the Netlify dashboard > Deploys, and drag the new folder or ZIP onto the deploy area (this keeps the same address; Netlify Drop creates a new address). If the site was never claimed, ask me what you see before dragging anything. 3. Open the address and check: catalogue counts, IOSutra ad with NVIDIA badge, a book page's tagged Amazon link.

## Rollback
Netlify keeps each deploy: Site > Deploys > choose the previous deploy > **Publish deploy**. (Standard Netlify behaviour; not verified for this site.) The repository equivalent is rebuilding from the earlier commit.

## Unchanged by this work
Wix site, DNS, production domain and hosting settings.
