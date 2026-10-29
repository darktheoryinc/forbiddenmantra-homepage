# Live bookstore frontend: where its covers come from (2026-10-29)

Scope: the actual bookstore embedded in the Wix site, its GitHub source and image-loading logic. Does not repeat the earlier Wix/Drive/repository audits.

## How the live site is built
* `https://www.forbiddenmantra.com` (Wix) embeds two Wix-hosted HTML components (`www-forbiddenmantra-com.filesusr.com/html/b993af_98fc83f8...html`, a 36 KB home page, and `b993af_abbb7983...html`, a 950 KB bookstore). Fetched and read on 2026-10-28; that host is no longer reachable from this session, so the saved copies were re-analysed.
* GitHub `darktheoryinc/forbiddenmantra-homepage` `main` holds only an older 10 KB homepage (`forbiddenmantra-homepage.html`, all text placeholders for covers, `amzn.to` links), a Wix Velo resize script and `files.zip` (the 5/2026 37 KB version). Twelve commits of that page contain **no image files, no inline cover images and no cover URLs** (the only image reference is an SVG noise texture). The other repositories on the account were not touched.

## Image-loading logic of the live bookstore iframe
1. Reads the public Supabase `catalog` table (176 records, 420 editions).
2. `deriveCoverUrl`: use the record's `cover_url`; otherwise `https://m.media-amazon.com/images/P/<ASIN>.01.L.jpg` for the ebook (or any) ASIN.
3. `<img ... onerror>` falls back to a text card with the title.
4. The only embedded image is the 512x512 site logo (inline base64 PNG). No Wix, GitHub or other-hosted cover files are used.

## What is displayed or referenced, by origin
| Origin | Count | Detail |
|---|---|---|
| Amazon-hosted (`images-na.ssl-images-amazon.com/images/P/<ASIN>...` in all 176 `cover_url` values, plus the `m.media-amazon.com` fallback) | every cover on the live bookstore | Amazon's files, not ours. Nothing here is a file we control. |
| Our own (inline logo only) | 1 | Not a cover. |
| Wix-hosted images on the pages | 18 media ids | 12 are Media Manager files already audited; the other 6 are Wix template backgrounds (soft gradients), not covers. |
| Third-party covers | 0 | |

## Result
**No additional covers are recoverable from the live frontend or its GitHub source.** Every cover the live bookstore shows for the 89 missing Press works is an Amazon-hosted image, which is the category `docs/OWN-COVER-ROUTES.md` concluded we may not retrieve and store. The sources we control (Wix Media Manager, Drive, repository, history) were already exhausted; the live site references nothing beyond them.

## Remaining blockers
Unchanged: the owner's original files (ChatGPT export, KDP print-cover downloads or design files), or written confirmation from Amazon (draft in `docs/OWN-COVER-ROUTES.md`).
