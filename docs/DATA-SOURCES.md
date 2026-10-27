# Catalogue data sources and the import pipeline

How books get into the catalogue, which sources are used, what each is and is not allowed to supply, and how to run the
automated route on a machine with network access. Policy lives in `config/sources.json`; this page explains it.

## Tiers (every published work carries `provenance.tier`)

| Tier | How it was verified | Publishes? |
|---|---|---|
| `hand-verified` | Checked by hand against dated sources (the original 53 works). | Yes |
| `web-corroborated` | The ISBN-13 appeared with the same title and author on **two independent bookseller/catalogue sources**. Every source URL is stored on the edition. | Yes |
| `auto-two-source` | Produced by `reconcile.mjs`: Open Library **and** Google Books carry the same ISBN-13 and agree on title, first author, language; format is stated; no quality rule fired. | Yes (files in `staging/batches/auto-*.json`; delete a file to withdraw it) |
| staged / review | Anything else: single source, conflicting data, unknown format, blocked title, unmatched subject. | **No** |

"Independent" means different companies. `config/sources.json` → `policy.hostOwnerGroups` merges hosts under common ownership
(Amazon, AbeBooks and Goodreads are one source; amazon.com and amazon.co.uk are one source). The importer enforces the rule
**per edition**: an edition with fewer than two independent hosts is held back and the work is published with its other editions.

## What is never copied from any source

Descriptions, cover images, prices, availability, ratings and reviews. A book page shows a factual summary built only from verified
fields ("Filed under ...; catalogued in paperback from ...") and says that no description has been written yet. Covers are typographic
placeholders. This avoids third-party copyright and avoids implying price or stock.

## Files

```
config/sources.json         source registry + compliance policy (terms reviewed? rate limits, never-store list, host groups)
config/import-rules.json    quality rules (blocked title patterns such as "Summary of", "workbook", "box set"; similarity floor)
config/subject-map.json     fallback subject -> department/tradition rules for records that arrive without a seed
config/seeds/subjects.json  246 editorial seeds: subjects, authors and series -> department/tradition (edit freely)
scripts/harvest.mjs         discover | verify | goodbooks   (resumable, rate-limited, cached)
scripts/harvest/lib.mjs     rate limiter, retry with Retry-After, circuit breaker, disk cache, checkpoints, ISBN helpers
scripts/harvest/adapters.mjs  Open Library, Google Books and goodbooks-10k parsers (descriptions/covers/prices are dropped here)
scripts/reconcile.mjs       group editions into works, two-source agreement, quality rules -> batches + review queue
scripts/import.mjs          validates and publishes: staging/verified/*.json (hand), staging/batches/*.json|*.vpsv (bulk)
staging/batches/*.vpsv      web-corroborated rows (one row per edition; rows with the same title+author become one work)
staging/review/*.json       held-back titles with the reason (not part of the catalogue)
data/error-queue.json       every rejected / duplicate / warning record from the last import
data/import-report.json     counts, including publishedByProvenance
```

## Running the automated route (needs network; not possible from the build sandbox)

```bash
export FM_CONTACT_EMAIL=you@example.com          # sent in the User-Agent
export GOOGLE_BOOKS_API_KEY=...                  # free key; anonymous calls have a zero quota. Never commit it.
# 1. read the terms (config/sources.json -> termsUrl), then set termsReviewed: true, or pass --accept-terms per run
node scripts/harvest.mjs discover --seeds config/seeds/subjects.json --pages 3 --accept-terms   # Open Library, ~1 req/s
node scripts/harvest.mjs verify --limit 1000 --accept-terms                                      # Google Books, free daily quota
node scripts/reconcile.mjs --batch-size 250
node scripts/import.mjs && node scripts/build.mjs
```

Every command is **resumable**: an interrupted run continues from `staging/harvest/*.checkpoint.json`; responses are cached under
`staging/harvest/.cache/`; a 429 honours `Retry-After`; five consecutive failures open a circuit breaker and stop the run with progress
saved. Re-running costs no requests for work already done. `test/verify-pipeline.mjs` exercises all of this against a local mock of
both APIs (22 checks, no network).

Open Library's bulk data dumps are the right tool beyond a few thousand records (the API is meant for light use); the adapters parse
the same record shape, so a dump reader only needs to emit the common record format.

`goodbooks-10k` (CC BY-SA, reported; confirm before redistributing derived data) is used **only to nominate titles** (`harvest.mjs goodbooks`
then `discover --nominations`). Its ISBNs are never trusted: a spot check found one wrong (a derived Signet *1984* number that did not exist in
any bookseller listing), which is why nominations still need two independent sources.

## Source limitations found while building this

* **Open Library** is unreachable from the build sandbox (requests never complete). Written against its documented API shapes and tested
  against a mock; a first real run on a networked machine may need small adapter fixes.
* **Google Books** is reachable but answers HTTP 429 with a zero daily quota for anonymous calls. A free API key is required.
* **Wikipedia, Internet Archive**: also unreachable from the sandbox.
* **Amazon**: no scraping and no credentials were used. Product pages count as evidence only when their URL appeared in a cited
  search result. The Creators/Product Advertising API needs qualifying sales; see `docs/AFFILIATE-AND-DEPLOYMENT.md`.
* **Web-search verification** returns about one clean work per query at roughly 4,000 tokens; the per-turn search budget (200) ended
  one batch early. This is the slow route, and it is why the networked pipeline is the route to thousands.

## Affiliate link rule for bulk tiers

A `/dp/<ISBN-10>` link is **not assumed** for bulk-imported editions. An edition gets a tagged product link only if an amazon.com
product URL for its exact ISBN-10 appeared in a cited source ("Product page seen in a cited source on <date>; live check pending").
Otherwise the button is a labelled **"Search on Amazon"** link for the ISBN-13 with the same tracking ID, status "ISBN search link; no
product page has been verified". The original 41 hand-verified works keep their previously-approved ISBN-10 links, labelled "not yet
confirmed live"; `scripts/check-links.mjs` on a networked machine upgrades or removes them. Hosts under the amazon.co.uk-style
marketplaces carry no tag until that marketplace's ID is configured.
