# Plan: move book covers from Amazon-hosted images to Forbidden Mantra's own hosting

STATUS: PLAN ONLY. Nothing here has been run, published or deployed. The live Wix site is unchanged.
Basis: Amazon Associates Support confirmed that self-hosting our original cover artwork, linked to Amazon with affiliate links, is allowed.

## How covers work today (from the Wix HTML)
- Cover URL = `row.cover_url` if present in the Supabase `catalog` row, otherwise built from the ASIN: `https://m.media-amazon.com/images/P/<ASIN>.01.L.jpg`.
- Amazon link = `row.amazon_url` if present, otherwise `amazon.com/dp/<ASIN>`.
- So the migration needs NO code change if every row gets a `cover_url`. ASINs and affiliate links stay exactly as they are.

## Steps (each is separate, reversible, and needs your approval)
1. **Inventory (read-only).** Export the `catalog` table: title, ASIN, current `cover_url`. List which rows rely on the Amazon-built fallback. Output: one CSV.
2. **Collect original artwork.** Use your own files: KDP "Download cover" / print-ready cover files, or the original design files. Do not scrape the Amazon images. Missing covers are listed, never replaced by placeholders.
3. **Prepare web versions.** One JPEG/WebP per book, named by ASIN (e.g. `B0XXXXXXXX.jpg`), about 600 px wide plus a 300 px size. Keep the originals untouched.
4. **Choose hosting.** Options: (a) Wix Media Manager (you already use Wix), (b) Netlify static folder, (c) a Supabase Storage public bucket (same project as the catalog). Recommendation: Supabase Storage, since the catalog already lives there and URLs are stable and CDN-served.
5. **Stage and test.** Upload to the chosen host. Run a script that checks every URL returns an image. Put the new URLs in a COPY of the catalog (a new `cover_url_new` column), not in the live column.
6. **Test on the duplicate site `FMBACKUP 2026-11-04` only.** Point a copy of the page at `cover_url_new`. Compare every cover against the Amazon-hosted one visually.
7. **Go live only after you approve.** Copy `cover_url_new` into `cover_url`. Rollback is clearing `cover_url`, which restores the current ASIN-built behaviour instantly.

## Safeguards
- No covers removed or replaced with placeholders at any step.
- ASINs, affiliate tag, titles, authors, prices untouched.
- Add `onerror` fallback to the old URL only if you want a safety net during the transition.
- Library site (37 owner covers) already uses own artwork; the same files can be reused.

## What I need from you
Where your original cover files are, and which host you prefer (default: Supabase Storage).
