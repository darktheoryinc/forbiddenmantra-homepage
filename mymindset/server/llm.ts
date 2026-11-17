/**
 * Two-stage LLM pipeline for Ramble → Routine, designed for small local models (e.g. Ollama).
 *
 * Source preservation by construction: the model never returns joke text. It points at numbered
 * sentences of the transcript ("from 12 to 14, payoff at 14") and the server cuts every excerpt,
 * setup and punchline out of the real transcript. The only model-written text that survives is
 * short transitions and one-line explanations, which are always labeled as AI-generated.
 */
import { z } from 'zod'
import { segment, contentWords, type Segment } from '../src/ai/heuristic'
import type { AnalysisResult, RawBit, RawRoutine, RawCallback, RawConnection, AnalysisMeta } from '../src/ai/types'

export interface LlmConfig {
  url: string
  model: string
  key?: string
  timeoutMs: number
  chunkWords: number
  maxChunks: number
}

export function llmConfigFromEnv(env: Record<string, string | undefined>): LlmConfig | null {
  if (!env.LLM_API_URL || !env.LLM_MODEL) return null
  const num = (v: string | undefined, d: number, min: number, max: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= min && n <= max ? n : d
  }
  return {
    url: env.LLM_API_URL, model: env.LLM_MODEL, key: env.LLM_API_KEY || undefined,
    timeoutMs: num(env.LLM_TIMEOUT_MS, 300_000, 5_000, 1_800_000),
    chunkWords: num(env.LLM_CHUNK_WORDS, 600, 150, 4_000),
    maxChunks: num(env.LLM_MAX_CHUNKS, 8, 1, 40),
  }
}

// ---------- low-level call ----------
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = (fenced ? fenced[1] : text).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Model did not return JSON')
  return JSON.parse(body.slice(start, end + 1))
}

type Msg = { role: 'system' | 'user'; content: string }

export class LlmError extends Error {}

async function chat(cfg: LlmConfig, f: typeof fetch, messages: Msg[], temperature: number, jsonMode = true): Promise<string> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs)
  try {
    const res = await f(cfg.url, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}) },
      body: JSON.stringify({ model: cfg.model, temperature, messages, stream: false, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) }),
    })
    // Some OpenAI-compatible servers reject response_format; retry once without it.
    if (res.status === 400 && jsonMode) return chat(cfg, f, messages, temperature, false)
    if (!res.ok) throw new LlmError(`AI provider returned ${res.status}`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new LlmError('AI provider returned an empty response')
    return content
  } catch (e) {
    if (e instanceof LlmError) throw e
    if ((e as Error).name === 'AbortError') throw new LlmError(`AI provider timed out after ${Math.round(cfg.timeoutMs / 1000)}s`)
    throw new LlmError('Could not reach the AI provider')
  } finally { clearTimeout(timer) }
}

/** One model call that must yield JSON matching `schema`; retries once with a corrective nudge. */
async function chatJson<T>(cfg: LlmConfig, f: typeof fetch, system: string, user: string, schema: z.ZodType<T>, temperature = 0.2): Promise<T> {
  let lastErr = 'malformed output'
  for (let attempt = 0; attempt < 2; attempt++) {
    const msgs: Msg[] = [{ role: 'system', content: system }, { role: 'user', content: attempt ? `${user}\n\nYour previous reply was not valid JSON in the required shape. Reply with ONLY the JSON object.` : user }]
    const text = await chat(cfg, f, msgs, temperature)
    try { return schema.parse(extractJson(text)) } catch (e) { lastErr = e instanceof Error ? e.message : String(e) }
  }
  throw new LlmError(`AI provider returned malformed output (${lastErr.slice(0, 80)})`)
}

// ---------- stage 1: find bits ----------
const STAGE1_SYSTEM = `You help a stand-up comedian mine a spoken ramble for material. The ramble is split into numbered sentences. You only POINT at sentence numbers. Never write, rewrite, quote, correct or improve any joke, setup or punchline.

A comedian's ramble usually contains several usable bits. Find every passage with comedic potential: a premise, an observation, a story, or a setup followed by a payoff. A passage is 1 to 5 consecutive sentences. Reply with ONLY a JSON object:
{"bits":[{"from":1,"to":4,"kind":"setup-punchline","punch_at":3,"themes":["landlord","midnight"]}]}

Fields:
- from / to: first and last sentence number of the passage (inclusive).
- kind: one of premise, setup-punchline, story, observation.
- punch_at: the sentence number where the payoff lands. Leave it out if the passage has no payoff.
- themes: up to 3 single words that appear in the passage.

Example. Input:
[1] So my landlord texts me at midnight.
[2] "Hey, quick question."
[3] Nothing at midnight is a quick question.
[4] That's a hostage negotiation.
[5] Anyway I've been trying to eat healthier.
[6] I bought a juicer.
[7] It's now a very expensive place where fruit goes to be judged.
[8] I use it twice a year.
Output:
{"bits":[{"from":1,"to":4,"kind":"setup-punchline","punch_at":3,"themes":["landlord","midnight"]},{"from":5,"to":8,"kind":"story","punch_at":7,"themes":["juicer","healthier"]}]}

Skip only plain filler and logistics. Return at most 8 bits, in order.`

