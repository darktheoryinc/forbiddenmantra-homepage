# Amazon-hosted covers (ON by the owner's instruction, 2026-11-02)

**What it does.** For every sold work without a verified stored cover and with an ebook, paperback, hardcover or generic-book edition (never audiobook), the page shows the image at `https://m.media-amazon.com/images/P/<ASIN or ISBN-10>.01._SCLZZZZZZZ_.jpg` over the normal text placeholder. The visitor's browser loads it from Amazon with no referrer; **nothing is downloaded, cached or rehosted**. A 1-pixel "no image" reply or a load error removes it, leaving the placeholder. Verified stored covers (owner originals and Penguin Random House) always win. Works on static pages, search results, the dynamic book page and the Digital Librarian.

**The authorisation and its limits.** The owner instructed that all Amazon covers be used because the site runs on his Amazon Associates account (recorded in `config/approvals.json` `amazonHostedCovers`, basis `owner-instruction`). The Associates IP License as read on 2026-10-29 permits image content obtained through its API or approved feeds and forbids storing it; it does not clearly grant this use, and the Creators API is not available to the account. The owner has accepted that risk. If Amazon objects, the images can be removed everywhere in one step.

**Controls.**
* Switch off: set `approved` to `false` in `config/approvals.json`, or build with `FM_AMAZON_COVERS=off` (all Amazon image references disappear; placeholders remain).
* Security gate: a public package may reference Amazon images only when the approval is recorded and only the exact pattern above; any other Amazon image URL fails the package. The package `_headers` allow `https://m.media-amazon.com` in `img-src` only when approved.
* `FM_AMAZON_COVERS=preview` (Press works only) is refused for public builds without the approval.
* Counts: "verified stored covers" (94 works, 104 files) and "Amazon-hosted covers displayed" are reported separately.
* Test: `node test/verify-amz-flag.mjs`.
