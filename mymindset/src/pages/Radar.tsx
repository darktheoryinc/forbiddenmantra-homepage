import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, saveSettings, createJoke, uid } from '../lib/db'
import { fetchTrends, getServerStatus, type TrendResponse, type TrendItem } from '../lib/api'
import { Page, Empty, useToast, fmtDate } from '../components/ui'

export const GEOS: Record<string, string> = { US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', IE: 'Ireland', IN: 'India', NZ: 'New Zealand', ZA: 'South Africa', SG: 'Singapore' }

export default function Radar() {
  const toast = useToast()
  const settings = useLiveQuery(() => getSettings(), [])
  const saved = useLiveQuery(() => db.topics.orderBy('savedAt').reverse().toArray(), [])
  const [results, setResults] = useState<Record<string, TrendResponse | { error: string }>>({})
  const [loading, setLoading] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => { getServerStatus().then((s) => setOnline(!!s)) }, [])

  async function refresh() {
    if (!settings) return
    setLoading(true)
    const out: typeof results = {}
    await Promise.all(settings.trendInterests.map(async (t) => {
      try { out[t.id] = await fetchTrends(t.query, settings.geo) } catch (e) { out[t.id] = { error: (e as Error).message } }
    }))
    setResults(out); setLoading(false)
  }
  async function addInterest() {
    const q = newQ.trim()
    if (q.length < 2 || !settings) return
    if (settings.trendInterests.some((t) => t.query.toLowerCase() === q.toLowerCase())) return setNewQ('')
    await saveSettings({ trendInterests: [...settings.trendInterests, { id: uid(), query: q }] })
    setNewQ('')
  }
  async function save(item: TrendItem, query: string) {
    if (saved?.some((t) => t.url === item.url)) return toast('Already saved.')
    const joke = await createJoke({
      title: `Premise: ${item.title.slice(0, 60)}`,
      text: '',
      notes: `Inspired by: ${item.title}\n${item.url}${item.source ? `\nSource: ${item.source}` : ''}${item.publishedAt ? `\nPublished: ${fmtDate(item.publishedAt)}` : ''}`,
      category: 'Current events', tags: [query.toLowerCase()], status: 'idea',
    }).catch(() => null)
    if (!joke) return
    await db.topics.add({ id: uid(), title: item.title, url: item.url, source: item.source, publishedAt: item.publishedAt, query, savedAt: Date.now(), jokeId: joke.id })
    toast('Saved as a premise in your Vault. Write your take!')
  }

  if (!settings) return null
  return (
    <Page title="Trend Radar" actions={<button className="btn primary sm" onClick={refresh} disabled={loading || !settings.trendInterests.length}>{loading ? 'Loading…' : 'Refresh'}</button>}>
      <p className="muted small" style={{ margin: 0 }}>Live headlines from Google News RSS for your interests, linked to their sources. Nothing here is generated or invented; if the feed can't be reached you'll see an error, not made-up news.</p>
      {online === false && <div className="callout warn">The MyMindSet server isn't reachable, so live headlines are unavailable.</div>}
      <section className="card stack">
        <div className="row wrap">
          <div className="field grow"><label htmlFor="geo">Region</label>
            <select id="geo" value={settings.geo} onChange={(e) => saveSettings({ geo: e.target.value })}>{Object.entries(GEOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div className="chips">{settings.trendInterests.map((t) => (
          <span key={t.id} className="chip on">{t.query} <button className="btn ghost sm" style={{ minHeight: 24, padding: '0 6px', color: '#1a1208' }} aria-label={`Remove ${t.query}`} onClick={() => saveSettings({ trendInterests: settings.trendInterests.filter((x) => x.id !== t.id) })}>✕</button></span>
        ))}</div>
        <div className="row"><input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Add a topic: airlines, AI, dating, local politics…" onKeyDown={(e) => e.key === 'Enter' && addInterest()} aria-label="New interest" /><button className="btn" onClick={addInterest} disabled={newQ.trim().length < 2}>Add</button></div>
      </section>

      {settings.trendInterests.map((t) => {
        const r = results[t.id]
        if (!r) return null
        return (
          <section key={t.id} className="stack">
            <h2>{t.query}</h2>
            {'error' in r ? <div className="callout warn">{r.error}</div> : (
              <>
                <div className="muted small">{r.source} · {r.geo} · fetched {new Date(r.fetchedAt).toLocaleTimeString()}</div>
                {r.items.length === 0 ? <Empty title="Nothing in the last 7 days" /> : r.items.map((it) => (
                  <div key={it.url} className="card stack">
                    <a href={it.url} target="_blank" rel="noopener noreferrer"><b>{it.title}</b></a>
                    <div className="muted small">{it.source ?? 'Unknown source'}{it.publishedAt ? ` · ${fmtDate(it.publishedAt)}` : ''}</div>
                    <div><button className="btn sm" onClick={() => save(it, t.query)} disabled={!!saved?.some((s) => s.url === it.url)}>{saved?.some((s) => s.url === it.url) ? 'Saved' : 'Save as premise'}</button></div>
                  </div>
                ))}
              </>
            )}
          </section>
        )
      })}

      {saved && saved.length > 0 && (
        <section className="stack"><h2>Saved premises</h2>
          {saved.map((t) => (
            <div key={t.id} className="card row spread"><div className="grow small"><b>{t.title}</b><div className="muted">{t.source}{t.publishedAt ? ` · ${fmtDate(t.publishedAt)}` : ''}</div></div>
              {t.jokeId && <Link to={`/joke/${t.jokeId}`} className="btn sm">Write it</Link>}</div>
          ))}</section>
      )}
    </Page>
  )
}
