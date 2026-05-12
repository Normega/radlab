import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

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
          enrollment_protocol_id,
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

          {days.map((day, di) => (
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

              {day.contacts.map((c, ci) => (
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
    </div>
  )
}

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
}
