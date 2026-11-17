import { db, getSettings, uid, createJoke, type MindSetDB } from '../lib/db'
import type { AnalysisProvider, AnalysisResult } from './types'
import { heuristicProvider } from './heuristic'
import { serverProvider } from './serverProvider'
import type { AnalysisRun, RoutineSuggestion, Suggestion } from '../lib/types'

export const providers: Record<string, AnalysisProvider> = {
  local: heuristicProvider,
  server: serverProvider,
}

export async function activeProvider(): Promise<AnalysisProvider> {
  const s = await getSettings()
  return providers[s.analysisProvider] ?? heuristicProvider
}

/** Persist an analysis. Replaces earlier *pending* suggestions for the recording; accepted ones (and their jokes) are kept. */
export async function storeAnalysis(
  recordingId: string, result: AnalysisResult, provider: Pick<AnalysisProvider, 'id' | 'origin'>, d: MindSetDB = db,
): Promise<{ runId: string; suggestions: Suggestion[]; routines: RoutineSuggestion[] }> {
  const runId = uid()
  const run: AnalysisRun = {
    id: runId, recordingId, provider: provider.id, createdAt: Date.now(), themes: result.themes, callbacks: [],
  }
  const suggestions: Suggestion[] = result.bits.map((b, i) => ({
    id: uid(), recordingId, runId, kind: b.kind, excerpt: b.excerpt, start: b.start, end: b.end,
    setup: b.setup, punchline: b.punchline, themes: b.themes, confidence: b.confidence, rationale: b.rationale,
    origin: provider.origin, status: 'pending', order: i,
  }))
  run.callbacks = result.callbacks.map((c) => ({ phrase: c.phrase, suggestionIds: c.bitIndexes.map((i) => suggestions[i]?.id).filter(Boolean) }))
  const routines: RoutineSuggestion[] = result.routines.map((r) => ({
    id: uid(), recordingId, runId, title: r.title, theme: r.theme,
    suggestionIds: r.bitIndexes.map((i) => suggestions[i].id), transitions: r.transitions,
    origin: provider.origin, status: 'pending',
  }))
  await d.transaction('rw', [d.suggestions, d.routines, d.runs], async () => {
    await d.suggestions.where('recordingId').equals(recordingId).and((s) => s.status !== 'accepted').delete()
    await d.routines.where('recordingId').equals(recordingId).and((r) => r.status !== 'accepted').delete()
    await d.runs.add(run)
    await d.suggestions.bulkAdd(suggestions)
    await d.routines.bulkAdd(routines)
  })
  return { runId, suggestions, routines }
}

export async function analyzeRecording(recordingId: string, d: MindSetDB = db) {
  const rec = await d.recordings.get(recordingId)
  if (!rec) throw new Error('Recording not found')
  if (rec.transcript.trim().length < 10) throw new Error('Add or paste a transcript first (at least a sentence).')
  const provider = await activeProvider()
  const result = await provider.analyze({ transcript: rec.transcript })
  if (!result.bits.length) {
    await storeAnalysis(recordingId, result, provider, d)
    return { provider, count: 0 }
  }
  const out = await storeAnalysis(recordingId, result, provider, d)
  return { provider, count: out.suggestions.length }
}

/** Accept a suggestion into the Joke Vault. The comedian's (possibly edited) text becomes the joke; the verbatim excerpt is retained for provenance. */
export async function acceptSuggestion(id: string, category = 'Observational', d: MindSetDB = db) {
  const s = await d.suggestions.get(id)
  if (!s) throw new Error('Suggestion not found')
  if (s.status === 'accepted' && s.acceptedJokeId) return s.acceptedJokeId
  const text = (s.userText ?? s.excerpt).trim()
  const joke = await createJoke({
    text, setup: s.setup, punchline: s.punchline, category,
    tags: s.themes.slice(0, 3), status: 'idea',
    // The excerpt is the comedian's own words; only text a model paraphrased (not found verbatim) counts as AI-generated.
    origin: s.start >= 0 ? 'original' : s.origin,
    sourceRecordingId: s.recordingId, sourceExcerpt: s.excerpt,
  }, d)
  await d.suggestions.update(id, { status: 'accepted', acceptedJokeId: joke.id })
  return joke.id
}
