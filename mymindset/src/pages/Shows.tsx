import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, snapshotSet, uid } from '../lib/db'
import { estimateSetSeconds } from '../lib/duration'
import type { Performance } from '../lib/types'
import { Page, Empty, Modal, useToast, fmtDate } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)
export const parseMmSs = (v: string): number | undefined => {
  const t = v.trim()
  if (!t) return undefined
  const m = /^(\d{1,3}):([0-5]?\d)$/.exec(t)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  return /^\d+$/.test(t) ? Number(t) * 60 : NaN // bare number = minutes
}
const fmt = (s?: number) => (s === undefined ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)

export default function Shows() {
  const toast = useToast()
  const perfs = useLiveQuery(() => db.performances.orderBy('date').reverse().toArray(), [])
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const jokes = useLiveQuery(() => db.jokes.toArray(), [])
  const [editing, setEditing] = useState<Performance | null>(null)
  const [snap, setSnap] = useState(true)
  const [actual, setActual] = useState('')

  function open(p?: Performance) {
    setEditing(p ?? { id: uid(), venue: '', date: today(), plannedSec: 0, audienceNotes: '', revisions: '', createdAt: Date.now() })
    setActual(p?.actualSec ? fmt(p.actualSec) : '')
    setSnap(!p)
  }
  async function save() {
    const p = editing!
    if (!p.venue.trim()) return toast('Venue is required.', 'err')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return toast('Pick a valid date.', 'err')
    const actualSec = parseMmSs(actual)
    if (Number.isNaN(actualSec)) return toast('Actual time should look like 12:30 (or minutes).', 'err')
    let next = { ...p, actualSec }
    const existing = await db.performances.get(p.id)
    if (p.setId && snap && !existing) {
      const set = await db.sets.get(p.setId)
      if (set) {
        const v = await snapshotSet(p.setId, `Performed at ${p.venue} on ${p.date}`)
        const map = new Map((jokes ?? []).map((j) => [j.id, j]))
        const s = await getSettings()
        next = { ...next, setVersion: v.version, plannedSec: p.plannedSec || estimateSetSeconds(v, map, s.wordsPerMinute, s.laughBreakSec) }
      }
    }
    await db.performances.put(next)
    setEditing(null); toast('Show saved.')
  }

  return (
    <Page title="Performance history" actions={<button className="btn primary sm" onClick={() => open()}>+ Log show</button>}>
      {!perfs ? null : perfs.length === 0 ? <Empty title="No shows logged">After a set, log how it went: audience response, actual time, and what to change.</Empty> : (
        <div className="stack">{perfs.map((p) => {
          const set = sets?.find((s) => s.id === p.setId)
          return (
            <button key={p.id} className="card" style={{ textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' }} onClick={() => open(p)}>
              <div className="row spread"><h3>{p.venue}</h3><span className="muted small">{fmtDate(p.date)}</span></div>
              <div className="muted small">{set ? `${set.title}${p.setVersion ? ` (v${p.setVersion})` : ''}` : 'No set linked'} · planned {fmt(p.plannedSec || undefined)} · actual {fmt(p.actualSec)}{p.rating ? ` · ${'★'.repeat(p.rating)}` : ''}</div>
              {p.audienceNotes && <p style={{ margin: '6px 0 0' }} className="small">{p.audienceNotes.slice(0, 140)}</p>}
            </button>)
        })}</div>
      )}
      {editing && (
        <Modal title={perfs?.some((p) => p.id === editing.id) ? 'Edit show' : 'Log a show'} onClose={() => setEditing(null)}>
          <div className="field"><label htmlFor="pv">Venue</label><input id="pv" value={editing.venue} onChange={(e) => setEditing({ ...editing, venue: e.target.value })} /></div>
          <div className="row"><div className="field grow"><label htmlFor="pd">Date</label><input id="pd" type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></div>
            <div className="field grow"><label htmlFor="pa">Actual time (m:ss)</label><input id="pa" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="11:30" inputMode="numeric" /></div></div>
          <div className="field"><label htmlFor="ps">Set performed</label>
            <select id="ps" value={editing.setId ?? ''} onChange={(e) => {
              const s = sets?.find((x) => x.id === e.target.value)
              const map = new Map((jokes ?? []).map((j) => [j.id, j]))
              setEditing({ ...editing, setId: s?.id, plannedSec: s ? estimateSetSeconds(s, map) : 0 })
            }}><option value="">— none —</option>{sets?.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
          {editing.setId && !perfs?.some((p) => p.id === editing.id) && (
            <label style={{ textTransform: 'none', display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Save the set as it was performed (new version)</label>
          )}
          <div className="field"><label htmlFor="pn">Audience response</label><textarea id="pn" value={editing.audienceNotes} onChange={(e) => setEditing({ ...editing, audienceNotes: e.target.value })} placeholder="What killed, what died, where the room turned…" /></div>
          <div className="field"><label htmlFor="pr">Revisions to make</label><textarea id="pr" value={editing.revisions} onChange={(e) => setEditing({ ...editing, revisions: e.target.value })} placeholder="Cut the second tag. Move the airport bit earlier." style={{ minHeight: 80 }} /></div>
          <div><label>Rating</label><div className="chips">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={`chip${editing.rating === n ? ' on' : ''}`} onClick={() => setEditing({ ...editing, rating: editing.rating === n ? undefined : n })} aria-label={`${n} stars`}>{'★'.repeat(n)}</button>)}</div></div>
          <div className="row"><button className="btn primary grow" onClick={save}>Save</button>
            {perfs?.some((p) => p.id === editing.id) && <button className="btn danger" onClick={async () => { if (confirm('Delete this show entry?')) { await db.performances.delete(editing.id); setEditing(null) } }}>Delete</button>}</div>
        </Modal>
      )}
    </Page>
  )
}
