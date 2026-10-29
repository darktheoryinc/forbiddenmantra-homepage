# Launch report (2026-10-29): GO for owner preview, NO-GO for public launch until 4 owner items

Dev branch `claude/gallant-archimedes-ocwf9s`. Nothing deployed; production untouched.

## Verified today
| Check | Result |
|---|---|
| Catalogue | 311 works, 632 editions (123 Press, 188 by other authors), 12 languages with editions |
| Covers | 91 works show a verified cover (100 files: 37 original, 63 licensed Penguin Random House); 220 show a labelled text-only placeholder. 0 broken cover images on any page |
| Affiliate links | 2,597 tagged `darktheoryinc-20` Amazon links, all `rel="sponsored"`, new tab; 626 of 626 eligible amazon.com purchase links tagged; 0 untagged purchase links. 6 untagged `us.amazon.com` links are source citations on 3 book pages, not buy links. 11 non-US links (co.uk, es, in, ca) carry no tag by design and are labelled |
| Site integrity | 682 pages, 72,645 internal links, 0 broken; 2,985 images, 0 missing |
| Functional sweep | 59 pages (home, categories, authors, languages incl. Arabic RTL, search, legal, 12 book pages) at desktop, tablet and mobile: 0 JS errors, 0 failed requests, 0 horizontal scroll, 0 broken images |
| Home page | Compact header, six-per-row shelves, Digital Librarian search answers from the catalogue; covers link to tagged Amazon pages |
| Tests | All 16 suites and `scripts/verify.mjs` pass; axe finds 0 violations on 26 pages |
| Placeholders | 2 unverified records (Mo Pai Nei Kung, The Hidden Technology of Human Power) have no buy links |

## Launch-blocking items (all owner decisions; no technical blocker)
1. **Production address.** `productionAddress` not recorded and `siteUrl` empty; the production build refuses to run.
2. **Legal pages review.** `legalPagesReviewed` false: privacy, terms and affiliate disclosure need your review and a real contact method.
3. **IOSutra promotion and artwork rights.** `iosutraPromotion` and `iosutraArtworkRights` false (likeness/commercial rights for the meditating man and robot art). NVIDIA branding itself is approved and unchanged.
4. **Librarian artwork rights.** `librarianArtworkRights` false.

## Not blockers (can wait or be decided at launch)
* Hosting ZIP is stale (built before the homepage, librarian and cover-link changes): needs your approval to rebuild before any preview.
* Retail link validity was never run live (196 blocked, 133 inconclusive, 20 live; this session cannot reach Amazon). Run the GitHub link-check workflow before launch.
* 95 works have only a tagged Amazon search link (no verified product page); 36 covered third-party books link to a tagged ISBN search.
* amazon.co.uk tracking ID and analytics choice; interface translations are machine-drafted betas.
* 220 placeholder covers (own originals: see `docs/OWN-COVER-ROUTES.md`; third-party: Creators API or publisher permission).
