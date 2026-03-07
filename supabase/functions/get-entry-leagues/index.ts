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
    const { teamId } = await req.json()
    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'teamId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Fetching leagues for team ${teamId}`)
    const res = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)',
        'Accept': 'application/json',
      },
    })
    
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`FPL API responded with ${res.status}: ${text}`)
    }

    const data = await res.json()
    
    if (!data) {
      throw new Error('FPL API returned empty response')
    }

    const leagues: any[] = data.leagues?.classic || []
    console.log(`Successfully fetched ${leagues.length} leagues for team ${teamId}`)

    return new Response(
      JSON.stringify({ leagues }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('get-entry-leagues error:', err)
    return new Response(
      JSON.stringify({ error: String(err), leagues: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
