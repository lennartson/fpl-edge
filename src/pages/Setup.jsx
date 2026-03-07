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
      const url = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://fantasy.premierleague.com/api/entry/' + teamId + '/')}`
      const { data } = await axios.get(url)
      console.log('FPL API response:', data)
      const managerName = `${data.player_first_name} ${data.player_last_name}`
      localStorage.setItem('fpl_team_id', teamId)
      localStorage.setItem('fpl_email', email)
      localStorage.setItem('fpl_manager_name', managerName)
      navigate('/my-team')
    } catch (err) {
      console.error('FPL API error:', err)
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-cream">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg shadow-charcoal/10 border border-cream-darker p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-forest tracking-tight">FPL Edge</h1>
          <p className="text-charcoal/50 mt-2 text-sm">Fantasy Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              FPL Team ID
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="e.g. 1234567"
              className="w-full bg-cream border border-cream-darker rounded-lg px-4 py-2.5 text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-colors"
            />
            <p className="mt-1.5 text-xs text-charcoal/40">
              Find your Team ID in the URL when you visit your FPL team page:{' '}
              <span className="text-charcoal/60">fantasy.premierleague.com/entry/YOUR-ID/event/1</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-cream border border-cream-darker rounded-lg px-4 py-2.5 text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-colors"
            />
            <p className="mt-1.5 text-xs text-charcoal/40">Used for deadline reminders.</p>
          </div>

          {error && (
            <p className="text-coral-dark text-sm bg-coral/10 border border-coral/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest hover:bg-coral disabled:opacity-60 disabled:cursor-not-allowed text-cream font-semibold rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'Verifying…' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  )
}
