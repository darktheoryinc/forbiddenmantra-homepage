> Latest status: see **docs/LAUNCH-STATUS.md** (2026-10-27). Sections below are earlier snapshots.

# IOSutra technology section update

Preview only; not deployed. Details: `docs/CROSS-PROMOTION.md`.
- Added a "Technology & innovation" section on the home page, a `/technology/` page and a small footer reference on every page, all driven by `data/promos.json` through the reusable `scripts/promo.mjs`.
- IOSutra is introduced only as "our AI-powered business software platform". The statement "IOSutra is a member of the NVIDIA Inception program." always appears with a line saying the membership applies to IOSutra only and does not imply NVIDIA sponsors or endorses Forbidden Mantra Press or the bookstore.
- **Open items, enforced by a production build gate that refuses today:** (1) no IOSutra URL exists in the repo and none could be found by search, so the link is a visible placeholder; (2) the membership is owner-asserted, not independently verified; (3) trademark wording is unconfirmed; (4) the owner has not approved the promo.
- **Badge not included:** no authorised asset and no Inception-specific usage terms were available. The code can render one only after licence confirmation and a recorded guidelines review; this was tested with a clearly marked test file, never an NVIDIA mark.
- Tests: 66 new checks pass; the earlier 139 and 95 still pass.

---

# Multilingual update

Preview only; not deployed. Full design notes: `docs/LANGUAGES.md`.

## What exists now
- **Language dropdown** in the header on every page (also on mobile, beside the hamburger). It has two clearly separate parts: **Website language** (menus, labels, buttons) and **Books by language** (verified editions only, with counts).
- **Registry of 39 languages** (`data/languages.json`): major world, South Asian and classical (Sanskrit, Latin, Ancient Greek, Coptic). Adding one is a single entry.
- **Website languages:** English complete; Spanish, French, German, Portuguese, Italian, Arabic (right-to-left) and Hindi as **beta machine drafts that need native review**. Only chrome is translated; book descriptions, editorial copy and the Amazon disclosure stay English.
- **Book-language filter** on every browsing page, matched on the **same edition** as the format filter. Language pages for all 39 languages, a languages index, language chips on subject/tradition/author/collection/press pages, and `?lang=` links into existing subjects.
- **Edition model:** per-edition language, `alsoLanguages` (bilingual), edition title and translator, edition-level provenance (required for every non-English edition), per-marketplace retailer links. Book pages group editions by language.
- **Import:** language and marketplace validation, rejection of unsourced translations, staged candidate editions (`translationOf`), duplicate language+format detection, and unverified edition leads kept out of all counts.
- **Affiliate structure:** 18 Amazon marketplaces, each with its own tracking-ID slot (env `AMAZON_TRACKING_ID_<SUFFIX>`) and optional local disclosure. No IDs are set.

## Actual counts (computed from `data/import-report.json`)
| Language | Works | Editions |
|---|---|---|
| English | 23 | 31 |
| Every other language (38) | **0** | **0** |

So **one language has verified editions**. No translated edition, ISBN, price or availability was invented. Three Forbidden Mantra Press editions were *reported* in search results (Spanish *Om Namah Shivaya*, German *Om Namah Shivaya*, Spanish *Invoke the Fierce*). They have no ASIN, title or ISBN seen, so they are stored as unverified leads, not editions, and the Spanish and German pages correctly say "no verified editions yet".
Existing records are unchanged: `data/catalogue.json`, `staged.json` and `error-queue.json` are byte-identical to before this change.

## Tests
- `node scripts/verify.mjs`: **139 checks pass** (desktop 1366px and mobile 390px): dropdown open/close/Escape/outside-click/focus, interface switching (Spanish, Arabic RTL, back to English, persistence), honest counts, empty states in two interface languages, search incl. language names, all earlier checks.
- `node test/verify-multilingual.mjs`: **95 checks pass** on fictional fixtures: 7 editions in 5 language groups, same-edition language+format matching, bilingual counting, per-marketplace tag isolation, rejected/staged/lead records never surfacing, RTL edition rendering. I confirmed the key matching test fails when the logic is deliberately broken.
- Found and fixed during testing: bilingual-edition anchor links broke; an edition with only a library button omitted the "no verified retailer link" note (also fixed on the real site).

## Limits of this update
- The original repo contains **no language dropdown** (the only matches were CSS `translate()`); it may exist in the live Wix site, which could not be reached. This is a new build, not a restoration. If Wix Multilingual is in use there, plan how the two coexist.
- The multilingual **edition** behaviour is proven on fictional fixtures only; the real catalogue has no non-English editions yet.
- Interface switching is client-side: crawlers see English. Static per-locale pages with `hreflang` are the next step for SEO.
- UI translations are unreviewed drafts.
- Retailer links are still unverified live, and no tracking ID is recovered (details below and in `docs/AFFILIATE-AND-DEPLOYMENT.md`).
- Not pushed: the GitHub App still lacked access when last tried.

---

# Original preview report (2026-10-26)

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

Site: 148 pages (108 original + 40 language pages): 6 hubs, 29 departments, 16 traditions, 13 author pages, 23 book pages, 39 language pages, 6 reading paths, 4 collections, search/browse, press page, standards and disclosure pages.

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
5. Only English editions are verified, so every other language shows an honest empty state (see the multilingual update above).
6. Seven departments have zero published books (Yoga, Tantra, Christian Mysticism, Hermeticism, Alchemy, Astrology, Dreams); they have staged candidates.
7. Deployment: repo had no deploy config and the live Wix site could not be reached; where to host is your decision.
8. Publishing opportunities: hypotheses only; no demand data available (`research/publishing-opportunities.md`).
9. Fonts load from Google Fonts at runtime; screenshots used fallback serif fonts.
