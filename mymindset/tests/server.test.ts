import { describe, expect, it, vi } from 'vitest'
import { createApp, extractJson } from '../server/app'
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

  it('analyze validates input and requires configuration', async () => {
    const a = createApp({ env: { LLM_API_URL: 'https://llm.test/v1/chat/completions', LLM_MODEL: 'm' }, fetchImpl: (async () => new Response('{}')) as unknown as typeof fetch })
    const bad = await a.request('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript: 'short' }) })
    expect(bad.status).toBe(400)
    const none = await a.request('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not json' })
    expect(none.status).toBe(400)
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
})
