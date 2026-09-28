import { useState } from 'react'
import InterventionPage from '../../components/study/InterventionPage'

// Dev harness for the short-form Breath Sensation module: the guided video of
// non-reactivity Phase 1 Day 1 replaced by the interactive breath_practice
// block (~2 min). Route: /dev/breath-sensation-preview
//
// Not yet in intervention_modules. When the short-form study is built, this
// MODULE is the definition to import (TrainingUpload validates it as-is).
// `?demo=1` shows the per-stage skip button reviewers use; without it the
// preview runs exactly as a participant would see it, timings included.

const MODULE = {
  module_id: 'non-reactivity-phase1-day1-short',
  condition: 'non_reactivity',
  phase: 'phase1',
  lesson: 1,
  title: 'Breath Sensation',
  subtitle: 'Stabilizing attention',
  lead_in: {
    owl: 'owl_nonreactivity',
    text: 'Today’s practice takes about two minutes. Find a quiet spot where you can sit comfortably, then press Next.',
  },
  steps: [
    { type: 'breath_practice', key: 'breath_sensation', label: 'Breath sensation', voice_base: '/audio/breath-sensation/' },
  ],
  lead_out: {
    owl: 'owl_love',
    text: 'You’ve completed today’s training. Please press Next to complete your post-session check-in.',
  },
}

export default function BreathSensationPreview() {
  const demo = new URLSearchParams(window.location.search).has('demo')
  const [run, setRun] = useState(0)
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <InterventionPage
        key={run}
        module={MODULE}
        participantId={null}
        dayDataId={null}
        scheduleId={null}
        studyDay={1}
        onComplete={() => setRun(r => r + 1)}
        demoMode={demo}
      />
    </div>
  )
}
