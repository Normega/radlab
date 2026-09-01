import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useWikiBase, useCoursePaths } from './wiki/useWikiBase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Staff triage for student reports (2026-08-20). Three exits per report, and
// each one closes the loop the student can see:
//   Fixed      — you applied it via Edit page on the wiki page (corrections
//                path, note, tripwire); then mark it here with a note.
//   Convert    — a verified contradiction becomes a claimable gap: one click
//                flags the gap seeded from the report, links it, resolves.
//                The reporting student claims it on the board; their
//                submission counts toward the required three articles.
//   Dismiss    — with a note, because silence teaches students not to report.
export default function ReportsQueue() {
  const WIKI_BASE = useWikiBase() // course-scoped; template usages unchanged
  const { courseClient, course: urlCourse } = useOutletContext()
  const paths = useCoursePaths()
  // Course from the URL via the guard — the in-page picker is gone because
  // switching course is now navigation, and a picker could contradict the
  // address bar.
  const courseId = urlCourse?.course_id
  const [rows, setRows] = useState(null)
  const [showResolved, setShowResolved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!courseId) return
    let live = true
    courseClient.from('page_reports')
      .select('id, kind, section, body, citation, status, resolution, created_at, wiki_pages ( slug, title )')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { if (live) setRows(data ?? []) })
    return () => { live = false }
  }, [courseClient, courseId, reload])

  const resolve = async (r, status) => {
    const note = window.prompt(
      status === 'fixed' ? 'What was fixed? (the student sees this)' :
      'Why dismissed? (the student sees this)')
    if (note === null) return
    setBusy(true)
    const { error } = await courseClient.rpc('resolve_page_report', {
      p_id: r.id, p_status: status, p_note: note || null,
    })
    setBusy(false)
    if (error) return setNotice(error.message)
    setReload(k => k + 1)
  }

  // Convert: flag the gap seeded from the report, then resolve with its id.
  // Difficulty amber by default — a contradiction ask is judgment work.
  const convert = async (r) => {
    if (!r.wiki_pages) return
    setBusy(true)
    setNotice(null)
    const ask =
      `${r.body.trim()}${r.citation ? ` A starting source has been proposed: ${r.citation.trim()}` : ''}` +
      ' (Opened from a student contradiction report — verify the source against the page and record what each actually says.)'
    const { data: pageRow } = await courseClient
      .from('wiki_pages').select('id').eq('slug', r.wiki_pages.slug).single()
    const { data: gap, error: gapErr } = await courseClient.rpc('flag_gap', {
      p_page_id: pageRow.id, p_section: r.section, p_ask: ask, p_difficulty: 'amber',
    })
    if (gapErr) { setBusy(false); return setNotice(gapErr.message) }
    const { error: resErr } = await courseClient.rpc('resolve_page_report', {
      p_id: r.id, p_status: 'converted',
      p_note: 'Verified and opened as a gap on the board — claim it and submit the source through the normal pipeline; it counts toward your three articles.',
      p_gap_id: gap.id,
    })
    setBusy(false)
    if (resErr) return setNotice(resErr.message)
    setNotice(`Converted — gap is live on the board (${r.wiki_pages.slug}).`)
    setReload(k => k + 1)
  }

  const open = (rows ?? []).filter(r => r.status === 'open')
  const resolved = (rows ?? []).filter(r => r.status !== 'open')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <p style={S.eyebrow}><Link to={paths.home} style={S.eyebrowLink}>Field Guide</Link> · staff</p>
        <h1 style={S.title}>Student reports</h1>
        <p style={S.sub}>
          Errors and contradictions students found while reading. <b>Fixed</b> = you applied it via
          Edit page on the wiki page itself; <b>Convert</b> = a verified contradiction becomes an
          amber gap the student can claim (their submission counts toward the three);
          <b> Dismiss</b> always carries a note, because silence teaches students not to report.
        </p>
        {notice && <p style={S.notice}>{notice}</p>}

        <h2 style={S.h2}>Open ({open.length})</h2>
        {rows === null ? <p style={S.sub}>Loading…</p> :
         open.length === 0 ? <p style={S.sub}>Nothing waiting.</p> :
         open.map(r => (
          <div key={r.id} style={S.card}>
            <div style={S.cardTop}>
              <span style={{ ...S.kind, color: r.kind === 'contradiction' ? 'var(--pk)' : '#b8860b' }}>
                {r.kind}
              </span>
              {r.wiki_pages && (
                <Link to={`${WIKI_BASE}/${r.wiki_pages.slug}${r.section ? `#${r.section}` : ''}`} style={S.pageLink}>
                  {r.wiki_pages.title}{r.section ? ` · ${r.section}` : ''}
                </Link>
              )}
              <span style={S.dim}>{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            <p style={S.body}>{r.body}</p>
            {r.citation && <p style={S.citation}>Source: {r.citation}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button style={S.btn} disabled={busy} onClick={() => resolve(r, 'fixed')}>Fixed</button>
              {r.kind === 'contradiction' && (
                <button style={S.btnPk} disabled={busy} onClick={() => convert(r)}>Convert to gap</button>
              )}
              <button style={S.btn} disabled={busy} onClick={() => resolve(r, 'dismissed')}>Dismiss</button>
            </div>
          </div>
        ))}

        <button style={S.toggle} onClick={() => setShowResolved(v => !v)}>
          {showResolved ? 'Hide' : 'Show'} resolved ({resolved.length})
        </button>
        {showResolved && resolved.map(r => (
          <div key={r.id} style={{ ...S.card, opacity: 0.65 }}>
            <div style={S.cardTop}>
              <span style={S.kind}>{r.status}</span>
              {r.wiki_pages && <span style={S.dim}>{r.wiki_pages.title}</span>}
            </div>
            <p style={S.body}>{r.body.slice(0, 160)}{r.body.length > 160 ? '…' : ''}</p>
            {r.resolution && <p style={S.citation}>→ {r.resolution}</p>}
          </div>
        ))}
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
  dim: { color: 'var(--tx2)', fontSize: 12, fontFamily: MONO },
  notice: { marginTop: 10, fontFamily: MONO, fontSize: 12.5, color: 'var(--pk)' },
  h2: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', margin: '22px 0 10px' },
  card: { padding: '12px 14px', borderRadius: 10, background: 'var(--bgc)', border: '1px solid var(--bd)', marginBottom: 10 },
  cardTop: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' },
  kind: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  pageLink: { fontSize: 14, fontWeight: 600, color: 'var(--tx)', textDecoration: 'none', flex: '1 1 auto' },
  body: { fontSize: 13.5, color: 'var(--tx)', lineHeight: 1.5, margin: '8px 0 0' },
  citation: { fontSize: 12.5, color: 'var(--tx2)', fontFamily: MONO, margin: '6px 0 0' },
  btn: { fontSize: 12.5, fontWeight: 600, padding: '5px 13px', borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)', cursor: 'pointer' },
  btnPk: { fontSize: 12.5, fontWeight: 600, padding: '5px 13px', borderRadius: 16, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  toggle: { marginTop: 16, fontFamily: MONO, fontSize: 12, padding: '6px 14px', borderRadius: 16, border: '1px solid var(--bd)', background: 'none', color: 'var(--tx2)', cursor: 'pointer' },
}
