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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const fplHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)',
      'Accept': 'application/json',
    }
    const [bootstrapRes, fixturesRes] = await Promise.all([
      fetch('https://fantasy.premierleague.com/api/bootstrap-static/', { headers: fplHeaders }),
      fetch('https://fantasy.premierleague.com/api/fixtures/', { headers: fplHeaders }),
    ])

    if (!bootstrapRes.ok) throw new Error(`Bootstrap fetch failed: ${bootstrapRes.status}`)
    if (!fixturesRes.ok) throw new Error(`Fixtures fetch failed: ${fixturesRes.status}`)

    const [bootstrap, fixturesRaw] = await Promise.all([
      bootstrapRes.json(),
      fixturesRes.json(),
    ])

    // Upsert teams
    const teams = bootstrap.teams.map((t: any) => ({
      id: t.id,
      name: t.name,
      short_name: t.short_name,
    }))
    const { error: teamsErr } = await supabase.from('teams').upsert(teams)
    if (teamsErr) throw new Error(`Teams upsert: ${teamsErr.message}`)

    // Upsert players
    const players = bootstrap.elements.map((el: any) => ({
      id: el.id,
      web_name: el.web_name,
      full_name: `${el.first_name} ${el.second_name}`,
      team_id: el.team,
      position: el.element_type,
      price: el.now_cost / 10,
      total_points: el.total_points,
      form: parseFloat(el.form) || 0,
      ict_index: parseFloat(el.ict_index) || 0,
      selected_by_percent: parseFloat(el.selected_by_percent) || 0,
      minutes: el.minutes,
      goals_scored: el.goals_scored,
      assists: el.assists,
      clean_sheets: el.clean_sheets,
      updated_at: new Date().toISOString(),
    }))
    const { error: playersErr } = await supabase.from('players').upsert(players)
    if (playersErr) throw new Error(`Players upsert: ${playersErr.message}`)

    // Upsert gameweeks
    const gameweeks = bootstrap.events.map((ev: any) => ({
      id: ev.id,
      name: ev.name,
      deadline_time: ev.deadline_time,
      is_current: ev.is_current,
      is_next: ev.is_next,
      finished: ev.finished,
    }))
    const { error: gwErr } = await supabase.from('gameweeks').upsert(gameweeks)
    if (gwErr) throw new Error(`Gameweeks upsert: ${gwErr.message}`)

    // Upsert fixtures
    const fixtures = fixturesRaw.map((f: any) => ({
      id: f.id,
      gameweek: f.event,
      home_team_id: f.team_h,
      away_team_id: f.team_a,
      fdr_home: f.team_h_difficulty,
      fdr_away: f.team_a_difficulty,
      kickoff_time: f.kickoff_time,
      finished: f.finished,
    }))
    const { error: fixErr } = await supabase.from('fixtures').upsert(fixtures)
    if (fixErr) throw new Error(`Fixtures upsert: ${fixErr.message}`)

    return new Response(
      JSON.stringify({
        success: true,
        counts: {
          teams: teams.length,
          players: players.length,
          gameweeks: gameweeks.length,
          fixtures: fixtures.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('refresh-fpl-data error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
