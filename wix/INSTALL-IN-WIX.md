# Putting the updated Forbidden Mantra Press bookstore into your Wix site

**Status: prepared only. Nothing has been published, nothing in Wix was touched, no domain or hosting was changed or bought.**

## The honest answer first
Your earlier method (copy code from GitHub, paste into a Wix HTML iframe) was a **single HTML file** (`legacy/forbiddenmantra-homepage.html`, plus the auto-height snippet `legacy/wix-velo-page-code.js`, element `#html3`). That method can hold **one page**.

The new bookstore is **521 files**: 508 pages, a search index, images, scripts and styles. It **cannot be pasted into one Wix code box**, and if it were squeezed into a single page, search, the librarian and every page except the homepage would stop working.

So there are two honest options:

| | What works | What you need |
|---|---|---|
| **A. Full bookstore in an iframe (recommended)** | Everything: all pages, search, librarian, language menu, curated homepage, IOSutra section with the full-colour NVIDIA badge, Amazon links with `darktheoryinc-20` | A free place to put the files (step 1 below) and the same Wix iframe element you used before, switched to "website address" |
| B. Paste-only, single page | Homepage look only. **No search, no librarian, no other pages** | Nothing extra, but it is not the bookstore, so I did not build it |

The rest of this page is Option A. It keeps your Wix site, domain and pages (Blog, About, etc.) exactly as they are.

## Install: 10 steps
Do steps 1 to 6 first; nothing public changes until step 8.

1. **Get the files online (free).** Unzip `wix/forbiddenmantra-site-for-hosting.zip` (3.6 MB) from this GitHub branch. Upload the *unzipped folder* to a free static host such as Netlify Drop (drag and drop) or Cloudflare Pages (Direct Upload). You get a web address like `https://something.netlify.app`. Open it: you should see the bookstore. *(I have not tested these hosts' current menus or free-tier limits; any host that serves plain files over HTTPS works.)*
2. **Copy that address.** It must start with `https://` and end with `/`.
3. In Wix, open your site in the **editor** (do not publish).
4. **Back up first:** duplicate the page that holds the current bookstore iframe (page menu > Duplicate) and leave the copy hidden.
5. On the original page, click the existing **HTML iframe** element (the one that shows "iFrame #html3").
6. Change it from *Code* to **Website address**, paste the address from step 2, and apply. Keeping the same element keeps its ID, so any old snippet still points at it.
7. **Size it:** width 100% of the page; height about 100% of the screen height (use "100vh" if your editor offers it, or around 900 px). Leave scrolling on. In **Preview**, check: the homepage with the IOSutra section, search, the language menu, a book page, the librarian button at the bottom right.
8. When you are happy, **Publish** from Wix as you normally do. (Only you do this step.)
9. *(Optional auto-height layout.)* If you prefer the iframe to grow with the page instead of scrolling inside itself, paste `wix/wix-velo-page-code.js` into the page code. Trade-off: the librarian button and header then sit at the very bottom/top of a very tall frame instead of following the visitor.
10. To roll back: unpublish the page or restore the duplicate from step 4.

## Before this goes live: five approvals only you can give
The zip is a **preview build**: it shows a "PREVIEW BUILD, NOT PUBLISHED" bar at the top and the production build refuses to run until these are done. Tell me "approved" for each (or tell me what to change) and I will make the clean production zip:
1. IOSutra membership statement verified in the NVIDIA Inception portal (and the exact trademark attribution line NVIDIA requires; send the guidelines PDF).
2. The IOSutra promotion approved for production.
3. The legal pages (Terms/Refund, Privacy, Affiliate Disclosure) reviewed by you or counsel; I recovered only summaries of your original Wix policies.
4. The final web address from step 1 (needed for the production build).
5. Confirm commercial-use and likeness permissions for the IOSutra artwork and the librarian character.

## What will and will not behave differently inside Wix
* **Works (tested):** the bookstore loaded from a different address inside an iframe on desktop and mobile widths, with images, scripts, search (also `?q=`), the librarian, the language menu, internal page navigation, and the NVIDIA full-colour badge file (byte-identical to the one you supplied). Run `node test/verify-wix-embed.mjs` (41 checks, including a sandboxed iframe with browser storage blocked).
* **Affiliate links:** every Amazon button opens in a new tab with `tag=darktheoryinc-20` and `rel="sponsored"`. They must open in a new tab because Amazon refuses to load inside frames. The same applies to IOSutra and NVIDIA links.
* **Limits of any iframe on Wix:**
  * **Web addresses:** the browser address bar stays on your Wix page, so visitors cannot copy a link to a particular book, author or search.
  * **Google/SEO:** Google credits the content to the hosting address, not to forbiddenmantra.com, and Wix SEO tools cannot see inside the frame. If search ranking of book pages matters, the frame is the wrong tool; hosting the bookstore on a subdomain of your domain would be the fix, but that is a domain change, so I did not do it.
  * **Two menus:** Wix's own header/menu and the bookstore's menu will both show. Your original Wix pages (Blog, About, Health & Wellness, etc.) stay in Wix's menu; the bookstore's menu does not link to them.
  * **Saved choices** (website language, librarian minimized) may not persist in browsers that block storage in frames (the site still works, it just forgets).
  * **Fonts** load from Google Fonts over the internet.
  * **Untested by me:** the actual Wix editor and live Wix page (I cannot open your Wix editor); the exact wording of Wix menus may differ from the steps above.
* **Preview notice and drafts:** see the five approvals above.

## What is in this package
* `wix/forbiddenmantra-site-for-hosting.zip`: the whole site (`index.html` at the top level), including `assets/wix-embed.js`, a 15-line helper that does nothing outside a frame and, inside one, reports the page height in the original `setHeight` format.
* `wix/wix-velo-page-code.js`: optional auto-height snippet.
* `scripts/make-wix-package.mjs`: rebuilds the zip (`node scripts/make-wix-package.mjs`).
* The Wix package differs from the normal build only by that helper script (it is added only when `FM_WIX=1`).
