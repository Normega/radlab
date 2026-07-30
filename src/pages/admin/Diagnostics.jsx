import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── Diagnostics ───────────────────────────────────────────────────────────────
// Route: /admin/diagnostics — SUPER ADMINS ONLY. Sidebar link is hidden for
// non-supers; the real gate is admin_service_diagnostics() raising 'forbidden'
// (20260729_admin_service_diagnostics.sql).
//
// Exists because ripple-reminders-hourly 401-ed on every tick for 15 days and
// nothing noticed — a scheduled service that fails has no complainant. The
// ordering of this page reflects how much each signal can be trusted:
//
//   1. Scheduled jobs   — credential shape is STATIC and would have caught that
//                         bug on day one. Most trustworthy thing here.
//   2. Outcome checks   — durable app-table truth ("has a reminder ever been
//                         sent"). Slower to move, impossible to fake.
//   3. HTTP responses   — real status codes, but pg_net keeps only a few hours
//                         and strips the URL, so it is a short, partly
//                         unattributable window. Read last, believe least.
//
// Deliberately read-only. Nothing here retries, reschedules, or sends.

const VERDICT = {
  ok:    { label: 'OK',     bg: '#e8f5ec', fg: '#1c6b3a' },
  stale: { label: 'STALE',  bg: '#fdf3e0', fg: '#8a5a00' },
  error: { label: 'ERROR',  bg: '#fdeaea', fg: '#a32020' },
  off:   { label: 'OFF',    bg: '#eeeeee', fg: '#555555' },
}

function Badge({ verdict }) {
  const v = VERDICT[verdict] ?? VERDICT.off
  return <span style={{ ...S.badge, background: v.bg, color: v.fg }}>{v.label}</span>
}

function ago(iso) {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)    return `${hrs} h ago`
  return `${Math.floor(hrs / 24)} d ago`
}

function Stat({ label, value, tone }) {
  return (
    <div style={S.stat}>
      <span style={S.statLabel}>{label}</span>
      <span style={{ ...S.statValue, ...(tone === 'bad' ? { color: '#a32020' } : {}) }}>{value}</span>
    </div>
  )
}

