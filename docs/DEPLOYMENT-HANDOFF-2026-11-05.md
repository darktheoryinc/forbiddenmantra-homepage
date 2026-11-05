# Deployment handoff: Forbidden Library (2026-11-05)

Nothing has been deployed. Netlify, DNS, Wix and all settings are unchanged. Waiting for Rav's explicit approval.

## 1. Readiness: GO (for the owner-run steps below)
Evidence:
* ZIP `wix/forbidden-library-production.zip`: sha256 `15927144770903ff7c5ccc5998dcc222eb7e7503e710784b9a5d1b404d632bae` (matches the `.sha256` file and the value you gave); `unzip -t` reports no errors; 10,987 files; extracted copy checked: `robots.txt` allows crawling and names `https://library.forbiddenmantra.com/sitemap.xml`; sitemap has 10,637 URLs; canonical links point at library.forbiddenmantra.com; only 1 file carries "noindex": `book/index.html`, the JavaScript book viewer shell (intended; all content pages are indexable); no `netlify.app` address in any file; no Amazon image address; `_headers` supplies the security headers (CSP allows only the site itself for images, scripts and connections); "Main website" link to https://forbiddenmantra.com; Associates statement on the home page and affiliate-disclosure page; IOSutra link and NVIDIA badge present.
* Tests on this same ZIP and build: package 59/59 (HTTP, search, filters, mobile, links), compliance 31, production 45, security gate 37, curation 26, discovery 84, scale 41, covers 31, cover links 24, affiliate 33, librarian 49, promo 73, niches 49, accessibility (no serious or critical issues on 26 pages).
* Launch check (`scripts/launch-check.mjs`): **0 blockers**, 8 warnings, 8 passed. It showed one blocker earlier today ("affiliate audit: 1 error"), caused by a stale audit file from before the pen-name titles were added; re-running `scripts/audit-affiliate.mjs` gives 0 link errors across 31,058 links, and the refreshed file is committed.
* Catalogue: 127 titles, 420 editions, ASINs equal the 2026-10-28 owner table. 33 covers; 94 titles show text cards. Live-table comparison not possible (blocked network); the six open catalogue/cover cases are preserved untouched (`docs/CATALOG-AND-COVER-STATUS-2026-11-05.md`).
* Original Wix site untouched: the original files in `legacy/` are byte-identical to backup commit 83ae92e6 (moved, not changed); the Wix HTML backup branch (6cacb4d), the store-edit branch (14b4b29) and `claude/compliance-remediation` (be88058) are unchanged.

Not launch blockers, but known: 2 works (placeholders) have no purchase link by design; 4 press editions lack an ASIN and use a search link; interface translations (es, fr, de, pt, it, ar, hi) are machine-drafted betas; the live Amazon links cannot be checked automatically (policy); legal pages are owner-approved but not counsel-reviewed.

## 2. Exact package
Branch `library/final-improvements`. ZIP: `wix/forbidden-library-production.zip` (96,369,067 bytes). Source commit for this handoff: see the git log (the ZIP itself is unchanged since commit 6ce837c).

## 3. Minimum steps to deploy (owner)
1. Netlify, project `unrivaled-liger-1baec4`: Site configuration > Build & deploy: confirm it is NOT linked to a Git repository (a linked project cannot take a ZIP). Note what is currently Published.
2. Domain management > Add a domain `library.forbiddenmantra.com`. Note the DNS target Netlify shows.
3. DNS (where forbiddenmantra.com's DNS lives; if it is Wix: Domains > Manage DNS Records > CNAME > Add record): Host `library`, Value `unrivaled-liger-1baec4.netlify.app` (or the target Netlify shows). Do not change any existing record. Wait for Netlify to show HTTPS issued.
4. Deploys > drag `forbidden-library-production.zip` onto the upload area > Publish deploy. (It replaces the current deploy.)
5. Check: `https://library.forbiddenmantra.com/robots.txt` and `/sitemap.xml` load; search a book; open a book page; click one "Buy on Amazon" button and confirm `tag=darktheoryinc-20` in the address.
6. Google Search Console: add the property, submit `/sitemap.xml` (optional, recommended).

## 4. Exact Wix link
Wix editor > menu > add an external link:
* Label: `Enter the Forbidden Library`
* Address: `https://library.forbiddenmantra.com`
Add this only after step 5 passes. Nothing else on Wix has to change. (Optional later: connect a homepage search box to `https://library.forbiddenmantra.com/search/index.html?q=<terms>`; the snippet is in `docs/PRODUCTION-APPROVAL-CHECKLIST.md`.)

## 5. Amazon Associates site registration (owner, in Associates Central; unverified here because amazon.com cannot be reached)
* Account Settings > Websites and Mobile Apps: make sure `library.forbiddenmantra.com` is listed (add `forbiddenmantra.com` if the Wix menu link or any tagged link appears there). Associates links are meant to be used only on sites listed in the account.
* Remove or unpublish the old address `unrivaled-liger-1baec4.netlify.app` once the custom domain works, or confirm it is listed, since it carries tagged links.
* The tracking ID in use is `darktheoryinc-20` (amazon.com only; other marketplaces carry no tag by design).
* The "As an Amazon Associate I earn from qualifying purchases" statement is on every page and on the Affiliate Disclosure page.
* Amazon's rules on manually built `/dp/ASIN?tag=` and "Search on Amazon" links, and on commissions from search links, could not be confirmed from the official pages; confirm in Associates Central or with Associates Support.

## 6. Critical blockers
None found. Owner-side prerequisites only: steps 1 to 4 above, and listing the domain in Associates Central.
