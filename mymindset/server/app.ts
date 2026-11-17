import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import { parseRss } from './rss'

export interface ServerEnv {
  APP_ACCESS_TOKEN?: string
  TRANSCRIBE_API_URL?: string
  TRANSCRIBE_API_KEY?: string
  TRANSCRIBE_MODEL?: string
  LLM_API_URL?: string
  LLM_API_KEY?: string
  LLM_MODEL?: string
}

export interface AppDeps {
  env: ServerEnv
  fetchImpl?: typeof fetch
  now?: () => number
}

const analyzeInput = z.object({ transcript: z.string().trim().min(10, 'Transcript is too short').max(60_000, 'Transcript is too long') })
const trendsQuery = z.object({
  q: z.string().trim().min(2).max(80),
  geo: z.string().trim().regex(/^[A-Za-z]{2}$/, 'geo must be a 2-letter country code').default('US'),
  limit: z.coerce.number().int().min(1).max(30).default(12),
})

const llmBit = z.object({
  kind: z.enum(['premise', 'setup-punchline', 'story', 'observation', 'callback']).catch('premise'),
  excerpt: z.string().min(3),
  setup: z.string().optional(),
  punchline: z.string().optional(),
  themes: z.array(z.string()).catch([]).default([]),
  confidence: z.number().min(0).max(1).catch(0.5).default(0.5),
  rationale: z.string().catch('').default(''),
})
const llmOut = z.object({
  themes: z.array(z.string()).catch([]).default([]),
  bits: z.array(llmBit).default([]),
  routines: z.array(z.object({
    title: z.string(), theme: z.string().catch('').default(''),
    bitIndexes: z.array(z.number().int().min(0)), transitions: z.array(z.string()).catch([]).default([]),
  })).catch([]).default([]),
  callbacks: z.array(z.object({ phrase: z.string(), bitIndexes: z.array(z.number().int().min(0)) })).catch([]).default([]),
})

const SYSTEM_PROMPT = `You are a writing assistant for a stand-up comedian. You are given a spoken ramble transcript.
Find joke candidates. RULES: (1) "excerpt" must be copied VERBATIM from the transcript — never rewrite the comedian's words. (2) Put suggested structure in setup/punchline only as verbatim sub-spans of the excerpt. (3) Propose routines (ordered groups of bits by index) and short transitions between consecutive bits; transitions are your own suggestions. (4) Reply with ONLY a JSON object:
{"themes":[string],"bits":[{"kind":"premise|setup-punchline|story|observation|callback","excerpt":string,"setup":string?,"punchline":string?,"themes":[string],"confidence":0..1,"rationale":string}],"routines":[{"title":string,"theme":string,"bitIndexes":[int],"transitions":[string]}],"callbacks":[{"phrase":string,"bitIndexes":[int]}]}`

export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = (fenced ? fenced[1] : text).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Model did not return JSON')
  return JSON.parse(body.slice(start, end + 1))
}

/** Locate `needle` in `haystack` ignoring whitespace differences. Returns [start,end] or null. */
export function locateVerbatim(haystack: string, needle: string): [number, number] | null {
  const direct = haystack.indexOf(needle)
  if (direct >= 0) return [direct, direct + needle.length]
  const esc = needle.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
  if (!esc) return null
  const m = new RegExp(esc, 'i').exec(haystack)
  return m ? [m.index, m.index + m[0].length] : null
}

