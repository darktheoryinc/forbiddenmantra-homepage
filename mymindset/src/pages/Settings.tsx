import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { exportBackup, getSettings, saveSettings, importBackup } from '../lib/db'
import { getServerStatus } from '../lib/api'
import { providers } from '../ai/service'
import type { ServerStatus } from '../ai/types'
import { Page, Badge, useToast, download } from '../components/ui'

export default function Settings() {
  const toast = useToast()
  const s = useLiveQuery(() => getSettings(), [])
  const [status, setStatus] = useState<ServerStatus | null | undefined>(undefined)
  const [token, setToken] = useState('')
  useEffect(() => { if (s) setToken(s.apiToken) }, [s?.apiToken]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { getServerStatus().then(setStatus) }, [])
  if (!s) return null

  const llm = status?.analysis.configured
  return (
    <Page title="Settings" actions={<Link to="/" className="btn ghost sm">Done</Link>}>
      <section className="card stack">
        <h3>Joke discovery engine</h3>
        {Object.entries(providers).map(([key, p]) => {
          const disabled = key === 'server' && !llm
          return (
            <label key={key} style={{ textTransform: 'none', display: 'flex', gap: 10, alignItems: 'flex-start', opacity: disabled ? 0.55 : 1 }}>
              <input type="radio" name="prov" style={{ width: 20, minHeight: 20, marginTop: 4 }} checked={s.analysisProvider === key} disabled={disabled} onChange={() => saveSettings({ analysisProvider: key as 'local' | 'server' })} />
              <span><b style={{ color: 'var(--text)' }}>{p.label}</b> {key === 'local' ? <Badge kind="heur">no AI model</Badge> : llm ? <Badge kind="ai">connected</Badge> : <Badge>not configured</Badge>}<br /><span className="small muted">{p.description}</span></span>
            </label>
          )
        })}
      </section>

      <section className="card stack">
        <h3>Server integrations</h3>
        {status === undefined ? <span className="muted">Checking…</span> : status === null ? (
          <div className="callout warn">The MyMindSet server isn't reachable. Recording, the Vault, sets and stage mode still work offline; transcription, AI analysis and Trend Radar need the server (<code>npm run dev</code> or <code>npm start</code>).</div>
        ) : (
          <div className="stack small">
            <div>Transcription: {status.transcription.configured ? <Badge kind="original">{status.transcription.provider}</Badge> : <Badge>not configured</Badge>}</div>
            <div>AI analysis: {status.analysis.configured ? <Badge kind="ai">{status.analysis.provider}</Badge> : <Badge>not configured</Badge>}</div>
            <div>Trend Radar: <Badge kind="original">{status.trends.provider}</Badge></div>
            <div>Access token required: {status.authRequired ? 'yes' : 'no'}</div>
            <div className="muted">Keys live in the server's environment (<code>.env</code>), never in this app.</div>
          </div>
        )}
        <div className="field"><label htmlFor="tok">Server access token (only if your server sets APP_ACCESS_TOKEN)</label>
          <input id="tok" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} onBlur={() => saveSettings({ apiToken: token })} /></div>
      </section>

      <section className="card stack">
        <h3>Set timing</h3>
        <div className="row">
          <div className="field grow"><label htmlFor="wpm">Pace (words / min)</label><input id="wpm" type="number" min={60} max={260} value={s.wordsPerMinute} onChange={(e) => saveSettings({ wordsPerMinute: Math.max(60, Math.min(260, Number(e.target.value) || 140)) })} /></div>
          <div className="field grow"><label htmlFor="lb">Laugh break (sec / bit)</label><input id="lb" type="number" min={0} max={20} value={s.laughBreakSec} onChange={(e) => saveSettings({ laughBreakSec: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} /></div>
        </div>
        <div className="field"><label htmlFor="cap">Warn when one bit runs longer than (seconds)</label><input id="cap" type="number" min={15} max={600} value={s.maxBitSec} onChange={(e) => saveSettings({ maxBitSec: Math.max(15, Math.min(600, Number(e.target.value) || 90)) })} /></div>
        <p className="muted small" style={{ margin: 0 }}>Tip: record yourself doing a bit, note the real time, and tune the pace until estimates match.</p>
      </section>

      <section className="card stack">
        <h3>Your data</h3>
        <p className="muted small" style={{ margin: 0 }}>Everything is stored privately on this device (IndexedDB). There are no accounts and no cloud sync yet, so export a backup now and then.</p>
        <button className="btn" onClick={async () => { download(`mymindset-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportBackup(), null, 2)); toast('Backup downloaded (audio files not included).') }}>Download JSON backup</button>
        <label className="btn" style={{ cursor: 'pointer' }}>Restore from JSON backup
          <input type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f) return
            try {
              if (f.size > 50 * 1024 * 1024) throw new Error('That file is too large to be a MyMindSet backup.')
              const counts = await importBackup(JSON.parse(await f.text()))
              toast(`Restored ${Object.values(counts).reduce((a, b) => a + b, 0)} items (merged by id; nothing deleted).`)
            } catch (err) { toast(err instanceof SyntaxError ? 'That file is not valid JSON.' : (err as Error).message, 'err') }
          }} />
        </label>
        <button className="btn ghost" onClick={async () => { await navigator.storage?.persist?.().then((ok) => toast(ok ? 'Storage marked persistent.' : 'Browser declined persistent storage.')) }}>Ask browser to keep my data</button>
      </section>
    </Page>
  )
}
