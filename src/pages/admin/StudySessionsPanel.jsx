import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useStudySessions(studyId) {
  return useQuery({
    queryKey: ['study-sessions', studyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('id, day_number, send_time, link_expires_hours, label, order_index, session_templates(id, label)')
        .eq('study_id', studyId)
        .order('order_index', { ascending: true })
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
        .order('label', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

const BLANK_FORM = {
  session_template_id: '',
  day_number:          1,
  send_time:           '09:00',
  link_expires_hours:  48,
  label:               '',
}

export default function StudySessionsPanel({ study, qc }) {
  const studyId        = study.id
  const isLongitudinal = study.delivery_mode === 'online_longitudinal'

  const { data: sessions = [], isLoading } = useStudySessions(studyId)
  const { data: templates = [] }            = useSessionTemplates()

  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(BLANK_FORM)
  const [formErr,  setFormErr]  = useState(null)

  const addSession = useMutation({
    mutationFn: async () => {
      if (!form.session_template_id) throw new Error('Select a session template.')
      const nextOrder = sessions.length > 0 ? Math.max(...sessions.map(s => s.order_index)) + 1 : 0
      const { error } = await supabase.from('study_sessions').insert({
        study_id:            studyId,
        session_template_id: form.session_template_id,
        day_number:          isLongitudinal ? Number(form.day_number) : 1,
        send_time:           isLongitudinal ? form.send_time : '09:00',
        link_expires_hours:  Number(form.link_expires_hours),
        label:               form.label || null,
        order_index:         nextOrder,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-sessions', studyId] })
      setForm(BLANK_FORM)
      setShowForm(false)
      setFormErr(null)
    },
    onError: (e) => setFormErr(e.message),
  })

  const removeSession = useMutation({
    mutationFn: async (sessionId) => {
      const { error } = await supabase.from('study_sessions').delete().eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-sessions', studyId] }),
  })

  return (
    <div style={{ marginTop: 36 }}>
      <div style={S.sectionHeader}>
        <h2 style={S.sectionTitle}>Sessions</h2>
        <button style={S.btnOutline} onClick={() => { setShowForm(v => !v); setFormErr(null) }}>
          {showForm ? 'Cancel' : '+ Add session'}
        </button>
      </div>

      {showForm && (
        <div style={S.addForm}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
            <div style={S.formField}>
              <label style={S.fieldLabel}>Session template <span style={{ color: '#e04' }}>*</span></label>
              <select
                style={S.select}
                value={form.session_template_id}
                onChange={e => setForm(f => ({ ...f, session_template_id: e.target.value }))}
              >
                <option value="">Select…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            {isLongitudinal && (
              <>
                <div style={S.formField}>
                  <label style={S.fieldLabel}>Day #</label>
                  <input
                    type="number" min="1"
                    style={{ ...S.input, width: 70 }}
                    value={form.day_number}
                    onChange={e => setForm(f => ({ ...f, day_number: e.target.value }))}
                  />
                </div>
                <div style={S.formField}>
                  <label style={S.fieldLabel}>Send time</label>
                  <input
                    type="time"
                    style={{ ...S.input, width: 110 }}
                    value={form.send_time}
                    onChange={e => setForm(f => ({ ...f, send_time: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div style={S.formField}>
              <label style={S.fieldLabel}>Link expires (hrs)</label>
              <input
                type="number" min="1"
                style={{ ...S.input, width: 90 }}
                value={form.link_expires_hours}
                onChange={e => setForm(f => ({ ...f, link_expires_hours: e.target.value }))}
              />
            </div>

            <div style={S.formField}>
              <label style={S.fieldLabel}>Label (optional)</label>
              <input
                style={{ ...S.input, width: 160 }}
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Baseline"
              />
            </div>

            <button
              style={{ ...S.btnPrimary, alignSelf: 'flex-end', opacity: addSession.isPending ? 0.7 : 1 }}
              onClick={() => { setFormErr(null); addSession.mutate() }}
              disabled={addSession.isPending}
            >
              {addSession.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
          {formErr && <p style={S.errMsg}>{formErr}</p>}
        </div>
      )}

      {isLoading ? (
        <p style={S.muted}>Loading…</p>
      ) : sessions.length === 0 ? (
        <div style={S.empty}>
          <p style={S.emptyText}>No sessions yet. Add a session template to get started.</p>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {[
                  isLongitudinal && 'Day',
                  'Label',
                  'Session template',
                  isLongitudinal && 'Send time',
                  'Link expires',
                  '',
                ].filter(Boolean).map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={S.tr}>
                  {isLongitudinal && <td style={S.td}><span style={S.mono}>Day {s.day_number}</span></td>}
                  <td style={S.td}><span style={S.mono}>{s.label || '—'}</span></td>
                  <td style={S.td}>{s.session_templates?.label ?? '—'}</td>
                  {isLongitudinal && <td style={S.td}><span style={S.mono}>{s.send_time?.slice(0, 5)}</span></td>}
                  <td style={S.td}><span style={S.mono}>{s.link_expires_hours}h</span></td>
                  <td style={S.td}>
                    <button
                      style={S.removeBtn}
                      onClick={() => { if (window.confirm('Remove this session?')) removeSession.mutate(s.id) }}
                      disabled={removeSession.isPending}
                    >
                      Remove
                    </button>
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

const S = {
  sectionHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  btnPrimary:     { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnOutline:     { background: '#fff', color: 'var(--pk)', border: '1.5px solid var(--pk)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  addForm:        { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  formField:      { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel:     { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  select:         { fontSize: 13, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 10px', color: 'var(--tx)', background: '#fff', minWidth: 200 },
  input:          { fontSize: 13, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 10px', color: 'var(--tx)', background: '#fff' },
  errMsg:         { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', margin: 0 },
  muted:          { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  empty:          { textAlign: 'center', padding: '28px 0', border: '1px dashed var(--bd)', borderRadius: 10 },
  emptyText:      { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0 },
  tableWrap:      { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table:          { width: '100%', borderCollapse: 'collapse' },
  th:             { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr:             { borderBottom: '1px solid var(--bd)' },
  td:             { padding: '11px 14px', verticalAlign: 'middle', fontSize: 13, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  mono:           { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
  removeBtn:      { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--tx3)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
}
