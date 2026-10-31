# KDP browser recovery: plan for a session that has browser access

Why this file exists: the cloud session that prepared the site has no connection to the owner's browser (no browser-extension tools and no device offered), so the KDP step has to run in a session on the owner's own computer (Claude Desktop app with the Chrome extension enabled, or `claude remote-control` in the repository folder). Everything else is ready.

## Rules
* Use only the owner's already signed-in KDP Bookshelf. Never ask for or type credentials. Read only title names, formats and ASINs shown on Bookshelf; do not open reports, payments, tax or account pages; do not edit, save or publish any listing.
* Use KDP's normal "Download author cover file" (Bookshelf, "..." menu beside a paperback or hardcover). One title at a time, human-like pace (a few seconds apart); stop immediately on any CAPTCHA, warning or rate-limit message.
* Name each downloaded file by the edition's ASIN, which Bookshelf shows under the format.

## Pilot (3 to 5 titles) to verify matching
| Title | Format | ASIN |
| Mo Pai Exposed | paperback | B0GFW4H6T2 |
| The Inner Mechanics of Energy Cultivation | paperback | B0H3QCG6D6 |
| The Matrix of Sound | paperback | B0F9LNXF5H |
| Awakening the Sacred Serpent | paperback | B0C6VTZMGK |
| Breathing with Ancient Wisdom | paperback | B0C63YPYKR |

For each: download, confirm the Bookshelf title and ASIN match `docs/OWN-COVER-ASINS.csv`, then run
`python3 scripts/cover_wrap_front.py IN OUT --trim 6x9` (use the trim size shown in the title's print setup), look at `OUT/contact-sheet.png`, and import with `node scripts/covers-bulk.mjs --dir OUT` (dry run) then `--apply --confirmed-by "Forbidden Mantra Press owner" --rights "owner confirmed original artwork"`.
If the pilot is clean, continue in batches of 10 to 15 using `docs/OWN-COVER-ASINS.csv` (89 works; ebook-only titles need the ebook cover if KDP offers a download, otherwise the print front is used for that print edition only).

## After import
`node scripts/build.mjs`, run the test suites, report the new verified cover count. Do not deploy or rebuild the hosting ZIP without approval.
