import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { MindSetDB, createRecording, uid } from '../src/lib/db'
import { analyzeRecording, acceptSuggestion, storeAnalysis } from '../src/ai/service'
import { heuristicProvider } from '../src/ai/heuristic'
import type { AnalysisProvider, AnalysisResult } from '../src/ai/types'

const T = 'You ever notice airport pretzels cost eleven dollars? It is flour and regret. I paid it anyway, because I am a coward. My mother hated pretzels, turns out she was right about airports.'

let d: MindSetDB
beforeEach(async () => { d = new MindSetDB(`a-${uid()}`); await d.open() })

const failing = (message: string): AnalysisProvider => ({ id: 'server-llm', label: 'AI', origin: 'ai-suggested', description: '', analyze: async () => { throw new Error(message) } })

const aiResult = (): AnalysisResult => ({
  themes: ['pretzel'],
  bits: [
    { kind: 'observation', excerpt: T.slice(0, 77), start: 0, end: 77, setup: T.slice(0, 50), punchline: T.slice(51, 77), themes: ['pretzel'], rationale: 'AI note: nice escalation' },
    { kind: 'story', excerpt: T.slice(107), start: 107, end: T.length, themes: ['mother'], rationale: 'AI note: callback' },
  ],
  routines: [{ title: 'Pretzels', theme: 'pretzel', bitIndexes: [0, 1], transitions: ['Speaking of pretzels —'], closerIndex: 1, closerWhy: 'Lands the callback' }],
  callbacks: [{ phrase: 'pretzels', bitIndexes: [0, 1] }],
  connections: [{ a: 0, b: 1, why: 'Both blame pretzels.' }],
  meta: { model: 'qwen2.5:3b', chunks: 1, chunksFailed: 0, dropped: 0, warnings: ['Long transcript: analyzed the first 1 of 2 sections.'], ms: 4200 },
})

describe('offline fallback', () => {
  it('falls back to the rule-based finder when the AI provider fails, and records why', async () => {
    const rec = await createRecording({ transcript: T }, d)
    const out = await analyzeRecording(rec.id, d, failing('AI provider timed out after 300s'))
    expect(out.provider.id).toBe('local-heuristic')
    expect(out.fallbackReason).toMatch(/timed out/)
    expect(out.count).toBeGreaterThan(0)
    const run = (await d.runs.where('recordingId').equals(rec.id).first())!
    expect(run.provider).toBe('local-heuristic')
    expect(run.fallbackFrom).toBe('server-llm')
    expect(run.fallbackReason).toMatch(/timed out/)
    const sug = await d.suggestions.where('recordingId').equals(rec.id).toArray()
    expect(sug.every((s) => s.origin === 'heuristic-suggested')).toBe(true)
  })

  it('falls back for an unconfigured server too (501) and for an unreachable one', async () => {
    const rec = await createRecording({ transcript: T }, d)
    for (const msg of ['AI analysis is not configured on this server. Set LLM_API_URL and LLM_MODEL.', 'Could not reach the MyMindSet server. Is it running?']) {
      const out = await analyzeRecording(rec.id, d, failing(msg))
      expect(out.fallbackReason).toBe(msg)
      expect(out.count).toBeGreaterThan(0)
    }
  })

  it('does not fall back when the offline finder is itself chosen, and rejects empty transcripts', async () => {
    const rec = await createRecording({ transcript: T }, d)
    const out = await analyzeRecording(rec.id, d, heuristicProvider)
    expect(out.fallbackReason).toBeUndefined()
    const empty = await createRecording({ transcript: '' }, d)
    await expect(analyzeRecording(empty.id, d, heuristicProvider)).rejects.toThrow(/transcript/i)
  })

  it('never touches the transcript or audio on fallback', async () => {
    const rec = await createRecording({ blob: new Blob(['abc'], { type: 'audio/webm' }), durationSec: 5, transcript: T }, d)
    await analyzeRecording(rec.id, d, failing('boom'))
    const after = (await d.recordings.get(rec.id))!
    expect(after.transcript).toBe(T); expect(after.transcriptOriginal).toBe(T)
    expect((await d.audio.get(rec.id))!.blob.size).toBe(3)
  })
})

describe('AI results: storage, labeling and acceptance', () => {
  it('persists routines with closer, connections, model and warnings; AI bits carry no score', async () => {
    const rec = await createRecording({ transcript: T }, d)
    const provider: AnalysisProvider = { id: 'server-llm', label: 'AI', origin: 'ai-suggested', description: '', analyze: async () => aiResult() }
    const out = await analyzeRecording(rec.id, d, provider)
    expect(out.warnings).toHaveLength(1)
    const run = (await d.runs.where('recordingId').equals(rec.id).first())!
    expect(run.model).toBe('qwen2.5:3b'); expect(run.fallbackFrom).toBeUndefined()
    expect(run.connections).toHaveLength(1)
    const sug = await d.suggestions.where('recordingId').equals(rec.id).sortBy('order')
    expect(sug.every((s) => s.origin === 'ai-suggested' && s.confidence === undefined)).toBe(true)
    const [r] = await d.routines.where('recordingId').equals(rec.id).toArray()
    expect(r.origin).toBe('ai-suggested')
    expect(r.closerSuggestionId).toBe(sug[1].id)
    expect(r.closerWhy).toBe('Lands the callback')
    expect(run.connections![0]).toMatchObject({ a: sug[0].id, b: sug[1].id })
  })

  it('accepting an AI suggestion keeps the comedian\'s words as "original" and never stores AI text as the joke', async () => {
    const rec = await createRecording({ transcript: T }, d)
    const { suggestions } = await storeAnalysis(rec.id, aiResult(), { id: 'server-llm', origin: 'ai-suggested' }, d)
    const jokeId = await acceptSuggestion(suggestions[0].id, 'Observational', d)
    const joke = (await d.jokes.get(jokeId))!
    expect(T).toContain(joke.text)           // text is a slice of the transcript
    expect(joke.origin).toBe('original')       // verbatim words → the comedian's
    expect(joke.sourceExcerpt).toBe(suggestions[0].excerpt)
    expect(joke.notes).not.toMatch(/AI note/)   // model commentary is not copied into the joke
    expect((await d.recordings.get(rec.id))!.transcript).toBe(T)
  })

  it('edits to a candidate never change the stored excerpt', async () => {
    const rec = await createRecording({ transcript: T }, d)
    const { suggestions } = await storeAnalysis(rec.id, aiResult(), { id: 'server-llm', origin: 'ai-suggested' }, d)
    await d.suggestions.update(suggestions[0].id, { userText: 'my tightened version' })
    const jokeId = await acceptSuggestion(suggestions[0].id, 'Observational', d)
    expect((await d.jokes.get(jokeId))!.text).toBe('my tightened version')
    expect((await d.suggestions.get(suggestions[0].id))!.excerpt).toBe(suggestions[0].excerpt)
  })

  it('re-running analysis keeps accepted candidates and replaces pending ones', async () => {
    const rec = await createRecording({ transcript: T }, d)
    const a = await storeAnalysis(rec.id, aiResult(), { id: 'server-llm', origin: 'ai-suggested' }, d)
    await acceptSuggestion(a.suggestions[0].id, 'Observational', d)
    await storeAnalysis(rec.id, aiResult(), { id: 'server-llm', origin: 'ai-suggested' }, d)
    const all = await d.suggestions.where('recordingId').equals(rec.id).toArray()
    expect(all.filter((s) => s.status === 'accepted')).toHaveLength(1)
    expect(all.filter((s) => s.status === 'pending')).toHaveLength(2)
  })
})
