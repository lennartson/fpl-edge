const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  console.log('[get-team-transfers] deployed at 2026-03-08T00:00:00Z')
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { teamId } = await req.json()
    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'teamId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch team transfers from FPL API
    const res = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/transfers/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)' },
    })

    if (!res.ok) {
      throw new Error(`FPL API returned ${res.status}`)
    }

    const transfers = await res.json()

    return new Response(JSON.stringify(transfers), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('get-team-transfers error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
