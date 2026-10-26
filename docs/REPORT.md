# Preview report, 2026-10-26

Preview only. Nothing published. Several parts are **not complete**; see "Not done / limits".

## Catalogue counts (from `data/import-report.json`)

| | Works | Editions |
|---|---|---|
| Published in preview | **23** | **31** |
| of which outside authors | 11 | 15 |
| of which Forbidden Mantra Press (owner-listed) | 12 | 16 |
| Authors with pages | 13 | |
| **Staged, unpublished** outside candidates | **97** (92 with checksum-valid ISBN-13, 5 without ISBN) | 97 |
| Error queue | 22 items: 1 error, 2 duplicates, 19 warnings | |

Site: 108 pages: 6 hubs, 29 departments, 16 traditions, 13 author pages, 23 book pages, 6 reading paths, 4 collections, search/browse, press page, standards and disclosure pages.

## Sources

- **11 outside works** were each corroborated by 2+ web-search results (library catalogues, bookseller listings, publisher pages). Source URLs and access dates are stored per record and shown on each book page. These are mostly secondary sources, not publisher pages; page counts conflicted between sources so none are displayed.
- **4 of the 11 ISBNs I first proposed from memory were wrong** and were corrected from search results (Chia, Illes, Pollack, Ashley-Farrand). The 97 staged candidates carry ISBNs from the same memory-based list and **should be expected to contain similar errors** until verified. That is why they are not published.
- **Forbidden Mantra Press** records come from your homepage plus web search: 9 titles surfaced in search (Apocalypse of Adam, Gayatri Mantra, Kebra Nagast, Weapons of the Gods, Maha Mrityunjaya Mantra, Invoke the Fierce, Lakshmi Gayatri, Om Namah Shivaya, Maa Kali Mantras and Instructions) plus your three homepage titles (Mo Pai Nei Kung, Hidden Technology of Human Power, Forbidden Mantra). Only 3 retailer URLs (2 Audible audiobooks, 1 Google Play) were seen directly; the rest need ASINs from KDP.

## Import results and unresolved records

- 1 checksum failure: *Stillness Speaks* (9781577314568): rejected.
- 5 candidates have no ISBN (Awakening Shakti, Mantras for Everyday Life, Awaken Healing Energy Through the Tao, Healing Love Through the Tao, Beginning Mo Pai Nei Kung): staged, cannot be published.
- 2 duplicates correctly caught (The Power of Now, Seventy-Eight Degrees of Wisdom already published).
- 14 FMP editions are listed without an ASIN (warnings); 5 outside edition IDs are single-source (flagged on the page).
- Three homepage titles (Mo Pai Nei Kung, Hidden Technology of Human Power, Forbidden Mantra) have **no confirmed edition data**. Please confirm.
- Amazon shows the Forbidden Mantra Series as **41 books**; only the ones above are in the catalogue. Spanish and German editions are known to exist but are not individually identified.
- Author attribution for FMP titles is the imprint; real author names need confirming. (The Apocalypse of Adam audiobook credits narrator Emily K Patel.)

## Tests (`node scripts/verify.mjs`) at 1366px and 390px

All passed: 108 pages / 4,012 internal links resolve; no buy link is reused across 3+ books; the old `amzn.to` link appears on no book page; search by title, author, subject and ISBN (hyphenated, ISBN-10, ASIN); filters for subject, tradition, language, format, level and source; hub → department → book → author navigation; two editions grouped under one work with separate destinations; disclosure visible; no horizontal scroll; no JS errors. Screenshots: `docs/screenshots/`.
These tests do **not** confirm that retailer URLs are live (network blocked).

## Not done / limits

1. **Retailer links are not live-checked.** 0 of 31 editions are verified live: 3 seen in search results, 14 built from ISBN-10, 13 are search links, 1 has none.
2. **Tracking ID not recovered; Creators API not connected.** See `docs/AFFILIATE-AND-DEPLOYMENT.md`. Links currently carry no tag, so no commissions are attributed until it is set.
3. **No prices, ratings, availability, covers or bestseller badges** are shown (no permitted source). One historical award (Gnostic Gospels) is shown, labelled historical.
4. **~100 outside editions:** 11 verified and published, 97 staged unverified. This is not 100 reviewed editions.
5. Language filter works, but only English editions are verified, so "German" and "Spanish" currently show an empty state.
6. Seven departments have zero published books (Yoga, Tantra, Christian Mysticism, Hermeticism, Alchemy, Astrology, Dreams); they have staged candidates.
7. Deployment: repo had no deploy config and the live Wix site could not be reached; where to host is your decision.
8. Publishing opportunities: hypotheses only; no demand data available (`research/publishing-opportunities.md`).
9. Fonts load from Google Fonts at runtime; screenshots used fallback serif fonts.
