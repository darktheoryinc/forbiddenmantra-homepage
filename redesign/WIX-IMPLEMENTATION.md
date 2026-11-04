# Wix implementation instructions (apply to the duplicate first)

**Nothing here has been applied to any Wix site.** Do every step on `FMBACKUP 2026-11-04` (id `c57fcf37-4d7c-48a6-9261-ca8043685e5c`), look at it in Preview, and only then ask for approval to repeat it on the live site. The live site stays as it is until you approve.

## Files
* `redesign/dist/forbiddenmantra-homepage.redesign.html`: the new homepage embed (self-contained, about 84 KB, everything inlined).
* `redesign/velo/page-code.js`: corrected Velo snippet.
* `redesign/STYLE-GUIDE.md`: styling for every other page.

## Steps (duplicate site only)
1. Open `FMBACKUP 2026-11-04` in the Wix Studio editor, go to the homepage and select the HTML element (the original snippet calls it `#html3`; the ID shows in the editor).
2. Open its code, select all, and replace it with the full contents of `forbiddenmantra-homepage.redesign.html`. If Wix refuses because of the size, tell me; the fallback is to host the three images outside the code.
3. Make the element full width. Its height is set automatically once step 4 is done.
4. Open the page's code panel and replace the old snippet with `redesign/velo/page-code.js` (change `#html3` if your element has a different ID).
5. Preview on desktop and mobile. Check: the header, the Atma search card, IOSutra, "Pay As You Go (Soon)", the NVIDIA badge, every book card, the footer notices.
6. Nothing else to do until the two destinations are ready (see below).

## Connecting the two features later (edit two strings near the top of the embed code)
```
window.FM_CONFIG={"libraryBaseUrl":"","iosutraPaygUrl":""}
```
* `libraryBaseUrl`: the public address of the compliant library, `https` only, no path, for example `https://library.forbiddenmantra.com`. The search then opens `<address>/search/index.html?q=<query>` in a new tab (the library's real search page, verified). While empty, the search shows a polite notice and goes nowhere. **Do not use the private Netlify address.**
* `iosutraPaygUrl`: the verified Pay As You Go page, `https` only. While empty, Pay As You Go shows "Soon" and is not a link.

## Rollback
Paste the original embed code back (it is `forbiddenmantra-homepage.html` on branch `backup/original-forbiddenmantra`, commit `83ae92e6a2ca5953f0a27e4c9a6dc7dde5a5bc7f`).

## Why the backup preview looked blank (investigation)
What I can prove from the original files, and what I cannot:
* **Proven:** the embedded page posts its height as `{ type: 'wixHeight' }`, but the original Velo snippet acts only on `'setHeight'`, and listens with `window.addEventListener` instead of the HTML element's `onMessage()` that Wix documents for receiving these messages. So the element's height is never applied. (Test: `redesign/verify.mjs`.)
* **Proven:** the original file begins with a pasted Markdown fence (` ```html `) and has two more fence lines around the script. They print as visible text inside an HTML element.
* **Proven:** the original hero uses `min-height: 70vh` / `100vh` and a fixed 70 px navigation. Inside an iframe whose height is small or changing, viewport-height layouts collapse or loop. The redesign removes these.
* **Not provable from here:** the actual height and settings of the HTML element in the duplicate, and Wix Studio's own preview behaviour for an unpublished draft. If the element is only a few pixels tall or hidden, the page looks blank even though its content exists. Check by selecting the element in the duplicate and reading its height and "Show on all pages / hidden" settings.
* Wix notes that elements hidden by Velo need Velo enabled in a duplicate; the duplicate does show Velo enabled.
The redesign addresses every cause above, but the first Preview of the duplicate is the real test.
