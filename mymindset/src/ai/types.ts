import type { Origin, SuggestionKind } from '../lib/types'

export interface RawBit {
  kind: SuggestionKind
  /** Verbatim text from the transcript. */
  excerpt: string
  /** Character offsets in the transcript; -1 when a provider returned text it could not locate verbatim. */
  start: number
  end: number
  setup?: string
  punchline?: string
  themes: string[]
  /** Heuristic score (0..1). Absent for AI bits: models don't give a trustworthy probability, so none is shown. */
  confidence?: number
  rationale: string
}

export interface RawRoutine { title: string; theme: string; bitIndexes: number[]; transitions: string[]; closerIndex?: number; closerWhy?: string }
export interface RawConnection { a: number; b: number; why: string; aQuote?: string; bQuote?: string }
export interface AnalysisMeta { model: string; chunks: number; chunksFailed: number; dropped: number; warnings: string[]; ms: number }
export interface RawCallback { phrase: string; bitIndexes: number[] }

export interface AnalysisResult {
  themes: string[]
  bits: RawBit[]
  routines: RawRoutine[]
  callbacks: RawCallback[]
  connections?: RawConnection[]
  meta?: AnalysisMeta
}

export interface AnalysisProvider {
  id: string
  label: string
  origin: Origin
  /** Human-readable honesty note shown in the UI. */
  description: string
  analyze(input: { transcript: string }): Promise<AnalysisResult>
  /** Offer a different take on a single suggestion. */
  regenerate?(input: { excerpt: string; variant: number }): Promise<Pick<RawBit, 'setup' | 'punchline' | 'rationale'>>
  suggestTransition?(input: { from: string; to: string; variant: number }): Promise<string>
}

export interface TranscriptionProvider {
  id: string
  label: string
  transcribe(blob: Blob): Promise<{ text: string }>
}

export interface ServerStatus {
  ok: boolean
  transcription: { configured: boolean; provider?: string }
  analysis: { configured: boolean; provider?: string }
  trends: { configured: boolean; provider: string }
  authRequired: boolean
}
