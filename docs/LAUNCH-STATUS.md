# Forbidden Mantra Press: status audit and launch readiness

Measured on 2026-10-27 from the repository `claude/gallant-archimedes-ocwf9s` (not from memory). Nothing is deployed; `main` is untouched.
Legend: **Verified** = a test or audit proves it · **Implemented** = built, not independently proven · **Partial** · **Planned** = not built.

## Task 1: what exists

| # | Question | Answer | Status |
|---|---|---|---|
| 1 | Books in the catalogue | **53 published works, 69 editions, 39 authors** (12 Forbidden Mantra Press, 41 outside). **97 further candidates staged, unpublished.** | Verified (import report) |
| 2 | Complete published book pages | **53 of 53** have a page with editions, sources, subjects, disclosure. 21 records are flagged for manual review (below), so "complete" means structurally complete, not every fact confirmed. | Verified |
| 3 | All existing FMP books imported? | **No, not provably.** 12 are in: your 4 homepage titles + 8 found in search. Amazon shows the Forbidden Mantra Series as **41 books**. Without a KDP / Author Central export the rest cannot be listed without inventing data. 14 FMP editions lack an ASIN. | Partial |
| 4 | Third-party authors and books | **Original 11 works:** Tolle, Singer, Chödrön, Maté, Buckland, Cunningham, Illes, Pollack, Chia and Winn, Pagels, Ashley-Farrand. **Added 30:** Rowling, Tolkien, Le Guin, Lewis, Gaiman, Pratchett, Clarke, Miller, Rothfuss, Sanderson, Martin, T.H. White, British Library, Jackson, Stoker, Shelley, Bradbury, Bulgakov, Rice, the Grimms, Frazer, Marcus Aurelius, Plato, Nietzsche, Frankl, Seneca. **Not published:** Sally Kempton and others requested (no verified ISBN; staged). | Verified |
| 5 | Categories, authors, search, filters | 7 hubs, 33 departments, 17 traditions; authors A–Z and 39 author pages; search by title/author/subject/ISBN/language with typo tolerance; filters for subject, tradition, language, format, level, source. Desktop and 390px mobile. | Verified (139+86 browser checks) |
| 6 | Multilingual selector | Header dropdown, 39-language registry, edition-level language filter and language pages, 8 website languages. **Only English has verified editions**, so 38 languages correctly show "none yet". Website translations are unreviewed machine drafts. Multi-language editions proven on fictional fixtures only. | Implemented / Verified on fixtures |
| 7 | Amazon affiliate links | **US ID `darktheoryinc-20` configured for amazon.com only.** 66 of 66 amazon.com buttons tagged, 0 audit errors, UK links deliberately untagged. **Not live-checked** (retailers are unreachable from the build sandbox). | Verified offline; live check Planned |
| 8 | Blog-to-book connections | 96 Wix blog posts read (read-only API, checksum-verified), 82 unique shown, linked to books/topics by keyword rules; 6 books and 15 topic pages show "From the blog". Connections are suggestions, not editorial review. | Verified |
| 9 | Mobile-friendly | 390px layout, hamburger menu, language panel, no horizontal scroll, contrast ≥ 4.5:1; **axe-core: 0 violations** on 22 pages at both widths. Manual screen-reader and keyboard testing not done. | Verified (automated) |
| 10 | Incomplete / broken / untested | See "Remaining work". | n/a |

## Task 2: strategy items

| Item | Status |
|---|---|
| Preserve existing catalogue and original publications | Verified (all 23 original works are byte-identical to the first published catalogue) |
| Fantasy, folklore, supernatural fiction, philosophy shelves | Implemented: new hub + 4 departments, 30 verified works |
| Harry Potter and major-fantasy discovery collections, no implied affiliation | Implemented and tested: "If You Love Harry Potter", "Major Fantasy Authors", "Myth Retold", "Gothic & Supernatural Classics", 3 paths. Independence notice on every related page; no franchise artwork or "official/authorized" claims. |
| Dedicated book/author pages, category navigation, prominent typo-tolerant search | Verified |
| Articles connected to books | Verified (above) |
| IOSutra navigation, branding, low-key promotion | Implemented: nav item, home section, footer line, `/technology/`. **Gated:** URL, approval and membership verification are open. |
| Phased multilingual navigation and discovery | Phase 1 done (structure, UI, filters, honest counts). Phase 2 needs verified non-English editions; phase 3 is static per-locale pages with `hreflang`. Planned. |
| Authorized affiliate links, disclosures, analytics | Affiliate + disclosure + click events: Verified. Analytics: structure only, **off** until you choose a provider. |
| **The October 26 strategy document** | **Not in the repository; I never saw it.** Work followed the bullets in the request only. Add it to `docs/` for a gap analysis. |

## Task 3: checks run

`node scripts/verify.mjs` 139 · `test/verify-multilingual.mjs` 95 (fictional fixtures) · `test/verify-promo.mjs` 66 · `test/verify-discovery.mjs` 86 · `test/verify-launch.mjs` 49 · `test/verify-affiliate.mjs` 33 · `test/a11y.mjs` (axe-core) 0 violations · link check 222 pages / 0 broken · importer validation (ISBN checksums, duplicates, provenance) · `scripts/audit-affiliate.mjs` · `scripts/launch-check.mjs`.
**468 automated checks pass.**

## Task 4: report

**Completed and verified:** everything marked Verified above.

**Amazon affiliate numbers** (`node scripts/audit-affiliate.mjs`):
- **43 books** have a valid tagged amazon.com product link whose ASIN is the edition's own ASIN or the ISBN-10 computed from its own ISBN-13 (2 seen in sources, 41 derived). Tagging changes only the `tag=` parameter.
- **10 books** have only an Amazon *search* link (Forbidden Mantra Press titles with no ASIN): **missing product links**.
- **0** books have no purchase link; **0** link errors.
- **21 records need manual review:** 12 owner-listed press records with unconfirmed editions (includes the 10 above and *Mo Pai Nei Kung*, *The Hidden Technology of Human Power*, *Forbidden Mantra*), 9 works with an identifier from a single source, 8 with an e-book/audiobook edition lacking a verified Amazon link (reasons overlap).
- 41 links are **not live-proven**. Identity is checked offline; whether Amazon currently serves that page is not.

**Remaining work:** live link check · KDP export for the other press titles and the 10 missing ASINs · hosting · IOSutra URL/approval/membership verification · privacy text review and contact method · native review of 7 website languages · non-English editions · more fantasy/series titles (staged only) · optional analytics · the strategy document.

**Blockers needing your decision:** (1) where to host (free static hosting is enough; no deploy config exists); (2) analytics provider or none; (3) IOSutra URL, membership verification and approval; (4) whether to supply the KDP export; (5) which unconfirmed claims or wording you accept.

**Recommended next three actions**
1. Run `node scripts/build.mjs && node scripts/check-links.mjs` once on your own computer (free, minutes). It live-checks the 67 retail URLs and the next build hides any dead one.
2. Export your KDP / Author Central title list so the 10 search-only press books get real product links and the other ~29 series titles can be added.
3. Choose a free host and set `siteUrl`; then run `FM_ENV=production node scripts/build.mjs`, which will list every remaining gate.

**Ready to launch?** **No.** `node scripts/launch-check.mjs` reports 2 blockers (live link validation not yet run; IOSutra gate) and 2 owner decisions (hosting, analytics). The bookstore itself is functionally complete and revenue-capable the moment hosting is chosen. The honest gap is verification, not features.
