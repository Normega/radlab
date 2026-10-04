// Study reports: look up one participant by SONA ID, study ID or email and see
// where they are; and a study-level report of enrollment and progress.
//
// A study's recruitment routes are separate studies linked by parent_study_id
// (Liliana Study 3 and Liliana Study 3 — Paid), so this page reads the whole
// family and reports each route alongside the total. Everything is computed in
// the browser from rows lab members can already read (studyProgress.js);
// nothing here writes.
import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fetchAllRows } from '../../lib/fetchAllRows'
import { participantProgress, summarize, lookup, ROUTE_LABEL, PHASE_DAYS } from '../../lib/studyProgress'

const TZ = 'America/Toronto'
const todayLab = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const fmtDT = (s) => (s ? new Date(s).toLocaleString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
const fmtD = (s) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', weekday: 'short' }) : '—')
const routeLabel = (r) => ROUTE_LABEL[r] ?? r ?? 'other'

const SCREENER_LABEL = {
  pass: 'Eligible', fail_phase1: 'Failed criteria', fail_low: 'Scores below range', fail_high: 'Scores above range', fail: 'Not eligible', none: 'Not screened',
}
const STANDING_LABEL = {
  met: 'Met (10+ done)', on_track: 'On track', no_more_misses: 'No more misses allowed', cannot_reach: 'Cannot reach 10/12', 'n/a': '—',
}
const CONDITION_LABEL = { feedback_choice: 'Choice + Feedback', control_choice: 'Choice', control_assigned: 'Assigned' }

function useFamilyData(id) {
  return useQuery({
    queryKey: ['study-reports', id],
    queryFn: async () => {
      const { data: me, error } = await supabase.from('studies').select('id, name, parent_study_id').eq('id', id).single()
      if (error) throw error
      const rootId = me.parent_study_id ?? me.id
      const { data: fam, error: famErr } = await supabase
        .from('studies').select('id, name, parent_study_id, compensation_kind')
        .or(`id.eq.${rootId},parent_study_id.eq.${rootId}`)
      if (famErr) throw famErr
      const ids = fam.map((s) => s.id)

      const [enrollments, schedule, sessions, screens, draws] = await Promise.all([
        fetchAllRows(() => supabase.from('study_enrollments')
          .select('id, study_id, profile_id, external_id, external_source, external_meta, status, enrolled_at, consent_date, contact_email, withdrawal_reason, is_test')
          .in('study_id', ids)),
        fetchAllRows(() => supabase.from('participant_schedule')
          .select('id, participant_id, study_id, study_session_id, study_day, scheduled_date, send_time, status, completed_at, last_sent_at')
          .in('study_id', ids)),
        fetchAllRows(() => supabase.from('study_sessions').select('id, node_key, label').in('study_id', ids)),
        fetchAllRows(() => supabase.from('screener_results')
          .select('id, participant_id, study_id, phase1_passed, phase2_passed, phase2_outcome, screened_at, resubmission_of')
          .in('study_id', ids)),
        fetchAllRows(() => supabase.from('participant_assignments')
          .select('id, participant_id, study_id, node_id, value')
          .in('study_id', ids).eq('node_id', 'midpoint_group')),
      ])
      return { me, fam, enrollments, schedule, sessions, screens, draws }
    },
  })
}

function buildPeople(d) {
  const key = (p, s) => `${p}:${s}`
  const rowsBy = new Map(), screensBy = new Map(), drawBy = new Map()
  for (const r of d.schedule) { const k = key(r.participant_id, r.study_id); (rowsBy.get(k) ?? rowsBy.set(k, []).get(k)).push(r) }
  for (const r of d.screens) { const k = key(r.participant_id, r.study_id); (screensBy.get(k) ?? screensBy.set(k, []).get(k)).push(r) }
  for (const r of d.draws) drawBy.set(key(r.participant_id, r.study_id), r.value)
  const sessionKey = new Map(d.sessions.map((s) => [s.id, s]))
  const today = todayLab()
  return d.enrollments.map((e) => {
    const k = key(e.profile_id, e.study_id)
    return participantProgress(e, rowsBy.get(k), sessionKey, screensBy.get(k), drawBy.get(k), today)
  })
}

function downloadCSV(people) {
  const cols = ['external_id', 'route', 'src', 'email', 'stage', 'status', 'screener', 'enrolled_at', 'consent_date',
    'p1_done', 'p1_missed', 'p1_open', 'p1_standing', 'mid_done', 'condition', 'p2_done', 'p2_missed', 'final_done',
    'next_session', 'next_date', 'last_activity', 'withdrawal_reason']
  const lines = people.map((p) => [
    p.external_id, routeLabel(p.route), p.src ?? '', p.email ?? '', p.stage, p.status, p.screener, p.enrolled_at, p.consent_date ?? '',
    p.p1.done, p.p1.missed, p.p1.open, p.p1Standing ?? '', p.midDone ? 'yes' : 'no', p.condition ?? '', p.p2.done, p.p2.missed,
    p.finalDone ? 'yes' : 'no', p.next?.label ?? '', p.next?.date ?? '', p.lastActivity ?? '', p.withdrawal_reason ?? '',
  ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([[cols.join(','), ...lines].join('\r\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `study_progress_${todayLab()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function StudyReportsPage() {
  const { id } = useParams()
  const { data, isLoading, error, refetch, isFetching } = useFamilyData(id)
  const [q, setQ] = useState('')
  const [includeTests, setIncludeTests] = useState(false)

  const peopleAll = useMemo(() => (data ? buildPeople(data) : []), [data])
  const people = useMemo(() => peopleAll.filter((p) => includeTests || !p.is_test), [peopleAll, includeTests])
  const summary = useMemo(() => summarize(people), [people])
  const matches = useMemo(() => lookup(peopleAll, q), [peopleAll, q])
  const studyName = (sid) => data?.fam.find((s) => s.id === sid)?.name ?? ''

  if (isLoading) return <p style={S.muted}>Loading…</p>
  if (error) return <p style={S.err}>Could not load the report: {error.message}</p>

  const routes = summary.routes
  const attention = people.filter((p) => p.consented && (p.p1Standing === 'cannot_reach' || p.p1Standing === 'no_more_misses' || p.nextOverdue) && p.stage !== 'Withdrawn' && p.stage !== 'Completed')

  return (
    <div>
      <div style={S.header}>
        <div>
          <Link to={`/admin/studies/${id}`} style={S.back}>← {data.me.name}</Link>
          <h1 style={S.h1}>Reports</h1>
          <p style={S.sub}>
            {data.fam.length > 1 ? `Covers ${data.fam.map((s) => s.name).join(' and ')}.` : null} Computed from the live schedule;
            {' '}conditions are shown only after a participant’s midpoint (Phase 1 is blind to condition).
          </p>
        </div>
        <div style={S.headerBtns}>
          {/* The credit/payment worksheet is Liliana-shaped (get_liliana_credit_report). */}
          {data.sessions.some((s) => s.node_key?.startsWith('s_p1_')) && data.fam.map((s) => (
            <Link key={s.id} to={`/admin/studies/${s.id}/liliana-credit`} style={S.btnGhost}>
              {s.compensation_kind === 'pay' ? 'Payment report' : 'Credit report'}{data.fam.length > 1 ? ` (${s.compensation_kind === 'pay' ? 'paid' : 'SONA'})` : ''}
            </Link>
          ))}
          <button style={S.btnGhost} onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Refreshing…' : 'Refresh'}</button>
          <button style={S.btn} onClick={() => downloadCSV(people)}>Export CSV</button>
        </div>
      </div>

      {/* ── Lookup ───────────────────────────────────────────────────────── */}
      <section style={S.card}>
        <h2 style={S.h2}>Find a participant</h2>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="SONA ID (e.g. 19975), study ID (O-…), or email"
          style={S.input}
        />
        {q.trim() && matches.length === 0 && <p style={S.muted}>No one matches “{q.trim()}”. Screened-out participants never give an email, so search them by SONA ID.</p>}
        {matches.slice(0, 5).map((p) => <ParticipantCard key={p.enrollment_id} p={p} studyName={studyName(p.study_id)} />)}
        {matches.length > 5 && <p style={S.muted}>{matches.length - 5} more match; type more of the ID or email.</p>}
      </section>

      <label style={S.toggle}>
        <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} /> Include test enrollments
      </label>

      {/* ── Funnel ───────────────────────────────────────────────────────── */}
      <section style={S.card}>
        <h2 style={S.h2}>Enrollment funnel</h2>
        <Table
          head={['', 'Total', ...routes.map(routeLabel)]}
          rows={[
            ['Arrived', 'arrived'], ['Screened', 'screened'], ['Eligible', 'eligible'], ['Consented', 'consented'],
            ['Baseline done', 'baseline'], ['Midpoint done', 'midpoint'], ['Completed', 'completed'], ['Withdrawn (after consent)', 'withdrawn'],
          ].map(([label, k]) => [label, summary.funnel.all[k], ...routes.map((r) => summary.funnel[r][k])])}
        />
        <p style={S.note}>
          Eligibility rate: {pct(summary.funnel.all.eligible, summary.funnel.all.screened)} of those screened.
          {' '}Consent rate: {pct(summary.funnel.all.consented, summary.funnel.all.eligible)} of those eligible.
        </p>
      </section>

      <div style={S.grid}>
        <section style={S.card}>
          <h2 style={S.h2}>Where everyone is now</h2>
          <Table head={['Stage', 'n']} rows={summary.stages} />
        </section>
        <section style={S.card}>
          <h2 style={S.h2}>Screener outcomes</h2>
          <Table head={['Outcome', 'n']} rows={Object.entries(summary.screener).map(([k, n]) => [SCREENER_LABEL[k] ?? k, n])} />
        </section>
        <section style={S.card}>
          <h2 style={S.h2}>Phase 1 adherence (in Phase 1)</h2>
          <Table head={['Standing', 'n']} rows={['on_track', 'no_more_misses', 'cannot_reach', 'met'].filter((k) => summary.p1Standing[k]).map((k) => [STANDING_LABEL[k], summary.p1Standing[k]])} />
          <p style={S.note}>Below 10 of {PHASE_DAYS} ends participation after Phase 1.</p>
        </section>
        <section style={S.card}>
          <h2 style={S.h2}>Phase 2 conditions (allocated)</h2>
          {Object.keys(summary.conditions).length === 0
            ? <p style={S.muted}>No one has reached the midpoint yet.</p>
            : <Table head={['Route', 'Condition', 'n']} rows={Object.entries(summary.conditions).map(([k, n]) => { const [r, c] = k.split('|'); return [routeLabel(r), CONDITION_LABEL[c] ?? c, n] })} />}
        </section>
      </div>

      <section style={S.card}>
        <h2 style={S.h2}>Needs attention ({attention.length})</h2>
        {attention.length === 0 ? <p style={S.muted}>No consented participant is overdue or at risk on Phase 1.</p> : (
          <Table
            head={['ID', 'Route', 'Stage', 'Phase 1', 'Standing', 'Next session', 'Last activity']}
            rows={attention.map((p) => [
              <button key="b" style={S.linkBtn} onClick={() => { setQ(p.external_id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{p.external_id}</button>,
              routeLabel(p.route), p.stage, `${p.p1.done}/${p.p1.total || PHASE_DAYS} (${p.p1.missed} missed)`,
              STANDING_LABEL[p.p1Standing ?? 'n/a'],
              p.next ? `${p.next.label}, ${fmtD(p.next.date)}${p.nextOverdue ? ' — overdue' : ''}` : '—',
              fmtDT(p.lastActivity),
            ])}
          />
        )}
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>By week of arrival</h2>
        <Table head={['Week of', 'Arrived', 'Eligible', 'Consented']} rows={summary.byWeek.map((w) => [fmtD(w.week), w.arrived, w.eligible, w.consented])} />
      </section>
    </div>
  )
}

function pct(a, b) { return b ? `${Math.round((100 * a) / b)}% (${a}/${b})` : '—' }

function ParticipantCard({ p, studyName }) {
  return (
    <div style={S.pCard}>
      <div style={S.pHead}>
        <div>
          <span style={S.pId}>{p.external_id}</span>
          <span style={S.chip}>{routeLabel(p.route)}</span>
          {p.is_test && <span style={S.chip}>test</span>}
          <div style={S.pMeta}>{studyName}{p.email ? ` · ${p.email}` : ''}</div>
        </div>
        <div style={S.pStage}>{p.stage}</div>
      </div>
      <div style={S.facts}>
        <Fact k="Signed up" v={fmtDT(p.enrolled_at)} />
        <Fact k="Screener" v={SCREENER_LABEL[p.screener] ?? p.screener} />
        <Fact k="Consented" v={p.consent_date ? fmtDT(p.consent_date) : 'No'} />
        <Fact k="Phase 1" v={p.p1.total ? `${p.p1.done}/${p.p1.total} done, ${p.p1.missed} missed` : '—'} />
        <Fact k="Standing" v={STANDING_LABEL[p.p1Standing ?? 'n/a']} />
        <Fact k="Midpoint" v={p.midDone ? 'Done' : 'Not yet'} />
        <Fact k="Condition" v={p.midDone ? (CONDITION_LABEL[p.condition] ?? p.condition ?? '—') : 'Allocated at midpoint'} />
        <Fact k="Phase 2" v={p.p2.total ? `${p.p2.done}/${p.p2.total} done, ${p.p2.missed} missed` : '—'} />
        <Fact k="Next" v={p.next ? `${p.next.label}, ${fmtD(p.next.date)}${p.nextOverdue ? ' (overdue)' : ''}` : '—'} />
        <Fact k="Last activity" v={fmtDT(p.lastActivity)} />
        {p.withdrawal_reason && <Fact k="Withdrawal" v={p.withdrawal_reason} />}
      </div>
      {p.timeline.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={S.summary}>Session timeline ({p.timeline.length})</summary>
          <Table
            head={['Day', 'Date', 'Session', 'Status', 'Completed']}
            rows={p.timeline.map((t) => [t.day ?? '', fmtD(t.date), t.label, t.status, t.completed_at ? fmtDT(t.completed_at) : ''])}
          />
        </details>
      )}
    </div>
  )
}

function Fact({ k, v }) {
  return <div style={S.fact}><div style={S.factK}>{k}</div><div style={S.factV}>{v}</div></div>
}

function Table({ head, rows }) {
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead><tr>{head.map((h, i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} style={S.tr}>{r.map((c, j) => <td key={j} style={S.td}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

const FONT = '"DM Sans",system-ui,sans-serif'
const MONO = '"Space Mono",monospace'
const S = {
  header:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  headerBtns:{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  back:      { fontSize: 14, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  h1:        { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  h2:        { fontFamily: FONT, fontSize: 15, fontWeight: 700, color: 'var(--tx)', margin: '0 0 12px' },
  sub:       { fontSize: 14, color: 'var(--tx2)', margin: 0, maxWidth: 680, lineHeight: 1.6 },
  card:      { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '18px 20px', marginBottom: 16 },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 0 },
  input:     { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, fontFamily: FONT, border: '1px solid var(--bd)', borderRadius: 8, marginBottom: 10 },
  toggle:    { display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--tx2)', fontFamily: FONT, margin: '0 0 12px' },
  btn:       { background: 'var(--pkd)', color: '#fff', border: '1px solid var(--pk)', borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT },
  btnGhost:  { background: '#fff', color: 'var(--tx)', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, textDecoration: 'none' },
  linkBtn:   { background: 'none', border: 'none', padding: 0, color: 'var(--pkd, var(--pkd))', fontFamily: MONO, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' },
  muted:     { fontSize: 14, color: 'var(--tx3)', fontFamily: FONT, margin: '4px 0' },
  note:      { fontSize: 13, color: 'var(--tx2)', fontFamily: FONT, margin: '10px 0 0' },
  err:       { fontSize: 14, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px' },
  tableWrap: { overflowX: 'auto', borderRadius: 8, border: '1px solid var(--bd)' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', background: 'var(--bg, #fafafa)' },
  tr:        { borderBottom: '1px solid var(--bd)' },
  td:        { padding: '8px 12px', fontSize: 14, fontFamily: FONT, color: 'var(--tx)', verticalAlign: 'top' },
  pCard:     { border: '1px solid var(--bd)', borderRadius: 10, padding: 16, marginTop: 10, background: 'var(--bg, #fdfafc)' },
  pHead:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  pId:       { fontFamily: MONO, fontSize: 18, fontWeight: 700, color: 'var(--tx)', marginRight: 8 },
  pMeta:     { fontSize: 13, color: 'var(--tx2)', fontFamily: FONT, marginTop: 4 },
  pStage:    { fontFamily: FONT, fontSize: 15, fontWeight: 700, color: 'var(--pkd, var(--pkd))' },
  chip:      { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '1px 6px', marginRight: 6, background: '#fff' },
  facts:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px 16px', marginTop: 12 },
  fact:      {},
  factK:     { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  factV:     { fontFamily: FONT, fontSize: 14, color: 'var(--tx)', marginTop: 2 },
  summary:   { cursor: 'pointer', fontFamily: FONT, fontSize: 14, color: 'var(--tx2)', marginBottom: 8 },
}
