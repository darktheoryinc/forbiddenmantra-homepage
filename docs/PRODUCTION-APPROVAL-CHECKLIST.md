# Production approval checklist and launch sequence (prepared 2026-11-03)

Target address: **https://library.forbiddenmantra.com** (owner's stated preference, 2026-11-03). Netlify project to reuse: **unrivaled-liger-1baec4**.
Nothing in this document is an approval. `config/approvals.json` and `data/promos.json` are unchanged and every item below is still **not approved** until the owner replies with the exact confirmation for that item. Claude records an item only after that reply.

Checked on 2026-11-03 (read-only): the Wix site "Forbidden Mantra Press" is published, on a Premium plan, with a custom domain, edited in Wix Studio, with Velo enabled (Wix site context). Not checkable from here: the Netlify project, and whether forbiddenmantra.com uses Wix name servers or "pointing" (see Part 2).

---

## Part 1. Owner approvals (reply with the quoted sentence for each item you accept)

Production build gates, from `docs/PRODUCTION-APPROVALS.md`. All five gates and the four security-gate approvals must be satisfied or the build refuses.

### 1. Production address (gate 5)
- What it records: `config/approvals.json` `productionAddress.url`, `config/site.json` `siteUrl`, and the canonical links, sitemap and `robots.txt` in the production package.
- Confirmation wording: **"I approve https://library.forbiddenmantra.com as the production address of the Forbidden Library."**

### 2. IOSutra promotion (gate 1 and `iosutraPromotion`)
- What it approves: the existing IOSutra advertisement exactly as it stands: headline "Wellness and AI Technology", subline "The future of health, wellbeing and abundance", the blurb "IOSutra is our AI-powered business software platform for wellness and abundance. It is a separate product from this bookstore.", linking to https://iosutra.com, shown on the homepage, in the footer and on `/technology/`. No wording or artwork change.
- Confirmation wording: **"I approve the IOSutra promotion exactly as it currently appears (homepage, footer and /technology/) for production."**

### 3. NVIDIA statements (gates 2 and 3)
These need facts only the owner can check. Claude will not write evidence on your behalf.
- **Membership claim (gate 2)**, current text: "IOSutra is a member of the NVIDIA Inception program." (status: owner-asserted, no evidence on file).
  - Before confirming: check in the NVIDIA Inception member portal that IOSutra's membership is current, and that the program terms permit this wording.
  - Confirmation wording: **"I checked the NVIDIA Inception member portal on [date]. IOSutra's membership is current, and the wording 'IOSutra is a member of the NVIDIA Inception program.' is permitted. Evidence: [what you saw, for example 'member dashboard shows Active']."**
- **Trademark attribution (gate 3)**, current text: "NVIDIA and NVIDIA Inception are trademarks of NVIDIA Corporation." (status: needs-confirmation).
  - Before confirming: find out from the Inception terms or NVIDIA's brand page (https://www.nvidia.com/en-us/about-nvidia/legal-info/logo-brand-usage/) whether this wording, or different wording, is required.
  - Confirmation wording: **"The NVIDIA trademark attribution wording is approved as it stands."** or **"Replace it with: [required wording]."**
- **Badge and non-endorsement** are already recorded (`approvals.json` nvidiaBranding, 2026-10-28, owner-approved). They stay exactly as they are. The statement "This membership applies to IOSutra only. It does not extend to Forbidden Mantra Press or this bookstore, and it does not imply that NVIDIA sponsors or endorses either." stays on the page.
- Banned phrasings that must never appear: "powered by NVIDIA", "NVIDIA partner", "NVIDIA-certified", "NVIDIA-backed", "in partnership with NVIDIA", "NVIDIA-approved", "endorsed by NVIDIA".

### 4. Artwork rights (`iosutraArtworkRights`, `librarianArtworkRights`)
- IOSutra picture (meditating man and robot, `iosutra-wellness-ai.webp`): commercial-use and likeness permissions.
  - Confirmation wording: **"I confirm that I own, or have licensed for commercial web use, the IOSutra meditating man and robot picture, including any likeness rights."**
