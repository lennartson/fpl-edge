import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Decay weights for GW+1 through GW+8
const GW_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.25, 0.15, 0.08, 0.04]

interface Player {
  id: number
  web_name: string
  full_name: string
  team_id: number
  position: number
  price: number
  total_points: number
  form: number
  ict_index: number
  selected_by_percent: number
  minutes: number
}

interface Fixture {
  gameweek: number
  home_team_id: number
  away_team_id: number
  fdr_home: number
  fdr_away: number
}

interface Pick {
  element: number
  position: number
  multiplier: number
  is_captain: boolean
  is_vice_captain: boolean
}

function calcXps(
  player: Player,
  fixtures: Fixture[],
  currentGw: number
): number {
  let xps = 0
  // Normalise inputs to 0-10 scale
  const formNorm = Math.min(player.form / 15, 1) * 10
  const ictNorm = Math.min(player.ict_index / 300, 1) * 10
  const minutesReliability = Math.min(player.minutes / (90 * 19), 1) // half season

  for (let i = 0; i < 8; i++) {
    const gw = currentGw + 1 + i
    const weight = GW_WEIGHTS[i]
    const gwFixtures = fixtures.filter(
      f => f.gameweek === gw && (f.home_team_id === player.team_id || f.away_team_id === player.team_id)
    )
    if (gwFixtures.length === 0) continue

    for (const fix of gwFixtures) {
      const isHome = fix.home_team_id === player.team_id
      const fdr = isHome ? fix.fdr_home : fix.fdr_away
      const fdrNorm = ((6 - fdr) / 4) * 10 // normalise FDR 1-5 → 0-10
      const homeBonus = isHome ? 1 : 0

      const gwScore =
        formNorm * 0.40 +
        ictNorm * 0.25 +
        fdrNorm * 0.25 +
        homeBonus * 0.05 +
        minutesReliability * 0.05

      xps += gwScore * weight
    }
  }
  return Math.round(xps * 10) / 10
}

function calcGw1Score(player: Player, fixtures: Fixture[], currentGw: number): number {
  const formNorm = Math.min(player.form / 15, 1) * 10
  const ictNorm = Math.min(player.ict_index / 300, 1) * 10
  const minutesReliability = Math.min(player.minutes / (90 * 19), 1)

  const gwFixtures = fixtures.filter(
    f => f.gameweek === currentGw + 1 && (f.home_team_id === player.team_id || f.away_team_id === player.team_id)
  )
  if (gwFixtures.length === 0) return 0

  let score = 0
  for (const fix of gwFixtures) {
    const isHome = fix.home_team_id === player.team_id
    const fdr = isHome ? fix.fdr_home : fix.fdr_away
    const fdrNorm = ((6 - fdr) / 4) * 10
    const homeBonus = isHome ? 1 : 0
    score += formNorm * 0.40 + ictNorm * 0.25 + fdrNorm * 0.25 + homeBonus * 0.05 + minutesReliability * 0.05
  }
  return Math.round(score * 10) / 10
}

