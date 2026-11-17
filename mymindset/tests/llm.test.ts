import { describe, expect, it } from 'vitest'
import { analyzeWithLlm, chunkRanges, dedupeBits, llmConfigFromEnv, transitionWithLlm, validateRoutines, validateLinks, validTransition, validateBits, type LlmConfig } from '../server/llm'
import { createApp } from '../server/app'
import { segment } from '../src/ai/heuristic'

const T = `I went to the airport yesterday. The pretzel cost eleven dollars. It is flour and regret. I paid it anyway, because I am a coward at the airport.

My mother hated flying. She said God would have given us better snacks. Turns out she was right about the pretzels.

Dating apps are the same. You swipe, you wait, you pay too much for something stale. Why is every profile a picture of a fish? I have never wanted to date a fish.`

const cfg: LlmConfig = { url: 'https://llm.test/v1/chat/completions', model: 'test-model', timeoutMs: 5000, chunkWords: 600, maxChunks: 8 }
const reply = (content: unknown, status = 200) => new Response(status === 200 ? JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] }) : '{}', { status })

/** Mock LLM: answers each prompt type separately (extraction, routines, links, transition). */
type Out = unknown | (() => Response)
function mockLlm(stage1: Out, routines: Out = { routines: [] }, links: Out = { callbacks: [], connections: [] }, transition: Out = { transition: 'Which brings me to something even worse.' }) {
  const calls: { system: string; user: string; body: Record<string, unknown> }[] = []
  const f = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    const system = body.messages[0].content as string
    calls.push({ system, user: body.messages[1].content, body })
    const out = system.includes('mine a spoken ramble') ? stage1 : system.includes('sequence material') ? routines : system.includes('find connections') ? links : transition
    return typeof out === 'function' ? (out as () => Response)() : reply(out)
  }) as unknown as typeof fetch
  return { f, calls }
}

const segs = segment(T)
const idxOf = (needle: string) => segs.findIndex((s) => s.text.includes(needle)) + 1 // 1-based, as the model sees it

describe('stage 1: pointers become verbatim excerpts', () => {
  it('cuts excerpt, setup and punchline from the transcript — never from model text', async () => {
    const from = idxOf('The pretzel'), to = idxOf('I paid it anyway')
    const { f } = mockLlm(
      // The model also tries to smuggle in its own "punchline" and "text" — these must be ignored.
      { bits: [{ from, to, kind: 'observation', punch_at: to, themes: ['pretzel', 'airport', 'invented'], why: 'Nice rhythm', punchline: 'INVENTED PUNCHLINE', text: 'REWRITTEN' }] },
      { routines: [] })
    const r = await analyzeWithLlm(T, cfg, f)
    expect(r.bits).toHaveLength(1)
    const b = r.bits[0]
    expect(T.slice(b.start, b.end)).toBe(b.excerpt)
    expect(b.punchline).toBe(segs[to - 1].text)
    expect(b.setup && b.excerpt.startsWith(b.setup)).toBe(true)
    expect(b.excerpt).toContain(b.punchline!)
    expect(JSON.stringify(r)).not.toMatch(/INVENTED PUNCHLINE|REWRITTEN/)
    expect(b.themes).toEqual(['pretzel', 'airport']) // "invented" isn't in the passage → dropped
    expect(b.rationale).toMatch(/^AI flagged this as/)
    expect(b.confidence).toBeUndefined()
    expect(r.meta?.model).toBe('test-model')
  })

  it('drops out-of-range, reversed and malformed pointers and counts them', () => {
    const range = { from: 0, to: segs.length - 1 }
    const v = validateBits({ bits: [
      { from: 0, to: 2, kind: 'x', themes: [], why: '' }, // sentence 0 does not exist (1-based)
      { from: 5, to: 3, kind: 'x', themes: [], why: '' }, // reversed
      { from: 1, to: 99, kind: 'x', themes: [], why: '' }, // beyond transcript
      null as never,
      { from: 2, to: 3, kind: 'weird-kind', punch_at: 9, themes: [], why: '' }, // ok; bad kind → premise, bad punch_at ignored
    ] }, segs, T, range)
    expect(v.bits).toHaveLength(1)
    expect(v.dropped).toBe(4)
    expect(v.bits[0].kind).toBe('premise')
    expect(v.bits[0].setup).toBeUndefined()
    expect(v.bits[0].punchline).toBeUndefined()
  })

  it('accepts numbers sent as strings and ignores junk entries (small models do this)', async () => {
    const { f } = mockLlm({ bits: [{ from: String(idxOf('My mother')), to: String(idxOf('Turns out')), kind: 'story', themes: 'not-an-array', why: 42 }, 'junk', 7] }, { routines: [] })
    const r = await analyzeWithLlm(T, cfg, f)
    expect(r.bits).toHaveLength(1)
    expect(r.bits[0].excerpt.startsWith('My mother hated flying.')).toBe(true)
  })

  it('dedupes overlapping bits from neighbouring chunks', () => {
    const mk = (a: number, b: number) => ({ kind: 'premise' as const, excerpt: 'x x x x', start: a, end: b, themes: [], rationale: '', fromIdx: a, toIdx: b })
    expect(dedupeBits([mk(5, 8), mk(4, 7), mk(20, 21)]).map((b) => b.fromIdx)).toEqual([4, 20])
  })
})

