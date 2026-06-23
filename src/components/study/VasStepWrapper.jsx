import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../../lib/supabase'
import VasRenderer from '../vas/VasRenderer'

/**
 * Mounts inside StepDispatcher for steps with category === 'vas'.
 *
 * subcategory formats:
 *   vas_{slug}      → single VAS scale
 *   vas_pkg_{slug}  → package (renders VAS scales and/or sliders in sequence)
 *   slider_{slug}   → single slider scale
 *
 * Packages support mixed items via pkg.items ([{type:'vas'|'slider', id}]).
 * Older packages with only scale_ids are handled as VAS-only for backward compat.
 */
export default function VasStepWrapper({
  subcategory,
  enrollment,
  stepIndex,
  totalSteps,
  onComplete,
  supabaseClient,
  isSimMode = false,
}) {
  const db     = supabaseClient ?? globalSupabase
  const userId = enrollment?.profile_id ?? enrollment?.user_id

  const isSlider = subcategory?.startsWith('slider_')
  const isPkg    = !isSlider && subcategory?.startsWith('vas_pkg_')
  const slug     = isSlider
    ? subcategory.replace('slider_', '')
    : isPkg
      ? subcategory.replace('vas_pkg_', '')
      : subcategory?.replace('vas_', '')

  // ── Slider scale ────────────────────────────────────────────────────────

  const { data: sliderScale, isLoading: loadingSlider, error: errSlider } = useQuery({
    queryKey: ['slider-scale', slug],
    enabled:  isSlider && !!slug,
    queryFn:  async () => {
      const { data, error } = await db.from('slider_scales').select('*').eq('slug', slug).single()
      if (error) throw error
      return data
    },
  })

  // ── Single VAS scale ─────────────────────────────────────────────────────

  const { data: singleScale, isLoading: loadingSingle, error: errSingle } = useQuery({
    queryKey: ['vas-scale', slug],
    enabled:  !isPkg && !isSlider && !!slug,
    queryFn:  async () => {
      const { data, error } = await db.from('vas_scales').select('*').eq('slug', slug).single()
      if (error) throw error
      return data
    },
  })

  // ── Package ──────────────────────────────────────────────────────────────

  const { data: pkg, isLoading: loadingPkg, error: errPkg } = useQuery({
    queryKey: ['vas-package', slug],
    enabled:  isPkg && !!slug,
    queryFn:  async () => {
      const { data, error } = await db.from('vas_packages').select('*').eq('slug', slug).single()
      if (error) throw error
      return data
    },
  })

  // Resolve item list — use pkg.items (mixed) or fall back to scale_ids (VAS-only)
  const itemList = pkg?.items ?? (pkg?.scale_ids ?? []).map(id => ({ type: 'vas', id }))
  const vasIds    = itemList.filter(x => x.type === 'vas').map(x => x.id)
  const sliderIds = itemList.filter(x => x.type === 'slider').map(x => x.id)

  const { data: pkgVasData, isLoading: loadingPkgVas } = useQuery({
    queryKey: ['vas-pkg-vas-scales', vasIds],
    enabled:  isPkg && vasIds.length > 0,
    queryFn:  async () => {
      const { data, error } = await db.from('vas_scales').select('*').in('id', vasIds)
      if (error) throw error
      return data ?? []
    },
  })

  const { data: pkgSliderData, isLoading: loadingPkgSliders } = useQuery({
    queryKey: ['vas-pkg-sliders', sliderIds],
    enabled:  isPkg && sliderIds.length > 0,
    queryFn:  async () => {
      const { data, error } = await db.from('slider_scales').select('*').in('id', sliderIds)
      if (error) throw error
      return data ?? []
    },
  })

  // Merge into ordered list of { type, id, data }
  const pkgItems = itemList.map(item => {
    const data = item.type === 'vas'
      ? (pkgVasData    ?? []).find(s => s.id === item.id)
      : (pkgSliderData ?? []).find(s => s.id === item.id)
    return data ? { ...item, data } : null
  }).filter(Boolean)

  const [pkgIndex, setPkgIndex] = useState(0)

  // ── Sim mode ─────────────────────────────────────────────────────────────

  if (isSimMode) {
    setTimeout(() => onComplete?.({ sim: true }), 0)
    return (
      <div style={S.loading}>
        <span style={S.mono}>Sim mode — skipping VAS step</span>
      </div>
    )
  }

  // ── Slider flow ──────────────────────────────────────────────────────────

  if (isSlider) {
    if (loadingSlider) return <div style={S.loading}>Loading slider…</div>
    if (errSlider)     return <div style={S.err}>Could not load slider "{slug}": {errSlider.message}</div>
    if (!sliderScale)  return <div style={S.err}>Slider "{slug}" not found.</div>

    return (
      <StudySliderBlock
        scale={sliderScale}
        userId={userId}
        db={db}
        onComplete={value => onComplete?.({ slider_slug: slug, value })}
      />
    )
  }

  // ── Single VAS scale flow ────────────────────────────────────────────────

  if (!isPkg) {
    if (loadingSingle) return <div style={S.loading}>Loading scale…</div>
    if (errSingle)     return <div style={S.err}>Could not load scale "{slug}": {errSingle.message}</div>
    if (!singleScale)  return <div style={S.err}>Scale "{slug}" not found.</div>

    return (
      <VasRenderer
        scale={singleScale}
        userId={userId}
        sessionId={null}
        onComplete={value => onComplete?.({ scale_slug: slug, value })}
        previewMode={false}
        partNumber={stepIndex != null ? stepIndex + 1 : null}
        totalParts={totalSteps ?? null}
        supabaseClient={db}
      />
    )
  }

  // ── Package flow ─────────────────────────────────────────────────────────

  const loadingPkgItems = loadingPkg
    || (vasIds.length    > 0 && loadingPkgVas)
    || (sliderIds.length > 0 && loadingPkgSliders)

  if (loadingPkgItems) return <div style={S.loading}>Loading scales…</div>
  if (errPkg)          return <div style={S.err}>Could not load package "{slug}": {errPkg.message}</div>
  if (!pkgItems.length) return <div style={S.err}>Package "{slug}" has no items configured.</div>

  const currentItem = pkgItems[pkgIndex]

  function handlePkgItemComplete(value) {
    const next = pkgIndex + 1
    if (next >= pkgItems.length) {
      onComplete?.({ package_slug: slug, responses_count: next })
    } else {
      setPkgIndex(next)
    }
  }

  if (currentItem.type === 'slider') {
    return (
      <StudySliderBlock
        key={currentItem.id}
        scale={currentItem.data}
        userId={userId}
        db={db}
        partNumber={pkgIndex + 1}
        totalParts={pkgItems.length}
        onComplete={handlePkgItemComplete}
      />
    )
  }

  return (
    <VasRenderer
      key={currentItem.id}
      scale={currentItem.data}
      userId={userId}
      sessionId={null}
      onComplete={handlePkgItemComplete}
      previewMode={false}
      partNumber={pkgIndex + 1}
      totalParts={pkgItems.length}
      supabaseClient={db}
    />
  )
}

