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

## Covers (95 valid; 31 of the 420 table editions have a cover; 26 of the 131 owner-listed works)
Added since the last report, now confirmed by the table: The Hidden Doctrine of Mo Pai, The Genesis of Sophia, The Secret Knowledge of Adam, The Catalyst, and the Hindi Kundalini cover. Earlier this session: Apocalypse of Adam/Eve/Peter, Kundalini, Mo Pai and Internal Alchemy, Mo Pai French/Spanish, Gayatri (clean file), Om Namah Shivaya EN/ES, Maha Mrityunjaya, Invoke the Fierce EN/ES, Lakshmi Gayatri, Miracles of the Masters of Yoga, Edenic Origins, Archons I-4, plus the older Kebra Nagast, Weapons of the Gods, Siddhis, Gospel of Magdalene, Kleem, Mo Pai D&H, and 58 Penguin Random House covers. Each cover is tied to one edition (a cover is not extended to the other formats of the same title without confirmation).

Still staged (reasons in `data/drafts/covers-pending.json`): Apocalypse of Adam Part II and the German Das Erscheinen Adams (grid or smear defects), Energy Unleashed (screenshots), Mo Pai Exposed (cover subtitle "Serious Truths About Internal Power Training" differs from the listing), the square Maa Kali files, and covers whose titles differ from the table (Matrix of Mantra vs The Matrix of Sound; Atharva Veda vs The Book of Vedic Spells; Dream Journal vs The Complete Dream & Conscious Experience Journal) or have no record (The Forbidden Light). The table's own `cover_url` values are Amazon-hosted images and are not used.

## What remains for the owner
1. Cover files for the roughly 105 owner-listed works that have none (the Amazon images in the table cannot be used); the Wix media library has no further matching files.
2. Confirm the flagged duplicates above, the imprint of the Muslim Prayer, R. K. Theory, Alex Knight and Spiritual Expressionz titles, and the author-name variants.
3. Confirm the automatically assigned departments, and the cover-title mismatches listed above.