- Digital Librarian character artwork:
  - Confirmation wording: **"I confirm that I own, or have licensed for commercial web use, the Digital Librarian character artwork."**
- If you cannot confirm either, say so. Claude will not remove or replace artwork without your instruction.

### 5. Legal pages (gate 4 and `legalPagesReviewed`)
Pages: Terms and Refunds, Privacy, Affiliate Disclosure, Contact and Network (hub at `/legal/`). The current text and the problems found are in `docs/LEGAL-REVIEW-2026-11-02.md`. The privacy page now also carries the voice-search sentence added on 2026-11-03: "Voice search (optional): the microphone button in the search box listens only after you press it. Your browser's built-in speech recognition turns what you say into text, and depending on your browser (for example Chrome, Edge or Safari) the audio may be processed by the browser provider's speech service, under that provider's own privacy terms. This site does not record, receive or store your audio or the words you speak; it only uses the resulting text to search this site's catalogue, and it never speaks back. Typed search works as before."
- Decisions still open in the legal review (answer each): keep or delete the Printify/apparel refund language; confirm the Amazon returns URL; whether counsel should add governing-law, dispute, age and children's-data clauses; confirm the Associates disclosure wording and placement; confirm tagged search links are intended.
- Confirmation wording: **"I have reviewed the Terms, Refund, Privacy and Affiliate Disclosure pages as they will be published (including the voice-search sentence). I approve them for production, effective [date], with these decisions: [your answers]."**
- If counsel has not reviewed them, you may still approve; the approval records that you did, not that counsel did.

### 6. Analytics (optional decision, not a gate)
Currently off. Options: none, or a cookie-free provider such as GoatCounter. Enabling analytics requires a privacy-page update first.

---

## Part 2. Verify before any deployment or DNS change

### Netlify project `unrivaled-liger-1baec4` (owner checks in the Netlify dashboard; Claude cannot reach it)
1. Site configuration > Build & deploy: confirm it is **not linked to a Git repository** (a linked project cannot take a manual ZIP deploy).
2. Deploys: note which deploy is currently **Published** and what it contains (the preview 12,022-work build or something else). The production deploy will replace it.
3. Site configuration > Domain management: confirm no other custom domain is attached and nothing else uses this project.
4. Confirm there are no redirects, environment variables or Netlify features (Forms, Functions, Identity) you rely on there. The ZIP supplies its own `_headers`.
5. Plan limits: the ZIP is about 103 MB with 10,636 pages; the earlier 9,855-file deploy worked.

### Wix DNS (read-only guidance from Wix's Help Center, 2026-10-05)
- **If forbiddenmantra.com is a Wix domain or connected to Wix by name servers:** in Wix, go to Domains > the three-dot "Domain Actions" menu next to forbiddenmantra.com > **Manage DNS Records** > under **CNAME (Aliases)** click **+ Add Record** > Host Name `library` > Value `unrivaled-liger-1baec4.netlify.app` > Save > Save Changes. Propagation can take up to 48 hours.
- **If it is connected by pointing (DNS hosted at the registrar):** Wix's records do not apply. Add the same CNAME at the registrar instead.
- Do not touch the existing records (the A records and `www` CNAME that serve the Wix homepage).
- How to tell which applies: Domains page > the domain's connection method, or Domain Actions > Manage DNS Records is available only when Wix hosts the DNS.
- Wix does not allow a business email on a subdomain; irrelevant here.

