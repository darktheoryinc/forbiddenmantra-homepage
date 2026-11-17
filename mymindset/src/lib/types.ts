export type Origin = 'original' | 'ai-suggested' | 'heuristic-suggested'

export const BUILTIN_CATEGORIES = [
  'Observational', 'Personal stories', 'Relationships', 'Politics', 'Current events',
  'Social commentary', 'Technology', 'Health', 'Aging', 'Crowd work', 'One-liners',
] as const

export type JokeStatus = 'idea' | 'drafting' | 'testing' | 'working' | 'polished' | 'retired'
export const JOKE_STATUSES: JokeStatus[] = ['idea', 'drafting', 'testing', 'working', 'polished', 'retired']

export interface Recording {
  id: string
  title: string
  createdAt: number
  durationSec: number
  mimeType: string
  hasAudio: boolean
  /** Text exactly as it arrived (engine output or pasted). Never modified after creation. */
  transcriptOriginal: string
  transcriptSource: 'none' | 'pasted' | 'server' | 'typed'
  /** User-editable working copy. */
  transcript: string
  kind: 'ramble' | 'rehearsal'
  setId?: string
  notes?: string
}

export interface AudioBlobRow { id: string; blob: Blob }

export interface Joke {
  id: string
  title: string
  /** The comedian's own words (or an accepted, user-approved suggestion). */
  text: string
  setup?: string
  punchline?: string
  category: string
  tags: string[]
  notes: string
  status: JokeStatus
  origin: Origin
  sourceRecordingId?: string
  /** Verbatim excerpt from the source transcript (preserved for provenance). */
  sourceExcerpt?: string
  durationSec?: number
  createdAt: number
  updatedAt: number
}

export interface JokeRevision { id: string; jokeId: string; text: string; setup?: string; punchline?: string; savedAt: number; note?: string }

export type SuggestionKind = 'premise' | 'setup-punchline' | 'story' | 'observation' | 'callback'

export interface Suggestion {
  id: string
  recordingId: string
  runId: string
  kind: SuggestionKind
  /** Verbatim excerpt from the transcript. */
  excerpt: string
  start: number
  end: number
  setup?: string
  punchline?: string
  themes: string[]
  confidence: number // 0..1 heuristic score — not a probability
  rationale: string
  origin: Origin
  status: 'pending' | 'accepted' | 'rejected'
  order: number
  userText?: string // user edit of the working text (excerpt stays untouched)
  acceptedJokeId?: string
}

export interface RoutineSuggestion {
  id: string
  recordingId: string
  runId: string
  title: string
  theme: string
  suggestionIds: string[]
  transitions: string[] // transitions[i] connects suggestionIds[i] -> [i+1]
  origin: Origin
  status: 'pending' | 'accepted' | 'rejected'
}

export interface AnalysisRun {
  id: string
  recordingId: string
  provider: string
  createdAt: number
  themes: string[]
  callbacks: { phrase: string; suggestionIds: string[] }[]
}

export interface SetItem {
  id: string
  kind: 'joke' | 'transition' | 'note'
  jokeId?: string
  text?: string
  origin: 'manual' | 'suggested'
}

export interface ComedySet {
  id: string
  title: string
  targetMinutes: number
  items: SetItem[]
  version: number
  createdAt: number
  updatedAt: number
}

export interface SetVersion {
  id: string
  setId: string
  version: number
  title: string
  targetMinutes: number
  items: SetItem[]
  savedAt: number
  note?: string
}

export interface Performance {
  id: string
  venue: string
  date: string // yyyy-mm-dd
  setId?: string
  setVersion?: number
  plannedSec: number
  actualSec?: number
  audienceNotes: string
  revisions: string
  rating?: number
  createdAt: number
}

export interface Topic {
  id: string
  title: string
  url?: string
  source?: string
  publishedAt?: string
  query?: string
  savedAt: number
  jokeId?: string
}

export interface TrendInterest { id: string; query: string }
export interface Settings {
  id: 'main'
  customCategories: string[]
  wordsPerMinute: number
  laughBreakSec: number
  trendInterests: TrendInterest[]
  geo: string // ISO country code
  apiToken: string
  analysisProvider: 'local' | 'server'
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  customCategories: [],
  wordsPerMinute: 140,
  laughBreakSec: 3,
  trendInterests: [{ id: 'default-1', query: 'technology' }, { id: 'default-2', query: 'dating' }],
  geo: 'US',
  apiToken: '',
  analysisProvider: 'local',
}
