# Forbidden Mantra Press: curated bookstore (preview)

Branch `claude/gallant-archimedes-ocwf9s`. Not published to production.

```
node scripts/import.mjs        # validate + dedupe + stage catalogue  -> data/*.json
node scripts/build.mjs         # generate static site                 -> site/
node scripts/verify.mjs --shots  # real-site checks: links, search, filters, language menu, mobile (needs Playwright)
node test/verify-multilingual.mjs  # multilingual behaviour on FICTIONAL fixtures (never published)
node test/verify-promo.mjs         # IOSutra section, wording lint, badge/production gates
node test/verify-discovery.mjs     # catalogue expansion, collections, typo-tolerant search, nav
node test/verify-launch.mjs        # articles, analytics, production mode, link checker, launch gate
node test/verify-affiliate.mjs     # Amazon tags/ASINs/disclosures/click events, with corruption tests
AXE_PATH=<axe.min.js> node test/a11y.mjs   # axe-core audit (install axe-core in a scratch dir)
node scripts/audit-affiliate.mjs   # audit every rendered Amazon link
node scripts/check-links.mjs       # live retailer check: run on a networked machine
node scripts/launch-check.mjs      # blockers and owner decisions

# catalogue scale (see docs/DATA-SOURCES.md and docs/CATALOGUE-EXPANSION.md)
node scripts/harvest.mjs discover|verify|goodbooks   # Open Library / Google Books harvest: resumable, rate-limited (networked machine)
node scripts/reconcile.mjs     # harvested records -> two-source batches + review queue
node test/verify-pipeline.mjs  # pipeline integrity on a mock of both APIs
node test/verify-scale.mjs     # pagination, chunk index, dynamic book tier, retailer-link rule
node scripts/synth-catalogue.mjs --n 25000 && FM_DATA=test/fixtures/perf/data FM_OUT=test/out-perf node scripts/build.mjs && node test/perf.mjs test/out-perf   # SYNTHETIC 25k load test
```
Open `site/index.html` in a browser (links are relative; no server needed).

| Path | What |
|---|---|
| `legacy/` | Original one-page homepage, Wix Velo snippet and zip, untouched |
| `config/site.json` | Site name, disclosure, affiliate settings (tracking ID via `AMAZON_TRACKING_ID`, never committed) |
| `data/languages.json` | Language registry (39 languages); counts are computed, never typed |
| `i18n/*.json` | Website-interface translations (en complete; 7 beta drafts needing native review) |
| `data/promos.json` | Cross-promotion registry (IOSutra): brands, claims with verification status, placements; `scripts/promo.mjs` renders it |
| `docs/CROSS-PROMOTION.md` | How the IOSutra section works, launch gate, badge rules, reuse on other sites |
| `docs/LAUNCH-STATUS.md` | **Start here:** status audit, counts, blockers, launch readiness |
| `docs/CATALOGUE-EXPANSION.md` | Catalogue expansion report: counts, review queue, affiliate coverage, 25k performance, what is needed for 5,000 / 25,000 |
| `docs/DATA-SOURCES.md` | Source policy, verification tiers, how to run the automated import |
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
