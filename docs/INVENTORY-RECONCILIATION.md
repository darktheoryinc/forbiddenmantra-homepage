# Inventory reconciliation: existing Forbidden Mantra Press website vs the new catalogue (2026-10-28)

Source: two screenshots of the owner's existing website book listing (supplied in the session; about 120 distinct listings are visible), plus the file names in the Forbidden Mantra Press Wix media library (read-only). The live site and the image files could not be fetched from this environment (network policy blocks `forbiddenmantra.com` and `static.wixstatic.com`), so this is **not yet the complete inventory**: the screenshots show only part of the page (rows before "La Joya del Loto" and after "The Coven and The Yogi: Eclipse of the…" are not visible).

## Counts (updated)
| | Before | After |
|---|---|---|
| Works in the catalogue | 198 | 269 (+71) |
| Editions | 230 | 325 (+95) |
| Forbidden Mantra Press titles | 18 | 86 (three more owner-listed works carry the Muslim Prayer Press imprint and are not counted as press titles) |
| Languages with editions | 2 | 8 (English, Spanish, German, French, Dutch, Welsh, Portuguese, Arabic) |
| Valid covers | 12 | 90 |

All new entries are `owner-listed` (the evidence is the owner's website) with `reviewFlags`; author credits are kept as printed ("Emily Patel" and "Emily K Patel" are different strings and are flagged, not merged). Source files: `staging/verified/fmp-website-listed.json` and translations appended in `staging/verified/fmp-owner-listed.json`.

## Translations added to existing works
- The Apocalypse of Adam: German (Das Erscheinen Adams), Dutch (De verschijning van Adam), Welsh (Datguddiad Adda), Spanish (El Apocalipsis de Adán). Welsh was added to the language registry.
- Om Namah Shivaya: German, Spanish. Maa Kali Mantras and Instructions: German, Spanish. Invoke the Fierce: Spanish. Lakshmi Gayatri: Spanish.
- Mo Pai: The Destructive and Healing Force Within: French, German, Spanish.

## New works (58), by group
Forbidden Mantra Series (Rav Shiva, new author name in the catalogue): Hanuman, Maha Mrityunjaya, Mantra Magic (Vasudevaya), Saraswati, Shiva, Katyayani-style and attraction/kundalini titles, Kama Sutra, Kamdev Gayatri, Lakshmi, Maa Kali for Success, How to Chant the Gayatri, Brahmastra, two Yogi-and-AI conversations. Emily K Patel: Buddhist Mantra Series (Amitabha, Avalokitesvara, Nam-myoho-renge-kyo, Vajrayogini), Chakra Mastery, Sacred Union in Tantra, Beyond Sex (+Dutch, Spanish), Unleashing the Inner Fire / Tummo (+German, Spanish, French), Edenic Origins (+German, Spanish), Miracles of the Masters of Yoga (+Spanish), Mo Pai and Internal Alchemy (+Spanish), the gnostic and apocrypha titles (Gnostic Gospels, Lost Wisdom, Revelations of Mary, Quotes of Yeshua, Acts of Peter, Apocalypse of Eve, Apocalypse of Peter, Apocryphon of John, Esdras, Additions to Esther, Maccabees, Apocalypse of Adam Part II). TSP Ravshiva: Archons Unveiled I-4, two overthinking guides, Siddhis: The Non-Locality of Consciousness.

## Unresolved discrepancies (owner decisions; nothing was merged or guessed)
1. **Kleem Mantra**: the website lists "Make Yourself Irresistibly Attractive with the Kleem Mantra" (TSPRav Shiva) plus Spanish, German and French editions; the catalogue's existing work is the longer "…Kleem Mantra, Kamdev Mantra and Kama Sutra". One book or two? The Kleem-only listing and its three translations are held back until you say.
2. **Brahmastra: Weapon of God** (Rav Shiva) vs the catalogue's **Weapons of the Gods** (which uses the brahmastra.png artwork). Same book or two? Both are kept, flagged.
3. **Maha Mrityunjaya** and **Lakshmi Gayatri** each appear under more than one title/author (Forbidden Mantra Press, Rav Shiva, Emily K Patel): kept as separate works, flagged.
4. **Mo Pai**: "La mecánica interna del cultivo de la energía" (Spanish) is attached to Mo Pai and Internal Alchemy as a guess-free pairing flagged for confirmation. "The Hidden Doctrine of Mo Pai" and "Mo Pai Internal Alchemy" cover files exist in Wix media but no listing for the former was visible.
5. **Beyond Sex** appears twice in English (one with the "How To Series" suffix): shown as one edition.
6. **Authors**: "Emily Patel" is treated as Emily K Patel; "Rav Shiva", "TSPRav Shiva" and "TSP Ravshiva" remain separate names; one byline reads "Ravi A. Kissoon" (not added). Whether these are one author identity is the owner's call.
7. **Formats, ASINs, dates, publisher lines**: none recovered for any new entry (shown as ebook, unconfirmed).

## Added in the second pass (categories you named)
- Muslim Prayer (imprint shown: Muslim Prayer Press, so not counted as press titles): Ruqyah's for Wealth (Abdur Rehman), Ruqyah's for Wealth in Arabic Language (Abdur Rehman; flagged as a possible duplicate, not merged), JINN - Dark Angels, Shapeshifters, and Ghouls (TSPRav Shiva).
- Comics (new department "Comics & Humor"): Enlightened Silly Comic Strips and Enlightened Silly Comics (Rav Shiva; flagged as possible duplicates of each other).
- Children's (new department "Children's Books"): Benny the Brave and the Shimmering Night (author kept as printed, "Emily Patel").
- Health: Forbidden Fruit and Forbidden Practices (added in the first pass, flagged).
- Kleem: the Kleem-only English title with its German and French editions was added as its own work and flagged as a POSSIBLE DUPLICATE of the existing combined-title work; the Spanish edition stays on the existing work.
- Spanish, Dutch and Portuguese titles whose English base title was not seen were added as their own works: La Joya del Loto, Más allá del sexo (flagged: may duplicate the Spanish edition of Beyond Sex), Schepping en verbinding, Revelando los misterios de El evangelio de Pedro (es and pt), Los pensamientos son mantras.

## Still not added
Three Hindi and two Chinese titles (illegible in the screenshots) and the cut-off last row (The Book of Jubilees, The Book of Vedic Spells, The Catalyst, The Code of Immortality, The Complete Dream & Consciousness, The Coven and the Yogi, and its sequel).

## Source of the full list
The live bookstore page loads its list from the owner's own `catalog` table on a Supabase host (`heakpxpkzzvwfiebrirc.supabase.co`), through the public read key that the page itself uses. That host is not on the network allow-list, so the complete list, ASINs, formats and exact titles could not be read. Allowing it would let this inventory be completed exactly instead of from screenshots.

## Covers (updated after `static.wixstatic.com` was allowed)
Recovered from the owner's Wix Media Manager (and one from Drive) and published to `data/covers.json` with the owner's recorded rights, each matched to its exact edition: **20 original covers**. Total valid covers is now **90**: 12 earlier, 58 Penguin Random House, and these 20.

| Work | Edition | Cover file (what the cover reads) |
|---|---|---|
| The Apocalypse of Adam | English paperback (ed2) | TheApocalyseofAdamCover.png ("The Apocalypse of Adam, Emily Patel"); portrait art, so not assigned to the audiobook |
| The Apocalypse of Eve; The Apocalypse of Peter | English | clean 1024px / 800px files |
| The Ancient Science of Kundalini Energy Revealed | English | exact title and subtitle |
| Mo Pai and Internal Alchemy | English | "The Hidden Technology of Human Power" tagline |
| Mo Pai: The Destructive and Healing Force Within | French, Spanish | French and Spanish covers (the Spanish file carries a small sparkle mark as supplied) |
| Gayatri Mantra | English ebook | clean 1024x1536 file; replaces the defective 331px one |
| Om Namah Shivaya | English, Spanish | Spanish cover wording ("una guía sagrada de práctica") differs from the listing wording; flagged |
| Maha Mrityunjaya Mantra; Lakshmi Gayatri; Miracles of the Masters of Yoga; Edenic Origins (English) | English | matched by cover text and, for Lakshmi, by the owner's screenshot |
| Invoke the Fierce | English (Durga3.png from Drive) and Spanish | the owner's screenshot shows Durga3 on this listing, which settles the earlier "probable" pairing |
| Archons Unveiled, II, III, Part 4 | English | four covers matched by subtitle |

Held (staged in `assets-src/covers-pending/`, listed in `data/drafts/covers-pending.json`): Apocalypse of Adam Part II (grid overlay), the German Das Erscheinen Adams (smear), Energy Unleashed (two 300px listing screenshots with a grid), Mo Pai Exposed (cover subtitle differs from the listing and two ASINs exist), the square Maa Kali files, and covers with no listing seen (Hidden Doctrine of Mo Pai, Matrix of Mantra, Atharva Veda, Dream Journal, The Forbidden Light, Genesis of Sophia, The Secret Knowledge of Adam, The Catalyst).

Not recoverable from the files: covers for the German, Dutch, Welsh and most Spanish editions, and for the Hindi and Chinese titles (no file seen).

Still blocked for the inventory: the live site builds its bookstore from `siteassets.parastorage.com`, `static.parastorage.com` and `www-forbiddenmantra-com.filesusr.com`, which the network policy does not allow, so the full listing could not be read directly.

## Highlights
`data/highlights.json` drives the new "Featured from Forbidden Mantra Press" shelf (The Apocalypse of Adam and the Mo Pai books first) and the "Mo Pai Collection" shelf. No sales evidence is on file, so every label reads "Featured". Add works to `bestsellerEvidence` only with owner-provided sales evidence; the heading and labels then switch to "Bestseller" for those works.
