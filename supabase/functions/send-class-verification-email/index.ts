// Lecture Lounge — sends the utoronto email verification link.
//
// The token must never be visible to the calling browser: if it were
// returned in the HTTP response, an already-authenticated client could
// self-verify without ever receiving mail at the claimed address. So this
// function generates the token, writes it (service-role, bypasses RLS),
// and emails it — the response back to the client carries no secret.
//
// POST body: { class_id: string, email: string }

import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { renderClassVerifyEmail } from '../_shared/classVerifyEmail.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UTORONTO_DOMAINS = ['utoronto.ca', 'mail.utoronto.ca']
const EXPIRES_HOURS = 24

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function isUtorontoEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  const domain = email.slice(at + 1).toLowerCase()
  return UTORONTO_DOMAINS.includes(domain)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await callerClient.auth.getUser()
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  const { class_id, email } = body
  if (!class_id || !email) return json({ error: 'class_id and email are required' }, 400)

  if (!isUtorontoEmail(email)) {
    return json({ error: 'Please use a utoronto.ca or mail.utoronto.ca email address.' }, 400)
  }

  const db = createClient(supabaseUrl, serviceKey)

  // Confirm caller actually belongs to this class before writing anything —
  // the service-role client below bypasses RLS, so this check is load-bearing.
  const { data: member } = await db
    .from('class_members')
    .select('id, utoronto_verified_at')
    .eq('class_id', class_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return json({ error: 'Not a member of this class' }, 403)
  if (member.utoronto_verified_at) return json({ error: 'Already verified' }, 400)

  const { data: cls } = await db.from('classes').select('name').eq('id', class_id).single()
  if (!cls) return json({ error: 'Class not found' }, 404)

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + EXPIRES_HOURS * 60 * 60 * 1000).toISOString()

  const { error: updateErr } = await db
    .from('class_members')
    .update({ utoronto_email: email, email_verify_token: token, email_verify_expires_at: expiresAt })
    .eq('id', member.id)

  if (updateErr) return json({ error: updateErr.message }, 500)

  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://radlab.vercel.app'
  const verifyUrl = `${siteUrl}/class/verify?token=${token}`

  const { subject, html, text } = renderClassVerifyEmail({
    class_name: cls.name,
    verify_url: verifyUrl,
    expires_hours: EXPIRES_HOURS,
  })

  const resend    = new Resend(Deno.env.get('RESEND_API_KEY'))
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'research@radlab.vercel.app'

  const { error: sendErr } = await resend.emails.send({ from: fromEmail, to: email, subject, html, text })

  if (sendErr) {
    console.error('Resend error:', sendErr)
    return json({ error: 'Failed to send verification email' }, 500)
  }

  return json({ ok: true })
})
