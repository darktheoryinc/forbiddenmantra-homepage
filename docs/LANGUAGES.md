# Multilingual bookstore: how it works

Two different things are called "language", and the site keeps them apart.

| | Website language | Book language |
|---|---|---|
| What it is | Language of menus, labels, buttons, filters | Language an **edition is published in** |
| Where it lives | `i18n/<code>.json`, chosen in the header dropdown | `editions[].language` (+ optional `alsoLanguages`) in the catalogue |
| Scope today | Navigation, filters, edition labels, counts, empty states. **Book descriptions and editorial text stay English.** The Amazon disclosure stays English. | Filter, language pages, search, edition grouping |
| Status | English complete; es, fr, de, pt, it, ar, hi are **machine-drafted betas that need native-speaker review** | Only English has verified editions |

## Honest counts
Every count is computed from `data/catalogue.json`. A language is listed as stocked only if at least one verified edition exists in it. Languages with zero editions are registered (so the structure is ready), appear in a collapsed "working toward" list, and their pages say "no verified editions yet". Reported-but-unverified editions live in `staging/edition-leads.json` and are never counted or shown as available.

## Add a language
1. Append an entry to `data/languages.json` (`code`, `name`, `endonym`, `group`, `dir`, candidate `amazonMarketplaces`). Language pages, filter options, the dropdown and the index update on the next build.
2. Optional, for the website UI: copy `i18n/en.json` to `i18n/<code>.json`, translate, set `interface` to `beta` in the registry. Missing keys fall back to English and are reported at build time. Right-to-left languages need `dir: "rtl"`.

## Add a translated or other-language edition
Add it to the existing work's `editions` array in `staging/verified/*.json`:

```json
{ "format": "paperback", "language": "es", "title": "…", "subtitle": "…", "translator": "…",
  "publisher": "…", "year": 2024, "isbn13": "…",
  "sources": [{ "label": "…", "url": "https://…", "accessed": "YYYY-MM-DD", "supports": "isbn, title" }],
  "retailers": [{ "retailer": "amazon", "marketplace": "amazon.es", "url": "https://www.amazon.es/dp/ASIN",
                  "verification": "verified-live", "checkedOn": "YYYY-MM-DD" }] }
```
The importer **rejects** a non-English edition without its own dated source, an unknown language code, a bad ISBN checksum, an unknown marketplace, or two editions sharing an identifier. Bilingual editions (for example Sanskrit–English) use `language: "en", alsoLanguages: ["sa"]`. Bulk candidates can name `translationOf` (a published work slug) in a `.psv`; those are **staged only** in `data/staged-editions.json`, and duplicates of an existing language+format are flagged.

Editions of one work share one book page, grouped by language, each with its own ISBN, format and retailer links. Language and format filters match the **same edition**: "Spanish + e-book" finds a work only if it has a Spanish e-book.

## International affiliate links (structure ready, no IDs set)
`config/site.json` → `affiliate.marketplaces` lists 18 Amazon marketplaces, each with its own `trackingId`, `enrolled` and optional local `disclosure`. Tracking IDs are read at build time from `AMAZON_TRACKING_ID_<SUFFIX>` (`_COM`, `_CO_UK`, `_DE`, `_FR`, `_ES`, `_IT`, `_CO_JP`, `_IN` …; plain `AMAZON_TRACKING_ID` = amazon.com). A link receives only its own marketplace's ID. **Not known:** which marketplace programmes this account is enrolled in, and the required local disclosure wording per programme. Confirm both in Associates Central before launch. English-edition links are built from ISBN-10 for amazon.com only. **Links for other languages are never derived**; they must be added as verified entries.

## Not done yet / future
- Static per-locale page trees with `hreflang` (better for SEO than the current client-side UI switch, which leaves crawlers with English).
- Translating editorial text, descriptions and reading-path copy.
- Region-aware retailer choice (for example sending German readers to amazon.de) once verified links per marketplace exist.
- Prices, availability and ratings per marketplace through the Creators API (blocked: no credentials).

## Tests
`node scripts/verify.mjs` (real site, 139 checks) and `node test/verify-multilingual.mjs` (fictional fixtures, 95 checks; never published, output in `test/out/`).
