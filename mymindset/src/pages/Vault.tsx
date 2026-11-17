import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, createJoke, getSettings, splitNotes, jokeStats } from '../lib/db'
import { BUILTIN_CATEGORIES, JOKE_STATUSES, type JokeStatus } from '../lib/types'
import { Page, Badge, OriginBadge, Empty, Modal, useToast } from '../components/ui'

export function useCategories() {
  const s = useLiveQuery(() => getSettings(), [])
  return useMemo(() => [...BUILTIN_CATEGORIES, ...(s?.customCategories ?? [])], [s])
}

export default function Vault() {
  const nav = useNavigate()
  const toast = useToast()
  const jokes = useLiveQuery(() => db.jokes.orderBy('updatedAt').reverse().toArray(), [])
  const cats = useCategories()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState<JokeStatus | ''>('')
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const perfs = useLiveQuery(() => db.performances.toArray(), [])
  const [importing, setImporting] = useState(false)
  const [raw, setRaw] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const blocks = useMemo(() => splitNotes(raw), [raw])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (jokes ?? []).filter((j) =>
      (!cat || j.category === cat) && (!status || j.status === status) &&
      (!needle || [j.title, j.text, j.notes, j.tags.join(' '), j.setup, j.punchline].some((f) => f?.toLowerCase().includes(needle))))
  }, [jokes, q, cat, status])

  async function add() {
    if (!text.trim()) return
    try {
      const j = await createJoke({ text: text.trim(), category: cat || 'Observational' })
      setAdding(false); setText('')
      nav(`/joke/${j.id}`)
    } catch { toast('Could not save the joke.', 'err') }
  }

  async function readFile(f?: File) {
    if (!f) return
    if (f.size > 2 * 1024 * 1024) return toast('That file is too large (2 MB max).', 'err')
    if (!/\.(txt|md|markdown|csv)$/i.test(f.name) && !f.type.startsWith('text/')) return toast('Import supports plain text, Markdown or CSV. For photos, attach them to a joke.', 'err')
    const t = await f.text()
    setRaw(t); setPicked(new Set(splitNotes(t).map((_, i) => i)))
  }
  async function runImport() {
    const list = blocks.filter((_, i) => picked.has(i))
    for (const b of list) await createJoke({ text: b, tags: ['imported'], status: 'idea', category: cat || 'Observational' })
    toast(`Imported ${list.length} bit${list.length === 1 ? '' : 's'} as ideas.`)
    setImporting(false); setRaw(''); setPicked(new Set())
  }

  return (
    <Page title="Joke Vault" actions={<><button className="btn sm" onClick={() => setImporting(true)}>Import</button><button className="btn primary sm" onClick={() => setAdding(true)}>+ New</button></>}>
      <input type="search" placeholder="Search jokes, tags, notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      <div className="tabs" role="group" aria-label="Category filter">
        <button className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>All</button>
        {cats.map((c) => <button key={c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}
      </div>
      <div className="tabs" role="group" aria-label="Status filter">
        <button className={`chip${!status ? ' on' : ''}`} onClick={() => setStatus('')}>Any status</button>
        {JOKE_STATUSES.map((s) => <button key={s} className={`chip${status === s ? ' on' : ''}`} onClick={() => setStatus(status === s ? '' : s)}>{s}</button>)}
      </div>
      {!jokes ? null : shown.length === 0 ? (
        <Empty title={jokes.length ? 'No matches' : 'Your Vault is empty'}>{jokes.length ? 'Try clearing a filter.' : 'Record a ramble and accept candidates, or add a joke by hand.'}</Empty>
      ) : (
        <div className="stack">
          {shown.map((j) => (
            <Link key={j.id} to={`/joke/${j.id}`} className="card card-link">
              <div className="row spread"><h3>{j.title}</h3><Badge kind="status">{j.status}</Badge></div>
              <p style={{ margin: '4px 0 8px' }} className="muted">{j.text.length > 160 ? `${j.text.slice(0, 160)}…` : j.text}</p>
              <div className="row wrap"><Badge>{j.category}</Badge><OriginBadge origin={j.origin} />{(() => { const st = jokeStats(j.id, perfs ?? []); return st.total ? <Badge>{st.hit}/{st.total} hit</Badge> : null })()}{j.tags.slice(0, 4).map((t) => <span key={t} className="chip">#{t}</span>)}</div>
            </Link>
          ))}
        </div>
      )}
      {importing && (
        <Modal title="Import notes" onClose={() => setImporting(false)}>
          <p className="muted small" style={{ margin: 0 }}>Paste notes or choose a .txt / .md / .csv file. Blank lines (or list items) separate bits. Nothing is rewritten.</p>
          <input type="file" accept=".txt,.md,.markdown,.csv,text/*" onChange={(e) => readFile(e.target.files?.[0])} aria-label="Notes file" />
          <textarea value={raw} onChange={(e) => { setRaw(e.target.value); setPicked(new Set(splitNotes(e.target.value).map((_, i) => i))) }} placeholder="Paste your notebook here…" aria-label="Notes to import" style={{ minHeight: 120 }} />
          {blocks.length > 0 && <>
            <div className="muted small">{picked.size} of {blocks.length} selected</div>
            {blocks.map((b, i) => (
              <label key={i} style={{ textTransform: 'none', display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--text)' }}>
                <input type="checkbox" style={{ width: 22, minHeight: 22 }} checked={picked.has(i)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })} />
                <span className="small">{b.length > 200 ? `${b.slice(0, 200)}…` : b}</span>
              </label>))}
            <button className="btn primary" onClick={runImport} disabled={!picked.size}>Import {picked.size}</button>
          </>}
        </Modal>
      )}
      {adding && (
        <Modal title="New joke" onClose={() => setAdding(false)}>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Write it however it comes out…" aria-label="Joke text" />
          <button className="btn primary" onClick={add} disabled={!text.trim()}>Save to Vault</button>
        </Modal>
      )}
    </Page>
  )
}
