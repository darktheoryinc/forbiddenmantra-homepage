# Recovering original covers from KDP, and importing them in bulk (2026-10-28)

## What KDP lets a publisher download: confirmed and not confirmed
Amazon's help pages (kdp.amazon.com) could not be opened from this session because the host is not on the network allow-list. What follows comes from search-result excerpts of KDP's own help topics ([Upload and Preview Book Content](https://kdp.amazon.com/en_US/help/topic/G200641240), [Cover Creator](https://kdp.amazon.com/en_US/help/topic/G201113520)) and KDP community threads. Treat the button labels as approximate until you see your own screen.

| Statement | Status |
|---|---|
| For a **print** book you can download the manuscript and **cover file you uploaded** from the Bookshelf: click the "..." next to the book and choose the author-cover-file download (it opens the online previewer, where the download icon is at the top right). | Confirmed by KDP's help text (excerpt) |
| The download is the file **in the format you uploaded**, not an Amazon-converted file. | Confirmed (excerpt) |
| Not available while the book is **in review, publishing or blocked**; for print also not within about five days of a scheduled release. | Confirmed (excerpt) |
| Covers made with **Cover Creator cannot be downloaded** (one forum post says the final preview can be saved as an image; anecdotal). | Confirmed by KDP; workaround unconfirmed |
| If you never uploaded a cover file, there is nothing to download. | Confirmed |
| Replaced uploads are not recoverable, so download before changing anything. | Confirmed (excerpt) |
| A print cover file is normally a **full wrap** (back, spine, front), so the front panel has to be cut out or re-exported. | Standard KDP practice; your files' layout is unknown |
| For a **Kindle ebook** a Bookshelf download exists, but one source says it returns converted HTML and images, not your original cover. Whether a plain front-cover image can be downloaded for an ebook is **not confirmed**. | Unconfirmed |
| A **single batch download** of all covers. | **Not found**: the help describes one book at a time. Assume per-book. |

So the dependable route is the print "author cover file" for each title, which also gives the artwork behind the ebook if the same front was used (confirm that when you send it). Your original design files (the ChatGPT or Canva exports you uploaded to KDP) are an equal alternative and need no KDP step.

## Owner action plan: Tier 1 homepage titles (do these first; nothing needs your password)
You work in your own KDP account. I never ask for credentials or access; you send me the files.

1. **Mo Pai Exposed** (ebook B0GFQ63JSF, paperback B0GFW4H6T2, hardcover B0GFVWMR9B, audiobook B0H85C85V8). We hold `Mo Pai Exposed Book cover.png` (cover subtitle "Serious Truths About Internal Power Training") but your listing says "What the Internal Power Community Refuses to Admit". **Reply with one word: is that file the published ebook cover, yes or no?** If yes no KDP step is needed. If no, download the paperback author cover file from KDP.
2. **Energy Unleashed** (ebook B0F287TGGL, paperback B0F29FBNF3, hardcover B0F2B2CTWH). Only low-resolution Amazon screenshots exist. In KDP Bookshelf, download the paperback author cover file (or send your original design file).
3. **The Inner Mechanics of Energy Cultivation**, English (ebook B0H3MY3JS3 and B0H44YW832, paperback B0H3QCG6D6, hardcover B0H3T6CKMZ, audiobook B0H8MBCDC6) and Spanish (ebook B0H3NV7ZVS, paperback B0H3T75J6P, hardcover B0H3SQK65J, audiobook B0H8ML8C5F). Two separate files (English and Spanish) are needed. Note the English title has two ebook ASINs: say which one each file belongs to.
4. **Mo Pai Nei Kung**: it is not in your bookstore table. **Is it a real, separate book? If yes send its title and ASIN; if not, say so** and I will mark it as a placeholder.

How to send: put the files in one folder and either name each by the ASIN of the edition it is the cover of (for example `B0GFQ63JSF.png`), or add a `map.csv` (columns `file,asin,reuse_for`). For a full-wrap print file also tell me the trim size and page count, or export the front panel only; I do not guess a crop. Audiobook files are square and separate.

## Bulk import workflow (built this round)
`node scripts/covers-bulk.mjs --dir FOLDER [--map map.csv]` is a dry run that writes `data/drafts/covers-bulk-report.json`; add `--apply --confirmed-by "NAME" --rights "BASIS"` to import what passed. It reuses `scripts/covers.mjs add` for resizing, metadata stripping and manifest rules, and `scripts/cover_inspect.py` for fingerprints.

- **Mapping:** map row, or file named by ASIN, or `work-slug.lang.ext` for a work with exactly one ebook in that language. Unknown ASINs, ambiguous names and two files for one edition are refused.
- **Validation:** unreadable files; wide full-wrap or banner shapes refused for print and ebook; portrait files refused for audiobooks and square files refused for the other formats; under 600 px warned; existing covers are never replaced without `--replace`.
- **Duplicates:** identical files in a batch are refused; a file near-identical to another work's existing cover is blocked as a likely wrong file; near-identical files for the same work are reported and pointed at `reuse_for`.
- **Evidence:** each import records the ASIN match in the manifest, and the cover is stored against that one edition only.
- **No automatic spreading:** an ebook file is never applied to a paperback, hardcover or audiobook. Identical front artwork can be recorded for display only, with `reuse_for` ASINs and `--reuse-confirmed "owner statement"`, into `data/cover-reuse.json`. Targets must be the same work and language and not audiobooks; the edition records are unchanged and the book page states what the owner confirmed. Without that file the site behaves exactly as before.
- **Tests:** `node test/verify-cover-bulk.mjs` (15 checks).
