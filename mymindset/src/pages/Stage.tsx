import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, createRecording, formatDuration, getSettings } from '../lib/db'
import { estimateItemSeconds } from '../lib/duration'
import { useRecorder } from '../lib/recorder'
import { useToast } from '../components/ui'

export default function Stage() {
  const { id = '' } = useParams()
  const toast = useToast()
  const set = useLiveQuery(() => db.sets.get(id), [id])
  const jokesArr = useLiveQuery(() => db.jokes.toArray(), [])
  const settings = useLiveQuery(() => getSettings(), [])
  const [i, setI] = useState(0)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [size, setSize] = useState(() => { try { return Number(localStorage.getItem('stage-size')) || 0 } catch { return 0 } })
  const [light, setLight] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const notesRef = useRef('')
  notesRef.current = notes
  const touchX = useRef<number | null>(null)

  const rec = useRecorder(async ({ blob, durationSec, mimeType }) => {
    await createRecording({ blob, durationSec, mimeType, kind: 'rehearsal', setId: id, title: `Rehearsal · ${set?.title ?? 'set'} · ${new Date().toLocaleString()}` })
    if (notesRef.current.trim()) {
      const r = await db.recordings.where('kind').equals('rehearsal').filter((x) => x.setId === id).reverse().sortBy('createdAt')
      if (r[0]) await db.recordings.update(r[0].id, { notes: notesRef.current })
    }
    toast('Rehearsal recording saved.')
  })

  const jokes = useMemo(() => new Map((jokesArr ?? []).map((j) => [j.id, j])), [jokesArr])
  const cards = useMemo(() => (set?.items ?? []).filter((x) => x.kind !== 'note' || x.text?.trim()), [set])
  const wpm = settings?.wordsPerMinute ?? 140, laugh = settings?.laughBreakSec ?? 3

  useEffect(() => {
    if (!running) return
    const t0 = Date.now() - elapsed * 1000
    const h = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250)
    return () => window.clearInterval(h)
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the screen awake on stage where supported.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const req = async () => { try { lock = (await navigator.wakeLock?.request('screen')) ?? null } catch { /* unsupported or denied */ } }
    req()
    const vis = () => { if (document.visibilityState === 'visible') req() }
    document.addEventListener('visibilitychange', vis)
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release().catch(() => {}) }
  }, [])

  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(Math.max(cards.length - 1, 0), x + d))), [cards.length])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [go])

  if (set === undefined) return null
  if (!set) return <div className="stage"><div className="stage-card"><p>Set not found.</p><Link to="/sets" className="btn">Back</Link></div></div>

  const card = cards[i]
  const joke = card?.jokeId ? jokes.get(card.jokeId) : undefined
  const target = set.targetMinutes * 60
  const sizeCls = size < 0 ? 'small-text' : ''
  const plannedUpTo = cards.slice(0, i).reduce((s, c) => s + estimateItemSeconds(c, jokes, wpm, laugh), 0)
  const next = cards[i + 1]
  const nextLabel = next ? (next.kind === 'joke' ? jokes.get(next.jokeId ?? '')?.title : next.text) : null
  const bump = (d: number) => { const v = Math.max(-1, Math.min(2, size + d)); setSize(v); try { localStorage.setItem('stage-size', String(v)) } catch { /* ignore */ } }

  async function saveNotesOnly() {
    if (!notes.trim()) return
    await createRecording({ transcript: '', kind: 'rehearsal', setId: id, title: `Rehearsal notes · ${set!.title}` })
    const r = await db.recordings.where('kind').equals('rehearsal').filter((x) => x.setId === id).reverse().sortBy('createdAt')
    if (r[0]) await db.recordings.update(r[0].id, { notes, durationSec: elapsed })
    setNotes(''); toast('Rehearsal notes saved.')
  }

  return (
    <div className={`stage${light ? ' light' : ''}`}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => { if (touchX.current === null || notesOpen) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); touchX.current = null }}>
      <div className="stage-top">
        <Link to={`/sets/${id}`} className="btn sm ghost" aria-label="Exit stage mode">✕ Exit</Link>
        <div className={`stage-clock${elapsed > target ? ' over' : ''}`} aria-label="Elapsed time">{formatDuration(elapsed)}<span className="muted small"> / {set.targetMinutes}:00</span></div>
        <div className="row">
          <button className="btn sm" onClick={() => setRunning(!running)} aria-pressed={running}>{running ? 'Pause' : elapsed ? 'Resume' : 'Start'}</button>
          {!running && elapsed > 0 && <button className="btn sm ghost" onClick={() => setElapsed(0)}>Reset</button>}
        </div>
      </div>
      <div className="progress" aria-hidden="true">{cards.map((_, k) => <i key={k} className={k <= i ? 'done' : ''} />)}</div>

      <div className="stage-card" aria-live="polite">
        {cards.length === 0 ? <p className="big">This set is empty. Add jokes in the Set Builder first.</p> : card && (
          <>
            <div className="label">{card.kind === 'joke' ? `Bit ${cards.slice(0, i + 1).filter((c) => c.kind === 'joke').length}` : card.kind === 'transition' ? 'Transition' : 'Note'} · card {i + 1}/{cards.length} · planned start {formatDuration(plannedUpTo)}</div>
            {card.kind === 'joke' ? (
              joke ? (
                <>
                  <div className="label" style={{ color: 'var(--amber)' }}>{joke.title}</div>
                  {joke.setup && joke.punchline ? (
                    <><div className={`big ${sizeCls}`} style={{ fontSize: size > 0 ? `${2.2 + size * 0.7}rem` : undefined }}>{joke.setup}</div>
                      <div className={`big ${sizeCls}`} style={{ color: 'var(--amber)', fontSize: size > 0 ? `${2.2 + size * 0.7}rem` : undefined }}>{joke.punchline}</div></>
                  ) : <div className={`big ${sizeCls}`} style={{ fontSize: size > 0 ? `${2.2 + size * 0.7}rem` : undefined }}>{joke.text}</div>}
                  {joke.notes && <div className="muted">Notes: {joke.notes}</div>}
                </>
              ) : <div className="big">Deleted joke</div>
            ) : <div className={`big ${sizeCls}`} style={{ fontStyle: 'italic', color: '#e9c27a', fontSize: size > 0 ? `${2.2 + size * 0.7}rem` : undefined }}>{card.text}</div>}
            {nextLabel && <div className="label">Next → {nextLabel.slice(0, 80)}</div>}
          </>
        )}
      </div>

      {notesOpen && (
        <div style={{ padding: '0 14px 8px' }}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Rehearsal notes: what to cut, tighten, re-order…" aria-label="Rehearsal notes" style={{ minHeight: 90 }} />
          {!rec.state.startsWith('rec') && <button className="btn sm" style={{ marginTop: 6 }} onClick={saveNotesOnly} disabled={!notes.trim()}>Save notes without audio</button>}
        </div>
      )}
      {rec.error && <p className="err" style={{ padding: '0 14px', margin: 0 }} role="alert">{rec.error}</p>}
      <div className="row wrap" style={{ padding: '0 14px 6px', justifyContent: 'center' }}>
        <button className={`btn sm${rec.state === 'recording' ? ' danger' : ''}`} onClick={rec.state === 'recording' ? rec.stop : rec.start}>{rec.state === 'recording' ? `■ Stop recording ${formatDuration(rec.elapsed)}` : '● Record rehearsal'}</button>
        <button className="btn sm" onClick={() => setNotesOpen(!notesOpen)}>Notes</button>
        <button className="btn sm" onClick={() => bump(-1)} aria-label="Smaller text">A−</button>
        <button className="btn sm" onClick={() => bump(1)} aria-label="Larger text">A+</button>
        <button className="btn sm" onClick={() => setLight(!light)}>{light ? 'Dark' : 'Light'}</button>
      </div>
      <div className="stage-bottom">
        <button className="btn" onClick={() => go(-1)} disabled={i === 0}>← Prev</button>
        <button className="btn primary" onClick={() => go(1)} disabled={i >= cards.length - 1}>Next →</button>
      </div>
    </div>
  )
}