describe('span clamping', () => {
  it('keeps the opening sentences of an over-long span instead of losing the bit', () => {
    const v = validateBits({ bits: [{ from: 1, to: 9, kind: 'story', punch_at: 8, themes: [] }] } as never, segs, T, { from: 0, to: segs.length - 1 })
    expect(v.bits).toHaveLength(1)
    expect(v.bits[0].excerpt).toBe(T.slice(segs[0].start, segs[5].end)) // 6 sentences
    expect(v.bits[0].punchline).toBeUndefined() // punch_at fell outside the clamped span → ignored, not guessed
  })
})

describe('chunking long transcripts', () => {
  it('splits by word budget with overlap and covers every sentence', () => {
    const long = Array.from({ length: 200 }, (_, i) => `This is sentence number ${i} about airports and pretzels.`).join(' ')
    const s = segment(long)
    const ranges = chunkRanges(s, 100, 4)
    expect(ranges.length).toBeGreaterThan(3)
    expect(ranges[0].from).toBe(0)
    expect(ranges[ranges.length - 1].to).toBe(s.length - 1)
    for (let i = 1; i < ranges.length; i++) { expect(ranges[i].from).toBeLessThanOrEqual(ranges[i - 1].to); expect(ranges[i].from).toBeGreaterThan(ranges[i - 1].from) }
  })

  it('only analyzes up to LLM_MAX_CHUNKS and says so', async () => {
    const long = Array.from({ length: 120 }, (_, i) => `Sentence ${i} is about my terrible neighbour and his lawn.`).join(' ')
    const { f, calls } = mockLlm({ bits: [] }, { routines: [] })
    const r = await analyzeWithLlm(long, { ...cfg, chunkWords: 150, maxChunks: 2 }, f)
    expect(calls.filter((c) => c.system.includes('mine a spoken ramble'))).toHaveLength(2)
    expect(r.meta?.warnings.join(' ')).toMatch(/first 2 of/)
  })

  it('keeps going when one chunk fails, and fails loudly when all do', async () => {
    const long = Array.from({ length: 120 }, (_, i) => `Sentence ${i} is about my terrible neighbour and his lawn.`).join(' ')
    let n = 0
    const half = (async () => (++n === 1 ? reply('{}', 500) : reply({ bits: [{ from: 70, to: 71, kind: 'premise', themes: [], why: 'x' }] }))) as unknown as typeof fetch
    const r = await analyzeWithLlm(long, { ...cfg, chunkWords: 150, maxChunks: 3 }, half)
    expect(r.meta?.chunksFailed).toBe(1)
    expect(r.meta?.warnings.join(' ')).toMatch(/could not be analyzed/)
    const dead = (async () => reply('{}', 500)) as unknown as typeof fetch
    await expect(analyzeWithLlm(T, cfg, dead)).rejects.toThrow(/500/)
  })
})