const num = z.coerce.number().int()
const stage1Schema = z.object({
  bits: z.array(z.object({
    from: num, to: num,
    kind: z.string().catch('premise').default('premise'),
    punch_at: num.nullish().catch(undefined),
    themes: z.array(z.string()).catch([]).default([]),
  }).passthrough().or(z.any().transform(() => null))).default([]),
})

const KINDS = new Set(['premise', 'setup-punchline', 'story', 'observation'])
const MAX_SPAN = 6

export function chunkRanges(segs: Segment[], maxWords: number, overlap = 4): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = []
  let i = 0
  while (i < segs.length) {
    let words = 0, j = i
    while (j < segs.length && (words + wc(segs[j].text) <= maxWords || j === i)) { words += wc(segs[j].text); j++ }
    ranges.push({ from: i, to: j - 1 })
    if (j >= segs.length) break
    i = Math.max(i + 1, j - overlap)
  }
  return ranges
}
const wc = (s: string) => (s.match(/\S+/g) ?? []).length

export interface ValidatedBit extends RawBit { fromIdx: number; toIdx: number }

/** Turn model pointers into verbatim bits. Anything out of range or malformed is dropped and counted. */
export function validateBits(raw: z.infer<typeof stage1Schema>, segs: Segment[], transcript: string, range: { from: number; to: number }): { bits: ValidatedBit[]; dropped: number } {
  const bits: ValidatedBit[] = []
  let dropped = 0
  for (const r of raw.bits) {
    if (!r || typeof r !== 'object') { dropped++; continue }
    const b = r as { from: number; to: number; kind: string; punch_at?: number | null; themes: string[] }
    const from = b.from - 1
    let to = b.to - 1 // model sees 1-based numbers
    if (!(from >= range.from && to <= range.to && from <= to)) { dropped++; continue }
    if (to - from >= MAX_SPAN) to = from + MAX_SPAN - 1 // models ignore length limits; keep the opening sentences rather than lose the bit
    const start = segs[from].start, end = segs[to].end
    const excerpt = transcript.slice(start, end)
    if (wc(excerpt) < 4) { dropped++; continue }
    const out: ValidatedBit = {
      kind: (KINDS.has(b.kind) ? b.kind : 'premise') as RawBit['kind'],
      excerpt, start, end, themes: [], rationale: '', fromIdx: from, toIdx: to,
    }
    const p = typeof b.punch_at === 'number' ? b.punch_at - 1 : undefined
    if (p !== undefined && p > from && p <= to) {
      out.setup = transcript.slice(start, segs[p - 1].end)
      out.punchline = transcript.slice(segs[p].start, end)
      if (out.kind !== 'story') out.kind = 'setup-punchline'
    }
    const have = new Set(contentWords(excerpt))
    out.themes = [...new Set(b.themes.map((t) => String(t).toLowerCase().trim()).filter((t) => t.length >= 3 && t.length <= 24 && contentWords(t).every((w) => have.has(w)) && contentWords(t).length > 0))].slice(0, 3)
    // No model-written explanation: small models describe the wrong passage, and a wrong reason is worse than none.
    out.rationale = `AI flagged this as ${out.setup ? 'a setup and payoff' : `a ${out.kind}`}.`
    bits.push(out)
  }
  return { bits, dropped }
}

/** Merge bits from overlapping chunks: keep the first, drop later ones that overlap it by half or more. */
export function dedupeBits(bits: ValidatedBit[]): ValidatedBit[] {
  const sorted = [...bits].sort((a, b) => a.fromIdx - b.fromIdx || a.toIdx - b.toIdx)
  const kept: ValidatedBit[] = []
  for (const b of sorted) {
    const clash = kept.some((k) => {
      const ov = Math.min(k.toIdx, b.toIdx) - Math.max(k.fromIdx, b.fromIdx) + 1
      return ov > 0 && ov >= Math.min(k.toIdx - k.fromIdx + 1, b.toIdx - b.fromIdx + 1) / 2
    })
    if (!clash) kept.push(b)
  }
  return kept
}

