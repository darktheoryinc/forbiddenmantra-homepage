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
| Joke discovery: LLM | **Needs** `LLM_API_URL` + `LLM_MODEL` (any OpenAI-compatible chat endpoint, incl. Ollama). Keys stay on the server. |
| Vault, Set Builder, versions, Stage/Rehearsal, Performance history | Works |
| Laugh markers (live in Stage, or tapped during playback), per-bit hit/OK/miss after each show, long-bit warnings | Works |
| Import notes (.txt/.md/.csv or paste), JSON backup + restore, notebook photos attached to jokes | Works. Photos are **not** OCR'd. |
| Cloud sync | Not built (needs a hosted backend) |
| Trend Radar | Works with live Google News RSS (no key); shows source + date; errors rather than fabricating |
| Auth | Optional shared `APP_ACCESS_TOKEN` gate on the API. No per-user accounts/cloud sync yet. |

## Providers
`src/ai/types.ts` defines `AnalysisProvider` / `TranscriptionProvider`. Add a provider by implementing the interface and registering it in `src/ai/service.ts`.
