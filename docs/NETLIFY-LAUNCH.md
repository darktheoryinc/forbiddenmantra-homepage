# Launching the bookstore on Netlify (separate from the Wix site)

Strategy (decided 2026-11-02): the existing Wix site at https://forbiddenmantra.com stays **completely unchanged**. The bookstore is hosted on its own Netlify address. The Wix menu gets one external link to it, and the bookstore's header has a "Main website" link back to https://forbiddenmantra.com. No DNS change is involved.

## Why the order matters
Canonical links, the sitemap and `robots.txt` in the production package contain the bookstore's final address. So the Netlify address has to exist **before** the production ZIP is built. Netlify only gives you the address when a site is created, so the first upload is the current preview ZIP (safe: it tells search engines not to index it).

## Steps for Rav
1. **Create the site.** In Netlify: Add new site > Deploy manually, and drop `wix/forbiddenmantra-site-for-hosting.zip` (the preview ZIP in this repository). Netlify assigns a random `something.netlify.app` address.
2. **Choose the final name now.** Site configuration > Site details > Change site name (for example `forbidden-library`). Pick the name you want to keep; changing it later changes the address, and the canonical links would then need a rebuild.
3. **Send Claude the final address** (the `https://....netlify.app` URL).
4. **Approvals.** Confirm the items in `docs/PRODUCTION-APPROVALS.md` (below). Claude records only what you explicitly confirm, then builds the production ZIP with:
   `FM_ENV=production FM_SITE_URL=https://<your-site>.netlify.app node scripts/make-wix-package.mjs`
5. **Publish it.** On the same Netlify site open Deploys and drag the new production ZIP onto the upload area. It replaces the preview.
6. **Check it.** Open `/robots.txt` (it should allow crawling and name `/sitemap.xml`), `/sitemap.xml`, and view a page's source (there should be no `noindex`). Search a book, open a book page, click a "Search on Amazon" button and look for `tag=darktheoryinc-20` in the address.
7. **Wix menu.** In the Wix editor, add an external link to the menu: label `📚 Enter the Forbidden Library`, address = the Netlify URL, open in the same or a new tab as you prefer. Nothing else on the Wix site needs to change.

Menu and button labels in Netlify and Wix change from time to time; the intent of each step is what matters.

## What is already done
* Header link "Main website" -> https://forbiddenmantra.com on every page, in all 8 interface languages (a test checks it).
* Preview package verified (indexing closed, 56 package checks). Production mode verified earlier in a throwaway copy with simulated approvals: no `noindex`, canonical URLs, sitemap, `robots.txt` with sitemap line.
* The build refuses to produce a production package until the approvals below are recorded, and refuses if the address you build with differs from the one recorded.
