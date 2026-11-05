# Library final improvements (2026-11-05)

Branch `library/final-improvements`, built on `claude/compliance-remediation` (be88058). Not deployed. Netlify, DNS and Wix untouched.

## What changed
1. **Home page lists every verified press title.** Before: 14 featured. Now: 119, with the first 28 shown and the rest revealed by a "Show more" button (steps of 28; no extra requests, covers are lazy-loaded; without JavaScript all are shown). Order: featured titles, then titles with covers, then A to Z. The Press page keeps its search, subject, tradition, language, format filters.
2. **Verified count is now 119, not 123.** Four press entries are withheld from the shelf and the count (`listing: "withheld"` in `staging/verified/fmp-owner-listed.json`). Their own pages and data are kept:
   * Mo Pai Nei Kung: category label, no verified book.
   * The Hidden Technology of Human Power: series name, no verified book.
   * Forbidden Mantra: imprint-name entry, no ASIN, not in the owner catalogue table.
   * Make Yourself Irresistibly Attractive with the Kleem Mantra, Kamdev Mantra and Kama Sutra: probable duplicate of the shorter Kleem title (shares Spanish ASIN B0CW19ZHGX); not merged.
3. Nothing else changed: design, navigation, branding (IOSutra link, NVIDIA badge), legal, SEO, covers (still only the 37 owner files), affiliate tag.

## Why 119
All 420 editions in the owner's catalogue table (176 rows, 127 works) are already in the library by ASIN. 119 of those works are press titles. The other 8 are by other authors (R. K. Theory, Abdur Rahman, Alex Knight, Spiritual Expressionz, and two by Rav Shiva) and are not labelled Forbidden Mantra Press here: the owner must say whether to show them as press titles.

## Not fixable from here
* 31 of the 119 press titles have a cover; 88 show title-and-author cards until the owner supplies the cover files (the importer `scripts/covers-bulk.mjs` is ready). Covers cannot be fetched from Amazon or from the Wix catalogue in this environment.
