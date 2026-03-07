import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Setup from './pages/Setup'
import MyTeam from './pages/MyTeam'
import GameweekIntel from './pages/GameweekIntel'
import Strategy from './pages/Strategy'
import Rivals from './pages/Rivals'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-cream text-charcoal">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/setup" replace />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/my-team" element={<MyTeam />} />
            <Route path="/gameweek-intel" element={<GameweekIntel />} />
            <Route path="/strategy" element={<Strategy />} />
            <Route path="/rivals" element={<Rivals />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