// ---------- stage 2: arrange (small single-purpose calls; small models fail at one big prompt) ----------
const ROUTINE_SYSTEM = `You help a stand-up comedian sequence material. You receive numbered bits (the comedian's own words, possibly shortened). Group related bits into routines and put each routine in an order that builds. Pick the bit that would make the strongest closer. Do not write anything else: no jokes, no new text.

Reply with ONLY a JSON object:
{"routines":[{"title":"Topic label","order":[2,5,6],"closer":6}]}

Rules:
- order: bit numbers. 2 to 6 bits per routine. A bit belongs to at most one routine. Leave out bits that fit nowhere.
- title: 2 to 4 words naming the topic.
- closer: one number from order (the bit to end on).
- Try to place EVERY bit in a routine. Bits on the same subject belong together. Return {"routines":[]} only if nothing relates.`

const routineSchema = z.object({
  routines: z.array(z.object({
    title: z.string().catch('Routine').default('Routine'),
    order: z.array(num).catch([]).default([]),
    closer: num.nullish().catch(undefined),
  }).passthrough()).catch([]).default([]),
})

const LINKS_SYSTEM = `You help a stand-up comedian find connections in their material. You receive numbered bits (the comedian's own words, possibly shortened). Do not write jokes.

Reply with ONLY a JSON object:
{"callbacks":[{"phrase":"juicer"}],"connections":[{"a":1,"b":6,"a_quote":"exact words from bit 1","b_quote":"exact words from bit 6","why":"Both are about feeling powerless against a system."}]}

- callbacks: a word or short phrase that appears in two or more bits, so the comedian can call back to it. Copy it exactly as written in the bits. Give only the phrase.
- connections: up to 3 pairs of bits about DIFFERENT topics that share a deeper theme or attitude. a_quote and b_quote must each be 3 to 10 words copied EXACTLY from that bit and show the link. why is one plain sentence under 25 words that only refers to what the quotes say. Skip pairs that are simply about the same topic.
- Return empty lists if there is nothing.`

// Small models mix shapes (strings where objects belong), so each element is parsed leniently and junk is skipped, not fatal.
const junk = z.any().transform(() => null)
const linksSchema = z.object({
  callbacks: z.array(z.union([z.string(), z.object({ phrase: z.string() }).passthrough(), junk])).catch([]).default([]),
  connections: z.array(z.object({ a: num, b: num, a_quote: z.string().catch('').default(''), b_quote: z.string().catch('').default(''), why: z.string().catch('').default('') }).or(junk)).catch([]).default([]),
})

const trimWords = (s: string, n: number) => { const w = s.split(' '); return w.length > n ? `${w.slice(0, n).join(' ')}…` : s }
const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '').trim().slice(0, max)

export function validateRoutines(raw: z.infer<typeof routineSchema>, bits: RawBit[]): { routines: RawRoutine[]; dropped: number } {
  let dropped = 0
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= bits.length
  const used = new Set<number>()
  const routines: RawRoutine[] = []
  for (const r of raw.routines) {
    const order: number[] = []
    for (const n of r.order) if (ok(n) && !used.has(n) && !order.includes(n)) order.push(n)
    if (order.length < 2) { dropped++; continue }
    const kept = order.slice(0, 6)
    kept.forEach((n) => used.add(n))
    const closerIndex = typeof r.closer === 'number' && kept.includes(r.closer) ? r.closer - 1 : undefined
    routines.push({ title: clean(r.title, 60) || 'Routine', theme: '', bitIndexes: kept.map((n) => n - 1), transitions: kept.slice(1).map(() => ''), closerIndex })
  }
  return { routines, dropped }
}

