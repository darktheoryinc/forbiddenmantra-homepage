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

## Full public-site crawl (2026-10-31)
Crawled every URL in forbiddenmantra.com's sitemaps (121 pages: 96 blog posts, 6 blog pages, home and 17 template pages), extracting all image URLs.
* **Wix-hosted images:** 66 distinct `static.wixstatic.com` media files. 57 are already in the Media Manager listing audited earlier. The other 9 are Wix template background gradients (`baac51_`, `55d98a_` prefixes) on the template pages, not covers.
* **Other image hosts:** 76 references to Wix's own stock-media host (`wixmp.com`, blog thumbnails) and 13 references (3 distinct files) to `m.media-amazon.com` in blog posts: Amazon-hosted, not ours, not stored.
* **Result:** no new covers. The live site's book covers are the Amazon-hosted images loaded by the bookstore iframe (see above), and its own Wix-hosted covers are the ones already recovered. 94 works show a verified cover (104 files); 92 Press works remain without original files.

## Recovery audit result (2026-10-31): precisely what remains unavailable
Checked this pass: all 121 public pages for images and Amazon links; every image URL's original on Wix (Wix serves the uploaded original at the plain media URL, so no higher-resolution copy exists beyond the files already used); the Wix and GitHub assets (see above). The only low-resolution own covers (7 of 37, e.g. Apocalypse of Adam 328x493, Unleashing the Inner Fire 292x466) are Wix's originals: Wix holds nothing larger. The site's home gallery links covers through `amzn.to` short links that cannot be resolved from here (503), and blog posts use one generic banner image, so no cover-to-ASIN evidence is available from the public pages.

92 Press works have no cover. Why:
1. **A staged file exists but cannot be assigned without a yes/no (about 4 works).**
   * Dream Journal cover (1024x1536, "366 pages, one year of discovery") vs catalogue "The Complete Dream & Conscious Experience Journal (1-Year Edition)", hardcover B0H1259BYN, paperback B0H14D7THD: probable, but the cover title is shorter.
   * "The Matrix of Mantra" cover (TSPRavshiva) vs catalogue "The Matrix of Sound": the title differs.
   * Maa Kali olive Kindle design (1487x2398 after trimming the black letterbox): the title and author match, but three ebook ASINs share the title, so the edition is ambiguous. A second, square Maa Kali design (2400x2400) fits no ebook shape.
2. **Staged but defective:** Apocalypse of Adam Part II (grid across the title) and the German Das Erscheinen Adams (smear): need a clean copy.
3. **No catalogue record:** "The Atharva Veda" and "The Forbidden Light" covers exist but match no catalogue work (unpublished or unlisted).
4. **No file anywhere we own (about 85 works):** never saved to Wix, Drive, GitHub or history. Their only copies are on Amazon (KDP uploads) and in the tools that made them (ChatGPT, design apps).
Not used: Amazon-hosted images (the only copies of group 4 reachable from the public web) and any third-party publisher artwork.