### Netlify domain steps that go with the CNAME
Domain management > **Add a domain** > `library.forbiddenmantra.com` (this project) > Netlify shows the DNS target it expects. **It must match** `unrivaled-liger-1baec4.netlify.app` or the value Netlify displays. After DNS resolves, Netlify issues the free HTTPS certificate (Let's Encrypt) automatically. Set `library.forbiddenmantra.com` as the **primary domain** so the netlify.app address redirects to it.

---

## Part 3. Shortest safe launch sequence (one step at a time)

| # | Who | Step | Verify before moving on |
|---|---|---|---|
| 1 | Owner | Run the Netlify checks (Part 2, Netlify). Reply with what is published there and whether it is Git-linked. | Not Git-linked; you know what the live deploy is |
| 2 | Owner | Reply with the confirmation sentences in Part 1 you can give today (address, IOSutra, artwork, legal; NVIDIA once checked). | Each is quoted exactly; unconfirmed ones stay unconfirmed |
| 3 | Claude | Record only the confirmed items and build the production ZIP once: `FM_ENV=production FM_SITE_URL=https://library.forbiddenmantra.com node scripts/make-wix-package.mjs`, then `node scripts/verify-wix-package.mjs`, `node scripts/security-gate.mjs` and a focused SEO check. Commit and report the checksum. | The build did not refuse; no `noindex` outside the dynamic shell page; canonical URLs and sitemap use library.forbiddenmantra.com |
| 4 | Owner | In Netlify (same project) add the domain `library.forbiddenmantra.com`; note the DNS target it shows. | Target matches the CNAME below |
| 5 | Owner | In Wix, add the one CNAME record (`library` > `unrivaled-liger-1baec4.netlify.app`). Do not edit anything else. | Netlify shows the domain verified and HTTPS issued (minutes to 48 hours) |
| 6 | Owner | Upload the production ZIP to unrivaled-liger-1baec4 as a new deploy and press **Publish deploy**. | https://library.forbiddenmantra.com loads; `/robots.txt` allows crawling and names `/sitemap.xml`; a book page source has no `noindex`; one Amazon link carries `tag=darktheoryinc-20`; the microphone button appears in Chrome |
| 7 | Owner | In Google Search Console add `library.forbiddenmantra.com` as a property and submit `/sitemap.xml`. | Sitemap accepted |
| 8 | Owner (Claude supplies the snippet) | In the Wix Studio editor add the menu link "📚 Enter the Forbidden Library" > `https://library.forbiddenmantra.com`, and connect the homepage search bar (below). Publish the Wix site. | A test search on the Wix homepage opens the library results page |

### Wix homepage search bar (step 8; not yet applied; untested on your site)
Velo is enabled on your site, so the simplest connection is page code on the homepage. In the Wix Studio editor, if the homepage search is a regular input plus button, give them IDs (for example `#libSearchInput`, `#libSearchButton`) and add this page code:

```js
import wixLocationFrontend from 'wix-location-frontend';

$w.onReady(function () {
  const go = () => {
    const q = ($w('#libSearchInput').value || '').trim();
    if (q) wixLocationFrontend.to('https://library.forbiddenmantra.com/search/index.html?q=' + encodeURIComponent(q));
  };
  $w('#libSearchButton').onClick(go);
  $w('#libSearchInput').onKeyPress((e) => { if (e.key === 'Enter') go(); });
});
```
(Do not use `$w('#html3')` or the legacy snippet; this is separate.) If the homepage search is Wix's built-in Site Search element, it cannot be re-pointed to another site; replace it with an input and button as above, or add an HTML embed with a form whose action is `https://library.forbiddenmantra.com/search/index.html`, method `get`, text input named `q`, `target="_top"`.

Order matters: do step 8 last, only after step 6 works, so the Wix site never links to a page that is not live.

---

## Part 4. What stays unchanged
All 16,711 works and 31,061 editions, the 12,022 original URLs, the Amazon tag `darktheoryinc-20` and every existing affiliate link, the voice-search button, the Digital Librarian, NVIDIA badge and statements, the IOSutra section, and the Wix homepage. Multilingual voice search is on hold.

## Part 5. Rollback
- Netlify: Deploys > choose the previous deploy > **Publish deploy** (instant).
- DNS: delete the single `library` CNAME record in Wix.
- Repository: preview build `3a83e36`, ZIP SHA-256 `9c8f06e0a2e8feaf7388c2cb245347b539bd4f403b01707bb71ca825b01afd79`.
