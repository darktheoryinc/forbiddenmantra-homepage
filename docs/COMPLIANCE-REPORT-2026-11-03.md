# Compliance report: Forbidden Mantra Press library (prepared 2026-11-03)

**Branch:** `claude/compliance-remediation` (not deployed, not merged). Existing Netlify deployment, DNS and the Wix site were not touched.
**This is not legal advice, not a legal certification and not a guarantee of Amazon compliance.** It records what the code and data do, what could be checked, and what could not.

## 0. How to read the evidence labels
* **VERIFIED:** checked in this repository or by an automated test in this session.
* **READ EARLIER:** official Amazon wording that an earlier session read (2026-10-29) and recorded in `docs/COVER-SOLUTIONS.md`. It could **not** be re-read now.
* **UNVERIFIED:** could not be confirmed from this environment. The session cannot reach `amazon.com`, `affiliate-program.amazon.com`, `webservices.amazon.com`, `netlify.com` or `*.netlify.app`; a web search returned only fragments and third-party summaries. **No Amazon clause number in this report is quoted from a current official page.**

## 1. What changed on this branch
| # | Change | Where | Evidence |
|---|---|---|---|
| 1 | All Amazon-hosted cover images removed. The code no longer builds any `m.media-amazon.com` address from an ASIN or ISBN-10; the search index no longer carries those identifiers; CSP `img-src` is the site itself only. | `scripts/build.mjs`, `scripts/assets/app.js`, `scripts/assets/ask.js`, `scripts/assets/style.css`, `scripts/make-wix-package.mjs` | VERIFIED: `test/verify-compliance.mjs` (no Amazon image address in any of ~11,000 built files; no `<img>` points off-site; no search-index identifiers) |
| 2 | Security gate now fails any package that references an Amazon image host, whatever is approved. | `scripts/security-gate.mjs` | VERIFIED: `test/verify-security-gate.mjs` |
| 3 | Automated checking of Amazon links disabled. `scripts/check-links.mjs` never requests an Amazon address (amazon.*, amzn.*, a.co, image hosts); it filters them before the loop and again before each request. Other retailers can still be checked. | `scripts/check-links.mjs` | VERIFIED: `test/verify-compliance.mjs` runs it against a list containing an Amazon link and shows the link is never processed |
| 4 | Stored covers published only where the rights cover our use: owner-supplied artwork (owner-confirmed) yes; the 67 Penguin Random House files no, because they rest on general publisher "bookseller" terms, not a permission given to this site. They stay in the repository, unpublished. Those books show title-and-author cards. | `scripts/build.mjs` (`publishableCover`) | VERIFIED: build log "67 stored covers withheld, 37 published"; test confirms the published set |
| 5 | Privacy page no longer says covers load from Amazon's image servers. | `scripts/build.mjs` | VERIFIED by test |
| 6 | `config/approvals.json` records Amazon-hosted covers as withdrawn (nothing reads it as a switch). | `config/approvals.json` | VERIFIED |

Preserved and tested: 16,711 works / 31,061 editions / 10,967 authors, all original edition identifiers, search and filters, voice search, Digital Librarian (Ask box, floating guide, face beside every search bar), IOSutra promotion with the NVIDIA badge, every tagged Amazon link, the Associates statement.

## 2. Official policy sources (open and read these; I could not)
* Associates Program Policies (includes the IP License and Usage Requirements): https://affiliate-program.amazon.com/help/operating/policies
* Creators API license agreement: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/license-agreement
* PA API license text (older, still published): https://webservices.amazon.com/paapi5/documentation/read-la.html
* Amazon EU Associates Programme IP Licence (shows the licence structure; not the US text): https://affiliate-program.amazon.co.uk/help/operating/license
* Associates Program Operating Agreement: reachable from the Policies page above; the US URL was not confirmed in this session.
* **Amazon Influencer Program terms and storefront policies: no official link could be located in this session. Please supply the current link.**

