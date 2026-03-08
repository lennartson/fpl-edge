import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  console.log('[get-team-picks] deployed at 2026-03-08T00:00:00Z')
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check team_picks_cache for a fresh hit (composite PK: team_id + gameweek)
    const now = new Date()
    const { data: cached } = await supabase
      .from('team_picks_cache')
      .select('picks, expires_at')
      .eq('team_id', teamId)
      .eq('gameweek', gameweek)
      .single()

    if (cached?.expires_at && new Date(cached.expires_at) > now) {
      console.log(`Cache hit for team ${teamId} GW${gameweek}, expires ${cached.expires_at}`)
      return new Response(
        JSON.stringify(cached.picks),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Cache miss for team ${teamId} GW${gameweek}, fetching from FPL API`)

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
    console.log('Sample pick fields:', JSON.stringify(data.picks?.[0]))

    // Determine expires_at: next gameweek deadline or 24h from now as fallback
    let expiresAt: string
    const { data: nextGw } = await supabase
      .from('gameweeks')
      .select('deadline_time')
      .eq('is_next', true)
      .single()

    if (nextGw?.deadline_time) {
      expiresAt = nextGw.deadline_time
    } else {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    }

    // Store in cache (upsert by team_id primary key)
    const { error: cacheErr } = await supabase.from('team_picks_cache').upsert({
      team_id: teamId,
      gameweek,
      picks: data,
      cached_at: now.toISOString(),
      expires_at: expiresAt,
    })
    if (cacheErr) console.warn(`team_picks_cache upsert failed: ${cacheErr.message}`)

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
