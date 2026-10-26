# Amazon attribution, API access and deployment

## What is and isn't known (as of 2026-10-26)

| Item | State |
|---|---|
| Associates **tracking ID** | **Not recovered.** The repository contains none. The only Amazon link is the short link `https://amzn.to/4tX3ogd`, which could not be expanded from the build environment (outbound access to amzn.to and amazon.com was blocked). The "Influencer storefront name" is not assumed to be the tracking ID. |
| Marketplace | Assumed `amazon.com` in `config/site.json` and flagged `marketplaceVerified: false`. |
| Amazon Associates / Creators API | Not connected. No credentials were available and none were requested. |

## How to recover the tracking ID securely (no passwords in chat)

Pick one:
1. **Fastest:** open `https://amzn.to/4tX3ogd` in a browser where you are signed in to Amazon. In the expanded address, find `tag=` — the value after it (looks like `yourname-20`) is a tracking ID for that link.
2. **Authoritative:** sign in yourself at Associates Central → Account Settings → *Manage Tracking IDs*. This lists every tracking ID and its marketplace. Copy the one used for this site.
3. Provide it to the build as an environment variable, never in source: `AMAZON_TRACKING_ID=yourname-20 node scripts/build.mjs`. The tracking ID is not a secret, but Creators API credentials are, and must be stored only in a secret manager or CI secret.

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
