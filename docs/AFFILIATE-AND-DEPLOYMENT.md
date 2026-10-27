# Amazon attribution, API access and deployment

## What is and isn't known (as of 2026-10-26)

| Item | State |
|---|---|
| Associates **tracking ID (US)** | **Configured 2026-10-27: owner-confirmed `darktheoryinc-20` for amazon.com only** (`config/site.json`). The statement below about recovery is historical: the repository contained none and the `amzn.to/4tX3ogd` short link still cannot be expanded here, so its tag is unknown. The only Amazon link is the short link `https://amzn.to/4tX3ogd`, which could not be expanded from the build environment (outbound access to amzn.to and amazon.com was blocked). The "Influencer storefront name" is not assumed to be the tracking ID. |
| Marketplace | Default `amazon.com`, flagged `marketplaceVerified: false`. Tracking IDs are now **per marketplace** (18 slots in `config/site.json`); none is set and enrollment per marketplace is unknown. See `docs/LANGUAGES.md`. |
| Amazon Associates / Creators API | Not connected. No credentials were available and none were requested. |

## How to recover the tracking ID securely (no passwords in chat)

Pick one:
1. **Fastest:** open `https://amzn.to/4tX3ogd` in a browser where you are signed in to Amazon. In the expanded address, find `tag=` — the value after it (looks like `yourname-20`) is a tracking ID for that link.
2. **Authoritative:** sign in yourself at Associates Central → Account Settings → *Manage Tracking IDs*. This lists every tracking ID and its marketplace. Copy the one used for this site.
3. Provide it to the build as an environment variable, never in source: `AMAZON_TRACKING_ID_COM=yourname-20 node scripts/build.mjs` (use `_DE`, `_CO_UK`, `_FR`… for other marketplaces; plain `AMAZON_TRACKING_ID` also works for amazon.com). The tracking ID is not a secret, but Creators API credentials are, and must be stored only in a secret manager or CI secret.

## Creators API: current eligibility (from web search, to be confirmed in Associates Central)

- It is the successor to the Product Advertising API (PA-API v5). Sources reported PA-API retirement in spring 2026, so assume migration is required.
- Amazon's documentation (via search results) says you must be enrolled in Associates for the target marketplace and have **at least 10 qualifying sales in the trailing 30 days**; credentials are created in Associates Central by the account owner; access can lapse if sales fall below the threshold.
- Content rules reported by secondary sources, **to be checked against the current Operating Agreement**: display prices/availability only from Amazon-served links or the API; show a **date/time stamp** next to API-sourced prices unless refreshed at least hourly; include the standard Associate disclosure wherever Amazon content appears; do not scrape.
- **Consequence for this build:** prices, availability, ratings and cover images are intentionally not displayed. Covers are typographic placeholders. When API access exists, `scripts/` is the place to add a refresh job that writes timestamped values into the catalogue.

## Retailer links today

Each edition gets its own destination. States, as shown on every book page:
- *Seen in search results* (3 editions): the Amazon/Google Play URL appeared in search results on 2026-10-26; not live-checked from here.
- *Built from ISBN-10* (14 editions): `amazon.com/dp/<ISBN-10>`, valid for print books when the edition is in Amazon's catalogue; **not confirmed live**.
- *Search link* (13 editions): Forbidden Mantra Press titles whose ASIN is not yet known. Replace with `dp/<ASIN>` links from your KDP dashboard.
Run a live check from a networked machine before launch: for each URL expect HTTP 200 and a page title matching the edition.

## Deployment

- The original site is a **single static HTML file embedded in Wix via an iframe** (`legacy/`, with its Velo auto-height snippet). The repository has **no CI, hosting or deploy configuration**, and the live Wix site could not be reached to confirm the repository is what is deployed. Treat it as the likely source, unconfirmed.
- The new storefront is a dependency-free static site: `node scripts/import.mjs && node scripts/build.mjs`, output in `site/`. It is multi-page with real URLs, so it should be hosted as its own site (for example on a subdomain, GitHub Pages, Netlify or Cloudflare Pages) rather than inside a Wix iframe. Decision needed from you: where to host it and how `forbiddenmantra.com` should link to it.
- Pages contain `noindex` and a preview banner. Remove both (in `scripts/build.mjs`) at launch.
- Nothing has been published to production.


## Update 2026-10-27: US tracking ID, audit and API credentials

- **Configured:** `darktheoryinc-20` on `amazon.com`; the other 17 marketplaces remain unconfigured (`trackingId: null`). A link receives only its own marketplace's ID, so UK editions stay untagged until an amazon.co.uk ID is confirmed.
- **Audit:** `node scripts/audit-affiliate.mjs` checks every rendered Amazon link offline: host, exactly one correct tag, ASIN = the edition's own ASIN or the ISBN-10 of its own ISBN-13, `rel="sponsored noopener"`. Before configuring: **66 of 68 links had no tag**. After: **0 errors**. `test/verify-affiliate.mjs` also mutates built pages (missing/wrong/duplicate tag, another book's ASIN, wrong marketplace, missing `rel`) and proves the audit fails each time.
- **Disclosure:** the footer of every page and every book page with an Amazon link carries "As an Amazon Associate I earn from qualifying purchases." Confirm the exact required wording against the current Operating Agreement.
- **Clicks:** outbound clicks emit an event containing only `track, work, isbn, market, href, page`. No cookies, no identifiers; nothing leaves the browser unless an analytics provider is enabled.
- **Not used:** Amazon images, prices, availability, ratings, widgets or any Amazon-hosted asset. Metadata comes from public library catalogues, publisher pages and bookseller listings found by web search; Amazon was never scraped.
- **Are Associates API credentials required?** **No**, not for anything built so far: tagged links, disclosures and click tracking need only the tracking ID. Credentials become necessary **only** to display Amazon prices, availability, covers or ratings, which must come from the Creators API (the successor to PA-API, retired in 2026 per secondary sources). By those sources it requires an Associates account in good standing with **at least 10 qualifying sales in the trailing 30 days**, and credentials created in Associates Central by the account owner. **Do not request them yet**; a bookstore does not need them to earn commission. Confirm eligibility in Associates Central before applying.
- **Still unverified:** whether `darktheoryinc-20` is active and in good standing (confirm in Associates Central); the 41 derived links have not been live-checked (`scripts/check-links.mjs`).
- **Idea, not built:** Associates allows several tracking IDs; separate IDs per site or surface would show which pages earn. Add them as additional marketplace-independent IDs only after you create them.
