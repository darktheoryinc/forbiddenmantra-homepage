/**
 * Live check against a real model. Skipped unless LIVE_LLM_URL and LIVE_LLM_MODEL are set, e.g.
 *   LIVE_LLM_URL=http://localhost:11434/v1/chat/completions LIVE_LLM_MODEL=qwen2.5:3b npm run test:live
 * Model output varies run to run, so this asserts the guarantees that must ALWAYS hold, not specific jokes.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeWithLlm, llmConfigFromEnv, validTransition } from '../server/llm'
import { contentWords } from '../src/ai/heuristic'

const url = process.env.LIVE_LLM_URL, model = process.env.LIVE_LLM_MODEL
const T = readFileSync(new URL('./fixtures/ramble.txt', import.meta.url), 'utf8')
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()

describe.skipIf(!url || !model)('live model', () => {
  it('finds real candidates and every guarantee holds on real output', { timeout: 900_000 }, async () => {
    const cfg = llmConfigFromEnv({ LLM_API_URL: url, LLM_MODEL: model, LLM_TIMEOUT_MS: '600000' })!
    const r = await analyzeWithLlm(T, cfg)
    console.log(`live: ${r.meta!.model} ${Math.round(r.meta!.ms / 1000)}s bits=${r.bits.length} routines=${r.routines.length} callbacks=${r.callbacks.length} connections=${r.connections?.length} warnings=${JSON.stringify(r.meta!.warnings)}`)

    expect(r.bits.length).toBeGreaterThanOrEqual(3)
    for (const b of r.bits) {
      expect(T.slice(b.start, b.end)).toBe(b.excerpt)                  // verbatim, by position
      if (b.setup && b.punchline) {
        expect(b.excerpt.startsWith(b.setup)).toBe(true)                // setup/punchline are slices of the excerpt
        expect(b.excerpt.endsWith(b.punchline)).toBe(true)
      }
      expect(b.confidence).toBeUndefined()                              // no fabricated score
    }
    for (const rt of r.routines) {
      expect(rt.bitIndexes.length).toBeGreaterThanOrEqual(2)
      expect(new Set(rt.bitIndexes).size).toBe(rt.bitIndexes.length)
      expect(rt.transitions).toHaveLength(rt.bitIndexes.length - 1)
      rt.transitions.forEach((t, k) => { if (t) expect(validTransition(t, [r.bits[rt.bitIndexes[k]].excerpt, r.bits[rt.bitIndexes[k + 1]].excerpt])).toBe(true) })
      if (rt.closerIndex !== undefined) expect(rt.bitIndexes).toContain(rt.closerIndex)
    }
    const used = r.routines.flatMap((x) => x.bitIndexes)
    expect(new Set(used).size).toBe(used.length)                        // a bit is in at most one routine
    for (const c of r.callbacks) for (const i of c.bitIndexes) expect(contentWords(r.bits[i].excerpt)).toEqual(expect.arrayContaining(contentWords(c.phrase)))
    for (const c of r.connections ?? []) {                              // connection evidence is the comedian's real words
      expect(norm(r.bits[c.a].excerpt)).toContain(norm(c.aQuote!))
      expect(norm(r.bits[c.b].excerpt)).toContain(norm(c.bQuote!))
    }
  })
})