What those pages were said to require (READ EARLIER / third-party excerpts, not re-verified): Program Content (which includes images) may be displayed only if obtained through the Creators API / PA API or an approved data feed; image content must not be stored or cached, though a link to it may be kept for up to 24 hours; Special Links must carry the tracking ID; no display of prices or availability without the API. A third-party clause tracker ([ConductAtlas](https://conductatlas.com/platform/amazon-associates/amazon-associates-program-policies/product-advertising-image-caching-limited-to-24-hours/)) quotes the 24-hour image-link wording; treat it as secondary.

## 3. Findings by area

### 3.1 Cover images
* **Before:** 16,429 constructed Amazon image identifiers (101 ASINs, 16,328 ISBN-10s) were hotlinked on about 105,000 image references. They were built by our code from identifiers, never returned by the Creators API or a feed, never fetched or checked, and embedded permanently in static pages and the search index. **Removed.**
* **Now published (37 files, 31 works):** Forbidden Mantra Press's own cover artwork. Evidence: each entry in `data/covers.json` records the source file and the owner's written confirmation (2026-10-28 and 2026-10-29) that all original Forbidden Mantra Press artwork is his and authorized for commercial use. **The 123 press titles: 31 now have a cover; 92 show title cards until the owner supplies their cover files** (KDP "Download author cover file", or the original design files; the bulk importer `scripts/covers-bulk.mjs` is ready).
* **Withheld (67 files, 63 works):** Penguin Random House covers. Evidence on file: the entries cite PRH's published bookseller terms as read by an assistant on 2026-10-28 ("cover images on PRH sites may be copied and used to promote PRH titles to customers; copyright information must accompany; not resold; not altered"), recorded as "Assistant review ... at the owner's instruction". That is an interpretation, not a permission given to this site, and it was not shown that this site is a PRH bookseller or that copyright information accompanied the images. Withheld until a written PRH permission is recorded (`docs/COVER-PERMISSION-REQUESTS.md` has the draft request; nothing has been sent).
* **Not used:** Open Library covers, Google Books covers (no licence for the artwork).

### 3.2 Automated access to Amazon
* `check-links.mjs` formerly sent automated requests to Amazon product and search pages (the existing results: 19 live, 195 blocked, 107 inconclusive). **Disabled for Amazon.** Stored results in `data/link-check.json` are old data only; no new request is made.
* Other scripts: the Open Library harvest talks only to Open Library; `amazon-cover-plan.mjs`, `asin-hints.mjs` and `audit-affiliate.mjs` make no network calls. VERIFIED by `test/verify-compliance.mjs` (static check) and earlier reading.

### 3.3 Special Links and tracking IDs
* **VERIFIED (sample of 3,017 pages, 6,084 Amazon links):** 6,076 go to `www.amazon.com`, every one with `tag=darktheoryinc-20` (the only tracking ID in the package). Two link shapes: `/dp/<ASIN>?tag=` (product links) and `/s?k=<ISBN>&i=stripbooks&tag=` ("Search on Amazon"). All carry `rel="sponsored"`, open in a new tab, and show no price, availability or rating.
* **Untagged Amazon links (VERIFIED):** 2 `us.amazon.com` links (source citations), 3 `amazon.es`, 2 `amazon.co.uk`, 1 `amazon.ca`, 1 `amazon.in`: untagged by design (no tracking ID for those stores). They earn nothing and are not a policy problem by themselves, but the owner should decide whether to keep them.
* **UNVERIFIED / OPEN:**
  1. Whether Amazon's rules accept manually constructed `/dp/ASIN?tag=` and `/s?k=...&tag=` links as Special Links. These are common formats, but I could not confirm against the current policy.
  2. **`https://amzn.to/4tX3ogd` appears on the Press page (`config/site.json` `legacyStoreLink`).** It is a short link. I cannot tell which tracking ID, storefront or account it belongs to, and the tag check cannot see inside a short link. The owner should confirm it is created under `darktheoryinc-20` (or remove it).
  3. Whether `darktheoryinc-20` is the Associates tracking ID tied to the same account as the Influencer storefront. The repository records it as owner-confirmed (2026-10-27) and says it is the tracking ID, not the storefront name.
  4. Whether "Search on Amazon" links qualify for commission (the Affiliate Disclosure page says "we are checking with Amazon which links qualify"; the owner chose to leave that sentence).

### 3.4 Registered websites / domains (UNVERIFIED, owner action)
Associates links may be used only on sites listed in the account. In Associates Central (Account Settings, Websites and Mobile Apps) confirm these are listed and approved:
* `forbiddenmantra.com`
* `library.forbiddenmantra.com`
* `unrivaled-liger-1baec4.netlify.app`: the current published Netlify address carries tagged links. **If it is not listed, treat it as a live risk: unpublish or password-protect it until the production address is live.** (You asked for it to stay private; the repository cannot control that, only Netlify can.)

### 3.5 Disclosures (VERIFIED)
* "As an Amazon Associate I earn from qualifying purchases." appears on every page footer and next to buy buttons; the Affiliate Disclosure page explains the program, "Search on Amazon" links, own-books royalties and independence; Terms and Privacy describe the site as a browsing and affiliate referral service, not a seller. Wording is Amazon's required statement; whether placement meets Amazon's current rules is UNVERIFIED.
* IOSutra card is labelled "from our team" and a separate product; NVIDIA statement says membership applies to IOSutra only and does not imply NVIDIA endorsement.

### 3.6 Promotional practices
* On the site: no prices, availability or ratings shown (tested), no Amazon logos used, links labelled "Amazon" / "Search on Amazon", no email or offline promotion by the site.
* **OPEN: paid advertising.** The owner said ads are running. Not in the repository. Please confirm where the ads send people (our site, not Amazon links), that no ad copy or keyword uses "Amazon" or Amazon trademarks, and that ads comply with the platform's rules and Amazon's advertising restrictions. I could not read those restrictions.

### 3.7 Amazon Influencer account
No Influencer-specific policy could be read. The site makes no use of the Influencer storefront (no `amazon.com/shop/...` links; the only short link is item 3.3.2). Open question: whether Influencer terms add rules about off-Amazon use of storefront content. Owner to supply the policy link.

### 3.8 Privacy (VERIFIED against the pages; Netlify unverified)
Privacy Policy covers: operator and contact, local storage choices, Digital Librarian, optional voice search (browser speech service may process audio), no analytics, Netlify hosting and server logs, self-hosted fonts, children (not directed at under-13s), email contact, retailer links (Amazon may set cookies). The Amazon-image-server paragraph was removed because no image is loaded from Amazon. UNVERIFIED: that no Netlify add-on (Analytics, Forms, snippet injection) records more than the page says.

### 3.9 Copyright
* Site text: book descriptions are "our own, or absent" (stated on the catalogue standards page); metadata (titles, authors, ISBNs) comes from Open Library and owner records.
* Covers: see 3.1. Fonts: SIL OFL, self-hosted with a licence notice. Code: ours.
* **OPEN: IOSutra hero picture (a realistic person and a robot) and the Digital Librarian character.** Published at the owner's instruction (2026-11-03). The repository records the owner's instruction, not a licence or likeness release, and the origin of both images is not documented. Please keep the licence or generation record on file.

### 3.10 Trademarks
* "Amazon" is used in text only (nominative use), no Amazon logos. Book titles, authors and publishers are named, not used as marks of ours.
* NVIDIA: the owner states IOSutra's Inception membership is verified (recorded as the owner's statement; not independently checked). The official badge is shown unmodified. The trademark line's wording is **not** confirmed against NVIDIA's Inception brand rules (UNVERIFIED).
* IOSutra and Forbidden Mantra Press are the owner's marks. Trademark registrations were not checked.

### 3.11 Advertising / endorsement disclosures
Affiliate disclosure is near the links and in the footer; IOSutra's relationship to the owner is stated; no testimonials or endorsements are shown. FTC endorsement-guide compliance is not certified here.

## 4. Risk register
| Risk | Severity | Status after this branch |
|---|---|---|
| Hotlinked constructed Amazon image URLs (outside the Creators API/feed channel; links stored permanently) | High | **Removed.** |
| Automated requests to Amazon pages by the link checker | Medium | **Disabled for Amazon.** |
| Third-party covers on the strength of an assistant's reading of general publisher terms | Medium | **Withheld (67).** |
| `amzn.to/4tX3ogd` short link of unknown account/tag | Medium | **Open: owner to confirm or remove.** |
| Tagged links on `unrivaled-liger-1baec4.netlify.app` or other domains not listed in the Associates account | Medium (unknown) | **Open: owner to check the account's site list.** |
| Paid advertising practices (keywords, landing pages) | Medium (unknown) | **Open.** |
| Search-link and manual link formats accepted as Special Links; commission eligibility of search links | Low to medium | **Open.** |
| Artwork provenance/likeness (IOSutra picture, Librarian character) | Low to medium | **Open: owner holds the records.** |
| Netlify features beyond the static files | Low | **Open: owner to check the dashboard.** |
| Terms/Privacy are drafts, not counsel-reviewed | Medium | **Open.** |

## 5. Questions only the owner can answer
1. Is `https://amzn.to/4tX3ogd` created under `darktheoryinc-20`? Keep or remove?
2. Which sites are listed in Associates Central? Is the netlify.app address listed?
3. What are the ads (platform, keywords, landing pages)?
4. Link to the current Amazon Influencer terms you operate under; is the storefront separate from this site?
5. Do you hold licences or generation records for the IOSutra picture and the Librarian character?
6. Will you send the 92 missing press cover files, and do you want to request written permission from Penguin Random House for specific titles?
7. Do you qualify for the Creators API (10 qualifying sales in 30 days; Tools > Creators API)? That is the compliant route to third-party covers.

## 6. Test evidence (branch `claude/compliance-remediation`)
| Check | Result |
|---|---|
| Core site (`scripts/verify.mjs`) | 143 of 143 pass |
| Compliance (`test/verify-compliance.mjs`): no Amazon image address in any built file, no off-site `<img>`, no Amazon request in a real browser on 7 page types (desktop and phone), check-links never requests Amazon, cover rights, catalogue and affiliate preserved | 31 of 31 pass |
| Affiliate (33), security gate (37), promo (73), launch (51), covers (31), cover links (24), cover bulk (15), Ask (49), Librarian (49), scale (41), discovery (84), curation (26), niches (49), voice (76), Wix embed (45), production (45), accessibility | all pass |
| Package checks over HTTP in a real browser: preview ZIP 57, production ZIP 59 | all pass |
| Production ZIP scan: 10,977 files, 0 name an Amazon image host; `index.html` at the root; 37 cover files (owner artwork only); `robots.txt` allows crawling and names the sitemap | pass |
| Affiliate audit | 0 link errors, 31,058 purchase links, tag `darktheoryinc-20` only |
| Launch check | 0 blockers, 0 open decisions, 8 non-blocking warnings |

Test changes made to match the new policy (each documented in its commit): the removed Amazon-cover test was replaced by `verify-compliance`; the affiliate test now expects zero Amazon image addresses; the Ask and Librarian tests no longer allow any Amazon request; the cover-link test counts only published covers and uses "kebra nagast" (an owner-artwork title) instead of "meditations" (a Penguin Random House title whose cover is now withheld); the security-gate test expects Amazon covers withdrawn.

## 7. Cover coverage after remediation
* Works in the catalogue: 16,711.
* Works with a real cover: **31 (0.2%)**, all Forbidden Mantra Press titles (owner artwork, rights confirmed in writing). Press titles still showing a title-and-author card: **92 of 123**.
* Third-party works with a real cover: **0**. Every other work shows a title-and-author card (typographic, in the site's design).
* Previously: about 16,300 Amazon-hosted covers (removed) and 63 Penguin Random House covers (withheld).
