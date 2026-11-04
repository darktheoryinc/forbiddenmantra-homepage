# Forbidden Mantra Press redesign (branch `redesign/forbiddenmantra-emerald`)

Based on `main` at `83ae92e6a2ca5953f0a27e4c9a6dc7dde5a5bc7f` (the original). The original files are untouched; everything new is under `redesign/`.

| File | Purpose |
|---|---|
| `build.mjs` | builds the redesigned embed from the ORIGINAL `forbiddenmantra-homepage.html` (only the 3 pasted Markdown fence lines are removed; all new markup carries `data-fm-new`) |
| `theme.css` | emerald, cream and gold theme, appended after the original styles (delete the `fm-redesign` block to return to the old look) |
| `header.html`, `nav-item.html`, `footer-notice.html`, `embed.js` | the new header features, footer notice and behaviour |
| `config.json` | the two destinations (Library address, Pay As You Go address), both **empty** |
| `assets-src/` | Atma face (crop of `librarian.webp`), IOSutra logo panel, official NVIDIA badge |
| `velo/page-code.js` | corrected Velo snippet |
| `dist/forbiddenmantra-homepage.redesign.html` | the deliverable embed code |
| `verify.mjs` | 34 automated checks |
| `previews/` | before and after screenshots |
| `STYLE-GUIDE.md`, `WIX-IMPLEMENTATION.md` | styling guide and Wix steps |

Build: `node redesign/build.mjs`. Verify: `FM_LIBRARY_DIR=<unzipped library preview> AXE_PATH=<axe.min.js> node redesign/verify.mjs`.

## Asset provenance (all existing; none created)
* `assets-src/atma-face.webp`: crop (172,0,342,170) of `librarian.webp` (sha256 `ef956e5e…`), resized to 128 px. The character is the owner-supplied Digital Librarian (Atma).
* `assets-src/iosutra-logo-panel.webp`: owner-supplied IOSutra panel, unmodified, sha256 `d494859b…`.
* `assets-src/nvidia-inception-badge.svg`: official NVIDIA Inception badge, unmodified, sha256 `d2f1fc25…`.
