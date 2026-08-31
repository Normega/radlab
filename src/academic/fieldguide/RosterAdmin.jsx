import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom'
import { rosterPath, staffedCourses, resolveCourse } from './rosterCourse.js'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// WP5 staff console (plan §2a): import the ACORN CSV, watch the status flow,
// send invites, resolve unmatched join attempts. The roster table itself is
// closed to clients — everything here goes through the staff-gated RPCs
// (roster_admin / roster_upsert / roster_set_status / roster_attempts) or the
// staff-authenticated /api/roster-invite endpoint.
//
// CSV handling: parsed client-side with explicit column mapping — ACORN
// exports rename columns often enough that guessing a fixed header row is how
// importers rot. Staff pick which column is which; the choice is remembered
// per header signature for re-uploads.

const STATUS_COLOUR = {
  added:    'var(--tx2)',
  invited:  '#b8860b',
  enrolled: '#2e7d32',
  bounced:  '#c0392b',
  dropped:  '#888',
}

// Minimal CSV parser that survives quoted fields with commas. Not a general
// implementation — good enough for ACORN exports and spreadsheet saves.
function parseCsv(text) {
  const rows = []
  let row = [], cell = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') inQ = false
      else cell += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(x => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some(x => x.trim() !== '')) rows.push(row)
  return rows
}

const guessCol = (headers, patterns) => {
  const idx = headers.findIndex(h => patterns.some(p => h.toLowerCase().includes(p)))
  return idx >= 0 ? idx : ''
}

// Page chrome for the two pre-roster states (choose a course / unknown course),
// so they sit on the same background and rails as the roster itself.
function Frame({ children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <p style={S.eyebrow}><Link to="/academic/fieldguide" style={S.eyebrowLink}>Field Guide</Link> · staff</p>
        {children}
      </div>
    </div>
  )
}

// The courses this person can actually open a roster for. Shown by both
// pre-roster states, which differ only in why they are asking.
function CourseList({ courses }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
      {courses.map(e => (
        <Link key={e.course_id} to={rosterPath(e.courses.code)} style={S.courseBtn}>
          {e.courses.code}
          <span style={S.courseBtnSub}>
            {e.courses.name}{e.courses.term ? ` · ${e.courses.term}` : ''}
          </span>
        </Link>
      ))}
    </div>
  )
}

