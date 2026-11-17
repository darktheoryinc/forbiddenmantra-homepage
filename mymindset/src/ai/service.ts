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
  fallback?: { from: string; reason: string },
): Promise<{ runId: string; suggestions: Suggestion[]; routines: RoutineSuggestion[] }> {
  const runId = uid()
  const run: AnalysisRun = {
    id: runId, recordingId, provider: provider.id, createdAt: Date.now(), themes: result.themes, callbacks: [],
    model: result.meta?.model, warnings: result.meta?.warnings, ms: result.meta?.ms,
    fallbackFrom: fallback?.from, fallbackReason: fallback?.reason,
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
    closerSuggestionId: r.closerIndex !== undefined ? suggestions[r.closerIndex]?.id : undefined, closerWhy: r.closerWhy,
    origin: provider.origin, status: 'pending',
  }))
  run.connections = (result.connections ?? []).map((c) => ({ a: suggestions[c.a]?.id, b: suggestions[c.b]?.id, why: c.why, aQuote: c.aQuote, bQuote: c.bQuote })).filter((c) => c.a && c.b)
  await d.transaction('rw', [d.suggestions, d.routines, d.runs], async () => {
    await d.suggestions.where('recordingId').equals(recordingId).and((s) => s.status !== 'accepted').delete()
    await d.routines.where('recordingId').equals(recordingId).and((r) => r.status !== 'accepted').delete()
    await d.runs.add(run)
    await d.suggestions.bulkAdd(suggestions)
    await d.routines.bulkAdd(routines)
  })
  return { runId, suggestions, routines }
}

export interface AnalyzeOutcome { provider: Pick<AnalysisProvider, 'id' | 'label'>; count: number; fallbackReason?: string; warnings: string[] }

/**
 * Runs the selected provider. If an AI provider fails for any reason (not configured, unreachable,
 * timeout, malformed output) the offline rule-based finder runs instead and the run records why.
 */
export async function analyzeRecording(recordingId: string, d: MindSetDB = db, chosen?: AnalysisProvider): Promise<AnalyzeOutcome> {
  const rec = await d.recordings.get(recordingId)
  if (!rec) throw new Error('Recording not found')
  if (rec.transcript.trim().length < 10) throw new Error('Add or paste a transcript first (at least a sentence).')
  const provider = chosen ?? (await activeProvider())
  let result: AnalysisResult
  let used: AnalysisProvider = provider
  let fallback: { from: string; reason: string } | undefined
  try {
    result = await provider.analyze({ transcript: rec.transcript })
  } catch (e) {
    if (provider.id === heuristicProvider.id) throw e
    fallback = { from: provider.id, reason: (e as Error).message || 'AI analysis failed' }
    used = heuristicProvider
    result = await heuristicProvider.analyze({ transcript: rec.transcript })
  }
  const out = await storeAnalysis(recordingId, result, used, d, fallback)
  return { provider: used, count: out.suggestions.length, fallbackReason: fallback?.reason, warnings: result.meta?.warnings ?? [] }
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
