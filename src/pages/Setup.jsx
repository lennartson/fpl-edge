import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getTeam, sendReminderEmail } from '../utils/fplApi'

export default function Setup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [teamId, setTeamId] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testEmailLoading, setTestEmailLoading] = useState(false)
  const [testEmailMessage, setTestEmailMessage] = useState('')
  const [testEmailError, setTestEmailError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const storedTeamId = localStorage.getItem('fpl_team_id')
    const storedEmail = localStorage.getItem('fpl_email')
    const isChangeMode = searchParams.get('change') === 'true'

    if (storedTeamId && storedEmail) {
      // Pre-fill the fields
      setTeamId(storedTeamId)
      setEmail(storedEmail)
      setIsUpdating(true)

      // Auto-redirect only if NOT in change mode
      if (!isChangeMode) {
        navigate('/my-team')
      }
    }
  }, [navigate, searchParams])

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
      const data = await getTeam(teamId)
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

  async function handleSendTestEmail() {
    setTestEmailMessage('')
    setTestEmailError('')

    const storedTeamId = localStorage.getItem('fpl_team_id')
    const storedEmail = localStorage.getItem('fpl_email')

    if (!storedTeamId || !storedEmail) {
      setTestEmailError('Please save your details first.')
      return
    }

    setTestEmailLoading(true)
    try {
      await sendReminderEmail(storedTeamId, storedEmail)
      setTestEmailMessage('✓ Test email sent! Check your inbox.')
      setTimeout(() => setTestEmailMessage(''), 5000)
    } catch (err) {
      console.error('Send email error:', err)
      setTestEmailError(err?.message || 'Failed to send test email')
    } finally {
      setTestEmailLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-cream py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Setup Form Card */}
        <div className="bg-white rounded-2xl shadow-lg shadow-charcoal/10 border border-cream-darker p-8">
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
              {loading ? 'Verifying…' : isUpdating ? 'Update Team' : 'Get Started'}
            </button>
          </form>
        </div>

        {/* Test Notifications Card */}
        {localStorage.getItem('fpl_team_id') && localStorage.getItem('fpl_email') && (
          <div className="bg-cream border border-cream-darker rounded-2xl shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                📬 Test Notifications
              </h3>
              <p className="text-sm text-charcoal/60 mt-1">Send a test deadline reminder to your email</p>
            </div>

            <button
              onClick={handleSendTestEmail}
              disabled={testEmailLoading}
              className="w-full bg-coral hover:bg-coral-dark disabled:opacity-60 disabled:cursor-not-allowed text-cream font-semibold rounded-lg py-2.5 transition-colors"
            >
              {testEmailLoading ? 'Sending…' : 'Send Test Email'}
            </button>

            {testEmailMessage && (
              <p className="text-green-700 text-sm mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 font-medium">
                ✓ {testEmailMessage}
              </p>
            )}
            {testEmailError && (
              <p className="text-coral-dark text-sm mt-3 bg-coral/10 border border-coral/20 rounded-lg px-4 py-3 font-medium">
                ✗ {testEmailError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
