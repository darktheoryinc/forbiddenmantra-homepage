import { apiFetch } from '../lib/api'
import type { AnalysisProvider, AnalysisResult } from './types'
import { alternateSplit, suggestTransition } from './heuristic'

/** Calls the MyMindSet server, which holds the LLM credentials. Only usable when the server reports it configured. */
export const serverProvider: AnalysisProvider = {
  id: 'server-llm',
  label: 'AI analysis (server)',
  origin: 'ai-suggested',
  description: 'Sends the transcript to the AI provider configured on your MyMindSet server. Suggestions are labeled AI-generated.',
  analyze: ({ transcript }) =>
    apiFetch<AnalysisResult>('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }),
    }),
  // Per-item regeneration reuses the local structural tools; the whole-recording run is what calls the model.
  regenerate: async ({ excerpt, variant }) => alternateSplit(excerpt, variant),
  suggestTransition: async ({ from, to, variant }) => suggestTransition(from, to, variant),
}
