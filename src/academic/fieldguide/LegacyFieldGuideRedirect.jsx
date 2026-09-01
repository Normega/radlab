import { Link, Navigate, useLocation, useOutletContext, useParams } from 'react-router-dom'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The resolving shim behind every legacy /academic/fieldguide/* URL.
//
// Those URLs carry no course, and a wiki slug is only unique per
// (course_id, slug), so the course cannot be recovered from the URL alone.
// Some of the legacy URLs are also IMMORTAL — /wiki is the redirectTo inside
// every magic link ever emailed, /gaps and /whats-new are in sent
// claim-decision emails — so these mounts live forever, under the same guard
// the legacy route always had: the guard creates the academic client, which
// consumes any auth token in the URL, and only then does this component
// redirect.
//
// Resolution order (never auto-pick from an ambiguous list — the
// courseRoutes invariant):
//   1. the reader's old sessionStorage course hint, if it still matches
//   2. exactly one addressable course → straight through
//   3. several → a chooser
//
// `target` builds the destination from a lowercase course code and the route
// params (for :slug), e.g.  (code, params) => `${wikiBase(code)}/${params.slug}`.
// Query string and hash are preserved.

// useWikiCourse's old key. READ-ONLY legacy hint: nothing writes it any more
// (the course lives in the URL now), so it decays naturally as sessions end.
const LEGACY_HINT_KEY = 'fieldguide.courseId'

export default function LegacyFieldGuideRedirect({ target }) {
  const { enrollments } = useOutletContext()
  const params = useParams()
  const { search, hash } = useLocation()

  const byCode = new Map()
  for (const e of enrollments ?? []) {
    const code = e?.courses?.code
    if (code && !byCode.has(code)) byCode.set(code, e)
  }
  const candidates = [...byCode.values()]
    .sort((a, b) => a.courses.code.localeCompare(b.courses.code))

  const dest = (e) =>
    `${target(e.courses.code.toLowerCase(), params)}${search}${hash}`

  let hinted = null
  try {
    const saved = sessionStorage.getItem(LEGACY_HINT_KEY)
    hinted = saved ? candidates.find(e => e.course_id === saved) ?? null : null
  } catch { /* private mode */ }

  if (hinted) return <Navigate to={dest(hinted)} replace />
  if (candidates.length === 1) return <Navigate to={dest(candidates[0])} replace />

  if (!candidates.length) {
    // The guard admits nobody with zero addressable courses, so this is
    // unreachable in practice — render something honest anyway.
    return <Shell><p style={S.sub}>No course access on this account.</p></Shell>
  }

  return (
    <Shell>
      <h1 style={S.title}>Which course?</h1>
      <p style={S.sub}>This link predates per-course pages. Pick where to go:</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {candidates.map(e => (
          <Link key={e.courses.code} to={dest(e)} style={S.choice}>
            {e.courses.code}{e.courses.term ? ` · ${e.courses.term}` : ''}
            <span style={S.choiceSub}>{e.courses.name}</span>
          </Link>
        ))}
      </div>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={S.card}>
        <p style={S.eyebrow}>Field Guide</p>
        {children}
      </div>
    </div>
  )
}

const S = {
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '40px 32px', textAlign: 'center', maxWidth: 420, width: '100%' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  choice: { display: 'flex', flexDirection: 'column', gap: 2, fontFamily: MONO, fontSize: 15, fontWeight: 600, color: 'var(--tx)', textDecoration: 'none', padding: '12px 16px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--bd)' },
  choiceSub: { fontFamily: 'inherit', fontSize: 12, fontWeight: 400, color: 'var(--tx2)' },
}
