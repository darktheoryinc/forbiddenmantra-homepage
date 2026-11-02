# Amazon-hosted covers (ON by the owner's instruction, 2026-11-02)

**What it does.** For every sold work without a verified stored cover and with an ebook, paperback, hardcover or generic-book edition (never audiobook), the page shows the image at `https://m.media-amazon.com/images/P/<ASIN or ISBN-10>.01._SCLZZZZZZZ_.jpg` over the normal text placeholder. The visitor's browser loads it from Amazon with no referrer; **nothing is downloaded, cached or rehosted**. A 1-pixel "no image" reply or a load error removes it, leaving the placeholder. Verified stored covers (owner originals and Penguin Random House) always win. Works on static pages, search results, the dynamic book page and the Digital Librarian.

**The authorisation and its limits.** The owner instructed that all Amazon covers be used because the site runs on his Amazon Associates account (recorded in `config/approvals.json` `amazonHostedCovers`, basis `owner-instruction`). The Associates IP License as read on 2026-10-29 permits image content obtained through its API or approved feeds and forbids storing it; it does not clearly grant this use, and the Creators API is not available to the account. The owner has accepted that risk. If Amazon objects, the images can be removed everywhere in one step.

**Controls.**
* Switch off: set `approved` to `false` in `config/approvals.json`, or build with `FM_AMAZON_COVERS=off` (all Amazon image references disappear; placeholders remain).
* Security gate: a public package may reference Amazon images only when the approval is recorded and only the exact pattern above; any other Amazon image URL fails the package. The package `_headers` allow `https://m.media-amazon.com` in `img-src` only when approved.
* `FM_AMAZON_COVERS=preview` (Press works only) is refused for public builds without the approval.
* Counts: "verified stored covers" (94 works, 104 files) and "Amazon-hosted covers displayed" are reported separately.
* Test: `node test/verify-amz-flag.mjs`.

## Requirements versus speculation (reviewed 2026-11-02)
Source: Associates Program Policies, IP License and Usage Requirements, as read and quoted in `docs/COVER-SOLUTIONS.md` (2026-10-29). The policy page could not be re-fetched in this session (host not reachable), so nothing below is newer than that reading.

| | Status |
|---|---|
| Images are normal affiliate content; owning the copyright of each cover is **not** a requirement | Fact. Amazon licenses Program Content to Associates for display on their site. Third-party cover ownership is not a launch blocker and is not treated as one. |
| Image display must come from an authorised channel: Creators API (formerly PA-API) or an approved data feed | Documented requirement. The Creators API needs 10 qualifying sales in 30 days; this account is not eligible yet. |
| Images must not be stored or cached (a link may be kept up to 24 hours) | Documented requirement. **Met**: Amazon covers are loaded live from Amazon by the visitor's browser; nothing is downloaded or rehosted. The 94 stored covers are different (owner originals and Penguin Random House exact-ISBN files). |
| Images must accompany Amazon links that carry the Associates tag | Met: every book card and page carries tagged purchase links (`darktheoryinc-20`, audited by `scripts/audit-affiliate.mjs`). |
| Hotlinking `m.media-amazon.com/images/P/<ASIN>` is an authorised channel | **Not documented.** It is not the API or an approved feed. The owner has accepted this documented gap (`config/approvals.json` `amazonHostedCovers`). It is a policy-compliance risk the owner holds, not a copyright question and not a launch blocker. |
| Amazon will act on this | Speculation. Nothing in the policy says covers will be removed; the one-step off switch exists if Amazon objects. |

**What would close the gap:** reach the Creators API eligibility threshold, then fetch image URLs by ASIN from the API instead of the fixed URL pattern. The display code, CSP and security gate already isolate the pattern in one place, so that swap is small.

Nothing was removed: covers keep working wherever the stored-cover or hotlink paths apply.
