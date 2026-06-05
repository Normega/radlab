import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── CSV helpers ──────────────────────────────────────────────────────────────

function toCsv(rows) {
  if (!rows.length) return ''
  // Collect all unique keys across every row so sparse rows (e.g. different
  // questionnaires with disjoint item sets) still get their columns included.
  const colSet = new Set()
  for (const r of rows) Object.keys(r).forEach(k => colSet.add(k))
  const cols = [...colSet]
  const escape = v => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n')
}

function downloadCsv(filename, rows) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Participant search ────────────────────────────────────────────────────────
// Queries belt_sessions.participant_external_id AND study_enrollments.external_id
// in parallel, merges by external_id. belt data is keyed by external_id directly;
// questionnaire data uses profile_id from study_enrollments (preferred) or
// belt_sessions.user_id as a fallback.

function useParticipantSearch(q) {
  return useQuery({
    queryKey: ['export-search', q],
    enabled: q.length >= 1,
    staleTime: 30_000,
    queryFn: async () => {
      const [beltRes, enrollRes] = await Promise.all([
        supabase
          .from('belt_sessions')
          .select('participant_external_id, user_id')
          .ilike('participant_external_id', `%${q}%`)
          .not('participant_external_id', 'is', null)
          .limit(30),
        supabase
          .from('study_enrollments')
          .select('external_id, profile_id, studies!study_id(name)')
          .ilike('external_id', `%${q}%`)
          .limit(30),
      ])

      const byId = {}

      for (const b of beltRes.data ?? []) {
        const eid = b.participant_external_id
        if (!byId[eid]) byId[eid] = { externalId: eid, profileId: b.user_id, studies: [] }
      }
      for (const e of enrollRes.data ?? []) {
        const eid = e.external_id
        if (!byId[eid]) byId[eid] = { externalId: eid, profileId: e.profile_id, studies: [] }
        // Trust enrollment for profileId (authoritative over belt user_id)
        byId[eid].profileId = e.profile_id
        const name = e.studies?.name
        if (name && !byId[eid].studies.includes(name)) byId[eid].studies.push(name)
      }

      return Object.values(byId).sort((a, b) => a.externalId.localeCompare(b.externalId))
    },
  })
}

// ── Data hooks ───────────────────────────────────────────────────────────────

