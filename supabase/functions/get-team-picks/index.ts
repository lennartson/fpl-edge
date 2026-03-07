const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { teamId, gameweek } = await req.json()
    if (!teamId || !gameweek) {
      return new Response(
        JSON.stringify({ error: 'teamId and gameweek are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const res = await fetch(
      `https://fantasy.premierleague.com/api/entry/${teamId}/event/${gameweek}/picks/`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)',
          'Accept': 'application/json',
        },
      }
    )
    if (!res.ok) throw new Error(`FPL API responded with ${res.status}`)

    const data = await res.json()
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('get-team-picks error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
