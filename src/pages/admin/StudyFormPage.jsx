import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import ProtocolBuilder from '../../components/study/ProtocolBuilder'

function useStudy(id) {
  return useQuery({
    queryKey: ['study-edit', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studies')
        .select('id, name, delivery_mode, protocol, active')
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

  const [name,         setName]         = useState('')
  const [deliveryMode, setDeliveryMode] = useState('in_person')
  const [steps,        setSteps]        = useState([])
  const [active,       setActive]       = useState(true)
  const [error,        setError]        = useState(null)

  useEffect(() => {
    if (existing) {
      setName(existing.name ?? '')
      setDeliveryMode(existing.delivery_mode ?? 'in_person')
      setSteps((existing.protocol ?? []).map(s => ({ ...s, id: s.id ?? crypto.randomUUID() })))
      setActive(existing.active ?? true)
    }
  }, [existing])

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Study name is required.')
      if (steps.length === 0) throw new Error('Add at least one protocol step.')

      const protocol = steps.map(({ id: _id, ...s }) => s)

      if (isEdit) {
        const { error } = await supabase
          .from('studies')
          .update({ name: name.trim(), delivery_mode: deliveryMode, protocol, active })
          .eq('id', id)
        if (error) throw error
        return id
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: study, error } = await supabase
          .from('studies')
          .insert({ name: name.trim(), delivery_mode: deliveryMode, protocol, active, created_by: user.id })
          .select('id')
          .single()
        if (error) throw error
        return study.id
      }
    },
    onSuccess: (studyId) => {
      qc.invalidateQueries({ queryKey: ['studies-list'] })
      qc.invalidateQueries({ queryKey: ['study-edit', id] })
      qc.invalidateQueries({ queryKey: ['study-detail', studyId] })
      navigate(`/admin/studies/${studyId}`)
    },
    onError: (e) => setError(e.message),
  })

  if (isEdit && loadingExisting) return <p style={S.muted}>Loading…</p>

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
        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Study name <span style={{ color: '#e04' }}>*</span></label>
          <input
            style={S.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Breath Belt Pilot — Spring 2026"
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Delivery mode</label>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { value: 'in_person', label: 'In-Person' },
              { value: 'remote',    label: 'Remote' },
            ].map(opt => (
              <label key={opt.value} style={S.radioLabel}>
                <input
                  type="radio"
                  name="deliveryMode"
                  value={opt.value}
                  checked={deliveryMode === opt.value}
                  onChange={() => setDeliveryMode(opt.value)}
                  style={{ accentColor: 'var(--pk)' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Protocol steps <span style={{ color: '#e04' }}>*</span></label>
          <ProtocolBuilder steps={steps} onChange={setSteps} />
        </div>

        <div style={S.fieldGroup}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              style={{
                width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: active ? 'var(--pk)' : 'var(--bd)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
              onClick={() => setActive(v => !v)}
            >
              <span style={{
                position: 'absolute', top: 3, left: active ? 18 : 3, width: 16, height: 16,
                borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
            <span style={S.toggleLabel}>Active</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  backLink:    { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  h1:          { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  muted:       { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  errMsg:      { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 },
  card:        { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 },
  fieldGroup:  { display: 'flex', flexDirection: 'column', gap: 8 },
  fieldLabel:  { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:       { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff' },
  radioLabel:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif', cursor: 'pointer' },
  toggleLabel: { fontSize: 13, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnPrimary:  { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
}
