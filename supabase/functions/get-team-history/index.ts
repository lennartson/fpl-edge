import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  console.log('[get-team-history] deployed at 2026-03-08T00:00:00Z')
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

    const cacheKey = `team_history:${teamId}`
    const now = new Date()

    const { data: cached } = await supabase
      .from('misc_cache')
      .select('data, expires_at')
      .eq('key', cacheKey)
      .single()

    if (cached?.expires_at && new Date(cached.expires_at) > now) {
      console.log(`Cache hit for ${cacheKey}`)
      return new Response(
        JSON.stringify(cached.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Cache miss for ${cacheKey}, fetching from FPL API`)

    const res = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/history/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`FPL API responded with ${res.status}`)

    const data = await res.json()

    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    const { error: cacheErr } = await supabase.from('misc_cache').upsert({
      key: cacheKey,
      data,
      cached_at: now.toISOString(),
      expires_at: expiresAt,
    })
    if (cacheErr) console.warn(`misc_cache upsert failed: ${cacheErr.message}`)

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('get-team-history error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
