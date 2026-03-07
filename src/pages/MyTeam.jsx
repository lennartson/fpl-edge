import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const PROXY = 'https://api.allorigins.win/raw?url='
const FPL = 'https://fantasy.premierleague.com/api'

function proxy(url) {
  return `${PROXY}${encodeURIComponent(url)}`
}

const POSITION_LABELS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

function PlayerCard({ player }) {
  return (
    <div className="flex flex-col items-center bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 w-28 text-center">
      <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">
        {POSITION_LABELS[player.position]}
      </span>
      <span className="text-white text-sm font-bold leading-tight mt-0.5 truncate w-full">
        {player.web_name}
      </span>
      <span className="text-gray-400 text-xs truncate w-full">{player.teamName}</span>
      <div className="mt-1.5 flex gap-2 text-xs">
        <span className="text-green-400 font-semibold">{player.gwPoints} pts</span>
        <span className="text-gray-500">£{(player.price / 10).toFixed(1)}m</span>
      </div>
      <span className="text-gray-500 text-xs">{player.totalPoints} tot</span>
      {player.isCaptain && (
        <span className="mt-1 text-xs bg-green-400 text-gray-950 font-bold rounded px-1.5">C</span>
      )}
      {player.isViceCaptain && (
        <span className="mt-1 text-xs bg-gray-600 text-white font-bold rounded px-1.5">V</span>
      )}
    </div>
  )
}

function PitchRow({ players, label }) {
  return (
    <div className="mb-4">
      <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex justify-center gap-2 flex-wrap">
        {players.map((p) => (
          <PlayerCard key={p.id} player={p} />
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${accent ? 'text-green-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

export default function MyTeam() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teamInfo, setTeamInfo] = useState(null)
  const [squad, setSquad] = useState([])

  useEffect(() => {
    const teamId = localStorage.getItem('fpl_team_id')
    if (!teamId) {
      navigate('/setup')
      return
    }

    async function fetchAll() {
      try {
        const [bootstrapRes, entryRes] = await Promise.all([
          axios.get(proxy(`${FPL}/bootstrap-static/`)),
          axios.get(proxy(`${FPL}/entry/${teamId}/`)),
        ])

        const bootstrap = bootstrapRes.data
        const entry = entryRes.data

        const currentGw =
          bootstrap.events.find((e) => e.is_current)?.id ||
          bootstrap.events.find((e) => e.is_next)?.id ||
          1

        const picksRes = await axios.get(
          proxy(`${FPL}/entry/${teamId}/event/${currentGw}/picks/`)
        )
        const picks = picksRes.data

        const playerMap = {}
        bootstrap.elements.forEach((el) => { playerMap[el.id] = el })
        const teamMap = {}
        bootstrap.teams.forEach((t) => { teamMap[t.id] = t.short_name })

        const enriched = picks.picks.map((pick) => {
          const el = playerMap[pick.element]
          return {
            id: pick.element,
            web_name: el.web_name,
            teamName: teamMap[el.team],
            position: el.element_type,
            gwPoints: el.event_points,
            totalPoints: el.total_points,
            price: el.now_cost,
            isCaptain: pick.is_captain,
            isViceCaptain: pick.is_vice_captain,
            multiplier: pick.multiplier,
            pickPosition: pick.position,
          }
        })

        setTeamInfo({
          managerName: `${entry.player_first_name} ${entry.player_last_name}`,
          teamName: entry.name,
          overallRank: entry.summary_overall_rank?.toLocaleString() ?? '—',
          totalPoints: entry.summary_overall_points,
          gwPoints: picks.entry_history.points,
          bank: entry.last_deadline_bank / 10,
          gameweek: currentGw,
        })

        setSquad(enriched)
      } catch (err) {
        console.error('MyTeam fetch error:', err)
        setError(err?.message || String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-gray-700 border-t-green-400 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading your squad…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-400 font-semibold mb-1">Failed to load team data</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const starters = squad.filter((p) => p.pickPosition <= 11)
  const bench = squad.filter((p) => p.pickPosition > 11)

  const gkp = starters.filter((p) => p.position === 1)
  const def = starters.filter((p) => p.position === 2)
  const mid = starters.filter((p) => p.position === 3)
  const fwd = starters.filter((p) => p.position === 4)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header stats */}
      <div className="mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{teamInfo.teamName}</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {teamInfo.managerName} · GW{teamInfo.gameweek}
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <Stat label="GW Points" value={teamInfo.gwPoints} accent />
            <Stat label="Total Points" value={teamInfo.totalPoints} />
            <Stat label="Overall Rank" value={teamInfo.overallRank} />
            <Stat label="In the Bank" value={`£${teamInfo.bank.toFixed(1)}m`} />
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-5 text-center">
          Starting XI
        </h2>
        <PitchRow players={gkp} label="Goalkeeper" />
        <PitchRow players={def} label="Defenders" />
        <PitchRow players={mid} label="Midfielders" />
        <PitchRow players={fwd} label="Forwards" />

        <div className="border-t border-dashed border-gray-700 mt-2 pt-4">
          <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-2">Bench</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {bench
              .sort((a, b) => a.pickPosition - b.pickPosition)
              .map((p) => (
                <PlayerCard key={p.id} player={p} />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
