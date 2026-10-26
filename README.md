# Forbidden Mantra Press: curated bookstore (preview)

Branch `claude/gallant-archimedes-ocwf9s`. Not published to production.

```
node scripts/import.mjs        # validate + dedupe + stage catalogue  -> data/*.json
node scripts/build.mjs         # generate static site                 -> site/
node scripts/verify.mjs --shots  # real-site checks: links, search, filters, language menu, mobile (needs Playwright)
node test/verify-multilingual.mjs  # multilingual behaviour on FICTIONAL fixtures (never published)
```
Open `site/index.html` in a browser (links are relative; no server needed).

| Path | What |
|---|---|
| `legacy/` | Original one-page homepage, Wix Velo snippet and zip, untouched |
| `config/site.json` | Site name, disclosure, affiliate settings (tracking ID via `AMAZON_TRACKING_ID`, never committed) |
| `data/languages.json` | Language registry (39 languages); counts are computed, never typed |
| `i18n/*.json` | Website-interface translations (en complete; 7 beta drafts needing native review) |
| `docs/LANGUAGES.md` | Interface vs book language, adding languages/editions, per-marketplace affiliate structure |
| `data/taxonomy.json` | 6 hubs, 29 departments, 16 traditions, with original introductions |
| `staging/verified/*.json` | Hand-verified records with dated sources; the only input that can be published |
| `staging/*.psv` | Bulk candidate rows; staged only, never published |
| `data/catalogue.json` `staged.json` `error-queue.json` `import-report.json` | Importer outputs |
| `data/collections.json` | Reading paths and collections |
| `research/publishing-opportunities.md` | Hypotheses only; not evidence of demand |
| `docs/AFFILIATE-AND-DEPLOYMENT.md` | Attribution, API eligibility, retailer-link states, deployment |
| `docs/REPORT.md` | Counts, results, unresolved records, blockers |

Adding books: add a verified record (with `sources` and an access date) to `staging/verified/`, or add candidate rows to a `.psv`; run the importer; read `data/error-queue.json`.
