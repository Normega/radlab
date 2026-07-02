// v2
import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const DELIVERY_MODES = [
  {
    value: 'in_person',
    label: 'In-Person',
    desc: 'RA-guided sessions on-site',
  },
  {
    value: 'online_single',
    label: 'Online, single session',
    desc: 'One-time link, no emails required',
  },
  {
    value: 'online_longitudinal',
    label: 'Online, longitudinal',
    desc: 'Multi-session, email scheduling',
  },
]

const EMAIL_VARS = ['{{first_name}}', '{{study_day}}', '{{link_url}}', '{{expires_hours}}']

function useStudy(id) {
  return useQuery({
    queryKey: ['study-edit', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studies')
        .select(`
          id, name, delivery_mode, active,
          allow_restart, reminders_enabled, reminder_interval_days, reminder_max,
          email_subject, email_body, design_graph
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

export default function StudyFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: existing, isLoading: loadingExisting } = useStudy(id)

  const [name,                 setName]                = useState('')
  const [deliveryMode,         setDeliveryMode]        = useState('in_person')
  const [active,               setActive]              = useState(true)
  const [allowRestart,         setAllowRestart]        = useState(false)
  const [remindersEnabled,     setRemindersEnabled]    = useState(false)
  const [reminderIntervalDays, setReminderIntervalDays]= useState('')
  const [reminderMax,          setReminderMax]         = useState('')
  const [emailSubject,         setEmailSubject]        = useState('')
  const [emailBody,            setEmailBody]           = useState('')
  const [showPreview,          setShowPreview]         = useState(false)
  const [error,                setError]               = useState(null)

  // Existing longitudinal studies are edited in the builder, not here.
  useEffect(() => {
    if (isEdit && existing?.delivery_mode === 'online_longitudinal') {
      navigate(`/admin/studies/${id}/design`, { replace: true })
    }
  }, [isEdit, existing?.delivery_mode, id, navigate])

  useEffect(() => {
    if (!existing) return
    setName(existing.name ?? '')
    setDeliveryMode(existing.delivery_mode ?? 'in_person')
    setActive(existing.active ?? true)
    setAllowRestart(existing.allow_restart ?? false)
    setRemindersEnabled(existing.reminders_enabled ?? false)
    setReminderIntervalDays(existing.reminder_interval_days ?? '')
    setReminderMax(existing.reminder_max ?? '')
    setEmailSubject(existing.email_subject ?? '')
    setEmailBody(existing.email_body ?? '')
  }, [existing])

  const isLongitudinal = deliveryMode === 'online_longitudinal'

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Study name is required.')

      const payload = {
        name:         name.trim(),
        delivery_mode: deliveryMode,
        active,
        // Longitudinal email/reminder settings live solely in ContactSettingsModal (WP7).
        // For non-longitudinal modes, persist the inline fields as before.
        ...(!isLongitudinal ? {
          allow_restart:          allowRestart,
          reminders_enabled:      remindersEnabled,
          reminder_interval_days: reminderIntervalDays ? Number(reminderIntervalDays) : null,
          reminder_max:           reminderMax ? Number(reminderMax) : null,
          email_subject:          emailSubject || null,
          email_body:             emailBody || null,
        } : {}),
      }

      if (isEdit) {
        const { error } = await supabase.from('studies').update(payload).eq('id', id)
        if (error) throw error
        return { studyId: id, isLongitudinal }
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: study, error } = await supabase
          .from('studies')
          .insert({ ...payload, created_by: user.id })
          .select('id')
          .single()
        if (error) throw error
        return { studyId: study.id, isLongitudinal }
      }
    },
    onSuccess: ({ studyId, isLongitudinal }) => {
      qc.invalidateQueries({ queryKey: ['studies-list'] })
      qc.invalidateQueries({ queryKey: ['study-edit', id] })
      qc.invalidateQueries({ queryKey: ['study-detail', studyId] })
      // Longitudinal studies go straight to the builder; others go to detail.
      navigate(isLongitudinal ? `/admin/studies/${studyId}/design` : `/admin/studies/${studyId}`)
    },
    onError: (e) => setError(e.message),
  })

  if (isEdit && loadingExisting) return <p style={S.muted}>Loading…</p>

  const previewHtml = (emailBody || '')
    .replace(/{{first_name}}/g, 'Alex')
    .replace(/{{study_day}}/g, '1')
    .replace(/{{link_url}}/g, 'https://radlab.zone/s/example-token')
    .replace(/{{expires_hours}}/g, '48')

  return (
    <div>
      <div style={S.header}>
        <div>
          <Link to="/admin/studies" style={S.backLink}>← Studies</Link>
          <h1 style={S.h1}>{isEdit ? 'Edit Study' : 'New Study'}</h1>
        </div>
        <button
          style={{ ...S.btnPrimary, opacity: save.isPending ? 0.7 : 1 }}
          onClick={() => { setError(null); save.mutate() }}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create study'}
        </button>
      </div>

      {error && <p style={S.errMsg}>{error}</p>}

      <div style={S.card}>
        {/* Study name */}
        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Study name <span style={{ color: '#e04' }}>*</span></label>
          <input
            style={S.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Breath Belt Pilot — Fall 2026"
          />
        </div>

        {/* Delivery mode — radio cards.
            Locked once a longitudinal study has a design_graph or enrollments. */}
        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Delivery mode</label>
          {existing?.design_graph && (
            <p style={{ ...S.muted, fontSize: 12, margin: '0 0 6px' }}>
              Mode locked — this study has a design graph.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DELIVERY_MODES.map(opt => {
              const selected  = deliveryMode === opt.value
              const modeLocked = isEdit && existing?.design_graph && opt.value !== existing.delivery_mode
              return (
                <label
                  key={opt.value}
                  style={{
                    ...S.modeCard,
                    borderColor: selected ? 'var(--pk)' : 'var(--bd)',
                    background:  selected ? '#fdf2f8' : '#fff',
                    opacity:     modeLocked ? 0.45 : 1,
                    cursor:      modeLocked ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="deliveryMode"
                    value={opt.value}
                    checked={selected}
                    onChange={() => !modeLocked && setDeliveryMode(opt.value)}
                    disabled={modeLocked}
                    style={{ accentColor: 'var(--pk)', marginTop: 1 }}
                  />
                  <div>
                    <div style={S.modeLabel}>{opt.label}</div>
                    <div style={S.modeDesc}>{opt.desc}</div>
                  </div>
                </label>
              )
            })}
          </div>
          {isLongitudinal && !isEdit && (
            <p style={{ ...S.muted, fontSize: 12, margin: '6px 0 0' }}>
              After creating, you'll be taken to the experiment builder to design the session timeline.
            </p>
          )}
          {isLongitudinal && isEdit && (
            <p style={{ ...S.muted, fontSize: 12, margin: '6px 0 0' }}>
              Email and reminder settings live in the builder's Contact Settings panel.
            </p>
          )}
        </div>

        {/* Email preferences — non-longitudinal only.
            Longitudinal studies configure email in the builder's Contact Settings. */}
        {!isLongitudinal && (
          <div style={S.emailPrefs}>
            <div style={S.emailPrefsTitle}>Email preferences</div>

            <div style={S.toggleRow}>
              <Toggle on={allowRestart} onChange={setAllowRestart} />
              <span style={S.toggleLabel}>Allow restart</span>
            </div>

            <div style={S.toggleRow}>
              <Toggle on={remindersEnabled} onChange={setRemindersEnabled} />
              <span style={S.toggleLabel}>Send reminders</span>
            </div>

            {remindersEnabled && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={S.fieldGroup}>
                  <label style={S.fieldLabel}>Interval (days)</label>
                  <input
                    type="number" min="1"
                    style={{ ...S.input, width: 100 }}
                    value={reminderIntervalDays}
                    onChange={e => setReminderIntervalDays(e.target.value)}
                    placeholder="3"
                  />
                </div>
                <div style={S.fieldGroup}>
                  <label style={S.fieldLabel}>Max reminders</label>
                  <input
                    type="number" min="1"
                    style={{ ...S.input, width: 100 }}
                    value={reminderMax}
                    onChange={e => setReminderMax(e.target.value)}
                    placeholder="2"
                  />
                </div>
              </div>
            )}

            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>Email subject</label>
              <input
                style={S.input}
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Your study session is ready"
              />
            </div>

            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>Email body</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {EMAIL_VARS.map(v => (
                  <button
                    key={v}
                    type="button"
                    style={S.varPill}
                    onClick={() => setEmailBody(b => b + v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <textarea
                style={{ ...S.input, minHeight: 120, resize: 'vertical' }}
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                placeholder="Hi {{first_name}}, your session link is ready: {{link_url}}"
              />
            </div>

            {emailBody && (
              <div>
                <button
                  type="button"
                  style={S.previewBtn}
                  onClick={() => setShowPreview(v => !v)}
                >
                  {showPreview ? 'Hide preview' : 'Preview email'}
                </button>
                {showPreview && (
                  <iframe
                    srcDoc={`<html><body style="font-family:sans-serif;font-size:14px;color:#1c1c1e;padding:16px;white-space:pre-wrap">${previewHtml}</body></html>`}
                    style={{ width: '100%', height: 200, border: '1px solid var(--bd)', borderRadius: 8, marginTop: 8 }}
                    title="Email preview"
                    sandbox=""
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Active toggle */}
        <div style={S.fieldGroup}>
          <div style={S.toggleRow}>
            <Toggle on={active} onChange={setActive} />
            <span style={S.toggleLabel}>Active</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      style={{
        width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: on ? 'var(--pk)' : '#d1d5db',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
      onClick={() => onChange(v => !v)}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 18 : 3, width: 16, height: 16,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

const S = {
  header:         { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  backLink:       { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  h1:             { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  muted:          { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  errMsg:         { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 },
  card:           { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 620 },
  fieldGroup:     { display: 'flex', flexDirection: 'column', gap: 8 },
  fieldLabel:     { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:          { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', width: '100%', boxSizing: 'border-box' },
  modeCard:       { display: 'flex', gap: 10, alignItems: 'flex-start', border: '1.5px solid', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' },
  modeLabel:      { fontSize: 14, fontWeight: 500, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  modeDesc:       { fontSize: 12, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif', marginTop: 2 },
  emailPrefs:     { display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 10, padding: '18px 20px' },
  emailPrefsTitle:{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--pkd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  toggleRow:      { display: 'flex', alignItems: 'center', gap: 10 },
  toggleLabel:    { fontSize: 14, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  varPill:        { fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--bgc)', border: '1px solid var(--pkb)', borderRadius: 6, padding: '3px 8px', color: 'var(--pkd)', cursor: 'pointer' },
  previewBtn:     { fontSize: 13, color: 'var(--pkd)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', textDecoration: 'underline' },
  btnPrimary:     { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
}
