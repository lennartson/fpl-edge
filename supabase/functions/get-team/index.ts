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
    const { teamId } = await req.json()
    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'teamId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()

    // Check team_cache — team data changes infrequently, 1-hour TTL is fine
    const { data: cached } = await supabase
      .from('team_cache')
      .select('data, expires_at')
      .eq('team_id', teamId)
      .single()

    if (cached?.expires_at && new Date(cached.expires_at) > now) {
      console.log(`Cache hit for team ${teamId}, expires ${cached.expires_at}`)
      return new Response(
        JSON.stringify(cached.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Cache miss for team ${teamId}, fetching from FPL API`)

    const res = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`FPL API responded with ${res.status}`)

    const data = await res.json()

    // Cache for 1 hour
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    const { error: cacheErr } = await supabase.from('team_cache').upsert({
      team_id: teamId,
      data,
      cached_at: now.toISOString(),
      expires_at: expiresAt,
    })
    if (cacheErr) console.warn(`team_cache upsert failed: ${cacheErr.message}`)

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('get-team error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
