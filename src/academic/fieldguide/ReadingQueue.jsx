import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { AcademicEyebrow } from '../AcademicChrome'
import { useWikiBase, useCoursePaths } from './wiki/useWikiBase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The pre-publish read as a queue (run plan §38.4). The stamp bar on each
// wiki page is the approval mechanism; this page removes the other cost —
// deciding what to read next. Open the top unreviewed page, read, stamp,
// and the stamp bar hands you the next one.
const BAND = {
  1: { label: 'Safety & legal', note: 'Every page that ever carried a red gap, plus the named safety/legal set. A wrong sentence costs the most here. Read these first.' },
  2: { label: 'Heavily scaffolded', note: '6+ open gaps: the pages students will work on hardest, and the most exposed to claims.' },
  3: { label: 'Tier A & foundation', note: 'Highest readership: the core disorder and scaffolding pages.' },
  4: { label: 'Everything else', note: 'Lowest priority — nothing here invites student edits. Fine to review in place during term, after publishing.' },
}

export default function ReadingQueue() {
  const WIKI_BASE = useWikiBase() // course-scoped; template usages unchanged
  const { courseClient, course: urlCourse } = useOutletContext()
  const paths = useCoursePaths()
  // Course from the URL via the guard — the in-page picker is gone because
  // switching course is now navigation, and a picker could contradict the
  // address bar.
  const courseId = urlCourse?.course_id
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!courseId) return
    let live = true
    courseClient.rpc('review_worklist', { p_course_id: courseId })
      .then(({ data }) => { if (live) setRows(data ?? []) })
    return () => { live = false }
  }, [courseClient, courseId])

  const bands = useMemo(() => {
    const b = { 1: [], 2: [], 3: [], 4: [] }
    for (const r of rows ?? []) b[r.risk_band]?.push(r)
    return b
  }, [rows])

  const done = (rows ?? []).filter(r => r.reviewed_current).length
  const total = rows?.length ?? 0
  const preTotal = (rows ?? []).filter(r => r.risk_band < 4).length
  const preDone = (rows ?? []).filter(r => r.risk_band < 4 && r.reviewed_current).length
  const next = (rows ?? []).find(r => !r.reviewed_current)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <AcademicEyebrow to={paths.home} suffix=" · staff" />
        <h1 style={S.title}>The reading queue</h1>
        <p style={S.sub}>
          Read in this order, stamp on the page (the bar under the title), and the stamp bar offers
          the next unreviewed page — you never come back here unless you want the overview. A stamp
          is three things at once: the page is cleared for your pre-publish list, its current
          version becomes <b>item-eligible</b> for tests, and its accepted changes show as
          examinable in What's new. Editing a page un-stamps it, on purpose.
        </p>


        {rows === null ? <p style={S.sub}>Loading…</p> : (
          <>
            <div style={S.progressBox}>
              <p style={S.progressBig}>
                {preDone} of {preTotal} pre-publish pages reviewed
                <span style={S.dim}> · {done} of {total} overall</span>
              </p>
              <div style={S.barOuter}>
                <div style={{ ...S.barInner, width: `${preTotal ? Math.round(100 * preDone / preTotal) : 0}%` }} />
              </div>
              {next && (
                <Link to={`${WIKI_BASE}/${next.slug}`} style={S.primary}>
                  Continue reading → {next.title}
                </Link>
              )}
            </div>

            {[1, 2, 3, 4].map(n => (
              <section key={n} style={{ marginTop: 26 }}>
                <h2 style={S.h2}>
                  {n}. {BAND[n].label}
                  <span style={S.count}>
                    {bands[n].filter(r => r.reviewed_current).length} / {bands[n].length}
                  </span>
                </h2>
                <p style={{ ...S.sub, fontSize: 14 }}>{BAND[n].note}</p>
                <div style={{ marginTop: 8 }}>
                  {bands[n].map(r => (
                    <Link key={r.slug} to={`${WIKI_BASE}/${r.slug}`} style={S.row}>
                      <span aria-hidden="true" style={{
                        ...S.dot,
                        background: r.reviewed_current ? '#2e7d32'
                          : r.last_verdict === 'needs_work' ? '#c0392b' : 'var(--bd)',
                      }} />
                      <span style={{ ...S.rowTitle, opacity: r.reviewed_current ? 0.55 : 1 }}>{r.title}</span>
                      <span style={S.rowMeta}>
                        {r.page_type}{r.tier ? ` · ${r.tier}` : ''} · {r.open_gaps} gap{r.open_gaps === 1 ? '' : 's'}
                        {r.last_verdict === 'needs_work' && !r.reviewed_current && ' · needs work'}
                        {r.reviewed_current && ' · ✓'}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 8px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: '68ch' },
  picker: { marginTop: 16, fontSize: 14, padding: '8px 8px', borderRadius: 12, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },
  dim: { color: 'var(--tx2)', fontWeight: 400, fontSize: 14 },
  h2: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '0 0 4px', display: 'flex', alignItems: 'baseline', gap: 10 },
  count: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  progressBox: { marginTop: 18, padding: '16px 18px', borderRadius: 12, background: 'var(--bgc)', border: '1px solid var(--bd)' },
  progressBig: { fontSize: 16, fontWeight: 600, color: 'var(--tx)', margin: '0 0 10px' },
  barOuter: { height: 8, borderRadius: 4, background: 'var(--bd)', overflow: 'hidden' },
  barInner: { height: '100%', background: '#2e7d32', transition: 'width .3s ease' },
  primary: { display: 'inline-block', marginTop: 14, fontSize: 14, fontWeight: 600, padding: '9px 18px', borderRadius: 22, background: 'var(--pk)', color: '#fff', textDecoration: 'none' },
  row: { display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 4px', borderBottom: '1px dotted var(--bd)', textDecoration: 'none' },
  dot: { flexShrink: 0, width: 9, height: 9, borderRadius: '50%', position: 'relative', top: -1 },
  rowTitle: { fontSize: 14.5, color: 'var(--tx)', flex: '1 1 auto' },
  rowMeta: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', whiteSpace: 'nowrap' },
}
