import type { ComedySet, Joke, SetItem } from './types'

export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length
}

/** Speaking-time estimate: words at the comedian's pace plus a laugh break. A manual override wins. */
export function estimateJokeSeconds(joke: Pick<Joke, 'text' | 'durationSec'>, wpm = 140, laughBreakSec = 3): number {
  if (joke.durationSec && joke.durationSec > 0) return joke.durationSec
  return Math.round((wordCount(joke.text) / Math.max(wpm, 40)) * 60 + laughBreakSec)
}

export function estimateItemSeconds(item: SetItem, jokes: Map<string, Joke>, wpm: number, laugh: number): number {
  if (item.kind === 'joke') {
    const j = item.jokeId ? jokes.get(item.jokeId) : undefined
    return j ? estimateJokeSeconds(j, wpm, laugh) : 0
  }
  if (item.kind === 'transition') return Math.round((wordCount(item.text ?? '') / Math.max(wpm, 40)) * 60)
  return 0
}

export function estimateSetSeconds(set: Pick<ComedySet, 'items'>, jokes: Map<string, Joke>, wpm = 140, laugh = 3): number {
  return set.items.reduce((sum, i) => sum + estimateItemSeconds(i, jokes, wpm, laugh), 0)
}

export type Fit = 'under' | 'fit' | 'over'
/** "fit" = within ±10% (min 15s) of the target. */
export function fitStatus(estimateSec: number, targetMinutes: number): { fit: Fit; deltaSec: number } {
  const target = targetMinutes * 60
  const delta = estimateSec - target
  const tol = Math.max(15, target * 0.1)
  return { fit: Math.abs(delta) <= tol ? 'fit' : delta < 0 ? 'under' : 'over', deltaSec: delta }
}
