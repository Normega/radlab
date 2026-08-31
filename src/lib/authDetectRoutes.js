import { FIELD_GUIDE_SEGMENTS } from '../academic/courseRoutes.js'

// Should the MAIN Supabase client consume auth params it finds in the URL at
// this path?
//
// Two Supabase projects share this app. The Field Guide authenticates against
// radlab-academic (src/academic/courseClient.js); its confirmation and
// magic-link URLs land on Field Guide routes carrying a single-use code the
// main project cannot exchange — but the main client, with URL detection on,
// would try anyway: either writing a foreign session into its own storage or
// eating the code before the academic client can use it. Detection must stay
// ON everywhere else — /verified, /reset-password, and the class signup
// confirmations that land on /class/:slug and /academic/:code/lounge all
// depend on it.
//
// The old rule was `!pathname.startsWith('/academic')`. Course-scoped routes
// broke that: /academic/psy240/lounge is a MAIN-project surface. So the rule
// is now by route shape, not prefix.
//
// INVARIANT (enforced by choice of redirect targets, asserted in the test):
// every academic-project emailRedirectTo/redirectTo targets a path where this
// returns false; every main-project one targets a path where it returns true.
// /academic/:code (the course home) returns true and must therefore never be
// used as an academic-project redirect target.
export function mainClientDetectsSessionAt(pathname) {
  const parts = String(pathname ?? '').split('/').filter(Boolean)
  if (parts[0] !== 'academic') return true
  // Legacy academic-project landings: /academic/fieldguide/**
  if (parts[1] === 'fieldguide') return false
  // Course-scoped Field Guide surfaces: /academic/:courseCode/<segment>
  if (parts.length >= 3 && FIELD_GUIDE_SEGMENTS.has(parts[2])) return false
  // Everything else under /academic is main-project or neutral ground:
  // /academic, /academic/admin, /academic/lecture-lounge/admin,
  // /academic/:code, /academic/:code/lounge/**
  return true
}
