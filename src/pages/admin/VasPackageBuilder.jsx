import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import VasRenderer from '../../components/vas/VasRenderer'

function slugify(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

// item shape: { type: 'vas'|'slider', id: string }
function itemKey(item) { return `${item.type}:${item.id}` }

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

function useSliders() {
  return useQuery({
    queryKey: ['slider-scales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('slider_scales').select('*').order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

export default function VasPackageBuilder() {
  const navigate = useNavigate()
  const { data: allScales  = [], isLoading: loadingScales  } = useScales()
  const { data: allSliders = [], isLoading: loadingSliders } = useSliders()

  const [name,          setName]          = useState('')
  const [description,   setDescription]   = useState('')
  const [selectedItems, setSelectedItems] = useState([]) // [{type, id}]
  const [previewIdx,    setPreviewIdx]    = useState(0)
  const [showPreview,   setShowPreview]   = useState(false)
  const [error,         setError]         = useState(null)

  const isLoading = loadingScales || loadingSliders

  const scaleMap  = Object.fromEntries(allScales.map(s  => [s.id, s]))
  const sliderMap = Object.fromEntries(allSliders.map(s => [s.id, s]))

  function getItemData(item) {
    return item.type === 'vas' ? scaleMap[item.id] : sliderMap[item.id]
  }

  const selectedWithData = selectedItems
    .map(item => ({ ...item, data: getItemData(item) }))
    .filter(x => x.data)

  function toggleItem(type, id) {
    const key = `${type}:${id}`
    setSelectedItems(prev => {
      const exists = prev.some(x => itemKey(x) === key)
      return exists ? prev.filter(x => itemKey(x) !== key) : [...prev, { type, id }]
    })
  }

  function moveUp(idx) {
    if (idx === 0) return
    const next = [...selectedItems]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setSelectedItems(next)
  }

  function moveDown(idx) {
    if (idx >= selectedItems.length - 1) return
    const next = [...selectedItems]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    setSelectedItems(next)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim())             throw new Error('Package name is required.')
      if (selectedItems.length < 1) throw new Error('Select at least one item.')

      const slug = slugify(name)
      const { data: { user } } = await supabase.auth.getUser()

      // scale_ids: VAS-only IDs in order, for backward compat with old packages
      const vasOnlyIds = selectedItems.filter(x => x.type === 'vas').map(x => x.id)

      const { error: pkgErr } = await supabase.from('vas_packages').insert({
        slug,
        name:        name.trim(),
        description: description.trim() || null,
        scale_ids:   vasOnlyIds,
        items:       selectedItems,  // full mixed list with types + order
        created_by:  user.id,
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

  if (isLoading) return <p style={S.muted}>Loading…</p>

  return (
    <div>
      <h1 style={S.h1}>New Package</h1>
      <p style={S.sub}>Bundle VAS scales and sliders into a sequence for study sessions.</p>

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

          <p style={{ ...S.label, marginTop: 20 }}>Items (check to include, reorder with ↑↓)</p>

          {allScales.length === 0 && allSliders.length === 0 && (
            <p style={S.muted}>No scales or sliders available. Create some first.</p>
          )}

          {allScales.length > 0 && (
            <>
              <div style={S.sectionHeader}>VAS Scales</div>
              {allScales.map(scale => {
                const item    = { type: 'vas', id: scale.id }
                const checked = selectedItems.some(x => itemKey(x) === itemKey(item))
                const idx     = selectedItems.findIndex(x => itemKey(x) === itemKey(item))
                return (
                  <ItemRow
                    key={scale.id}
                    label={scale.slug}
                    question={scale.question}
                    typeTag="VAS"
                    checked={checked}
                    idx={idx}
                    total={selectedItems.length}
                    onToggle={() => toggleItem('vas', scale.id)}
                    onUp={() => moveUp(idx)}
                    onDown={() => moveDown(idx)}
                  />
                )
              })}
            </>
          )}

          {allSliders.length > 0 && (
            <>
              <div style={{ ...S.sectionHeader, marginTop: allScales.length > 0 ? 14 : 0 }}>Sliders</div>
              {allSliders.map(slider => {
                const item    = { type: 'slider', id: slider.id }
                const checked = selectedItems.some(x => itemKey(x) === itemKey(item))
                const idx     = selectedItems.findIndex(x => itemKey(x) === itemKey(item))
                return (
                  <ItemRow
                    key={slider.id}
                    label={slider.slug}
                    question={slider.prompt}
                    typeTag="Slider"
                    checked={checked}
                    idx={idx}
                    total={selectedItems.length}
                    onToggle={() => toggleItem('slider', slider.id)}
                    onUp={() => moveUp(idx)}
                    onDown={() => moveDown(idx)}
                  />
                )
              })}
            </>
          )}

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

          {selectedWithData.length === 0 ? (
            <p style={S.muted}>Select items on the left to preview the sequence.</p>
          ) : showPreview ? (
            <PreviewItem
              item={selectedWithData[previewIdx]}
              partNumber={previewIdx + 1}
              totalParts={selectedWithData.length}
              onComplete={() => {
                const next = previewIdx + 1
                if (next >= selectedWithData.length) {
                  setShowPreview(false)
                  setPreviewIdx(0)
                } else {
                  setPreviewIdx(next)
                }
              }}
              onClose={() => { setShowPreview(false); setPreviewIdx(0) }}
            />
          ) : (
            <div style={S.previewSummary}>
              <p style={S.previewCount}>{selectedWithData.length} item{selectedWithData.length !== 1 ? 's' : ''} selected</p>
              <ol style={S.previewList}>
                {selectedWithData.map(item => (
                  <li key={itemKey(item)} style={S.previewItem}>
                    <span style={item.type === 'slider' ? { ...S.chip, ...S.chipSlider } : S.chip}>
                      {item.type === 'slider' ? item.data.slug : item.data.slug}
                    </span>
                    <span style={S.typeTag(item.type)}>{item.type === 'slider' ? 'Slider' : 'VAS'}</span>
                    <span style={S.scaleQ}>
                      {item.type === 'vas' ? item.data.question : item.data.prompt}
                    </span>
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

// ── ItemRow ───────────────────────────────────────────────────────────────────

function ItemRow({ label, question, typeTag, checked, idx, total, onToggle, onUp, onDown }) {
  return (
    <div style={S.scaleRow}>
      <label style={S.checkLabel}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          style={{ margin: '0 8px 0 0' }}
        />
        <span style={typeTag === 'Slider' ? { ...S.chip, ...S.chipSlider } : S.chip}>{label}</span>
        <span style={S.typeTag(typeTag === 'Slider' ? 'slider' : 'vas')}>{typeTag}</span>
        <span style={S.scaleQ}>{question}</span>
      </label>
      {checked && (
        <div style={S.reorder}>
          <span style={S.orderBadge}>#{idx + 1}</span>
          <button style={S.arrowBtn} onClick={onUp}   disabled={idx === 0}>↑</button>
          <button style={S.arrowBtn} onClick={onDown} disabled={idx === total - 1}>↓</button>
        </div>
      )}
    </div>
  )
}

// ── PreviewItem ───────────────────────────────────────────────────────────────

function PreviewItem({ item, partNumber, totalParts, onComplete, onClose }) {
  if (item.type === 'vas') {
    return (
      <>
        <VasRenderer
          key={item.id}
          scale={item.data}
          previewMode
          partNumber={partNumber}
          totalParts={totalParts}
          onComplete={onComplete}
        />
        <button style={S.resetPreviewBtn} onClick={onClose}>✕ Close preview</button>
      </>
    )
  }

  return (
    <>
      <SliderPreview
        key={item.id}
        scale={item.data}
        partNumber={partNumber}
        totalParts={totalParts}
        onComplete={onComplete}
      />
      <button style={S.resetPreviewBtn} onClick={onClose}>✕ Close preview</button>
    </>
  )
}

function SliderPreview({ scale, partNumber, totalParts, onComplete }) {
  const mid = Math.round((scale.min + scale.max) / 2)
  const [value,   setValue]   = useState(mid)
  const [touched, setTouched] = useState(false)

  return (
    <div style={{ fontFamily: '"DM Sans",system-ui,sans-serif' }}>
      <p style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', marginBottom: 14 }}>
        {partNumber} of {totalParts}
      </p>
      <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--tx)', marginBottom: 16, lineHeight: 1.5 }}>
        {scale.prompt}
      </p>
      <div style={{ background: '#faf9f7', border: '1px solid #e8e5e0', borderRadius: 12, padding: '20px 20px 14px', marginBottom: 20 }}>
        <input
          type="range"
          min={scale.min}
          max={scale.max}
          value={value}
          onChange={e => { setValue(Number(e.target.value)); setTouched(true) }}
          style={{ width: '100%', height: 8, cursor: 'pointer', marginBottom: 12, display: 'block',
                   accentColor: touched ? 'var(--pk)' : '#c0bdb8' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 13, color: touched ? 'var(--tx2)' : '#b0ada8' }}>
          <span>{scale.min_label}</span>
          {touched
            ? <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--pk)' }}>{value}</span>
            : <span style={{ fontSize: 24, color: '#c0bdb8' }}>—</span>}
          <span>{scale.max_label}</span>
        </div>
      </div>
      <button
        onClick={() => touched && onComplete(value)}
        disabled={!touched}
        style={{ background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10,
                 padding: '11px 28px', fontSize: 14, fontWeight: 500, cursor: touched ? 'pointer' : 'not-allowed',
                 opacity: touched ? 1 : 0.4, fontFamily: '"DM Sans",system-ui,sans-serif' }}
      >
        Next →
      </button>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

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

  sectionHeader: { fontFamily: '"Space Mono",monospace', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--tx3)', padding: '6px 0 4px', borderBottom: '1px solid var(--bd)', marginBottom: 4 },

  scaleRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--bd)' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1, minWidth: 0 },
  chip:       { fontFamily: '"Space Mono",monospace', fontSize: 10, background: 'var(--bgp)', color: 'var(--pk)', border: '1px solid var(--pkb)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 },
  chipSlider: { background: '#eef4ff', color: '#3b6db0', borderColor: 'rgba(59,109,176,0.25)' },
  typeTag:    (type) => ({
    fontFamily: '"Space Mono",monospace',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '1px 5px',
    borderRadius: 3,
    flexShrink: 0,
    background: type === 'slider' ? '#eef4ff' : 'var(--bgp)',
    color:      type === 'slider' ? '#3b6db0' : 'var(--pkd)',
  }),
  scaleQ:     { fontSize: 12, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  reorder:    { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  orderBadge: { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', minWidth: 20, textAlign: 'center' },
  arrowBtn:   { background: 'none', border: '1px solid var(--bd)', borderRadius: 4, width: 22, height: 22, fontSize: 11, cursor: 'pointer', color: 'var(--tx2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },

  saveBtn:   { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  cancelBtn: { background: 'none', border: '1px solid var(--bd)', borderRadius: 9, padding: '10px 16px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },

  previewSummary:   { display: 'flex', flexDirection: 'column', gap: 10 },
  previewCount:     { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', margin: 0 },
  previewList:      { margin: '0 0 12px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 },
  previewItem:      { display: 'flex', alignItems: 'center', gap: 6, listStyle: 'decimal' },
  startPreviewBtn:  { background: 'none', border: '1px solid var(--pk)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--pk)', fontFamily: '"DM Sans",system-ui,sans-serif', alignSelf: 'flex-start' },
  resetPreviewBtn:  { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '8px 0 0' },
}
