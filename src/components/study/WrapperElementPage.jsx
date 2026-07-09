import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { interventionStyles as S, OwlScreen } from './InterventionPage'
import { SESSION_SLOT_LABELS } from './wrapperElements'
import VasRenderer from '../vas/VasRenderer'

// Renders one standard session wrapper element (welcome / check-in / farewell).
// Owl screens use the InterventionPage visual system with the 5-step progress
// bar; vas_package screens render the live package contents through the real
// participant-facing VasRenderer (previewMode — nothing saved), full-bleed,
// exactly as the session runner delivers the check-in steps. Preview-only.

export default function WrapperElementPage({ element, onComplete }) {
  const screens = element.screens
  const [screenIndex,   setScreenIndex]   = useState(0)
  const [pkgScaleIndex, setPkgScaleIndex] = useState(0)

  // At most one vas_package screen per element; fetch its scales in item order.
  const pkgSlug = screens.find(s => s.type === 'vas_package')?.slug ?? null

  const { data: pkgScales, isLoading: pkgLoading, error: pkgError } = useQuery({
    queryKey: ['wrapper-vas-package', pkgSlug],
    enabled:  !!pkgSlug,
    queryFn:  async () => {
      const { data: pkg, error } = await supabase
        .from('vas_packages')
        .select('items, scale_ids')
        .eq('slug', pkgSlug)
        .single()
      if (error) throw error
      const ids = (pkg.items ?? (pkg.scale_ids ?? []).map(id => ({ type: 'vas', id })))
        .filter(x => x.type === 'vas')
        .map(x => x.id)
      const { data: scales, error: e2 } = await supabase
        .from('vas_scales')
        .select('*')
        .in('id', ids)
      if (e2) throw e2
      return ids.map(id => (scales ?? []).find(s => s.id === id)).filter(Boolean)
    },
  })

  const current = screens[screenIndex]
  const isLast  = screenIndex === screens.length - 1

  function handleNext() {
    if (isLast) onComplete()
    else setScreenIndex(i => i + 1)
  }

  function stepState(i) {
    return i < element.slot ? 'done' : i === element.slot ? 'active' : 'upcoming'
  }

  // ── vas_package screens: the real check-in step, full-bleed ───────────────

  if (current.type === 'vas_package') {
    if (pkgLoading) {
      return <div style={PKG.msg}>Loading check-in scales…</div>
    }
    if (pkgError || !pkgScales?.length) {
      return (
        <div style={{ ...PKG.msg, color: '#c0392b' }}>
          Could not load VAS package "{current.slug}"
          {pkgError ? ` — ${pkgError.message}` : ' (no scales found)'}.
          Check it at /admin/vas.
        </div>
      )
    }

    const scale = pkgScales[Math.min(pkgScaleIndex, pkgScales.length - 1)]
    return (
      <VasRenderer
        key={scale.id}
        scale={scale}
        userId={null}
        previewMode
        partNumber={pkgScaleIndex + 1}
        totalParts={pkgScales.length}
        onComplete={() => {
          if (pkgScaleIndex + 1 < pkgScales.length) {
            setPkgScaleIndex(i => i + 1)
          } else {
            setPkgScaleIndex(0)
            handleNext()
          }
        }}
      />
    )
  }

  // ── owl screens: InterventionPage chrome ───────────────────────────────────

  return (
    <div style={S.bg}>
      <div style={S.page}>

        {/* 5-step session progress bar — this element's slot is active */}
        <div style={S.progressBar}>
          <div style={{ display: 'flex' }}>
            {SESSION_SLOT_LABELS.map((label, i) => {
              const state = stepState(i)
              const color = state === 'done' ? '#639922' : state === 'active' ? '#2c2c2a' : '#a09d98'
              const bar   = state === 'done' ? '#639922' : state === 'active' ? '#2c2c2a' : '#ddd'
              return (
                <div key={i} style={S.stepCol}>
                  <span style={{ ...S.stepLabel, color }}>{label}</span>
                  <div style={{ ...S.stepTrack, background: bar }}>
                    <div style={{ ...S.stepDot, background: bar }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Header */}
        <div style={S.header}>
          <div style={S.practiceBadge}>
            <div style={S.badgeDot} />
            Every session
          </div>
          <div style={S.dayNumber}>{element.name}</div>
          <div style={S.daySubtitle}>{element.description}</div>
        </div>

        {/* Step pips */}
        <div style={S.pips}>
          {screens.map((_, i) => (
            <div key={i} style={{
              ...S.pip,
              background: i < screenIndex ? '#639922' : i === screenIndex ? '#2c2c2a' : '#ddd',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={S.content}>
          {current.type === 'owl' && (
            <OwlScreen owl={current.owl} text={current.text} />
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button
            onClick={handleNext}
            style={isLast && element.finalButtonGreen ? S.btnDone : S.btnNext}
          >
            {isLast ? element.finalButtonLabel : 'Next'}
          </button>
        </div>

      </div>
    </div>
  )
}

const PKG = {
  msg: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 300, padding: 40, textAlign: 'center',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 15, color: '#888780',
  },
}
