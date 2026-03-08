import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { gameweek } = await req.json()
    if (!gameweek) {
      return new Response(
        JSON.stringify({ error: 'gameweek is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()

    // Check live_gameweek_cache first
    const { data: cached } = await supabase
      .from('live_gameweek_cache')
      .select('data, expires_at')
      .eq('gameweek', gameweek)
      .single()

    if (cached?.expires_at && new Date(cached.expires_at) > now) {
      console.log(`Live cache hit for GW${gameweek}, expires ${cached.expires_at}`)
      return new Response(
        JSON.stringify(cached.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Live cache miss for GW${gameweek}, fetching from FPL API`)

    const res = await fetch(`https://fantasy.premierleague.com/api/event/${gameweek}/live/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`FPL API responded with ${res.status}`)

    const data = await res.json()

    // Determine if any matches are currently in progress (kickoff within the last 3 hours)
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const { data: activeFixtures } = await supabase
      .from('fixtures')
      .select('id')
      .eq('gameweek', gameweek)
      .eq('finished', false)
      .gte('kickoff_time', threeHoursAgo.toISOString())
      .lte('kickoff_time', now.toISOString())

    const matchesInProgress = (activeFixtures?.length ?? 0) > 0
    const ttlMs = matchesInProgress ? 2 * 60 * 1000 : 60 * 60 * 1000 // 2 min or 1 hour
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString()

    console.log(`Matches in progress: ${matchesInProgress}, caching for ${matchesInProgress ? '2 min' : '1 hour'}`)

    const { error: cacheErr } = await supabase.from('live_gameweek_cache').upsert({
      gameweek,
      data,
      cached_at: now.toISOString(),
      expires_at: expiresAt,
    })
    if (cacheErr) console.warn(`live_gameweek_cache upsert failed: ${cacheErr.message}`)

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('get-live-gameweek error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
