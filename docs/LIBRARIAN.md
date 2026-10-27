# Digital librarian (Phase 1)

A small animated guide ("Digital librarian") in the bottom-right corner of every page. Files: `scripts/assets/librarian.js`, styles at the end of `scripts/assets/style.css`, config `data/librarian.json`, art `assets-src/librarian/librarian.webp`.

## What she does
* **Character:** the owner-supplied *Welcoming Futuristic Lotus Android* image, downscaled to 560x840 (75 KB WebP, transparent). It is not redrawn. Her head is a clipped copy of the same image so it can nod and sway on its own; two skin-toned lids drawn over the eyes produce blinking; a soft glow over the chest lotus pulses; the open hand gives off a light when she greets or presents.
* **Motion:** breathing, head sway, random blinks, a greeting on arrival, a head tilt while you focus a search box, a turn toward the holographic display while she searches, and a welcoming pose with a light at her open hand when results arrive. All motion is CSS and is removed under `prefers-reduced-motion` (the poses remain, the animation does not).
* **Real search:** she loads the same chunk index as the search page (`assets/idx/manifest.js` + `cNN.js`) the first time you focus a search box, then matches title, subtitle, author, subject and hidden search keywords: exact matches first (title matches ranked highest, our own books first on ties), close spellings if nothing matches exactly. She shows up to 4 books, up to 3 authors and a link to the full results. Nothing is invented: a query with no match says so. Typing in **any** `name="q"` field (hero, header, filters, search page) drives her, and `search/?q=` is searched on arrival.
* **Out of the way:** on screens 700 px and wider she opens by herself at load (floating panel, bottom right, original greeting, Minimize button); on narrower screens she starts as a small round button showing her face. A panel she opened by herself tucks away into that button when the visitor scrolls on, so she does not sit over page content. *Minimize* (button or `Esc`) and the button are the visitor's own choices and are remembered (`localStorage` key `fm-librarian`); the footer link hides or restores her entirely.
* **Accessibility:** results are announced through a polite live region; every control and link is keyboard reachable; focus moves to the small button when she minimizes; the animated figure is `aria-hidden`; her text is marked `lang="en"` (see limitations).
* **Cost and privacy:** no microphone, no AI, no network calls other than the site's own static files; nothing recurring.

## Extension points (inactive)
`window.FMLibrarian`
* `submitQuery(text, { source })`: the single entry point for a query. A future **voice** module should request the microphone only after a user click, transcribe, and call `submitQuery(text, { source: 'voice' })`. `data/librarian.json` `voice.enabled` is read into `FMLibrarian.voice.enabled`; no recogniser is loaded.
* `setAnswerProvider(fn)`: a future **AI librarian** registers `fn(query, topBooks) -> { text } | Promise`. When registered, its text replaces the status line after the real results are shown. The grounding rule: it must only talk about the `topBooks` it is handed. No provider is registered and no API key or SDK exists in the repository.
* DOM event `fm:librarian` on `document`: `{ query, total, done, slugs }` after each search, for analytics or other modules.
* `setMode('open' | 'min' | 'off')`, `getState()`.

## Tuning the art
Percent coordinates in `data/librarian.json` `art`: `eyes[]` (centre x/y and size of each lid), `head` (`clipBottom` = chin/neck line, `pivotY`), `emblem`, `hand`. Swap the image by replacing the WebP and re-measuring.

## Limitations
* English only (the site UI is multilingual; her sentences are not translated).
* The head layer is a clipped duplicate, so very large head rotations would show the neck seam; movement is kept to about ±3°. A layered/rigged export of the character would allow richer gestures (arm wave, real head turn).
* Searches run only after the index is downloaded (one small file now; progressive at scale). On a 25,000-book catalogue the first query loads every index chunk, the same cost as the search page.
* Fuzzy matching is single-edit and only runs when nothing matches exactly.
* She presents titles and authors only; no covers, prices or availability.
* Image rights/likeness: the owner supplied the art; confirm licence for web use.

## Roadmap status
* Phase 1 (done, this branch): animated librarian beside real catalogue search, minimize/hide, reduced motion.
* Placement: the figure sits at the bottom right of every page and responds to the search boxes (hero, header, filters, search page). A variant docked directly beside the homepage search field is a possible later layout change.
* Phase 2 (not started): microphone search via `FMLibrarian.submitQuery(text, { source: 'voice' })`.
* Phase 3 (not started): AI answers via `FMLibrarian.setAnswerProvider(fn)`; no paid API is configured.
