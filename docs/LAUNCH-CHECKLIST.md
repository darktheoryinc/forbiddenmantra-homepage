# Launch-readiness checklist

State: 311 works, 632 editions, 12 languages, 99 verified covers, 626/626 eligible amazon.com links tagged `darktheoryinc-20`.
Source: `node scripts/launch-check.mjs` (preview ready; production gated by the owner approvals below).

## Gates (exact names, current value, purpose, type)
| Gate | Value | Purpose | Type | Blocks preview? |
|---|---|---|---|---|
| `nvidiaBranding` (config/approvals.json) | **true**, owner, 2026-10-28 | Show badge/panel inside the IOSutra ad | Settled. The earlier checklist wrongly listed it as a blocker. The only gap is that data/promos.json claim entries still say owner-asserted / needs-confirmation because no portal evidence was supplied: administrative, no branding change, no invented evidence | No |
| `iosutraPromotion` | false | Owner approval that the IOSutra section is promoted here | Owner decision, but the owner has already directed the ad's placement; flag is unreconciled with that instruction | No (preview). Production build refuses |
| `iosutraArtworkRights` | false | Likeness/commercial rights for the man-and-robot artwork | Owner decision | No (preview). Production |
| `librarianArtworkRights` | false | Rights to the librarian character art | Owner decision | No (preview). Production |
| `legalPagesReviewed` | false | Privacy/terms/disclosure reviewed, contact method added | Owner decision | No (preview). Production |
| `productionAddress` | false, url null | Final public address | Owner decision | No (preview). Production |
| `siteUrl` (config/site.json) | empty | Canonical URLs for production | Owner decision with productionAddress | No |
| Analytics | off | Optional | Owner decision | No |

Technical blockers for a preview: **none open**. Production gate, as launch-check reports it: IOSutra promotion approval, hosting URL, analytics choice.

## Working and verified (functioning bookstore)
- Build: 682 pages. All test suites pass (covers, security gate, launch, librarian, curation, promo, discovery, affiliate, niches, multilingual, scale, wix-embed, pipeline, cover-bulk). axe finds no violations across 26 pages at desktop and mobile widths.
- Affiliate: 626/626 eligible links tagged. Non-US links (amazon.co.uk x2, amazon.es x1) earn nothing until an ID is set.
- Seven-column desktop layout intact; 6/5/4/3/2 columns below; no horizontal overflow.
- Records the owner has not confirmed are not sold: "Mo Pai Nei Kung" and "The Hidden Technology of Human Power" are placeholders (`purchasable:false`), hidden from shelves and buy links, and show a clear note on their pages.
- Missing covers use a consistent text-only card ("Cover art coming"). It does not imitate artwork. Mo Pai Exposed's candidate cover stays unassigned.

## Can wait (improvements)
- Covers for about 101 works (`docs/COVER-RECOVERY-PLAN.md`, Tier 1 first).
- Live link check on a networked machine (`scripts/check-links.mjs`): 415 URLs never checked, 196 blocked.
- 4 Press editions with no ASIN/ISBN use search links.
- Interface translations (es, fr, de, pt, it, ar, hi) are machine-drafted betas.
- Privacy page needs a contact method and legal review.
- Import queue: 2 errors, 49 duplicates, 50 staged candidates.
- Amazon marketplace IDs beyond amazon.com.

## Owner decisions still needed
1. Mo Pai Exposed: is the candidate image the listing's front cover?
2. Mo Pai Nei Kung: keep as placeholder, or give the title and ASIN. Same for "The Hidden Technology of Human Power" (a series name) and "Forbidden Mantra" (no ASIN; still listed, flagged).
3. B0GYYGC3XH: what is it? See `docs/INVENTORY-RECONCILIATION.md`. It is not added or merged.
4. Inner Mechanics covers: English B0H3MY3JS3, Spanish B0H3NV7ZVS, Hindi B0H44YW832.
5. Which titles share identical print artwork.
6. Author-name and imprint variants (Muslim Prayer, R. K. Theory, Alex Knight, Spiritual Expressionz; Emily K Patel/Patel/Kissoon; Rav Shiva/TSP Ravshiva).
7. Department confirmations, and the NVIDIA/IOSutra and hosting items above.
