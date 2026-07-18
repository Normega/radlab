// Contact settings popout for the Experiment Builder (WP7). Opened from a
// button inside ExperimentBuilder, not the first screen a study author sees.
// Writes directly to `studies` — separate from the design_graph save, so it
// can be opened/saved independently of the graph editor.
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

const EMAIL_VARS = ['{{first_name}}', '{{study_day}}', '{{link_url}}', '{{expires_hours}}']

function useContactSettings(studyId) {
  return useQuery({
    queryKey: ['study-contact-settings', studyId],
    enabled: !!studyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studies')
        .select('id, reminders_enabled, reminder_interval_hours, reminder_max, allow_restart, max_attempts, email_subject, email_body')
        .eq('id', studyId)
        .single()
      if (error) throw error
      return data
    },
  })
}

export default function ContactSettingsModal({ studyId, onClose }) {
  const qc = useQueryClient()
  const { data: existing, isLoading } = useContactSettings(studyId)

  const [remindersEnabled,     setRemindersEnabled]     = useState(false)
  const [reminderIntervalHours, setReminderIntervalHours] = useState('')
  const [reminderMax,          setReminderMax]          = useState('')
  const [allowRestart,         setAllowRestart]         = useState(false)
  const [maxAttempts,          setMaxAttempts]          = useState('')
  const [emailSubject,         setEmailSubject]         = useState('')
  const [emailBody,            setEmailBody]            = useState('')
  const [showPreview,          setShowPreview]          = useState(false)
  const [error,                setError]                = useState(null)

  useEffect(() => {
    if (!existing) return
    setRemindersEnabled(existing.reminders_enabled ?? false)
    setReminderIntervalHours(existing.reminder_interval_hours ?? 24)
    setReminderMax(existing.reminder_max ?? '')
    setAllowRestart(existing.allow_restart ?? false)
    setMaxAttempts(existing.max_attempts ?? 1)
    setEmailSubject(existing.email_subject ?? '')
    setEmailBody(existing.email_body ?? '')
  }, [existing])

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        reminders_enabled:      remindersEnabled,
        reminder_interval_hours: reminderIntervalHours ? Number(reminderIntervalHours) : 24,
        reminder_max:           reminderMax ? Number(reminderMax) : null,
        allow_restart:          allowRestart,
        max_attempts:           maxAttempts ? Number(maxAttempts) : 1,
        email_subject:          emailSubject || null,
        email_body:             emailBody || null,
      }
      const { error } = await supabase.from('studies').update(payload).eq('id', studyId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-contact-settings', studyId] })
      qc.invalidateQueries({ queryKey: ['study-detail', studyId] })
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  const previewHtml = (emailBody || '')
    .replace(/{{first_name}}/g, 'Alex')
    .replace(/{{study_day}}/g, '1')
    .replace(/{{link_url}}/g, 'https://radlab.zone/s/example-token')
    .replace(/{{expires_hours}}/g, String(reminderIntervalHours || 48))

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modalWrap} onClick={e => e.stopPropagation()}>
        <button style={S.closeBtn} onClick={onClose}>✕</button>

        <div style={S.card}>
          <div style={S.title}>Contact settings</div>

          {isLoading ? (
            <p style={S.muted}>Loading…</p>
          ) : (
            <>
              {error && <p style={S.errMsg}>{error}</p>}

              <div style={S.fieldGroup}>
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
                      <label style={S.fieldLabel}>Interval (hours)</label>
                      <input
                        type="number" min="1"
                        style={{ ...S.input, width: 100 }}
                        value={reminderIntervalHours}
                        onChange={e => setReminderIntervalHours(e.target.value)}
                        placeholder="24"
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
                  <label style={S.fieldLabel}>Max attempts (link re-sends per session)</label>
                  <input
                    type="number" min="1"
                    style={{ ...S.input, width: 100 }}
                    value={maxAttempts}
                    onChange={e => setMaxAttempts(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>

              <div style={S.fieldGroup}>
                <label style={S.fieldLabel}>Email subject</label>
                <input
                  style={S.input}
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Your RADlab session is ready"
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
                  placeholder="Hi! Your Study Day {{study_day}} session is ready: {{link_url}}"
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

              <div style={S.actions}>
                <button style={S.cancelBtn} onClick={onClose} disabled={save.isPending}>
                  Cancel
                </button>
                <button
                  style={{ ...S.saveBtn, opacity: save.isPending ? 0.7 : 1 }}
                  onClick={() => { setError(null); save.mutate() }}
                  disabled={save.isPending}
                >
                  {save.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}
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
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' },
  modalWrap: { position: 'relative', width: '100%', maxWidth: 620 },
  closeBtn:  { position: 'fixed', top: 16, right: 20, background: '#fff', border: '1px solid var(--bd)', borderRadius: '50%', width: 36, height: 36, fontSize: 16, cursor: 'pointer', color: 'var(--tx2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101 },
  card:      { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 },
  title:     { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 22, fontWeight: 400, color: 'var(--tx)' },
  muted:     { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  errMsg:    { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', margin: 0 },
  fieldGroup:{ display: 'flex', flexDirection: 'column', gap: 8 },
  fieldLabel:{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:     { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', width: '100%', boxSizing: 'border-box' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 10 },
  toggleLabel:{ fontSize: 14, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  varPill:   { fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 6, padding: '3px 8px', color: 'var(--pkd)', cursor: 'pointer' },
  previewBtn:{ fontSize: 13, color: 'var(--pkd)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', textDecoration: 'underline' },
  actions:   { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 16px', fontSize: 14, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  saveBtn:   { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
}
