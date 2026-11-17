import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteJoke, updateJoke } from '../lib/db'
import { JOKE_STATUSES, type JokeStatus } from '../lib/types'
import { estimateJokeSeconds } from '../lib/duration'
import { getSettings, saveSettings } from '../lib/db'
import { Page, OriginBadge, Empty, useToast, fmtDate } from '../components/ui'
import { useCategories } from './Vault'

export default function JokeDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const joke = useLiveQuery(() => db.jokes.get(id), [id])
  const revisions = useLiveQuery(() => db.revisions.where('jokeId').equals(id).reverse().sortBy('savedAt'), [id])
  const source = useLiveQuery(async () => { const j = await db.jokes.get(id); return j?.sourceRecordingId ? db.recordings.get(j.sourceRecordingId) : undefined }, [id])
  const cats = useCategories()
  const [f, setF] = useState({ title: '', text: '', setup: '', punchline: '', notes: '', tags: '', category: '', status: 'idea' as JokeStatus, dur: '' })
  const [newCat, setNewCat] = useState('')

  useEffect(() => {
    if (joke) setF({ title: joke.title, text: joke.text, setup: joke.setup ?? '', punchline: joke.punchline ?? '', notes: joke.notes, tags: joke.tags.join(', '), category: joke.category, status: joke.status, dur: joke.durationSec ? String(joke.durationSec) : '' })
  }, [joke?.id, joke?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (joke === undefined) return <Page title="Loading…"><div /></Page>
  if (!joke) return <Page title="Not found"><Empty title="Joke not found"><Link to="/vault">Back to Vault</Link></Empty></Page>

  async function save() {
    if (!f.text.trim()) return toast('A joke needs some text.', 'err')
    const dur = f.dur.trim() ? Number(f.dur) : undefined
    if (dur !== undefined && (!Number.isFinite(dur) || dur < 0 || dur > 1800)) return toast('Duration must be 0–1800 seconds.', 'err')
    await updateJoke(id, {
      title: f.title.trim() || joke!.title, text: f.text, setup: f.setup || undefined, punchline: f.punchline || undefined,
      notes: f.notes, category: f.category, status: f.status, durationSec: dur || undefined,
      tags: [...new Set(f.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))],
    })
    toast('Saved. Previous wording kept in revisions.')
  }
  async function addCategory() {
    const c = newCat.trim()
    if (!c || cats.includes(c)) return
    const s = await getSettings()
    await saveSettings({ customCategories: [...s.customCategories, c] })
    setF({ ...f, category: c }); setNewCat('')
  }
  async function remove() {
    if (!confirm('Delete this joke? It will also be removed from your sets (saved set versions keep a record).')) return
    await deleteJoke(id)
    nav('/vault')
  }
  const dirty = JSON.stringify(f) !== JSON.stringify({ title: joke.title, text: joke.text, setup: joke.setup ?? '', punchline: joke.punchline ?? '', notes: joke.notes, tags: joke.tags.join(', '), category: joke.category, status: joke.status, dur: joke.durationSec ? String(joke.durationSec) : '' })

  return (
    <Page title="Joke" actions={<button className="btn ghost sm danger" onClick={remove}>Delete</button>}>
      <div className="row wrap"><OriginBadge origin={joke.origin} /><span className="muted small">Created {fmtDate(joke.createdAt)} · est. {estimateJokeSeconds({ text: f.text, durationSec: f.dur ? Number(f.dur) : undefined })}s on stage</span></div>
      <section className="card stack">
        <div className="field"><label htmlFor="jt">Title</label><input id="jt" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="jx">The bit</label><textarea id="jx" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} style={{ minHeight: 160 }} /></div>
        <div className="field"><label htmlFor="js">Setup (optional)</label><textarea id="js" value={f.setup} onChange={(e) => setF({ ...f, setup: e.target.value })} style={{ minHeight: 60 }} /></div>
        <div className="field"><label htmlFor="jp">Punchline (optional)</label><textarea id="jp" value={f.punchline} onChange={(e) => setF({ ...f, punchline: e.target.value })} style={{ minHeight: 60 }} /></div>
        <div className="row wrap">
          <div className="field grow"><label htmlFor="jc">Category</label>
            <select id="jc" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field grow"><label htmlFor="jst">Status</label>
            <select id="jst" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as JokeStatus })}>{JOKE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="row"><input placeholder="Add custom category" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="New category" /><button className="btn" onClick={addCategory} disabled={!newCat.trim()}>Add</button></div>
        <div className="field"><label htmlFor="jtag">Tags (comma separated)</label><input id="jtag" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></div>
        <div className="field"><label htmlFor="jd">Time override (seconds, optional)</label><input id="jd" inputMode="numeric" value={f.dur} onChange={(e) => setF({ ...f, dur: e.target.value.replace(/\D/g, '') })} placeholder="auto from word count" /></div>
        <div className="field"><label htmlFor="jn">Notes</label><textarea id="jn" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ minHeight: 80 }} placeholder="Tag ideas, audience reactions, alt punchlines…" /></div>
        <button className="btn primary" onClick={save} disabled={!dirty}>Save{dirty ? '' : 'd'}</button>
      </section>

      {(source || joke.sourceExcerpt) && (
        <section className="card stack">
          <h3>Where it came from</h3>
          {joke.sourceExcerpt && <div className="excerpt">{joke.sourceExcerpt}</div>}
          {source ? <Link to={`/recording/${source.id}`} className="btn sm">Open source recording</Link> : joke.sourceRecordingId ? <span className="muted small">The source recording was deleted; the excerpt above is preserved.</span> : null}
        </section>
      )}

      <section className="stack">
        <h2>Revisions</h2>
        {!revisions?.length ? <p className="muted small" style={{ margin: 0 }}>Each time you change the wording, the previous version is kept here.</p> : revisions.map((r) => (
          <div key={r.id} className="card stack">
            <div className="row spread"><span className="muted small">{new Date(r.savedAt).toLocaleString()}</span>
              <button className="btn sm" onClick={() => { setF({ ...f, text: r.text, setup: r.setup ?? '', punchline: r.punchline ?? '' }); toast('Loaded into the editor. Save to apply.') }}>Restore</button></div>
            <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{r.text}</div>
          </div>
        ))}
      </section>
    </Page>
  )
}
