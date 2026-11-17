import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, createRecording, createJoke, formatDuration } from '../lib/db'
import { useRecorder } from '../lib/recorder'
import { Page, Empty, useToast, fmtDate } from '../components/ui'

export default function Capture() {
  const nav = useNavigate()
  const toast = useToast()
  const recs = useLiveQuery(() => db.recordings.where('kind').equals('ramble').reverse().sortBy('createdAt'), [])
  const [paste, setPaste] = useState('')
  const [quick, setQuick] = useState('')
  const rec = useRecorder(async ({ blob, durationSec, mimeType }) => {
    try {
      const r = await createRecording({ blob, durationSec, mimeType })
      toast('Saved. Audio is stored on this device.')
      nav(`/recording/${r.id}`)
    } catch { toast('Could not save the recording (storage may be full).', 'err') }
  })

  async function savePaste() {
    if (paste.trim().length < 10) return toast('Paste at least a sentence of transcript.', 'err')
    const r = await createRecording({ transcript: paste })
    setPaste('')
    nav(`/recording/${r.id}`)
  }
  async function saveQuick() {
    if (!quick.trim()) return
    const j = await createJoke({ text: quick.trim(), status: 'idea' })
    setQuick('')
    toast('Added to your Vault as an idea.')
    nav(`/joke/${j.id}`)
  }

  const live = rec.state === 'recording'
  return (
    <Page title="MyMindSet" actions={<Link to="/settings" className="btn ghost sm">Settings</Link>}>
      <section className="card amber rec-wrap" aria-label="Record">
        <button className={`rec-btn${live ? ' live' : ''}`} onClick={live ? rec.stop : rec.start} disabled={rec.state === 'starting'} aria-label={live ? 'Stop recording' : 'Start recording'}>
          {live ? <>■<span>Stop</span></> : <>●<span>{rec.state === 'starting' ? '…' : 'Record'}</span></>}
        </button>
        {live ? <div className="timer" aria-live="off">{formatDuration(rec.elapsed)}</div> : <p className="muted" style={{ margin: 0 }}>Ramble. Don't edit yourself. Your original audio is always kept.</p>}
        {rec.error && <p className="err" role="alert" style={{ margin: 0 }}>{rec.error}</p>}
      </section>

      <section className="card stack">
        <h3>Got a thought? Jot it down.</h3>
        <textarea value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="A premise, a tag, half a joke…" style={{ minHeight: 70 }} aria-label="Quick idea" />
        <button className="btn" onClick={saveQuick} disabled={!quick.trim()}>Save to Vault</button>
      </section>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Paste a transcript instead</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste a ramble from your notes, voice memo transcript, or set recording…" aria-label="Transcript" style={{ minHeight: 140 }} />
          <button className="btn primary" onClick={savePaste}>Save &amp; find jokes</button>
        </div>
      </details>

      <section className="stack">
        <h2>Recent rambles</h2>
        {!recs ? null : recs.length === 0 ? (
          <Empty title="Nothing yet">Hit record and talk about your day. The jokes are in there.</Empty>
        ) : recs.map((r) => (
          <Link key={r.id} to={`/recording/${r.id}`} className="card card-link">
            <div className="row spread"><h3>{r.title}</h3><span className="muted small">{fmtDate(r.createdAt)}</span></div>
            <div className="muted small">
              {r.hasAudio ? `Audio ${formatDuration(r.durationSec)}` : 'Text only'} · {r.transcript ? `${r.transcript.split(/\s+/).length} words` : 'no transcript yet'}
            </div>
          </Link>
        ))}
      </section>
    </Page>
  )
}