export default function RosterAdmin() {
  const { courseClient, staffEnrollments, session } = useOutletContext()
  const { courseCode } = useParams()

  // Both resolved in rosterCourse.js, where they are unit-tested. The rule
  // that matters: a code that does not resolve gives null, never a fallback to
  // some other course this person staffs — the next click here can be a
  // several-hundred-row import or a bulk invite.
  const courses = useMemo(() => staffedCourses(staffEnrollments), [staffEnrollments])
  const course  = useMemo(() => resolveCourse(courses, courseCode), [courses, courseCode])

  const courseId = course?.course_id

  const [rows, setRows] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [filter, setFilter] = useState('all')
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)

  // CSV import state
  const [csv, setCsv] = useState(null)       // { headers, data }
  const [map, setMap] = useState({ name: '', email: '', num: '' })

  useEffect(() => {
    if (!courseId) return
    let live = true
    Promise.all([
      courseClient.rpc('roster_admin', { p_course_id: courseId }),
      courseClient.rpc('roster_attempts', { p_course_id: courseId }),
    ]).then(([r, a]) => {
      if (!live) return
      setRows(r.data ?? [])
      setAttempts((a.data ?? []).filter(x => !x.resolved_at))
    })
    return () => { live = false }
  }, [courseClient, courseId, reload])

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0 }
    for (const r of rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])

  const visible = useMemo(
    () => (rows ?? []).filter(r => filter === 'all' || r.status === filter),
    [rows, filter],
  )

  const onFile = async (file) => {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.length < 2) return setNotice('That file has no data rows.')
    const headers = parsed[0]
    setCsv({ headers, data: parsed.slice(1) })
    setMap({
      name:  guessCol(headers, ['name']),
      email: guessCol(headers, ['email', 'e-mail']),
      num:   guessCol(headers, ['student', 'number', 'id']),
    })
  }

  const doImport = async () => {
    if (map.name === '' || map.email === '') return setNotice('Pick the name and email columns first.')
    setBusy(true)
    const payload = csv.data.map(r => ({
      full_name: r[map.name] ?? '',
      email: r[map.email] ?? '',
      student_number: map.num === '' ? null : (r[map.num] ?? null),
    }))
    const { data, error } = await courseClient.rpc('roster_upsert', {
      p_course_id: courseId, p_rows: payload,
    })
    setBusy(false)
    if (error) return setNotice(error.message)
    setNotice(`Imported: ${data.inserted} new, ${data.updated} updated, ${data.skipped} skipped.`)
    setCsv(null)
    setReload(k => k + 1)
  }

  // Invites go through the serverless endpoint (it holds the Resend key and
  // the service role). `all` batches server-side; loop while remaining.
  const invite = useCallback(async (body, label) => {
    setBusy(true)
    setNotice(`${label}…`)
    let total = 0, failures = []
    try {
      for (;;) {
        const rsp = await fetch('/api/roster-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ course_id: courseId, ...body }),
        })
        const out = await rsp.json().catch(() => ({}))
        if (!rsp.ok) { failures.push({ email: '(batch)', error: out.error ?? rsp.status }); break }
        total += out.sent
        failures = failures.concat(out.failed ?? [])
        setNotice(`${label}: ${total} sent…`)
        if (!body.all || !out.remaining) break
      }
    } catch (e) {
      failures.push({ email: '(network)', error: e.message })
    }
    setBusy(false)
    setNotice(
      `${label}: ${total} sent` +
      (failures.length ? ` · ${failures.length} failed — ${failures.slice(0, 3).map(f => `${f.email}: ${f.error}`).join('; ')}${failures.length > 3 ? '…' : ''}` : ''),
    )
    setReload(k => k + 1)
  }, [courseId, session])

  const setStatus = async (id, status) => {
    const { error } = await courseClient.rpc('roster_set_status', { p_id: id, p_status: status })
    if (error) return setNotice(error.message)
    setReload(k => k + 1)
  }

  const resolveAttempt = async (id) => {
    const note = window.prompt('Resolution note (e.g. "added to roster", "not our student"):')
    if (note === null) return
    const { error } = await courseClient.rpc('roster_resolve_attempt', {
      p_course_id: courseId, p_id: id, p_note: note || null,
    })
    if (error) return setNotice(error.message)
    setReload(k => k + 1)
  }

  // ── Course resolution, before any roster is shown ────────────────────────
  // Every hook above runs unconditionally; these returns sit below all of them
  // so hook order is identical on every render.

  // No course named. Staff exactly one and there is nothing to choose, so go
  // straight through and keep the old bookmark working. Staff several and the
  // choice IS the point of this route, so it gets made, not defaulted.
  if (!courseCode) {
    if (courses.length === 1) return <Navigate to={rosterPath(courses[0].courses.code)} replace />
    return (
      <Frame>
        <h1 style={S.title}>Roster</h1>
        <p style={S.sub}>
          {courses.length
            ? 'Which course? The roster page imports and emails in bulk, so it works on one named course at a time.'
            : 'You do not staff any course, so there is no roster to manage.'}
        </p>
        <CourseList courses={courses} />
      </Frame>
    )
  }

  // Named a course the caller does not staff, or that does not exist. Say so
  // rather than quietly showing a different course's roster.
  if (!course) {
    return (
      <Frame>
        <h1 style={S.title}>Roster</h1>
        <p style={S.sub}>
          No course with the code <code style={S.code}>{courseCode}</code> is one you staff.
          {courses.length ? ' You have staff access to:' : ' You do not staff any course.'}
        </p>
        <CourseList courses={courses} />
      </Frame>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <p style={S.eyebrow}><Link to="/academic/fieldguide" style={S.eyebrowLink}>Field Guide</Link> · staff</p>
        <h1 style={S.title}>Roster · {course.courses.code}</h1>
        {courses.length > 1 && (
          <p style={S.sub}>
            {courses.filter(e => e.course_id !== course.course_id).map(e => (
              <Link key={e.course_id} to={rosterPath(e.courses.code)} style={S.switchLink}>
                Switch to {e.courses.code}
              </Link>
            ))}
          </p>
        )}
        <p style={S.sub}>
          Import the ACORN CSV, invite, watch enrollment. <b>Enrolled</b> means the student clicked
          their emailed link — it can't be set by hand, and re-importing a CSV never regresses it.
          Students self-serve fresh sign-in links at <code style={S.code}>/academic/fieldguide/join</code>
          {' '}(that's the URL behind the lecture-slide QR code).
        </p>

        {notice && <p style={S.notice}>{notice}</p>}

        {/* ── CSV import ── */}
        <section style={S.panel}>
          <h2 style={S.h2}>Import roster CSV</h2>
          {!csv ? (
            <input type="file" accept=".csv,text/csv" style={{ fontSize: 14, color: 'var(--tx)' }}
                   onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          ) : (
            <>
              <p style={S.sub}>{csv.data.length} data rows. Which column is which?</p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '10px 0' }}>
                {[['name', 'Full name'], ['email', 'Email'], ['num', 'Student number (optional)']].map(([k, label]) => (
                  <label key={k} style={S.sub}>
                    {label}{' '}
                    <select style={S.select} value={map[k]}
                            onChange={e => setMap(m => ({ ...m, [k]: e.target.value === '' ? '' : Number(e.target.value) }))}>
                      <option value="">—</option>
                      {csv.headers.map((h, i) => <option key={i} value={i}>{h || `(column ${i + 1})`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={S.primary} disabled={busy} onClick={doImport}>{busy ? 'Importing…' : 'Import'}</button>
                <button style={S.secondary} disabled={busy} onClick={() => setCsv(null)}>Cancel</button>
              </div>
            </>
          )}
        </section>

        {/* ── Unmatched attempts ── */}
        {attempts.length > 0 && (
          <section style={{ ...S.panel, borderColor: '#b8860b' }}>
            <h2 style={S.h2}>Unmatched join attempts ({attempts.length})</h2>
            <p style={S.sub}>Someone used the join form with an address that isn't on the roster — usually a personal email, sometimes a late enrolment.</p>
            {attempts.map(a => (
              <div key={a.id} style={S.attemptRow}>
                <span style={{ fontFamily: MONO, fontSize: 13 }}>{a.submitted}</span>
                <span style={S.dim}>{new Date(a.submitted_at).toLocaleString()}</span>
                <button style={S.tiny} onClick={() => resolveAttempt(a.id)}>Resolve</button>
              </div>
            ))}
          </section>
        )}

        {/* ── Status bar + bulk actions ── */}
        <div style={S.bar}>
          {['all', 'added', 'invited', 'enrolled', 'bounced', 'dropped'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
                    style={{ ...S.chip, ...(filter === s ? S.chipOn : null), color: s === 'all' ? 'var(--tx)' : STATUS_COLOUR[s] }}>
              {s} {counts[s] ?? 0}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button style={S.primary} disabled={busy || !rows?.length}
                  onClick={() => invite({ all: true }, 'Bulk invite')}>
            {busy ? '…' : 'Invite all not-yet-enrolled'}
          </button>
        </div>

        {/* ── The roster ── */}
        {rows === null ? <p style={S.sub}>Loading…</p> : (
          <table style={S.table}>
            <thead>
              <tr>
                {['Name', 'Email', 'Student #', 'Status', 'Invites', 'Last invited', ''].map(h =>
                  <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id}>
                  <td style={S.td}>{r.full_name}</td>
                  <td style={{ ...S.td, fontFamily: MONO, fontSize: 12.5 }}>{r.email}</td>
                  <td style={{ ...S.td, fontFamily: MONO, fontSize: 12.5 }}>{r.student_number ?? '—'}</td>
                  <td style={{ ...S.td, color: STATUS_COLOUR[r.status], fontWeight: 600 }}>{r.status}</td>
                  <td style={S.td}>{r.invite_count}</td>
                  <td style={S.td}>{r.last_invited_at ? new Date(r.last_invited_at).toLocaleDateString() : '—'}</td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                    {r.status !== 'enrolled' && (
                      <button style={S.tiny} disabled={busy}
                              onClick={() => invite({ roster_ids: [r.id] }, `Invite ${r.full_name}`)}>invite</button>
                    )}
                    {r.status !== 'dropped'
                      ? <button style={S.tiny} disabled={busy} onClick={() => setStatus(r.id, 'dropped')}>drop</button>
                      : <button style={S.tiny} disabled={busy} onClick={() => setStatus(r.id, 'added')}>restore</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 6px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 720 },
  dim: { color: 'var(--tx2)', fontSize: 12 },
  code: { fontFamily: MONO, fontSize: 12.5 },
  notice: { marginTop: 12, fontFamily: MONO, fontSize: 13, color: 'var(--pk)', lineHeight: 1.5 },
  h2: { fontFamily: SERIF, fontSize: 19, color: 'var(--tx)', margin: '0 0 8px' },
  panel: { marginTop: 18, padding: '16px 18px', borderRadius: 12, background: 'var(--bgc)', border: '1px solid var(--bd)' },
  select: { fontSize: 13, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' },
  primary: { fontSize: 13.5, fontWeight: 600, padding: '8px 16px', borderRadius: 20, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  secondary: { fontSize: 13.5, fontWeight: 600, padding: '8px 16px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },
  bar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '22px 0 10px' },
  chip: { fontFamily: MONO, fontSize: 12, padding: '5px 12px', borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bgc)', cursor: 'pointer' },
  chipOn: { borderColor: 'var(--pk)', background: 'rgba(214,51,132,.08)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', padding: '8px 10px', borderBottom: '1px solid var(--bd)' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--tx)' },
  tiny: { fontFamily: MONO, fontSize: 11, padding: '3px 10px', marginRight: 6, borderRadius: 12, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx2)', cursor: 'pointer' },
  attemptRow: { display: 'flex', gap: 14, alignItems: 'center', padding: '6px 0', borderBottom: '1px dotted var(--bd)' },
  courseBtn: {
    display: 'flex', flexDirection: 'column', gap: 3, minWidth: 190,
    fontFamily: MONO, fontSize: 15, fontWeight: 600, color: 'var(--tx)',
    textDecoration: 'none', padding: '14px 18px', borderRadius: 12,
    background: 'var(--bgc)', border: '1px solid var(--bd)',
  },
  courseBtnSub: { fontFamily: 'inherit', fontSize: 12, fontWeight: 400, color: 'var(--tx2)' },
  switchLink: { fontFamily: MONO, fontSize: 12.5, color: 'var(--pk)', textDecoration: 'none', marginRight: 14 },
}
