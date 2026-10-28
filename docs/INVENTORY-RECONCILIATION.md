# Inventory reconciliation: the owner's existing bookstore vs the new catalogue (2026-10-28)

## Source and access
The existing bookstore (the HTML component on forbiddenmantra.com) draws its list from the owner's own `catalog` table through the site's public read-only access. I made exactly the request the page itself makes (`select=*` on that one table, ordered by title) and nothing else: no other table, no write, no private access. The result is saved without prices or Amazon cover URLs in `data/drafts/owner-catalog-snapshot.json`; the per-record mapping to the new catalogue is `data/drafts/owner-catalog-reconciliation.json`. No credential is stored in the repository.

## Final inventory
| | Before the reconciliation | After |
|---|---|---|
| Records in the owner's table | 176 records / 420 editions (ASIN, format, publication date, Amazon link) | all 176 records and all 420 editions are in the catalogue, each matched by ASIN |
| Works in the new catalogue | 198 | **311** |
| Editions | 230 | **632** |
| Forbidden Mantra Press works | 18 | **123** |
| Owner-listed works | 18 | 131 (the 176 table records, grouped, plus 3 earlier owner entries) |
| Languages with editions | 2 | **12** (English, Spanish, German, French, Dutch, Welsh, Portuguese, Arabic, Hindi, Chinese, Russian, Tamil) |
| Valid covers | 12 | **95** |
| Edition-specific author credits preserved | 0 | 51 |

By language in the owner-listed set: English 318 editions, Spanish 46, German 14, Hindi 14, French 10, Dutch 9, Welsh 3, Chinese 3, Portuguese 3, Russian 3, Arabic 1, Tamil 1.

## How records were grouped
The table has one record per language per title and no field linking a translation to its original, so translations were grouped under the English record when the title clearly corresponds (for example the German, Welsh, Dutch, Spanish, Arabic, Hindi, Tamil and Chinese records of The Apocalypse of Adam). Standalone records stay separate works. Where a match was not certain the records were kept apart and flagged, never merged.

## ASIN cross-check against what we already held
Every ASIN already in the catalogue matches the table exactly: Apocalypse of Adam audiobook, Gayatri Mantra audiobook, Mo Pai Exposed paperback, Mo Pai: The Destructive and Healing Force Within paperback, Energy Unleashed paperback, and the Kleem Spanish ebook. This also settles an earlier question: the second Mo Pai Exposed ASIN (B0GFVWMR9B, ISBN-13 9798243193894) is its **hardcover**.

## Author credits
Each table record carries its own credit, so the catalogue keeps credits as printed: "Emily K Patel", "Emily K. Patel", "Emily Patel", "Rav Shiva", "TSP Ravshiva", "TSPRav Shiva", "TSPRavshiva", "Forbidden Mantra Press", "Abdur Rahman", "R. K. Theory", "Alex Knight", "Ravi A. Kissoon", "Spiritual Expressionz". Where a translation or edition is credited differently from its work (for example the Maa Kali and Apocalypse of Adam editions credited to "Emily K Patel" or "Rav Shiva" under a work attributed to Forbidden Mantra Press), the edition carries a "Credited as" line on its book page. Two table authors end in "..." in the table itself (TSPRavshiva The Spiritual Philan…); the work shows the legible part and the edition keeps the exact table text.

## Duplicates and uncertain overlaps (flagged, not merged)
- Two English records for Beyond Sex (one with the "How To Series" suffix, author spelled "Emily K. Patel"): kept as two works, the second titled "(second catalogue record)".
- Two Hindi records for The Apocalypse of Adam (आदम का सर्वनाश and एडम का सर्वनाश).
- The Gospel of Truth: two records ("The Gospel of Truth: Nag Hammadi" and a longer "Ancient Wisdom Revealed" title); The Infancy Gospel of Thomas & Gospel of Thomas vs The Gospel of Thomas.
- Kleem Mantra: the table has only "Make Yourself Irresistibly Attractive with the Kleem Mantra" (TSPRav Shiva, all four formats) and its translations. The older catalogue work "…Kleem Mantra, Kamdev Mantra and Kama Sutra" (same author) probably is the same book under a longer cover title; both are kept and flagged, and the Spanish ASIN B0CW19ZHGX appears on both.
- Brahmastra: Weapon of God (Rav Shiva, ebook) vs Weapons of the Gods (Forbidden Mantra Press, ebook and paperback): two works.
- Maha Mrityunjaya: three records (The Maha Mrityunjaya Mantra / Maha Mrityunjaya Mantra / Mantra Sound Vibrational Energy), and Lakshmi Gayatri: two records, each kept separate.
- Enlightened Silly Comic Strips vs Enlightened Silly Comics; Ruqyah's for Wealth vs Ruqyah's for Wealth in Arabic Language.
- Ancient Breathing Techniques… (Breath Mastery) vs Unleashing the Inner Fire; The Coven and The Yogi (two records).

## Data quirks recorded as they are
- Six records have a language code that disagrees with the title language (Welsh and Dutch Apocalypse of Adam titles and "Beyond Sex: de spirituele dimensies…" coded en; the German Kleem, Spanish Maa Kali and "LOS PENSAMIENTOS SON MANTRAS" coded en). They are stored under the real language and flagged.
- Spellings kept as the table has them: "Irresitible", "Macabees", "APOCHRYPHA", "APOCHRYPHON".
- The table's series "The Hidden Technology of Human Power Series" (11 records) confirms that "The Hidden Technology of Human Power" is a series name, so the earlier catalogue placeholder of that name stays flagged. "Mo Pai Nei Kung" and "Forbidden Mantra" are not in the table and stay as earlier owner entries, flagged.
- Records outside the Forbidden Mantra Press imprint or whose imprint is not stated (Abdur Rahman, Alex Knight, R. K. Theory, Spiritual Expressionz, the Muslim Prayer Series) are in the catalogue but not counted as press titles until the owner confirms.
- Departments for the 110 new works were assigned from titles and series and are flagged for review. New departments: Children's Books, Comics & Humor, Journals & Coloring Books.
- Formats, ASINs and publication years come from the table. Prices and the table's Amazon cover URLs were deliberately not stored. Buy links are the table's own Amazon product links with the affiliate tag added (all 631 links audited, 0 errors).

