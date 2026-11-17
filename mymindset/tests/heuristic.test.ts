import { describe, expect, it } from 'vitest'
import { analyzeHeuristic, segment, suggestTransition, alternateSplit, stem } from '../src/ai/heuristic'

const RAMBLE = `So I went to the airport yesterday and the security guy asks me if I packed my own bag. Who else is packing my bag? My mother? She's been dead since 2009, but sure, she did it. Airports are basically a place where adults get treated like toddlers with luggage.

You ever notice airport pretzels cost eleven dollars? It's a pretzel, it's flour and regret. I paid it, because I'm a coward at the airport, but still.

My mother, God rest her, hated flying. She said if God wanted us to fly he'd have given us better snacks at the gate. Turns out she was right about the pretzels.

Anyway, dating apps are the same. You swipe, you wait, you pay too much for something stale. Why is every profile a picture of a fish? I have never once wanted to date a fish.`

describe('analyzeHeuristic', () => {
  const out = analyzeHeuristic(RAMBLE)

  it('finds candidates and every excerpt is verbatim from the transcript', () => {
    expect(out.bits.length).toBeGreaterThanOrEqual(2)
    for (const b of out.bits) {
      expect(RAMBLE.slice(b.start, b.end)).toBe(b.excerpt)
      expect(RAMBLE).toContain(b.excerpt)
      if (b.setup) expect(b.excerpt).toContain(b.setup.slice(0, 20))
    }
  })

  it('never emits confidence outside 0..1 and explains itself', () => {
    for (const b of out.bits) { expect(b.confidence).toBeGreaterThan(0); expect(b.confidence).toBeLessThanOrEqual(1); expect(b.rationale).toMatch(/signals/i) }
  })

  it('detects recurring themes and callbacks across bits', () => {
    expect(out.themes.some((t) => ['mother', 'airport', 'pretzel'].includes(t))).toBe(true)
    expect(out.callbacks.length).toBeGreaterThan(0)
    for (const c of out.callbacks) expect(c.bitIndexes.length).toBeGreaterThanOrEqual(2)
  })

  it('builds ordered routines with one fewer transition than bits', () => {
    expect(out.routines.length).toBeGreaterThan(0)
    for (const r of out.routines) {
      expect(r.transitions).toHaveLength(r.bitIndexes.length - 1)
      expect([...r.bitIndexes].sort((a, b) => a - b)).toEqual(r.bitIndexes)
    }
  })

  it('returns nothing for empty or filler-only input', () => {
    expect(analyzeHeuristic('')).toEqual({ themes: [], bits: [], routines: [], callbacks: [] })
    expect(analyzeHeuristic('um uh yeah okay.').bits).toHaveLength(0)
  })

  it('handles long unpunctuated speech without throwing', () => {
    const run = Array.from({ length: 120 }, (_, i) => (i % 17 === 0 ? 'and then my mother called' : 'the airport pretzel')).join(' ')
    expect(() => analyzeHeuristic(run)).not.toThrow()
    expect(segment(run).length).toBeGreaterThan(1)
  })
})

describe('helpers', () => {
  it('stems simple plurals', () => { expect(stem('pretzels')).toBe('pretzel'); expect(stem('parties')).toBe('party'); expect(stem('class')).toBe('class') })
  it('transition uses a shared word when there is one, and varies by variant', () => {
    const a = suggestTransition('My mother hated airports.', 'Airports are weird.', 0)
    expect(a.toLowerCase()).toContain('airport')
    expect(suggestTransition('cats', 'taxes', 0)).not.toBe(suggestTransition('cats', 'taxes', 1))
  })
  it('alternateSplit cycles boundaries and preserves the words', () => {
    const ex = 'I bought a gym membership. I went once. The gym sent me a thank-you card for my donation.'
    const a = alternateSplit(ex, 0), b = alternateSplit(ex, 1)
    expect(a.punchline).not.toBe(b.punchline)
    expect(`${a.setup} ${a.punchline}`.replace(/\s+/g, ' ')).toBe(ex)
  })
})
