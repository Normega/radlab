import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const TEMPLATE_VARS = ['{{first_name}}', '{{study_day}}', '{{link_url}}', '{{expires_hours}}']

const DEFAULT_EMAIL_BODY = `Hi {{first_name}},

Your session for Study Day {{study_day}} is ready.

Click the button below to begin. This link is personal to you — please don't share it.

This link will expire in {{expires_hours}} hours.

Thanks for participating,
The RADlab Team
University of Toronto Mississauga`

// Preview sample values
const PREVIEW_VARS = {
  first_name:    'Alex',
  study_day:     '3',
  link_url:      'https://radlab.zone/s/example-token',
  expires_hours: '48',
}

function resolvePreviewVars(template) {
  return template
    .replace(/\{\{first_name\}\}/g,    PREVIEW_VARS.first_name)
    .replace(/\{\{study_day\}\}/g,     PREVIEW_VARS.study_day)
    .replace(/\{\{link_url\}\}/g,      PREVIEW_VARS.link_url)
    .replace(/\{\{expires_hours\}\}/g, PREVIEW_VARS.expires_hours)
}

function buildPreviewHtml(customBody) {
  const bodyText = resolvePreviewVars(customBody.trim() || DEFAULT_EMAIL_BODY)
  const bodyHtml = bodyText
    .split(/\n\n+/)
    .map(para =>
      `<p style="margin:0 0 16px 0;font-size:15px;color:#1c1c1e;line-height:1.6;">${para.replace(/\n/g, '<br>')}</p>`
    )
    .join('\n')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RADlab</title></head>
<body style="margin:0;padding:0;background-color:#FCF0F5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FCF0F5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 0 24px 0;">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1c1c1e;font-weight:normal;">RADlab</p>
          <p style="margin:4px 0 0 0;font-size:12px;color:#abadb0;">Regulatory and Affective Dynamics Lab · University of Toronto Mississauga</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          ${bodyHtml}
          <table cellpadding="0" cellspacing="0" style="margin:32px 0 0 0;"><tr>
            <td style="background-color:#f068a4;border-radius:8px;">
              <a href="${PREVIEW_VARS.link_url}" style="display:inline-block;padding:14px 32px;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;">Begin session →</a>
            </td>
          </tr></table>
          <p style="margin:16px 0 0 0;font-size:12px;color:#abadb0;">Or copy this link: <a href="${PREVIEW_VARS.link_url}" style="color:#f068a4;word-break:break-all;">${PREVIEW_VARS.link_url}</a></p>
          <p style="margin:24px 0 0 0;font-size:12px;color:#abadb0;border-top:1px solid #f5f5f5;padding-top:16px;">This link expires in ${PREVIEW_VARS.expires_hours} hours and is personal to you — please don't share it.</p>
        </td></tr>
        <tr><td style="padding:24px 0 0 0;">
          <p style="margin:0;font-size:11px;color:#abadb0;line-height:1.6;">You are receiving this because you enrolled in a study at RADlab, University of Toronto Mississauga. If you believe this was sent in error, please contact your researcher.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useProtocol(id) {
  return useQuery({
    queryKey: ['study-protocol', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_protocols')
        .select(`
          id, label, protocol_type, allow_restart, max_attempts,
          reminders_enabled, reminder_interval_hours, reminder_max,
          enrollment_protocol_id, email_subject, email_body,
          protocol_study_days(
            id, day_number, day_of_week, label,
            protocol_day_contacts(
              id, send_time, session_template_id, link_expires_hours, label, contact_order
            )
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

function useSessionTemplates() {
  return useQuery({
    queryKey: ['session-templates-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_templates')
        .select('id, label')
        .order('label')
      if (error) throw error
      return data
    },
  })
}

function useOtherProtocols(currentId) {
  return useQuery({
    queryKey: ['protocols-for-enrollment', currentId],
    queryFn: async () => {
      let q = supabase.from('study_protocols').select('id, label, protocol_type').order('label')
      if (currentId) q = q.neq('id', currentId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

function newContact(orderIndex = 0) {
  return { _key: `c-${Date.now()}-${Math.random()}`, send_time: '09:00', session_template_id: '', link_expires_hours: 48, label: '', order_index: orderIndex }
}

function newDay(dayNumber) {
  return { _key: `d-${Date.now()}-${Math.random()}`, day_number: dayNumber, day_of_week: 'mon', label: '', contacts: [newContact(0)] }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProtocolBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isNew = !id

  const { data: existing, isLoading } = useProtocol(id)
  const { data: sessions = [] } = useSessionTemplates()
  const { data: otherProtocols = [] } = useOtherProtocols(id)

  const [label, setLabel] = useState('')
  const [protocolType, setProtocolType] = useState('single_shot')
  const [singleShotSession, setSingleShotSession] = useState('')
  const [allowRestart, setAllowRestart] = useState(false)
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [reminderInterval, setReminderInterval] = useState(24)
  const [maxReminders, setMaxReminders] = useState(2)
  const [enrollmentProtocolId, setEnrollmentProtocolId] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [days, setDays] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!existing) return
    setLabel(existing.label ?? '')
    setProtocolType(existing.protocol_type ?? 'single_shot')
    setAllowRestart(existing.allow_restart ?? false)
    setMaxAttempts(existing.max_attempts ?? 3)
    setRemindersEnabled(existing.reminders_enabled ?? false)
    setReminderInterval(existing.reminder_interval_hours ?? 24)
    setMaxReminders(existing.reminder_max ?? 2)
    setEnrollmentProtocolId(existing.enrollment_protocol_id ?? '')
    setEmailSubject(existing.email_subject ?? '')
    setEmailBody(existing.email_body ?? '')

    const sortedDays = [...(existing.protocol_study_days ?? [])].sort((a, b) => a.day_number - b.day_number)
    setDays(sortedDays.map(d => ({
      _key: `d-${d.id}`,
      day_number: d.day_number,
      day_of_week: d.day_of_week ?? 'mon',
      label: d.label ?? '',
      contacts: [...(d.protocol_day_contacts ?? [])].sort((a, b) => (a.contact_order ?? 0) - (b.contact_order ?? 0)).map(c => ({
        _key: `c-${c.id}`,
        send_time: c.send_time ?? '09:00',
        session_template_id: c.session_template_id ?? '',
        link_expires_hours: c.link_expires_hours ?? 48,
        label: c.label ?? '',
        contact_order: c.contact_order ?? 0,
      })),
    })))

    if (existing.protocol_type === 'single_shot' && existing.protocol_study_days?.length) {
      const firstContact = existing.protocol_study_days[0]?.protocol_day_contacts?.[0]
      if (firstContact) setSingleShotSession(firstContact.session_template_id ?? '')
    }
  }, [existing])

  function updateDay(key, field, value) {
    setDays(prev => prev.map(d => d._key === key ? { ...d, [field]: value } : d))
  }

  function updateContact(dayKey, contactKey, field, value) {
    setDays(prev => prev.map(d => {
      if (d._key !== dayKey) return d
      return { ...d, contacts: d.contacts.map(c => c._key === contactKey ? { ...c, [field]: value } : c) }
    }))
  }

  function addDay() {
    const nextNum = days.length ? Math.max(...days.map(d => d.day_number)) + 1 : 1
    setDays(prev => [...prev, newDay(nextNum)])
  }

  function removeDay(key) {
    setDays(prev => prev.filter(d => d._key !== key))
  }

  function addContact(dayKey) {
    setDays(prev => prev.map(d => {
      if (d._key !== dayKey) return d
      return { ...d, contacts: [...d.contacts, newContact(d.contacts.length)] }
    }))
  }

  function removeContact(dayKey, contactKey) {
    setDays(prev => prev.map(d => {
      if (d._key !== dayKey) return d
      return { ...d, contacts: d.contacts.filter(c => c._key !== contactKey) }
    }))
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error('Label is required.')

      const payload = {
        label: label.trim(),
        protocol_type: protocolType,
        allow_restart: allowRestart,
        max_attempts: allowRestart ? Number(maxAttempts) : null,
        reminders_enabled: remindersEnabled,
        reminder_interval_hours: remindersEnabled ? Number(reminderInterval) : null,
        reminder_max: remindersEnabled ? Number(maxReminders) : null,
        enrollment_protocol_id: enrollmentProtocolId || null,
        email_subject: emailSubject.trim() || null,
        email_body: emailBody.trim() || null,
      }

      let protocolId = id
      if (isNew) {
        const { data: newP, error: pe } = await supabase.from('study_protocols').insert(payload).select('id').single()
        if (pe) throw pe
        protocolId = newP.id
      } else {
        const { error: pe } = await supabase.from('study_protocols').update(payload).eq('id', id)
        if (pe) throw pe
        await supabase.from('protocol_study_days').delete().eq('protocol_id', id)
      }

      if (protocolType === 'single_shot') {
        if (singleShotSession) {
          const { data: day, error: de } = await supabase
            .from('protocol_study_days')
            .insert({ protocol_id: protocolId, day_number: 1, day_of_week: 'mon', label: 'Session' })
            .select('id').single()
          if (de) throw de
          const { error: ce } = await supabase.from('protocol_day_contacts').insert({
            study_day_id: day.id,
            send_time: '00:00',
            session_template_id: singleShotSession,
            link_expires_hours: 48,
            contact_order: 0,
          })
          if (ce) throw ce
        }
      } else {
        for (const d of days) {
          const { data: dayRow, error: de } = await supabase
            .from('protocol_study_days')
            .insert({ protocol_id: protocolId, day_number: d.day_number, day_of_week: d.day_of_week, label: d.label || null })
            .select('id').single()
          if (de) throw de
          if (d.contacts.length) {
            const contacts = d.contacts.map((c, i) => ({
              study_day_id: dayRow.id,
              send_time: c.send_time,
              session_template_id: c.session_template_id || null,
              link_expires_hours: Number(c.link_expires_hours),
              label: c.label || null,
              contact_order: i,
            }))
            const { error: cce } = await supabase.from('protocol_day_contacts').insert(contacts)
            if (cce) throw cce
          }
        }
      }

      return protocolId
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ['study-protocols'] })
      qc.invalidateQueries({ queryKey: ['study-protocol', id] })
      navigate(`/admin/protocols/${newId}`)
    },
    onError: (e) => setError(e.message),
  })

  if (!isNew && isLoading) return <p style={S.muted}>Loading…</p>

  const previewSubject = resolvePreviewVars(emailSubject.trim() || 'Your RADlab session is ready')

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>{isNew ? 'New Protocol' : 'Edit Protocol'}</h1>
          <p style={S.sub}>Define the session schedule for a study.</p>
        </div>
        <button
          style={{ ...S.btnPrimary, opacity: save.isPending ? 0.7 : 1 }}
          onClick={() => { setError(null); save.mutate() }}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save protocol'}
        </button>
      </div>

      {error && <p style={S.errMsg}>{error}</p>}

      <div style={S.card}>
        <div style={S.fieldRow}>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>Label <Req /></label>
            <input style={S.input} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. 4-week wellness protocol" />
          </div>
        </div>

        <div style={S.fieldRow}>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>Protocol type</label>
            <div style={S.toggle}>
              {['single_shot', 'scheduled'].map(t => (
                <button
                  key={t}
                  style={{ ...S.toggleBtn, ...(protocolType === t ? S.toggleActive : {}) }}
                  onClick={() => setProtocolType(t)}
                >
                  {t === 'single_shot' ? 'Single shot' : 'Scheduled'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {protocolType === 'single_shot' && (
          <div style={S.fieldRow}>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>Session template</label>
              <select style={S.select} value={singleShotSession} onChange={e => setSingleShotSession(e.target.value)}>
                <option value="">— none —</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={S.fieldRow}>
          <Toggle label="Allow restart" checked={allowRestart} onChange={setAllowRestart} />
          {allowRestart && (
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>Max attempts</label>
              <input style={{ ...S.input, maxWidth: 100 }} type="number" min={1} value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} />
            </div>
          )}
        </div>

        <div style={S.fieldRow}>
          <Toggle label="Reminders" checked={remindersEnabled} onChange={setRemindersEnabled} />
          {remindersEnabled && (
            <>
              <div style={S.fieldGroup}>
                <label style={S.fieldLabel}>Interval (hours)</label>
                <input style={{ ...S.input, maxWidth: 100 }} type="number" min={1} value={reminderInterval} onChange={e => setReminderInterval(e.target.value)} />
              </div>
              <div style={S.fieldGroup}>
                <label style={S.fieldLabel}>Max reminders</label>
                <input style={{ ...S.input, maxWidth: 100 }} type="number" min={1} value={maxReminders} onChange={e => setMaxReminders(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div style={S.fieldRow}>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>Enrollment protocol (optional)</label>
            <select style={S.select} value={enrollmentProtocolId} onChange={e => setEnrollmentProtocolId(e.target.value)}>
              <option value="">— none —</option>
              {otherProtocols.map(p => <option key={p.id} value={p.id}>{p.label} ({p.protocol_type})</option>)}
            </select>
            <p style={S.hint}>Completing this protocol will automatically enroll participants in the selected one.</p>
          </div>
        </div>

        {/* ── Email message (collapsible) ── */}
        <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 14 }}>
          <button style={S.collapseToggle} onClick={() => setEmailOpen(v => !v)}>
            <span style={S.fieldLabel}>Email message</span>
            <span style={{ fontSize: 12, color: 'var(--tx3)', transform: emailOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.18s' }}>▾</span>
          </button>

          {emailOpen && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Subject */}
              <div style={S.fieldGroup}>
                <label style={S.fieldLabel}>Subject line</label>
                <input
                  style={S.input}
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Your RADlab session is ready"
                />
                <p style={S.hint}>Leave blank to use the default subject.</p>
              </div>

              {/* Body */}
              <div style={S.fieldGroup}>
                <label style={S.fieldLabel}>Message body</label>
                <textarea
                  style={{ ...S.input, minHeight: 160, resize: 'vertical', lineHeight: 1.6, fontFamily: '"DM Sans",system-ui,sans-serif' }}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={6}
                  placeholder={DEFAULT_EMAIL_BODY}
                />
                <p style={S.hint}>Leave blank to use the default message.</p>
              </div>

              {/* Variable pills */}
              <div>
                <p style={{ ...S.hint, marginBottom: 6 }}>Available variables (click to copy):</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TEMPLATE_VARS.map(v => (
                    <button
                      key={v}
                      style={S.varPill}
                      onClick={() => navigator.clipboard.writeText(v)}
                      title="Click to copy"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <button style={S.btnSecondary} onClick={() => setPreviewOpen(true)}>
                  Preview email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {protocolType === 'scheduled' && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={S.sectionTitle}>Study Days</h2>
            <button style={S.btnSecondary} onClick={addDay}>+ Add day</button>
          </div>

          {days.length === 0 && (
            <p style={S.muted}>No study days yet. Add one to start building the schedule.</p>
          )}

          {days.map((day) => (
            <div key={day._key} style={S.dayCard}>
              <div style={S.dayHeader}>
                <span style={S.dayNum}>Day {day.day_number}</span>
                <select style={{ ...S.select, width: 'auto' }} value={day.day_of_week} onChange={e => updateDay(day._key, 'day_of_week', e.target.value)}>
                  {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  style={{ ...S.input, flex: 1 }}
                  placeholder="Day label (optional)"
                  value={day.label}
                  onChange={e => updateDay(day._key, 'label', e.target.value)}
                />
                <button style={{ ...S.actionBtn, color: '#e04' }} onClick={() => removeDay(day._key)}>Remove day</button>
              </div>

              {day.contacts.map((c) => (
                <div key={c._key} style={S.contactRow}>
                  <div style={S.contactField}>
                    <label style={S.fieldLabel}>Send time</label>
                    <input style={{ ...S.input, maxWidth: 120 }} type="time" value={c.send_time} onChange={e => updateContact(day._key, c._key, 'send_time', e.target.value)} />
                  </div>
                  <div style={{ ...S.contactField, flex: 2 }}>
                    <label style={S.fieldLabel}>Session template</label>
                    <select style={S.select} value={c.session_template_id} onChange={e => updateContact(day._key, c._key, 'session_template_id', e.target.value)}>
                      <option value="">— none —</option>
                      {sessions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div style={S.contactField}>
                    <label style={S.fieldLabel}>Expires (hrs)</label>
                    <input style={{ ...S.input, maxWidth: 80 }} type="number" min={1} value={c.link_expires_hours} onChange={e => updateContact(day._key, c._key, 'link_expires_hours', e.target.value)} />
                  </div>
                  <div style={{ ...S.contactField, flex: 1 }}>
                    <label style={S.fieldLabel}>Label</label>
                    <input style={S.input} placeholder="optional" value={c.label} onChange={e => updateContact(day._key, c._key, 'label', e.target.value)} />
                  </div>
                  <button style={{ ...S.actionBtn, color: '#e04', alignSelf: 'flex-end', paddingBottom: 8 }} onClick={() => removeContact(day._key, c._key)}>×</button>
                </div>
              ))}

              <button style={S.addContactBtn} onClick={() => addContact(day._key)}>+ Add contact</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Preview modal ── */}
      {previewOpen && (
        <div style={S.overlay} onClick={() => setPreviewOpen(false)}>
          <div style={S.previewDialog} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <h3 style={{ ...S.sectionTitle, fontSize: 17, margin: 0 }}>Email preview</h3>
                <p style={{ ...S.hint, margin: '4px 0 0' }}>Subject: <em>{previewSubject}</em></p>
              </div>
              <button style={S.actionBtn} onClick={() => setPreviewOpen(false)}>Close</button>
            </div>
            <iframe
              srcDoc={buildPreviewHtml(emailBody)}
              style={{ width: '100%', height: 560, border: 'none', borderRadius: 8, marginTop: 12 }}
              title="Email preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function Req() {
  return <span style={{ color: '#e04' }}> *</span>
}

function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        role="switch"
        aria-checked={checked}
        style={{
          width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--pk)' : 'var(--bd)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
        onClick={() => onChange(!checked)}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 18 : 3, width: 16, height: 16,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
      <span style={{ fontSize: 13, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' }}>{label}</span>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  muted: { fontSize: 14, color: 'var(--tx3)', margin: '8px 0' },
  errMsg: { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 },
  card: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '20px 20px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 18 },
  fieldRow: { display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 },
  fieldLabel: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input: { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff' },
  select: { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', width: '100%' },
  hint: { fontSize: 12, color: 'var(--tx3)', margin: '4px 0 0', lineHeight: 1.5 },
  toggle: { display: 'flex', gap: 0, border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' },
  toggleBtn: { padding: '7px 16px', fontSize: 13, fontFamily: '"DM Sans",system-ui,sans-serif', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx2)' },
  toggleActive: { background: 'var(--pk)', color: '#fff' },
  collapseToggle: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', justifyContent: 'space-between' },
  varPill: { fontFamily: '"Space Mono",monospace', fontSize: 11, background: '#fce7f3', color: '#f068a4', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' },
  sectionTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  dayCard: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px', marginBottom: 12 },
  dayHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  dayNum: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--pk)', fontWeight: 700, flexShrink: 0 },
  contactRow: { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', borderTop: '1px solid var(--bd)', paddingTop: 10 },
  contactField: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 80 },
  addContactBtn: { background: 'none', border: '1px dashed var(--bd)', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', marginTop: 8 },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnPrimary: { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  btnSecondary: { background: 'none', border: '1px solid var(--bds)', borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  previewDialog: { background: '#fff', borderRadius: 14, padding: '24px 28px', maxWidth: 680, width: '95%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' },
}
