import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function slugify(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export default function SliderCreatePage() {
  const navigate = useNavigate()

  const [prompt,      setPrompt]      = useState('')
  const [slug,        setSlug]        = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [min,         setMin]         = useState(1)
  const [max,         setMax]         = useState(6)
  const [minLabel,    setMinLabel]    = useState('')
  const [maxLabel,    setMaxLabel]    = useState('')
  const [previewVal,  setPreviewVal]  = useState(3)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)

  function handlePromptChange(v) {
    setPrompt(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  function handleMinChange(v) {
    const n = Number(v)
    setMin(n)
    const mid = Math.round((n + max) / 2)
    setPreviewVal(mid)
  }

  function handleMaxChange(v) {
    const n = Number(v)
    setMax(n)
    const mid = Math.round((min + n) / 2)
    setPreviewVal(mid)
  }

  async function handleSave() {
    if (!prompt.trim() || !slug.trim() || !minLabel.trim() || !maxLabel.trim()) return
    if (min >= max) { setError('Min must be less than max.'); return }
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase.from('slider_scales').insert({
        slug:      slug.trim(),
        prompt:    prompt.trim(),
        min,
        max,
        min_label: minLabel.trim(),
        max_label: maxLabel.trim(),
        created_by: user.id,
      })
      if (err) throw new Error(err.message)

      const { error: actErr } = await supabase.from('activities').insert({
        category:    'vas',
        subcategory: `slider_${slug.trim()}`,
        label:       `Slider – ${prompt.trim().slice(0, 60)}`,
        description: `${minLabel.trim()} → ${maxLabel.trim()} (${min}–${max})`,
      })
      if (actErr) console.warn('activities insert:', actErr.message)

      navigate('/admin/vas')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const canSave = prompt.trim() && slug.trim() && minLabel.trim() && maxLabel.trim() && min < max && !saving

  return (
    <div>
      <h1 style={S.h1}>Create Slider</h1>
      <p style={S.sub}>Define a labelled range slider for use in training modules.</p>

      <div style={S.form}>

        <label style={S.label}>Prompt *</label>
        <input
          style={S.input}
          value={prompt}
          onChange={e => handlePromptChange(e.target.value)}
          placeholder="Rate how difficult you find this task."
        />

        <label style={{ ...S.label, marginTop: 14 }}>Slug *</label>
        <input
          style={S.input}
          value={slug}
          onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
          placeholder="difficulty_rating"
        />
        <p style={S.hint}>Auto-generated from prompt. Used as the identifier in module JSON.</p>

        <div style={S.row2}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Min *</label>
            <input
              style={S.input}
              type="number"
              value={min}
              onChange={e => handleMinChange(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Max *</label>
            <input
              style={S.input}
              type="number"
              value={max}
              onChange={e => handleMaxChange(e.target.value)}
            />
          </div>
        </div>

        <div style={S.row2}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Min label *</label>
            <input
              style={S.input}
              value={minLabel}
              onChange={e => setMinLabel(e.target.value)}
              placeholder="Not at all"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Max label *</label>
            <input
              style={S.input}
              value={maxLabel}
              onChange={e => setMaxLabel(e.target.value)}
              placeholder="Extremely"
            />
          </div>
        </div>

        <p style={{ ...S.label, marginTop: 20 }}>Preview</p>
        <SliderPreview
          prompt={prompt || 'Your prompt will appear here.'}
          min={min}
          max={max}
          minLabel={minLabel || 'Min'}
          maxLabel={maxLabel || 'Max'}
          value={previewVal}
          onChange={setPreviewVal}
        />

        {error && <p style={S.errMsg}>{error}</p>}

        <div style={S.actions}>
          <button
            style={{ ...S.saveBtn, opacity: canSave ? 1 : 0.45 }}
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving ? 'Saving…' : 'Save Slider'}
          </button>
          <button style={S.cancelBtn} onClick={() => navigate('/admin/vas')}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}

export function SliderPreview({ prompt, min, max, minLabel, maxLabel, value, onChange }) {
  return (
    <div style={SP.outer}>
      <p style={SP.prompt}>{prompt}</p>
      <div style={SP.sliderWrap}>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange?.(Number(e.target.value))}
          style={SP.slider}
        />
        <div style={SP.labels}>
          <span style={SP.labelTxt}>{minLabel}</span>
          <span style={SP.val}>{value}</span>
          <span style={SP.labelTxt}>{maxLabel}</span>
        </div>
      </div>
    </div>
  )
}

const S = {
  h1:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub:   { fontSize: 14, color: 'var(--tx2)', margin: '0 0 28px' },
  form:  { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 22px', maxWidth: 600 },
  label: { display: 'block', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  input: { width: '100%', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', boxSizing: 'border-box' },
  hint:  { fontSize: 11, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '4px 0 0' },
  row2:  { display: 'flex', gap: 14, marginTop: 14 },
  actions: { display: 'flex', gap: 10, marginTop: 24 },
  saveBtn:   { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  cancelBtn: { background: 'none', border: '1px solid var(--bd)', borderRadius: 9, padding: '10px 16px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  errMsg: { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', margin: '12px 0' },
}

const SP = {
  outer:     { border: '1px solid var(--bd)', borderRadius: 12, padding: '16px', background: '#fafafa' },
  prompt:    { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)', margin: '0 0 16px', lineHeight: 1.5 },
  sliderWrap: { background: '#faf9f7', border: '1px solid #e8e5e0', borderRadius: 12, padding: '20px 20px 16px' },
  slider:    { width: '100%', height: 8, accentColor: '#639922', cursor: 'pointer', marginBottom: 12, display: 'block' },
  labels:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#5f5e5a' },
  labelTxt:  { fontFamily: '"DM Sans",system-ui,sans-serif' },
  val:       { fontSize: 22, fontWeight: 700, color: '#639922', fontFamily: '"DM Sans",system-ui,sans-serif' },
}
