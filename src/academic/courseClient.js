import { createClient } from '@supabase/supabase-js'

// Client for the SEPARATE radlab-academic Supabase project (courses,
// enrollments, identity schema, ingest jobs) — not the main radlab project.
//
// The URL and publishable key are baked in (2026-09-08): they are PUBLIC by
// definition — /api/ingest has served them to any unauthenticated caller
// since phase 1 — and fetching them added a serverless round-trip (plus its
// cold starts) to the FRONT of every academic page load, serializing
// everything behind it. Construction is now synchronous; getCourseClient
// keeps its Promise signature so no caller changes.
//
// Key rotation: update these constants (or set the VITE_ overrides in
// Vercel) and redeploy. /api/ingest still serves the same values for any
// out-of-tree consumer.
const COURSE_URL =
  import.meta.env.VITE_COURSE_SUPABASE_URL ?? 'https://qldgwpneygvgcvexlduz.supabase.co'
const COURSE_ANON_KEY =
  import.meta.env.VITE_COURSE_SUPABASE_ANON_KEY ?? 'sb_publishable_fl5t3V8U7u6IjoIFJaeV-Q_8Eq7PBuM'

let client = null

export function getCourseClient() {
  if (!client) {
    client = createClient(COURSE_URL, COURSE_ANON_KEY, {
      // Distinct storage key so the academic session never collides with
      // the main radlab project's auth token in localStorage.
      auth: { storageKey: 'radlab-academic-auth' },
    })
  }
  return Promise.resolve(client)
}
