import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../../lib/supabase'
import VasRenderer from '../vas/VasRenderer'

/**
 * Mounts inside StepDispatcher for steps with category === 'vas'.
 *
 * subcategory formats:
 *   vas_{slug}      → single scale
 *   vas_pkg_{slug}  → package (renders scales in sequence)
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

  const isPkg  = subcategory?.startsWith('vas_pkg_')
  const slug   = isPkg
    ? subcategory.replace('vas_pkg_', '')
    : subcategory?.replace('vas_', '')

  // ── Single scale ────────────────────────────────────────────────────────

  const { data: singleScale, isLoading: loadingSingle, error: errSingle } = useQuery({
    queryKey: ['vas-scale', slug],
    enabled:  !isPkg && !!slug,
    queryFn:  async () => {
      const { data, error } = await db
        .from('vas_scales')
        .select('*')
        .eq('slug', slug)
        .single()
      if (error) throw error
      return data
    },
  })

  // ── Package ─────────────────────────────────────────────────────────────

  const { data: pkg, isLoading: loadingPkg, error: errPkg } = useQuery({
    queryKey: ['vas-package', slug],
    enabled:  isPkg && !!slug,
    queryFn:  async () => {
      const { data, error } = await db
        .from('vas_packages')
        .select('*')
        .eq('slug', slug)
        .single()
      if (error) throw error
      return data
    },
  })

  const scaleIdList = pkg?.scale_ids ?? []

  const { data: pkgScales, isLoading: loadingPkgScales } = useQuery({
    queryKey: ['vas-pkg-scales', scaleIdList],
    enabled:  isPkg && scaleIdList.length > 0,
    queryFn:  async () => {
      const { data, error } = await db
        .from('vas_scales')
        .select('*')
        .in('id', scaleIdList)
      if (error) throw error
      // Preserve order from scale_ids
      return scaleIdList.map(id => data.find(s => s.id === id)).filter(Boolean)
    },
  })

  const [pkgIndex, setPkgIndex] = useState(0)

  // ── Sim mode — auto-complete immediately ────────────────────────────────

  if (isSimMode) {
    // Defer to next tick so the component can mount before advancing
    setTimeout(() => onComplete?.({ sim: true }), 0)
    return (
      <div style={S.loading}>
        <span style={S.mono}>Sim mode — skipping VAS step</span>
      </div>
    )
  }

  // ── Single scale flow ───────────────────────────────────────────────────

  if (!isPkg) {
    if (loadingSingle) return <div style={S.loading}>Loading scale…</div>
    if (errSingle) return <div style={S.err}>Could not load scale "{slug}": {errSingle.message}</div>
    if (!singleScale) return <div style={S.err}>Scale "{slug}" not found.</div>

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

  if (loadingPkg || loadingPkgScales) return <div style={S.loading}>Loading scales…</div>
  if (errPkg) return <div style={S.err}>Could not load package "{slug}": {errPkg.message}</div>
  if (!pkgScales?.length) return <div style={S.err}>Package "{slug}" has no scales configured.</div>

  const currentScale = pkgScales[pkgIndex]

  function handlePkgScaleComplete(value) {
    const next = pkgIndex + 1
    if (next >= pkgScales.length) {
      onComplete?.({ package_slug: slug, responses_count: next })
    } else {
      setPkgIndex(next)
    }
  }

  return (
    <VasRenderer
      key={currentScale.id}
      scale={currentScale}
      userId={userId}
      sessionId={null}
      onComplete={handlePkgScaleComplete}
      previewMode={false}
      partNumber={pkgIndex + 1}
      totalParts={pkgScales.length}
      supabaseClient={db}
    />
  )
}

const S = {
  loading: { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
  err:     { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: '#e04', fontSize: 14 },
  mono:    { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
}
