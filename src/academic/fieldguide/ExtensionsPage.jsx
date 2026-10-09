import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { AcademicEyebrow, AcademicHeaderRow } from '../AcademicChrome'
import AvatarMenu from './AvatarMenu'
import { staffedCourses, resolveCourse } from './staffCourses.js'
import { CONTRIBUTION_SLOTS } from './contributions'
import { courseSubPath } from '../courseRoutes'
import { courseFeatures } from '../courseFeatures.js'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Deadline extensions (/academic/:courseCode/extensions), staff only
// (Norm, 2026-10-09). One record of every extension the course grants, from
// AccessAbility letters, Special Consideration Requests and the instructor,
// which until now lived in inboxes and roster notes.
//
// This is the RECORD, not the mechanism (20261009_deadline_extensions.sql):
// saving a row moves no deadline. A contribution's claim is reopened or
// extended on the claim; extra time on a test is set in the Lecture Lounge's
// Test tab. Staff marking a late contribution look here.

// The default "For" list (Field Guide contributions, quizzes, midterm, final).
// A course with other assessments supplies its own in courseFeatures.js
// (extensionItems); either way every key must be in deadline_extensions_item_check.
export const DEFAULT_ITEMS = [
  ['contribution_1', `Contribution 1 (green, due ${CONTRIBUTION_SLOTS[0].due})`],
  ['contribution_2', `Contribution 2 (amber, due ${CONTRIBUTION_SLOTS[1].due})`],
  ['contribution_3', `Contribution 3 (amber, due ${CONTRIBUTION_SLOTS[2].due})`],
  ['weekly_quiz', 'Weekly quiz'],
  ['midterm', 'Midterm'],
  ['final_exam', 'Final exam'],
  ['other', 'Other'],
]
// Every label any course uses, so a row always displays, whichever list made it.
const OTHER_LABELS = [
  ['term_test_1', 'Term Test 1'], ['term_test_2', 'Term Test 2'], ['practical', 'Practical assignment'],
  ['poster', 'Research poster and recording'], ['peer_review', 'Poster peer review'], ['final_paper', 'Final paper'],
]
const ITEM_LABEL = Object.fromEntries([...OTHER_LABELS, ...DEFAULT_ITEMS])
const BASES = [['accessibility', 'AccessAbility'], ['scr', 'SCR'], ['instructor', 'Instructor'], ['other', 'Other']]
const BASIS_LABEL = Object.fromEntries(BASES)
const STATUSES = ['approved', 'pending', 'declined']

