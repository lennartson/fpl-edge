import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`

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

export async function refreshFplData() {
  const res = await fetch(`${FUNCTIONS_URL}/refresh-fpl-data`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`refresh-fpl-data failed: ${res.status}`)
  return res.json()
}

export async function optimizeTransfers({ teamId, picks, budget, freeTransfers }) {
  const res = await fetch(`${FUNCTIONS_URL}/transfer-optimizer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ teamId, picks, budget, freeTransfers }),
  })
  if (!res.ok) throw new Error(`transfer-optimizer failed: ${res.status}`)
  return res.json()
}
