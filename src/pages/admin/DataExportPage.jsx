import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { zipSync, strToU8 } from 'fflate'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ── CSV helpers ──────────────────────────────────────────────────────────────

function toCsv(rows) {
  if (!rows.length) return ''
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

// Checklist-type questionnaire items store an object per response
// ({ response_value, item_weight, occurrence_count }); export the weighted
// score. Likert responses are plain numbers and pass through.
function responseScalar(v) {
  return (v && typeof v === 'object') ? v.response_value ?? JSON.stringify(v) : v
}

function downloadCsv(filename, rows) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Zip helpers ──────────────────────────────────────────────────────────────

function buildZip(files) {
  const zipObj = {}
  for (const f of files) zipObj[f.filename] = strToU8(f.content)
  return new Blob([zipSync(zipObj)], { type: 'application/zip' })
}

function downloadZip(zipFilename, files) {
  const blob = buildZip(files)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = zipFilename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Participant search ────────────────────────────────────────────────────────

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

function useStillWaterResponses(profileId) {
  return useQuery({
    queryKey: ['export-stillwater', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stillwater_responses')
        .select('pos_rating, pos_x, pos_y, neg_rating, neg_x, neg_y, composite_x, composite_y, composite_label, ambivalence_x, ambivalence_y, ambivalence_mag, created_at')
        .eq('user_id', profileId)
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

// ── Study-level hooks ─────────────────────────────────────────────────────────

function useStudies() {
  return useQuery({
    queryKey: ['export-studies'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studies')
        .select('id, name')
        .eq('delivery_mode', 'in_person')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

function useStudyEnrollments(studyId) {
  return useQuery({
    queryKey: ['export-study-enrollments', studyId],
    enabled: !!studyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_enrollments')
        .select('profile_id, external_id, enrolled_at, consent_date')
        .eq('study_id', studyId)
        .order('external_id')
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

// ── Tabular zip builder ───────────────────────────────────────────────────────

async function buildTabularZipFiles(enrollments) {
  const profileIds  = enrollments.map(e => e.profile_id)
  const externalIds = enrollments.map(e => e.external_id)

  const [demRows, swRows, sessRows, trialRows, qRows] = await Promise.all([
    supabase.from('demographics')
      .select('user_id, age, gender, racialized, ses_ladder, enrollment_id, schedule_id, completed_at')
      .in('user_id', profileIds).then(r => r.data ?? []),

    supabase.from('stillwater_responses')
      .select('user_id, pos_rating, neg_rating, composite_x, composite_y, composite_label, ambivalence_x, ambivalence_y, ambivalence_mag, created_at')
      .in('user_id', profileIds).order('created_at', { ascending: true }).then(r => r.data ?? []),

    supabase.from('belt_sessions')
      .select('id, session_id, user_id, participant_external_id, created_at, session_number, calib_model_label, calib_fit_r, calib_lag_ms, trigger_device, storage_path, baseline_period_ms, post_baseline_period_ms, thresh_faster_log10, thresh_slower_log10, thresh_sd_faster, thresh_sd_slower, session_start_epoch_ms, phase2_start_ms, phase2_end_ms, phase3_start_ms, phase3_end_ms')
      .in('participant_external_id', externalIds).then(r => r.data ?? []),

    supabase.from('belt_trials')
      .select('session_id, participant_external_id, phase, trial_number, condition, breath_period_ms, log10_mag, proportion_mag, response, correct, same_context, confidence, arousal, response_rt_ms, belt_sync_mean, bt_baseline_period_ms, bt_condition_period_ms, trial_r_baseline, trial_r_condition, peak_error_ms, trial_onset_ms, condition_onset_ms, trial_end_ms, created_at')
      .in('participant_external_id', externalIds).order('created_at', { ascending: true }).then(r => r.data ?? []),

    supabase.from('questionnaire_responses')
      .select('user_id, questionnaire_slug, responses, completed_at')
      .in('user_id', profileIds).order('completed_at', { ascending: true }).then(r => r.data ?? []),
  ])

  const enrollMap = {}
  for (const e of enrollments) enrollMap[e.profile_id] = e

  // demographics.csv
  const demCsv = toCsv(demRows.map(r => {
    const e = enrollMap[r.user_id] ?? {}
    return { participant_id: e.external_id, enrolled_at: e.enrolled_at, consent_date: e.consent_date, ...r, user_id: undefined }
  }))

  // stillwater.csv — first row = pre, second = post per participant
  const SW_FIELDS = ['pos_rating','neg_rating','composite_x','composite_y','composite_label','ambivalence_x','ambivalence_y','ambivalence_mag']
  const swByUser = {}
  for (const r of swRows) {
    if (!swByUser[r.user_id]) swByUser[r.user_id] = []
    swByUser[r.user_id].push(r)
  }
  const swCsv = toCsv(enrollments.map(e => {
    const rows = swByUser[e.profile_id] ?? []
    const pre  = rows[0] ?? {}
    const post = rows[1] ?? {}
    const out  = { participant_id: e.external_id }
    for (const f of SW_FIELDS) {
      out[`pre_${f}`]  = pre[f]  ?? null
      out[`post_${f}`] = post[f] ?? null
    }
    return out
  }))

  // belt_sessions.csv
  const sessCsv = toCsv(sessRows.map(r => {
    const e = enrollMap[r.user_id] ?? {}
    return { participant_id: e.external_id ?? r.participant_external_id, ...r, user_id: undefined }
  }))

  // belt_trials.csv
  const trialCsv = toCsv(trialRows.map(r => ({
    participant_id: r.participant_external_id,
    ...r,
  })))

  // questionnaires.csv — wide format, one row per participant
  function normalizeSlug(slug) {
    return slug
      .replace('brief-maia-2', 'maia2')
      .replace('barq-r',       'barqr')
      .replace('phq-4',        'phq4')
      .replace(/-/g, '')
  }
  const qWide = {}
  for (const e of enrollments) qWide[e.profile_id] = { participant_id: e.external_id }
  for (const r of qRows) {
    if (!qWide[r.user_id]) continue
    const prefix = normalizeSlug(r.questionnaire_slug)
    for (const [rawKey, val] of Object.entries(r.responses ?? {})) {
      const cleanKey = rawKey.replace(/^item_/, '')
      const match    = cleanKey.match(/(\d+)$/)
      const col      = match ? `${prefix}_${match[1]}` : `${prefix}_${cleanKey}`
      qWide[r.user_id][col] = responseScalar(val)
    }
  }
  const qCsv = toCsv(Object.values(qWide))

  return [
    { filename: 'demographics.csv',   content: demCsv   },
    { filename: 'stillwater.csv',     content: swCsv    },
    { filename: 'belt_sessions.csv',  content: sessCsv  },
    { filename: 'belt_trials.csv',    content: trialCsv },
    { filename: 'questionnaires.csv', content: qCsv     },
  ]
}

// ── Physio zip builder ────────────────────────────────────────────────────────

async function buildPhysioZipFiles(enrollments, onProgress) {
  const externalIds = enrollments.map(e => e.external_id)
  const { data: sessions } = await supabase
    .from('belt_sessions')
    .select('participant_external_id, user_id, session_id, session_number, storage_path, created_at')
    .in('participant_external_id', externalIds)
    .order('created_at', { ascending: true })

  // Group by participant → session_number, then sort for a/b/c disambiguation
  const byParticipant = {}
  for (const s of sessions ?? []) {
    const pid = s.participant_external_id
    if (!byParticipant[pid]) byParticipant[pid] = {}
    const n = s.session_number ?? 1
    if (!byParticipant[pid][n]) byParticipant[pid][n] = []
    byParticipant[pid][n].push(s)
  }

  const toFetch = []
  for (const [pid, byNum] of Object.entries(byParticipant)) {
    for (const [num, rows] of Object.entries(byNum)) {
      rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      const needDisambig = rows.length > 1
      rows.forEach((s, i) => {
        const suffix = needDisambig ? `${num}${'abcdefghijklmnopqrstuvwxyz'[i]}` : num
        const label  = `session${suffix}`
        toFetch.push({
          accelFilename: `${pid}_${label}_accel.csv`,
          hrFilename:    `${pid}_${label}_hr.csv`,
          accelPath:     `${s.storage_path}_accel.csv`,
          hrPath:        `${s.storage_path}_hr.csv`,
        })
      })
    }
  }

  const files = []
  let done = 0
  for (const entry of toFetch) {
    onProgress(`Downloading ${entry.accelFilename} (${done + 1}/${toFetch.length})…`)
    const [accelRes, hrRes] = await Promise.all([
      supabase.storage.from('belt-sessions').download(entry.accelPath),
      supabase.storage.from('belt-sessions').download(entry.hrPath),
    ])
    if (accelRes.data) files.push({ filename: entry.accelFilename, content: await accelRes.data.text() })
    if (hrRes.data)    files.push({ filename: entry.hrFilename,    content: await hrRes.data.text() })
    done++
  }

  return files
}

// ── Session label helper (shared between physio builder and BeltPhysioSection) ─

function buildSessionEntries(sessions) {
  const byNum = {}
  for (const s of sessions) {
    const n = s.session_number ?? 1
    if (!byNum[n]) byNum[n] = []
    byNum[n].push(s)
  }
  const entries = []
  for (const [num, rows] of Object.entries(byNum)) {
    rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const needDisambig = rows.length > 1
    rows.forEach((s, i) => {
      const suffix = needDisambig ? `${num}${'abcdefghijklmnopqrstuvwxyz'[i]}` : num
      entries.push({ label: `session${suffix}`, session: s })
    })
  }
  return entries
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
        Object.entries(r.responses ?? {}).map(([k, v]) => [`item_${k}`, responseScalar(v)])
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

// ── Still Water section ──────────────────────────────────────────────────────

function StillWaterSection({ profileId, externalId }) {
  const { data = [], isLoading } = useStillWaterResponses(profileId)

  return (
    <section style={S.section}>
      <SectionHeader
        title="Still Water"
        count={isLoading ? null : data.length}
        onDownload={() => downloadCsv(`stillwater_${externalId}.csv`, data)}
        disabled={isLoading || data.length === 0}
      />
      {isLoading ? (
        <p style={S.msg}>Loading…</p>
      ) : !profileId ? (
        <p style={S.msg}>No study enrollment found — Still Water lookup requires an enrollment record.</p>
      ) : data.length === 0 ? (
        <p style={S.msg}>No Still Water responses found.</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Date', 'Composite', 'Valence', 'Arousal', 'Step 1 rating', 'Step 2 rating', 'Ambivalence'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} style={S.tr}>
                  <td style={S.td}>{fmtDate(row.created_at)}</td>
                  <td style={S.tdMono}>{row.composite_label ?? '—'}</td>
                  <td style={S.tdMono}>{fmt(row.composite_x)}</td>
                  <td style={S.tdMono}>{fmt(row.composite_y)}</td>
                  <td style={S.tdMono}>{row.pos_rating ?? '—'}</td>
                  <td style={S.tdMono}>{row.neg_rating ?? '—'}</td>
                  <td style={S.tdMono}>{fmt(row.ambivalence_mag)}</td>
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

// ── Physio preview chart ──────────────────────────────────────────────────────

function PhysioPreviewChart({ data }) {
  const { accel, hr } = data

  const accelCols = accel.length ? Object.keys(accel[0]) : []
  const hrCols    = hr.length    ? Object.keys(hr[0])    : []

  const accelYCol = accelCols.find(c => /mag|acc_z|z$/i.test(c)) ?? accelCols[1] ?? accelCols[0]
  const hrYCol    = hrCols.find(c => /hr|bpm|rate/i.test(c))     ?? hrCols[1]    ?? hrCols[0]
  const accelXCol = accelCols[0]
  const hrXCol    = hrCols[0]

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <p style={S.chartLabel}>Accelerometer — {accelYCol} (every 10th sample)</p>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={accel}>
            <XAxis dataKey={accelXCol} hide />
            <YAxis width={40} tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey={accelYCol} dot={false} stroke="var(--pk)" strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p style={S.chartLabel}>Heart Rate — {hrYCol} (every 10th sample)</p>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={hr}>
            <XAxis dataKey={hrXCol} hide />
            <YAxis width={40} tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey={hrYCol} dot={false} stroke="#16a34a" strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Belt Physio section (individual participant) ───────────────────────────────

function BeltPhysioSection({ externalId }) {
  const { data: sessions = [], isLoading } = useBeltSessions(externalId)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewData,    setPreviewData]    = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleDownload() {
    if (!sessions.length) return
    setBusy(true)
    try {
      const entries = buildSessionEntries(sessions)
      const files = []
      for (const { label, session: s } of entries) {
        const [accelRes, hrRes] = await Promise.all([
          supabase.storage.from('belt-sessions').download(`${s.storage_path}_accel.csv`),
          supabase.storage.from('belt-sessions').download(`${s.storage_path}_hr.csv`),
        ])
        if (accelRes.data) files.push({ filename: `${externalId}_${label}_accel.csv`, content: await accelRes.data.text() })
        if (hrRes.data)    files.push({ filename: `${externalId}_${label}_hr.csv`,    content: await hrRes.data.text() })
      }
      downloadZip(`physio_${externalId}.zip`, files)
    } finally {
      setBusy(false)
    }
  }

  async function handlePreview() {
    if (previewVisible) { setPreviewVisible(false); return }
    if (previewData)    { setPreviewVisible(true);  return }
    setPreviewLoading(true)
    try {
      const entries = buildSessionEntries(sessions)
      if (!entries.length) return
      const { session: s } = entries[0]
      const [accelRes, hrRes] = await Promise.all([
        supabase.storage.from('belt-sessions').download(`${s.storage_path}_accel.csv`),
        supabase.storage.from('belt-sessions').download(`${s.storage_path}_hr.csv`),
      ])
      const parseCsv = async (blob) => {
        if (!blob) return []
        const text    = await blob.text()
        const lines   = text.trim().split('\n')
        const headers = lines[0].split(',')
        return lines.slice(1).filter((_, i) => i % 10 === 0).map(line => {
          const vals = line.split(',')
          const obj  = {}
          headers.forEach((h, j) => { obj[h.trim()] = parseFloat(vals[j]) || 0 })
          return obj
        })
      }
      const [accel, hr] = await Promise.all([parseCsv(accelRes.data), parseCsv(hrRes.data)])
      setPreviewData({ accel, hr })
      setPreviewVisible(true)
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <section style={S.section}>
      <div style={S.sectionHead}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={S.sectionTitle}>Physio Data</span>
          {!isLoading && <span style={S.sectionCount}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ ...S.csvBtn, opacity: (isLoading || busy || !sessions.length) ? 0.4 : 1 }}
            disabled={isLoading || busy || !sessions.length}
            onClick={handleDownload}
          >
            {busy ? 'Downloading…' : '↓ Physio ZIP'}
          </button>
          <button
            style={{ ...S.csvBtn, opacity: (isLoading || previewLoading || !sessions.length) ? 0.4 : 1 }}
            disabled={isLoading || previewLoading || !sessions.length}
            onClick={handlePreview}
          >
            {previewLoading ? 'Loading…' : previewVisible ? 'Hide Preview' : '▶ Preview'}
          </button>
        </div>
      </div>
      {previewVisible && previewData && <PhysioPreviewChart data={previewData} />}
      {!isLoading && sessions.length === 0 && <p style={S.msg}>No physio sessions found.</p>}
    </section>
  )
}

// ── Study-level export section ────────────────────────────────────────────────

function StudyExportSection() {
  const [studyId,     setStudyId]     = useState('')
  const [tabularBusy, setTabularBusy] = useState(false)
  const [physioBusy,  setPhysioBusy]  = useState(false)
  const [status,      setStatus]      = useState('')

  const { data: studies     = [] } = useStudies()
  const { data: enrollments = [] } = useStudyEnrollments(studyId)

  async function handleTabularExport() {
    if (!studyId || !enrollments.length) return
    setTabularBusy(true)
    setStatus('Fetching data…')
    try {
      const files     = await buildTabularZipFiles(enrollments)
      setStatus('Building zip…')
      const studyName = studies.find(s => s.id === studyId)?.name ?? studyId
      downloadZip(`${studyName}_tabular_export.zip`, files)
      setStatus(`Done — ${enrollments.length} participant${enrollments.length !== 1 ? 's' : ''} exported.`)
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setTabularBusy(false)
    }
  }

  async function handlePhysioExport() {
    if (!studyId || !enrollments.length) return
    setPhysioBusy(true)
    setStatus('Fetching physio files…')
    try {
      const files     = await buildPhysioZipFiles(enrollments, msg => setStatus(msg))
      setStatus('Building zip…')
      const studyName = studies.find(s => s.id === studyId)?.name ?? studyId
      downloadZip(`${studyName}_physio_export.zip`, files)
      setStatus('Done — physio files exported.')
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setPhysioBusy(false)
    }
  }

  return (
    <section style={S.section}>
      <div style={S.sectionHead}>
        <span style={S.sectionTitle}>Study-Level Export</span>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <select
          value={studyId}
          onChange={e => { setStudyId(e.target.value); setStatus('') }}
          style={S.select}
        >
          <option value="">Select a study…</option>
          {studies.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {studyId && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' }}>
            {enrollments.length} enrolled participant{enrollments.length !== 1 ? 's' : ''}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            style={{ ...S.csvBtn, opacity: (!studyId || tabularBusy) ? 0.4 : 1 }}
            disabled={!studyId || tabularBusy || enrollments.length === 0}
            onClick={handleTabularExport}
          >
            {tabularBusy ? 'Exporting…' : '↓ Export Tabular Data'}
          </button>
          <button
            style={{ ...S.csvBtn, opacity: (!studyId || physioBusy) ? 0.4 : 1 }}
            disabled={!studyId || physioBusy || enrollments.length === 0}
            onClick={handlePhysioExport}
          >
            {physioBusy ? 'Exporting…' : '↓ Export Physio Data'}
          </button>
        </div>

        {status && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx2)', fontFamily: '"Space Mono",monospace' }}>
            {status}
          </p>
        )}
      </div>
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DataExportPage() {
  const [search,          setSearch]          = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected,        setSelected]        = useState(null)

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
      <p style={S.sub}>Export BreathBelt and questionnaire data as CSV. Use the study-level export for batch downloads.</p>

      <StudyExportSection />

      <hr style={{ border: 'none', borderTop: '1px solid var(--bd)', margin: '28px 0' }} />

      <p style={S.sub}>Or search by participant ID to export individual data.</p>

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
          <StillWaterSection     externalId={selected.externalId} profileId={selected.profileId} />
          <BeltSessionsSection   externalId={selected.externalId} />
          <BeltTrialsSection     externalId={selected.externalId} />
          <BeltPhysioSection     externalId={selected.externalId} />
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

  select: {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--bd)',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14,
    color: 'var(--tx)', background: '#fff', maxWidth: 360,
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
  chartLabel: { margin: '0 0 6px', fontSize: 11, fontFamily: '"Space Mono",monospace', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
}
