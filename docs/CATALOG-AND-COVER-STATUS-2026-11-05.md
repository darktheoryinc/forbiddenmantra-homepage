# Final catalogue and cover recovery status (2026-11-05)

Branch `library/final-improvements`. Not deployed. Wix, DNS and Netlify untouched.

## 1. Catalogue verification
* **127 titles shown, 420 editions, no duplicates.** Their 420 ASINs equal the 420 ASINs in the owner's catalogue table (snapshot 2026-10-28): none missing, none extra, none repeated. 127 unique work slugs. Author credits are as in the table (59 Emily K Patel, plus the variants Emily K. Patel and Emily Patel, Rav Shiva, TSP Ravshiva and the other pen names).
* **Limitation:** the live table (`heakpxpkzzvwfiebrirc.supabase.co`) is blocked by this environment's network policy (re-tried 2026-11-05, HTTP 403 from the proxy). The 2026-10-28 snapshot is the only ownership evidence; titles added to the live table since then are not reflected. To close this: export the `catalog` table as CSV and I reconcile it.
* 4 entries stay withheld, not deleted: Mo Pai Nei Kung, The Hidden Technology of Human Power, Forbidden Mantra, and the long Kleem entry (see 3).

## 2. Cover recovery: evidence exhausted
33 of 127 titles show a cover. The other 94 cannot be recovered from any source available to this project:
| Source | Result |
|---|---|
| Repository and all branches, staged files | Checked 2026-10-29 and again today: nothing unpublished beyond the cases in section 3. |
| Wix Media Manager (257 images inventoried 2026-10-29; the 49 cover candidates re-downloaded and hashed today) | All used, staged, or listed in section 3. |
| Google Drive (book-art folder, images) | Checked 2026-10-29: nothing further. |
| Amazon-hosted images / the table's cover URLs | **Not used.** See "Needs your decision" below. |
Nothing was re-downloaded that had already been checked, except the 49 Wix candidates needed to re-hash.

## 3. Discrepancies (nothing assigned or merged without your approval)
| Case | Evidence | Verdict |
|---|---|---|
| `mopai-exposed.png` | Cover: "Mo Pai Exposed: Serious Truths About Internal Power Training", Emily K Patel. Table: "Mo Pai Exposed: What the Internal Power Community Refuses to Admit", Emily Patel; 4 editions (B0GFQ63JSF ebook 2026-01-08, B0GFW4H6T2 paperback, B0GFVWMR9B hardcover, B0H85C85V8 audiobook). The Wix file is dated the same day as the ebook. | **Probably the right artwork, but the subtitle differs, and the edition is unknown.** Approve: which editions get it, or supply the current front cover. |
| `atharvaveda.png` | Cover: "The Atharva Veda: Ancient Spells, Mantras, and Spiritual Practices for Modern Life", The Spiritual Philanthropist Ravshiva. Table: "The Book of Vedic Spells: Ancient Mantras from the Atharva Veda", TSP Ravshiva (B0D11V38H9 audiobook, B0F7G31829 ebook, B0F7R7FJD7 paperback). | **Same author and subject; title differs (earlier or alternate title?).** Cannot be proven from files. Approve or reject. |
| The Matrix of Mantra (`matrix-of-mantra.png`) | Cover author TSPRavshiva. Table has "The Matrix of Sound" by TSPRavshiva (B0H8MKMLT9, B0F9KWD3B8, B0F9LNXF5H). No title "The Matrix of Mantra" in the table. | **Likely an earlier title of The Matrix of Sound; unproven.** Not added as a new title. |
| Dream Journal (`dream-journal.png`) | The table has "The Complete Dream & Conscious Experience Journal (1-Year Edition)", Emily K Patel (hardcover B0H1259BYN, paperback B0H14D7THD). The cover says "Dream Journal ... 366 pages, one year of discovery", no author. | **Already a catalogue title, so no new title is needed; the cover plausibly matches ("1-Year Edition").** Approve and I assign it to the print editions. |
| The Forbidden Light (`forbidden-light.png`) | Cover: "The Forbidden Light: Unlocking the Gayatri Code", Ravshiva. No record in the table or the catalogue; no ASIN. | **Not verified. Not added.** Needs an ASIN or your confirmation it is published. |
| Kleem Mantra duplicate | Long entry: English edition seen on an Amazon page screenshot, no ASIN, author TSPRav Shiva, same artwork as the table's "Make Yourself Irresistibly Attractive with the Kleem Mantra" (TSPRav Shiva, ebook B0BY67Z5QR 2023-03-12). Both carry the Spanish ASIN B0CW19ZHGX. The table has no record of the long title. | **Very likely the same book (same author, series and artwork); the long form is probably Amazon's displayed title.** Not merged or deleted. Approve a merge and I fold the long entry into the short one. |

Ready-to-apply proposals are in `data/drafts/owner-decisions-pending-2026-11-05.json` (not read by the build).

## Needs your decision
1. The six cases above.
2. **Amazon-hosted covers for the other 94.** Amazon Associates Support confirmed that we may self-host our own cover artwork. It is not established that this also permits downloading the files from Amazon's image servers. The Associates licence text read earlier says not to store images obtained from Amazon. Say "go" and name the basis if you want me to retrieve them for your own ASINs; otherwise the compliant routes are KDP "Download author cover file" (print editions), your design files, or your ChatGPT image export (`docs/OWN-COVER-ROUTES.md`). The importer (`scripts/covers-bulk.mjs`) and the front-cover cutter are ready.