const fmtDue = (iso) => iso
  ? new Date(iso).toLocaleString('en-CA', { timeZone: 'America/Toronto', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : 'not set'
// <input type="datetime-local"> works in the viewer's local time; staff are in
// Toronto, so this round-trips without a timezone library.
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const blankForm = (items) => ({ id: null, roster_id: '', item: items[0][0], item_detail: '', new_due: '', basis: 'accessibility', status: 'approved', note: '' })

export default function ExtensionsPage() {
  const { courseClient, staffEnrollments } = useOutletContext()
  const { courseCode } = useParams()
  const courses = useMemo(() => staffedCourses(staffEnrollments), [staffEnrollments])
  const course = useMemo(() => resolveCourse(courses, courseCode), [courses, courseCode])
  const courseId = course?.course_id
  const ITEMS = courseFeatures(courseCode).extensionItems ?? DEFAULT_ITEMS
  const EMPTY = blankForm(ITEMS)

  const [rows, setRows] = useState(undefined)
  const [roster, setRoster] = useState([])
  const [err, setErr] = useState(null)
  const [form, setForm] = useState(() => blankForm(courseFeatures(courseCode).extensionItems ?? DEFAULT_ITEMS))
  const [studentQuery, setStudentQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [filterItem, setFilterItem] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async () => {
    if (!courseId) return
    const { data, error } = await courseClient.rpc('list_deadline_extensions', { p_course_id: courseId })
    if (error) { setErr(error.message); setRows([]); return }
    setErr(null); setRows(data ?? [])
  }, [courseClient, courseId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!courseId) return
    courseClient.rpc('roster_admin', { p_course_id: courseId }).then(({ data }) => {
      setRoster((data ?? []).filter((r) => r.role !== 'observer')
        .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))))
    })
  }, [courseClient, courseId])

  // Student picker: type a name or student number, pick from the matches.
  const matches = useMemo(() => {
    const q = studentQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return roster.filter((r) => `${r.full_name} ${r.student_number} ${r.email}`.toLowerCase().includes(q)).slice(0, 8)
  }, [roster, studentQuery])
  const picked = roster.find((r) => r.id === form.roster_id)

  const shown = (rows ?? []).filter((r) => (!filterItem || r.item === filterItem) && (!filterStatus || r.status === filterStatus))
  const pendingCount = (rows ?? []).filter((r) => r.status === 'pending').length

  const save = async (e) => {
    e?.preventDefault()
    if (!form.roster_id) { setErr('Pick a student first.'); return }
    setBusy(true)
    const { error } = await courseClient.rpc('save_deadline_extension', {
      p_course_id: courseId, p_id: form.id, p_roster_id: form.roster_id, p_item: form.item,
      p_item_detail: form.item_detail, p_new_due: form.new_due ? new Date(form.new_due).toISOString() : null,
      p_basis: form.basis, p_status: form.status, p_note: form.note,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setForm(EMPTY); setStudentQuery(''); load()
  }

  const quickStatus = async (r, status) => {
    const { error } = await courseClient.rpc('save_deadline_extension', {
      p_course_id: courseId, p_id: r.id, p_roster_id: r.roster_id, p_item: r.item, p_item_detail: r.item_detail,
      p_new_due: r.new_due, p_basis: r.basis, p_status: status, p_note: r.note,
    })
    if (error) { setErr(error.message); return }
    load()
  }

  const remove = async (r) => {
    if (!window.confirm(`Delete the ${ITEM_LABEL[r.item]} extension for ${r.full_name}?`)) return
    const { error } = await courseClient.rpc('delete_deadline_extension', { p_course_id: courseId, p_id: r.id })
    if (error) { setErr(error.message); return }
    load()
  }

  const edit = (r) => {
    setForm({ id: r.id, roster_id: r.roster_id, item: r.item, item_detail: r.item_detail ?? '',
      new_due: toLocalInput(r.new_due), basis: r.basis, status: r.status, note: r.note ?? '' })
    setStudentQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!course) {
    return <Frame><h1 style={S.title}>Extensions</h1><p style={S.sub}>No course called “{courseCode}” in your staffed courses.</p></Frame>
  }

  return (
    <Frame>
      <h1 style={S.title}>{course.courses?.code} · extensions</h1>
      <p style={S.sub}>
        Every deadline extension the course has granted, with its basis. This is the record: saving a row moves no
        deadline. Reopen or extend a contribution on the student's claim, and set extra time for a test in the
        Lecture Lounge's Test tab. Times are Toronto time.
      </p>

      <form onSubmit={save} style={S.card}>
        <p style={S.cardTitle}>{form.id ? 'Edit extension' : 'Add an extension'}</p>
        <div style={S.grid}>
          <label style={S.field}>Student
            {picked
              ? <span style={S.pickedRow}>
                  <span>{picked.full_name} <span style={S.email}>{picked.student_number}</span></span>
                  <button type="button" style={S.linkBtn} onClick={() => setForm((f) => ({ ...f, roster_id: '' }))}>change</button>
                </span>
              : <>
                  <input style={S.input} value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)}
                         placeholder="Name or student number" />
                  {matches.length > 0 && (
                    <span style={S.matchList}>
                      {matches.map((m) => (
                        <button type="button" key={m.id} style={S.matchBtn}
                                onClick={() => { setForm((f) => ({ ...f, roster_id: m.id })); setStudentQuery('') }}>
                          {m.full_name} <span style={S.email}>{m.student_number}</span>
                        </button>
                      ))}
                    </span>
                  )}
                </>}
          </label>
          <label style={S.field}>For
            <select style={S.input} value={form.item} onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}>
              {ITEMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label style={S.field}>Detail <span style={S.dim}>(e.g. Quiz 4, Practical 3)</span>
            <input style={S.input} value={form.item_detail} onChange={(e) => setForm((f) => ({ ...f, item_detail: e.target.value }))} />
          </label>
          <label style={S.field}>New due date
            <input style={S.input} type="datetime-local" value={form.new_due}
                   onChange={(e) => setForm((f) => ({ ...f, new_due: e.target.value }))} />
          </label>
          <label style={S.field}>Basis
            <select style={S.input} value={form.basis} onChange={(e) => setForm((f) => ({ ...f, basis: e.target.value }))}>
              {BASES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label style={S.field}>Status
            <select style={S.input} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label style={S.field}>Note <span style={S.dim}>(what it's for, what was done, e.g. "claim reopened to Oct 15")</span>
          <textarea style={{ ...S.input, minHeight: 64 }} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </label>
        <div style={S.actions}>
          <button type="submit" style={S.primary} disabled={busy || !courseId}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Add extension'}</button>
          {form.id && <button type="button" style={S.btn} onClick={() => { setForm(EMPTY); setStudentQuery('') }}>Cancel</button>}
        </div>
      </form>

      {err && <p style={S.error}>{err}</p>}

      <div style={S.toolbar}>
        <span style={S.count}>
          {rows === undefined ? 'Loading…' : `${shown.length} of ${rows.length} extensions`}
          {pendingCount > 0 && <span style={S.hot}> · {pendingCount} pending</span>}
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <select style={S.filter} value={filterItem} onChange={(e) => setFilterItem(e.target.value)}>
            <option value="">All items</option>
            {ITEMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select style={S.filter} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead><tr>
            {['Student', 'For', 'New due', 'Basis', 'Status', 'Note', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td style={S.td}>{r.full_name}<div style={S.email}>{r.student_number} · {r.email}</div></td>
                <td style={S.td}>{ITEM_LABEL[r.item]}{r.item_detail ? <div style={S.email}>{r.item_detail}</div> : null}</td>
                <td style={S.td}>{fmtDue(r.new_due)}</td>
                <td style={S.td}>{BASIS_LABEL[r.basis]}</td>
                <td style={S.td}>
                  <select style={S.statusSel(r.status)} value={r.status} onChange={(e) => quickStatus(r, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ ...S.td, maxWidth: 360 }}>{r.note}
                  <div style={S.email}>
                    {r.created_by_name ? `recorded by ${r.created_by_name}` : 'recorded'}
                    {r.updated_by_name ? ` · edited by ${r.updated_by_name}` : ''}
                  </div>
                </td>
                <td style={S.td}>
                  <button style={S.linkBtn} onClick={() => edit(r)}>edit</button>{' '}
                  <button style={S.linkBtn} onClick={() => remove(r)}>delete</button>
                </td>
              </tr>
            ))}
            {rows !== undefined && shown.length === 0 && (
              <tr><td style={S.td} colSpan={7}><span style={S.dim}>No extensions{filterItem || filterStatus ? ' match these filters' : ' yet'}.</span></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ ...S.sub, marginTop: 16 }}>
        See also: <Link to={courseSubPath(courseCode, 'tracking')} style={S.link}>Tracking</Link> ·{' '}
        <Link to={courseSubPath(courseCode, 'roster')} style={S.link}>Roster</Link>
      </p>
    </Frame>
  )
}

function Frame({ children }) {
  const { courseClient, session, isStaff } = useOutletContext()
  const { courseCode } = useParams()
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AcademicHeaderRow menu={<AvatarMenu client={courseClient} fgEmail={session.user.email} courseCode={courseCode} isStaff={isStaff} />}>
          <AcademicEyebrow to="/academic/fieldguide" suffix=" · staff" />
        </AcademicHeaderRow>
        {children}
      </div>
    </div>
  )
}

