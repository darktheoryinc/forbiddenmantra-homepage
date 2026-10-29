# Recovering the 89 own-press covers: what is permitted, and the fastest compliant route (2026-10-29)

## 1. May we download and store the Amazon-hosted cover files? Not on the evidence available. Nothing was downloaded.
First-hand text read today (Amazon Associates Program Policies, "Associates Program IP License and Usage Requirements", https://affiliate-program.amazon.com/help/operating/policies):
* Product Advertising Content (images, text, data Amazon supplies about products) is Program Content that we may "copy and display ... solely on your Site" only on the licence's terms.
* Clause (h): "You will not store or cache Product Advertising Content consisting of an image, but you may store a link to Product Advertising Content consisting of an image for up to 24 hours."
* The licence names the Creators API, PA API and approved data feeds as the ways to obtain that content. Copying files from Amazon's image host is none of those.
* Owning the artwork does not change this: the files on `m.media-amazon.com` are Amazon's hosted, processed copies, and the licence governs them for an Associates site (this one carries Associates links).
Not readable from this session: Amazon's Conditions of Use and the KDP Terms and Conditions (the hosts are outside the session's allowed network). Nothing I could read grants a right to bulk-retrieve and store these files, and the one clause on point says not to. The Creators API is closed to us (eligibility not met, per `docs/AMAZON-COVERS.md`). So the answer is: **do not import them**. (Technically the host answers, which is why this needed a decision; the legal answer is separate.)

A third route is to ask Amazon: a short written question to KDP/Associates support (draft below). If Amazon confirms in writing that the rights holder may retrieve his own cover images, the import is mechanical (`scripts/covers-bulk.mjs`). I have not contacted anyone.

## 2. Fastest compliant bulk recovery
| Rank | Route | What you do | Yield | Notes |
|---|---|---|---|---|
| 1 | **ChatGPT account data export** (your covers' file names, e.g. "ChatGPT Image Mar 29, 2025", show they were made there) | Settings > Data controls > Export data; send me the ZIP (or just its image folder) | Possibly most of the artwork, one request | Reports are mixed on whether the export includes generated images (community threads), so check the ZIP for an images folder. Deleted chats lose their images. |
| 2 | **KDP "Download author cover file"** (print titles) | Bookshelf > "..." next to the paperback/hardcover > Download author cover file. Name each file by the edition's ASIN | One front cover per print edition | Documented by KDP for print books. Files are full wraps; `scripts/cover_wrap_front.py` cuts the front out (tested on a synthetic wrap; you only need the trim size, usually 6x9). Covers made in Cover Creator cannot be downloaded. |
| 3 | The design tool (Canva or whatever laid out the wraps) | Download the front as PNG per design | Exact originals | Slowest if there are dozens of designs. |
| 4 | **Ask Amazon** (draft below) | Send the message | All ~89 if they agree | Unknown answer and time. |

Ebooks: KDP does not document an ebook cover download. Print and ebook fronts share artwork only where you confirm it (`data/cover-reuse.json`); a print front is never applied to an ebook or audiobook silently.

### Pipeline once files arrive
1. Put wraps in `IN`, run `python3 scripts/cover_wrap_front.py IN OUT --trim 6x9` (per-file trims via `--map trims.csv`), and check `OUT/contact-sheet.png` and the printed spine widths.
2. `node scripts/covers-bulk.mjs --dir OUT` (dry run: ASIN-to-edition match, shape, size, duplicates), then `--apply --confirmed-by "NAME" --rights "owner confirmed..."`.
3. Build and run the tests; the homepage cover links and shelves update on their own.

## 3. Draft message (not sent)
> Subject: Question about using my own book cover images
> I am the publisher and rights holder of the Forbidden Mantra Press books listed below (ASINs attached). I run an Associates-linked bookstore site (tracking ID darktheoryinc-20). May I download the front-cover images shown on Amazon.com for my own titles and host them on my site, or can KDP provide my original cover files in bulk? If neither is allowed, what is the recommended way to display my own covers with Associates links when I do not yet qualify for the Creators API?