export function validateLinks(raw: z.infer<typeof linksSchema>, bits: RawBit[]): { callbacks: RawCallback[]; connections: RawConnection[]; dropped: number } {
  let dropped = 0
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= bits.length
  const haves = bits.map((b) => new Set(contentWords(b.excerpt)))
  const callbacks: RawCallback[] = []
  for (const c of raw.callbacks) {
    const phrase = clean(typeof c === 'string' ? c : c && typeof (c as { phrase?: unknown }).phrase === 'string' ? (c as { phrase: string }).phrase : '', 40)
    const need = contentWords(phrase)
    if (phrase.length < 3 || !need.length) { dropped++; continue }
    // We don't trust the model's bit numbers: a callback is every bit where the phrase literally occurs.
    const idx = haves.map((h, i) => (need.every((w) => h.has(w)) ? i : -1)).filter((i) => i >= 0)
    if (idx.length < 2 || callbacks.some((x) => x.phrase.toLowerCase() === phrase.toLowerCase())) { dropped++; continue }
    callbacks.push({ phrase, bitIndexes: idx })
  }
  const connections: RawConnection[] = []
  const seen = new Set<string>()
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const quoteIn = (q: string, bit: RawBit) => { const n = norm(q); return wc(n) >= 2 && norm(bit.excerpt).includes(n) }
  for (const c of raw.connections) {
    if (!c) { dropped++; continue }
    const why = clean(c.why ?? '', 200)
    const key = [c.a, c.b].sort().join('-')
    if (!ok(c.a) || !ok(c.b) || c.a === c.b || wc(why) < 4 || seen.has(key)) { dropped++; continue }
    // Evidence rule: both quotes must be the comedian's real words from the right bits, or the connection is dropped.
    if (!quoteIn(c.a_quote ?? '', bits[c.a - 1]) || !quoteIn(c.b_quote ?? '', bits[c.b - 1])) { dropped++; continue }
    // "Seemingly unrelated": bits sharing several content words are the same topic, not a surprising link.
    const shared = [...haves[c.a - 1]].filter((w) => haves[c.b - 1].has(w)).length
    if (shared >= 2) { dropped++; continue }
    seen.add(key)
    connections.push({ a: c.a - 1, b: c.b - 1, why, aQuote: trimWords(clean(c.a_quote, 400), 14), bQuote: trimWords(clean(c.b_quote, 400), 14) })
  }
  return { callbacks: callbacks.slice(0, 6), connections: connections.slice(0, 5), dropped }
}