describe('stage 2: validation', () => {
  const bits = ['The pretzel cost eleven dollars at the airport.', 'My mother hated airports.', 'Dating apps are full of fish.', 'I paid for the stale pretzel.'].map((excerpt, i) => ({ kind: 'premise' as const, excerpt, start: i, end: i + 1, themes: [], rationale: '' }))

  it('keeps valid routines; drops bad indexes, duplicates and one-bit routines; leaves transitions blank for the next step', () => {
    const v = validateRoutines({ routines: [
      { title: 'Airports', order: [1, 2, 99, 2, 4], closer: 4 },
      { title: 'Solo', order: [3] },
      { title: 'Reuse', order: [1, 3] }, // bit 1 already used → one left → dropped
    ] } as never, bits)
    expect(v.routines).toHaveLength(1)
    expect(v.routines[0].bitIndexes).toEqual([0, 1, 3])
    expect(v.routines[0].transitions).toEqual(['', ''])
    expect(v.routines[0].closerIndex).toBe(3)
    expect(v.routines[0].closerWhy).toBeUndefined() // models describe the wrong reason; we don't show one
    expect(v.dropped).toBe(2)
  })

  it('caps a routine at six bits and ignores a closer that is not in it', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...bits[0], excerpt: `bit ${i}` }))
    const v = validateRoutines({ routines: [{ title: 't', order: [1, 2, 3, 4, 5, 6, 7, 8], closer: 8 }] } as never, many)
    expect(v.routines[0].bitIndexes).toHaveLength(6)
    expect(v.routines[0].closerIndex).toBeUndefined()
  })

  it('callbacks are computed from where the phrase literally occurs; junk is skipped', () => {
    const v = validateLinks({ callbacks: ['pretzel', { phrase: 'banana', bits: [1, 2] }, { phrase: 'airport', bits: [3, 4] }, { phrase: 'pretzel' }, 'ab', 42 as never, null as never], connections: [] } as never, bits)
    expect(v.callbacks).toEqual([{ phrase: 'pretzel', bitIndexes: [0, 3] }, { phrase: 'airport', bitIndexes: [0, 1] }]) // model's bit numbers [3,4] ignored; "banana" appears nowhere
    expect(v.dropped).toBeGreaterThanOrEqual(4)
  })

  it('connections need real verbatim quotes from both bits, different topics, and a real explanation', () => {
    const cb = [
      { kind: 'premise' as const, excerpt: 'Airports treat adults like toddlers with luggage.', start: 0, end: 1, themes: [], rationale: '' },
      { kind: 'premise' as const, excerpt: 'Why is every man holding a fish? It is a hostage photo.', start: 1, end: 2, themes: [], rationale: '' },
      { kind: 'premise' as const, excerpt: 'Airports sell pretzels for eleven dollars.', start: 2, end: 3, themes: [], rationale: '' },
    ]
    const v = validateLinks({ callbacks: [], connections: [
      { a: 1, b: 2, a_quote: 'treat adults like toddlers', b_quote: 'It is a hostage photo', why: 'Both are about being held against your will.' }, // real quotes → kept
      { a: 1, b: 2, a_quote: 'treat adults like toddlers', b_quote: 'a made up phrase here', why: 'Both are about being held against your will.' }, // invented quote → dropped (also a duplicate pair)
      { a: 2, b: 3, a_quote: 'a hostage photo', b_quote: 'sell pretzels for eleven dollars', why: 'Both involve paying for something unpleasant.' }, // ok
      { a: 1, b: 3, a_quote: 'toddlers with luggage', b_quote: 'Airports sell pretzels', why: 'Same airport setting again here.' }, // shares "airport" + only one real quote path: bit 3 quote ok, but same topic (≥2 shared words? only 1) → kept
      { a: 1, b: 2, a_quote: 'x', b_quote: 'y', why: 'ok' },
      { a: 2, b: 2, a_quote: 'hostage photo', b_quote: 'hostage photo', why: 'a bit connects with itself' },
      null as never,
    ] } as never, cb)
    expect(v.connections.map((c) => [c.a, c.b])).toEqual([[0, 1], [1, 2], [0, 2]])
    expect(v.connections[0]).toMatchObject({ aQuote: 'treat adults like toddlers', bQuote: 'It is a hostage photo' })
    // Quotes in the wrong bit are rejected even if they are real words from the transcript.
    const swapped = validateLinks({ callbacks: [], connections: [{ a: 1, b: 2, a_quote: 'It is a hostage photo', b_quote: 'treat adults like toddlers', why: 'Swapped evidence does not count.' }] } as never, cb)
    expect(swapped.connections).toHaveLength(0)
    // Same-topic pairs (several shared content words) are not "seemingly unrelated".
    const same = [cb[0], { ...cb[0], excerpt: 'Airports treat adults like toddlers, again, with luggage.' }]
    expect(validateLinks({ callbacks: [], connections: [{ a: 1, b: 2, a_quote: 'treat adults like toddlers', b_quote: 'treat adults like toddlers', why: 'These are basically the same bit.' }] } as never, same).connections).toHaveLength(0)
  })

  it('rejects transitions that echo the prompt, are too short, or copy the comedian', () => {
    const near = ['And then I get to the gate and I buy a pretzel, a soft pretzel, and it is eleven dollars.', 'Anyway so I am single now.']
    expect(validTransition('Which brings me to something even worse.', near)).toBe(true)
    expect(validTransition('spoken bridge from first to second', near)).toBe(false)
    expect(validTransition('So, and', near)).toBe(false)
    expect(validTransition('And then I get to the gate and I buy a soft pretzel', near)).toBe(false) // copied from the bit
    expect(validTransition('x '.repeat(30), near)).toBe(false)
    expect(validTransition("And that's when I realized I should pack my own bag.", near)).toBe(false) // speaks as the comedian
    expect(validTransition('Speaking of dating apps, here is another one.', near)).toBe(true)
  })
})

