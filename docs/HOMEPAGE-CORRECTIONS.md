# Homepage corrections (review before any new package)

Branch `claude/gallant-archimedes-ocwf9s`. Not deployed. The hosting ZIP and `wix/` were not rebuilt.

## 1. Compact header
* The decorative hero is removed. The header is one slim row (logo, Subjects, Traditions, Authors, Reading paths, Collections, Press, IOSutra, language). On inner pages the header keeps a wide search box with the navigation on a second row; below 1280 px the navigation collapses behind the menu button.
* The homepage page title is a visually hidden `<h1>`. The affiliate disclosure sits under the librarian.
* Measured at 1366x768 and 1440x900: header 58 px, first cover row starts at 353 px, six covers fully visible without scrolling (also at 1100 px). Tablet (820 px) shows five columns; mobile shows two.
* Longer translations (fr, pt, it, de, es) no longer push the header past the viewport (checked at 1280, 1366, 1440, 1920 px in all eight interface languages).

## 2. Missing-cover audit (homepage)
* 62 cards, 58 distinct works across every shelf. 24 works show a verified cover, 34 show the text-only placeholder.
* **Repaired: 0.** No homepage book has a broken or mis-named cover reference: all 27 image paths on the page resolve, and none of the 34 works has any cover file, manifest entry or differently-cased file anywhere in `assets-src/` to point to. Nothing was substituted.
* **Genuinely missing (34):** mo-pai-exposed (a candidate image exists in `assets-src/covers-pending` but the owner has not confirmed it, so it stays unassigned), the-inner-mechanics-of-energy-cultivation, the-cyber-cupid, the-power-of-fasting-and-prayer, jinn-dark-angels-shapeshifters-and-ghouls, and 29 third-party titles (When Things Fall Apart, The Power of Now, Man's Search for Meaning, The Untethered Soul, When the Body Says No, Comfortable with Uncertainty, I Am That, The Tao of Physics, Wherever You Go There You Are, The Golden Bough, Taoist Secrets of Love, Wicca, Encyclopedia of 5,000 Spells, Harry Potter: A History of Magic, Seventy-Eight Degrees of Wisdom, Buckland's Complete Book of Witchcraft, Modern Magick, Awaken Healing Energy Through the Tao, Chakra Mantras, Tao Te Ching, The Secret of the Golden Flower, Circe, American Gods, A Wizard of Earthsea, Harry Potter and the Philosopher's Stone, The Hobbit, Good Omens, Jonathan Strange & Mr Norrell, The Lion, the Witch and the Wardrobe). Publisher and Amazon images are not used without authorization.
* Catalogue-wide: 99 verified covers (unchanged).

## 3. Six per row
* Every homepage shelf is a six-column grid on desktop (Featured from Forbidden Mantra Press, Mo Pai Collection, each category shelf), with identical cover size (177x266 at 1440 px), card spacing and type. Tablet and mobile keep their existing 5/4/3/2-column layouts.
* Change to curation, explained: the category shelves were four-book side-scrolling strips; they are now six-book rows so each fills a row. They are filled by the same selection rule with a limit of six (no invented titles).
* Shelves that do not fill a row: Featured from Forbidden Mantra Press has 14 books (6 + 6 + 2); Mo Pai Collection has 7 (6 + 1); the Energy & Inner Cultivation category shelf has only 5 eligible books. Nothing was added to fill them.

## 4. Digital Librarian as the primary search
* The homepage has no separate search box. A compact panel with her face, a text input, an Ask button and four example chips sits directly above the first shelf. The floating panel is not shown on the homepage; inner pages keep it and the ordinary search box.
* It answers plain questions from the catalogue index in the browser: no AI service, no network calls, no cost. Each answer lists up to six real books with cover (or the text-only placeholder), authors and a link to the book page, and "Show more" pages through the rest.
* Follow-ups: "in Spanish", "audiobooks", "only your own books", "more", "tell me about the second one", "start over".
* Honesty: unverified placeholder records are never offered; when nothing matches she says so and suggests nothing; topic words are matched to real catalogue shelves, and a note says when a question (Nag Hammadi) is answered from a related shelf. She speaks of "our catalogue", never stock; for availability she points to the Amazon link on the book page.
* Limits: her sentences are English (like her earlier version); the panel title, placeholder and button follow the site language (machine-drafted, beta). It matches words, not meaning, so unusual phrasings can miss.
* Without JavaScript the form submits to the ordinary search page.

## Verification
`node scripts/verify.mjs` and every `test/verify-*.mjs` pass (including the new `test/verify-ask.mjs`, 49 checks), axe finds no violations on 26 pages, and a browser pass confirmed navigation (Authors, Subjects, book pages), language switching, RTL, mobile menu, no JS errors, and 311 works / 632 editions / 626 of 626 tagged amazon.com links.
