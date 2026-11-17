import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, deleteRecording, formatDuration, uid, getSettings } from '../lib/db'
import { analyzeRecording, acceptSuggestion, activeProvider, providers } from '../ai/service'
import { getServerStatus, transcribeOnServer } from '../lib/api'
import type { ServerStatus } from '../ai/types'
import { BUILTIN_CATEGORIES, type Suggestion, type RoutineSuggestion, type MarkerKind } from '../lib/types'
import { useRef } from 'react'
import { suggestTransition } from '../ai/heuristic'
import { Page, Badge, OriginBadge, Empty, useToast, download } from '../components/ui'

export default function RecordingDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const rec = useLiveQuery(() => db.recordings.get(id), [id])
  const audioRow = useLiveQuery(() => db.audio.get(id), [id])
  const suggestions = useLiveQuery(() => db.suggestions.where('recordingId').equals(id).sortBy('order'), [id])
  const routines = useLiveQuery(() => db.routines.where('recordingId').equals(id).toArray(), [id])
  const runs = useLiveQuery(() => db.runs.where('recordingId').equals(id).sortBy('createdAt'), [id])
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [url, setUrl] = useState<string>()
  const [busy, setBusy] = useState<'' | 'transcribe' | 'analyze'>('')
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [tab, setTab] = useState<'bits' | 'routines'>('bits')
  const audioEl = useRef<HTMLAudioElement>(null)
  const jokesAll = useLiveQuery(() => db.jokes.toArray(), [])
  const cfg = useLiveQuery(() => getSettings(), [])

  useEffect(() => { if (rec) { setTitle(rec.title); setText(rec.transcript) } }, [rec?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { getServerStatus().then(setStatus) }, [])
  useEffect(() => {
    if (!audioRow?.blob) return setUrl(undefined)
    const u = URL.createObjectURL(audioRow.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [audioRow?.blob])

  const byId = useMemo(() => new Map((suggestions ?? []).map((s) => [s.id, s])), [suggestions])
  if (rec === undefined) return <Page title="Loading…"><div /></Page>
  if (!rec) return <Page title="Not found"><Empty title="Recording not found"><Link to="/">Back to Capture</Link></Empty></Page>

  const dirty = title !== rec.title || text !== rec.transcript
  const visible = (suggestions ?? []).filter((s) => s.status !== 'rejected')
  const rejected = (suggestions ?? []).filter((s) => s.status === 'rejected')

  async function save() {
    await db.recordings.update(id, { title: title.trim() || rec!.title, transcript: text })
    toast('Saved.')
  }
  async function transcribe() {
    if (!audioRow) return
    setBusy('transcribe')
    try {
      const t = await transcribeOnServer(audioRow.blob)
      // The engine's output is stored immutably as the original; the editable copy starts identical.
      await db.recordings.update(id, { transcriptOriginal: t, transcript: t, transcriptSource: 'server' })
      setText(t)
      toast('Transcribed.')
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy('') }
  }
  async function analyze() {
    if (dirty) await save()
    setBusy('analyze')
    try {
      const { count, provider, fallbackReason } = await analyzeRecording(id)
      if (fallbackReason) toast(`AI analysis unavailable (${fallbackReason}). Used the offline pattern finder instead.`, 'err')
      else toast(count ? `Found ${count} candidate${count === 1 ? '' : 's'} (${provider.label}).` : 'No joke candidates found. Try a longer ramble.', count ? 'ok' : 'err')
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy('') }
  }
  async function remove() {
    if (!confirm('Delete this recording, its audio, and its pending suggestions? Jokes you already accepted stay in your Vault.')) return
    await deleteRecording(id)
    nav('/')
  }
  async function reorder(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    const ids = visible.map((s) => s.id)
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)))
    await db.transaction('rw', db.suggestions, async () => { for (let i = 0; i < next.length; i++) await db.suggestions.update(next[i], { order: i }) })
  }
  async function acceptAll() {
    for (const s of visible.filter((x) => x.status === 'pending')) await acceptSuggestion(s.id)
    toast('All pending candidates added to your Vault.')
  }

  return (
    <Page title="Recording" actions={<button className="btn ghost sm danger" onClick={remove}>Delete</button>}>
      <section className="card stack">
        <div className="field"><label htmlFor="rt">Title</label><input id="rt" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="muted small">
          {new Date(rec.createdAt).toLocaleString()} · {rec.hasAudio ? `audio ${formatDuration(rec.durationSec)}` : 'text only'}
          {rec.kind === 'rehearsal' && ' · rehearsal'}
        </div>
        {url ? <audio ref={audioEl} className="audio" controls src={url} preload="metadata" /> : rec.hasAudio ? <span className="muted small">Loading audio…</span> : null}
        {rec.hasAudio && url && <button className="btn sm" onClick={() => download(`${rec.title.replace(/[^\w-]+/g, '_')}.${rec.mimeType.includes('mp4') ? 'm4a' : 'webm'}`, audioRow!.blob, rec.mimeType)}>Download original audio</button>}
      </section>

      {rec.hasAudio && (
        <section className="card stack">
          <div className="row spread"><h3>Laugh markers</h3><span className="muted small">{(rec.markers ?? []).length} marked</span></div>
          <div className="row wrap" role="group" aria-label="Add marker at current playback time">
            {(['laugh', 'big-laugh', 'groan', 'miss'] as MarkerKind[]).map((k) => (
              <button key={k} className="btn sm" onClick={async () => {
                const t = Math.round(audioEl.current?.currentTime ?? 0)
                await db.recordings.update(id, { markers: [...(rec.markers ?? []), { id: uid(), t, kind: k }].sort((a, b) => a.t - b.t) })
              }}>+ {MARKER_LABEL[k]}</button>))}
          </div>
          {(rec.markers ?? []).length === 0 ? <p className="muted small" style={{ margin: 0 }}>Play the recording and tap to mark where the room laughed, groaned or went quiet. During a live set or rehearsal you can tap in Stage mode instead.</p> : (
            <div className="stack">{(rec.markers ?? []).map((m) => {
              const j = jokesAll?.find((x) => x.id === m.jokeId)
              return (
                <div key={m.id} className="row spread">
                  <button className="btn sm ghost" onClick={() => { if (audioEl.current) { audioEl.current.currentTime = m.t; audioEl.current.play().catch(() => {}) } }}>▶ {formatDuration(m.t)} {MARKER_LABEL[m.kind]}</button>
                  <span className="muted small grow" style={{ textAlign: 'right' }}>{j?.title}</span>
                  <button className="btn sm ghost" aria-label="Delete marker" onClick={() => db.recordings.update(id, { markers: (rec.markers ?? []).filter((x) => x.id !== m.id) })}>✕</button>
                </div>)
            })}</div>
          )}
          {(rec.markers ?? []).length > 0 && <MarkerSummary rec={rec} jokes={jokesAll ?? []} />}
        </section>
      )}

      {rec.kind === 'rehearsal' && (
        <section className="card stack">
          <h3>Rehearsal notes</h3>
          <textarea defaultValue={rec.notes ?? ''} onBlur={(e) => db.recordings.update(id, { notes: e.target.value })} placeholder="What to cut, tighten, re-order…" aria-label="Rehearsal notes" />
          {rec.setId && <Link to={`/sets/${rec.setId}`} className="btn sm">Open set</Link>}
        </section>
      )}

      <section className="card stack">
        <div className="row spread"><h3>Transcript</h3>
          <span className="muted small">{rec.transcriptSource === 'none' ? 'none yet' : rec.transcriptSource === 'server' ? 'machine transcript' : rec.transcriptSource === 'pasted' ? 'pasted' : 'typed'}</span></div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 180 }} placeholder={rec.hasAudio ? 'Type or paste the transcript. If a transcription engine is configured, use Transcribe.' : 'Transcript'} aria-label="Transcript" />
        {rec.transcriptOriginal && rec.transcriptOriginal !== text && (
          <button className="btn sm ghost" onClick={() => setText(rec.transcriptOriginal)}>Revert to original transcript</button>
        )}
        <div className="row wrap">
          <button className="btn" onClick={save} disabled={!dirty}>Save</button>
          {rec.hasAudio && (
            <button className="btn" onClick={transcribe} disabled={busy !== '' || !status?.transcription.configured}
              title={status?.transcription.configured ? '' : 'No transcription engine configured on the server'}>
              {busy === 'transcribe' ? 'Transcribing…' : 'Transcribe audio'}
            </button>
          )}
          <button className="btn primary" onClick={analyze} disabled={busy !== '' || text.trim().length < 10}>{busy === 'analyze' ? 'Searching…' : 'Find the jokes'}</button>
        </div>
        {busy === 'analyze' && cfg?.analysisProvider === 'server' && (
          <p className="callout small" style={{ margin: 0 }} role="status">Analyzing with your AI model. A local model on a laptop-class CPU can take a minute or two for a long ramble. If it fails, the offline finder takes over.</p>
        )}
        {rec.hasAudio && status && !status.transcription.configured && (
          <p className="callout warn small" style={{ margin: 0 }}>Transcription isn't set up on this server (see <code>.env.example</code>), so audio can't be auto-transcribed. Your audio is safe; type or paste the transcript to continue.</p>
        )}
        {rec.hasAudio && !status && (
          <p className="callout warn small" style={{ margin: 0 }}>The MyMindSet server isn't reachable, so transcription is unavailable. Recording and pasting still work.</p>
        )}
      </section>

      {(suggestions?.length ?? 0) > 0 && (
        <section className="stack">
          <div className="row spread wrap">
            <h2>Joke candidates</h2>
            <div className="row">
              {runs?.length ? <Badge>{providers[Object.keys(providers).find((k) => providers[k].id === runs[runs.length - 1].provider) ?? 'local']?.label ?? runs[runs.length - 1].provider}</Badge> : null}
              <button className="btn sm" onClick={acceptAll}>Accept all</button>
            </div>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Excerpts are your exact words. Suggested structure and transitions are labeled. Nothing changes your transcript or audio.</p>
          {runs?.length ? <RunInfo run={runs[runs.length - 1]} byId={byId} /> : null}
          {runs?.length ? <div className="chips">{runs[runs.length - 1].themes.map((t) => <span key={t} className="chip">#{t}</span>)}{runs[runs.length - 1].callbacks.map((c) => <span key={c.phrase} className="chip on" title="Appears in multiple bits — callback potential">↺ {c.phrase}</span>)}</div> : null}
          <div className="tabs">
            <button className={`chip${tab === 'bits' ? ' on' : ''}`} onClick={() => setTab('bits')}>Bits ({visible.length})</button>
            <button className={`chip${tab === 'routines' ? ' on' : ''}`} onClick={() => setTab('routines')}>Routines ({(routines ?? []).filter((r) => r.status !== 'rejected').length})</button>
          </div>
          {tab === 'bits' && (
            <BitList items={visible} onDragEnd={reorder} />
          )}
          {tab === 'routines' && <Routines routines={(routines ?? []).filter((r) => r.status !== 'rejected')} byId={byId} />}
          {rejected.length > 0 && (
            <details><summary className="muted small" style={{ cursor: 'pointer' }}>{rejected.length} dismissed</summary>
              <div className="stack" style={{ marginTop: 8 }}>{rejected.map((s) => (
                <div key={s.id} className="card dim row spread"><span className="small">{s.excerpt.slice(0, 90)}…</span>
                  <button className="btn sm" onClick={() => db.suggestions.update(s.id, { status: 'pending' })}>Restore</button></div>))}</div></details>
          )}
        </section>
      )}
      {suggestions && suggestions.length === 0 && runs && runs.length > 0 && <Empty title="No candidates this time">Try a longer ramble, or use a different analysis provider in Settings.</Empty>}
    </Page>
  )
}

function BitList({ items, onDragEnd }: { items: Suggestion[]; onDragEnd: (e: DragEndEvent) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="stack">{items.map((s) => <BitCard key={s.id} s={s} />)}</div>
      </SortableContext>
    </DndContext>
  )
}

function BitCard({ s }: { s: Suggestion }) {
  const toast = useToast()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(s.userText ?? s.excerpt)
  const [cat, setCat] = useState('Observational')
  const [variant, setVariant] = useState(0)
  const accepted = s.status === 'accepted'

  async function regenerate() {
    const p = await activeProvider()
    const next = variant + 1
    const r = await p.regenerate?.({ excerpt: s.excerpt, variant: next })
    if (!r) return
    setVariant(next)
    await db.suggestions.update(s.id, { setup: r.setup, punchline: r.punchline, rationale: r.rationale ?? s.rationale })
  }
  async function saveEdit() {
    await db.suggestions.update(s.id, { userText: draft })
    setEditing(false)
  }
  async function accept() {
    try { await acceptSuggestion(s.id, cat); toast('Added to your Vault.') } catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`card${isDragging ? ' dragging' : ''}${accepted ? ' dim' : ''}`}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="handle" {...attributes} {...listeners} aria-label="Drag to reorder">⠿</div>
        <div className="grow stack">
          <div className="row wrap">
            <Badge>{s.kind.replace('-', ' / ')}</Badge>
            <OriginBadge origin="original" />
            {s.origin !== 'original' && <Badge kind={s.origin === 'ai-suggested' ? 'ai' : 'heur'}>{s.origin === 'ai-suggested' ? 'AI-suggested structure' : 'Suggested structure'}</Badge>}
            {s.confidence !== undefined && <span className="muted small">score {Math.round(s.confidence * 100)}</span>}
            {accepted && <Badge kind="original">In Vault</Badge>}
          </div>
          {editing ? (
            <>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit candidate text" />
              <div className="row"><button className="btn sm primary" onClick={saveEdit}>Save edit</button><button className="btn sm" onClick={() => { setDraft(s.userText ?? s.excerpt); setEditing(false) }}>Cancel</button></div>
            </>
          ) : (
            <>
              <div className="excerpt">{s.userText ?? s.excerpt}</div>
              {s.userText && s.userText !== s.excerpt && <p className="muted small" style={{ margin: 0 }}>Edited. Original excerpt: “{s.excerpt}”</p>}
            </>
          )}
          {(s.setup || s.punchline) && !editing && (
            <div className="small"><span className="muted">Setup · </span><span className="setup">{s.setup ?? '—'}</span><br /><span className="muted">Punch · </span><span className="punch">{s.punchline ?? '—'}</span></div>
          )}
          <div className="muted small">{s.rationale}</div>
          {s.themes.length > 0 && <div className="chips">{s.themes.map((t) => <span key={t} className="chip">#{t}</span>)}</div>}
          {!accepted && !editing && (
            <div className="row wrap">
              <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 'auto', minHeight: 36 }} aria-label="Category">
                {BUILTIN_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button className="btn sm primary" onClick={accept}>Accept</button>
              <button className="btn sm" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn sm" onClick={regenerate} title="Try a different setup/punchline split">Regenerate</button>
              <button className="btn sm danger" onClick={() => db.suggestions.update(s.id, { status: 'rejected' })}>Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Routines({ routines, byId }: { routines: RoutineSuggestion[]; byId: Map<string, Suggestion> }) {
  const toast = useToast()
  if (!routines.length) return <Empty title="No routines yet">Routines appear when several bits share a theme. Longer rambles give better pathways.</Empty>

  async function patch(r: RoutineSuggestion, ids: string[], transitions: string[]) {
    await db.routines.update(r.id, { suggestionIds: ids, transitions })
  }
  async function move(r: RoutineSuggestion, i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= r.suggestionIds.length) return
    const ids = [...r.suggestionIds]; [ids[i], ids[j]] = [ids[j], ids[i]]
    const t = ids.slice(1).map((id, k) => suggestTransition(byId.get(ids[k])?.excerpt ?? '', byId.get(id)?.excerpt ?? '', 0))
    await patch(r, ids, t)
  }
  async function removeBit(r: RoutineSuggestion, i: number) {
    const ids = r.suggestionIds.filter((_, k) => k !== i)
    const t = ids.slice(1).map((id, k) => r.transitions[k] ?? suggestTransition(byId.get(ids[k])?.excerpt ?? '', byId.get(id)?.excerpt ?? '', 0))
    await patch(r, ids, t)
  }
  async function regenTransition(r: RoutineSuggestion, k: number) {
    const p = await activeProvider()
    const from = byId.get(r.suggestionIds[k])?.excerpt ?? '', to = byId.get(r.suggestionIds[k + 1])?.excerpt ?? ''
    const variant = Math.floor(Math.random() * 4) + 1
    const t = (await p.suggestTransition?.({ from, to, variant })) ?? suggestTransition(from, to, variant)
    const next = [...r.transitions]; next[k] = t
    await db.routines.update(r.id, { transitions: next })
  }
  async function editTransition(r: RoutineSuggestion, k: number, v: string) {
    const next = [...r.transitions]; next[k] = v
    await db.routines.update(r.id, { transitions: next })
  }
  async function accept(r: RoutineSuggestion) {
    const jokeIds: string[] = []
    for (const sid of r.suggestionIds) jokeIds.push(await acceptSuggestion(sid))
    const now = Date.now()
    const items: { id: string; kind: 'joke' | 'transition'; jokeId?: string; text?: string; origin: 'manual' | 'suggested' }[] = []
    jokeIds.forEach((jid, i) => {
      items.push({ id: uid(), kind: 'joke', jokeId: jid, origin: 'manual' })
      if (i < jokeIds.length - 1 && r.transitions[i]) items.push({ id: uid(), kind: 'transition', text: r.transitions[i], origin: 'suggested' })
    })
    const setId = uid()
    await db.sets.add({ id: setId, title: r.title, targetMinutes: 5, items, version: 1, createdAt: now, updatedAt: now })
    await db.routines.update(r.id, { status: 'accepted' })
    toast('Routine saved as a draft set.')
    location.hash = `#/sets/${setId}`
  }

  return (
    <div className="stack">
      {routines.map((r) => (
        <div key={r.id} className="card stack">
          <div className="row spread wrap"><h3>{r.title}</h3><div className="row">{r.status === 'accepted' ? <Badge kind="original">Saved as set</Badge> : <OriginBadge origin={r.origin} />}</div></div>
          {r.suggestionIds.map((sid, i) => {
            const s = byId.get(sid)
            return (
              <div key={sid} className="stack">
                <div className="card" style={{ background: 'var(--bg2)' }}>
                  <div className="row spread" style={{ alignItems: 'flex-start' }}>
                    <div className="grow small">{i + 1}. {(s?.userText ?? s?.excerpt ?? '(removed)').slice(0, 220)}
                      {sid === r.closerSuggestionId && <div style={{ marginTop: 4 }}><Badge kind="ai">Suggested closer</Badge>{r.closerWhy && <span className="muted"> {r.closerWhy}</span>}</div>}
                    </div>
                    <div className="row">
                      <button className="btn sm ghost" onClick={() => move(r, i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                      <button className="btn sm ghost" onClick={() => move(r, i, 1)} disabled={i === r.suggestionIds.length - 1} aria-label="Move down">↓</button>
                      <button className="btn sm ghost" onClick={() => removeBit(r, i)} aria-label="Remove from routine">✕</button>
                    </div>
                  </div>
                </div>
                {i < r.suggestionIds.length - 1 && (
                  <div className="transition">
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <textarea style={{ minHeight: 44, background: 'transparent', border: 'none', color: 'inherit', fontStyle: 'italic' }} value={r.transitions[i] ?? ''} onChange={(e) => editTransition(r, i, e.target.value)} aria-label="Transition" rows={2} />
                      <button className="btn sm ghost" onClick={() => regenTransition(r, i)} aria-label="Regenerate transition">↻</button>
                    </div>
                    <span className="small muted">↳ {r.origin === 'ai-suggested' ? 'AI-written transition (not your words)' : 'suggested transition (template)'}</span>
                  </div>
                )}
              </div>
            )
          })}
          {r.status !== 'accepted' && (
            <div className="row wrap"><button className="btn primary" onClick={() => accept(r)} disabled={r.suggestionIds.length < 1}>Accept → build set</button>
              <button className="btn danger" onClick={() => db.routines.update(r.id, { status: 'rejected' })}>Dismiss</button></div>
          )}
        </div>
      ))}
    </div>
  )
}

export const MARKER_LABEL: Record<MarkerKind, string> = { laugh: '😂 Laugh', 'big-laugh': '🔥 Big laugh', groan: '😬 Groan', miss: '🦗 Silence', note: '📝 Note' }

function MarkerSummary({ rec, jokes }: { rec: { markers?: { kind: MarkerKind; jokeId?: string }[] }; jokes: { id: string; title: string }[] }) {
  const per = new Map<string, { laughs: number; misses: number }>()
  for (const m of rec.markers ?? []) {
    if (!m.jokeId) continue
    const e = per.get(m.jokeId) ?? { laughs: 0, misses: 0 }
    if (m.kind === 'laugh' || m.kind === 'big-laugh') e.laughs += m.kind === 'big-laugh' ? 2 : 1
    else if (m.kind === 'miss' || m.kind === 'groan') e.misses++
    per.set(m.jokeId, e)
  }
  if (!per.size) return null
  return (
    <div className="callout small"><b>Per bit</b>
      {[...per].map(([jid, e]) => <div key={jid}>{jokes.find((j) => j.id === jid)?.title ?? 'Deleted joke'}: laugh score {e.laughs}, {e.misses} dead spot{e.misses === 1 ? '' : 's'}</div>)}
    </div>
  )
}

function RunInfo({ run, byId }: { run: import('../lib/types').AnalysisRun; byId: Map<string, Suggestion> }) {
  const short = (id: string) => { const t = byId.get(id); return t ? (t.userText ?? t.excerpt).slice(0, 60) + ((t.userText ?? t.excerpt).length > 60 ? '…' : '') : '(removed)' }
  return (
    <div className="stack">
      {run.fallbackFrom && <div className="callout warn small">AI analysis was unavailable ({run.fallbackReason}), so the offline pattern finder produced these results.</div>}
      {!run.fallbackFrom && run.model && <div className="muted small">Analyzed by <b>{run.model}</b>{run.ms ? ` in ${Math.round(run.ms / 1000)}s` : ''}. Excerpts are cut from your transcript by position; notes and transitions marked AI are the model's.</div>}
      {(run.warnings ?? []).map((w) => <div key={w} className="callout warn small">{w}</div>)}
      {(run.connections ?? []).length > 0 && (
        <div className="callout small"><b>Possible connections</b> <Badge kind="ai">AI</Badge>
          {run.connections!.map((c, i) => <div key={i} style={{ marginTop: 8 }}>
            <div className="excerpt small">“{c.aQuote ?? short(c.a)}”</div>
            <div className="small muted" style={{ textAlign: 'center' }}>↕</div>
            <div className="excerpt small">“{c.bQuote ?? short(c.b)}”</div>
            <span className="muted">{c.why}</span></div>)}
        </div>
      )}
    </div>
  )
}
