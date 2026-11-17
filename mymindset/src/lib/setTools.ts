import { contentWords, suggestTransition } from '../ai/heuristic'
import type { Joke, SetItem } from './types'
import { uid } from './db'

const STATUS_RANK: Record<string, number> = { polished: 0, working: 1, testing: 2, drafting: 3, idea: 4, retired: 9 }

/** Inserts a *suggested* transition between every adjacent pair of jokes that has nothing between them. */
export function withSuggestedTransitions(items: SetItem[], jokes: Map<string, Joke>, variantSeed = 0): SetItem[] {
  const out: SetItem[] = []
  items.forEach((it, i) => {
    out.push(it)
    const next = items[i + 1]
    if (it.kind === 'joke' && next?.kind === 'joke') {
      const a = jokes.get(it.jokeId ?? ''), b = jokes.get(next.jokeId ?? '')
      if (a && b) out.push({ id: uid(), kind: 'transition', text: suggestTransition(a.text, b.text, variantSeed + i), origin: 'suggested' })
    }
  })
  return out
}

export interface SetCallback { phrase: string; positions: number[]; jokeIds: string[] }

/** Words/tags that recur across non-adjacent jokes in a set → callback opportunities. */
export function findSetCallbacks(items: SetItem[], jokes: Map<string, Joke>): SetCallback[] {
  const placed = items.filter((i) => i.kind === 'joke' && i.jokeId && jokes.has(i.jokeId))
  const seen = new Map<string, number[]>()
  placed.forEach((it, pos) => {
    const j = jokes.get(it.jokeId!)!
    const words = new Set([...contentWords(j.text), ...j.tags.map((t) => t.toLowerCase())])
    for (const w of words) seen.set(w, [...(seen.get(w) ?? []), pos])
  })
  const out: SetCallback[] = []
  for (const [phrase, pos] of seen) {
    if (pos.length < 2 || phrase.length < 4) continue
    if (pos[pos.length - 1] - pos[0] < 2) continue // adjacent bits already flow together
    out.push({ phrase, positions: pos, jokeIds: pos.map((p) => placed[p].jokeId!) })
  }
  return out.sort((a, b) => b.positions.length - a.positions.length || b.positions[b.positions.length - 1] - b.positions[0] - (a.positions[a.positions.length - 1] - a.positions[0])).slice(0, 4)
}

/** Picks vault jokes (best status first, skipping retired + already used) until the estimate reaches the target. */
export function suggestFill(
  vault: Joke[], used: Set<string>, currentSec: number, targetSec: number, est: (j: Joke) => number,
): Joke[] {
  const pool = vault.filter((j) => !used.has(j.id) && j.status !== 'retired')
    .sort((a, b) => (STATUS_RANK[a.status] ?? 5) - (STATUS_RANK[b.status] ?? 5) || b.updatedAt - a.updatedAt)
  const picked: Joke[] = []
  let total = currentSec
  for (const j of pool) {
    if (total >= targetSec) break
    const e = est(j)
    if (total + e > targetSec * 1.1) continue
    picked.push(j); total += e
  }
  return picked
}
