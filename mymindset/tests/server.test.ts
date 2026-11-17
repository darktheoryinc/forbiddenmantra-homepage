import { describe, expect, it, vi } from 'vitest'
import { createApp, extractJson, locateVerbatim } from '../server/app'
import { parseRss } from '../server/rss'

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title>Airline loses 40 bags &amp; dignity - The Daily Post</title><link>https://example.com/a</link><pubDate>Mon, 16 Nov 2026 09:00:00 GMT</pubDate><source url="https://example.com">The Daily Post</source></item>
<item><title><![CDATA[Phones now have phones]]></title><link>https://example.com/b</link></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
</channel></rss>`

describe('parseRss', () => {
  it('parses real fields, decodes entities, strips source suffix, rejects non-http links', () => {
    const items = parseRss(RSS)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ title: 'Airline loses 40 bags & dignity', source: 'The Daily Post', url: 'https://example.com/a', publishedAt: '2026-11-16T09:00:00.000Z' })
    expect(items[1].title).toBe('Phones now have phones')
    expect(items[1].publishedAt).toBeUndefined()
  })
})

describe('api', () => {
  const app = (env = {}, fetchImpl?: typeof fetch) => createApp({ env, fetchImpl })

  it('status reports unconfigured integrations honestly', async () => {
    const j = await (await app().request('/api/status')).json()
    expect(j.transcription.configured).toBe(false)
    expect(j.analysis.configured).toBe(false)
    expect(j.trends.configured).toBe(true)
  })

  it('returns 501 rather than fake output when AI/transcription are not configured', async () => {
    const a = await app().request('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript: 'a long enough transcript here' }) })
    expect(a.status).toBe(501)
    const t = await app().request('/api/transcribe', { method: 'POST', body: new FormData() })
    expect(t.status).toBe(501)
  })

  it('enforces the access token on everything except status', async () => {
    const a = app({ APP_ACCESS_TOKEN: 'sekret' })
    expect((await a.request('/api/status')).status).toBe(200)
    expect((await a.request('/api/trends?q=cats')).status).toBe(401)
    const ok = vi.fn(async () => new Response(RSS))
    const b = createApp({ env: { APP_ACCESS_TOKEN: 'sekret' }, fetchImpl: ok as unknown as typeof fetch })
    expect((await b.request('/api/trends?q=cats', { headers: { authorization: 'Bearer sekret' } })).status).toBe(200)
  })

  it('validates trend input', async () => {
    expect((await app().request('/api/trends')).status).toBe(400)
    expect((await app().request('/api/trends?q=cats&geo=USA')).status).toBe(400)
  })

  it('fetches trends from the news source, caches, and surfaces upstream failure', async () => {
    const f = vi.fn(async () => new Response(RSS))
    const a = createApp({ env: {}, fetchImpl: f as unknown as typeof fetch })
    const r = await (await a.request('/api/trends?q=airlines&geo=gb')).json()
    expect(r.items).toHaveLength(2); expect(r.geo).toBe('GB')
    await a.request('/api/trends?q=airlines&geo=gb')
    expect(f).toHaveBeenCalledTimes(1)
    const bad = createApp({ env: {}, fetchImpl: (async () => { throw new Error('down') }) as unknown as typeof fetch })
    expect((await bad.request('/api/trends?q=airlines')).status).toBe(502)
  })

  it('analyze validates input, keeps excerpts verbatim and drops invalid routine indexes', async () => {
    const transcript = 'I went to the airport. The pretzel cost eleven dollars. My mother hates flying.'
    const llm = JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify({
      themes: ['airport'], bits: [{ kind: 'observation', excerpt: 'The pretzel  cost eleven dollars.', themes: [], confidence: 0.8, rationale: 'x' }, { kind: 'premise', excerpt: 'Made up line the model invented', themes: [] }],
      routines: [{ title: 'r', theme: 't', bitIndexes: [0, 1, 9], transitions: ['so'] }], callbacks: [],
    }) + '\n```' } }] })
    const a = createApp({ env: { LLM_API_URL: 'https://llm.test/v1/chat/completions', LLM_MODEL: 'm' }, fetchImpl: (async () => new Response(llm)) as unknown as typeof fetch })
    const bad = await a.request('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript: 'short' }) })
    expect(bad.status).toBe(400)
    const res = await a.request('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript }) })
    const j = await res.json()
    expect(j.bits[0].excerpt).toBe('The pretzel cost eleven dollars.')
    expect(transcript.slice(j.bits[0].start, j.bits[0].end)).toBe(j.bits[0].excerpt)
    expect(j.bits[1].start).toBe(-1)
    expect(j.bits[1].rationale).toMatch(/paraphrased/)
    expect(j.routines[0].bitIndexes).toEqual([0, 1])
  })

  it('never leaks credentials in responses', async () => {
    const a = createApp({ env: { LLM_API_URL: 'https://llm.test/x', LLM_MODEL: 'm', LLM_API_KEY: 'sk-secret', TRANSCRIBE_API_URL: 'https://stt.test/x', TRANSCRIBE_API_KEY: 'sk-stt' } })
    expect(await (await a.request('/api/status')).text()).not.toMatch(/sk-/)
  })
})

describe('json helpers', () => {
  it('extracts json from fenced or chatty output', () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('here: {"a":2} bye')).toEqual({ a: 2 })
    expect(() => extractJson('no json')).toThrow()
  })
  it('locates verbatim text across whitespace differences', () => { expect(locateVerbatim('a b  c d', 'b c')).toEqual([2, 6]); expect(locateVerbatim('abc', 'zzz')).toBeNull() })
})
