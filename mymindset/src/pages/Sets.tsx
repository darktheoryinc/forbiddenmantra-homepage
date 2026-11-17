import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, createSet, getSettings } from '../lib/db'
import { estimateSetSeconds } from '../lib/duration'
import { Page, Empty, Modal, fmtDate } from '../components/ui'

export const SET_LENGTHS = [3, 5, 10, 15, 30, 60]

export default function Sets() {
  const nav = useNavigate()
  const sets = useLiveQuery(() => db.sets.orderBy('updatedAt').reverse().toArray(), [])
  const jokes = useLiveQuery(() => db.jokes.toArray(), [])
  const settings = useLiveQuery(() => getSettings(), [])
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [mins, setMins] = useState(5)
  const map = new Map((jokes ?? []).map((j) => [j.id, j]))

  async function create() {
    const s = await createSet(title, mins)
    nav(`/sets/${s.id}`)
  }
  return (
    <Page title="Sets" actions={<button className="btn primary sm" onClick={() => setAdding(true)}>+ New set</button>}>
      {!sets ? null : sets.length === 0 ? <Empty title="No sets yet">Build a 3-, 5-, 10-, 15-, 30- or 60-minute set from your Vault.</Empty> : (
        <div className="stack">{sets.map((s) => {
          const est = estimateSetSeconds(s, map, settings?.wordsPerMinute, settings?.laughBreakSec)
          return (
            <Link key={s.id} to={`/sets/${s.id}`} className="card card-link">
              <div className="row spread"><h3>{s.title}</h3><span className="chip">{s.targetMinutes} min</span></div>
              <div className="muted small">{s.items.filter((i) => i.kind === 'joke').length} bits · ≈{Math.floor(est / 60)}:{String(est % 60).padStart(2, '0')} · v{s.version} · updated {fmtDate(s.updatedAt)}</div>
            </Link>)
        })}</div>
      )}
      {adding && (
        <Modal title="New set" onClose={() => setAdding(false)}>
          <div className="field"><label htmlFor="st">Title</label><input id="st" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday late show" /></div>
          <div><label>Length</label><div className="chips">{SET_LENGTHS.map((m) => <button key={m} className={`chip${mins === m ? ' on' : ''}`} onClick={() => setMins(m)}>{m} min</button>)}</div></div>
          <button className="btn primary" onClick={create}>Create set</button>
        </Modal>
      )}
    </Page>
  )
}
