import PrimaryCTA from './PrimaryCTA'
import SecondaryCTA from './SecondaryCTA'

/**
 * OnboardingNavigation — Onboarding Redesign v1 primitive (Figma node 170:1124).
 * Prev/Next control bar: Previous bottom-left, Next bottom-right (Dev Spec §4.3).
 * Variant (OnlyL / OnlyR / BothButtons) derives from which handlers are passed.
 * `nextDisabled` gates Next into the Inactive state (per-step validation).
 * Full-width in-flow bar; keeps the left/right split on mobile (Dev Spec §6.3).
 */
export default function OnboardingNavigation({
  onPrevious,
  onNext,
  nextDisabled = false,
  previousLabel = '← Back',
  nextLabel = 'Next →',
  style,
}) {
  const justify = onPrevious && onNext ? 'space-between' : onNext ? 'flex-end' : 'flex-start'
  return (
    <div style={{ ...S.bar, justifyContent: justify, ...style }}>
      {onPrevious && <SecondaryCTA onClick={onPrevious}>{previousLabel}</SecondaryCTA>}
      {onNext && <PrimaryCTA onClick={onNext} disabled={nextDisabled}>{nextLabel}</PrimaryCTA>}
    </div>
  )
}

const S = {
  bar: {
    display: 'flex', alignItems: 'center', width: '100%', gap: 12,
  },
}
