# Recovering original covers from KDP, and importing them in bulk (2026-10-28)

## What KDP documents (read directly from the official pages on 2026-10-28)
Sources: [Upload and Preview Book Content](https://kdp.amazon.com/en_US/help/topic/G200641240), [Cover Creator](https://kdp.amazon.com/en_US/help/topic/G201113520), [Modify Converted eBook Content](https://kdp.amazon.com/en_US/help/topic/G200652380), [Update Your Cover](https://kdp.amazon.com/en_US/help/topic/G200965970) and [What criteria does my eBook's cover image need to meet?](https://kdp.amazon.com/en_US/help/topic/G200645690). I read the public help text only; I did not touch any KDP account.

**How to download your files** (Upload and Preview Book Content; quoted):
1. Go to your Bookshelf.
2. Click the ellipsis button ("…") next to the book you want to download files from.
3. Select **Download author cover file** or **Download author manuscript**.
4. The online previewer opens. Preview your file and select the download icon at the top right.
5. "To download files for multiple books, repeat these steps for each book."

**Limitations (all quoted from the same page):**
- "You will download the latest files in the exact format you originally uploaded. You will not download any Amazon-converted files."
- "You cannot download files when your book is in review, publishing, or blocked. For print books, you also cannot download files within five days of a scheduled release date."
- "If your file is not eligible for download, the download option may not appear when you select the ellipsis button, or you may see an error message."
- "Covers created with Cover Creator cannot be downloaded." The Cover Creator page adds: "Cover Creator and covers made using stock images available in the Cover Creator tool cannot be downloaded for use outside the KDP website." (Your own image that you uploaded into Cover Creator is still your file; the finished Cover Creator cover is not downloadable.)
- "If you did not upload a manuscript or cover file, you will not be able to download it."
- "Once you upload new files, you will not be able to download previous versions."

**Ebook versus print: what is and is not stated**
- The "How to download your files" block says "print book" in its first sentence, but on the page it sits at the end of the **eBooks** section, immediately before the **Paperback and Hardcover** section. The page does not say whether the Kindle ebook "…" menu shows "Download author cover file". **That is not confirmed either way**, so the first step below is simply to look at the menu.
- For ebooks the page documents a different download: Edit eBook content, then "Kindle eBook Preview", then "Preview on your computer" (Downloadable Preview Options). Per Modify Converted eBook Content this gives "a ZIP file that contains an HTML file of your text content, as well as any included images". The cover is uploaded separately, so the ZIP contains it only if the cover image is also inside your manuscript. That is a long shot, not a documented cover download.
- Ebook covers are JPEG or TIFF (ideal 2,560 x 1,600 px, minimum 1,000 x 625 px). If "Download author cover file" is offered for the ebook, you get that finished front cover with no cropping.
- Print covers: Cover Creator's page states that all covers have 0.125 in (3.2 mm) bleed, and the full-wrap template places back cover, spine and front in one file. So a downloaded print cover file is expected to be a full wrap that needs its front panel cut out (not stated as such on the pages I read; it follows from the templates).
- No batch download exists on these pages: one book at a time.

Corrections to the previous version of this document: it said the KDP pages could not be read (they now can); it called the ebook download a conversion of HTML and images without a source (now confirmed, see above); it called the ebook cover download unconfirmed (still not documented, now stated precisely); and it listed the print "Download author cover file" button as approximate (now exact wording).

## Simplest steps for the four Tier 1 covers (you do these in your own KDP account; send me only the files)
For each of the three titles below, go to **Bookshelf**, click the **"…"** next to the **Kindle ebook** and see whether **Download author cover file** is in the menu.
- **Yes:** choose it, press the download icon in the previewer, save the JPEG. That is the finished front cover. Name it by the ebook ASIN.
- **No (or an error):** do the same on the **paperback** ("…" next to the paperback, Download author cover file). You get the full-wrap print file. Name it by the paperback ASIN and tell me the **trim size** (for example 5.5 x 8.5 in). I can cut the front panel out from the trim size alone, because the file height equals trim height plus 0.25 in of bleed; do not crop it yourself.
- **Still nothing** (the book is in review, or the cover was made in Cover Creator): send the original image you uploaded into Cover Creator, or your own design file.

1. **Mo Pai Exposed** (ebook B0GFQ63JSF, paperback B0GFW4H6T2, hardcover B0GFVWMR9B, audiobook B0H85C85V8). First reply yes or no: is `Mo Pai Exposed Book cover.png` (subtitle "Serious Truths About Internal Power Training") the published ebook cover? If yes, no KDP step is needed.
2. **Energy Unleashed** (ebook B0F287TGGL, paperback B0F29FBNF3, hardcover B0F2B2CTWH): the steps above.
3. **The Inner Mechanics of Energy Cultivation**, English (ebooks B0H3MY3JS3 and B0H44YW832, paperback B0H3QCG6D6) and Spanish (ebook B0H3NV7ZVS, paperback B0H3T75J6P): two covers, English and Spanish; say which English ebook ASIN each file is for.
4. **Mo Pai Nei Kung**: not in your catalogue table. Is it a real, separate book? If yes send its title and ASIN; if not, say so.
Do the audiobooks later: they use their own square covers and are not downloadable through this route (the page describes manuscript and cover files only).

Two things to keep in mind: do not upload a new cover to KDP before downloading the current one, and do not download while a title is in review or publishing.

## Bulk import workflow (built this round)
`node scripts/covers-bulk.mjs --dir FOLDER [--map map.csv]` is a dry run that writes `data/drafts/covers-bulk-report.json`; add `--apply --confirmed-by "NAME" --rights "BASIS"` to import what passed. It reuses `scripts/covers.mjs add` for resizing, metadata stripping and manifest rules, and `scripts/cover_inspect.py` for fingerprints.

- **Mapping:** map row, or file named by ASIN, or `work-slug.lang.ext` for a work with exactly one ebook in that language. Unknown ASINs, ambiguous names and two files for one edition are refused.
- **Validation:** unreadable files; wide full-wrap or banner shapes refused for print and ebook; portrait files refused for audiobooks and square files refused for the other formats; under 600 px warned; existing covers are never replaced without `--replace`.
- **Duplicates:** identical files in a batch are refused; a file near-identical to another work's existing cover is blocked as a likely wrong file; near-identical files for the same work are reported and pointed at `reuse_for`.
- **Evidence:** each import records the ASIN match in the manifest, and the cover is stored against that one edition only.
- **No automatic spreading:** an ebook file is never applied to a paperback, hardcover or audiobook. Identical front artwork can be recorded for display only, with `reuse_for` ASINs and `--reuse-confirmed "owner statement"`, into `data/cover-reuse.json`. Targets must be the same work and language and not audiobooks; the edition records are unchanged and the book page states what the owner confirmed. Without that file the site behaves exactly as before.
- **Tests:** `node test/verify-cover-bulk.mjs` (15 checks).
