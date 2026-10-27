# Book covers: policy, pipeline and what is needed

**Status (2026-10-27): 0 authentic covers added.** Not one cover file exists in the project, none was supplied, and this environment cannot reach any cover source (Open Library, Google Books, Amazon, publisher sites and archive.org all refuse connections). I did not scrape, copy, generate or "find" any image, and no cover is shown as verified. Every book still shows its typographic title card. Full per-edition list: `docs/COVER-AUDIT.md`, `data/cover-audit.csv`.

## Rules the pipeline enforces
* One cover = one **edition** (`work-slug` + `edition id`). A cover for another edition, format or ISBN is refused: if the edition has an ISBN-13 the entry must carry the same ISBN-13; if it has none (16 editions, including most of our own), written `matchEvidence` is required.
* Accepted source types: `owner-supplied`, `publisher-permission`, `licensed-feed`, `public-domain`. Each entry must record the source, the basis for using it, who confirmed it and when. Scraped or unlicensed sources are refused.
* Images must be at least 240 px wide and cover-shaped. They are re-encoded to 240 px and 480 px WebP (typically under 30 KB and 80 KB) with all metadata stripped, shown with real width/height (no layout shift), lazy loading, `srcset`, and exact-title/author/format alt text.
* The build stops if the manifest is wrong; the security gate refuses any published cover file that is not in `data/covers.json` with its rights recorded; fixture covers are refused by real builds.
* Where a work has several editions, the cover of its first covered edition represents it, and other editions show their own cover in their edition box.

## Adding a cover (once you have the file)
`node scripts/covers.mjs add --work SLUG --edition ID --file PATH --source-type owner-supplied --source "where it came from" --rights "why we may use it" --confirmed-by "Your Name" [--isbn13 N | --match-evidence "how this file is that edition"]`, then `node scripts/covers.mjs audit`, rebuild and `node scripts/make-wix-package.mjs`.

## What I need from you
1. **Our own 12 titles (16 editions):** the cover files you own, one per edition (paperback, ebook, audiobook), with the ISBN/ASIN for each where it exists. 14 of the 16 have no identifier on record yet; the paperback and ebook ASINs/ISBNs from your KDP dashboard also fix the purchase links.
2. **Third-party books (176 books):** decide the source. Options and concerns:
   * **Publisher permission** (best for a curated store): request press-kit cover files, in bulk by publisher (Penguin Classics 23 editions, Llewellyn 11, Shambhala 9, Weiser 8, Bantam 7, HarperOne 7 ...). Slow but clean.
   * **Amazon product API (Creators/PA-API):** images are licensed for use with an Amazon link back, under the Associates agreement; needs your API credentials and qualifying sales. Amazon forbids copying images from its pages.
   * **Open Library covers by ISBN:** free and automatic, but coverage is partial and the underlying artwork is still the publisher's copyright; their terms must be read and accepted by you first (I could not read them from here).
   * **None:** keep the typographic cards (current state).
3. For books that end up without a cover: keep the typographic card (current), hide them from homepage shelves, or leave them out.
4. Allow `openlibrary.org` and `covers.openlibrary.org` in the session's network settings if you want me to test that route.

## Permission and licensing concerns
Covers are copyrighted artwork and often trademarks of the publisher; showing them without permission on a commercial affiliate site is a real infringement risk even when the image is easy to download. Retailer product images (Amazon, etc.) must not be scraped. Real author photos or likenesses are a separate permission. Nothing here was assumed to be allowed.
