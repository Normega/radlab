import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { generateSchedule, issueLink } from '../../lib/scheduleGenerator'

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useStudy(id) {
  return useQuery({
    queryKey: ['study-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studies')
        .select(`
          id, name, created_at, messaging_required,
          consent_required, active_consent_form_id, active_debrief_form_id,
          study_protocol_assignments(
            study_protocols(id, label, protocol_type)
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      const protocol = data.study_protocol_assignments?.[0]?.study_protocols
      return { ...data, protocol }
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

function useParticipantConsent(studyId, participantId) {
  return useQuery({
    queryKey: ['participant-consent', studyId, participantId],
    enabled: !!studyId && !!participantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('participant_consents')
        .select('id, consented_at, study_consent_forms(uploaded_at)')
        .eq('study_id', studyId)
        .eq('participant_id', participantId)
        .maybeSingle()
      return data
    },
  })
}

function useParticipants(studyId) {
  return useQuery({
    queryKey: ['study-participants', studyId],
    queryFn: async () => {
      const { data: consents, error } = await supabase
        .from('participant_consent')
        .select('id, participant_id, consented_at, withdrawn_at, email_reminders, profiles(id, display_name)')
        .eq('study_id', studyId)
        .is('withdrawn_at', null)
        .order('consented_at')
      if (error) throw error

      const participantIds = consents.map(c => c.participant_id)
      if (!participantIds.length) return []

      const { data: schedule } = await supabase
        .from('participant_schedule')
        .select('id, participant_id, status, completed_at')
        .eq('study_id', studyId)
        .in('participant_id', participantIds)

      const schedMap = {}
      for (const row of (schedule ?? [])) {
        if (!schedMap[row.participant_id]) schedMap[row.participant_id] = []
        schedMap[row.participant_id].push(row)
      }

      return consents.map(c => {
        const rows = schedMap[c.participant_id] ?? []
        const total = rows.length
        const completed = rows.filter(r => r.status === 'completed').length
        const lastActive = rows
          .map(r => r.completed_at)
          .filter(Boolean)
          .sort()
          .at(-1)
        return {
          consentId: c.id,
          participantId: c.participant_id,
          displayName: c.profiles?.display_name || '—',
          enrolledAt: c.consented_at,
          emailReminders: c.email_reminders,
          total,
          completed,
          lastActive,
        }
      })
    },
    enabled: !!studyId,
  })
}

function useParticipantSchedule(studyId, participantId) {
  return useQuery({
    queryKey: ['participant-schedule', studyId, participantId],
    enabled: !!studyId && !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_schedule')
        .select(`
          id, study_day, period_of_day, scheduled_for, status,
          completed_at, attempts, link_id,
          participant_links:link_id(id, token, status, expires_at)
        `)
        .eq('study_id', studyId)
        .eq('participant_id', participantId)
        .order('scheduled_for', { ascending: true, nullsFirst: true })
      if (error) throw error
      return data
    },
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudyDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { data: study, isLoading: studyLoading } = useStudy(id)
  const { data: participants = [], isLoading: participantsLoading } = useParticipants(id)

  const [selectedParticipant, setSelectedParticipant] = useState(null)
  const [addEmail, setAddEmail] = useState('')
  const [addError, setAddError] = useState(null)
  const [addSuccess, setAddSuccess] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const addParticipant = useMutation({
    mutationFn: async (email) => {
      const { data: userId, error: pe } = await supabase
        .rpc('get_user_id_by_email', { lookup_email: email.trim().toLowerCase() })
      if (pe) throw pe
      if (!userId) throw new Error(`No account found for ${email}. They need to sign up first.`)

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', userId)
        .single()

      const existing = await supabase
        .from('participant_consent')
        .select('id')
        .eq('participant_id', profile.id)
        .eq('study_id', id)
        .is('withdrawn_at', null)
        .maybeSingle()
      if (existing.data) throw new Error('This participant is already enrolled in this study.')

      const messagingBasis = study?.messaging_required ? 'research_exemption' : 'explicit_consent'
      const { error: ce } = await supabase.from('participant_consent').insert({
        participant_id: profile.id,
        study_id: id,
        messaging_basis: messagingBasis,
      })
      if (ce) throw ce

      const protocol = study?.protocol
      if (!protocol) throw new Error('No protocol assigned to this study.')

      const scheduleRows = await generateSchedule(profile.id, protocol.id, new Date())

      if (scheduleRows?.length) {
        const rowIds = scheduleRows.map(r => r.id)
        await supabase.from('participant_schedule').update({ study_id: id }).in('id', rowIds)
      }

      if (protocol.protocol_type === 'single_shot' && scheduleRows?.length) {
        await issueLink(scheduleRows[0].id)
      }

      return profile?.display_name || email
    },
    onSuccess: (name) => {
      qc.invalidateQueries({ queryKey: ['study-participants', id] })
      qc.invalidateQueries({ queryKey: ['study-detail', id] })
      setAddEmail('')
      setAddSuccess(`${name} enrolled successfully.`)
      setAddError(null)
      setShowAddForm(false)
    },
    onError: (e) => { setAddError(e.message); setAddSuccess(null) },
  })

  if (studyLoading) return <p style={S.muted}>Loading…</p>

  const protocol = study?.protocol

  return (
    <div>
      <div style={S.header}>
        <div>
          <Link to="/admin/studies" style={S.backLink}>← Studies</Link>
          <h1 style={S.h1}>{study?.name}</h1>
          <p style={S.sub}>
            {protocol?.label ?? '—'}
            {protocol?.protocol_type && (
              <span style={S.typePill}>{protocol.protocol_type === 'single_shot' ? 'one-time' : 'scheduled'}</span>
            )}
            <span style={S.sep}>·</span>
            {fmtDate(study?.created_at)}
            <span style={S.sep}>·</span>
            {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
          </p>
        </div>
      </div>

      {selectedParticipant ? (
        <ScheduleView
          studyId={id}
          participant={selectedParticipant}
          onBack={() => setSelectedParticipant(null)}
          qc={qc}
        />
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={S.sectionTitle}>Participants</h2>
            <button style={S.btnPrimary} onClick={() => { setShowAddForm(v => !v); setAddError(null); setAddSuccess(null) }}>
              {showAddForm ? 'Cancel' : '+ Add participant'}
            </button>
          </div>

          {showAddForm && (
            <div style={S.addForm}>
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="participant@email.com"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addParticipant.mutate(addEmail)}
              />
              <button
                style={{ ...S.btnPrimary, opacity: addParticipant.isPending ? 0.7 : 1 }}
                onClick={() => { setAddError(null); addParticipant.mutate(addEmail) }}
                disabled={addParticipant.isPending}
              >
                {addParticipant.isPending ? 'Enrolling…' : 'Enroll'}
              </button>
            </div>
          )}

          {addError && <p style={S.errMsg}>{addError}</p>}
          {addSuccess && <p style={S.successMsg}>{addSuccess}</p>}

          {participantsLoading ? (
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
                    {['Name', 'Enrolled', 'Progress', 'Last active', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.participantId} style={S.tr}>
                      <td style={S.td}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={S.pName}>{p.displayName}</span>
                          {p.emailReminders === false && (
                            <span title="Unsubscribed from email reminders" style={S.emailOffBadge}>email off</span>
                          )}
                        </span>
                      </td>
                      <td style={S.td}><span style={S.mono}>{fmtDate(p.enrolledAt)}</span></td>
                      <td style={S.td}>
                        {p.total > 0
                          ? <Chip>{p.completed} / {p.total} completed</Chip>
                          : <span style={S.muted}>—</span>}
                      </td>
                      <td style={S.td}>
                        {p.lastActive
                          ? <span style={S.mono}>{fmtDate(p.lastActive)}</span>
                          : <span style={S.muted}>—</span>}
                      </td>
                      <td style={S.td}>
                        <div style={S.actions}>
                          <button style={S.actionBtn} onClick={() => setSelectedParticipant(p)}>
                            View schedule
                          </button>
                          {p.emailReminders === false && (
                            <ReenableButton participantId={p.participantId} studyId={id} qc={qc} />
                          )}
                          <RevokeButton participantId={p.participantId} studyId={id} qc={qc} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ConsentFormSection study={study} qc={qc} />
          <DebriefFormSection study={study} qc={qc} />
        </div>
      )}
    </div>
  )
}

// ─── Consent form section ─────────────────────────────────────────────────────

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

// ─── Debrief form section ─────────────────────────────────────────────────────

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

// ─── Schedule view ────────────────────────────────────────────────────────────

function ScheduleView({ studyId, participant, onBack, qc }) {
  const { data: rows = [], isLoading } = useParticipantSchedule(studyId, participant.participantId)
  const [copied, setCopied] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [testModal, setTestModal] = useState({ open: false, scheduleId: null })
  const [testEmail, setTestEmail] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function openTestModal(scheduleId) {
    const { data: { user } } = await supabase.auth.getUser()
    setTestEmail(user?.email ?? '')
    setTestModal({ open: true, scheduleId })
  }

  async function sendTest() {
    setTestSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send_message', {
        body: { schedule_instance_id: testModal.scheduleId, test_override_email: testEmail },
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error ?? 'Send failed')
      setToast({ msg: `Test email sent to ${testEmail}`, type: 'success' })
    } catch (e) {
      setToast({ msg: e.message, type: 'error' })
    } finally {
      setTestSending(false)
      setTestModal({ open: false, scheduleId: null })
    }
  }

  const issueLinkMutation = useMutation({
    mutationFn: async (scheduleId) => {
      return issueLink(scheduleId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participant-schedule', studyId, participant.participantId] })
      qc.invalidateQueries({ queryKey: ['study-participants', studyId] })
    },
    onError: (e) => setActionError(e.message),
  })

  const revokeLink = useMutation({
    mutationFn: async ({ linkId, scheduleId }) => {
      await supabase.from('participant_links').update({ status: 'revoked' }).eq('id', linkId)
      await supabase.from('participant_schedule').update({ status: 'pending', link_id: null }).eq('id', scheduleId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participant-schedule', studyId, participant.participantId] })
    },
    onError: (e) => setActionError(e.message),
  })

  async function copyLink(token) {
    const url = `${window.location.origin}/s/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const { data: consentRecord } = useParticipantConsent(studyId, participant.participantId)

  return (
    <div>
      <button style={S.backLinkBtn} onClick={onBack}>← Back to participants</button>
      <h2 style={S.sectionTitle} >{participant.displayName}'s Schedule</h2>
      <p style={{ fontSize: 13, color: 'var(--tx2)', margin: '0 0 8px' }}>{participant.email}</p>

      <div style={S.consentAudit}>
        {consentRecord
          ? <>
              Consented {fmtDate(consentRecord.consented_at)}
              {consentRecord.study_consent_forms?.uploaded_at
                ? <> · form version {fmtDate(consentRecord.study_consent_forms.uploaded_at)}</>
                : null}
            </>
          : 'No consent record on file'}
      </div>

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
                {['Check-in', 'Scheduled for', 'Status', 'Completed at', 'Attempts', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const link = row.participant_links
                const canIssue = row.status === 'pending' && !link
                const canRevoke = link?.status === 'active'
                const rowBg = row.status === 'completed' ? '#f0fdf4'
                  : row.status === 'expired' ? '#fef2f2'
                  : 'transparent'

                return (
                  <tr key={row.id} style={{ ...S.tr, background: rowBg }}>
                    <td style={S.td}>
                      <span style={S.mono}>
                        {row.study_day != null ? `Day ${row.study_day}` : '—'}
                        {row.period_of_day ? ` · ${row.period_of_day}` : ''}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={S.mono}>{row.scheduled_for ? fmtDateTime(row.scheduled_for) : '—'}</span>
                    </td>
                    <td style={S.td}><StatusBadge status={row.status} /></td>
                    <td style={S.td}>
                      <span style={S.mono}>{row.completed_at ? fmtDateTime(row.completed_at) : '—'}</span>
                    </td>
                    <td style={S.td}>
                      <span style={S.mono}>{row.attempts ?? 0}</span>
                    </td>
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
                            disabled={revokeLink.isPending}
                          >
                            Revoke
                          </button>
                        )}
                        {link?.token && link.status === 'active' && (
                          <button
                            style={S.actionBtn}
                            onClick={() => copyLink(link.token)}
                          >
                            {copied === link.token ? 'Copied!' : 'Copy link'}
                          </button>
                        )}
                        {['pending', 'link_sent', 'unlocked'].includes(row.status) && (
                          <button
                            style={{ ...S.actionBtn, color: 'var(--pk)' }}
                            onClick={() => openTestModal(row.id)}
                          >
                            Send test
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

      {/* Send test modal */}
      {testModal.open && (
        <div style={S.overlay} onClick={() => setTestModal({ open: false, scheduleId: null })}>
          <div style={S.dialog} onClick={e => e.stopPropagation()}>
            <h3 style={S.dialogTitle}>Send test email</h3>
            <p style={S.dialogBody}>
              This sends a test version of this scheduled message to your email address. It will not affect
              the participant's schedule or consent record.
            </p>
            <label style={S.dialogLabel}>Send to</label>
            <input
              style={{ ...S.input, width: '100%', marginBottom: 20, boxSizing: 'border-box' }}
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                style={{ ...S.actionBtn, padding: '8px 16px', border: '1px solid var(--bd)', borderRadius: 8 }}
                onClick={() => setTestModal({ open: false, scheduleId: null })}
                disabled={testSending}
              >
                Cancel
              </button>
              <button
                style={{ ...S.btnPrimary, opacity: testSending ? 0.7 : 1 }}
                onClick={sendTest}
                disabled={testSending || !testEmail}
              >
                {testSending ? 'Sending…' : 'Send test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? '#22c55e' : '#ef4444' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Revoke access button ─────────────────────────────────────────────────────

function RevokeButton({ participantId, studyId, qc }) {
  const [confirming, setConfirming] = useState(false)

  const revoke = useMutation({
    mutationFn: async () => {
      await supabase
        .from('participant_consent')
        .update({ withdrawn_at: new Date().toISOString() })
        .eq('participant_id', participantId)
        .eq('study_id', studyId)
        .is('withdrawn_at', null)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-participants', studyId] })
      setConfirming(false)
    },
  })

  if (!confirming) {
    return (
      <button style={{ ...S.actionBtn, color: '#e04' }} onClick={() => setConfirming(true)}>
        Revoke access
      </button>
    )
  }

  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--tx2)' }}>Sure?</span>
      <button style={{ ...S.actionBtn, color: '#e04' }} onClick={() => revoke.mutate()} disabled={revoke.isPending}>
        Yes
      </button>
      <button style={S.actionBtn} onClick={() => setConfirming(false)}>No</button>
    </span>
  )
}

// ─── Re-enable email reminders button ────────────────────────────────────────

function ReenableButton({ participantId, studyId, qc }) {
  const [confirming, setConfirming] = useState(false)

  const reenable = useMutation({
    mutationFn: async () => {
      await supabase
        .from('participant_consent')
        .update({ email_reminders: true })
        .eq('participant_id', participantId)
        .eq('study_id', studyId)
        .is('withdrawn_at', null)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-participants', studyId] })
      setConfirming(false)
    },
  })

  if (!confirming) {
    return (
      <button style={{ ...S.actionBtn, color: 'var(--pk)' }} onClick={() => setConfirming(true)}>
        Re-enable email
      </button>
    )
  }

  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--tx2)' }}>Re-enable email reminders?</span>
      <button style={{ ...S.actionBtn, color: 'var(--pk)' }} onClick={() => reenable.mutate()} disabled={reenable.isPending}>
        Yes
      </button>
      <button style={S.actionBtn} onClick={() => setConfirming(false)}>No</button>
    </span>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const colors = {
    completed:  { bg: '#f0fdf4', color: '#15803d' },
    expired:    { bg: '#fef2f2', color: '#b91c1c' },
    link_sent:  { bg: '#eff6ff', color: '#1d4ed8' },
    pending:    { bg: '#f4f4f5', color: '#52525b' },
    unlocked:   { bg: '#fef9c3', color: '#92400e' },
    blocked:    { bg: '#fef2f2', color: '#b91c1c' },
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

function fmtDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const S = {
  header: { marginBottom: 28 },
  backLink: { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  backLinkBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, marginBottom: 12, fontFamily: '"DM Sans",system-ui,sans-serif' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub: { fontSize: 13, color: 'var(--tx2)', margin: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  sep: { color: 'var(--tx3)' },
  typePill: { fontFamily: '"Space Mono",monospace', fontSize: 10, background: 'var(--pkb)', color: 'var(--pk)', borderRadius: 6, padding: '2px 7px' },
  sectionTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  muted: { fontSize: 14, color: 'var(--tx3)' },
  mono: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', display: 'block' },
  empty: { textAlign: 'center', padding: '40px 0' },
  emptyText: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 18, color: 'var(--tx)', margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: 'var(--tx2)', margin: 0 },
  addForm: { display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  input: { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', minWidth: 240 },
  errMsg: { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 12 },
  successMsg: { fontSize: 13, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', marginBottom: 12 },
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr: { borderBottom: '1px solid var(--bd)' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  pName: { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--tx)' },
  emailOffBadge: { fontFamily: '"Space Mono",monospace', fontSize: 10, background: '#f5f5f5', color: '#abadb0', borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' },
  pEmail: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', display: 'block' },
  actions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnPrimary: { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dialog: { background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' },
  dialogTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '0 0 10px' },
  dialogBody: { fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 18px' },
  dialogLabel: { display: 'block', fontSize: 12, fontFamily: '"Space Mono",monospace', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 },
  toast: { position: 'fixed', bottom: 24, right: 24, color: '#fff', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 100, maxWidth: 340 },
  formCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px' },
  consentAudit: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', marginBottom: 16 },
}
