import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getCurrentGameweek,
  getTeamHistory,
  getTeamPicks,
  getTeamTransfers,
  getPlayers,
  getTeams,
  getUpcomingFixtures,
} from '../utils/fplApi'

const POSITION_LABELS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

// FPL allows 2 wildcards per season, 1 of everything else
const CHIP_META = {
  wildcard: {
    label: 'Wildcard',
    icon: '🃏',
    maxUses: 2,
    description:
      'Make unlimited free transfers for one gameweek — your squad stays the same afterwards.',
  },
  bboost: {
    label: 'Bench Boost',
    icon: '📦',
    maxUses: 1,
    description:
      'Points scored by your four bench players count towards your total for one gameweek.',
  },
  freehit: {
    label: 'Free Hit',
    icon: '⚡',
    maxUses: 1,
    description:
      'Make unlimited transfers for one GW. Your squad reverts to its previous state next week.',
  },
  '3xc': {
    label: 'Triple Captain',
    icon: '👑',
    maxUses: 1,
    description: 'Your captain earns 3× points instead of 2× for one gameweek.',
  },
}

// ── Shared ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-cream">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-cream-darker border-t-forest rounded-full animate-spin" />
        <p className="text-charcoal/50 text-sm">Loading Strategy…</p>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-cream-darker rounded-2xl shadow-sm p-6 mb-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-charcoal">{title}</h2>
        {subtitle && <p className="text-xs text-charcoal/40 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ── Section 1: Chip Advisor ────────────────────────────────────────────────────

/**
 * For each of the next 6 GWs, count how many squad starters / bench players
 * have a DGW (2 fixtures) or a blank (0 fixtures).
 */
function buildGwAnalysis(picks, playerMap, fixtures, currentGw) {
  const teamGwCount = {}
  fixtures.forEach((f) => {
    ;[f.home_team_id, f.away_team_id].forEach((tid) => {
      if (!teamGwCount[tid]) teamGwCount[tid] = {}
      teamGwCount[tid][f.gameweek] = (teamGwCount[tid][f.gameweek] || 0) + 1
    })
  })

  const starters = (picks || []).filter((p) => p.position <= 11).map((p) => p.element)
  const bench = (picks || []).filter((p) => p.position > 11).map((p) => p.element)

  const analysis = {}
  for (let g = currentGw + 1; g <= currentGw + 6; g++) {
    let starterDgws = 0
    let starterBlanks = 0
    let benchDgws = 0

    starters.forEach((id) => {
      const player = playerMap[id]
      if (!player) return
      const count = teamGwCount[player.team_id]?.[g] || 0
      if (count >= 2) starterDgws++
      if (count === 0) starterBlanks++
    })

    bench.forEach((id) => {
      const player = playerMap[id]
      if (!player) return
      if ((teamGwCount[player.team_id]?.[g] || 0) >= 2) benchDgws++
    })

    analysis[g] = { starterDgws, starterBlanks, benchDgws }
  }
  return analysis
}

function getChipRecommendation(chipKey, gwAnalysis) {
  const entries = Object.entries(gwAnalysis).map(([gw, d]) => ({ gw: Number(gw), ...d }))

  switch (chipKey) {
    case 'wildcard':
      return {
        timing: 'When squad needs a major rebuild',
        trigger:
          'Play when 5+ of your squad need replacing simultaneously, or to capture multiple price rises before a deadline.',
      }
    case 'bboost': {
      const best = [...entries].sort((a, b) => b.benchDgws - a.benchDgws)[0]
      if (best?.benchDgws >= 2) {
        return {
          timing: `GW${best.gw}`,
          trigger: `${best.benchDgws} of your bench players have a double gameweek in GW${best.gw} — extra bench points are maximised.`,
        }
      }
      return {
        timing: 'Wait for a double gameweek',
        trigger: 'Hold until 3+ bench players have a double gameweek to maximise the extra points.',
      }
    }
    case 'freehit': {
      const worst = [...entries].sort((a, b) => b.starterBlanks - a.starterBlanks)[0]
      if (worst?.starterBlanks >= 4) {
        return {
          timing: `GW${worst.gw}`,
          trigger: `${worst.starterBlanks} of your starters have no fixture in GW${worst.gw} — Free Hit lets you field a full team.`,
        }
      }
      return {
        timing: 'Save for a blank gameweek',
        trigger:
          'Hold until 5+ of your starters have no fixture — Free Hit lets you temporarily replace all blanking players.',
      }
    }
    case '3xc': {
      const best = [...entries].sort((a, b) => b.starterDgws - a.starterDgws)[0]
      if (best?.starterDgws >= 3) {
        return {
          timing: `GW${best.gw}`,
          trigger: `${best.starterDgws} starters have a double gameweek in GW${best.gw} — your captain is likely to play twice.`,
        }
      }
      return {
        timing: 'Wait for a strong DGW',
        trigger:
          'Best when your top captain candidate has a double gameweek or a home FDR 1 fixture.',
      }
    }
    default:
      return { timing: null, trigger: null }
  }
}

function ChipCard({ chipKey, meta, usedInstances, gwAnalysis }) {
  const usedCount = usedInstances.length
  const available = usedCount < meta.maxUses
  const remaining = meta.maxUses - usedCount
  const rec = available ? getChipRecommendation(chipKey, gwAnalysis) : null

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-3 ${
        available ? 'border-forest/25 bg-white' : 'border-cream-darker bg-cream/50'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <p className="font-bold text-charcoal leading-tight">{meta.label}</p>
            {meta.maxUses > 1 && (
              <p className="text-xs text-charcoal/40">
                {remaining} of {meta.maxUses} remaining
              </p>
            )}
          </div>
        </div>
        {available ? (
          <span className="shrink-0 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
            ● Available
          </span>
        ) : (
          <span className="shrink-0 text-xs font-semibold text-charcoal/40 bg-cream-darker px-2.5 py-1 rounded-full">
            ✓ Used
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-charcoal/60 leading-snug">{meta.description}</p>

      {/* Usage history badges */}
      {usedInstances.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {usedInstances.map((u, i) => (
            <span
              key={i}
              className="text-xs text-charcoal/50 bg-cream-darker px-2 py-0.5 rounded-full"
            >
              Played GW{u.event}
            </span>
          ))}
        </div>
      )}

      {/* Timing recommendation */}
      {rec && (
        <div className="border-t border-cream-darker pt-3 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-charcoal/40 uppercase tracking-wide">
              Recommended timing
            </span>
            <span className="text-xs font-bold text-forest bg-forest/10 px-2 py-0.5 rounded-full">
              {rec.timing}
            </span>
          </div>
          <p className="text-xs text-charcoal/60 leading-snug">{rec.trigger}</p>
        </div>
      )}
    </div>
  )
}

// ── Section 2: Price Change Tracker ──────────────────────────────────────────

function PricePlayerRow({ player, teamMap, direction }) {
  const up = direction === 'rising'
  return (
    <div className="flex items-center justify-between py-2 border-b border-cream-darker last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold leading-none ${up ? 'text-green-700' : 'text-coral'}`}>
            {up ? '↑' : '↓'}
          </span>
          <p className="font-semibold text-charcoal text-sm truncate">{player.web_name}</p>
        </div>
        <p className="text-xs text-charcoal/40">
          {teamMap[player.team_id] || '?'} · {POSITION_LABELS[player.position]}
        </p>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className="text-sm font-bold text-forest">£{parseFloat(player.price).toFixed(1)}m</p>
        <div className="flex gap-2 justify-end text-xs text-charcoal/50">
          <span>
            Form:{' '}
            <strong className={up ? 'text-green-700' : 'text-coral'}>
              {parseFloat(player.form).toFixed(1)}
            </strong>
          </span>
          <span>{parseFloat(player.selected_by_percent).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Section 3: Squad Value Tracker ───────────────────────────────────────────

function SquadValueRow({ pick, player, teamName }) {
  if (!player) return null
  const purchased = (pick.purchase_price ?? 0) / 10
  const selling = (pick.selling_price ?? 0) / 10
  const current = parseFloat(player.price)
  const gain = selling - purchased

  return (
    <tr className="border-b border-cream-darker last:border-0 hover:bg-cream/40 transition-colors">
      <td className="py-2 pr-3">
        <p className="font-semibold text-charcoal text-sm leading-tight truncate max-w-[8rem]">
          {player.web_name}
        </p>
        <p className="text-xs text-charcoal/40">
          {teamName} · {POSITION_LABELS[player.position]}
        </p>
      </td>
      <td className="py-2 px-2 text-sm text-center text-charcoal/60">
        £{purchased.toFixed(1)}m
      </td>
      <td className="py-2 px-2 text-sm text-center font-medium text-charcoal">
        £{current.toFixed(1)}m
      </td>
      <td className="py-2 px-2 text-sm text-center text-charcoal/60">
        £{selling.toFixed(1)}m
      </td>
      <td className="py-2 pl-2 text-sm text-right font-bold whitespace-nowrap">
        {gain > 0.04 ? (
          <span className="text-green-700">+£{gain.toFixed(1)}m ↑</span>
        ) : gain < -0.04 ? (
          <span className="text-coral">£{gain.toFixed(1)}m ↓</span>
        ) : (
          <span className="text-charcoal/30">no change</span>
        )}
      </td>
    </tr>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Strategy() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [currentGw, setCurrentGw] = useState(null)
  const [playerMap, setPlayerMap] = useState({})
  const [teamMap, setTeamMap] = useState({})
  const [usedChips, setUsedChips] = useState([]) // [{ name, event }]
  const [gwAnalysis, setGwAnalysis] = useState({})
  const [risingPlayers, setRisingPlayers] = useState([])
  const [fallingPlayers, setFallingPlayers] = useState([])
  const [squadPicks, setSquadPicks] = useState([])
  const [squadValue, setSquadValue] = useState({ current: 0, purchased: 0 })

  useEffect(() => {
    const teamId = localStorage.getItem('fpl_team_id')
    if (!teamId) {
      navigate('/setup')
      return
    }

    async function fetchAll() {
      try {
        // Step 1 — parallel base data
        const [gwData, history, players, teams, fixtures] = await Promise.all([
          getCurrentGameweek(),
          getTeamHistory(Number(teamId)),
          getPlayers({ limit: 700 }),
          getTeams(),
          getUpcomingFixtures(),
        ])

        const gw = gwData.id
        setCurrentGw(gw)
        setUsedChips(history.chips || [])

        const pMap = {}
        players.forEach((p) => { pMap[p.id] = p })
        setPlayerMap(pMap)

        const tMap = {}
        teams.forEach((t) => { tMap[t.id] = t.short_name })
        setTeamMap(tMap)

        // Step 2 — picks + transfers (needs current GW)
        const [picksData, transfersData] = await Promise.all([
          getTeamPicks(Number(teamId), gw),
          getTeamTransfers(Number(teamId)),
        ])
        const picks = picksData.picks || []

        // Build purchase price map from transfers history (most recent transfer IN wins)
        const purchasePriceMap = {}
        const transfers = Array.isArray(transfersData) ? transfersData : []
        transfers
          .sort((a, b) => new Date(a.time) - new Date(b.time))
          .forEach((t) => { purchasePriceMap[t.element_in] = t.element_in_cost })

        // Enrich picks with purchase + selling prices
        // FPL API doesn't return selling_price in picks, so we use current market price
        // purchase_price comes from transfers history or current price as fallback
        // selling_price is current market price (what they'd sell for now)
        const enrichedPicks = picks.map((p) => ({
          ...p,
          purchase_price: purchasePriceMap[p.element] ?? (parseFloat(pMap[p.element]?.price ?? 0) * 10),
          selling_price: parseFloat(pMap[p.element]?.price ?? 0) * 10,
        }))

        // Chip fixture analysis
        setGwAnalysis(buildGwAnalysis(enrichedPicks, pMap, fixtures, gw))

        // Enrich picks with player data
        const enriched = enrichedPicks.slice(0, 15).map((p) => ({ ...p, player: pMap[p.element] }))
        setSquadPicks(enriched)

        // Squad value summary
        const purchased = enrichedPicks
          .slice(0, 15)
          .reduce((sum, p) => sum + (p.purchase_price ?? 0) / 10, 0)
        const current = enrichedPicks
          .slice(0, 15)
          .reduce((sum, p) => sum + parseFloat(pMap[p.element]?.price ?? 0), 0)
        setSquadValue({ current, purchased })

        // Price tracker: filter out zero-minute players for relevance
        const active = players.filter((p) => p.minutes > 0)

        setRisingPlayers(
          active
            .filter((p) => parseFloat(p.form) > 6 && parseFloat(p.selected_by_percent) > 10)
            .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
            .slice(0, 10)
        )

        setFallingPlayers(
          active
            .filter((p) => parseFloat(p.form) < 4 && parseFloat(p.selected_by_percent) < 6)
            .sort((a, b) => parseFloat(a.form) - parseFloat(b.form))
            .slice(0, 10)
        )
      } catch (err) {
        console.error('Strategy fetch error:', err)
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
          <p className="text-coral-dark font-semibold mb-1">Failed to load Strategy</p>
          <p className="text-charcoal/60 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  // Group used chip instances by name
  const chipInstances = {}
  usedChips.forEach((c) => {
    if (!chipInstances[c.name]) chipInstances[c.name] = []
    chipInstances[c.name].push(c)
  })

  const netGain = squadValue.current - squadValue.purchased

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">🎯 Strategy</h1>
        <p className="text-charcoal/50 text-sm mt-0.5">
          GW{currentGw} · Chips, price movements, and squad value
        </p>
      </div>

      {/* ── Section 1: Chip Advisor ─────────────────────────────────────────── */}
      <Section
        title="🃏 Chip Advisor"
        subtitle="Timing recommendations based on your squad's upcoming fixture profile over the next 6 gameweeks"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(CHIP_META).map(([key, meta]) => (
            <ChipCard
              key={key}
              chipKey={key}
              meta={meta}
              usedInstances={chipInstances[key] || []}
              gwAnalysis={gwAnalysis}
            />
          ))}
        </div>
      </Section>

      {/* ── Section 2: Price Change Tracker ─────────────────────────────────── */}
      <Section
        title="📈 Price Change Tracker"
        subtitle="Price changes trigger when enough managers transfer a player in (rise) or out (fall) within a 24-hour window"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Rising */}
          <div>
            <h3 className="flex items-center gap-1.5 font-bold text-green-700 text-sm mb-1">
              <span>↑</span> Rising — likely price rises
            </h3>
            <p className="text-xs text-charcoal/40 mb-3">
              Ownership &gt;10% · Form &gt;6.0 — buy demand is building
            </p>
            {risingPlayers.length === 0 ? (
              <p className="text-charcoal/40 text-sm">No players match criteria right now.</p>
            ) : (
              risingPlayers.map((p) => (
                <PricePlayerRow key={p.id} player={p} teamMap={teamMap} direction="rising" />
              ))
            )}
          </div>

          {/* Falling */}
          <div>
            <h3 className="flex items-center gap-1.5 font-bold text-coral text-sm mb-1">
              <span>↓</span> Falling — likely price drops
            </h3>
            <p className="text-xs text-charcoal/40 mb-3">
              Ownership &lt;6% · Form &lt;4.0 — sell pressure is building
            </p>
            {fallingPlayers.length === 0 ? (
              <p className="text-charcoal/40 text-sm">No players match criteria right now.</p>
            ) : (
              fallingPlayers.map((p) => (
                <PricePlayerRow key={p.id} player={p} teamMap={teamMap} direction="falling" />
              ))
            )}
          </div>
        </div>
      </Section>

      {/* ── Section 3: Squad Value Tracker ──────────────────────────────────── */}
      <Section title="💰 Squad Value Tracker">
        {/* Summary strip */}
        <div className="flex flex-wrap gap-6 mb-5 p-4 rounded-xl bg-cream">
          <div>
            <p className="text-xl font-bold text-forest">£{squadValue.current.toFixed(1)}m</p>
            <p className="text-xs text-charcoal/40">Current squad value</p>
          </div>
          <div>
            <p className="text-xl font-bold text-charcoal">£{squadValue.purchased.toFixed(1)}m</p>
            <p className="text-xs text-charcoal/40">Total purchase cost</p>
          </div>
          <div>
            <p
              className={`text-xl font-bold ${
                netGain > 0.05
                  ? 'text-green-700'
                  : netGain < -0.05
                  ? 'text-coral'
                  : 'text-charcoal/40'
              }`}
            >
              {netGain > 0 ? '+' : ''}£{netGain.toFixed(1)}m
            </p>
            <p className="text-xs text-charcoal/40">Net value change</p>
          </div>
        </div>

        <p className="text-xs text-charcoal/40 mb-4">
          Sell price may be less than current market value — FPL retains 50% of any profit above
          purchase price.
        </p>

        {squadPicks.length === 0 ? (
          <p className="text-charcoal/40 text-sm">No squad data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-cream-darker">
                  <th className="text-left text-charcoal/40 font-medium pb-2 pr-3">Player</th>
                  <th className="text-center text-charcoal/40 font-medium pb-2 px-2">Bought</th>
                  <th className="text-center text-charcoal/40 font-medium pb-2 px-2">Market</th>
                  <th className="text-center text-charcoal/40 font-medium pb-2 px-2">Sell</th>
                  <th className="text-right text-charcoal/40 font-medium pb-2 pl-2">Change</th>
                </tr>
              </thead>
              <tbody>
                {squadPicks
                  .filter((p) => p.position <= 11)
                  .map((p) => (
                    <SquadValueRow
                      key={p.element}
                      pick={p}
                      player={p.player}
                      teamName={teamMap[p.player?.team_id] || '?'}
                    />
                  ))}
                <tr>
                  <td
                    colSpan={5}
                    className="py-1.5 text-xs text-charcoal/25 uppercase tracking-widest text-center"
                  >
                    — Bench —
                  </td>
                </tr>
                {squadPicks
                  .filter((p) => p.position > 11)
                  .map((p) => (
                    <SquadValueRow
                      key={p.element}
                      pick={p}
                      player={p.player}
                      teamName={teamMap[p.player?.team_id] || '?'}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
