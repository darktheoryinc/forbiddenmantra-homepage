import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { MindSetDB, createJoke, updateJoke, deleteJoke, createSet, snapshotSet, restoreSetVersion, createRecording, deleteRecording, uid, formatDuration } from '../src/lib/db'
import { storeAnalysis, acceptSuggestion } from '../src/ai/service'
import { analyzeHeuristic, heuristicProvider } from '../src/ai/heuristic'
import { estimateJokeSeconds, estimateSetSeconds, fitStatus } from '../src/lib/duration'
import { findSetCallbacks, suggestFill, withSuggestedTransitions } from '../src/lib/setTools'
import type { Joke } from '../src/lib/types'

let d: MindSetDB
beforeEach(async () => { d = new MindSetDB(`t-${uid()}`); await d.open() })

describe('recordings', () => {
  it('stores audio separately from metadata, auto-titles, and deletion cleans related rows', async () => {
    const r = await createRecording({ blob: new Blob(['abc'], { type: 'audio/webm' }), durationSec: 65 }, d)
    expect(r.title).toMatch(/Ramble/); expect(r.title).toContain('1:05')
    expect((await d.audio.get(r.id))?.blob.size).toBe(3)
    expect(r.transcriptOriginal).toBe('')
    await deleteRecording(r.id, d)
    expect(await d.audio.get(r.id)).toBeUndefined()
  })
  it('pasted transcripts keep an immutable original', async () => {
    const r = await createRecording({ transcript: '  my words here  ' }, d)
    expect(r.transcriptOriginal).toBe('my words here'); expect(r.transcriptSource).toBe('pasted')
    await d.recordings.update(r.id, { transcript: 'edited' })
    expect((await d.recordings.get(r.id))!.transcriptOriginal).toBe('my words here')
  })
})

describe('jokes', () => {
  it('snapshots previous wording as a revision only when wording changes', async () => {
    const j = await createJoke({ text: 'v1' }, d)
    await updateJoke(j.id, { notes: 'just notes' }, d)
    expect(await d.revisions.count()).toBe(0)
    await updateJoke(j.id, { text: 'v2' }, d)
    const revs = await d.revisions.toArray()
    expect(revs).toHaveLength(1); expect(revs[0].text).toBe('v1')
    expect((await d.jokes.get(j.id))!.text).toBe('v2')
  })
  it('deleting a joke removes it from live sets but old versions survive', async () => {
    const j = await createJoke({ text: 'x' }, d)
    const s = await createSet('S', 5, d)
    await d.sets.put({ ...s, items: [{ id: uid(), kind: 'joke', jokeId: j.id, origin: 'manual' }] })
    await snapshotSet(s.id, 'n', d)
    await deleteJoke(j.id, d)
    expect((await d.sets.get(s.id))!.items).toHaveLength(0)
    expect((await d.setVersions.where('setId').equals(s.id).first())!.items).toHaveLength(1)
  })
})

describe('sets', () => {
  it('versions are immutable snapshots and restore never destroys current work', async () => {
    const s = await createSet('Set', 10, d)
    const item = { id: uid(), kind: 'note' as const, text: 'one', origin: 'manual' as const }
    await d.sets.put({ ...s, items: [item] })
    const v1 = await snapshotSet(s.id, 'first', d)
    expect(v1.version).toBe(1)
    await d.sets.update(s.id, { items: [item, { ...item, id: uid(), text: 'two' }] })
    await restoreSetVersion(v1.id, d)
    const cur = (await d.sets.get(s.id))!
    expect(cur.items).toHaveLength(1)
    expect(cur.version).toBe(3)
    const all = await d.setVersions.where('setId').equals(s.id).toArray()
    expect(all.some((v) => v.items.length === 2)).toBe(true) // pre-restore state preserved
  })
})

describe('ramble → joke → set workflow', () => {
  it('accepting a suggestion creates a Vault joke with provenance and never alters the transcript', async () => {
    const transcript = 'You ever notice airport pretzels cost eleven dollars? It is flour and regret. I paid it anyway, because I am a coward. My mother hated pretzels, turns out she was right about airports.'
    const rec = await createRecording({ transcript }, d)
    const res = analyzeHeuristic(rec.transcript)
    expect(res.bits.length).toBeGreaterThan(0)
    const { suggestions } = await storeAnalysis(rec.id, res, heuristicProvider, d)
    const jokeId = await acceptSuggestion(suggestions[0].id, 'Observational', d)
    const joke = (await d.jokes.get(jokeId))!
    expect(transcript).toContain(joke.text)
    expect(joke.origin).toBe('original')
    expect(joke.sourceRecordingId).toBe(rec.id)
    expect(joke.sourceExcerpt).toBe(suggestions[0].excerpt)
    expect((await d.recordings.get(rec.id))!.transcript).toBe(transcript)
    expect(await acceptSuggestion(suggestions[0].id, 'x', d)).toBe(jokeId) // idempotent
    // re-analysis replaces pending, keeps accepted
    await storeAnalysis(rec.id, res, heuristicProvider, d)
    expect((await d.suggestions.where('recordingId').equals(rec.id).toArray()).filter((s) => s.status === 'accepted')).toHaveLength(1)
  })
})

describe('durations and set tools', () => {
  const mk = (id: string, text: string, extra: Partial<Joke> = {}): Joke => ({ id, title: id, text, category: 'x', tags: [], notes: '', status: 'working', origin: 'original', createdAt: 1, updatedAt: 1, ...extra })
  it('estimates from words, respects override, and judges fit', () => {
    expect(estimateJokeSeconds({ text: Array(70).fill('w').join(' ') }, 140, 3)).toBe(33)
    expect(estimateJokeSeconds({ text: 'a', durationSec: 45 })).toBe(45)
    expect(fitStatus(300, 5).fit).toBe('fit'); expect(fitStatus(200, 5).fit).toBe('under'); expect(fitStatus(400, 5).fit).toBe('over')
    const jm = new Map([['a', mk('a', 'x y z')]])
    expect(estimateSetSeconds({ items: [{ id: '1', kind: 'joke', jokeId: 'a', origin: 'manual' }, { id: '2', kind: 'joke', jokeId: 'gone', origin: 'manual' }] }, jm)).toBeGreaterThan(0)
  })
  it('suggests labeled transitions only between adjacent jokes, and finds non-adjacent callbacks', () => {
    const jokes = new Map([['a', mk('a', 'My mother hates airports')], ['b', mk('b', 'Dating apps are cruel')], ['c', mk('c', 'Airports again, mother approved')]])
    const items = ['a', 'b', 'c'].map((k) => ({ id: k, kind: 'joke' as const, jokeId: k, origin: 'manual' as const }))
    const withT = withSuggestedTransitions(items, jokes)
    expect(withT).toHaveLength(5)
    expect(withT.filter((i) => i.kind === 'transition').every((i) => i.origin === 'suggested')).toBe(true)
    expect(withSuggestedTransitions(withT, jokes)).toHaveLength(5) // idempotent
    expect(findSetCallbacks(items, jokes).some((c) => c.phrase === 'mother' || c.phrase === 'airport')).toBe(true)
  })
  it('fill suggestions respect target, skip used/retired jokes', () => {
    const vault = [mk('a', 'x'.repeat(1)), mk('b', 'y', { status: 'retired' }), mk('c', 'z', { status: 'polished' })]
    const picks = suggestFill(vault, new Set(['a']), 0, 60, () => 30)
    expect(picks.map((p) => p.id)).toEqual(['c'])
  })
  it('formats durations', () => { expect(formatDuration(65)).toBe('1:05'); expect(formatDuration(-3)).toBe('0:00') })
})