const PLACEHOLDERS = /spoken (bridge|connective)|bridge from|first to second|short reason|how these/i
// A transition must not narrate or make claims in the comedian's voice ("that's when I realized…").
const NARRATIVE = /\b(that'?s when|i|we|my|me) (realized|decided|learned|found out|knew|started|went|told|said|thought|felt|remember)\b|\bthat'?s when\b/i

/**
 * A transition is the one piece of model-written text in a set, so it must be a real bridge:
 * 3–20 words, not an echo of the prompt, and not the comedian's own sentences copied back.
 */
export function validTransition(text: string, neighbours: string[]): boolean {
  const words = (text.toLowerCase().match(/[a-z'’]+/g) ?? [])
  if (words.length < 3 || words.length > 20 || PLACEHOLDERS.test(text) || NARRATIVE.test(text)) return false
  return !neighbours.some((n) => {
    const have = new Set((n.toLowerCase().match(/[a-z'’]+/g) ?? []))
    return words.filter((w) => have.has(w)).length / words.length >= 0.7
  })
}

// ---------- orchestration ----------
export async function analyzeWithLlm(transcript: string, cfg: LlmConfig, f: typeof fetch = fetch, now: () => number = Date.now): Promise<AnalysisResult> {
  const t0 = now()
  const segs = segment(transcript)
  if (segs.length < 2) throw new LlmError('Transcript is too short to analyze')
  const warnings: string[] = []
  let dropped = 0

  const ranges = chunkRanges(segs, cfg.chunkWords)
  const used = ranges.slice(0, cfg.maxChunks)
  if (ranges.length > used.length) warnings.push(`Long transcript: analyzed the first ${used.length} of ${ranges.length} sections.`)

  const found: ValidatedBit[] = []
  let failed = 0
  let lastError = ''
  for (const range of used) {
    const numbered = segs.slice(range.from, range.to + 1).map((s, k) => `[${range.from + k + 1}] ${s.text.replace(/\s+/g, ' ')}`).join('\n')
    try {
      const raw = await chatJson(cfg, f, STAGE1_SYSTEM, numbered, stage1Schema)
      const v = validateBits(raw, segs, transcript, range)
      dropped += v.dropped
      found.push(...v.bits)
    } catch (e) { failed++; lastError = (e as Error).message }
  }
  if (failed === used.length) throw new LlmError(lastError || 'AI analysis failed')
  if (failed) warnings.push(`${failed} of ${used.length} sections could not be analyzed (${lastError}).`)

  const bits = dedupeBits(found)
  const meta: AnalysisMeta = { model: cfg.model, chunks: used.length, chunksFailed: failed, dropped, warnings, ms: 0 }
  const themeCount = new Map<string, number>()
  bits.forEach((b) => b.themes.forEach((t) => themeCount.set(t, (themeCount.get(t) ?? 0) + 1)))
  const themes = [...themeCount].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t)
  const strip = (b: ValidatedBit): RawBit => ({ kind: b.kind, excerpt: b.excerpt, start: b.start, end: b.end, setup: b.setup, punchline: b.punchline, themes: b.themes, rationale: b.rationale })
  const finalBits = bits.map(strip)

  let routines: RawRoutine[] = [], callbacks: RawCallback[] = [], connections: RawConnection[] = []
  if (finalBits.length >= 2) {
    const slice = finalBits.slice(0, 40)
    const listing = slice.map((b, i) => `Bit ${i + 1}: ${b.excerpt.replace(/\s+/g, ' ').slice(0, 180)}`).join('\n')
    try {
      // A small model tends to group only the obvious bits. Re-offer the leftovers (renumbered) for up to two more passes.
      let remaining = slice.map((_, i) => i)
      for (let pass = 0; pass < 3 && remaining.length >= 2; pass++) {
        const sub = remaining.map((i) => slice[i])
        const list = sub.map((b, i) => `Bit ${i + 1}: ${b.excerpt.replace(/\s+/g, ' ').slice(0, 180)}`).join('\n')
        const v = validateRoutines(await chatJson(cfg, f, ROUTINE_SYSTEM, list, routineSchema, 0.3), sub)
        dropped += v.dropped
        if (!v.routines.length) break
        for (const r of v.routines) {
          r.bitIndexes = r.bitIndexes.map((i) => remaining[i])
          if (r.closerIndex !== undefined) r.closerIndex = remaining[r.closerIndex]
          r.theme = themeOf(r.bitIndexes.map((i) => finalBits[i]))
          routines.push(r)
        }
        const placed = new Set(routines.flatMap((r) => r.bitIndexes))
        remaining = remaining.filter((i) => !placed.has(i))
      }
    } catch (e) { if (!routines.length) warnings.push(`Routine assembly failed (${(e as Error).message}); candidates are listed without routines.`) }
    try {
      const v = validateLinks(await chatJson(cfg, f, LINKS_SYSTEM, listing, linksSchema, 0.3), slice)
      callbacks = v.callbacks; connections = v.connections; dropped += v.dropped
    } catch (e) { warnings.push(`Connection search failed (${(e as Error).message}).`) }
    // Transitions: one focused call per adjacent pair. A bad or failed bridge stays empty; we never fill it with canned text.
    let blank = 0
    for (const r of routines) {
      for (let k = 0; k < r.transitions.length; k++) {
        const a = finalBits[r.bitIndexes[k]], b = finalBits[r.bitIndexes[k + 1]]
        try { r.transitions[k] = await transitionWithLlm(a.excerpt, b.excerpt, 0, cfg, f) } catch { blank++ }
      }
    }
    if (blank) warnings.push(`${blank} transition${blank === 1 ? '' : 's'} could not be generated; write your own.`)
  }
  meta.dropped = dropped
  meta.ms = now() - t0
  return { themes, bits: finalBits, routines, callbacks, connections, meta }
}

function themeOf(bits: RawBit[]): string {
  const c = new Map<string, number>()
  bits.forEach((b) => b.themes.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)))
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

// ---------- single transition ----------
const transitionSchema = z.object({ transition: z.string().min(2) })
const TRANSITION_SYSTEM = `You help a stand-up comedian link two bits. Write ONE short spoken phrase (5 to 15 words) that bridges from the end of the first bit into the second. It must not be a joke, must not describe events or say what the comedian thought, felt, realized or did, and must not repeat sentences from either bit. Use neutral stage patter such as "Speaking of X," or "Which brings me to Y." Reply with ONLY JSON: {"transition":"<your phrase>"}`

export async function transitionWithLlm(from: string, to: string, variant: number, cfg: LlmConfig, f: typeof fetch = fetch): Promise<string> {
  const user = `First bit (ends): ${from.slice(-350)}\n\nSecond bit (starts): ${to.slice(0, 350)}`
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chatJson(cfg, f, TRANSITION_SYSTEM, user, transitionSchema, 0.3 + 0.2 * ((variant + attempt) % 3))
    const t = clean(out.transition, 160)
    if (validTransition(t, [from, to])) return t
  }
  throw new LlmError('AI provider did not return a usable transition')
}
