# Installing the Forbidden Mantra Press bookstore inside your Wix site

**Prepared only. Nothing has been published; your Wix site, domain, DNS and hosting are unchanged. No paid service is needed.**

This package is a **PREVIEW build**: it shows a "Preview build, not published" bar at the top and tells search engines not to index it. Use it to inspect the bookstore on a free host before connecting it to Wix. The final production build is made after the approvals listed at the bottom.

## Why an iframe
Your earlier homepage was one HTML file pasted into a Wix HTML iframe. The bookstore is 522 files (508 pages, search index, images, scripts), so it must live on a free static host, and Wix shows it through the same kind of iframe element, set to a website address instead of pasted code.

## Part 1: get a working preview (about 5 minutes, free)
1. Download the file (exact link):
   `https://github.com/darktheoryinc/forbiddenmantra-homepage/raw/claude/gallant-archimedes-ocwf9s/wix/forbiddenmantra-site-for-hosting.zip`
   It must be **3,702,982 bytes (about 3.7 MB)** and start with the letters `PK`. If it is tiny, or opens as a web page, it was not downloaded correctly: use the link above (the "raw" link, not the normal file page), or use step 1b.
   * **Check it (Windows):** open Command Prompt in the Downloads folder and run
     `certutil -hashfile forbiddenmantra-site-for-hosting.zip SHA256`
     The result must be `3d389c100f09b45f…` (the full value is in `wix/forbiddenmantra-site-for-hosting.zip.sha256`).
   * **1b. No ZIP needed:** on the repository page choose branch `claude/gallant-archimedes-ocwf9s`, then Code > Download ZIP, extract it, and use the folder `wix/hosting/` inside. It holds the identical files.
2. Go to **Netlify Drop** (app.netlify.com/drop). Drag in **either** the ZIP **or** the extracted folder (`wix/hosting/`, whose top level contains `index.html`). If the ZIP is refused, extract it and drag the folder instead.
3. Netlify gives you an address like `https://something.netlify.app`. Open it and look around. It should show the bookstore with the IOSutra section and the full-colour NVIDIA badge.
4. Free Netlify Drop sites may expire unless you claim them with a free Netlify account. Claim it if you want to keep the address.

## Part 2: show it inside Wix (only after you are happy with Part 1)
5. Open your Wix site in the **editor** (do not publish yet).
6. Duplicate the page that holds the current bookstore iframe and keep the copy as a backup.
7. Click the existing iframe element (it shows "iFrame #html3"). Change it from *Code* to **Website address**, paste your Netlify address (it must start with `https://`), and apply. Keeping the same element keeps its ID.
8. Make it **full width** and about **screen height** (100vh, or around 900 px), with scrolling on.
9. Click **Preview** in Wix and check: homepage, search, a book page, the language menu, the librarian button at the bottom right, on desktop and mobile.
10. When satisfied, **you** press Publish in Wix. To undo, unpublish or restore the duplicate.

## What is verified, and what is not
* **Verified here** (`node scripts/verify-wix-package.mjs`, 50 checks): the ZIP is real and non-empty, extracts to identical files with two independent tools (Info-ZIP and Java), has `index.html` at the top, all 522 files present, all 48,710 internal links, images and scripts resolve; all 192 books and 223 editions have pages; served over HTTP in a real browser on desktop and mobile with no failed requests or JavaScript errors: homepage, search, librarian, categories, authors, series, guides, legal pages, language menu, IOSutra artwork and full-colour NVIDIA badge. Cross-origin iframe test: `node test/verify-wix-embed.mjs` (41 checks).
* **Not verified:** I cannot reach Netlify or Wix from my environment, so I did not upload to Netlify or open your Wix editor. The ZIP meets the Netlify Drop requirement as I understand it (a standard ZIP with `index.html` at the top), but I have not seen Netlify accept it.
* **Amazon links:** 220 buy buttons on book pages; every amazon.com link carries `tag=darktheoryinc-20` (85 go to a product page, 135 are an ISBN search); 2 amazon.co.uk links are correctly untagged. Product links have not been checked live.

## Known limitations (all iframe embeds)
* The browser address bar stays on your Wix page, so a visitor cannot copy a link to one book.
* Google credits the content to the Netlify address, not forbiddenmantra.com (the preview is marked noindex for that reason).
* Wix's menu and the bookstore's menu both show; your Blog, About and other Wix pages stay in Wix's menu.
* Saved choices (language, librarian minimized) may not persist where a browser blocks storage in frames. The site still works.
* Amazon, IOSutra and NVIDIA links open in a new tab, because Amazon refuses to load inside a frame.

## Open launch blockers (not granted, not assumed)
1. **Book covers:** none of the 192 books has a cover image; each shows a typographic title card. No cover source is connected, and none were invented. See `docs/LAUNCH-READINESS.md`.
2. **Verified purchase links:** 76 books have a product link, 116 an ISBN search link, and 10 of your own 12 titles have no ISBN/ASIN.
3. **Approvals only you can give:** NVIDIA membership statement and trademark wording (send the Inception guidelines PDF); IOSutra promotion approved; legal pages reviewed; final web address; commercial-use and likeness permissions for the IOSutra artwork and the librarian character. The production build refuses to run until they are recorded.

## Rebuilding
`node scripts/make-wix-package.mjs` rebuilds the preview ZIP and `wix/hosting/`; `node scripts/verify-wix-package.mjs` re-checks them. A production package is made with `FM_ENV=production FM_SITE_URL=https://your-address/ node scripts/make-wix-package.mjs` and works only after the approvals above.
`wix/wix-velo-page-code.js` is an optional auto-height snippet (the fixed-height setup above needs no code).
