# Production launch: what only the owner can approve (2026-11-02)

Hosting (decided 2026-11-02): the Wix site at https://forbiddenmantra.com is untouched; the bookstore goes on its own `netlify.app` address (see `docs/NETLIFY-LAUNCH.md`). **The production address is therefore not recorded yet**: it is the first thing needed, and the earlier recorded `forbiddenmantra.com` entry has been withdrawn. Nothing below has been approved or assumed.

## The exact gates that stop a production build today
Command: `FM_ENV=production node scripts/make-wix-package.mjs` (it refuses and lists these together).

| # | Gate | Where | Minimum action |
|---|---|---|---|
| 1 | `promo iosutra-technology: not approved by the owner` | `data/promos.json` `promos[0].approved` | Owner approves the existing IOSutra promotion as it stands (no wording or artwork change). |
| 2 | `claim "nvidia-inception-membership" is owner-asserted` | `data/promos.json` `claims` | Owner records evidence (`evidence`, `verifiedOn`) and sets `status: verified`. Wording is not changed. |
| 3 | `claim "nvidia-trademark-notice" is needs-confirmation` | `data/promos.json` `claims` | Owner confirms the attribution wording the programme requires (or that none is required) and sets `status: verified`. |
| 4 | `legal: the Terms, Refund, Privacy and Affiliate pages are drafts` | `config/site.json` `legal.reviewedByOwner` and `legal.effectiveDate` | Owner (or counsel) reviews the pages (see `docs/LEGAL-REVIEW-2026-11-02.md`; its decision 1 is now settled: separate site), then confirms. |
| 5 | `no production siteUrl` / `productionAddress` | `config/approvals.json` `productionAddress.url` | Owner supplies the assigned Netlify address (step 3 in `docs/NETLIFY-LAUNCH.md`). |

The package security gate additionally requires these `config/approvals.json` entries to be `approved: true`, each recorded with `approvedBy` and `approvedOn`: `iosutraPromotion`, `iosutraArtworkRights`, `librarianArtworkRights`, `legalPagesReviewed`. (`productionAddress` also needs the Netlify address. `nvidiaBranding` and `amazonHostedCovers` are already recorded.)

Claude has not set, and will not set, any of these. Once the owner confirms them, recording them is a five-minute change and the production ZIP is built with one command.

## Legal pages: what needs the owner's decision
Pages: `legal/` hub, `legal/terms-refunds/`, `about/privacy/`, `about/affiliate-disclosure/`, `contact/`, `network/`.
1. **Terms / Refund wording** is a paraphrase of a recovered summary, not the original text. Confirm it, or supply the original text.
2. **Refund clause**: the bookstore sells nothing itself. Printify/apparel language was kept because the original store sold such items. Keep or delete?
3. **Amazon returns URL** (`amazon.com/returns`) came from a search summary. Confirm.
4. **No governing-law, dispute, age or children's-data clause exists.** None was invented. Decide whether counsel should add them.
5. **Privacy**: Google Fonts sends visitors' IP addresses to Google (self-hosting the fonts would remove that). Amazon-hosted covers (added after the first draft) send visitors' IP addresses to Amazon; the privacy page now says so ("Book covers"). Analytics provider is undecided; none is enabled. Confirm all three.
6. **Affiliate disclosure**: "As an Amazon Associate I earn from qualifying purchases." appears in the hero, under every book's buy buttons, in the footer and on the disclosure page. Confirm wording and placement against Associates Central > Operating Agreement (the page needs a login Claude does not have).
7. **Search links**: confirm that tagged Amazon *search* links earn commission (`affiliate.searchLinks`); they are labelled "Search on Amazon" either way.
8. The Wix site's Members Area, Forms and Hotels apps collect personal data and are outside this bookstore's privacy page.

## What is already verified for production (simulated approvals, throwaway copy; the repository's approvals are unchanged)
* No `noindex` anywhere except the dynamic book shell `book/index.html` (deliberate); no `X-Robots-Tag`; `robots.txt` allows crawling and names `https://forbiddenmantra.com/sitemap.xml`; the sitemap lists 8,631 URLs; every page has a canonical URL on the domain. Checked by `scripts/verify-wix-package.mjs` (production mode).
* Security gate, 58 package checks, axe accessibility, and the affiliate audit all pass (see the report).
