# Ownership reconciliation (2026-11-05)

Rule from the owner: Forbidden Mantra Press includes books published under several author names and pen names (Emily K Patel is one of Rav's pen names). Ownership is decided by the owner's catalogue table, never by author name. Author credits stay as printed on each book.

## Corrected total: 127 verified owned titles displayed
(was 119 before this correction; 123 entries existed, 4 are withheld)

* Basis: the owner's public `catalog` table as snapshot on 2026-10-28 (176 rows, 420 editions, 127 works). Every edition matched the library by ASIN. All 127 works are now labelled and shown as Forbidden Mantra Press titles. The live table could not be re-read: the network blocks supabase.co from this environment.
* Added by this correction (8, author names kept): JINN - Dark Angels, Shapeshifters, and Ghouls (TSPRav Shiva); Ruqyah's for Wealth and its Arabic edition (Abdur Rahman); The Cyber Cupid (Alex Knight); The Pissed Off Hindu and Truth is Stranger Than Fiction (R. K. Theory); The Power of Fasting and Prayer (Rav Shiva); wildflower coloring book (Spiritual Expressionz).
* Emily K Patel books: 59 titles under "Emily K Patel" plus the variants "Emily K. Patel" (4) and "Emily Patel" (4), all already in the set. Author names were not changed.
* Not included, correctly: third-party books by unrelated people with similar names (Kamlesh D. Patel, Nita Patel, Chandra Patel, Nithyananda, etc.). They are not in the owner table; a name filter would have wrongly claimed them.
* Withheld (4, own pages kept, not counted): Mo Pai Nei Kung (category label), The Hidden Technology of Human Power (series name), "Forbidden Mantra" (no ASIN, not in table), and the long "Kleem Mantra, Kamdev Mantra and Kama Sutra" entry (probable duplicate of the shorter Kleem title; shares Spanish ASIN B0CW19ZHGX; not merged).

## Covers recovered (4 new, from the owner's Wix Media Manager, read 2026-11-05)
| Work / edition | File | Why it matches |
|---|---|---|
| Apocalypse of Adam, Part II (paperback B0GWVMZQ8S) | apocalypse-adam2.png | title, "War of the Archons Part II", Emily K Patel (low resolution) |
| Maa Kali Mantras and Instructions (ebook B0BXTBM2QT) | ma-kali-2400.png, black side bars cropped | exact title |
| The Apocalypse of Adam, German ebook B0CVW787KP | adam-german.png | "Das Erscheinen Adams" |
| Make Yourself Irresistibly Attractive with the Kleem Mantra (ebook B0BY67Z5QR) | kleem-listing-shot.png | exact title (low resolution listing screenshot) |

Covers shown now: 33 of 127 titles (was 30 of 119). 94 show title-and-author cards.

## Wix Media files NOT used (owner decision needed)
* mopai-exposed.png: title and author match Mo Pai Exposed, but the cover subtitle is "Serious Truths About Internal Power Training" while the catalogue subtitle is "What the Internal Power Community Refuses to Admit". Confirm it is the right cover.
* atharvaveda.png: reads "The Atharva Veda: Ancient Spells, Mantras..."; the catalogue title is "The Book of Vedic Spells". Confirm it is the same book.
* matrix-of-mantra.png, dream-journal.png, forbidden-light.png: titles not in the owner table or the catalogue (drafts in `data/drafts/own-titles-pending-approval.json`). Need ASINs before listing.
* best-sellers.png, chatgpt-*.png, sophia.jpg, gayatri-small.jpg, kali-ma-edit.jpg and others: banners, stock-style images, or duplicates of covers already used.
