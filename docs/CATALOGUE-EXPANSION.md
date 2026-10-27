# Catalogue expansion report (2026-10-27)

Scope: build reusable import infrastructure, import verified records in batches, make the site scale to 25,000+ records, and
report honestly. Nothing was deployed, no production setting was changed, nothing was purchased. All new records are in the
private preview only.

## Headline numbers

| | Before | Now | Change |
|---|---|---|---|
| Published works | 53 | **192** (180 third-party + 12 Forbidden Mantra Press) | +139 |
| Editions | 69 | **223** | +154 |
| Unique authors | 39 | **132** | +93 |
| Works with 2+ editions grouped | 16 | 31 | |
| Series catalogued | 0 | 13 (14 works) | |
| Departments with at least one book | 28 of 33 | **47 of 50** (still empty: Dreams, Jainism, Paranormal Fiction) | |
| Traditions with at least one book | 15 of 17 | 20 of 21 | |

Phase 1 target was 1,000 verified books. **That target is not met: 192 are verified and published.** The 139 new works were verified one
by one from public bookseller/catalogue pages (two independent sources per edition). The automated route that can reach 1,000+ is built
and tested but cannot run from the build sandbox (see "What stopped 1,000").

Provenance of the published works: 53 `hand-verified`, 139 `web-corroborated`, 0 `auto-two-source` (that tier needs the networked harvest).
Every one of the 139 new works shows its source URLs on its book page; none has a copied description or cover.

## Rejected, uncertain and awaiting review

* **35 titles searched but not published** (`staging/review/held-web-2026-10-27.json`): each with the ISBN seen and the reason, almost all
  "only one independent source group showed this ISBN" or "sources disagree on the binding". They need one more source or a decision.
* **69 items in `data/error-queue.json`**: 2 errors (*The Prophet*, Deluxe Edition, has a single source; *Stillness Speaks* in the old editorial
  shortlist has an ISBN that fails its checksum), 18 warnings (identifiers missing on owner-listed press editions, plus *Siddhartha*, Bantam: that
  edition is held back while the New Directions edition is published), 49 duplicates (candidate rows that match published works).
* **50 staged candidates** (`data/staged.json`, from the earlier editorial shortlist): valid but unverified, not published.
* A goodbooks-derived ISBN for *1984* was wrong in a spot check (the number matched no bookseller listing). Nominations are never trusted
  without two sources.

## Category coverage of the new works

Buddhism 15, Mindfulness 14, Ancient texts 14, Philosophy 10, Supernatural fiction 10, Speculative fiction 10, Epic fantasy 9, Mythology 9,
Horror 8, Ceremonial magic 8, Witchcraft 8, Fantasy 7, Personal growth 7, Hinduism 6, Consciousness 6, Ancient civilizations 6, Yoga 5, Tarot 5,
Hermeticism 5, Wicca 5, Spells 5, Taoism 5, Comparative religion 5, Magical realism 4, Emotional wellbeing 4, and 1-3 each in Islam & Sufism,
Theology, Gnosticism, Tantra, Astrology, Dark fantasy, Urban fantasy, Paganism, Mind-body, Judaism & Kabbalah, Sikhism, Divination, Alchemy,
Folklore, Christian mysticism, Qigong, Sanskrit mantras, Subtle body. Hub totals now: Fantasy, Folklore & Fiction 93; Religions & Sacred Texts 71;
Consciousness, Myth & Wisdom 64; Meditation, Yoga & Mantra 42; Occult, Magick & Paganism 40; Wellbeing & Health 32; Energy & Inner Cultivation 9.
Thin spots: Jainism (taxonomy ready, no verified book yet), dreams, paranormal fiction, Qigong/Neigong, Sikhism, divination beyond tarot, alchemy.

## Affiliate product-link coverage (offline audit, `scripts/audit-affiliate.mjs`)

* 222 purchase links, **0 errors** (right tag `darktheoryinc-20` on every amazon.com link, none anywhere else, ASIN matches the edition).
* **76 of 192 works (40%) have a tagged amazon.com product link**: 35 because the exact product page appeared in a cited source, 41 (the original
  hand-verified tier) matched offline to their own ISBN-10 and labelled "not yet confirmed live".
* **116 works (60%) have only a clearly labelled "Search on Amazon" link** for the ISBN-13. No `/dp/` link is assumed for bulk-imported editions.
* No price, availability or stock is shown anywhere. Live link validation (`scripts/check-links.mjs`) still needs a networked machine.

## Architecture: does static still work at 25,000?

Yes, with limits that are now configuration (`config/site.json` → `build`), not code:

* **Pagination**: 48 cards per static listing page, capped at 40 pages per list (`maxListingPages`); the rest of a list is reached through filters/search.
* **Lazy chunk index**: `assets/idx/cNN.js` (≈1,500 records each, script files so it works from `file://`). Search, filters and "Show more" run over
  the chunks for that listing only; results appear as chunks arrive (3 at a time).
