import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useProtocols() {
  return useQuery({
    queryKey: ['protocols-for-study'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_protocols')
        .select('id, label, protocol_type')
        .order('label')
      if (error) throw error
      return data
    },
  })
}

export default function StudyBuilder() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: protocols = [] } = useProtocols()

  const [label, setLabel] = useState('')
  const [protocolId, setProtocolId] = useState('')
  const [messagingRequired, setMessagingRequired] = useState(false)
  const [error, setError] = useState(null)

  const save = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error('Study label is required.')
      if (!protocolId) throw new Error('Please select a protocol.')

      const { data: study, error: se } = await supabase
        .from('studies')
        .insert({ name: label.trim(), messaging_required: messagingRequired })
        .select('id').single()
      if (se) throw se

      const { error: ae } = await supabase
        .from('study_protocol_assignments')
        .insert({ study_id: study.id, protocol_id: protocolId })
      if (ae) throw ae

      return study.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['studies-list'] })
      navigate(`/admin/studies/${id}`)
    },
    onError: (e) => setError(e.message),
  })

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>New Study</h1>
          <p style={S.sub}>Enroll participants into a protocol.</p>
        </div>
        <button
          style={{ ...S.btnPrimary, opacity: save.isPending ? 0.7 : 1 }}
          onClick={() => { setError(null); save.mutate() }}
          disabled={save.isPending}
        >
          {save.isPending ? 'Creating…' : 'Create study'}
        </button>
      </div>

      {error && <p style={S.errMsg}>{error}</p>}

      <div style={S.card}>
        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Study label <span style={{ color: '#e04' }}>*</span></label>
          <input
            style={S.input}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Spring 2026 mindfulness cohort"
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Protocol <span style={{ color: '#e04' }}>*</span></label>
          <select style={S.select} value={protocolId} onChange={e => setProtocolId(e.target.value)}>
            <option value="">— select a protocol —</option>
            {protocols.map(p => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.protocol_type === 'single_shot' ? 'one-time' : 'scheduled'})
              </option>
            ))}
          </select>
          {protocols.length === 0 && (
            <p style={S.hint}>No protocols yet. <a href="/admin/protocols/new" style={{ color: 'var(--pk)' }}>Build one first.</a></p>
          )}
        </div>

        <div style={S.fieldGroup}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              role="switch"
              aria-checked={messagingRequired}
              style={{
                width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: messagingRequired ? 'var(--pk)' : 'var(--bd)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
              onClick={() => setMessagingRequired(v => !v)}
            >
              <span style={{
                position: 'absolute', top: 3, left: messagingRequired ? 18 : 3, width: 16, height: 16,
                borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
            <span style={S.toggleLabel}>Messaging required</span>
          </div>
          {messagingRequired && (
            <p style={S.notice}>
              Messaging will be treated as a participation requirement under the research exemption.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  errMsg: { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 },
  card: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input: { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff' },
  select: { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff' },
  hint: { fontSize: 12, color: 'var(--tx3)', margin: '4px 0 0' },
  toggleLabel: { fontSize: 13, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  notice: { fontSize: 12, color: 'var(--tx2)', background: '#fffbe6', border: '1px solid #ffe88a', borderRadius: 8, padding: '8px 12px', margin: '8px 0 0', lineHeight: 1.5 },
  btnPrimary: { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
}
