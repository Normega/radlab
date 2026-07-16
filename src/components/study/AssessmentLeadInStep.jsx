import { interventionStyles as S } from './InterventionPage'

/**
 * Owl "Begin Check-in" lead-in shown before the midpoint and final/post
 * assessment sessions, so participants aren't dropped directly into the
 * first questionnaire. Copy is Liliana's canonical wording (Study 3
 * Leadins/, 2026-07-14), hardcoded here the same way MidpointStep.jsx
 * hardcodes its own copy rather than loading it from a DB row.
 *
 */

const STUDY_STEPS = ['Check-in', 'Phase 1', 'Mid Check-in', 'Phase 2', 'Final Check-in']

const LEADINS = {
  midpoint: {
    badge: 'Mid-Study Assessment',
    owl: 'owl_veryhappy',
    activeStep: 2,
    paragraphs: [
      "You've made it to the midpoint of the study. Great work so far!",
      "Today we're asking you to complete a check-in assessment before your next session begins. This is an important step: your responses will help us understand how the practice has been going for you, and will determine which intervention you'll be working with in the second half of the study.",
      "You have 3 days (including today) to complete this, but please don't wait too long, as your spot in Phase 2 depends on finishing this check-in within the window.",
      "Click below whenever you're ready:",
    ],
    buttonLabel: 'Begin Check-in',
  },
  post: {
    badge: 'Final Assessment',
    owl: 'owl_veryhappy',
    activeStep: 4,
    paragraphs: [
      "You've nearly completed the study. Congratulations on making it this far!",
      "All that's left is your final assessment. Your responses will help us understand the full picture of your experience over the past weeks, and are an important part of the research.",
      "You have 3 days (including today) to complete this. When you're ready, click the link below:",
    ],
    buttonLabel: 'Begin Check-in',
  },
}

export default function AssessmentLeadInStep({ variant, onComplete }) {
  const content = LEADINS[variant]

  if (!content) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#e04' }}>Unknown assessment lead-in variant: {variant}</div>
  }

  const owlSrc = `/assets/owls/${content.owl}.png`

  return (
    <div style={S.bg}>
      <div style={S.page}>
        <div style={S.progressBar}>
          <div style={{ display: 'flex' }}>
            {STUDY_STEPS.map((label, i) => {
              const state = i < content.activeStep ? 'done' : i === content.activeStep ? 'active' : 'upcoming'
              const dotColor = state === 'done' ? 'var(--pk)' : state === 'active' ? 'var(--tx)' : '#ddd'
              const labelColor = state === 'done' ? 'var(--pk)' : state === 'active' ? 'var(--tx)' : 'var(--gy)'
              return (
                <div key={label} style={S.stepCol}>
                  <span style={{ ...S.stepLabel, color: labelColor }}>{label}</span>
                  <div style={{ ...S.stepTrack, background: dotColor }}>
                    <div style={{ ...S.stepDot, background: dotColor }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={M.badgeRow}>
          <span style={M.badge}>{content.badge}</span>
        </div>

        <div style={S.owlScreen}>
          <img src={owlSrc} alt="" style={S.owlImg} />
          <div style={S.speechBubble}>
            {content.paragraphs.map((p, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : '12px 0 0' }}>{p}</p>
            ))}
          </div>
        </div>

        <div style={S.footer}>
          <button style={S.btnNext} onClick={() => onComplete?.({ leadin_variant: variant })}>
            {content.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const M = {
  badgeRow: { padding: '20px 24px 0' },
  badge: {
    display: 'inline-block',
    background: 'var(--bgp)', color: 'var(--pk)', border: '1px solid var(--pkbs)',
    borderRadius: 999, fontSize: 11, fontWeight: 600,
    letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 12px',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
}
