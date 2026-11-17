import Dexie, { type Table } from 'dexie'
import {
  DEFAULT_SETTINGS, type AnalysisRun, type AudioBlobRow, type ComedySet, type Joke, type JokeRevision,
  type Performance, type Recording, type RoutineSuggestion, type Settings, type SetVersion, type Suggestion, type Topic,
} from './types'

export class MindSetDB extends Dexie {
  recordings!: Table<Recording, string>
  audio!: Table<AudioBlobRow, string>
  jokes!: Table<Joke, string>
  revisions!: Table<JokeRevision, string>
  suggestions!: Table<Suggestion, string>
  routines!: Table<RoutineSuggestion, string>
  runs!: Table<AnalysisRun, string>
  sets!: Table<ComedySet, string>
  setVersions!: Table<SetVersion, string>
  performances!: Table<Performance, string>
  topics!: Table<Topic, string>
  settings!: Table<Settings, string>

  constructor(name = 'mymindset') {
    super(name)
    this.version(1).stores({
      recordings: 'id, createdAt, kind',
      audio: 'id',
      jokes: 'id, category, status, updatedAt, sourceRecordingId',
      revisions: 'id, jokeId, savedAt',
      suggestions: 'id, recordingId, runId, status',
      routines: 'id, recordingId, runId',
      runs: 'id, recordingId',
      sets: 'id, updatedAt',
      setVersions: 'id, setId, version',
      performances: 'id, date, setId',
      topics: 'id, savedAt',
      settings: 'id',
    })
  }
}

export const db = new MindSetDB()

export const uid = () => crypto.randomUUID()

export async function getSettings(d: MindSetDB = db): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await d.settings.get('main')) }
}
export async function saveSettings(patch: Partial<Settings>, d: MindSetDB = db) {
  await d.settings.put({ ...(await getSettings(d)), ...patch, id: 'main' })
}

// ---------- Recordings ----------
export function defaultTitle(at: number, durationSec: number): string {
  const d = new Date(at)
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `Ramble · ${day}, ${time}${durationSec ? ` · ${formatDuration(durationSec)}` : ''}`
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export async function createRecording(
  input: { blob?: Blob; durationSec?: number; mimeType?: string; transcript?: string; title?: string; kind?: Recording['kind']; setId?: string },
  d: MindSetDB = db,
): Promise<Recording> {
  const createdAt = Date.now()
  const id = uid()
  const text = input.transcript?.trim() ?? ''
  const rec: Recording = {
    id,
    title: input.title?.trim() || defaultTitle(createdAt, input.durationSec ?? 0),
    createdAt,
    durationSec: input.durationSec ?? 0,
    mimeType: input.mimeType ?? input.blob?.type ?? '',
    hasAudio: !!input.blob,
    transcriptOriginal: text,
    transcriptSource: text ? (input.blob ? 'typed' : 'pasted') : 'none',
    transcript: text,
    kind: input.kind ?? 'ramble',
    setId: input.setId,
  }
  await d.transaction('rw', d.recordings, d.audio, async () => {
    await d.recordings.add(rec)
    if (input.blob) await d.audio.add({ id, blob: input.blob })
  })
  return rec
}

export async function deleteRecording(id: string, d: MindSetDB = db) {
  await d.transaction('rw', [d.recordings, d.audio, d.suggestions, d.routines, d.runs], async () => {
    await d.recordings.delete(id)
    await d.audio.delete(id)
    await d.suggestions.where('recordingId').equals(id).delete()
    await d.routines.where('recordingId').equals(id).delete()
    await d.runs.where('recordingId').equals(id).delete()
  })
  // Jokes accepted from this recording keep their text + verbatim excerpt; only the link goes stale.
}

// ---------- Jokes ----------
export async function createJoke(input: Partial<Joke> & { text: string }, d: MindSetDB = db): Promise<Joke> {
  const now = Date.now()
  const joke: Joke = {
    id: uid(),
    title: input.title?.trim() || deriveTitle(input.text),
    text: input.text,
    setup: input.setup,
    punchline: input.punchline,
    category: input.category ?? 'Observational',
    tags: input.tags ?? [],
    notes: input.notes ?? '',
    status: input.status ?? 'idea',
    origin: input.origin ?? 'original',
    sourceRecordingId: input.sourceRecordingId,
    sourceExcerpt: input.sourceExcerpt,
    durationSec: input.durationSec,
    createdAt: now,
    updatedAt: now,
  }
  await d.jokes.add(joke)
  return joke
}

export function deriveTitle(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 7).join(' ')
  return words.length < text.trim().length ? `${words}…` : words || 'Untitled bit'
}