describe('full pipeline', () => {
  const s1 = { bits: [
    { from: idxOf('The pretzel'), to: idxOf('I paid it anyway'), kind: 'observation', punch_at: idxOf('I paid it anyway'), themes: ['pretzel'] },
    { from: idxOf('My mother'), to: idxOf('Turns out'), kind: 'story', punch_at: idxOf('Turns out'), themes: ['mother', 'pretzels'] },
    { from: idxOf('Why is every profile'), to: idxOf('I have never wanted'), kind: 'setup-punchline', punch_at: idxOf('I have never wanted'), themes: ['fish'] },
  ] }
  const routines = { routines: [{ title: 'Pretzel family', order: [1, 2, 3], closer: 3 }] }
  const links = { callbacks: ['pretzel', { phrase: 'mother' }], connections: [{ a: 1, b: 3, a_quote: 'The pretzel cost eleven dollars', b_quote: 'every profile a picture of a fish', why: 'Both are about paying for something disappointing.' }] }

  it('produces bits, a sequenced routine with AI-labeled transitions, a closer, callbacks and connections', async () => {
    const { f, calls } = mockLlm(s1, routines, links)
    const r = await analyzeWithLlm(T, cfg, f)
    expect(r.bits).toHaveLength(3)
    r.bits.forEach((b) => expect(T.slice(b.start, b.end)).toBe(b.excerpt))
    expect(r.routines[0]).toMatchObject({ bitIndexes: [0, 1, 2], closerIndex: 2 })
    expect(r.routines[0].transitions).toEqual(['Which brings me to something even worse.', 'Which brings me to something even worse.'])
    expect(r.callbacks[0].phrase).toBe('pretzel') // from a bare string: tolerated
    expect(r.connections?.[0]).toMatchObject({ a: 0, b: 2, aQuote: 'The pretzel cost eleven dollars', bQuote: 'every profile a picture of a fish' })
    expect(calls.filter((c) => c.system.includes('link two bits'))).toHaveLength(2) // one focused call per adjacent pair
    const stage2 = calls.find((c) => c.system.includes('sequence material'))!
    expect(stage2.user).toMatch(/^Bit 1: The pretzel cost eleven dollars/) // built from the comedian's own words
    expect(calls.every((c) => (c.body.response_format as { type: string }).type === 'json_object' && (c.body.temperature as number) <= 0.7)).toBe(true)
  })

  it('offers bits the model left out for another grouping pass, mapping renumbered bits back correctly', async () => {
    const spans: [string, string][] = [['I went to the airport', 'I paid it anyway'], ['My mother', 'Turns out'], ['Dating apps are the same', 'You swipe'], ['Why is every profile', 'I have never wanted']]
    const s = { bits: spans.map(([a, b]) => ({ from: idxOf(a), to: idxOf(b), kind: 'premise', themes: [] })) }
    let pass = 0
    const f = (async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)); const sys = body.messages[0].content as string
      if (sys.includes('sequence material')) return reply(++pass === 1 ? { routines: [{ title: 'First', order: [1, 3] }] } : { routines: [{ title: 'Second', order: [2, 1] }] }) // pass 2 sees leftovers (bits 2 and 4) as 1 and 2
      if (sys.includes('find connections')) return reply({ callbacks: [], connections: [] })
      if (sys.includes('link two bits')) return reply({ transition: 'Which brings me to something worse.' })
      return reply(s)
    }) as unknown as typeof fetch
    const r = await analyzeWithLlm(T, cfg, f)
    expect(r.bits).toHaveLength(4)
    expect(r.routines.map((x) => x.bitIndexes)).toEqual([[0, 2], [3, 1]])
    expect(pass).toBe(2)
  })

  it('leaves a transition blank (never canned text) when the model gives junk, and says so', async () => {
    const { f } = mockLlm(s1, routines, links, { transition: 'spoken bridge from first to second' })
    const r = await analyzeWithLlm(T, cfg, f)
    expect(r.routines[0].transitions).toEqual(['', ''])
    expect(r.meta?.warnings.join(' ')).toMatch(/2 transitions could not be generated/)
  })

  it('survives a failed assembly step: returns candidates plus a warning', async () => {
    const { f } = mockLlm(s1, 'this is not json at all', 'neither is this')
    const r = await analyzeWithLlm(T, cfg, f)
    expect(r.bits).toHaveLength(3)
    expect(r.routines).toHaveLength(0)
    expect(r.meta?.warnings.join(' ')).toMatch(/Routine assembly failed/)
    expect(r.meta?.warnings.join(' ')).toMatch(/Connection search failed/)
  })

  it('retries once on malformed JSON, then succeeds', async () => {
    let n = 0
    const f = (async (_u: string, init: RequestInit) => {
      const sys = JSON.parse(String(init.body)).messages[0].content as string
      if (sys.includes('sequence material')) return reply(routines)
      if (sys.includes('find connections')) return reply(links)
      if (sys.includes('link two bits')) return reply({ transition: 'Which brings me to something worse.' })
      return ++n === 1 ? reply('Sure! Here are some jokes: haha') : reply(s1)
    }) as unknown as typeof fetch
    const r = await analyzeWithLlm(T, cfg, f)
    expect(n).toBe(2)
    expect(r.bits).toHaveLength(3)
  })

  it('retries without response_format when the provider rejects it', async () => {
    const seen: boolean[] = []
    const f = (async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      seen.push('response_format' in body)
      if ('response_format' in body) return reply('{}', 400)
      const sys = body.messages[0].content as string
      return reply(sys.includes('sequence material') ? routines : sys.includes('find connections') ? links : sys.includes('link two bits') ? { transition: 'Which brings me to something worse.' } : s1)
    }) as unknown as typeof fetch
    const r = await analyzeWithLlm(T, cfg, f)
    expect(r.bits).toHaveLength(3)
    expect(seen).toContain(false)
  })

  it('reports a timeout clearly', async () => {
    const f = (async (_u: string, init: RequestInit) => new Promise((_res, rej) => (init.signal as AbortSignal).addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch
    await expect(analyzeWithLlm(T, { ...cfg, timeoutMs: 20 }, f)).rejects.toThrow(/timed out/)
  })
})