export default function Diagnostics() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin_service_diagnostics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_service_diagnostics')
      if (error) throw error
      return data
    },
    retry: false,
    refetchOnWindowFocus: false,
  })

  if (isLoading) return <p style={S.muted}>Loading…</p>

  if (error) {
    const forbidden = String(error.message).includes('forbidden')
    return (
      <div>
        <h1 style={S.h1}>Diagnostics</h1>
        <p style={S.errBox}>
          {forbidden
            ? 'This page is available to super admins only.'
            : `Could not load diagnostics — has 20260729_admin_service_diagnostics.sql been applied? (${error.message})`}
        </p>
      </div>
    )
  }

  const { cron = [], http = {}, email = {}, ripple = {}, generated_at } = data ?? {}
  const worst = cron.some(j => j.verdict === 'error') ? 'error'
              : cron.some(j => j.verdict === 'stale') ? 'stale'
              : 'ok'

  return (
    <div>
      <div style={S.headRow}>
        <h1 style={S.h1}>Diagnostics</h1>
        <button style={S.refresh} onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p style={S.muted}>
        Read as of {new Date(generated_at).toLocaleString()}. Read-only — nothing here retries or sends.
      </p>

      {/* ── 1. Scheduled jobs ─────────────────────────────────────────────── */}
      <h2 style={S.h2}>
        Scheduled jobs {worst !== 'ok' && <Badge verdict={worst} />}
      </h2>
      {cron.length === 0 && <p style={S.muted}>No cron jobs found.</p>}
      {cron.map(j => (
        <div key={j.jobname} style={{ ...S.card, ...(j.verdict === 'error' ? S.cardBad : {}) }}>
          <div style={S.cardHead}>
            <span style={S.cardTitle}>{j.jobname}</span>
            <Badge verdict={j.verdict} />
          </div>
          <div style={S.grid}>
            <Stat label="Target"      value={j.target ?? '—'} />
            <Stat label="Schedule"    value={j.schedule} />
            <Stat label="Credential"  value={j.credential} tone={j.credential !== 'new-style' ? 'bad' : undefined} />
            <Stat label="Last fired"  value={ago(j.last_run_at)} />
            <Stat
              label="Last confirmed 2xx"
              value={j.has_signature ? ago(j.last_confirmed_2xx) : 'no signature'}
              tone={j.has_signature && !j.last_confirmed_2xx ? 'bad' : undefined}
            />
            <Stat label="Enqueue status" value={j.last_run_status ?? '—'} />
          </div>
          {j.note && <p style={S.note}>{j.note}</p>}
        </div>
      ))}
      <p style={S.footnote}>
        “Last fired” comes from <code>cron.job_run_details</code>, which records the <em>enqueue</em> —
        a job that fires and comes back 401 still logs <code>succeeded</code> there. “Last confirmed 2xx”
        is the real answer, but only within the short window below, and only for targets whose response
        body has a signature in <code>diag_signatures()</code>.
      </p>

      {/* ── 2. Durable outcome checks ─────────────────────────────────────── */}
      <h2 style={S.h2}>Outcomes</h2>
      <div style={S.card}>
        <div style={S.cardHead}><span style={S.cardTitle}>Participant email engine</span></div>
        <div style={S.grid}>
          <Stat label="Sent, 24 h"        value={email.sent_24h} />
          <Stat label="Failed, 24 h"      value={email.failed_24h} tone={email.failed_24h > 0 ? 'bad' : undefined} />
          <Stat label="Suppressed, 24 h"  value={email.suppressed_24h} />
          <Stat label="Sent, 7 d"         value={email.sent_7d} />
          <Stat label="Last send"         value={ago(email.last_sent_at)} />
          <Stat label="Links open now"    value={email.links_open} />
          <Stat label="Due today"         value={email.due_today_pending} />
          <Stat
            label="Overdue still pending"
            value={email.overdue_pending}
            tone={email.overdue_pending > 0 ? 'bad' : undefined}
          />
          <Stat label="Withdrawn residue" value={email.withdrawn_residue} />
        </div>
        <p style={S.note}>
          “Overdue still pending” is the canary. The send pass picks up any row dated
          <code> on or before today</code>, so a row that is still <code>pending</code> with a past date is
          one the engine hasn’t gotten to — above 0 means it has stopped, whatever the job table claims.
          Withdrawn enrollments are excluded and counted as “withdrawn residue” instead: pass 0c skips
          them forever by design and nothing ever sweeps a <code>pending</code> row, so that number only
          grows and means nothing is wrong.
        </p>
      </div>

      <div style={S.card}>
        <div style={S.cardHead}><span style={S.cardTitle}>Ripple reminders</span></div>
        <div style={S.grid}>
          <Stat label="Ripples"          value={ripple.total} />
          <Stat label="Reminders on"     value={ripple.reminders_on} />
          <Stat
            label="Ever reminded"
            value={ripple.ever_reminded}
            tone={ripple.reminders_on > 0 && ripple.ever_reminded === 0 ? 'bad' : undefined}
          />
          <Stat label="Reminded today"   value={ripple.reminded_today} />
          <Stat label="Last reminder"    value={ripple.last_reminder_any ?? 'never'} />
          <Stat label="Newest check-in"  value={ripple.newest_checkin ?? '—'} />
        </div>
        <p style={S.note}>
          Ripple reminders don’t write <code>message_log</code>, so this reads
          <code> ripples.last_reminder_sent_on</code> directly. “Ever reminded = 0 while reminders are on”
          is exactly the state that went unnoticed for 15 days.
        </p>
      </div>

      {/* ── 3. HTTP window ────────────────────────────────────────────────── */}
      <h2 style={S.h2}>
        Recent HTTP responses {http.non_2xx_count > 0 && <Badge verdict="error" />}
      </h2>
      <p style={S.footnote}>
        {http.retained_rows} rows retained, oldest {ago(http.oldest)} — pg_net prunes aggressively, so this
        is a window of hours, not history. Responses carry no URL (the queue row with the URL is deleted on
        completion), so attribution is by response-body shape; a 401 body is unattributable, which is why
        the count below is reported unattributed too.
      </p>
      {http.non_2xx_count > 0 && (
        <p style={S.errBox}>
          {http.non_2xx_count} non-2xx response{http.non_2xx_count === 1 ? '' : 's'} in the retained window.
        </p>
      )}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>When</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Attributed to</th>
              <th style={S.th}>Body</th>
            </tr>
          </thead>
          <tbody>
            {(http.rows ?? []).map((r, i) => (
              <tr key={i}>
                <td style={S.td}>{ago(r.created)}</td>
                <td style={{ ...S.td, color: r.status_code >= 200 && r.status_code < 300 ? '#1c6b3a' : '#a32020', fontWeight: 700 }}>
                  {r.status_code ?? r.error_msg ?? '—'}
                </td>
                <td style={S.td}>{r.target_guess ?? <span style={S.muted}>unattributed</span>}</td>
                <td style={{ ...S.td, fontFamily: '"Space Mono",monospace', fontSize: 11 }}>{r.snippet}</td>
              </tr>
            ))}
            {(http.rows ?? []).length === 0 && (
              <tr><td style={S.td} colSpan={4}><span style={S.muted}>No responses retained.</span></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const S = {
  h1:        { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, color: 'var(--tx)', margin: 0 },
  h2:        { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--tx)', margin: '28px 0 10px', display: 'flex', alignItems: 'center', gap: 8 },
  headRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  refresh:   { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--bd)', background: '#fff', color: 'var(--tx2)', cursor: 'pointer' },
  muted:     { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, color: 'var(--tx3)' },
  footnote:  { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 12, color: 'var(--tx3)', lineHeight: 1.55, margin: '8px 0 0' },
  note:      { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 12, color: 'var(--tx2)', lineHeight: 1.55, margin: '10px 0 0', paddingTop: 10, borderTop: '1px solid var(--bd)' },
  errBox:    { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, color: '#a32020', background: '#fdeaea', border: '1px solid #f3c9c9', borderRadius: 8, padding: '10px 12px' },
  card:      { border: '1px solid var(--bd)', borderRadius: 12, background: '#fff', padding: '14px 16px', marginBottom: 12 },
  cardBad:   { borderColor: '#f3c9c9' },
  cardHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  cardTitle: { fontFamily: '"Space Mono",monospace', fontSize: 13, fontWeight: 700, color: 'var(--tx)' },
  badge:     { fontFamily: '"Space Mono",monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 999 },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px 16px' },
  stat:      { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  statLabel: { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--bd)', borderRadius: 12, background: '#fff' },
  table:     { width: '100%', borderCollapse: 'collapse', minWidth: 520 },
  th:        { textAlign: 'left', fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 12px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' },
  td:        { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, color: 'var(--tx)', padding: '9px 12px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top' },
}
