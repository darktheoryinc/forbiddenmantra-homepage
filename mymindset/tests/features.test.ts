import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { MindSetDB, createJoke, createRecording, exportBackup, importBackup, jokeStats, splitNotes, uid } from '../src/lib/db'

let d: MindSetDB
beforeEach(async () => { d = new MindSetDB(`f-${uid()}`); await d.open() })

describe('splitNotes', () => {
  it('splits on blank lines and strips list markers', () => {
    expect(splitNotes('First bit\nstill first.\n\nSecond bit.\n\n\nThird.')).toEqual(['First bit\nstill first.', 'Second bit.', 'Third.'])
    expect(splitNotes('- one liner a\n- one liner b\n3. one liner c')).toEqual(['one liner a', 'one liner b', 'one liner c'])
    expect(splitNotes('   ')).toEqual([])
    expect(splitNotes('ab')).toEqual([]) // too short to be a bit
    expect(splitNotes('a\r\n\r\nbbb bbb')).toEqual(['bbb bbb'])
  })
})

describe('jokeStats', () => {
  it('tallies verdicts per joke across shows', () => {
    const perfs = [
      { bitResults: [{ jokeId: 'a', verdict: 'hit' as const }, { jokeId: 'b', verdict: 'miss' as const }] },
      { bitResults: [{ jokeId: 'a', verdict: 'ok' as const }] },
      {},
    ]
    expect(jokeStats('a', perfs)).toEqual({ hit: 1, ok: 1, miss: 0, total: 2 })
    expect(jokeStats('zzz', perfs).total).toBe(0)
  })
})

describe('backup round-trip', () => {
  it('restores jokes, markers and show results into a fresh database without duplicating', async () => {
    const j = await createJoke({ text: 'pretzel bit' }, d)
    const r = await createRecording({ blob: new Blob(['x'], { type: 'audio/webm' }), durationSec: 10, kind: 'performance' }, d)
    await d.recordings.update(r.id, { markers: [{ id: 'm1', t: 3, kind: 'big-laugh', jokeId: j.id }] })
    await d.performances.add({ id: 'p1', venue: 'Cellar', date: '2026-11-17', plannedSec: 60, audienceNotes: '', revisions: '', createdAt: 1, bitResults: [{ jokeId: j.id, verdict: 'hit' }] })
    const backup = JSON.parse(JSON.stringify(await exportBackup(d)))

    const fresh = new MindSetDB(`f-${uid()}`); await fresh.open()
    const counts = await importBackup(backup, fresh)
    expect(counts.jokes).toBe(1)
    expect((await fresh.jokes.get(j.id))!.text).toBe('pretzel bit')
    const rec = (await fresh.recordings.get(r.id))!
    expect(rec.markers![0].kind).toBe('big-laugh')
    expect(rec.hasAudio).toBe(false) // audio isn't in the JSON, and the UI must not claim it is
    expect((await fresh.performances.get('p1'))!.bitResults![0].verdict).toBe('hit')
    await importBackup(backup, fresh)
    expect(await fresh.jokes.count()).toBe(1)
  })

  it('rejects files that are not MyMindSet backups', async () => {
    await expect(importBackup({ hello: 1 }, d)).rejects.toThrow(/not a MyMindSet backup/)
    await expect(importBackup(null, d)).rejects.toThrow()
  })

  it('ignores malformed rows instead of corrupting the database', async () => {
    await importBackup({ app: 'MyMindSet', jokes: [{ nope: true }, null, { id: 'ok', title: 't', text: 'x', category: 'c', tags: [], notes: '', status: 'idea', origin: 'original', createdAt: 1, updatedAt: 1 }] }, d)
    expect(await d.jokes.count()).toBe(1)
  })
})