describe('transition endpoint + config', () => {
  it('returns a trimmed transition and never exposes keys', async () => {
    const { f } = mockLlm({}, {}, {}, { transition: '"Speaking of snacks, let me tell you about dating."' })
    const t = await transitionWithLlm('a bit about pretzels', 'a bit about dating', 1, cfg, f)
    expect(t).toBe('Speaking of snacks, let me tell you about dating.')
  })

  it('route: 501 without config, 400 on bad input, 502 on provider failure, 200 on success', async () => {
    const post = (a: ReturnType<typeof createApp>, path: string, body: unknown) => a.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    expect((await post(createApp({ env: {} }), '/api/transition', { from: 'aaa', to: 'bbb' })).status).toBe(501)
    const env = { LLM_API_URL: cfg.url, LLM_MODEL: 'm', LLM_API_KEY: 'sk-secret' }
    const ok = createApp({ env, fetchImpl: (async () => reply({ transition: 'Speaking of dating —' })) as unknown as typeof fetch })
    expect((await post(ok, '/api/transition', { from: 'x', to: 'y' })).status).toBe(400)
    const res = await post(ok, '/api/transition', { from: 'pretzel bit', to: 'dating bit' })
    expect(await res.json()).toEqual({ text: 'Speaking of dating —' })
    const down = createApp({ env, fetchImpl: (async () => { throw new Error('refused') }) as unknown as typeof fetch })
    const bad = await post(down, '/api/analyze', { transcript: T })
    expect(bad.status).toBe(502)
    expect(JSON.stringify(await bad.json())).not.toMatch(/sk-secret/)
  })

  it('reads limits from env with sane bounds', () => {
    expect(llmConfigFromEnv({})).toBeNull()
    expect(llmConfigFromEnv({ LLM_API_URL: 'http://x', LLM_MODEL: 'm', LLM_CHUNK_WORDS: '99999', LLM_MAX_CHUNKS: 'abc' })).toMatchObject({ chunkWords: 600, maxChunks: 8, timeoutMs: 300000 })
    expect(llmConfigFromEnv({ LLM_API_URL: 'http://x', LLM_MODEL: 'm', LLM_CHUNK_WORDS: '400', LLM_TIMEOUT_MS: '60000' })).toMatchObject({ chunkWords: 400, timeoutMs: 60000 })
  })
})
