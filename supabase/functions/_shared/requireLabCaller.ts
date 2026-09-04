// Verify that the caller of an admin-facing Edge Function is a lab member.
//
// Extracted from create_participant, which carries an inline copy of this and
// should adopt this module next time it is touched (not refactored now purely
// to avoid redeploying a function that works).
//
// Two things worth preserving from the original:
//
// 1. It deliberately does NOT use SUPABASE_ANON_KEY as the apikey. That var is
//    deprecated in favour of publishable keys, and the legacy JWT pair it held
//    was revoked 2026-07-30 — when it eventually stops being injected, this
//    path would 401 in a way indistinguishable from an expired session.
//
// 2. The role is read with the service key rather than through RLS. This is a
//    gate, so the true role is what we want, not the RLS-visible one.

import { createClient } from 'npm:@supabase/supabase-js@2'

export interface LabCallerResult {
  /** Set when the caller is NOT authorised — return it directly. */
  error?: { message: string; status: number }
  /** The verified caller's auth user id, when authorised. */
  userId?: string
}

export async function requireLabCaller(req: Request): Promise<LabCallerResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { error: { message: 'Missing authorization header', status: 401 } }

  const callerAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user }, error: authErr } = await callerAuth.auth.getUser(token)
  if (authErr || !user) return { error: { message: 'Unauthorized', status: 401 } }

  const { data: profile } = await callerAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'lab') {
    return { error: { message: 'Forbidden: lab role required', status: 403 } }
  }

  return { userId: user.id }
}
