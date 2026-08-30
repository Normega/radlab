import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../../lib/supabase'
import VasRenderer from '../vas/VasRenderer'
import SliderQuestion from '../questionnaire/composable/SliderQuestion'
import { useSubmitLock } from '../../lib/useSubmitLock'
import '../questionnaire/composable/composableSurvey.css'

/**
 * Mounts inside StepDispatcher for steps with category 'vas' — or its
 * post-split aliases 'numeric_slider' / 'assessment' (2026-08-25), which carry
 * the same subcategory prefixes and behave identically here.
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
  scheduleId = null,
  stepIndex,
  totalSteps,
  onComplete,
  supabaseClient,
  isSimMode = false,
  demoMode = false,
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
  // Per-item values collected across the package, reported on completion so
  // each item lands in the session context under its own slider./vas. key.
  const pkgValuesRef = useRef([])

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
        userId={demoMode ? null : userId}
        scheduleId={scheduleId}
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
        scheduleId={scheduleId}
        onComplete={value => onComplete?.({ scale_slug: slug, value })}
        previewMode={demoMode}
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
    const item = pkgItems[pkgIndex]
    if (item?.data?.slug !== undefined) {
      pkgValuesRef.current.push({
        type: item.type === 'slider' ? 'slider' : 'vas',
        slug: item.data.slug,
        value,
      })
    }
    const next = pkgIndex + 1
    if (next >= pkgItems.length) {
      onComplete?.({ package_slug: slug, responses_count: next, item_values: pkgValuesRef.current })
    } else {
      setPkgIndex(next)
    }
  }

  if (currentItem.type === 'slider') {
    return (
      <StudySliderBlock
        key={currentItem.id}
        scale={currentItem.data}
        userId={demoMode ? null : userId}
        scheduleId={scheduleId}
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
      scheduleId={scheduleId}
      packageSlug={slug}
      onComplete={handlePkgItemComplete}
      previewMode={demoMode}
      partNumber={pkgIndex + 1}
      totalParts={pkgItems.length}
      supabaseClient={db}
    />
  )
}

// ── StudySliderBlock ──────────────────────────────────────────────────────────
// Renders through the production SliderQuestion component (2026-08-25), so
// participants see the enforced numeric-slider template — white card, sparse
// numbered anchors, VALUE box "—" until touched — exactly what the admin
// library previews. Rows without an `anchors` spec fall back to start/end
// anchors from their min/max labels.
//
// Save path fixed in the same pass (CLAUDE.md participant-data rules): the
// insert now records schedule_id (it never did — every prior slider response
// is un-attributable to a session), and the `saving` state flag became a
// useSubmitLock ref (a state flag is a race, not a lock). The insert error is
// also checked now: it used to be discarded, advancing the participant past a
// silently lost response.

function StudySliderBlock({ scale, userId, scheduleId = null, db, onComplete, partNumber, totalParts }) {
  const [value, setValue]         = useState(null)
  const [saveError, setSaveError] = useState(null)
  const { submit, busy } = useSubmitLock(scale.slug)
  const touched = value != null

  async function handleSubmit() {
    if (!touched || busy) return
    setSaveError(null)
    await submit(async () => {
      if (userId) {
        const { error } = await db.from('questionnaire_responses').insert({
          user_id:            userId,
          questionnaire_slug: `slider_${scale.slug}`,
          schedule_id:        scheduleId ?? null,
          responses:          { value },
          completed_at:       new Date().toISOString(),
        })
        // Thrown so the lock releases and the participant can retry —
        // advancing on a failed save loses the response silently.
        if (error) throw error
      }
      onComplete(value)
    }).catch(err => {
      console.error('slider questionnaire_responses insert:', err)
      setSaveError(err.message)
    })
  }

  const min = scale.min ?? 0
  const max = scale.max ?? 100

  return (
    <div style={SS.wrap}>
      {partNumber != null && totalParts != null && (
        <p style={SS.partLabel}>{partNumber} of {totalParts}</p>
      )}
      <div className="cs-page">
        <SliderQuestion
          config={{
            id:       `slider_${scale.slug}`,
            question: scale.prompt,
            min,
            max,
            step:     scale.step ?? 1,
            labels:   scale.anchors ?? [
              { value: min, label: scale.min_label ?? '' },
              { value: max, label: scale.max_label ?? '' },
            ],
          }}
          value={value}
          onChange={setValue}
        />
      </div>
      {saveError && (
        <p style={SS.errMsg}>Could not save your response: {saveError}. Please try again.</p>
      )}
      <div style={SS.btnRow}>
        <button
          type="button"
          className="cs-primary-button"
          disabled={!touched || busy}
          onClick={handleSubmit}
        >
          {busy ? 'Saving…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}

const SS = {
  wrap:      { padding: '40px 24px 60px', maxWidth: 860, margin: '0 auto', fontFamily: '"DM Sans",system-ui,sans-serif' },
  partLabel: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', margin: '0 0 16px' },
  btnRow:    { display: 'flex', justifyContent: 'flex-end', marginTop: 24 },
  errMsg:    { fontSize: 14, color: 'var(--err-tx)', background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 8, padding: '8px 14px', marginTop: 16 },
}

const S = {
  loading: { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
  err:     { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: '#e04', fontSize: 14 },
  mono:    { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
}
