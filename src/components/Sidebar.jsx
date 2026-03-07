import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/setup', emoji: '⚙️', label: 'Setup' },
  { to: '/my-team', emoji: '👤', label: 'My Team' },
  { to: '/gameweek-intel', emoji: '📊', label: 'Gameweek Intel' },
  { to: '/strategy', emoji: '🧠', label: 'Strategy' },
  { to: '/rivals', emoji: '⚔️', label: 'Rivals' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col py-6">
      <div className="px-6 mb-8">
        <h1 className="text-green-400 font-bold text-xl tracking-tight">FPL Edge</h1>
        <p className="text-gray-500 text-xs mt-1">Fantasy Intelligence</p>
      </div>
      <nav className="flex-1 px-3">
        {navItems.map(({ to, emoji, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-400/10 text-green-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span className="text-base">{emoji}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