/** Saves the joke, snapshotting the previous text as a revision whenever the wording changed. */
export async function updateJoke(id: string, patch: Partial<Joke>, d: MindSetDB = db, note?: string) {
  await d.transaction('rw', d.jokes, d.revisions, async () => {
    const prev = await d.jokes.get(id)
    if (!prev) throw new Error('Joke not found')
    const wordingChanged =
      (patch.text !== undefined && patch.text !== prev.text) ||
      (patch.setup !== undefined && patch.setup !== prev.setup) ||
      (patch.punchline !== undefined && patch.punchline !== prev.punchline)
    if (wordingChanged) {
      await d.revisions.add({ id: uid(), jokeId: id, text: prev.text, setup: prev.setup, punchline: prev.punchline, savedAt: Date.now(), note })
    }
    await d.jokes.put({ ...prev, ...patch, id, updatedAt: Date.now() })
  })
}

export async function deleteJoke(id: string, d: MindSetDB = db) {
  await d.transaction('rw', [d.jokes, d.revisions, d.sets], async () => {
    await d.jokes.delete(id)
    await d.revisions.where('jokeId').equals(id).delete()
    // Strip from live sets; saved set versions keep the reference (shown as "deleted joke").
    for (const s of await d.sets.toArray()) {
      if (s.items.some((i) => i.jokeId === id)) await d.sets.put({ ...s, items: s.items.filter((i) => i.jokeId !== id) })
    }
  })
}

// ---------- Sets ----------
export async function createSet(title: string, targetMinutes: number, d: MindSetDB = db): Promise<ComedySet> {
  const now = Date.now()
  const set: ComedySet = { id: uid(), title: title.trim() || 'Untitled set', targetMinutes, items: [], version: 1, createdAt: now, updatedAt: now }
  await d.sets.add(set)
  return set
}

export async function saveSet(set: ComedySet, d: MindSetDB = db) {
  await d.sets.put({ ...set, updatedAt: Date.now() })
}

/** Snapshots the current set as an immutable version and bumps the live version counter. */
export async function snapshotSet(setId: string, note: string | undefined, d: MindSetDB = db): Promise<SetVersion> {
  return d.transaction('rw', d.sets, d.setVersions, async () => {
    const set = await d.sets.get(setId)
    if (!set) throw new Error('Set not found')
    const v: SetVersion = {
      id: uid(), setId, version: set.version, title: set.title, targetMinutes: set.targetMinutes,
      items: structuredClone(set.items), savedAt: Date.now(), note,
    }
    await d.setVersions.add(v)
    await d.sets.put({ ...set, version: set.version + 1, updatedAt: Date.now() })
    return v
  })
}

export async function restoreSetVersion(versionId: string, d: MindSetDB = db) {
  await d.transaction('rw', d.sets, d.setVersions, async () => {
    const v = await d.setVersions.get(versionId)
    if (!v) throw new Error('Version not found')
    const set = await d.sets.get(v.setId)
    if (!set) throw new Error('Set not found')
    // Preserve the current state first so restoring never destroys work.
    await d.setVersions.add({
      id: uid(), setId: set.id, version: set.version, title: set.title, targetMinutes: set.targetMinutes,
      items: structuredClone(set.items), savedAt: Date.now(), note: `Auto-saved before restoring v${v.version}`,
    })
    await d.sets.put({ ...set, title: v.title, targetMinutes: v.targetMinutes, items: structuredClone(v.items), version: set.version + 1, updatedAt: Date.now() })
  })
}

// ---------- Backup ----------
export async function exportBackup(d: MindSetDB = db) {
  return {
    app: 'MyMindSet', version: 1, exportedAt: new Date().toISOString(),
    note: 'Audio files are not included in this JSON backup.',
    recordings: await d.recordings.toArray(), jokes: await d.jokes.toArray(), revisions: await d.revisions.toArray(),
    suggestions: await d.suggestions.toArray(), routines: await d.routines.toArray(), runs: await d.runs.toArray(),
    sets: await d.sets.toArray(), setVersions: await d.setVersions.toArray(), performances: await d.performances.toArray(),
    topics: await d.topics.toArray(),
  }
}
