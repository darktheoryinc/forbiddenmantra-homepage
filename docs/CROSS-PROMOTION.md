# Cross-promotion system (first use: IOSutra)

One registry, `data/promos.json`, drives every cross-promotion on this site. `scripts/promo.mjs` renders and validates it and has **no bookstore dependencies**, so another site or product can copy the registry format and that one file.

## What is on the site now
- **Home**: a "Technology & innovation" section introducing IOSutra as *our AI-powered business software platform*, with a separate "Program membership" panel.
- **`/technology/`**: the same card plus an explanation of the membership statement and the trademark notice.
- **Footer (every page)**: one small line naming IOSutra, the membership statement and the no-endorsement line.

## What is deliberately not on the site
| Item | State | Why |
|---|---|---|
| IOSutra link | Shows a dashed "link to be added" placeholder | No IOSutra site could be found by search, and no URL was provided. Set `brands.iosutra.url`. (An unrelated company, Sutra.AI, appears in results; do not use it.) |
| NVIDIA Inception badge | **Not rendered** | No authorised badge file is in the repo and no Inception-specific usage terms were found. NVIDIA's general logo guidance says its marks may not be used beyond what NVIDIA authorises in writing, and that using the logo implies a partnership or endorsement. |
| IOSutra feature copy | Not written | Only "AI-powered business software platform" was provided. Add accurate text in `brands.iosutra.blurb`. |

## The membership claim
Wording on the site: **"IOSutra is a member of the NVIDIA Inception program."** It is recorded as `owner-asserted`: no source I could reach confirms it. Whenever it appears, the registry forces it to travel with: *"This membership applies to IOSutra only. It does not extend to Forbidden Mantra Press or this bookstore, and it does not imply that NVIDIA sponsors or endorses either."* NVIDIA is never described as a partner, sponsor, certifier or technology provider; the validator rejects "powered by NVIDIA", "NVIDIA partner", "NVIDIA-certified", "NVIDIA-backed", "in partnership with NVIDIA", "NVIDIA-approved" and "endorsed by NVIDIA" anywhere in the copy.

## Launch gate
`FM_ENV=production node scripts/build.mjs` **refuses to build** while any of these is open: promo not `approved`; brand has no https `url`; a claim is not `verified`; the trademark wording is `needs-confirmation`. The preview build prints the same items as warnings. Today the production build correctly refuses.

To clear the gate: confirm membership in the Inception member portal, read the terms/licence you accepted for permitted wording and attribution, record the date in the claim's `evidence`/`verifiedOn` and set `status: "verified"`; set the URL; set `approved: true`.

## Adding the badge later (only if authorised)
1. Obtain the badge **from NVIDIA's member resources** and confirm in writing or in the licence that you may use it on this site.
2. Put the unmodified file in `assets-src/partner/`.
3. In `badges.nvidiaInception` set `enabled: true`, `asset`, `licenseConfirmed: true`, `guidelinesUrl`, `guidelinesReviewedOn`.
The build fails unless all of that is true. The badge appears only inside IOSutra's membership panel, at fixed height with automatic width (no distortion), with alt text. It never appears in the bookstore header, footer or beside Forbidden Mantra Press. Do not redraw, recolour, restyle or imitate NVIDIA marks or its green.

## Adding another promotion or site
1. Add a `brands` entry, the `claims` it relies on (each with `status`, `evidence`, `verifiedOn`, optional `prohibitedVariants`), and a `promos` entry with `placements` (`home`, `footer`, `page`).
2. Outbound links get `utm_source=<this site>`, `utm_medium=cross-promo`, `utm_campaign=<promo>`, `utm_content=<placement>` so each surface can be measured.
3. For another site, copy `scripts/promo.mjs` and a registry with that site's `site` block.

## Not done
- No analytics or click reporting is wired; UTM tags only.
- Section text is English only and stays English when the website language changes (legal wording is not machine-translated).
- Nothing is deployed.

## Tests
`node test/verify-promo.mjs` (66 checks): exact wording; separation statement wherever the membership appears; NVIDIA named only in approved strings on all pages; no logo/asset/NVIDIA green; no invented domain; production gate refuses today; temporary registries prove the badge gate (missing asset, unconfirmed licence, missing guidelines review, fully authorised test asset byte-identical), UTM tagging, https-only, banned-wording lint; desktop/mobile layout, contrast >= 4.5:1, no overflow; footer size and link; language switching leaves the legal wording in English.
