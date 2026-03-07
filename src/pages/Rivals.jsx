import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getBootstrapStatic,
  getTeamPicks,
  getUpcomingFixtures,
  getEntryLeagues,
  getMiniLeague,
  getTopManagers,
} from '../utils/fplApi'

const POSITION_LABELS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

const CHIP_LABELS = {
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
  freehit: 'Free Hit',
  wildcard: 'Wildcard',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-8 h-8 border-4 border-cream-darker border-t-forest rounded-full animate-spin" />
    </div>
  )
}

function ErrorCard({ message }) {
  return (
    <div className="bg-coral/10 border border-coral/20 rounded-xl p-4 text-sm text-coral">
      {message}
    </div>
  )
}

function Section({ title, children, loading, error }) {
  return (
    <div className="bg-white border border-cream-darker rounded-2xl shadow-sm p-6">
      <h3 className="text-base font-bold text-charcoal mb-4">{title}</h3>
      {loading ? <Spinner /> : error ? <ErrorCard message={error} /> : children}
    </div>
  )
}

function MovementBadge({ rank, lastRank }) {
  if (!lastRank || lastRank === 0) return <span className="text-charcoal/30 text-xs">—</span>
  const diff = lastRank - rank
  if (diff > 0) return <span className="text-green-600 text-xs font-semibold">▲ {diff}</span>
  if (diff < 0) return <span className="text-coral text-xs font-semibold">▼ {Math.abs(diff)}</span>
  return <span className="text-charcoal/30 text-xs">—</span>
}

function ChipBadge({ chip }) {
  if (!chip) return null
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-forest text-cream">
      {CHIP_LABELS[chip] || chip}
    </span>
  )
}

