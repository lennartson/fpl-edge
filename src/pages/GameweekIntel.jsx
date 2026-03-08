import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getCurrentGameweek,
  getTeam,
  getTeamPicks,
  getPlayers,
  getTeams,
  getUpcomingFixtures,
  optimizeTransfers,
} from '../utils/fplApi'

const POSITION_LABELS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

function fdrBg(fdr) {
  if (fdr <= 2) return '#166534'
  if (fdr === 3) return '#16a34a'
  if (fdr === 4) return '#d97706'
  return '#dc2626'
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-cream">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-cream-darker border-t-forest rounded-full animate-spin" />
        <p className="text-charcoal/50 text-sm">Loading Gameweek Intel…</p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-cream-darker rounded-2xl shadow-sm p-6 mb-6">
      <h2 className="text-lg font-bold text-charcoal mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ── Section 1: Captain Pick ───────────────────────────────────────────────────

function ScoreBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-charcoal/50">{label}</span>
        <span className="text-charcoal/60 font-medium">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-cream-darker rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function CaptainCard({ pick, rank, playerMap, teamMap, fixtureMap, currentGw }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const player = playerMap[pick.id]
  if (!player) return null

  const teamName = teamMap[player.team_id] || '?'
  const nextFixture = (fixtureMap[player.team_id] || []).find((f) => f.gameweek === currentGw + 1)
  const isHome = nextFixture?.home_team_id === player.team_id
  const opponent = nextFixture
    ? isHome
      ? teamMap[nextFixture.away_team_id]
      : teamMap[nextFixture.home_team_id]
    : null
  const fdr = nextFixture ? (isHome ? nextFixture.fdr_home : nextFixture.fdr_away) : null

  const form = parseFloat(player.form) || 0
  const ict = parseFloat(player.ict_index) || 0
  const fdrScore = fdr != null ? ((6 - fdr) / 5) * 10 : 5

  // Composite score components (matching brief: form 40%, ICT 30%, fixture 30%)
  const formContrib = form * 0.4
  const ictContrib = (ict / 10) * 0.3
  const fixtureContrib = fdrScore * 0.3
  const compositeMax = form * 0.4 + (ict / 10) * 0.3 + 10 * 0.3

  const isCaptain = rank === 0
  const isVice = rank === 1

  const borderClass = isCaptain
    ? 'border-2 border-green-600 bg-green-50'
    : isVice
    ? 'border-2 border-coral bg-coral/5'
    : 'border border-cream-darker'

  return (
    <div
      className={`rounded-xl p-4 cursor-default transition-all ${borderClass}`}
      onMouseEnter={() => setShowBreakdown(true)}
      onMouseLeave={() => setShowBreakdown(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isCaptain && (
              <span className="text-xs font-bold text-white bg-green-600 rounded px-2 py-0.5 shrink-0">
                ★ Captain
              </span>
            )}
            {isVice && (
              <span className="text-xs font-bold text-white bg-coral rounded px-2 py-0.5 shrink-0">
                Vice Captain
              </span>
            )}
            <span className="text-xs text-charcoal/40 uppercase tracking-wide">
              {POSITION_LABELS[player.position]}
            </span>
          </div>
          <p className="font-bold text-charcoal text-base leading-tight truncate">{player.web_name}</p>
          <p className="text-charcoal/50 text-sm">{teamName}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-forest">{pick.xpts.toFixed(1)}</p>
          <p className="text-xs text-charcoal/40">xPts</p>
        </div>
      </div>

      {nextFixture && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span
            className="px-2 py-0.5 rounded font-semibold text-white"
            style={{ backgroundColor: fdrBg(fdr) }}
          >
            {isHome ? `vs ${opponent}` : `@ ${opponent}`}
          </span>
          <span className="text-charcoal/40">{isHome ? 'Home' : 'Away'}</span>
        </div>
      )}

      {showBreakdown && (
        <div className="mt-3 space-y-1.5 border-t border-cream-darker pt-3">
          <p className="text-xs text-charcoal/40 mb-2">Score breakdown (hover)</p>
          <ScoreBar label="Form (40%)" value={formContrib} max={compositeMax} color="#1a4a3a" />
          <ScoreBar label="ICT (30%)" value={ictContrib} max={compositeMax} color="#E8603C" />
          <ScoreBar label="Fixture (30%)" value={fixtureContrib} max={compositeMax} color="#d97706" />
        </div>
      )}
    </div>
  )
}

// ── Section 2: Fixture Difficulty Grid ───────────────────────────────────────

function FixtureGrid({ squad, playerMap, teamMap, fixtureMap, currentGw }) {
  const nextGws = [currentGw + 1, currentGw + 2, currentGw + 3, currentGw + 4, currentGw + 5]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-y-0.5">
        <thead>
          <tr>
            <th className="text-left text-charcoal/40 font-medium pb-2 pr-4 w-36">Player</th>
            {nextGws.map((gw) => (
              <th key={gw} className="text-center text-charcoal/40 font-medium pb-2 px-1 w-20">
                GW{gw}
              </th>
            ))}
            <th className="text-center text-charcoal/40 font-medium pb-2 px-2 w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {squad.map((pick) => {
            const player = playerMap[pick.element]
            if (!player) return null

            const cells = nextGws.map((gw) => ({
              gw,
              fixtures: (fixtureMap[player.team_id] || []).filter((f) => f.gameweek === gw),
            }))

            const hardCells = cells.filter(({ fixtures }) =>
              fixtures.some((f) => {
                const isHome = f.home_team_id === player.team_id
                return (isHome ? f.fdr_home : f.fdr_away) >= 4
              })
            ).length

            const isCandidate = hardCells >= 3
            const isBench = pick.position > 11

            return (
              <tr
                key={pick.element}
                className={isCandidate ? 'bg-red-50' : isBench ? 'opacity-60' : ''}
              >
                <td className="py-1.5 pr-4">
                  <p className="font-medium text-charcoal leading-tight truncate max-w-[8rem]">
                    {player.web_name}
                  </p>
                  <p className="text-charcoal/40 text-xs">{teamMap[player.team_id]}</p>
                </td>
                {cells.map(({ gw, fixtures }) => {
                  if (fixtures.length === 0) {
                    return (
                      <td key={gw} className="px-1 py-1 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-charcoal/10 text-charcoal/40 font-medium">
                          —
                        </span>
                      </td>
                    )
                  }
                  return (
                    <td key={gw} className="px-1 py-1 text-center">
                      <div className="flex flex-col gap-0.5 items-center">
                        {fixtures.map((f, i) => {
                          const isHome = f.home_team_id === player.team_id
                          const fdr = isHome ? f.fdr_home : f.fdr_away
                          const opp = isHome ? teamMap[f.away_team_id] : teamMap[f.home_team_id]
                          return (
                            <span
                              key={i}
                              className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold text-white whitespace-nowrap"
                              style={{ backgroundColor: fdrBg(fdr) }}
                              title={`FDR ${fdr}`}
                            >
                              {opp}
                              {isHome ? '' : ' A'}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
                <td className="px-2 py-1 text-center">
                  {isCandidate ? (
                    <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Transfer?
                    </span>
                  ) : (
                    <span className="text-xs text-charcoal/20">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Section 3: Transfer Recommendations ──────────────────────────────────────

const CHIP_CONFIG = {
  BENCH_BOOST: { label: 'Bench Boost', bg: 'bg-forest', icon: '📦' },
  TRIPLE_CAPTAIN: { label: 'Triple Captain', bg: 'bg-forest', icon: '👑' },
  FREE_HIT: { label: 'Free Hit', bg: 'bg-coral', icon: '⚡' },
  WILDCARD: { label: 'Wildcard', bg: 'bg-coral', icon: '🃏' },
}

function ChipAlert({ alert }) {
  const key = Object.keys(CHIP_CONFIG).find((k) => alert.startsWith(k))
  const config = CHIP_CONFIG[key] || { label: 'Chip Alert', bg: 'bg-forest', icon: '💡' }
  const body = alert.replace(/^[A-Z_]+: /, '')
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-3 text-cream ${config.bg}`}>
      <span className="text-lg mt-0.5">{config.icon}</span>
      <div>
        <p className="font-bold text-sm">{config.label}</p>
        <p className="text-sm opacity-80">{body}</p>
      </div>
    </div>
  )
}

function TransferCard({ combo }) {
  const isRoll = combo.transfers === 0
  const isFree = combo.transferCost === 0 && combo.transfers > 0

  if (isRoll) {
    return (
      <div className="border-2 border-amber-300 rounded-xl p-4 mb-3 bg-amber-50">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              🏦 Roll Transfer
            </span>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-amber-700">+{combo.netGain}</p>
            <p className="text-xs text-charcoal/40">banking flexibility</p>
          </div>
        </div>
        <p className="text-sm text-amber-900">{combo.reason}</p>
      </div>
    )
  }

  return (
    <div className="border border-cream-darker rounded-xl p-4 mb-3">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isFree ? (
            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              Free transfer
            </span>
          ) : (
            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
              −{combo.transferCost}pt hit
            </span>
          )}
          <span className="text-xs text-charcoal/40">
            {combo.transfers} transfer{combo.transfers > 1 ? 's' : ''}
          </span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-forest">+{combo.netGain}</p>
          <p className="text-xs text-charcoal/40">net xPts gain</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-charcoal/40 uppercase tracking-wide mb-2">Out</p>
          {combo.out.map((p) => (
            <div key={p.id} className="mb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-charcoal">{p.name}</p>
                <span className="text-xs font-bold text-coral ml-2">{p.xpts} xPts</span>
              </div>
              <p className="text-xs text-charcoal/40">{p.reason || 'Not available'}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold text-charcoal/40 uppercase tracking-wide mb-2">In</p>
          {combo.in.map((p) => (
            <div key={p.id} className="mb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-charcoal">{p.name}</p>
                <span className="text-xs font-bold text-forest ml-2">{p.xpts} xPts</span>
              </div>
              <p className="text-xs text-charcoal/40">+{combo.xptsGain.toFixed(1)} xPts over 3 GWs</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Section 4: Differential Finder ───────────────────────────────────────────

function DifferentialCard({ player, teamMap, fixtureMap, currentGw }) {
  const teamName = teamMap[player.team_id] || '?'
  const nextFixtures = (fixtureMap[player.team_id] || [])
    .filter((f) => f.gameweek > currentGw)
    .slice(0, 3)

  return (
    <div className="border border-cream-darker rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-amber-500">⚡</span>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">
              Differential pick
            </span>
          </div>
          <p className="font-bold text-charcoal text-base leading-tight truncate">{player.web_name}</p>
          <p className="text-charcoal/50 text-sm">
            {teamName} · {POSITION_LABELS[player.position]}
          </p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-lg font-bold text-forest">£{(player.price / 10).toFixed(1)}m</p>
          <p className="text-xs text-charcoal/40">{parseFloat(player.selected_by_percent).toFixed(1)}% owned</p>
        </div>
      </div>

      <p className="text-sm font-semibold text-coral mb-2">
        Form: {parseFloat(player.form).toFixed(1)}
      </p>

      <div className="flex flex-wrap gap-1">
        {nextFixtures.map((f, i) => {
          const isHome = f.home_team_id === player.team_id
          const fdr = isHome ? f.fdr_home : f.fdr_away
          const opp = isHome ? teamMap[f.away_team_id] : teamMap[f.home_team_id]
          return (
            <span
              key={i}
              className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
              style={{ backgroundColor: fdrBg(fdr) }}
            >
              GW{f.gameweek} {isHome ? `vs ${opp}` : `@ ${opp}`}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GameweekIntel() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentGw, setCurrentGw] = useState(null)
  const [playerMap, setPlayerMap] = useState({})
  const [teamMap, setTeamMap] = useState({})
  const [fixtureMap, setFixtureMap] = useState({})
  const [squad, setSquad] = useState([])
  const [optimizerData, setOptimizerData] = useState(null)
  const [differentials, setDifferentials] = useState([])

  useEffect(() => {
    const teamId = localStorage.getItem('fpl_team_id')
    if (!teamId) {
      navigate('/setup')
      return
    }

    async function fetchAll() {
      try {
        // Step 1 — base data in parallel
        const [gwData, teamEntry, players, teams, fixtures] = await Promise.all([
          getCurrentGameweek(),
          getTeam(Number(teamId)),
          getPlayers({ limit: 700 }),
          getTeams(),
          getUpcomingFixtures(),
        ])

        const gw = gwData.id
        setCurrentGw(gw)

        // Player map: id → player
        const pMap = {}
        players.forEach((p) => { pMap[p.id] = p })
        setPlayerMap(pMap)

        // Team map: id → short_name
        const tMap = {}
        teams.forEach((t) => { tMap[t.id] = t.short_name })
        setTeamMap(tMap)

        // Fixture map: team_id → sorted upcoming fixtures
        const fMap = {}
        fixtures.forEach((f) => {
          ;[f.home_team_id, f.away_team_id].forEach((tid) => {
            if (!fMap[tid]) fMap[tid] = []
            fMap[tid].push(f)
          })
        })
        Object.values(fMap).forEach((arr) => arr.sort((a, b) => a.gameweek - b.gameweek))
        setFixtureMap(fMap)

        // Step 2 — squad picks
        const picksData = await getTeamPicks(Number(teamId), gw)
        const picksArray = picksData.picks || []
        setSquad(picksArray)

        // Step 3 — optimizer (needs picks)
        const budget = (teamEntry.last_deadline_bank || 0) / 10
        const freeTransfers = teamEntry.transfers?.limit ?? 1
        const optimizerResult = await optimizeTransfers({
          teamId: Number(teamId),
          picks: picksArray,
          budget,
          freeTransfers,
        })
        setOptimizerData(optimizerResult)

        // Step 4 — differentials (players not in squad with good profile)
        const squadIds = new Set(picksArray.map((p) => p.element))
        const diffs = players
          .filter((p) => {
            if (squadIds.has(p.id)) return false
            if (parseFloat(p.selected_by_percent) >= 10) return false
            if (parseFloat(p.form) <= 6.0) return false
            const next3 = (fMap[p.team_id] || []).filter((f) => f.gameweek > gw).slice(0, 3)
            if (next3.length === 0) return false
            const avgFdr =
              next3.reduce((sum, f) => {
                const isHome = f.home_team_id === p.team_id
                return sum + (isHome ? f.fdr_home : f.fdr_away)
              }, 0) / next3.length
            return avgFdr < 3
          })
          .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
          .slice(0, 5)
        setDifferentials(diffs)
      } catch (err) {
        console.error('GameweekIntel fetch error:', err)
        setError(err?.message || String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [navigate])

  if (loading) return <Spinner />

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-cream">
        <div className="bg-coral/10 border border-coral/20 rounded-xl p-6 max-w-md text-center">
          <p className="text-coral-dark font-semibold mb-1">Failed to load Gameweek Intel</p>
          <p className="text-charcoal/60 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const captainPicks = optimizerData?.captainPicks || []
  const topTransfers = optimizerData?.topTransfers || []
  const chipAlerts = optimizerData?.chipAlerts || []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">📊 Gameweek Intel</h1>
        <p className="text-charcoal/50 text-sm mt-0.5">
          GW{currentGw} · Actionable recommendations based on live xPts data
        </p>
      </div>

      {/* Top row: two columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Section 1 — Captain Pick */}
        <Section title="⭐ Captain Pick">
          {captainPicks.length === 0 ? (
            <p className="text-charcoal/40 text-sm">No captain data available.</p>
          ) : (
            <div className="space-y-3">
              {captainPicks.map((pick, i) => (
                <CaptainCard
                  key={pick.id}
                  pick={pick}
                  rank={i}
                  playerMap={playerMap}
                  teamMap={teamMap}
                  fixtureMap={fixtureMap}
                  currentGw={currentGw}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Section 4 — Differential Finder */}
        <Section title="⚡ Differential Finder">
          <p className="text-xs text-charcoal/40 mb-3">
            Under 10% owned · Form &gt; 6.0 · Avg FDR next 3 GWs &lt; 3
          </p>
          {differentials.length === 0 ? (
            <p className="text-charcoal/40 text-sm">No differentials match criteria this week.</p>
          ) : (
            <div className="space-y-3">
              {differentials.map((p) => (
                <DifferentialCard
                  key={p.id}
                  player={p}
                  teamMap={teamMap}
                  fixtureMap={fixtureMap}
                  currentGw={currentGw}
                />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Section 3 — Transfer Recommendations */}
      <Section title="🔄 Transfer Recommendations">
        {chipAlerts.length > 0 && (
          <div className="mb-4">
            {chipAlerts.map((alert, i) => (
              <ChipAlert key={i} alert={alert} />
            ))}
          </div>
        )}

        {topTransfers.length === 0 ? (
          <div className="text-center py-4 bg-cream rounded-xl">
            <p className="font-semibold text-charcoal/70">Roll your transfer</p>
            <p className="text-charcoal/40 text-sm mt-1">
              No transfer combination clears the gain threshold. Saving your free transfer may be worth
              more next week.
            </p>
          </div>
        ) : (
          <>
            {topTransfers.map((combo, i) => (
              <TransferCard key={i} combo={combo} />
            ))}
            {topTransfers.every((t) => t.netGain < 3) && (
              <div className="mt-2 bg-cream rounded-xl px-4 py-3">
                <p className="text-sm text-charcoal/70">
                  💡 <strong>Consider rolling.</strong> Gains are marginal — banking your free transfer
                  could unlock a bigger move next week.
                </p>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Section 2 — Fixture Difficulty Grid */}
      <Section title="📅 Fixture Difficulty Grid">
        <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
          {[
            { label: 'Easy (1–2)', color: '#166534' },
            { label: 'OK (3)', color: '#16a34a' },
            { label: 'Tough (4)', color: '#d97706' },
            { label: 'Very Tough (5)', color: '#dc2626' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
              <span className="text-charcoal/50">{item.label}</span>
            </div>
          ))}
          <span className="text-charcoal/30 ml-auto">Players with 3+ tough fixtures flagged for transfer</span>
        </div>
        <FixtureGrid
          squad={squad}
          playerMap={playerMap}
          teamMap={teamMap}
          fixtureMap={fixtureMap}
          currentGw={currentGw}
        />
      </Section>
    </div>
  )
}
