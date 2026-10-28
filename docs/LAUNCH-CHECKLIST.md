# Launch-readiness checklist

State: 311 works, 632 editions, 12 languages, 99 verified covers, 626/626 eligible amazon.com links tagged `darktheoryinc-20`.
Source: `node scripts/launch-check.mjs` (1 blocker, 2 owner decisions, 8 warnings, 4 passed).

## Genuine blockers (owner action; no code can resolve these)
1. **IOSutra cross-promotion gate.** The NVIDIA Inception claims are owner-asserted. Confirm membership and the attribution wording in the Inception terms, record `verifiedOn` and `evidence`, then approve the promo. Until then the gate reports "NOT ready".
2. **Production address and host.** Choose the production URL and host, then deploy (not done in this work).
3. **Remaining approval gates** other than `nvidiaBranding` are still false.

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
