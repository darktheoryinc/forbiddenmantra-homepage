# Cover-image options compared (research only, 2026-10-29)

No credentials requested, nothing fetched into the site, catalogue/ZIP/deployment untouched.

## Catalogue facts (from `data/catalogue.json`)
632 editions: 421 have an ASIN, 214 an ISBN-13 (207 start 978, so convertible to an ISBN-10, which is the ASIN for print books; 7 start 979 and have ASINs), 4 have neither. 308 of 311 works have at least one usable identifier. Own-press editions: 413, of which 409 have an ASIN.

## 1. Amazon Creators API (official; replaces PA-API)
Read from Amazon's own pages (Associates Central, today):
* PA-API 5 is deprecated and returns HTTP 403; the Creators API is its successor (same operations: GetItems by ASIN, SearchItems; Images resource returns Small/Medium/Large URLs with width and height).
* **Eligibility (official "Prerequisites"):** be enrolled in Associates for the marketplace, **have at least 10 qualifying sales in the past 30 days**, register in Associates Central, generate credentials. Registration is available only to associates with referred qualified sales, and **only the primary account owner** can sign up. Up to two applications per store.
* **Cost:** no fee is stated; the licence is "royalty-free". Rate limits: the page is access-denied to me, so unknown.
* **Image restriction (Operating Agreement IP licence, clause h):** "You will not store or cache Product Advertising Content consisting of an image, but you may store a link ... for up to 24 hours." So covers cannot be downloaded into the site; they are loaded from Amazon's image URLs, which must be refreshed at least daily. Links must be Amazon's vended links (our tagged links already are); the site's principal purpose must be selling on Amazon (it is); no aggregating or ML training use.
* **Implementation:** needs a small server-side function (credentials cannot sit in a browser). Either (a) a serverless function that returns image URLs by ASIN on demand with a short cache, or (b) a scheduled rebuild at least daily that embeds links (a failed rebuild leaves links older than 24 h, a licence risk). The page CSP and the security gate must be changed to allow Amazon's image host. The response also returns the title/author, so every cover can be verified against our edition automatically.
* **Scale:** covers every edition with an ASIN or convertible ISBN (about 99% of works), incl. ebooks and audiobooks, 10 items per call.
* Not approved by me or requested; credentials, if ever used, belong only in the host's secret settings, never in chat or the repository.
* The old SiteStripe "Image" link option was withdrawn in late 2023 (secondary sources), so no no-API route.

