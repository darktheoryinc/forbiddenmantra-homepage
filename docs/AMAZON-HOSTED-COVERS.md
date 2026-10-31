# Amazon-hosted cover preview flag (OFF by default)

Purpose: let the owner see how 89 Press works without a verified cover would look using the Amazon image the live bookstore already loads. **Not authorised for public use**: the Associates licence (read 2026-10-29) lets us use Amazon images only as obtained through its API or approved feeds and forbids storing them; nothing readable authorises this address pattern. Nothing is downloaded, cached or rehosted.

* Enable (local dev build only): `FM_AMAZON_COVERS=preview FM_OUT=test/out-amz node scripts/build.mjs`, then open `test/out-amz/`.
* Default build and the hosting ZIP are unchanged: no page references Amazon image hosts.
* Refused for `FM_PUBLIC=1` (the package script) and `FM_ENV=production`; the security gate also fails any package that references `m.media-amazon.com/images/` or `ssl-images-amazon.com/images/`.
* What it shows: for Press works that are sold, have no verified cover and have an ebook, paperback or hardcover ASIN (never audiobook, ebook first), an `<img>` at `https://m.media-amazon.com/images/P/<ASIN>.01._SCLZZZZZZZ_.jpg` is layered over the normal text placeholder and removed if it fails. Each is labelled "Preview: Amazon-hosted". Verified covers and Mo Pai Nei Kung, The Hidden Technology of Human Power and Forbidden Mantra (no ASIN or not sold) are untouched.
* Test: `node test/verify-amz-flag.mjs`.
* To make it public, the owner must first obtain Amazon's written confirmation (draft in `docs/OWN-COVER-ROUTES.md`) or qualify for the Creators API; the gate and flag guard would then be changed deliberately.
