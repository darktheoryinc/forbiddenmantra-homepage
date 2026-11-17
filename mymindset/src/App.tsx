import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import Capture from './pages/Capture'
import RecordingDetail from './pages/RecordingDetail'
import Vault from './pages/Vault'
import JokeDetail from './pages/JokeDetail'
import Sets from './pages/Sets'
import SetBuilder from './pages/SetBuilder'
import Stage from './pages/Stage'
import Shows from './pages/Shows'
import Radar from './pages/Radar'
import Settings from './pages/Settings'

const NAV = [
  { to: '/', label: 'Capture', icon: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4' },
  { to: '/vault', label: 'Vault', icon: 'M4 5h16v14H4zM4 9h16M9 5v14' },
  { to: '/sets', label: 'Sets', icon: 'M5 6h14M5 12h14M5 18h9' },
  { to: '/radar', label: 'Radar', icon: 'M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 12l6-6M12 3a9 9 0 1 0 9 9' },
  { to: '/shows', label: 'Shows', icon: 'M4 7l8-4 8 4v10l-8 4-8-4zM12 3v18' },
]

export default function App() {
  const { pathname } = useLocation()
  const stage = pathname.startsWith('/stage')
  return (
    <ToastProvider>
      <div className="app">
        <Routes>
          <Route path="/" element={<Capture />} />
          <Route path="/recording/:id" element={<RecordingDetail />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/joke/:id" element={<JokeDetail />} />
          <Route path="/sets" element={<Sets />} />
          <Route path="/sets/:id" element={<SetBuilder />} />
          <Route path="/stage/:id" element={<Stage />} />
          <Route path="/shows" element={<Shows />} />
          <Route path="/radar" element={<Radar />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!stage && (
          <nav className="bottom-nav" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={n.icon} /></svg>
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </ToastProvider>
  )
}
