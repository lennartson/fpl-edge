const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FPL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)',
  'Accept': 'application/json',
}

// Overall FPL classic league ID (fetches top-ranked managers globally)
const OVERALL_LEAGUE_ID = 314

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { gameweek } = await req.json()
    if (!gameweek) {
      return new Response(
        JSON.stringify({ error: 'gameweek is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the top managers from the overall league (page 1 = top 50 managers)
    const standingsRes = await fetch(
      `https://fantasy.premierleague.com/api/leagues-classic/${OVERALL_LEAGUE_ID}/standings/`,
      { headers: FPL_HEADERS }
    )
    if (!standingsRes.ok) throw new Error(`FPL overall league API responded with ${standingsRes.status}`)

    const standingsData = await standingsRes.json()
    const topManagers: any[] = (standingsData.standings?.results || []).slice(0, 50)

    // Fetch picks for all top managers in parallel
    const picksResults = await Promise.allSettled(
      topManagers.map((manager: any) =>
        fetch(
          `https://fantasy.premierleague.com/api/entry/${manager.entry}/event/${gameweek}/picks/`,
          { headers: FPL_HEADERS }
        ).then(r => (r.ok ? r.json() : null))
      )
    )

    // Aggregate player ownership across top managers
    const elementCounts: Record<number, number> = {}
    let successCount = 0

    for (const result of picksResults) {
      if (result.status === 'fulfilled' && result.value?.picks) {
        successCount++
        for (const pick of result.value.picks) {
          elementCounts[pick.element] = (elementCounts[pick.element] || 0) + 1
        }
      }
    }

    // Sort players by ownership count descending
    const topPlayers = Object.entries(elementCounts)
      .map(([elementId, count]) => ({
        elementId: Number(elementId),
        count,
        percent: successCount > 0 ? Math.round((count / successCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    return new Response(
      JSON.stringify({ topPlayers, sampleSize: successCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('get-top-managers error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