// ── StudySliderBlock ──────────────────────────────────────────────────────────

function StudySliderBlock({ scale, userId, db, onComplete, partNumber, totalParts }) {
  const mid = Math.round((scale.min + scale.max) / 2)
  const [value,   setValue]   = useState(mid)
  const [touched, setTouched] = useState(false)
  const [saving,  setSaving]  = useState(false)

  async function handleSubmit() {
    if (!touched || saving) return
    setSaving(true)
    if (userId) {
      await db.from('questionnaire_responses').insert({
        user_id:            userId,
        questionnaire_slug: `slider_${scale.slug}`,
        responses:          { value },
        completed_at:       new Date().toISOString(),
      })
    }
    onComplete(value)
  }

  return (
    <div style={SS.wrap}>
      {partNumber != null && totalParts != null && (
        <p style={SS.partLabel}>{partNumber} of {totalParts}</p>
      )}
      <p style={SS.prompt}>{scale.prompt}</p>
      <div style={SS.sliderWrap}>
        <input
          type="range"
          min={scale.min}
          max={scale.max}
          value={value}
          onChange={e => {
            setValue(Number(e.target.value))
            setTouched(true)
          }}
          style={{ ...SS.slider, accentColor: touched ? 'var(--pk)' : '#c0bdb8' }}
        />
        <div style={{ ...SS.labels, color: touched ? 'var(--tx2)' : '#b0ada8' }}>
          <span>{scale.min_label}</span>
          {touched
            ? <span style={SS.val}>{value}</span>
            : <span style={SS.valEmpty}>—</span>
          }
          <span>{scale.max_label}</span>
        </div>
      </div>
      <button
        style={{ ...SS.btn, opacity: touched && !saving ? 1 : 0.4, cursor: touched && !saving ? 'pointer' : 'not-allowed' }}
        onClick={handleSubmit}
        disabled={!touched || saving}
      >
        {saving ? 'Saving…' : 'Submit'}
      </button>
    </div>
  )
}

const SS = {
  wrap:      { padding: '40px 32px', maxWidth: 560, margin: '0 auto', fontFamily: '"DM Sans",system-ui,sans-serif' },
  partLabel: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', margin: '0 0 16px' },
  prompt:    { fontSize: 18, fontWeight: 500, color: 'var(--tx)', margin: '0 0 24px', lineHeight: 1.5 },
  sliderWrap: { background: '#faf9f7', border: '1px solid #e8e5e0', borderRadius: 12, padding: '24px 24px 18px', marginBottom: 28 },
  slider:    { width: '100%', height: 8, cursor: 'pointer', marginBottom: 14, display: 'block' },
  labels:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 },
  val:       { fontSize: 28, fontWeight: 700, color: 'var(--pk)' },
  valEmpty:  { fontSize: 28, fontWeight: 400, color: '#c0bdb8' },
  btn:       { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 32px', fontSize: 15, fontWeight: 500, fontFamily: '"DM Sans",system-ui,sans-serif', transition: 'opacity 0.15s' },
}

const S = {
  loading: { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
  err:     { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: '#e04', fontSize: 14 },
  mono:    { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
}