## Cover coverage (98 valid covers, updated)
| Scope | Works with a cover | Editions with a cover |
|---|---|---|
| Whole catalogue | 89 of 311 (29%) | 98 of 632 (16%) |
| Owner-owned books (owner-listed) | 29 of 131 (22%) | 35 of 425 (8%) |
| Third-party books | 60 of 180 | 63 of 207 (publisher-authorised Penguin Random House files) |
| Forbidden Mantra Press titles | 29 of 123 | 35 of 413 |

Owner-owned editions with a cover, by language: English 30 of 318, Spanish 3 of 46, French 1 of 10, Hindi 1 of 14; none yet for German (14), Dutch (9), Welsh (3), Chinese (3), Portuguese (3), Russian (3), Arabic (1), Tamil (1). By format: ebook 32 of 177, paperback 3 of 115, none for hardcover (79) or audiobook (54). A cover is tied to the one edition it was matched to (usually the ebook, whose ASIN is the table's primary ASIN); it is not extended to the other formats without evidence.

New this round, from the owner's Google Drive and matched to exact table records: The Physics of Siddhis (Perception Across Time), Siddhis: The Non-Locality of Consciousness (the cover reads "The Physics of Siddhis: Non-Locality of Consciousness"; wording to confirm), and The Coven and The Yogi: Eclipse of the Heart Chakra (cover says Book Two). The Wix media subfolders hold only social-media images, and Drive has no further matching files (a Drive Spanish Edenic Origins file still reads "Aquí va el subtítulo", so it is a placeholder, not a cover).

The list of owner-listed works that still need a cover file is `data/drafts/covers-needed-from-owner.json` (106 works with their languages, formats and ASINs). The table's Amazon-hosted cover images are not used (see `docs/AMAZON-COVERS.md`).

## Duplicate decisions, from ASINs and publication dates
No records were merged and no edition was removed: every table ASIN is unique, so every flagged pair is two different Amazon products.

| Flagged group | Evidence | Decision |
|---|---|---|
| Beyond Sex (two English records) | different ASINs; published 2023-03/07 vs 2024-12 | two works; probably an original and a re-issue, owner to say |
| Hindi Apocalypse of Adam (two records) | B0DR69Q4T4 (2024-12) vs B0H1KPFZS6 (2026-05) | two editions kept |
| The Gospel of Truth (two records) | six different ASINs, 2023-05 and 2024-12 | two works |
| Infancy Gospel of Thomas & Gospel of Thomas vs The Gospel of Thomas | different ASINs; the combined record has two ebook, two hardcover and two paperback ASINs from 2023 and 2024-12 | kept; the combined record holds two product generations |
| Brahmastra: Weapon of God vs Weapons of the Gods | different ASINs, authors and dates (2023-03 vs 2025-06) | two works |
| Maha Mrityunjaya (3 records) and Lakshmi Gayatri (2 records) | each has its own ASINs and dates | separate works |
| Comics pair; Ruqyah's pair | different ASINs (comics 6 days apart in 2017; Ruqyah's same day) | separate works |
| Ancient Breathing Techniques vs Unleashing the Inner Fire vs Breathing with Ancient Wisdom | different ASINs, 2023-03 vs 2023-05 | separate works |
| The Coven and The Yogi (two records) | cover for the second reads "Book Two" | two books |
| Kleem Mantra (new work) vs the older combined-title work | the Spanish ASIN B0CW19ZHGX is on both works (same product, listed twice); the older work's English edition has no ASIN | not merged and nothing removed: work-level identity is not proven and the older link points to amazon.es; owner to confirm |

## Author-name variants (credits preserved as printed)
Counts of table records: Emily K Patel 104; Rav Shiva 27; Forbidden Mantra Press 11; TSP Ravshiva 8; Emily Patel 6; Emily K. Patel 4; TSPRavshiva (The Spiritual Philan… / Phila…, truncated in the table) 5; The Spiritual Philanthropist Rav… (truncated) 2; TSPRav Shiva 2; Abdur Rahman 2; R. K. Theory 2; Ravi A. Kissoon 1; Alex Knight 1; Spiritual Expressionz 1. Open identity questions, not guessed: whether "Emily Patel", "Emily K. Patel" and "Emily K Patel" are one credit; whether Rav Shiva, TSP Ravshiva, TSPRav Shiva and TSPRavshiva (The Spiritual Philanthropist) are one pen name; and the older catalogue spelling "Emily K Kissoon" (Mo Pai: The Destructive and Healing Force Within), which the table credits as "Emily Patel".

## Imprints and categories
The table has no publisher field. Forbidden Mantra Press is recorded as owner-supplied for the 123 press works; the Muslim Prayer Series titles and the Abdur Rahman, R. K. Theory, Alex Knight and Spiritual Expressionz titles stay outside the press count until the owner confirms the imprint. Departments were checked against the table's series: all but four agree with the series; the four are source anomalies that were kept (Energy Unleashed sits in the table's "buddhist mantra series" but is a Mo Pai book; Creation and Connection and Unveiling Hidden Wisdom and The Reason All The Prophets Fasted sit in series that do not match their subject). Two works are assigned by default and flagged: The Code of Immortality: The Fallen Star.
