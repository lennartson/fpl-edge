import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function Setup() {
  const navigate = useNavigate()
  const [teamId, setTeamId] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const storedTeamId = localStorage.getItem('fpl_team_id')
    const storedEmail = localStorage.getItem('fpl_email')
    if (storedTeamId && storedEmail) {
      navigate('/my-team')
    }
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!teamId || !email) {
      setError('Please fill in both fields.')
      return
    }
    if (!/^\d+$/.test(teamId)) {
      setError('Team ID must be a number.')
      return
    }

    setLoading(true)
    try {
      const url = `https://corsproxy.io/?https://fantasy.premierleague.com/api/entry/${teamId}/`
      const { data } = await axios.get(url)
      const managerName = `${data.player_first_name} ${data.player_last_name}`
      localStorage.setItem('fpl_team_id', teamId)
      localStorage.setItem('fpl_email', email)
      localStorage.setItem('fpl_manager_name', managerName)
      navigate('/my-team')
    } catch {
      setError('Could not find that Team ID. Please check it and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-green-400 tracking-tight">FPL Edge</h1>
          <p className="text-gray-400 mt-2 text-sm">Fantasy Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              FPL Team ID
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="e.g. 1234567"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Find your Team ID in the URL when you visit your FPL team page:{' '}
              <span className="text-gray-400">fantasy.premierleague.com/entry/YOUR-ID/event/1</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors"
            />
            <p className="mt-1.5 text-xs text-gray-500">Used for deadline reminders.</p>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-400 hover:bg-green-300 disabled:opacity-60 disabled:cursor-not-allowed text-gray-950 font-semibold rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'Verifying…' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  )
}
