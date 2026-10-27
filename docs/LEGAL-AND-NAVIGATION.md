# Legal pages, original-site navigation, network links (status 2026-10-27)

## What could and could not be recovered
The original site (https://www.forbiddenmantra.com, Wix **Studio**, Velo enabled) is **not reachable from this sandbox** (DNS/egress blocked for curl, WebFetch and the proxy). The Wix connector exposes dynamic content (blog, forms, stores) but **not static page content, menus or policy text**. The only material recovered came from web-search excerpts.

| Item | Result |
|---|---|
| Terms of Service / Refund Policy | Page exists at `/blank-11`. Only a **summary of its clauses** was recovered (lawful use; most products fulfilled by Amazon or Printify, governed by those platforms; no payment info processed/stored; Amazon returns policy for books; Printify items made to order and generally non-refundable unless defective/damaged; owner IP, no reuse without written consent; liability disclaimer for third-party/shipping issues; terms may change with a new effective date). **Verbatim text, effective date and any governing-law clause were not recovered.** |
| Privacy Policy | Linked beneath Terms/Policies on the original site; **text not recovered**. |
| Terms & Policies | A menu group containing the two pages above, not a page of its own. |
| Other known URLs | `/blank-6` Health & Wellness, `/blank-2` "Forbidden Mantra Press Facebook Page", blog posts under `/post/…`. |
| Menu structure | Search excerpts suggest: Yoga Props & Accessories under Health & Wellness; Incense under Collection Best Sellers; Terms/Policies containing Terms of Service/Refund Policy and Privacy Policy. The owner-supplied labels (Home, Blog, About, Health & Wellness, Collection Best Sellers, Spiritual Expressionz, Forbidden Christianity, Yoga Props & Accessories, Contact, Incense, Meditation, Terms & Policies, ToS/Refund, Privacy) have **no verified destination URLs**, so none are linked individually. |

**Needed from the owner:** a Wix export or screenshots/PDF of the nav (with dropdowns), the full text of the two policy pages, the effective dates, and the destination URLs for each menu item. With those, a "Original store" menu can be added to the nav without inventing anything.

## What was built (all additive)
* `legal/` Terms & Policies hub; `legal/terms-refunds/` Terms of Service / Refund Policy (adapted from the recovered clauses, **not verbatim**); `about/privacy/` Privacy Policy (rewritten to the bookstore's real behaviour); `about/affiliate-disclosure/`; `contact/`; `network/`.
* Footer columns: Terms & policies (all five links) and Our network (IOSutra, Spiritual Expressionz, Dogs R Fun, owner-supplied URLs, not reachable from here so unchecked). Visible on mobile (single column).
* Disclosure: "As an Amazon Associate I earn from qualifying purchases." in the homepage hero, directly under every book page's buy buttons (static and dynamic views), on niche pages, in the footer, and on the disclosure page.
* A **production blocker** (`config/site.json` `legal.reviewedByOwner`) keeps the drafts from shipping until the owner/legal reviewer signs off and sets `legal.effectiveDate`. Preview builds show a "Draft for owner and legal review" notice on those pages.

## Items needing owner or legal review
1. Terms/Refund wording is a paraphrase of search excerpts; replace with the original text where it is still accurate.
2. Refund clause: the bookstore sells nothing itself; Printify/apparel language is kept only because the original store sold such items. Confirm it still applies to the original store and whether to keep it here.
3. The Amazon returns URL (`amazon.com/returns`) came from a search summary; confirm.
4. No governing-law, dispute, age or children's-data clauses exist (none were recovered; none invented).
5. Privacy: confirm Google Fonts is acceptable (it sends visitor IPs to Google; self-hosting fonts would remove this) and decide on analytics provider before enabling.
6. Affiliate Disclosure: official Associates wording/placement rules could not be read directly (Associates Central needs a login). Secondary sources agree the exact sentence must be clear and conspicuous; placement is "before/near links" best practice. Confirm in Associates Central > Operating Agreement.
7. Whether Amazon **search** links earn commission is still unconfirmed (`affiliate.searchLinks` switch).
8. The Wix site has Members Area, Forms and Hotels apps; those collect personal data and are outside this bookstore's privacy page.