* **Tiered book pages**: the first 6,000 books (press, hand-verified, web-corroborated first) get static pages; the rest are drawn by `book/index.html`
  from a 256-way hashed detail shard (≈110 kB each, one file per view). Buy links come from the same build functions, and a test proves the dynamic
  view's links are identical to the static page's. The dynamic view is `noindex` and not in the sitemap.
* **Author pages** only for authors with 2+ books or a press title once the catalogue exceeds 2,000 works; single-book authors link to a search.
* File count at 25,095 works: **14,395** (limit on common free static hosts: 20,000). Output 465 MB (HTML compresses ≈6:1 on any CDN).
  Real catalogue now: 500 pages, 507 files, ~14 MB, builds in 0.8 s.

### Measured performance (SYNTHETIC 25,095-record catalogue; `scripts/synth-catalogue.mjs` + `test/perf.mjs`; raw data in `docs/perf-25k-synthetic.json`)

| | Desktop (Chromium, local HTTP + gzip) | Mobile profile (4x CPU, 1.6 Mbit/s, 150 ms RTT) |
|---|---|---|
| Browse page load (`books/`) | 69 ms | 594 ms (FCP 536 ms) |
| Listing HTML (gzip) | 10 kB | 10 kB |
| First search, first results visible | 560 ms | 2.0 s |
| First search, all chunks loaded (1.2 MB gzip) | 0.84 s | 7.0 s |
| Later search (title / word / ISBN) | 150-200 ms | 234-260 ms |
| Typo ("close matches") / no-match search | 415 ms / 250 ms | 1.8 s / 0.6 s |
| Language or subject filter over the whole index | 37-49 ms | 146-187 ms |
| Dynamic book view | 127 ms | 1.1 s |
| JS heap after the full index is loaded | 56 MB | 45 MB |
| Full 25k build | 59 s, one process | |

Build size is dominated by the 6,000 static book pages; the index is 4.0 MB raw / 1.2 MB gzip for 25k records. The weak point on a slow phone
is the 1.2 MB first download (mitigated by progressive results); an inverted-index shard scheme is the next step beyond ~50k records.
Accessibility: axe-core reports 0 violations on 26 pages plus the search-results and dynamic-view states at desktop and mobile widths.
Mobile checks: no horizontal scroll on paged lists, search results or the dynamic view; pager links are ≥44 px.

## Tests (all passing at commit time)

`scripts/verify.mjs` 139 · `test/verify-multilingual.mjs` 95 · `test/verify-promo.mjs` 66 · `test/verify-discovery.mjs` 86 ·
`test/verify-launch.mjs` 49 · `test/verify-affiliate.mjs` 33 · `test/verify-pipeline.mjs` 22 (new) · `test/verify-scale.mjs` 41 (new) · axe (26 pages).
Several older tests had hard-coded counts; they now derive counts from the data.

## What stopped 1,000

1. **Network.** Open Library and the Internet Archive are unreachable from this sandbox; Google Books answers 429 with a zero anonymous quota.
   The harvest/reconcile pipeline is complete and mock-tested but has not run against the real services.
2. **Verification by search is slow and rate-limited.** About 4,000 tokens per accepted work, and a 200-search-per-turn cap ended the last batch
   after 7 of 31 queries. Continuing needs a new message (or `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` raised).
3. **A strict rule on purpose.** Two independent source groups per edition, with Amazon/AbeBooks/Goodreads counted once. It rejects roughly a
   fifth of otherwise-plausible rows rather than risk a wrong ISBN (4 of 11 remembered ISBNs were wrong in the first batch; one goodbooks ISBN was wrong).

## Requirements to reach 5,000 and 25,000

**To 5,000 (days, ~$0):** run the pipeline on any networked machine: a contact email, a free Google Books API key (the default quota is reported as 1,000 lookups/day; confirm in your Google Cloud console, so roughly 5 days
for 5,000 ISBNs unless you raise it), and a review of the Open Library and Google Books terms (flip `termsReviewed`). Expand `config/seeds/subjects.json`
(authors and series are the best seeds), run `harvest discover` → `verify` → `reconcile` → `import` in 250-record batches, and skim `staging/review/`
(single-source and format-unknown rows). The share of Open Library editions that survive the two-source and format rules is unknown until the first real run (the web-search route accepted about 140 works from about 200 searches). Run `scripts/check-links.mjs`
from the same machine so product links are live-checked.

**To 25,000 (weeks, still near $0 on hosting):** switch discovery to Open Library's monthly data dump (a dump reader emitting the same record shape),
keep Google Books as the second source across several days of quota, and consider ISBNdb (paid) or publisher feeds only if coverage stalls.
Hosting: Cloudflare Pages free tier (20,000 files; 14.4k used at 25k) or Netlify/GitHub Pages; no server is needed. Decide the hosting and `siteUrl`
(still a launch blocker), keep `maxStaticBookPages` ≤ ~9,000 if you stay on a 20k-file host, and add an inverted-index shard scheme if the catalogue
passes ~50k. Monetization scales with search-link coverage; applying for the Amazon Creators API (needs qualifying sales) would replace search links
with verified product links and compliant price/availability.
