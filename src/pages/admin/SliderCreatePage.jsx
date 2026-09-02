import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SliderQuestion from '../../components/questionnaire/composable/SliderQuestion'
import '../../components/questionnaire/composable/composableSurvey.css'

function slugify(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

// The anchors spec a row would carry (slider_scales.anchors,
// 20260825_composable_instruments.sql). With no middle anchor this returns
// null — the stored convention for "derive start/end from min_label/max_label",
// which keeps rows identical to every slider authored before the field existed.
function buildAnchors({ min, max, minLabel, maxLabel, midValue, midLabel }) {
  if (!midLabel.trim()) return null
  return [
    { value: min, label: minLabel.trim() },
    { value: midValue ?? Math.round((min + max) / 2), label: midLabel.trim() },
    { value: max, label: maxLabel.trim() },
  ]
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
  const [midLabel,    setMidLabel]    = useState('')
  const [midValue,    setMidValue]    = useState(null)   // null = auto midpoint
  const [previewVal,  setPreviewVal]  = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)

  function handlePromptChange(v) {
    setPrompt(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  const anchors = buildAnchors({ min, max, minLabel, maxLabel, midValue, midLabel })
  const midInRange = !midLabel.trim()
    || ((midValue ?? Math.round((min + max) / 2)) > min
      && (midValue ?? Math.round((min + max) / 2)) < max)

  async function handleSave() {
    if (!prompt.trim() || !slug.trim() || !minLabel.trim() || !maxLabel.trim()) return
    if (min >= max) { setError('Min must be less than max.'); return }
    if (!midInRange) { setError('The middle anchor position must fall between min and max.'); return }
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
        anchors,
        created_by: user.id,
      })
      if (err) throw new Error(err.message)

      // 'numeric_slider' since the composable-instruments split (2026-08-25) —
      // the picker and dispatcher treat it and legacy 'vas' rows identically.
      const labelChain = anchors
        ? anchors.map(a => a.label).join(' → ')
        : `${minLabel.trim()} → ${maxLabel.trim()}`
      const { error: actErr } = await supabase.from('activities').insert({
        category:    'numeric_slider',
        subcategory: `slider_${slug.trim()}`,
        label:       `Slider – ${prompt.trim().slice(0, 60)}`,
        description: `${labelChain} (${min}–${max})`,
      })
      if (actErr) console.warn('activities insert:', actErr.message)

      navigate('/admin/vas')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const canSave = prompt.trim() && slug.trim() && minLabel.trim() && maxLabel.trim()
    && min < max && midInRange && !saving

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
              onChange={e => setMin(Number(e.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Max *</label>
            <input
              style={S.input}
              type="number"
              value={max}
              onChange={e => setMax(Number(e.target.value))}
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

        <div style={S.row2}>
          <div style={{ flex: 2 }}>
            <label style={S.label}>Middle anchor label</label>
            <input
              style={S.input}
              value={midLabel}
              onChange={e => setMidLabel(e.target.value)}
              placeholder="Moderately (leave empty for no middle anchor)"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>At value</label>
            <input
              style={S.input}
              type="number"
              value={midValue ?? ''}
              onChange={e => setMidValue(e.target.value === '' ? null : Number(e.target.value))}
              placeholder={String(Math.round((min + max) / 2))}
            />
          </div>
        </div>
        <p style={S.hint}>Optional. Empty position defaults to the midpoint of the range.</p>

        <p style={{ ...S.label, marginTop: 20 }}>Preview</p>
        <p style={S.hint}>The production component — exactly what a participant sees.</p>
        <SliderPreview
          prompt={prompt || 'Your prompt will appear here.'}
          min={min}
          max={max}
          labels={anchors ?? [
            { value: min, label: minLabel || 'Min' },
            { value: max, label: maxLabel || 'Max' },
          ]}
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

// Renders through the production SliderQuestion so the preview matches what a
// participant gets (until 2026-09-02 this was a hand-rolled green range input
// that predated the adopted numeric-slider template — Dana flagged the
// mismatch). Also used by VasLibraryPage's slider preview modal.
export function SliderPreview({ prompt, min, max, step = 1, labels, value, onChange }) {
  return (
    <div className="cs-page" style={SP.stage}>
      <SliderQuestion
        config={{
          id: 'slider_preview',
          question: prompt,
          min,
          max,
          step,
          labels: labels ?? [],
        }}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

const S = {
  h1:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub:   { fontSize: 14, color: 'var(--tx2)', margin: '0 0 28px' },
  form:  { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 22px', maxWidth: 600 },
  label: { display: 'block', fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  input: { width: '100%', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', boxSizing: 'border-box' },
  hint:  { fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: '4px 0 0' },
  row2:  { display: 'flex', gap: 14, marginTop: 14 },
  actions: { display: 'flex', gap: 10, marginTop: 24 },
  saveBtn:   { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  cancelBtn: { background: 'none', border: '1px solid var(--bd)', borderRadius: 9, padding: '10px 16px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  errMsg: { fontSize: 14, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', margin: '12px 0' },
}

const SP = {
  stage: { background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16, marginTop: 8 },
}