## 2. Open Library covers (free, no account)
* Official guidance: display covers by pointing an image `src` at `covers.openlibrary.org` (by ISBN); do not crawl or bulk-download through the API; a courtesy link back is appreciated.
* **No licence for the artwork:** the Internet Archive "does not assert any new copyright... There may be existing rights issues." The covers are still publishers' artwork, so this is risk acceptance, not permission.
* Test (45 HEAD requests, no images stored): of the 29 third-party homepage titles, **28 have a cover for at least one catalogued ISBN** (existence only; accuracy not visually checked, matches are by ISBN). Nothing for ASIN-only titles (the owner's KDP books).
* Effort: very small (hotlink with fallback to the placeholder; CSP change). Conflicts with the repository rule that covers come from owner, publisher permission, licensed feed or public domain, so it needs the owner's explicit decision.

## 3. Publisher and bookseller feeds
* **PRH:** already used for PRH imprints under its published bookseller terms ("promoting Penguin Random House titles"); its image server also returns other publishers' files, which those terms do not cover.
* **Other publishers (HarperCollins, Hachette, Shambhala, Llewellyn...):** per-publisher permission or retailer portals; slow, does not scale. Drafted in `docs/COVER-PERMISSION-REQUESTS.md`, not sent.
* **Baker & Taylor Content Cafe:** closed 15 Dec 2025. **Syndetics Unbound:** library product, quote-only pricing. **Google Books API:** I could not reach its terms from here; secondary sources say attribution is required and that Google calls covers third-party material, so not recommended. **Bookshop.org:** no documented cover API or image licence found.

## 4. Recovering our own covers (the biggest, safest win)
Own-press editions are 413 of 632. Sources, best first:
1. **Original design files** (the tool the covers were made in, plus any ChatGPT/Canva/other export): full resolution, no restrictions.
2. **KDP Bookshelf, "..." menu, "Download author cover file"** (official KDP help; documented for print books; for ebooks not confirmed). Covers made with Cover Creator cannot be downloaded. Print files are full wraps, so the front panel is cut out.
3. The same ASINs through the Creators API as a stopgap display (Amazon-hosted, see limits above).
The bulk importer (`scripts/covers-bulk.mjs`) is ready: files named by ASIN are validated, deduplicated and published with the owner-supplied rights record.

## Comparison
| | Cost | Effort | Rights | Scales beyond 34 | Verifies edition |
|---|---|---|---|---|---|
| Own files (KDP/design files) | Free | Owner time; importer ready | Clear (owner) | Own titles only (~100 missing) | Yes (you name the ASIN) |
| Creators API | Free (no fee stated) | Medium: serverless function, CSP, daily refresh | Licensed, with no-storage rule | Yes, ~99% of works | Yes (API returns title/author) |
| Open Library | Free | Small | Not licensed (risk) | Yes, by ISBN | By ISBN only |
| Publisher permission | Free | High per publisher | Clear | Poor | Yes |
| Syndetics/others | Quote | Medium | Licensed | Yes | Yes |

## Recommendation
Two tracks. (1) Recover the own-press covers from your design files and KDP (free, permanent, best quality, importer ready). (2) For third-party books use the Creators API if the account qualifies; otherwise keep the text placeholders and request permission only for the highest-traffic titles. Open Library is the fastest but unlicensed route, only if you consciously accept that risk.

## What I need from you (no passwords or keys)
1. In Associates Central: do you have at least 10 qualifying sales in the last 30 days, and does **Tools > Creators API** appear? (a yes/no or a screenshot of the menu; only the primary account owner will see it).
2. Own covers: where were the originals made (Canva, ChatGPT, other)? Send any folder or export; also try **Bookshelf > "..." > Download author cover file** on one paperback and one ebook and tell me which menu items appear.
3. Decision: accept or reject Open Library (unlicensed) as a stopgap.
4. Decision: allow a small serverless function on the existing free Netlify account for the API route (you would store credentials in Netlify's settings yourself).

## Follow-up (2026-10-29): can we hotlink Amazon image URLs without the Creators API?
**Conclusion: no, not under Amazon's published terms.** Nothing was implemented or deployed.
Source: Associates Program Policies, "Associates Program IP License and Usage Requirements" (https://affiliate-program.amazon.com/help/operating/policies), read today.
* The licence grants the right to "copy and display Program Content solely on your Site", and defines Program Content to include "Creators API, PA API, Data Feeds and Product Advertising Content". Product Advertising Content (data, images, text) is obtained by calling the Creators API/PA API, or by an approved data feed ("If we provide express prior written approval, you may also obtain Product Advertising Content through a data feed").
* Images scraped from product pages or built from guessed URLs are not obtained through any of those channels, so nothing in the licence covers displaying them. The image-restriction clause also applies even with the API: no storing or caching, only a link kept up to 24 hours.
* The one image-bearing link format Associates once offered (SiteStripe "Image" / "Text+Image") was withdrawn in late 2023 (secondary sources); the official SiteStripe help page could not be re-read from here. Amazon image hosts are also unreachable from this session, so the legacy ASIN image URLs could not be tested, and they are unofficial anyway.
* Amazon image URLs are not derivable from an ASIN or ISBN (the image id is not the ASIN), so a URL-only approach cannot be built without scraping product pages.

**What can be done without that:** (a) the cover can link to the book's tagged Amazon page whatever image it shows (the book-page and card links already carry `tag=darktheoryinc-20`; making the cover itself the Amazon link is a small change); (b) the licensed image routes remain the Creators API (needs 10 qualifying sales in 30 days) and, for your own titles, your own files.
