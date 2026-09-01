import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useWikiCourse } from './wiki/useWikiCourse'
import { useWikiBase, useCoursePaths } from './wiki/useWikiBase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// What we've learned since September (run plan §39.12.9). Two audiences, one
// feed: the class sees its collective contribution grow, and a student who
// studied a page early sees what changed after they read it — and, the part
// that actually matters to them, whether the change is examinable yet.
//
// Everything comes from one SECURITY DEFINER rpc (whats_new): it joins
// tables a member's own client can't fully read (gap_claims, page_reviews)
// and returns no names and no stamp notes. Attribution is deliberately
// absent — contributions are coursework, and coursework doesn't publish
// under a name by default.
const ORIGIN = {
  submission: { label: 'student contribution', colour: '#2e7d32' },
  ingest:     { label: 'staff addition',       colour: '#5b7596' },
  correction: { label: 'staff correction',     colour: '#b8860b' },
}

export default function WhatsNew() {
  const WIKI_BASE = useWikiBase() // course-scoped; template usages unchanged
  const paths = useCoursePaths()
  const { courseClient, enrollments } = useOutletContext()
  const { courseId, course } = useWikiCourse(enrollments)
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!courseId) return
    let live = true
    courseClient.rpc('whats_new', { p_course_id: courseId })
      .then(({ data }) => { if (live) setRows(data ?? []) })
    return () => { live = false }
  }, [courseClient, courseId])

  // Grouped by ISO week, newest first. The rpc already sorts; this just cuts
  // the list where the week changes so the term reads as a timeline.
  const weeks = useMemo(() => {
    if (!rows) return []
    const out = []
    let cur = null
    for (const r of rows) {
      const d = new Date(r.landed_at)
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const key = monday.toISOString().slice(0, 10)
      if (!cur || cur.key !== key) {
        cur = { key, label: monday.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' }), rows: [] }
        out.push(cur)
      }
      cur.rows.push(r)
    }
    return out
  }, [rows])

  const contributions = rows?.filter(r => r.origin === 'submission').length ?? 0

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <p style={S.eyebrow}><Link to={paths.home} style={S.eyebrowLink}>Field Guide</Link>{course?.code ? ` · ${course.code}` : ''}</p>
        <h1 style={S.title}>What we've learned since September</h1>
        <p style={S.sub}>
          The guide the term started with is not the guide you're reading. Every accepted
          contribution and correction lands here, newest first — so if you studied a page weeks
          ago, this is what changed behind you.
        </p>
        {rows && rows.length > 0 && (
          <p style={S.counter}>
            {rows.length} change{rows.length === 1 ? '' : 's'} so far
            {contributions > 0 && <> · <b>{contributions}</b> from this class's own research</>}
          </p>
        )}

        <p style={S.keyLine}>
          <span style={S.examTag}>examinable</span> means staff have verified the page since the
          change landed — it is part of what tests can draw on (test items are only ever written
          against staff-verified text). Everything else is reference: read it, cite it, but it
          won't be on an exam yet.
        </p>

        {rows === null && <p style={S.sub}>Loading…</p>}

        {rows?.length === 0 && (
          <p style={{ ...S.sub, marginTop: 24 }}>
            Nothing yet — the term's first accepted contribution will start the timeline.
          </p>
        )}

        {weeks.map(w => (
          <section key={w.key} style={S.week}>
            <h2 style={S.weekH}>Week of {w.label}</h2>
            {w.rows.map(r => {
              const o = ORIGIN[r.origin] ?? ORIGIN.correction
              return (
                <div key={r.version_id} style={S.entry}>
                  <div style={S.entryTop}>
                    <span style={{ ...S.originTag, color: o.colour, borderColor: o.colour }}>{o.label}</span>
                    <Link
                      to={`${WIKI_BASE}/${r.slug}${r.section ? `#${r.section}` : ''}`}
                      style={S.pageLink}
                    >
                      {r.page_title}
                    </Link>
                    {r.examinable
                      ? <span style={S.examTag}>examinable</span>
                      : <span style={S.refTag}>reference</span>}
                  </div>
                  {/* The resolved gap's ask is the one-line "what the guide now
                      knows that it didn't" — written when the gap was, no
                      editorial pass needed. Corrections show their required
                      note instead. */}
                  {(r.ask || r.note) && (
                    <p style={S.entryBody}>{r.ask ?? r.note}</p>
                  )}
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 30, color: 'var(--tx)', margin: '4px 0 8px', lineHeight: 1.15 },
  sub: { fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: '62ch' },
  counter: { fontFamily: MONO, fontSize: 14, color: 'var(--tx)', marginTop: 12 },
  keyLine: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'var(--bgc)', border: '1px solid var(--bd)', maxWidth: '70ch' },

  week: { marginTop: 28 },
  weekH: { fontFamily: SERIF, fontSize: 19, color: 'var(--tx)', margin: '0 0 10px', paddingBottom: 6, borderBottom: '1px solid var(--bd)' },
  entry: { padding: '10px 0', borderBottom: '1px dotted var(--bd)' },
  entryTop: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' },
  originTag: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', border: '1px solid', borderRadius: 12, padding: '1px 8px', whiteSpace: 'nowrap' },
  pageLink: { fontSize: 15, fontWeight: 600, color: 'var(--tx)', textDecoration: 'none' },
  examTag: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: '#2e7d32', border: '1px solid #2e7d32', borderRadius: 12, padding: '1px 8px', whiteSpace: 'nowrap' },
  refTag: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--tx2)', border: '1px solid var(--bd)', borderRadius: 12, padding: '1px 8px', whiteSpace: 'nowrap' },
  entryBody: { fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.55, margin: '6px 0 0', maxWidth: '68ch' },
}