export function createApp({ env, fetchImpl = fetch, now = Date.now }: AppDeps) {
  const app = new Hono()
  const transcribeOn = !!env.TRANSCRIBE_API_URL
  const llmOn = !!(env.LLM_API_URL && env.LLM_MODEL)

  // Optional shared-secret gate. When APP_ACCESS_TOKEN is set every /api route except /api/status requires it.
  app.use('/api/*', async (c, next) => {
    if (!env.APP_ACCESS_TOKEN || c.req.path === '/api/status') return next()
    const got = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    if (got.length !== env.APP_ACCESS_TOKEN.length || got !== env.APP_ACCESS_TOKEN) return c.json({ error: 'Unauthorized' }, 401)
    return next()
  })

  app.get('/api/status', (c) =>
    c.json({
      ok: true,
      authRequired: !!env.APP_ACCESS_TOKEN,
      transcription: { configured: transcribeOn, provider: transcribeOn ? new URL(env.TRANSCRIBE_API_URL!).host : undefined },
      analysis: { configured: llmOn, provider: llmOn ? `${new URL(env.LLM_API_URL!).host} (${env.LLM_MODEL})` : undefined },
      trends: { configured: true, provider: 'Google News RSS (public, no key)' },
    }),
  )

  app.post('/api/transcribe', bodyLimit({ maxSize: 25 * 1024 * 1024, onError: (c) => c.json({ error: 'Audio file too large (25 MB max)' }, 413) }), async (c) => {
    if (!transcribeOn) return c.json({ error: 'Transcription is not configured on this server. Set TRANSCRIBE_API_URL.' }, 501)
    let form: FormData
    try { form = await c.req.formData() } catch { return c.json({ error: 'Expected multipart form data with an "audio" file' }, 400) }
    const file = form.get('audio')
    if (!(file instanceof File) || file.size === 0) return c.json({ error: 'Missing "audio" file' }, 400)
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) return c.json({ error: 'Unsupported file type' }, 415)
    const out = new FormData()
    out.set('file', file, file.name || 'recording.webm')
    out.set('model', env.TRANSCRIBE_MODEL ?? 'whisper-1')
    out.set('response_format', 'json')
    try {
      const res = await fetchImpl(env.TRANSCRIBE_API_URL!, {
        method: 'POST', body: out,
        headers: env.TRANSCRIBE_API_KEY ? { Authorization: `Bearer ${env.TRANSCRIBE_API_KEY}` } : undefined,
      })
      if (!res.ok) return c.json({ error: `Transcription provider returned ${res.status}` }, 502)
      const data = (await res.json()) as { text?: unknown }
      if (typeof data.text !== 'string') return c.json({ error: 'Transcription provider returned an unexpected response' }, 502)
      return c.json({ text: data.text })
    } catch { return c.json({ error: 'Could not reach the transcription provider' }, 502) }
  })

  app.post('/api/analyze', async (c) => {
    if (!llmOn) return c.json({ error: 'AI analysis is not configured on this server. Set LLM_API_URL and LLM_MODEL.' }, 501)
    const parsed = analyzeInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400)
    const { transcript } = parsed.data
    try {
      const res = await fetchImpl(env.LLM_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(env.LLM_API_KEY ? { Authorization: `Bearer ${env.LLM_API_KEY}` } : {}) },
        body: JSON.stringify({
          model: env.LLM_MODEL, temperature: 0.4,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: transcript }],
        }),
      })
      if (!res.ok) return c.json({ error: `AI provider returned ${res.status}` }, 502)
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const content = data.choices?.[0]?.message?.content
      if (!content) return c.json({ error: 'AI provider returned an empty response' }, 502)
      const out = llmOut.parse(extractJson(content))
      const bits = out.bits.map((b) => {
        const loc = locateVerbatim(transcript, b.excerpt)
        return {
          ...b,
          excerpt: loc ? transcript.slice(loc[0], loc[1]) : b.excerpt,
          start: loc ? loc[0] : -1, end: loc ? loc[1] : -1,
          rationale: loc ? b.rationale : `${b.rationale} (Not found verbatim in transcript — model paraphrased.)`.trim(),
        }
      })
      const ok = (i: number) => i < bits.length
      return c.json({
        themes: out.themes, bits,
        routines: out.routines.map((r) => ({ ...r, bitIndexes: r.bitIndexes.filter(ok) })).filter((r) => r.bitIndexes.length >= 2),
        callbacks: out.callbacks.map((cb) => ({ ...cb, bitIndexes: cb.bitIndexes.filter(ok) })).filter((cb) => cb.bitIndexes.length >= 2),
      })
    } catch (e) {
      return c.json({ error: e instanceof SyntaxError || (e instanceof Error && e.message.includes('JSON')) ? 'AI provider returned malformed output' : 'Could not complete AI analysis' }, 502)
    }
  })

  const cache = new Map<string, { at: number; data: unknown }>()
  app.get('/api/trends', async (c) => {
    const q = trendsQuery.safeParse({ q: c.req.query('q'), geo: c.req.query('geo') || undefined, limit: c.req.query('limit') || undefined })
    if (!q.success) return c.json({ error: q.error.issues[0]?.message ?? 'Invalid query' }, 400)
    const { q: query, geo, limit } = q.data
    const key = `${query.toLowerCase()}|${geo.toUpperCase()}|${limit}`
    const hit = cache.get(key)
    if (hit && now() - hit.at < 10 * 60_000) return c.json(hit.data)
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:7d`)}&hl=en-${geo.toUpperCase()}&gl=${geo.toUpperCase()}&ceid=${geo.toUpperCase()}:en`
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': 'MyMindSet/0.1 (+trend-radar)' } })
      if (!res.ok) return c.json({ error: `News source returned ${res.status}` }, 502)
      const items = parseRss(await res.text(), limit)
      const data = { query, geo: geo.toUpperCase(), source: 'Google News RSS', fetchedAt: new Date(now()).toISOString(), items }
      cache.set(key, { at: now(), data })
      return c.json(data)
    } catch { return c.json({ error: 'Could not reach the news source' }, 502) }
  })

  return app
}
