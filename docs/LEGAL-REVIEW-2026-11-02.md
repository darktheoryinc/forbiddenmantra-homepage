# Legal review for forbiddenmantra.com launch (2026-11-02)

Status: **nothing here is approved or live.** The site still ships the drafts below; `legal.reviewedByOwner` stays `false` until Rav confirms. This is a plain-language editorial review, not legal advice; the starred items (*) are ones counsel should confirm.

Note: the site has **one** page for "Terms of Service / Refund Policy" (`legal/terms-refunds/`), so there are three pages, not four.

---------------------------------------------------------------------
## PART 1. CURRENT TEXT, exactly as built (preview-only draft banner removed)

### 1A. Terms of Service / Refund Policy (`legal/terms-refunds/`)
# Terms of Service / Refund Policy
Welcome to the Forbidden Mantra Press bookstore. By using this site you agree to these terms.

## Using this website
You agree to use the site only for lawful purposes and in accordance with these terms. Misuse of the site may result in loss of access.

## What this site is
This site is a curated catalogue of books, with our own publications and books from other publishers. It has no shopping cart, checkout or customer accounts. Buttons on book pages lead to other companies’ websites, mainly Amazon, where any purchase takes place.

## Orders, payment and fulfilment
Books are bought, paid for and fulfilled by the retailer you choose, not by Forbidden Mantra Press, and the retailer’s own terms govern that transaction. This site does not process or store payment information for those orders.

## Returns and refunds
Books ordered through Amazon are covered by Amazon’s returns and refund policy; contact the retailer’s customer service for any order problem, because only the retailer can change or refund an order. Made-to-order items sold on our original store (for example apparel fulfilled through Printify) are generally non-refundable unless they arrive defective or damaged in shipping; see the terms on forbiddenmantra.com for those items.

## Catalogue information
We check book details against published sources and say where a detail is unverified. We do not show prices, availability or ratings. Check the retailer’s page for the current edition, price and format before you buy.

## Affiliate links
Some links to Amazon are affiliate links. See the Affiliate Disclosure.

## Ownership and reuse
Content on this site that we wrote is owned by Forbidden Mantra Press, and no part may be reused or reproduced without our express written consent. Book titles, author names, cover images and trademarks belong to their owners; their appearance here does not imply endorsement.

## Third-party sites
Links to other sites, including retailers and our sister sites, are provided for convenience. We are not responsible for their content or practices.

## Limitation of liability
Forbidden Mantra Press is not responsible for delays, damages or losses resulting from third-party vendors, shipping errors or platform issues beyond our control.

## Changes
We may update these terms. Updates are posted on this page with a new effective date.

Effective date: to be set when the owner approves this page.

### 1B. Privacy Policy (`about/privacy/`)
# Privacy Policy
This page describes how this bookstore works today. The bookstore has no accounts, checkout, forms or comments, does not ask for personal information, and sets no cookies of its own.

Your choices stay in your browser. If you pick a website language, the site remembers it in your browser’s local storage on your own device. It is never sent to us. The same goes for whether you have minimized or hidden the digital librarian.

Digital librarian: the animated guide searches the book index that your browser downloads from this site. What you type into it or into the search boxes is not sent anywhere, and it uses no cookies, microphone or outside service.

Analytics: none is running at the moment. If this changes, this page will say which service is used and what it records. The site does not run analytics when your browser sends Do Not Track.

Fonts: the site loads its typefaces from Google Fonts, so your browser contacts Google when a page loads and Google receives your IP address and browser details under its own privacy policy.

Book covers: many book covers are loaded directly from Amazon's image servers (m.media-amazon.com), so your browser contacts Amazon when those pictures appear and Amazon receives your IP address and browser details under its own privacy policy. We send no referrer and store none of these images.

Retailer and partner links: buttons for Amazon and other retailers, the Forbidden Mantra blog, our sister sites and IOSutra lead away from this site. Those sites have their own privacy practices. When you follow an Amazon affiliate link, Amazon can tell that the visit came from us and may set its own cookies; see the Affiliate Disclosure. Links to IOSutra carry campaign tags (the name of this site and the page) in the address.

Library links go to WorldCat’s public search and carry only a book’s ISBN.

Our main website. forbiddenmantra.com is a separate site with its own features and its own privacy practices.

Questions about this page: see Contact.

### 1C. Affiliate Disclosure (`about/affiliate-disclosure/`)
# Affiliate Disclosure
As an Amazon Associate I earn from qualifying purchases.

Forbidden Mantra Press participates in the Amazon Services LLC Associates Program, an affiliate advertising program that lets sites earn fees by linking to Amazon.com. Buttons marked “Amazon” or “Search on Amazon” lead to Amazon.com and include our Associates tracking ID. If you buy through them we may earn a commission at no extra cost to you.

