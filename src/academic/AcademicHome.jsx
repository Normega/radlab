import { Link } from 'react-router-dom'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// /academic — minimal landing for the academic partition (partition plan §2).
// Links to the sub-areas; each enforces its own auth.
export default function AcademicHome() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%' }}>
        <p style={S.eyebrow}>radlab</p>
        <h1 style={S.title}>Academic</h1>
        <p style={S.sub}>Classroom and course tools built on the radlab platform.</p>

        <Link to="/academic/lecture-lounge/admin" style={S.card}>
          <h2 style={S.cardTitle}>Lecture Lounge</h2>
          <p style={S.sub}>Live classroom engagement — admin console for classes and instructors. Students join at their class link.</p>
        </Link>
        <Link to="/academic/fieldguide/wiki" style={S.card}>
          <h2 style={S.cardTitle}>Field Guide — wiki</h2>
          <p style={S.sub}>The course wiki. Open to anyone enrolled; published pages only unless you're staff.</p>
        </Link>
        <Link to="/academic/fieldguide/ingest" style={S.card}>
          <h2 style={S.cardTitle}>Field Guide — ingest</h2>
          <p style={S.sub}>Course wiki paper-ingest portal. Instructors and TAs only.</p>
        </Link>
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  title: { fontFamily: SERIF, fontSize: 32, color: 'var(--tx)', margin: '2px 0 6px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  card: { display: 'block', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '18px 20px', marginTop: 16, textDecoration: 'none' },
  cardTitle: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', marginBottom: 4 },
}
