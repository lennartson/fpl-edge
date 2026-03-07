import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FUNCTIONS_URL = (baseUrl: string) => `${baseUrl}/functions/v1`

interface UserPreference {
  team_id: number
  email: string
}

function generateEmailHtml(data: any): string {
  const {
    currentGw,
    footballerName,
    teamName,
    captainPicks,
    topTransfers,
    chipAlerts,
  } = data

  const captain = captainPicks?.[0]
  const viceCaptain = captainPicks?.[1]
  const topTransfer = topTransfers?.[0]

  // Deadline is typically Saturday 11:00 GMT for GW gameweek (based on FPL schedule)
  const deadlineTime = 'Saturday 11:00 GMT'

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f0eb; color: #2c2320; line-height: 1.6; }
.container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.header { background: linear-gradient(135deg, #1a4a3a 0%, #2d6b57 100%); color: #f5f0eb; padding: 32px 24px; text-align: center; }
.header h1 { margin: 0; font-size: 24px; font-weight: bold; }
.header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
.content { padding: 32px 24px; }
.section { margin-bottom: 28px; }
.section-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #8b7765; margin-bottom: 12px; }
.deadline-box { background-color: #f5f0eb; border-left: 4px solid #1a4a3a; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
.deadline-box p { margin: 0; font-size: 14px; }
.deadline-box strong { color: #1a4a3a; }

.pick-card { background-color: #f5f0eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.pick-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.pick-name { font-weight: 600; font-size: 16px; color: #2c2320; }
.pick-xps { font-size: 20px; font-weight: bold; color: #1a4a3a; }
.pick-xps-label { font-size: 12px; color: #8b7765; }
.pick-meta { font-size: 13px; color: #8b7765; }
.badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-right: 8px; margin-bottom: 8px; }
.badge-captain { background-color: #166534; color: white; }
.badge-vice { background-color: #e8603c; color: white; }
.badge-free { background-color: #dcfce7; color: #166534; }
.badge-hit { background-color: #fee2e2; color: #991b1b; }

.transfer-section { background-color: #f5f0eb; border-radius: 12px; padding: 16px; }
.transfer-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 8px 0; border-bottom: 1px solid #e8ddd8; }
.transfer-row:last-child { border-bottom: none; margin-bottom: 0; }
.transfer-label { font-size: 12px; color: #8b7765; text-transform: uppercase; }
.player-name { font-weight: 600; color: #2c2320; }
.xps-value { font-weight: bold; color: #1a4a3a; }
.net-gain { font-size: 18px; font-weight: bold; color: #1a4a3a; }

.chip-alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; }
.chip-alert strong { color: #92400e; }

.cta-button { display: inline-block; background-color: #1a4a3a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
.footer { background-color: #f5f0eb; padding: 24px; text-align: center; font-size: 12px; color: #8b7765; }
.footer a { color: #1a4a3a; text-decoration: none; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🎲 FPL Edge</h1>
    <p>GW${currentGw} Deadline Reminder</p>
  </div>

  <div class="content">
    <p style="margin-top: 0;">Hi ${footballerName},</p>

    <div class="deadline-box">
      <p><strong>⏰ Deadline: ${deadlineTime}</strong></p>
      <p>Make your final decisions before the clock runs out!</p>
    </div>

    ${captain ? `
    <div class="section">
      <div class="section-title">⭐ Captain Pick</div>
      <div class="pick-card">
        <span class="badge badge-captain">★ Captain</span>
        <div class="pick-header">
          <div>
            <div class="pick-name">${captain.name}</div>
            <div class="pick-meta">Team ${captain.team} • xPS: ${captain.xps.toFixed(1)}</div>
          </div>
          <div style="text-align: right;">
            <div class="pick-xps">${captain.xps.toFixed(1)}</div>
            <div class="pick-xps-label">xPS</div>
          </div>
        </div>
      </div>
      ${viceCaptain ? `
      <div class="pick-card" style="border-left: 3px solid #e8603c;">
        <span class="badge badge-vice">Vice Captain</span>
        <div class="pick-header">
          <div>
            <div class="pick-name">${viceCaptain.name}</div>
            <div class="pick-meta">Team ${viceCaptain.team} • xPS: ${viceCaptain.xps.toFixed(1)}</div>
          </div>
          <div style="text-align: right;">
            <div class="pick-xps" style="color: #e8603c;">${viceCaptain.xps.toFixed(1)}</div>
            <div class="pick-xps-label">xPS</div>
          </div>
        </div>
      </div>
      ` : ''}
    </div>
    ` : ''}

    ${topTransfer && topTransfer.transfers > 0 && topTransfer.netGain > 1.5 ? `
    <div class="section">
      <div class="section-title">💱 Top Transfer Option</div>
      <div class="transfer-section">
        <div style="margin-bottom: 12px;">
          ${topTransfer.transferCost === 0 ? '<span class="badge badge-free">Free Transfer</span>' : `<span class="badge badge-hit">−${topTransfer.transferCost} Hit</span>`}
          <span class="badge" style="background-color: #e8ddd8; color: #5a4d47;">${topTransfer.transfers} transfer${topTransfer.transfers > 1 ? 's' : ''}</span>
        </div>
        
        <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e8ddd8;">
          <div style="font-size: 12px; color: #8b7765; text-transform: uppercase; margin-bottom: 8px;">Out</div>
          ${topTransfer.out.map((p: any) => `
          <div class="transfer-row" style="border: none; margin-bottom: 8px; padding: 0;">
            <div>
              <div class="player-name">${p.name}</div>
              <div style="font-size: 12px; color: #8b7765;">${p.reason || 'Value move'}</div>
            </div>
            <div class="xps-value" style="color: #e8603c;">${p.xps} xPS</div>
          </div>
          `).join('')}
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: #8b7765; text-transform: uppercase; margin-bottom: 8px;">In</div>
          ${topTransfer.in.map((p: any) => `
          <div class="transfer-row" style="border: none; margin-bottom: 8px; padding: 0;">
            <div class="player-name">${p.name}</div>
            <div class="xps-value">${p.xps} xPS</div>
          </div>
          `).join('')}
        </div>

        <div style="background-color: white; padding: 12px; border-radius: 8px;">
          <div style="font-size: 12px; color: #8b7765; margin-bottom: 4px;">Net xPS Gain</div>
          <div class="net-gain">+${topTransfer.netGain}</div>
        </div>
      </div>
    </div>
    ` : ''}

    ${chipAlerts && chipAlerts.length > 0 ? `
    <div class="section">
      <div class="section-title">💡 Chip Alerts</div>
      ${chipAlerts.map((alert: string) => `<div class="chip-alert">${alert}</div>`).join('')}
    </div>
    ` : ''}

    <div style="text-align: center; margin-top: 24px;">
      <a href="https://fpl-edge-phi.vercel.app" class="cta-button">Open FPL Edge</a>
    </div>
  </div>

  <div class="footer">
    <p style="margin: 0; margin-bottom: 8px;">FPL Edge — Fantasy Intelligence Platform</p>
    <p style="margin: 0;">
      <a href="https://fpl-edge-phi.vercel.app">Visit App</a> •
      <a href="https://github.com/lennartson/fpl-edge">GitHub</a>
    </p>
  </div>
</div>
</body>
</html>
  `.trim()
}

async function sendReminderEmail(
  teamId: number,
  email: string,
  supabase: any,
  resendKey: string,
  baseUrl: string
): Promise<void> {
  try {
    console.log(`Sending reminder to ${email} for team ${teamId}`)

    // Fetch gameweek data
    const { data: gwData, error: gwErr } = await supabase
      .from('gameweeks')
      .select('id')
      .eq('is_current', true)
      .single()

    if (gwErr) throw new Error(`Gameweek fetch failed: ${gwErr.message}`)
    const currentGw = gwData.id

    // Fetch user's team info from FPL API
    const teamRes = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLEdge/1.0)' },
    })
    if (!teamRes.ok) throw new Error(`FPL API team fetch failed: ${teamRes.status}`)
    const teamData = await teamRes.json()
    const footballerName = `${teamData.player_first_name} ${teamData.player_last_name}`

    // Fetch team picks via the get-team-picks function
    const picksRes = await fetch(`${FUNCTIONS_URL(baseUrl)}/get-team-picks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')!}`,
      },
      body: JSON.stringify({ teamId, gameweek: currentGw }),
    })
    if (!picksRes.ok) throw new Error(`get-team-picks failed: ${picksRes.status}`)
    const picksData = await picksRes.json()
    const picks = picksData.picks || []

    // Fetch current budget/transfers
    const budget = teamData.transfers_available ? teamData.bank / 10 : 0
    const freeTransfers = teamData.transfers_available || 1

    // Call transfer-optimizer
    const optimizerRes = await fetch(`${FUNCTIONS_URL(baseUrl)}/transfer-optimizer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')!}`,
      },
      body: JSON.stringify({ teamId, picks, budget, freeTransfers }),
    })
    if (!optimizerRes.ok) throw new Error(`transfer-optimizer failed: ${optimizerRes.status}`)
    const optimizerData = await optimizerRes.json()

    // Fetch team name
    const { data: teams, error: teamsErr } = await supabase.from('teams').select('*').limit(1)
    if (!teamsErr && teams && teams.length > 0) {
      const teamNameData = teams[0].name || 'Your Team'
    }

    // Generate email HTML
    const emailHtml = generateEmailHtml({
      currentGw,
      footballerName,
      teamName: 'Your Team',
      captainPicks: optimizerData.captainPicks || [],
      topTransfers: optimizerData.topTransfers || [],
      chipAlerts: optimizerData.chipAlerts || [],
    })

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FPL Edge <onboarding@resend.dev>',
        to: email,
        subject: `FPL Edge — GW${currentGw} Deadline Reminder`,
        html: emailHtml,
      }),
    })

    if (!resendRes.ok) {
      const errText = await resendRes.text()
      throw new Error(`Resend API failed: ${resendRes.status} ${errText}`)
    }

    console.log(`Successfully sent reminder to ${email}`)
  } catch (err) {
    console.error(`Error sending reminder to ${email}:`, err)
    throw err
  }
}

async function checkDeadlineWindow(supabase: any): Promise<{ shouldSend: boolean; reason: string } | null> {
  try {
    // Fetch next gameweek
    const { data: nextGw, error: gwErr } = await supabase
      .from('gameweeks')
      .select('id, deadline_time')
      .eq('is_next', true)
      .single()

    if (gwErr || !nextGw) {
      console.log('No next gameweek found or error:', gwErr?.message)
      return { shouldSend: false, reason: 'No next gameweek found' }
    }

    if (!nextGw.deadline_time) {
      console.log('Next gameweek has no deadline_time set')
      return { shouldSend: false, reason: 'Deadline time not set' }
    }

    const deadlineDate = new Date(nextGw.deadline_time)
    const now = new Date()
    const hoursUntilDeadline = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    console.log(`Current time: ${now.toISOString()}`)
    console.log(`Deadline: ${deadlineDate.toISOString()}`)
    console.log(`Hours until deadline: ${hoursUntilDeadline.toFixed(1)}`)

    // Send if within 24-26 hours before deadline (2-hour window to avoid double-sends)
    if (hoursUntilDeadline >= 24 && hoursUntilDeadline < 26) {
      return { shouldSend: true, reason: `Within 24-26h window (${hoursUntilDeadline.toFixed(1)}h remaining)` }
    }

    return {
      shouldSend: false,
      reason: `Outside 24-26h window (${hoursUntilDeadline.toFixed(1)}h remaining)`,
    }
  } catch (err) {
    console.error('Error checking deadline window:', err)
    throw err
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { teamId, email } = body

    if (teamId && email) {
      // Single targeted send (for manual testing, skip deadline check)
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      )
      const resendKey = Deno.env.get('RESEND_API_KEY') || ''
      const baseUrl = Deno.env.get('SUPABASE_URL') || ''
      await sendReminderEmail(teamId, email, supabase, resendKey, baseUrl)
      return new Response(
        JSON.stringify({ success: true, message: 'Reminder sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Batch send to all users — check deadline window first
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )
    const resendKey = Deno.env.get('RESEND_API_KEY') || ''
    const baseUrl = Deno.env.get('SUPABASE_URL') || ''
    const deadlineCheck = await checkDeadlineWindow(supabase)
    if (!deadlineCheck?.shouldSend) {
      return new Response(
        JSON.stringify({ skipped: true, reason: deadlineCheck?.reason || 'Outside deadline window' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Deadline check passed, proceeding with batch send')

    const { data: users, error: err } = await supabase
      .from('user_preferences')
      .select('team_id, email')

    if (err) throw new Error(`Failed to fetch user preferences: ${err.message}`)
    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No users to send reminders to' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = { sent: 0, failed: 0, errors: [] as string[], deadline: deadlineCheck.reason }

    for (const user of users as UserPreference[]) {
      try {
        await sendReminderEmail(user.team_id, user.email, supabase, resendKey, baseUrl)
        results.sent++
      } catch (err) {
        results.failed++
        results.errors.push(`${user.email}: ${String(err)}`)
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-deadline-reminder error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