Which links. Amazon.com links on book pages and guides. “Amazon” buttons go to a specific product page; “Search on Amazon” buttons open an Amazon search for the book’s ISBN, and we are checking with Amazon which links qualify. Tracking IDs are specific to each marketplace, so links to other Amazon stores are untagged unless we hold that store’s own tracking ID.

Our own books and others. Some titles are published by Forbidden Mantra Press, and we also earn publisher royalties on those. Books from other publishers are marked as such.

Independence. Books are chosen for the catalogue by subject and quality of sources, not by commission. We do not show prices, availability or ratings.

Library and other links. Library lookups, article links and links to our other sites are not affiliate links.

The statement above appears on every page. See also the Terms of Service / Refund Policy and Privacy Policy.

---------------------------------------------------------------------
## PART 2. PROBLEMS FOUND

**Inaccurate or risky**
1. **Terms, "Returns and refunds" mentions Printify apparel "on our original store".** This bookstore sells nothing. The sentence refers readers to "forbiddenmantra.com" for those terms, but the bookstore itself is going live **at** forbiddenmantra.com, so the reference is circular and confusing. Delete (or move to the main store's own terms).
2. **Privacy, "Our main website. forbiddenmantra.com is a separate site".** Wrong if the bookstore is deployed at forbiddenmantra.com. See Decision 1.
3. **Terms, "We check book details against published sources and say where a detail is unverified."** Overstated for the 8,395-book catalogue: about 8,000 of the 8,395 works are single-source records from Open Library, labelled as such only on the book page. Say that details come from public catalogue records and may be wrong.
4. **Affiliate, "we are checking with Amazon which links qualify".** Reads as unfinished and tells readers the programme status is uncertain. Remove; state what is true (links carry our tag; we may earn on qualifying purchases).
5. **Affiliate, "Books are chosen ... by subject and quality of sources".** Most of the catalogue is imported by subject, not hand-selected. Replace with "chosen by subject".
6. **Affiliate, "we also earn publisher royalties" on our own titles.** Only the owner can confirm this. (The records list the Press titles as owner-supplied; publisher attribution is unconfirmed.)
7. **Affiliate, "Amazon buttons go to a specific product page".** Still true, but most are search links; the sentence is fine once the "checking" clause goes.

**Missing**
8. **Health and wellness disclaimer** (yoga, Ayurveda, herbalism, energy healing, meditation titles): books are listed for information, not medical or professional advice. Strongly recommended for this subject matter.*
9. **"As is" disclaimer and governing law/venue.** None exists. Not invented; the owner/counsel must supply jurisdiction.*
10. **Privacy: hosting logs.** The host (Netlify) receives visitors' IP addresses and request details in ordinary server logs. Not mentioned.
11. **Privacy: children, contact for privacy questions, and a "we do not sell personal information" line.**
12. **Amazon trademark / image notice**: "Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates", and that cover images belong to their owners (they now also load from Amazon's servers).
13. **A way to report copyright/trademark concerns** (Contact page exists; the Terms do not point to it for that).

**Unnecessary**
14. Printify/"made-to-order" sentence (item 1). Nothing else is superfluous; the pages are short.

**Correct and should stay:** "As an Amazon Associate I earn from qualifying purchases." (the required sentence, on every page and the disclosure page); "no cart, checkout, accounts"; "no payment information"; "no prices, availability or ratings"; the cookie/local-storage/digital-librarian/analytics/Google Fonts/Amazon covers/WorldCat statements on the privacy page (all match the code).

---------------------------------------------------------------------
## PART 3. RECOMMENDED WORDING (concise; nothing below is live or approved)

### 3A. Terms of Service and Refund Policy
**About this site.** Forbidden Mantra Press is an online catalogue of books, including our own titles and books from other publishers. This site has no shopping cart, checkout or customer accounts. Buttons on book pages lead to other companies' websites, mainly Amazon.com, where any purchase takes place. By using this site you agree to these terms.

**Purchases, returns and refunds.** Books are sold, charged for and shipped by the retailer you choose, not by Forbidden Mantra Press. The retailer's own terms and policies govern your order, including returns and refunds (for Amazon, see Amazon's returns and refund policy). Only the retailer can change, cancel or refund an order, so contact its customer service. We never receive your payment information, and we do not sell physical goods through this site.

**Catalogue information.** Titles, authors, editions, ISBNs, formats and dates come from public catalogue records and may be incomplete or wrong. We do not show prices, availability or ratings; check the retailer's page for the current edition, price and format before you buy.

**Affiliate links.** Some links to Amazon.com are affiliate links, so we may earn a commission on qualifying purchases at no extra cost to you. See the Affiliate Disclosure.

**Not professional advice.** Books on yoga, meditation, Ayurveda, herbalism, energy healing and related subjects are listed for information. Their inclusion is not an endorsement, and nothing on this site is medical, psychological, legal or other professional advice. Consult a qualified professional about your own situation.

**Ownership and reuse.** Content we wrote is owned by Forbidden Mantra Press and may not be reused without our written consent. Book titles, author names, cover images and trademarks belong to their owners; their appearance here does not imply endorsement. Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates. To report a copyright or trademark concern, use the Contact page.

**Using this site.** Use it only for lawful purposes. We may restrict access to anyone who misuses it.

**Third-party sites.** We link to retailers, our sister sites and other websites for convenience and are not responsible for their content, products, shipping or practices.

**Disclaimer and liability.** The site is provided "as is". To the extent the law allows, Forbidden Mantra Press is not liable for losses or delays arising from third-party retailers, shipping or platform issues, or from reliance on catalogue information.

**Governing law.** [Owner/counsel to supply the governing law and venue. Not invented.]*

**Changes.** We may update these terms; changes are posted here with a new effective date. Effective date: [to be set on approval].

### 3B. Privacy Policy (keep the current text; make these edits)
* Replace "Our main website..." with a sentence that matches Decision 1. If the bookstore replaces the main site: *"This site is operated by Forbidden Mantra Press. Other sites we run (see Our network) have their own privacy practices."*
* Add: **Hosting.** *"Our host, Netlify, receives your IP address and request details when you load a page, in ordinary server logs. We do not use these logs to identify visitors."*  [confirm host]*
* Add: **Children.** *"This site is not directed at children under 13 and does not knowingly collect their information."*
* Add: *"We do not sell personal information. We collect none ourselves; the third parties named above (Google Fonts, Amazon, Netlify) have their own policies."*
* Add: *"Questions or requests about privacy: use the Contact page."*
* Keep unchanged: no accounts/forms, no cookies, local-storage language choice, digital librarian, analytics none (and Do Not Track), Google Fonts, Amazon covers, retailer and IOSutra link notes, WorldCat links.

### 3C. Affiliate Disclosure
**As an Amazon Associate I earn from qualifying purchases.**

Forbidden Mantra Press participates in the Amazon Services LLC Associates Program, an affiliate advertising program that lets sites earn fees by linking to Amazon.com. Buttons marked "Amazon" or "Search on Amazon" lead to Amazon.com and include our Associates tracking ID. If you buy through them, we may earn a commission at no extra cost to you.

**Which links.** "Amazon" buttons open a specific product page. "Search on Amazon" buttons open an Amazon search for the book's ISBN. Links to other Amazon stores are untagged. Library lookups, article links and links to our other sites are not affiliate links.

**Our own books.** Some titles are published by Forbidden Mantra Press; we benefit financially from sales of those too. [Owner to confirm royalty wording.]* Books from other publishers are marked as such.

**Independence.** Books are listed by subject, not by commission rate. We do not show prices, availability or ratings. Cover images may be displayed from Amazon or the publisher and belong to their owners. Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.

---------------------------------------------------------------------
## PART 4. DECISIONS ONLY RAV CAN MAKE

| # | Decision | Recommended |
|---|---|---|
| 1 | **Where does the bookstore go?** forbiddenmantra.com is currently the Wix site. Uploading this package to Netlify at that exact address replaces the Wix site, which also holds the store, forms, members and blog. Replace it, or use a sub-address such as books.forbiddenmantra.com? (Changing `siteUrl`/the recorded address is a one-line change; DNS is yours.) | Sub-address first, until the Wix content is moved |
| 2 | Delete the Printify/apparel refund sentence | Yes |
| 3 | Adopt the 3A Terms text (and add the health disclaimer) | Yes |
| 4 | Governing law and venue (not invented) | Counsel/owner supplies |
| 5 | Adopt the 3B privacy edits; confirm Netlify as the host | Yes |
| 6 | Keep Google Fonts as is, or self-host them (removes the IP transfer to Google) | Keep for launch |
| 7 | Analytics: none for launch, or choose a provider | None |
| 8 | Adopt the 3C Affiliate text; confirm the "publisher royalties" wording for the Press titles | Yes |
| 9 | Confirm that Amazon "Search" links earn under your Associates account (affects nothing on the page now) | Check Associates Central |
| 10 | Effective date for the pages | Date you approve |
| 11 | Set `legal.reviewedByOwner: true` and `legalPagesReviewed` (also the IOSutra/NVIDIA approvals, separately) | Only after 1-10 |

Not touched: NVIDIA branding and claims, IOSutra promotion and artwork, the catalogue, affiliate links, the harvest, DNS, deployment.
