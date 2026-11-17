# MyMindSet

Mobile-first PWA for stand-up comedians: **record a ramble → find the jokes → build a set → rehearse → log the show.**
Self-contained in this folder; it does not touch the rest of the repo.

## Run

```bash
cd mymindset
npm install
cp .env.example .env     # optional: add transcription / LLM endpoints
npm run dev              # web on :5173, API on :8787
# or production-style (single port):
npm run build && npm start   # http://localhost:8787
npm test                 # unit/integration tests
node tests/e2e.cjs       # browser walk-through against a running server (needs Playwright)
```

## Stack
Vite + React 19 + TypeScript, Dexie (IndexedDB) for jokes/sets/recordings/audio, dnd-kit for drag-reorder, vite-plugin-pwa (installable, offline shell), Hono + zod server for anything needing secrets or cross-origin fetches, Vitest.

## What is real vs. needs configuration
| Feature | Status |
|---|---|
| Recording, storage of original audio, rename/delete, download | Works (browser MediaRecorder, stored in IndexedDB) |
| Transcription | **Needs** `TRANSCRIBE_API_URL` (any OpenAI-compatible `/audio/transcriptions`, incl. self-hosted whisper). Otherwise paste/type a transcript. |
| Joke discovery: local pattern finder | Works offline. Rule-based, **not AI**; excerpts are verbatim, suggested structure/transitions are labeled. |
| Joke discovery: AI | **Needs** `LLM_API_URL` + `LLM_MODEL` (any OpenAI-compatible chat endpoint). Tested end to end with a free local model via Ollama (`qwen2.5:3b`). Falls back to the offline finder automatically if the model fails. Keys stay on the server. |
| Vault, Set Builder, versions, Stage/Rehearsal, Performance history | Works |
| Laugh markers (live in Stage, or tapped during playback), per-bit hit/OK/miss after each show, long-bit warnings | Works |
| Import notes (.txt/.md/.csv or paste), JSON backup + restore, notebook photos attached to jokes | Works. Photos are **not** OCR'd. |
| Cloud sync | Not built (needs a hosted backend) |
| Trend Radar | Works with live Google News RSS (no key); shows source + date; errors rather than fabricating |
| Auth | Optional shared `APP_ACCESS_TOKEN` gate on the API. No per-user accounts/cloud sync yet. |

## Providers
`src/ai/types.ts` defines `AnalysisProvider` / `TranscriptionProvider`. Add a provider by implementing the interface and registering it in `src/ai/service.ts`.

## Free local AI (Ollama)
```bash
# install Ollama (https://ollama.com), then:
ollama pull qwen2.5:3b                       # ~1.9 GB download; ~3-4 GB RAM; CPU-only works (4+ cores)
OLLAMA_CONTEXT_LENGTH=8192 ollama serve
# in mymindset/.env:
LLM_API_URL=http://localhost:11434/v1/chat/completions
LLM_MODEL=qwen2.5:3b
```
Then Settings → "AI analysis (server model)". A 600-word ramble takes roughly 1-2 minutes on a 4-core CPU; a GPU is much faster.

### How the AI is kept honest
- The model never returns joke text. It **points at numbered sentences**; the server cuts every excerpt, setup and punchline out of the real transcript, so your words can't be paraphrased or invented.
- The only model-written text is short **transitions** and one-line **connection notes**, always labeled AI. Transitions must be neutral bridges (no copying your lines, no speaking as you); connections must quote your real words from both bits.
- Callbacks are verified to literally occur in every bit they link. Anything invalid is dropped, not repaired.
- If the model is unreachable, slow, or returns junk, the offline pattern finder runs and the run records why.
- `npm run test:live` (with `LIVE_LLM_URL` / `LIVE_LLM_MODEL`) checks these guarantees against a real model.
