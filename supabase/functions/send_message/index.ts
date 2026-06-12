// send_message — core email sending primitive.
// Called by check_schedule (cron) or directly for test sends from the admin UI.
//
// POST body: { schedule_instance_id: string, test_override_email?: string }
// When test_override_email is provided this is a test send — consent is skipped,
// recipient is the override address, subject is prefixed with [TEST].

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { renderEmail } from '../_shared/emailTemplate.ts'
import { getOrCreateUnsubscribeToken } from '../_shared/unsubscribeToken.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Require service-role Bearer (from check_schedule) or a valid lab-member JWT.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  if (authHeader !== `Bearer ${serviceKey}`) {
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await callerClient
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'lab') return json({ error: 'Forbidden' }, 403)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { schedule_instance_id, test_override_email } = body

    // 1. Validate input
    if (!schedule_instance_id) {
      return json({ error: 'schedule_instance_id is required' }, 400)
    }

    const isTest = !!test_override_email

    // Service role client — bypasses RLS; required for auth.users lookups.
    const db: SupabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // 2. Fetch the schedule row
    const { data: row, error: rowErr } = await db
      .from('participant_schedule')
      .select('id, participant_id, study_id, session_template_id, day_contact_id, scheduled_for, study_day, protocol_id, link_id, status, attempts')
      .eq('id', schedule_instance_id)
      .single()

    if (rowErr || !row) {
      return json({ error: 'Schedule row not found' }, 400)
    }

    // Fetch link expiry hours from the day contact row
    let expiresHours = 48
    if (row.day_contact_id) {
      const { data: pdc } = await db
        .from('protocol_day_contacts')
        .select('link_expires_hours')
        .eq('id', row.day_contact_id)
        .single()
      if (pdc?.link_expires_hours) expiresHours = pdc.link_expires_hours
    }

    // Fetch per-protocol custom email subject/body (nullable — null uses default template)
    let customSubject: string | null = null
    let customBody: string | null = null
    if (row.protocol_id) {
      const { data: proto } = await db
        .from('study_protocols')
        .select('email_subject, email_body')
        .eq('id', row.protocol_id)
        .single()
      customSubject = proto?.email_subject ?? null
      customBody    = proto?.email_body ?? null
    }

    // 3. Fetch participant profile and email
    const { data: profile } = await db
      .from('profiles')
      .select('id, display_name')
      .eq('id', row.participant_id)
      .single()

    const displayName = profile?.display_name ?? ''
    const firstName   = displayName.split(' ')[0] || 'Participant'

    // auth.users requires service role
    const { data: { user: authUser } } = await db.auth.admin.getUserById(row.participant_id)
    const participantEmail = authUser?.email ?? null

    // 4. Consent check (skipped for test sends)
    if (!isTest) {
      const { data: consent } = await db
        .from('participant_consent')
        .select('email_reminders')
        .eq('participant_id', row.participant_id)
        .eq('study_id', row.study_id)
        .is('withdrawn_at', null)
        .maybeSingle()

      if (consent?.email_reminders === false) {
        return json({ suppressed: true, reason: 'consent_not_given' })
      }
    }

    // 5. Resolve or create participant link
    let token: string | null = null

    if (row.link_id) {
      const { data: existingLink } = await db
        .from('participant_links')
        .select('token')
        .eq('id', row.link_id)
        .single()
      token = existingLink?.token ?? null
    }

    if (!token) {
      token = await issueLinkInternal(row, expiresHours, db)
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://radlab.vercel.app'
    const linkUrl = `${siteUrl}/s/${token}`

    // 6. Generate unsubscribe URL (omitted for test sends)
    let unsubscribeUrl: string | null = null
    if (!isTest) {
      const unsubToken = await getOrCreateUnsubscribeToken(db, row.participant_id, row.study_id)
      unsubscribeUrl = `${siteUrl}/unsubscribe/${unsubToken}`
    }

    // 7. Render email (subject + HTML + plain text)
    const { subject, html, text } = renderEmail({
      first_name:      firstName,
      study_day:       row.study_day,
      link_url:        linkUrl,
      expires_hours:   expiresHours,
      custom_subject:  customSubject,
      custom_body:     customBody,
      unsubscribe_url: unsubscribeUrl,
      is_test:         isTest,
    })

    // Warn if any template variables remain unresolved after substitution
    for (const [label, content] of [['subject', subject], ['text', text]] as const) {
      const unresolved = content.match(/\{\{[^}]+\}\}/g)
      if (unresolved) console.warn(`Unresolved template variables in ${label}:`, unresolved)
    }

    // 8. Send via Resend
    const to = isTest ? test_override_email : participantEmail
    if (!to) {
      await logMessage(db, row.participant_id, 'failed', isTest, null)
      return json({ success: false, error: 'No recipient email found for participant' })
    }

    const resend    = new Resend(Deno.env.get('RESEND_API_KEY'))
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'research@radlab.vercel.app'

    const { data: sendData, error: sendErr } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
      text,
    })

    const sendStatus = sendErr ? 'failed' : 'sent'

    // 9. Log the send attempt
    await logMessage(db, row.participant_id, sendStatus, isTest, null)

    // 10. Return result
    if (sendErr) {
      console.error('Resend error:', sendErr)
      return json({ success: false, error: sendErr.message })
    }

    return json({ success: true, message_id: sendData?.id, recipient: to })

  } catch (err) {
    console.error('send_message unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function issueLinkInternal(
  row: { id: string; participant_id: string; protocol_id: string | null },
  expiresHours: number,
  db: SupabaseClient,
): Promise<string> {
  const token     = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString()

  const { data: link, error } = await db
    .from('participant_links')
    .insert({
      token,
      schedule_instance_id: row.id,
      participant_id: row.participant_id,
      protocol_id: row.protocol_id,
      status: 'active',
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create participant link: ${error.message}`)

  await db
    .from('participant_schedule')
    .update({ link_id: link.id, status: 'link_sent' })
    .eq('id', row.id)

  return token
}

async function logMessage(
  db: SupabaseClient,
  participantId: string,
  status: string,
  isTest: boolean,
  suppressedReason: string | null,
) {
  const { error } = await db.from('message_log').insert({
    participant_id: participantId,
    sent_at: new Date().toISOString(),
    channel: 'email',
    status,
    is_test: isTest,
    suppressed_reason: suppressedReason,
  })
  if (error) console.error('Failed to write message_log:', error.message)
}
