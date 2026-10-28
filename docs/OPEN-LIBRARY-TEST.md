# Open Library cover test (2026-10-28)

Sample: 16 third-party editions chosen at random (seed 7) with an ISBN-13, plus a title search for each of our 12 own works. Throttled to 1 request/second, no images stored.

| Result | Count |
|---|---|
| Open Library edition record found by ISBN | 16 of 16 |
| Record's ISBN-13 list contains our ISBN (exact edition) | 13 of 16 (3 rejected: Dorian Gray, The Wisdom of No Escape, Tibetan Book of Living and Dying) |
| Exact edition has a cover id | 10 of 13 |
| Cover image downloaded OK in the test | 5 of 10 (the others failed with connection errors or HTTP 502) |
| Own Forbidden Mantra Press works found in Open Library | 0 of 12 |

Rights: Open Library's API pages give usage and rate guidance (non-identified 1 request/second; cover lookups by ISBN limited to 100 requests per IP per 5 minutes; do not use as a backend for high-traffic commercial services) but say nothing that grants reuse rights for the cover artwork, which remains the publisher's. The Internet Archive terms page could not be read. Under `docs/COVERS.md` an Open Library cover is therefore not an accepted source type, so no cover was added to `data/covers.json` and no image was published.
