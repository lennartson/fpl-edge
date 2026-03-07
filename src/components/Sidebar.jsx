import { NavLink, useNavigate } from 'react-router-dom'

const navItems = [
  { to: '/setup', emoji: '⚙️', label: 'Setup' },
  { to: '/my-team', emoji: '👤', label: 'My Team' },
  { to: '/gameweek-intel', emoji: '📊', label: 'Gameweek Intel' },
  { to: '/strategy', emoji: '🧠', label: 'Strategy' },
  { to: '/rivals', emoji: '⚔️', label: 'Rivals' },
]

export default function Sidebar() {
  const navigate = useNavigate()

  function handleChangeTeam() {
    navigate('/setup?change=true')
  }

  return (
    <aside className="w-56 min-h-screen bg-forest flex flex-col py-6">
      <div className="px-6 mb-8">
        <h1 className="text-cream font-bold text-xl tracking-tight">FPL Edge</h1>
        <p className="text-cream/50 text-xs mt-1">Fantasy Intelligence</p>
      </div>
      <nav className="flex-1 px-3">
        {navItems.map(({ to, emoji, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-coral text-cream'
                  : 'text-cream/70 hover:bg-forest-light hover:text-cream'
              }`
            }
          >
            <span className="text-base">{emoji}</span>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pt-6 border-t border-forest-light/20">
        <button
          onClick={handleChangeTeam}
          className="flex items-center gap-2 px-3 py-2 text-xs text-cream/50 hover:text-cream/70 transition-colors rounded-lg hover:bg-forest-light/30 w-full"
        >
          <span className="text-sm">🔄</span>
          Change Team
        </button>
      </div>
    </aside>
  )
}