function SquadViewer({ manager, playerMap, teamMap, userPickIds }) {
  const { picks = [], active_chip } = manager

  // Group starting XI by player position type
  const grouped = { 1: [], 2: [], 3: [], 4: [] }
  const bench = []

  picks.forEach(pick => {
    const player = playerMap[pick.element]
    if (!player) return
    if (pick.position <= 11) {
      grouped[player.position]?.push({ ...pick, player })
    } else {
      bench.push({ ...pick, player })
    }
  })

  const captain = picks.find(p => p.is_captain)
  const captainPlayer = captain ? playerMap[captain.element] : null

  const renderPlayer = (pick) => {
    const { player } = pick
    const isDiff = !userPickIds.has(pick.element)
    const isCaptain = pick.is_captain
    const isVC = pick.is_vice_captain

    return (
      <div
        key={pick.element}
        className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm ${
          isDiff ? 'bg-coral/10 border border-coral/20' : 'bg-cream/60'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-charcoal/40 w-8">{POSITION_LABELS[player.position]}</span>
          <span className={`font-medium ${isDiff ? 'text-coral' : 'text-charcoal'}`}>
            {player.web_name}
          </span>
          {isCaptain && (
            <span className="text-xs font-bold bg-forest text-cream rounded px-1">C</span>
          )}
          {isVC && (
            <span className="text-xs font-bold bg-cream-darker text-charcoal rounded px-1">V</span>
          )}
          {isDiff && (
            <span className="text-xs text-coral/70">differential</span>
          )}
        </div>
        <span className="text-xs text-charcoal/40">
          {teamMap[player.team_id]?.short_name || '—'}
        </span>
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-cream-darker pt-4 space-y-4">
      {/* Chip + Captain summary */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {captainPlayer && (
          <span className="text-charcoal/70">
            Captain: <span className="font-semibold text-charcoal">{captainPlayer.web_name}</span>
          </span>
        )}
        {active_chip && <ChipBadge chip={active_chip} />}
      </div>

      {/* Key */}
      <div className="flex items-center gap-4 text-xs text-charcoal/50">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-coral/20 border border-coral/30 inline-block" />
          Differential (they have, you don't)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-cream inline-block" />
          Shared
        </span>
      </div>

      {/* Starting XI */}
      <div>
        <p className="text-xs font-semibold text-charcoal/40 uppercase tracking-wide mb-2">Starting XI</p>
        <div className="space-y-1">
          {[1, 2, 3, 4].flatMap(pos => grouped[pos]).map(renderPlayer)}
        </div>
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-charcoal/40 uppercase tracking-wide mb-2">Bench</p>
          <div className="space-y-1">
            {bench.map(renderPlayer)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Rivals() {
  const navigate = useNavigate()
  const teamId = localStorage.getItem('fpl_team_id')

  // Base data (bootstrap → playerMap, teamMap, currentGw)
  const [currentGw, setCurrentGw] = useState(null)
  const [playerMap, setPlayerMap] = useState({})
  const [teamMap, setTeamMap] = useState({})
  const [loadingBootstrap, setLoadingBootstrap] = useState(true)
  const [bootstrapError, setBootstrapError] = useState(null)

  // User picks + fixtures (depends on currentGw)
  const [userPickIds, setUserPickIds] = useState(new Set())
  const [upcomingFixtures, setUpcomingFixtures] = useState([])
  const [loadingUserData, setLoadingUserData] = useState(true)

  // Leagues
  const [leagues, setLeagues] = useState([])
  const [selectedLeagueId, setSelectedLeagueId] = useState(null)
  const [loadingLeagues, setLoadingLeagues] = useState(true)
  const [leaguesError, setLeaguesError] = useState(null)

  // Mini-league detail
  const [leagueData, setLeagueData] = useState(null)
  const [expandedEntry, setExpandedEntry] = useState(null)
  const [loadingLeague, setLoadingLeague] = useState(false)
  const [leagueError, setLeagueError] = useState(null)

  // Top managers
  const [topPlayersData, setTopPlayersData] = useState(null)
  const [loadingTopManagers, setLoadingTopManagers] = useState(true)
  const [topManagersError, setTopManagersError] = useState(null)

  useEffect(() => {
    if (!teamId) navigate('/setup')
  }, [teamId, navigate])

  // 1. Load bootstrap data
  useEffect(() => {
    if (!teamId) return
    async function loadBootstrap() {
      try {
        const bootstrap = await getBootstrapStatic()
        const gw =
          bootstrap.events.find(e => e.is_current) ||
          bootstrap.events.find(e => e.is_next)
        setCurrentGw(gw)

        const pMap = {}
        bootstrap.elements.forEach(p => { pMap[p.id] = p })
        setPlayerMap(pMap)

        const tMap = {}
        bootstrap.teams.forEach(t => { tMap[t.id] = t })
        setTeamMap(tMap)
      } catch (err) {
        setBootstrapError(err?.message || String(err))
      } finally {
        setLoadingBootstrap(false)
      }
    }
    loadBootstrap()
  }, [teamId])

  // 2. Load user picks + fixtures after currentGw is ready
  useEffect(() => {
    if (!currentGw || !teamId) return
    async function loadUserData() {
      setLoadingUserData(true)
      try {
        const [picksData, fixturesData] = await Promise.all([
          getTeamPicks(teamId, currentGw.id).catch(() => ({ picks: [] })),
          getUpcomingFixtures().catch(() => []),
        ])
        setUserPickIds(new Set(picksData.picks.map(p => p.element)))
        setUpcomingFixtures(fixturesData || [])
      } finally {
        setLoadingUserData(false)
      }
    }
    loadUserData()
  }, [currentGw, teamId])

  // 3. Load top managers after currentGw is ready
  useEffect(() => {
    if (!currentGw) return
    async function loadTopManagers() {
      try {
        const data = await getTopManagers(currentGw.id)
        setTopPlayersData(data)
      } catch (err) {
        setTopManagersError(err?.message || String(err))
      } finally {
        setLoadingTopManagers(false)
      }
    }
    loadTopManagers()
  }, [currentGw])

  // 4. Load user's leagues (independent)
  useEffect(() => {
    if (!teamId) return
    async function loadLeagues() {
      try {
        const data = await getEntryLeagues(teamId)
        // Filter to private mini-leagues only (league_type 'x')
        const privateLeagues = (data.leagues || []).filter(l => l.league_type === 'x')
        setLeagues(privateLeagues)
        if (privateLeagues.length === 1) setSelectedLeagueId(privateLeagues[0].id)
      } catch (err) {
        setLeaguesError(err?.message || String(err))
      } finally {
        setLoadingLeagues(false)
      }
    }
    loadLeagues()
  }, [teamId])

  // 5. Load mini-league detail when a league is selected
  useEffect(() => {
    if (!selectedLeagueId || !currentGw) return
    setLeagueData(null)
    setExpandedEntry(null)
    setLeagueError(null)
    setLoadingLeague(true)
    async function loadLeague() {
      try {
        const data = await getMiniLeague(selectedLeagueId, currentGw.id)
        setLeagueData(data)
      } catch (err) {
        setLeagueError(err?.message || String(err))
      } finally {
        setLoadingLeague(false)
      }
    }
    loadLeague()
  }, [selectedLeagueId, currentGw])

  // ── Computed values ────────────────────────────────────────────────────────

  // Next 3 upcoming GW IDs for the weakness scanner
  const upcomingGwIds = useMemo(
    () => [...new Set(upcomingFixtures.map(f => f.gameweek))].sort((a, b) => a - b).slice(0, 3),
    [upcomingFixtures]
  )

  // Map teamId → fixtures with FDR
  const teamFixturesMap = useMemo(() => {
    const map = {}
    for (const f of upcomingFixtures) {
      if (!map[f.home_team_id]) map[f.home_team_id] = []
      if (!map[f.away_team_id]) map[f.away_team_id] = []
      map[f.home_team_id].push({ gameweek: f.gameweek, fdr: f.fdr_home })
      map[f.away_team_id].push({ gameweek: f.gameweek, fdr: f.fdr_away })
    }
    return map
  }, [upcomingFixtures])

  // Count how many of a rival's starting players have a tough fixture in next 3 GWs
  function countToughFixtures(picks) {
    if (!picks?.length || !upcomingGwIds?.length) return 0
    const starting = picks.filter(p => p.position <= 11)
    let count = 0
    for (const pick of starting) {
      const player = playerMap[pick.element]
      if (!player) continue
      const fixtures = teamFixturesMap[player.team_id] || []
      const hasTough = fixtures.some(f => upcomingGwIds.includes(f.gameweek) && f.fdr >= 4)
      if (hasTough) count++
    }
    return count
  }

  // Top manager comparison data
  const topManagerTopIds = useMemo(
    () => new Set((topPlayersData?.topPlayers || []).slice(0, 30).map(p => p.elementId)),
    [topPlayersData]
  )

  const goodPicks = useMemo(
    () => [...userPickIds].filter(id => topManagerTopIds.has(id)),
    [userPickIds, topManagerTopIds]
  )

  const missingPicks = useMemo(
    () => (topPlayersData?.topPlayers || []).filter(p => !userPickIds.has(p.elementId)).slice(0, 6),
    [topPlayersData, userPickIds]
  )

  const overlapPercent = useMemo(() => {
    const starters = [...userPickIds].length
    if (!starters) return 0
    return Math.round((goodPicks.length / Math.min(starters, 15)) * 100)
  }, [goodPicks, userPickIds])

  if (!teamId) return null

  const userEntryId = Number(teamId)
  const bootstrapReady = !loadingBootstrap && !bootstrapError

  return (
    <div className="p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-charcoal">Rivals</h2>
        <p className="text-charcoal/50 text-sm mt-1">
          Track and outmaneuver your mini-league competitors
        </p>
      </div>

      {/* Bootstrap error (blocks most sections) */}
      {bootstrapError && (
        <div className="bg-coral/10 border border-coral/20 rounded-xl p-4 text-sm text-coral">
          Failed to load player data: {bootstrapError}
        </div>
      )}

      {/* ── League Selector ─────────────────────────────────────────────────── */}
      {!loadingLeagues && !leaguesError && leagues.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-charcoal" htmlFor="league-select">
            League:
          </label>
          <select
            id="league-select"
            value={selectedLeagueId || ''}
            onChange={e => setSelectedLeagueId(Number(e.target.value))}
            className="border border-cream-darker rounded-xl px-4 py-2 text-sm text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-forest/30"
          >
            <option value="">Select a league…</option>
            {leagues.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {leaguesError && <ErrorCard message={`Could not load leagues: ${leaguesError}`} />}

      {!loadingLeagues && !leaguesError && leagues.length === 0 && (
        <div className="bg-cream border border-cream-darker rounded-xl p-5 text-sm text-charcoal/60">
          No private mini-leagues found. Join or create a league on the FPL website to use this feature.
        </div>
      )}

      {/* ── Section 1 + 2: Mini-League Table with inline squad expansion ───── */}
      {(selectedLeagueId || leagues.length > 0) && (
        <Section
          title={leagueData ? leagueData.league?.name || 'League Standings' : 'Mini-League Standings'}
          loading={loadingLeague || (loadingLeagues && !selectedLeagueId)}
          error={leagueError}
        >
          {leagueData && (
            <>
              {!selectedLeagueId && (
                <p className="text-sm text-charcoal/50 mb-4">Select a league above to view standings.</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cream-darker text-charcoal/50 text-xs uppercase tracking-wide">
                      <th className="text-left pb-3 w-12">Rank</th>
                      <th className="text-left pb-3">Manager</th>
                      <th className="text-left pb-3">Team</th>
                      <th className="text-right pb-3">GW Pts</th>
                      <th className="text-right pb-3">Total</th>
                      <th className="text-right pb-3 w-16">Move</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueData.standings.map(manager => {
                      const isUser = manager.entry === userEntryId
                      const isExpanded = expandedEntry === manager.entry
                      const hasNoPicks = !manager.picks?.length

                      return (
                        <tr
                          key={manager.entry}
                          className={`border-b border-cream-darker last:border-0 ${
                            isUser ? 'bg-green-50' : ''
                          }`}
                        >
                          <td colSpan={6} className="p-0">
                            <div>
                              {/* Row */}
                              <button
                                onClick={() => {
                                  if (!isUser && !hasNoPicks)
                                    setExpandedEntry(isExpanded ? null : manager.entry)
                                }}
                                className={`w-full grid grid-cols-6 items-center py-3 text-left transition-colors ${
                                  !isUser && !hasNoPicks ? 'hover:bg-cream/60 cursor-pointer' : 'cursor-default'
                                }`}
                              >
                                <span className={`pl-1 font-bold text-base ${isUser ? 'text-forest' : 'text-charcoal'}`}>
                                  {manager.rank}
                                </span>
                                <span className={`font-medium col-span-1 ${isUser ? 'text-forest font-semibold' : 'text-charcoal'}`}>
                                  {manager.player_name}
                                  {isUser && (
                                    <span className="ml-2 text-xs bg-forest text-cream rounded px-1.5 py-0.5">You</span>
                                  )}
                                </span>
                                <span className="text-charcoal/60 col-span-1 truncate pr-2">{manager.entry_name}</span>
                                <span className="text-right text-coral font-bold">{manager.event_total}</span>
                                <span className="text-right text-charcoal font-medium">{manager.total}</span>
                                <span className="text-right pr-1">
                                  <MovementBadge rank={manager.rank} lastRank={manager.last_rank} />
                                </span>
                              </button>

                              {/* Expanded squad viewer */}
                              {isExpanded && bootstrapReady && (
                                <div className="px-4 pb-4">
                                  <SquadViewer
                                    manager={manager}
                                    playerMap={playerMap}
                                    teamMap={teamMap}
                                    userPickIds={userPickIds}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-charcoal/40 mt-3">
                Click any rival row to inspect their squad. Coral = players they have that you don't.
              </p>
            </>
          )}

          {!leagueData && !loadingLeague && selectedLeagueId && (
            <p className="text-sm text-charcoal/50">No data yet.</p>
          )}

          {!selectedLeagueId && !leagueData && !loadingLeague && leagues.length > 1 && (
            <p className="text-sm text-charcoal/50">Select a league above to see standings.</p>
          )}
        </Section>
      )}

      {/* ── Bottom row: Section 3 + Section 4 side by side on desktop ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Section 3: Top Manager Comparison */}
        <Section
          title="Top Manager Comparison"
          loading={loadingTopManagers || loadingBootstrap || loadingUserData}
          error={topManagersError}
        >
          {topPlayersData && bootstrapReady && (
            <div className="space-y-5">
              {/* Overlap stat */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-forest">{overlapPercent}%</div>
                  <div className="text-xs text-charcoal/50 mt-0.5">squad overlap</div>
                </div>
                <p className="text-sm text-charcoal/70 flex-1">
                  {goodPicks.length} of your 15 players are owned by top managers
                  <span className="text-charcoal/40"> (sample: {topPlayersData.sampleSize} managers)</span>
                </p>
              </div>

              {/* Good picks */}
              {goodPicks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-charcoal/40 uppercase tracking-wide mb-2">
                    You own — top managers agree ✓
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {goodPicks.map(id => {
                      const p = playerMap[id]
                      return p ? (
                        <span
                          key={id}
                          className="text-xs bg-green-50 border border-green-200 text-green-800 rounded-lg px-2.5 py-1 font-medium"
                        >
                          {p.web_name}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {/* Missing picks */}
              {missingPicks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-charcoal/40 uppercase tracking-wide mb-2">
                    Top managers own — you don't (consider transferring in)
                  </p>
                  <div className="space-y-1.5">
                    {missingPicks.map(({ elementId, percent }) => {
                      const p = playerMap[elementId]
                      return p ? (
                        <div
                          key={elementId}
                          className="flex items-center justify-between text-sm bg-coral/5 border border-coral/20 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-charcoal/40">{POSITION_LABELS[p.position]}</span>
                            <span className="font-medium text-charcoal">{p.web_name}</span>
                            <span className="text-xs text-charcoal/40">
                              {teamMap[p.team_id]?.short_name}
                            </span>
                          </div>
                          <span className="text-coral font-semibold text-xs">{percent}%</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Section 4: Rival Weakness Scanner */}
        <Section
          title="Rival Weakness Scanner"
          loading={loadingLeague || loadingBootstrap || loadingUserData}
          error={null}
        >
          {!leagueData && !loadingLeague && (
            <p className="text-sm text-charcoal/50">
              Select a league to scan rivals' upcoming fixtures.
            </p>
          )}

          {leagueData && bootstrapReady && upcomingGwIds.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-charcoal/50 mb-1">
                Rivals with 3+ starters facing tough fixtures (FDR 4–5) in the next{' '}
                {upcomingGwIds.length} GWs:
              </p>

              {(() => {
                const rivals = leagueData.standings.filter(m => m.entry !== userEntryId)
                const flagged = rivals
                  .map(m => ({ ...m, toughCount: countToughFixtures(m.picks) }))
                  .filter(m => m.toughCount >= 3)
                  .sort((a, b) => b.toughCount - a.toughCount)

                if (flagged.length === 0) {
                  return (
                    <div className="text-sm text-charcoal/50 py-4 text-center">
                      No rivals with 3+ tough fixtures found — everyone has manageable upcoming games.
                    </div>
                  )
                }

                return flagged.map(m => (
                  <div
                    key={m.entry}
                    className="flex items-start gap-3 bg-cream/60 border border-cream-darker rounded-xl p-3"
                  >
                    <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-coral/10 border border-coral/20 flex items-center justify-center">
                      <span className="text-coral font-bold text-sm">{m.toughCount}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-charcoal">
                        {m.player_name}
                        <span className="font-normal text-charcoal/50"> · {m.entry_name}</span>
                      </p>
                      <p className="text-xs text-charcoal/60 mt-0.5">
                        {m.toughCount} starters with tough fixtures in the next{' '}
                        {upcomingGwIds.length} GWs — good week to gain on them
                      </p>
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}

          {leagueData && bootstrapReady && upcomingGwIds.length === 0 && (
            <p className="text-sm text-charcoal/50">
              Fixture data not available. Try refreshing data on the Gameweek Intel page first.
            </p>
          )}
        </Section>
      </div>
    </div>
  )
}
