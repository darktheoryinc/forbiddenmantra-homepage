# Installing the Forbidden Mantra Press bookstore inside your Wix site

**Prepared only. Nothing has been published; your Wix site, domain, DNS and hosting are unchanged. No paid service is needed.**

**Update 2026-10-28:** this is the package from commit `8f14416`. The owner has recorded explicit approval to show the IOSutra advertisement with the NVIDIA Inception badge, membership wording and non-endorsement statement, so they are included. Independent portal verification of the membership, NVIDIA's Inception guidelines and legal review are not documented. A Netlify Drop site is public to anyone who has its address, so share the preview address only with people you trust (the preview is marked noindex).

This package is a **PREVIEW build**: it shows a "Preview build, not published" bar at the top and tells search engines not to index it. Use it to inspect the bookstore on a free host before connecting it to Wix. The final production build is made after the approvals listed at the bottom.

## Why an iframe
Your earlier homepage was one HTML file pasted into a Wix HTML iframe. The bookstore is 520 files (508 pages, search index, images, scripts), so it must live on a free static host, and Wix shows it through the same kind of iframe element, set to a website address instead of pasted code.

## Part 1: get a working preview (about 5 minutes, free)
1. Download the file (exact link):
   `https://github.com/darktheoryinc/forbiddenmantra-homepage/raw/claude/gallant-archimedes-ocwf9s/wix/forbiddenmantra-site-for-hosting.zip`
   It must be **9,043,521 bytes (about 9 MB)** and start with the letters `PK`. If it is tiny, or opens as a web page, it was not downloaded correctly: use the link above (the "raw" link, not the normal file page), or use step 1b.
   * **Check it (Windows):** open Command Prompt in the Downloads folder and run
     `certutil -hashfile forbiddenmantra-site-for-hosting.zip SHA256`
     The result must be `23aec519f2f516f1…` (the full value is in `wix/forbiddenmantra-site-for-hosting.zip.sha256`).
   * **1b. No ZIP needed:** on the repository page choose branch `claude/gallant-archimedes-ocwf9s`, then Code > Download ZIP, extract it, and use the folder `wix/hosting/` inside. It holds the identical files.
2. Go to **Netlify Drop** (app.netlify.com/drop). Drag in **either** the ZIP **or** the extracted folder (`wix/hosting/`, whose top level contains `index.html`). If the ZIP is refused, extract it and drag the folder instead.
3. Netlify gives you an address like `https://something.netlify.app`. Open it and look around. It should show, top to bottom: the hero, a shelf of Forbidden Mantra Press books, the IOSutra advertisement with the Inception Member panel and the full-colour NVIDIA Inception badge inside it, then the Featured books shelves.
4. Free Netlify Drop sites may expire unless you claim them with a free Netlify account. Claim it if you want to keep the address.

## Part 2: show it inside Wix (only after you are happy with Part 1)
5. Open your Wix site in the **editor** (do not publish yet).
6. Duplicate the page that holds the current bookstore iframe and keep the copy as a backup.
7. Click the existing iframe element (it shows "iFrame #html3"). Change it from *Code* to **Website address**, paste your Netlify address (it must start with `https://`), and apply. Keeping the same element keeps its ID.
8. Make it **full width** and about **screen height** (100vh, or around 900 px), with scrolling on.
9. Click **Preview** in Wix and check: homepage, search, a book page, the language menu, the librarian button at the bottom right, on desktop and mobile.
10. When satisfied, **you** press Publish in Wix. To undo, unpublish or restore the duplicate.

## What is verified, and what is not
* **Verified here** (`node scripts/verify-wix-package.mjs`, 55 checks, plus the full suite): the ZIP extracts to identical files with `index.html` at the top, about 580 files, all internal links resolve; 198 works; 12 real covers; the IOSutra ad contains the original badge (byte-identical to the source file) with a bookshelf above and another below; every amazon.com buy button carries `tag=darktheoryinc-20`; no accessibility violations.
* **Not verified:** I cannot reach Netlify or Wix from my environment, so I did not upload to Netlify or open your Wix editor. The ZIP meets the Netlify Drop requirement as I understand it (a standard ZIP with `index.html` at the top), but I have not seen Netlify accept it.
* **Amazon links:** every amazon.com buy button carries `tag=darktheoryinc-20` (product pages and ISBN searches); links to other marketplaces are untagged and labelled. Product links could not be machine-checked from here (Amazon blocks it); open a few after the preview is live.

## Known limitations (all iframe embeds)
* The browser address bar stays on your Wix page, so a visitor cannot copy a link to one book.
* Google credits the content to the Netlify address, not forbiddenmantra.com (the preview is marked noindex for that reason).
* Wix's menu and the bookstore's menu both show; your Blog, About and other Wix pages stay in Wix's menu.
* Saved choices (language, librarian minimized) may not persist where a browser blocks storage in frames. The site still works.
* Amazon, IOSutra and NVIDIA links open in a new tab, because Amazon refuses to load inside a frame.

## Open launch blockers (not granted, not assumed)
The NVIDIA branding approval is granted. Still open: the five other approvals in `config/approvals.json` (`iosutraPromotion`, `iosutraArtworkRights`, `librarianArtworkRights`, `legalPagesReviewed`, `productionAddress`), and the owner decisions listed in `docs/DEPLOYMENT-READINESS.md`. The production build refuses to run until they are recorded.

## Rebuilding
`node scripts/make-wix-package.mjs` rebuilds the preview ZIP and `wix/hosting/`; `node scripts/verify-wix-package.mjs` re-checks them. A production package is made with `FM_ENV=production FM_SITE_URL=https://your-address/ node scripts/make-wix-package.mjs` and works only after the approvals above.
`wix/wix-velo-page-code.js` is an optional auto-height snippet (the fixed-height setup above needs no code).