const S = {
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 760, marginBottom: 16 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 8px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--tx)', marginBottom: 8, position: 'relative' },
  input: { padding: 8, borderRadius: 12, border: '1px solid var(--bds)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--tx)' },
  pickedRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, border: '1px solid var(--bd)' },
  matchList: { display: 'flex', flexDirection: 'column', border: '1px solid var(--bd)', borderRadius: 12, background: 'var(--bgc)', overflow: 'hidden' },
  matchBtn: { textAlign: 'left', padding: 8, border: 'none', borderBottom: '1px solid var(--bd)', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--tx)', fontFamily: 'inherit' },
  actions: { display: 'flex', gap: 8, marginTop: 8 },
  primary: { fontFamily: MONO, fontSize: 12, padding: '8px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  btn: { fontFamily: MONO, fontSize: 12, padding: '8px 16px', borderRadius: 24, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },
  linkBtn: { border: 'none', background: 'none', color: 'var(--pkd)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', padding: 0 },
  error: { fontSize: 14, color: 'var(--err-tx)' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 8 },
  count: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  filter: { padding: '4px 8px', borderRadius: 12, border: '1px solid var(--bds)', fontSize: 12, fontFamily: MONO, background: 'var(--bgc)', color: 'var(--tx)' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12 },
  th: { textAlign: 'left', fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--tx2)', padding: '8px 16px', borderBottom: '2px solid var(--bd)' },
  td: { padding: '8px 16px', borderBottom: '1px solid var(--bd)', fontSize: 14, color: 'var(--tx)', verticalAlign: 'top' },
  email: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  dim: { color: 'var(--tx2)' },
  hot: { color: 'var(--pkd)', fontWeight: 700 },
  link: { color: 'var(--pkd)' },
  statusSel: (s) => ({
    padding: '4px 8px', borderRadius: 12, fontSize: 12, fontFamily: MONO, background: 'var(--bgc)',
    border: `1px solid ${s === 'pending' ? 'var(--pkd)' : 'var(--bds)'}`,
    color: s === 'pending' ? 'var(--pkd)' : s === 'declined' ? 'var(--tx2)' : 'var(--tx)',
  }),
}
