import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, getSettings, saveSet, snapshotSet, restoreSetVersion, uid, formatDuration } from '../lib/db'
import { estimateItemSeconds, estimateSetSeconds, estimateJokeSeconds, fitStatus } from '../lib/duration'
import { withSuggestedTransitions, findSetCallbacks, suggestFill } from '../lib/setTools'
import { suggestTransition } from '../ai/heuristic'
import { SET_LENGTHS } from './Sets'
import type { ComedySet, Joke, SetItem } from '../lib/types'
import { Page, Badge, Empty, Modal, useToast, fmtDate } from '../components/ui'

export default function SetBuilder() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const stored = useLiveQuery(() => db.sets.get(id), [id])
  const jokesArr = useLiveQuery(() => db.jokes.toArray(), [])
  const versions = useLiveQuery(() => db.setVersions.where('setId').equals(id).reverse().sortBy('version'), [id])
  const rehearsals = useLiveQuery(() => db.recordings.where('kind').equals('rehearsal').filter((r) => r.setId === id).reverse().sortBy('createdAt'), [id])
  const settings = useLiveQuery(() => getSettings(), [])
  const [picker, setPicker] = useState(false)
  const [q, setQ] = useState('')
  const [snapNote, setSnapNote] = useState('')
  const [showVersions, setShowVersions] = useState(false)
  const [set, setSet] = useState<ComedySet | null>(null)

  useEffect(() => { if (stored) setSet((cur) => (cur && cur.updatedAt === stored.updatedAt && cur.id === stored.id ? cur : stored)) }, [stored])
  const jokes = useMemo(() => new Map((jokesArr ?? []).map((j) => [j.id, j])), [jokesArr])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (stored === undefined) return <Page title="Loading…"><div /></Page>
  if (!stored || !set) return <Page title="Not found"><Empty title="Set not found"><Link to="/sets">Back to Sets</Link></Empty></Page>

  const wpm = settings?.wordsPerMinute ?? 140, laugh = settings?.laughBreakSec ?? 3
  const est = estimateSetSeconds(set, jokes, wpm, laugh)
  const { fit, deltaSec } = fitStatus(est, set.targetMinutes)
  const callbacks = findSetCallbacks(set.items, jokes)
  const inSet = new Set(set.items.filter((i) => i.kind === 'joke').map((i) => i.jokeId!))

  const commit = async (items: SetItem[], extra: Partial<ComedySet> = {}) => {
    const next = { ...set, ...extra, items, updatedAt: Date.now() }
    setSet(next)
    await saveSet(next)
  }
  const addJoke = (j: Joke) => commit([...set.items, { id: uid(), kind: 'joke', jokeId: j.id, origin: 'manual' }])
  const remove = (itemId: string) => commit(set.items.filter((i) => i.id !== itemId))
  const edit = (itemId: string, text: string) => commit(set.items.map((i) => (i.id === itemId ? { ...i, text, origin: 'manual' } : i)))
  async function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    const ids = set!.items.map((i) => i.id)
    await commit(arrayMove(set!.items, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))))
  }
  const suggestTrans = () => {
    const withT = withSuggestedTransitions(set.items, jokes)
    if (withT.length === set.items.length) return toast('Every adjacent pair of bits already has something between them.')
    commit(withT); toast('Added suggested transitions. Edit or delete any of them.')
  }
  async function regen(itemId: string) {
    const idx = set!.items.findIndex((i) => i.id === itemId)
    const prev = set!.items.slice(0, idx).reverse().find((i) => i.kind === 'joke'), next = set!.items.slice(idx + 1).find((i) => i.kind === 'joke')
    const a = jokes.get(prev?.jokeId ?? ''), b = jokes.get(next?.jokeId ?? '')
    if (!a || !b) return
    await commit(set!.items.map((i) => (i.id === itemId ? { ...i, text: suggestTransition(a.text, b.text, Math.floor(Math.random() * 4) + 1), origin: 'suggested' } : i)))
  }
  function fill() {
    const picks = suggestFill(jokesArr ?? [], inSet, est, set!.targetMinutes * 60, (j) => estimateJokeSeconds(j, wpm, laugh))
    if (!picks.length) return toast('No more Vault jokes fit. Add jokes to the Vault first.', 'err')
    commit([...set!.items, ...picks.map((j): SetItem => ({ id: uid(), kind: 'joke', jokeId: j.id, origin: 'suggested' }))])
    toast(`Added ${picks.length} suggested bit${picks.length === 1 ? '' : 's'} (best status first). Reorder or remove freely.`)
  }
  async function saveVersion() {
    await saveSet(set!)
    const v = await snapshotSet(id, snapNote.trim() || undefined)
    setSnapNote(''); toast(`Saved as version ${v.version}.`)
  }
  async function del() {
    if (!confirm('Delete this set? Saved versions and performance history are kept.')) return
    await db.sets.delete(id)
    nav('/sets')
  }

  const pct = Math.min(100, Math.round((est / (set.targetMinutes * 60)) * 100))
  const filtered = (jokesArr ?? []).filter((j) => !inSet.has(j.id) && (!q || `${j.title} ${j.text} ${j.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <Page title="Set Builder" actions={<><Link to={`/stage/${id}`} className="btn primary sm">Rehearse ▶</Link><button className="btn ghost sm danger" onClick={del}>Delete</button></>}>
      <section className="card stack">
        <input value={set.title} onChange={(e) => setSet({ ...set, title: e.target.value })} onBlur={() => commit(set.items, { title: set.title.trim() || 'Untitled set' })} aria-label="Set title" style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem', fontWeight: 700 }} />
        <div className="chips" role="group" aria-label="Target length">{SET_LENGTHS.map((m) => <button key={m} className={`chip${set.targetMinutes === m ? ' on' : ''}`} onClick={() => commit(set.items, { targetMinutes: m })}>{m} min</button>)}</div>
        <div className={`meter ${fit}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Set length vs target"><i style={{ width: `${pct}%` }} /></div>
        <div className="row spread small"><span><b>≈ {formatDuration(est)}</b> of {set.targetMinutes}:00 · version {set.version}</span>
          <span className={fit === 'fit' ? 'ok' : fit === 'over' ? 'err' : 'muted'}>{fit === 'fit' ? 'On target' : fit === 'over' ? `${formatDuration(deltaSec)} over` : `${formatDuration(-deltaSec)} to fill`}</span></div>
        <p className="muted small" style={{ margin: 0 }}>Estimate = word count at {wpm} wpm + {laugh}s laugh break per bit (or your per-joke override). Change pacing in Settings.</p>
      </section>

      <div className="row wrap">
        <button className="btn primary" onClick={() => setPicker(true)}>+ Add joke</button>
        <button className="btn" onClick={suggestTrans}>Suggest transitions</button>
        <button className="btn" onClick={fill} disabled={fit === 'over'}>Suggest jokes to fill</button>
        <button className="btn" onClick={() => commit([...set.items, { id: uid(), kind: 'transition', text: '', origin: 'manual' }])}>+ Transition</button>
      </div>

      {callbacks.length > 0 && (
        <div className="callout">
          <b>Callback ideas</b>
          {callbacks.map((c) => (
            <div key={c.phrase} className="row spread" style={{ marginTop: 6 }}>
              <span className="small">“{c.phrase}” shows up in bits {c.positions.map((p) => p + 1).join(', ')} — consider calling back to it.</span>
              <button className="btn sm" onClick={() => {
                const last = set.items.findIndex((i) => i.jokeId === c.jokeIds[c.jokeIds.length - 1])
                const items = [...set.items]; items.splice(last + 1, 0, { id: uid(), kind: 'note', text: `Callback: bring back “${c.phrase}” here.`, origin: 'suggested' })
                commit(items)
              }}>Add note</button>
            </div>
          ))}
        </div>
      )}

      {set.items.length === 0 ? <Empty title="Empty set">Add jokes from your Vault, or let MyMindSet suggest some.</Empty> : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={set.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="stack">
              {set.items.map((it, idx) => (
                <Row key={it.id} item={it} n={set.items.slice(0, idx).filter((i) => i.kind === 'joke').length + 1}
                  joke={it.jokeId ? jokes.get(it.jokeId) : undefined} sec={estimateItemSeconds(it, jokes, wpm, laugh)}
                  onRemove={() => remove(it.id)} onEdit={(t) => edit(it.id, t)} onRegen={() => regen(it.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <section className="card stack">
        <h3>Versions</h3>
        <div className="row"><input value={snapNote} onChange={(e) => setSnapNote(e.target.value)} placeholder="Note (e.g. after Tuesday open mic)" aria-label="Version note" /><button className="btn" onClick={saveVersion}>Save v{set.version}</button></div>
        <button className="btn sm ghost" onClick={() => setShowVersions(!showVersions)}>{showVersions ? 'Hide' : 'Show'} {versions?.length ?? 0} saved version{versions?.length === 1 ? '' : 's'}</button>
        {showVersions && (versions ?? []).map((v) => (
          <div key={v.id} className="card row spread" style={{ background: 'var(--bg2)' }}>
            <div className="small"><b>v{v.version}</b> · {fmtDate(v.savedAt)} · {v.items.filter((i) => i.kind === 'joke').length} bits{v.note ? <><br /><span className="muted">{v.note}</span></> : null}</div>
            <button className="btn sm" onClick={async () => { if (confirm(`Restore v${v.version}? Your current set is saved as a version first.`)) { await restoreSetVersion(v.id); toast('Restored.') } }}>Restore</button>
          </div>
        ))}
      </section>

      {(rehearsals?.length ?? 0) > 0 && (
        <section className="card stack"><h3>Rehearsals</h3>
          {rehearsals!.map((r) => <Link key={r.id} to={`/recording/${r.id}`} className="small">{new Date(r.createdAt).toLocaleString()} · {r.hasAudio ? formatDuration(r.durationSec) : 'notes only'}</Link>)}
        </section>
      )}

      {picker && (
        <Modal title="Add from Vault" onClose={() => setPicker(false)}>
          <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Vault…" aria-label="Search vault" />
          {filtered.length === 0 && <Empty title="Nothing to add">{(jokesArr?.length ?? 0) === 0 ? 'Your Vault is empty.' : 'Everything matching is already in this set.'}</Empty>}
          {filtered.map((j) => (
            <button key={j.id} className="card" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => { addJoke(j); toast('Added.') }}>
              <div className="row spread"><b>{j.title}</b><Badge kind="status">{j.status}</Badge></div>
              <div className="muted small">{j.text.slice(0, 110)}{j.text.length > 110 ? '…' : ''} · ≈{estimateJokeSeconds(j, wpm, laugh)}s</div>
            </button>
          ))}
        </Modal>
      )}
    </Page>
  )
}

function Row({ item, n, joke, sec, onRemove, onEdit, onRegen }: { item: SetItem; n: number; joke?: Joke; sec: number; onRemove: () => void; onEdit: (t: string) => void; onRegen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'dragging' : ''}>
      <div className={item.kind === 'joke' ? 'card' : 'transition'}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="handle" {...attributes} {...listeners} aria-label="Drag to reorder">⠿</div>
          <div className="grow">
            {item.kind === 'joke' ? (
              joke ? (<>
                <div className="row spread"><Link to={`/joke/${joke.id}`}><b>{n}. {joke.title}</b></Link><span className="muted small">≈{sec}s</span></div>
                <div className="muted small">{joke.text.slice(0, 140)}{joke.text.length > 140 ? '…' : ''}</div>
                {item.origin === 'suggested' && <Badge kind="heur">Suggested</Badge>}
              </>) : <span className="muted">Deleted joke</span>
            ) : (
              <>
                <textarea style={{ minHeight: 44, background: 'transparent', border: 'none', color: 'inherit', fontStyle: 'italic', padding: 4 }} value={item.text ?? ''} onChange={(e) => onEdit(e.target.value)} rows={2} placeholder={item.kind === 'note' ? 'Note to self' : 'Write a transition…'} aria-label={item.kind} />
                <div className="small muted">{item.kind === 'note' ? 'note' : 'transition'}{item.origin === 'suggested' ? ' · suggested (template)' : ''}</div>
              </>
            )}
          </div>
          <div className="row">
            {item.kind === 'transition' && <button className="btn sm ghost" onClick={onRegen} aria-label="Regenerate transition">↻</button>}
            <button className="btn sm ghost" onClick={onRemove} aria-label="Remove">✕</button>
          </div>
        </div>
      </div>
    </div>
  )
}
