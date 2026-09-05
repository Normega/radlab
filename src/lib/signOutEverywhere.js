import { supabase } from './supabase'

// One sign-out for both platforms (Norm, 2026-09-05). Sign-IN is linked — the
// Field Guide reconciles the main session to its identity, the Lounge door
// chains the bridge — so an unlinked sign-out left ghosts: pressing "Sign
// out" on either side stranded a live session on the other, which on a
// shared library computer is the next student reading your check-ins.
//
// Pass the academic client when the caller already holds one (Field Guide
// surfaces); otherwise the academic side is ended only if its session
// actually exists in storage — the dynamic import keeps courseClient (and
// its /api/ingest fetch) out of the path for pure main-site users.
//
// Scope note: supabase-js signOut() defaults to global (revokes that
// account's sessions on every device). That is what each side already did
// individually; this helper extends the reach across platforms, not the
// semantics.
export async function signOutEverywhere(academicClient) {
  try {
    let c = academicClient
    if (!c && localStorage.getItem('radlab-academic-auth')) {
      const { getCourseClient } = await import('../academic/courseClient')
      c = await getCourseClient()
    }
    if (c) await c.auth.signOut()
  } catch { /* the academic half failing must never block the main sign-out */ }
  try { await supabase.auth.signOut() } catch { /* ignore */ }
}