function countByTeam(pickIds: number[], players: Player[]): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const id of pickIds) {
    const p = players.find((pl) => pl.id === id)
    if (!p) continue
    counts[p.team_id] = (counts[p.team_id] || 0) + 1
  }
  return counts
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { teamId, picks, budget, freeTransfers } = await req.json() as {
      teamId: number
      picks: Pick[]
      budget: number
      freeTransfers: number
    }

    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      throw new Error('picks array is required')
    }

    // Fetch all players and upcoming fixtures
    const [{ data: allPlayers, error: pErr }, { data: allFixtures, error: fErr }, { data: gwData, error: gwErr }] =
      await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('fixtures').select('*').eq('finished', false).order('gameweek'),
        supabase.from('gameweeks').select('id').eq('is_current', true).single(),
      ])

    if (pErr) throw new Error(`Players fetch: ${pErr.message}`)
    if (fErr) throw new Error(`Fixtures fetch: ${fErr.message}`)
    if (gwErr) throw new Error(`Gameweek fetch: ${gwErr.message}`)

    const players = allPlayers as Player[]
    const fixtures = allFixtures as Fixture[]
    const currentGw: number = (gwData as any)?.id ?? 1

    const playerMap = new Map(players.map((p) => [p.id, p]))

    // Score each player's xPS
    const xpsMap = new Map<number, number>()
    const gw1ScoreMap = new Map<number, number>()
    for (const p of players) {
      xpsMap.set(p.id, calcXps(p, fixtures, currentGw))
      gw1ScoreMap.set(p.id, calcGw1Score(p, fixtures, currentGw))
    }

    // Current squad pick IDs (starters + bench, first 15)
    const currentPickIds = picks.map((p) => p.element)
    const currentSquadXps = currentPickIds.reduce((sum, id) => sum + (xpsMap.get(id) ?? 0), 0)

    // Rank GW+1 captain picks using GW1 score
    const starterPicks = picks.filter((p) => p.position <= 11)
    const captainOptions = starterPicks
      .map((p) => ({ id: p.element, player: playerMap.get(p.element)!, xps: gw1ScoreMap.get(p.element) ?? 0 }))
      .filter((x) => x.player)
      .sort((a, b) => b.xps - a.xps)
      .slice(0, 3)

    // Build transfer candidates: players NOT in squad, grouped by position
    const squadSet = new Set(currentPickIds)
    const candidates = players
      .filter((p) => !squadSet.has(p.id))
      .map((p) => ({ ...p, xps: xpsMap.get(p.id) ?? 0 }))
      .sort((a, b) => b.xps - a.xps)

    const transferCombinations: any[] = []

    // Helper: get transfer reason based on player stats
    function getTransferReason(outPlayer: Player, inPlayer: Player, fixtures: Fixture[]): string {
      if (outPlayer.form < 4.0) return 'Poor form'
      
      // Calculate average FDR for next 3 gameweeks
      const nextFixtures = fixtures.filter(
        f => f.gameweek <= currentGw + 3 && (f.home_team_id === outPlayer.team_id || f.away_team_id === outPlayer.team_id)
      ).slice(0, 3)
      
      let avgFdr = 0
      for (const fix of nextFixtures) {
        const isHome = fix.home_team_id === outPlayer.team_id
        avgFdr += isHome ? fix.fdr_home : fix.fdr_away
      }
      avgFdr = nextFixtures.length > 0 ? avgFdr / nextFixtures.length : 2.5
      
      if (avgFdr > 3.5) return 'Tough fixtures'
      if (outPlayer.minutes < 500) return 'Rotation risk'
      return 'Value upgrade'
    }

    // Helper: check if a swap is valid (budget, 3-per-club)
    function isValidSwap(outIds: number[], inIds: number[]): { valid: boolean; costDelta: number } {
      const newPickIds = currentPickIds.filter((id) => !outIds.includes(id)).concat(inIds)
      // 3-per-club rule
      const teamCounts = countByTeam(newPickIds, players)
      if (Object.values(teamCounts).some((c) => c > 3)) return { valid: false, costDelta: 0 }
      // Budget check
      const outValue = outIds.reduce((s, id) => s + (playerMap.get(id)?.price ?? 0), 0)
      const inCost = inIds.reduce((s, id) => s + (playerMap.get(id)?.price ?? 0), 0)
      const costDelta = inCost - outValue
      if (costDelta > budget) return { valid: false, costDelta }
      return { valid: true, costDelta }
    }

    // Evaluate 1-transfer options
    for (const pick of picks.slice(0, 15)) {
      const outPlayer = playerMap.get(pick.element)
      if (!outPlayer) continue
      const outXps = xpsMap.get(pick.element) ?? 0
      const samePosCandidates = candidates.filter((c) => c.position === outPlayer.position).slice(0, 20)

      for (const candidate of samePosCandidates) {
        const { valid, costDelta } = isValidSwap([pick.element], [candidate.id])
        if (!valid) continue
        const xpsGain = candidate.xps - outXps
        const transferCost = freeTransfers >= 1 ? 0 : 4
        const netGain = xpsGain - transferCost
        if (netGain > 0) {
          const reason = getTransferReason(outPlayer, candidate, fixtures)
          transferCombinations.push({
            transfers: 1,
            out: [{ id: pick.element, name: outPlayer.web_name, xps: Math.round(outXps * 10) / 10, reason }],
            in: [{ id: candidate.id, name: candidate.web_name, xps: candidate.xps }],
            xpsGain: Math.round(xpsGain * 10) / 10,
            transferCost,
            netGain: Math.round(netGain * 10) / 10,
            costDelta: Math.round(costDelta * 10) / 10,
          })
        }
      }
    }

    // Evaluate 2-transfer options (top candidates only to limit combinations)
    const top2Candidates = candidates.slice(0, 30)
    const pickArray = picks.slice(0, 11) // starters only for 2+ transfers

    for (let i = 0; i < pickArray.length; i++) {
      for (let j = i + 1; j < pickArray.length; j++) {
        const out1 = playerMap.get(pickArray[i].element)
        const out2 = playerMap.get(pickArray[j].element)
        if (!out1 || !out2) continue
        const out1Xps = xpsMap.get(pickArray[i].element) ?? 0
        const out2Xps = xpsMap.get(pickArray[j].element) ?? 0

        const pos1Candidates = top2Candidates.filter((c) => c.position === out1.position)
        const pos2Candidates = top2Candidates.filter((c) => c.position === out2.position)

        for (const c1 of pos1Candidates.slice(0, 8)) {
          for (const c2 of pos2Candidates.slice(0, 8)) {
            if (c1.id === c2.id) continue
            const { valid, costDelta } = isValidSwap(
              [pickArray[i].element, pickArray[j].element],
              [c1.id, c2.id]
            )
            if (!valid) continue
            const xpsGain = (c1.xps - out1Xps) + (c2.xps - out2Xps)
            const freeUsed = Math.min(freeTransfers, 2)
            const hits = 2 - freeUsed
            const transferCost = hits * 4
            if (hits > 0 && xpsGain < transferCost + 2) continue // only take hit if clearly worth it
            const netGain = xpsGain - transferCost
            if (netGain > 0) {
              const reason1 = getTransferReason(out1, c1, fixtures)
              const reason2 = getTransferReason(out2, c2, fixtures)
              transferCombinations.push({
                transfers: 2,
                out: [
                  { id: pickArray[i].element, name: out1.web_name, xps: Math.round(out1Xps * 10) / 10, reason: reason1 },
                  { id: pickArray[j].element, name: out2.web_name, xps: Math.round(out2Xps * 10) / 10, reason: reason2 },
                ],
                in: [
                  { id: c1.id, name: c1.web_name, xps: c1.xps },
                  { id: c2.id, name: c2.web_name, xps: c2.xps },
                ],
                xpsGain: Math.round(xpsGain * 10) / 10,
                transferCost,
                netGain: Math.round(netGain * 10) / 10,
                costDelta: Math.round(costDelta * 10) / 10,
              })
            }
          }
        }
      }
    }

    // Add roll transfer recommendation if warranted
    const sorted = transferCombinations.sort((a, b) => b.netGain - a.netGain)
    const bestNetGain = sorted.length > 0 ? sorted[0].netGain : 0
    
    if (bestNetGain < 3.0) {
      const rollOption = {
        transfers: 0,
        out: [],
        in: [],
        xpsGain: 1.5,
        transferCost: 0,
        netGain: 1.5,
        costDelta: 0,
        reason: 'Roll transfer — banking gives you more flexibility next gameweek'
      }
      sorted.unshift(rollOption)
    }
    
    const top3 = sorted.slice(0, 3)

    // Chip recommendations based on squad analysis
    const chipAlerts: string[] = []
    const squadXpsPerPlayer = currentSquadXps / currentPickIds.length
    const benchXps = picks
      .filter((p) => p.position > 11)
      .reduce((sum, p) => sum + (xpsMap.get(p.element) ?? 0), 0)
    const starterXps = picks
      .filter((p) => p.position <= 11)
      .reduce((sum, p) => sum + (xpsMap.get(p.element) ?? 0), 0)

    if (benchXps / 4 > (starterXps / 11) * 1.2) {
      chipAlerts.push('BENCH_BOOST: Your bench is exceptionally strong (120%+ of starter average xPS) — Bench Boost could deliver significant value.')
    }
    if (captainOptions.length > 0 && captainOptions[0].xps > squadXpsPerPlayer * 2.5) {
      chipAlerts.push('TRIPLE_CAPTAIN: Top captain pick has exceptional xPS — Triple Captain could be high value.')
    }
    if (freeTransfers >= 2 && top3.length > 0 && top3[0].netGain > 20) {
      chipAlerts.push('FREE_HIT: Large squad upgrade potential detected — Free Hit may maximise this gameweek.')
    }
    if (top3.length >= 3 && top3.reduce((s, t) => s + t.netGain, 0) > 30) {
      chipAlerts.push('WILDCARD: Multiple high-value transfer targets available — Wildcard could unlock significant gains.')
    }

    return new Response(
      JSON.stringify({
        currentGw,
        currentSquadXps: Math.round(currentSquadXps * 10) / 10,
        topTransfers: top3,
        captainPicks: captainOptions.map((c) => ({
          id: c.id,
          name: c.player.web_name,
          team: c.player.team_id,
          xps: c.xps,
        })),
        chipAlerts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('transfer-optimizer error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
