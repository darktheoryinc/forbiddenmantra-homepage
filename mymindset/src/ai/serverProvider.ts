import { apiFetch } from '../lib/api'
import type { AnalysisProvider, AnalysisResult } from './types'
import { alternateSplit, suggestTransition } from './heuristic'

/** Calls the MyMindSet server, which holds the LLM endpoint/credentials (e.g. a local Ollama model). Only usable when the server reports it configured. */
export const serverProvider: AnalysisProvider = {
  id: 'server-llm',
  label: 'AI analysis (server model)',
  origin: 'ai-suggested',
  description: 'Sends the transcript to the model configured on your MyMindSet server (for example a local Ollama model). The model only points at your words; it never writes jokes. Its transitions and notes are labeled AI. If it fails, the offline finder runs instead.',
  analyze: ({ transcript }) =>
    apiFetch<AnalysisResult>('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }),
    }),
  // Setup/punchline re-splits stay local and deterministic (the split is always your own words).
  regenerate: async ({ excerpt, variant }) => alternateSplit(excerpt, variant),
  // New transitions come from the model; fall back to a template if it is unavailable.
  suggestTransition: async ({ from, to, variant }) => {
    try {
      return (await apiFetch<{ text: string }>('/api/transition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, variant }) })).text
    } catch { return suggestTransition(from, to, variant) }
  },
}
