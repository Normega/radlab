import { createClient } from '@supabase/supabase-js'

// Client for the SEPARATE radlab-academic Supabase project (courses,
// enrollments, identity schema, ingest jobs) — not the main radlab project.
// Its URL + anon key live server-side only (COURSE_SUPABASE_URL /
// COURSE_SUPABASE_ANON_KEY in Vercel); the client fetches them from
// GET /api/ingest so no VITE_-prefixed duplicates need to exist.
//
// Note: under plain `vite dev` there is no /api — use a Vercel preview
// deploy (or `vercel dev`) to exercise the academic auth flow locally.

let clientPromise = null

export function getCourseClient() {
  if (!clientPromise) {
    clientPromise = fetch('/api/ingest')
      .then(r => {
        if (!r.ok) throw new Error(`Course backend unreachable (${r.status})`)
        return r.json()
      })
      .then(({ url, anonKey }) =>
        createClient(url, anonKey, {
          // Distinct storage key so the academic session never collides with
          // the main radlab project's auth token in localStorage.
          auth: { storageKey: 'radlab-academic-auth' },
        })
      )
      .catch(err => {
        clientPromise = null // allow retry on transient failure
        throw err
      })
  }
  return clientPromise
}
