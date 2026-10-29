# Own-cover recovery pass (2026-10-29)

Goal: recover as many of our 413 Forbidden Mantra Press edition covers as possible from files we already have access to, with no manual downloads. Nothing was deployed; production untouched.

## What was inspected
| Source | Method | Result |
|---|---|---|
| Repository and Git history (all branches) | Image blobs ever committed, hashed and compared | Nothing beyond the 36 own + 63 PRH covers already published. |
| `assets-src/covers-pending` (20 staged files) | Re-read each | All still blocked (grid or smear defects, or an unresolved edition). |
| Wix Media Manager, Forbidden Mantra Press site | Re-listed every folder (257 image files, up from the 49 first inventoried), downloaded and hashed every candidate | 48 of the earlier 49 are already published or staged. **1 new cover recovered: Unleashing the Inner Fire (English ebook B0C5ZZ9GHB).** The rest are AI social images, product photos, incense-list screenshots or banners. |
| Wix Media Manager, Spiritual Expression site | Listed (106 images) | All square social or product images; no covers. |
| Google Drive (owner's images, plus the book-art folder in full) | Listed the folder, downloaded and hashed 25 candidates | All already published, staged, or unusable: the Spanish "Orígenes Edénicos" draft still reads "AQUÍ VA EL SUBTÍTULO"; an Archons Part 4 draft lacks the published subtitle; a square "The Coven and The Yogi" (1024x1024, no author) has no edition evidence and is not cover-shaped. |

**Net: +1 cover (100 in total; 37 of 413 owned editions; 31 of 123 Press works).** 92 Press works still have no cover.

## What the existing files cannot give us
The 92 remaining Press works were never saved as files in any location available to this project (Wix, Drive, repository, history). Their covers exist only on Amazon, uploaded through KDP.

## The one remaining automatic route (needs the owner's decision)
The owner's own catalogue table lists Amazon image addresses for his own ASINs, and Amazon's image host answers from here. Test results (headers only, nothing stored): ebook, paperback and hardcover ASINs return a cover image of roughly 40 KB; the audiobook ASIN returns a one-pixel placeholder. 89 of the 92 missing Press works (238 non-audiobook editions) have such an ASIN; 3 (Mo Pai Nei Kung, The Hidden Technology of Human Power, Forbidden Mantra) have none.
* These are the owner's own cover artwork, so the rights are his. But the images would be retrieved from Amazon's servers, and an earlier owner instruction (and the policy findings in `docs/AMAZON-COVERS.md`) says not to download or re-host Amazon-hosted images without confirmed authorization. **I have not done this.**
* If the owner confirms, it is mechanical: map each ASIN to its edition, import with the existing validated bulk importer as `owner-supplied`, keep one cover per edition (no reuse across formats without confirmation), and verify visually.
