import { useState } from 'react'
import ComposableQuestionnaireRenderer from '../../components/questionnaire/composable/ComposableQuestionnaireRenderer'

// Dev harness for the free-choice pause (SensingPauseOffer), Sense Foraging
// Study 2b's behavioural criterion. Route: /dev/sensing-pause-preview
//
// A short mock survey with both offers in place: a statement, offer 1, a
// statement, offer 2 (which also asks where they are and how tired). At the
// end it shows exactly what the survey would save. Nothing is saved.
// `?fast=1` brings the "Whenever you're ready" nudge forward to 10 s and the
// cap to 30 s, so both can be seen without waiting 3 and 10 minutes.

const SCALE = [
  { value: 1, label: 'Strongly disagree' }, { value: 2, label: 'Disagree' },
  { value: 3, label: 'Mildly disagree' }, { value: 4, label: 'Mildly agree' },
  { value: 5, label: 'Agree' }, { value: 6, label: 'Strongly agree' },
]

const statement = (id, question) => ({ id, type: 'likert', question, scale: SCALE, required: true, allow_pna: true })

function questionnaire(fast) {
  const timing = fast ? { nudge_ms: 10_000, cap_ms: 30_000 } : {}
  return {
    slug: 'sensing-pause-preview',
    name: 'Sensing pause (preview)',
    questionnaire_type: 'composable',
    pages: [
      { id: 'p1', components: [statement('demo_1', 'As I go about my day, I notice the light, colours and sounds around me with interest')] },
      { id: 'p2', components: [{ id: 'pause_1', type: 'sensing_pause', slot: 1, ...timing }] },
      { id: 'p3', components: [statement('demo_2', 'When I am busy, returning to the sensing mode feels like a low priority')] },
      { id: 'p4', components: [{ id: 'pause_2', type: 'sensing_pause', slot: 2, ...timing }] },
    ],
  }
}

export default function SensingPausePreview() {
  const fast = new URLSearchParams(window.location.search).has('fast')
  const [run, setRun] = useState(0)
  const [result, setResult] = useState(null)

  if (result) {
    const { pause_1: p1, pause_2: p2 } = result.responses
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
        <h1>What the survey would save</h1>
        <p>The two pause records, then the page timings the survey keeps for every questionnaire.</p>
        <pre style={{ background: '#fff', padding: 16, borderRadius: 12, overflowX: 'auto', fontSize: 12 }}>
          {JSON.stringify({ pause_1: p1, pause_2: p2, _timing: result.responses._timing }, null, 2)}
        </pre>
        <button type="button" className="cs-primary-button" onClick={() => { setResult(null); setRun(r => r + 1) }}>
          Run it again
        </button>
      </div>
    )
  }

  return (
    <ComposableQuestionnaireRenderer
      key={run}
      questionnaire={questionnaire(fast)}
      onComplete={setResult}
    />
  )
}
