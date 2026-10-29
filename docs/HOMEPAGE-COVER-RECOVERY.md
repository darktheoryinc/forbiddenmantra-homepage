# Homepage cover recovery (34 books)

Result: **0 of 34 covers could be added legitimately in this pass.** Not because the covers do not exist, but because every legitimate source needs something only the owner or a publisher can give. Nothing was added, substituted, generated or scraped; `data/covers.json` still has 99 covers. Not rebuilt, not deployed.

## What was searched (this pass)
| Source | Result |
|---|---|
| Repository: `assets-src/covers`, `covers-opt`, `covers-pending`, `partner`, `logo`, `librarian` | All 34 searched by slug and title words. The only relevant file is the Mo Pai Exposed candidate below. |
| Git history, all branches (image files ever committed, excluding generated `site/`, `wix/`, `test/`) | No image for any of the 34 was ever committed. |
| Catalogue metadata (`data/catalogue.json`, `data/covers.json`, `data/drafts/covers-pending.json`) | No cover file, URL or reference for any of the 34 (the only `cover_url` values are Amazon-hosted and not used). |
| Previously exhausted: Wix media, Google Drive, owner's Supabase table | Not repeated. |

## Why the public cover images cannot be used yet
* **Penguin Random House**: the site's rights basis is PRH's published bookseller terms (read again today): files may be used "in promoting Penguin Random House titles". PRH's image server also returns files for ISBNs of other publishers (Shambhala, Hachette, HarperCollins, Wiley, Oxford and others). Those are not PRH titles, so the terms do not cover them. I fetched them only to test availability, discarded them, and used none. None of the 34 books is from a PRH-owned imprint (the one Bantam/Spectra edition returned PRH's generic "no image" file).
* **Amazon listings / publisher sites**: Amazon's cover images are licensed through its API, which needs credentials and an approved account; copying them from product pages is not permitted. Publisher sites require the publisher's permission for commercial display.
* **Open Library**: reachable now, but its covers are publishers' artwork uploaded by users and the owner has not accepted its terms.
* **Public domain**: none of the 34 catalogued editions has a public-domain cover (The Golden Bough text is old, but the catalogued edition is Oxford World's Classics, 2009; a different edition's cover is not allowed by the one-cover-one-edition rule).

## The 34, by what each needs
**A. Owner-supplied artwork (5 books: 2 Press titles + 3 probable pen-name titles)**
| Book | Status |
|---|---|
| Mo Pai Exposed | Candidate exists, edition match unresolved (below). |
| The Inner Mechanics of Energy Cultivation | No file anywhere. Needs the owner's cover files: English ebook B0H3MY3JS3, hardcover 9798199638562, Spanish B0H3NV7ZVS, Hindi B0H44YW832. |
| The Cyber Cupid (Alex Knight), The Power of Fasting and Prayer (Rav Shiva), JINN (TSPRav Shiva) | Probably the owner's own pen names. If so, send the cover files; no permission needed. If not, treat as third-party. |

**B. Third-party publishers (29) need written permission or a licensed feed.** The request text and ISBNs, grouped by publisher, are in `docs/COVER-PERMISSION-REQUESTS.md` (regenerated for the current homepage). Groups: HarperCollins 5, Shambhala 3, Llewellyn 3, Houghton Mifflin Harcourt 3, Hachette 2, Bloomsbury 2, Weiser 2, Aurora 2, and one each for New World Library, Beacon, New Harbinger, Wiley, Acorn, Oxford and Scholastic. Harry Potter needs an edition decision first (US "Sorcerer's Stone" vs UK "Philosopher's Stone"). Requests were not sent: that is outbound contact in the owner's name.

Titles: When Things Fall Apart, The Power of Now, Man's Search for Meaning, The Untethered Soul, When the Body Says No, Comfortable with Uncertainty, I Am That, The Tao of Physics, Wherever You Go There You Are, The Golden Bough, Taoist Secrets of Love, Wicca, Encyclopedia of 5,000 Spells, Harry Potter: A History of Magic, Seventy-Eight Degrees of Wisdom, Buckland's Complete Book of Witchcraft, Modern Magick, Awaken Healing Energy Through the Tao, Chakra Mantras, Tao Te Ching, The Secret of the Golden Flower, Circe, American Gods, A Wizard of Earthsea, Harry Potter and the Philosopher's Stone, The Hobbit, Good Omens, Jonathan Strange & Mr Norrell, The Lion, the Witch and the Wardrobe. (29 titles; with the 5 in section A that makes 34.)

## Mo Pai Exposed: candidate cover, for your approval
File: `assets-src/covers-pending/original/wix-mopai-exposed.png` (from the Wix media library), 1024x1536 RGB, portrait, Forbidden Mantra Press artwork (rights already confirmed by you).
* The cover reads **"MO PAI EXPOSED: Serious Truths About Internal Power Training", Emily K Patel.**
* The public Amazon listing for the ebook (B0GFQ63JSF) is titled "Mo Pai Exposed: **What the Internal Power Community Refuses to Admit**", and your catalogue has an ebook, paperback (B0GFW4H6T2), hardcover (B0GFVWMR9B) and audiobook.
* **The subtitles differ, so I cannot say which edition this artwork is.** It may be an earlier or alternate cover/subtitle. Nothing is assigned.
* Decision needed: (1) which edition(s) this exact cover belongs to (ebook, paperback, hardcover, audiobook), or (2) supply the current front cover. Once you answer, I add it in one step.

## Homepage shelf test
Every shelf was rebuilt and tested: all 27 image paths resolve, 24 works show real covers, the other 34 show the labelled text-only placeholder, and no shelf shows an unrelated or borrowed image (`node test/verify-covers.mjs`, 31 checks pass).
