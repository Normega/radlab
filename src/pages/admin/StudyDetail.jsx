// v2
import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { generateSchedule, issueLink } from '../../lib/scheduleGenerator'
import EnrollmentPanel   from '../../components/study/EnrollmentPanel'
import StudySessionsPanel from './StudySessionsPanel'
import AnonymousLinkPanel from './AnonymousLinkPanel'

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useStudy(id) {
  return useQuery({
    queryKey: ['study-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studies')
        .select(`
          id, name, created_at, delivery_mode, active,
          consent_required, active_consent_form_id, active_debrief_form_id,
          allow_restart, reminders_enabled, reminder_interval_days, reminder_max,
          email_subject, email_body,
          allow_external_enrollment, external_enrollment_source, completion_redirect_url,
          screener_id
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

function useConsentForm(formId) {
  return useQuery({
    queryKey: ['consent-form', formId],
    enabled: !!formId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_consent_forms')
        .select('id, uploaded_at, docx_url, html_content')
        .eq('id', formId)
        .single()
      if (error) throw error
      return data
    },
  })
}

function useDebriefForm(formId) {
  return useQuery({
    queryKey: ['debrief-form', formId],
    enabled: !!formId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_debrief_forms')
        .select('id, uploaded_at, docx_url, html_content')
        .eq('id', formId)
        .single()
      if (error) throw error
      return data
    },
  })
}

function useLongitudinalParticipants(studyId) {
  return useQuery({
    queryKey: ['longitudinal-participants', studyId],
    enabled: !!studyId,
    queryFn: async () => {
      const { data: enrollments, error } = await supabase
        .from('study_enrollments')
        .select('id, profile_id, external_id, enrolled_at, consent_date, status, profiles!profile_id(id, display_name)')
        .eq('study_id', studyId)
        .is('withdrawn_at', null)
        .order('enrolled_at', { ascending: true })
      if (error) throw error

      const profileIds = (enrollments ?? []).map(e => e.profile_id).filter(Boolean)
      if (!profileIds.length) return []

      const { data: schedule } = await supabase
        .from('participant_schedule')
        .select('id, participant_id, study_session_id, status, completed_at')
        .eq('study_id', studyId)
        .in('participant_id', profileIds)

      const schedMap = {}
      for (const row of (schedule ?? [])) {
        if (!schedMap[row.participant_id]) schedMap[row.participant_id] = []
        schedMap[row.participant_id].push(row)
      }

      return enrollments.map(e => {
        const rows      = schedMap[e.profile_id] ?? []
        const total     = rows.length
        const completed = rows.filter(r => r.status === 'completed').length
        const lastActive = rows.map(r => r.completed_at).filter(Boolean).sort().at(-1)
        return {
          enrollmentId:  e.id,
          profileId:     e.profile_id,
          externalId:    e.external_id,
          displayName:   e.profiles?.display_name || e.external_id || '—',
          enrolledAt:    e.enrolled_at,
          consentDate:   e.consent_date,
          status:        e.status,
          total,
          completed,
          lastActive,
        }
      })
    },
  })
}

function useParticipantSchedule(studyId, profileId) {
  return useQuery({
    queryKey: ['participant-schedule', studyId, profileId],
    enabled: !!studyId && !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_schedule')
        .select(`
          id, study_session_id, scheduled_date, send_time, status,
          completed_at, attempts,
          study_sessions(label, day_number, link_expires_hours),
          participant_links!link_id(id, token, status, expires_at)
        `)
        .eq('study_id', studyId)
        .eq('participant_id', profileId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudyDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { data: study, isLoading: studyLoading } = useStudy(id)

  if (studyLoading) return <p style={S.muted}>Loading…</p>

  const mode = study?.delivery_mode ?? 'in_person'
  const modeLabel = { in_person: 'in-person', online_single: 'single session', online_longitudinal: 'longitudinal' }[mode] ?? mode

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <Link to="/admin/studies" style={S.backLink}>← Studies</Link>
          <h1 style={S.h1}>{study?.name}</h1>
          <p style={S.sub}>
            <span style={S.typePill}>{modeLabel}</span>
            <span style={S.sep}>·</span>
            {fmtDate(study?.created_at)}
          </p>
        </div>
        <Link to={`/admin/studies/${id}/edit`} style={{ ...S.btnPrimary, textDecoration: 'none', fontSize: 13, padding: '7px 14px' }}>
          Edit Study
        </Link>
      </div>

      {/* Sessions — all study types */}
      <StudySessionsPanel study={study} qc={qc} />

      {/* Mode-specific enrollment panel */}
      {mode === 'in_person' && (
        <EnrollmentPanel study={study} />
      )}

      {mode === 'online_single' && (
        <>
          <AnonymousLinkPanel study={study} qc={qc} />
          <ExternalEnrollmentPanel study={study} qc={qc} />
        </>
      )}

      {mode === 'online_longitudinal' && (
        <>
          <EmailPrefsCard study={study} />
          <LongitudinalParticipantsPanel study={study} qc={qc} />
          <ExternalEnrollmentPanel study={study} qc={qc} />
        </>
      )}

      {/* Screener, consent, and debrief — all types */}
      <ScreenerSection study={study} qc={qc} />
      <ConsentFormSection study={study} qc={qc} />
      <DebriefFormSection study={study} qc={qc} />
    </div>
  )
}

// ─── Email prefs summary card (longitudinal only) ─────────────────────────────

function EmailPrefsCard({ study }) {
  if (!study) return null
  return (
    <div style={{ marginTop: 32, background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 10, padding: '16px 20px', maxWidth: 520 }}>
      <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--pkd)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Email preferences</div>
      <div style={{ fontSize: 13, color: 'var(--tx2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Allow restart: <strong>{study.allow_restart ? 'yes' : 'no'}</strong></span>
        <span>Reminders: <strong>{study.reminders_enabled ? `every ${study.reminder_interval_days ?? '?'} days, max ${study.reminder_max ?? '?'}` : 'off'}</strong></span>
        {study.email_subject && <span>Subject: <strong>{study.email_subject}</strong></span>}
      </div>
      <Link to={`/admin/studies/${study.id}/edit`} style={{ fontSize: 12, color: 'var(--pkd)', display: 'inline-block', marginTop: 10 }}>
        Edit email preferences →
      </Link>
    </div>
  )
}

// ─── Longitudinal participants panel ─────────────────────────────────────────

function LongitudinalParticipantsPanel({ study, qc }) {
  const studyId = study.id
  const { data: participants = [], isLoading } = useLongitudinalParticipants(studyId)
  const [showForm,    setShowForm]    = useState(false)
  const [email,       setEmail]       = useState('')
  const [addError,    setAddError]    = useState(null)
  const [addSuccess,  setAddSuccess]  = useState(null)
  const [selectedPid, setSelectedPid] = useState(null)

  const addParticipant = useMutation({
    mutationFn: async (emailVal) => {
      const { data: userId, error: pe } = await supabase
        .rpc('get_user_id_by_email', { lookup_email: emailVal.trim().toLowerCase() })
      if (pe) throw pe
      if (!userId) throw new Error(`No account found for ${emailVal}. They need to sign up first.`)

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', userId)
        .single()

      const now = new Date().toISOString()
      const { error: insertErr } = await supabase
        .from('study_enrollments')
        .insert({
          study_id:     studyId,
          profile_id:   profile.id,
          external_id:  emailVal.trim().toLowerCase(),
          enrolled_at:  now,
          consent_date: now,
          status:       'enrolled',
        })
      if (insertErr) {
        if (insertErr.code === '23505') throw new Error('This participant is already enrolled.')
        throw insertErr
      }

      await generateSchedule(profile.id, studyId, new Date())
      return profile.display_name || emailVal
    },
    onSuccess: (name) => {
      qc.invalidateQueries({ queryKey: ['longitudinal-participants', studyId] })
      setEmail('')
      setShowForm(false)
      setAddSuccess(`${name} enrolled successfully.`)
      setAddError(null)
    },
    onError: (e) => { setAddError(e.message); setAddSuccess(null) },
  })

  const withdraw = useMutation({
    mutationFn: async (enrollmentId) => {
      const { error } = await supabase
        .from('study_enrollments')
        .update({ status: 'withdrawn' })
        .eq('id', enrollmentId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['longitudinal-participants', studyId] }),
  })

  if (selectedPid) {
    const p = participants.find(x => x.profileId === selectedPid)
    return (
      <ScheduleView
        studyId={studyId}
        participant={p}
        onBack={() => setSelectedPid(null)}
        qc={qc}
      />
    )
  }

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={S.sectionTitle}>Participants</h2>
        <button style={S.btnPrimary} onClick={() => { setShowForm(v => !v); setAddError(null); setAddSuccess(null) }}>
          {showForm ? 'Cancel' : '+ Add participant'}
        </button>
      </div>

      {showForm && (
        <div style={S.addForm}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="participant@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addParticipant.mutate(email)}
          />
          <button
            style={{ ...S.btnPrimary, opacity: addParticipant.isPending ? 0.7 : 1 }}
            onClick={() => { setAddError(null); addParticipant.mutate(email) }}
            disabled={addParticipant.isPending}
          >
            {addParticipant.isPending ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
      )}

      {addError   && <p style={S.errMsg}>{addError}</p>}
      {addSuccess && <p style={S.successMsg}>{addSuccess}</p>}

      {isLoading ? (
        <p style={S.muted}>Loading participants…</p>
      ) : participants.length === 0 ? (
        <div style={S.empty}>
          <p style={S.emptyText}>No participants yet.</p>
          <p style={S.emptyHint}>Add someone by their email address to enroll them.</p>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Name', 'Enrolled', 'Consent', 'Progress', 'Last active', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map(p => (
                <tr key={p.profileId} style={S.tr}>
                  <td style={S.td}><span style={S.pName}>{p.displayName}</span></td>
                  <td style={S.td}><span style={S.mono}>{fmtDate(p.enrolledAt)}</span></td>
                  <td style={S.td}><span style={S.mono}>{fmtDate(p.consentDate)}</span></td>
                  <td style={S.td}>
                    {p.total > 0
                      ? <Chip>{p.completed} / {p.total} sessions</Chip>
                      : <span style={S.muted}>—</span>}
                  </td>
                  <td style={S.td}>
                    {p.lastActive
                      ? <span style={S.mono}>{fmtDate(p.lastActive)}</span>
                      : <span style={S.muted}>—</span>}
                  </td>
                  <td style={S.td}>
                    <div style={S.actions}>
                      <button style={S.actionBtn} onClick={() => setSelectedPid(p.profileId)}>
                        View schedule
                      </button>
                      <button
                        style={{ ...S.actionBtn, color: '#e04' }}
                        onClick={() => { if (window.confirm(`Withdraw ${p.displayName}?`)) withdraw.mutate(p.enrollmentId) }}
                      >
                        Withdraw
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Schedule view (longitudinal) ────────────────────────────────────────────

function ScheduleView({ studyId, participant, onBack, qc }) {
  const { data: rows = [], isLoading } = useParticipantSchedule(studyId, participant?.profileId)
  const [copied,      setCopied]      = useState(null)
  const [actionError, setActionError] = useState(null)

  const issueLinkMutation = useMutation({
    mutationFn: (scheduleId) => issueLink(scheduleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participant-schedule', studyId, participant.profileId] })
      qc.invalidateQueries({ queryKey: ['longitudinal-participants', studyId] })
    },
    onError: (e) => setActionError(e.message),
  })

  const revokeLink = useMutation({
    mutationFn: async ({ linkId, scheduleId }) => {
      await supabase.from('participant_links').update({ status: 'revoked' }).eq('id', linkId)
      await supabase.from('participant_schedule').update({ status: 'pending', link_id: null }).eq('id', scheduleId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participant-schedule', studyId, participant.profileId] }),
    onError: (e) => setActionError(e.message),
  })

  async function copyLink(token) {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ marginTop: 36 }}>
      <button style={S.backLinkBtn} onClick={onBack}>← Back to participants</button>
      <h2 style={S.sectionTitle}>{participant?.displayName}'s Schedule</h2>

      {actionError && <p style={S.errMsg}>{actionError}</p>}

      {isLoading ? (
        <p style={S.muted}>Loading schedule…</p>
      ) : rows.length === 0 ? (
        <p style={S.muted}>No schedule rows yet.</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Session', 'Scheduled date', 'Status', 'Completed', 'Attempts', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const link      = row.participant_links
                const sess      = row.study_sessions
                const label     = sess?.label || `Day ${sess?.day_number ?? '?'}`
                const canIssue  = row.status === 'pending' && !link
                const canRevoke = link?.status === 'active'
                return (
                  <tr key={row.id} style={S.tr}>
                    <td style={S.td}><span style={S.mono}>{label}</span></td>
                    <td style={S.td}><span style={S.mono}>{row.scheduled_date ?? '—'}</span></td>
                    <td style={S.td}><StatusBadge status={row.status} /></td>
                    <td style={S.td}><span style={S.mono}>{row.completed_at ? fmtDate(row.completed_at) : '—'}</span></td>
                    <td style={S.td}><span style={S.mono}>{row.attempts ?? 0}</span></td>
                    <td style={S.td}>
                      <div style={S.actions}>
                        {canIssue && (
                          <button
                            style={S.actionBtn}
                            onClick={() => issueLinkMutation.mutate(row.id)}
                            disabled={issueLinkMutation.isPending}
                          >
                            Issue link
                          </button>
                        )}
                        {canRevoke && (
                          <button
                            style={{ ...S.actionBtn, color: '#e04' }}
                            onClick={() => revokeLink.mutate({ linkId: link.id, scheduleId: row.id })}
                          >
                            Revoke
                          </button>
                        )}
                        {link?.token && link.status === 'active' && (
                          <button style={S.actionBtn} onClick={() => copyLink(link.token)}>
                            {copied === link.token ? 'Copied!' : 'Copy link'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Screener section ─────────────────────────────────────────────────────────

function useScreeners() {
  return useQuery({
    queryKey: ['screeners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('screeners').select('id, slug, name').order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

function ScreenerSection({ study, qc }) {
  const { data: screeners = [] } = useScreeners()
  const [selectedId, setSelectedId] = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState(null)

  const attached  = screeners.find(s => s.id === study?.screener_id)
  const available = screeners.filter(s => s.id !== study?.screener_id)

  async function attach() {
    if (!selectedId) return
    setSaving(true); setErr(null)
    try {
      const { data: screener, error: fe } = await supabase
        .from('screeners').select('id, definition').eq('id', selectedId).single()
      if (fe) throw fe
      const { error: ue } = await supabase
        .from('studies')
        .update({ screener_id: screener.id, screener: screener.definition })
        .eq('id', study.id)
      if (ue) throw ue
      qc.invalidateQueries({ queryKey: ['study-detail', study.id] })
      setSelectedId(null)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true); setErr(null)
    try {
      const { error } = await supabase
        .from('studies')
        .update({ screener_id: null, screener: null })
        .eq('id', study.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['study-detail', study.id] })
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={S.sectionTitle}>Screener</h2>
      <p style={{ fontSize: 13, color: 'var(--tx2)', margin: '4px 0 14px', fontFamily: '"DM Sans",system-ui,sans-serif' }}>
        Pre-consent eligibility gate shown to participants before the consent form.
      </p>

      <div style={S.formCard}>
        {attached ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Active screener</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' }}>{attached.name}</div>
              <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--pk)', marginTop: 2 }}>{attached.slug}</div>
            </div>
            <button
              style={{ ...S.actionBtn, color: '#c0392b', opacity: saving ? 0.5 : 1 }}
              onClick={remove}
              disabled={saving}
            >
              {saving ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--tx2)', margin: 0, fontFamily: '"DM Sans",system-ui,sans-serif' }}>
            No screener attached — participants proceed directly to the consent form.
          </p>
        )}

        {screeners.length > 0 && (
          <div style={{ marginTop: attached ? 18 : 14, paddingTop: attached ? 18 : 0, borderTop: attached ? '1px solid var(--bd)' : 'none', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              style={{ ...S.input, flex: 1, minWidth: 200 }}
              value={selectedId ?? ''}
              onChange={e => setSelectedId(e.target.value || null)}
            >
              <option value="">— {attached ? 'Switch to a different screener…' : 'Select a screener…'} —</option>
              {available.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              style={{ ...S.btnPrimary, fontSize: 13, padding: '7px 16px', opacity: (!selectedId || saving) ? 0.5 : 1 }}
              onClick={attach}
              disabled={!selectedId || saving}
            >
              {saving ? 'Saving…' : attached ? 'Switch' : 'Attach'}
            </button>
          </div>
        )}

        {err && <p style={{ ...S.errMsg, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  )
}

// ─── Consent form section (unchanged from v1) ─────────────────────────────────

function ConsentFormSection({ study, qc }) {
  const fileRef = useRef(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const { data: form } = useConsentForm(study?.active_consent_form_id)

  async function toggleConsentRequired(val) {
    await supabase.from('studies').update({ consent_required: val }).eq('id', study.id)
    qc.invalidateQueries({ queryKey: ['study-detail', study.id] })
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const { convertToHtml } = await import('mammoth')
      const { value: html } = await convertToHtml({ arrayBuffer })

      const path = `${study.id}/${Date.now()}_${file.name}`
      const { error: se } = await supabase.storage
        .from('consent-forms')
        .upload(path, file, { contentType: file.type })
      if (se) throw se

      const { data: { user } } = await supabase.auth.getUser()
      const { data: formRecord, error: ie } = await supabase
        .from('study_consent_forms')
        .insert({ study_id: study.id, docx_url: path, html_content: html, uploaded_by: user.id })
        .select('id')
        .single()
      if (ie) throw ie

      const { error: ue } = await supabase
        .from('studies')
        .update({ active_consent_form_id: formRecord.id })
        .eq('id', study.id)
      if (ue) throw ue

      qc.invalidateQueries({ queryKey: ['study-detail', study.id] })
      qc.invalidateQueries({ queryKey: ['consent-form', formRecord.id] })
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const consentUrl = `${window.location.origin}/study/${study?.id}/consent`

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={S.sectionTitle}>Consent Form</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={study?.consent_required ?? true}
            onChange={e => toggleConsentRequired(e.target.checked)}
          />
          <span style={{ fontSize: 13, color: 'var(--tx2)' }}>Require consent before sessions</span>
        </label>
      </div>

      {form ? (
        <div style={S.formCard}>
          <p style={{ fontSize: 13, color: 'var(--tx2)', margin: 0 }}>
            Active form — uploaded {fmtDate(form.uploaded_at)}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={S.actionBtn} onClick={() => setPreviewOpen(true)}>Preview</button>
            <button style={S.actionBtn} onClick={() => navigator.clipboard.writeText(consentUrl)}>
              Copy participant link
            </button>
            <input ref={fileRef} type="file" accept=".docx" style={{ display: 'none' }} onChange={handleFileChange} />
            <button
              style={{ ...S.btnPrimary, fontSize: 13, padding: '7px 14px', opacity: uploading ? 0.7 : 1 }}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Replace form'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '4px 0' }}>
          <p style={{ fontSize: 14, color: 'var(--tx2)', margin: '0 0 12px' }}>
            No consent form attached. Upload a .docx file to add one.
          </p>
          <input ref={fileRef} type="file" accept=".docx" style={{ display: 'none' }} onChange={handleFileChange} />
          <button
            style={{ ...S.btnPrimary, opacity: uploading ? 0.7 : 1 }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Upload consent form (.docx)'}
          </button>
        </div>
      )}

      {uploadError && <p style={{ ...S.errMsg, marginTop: 10 }}>{uploadError}</p>}

      {previewOpen && form && (
        <div style={S.overlay} onClick={() => setPreviewOpen(false)}>
          <div
            style={{ ...S.dialog, maxWidth: 700, maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={S.dialogTitle}>Consent Form Preview</h3>
              <button style={S.actionBtn} onClick={() => setPreviewOpen(false)}>Close ✕</button>
            </div>
            <div
              className="consent-body"
              style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--tx)' }}
              dangerouslySetInnerHTML={{ __html: form.html_content }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Debrief form section (unchanged from v1) ─────────────────────────────────

function DebriefFormSection({ study, qc }) {
  const fileRef = useRef(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const { data: form } = useDebriefForm(study?.active_debrief_form_id)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const { convertToHtml } = await import('mammoth')
      const { value: html } = await convertToHtml({ arrayBuffer })

      const path = `${study.id}/${Date.now()}_${file.name}`
      const { error: se } = await supabase.storage
        .from('debrief-forms')
        .upload(path, file, { contentType: file.type })
      if (se) throw se

      const { data: { user } } = await supabase.auth.getUser()
      const { data: formRecord, error: ie } = await supabase
        .from('study_debrief_forms')
        .insert({ study_id: study.id, docx_url: path, html_content: html, uploaded_by: user.id })
        .select('id')
        .single()
      if (ie) throw ie

      const { error: ue } = await supabase
        .from('studies')
        .update({ active_debrief_form_id: formRecord.id })
        .eq('id', study.id)
      if (ue) throw ue

      qc.invalidateQueries({ queryKey: ['study-detail', study.id] })
      qc.invalidateQueries({ queryKey: ['debrief-form', formRecord.id] })
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={S.sectionTitle}>Debrief Form</h2>
      </div>

      {form ? (
        <div style={S.formCard}>
          <p style={{ fontSize: 13, color: 'var(--tx2)', margin: 0 }}>
            Active form — uploaded {fmtDate(form.uploaded_at)}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={S.actionBtn} onClick={() => setPreviewOpen(true)}>Preview</button>
            <input ref={fileRef} type="file" accept=".docx" style={{ display: 'none' }} onChange={handleFileChange} />
            <button
              style={{ ...S.btnPrimary, fontSize: 13, padding: '7px 14px', opacity: uploading ? 0.7 : 1 }}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Replace form'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '4px 0' }}>
          <p style={{ fontSize: 14, color: 'var(--tx2)', margin: '0 0 12px' }}>
            No debrief form attached. Upload a .docx file to add one.
          </p>
          <input ref={fileRef} type="file" accept=".docx" style={{ display: 'none' }} onChange={handleFileChange} />
          <button
            style={{ ...S.btnPrimary, opacity: uploading ? 0.7 : 1 }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Upload debrief form (.docx)'}
          </button>
        </div>
      )}

      {uploadError && <p style={{ ...S.errMsg, marginTop: 10 }}>{uploadError}</p>}

      {previewOpen && form && (
        <div style={S.overlay} onClick={() => setPreviewOpen(false)}>
          <div
            style={{ ...S.dialog, maxWidth: 700, maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={S.dialogTitle}>Debrief Form Preview</h3>
              <button style={S.actionBtn} onClick={() => setPreviewOpen(false)}>Close ✕</button>
            </div>
            <div
              className="consent-body"
              style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--tx)' }}
              dangerouslySetInnerHTML={{ __html: form.html_content }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── External enrollment panel ───────────────────────────────────────────────

const SITE_ROOT = import.meta.env.DEV ? window.location.origin : 'https://radlab.zone'

function ExternalEnrollmentPanel({ study, qc }) {
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState(null)
  const [redirectUrl,  setRedirectUrl]  = useState(study?.completion_redirect_url ?? '')
  const [urlSaving,    setUrlSaving]    = useState(false)
  const [copiedKey,    setCopiedKey]    = useState(null)

  if (!study) return null

  const enabled = study.allow_external_enrollment ?? false
  const source  = study.external_enrollment_source ?? null

  async function toggle(val) {
    setSaving(true); setSaveError(null)
    const { error } = await supabase
      .from('studies')
      .update({ allow_external_enrollment: val })
      .eq('id', study.id)
    if (error) setSaveError(error.message)
    else qc.invalidateQueries({ queryKey: ['study-detail', study.id] })
    setSaving(false)
  }

  async function setSource(val) {
    setSaving(true); setSaveError(null)
    const { error } = await supabase
      .from('studies')
      .update({ external_enrollment_source: val })
      .eq('id', study.id)
    if (error) setSaveError(error.message)
    else qc.invalidateQueries({ queryKey: ['study-detail', study.id] })
    setSaving(false)
  }

  async function saveRedirectUrl() {
    setUrlSaving(true); setSaveError(null)
    const { error } = await supabase
      .from('studies')
      .update({ completion_redirect_url: redirectUrl.trim() || null })
      .eq('id', study.id)
    if (error) setSaveError(error.message)
    else qc.invalidateQueries({ queryKey: ['study-detail', study.id] })
    setUrlSaving(false)
  }

  function copyLink(key, text) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const sonaLink    = `${SITE_ROOT}/study/join?study_id=${study.id}&id=%survey_code%`
  const prolificLink = `${SITE_ROOT}/study/join?study_id=${study.id}&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`

  const showSona    = enabled && (source === 'sona'    || source === 'both')
  const showProlific = enabled && (source === 'prolific' || source === 'both')

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={S.sectionTitle}>External Enrollment</h2>

      <div style={EE.card}>
        {/* Enable toggle */}
        <label style={EE.toggleRow}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => toggle(e.target.checked)}
            disabled={saving}
          />
          <span style={EE.toggleLabel}>Enable external enrollment (SONA / Prolific)</span>
          {saving && <span style={EE.saving}>Saving…</span>}
        </label>

        {enabled && (
          <>
            {/* Source selector */}
            <div style={EE.fieldGroup}>
              <div style={EE.fieldLabel}>Participant source</div>
              <div style={EE.radioRow}>
                {['sona', 'prolific', 'both'].map(opt => (
                  <label key={opt} style={EE.radioLabel}>
                    <input
                      type="radio"
                      name="ext-source"
                      value={opt}
                      checked={source === opt}
                      onChange={() => setSource(opt)}
                      disabled={saving}
                    />
                    <span>{opt.charAt(0).toUpperCase() + opt.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Completion redirect URL */}
            <div style={EE.fieldGroup}>
              <div style={EE.fieldLabel}>Completion redirect URL <span style={EE.optional}>(optional)</span></div>
              <div style={EE.urlRow}>
                <input
                  style={EE.urlInput}
                  type="url"
                  placeholder="https://app.prolific.com/submissions/complete?cc=XXXXX"
                  value={redirectUrl}
                  onChange={e => setRedirectUrl(e.target.value)}
                />
                <button
                  style={{ ...S.btnPrimary, fontSize: 13, padding: '7px 14px', opacity: urlSaving ? 0.7 : 1 }}
                  onClick={saveRedirectUrl}
                  disabled={urlSaving}
                >
                  {urlSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
              <p style={EE.hint}>Participants are redirected here after completing the session. Leave blank to show the default completion screen.</p>
            </div>

            {/* Generated links */}
            {(showSona || showProlific) && (
              <div style={EE.fieldGroup}>
                <div style={EE.fieldLabel}>Study links</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {showSona && (
                    <LinkRow label="SONA" url={sonaLink} copied={copiedKey === 'sona'} onCopy={() => copyLink('sona', sonaLink)} />
                  )}
                  {showProlific && (
                    <LinkRow label="Prolific" url={prolificLink} copied={copiedKey === 'prolific'} onCopy={() => copyLink('prolific', prolificLink)} />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {saveError && <p style={S.errMsg}>{saveError}</p>}
      </div>
    </div>
  )
}

function LinkRow({ label, url, copied, onCopy }) {
  return (
    <div style={EE.linkRow}>
      <span style={EE.linkLabel}>{label}</span>
      <input style={EE.linkInput} type="text" readOnly value={url} onFocus={e => e.target.select()} />
      <button style={EE.copyBtn} onClick={onCopy}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

const EE = {
  card:        { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '20px 22px' },
  toggleRow:   { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' },
  toggleLabel: { fontSize: 14, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  saving:      { fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  fieldGroup:  { marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--bd)' },
  fieldLabel:  { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 },
  optional:    { textTransform: 'none', color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 11 },
  radioRow:    { display: 'flex', gap: 20 },
  radioLabel:  { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  urlRow:      { display: 'flex', gap: 10 },
  urlInput:    { flex: 1, fontSize: 13, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '7px 12px', color: 'var(--tx)', background: '#fff' },
  hint:        { fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '6px 0 0' },
  linkRow:     { display: 'flex', alignItems: 'center', gap: 10 },
  linkLabel:   { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', width: 56, flexShrink: 0 },
  linkInput:   { flex: 1, fontSize: 12, fontFamily: '"Space Mono",monospace', border: '1px solid var(--bd)', borderRadius: 7, padding: '6px 10px', color: 'var(--tx2)', background: 'var(--bgc)', cursor: 'text' },
  copyBtn:     { background: 'none', border: '1px solid var(--bd)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--pk)', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const colors = {
    completed:  { bg: '#f0fdf4', color: '#15803d' },
    expired:    { bg: '#fef2f2', color: '#b91c1c' },
    link_sent:  { bg: '#eff6ff', color: '#1d4ed8' },
    pending:    { bg: '#f4f4f5', color: '#52525b' },
    unlocked:   { bg: '#fef9c3', color: '#92400e' },
  }
  const c = colors[status] ?? colors.pending
  return (
    <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, borderRadius: 6, padding: '2px 7px', background: c.bg, color: c.color }}>
      {status}
    </span>
  )
}

function Chip({ children }) {
  return <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--pkb)', color: 'var(--pk)', borderRadius: 6, padding: '2px 7px' }}>{children}</span>
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const S = {
  backLink:      { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  backLinkBtn:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, marginBottom: 12, fontFamily: '"DM Sans",system-ui,sans-serif' },
  h1:            { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub:           { fontSize: 13, color: 'var(--tx2)', margin: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  sep:           { color: 'var(--tx3)' },
  typePill:      { fontFamily: '"Space Mono",monospace', fontSize: 10, background: 'var(--pkb)', color: 'var(--pk)', borderRadius: 6, padding: '2px 7px' },
  sectionTitle:  { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  muted:         { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  empty:         { textAlign: 'center', padding: '40px 0' },
  emptyText:     { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 18, color: 'var(--tx)', margin: '0 0 6px' },
  emptyHint:     { fontSize: 13, color: 'var(--tx2)', margin: 0 },
  addForm:       { display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  input:         { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', minWidth: 240 },
  errMsg:        { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 12 },
  successMsg:    { fontSize: 13, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', marginBottom: 12 },
  tableWrap:     { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table:         { width: '100%', borderCollapse: 'collapse' },
  th:            { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr:            { borderBottom: '1px solid var(--bd)' },
  td:            { padding: '12px 16px', verticalAlign: 'middle' },
  pName:         { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--tx)' },
  mono:          { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)' },
  actions:       { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  actionBtn:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnPrimary:    { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  overlay:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dialog:        { background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' },
  dialogTitle:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '0 0 10px' },
  formCard:      { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px' },
}
