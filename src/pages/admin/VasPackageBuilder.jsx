import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import VasRenderer from '../../components/vas/VasRenderer'

function slugify(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function useScales() {
  return useQuery({
    queryKey: ['vas-scales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vas_scales').select('*').order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

export default function VasPackageBuilder() {
  const navigate = useNavigate()
  const { data: allScales = [], isLoading } = useScales()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [selectedIds, setSelectedIds] = useState([]) // ordered list of ids
  const [previewIdx,  setPreviewIdx]  = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [error,       setError]       = useState(null)

  const selectedScales = selectedIds
    .map(id => allScales.find(s => s.id === id))
    .filter(Boolean)

  function toggleScale(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function moveUp(idx) {
    if (idx === 0) return
    const next = [...selectedIds]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setSelectedIds(next)
  }

  function moveDown(idx) {
    if (idx >= selectedIds.length - 1) return
    const next = [...selectedIds]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    setSelectedIds(next)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim())           throw new Error('Package name is required.')
      if (selectedIds.length < 1) throw new Error('Select at least one scale.')

      const slug = slugify(name)
      const { data: { user } } = await supabase.auth.getUser()

      const { error: pkgErr } = await supabase.from('vas_packages').insert({
        slug,
        name: name.trim(),
        description: description.trim() || null,
        scale_ids: selectedIds,
        created_by: user.id,
      })
      if (pkgErr) throw pkgErr

      const { error: actErr } = await supabase.from('activities').insert({
        category:    'vas',
        subcategory: `vas_pkg_${slug}`,
        label:       `VAS Bundle – ${name.trim()}`,
        description: description.trim() || null,
      })
      if (actErr) console.warn('activities insert:', actErr.message)
    },
    onSuccess: () => navigate('/admin/vas'),
    onError:   e  => setError(e.message),
  })

  if (isLoading) return <p style={S.muted}>Loading scales…</p>

  return (
    <div>
      <h1 style={S.h1}>New VAS Package</h1>
      <p style={S.sub}>Bundle existing scales into a sequence for study sessions.</p>

      {error && <p style={S.errMsg}>{error}</p>}

      <div style={S.columns}>
        {/* Left: form */}
        <div style={S.panel}>
          <label style={S.label}>Package name *</label>
          <input
            style={S.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Pre-session mood"
          />
          {name && <p style={S.hint}>Slug: <code style={S.code}>{slugify(name)}</code></p>}

          <label style={{ ...S.label, marginTop: 14 }}>Description</label>
          <input
            style={S.input}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional notes"
          />

          <p style={{ ...S.label, marginTop: 20 }}>Scales (check to include, reorder with ↑↓)</p>

          {allScales.length === 0 && (
            <p style={S.muted}>No scales available. Upload a scale first.</p>
          )}

          {allScales.map(scale => {
            const checked = selectedIds.includes(scale.id)
            const idx     = selectedIds.indexOf(scale.id)
            return (
              <div key={scale.id} style={S.scaleRow}>
                <label style={S.checkLabel}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleScale(scale.id)}
                    style={{ margin: '0 8px 0 0' }}
                  />
                  <span style={S.chip}>{scale.slug}</span>
                  <span style={S.scaleQ}>{scale.question}</span>
                </label>
                {checked && (
                  <div style={S.reorder}>
                    <span style={S.orderBadge}>#{idx + 1}</span>
                    <button style={S.arrowBtn} onClick={() => moveUp(idx)}   disabled={idx === 0}>↑</button>
                    <button style={S.arrowBtn} onClick={() => moveDown(idx)} disabled={idx === selectedIds.length - 1}>↓</button>
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button
              style={{ ...S.saveBtn, opacity: save.isPending ? 0.7 : 1 }}
              onClick={() => { setError(null); save.mutate() }}
              disabled={save.isPending}
            >
              {save.isPending ? 'Creating…' : 'Create Package'}
            </button>
            <button style={S.cancelBtn} onClick={() => navigate('/admin/vas')}>Cancel</button>
          </div>
        </div>

        {/* Right: live preview */}
        <div style={S.panel}>
          <p style={S.panelTitle}>Live preview</p>

          {selectedScales.length === 0 ? (
            <p style={S.muted}>Select scales on the left to preview the sequence.</p>
          ) : showPreview ? (
            <>
              <VasRenderer
                key={selectedScales[previewIdx]?.id}
                scale={selectedScales[previewIdx]}
                previewMode
                partNumber={previewIdx + 1}
                totalParts={selectedScales.length}
                onComplete={() => {
                  const next = previewIdx + 1
                  if (next >= selectedScales.length) {
                    setShowPreview(false)
                    setPreviewIdx(0)
                  } else {
                    setPreviewIdx(next)
                  }
                }}
              />
              <button style={S.resetPreviewBtn} onClick={() => { setShowPreview(false); setPreviewIdx(0) }}>
                ✕ Close preview
              </button>
            </>
          ) : (
            <div style={S.previewSummary}>
              <p style={S.previewCount}>{selectedScales.length} scale{selectedScales.length !== 1 ? 's' : ''} selected</p>
              <ol style={S.previewList}>
                {selectedScales.map(s => (
                  <li key={s.id} style={S.previewItem}>
                    <span style={S.chip}>{s.slug}</span>
                    <span style={S.scaleQ}>{s.question}</span>
                  </li>
                ))}
              </ol>
              <button style={S.startPreviewBtn} onClick={() => { setPreviewIdx(0); setShowPreview(true) }}>
                ▶ Preview sequence
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  h1:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub:  { fontSize: 14, color: 'var(--tx2)', margin: '0 0 28px' },
  muted:  { fontSize: 14, color: 'var(--tx3)', margin: '8px 0' },
  errMsg: { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 },
  hint:   { fontSize: 12, color: 'var(--tx3)', margin: '4px 0 0' },
  code:   { fontFamily: '"Space Mono",monospace', fontSize: 11 },

  columns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' },
  panel:   { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '20px 18px' },
  panelTitle: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' },

  label: { display: 'block', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  input: { width: '100%', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', boxSizing: 'border-box' },

  scaleRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--bd)' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1, minWidth: 0 },
  chip:       { fontFamily: '"Space Mono",monospace', fontSize: 10, background: 'var(--bgp)', color: 'var(--pk)', border: '1px solid var(--pkb)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 },
  scaleQ:     { fontSize: 12, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  reorder:    { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  orderBadge: { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', minWidth: 20, textAlign: 'center' },
  arrowBtn:   { background: 'none', border: '1px solid var(--bd)', borderRadius: 4, width: 22, height: 22, fontSize: 11, cursor: 'pointer', color: 'var(--tx2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },

  saveBtn:   { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  cancelBtn: { background: 'none', border: '1px solid var(--bd)', borderRadius: 9, padding: '10px 16px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },

  previewSummary:   { display: 'flex', flexDirection: 'column', gap: 10 },
  previewCount:     { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', margin: 0 },
  previewList:      { margin: '0 0 12px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 },
  previewItem:      { display: 'flex', alignItems: 'center', gap: 8, listStyle: 'decimal' },
  startPreviewBtn:  { background: 'none', border: '1px solid var(--pk)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--pk)', fontFamily: '"DM Sans",system-ui,sans-serif', alignSelf: 'flex-start' },
  resetPreviewBtn:  { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '8px 0 0' },
}