function useBeltSessions(externalId) {
  return useQuery({
    queryKey: ['export-belt-sessions', externalId],
    enabled: !!externalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('belt_sessions')
        .select('id, session_id, created_at, session_number, calib_model_label, calib_fit_r, calib_lag_ms, trigger_device, storage_path, baseline_period_ms, post_baseline_period_ms, thresh_faster_log10, thresh_slower_log10, thresh_sd_faster, thresh_sd_slower, session_start_epoch_ms, phase2_start_ms, phase2_end_ms, phase3_start_ms, phase3_end_ms')
        .eq('participant_external_id', externalId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

function useBeltTrials(externalId) {
  return useQuery({
    queryKey: ['export-belt-trials', externalId],
    enabled: !!externalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('belt_trials')
        .select('session_id, phase, trial_number, condition, breath_period_ms, log10_mag, proportion_mag, response, correct, same_context, confidence, arousal, response_rt_ms, belt_sync_mean, bt_baseline_period_ms, bt_condition_period_ms, trial_r_baseline, trial_r_condition, peak_error_ms, trial_onset_ms, condition_onset_ms, trial_end_ms, created_at')
        .eq('participant_external_id', externalId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

function useDemographics(profileId) {
  return useQuery({
    queryKey: ['export-demographics', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demographics')
        .select('age, gender, racialized, ses_ladder, enrollment_id, schedule_id, completed_at')
        .eq('user_id', profileId)
        .order('completed_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

function useQResponses(profileId) {
  return useQuery({
    queryKey: ['export-q-responses', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('id, questionnaire_slug, responses, completed_at')
        .eq('user_id', profileId)
        .order('completed_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function fmt(v, decimals = 2) {
  if (v == null) return '—'
  return typeof v === 'number' ? v.toFixed(decimals) : String(v)
}

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' })
}

function fitColor(r) {
  if (r == null) return 'var(--tx3)'
  if (r >= 0.7)  return '#16a34a'
  if (r >= 0.4)  return '#d97706'
  return '#dc2626'
}

function SectionHeader({ title, count, onDownload, disabled }) {
  return (
    <div style={S.sectionHead}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={S.sectionTitle}>{title}</span>
        {count != null && <span style={S.sectionCount}>{count} rows</span>}
      </div>
      <button style={{ ...S.csvBtn, opacity: disabled ? 0.4 : 1 }} onClick={onDownload} disabled={disabled}>
        ↓ CSV
      </button>
    </div>
  )
}

// ── Belt Sessions section ────────────────────────────────────────────────────

function BeltSessionsSection({ externalId }) {
  const { data = [], isLoading } = useBeltSessions(externalId)

  return (
    <section style={S.section}>
      <SectionHeader
        title="BreathBelt Sessions"
        count={isLoading ? null : data.length}
        onDownload={() => downloadCsv(`belt_sessions_${externalId}.csv`, data)}
        disabled={isLoading || data.length === 0}
      />
      {isLoading ? (
        <p style={S.msg}>Loading…</p>
      ) : data.length === 0 ? (
        <p style={S.msg}>No sessions found.</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Date', 'Sess #', 'Calib model', 'Fit R', 'Lag ms', 'Trigger', 'BL period ms', 'Post BL ms', 'Thresh fast', 'Thresh slow', 'Session ID'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} style={S.tr}>
                  <td style={S.td}>{fmtDate(row.created_at)}</td>
                  <td style={S.tdMono}>{row.session_number ?? '—'}</td>
                  <td style={S.tdMono}>{row.calib_model_label ?? '—'}</td>
                  <td style={{ ...S.tdMono, color: fitColor(row.calib_fit_r) }}>{fmt(row.calib_fit_r)}</td>
                  <td style={S.tdMono}>{fmt(row.calib_lag_ms, 0)}</td>
                  <td style={S.tdMono}>{row.trigger_device ?? '—'}</td>
                  <td style={S.tdMono}>{row.baseline_period_ms != null ? Math.round(row.baseline_period_ms) : '—'}</td>
                  <td style={S.tdMono}>{row.post_baseline_period_ms != null ? Math.round(row.post_baseline_period_ms) : '—'}</td>
                  <td style={S.tdMono}>{fmt(row.thresh_faster_log10)}</td>
                  <td style={S.tdMono}>{fmt(row.thresh_slower_log10)}</td>
                  <td style={S.tdMono}>{row.session_id?.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Belt Trials section ──────────────────────────────────────────────────────

const TRIAL_COLS = [
  { key: 'session_id',            label: 'Session',      render: v => v ? v.slice(0, 8) + '…' : '—' },
  { key: 'phase',                 label: 'Ph',           render: v => v },
  { key: 'trial_number',          label: '#',            render: v => v },
  { key: 'condition',             label: 'Condition',    render: v => v ?? '—' },
  { key: 'same_context',          label: 'Same ctx',     render: v => v ?? '—' },
  { key: 'breath_period_ms',      label: 'Period ms',    render: v => v != null ? Math.round(v) : '—' },
  { key: 'log10_mag',             label: 'log10 mag',    render: v => fmt(v) },
  { key: 'proportion_mag',        label: 'Prop mag',     render: v => fmt(v) },
  { key: 'response',              label: 'Response',     render: v => v ?? '—' },
  { key: 'correct',               label: 'Correct',      render: v => v == null ? '—' : v ? '✓' : '✗' },
  { key: 'confidence',            label: 'Conf',         render: v => v ?? '—' },
  { key: 'arousal',               label: 'Arousal',      render: v => v ?? '—' },
  { key: 'response_rt_ms',        label: 'RT ms',        render: v => v ?? '—' },
  { key: 'belt_sync_mean',        label: 'Sync',         render: v => fmt(v) },
  { key: 'bt_baseline_period_ms', label: 'BT BL ms',     render: v => v != null ? Math.round(v) : '—' },
  { key: 'bt_condition_period_ms',label: 'BT cond ms',   render: v => v != null ? Math.round(v) : '—' },
  { key: 'trial_r_baseline',      label: 'R base',       render: v => fmt(v) },
  { key: 'trial_r_condition',     label: 'R cond',       render: v => fmt(v) },
  { key: 'peak_error_ms',         label: 'Peak err ms',  render: v => fmt(v, 0) },
]

function BeltTrialsSection({ externalId }) {
  const { data = [], isLoading } = useBeltTrials(externalId)

  return (
    <section style={S.section}>
      <SectionHeader
        title="BreathBelt Trials"
        count={isLoading ? null : data.length}
        onDownload={() => downloadCsv(`belt_trials_${externalId}.csv`, data)}
        disabled={isLoading || data.length === 0}
      />
      {isLoading ? (
        <p style={S.msg}>Loading…</p>
      ) : data.length === 0 ? (
        <p style={S.msg}>No trials found.</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>{TRIAL_COLS.map(c => <th key={c.key} style={S.th}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} style={S.tr}>
                  {TRIAL_COLS.map(c => (
                    <td key={c.key} style={S.tdMono}>{c.render(row[c.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Questionnaires section ───────────────────────────────────────────────────

function QuestionnairesSection({ profileId, externalId }) {
  const { data = [], isLoading } = useQResponses(profileId)

  function dlQuestionnaires() {
    const flat = data.map(r => ({
      questionnaire_slug: r.questionnaire_slug,
      completed_at:       r.completed_at,
      ...Object.fromEntries(
        Object.entries(r.responses ?? {}).map(([k, v]) => [`item_${k}`, v])
      ),
    }))
    downloadCsv(`questionnaire_responses_${externalId}.csv`, flat)
  }

  return (
    <section style={S.section}>
      <SectionHeader
        title="Questionnaire Responses"
        count={isLoading ? null : data.length}
        onDownload={dlQuestionnaires}
        disabled={isLoading || data.length === 0}
      />
      {isLoading ? (
        <p style={S.msg}>Loading…</p>
      ) : !profileId ? (
        <p style={S.msg}>No study enrollment found — questionnaire lookup requires an enrollment record.</p>
      ) : data.length === 0 ? (
        <p style={S.msg}>No questionnaire responses found.</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Questionnaire', 'Completed', 'Items answered'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} style={S.tr}>
                  <td style={S.tdMono}>{row.questionnaire_slug}</td>
                  <td style={S.td}>{fmtDate(row.completed_at)}</td>
                  <td style={S.tdMono}>{Object.keys(row.responses ?? {}).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Demographics section ─────────────────────────────────────────────────────

function DemographicsSection({ profileId, externalId }) {
  const { data = [], isLoading } = useDemographics(profileId)

  return (
    <section style={S.section}>
      <SectionHeader
        title="Demographics"
        count={isLoading ? null : data.length}
        onDownload={() => downloadCsv(`demographics_${externalId}.csv`, data)}
        disabled={isLoading || data.length === 0}
      />
      {isLoading ? (
        <p style={S.msg}>Loading…</p>
      ) : !profileId ? (
        <p style={S.msg}>No study enrollment found — demographics lookup requires an enrollment record.</p>
      ) : data.length === 0 ? (
        <p style={S.msg}>No demographics found.</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Age', 'Gender', 'Racialized', 'SES ladder', 'Completed'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} style={S.tr}>
                  <td style={S.tdMono}>{row.age ?? '—'}</td>
                  <td style={S.td}>{row.gender ?? '—'}</td>
                  <td style={S.tdMono}>{row.racialized ?? '—'}</td>
                  <td style={S.tdMono}>{row.ses_ladder ?? '—'}</td>
                  <td style={S.td}>{fmtDate(row.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DataExportPage() {
  const [search,          setSearch]          = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected,        setSelected]        = useState(null) // { externalId, profileId }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: results = [] } = useParticipantSearch(debouncedSearch)
  const showDropdown = debouncedSearch.length >= 1 && !selected && results.length > 0

  function pick(p) {
    setSelected(p)
    setSearch(p.externalId)
  }

  function clear() {
    setSearch('')
    setSelected(null)
  }

  return (
    <div>
      <h1 style={S.h1}>Export Data</h1>
      <p style={S.sub}>Search by participant ID to export BreathBelt and questionnaire data as CSV.</p>

      <div style={S.searchWrap}>
        <input
          style={S.searchInput}
          placeholder="Participant ID (e.g. 1990)"
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null) }}
          autoComplete="off"
          spellCheck={false}
        />
        {search && (
          <button style={S.clearBtn} onClick={clear} aria-label="Clear">✕</button>
        )}
        {showDropdown && (
          <div style={S.dropdown}>
            {results.map(p => (
              <button key={p.externalId} style={S.dropItem} onClick={() => pick(p)}>
                <span style={S.dropId}>{p.externalId}</span>
                {p.studies.length > 0 && (
                  <span style={S.dropStudies}>{p.studies.join(' · ')}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <>
          <p style={S.badge}>
            Participant <strong style={{ fontFamily: '"Space Mono",monospace' }}>{selected.externalId}</strong>
          </p>
          <DemographicsSection   externalId={selected.externalId} profileId={selected.profileId} />
          <BeltSessionsSection   externalId={selected.externalId} />
          <BeltTrialsSection     externalId={selected.externalId} />
          <QuestionnairesSection externalId={selected.externalId} profileId={selected.profileId} />
        </>
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  h1: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px',
  },
  sub: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 28px', fontFamily: '"DM Sans",system-ui,sans-serif' },

  searchWrap:  { position: 'relative', maxWidth: 420, marginBottom: 24 },
  searchInput: {
    width: '100%', padding: '10px 36px 10px 14px', boxSizing: 'border-box',
    border: '1px solid var(--bd)', borderRadius: 10,
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: 'var(--tx)',
    background: '#fff', outline: 'none',
  },
  clearBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', fontSize: 14, padding: 2,
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
    background: '#fff', border: '1px solid var(--bd)', borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden',
  },
  dropItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
    width: '100%', padding: '10px 14px', textAlign: 'left',
    background: 'none', border: 'none', borderBottom: '1px solid var(--bd)',
    cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  dropId:     { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx)' },
  dropStudies:{ fontSize: 12, color: 'var(--tx3)' },

  badge: {
    fontSize: 14, color: 'var(--tx2)',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    margin: '0 0 20px',
  },

  section:     { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },
  sectionHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '1px solid var(--bd)',
  },
  sectionTitle:  { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--tx)' },
  sectionCount:  { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)' },
  csvBtn: {
    background: 'var(--pkb)', color: 'var(--pk)',
    border: '1px solid var(--pk)', borderRadius: 8,
    padding: '6px 14px', cursor: 'pointer',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, fontWeight: 500,
  },

  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    padding: '7px 12px', textAlign: 'left',
    fontFamily: '"Space Mono",monospace', fontSize: 10,
    color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--bd)', background: '#fafafa', whiteSpace: 'nowrap',
  },
  tr:     { borderBottom: '1px solid var(--bd)' },
  td:     { padding: '7px 12px', fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, color: 'var(--tx)', whiteSpace: 'nowrap' },
  tdMono: { padding: '7px 12px', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx)', whiteSpace: 'nowrap' },
  msg:    { padding: '16px 20px', margin: 0, fontSize: 13, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
}
