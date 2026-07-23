import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { zipSync, strToU8 } from 'fflate'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  fetchStudyData, buildMasterTable, hasPhysio, toCsv, responseScalar,
} from '../../lib/studyExport'

// ── CSV helpers ──────────────────────────────────────────────────────────────

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
      // All studies (not just in-person) — physio export self-disables when a
      // study has no BreathBelt data.
      const { data, error } = await supabase
        .from('studies')
        .select('id, name, delivery_mode')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

function useStudyData(studyId) {
  return useQuery({
    queryKey: ['study-export-all', studyId],
    enabled: !!studyId,
    staleTime: 60_000,
    queryFn: () => fetchStudyData(studyId),
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

const CATEGORY_ORDER = [
  'Sessions', 'Games', 'Questionnaires', 'Rating scales', 'Screeners',
  'Demographics', 'Physio', 'Video', 'Audio', 'Forms', 'Timing',
  'Assignments', 'Training',
]

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// Generic preview of any rows: first 20 rows, first 14 columns.
function GenericPreview({ rows }) {
  const MAX_ROWS = 20
  const MAX_COLS = 14
  const cols = useMemo(() => {
    const set = new Set()
    for (const r of rows.slice(0, MAX_ROWS)) Object.keys(r).forEach(k => set.add(k))
    return [...set]
  }, [rows])
  if (!rows.length) return <p style={S.msg}>No rows.</p>
  const shown = cols.slice(0, MAX_COLS)
  const extra = cols.length - shown.length
  const cell  = v => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead>
          <tr>
            {shown.map(c => <th key={c} style={S.th}>{c}</th>)}
            {extra > 0 && <th style={S.th}>+{extra} more</th>}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, MAX_ROWS).map((r, i) => (
            <tr key={i} style={S.tr}>
              {shown.map(c => (
                <td key={c} style={S.tdMono} title={cell(r[c])}>{truncate(cell(r[c]), 40)}</td>
              ))}
              {extra > 0 && <td style={S.tdMono}>…</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={S.msg}>
        Showing first {Math.min(MAX_ROWS, rows.length)} of {rows.length} row{rows.length !== 1 ? 's' : ''}
        {extra > 0 ? ` · ${cols.length} columns` : ''} — download CSV for the complete table.
      </p>
    </div>
  )
}

function TableCard({ entry, studyName }) {
  const [open, setOpen] = useState(false)
  return (
    <section style={S.section}>
      <div style={S.sectionHead}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={S.sectionTitle}>{entry.label}</span>
          <span style={S.sectionCount}>{entry.rows.length} rows</span>
          <code style={S.tableName}>{entry.table}</code>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.linkBtn} onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Preview'}</button>
          <button style={S.csvBtn} onClick={() => downloadCsv(`${studyName}__${entry.table}.csv`, entry.rows)}>↓ CSV</button>
        </div>
      </div>
      {open && <GenericPreview rows={entry.rows} />}
    </section>
  )
}

function StudyExportSection() {
  const [studyId,    setStudyId]    = useState('')
  const [zipBusy,    setZipBusy]    = useState(false)
  const [physioBusy, setPhysioBusy] = useState(false)
  const [status,     setStatus]     = useState('')
  const [masterOpen, setMasterOpen] = useState(false)

  const { data: studies = [] }               = useStudies()
  const { data: studyData, isFetching, error } = useStudyData(studyId)

  const studyName   = studies.find(s => s.id === studyId)?.name ?? studyId
  const tables      = studyData?.tables ?? []
  const errors      = studyData?.errors ?? []
  const enrollments = studyData?.context?.enrollments ?? []
  const master = useMemo(
    () => (studyData ? buildMasterTable(studyData.context, studyData.resultsByTable) : []),
    [studyData],
  )
  const physioAvailable = studyData ? hasPhysio(studyData.resultsByTable) : false

  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, items: tables.filter(t => t.category === cat) }))
    .filter(g => g.items.length)

  async function handleFullExport() {
    if (!studyData) return
    setZipBusy(true)
    setStatus('Building zip…')
    try {
      const files = [
        { filename: '_participant_master.csv', content: toCsv(master) },
        ...tables.map(t => ({ filename: `${t.table}.csv`, content: toCsv(t.rows) })),
      ]
      downloadZip(`${studyName}_study_export.zip`, files)
      setStatus(`Done — master + ${tables.length} table${tables.length !== 1 ? 's' : ''} exported.`)
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setZipBusy(false)
    }
  }

  async function handlePhysioExport() {
    if (!enrollments.length) return
    setPhysioBusy(true)
    setStatus('Fetching physio files…')
    try {
      const files = await buildPhysioZipFiles(enrollments, msg => setStatus(msg))
      setStatus('Building zip…')
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
          onChange={e => { setStudyId(e.target.value); setStatus(''); setMasterOpen(false) }}
          style={S.select}
        >
          <option value="">Select a study…</option>
          {studies.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {studyId && isFetching && <p style={S.dim}>Loading study data…</p>}
        {error && <p style={S.err}>Error loading study: {error.message}</p>}

        {studyId && !isFetching && studyData && (
          <>
            <p style={S.dim}>
              {enrollments.length} enrolled participant{enrollments.length !== 1 ? 's' : ''} · {tables.length} non-empty table{tables.length !== 1 ? 's' : ''}
            </p>
            {errors.length > 0 && (
              <p style={S.warn}>
                ⚠ {errors.length} table{errors.length !== 1 ? 's' : ''} could not be read
                ({errors.map(e => e.table).join(', ')}). If these should hold data, the
                lab-read RLS migration (20260723_export_lab_read_policies) may not be applied yet.
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                style={{ ...S.csvBtn, opacity: (zipBusy || !tables.length) ? 0.4 : 1 }}
                disabled={zipBusy || !tables.length}
                onClick={handleFullExport}
              >
                {zipBusy ? 'Exporting…' : '↓ Export All Tables + Master (ZIP)'}
              </button>
              <button
                style={{ ...S.csvBtn, opacity: (physioBusy || !physioAvailable) ? 0.4 : 1 }}
                disabled={physioBusy || !physioAvailable}
                onClick={handlePhysioExport}
                title={physioAvailable ? '' : 'This study has no BreathBelt data'}
              >
                {physioBusy ? 'Exporting…' : physioAvailable ? '↓ Export Physio (ZIP)' : 'No physio data'}
              </button>
            </div>
            {status && <p style={S.mono}>{status}</p>}
          </>
        )}
      </div>

      {studyId && !isFetching && studyData && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Combined participant-level master — one row per participant */}
          <section style={{ ...S.section, borderColor: 'var(--pk)' }}>
            <div style={S.sectionHead}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={S.sectionTitle}>Combined participant master</span>
                <span style={S.sectionCount}>{master.length} participants · one row each</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.linkBtn} onClick={() => setMasterOpen(o => !o)}>{masterOpen ? 'Hide' : 'Preview'}</button>
                <button
                  style={{ ...S.csvBtn, opacity: master.length ? 1 : 0.4 }}
                  disabled={!master.length}
                  onClick={() => downloadCsv(`${studyName}__participant_master.csv`, master)}
                >
                  ↓ CSV
                </button>
              </div>
            </div>
            {masterOpen && <GenericPreview rows={master} />}
          </section>

          {grouped.map(g => (
            <div key={g.cat}>
              <p style={S.catHead}>{g.cat}</p>
              {g.items.map(entry => <TableCard key={entry.table} entry={entry} studyName={studyName} />)}
            </div>
          ))}

          {tables.length === 0 && (
            <p style={S.msg}>No participant data found for this study yet.</p>
          )}
        </div>
      )}
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
      <p style={S.sub}>Pick a study to preview and export every research element its participants generated — each table individually, plus a combined one-row-per-participant master — all as CSV.</p>

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
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, fontWeight: 600,
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

  dim:  { margin: 0, fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  mono: { margin: 0, fontSize: 12, color: 'var(--tx2)', fontFamily: '"Space Mono",monospace' },
  err:  { margin: 0, fontSize: 13, color: '#dc2626', fontFamily: '"DM Sans",system-ui,sans-serif' },
  warn: {
    margin: 0, fontSize: 12, color: '#92400e', background: '#fef3c7',
    border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 12px',
    fontFamily: '"DM Sans",system-ui,sans-serif', lineHeight: 1.4,
  },
  catHead: {
    margin: '22px 0 8px', fontSize: 11, fontWeight: 700,
    fontFamily: '"Space Mono",monospace', color: 'var(--tx2)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  tableName: {
    fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)',
    background: '#f3f4f6', borderRadius: 4, padding: '2px 6px',
  },
  linkBtn: {
    background: 'none', border: '1px solid var(--bd)', borderRadius: 8,
    padding: '6px 12px', cursor: 'pointer', color: 'var(--tx2)',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, fontWeight: 600,
  },
}
