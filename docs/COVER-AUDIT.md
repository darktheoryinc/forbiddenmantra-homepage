# Cover audit (2026-10-27)

Source of truth: `data/covers.json` (manifest) checked against `data/catalogue.json`. Regenerate with `node scripts/covers.mjs audit`. Per-edition detail: `data/cover-audit.csv`.

| | |
|---|---|
| Books (works) | 192 |
| Editions | 223 |
| **Authentic covers added and verified** | **0** (0 books) |
| Editions still missing a cover | 223 |
| Editions with an ISBN-13 (can be matched exactly) | 207 |
| Editions without an ISBN-13 | 16 |
| Own Forbidden Mantra Press editions | 16 (0 with cover) |

## Why none have been added yet
* No cover file exists anywhere in the project or was supplied, and covers were deliberately never copied from retailers or scraped.
* This environment cannot reach Open Library, Google Books, Amazon, publisher sites or archive.org (every connection is refused), so no cover could be fetched or checked even from permitted sources.
* A cover is copyrighted artwork. The only routes that are legally clean are: (1) files **you** own (all own-title covers), (2) **publisher permission** (press/media kits or written licence), (3) a **licensed feed**, (4) public-domain editions. Open Library's cover service and Amazon's product API each have their own terms and are not used without your decision and, for Amazon, your Associates API credentials.

## Own titles (priority)
| Title | Format | Identifier on record | Status | Needed |
|---|---|---|---|---|
| The Apocalypse of Adam | audiobook | ASIN B0H8MQN9WK | missing | cover file for this audiobook edition from the owner (and its ISBN/ASIN, to prove the match) |
| The Apocalypse of Adam | paperback | no identifier on record | missing | cover file for this paperback edition from the owner (and its ISBN/ASIN, to prove the match) |
| Gayatri Mantra | audiobook | ASIN B0H8MDVC72 | missing | cover file for this audiobook edition from the owner (and its ISBN/ASIN, to prove the match) |
| Gayatri Mantra | ebook | no identifier on record | missing | cover file for this ebook edition from the owner (and its ISBN/ASIN, to prove the match) |
| Kebra Nagast | paperback | no identifier on record | missing | cover file for this paperback edition from the owner (and its ISBN/ASIN, to prove the match) |
| Kebra Nagast | ebook | no identifier on record | missing | cover file for this ebook edition from the owner (and its ISBN/ASIN, to prove the match) |
| Weapons of the Gods | paperback | no identifier on record | missing | cover file for this paperback edition from the owner (and its ISBN/ASIN, to prove the match) |
| Weapons of the Gods | ebook | no identifier on record | missing | cover file for this ebook edition from the owner (and its ISBN/ASIN, to prove the match) |
| Maha Mrityunjaya Mantra | ebook | no identifier on record | missing | cover file for this ebook edition from the owner (and its ISBN/ASIN, to prove the match) |
| Invoke the Fierce | ebook | no identifier on record | missing | cover file for this ebook edition from the owner (and its ISBN/ASIN, to prove the match) |
| Lakshmi Gayatri | ebook | no identifier on record | missing | cover file for this ebook edition from the owner (and its ISBN/ASIN, to prove the match) |
| Om Namah Shivaya | ebook | no identifier on record | missing | cover file for this ebook edition from the owner (and its ISBN/ASIN, to prove the match) |
| Maa Kali Mantras and Instructions | ebook | no identifier on record | missing | cover file for this ebook edition from the owner (and its ISBN/ASIN, to prove the match) |
| Mo Pai Nei Kung | paperback | no identifier on record | missing | cover file for this paperback edition from the owner (and its ISBN/ASIN, to prove the match) |
| The Hidden Technology of Human Power | paperback | no identifier on record | missing | cover file for this paperback edition from the owner (and its ISBN/ASIN, to prove the match) |
| Forbidden Mantra | paperback | no identifier on record | missing | cover file for this paperback edition from the owner (and its ISBN/ASIN, to prove the match) |

## Third-party editions by publisher (where a permission request would go)
| Publisher | Editions needing a cover |
|---|---|
| Penguin Classics | 23 |
| Llewellyn | 11 |
| Shambhala | 9 |
| Weiser Books | 8 |
| Bantam | 7 |
| HarperOne | 7 |
| Bloomsbury | 5 |
| Vintage | 5 |
| William Morrow Paperbacks | 4 |
| Ace | 4 |
| (publisher not recorded) | 4 |
| Mariner Books | 4 |
| Tor Books | 4 |
| Oxford University Press | 4 |
| HarperCollins | 3 |

## How a cover gets in
1. You (or a publisher) supply the exact image file for one edition.
2. `node scripts/covers.mjs add --work SLUG --edition ID --file PATH --source-type owner-supplied --source "where it came from" --rights "why we may use it" --confirmed-by "your name"` (plus `--isbn13` for editions with an ISBN-13, or `--match-evidence` where there is none).
3. The script refuses a cover whose ISBN does not match that edition, strips metadata, makes 240 px and 480 px WebP copies, and records the rights evidence. The build shows the image, and the security gate refuses any cover file that is not in the manifest with its rights recorded.
