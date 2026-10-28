# Deployment readiness (2026-10-28, branch claude/gallant-archimedes-ocwf9s)

Nothing is deployed. DNS, Wix and the live site are untouched.

## Verified here
198 works, 230 editions, 12 verified covers, all test suites and the axe accessibility scan pass (`node scripts/launch-check.mjs`, `node scripts/verify.mjs`, `test/*`).

## Genuine blockers
1. **Retail links never checked live (349 URLs).** This session cannot reach Amazon or any retailer (connection refused by the network policy), so `scripts/check-links.mjs` cannot run here. Run it with the GitHub Actions workflow `.github/workflows/check-links.yml` (no installation, no secrets). The Run workflow button only appears once the file is on the default branch, so from this branch it starts when a commit changes the number in `.github/run-link-check.txt` (you can edit that file in the GitHub web editor, or ask Claude to push it). Results land on branch `link-check-results`. Amazon may show bot protection to GitHub's servers: those are recorded as `blocked`, never `dead`, and only `dead` (HTTP 404/410) links are hidden by the build.
2. **NVIDIA Inception claim is unverified.** Registry `data/promos.json`: `nvidia-inception-membership` is owner-asserted, `nvidia-trademark-notice` needs confirmation, `no-endorsement` is verified (it only applies alongside the membership statement). The public package (`FM_PUBLIC=1`) withholds the badge, the "Inception Member" panel, the membership statement and the trademark notice: a test public build contains 0 mentions of NVIDIA or Inception. Nothing was deleted from the registry; the entries stay with their statuses and are published only after the owner records approval.

## Hosting (existing configuration)
- The domain and site are on Wix. The bookstore is 522 static files, too many to paste into Wix, so the documented route (`wix/INSTALL-IN-WIX.md`) is a free static host plus the existing Wix iframe element set to that address. `wix/hosting/_headers` is already written for Netlify (security headers, CSP; the preview marks pages noindex).
- **Simplest route that keeps your site and domain:** upload the hosting ZIP (or `wix/hosting/`) to Netlify (free; claim the site with a free account so it does not expire), then in the Wix editor switch the existing iframe from Code to Website address and publish. No DNS change, no Wix hosting change, no payment.
- A production build (indexable, canonical URLs) is `FM_ENV=production FM_SITE_URL=https://<address>/ node scripts/make-wix-package.mjs`; it refuses to run until every approval below is recorded. Inside an iframe, search engines credit the host address, not forbiddenmantra.com.
- Still to decide: `config/site.json` `siteUrl` is empty; analytics is off (optional); the amazon.co.uk tracking ID is not set (UK links earn nothing).

## Exact remaining approvals (`config/approvals.json`, all currently false)
| Approval | What the owner must confirm |
|---|---|
| nvidiaBranding | Membership is current in the NVIDIA Inception portal; guidelines read; attribution wording agreed |
| iosutraPromotion | The IOSutra section may be promoted on this site |
| iosutraArtworkRights | Commercial-use and likeness permission for the meditating man and robot artwork |
| librarianArtworkRights | Rights to the digital librarian character artwork |
| legalPagesReviewed | Privacy, terms and affiliate disclosure reviewed (add a real contact method) |
| productionAddress | The final web address (with the person and date) |

A preview-style public package (noindex, NVIDIA content withheld) does not need these; a production build does.

## Owner confirmations on catalog data (not launch blockers)
Kleem English edition format; publisher attribution on the six new titles; author spelling "Emily K Kissoon"; the Mo Pai Exposed cover subtitle and second ISBN; Durga, Lakshmi, Gayatri and Weapons paperback artwork.
