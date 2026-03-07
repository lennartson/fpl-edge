const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FPL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)',
  'Accept': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leagueId, gameweek } = await req.json()
    if (!leagueId || !gameweek) {
      return new Response(
        JSON.stringify({ error: 'leagueId and gameweek are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch league standings (first page, up to 50 managers)
    const standingsRes = await fetch(
      `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`,
      { headers: FPL_HEADERS }
    )
    if (!standingsRes.ok) throw new Error(`FPL standings API responded with ${standingsRes.status}`)

    const standingsData = await standingsRes.json()
    const managers = (standingsData.standings?.results || []).slice(0, 20)

    // Fetch picks for all managers in parallel
    const picksResults = await Promise.allSettled(
      managers.map((manager: any) =>
        fetch(
          `https://fantasy.premierleague.com/api/entry/${manager.entry}/event/${gameweek}/picks/`,
          { headers: FPL_HEADERS }
        ).then(r => (r.ok ? r.json() : null))
      )
    )

    // Enrich each manager row with their picks and active chip
    const standings = managers.map((manager: any, i: number) => {
      const result = picksResults[i]
      const picksData = result.status === 'fulfilled' ? result.value : null
      return {
        ...manager,
        picks: picksData?.picks || [],
        active_chip: picksData?.active_chip || null,
      }
    })

    return new Response(
      JSON.stringify({ league: standingsData.league, standings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('get-mini-league error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
