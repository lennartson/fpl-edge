import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`

const authHeaders = {
  'Content-Type': 'application/json',
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
}

// ── Players ──────────────────────────────────────────────────────────────────

export async function getPlayers({ position, limit = 100 } = {}) {
  let query = supabase
    .from('players')
    .select('*')
    .order('total_points', { ascending: false })
    .limit(limit)
  if (position) query = query.eq('position', position)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getPlayerById(id) {
  const { data, error } = await supabase.from('players').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function getTeams() {
  const { data, error } = await supabase.from('teams').select('*').order('id')
  if (error) throw error
  return data
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export async function getUpcomingFixtures(gameweek) {
  let query = supabase
    .from('fixtures')
    .select('*')
    .eq('finished', false)
    .order('gameweek')
  if (gameweek) query = query.eq('gameweek', gameweek)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ── Gameweeks ─────────────────────────────────────────────────────────────────

export async function getGameweeks() {
  const { data, error } = await supabase.from('gameweeks').select('*').order('id')
  if (error) throw error
  return data
}

export async function getCurrentGameweek() {
  const { data, error } = await supabase
    .from('gameweeks')
    .select('*')
    .eq('is_current', true)
    .single()
  if (error) throw error
  return data
}

// ── User preferences ──────────────────────────────────────────────────────────

export async function saveUserPreferences(teamId, email) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ team_id: teamId, email })
  if (error) throw error
}

// ── Edge Functions ────────────────────────────────────────────────────────────

export async function getTeam(teamId) {
  // Check team_cache first — 1-hour TTL
  const { data: cached } = await supabase
    .from('team_cache')
    .select('data, expires_at')
    .eq('team_id', teamId)
    .single()

  if (cached?.expires_at && new Date(cached.expires_at) > new Date()) {
    return cached.data
  }

  // Cache miss — call edge function (which will also populate the cache)
  const res = await fetch(`${FUNCTIONS_URL}/get-team`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ teamId }),
  })
  if (!res.ok) throw new Error(`get-team failed: ${res.status}`)
  return res.json()
}

export async function getBootstrapStatic() {
  // Check cache_metadata — if bootstrap_static is still fresh, skip the edge function call
  const { data: cacheMeta } = await supabase
    .from('cache_metadata')
    .select('expires_at')
    .eq('key', 'bootstrap_static')
    .single()

  const isStale = !cacheMeta?.expires_at || new Date(cacheMeta.expires_at) <= new Date()

  if (isStale) {
    // Trigger a refresh so Supabase tables are up to date
    const refreshRes = await fetch(`${FUNCTIONS_URL}/refresh-fpl-data`, {
      method: 'POST',
      headers: authHeaders,
    })
    if (!refreshRes.ok) throw new Error(`refresh-fpl-data failed: ${refreshRes.status}`)
  }

  // Query all three tables in parallel directly from Supabase
  const [playersResult, teamsResult, gameweeksResult] = await Promise.all([
    supabase.from('players').select('*'),
    supabase.from('teams').select('*').order('id'),
    supabase.from('gameweeks').select('*').order('id'),
  ])

  if (playersResult.error) throw playersResult.error
  if (teamsResult.error) throw teamsResult.error
  if (gameweeksResult.error) throw gameweeksResult.error

  return {
    elements: playersResult.data,
    teams: teamsResult.data,
    events: gameweeksResult.data,
  }
}

export async function getTeamPicks(teamId, gameweek) {
  // Check team_picks_cache first — composite PK (team_id, gameweek)
  const { data: cached } = await supabase
    .from('team_picks_cache')
    .select('picks, expires_at')
    .eq('team_id', teamId)
    .eq('gameweek', gameweek)
    .single()

  if (cached?.expires_at && new Date(cached.expires_at) > new Date()) {
    return cached.picks
  }

  // Cache miss — call edge function (which will also populate the cache)
  const res = await fetch(`${FUNCTIONS_URL}/get-team-picks`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ teamId, gameweek }),
  })
  if (!res.ok) throw new Error(`get-team-picks failed: ${res.status}`)
  return res.json()
}

export async function getLiveGameweek(gameweek) {
  const res = await fetch(`${FUNCTIONS_URL}/get-live-gameweek`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ gameweek }),
  })
  if (!res.ok) throw new Error(`get-live-gameweek failed: ${res.status}`)
  return res.json()
}

export async function getTeamHistory(teamId) {
  const res = await fetch(`${FUNCTIONS_URL}/get-team-history`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ teamId }),
  })
  if (!res.ok) throw new Error(`get-team-history failed: ${res.status}`)
  return res.json()
}

export async function getEntryLeagues(teamId) {
  const res = await fetch(`${FUNCTIONS_URL}/get-entry-leagues`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ teamId }),
  })
  if (!res.ok) throw new Error(`get-entry-leagues failed: ${res.status}`)
  return res.json()
}

export async function getMiniLeague(leagueId, gameweek) {
  // Check mini_league_cache first (composite PK: league_id + gameweek)
  const { data: cached } = await supabase
    .from('mini_league_cache')
    .select('data, expires_at')
    .eq('league_id', leagueId)
    .eq('gameweek', gameweek)
    .single()

  if (cached?.expires_at && new Date(cached.expires_at) > new Date()) {
    return cached.data
  }

  // Cache miss — call edge function (which will also populate the cache)
  const res = await fetch(`${FUNCTIONS_URL}/get-mini-league`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ leagueId, gameweek }),
  })
  if (!res.ok) throw new Error(`get-mini-league failed: ${res.status}`)
  return res.json()
}

export async function getTopManagers(gameweek) {
  // Check top_managers_cache first
  const { data: cached } = await supabase
    .from('top_managers_cache')
    .select('data, expires_at')
    .eq('gameweek', gameweek)
    .single()

  if (cached?.expires_at && new Date(cached.expires_at) > new Date()) {
    return cached.data
  }

  // Cache miss — call edge function (which will also populate the cache)
  const res = await fetch(`${FUNCTIONS_URL}/get-top-managers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ gameweek }),
  })
  if (!res.ok) throw new Error(`get-top-managers failed: ${res.status}`)
  return res.json()
}

export async function optimizeTransfers({ teamId, picks, budget, freeTransfers }) {
  const res = await fetch(`${FUNCTIONS_URL}/transfer-optimizer`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ teamId, picks, budget, freeTransfers }),
  })
  if (!res.ok) throw new Error(`transfer-optimizer failed: ${res.status}`)
  return res.json()
}

export async function sendReminderEmail(teamId, email) {
  const res = await fetch(`${FUNCTIONS_URL}/send-deadline-reminder`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ teamId, email }),
  })
  if (!res.ok) throw new Error(`send-deadline-reminder failed: ${res.status}`)
  return res.json()
}
