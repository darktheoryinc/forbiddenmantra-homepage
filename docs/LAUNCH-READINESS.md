# Launch readiness audit (2026-10-27, branch `claude/gallant-archimedes-ocwf9s`, commit 5c81324)

Nothing is deployed. DNS, Wix hosting and the live Wix site are untouched. The launch is **not complete** and the live site has **not** been checked (this environment cannot reach any external host: forbiddenmantra.com, Open Library, Google Books, Amazon and static hosts all fail to connect).

## What is ready (measured)
| Item | Result |
|---|---|
| Works / editions / authors | 192 / 223 / 132. Every one of the 192 works has a static book page, and the 223 edition sections render (192 pages, 223 `edition` blocks). Own titles: 12 |
| Affiliate | 218 of 218 eligible amazon.com links carry `darktheoryinc-20`; build fails otherwise |
| Features | Catalogue, categories, authors, series, search, language dropdown, curated homepage, niche guides, legal drafts, librarian, IOSutra section with official full-colour NVIDIA badge: all tested (see test list) |
| Wix route | Full site in an iframe from a free static host, package `wix/forbiddenmantra-site-for-hosting.zip`, steps in `wix/INSTALL-IN-WIX.md`, cross-origin iframe test 41 checks |

## Genuine blockers against your launch requirements
1. **Book covers: 0 of 192 books have a cover image or a cover source.** Every book currently shows a typographic placeholder card (15 on a single book page including related titles). Nothing in the repo or the catalogue data holds a cover file or URL, and covers were deliberately excluded until a permitted source exists (`config/sources.json`). Real covers need one of:
   * **Own 12 titles:** you send the cover files (they are yours to use).
   * **Third-party books, free route:** Open Library's Covers API by ISBN (hotlinked images). Coverage is partial, so some books would still have no cover. I cannot test it from here, so coverage is unknown until it is run from a machine with internet access.
   * **Third-party books, Amazon route:** Amazon's product API (needs your Associates API credentials; Amazon does not allow copying cover images from its pages).
   * **Publisher-supplied covers** you hold rights to.
   "No placeholders" cannot be guaranteed by any free route: for books with no available cover you must choose between a plain typographic card (what exists now), hiding the book from the homepage shelves (still searchable), or leaving the catalogue entry out.
2. **Verified purchase links: 76 of 192 books have a product link** (35 confirmed against sources, 41 matched by identifier only, none live-checked). **116 have an Amazon search link only**, and **10 of our own 12 titles have no ISBN/ASIN at all** (search link by title). Verifying or upgrading them needs live Amazon access (not possible here) or your ASIN/ISBN list from your KDP dashboard, or the Amazon API credentials above.
3. **Production approvals (five items, all yours):** NVIDIA membership statement and trademark wording checked against NVIDIA's guidelines (please send the Inception guidelines PDF); IOSutra promotion approved; legal pages reviewed; final hosting address; confirmation of commercial-use and likeness permissions for the IOSutra artwork and the librarian character. The production build refuses to run until these are recorded.
4. **A place to host the files** (free static host) and **your Wix editor steps** (I cannot open your Wix editor). Publishing to the live site is yours to do.
5. **Live check after launch:** only possible once it is online and someone with internet access (you, or me with network access enabled for the hosting address and forbiddenmantra.com) opens it.

## Limitations of the iframe route (unchanged)
Address bar stays on one Wix page (no shareable book URLs); Google credits the hosting address, not forbiddenmantra.com; two menus show; saved choices may not persist where browsers block frame storage. Full detail in `wix/INSTALL-IN-WIX.md`.

## Fastest safe path
1. You send: own-title cover files + ASINs/ISBNs (12 titles), and your choice for third-party covers (Open Library, Amazon API, or none) and for books without a cover (typographic card, hide from shelves, or leave out).
2. I add cover support (image with title/author alt text, lazy loading, fallback), run a cover and link coverage report, and rebuild the production zip once the approvals are recorded.
3. You upload the zip to the free host and switch the Wix iframe to its address (about 10 minutes, `wix/INSTALL-IN-WIX.md`).
4. Together we check the live page on desktop and mobile; only then is the launch complete.
