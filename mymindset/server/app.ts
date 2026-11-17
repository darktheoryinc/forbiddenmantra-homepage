import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import { parseRss } from './rss'
import { analyzeWithLlm, transitionWithLlm, llmConfigFromEnv, LlmError } from './llm'

export { extractJson } from './llm'

export interface ServerEnv {
  APP_ACCESS_TOKEN?: string
  TRANSCRIBE_API_URL?: string
  TRANSCRIBE_API_KEY?: string
  TRANSCRIBE_MODEL?: string
  LLM_API_URL?: string
  LLM_API_KEY?: string
  LLM_MODEL?: string
  LLM_TIMEOUT_MS?: string
  LLM_CHUNK_WORDS?: string
  LLM_MAX_CHUNKS?: string
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

const transitionInput = z.object({
  from: z.string().trim().min(3).max(2000),
  to: z.string().trim().min(3).max(2000),
  variant: z.coerce.number().int().min(0).max(20).default(0),
})

export function createApp({ env, fetchImpl = fetch, now = Date.now }: AppDeps) {
  const app = new Hono()
  const transcribeOn = !!env.TRANSCRIBE_API_URL
  const llm = llmConfigFromEnv(env as Record<string, string | undefined>)
  const llmOn = !!llm

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
      analysis: { configured: llmOn, provider: llmOn ? `${new URL(env.LLM_API_URL!).host} (${env.LLM_MODEL})` : undefined, model: llm?.model },
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
    if (!llm) return c.json({ error: 'AI analysis is not configured on this server. Set LLM_API_URL and LLM_MODEL.' }, 501)
    const parsed = analyzeInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400)
    try {
      return c.json(await analyzeWithLlm(parsed.data.transcript, llm, fetchImpl, now))
    } catch (e) {
      return c.json({ error: e instanceof LlmError ? e.message : 'Could not complete AI analysis' }, 502)
    }
  })

  app.post('/api/transition', async (c) => {
    if (!llm) return c.json({ error: 'AI is not configured on this server. Set LLM_API_URL and LLM_MODEL.' }, 501)
    const parsed = transitionInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400)
    try {
      return c.json({ text: await transitionWithLlm(parsed.data.from, parsed.data.to, parsed.data.variant, llm, fetchImpl) })
    } catch (e) {
      return c.json({ error: e instanceof LlmError ? e.message : 'Could not complete AI request' }, 502)
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
