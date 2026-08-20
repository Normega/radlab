import { useState } from 'react'
import { Link } from 'react-router-dom'
import LikertItem from '../../components/questionnaire/LikertItem'
import InstructionScreen from '../../components/questionnaire/InstructionScreen'
import ScaleChangeScreen from '../../components/questionnaire/ScaleChangeScreen'
import ChecklistScreen from '../../components/questionnaire/ChecklistScreen'
import ProgressLabel from '../../components/questionnaire/ProgressLabel'
import NoDefaultSlider from '../../components/study/NoDefaultSlider'
import DebriefStep from '../../components/study/DebriefStep'
import MoodCheckinStep from '../../components/study/MoodCheckinStep'
import WellnessTipStep from '../../components/study/WellnessTipStep'
import { OwlScreen } from '../../components/study/InterventionPage'
import FillableBox from '../../components/ui/FillableBox'
import Checkbox from '../../components/ui/Checkbox'
import {
  ProposedLikert, AdoptedLikertSlider, AdoptedNumericSlider,
  ProposedMultipleChoice, ProposedOpenList, ProposedHierarchy,
} from './proposedInstruments'

// ── InstrumentStylesPage (/admin/instruments) ─────────────────────────────────
// A live style inventory of the participant-facing instrument components
// (Norm, 2026-08-19): one real sample per standardized type, rendered by the
// ACTUAL component — not a mockup — so what this page shows is by definition
// the current style. Two audiences: trainees seeing what already exists before
// asking for something new, and design reviews comparing current against
// proposed variants (each sample is staged under a CURRENT caption so a
// PROPOSED twin can mount beside it — pass `proposed` to Spec).
//
// Every sample is interactive but inert: previewMode where the component
// writes, no-op onComplete everywhere. Reset remounts everything via key.
//
// Deliberately NOT here (own full-viewport layouts or DB-backed content) —
// the footer links to their live preview homes instead: the assembled
// QuestionnaireRenderer flow, the VAS emoji scale, and authored Displays.

export default function InstrumentStylesPage() {
  const [resetKey, setResetKey] = useState(0)

  return (
    <div>
      <div style={S.headRow}>
        <div>
          <h1 style={S.title}>Instrument styles</h1>
          <p style={S.sub}>
            The current standard for each participant-facing instrument, rendered live by the real
            component. When a redesign is proposed, mount it beside the current sample here and the
            comparison is the review.
          </p>
        </div>
        <button style={S.resetBtn} onClick={() => setResetKey(k => k + 1)}>Reset samples</button>
      </div>

      <div key={resetKey} style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

        <Spec
          title="Likert item"
          file="src/components/questionnaire/LikertItem.jsx"
          notes="Current: vertical, every point labelled, one item per screen. Proposed (Dana's composable-surveys package): horizontal 7-box row, anchors under the endpoints only, several items per page with ITEM eyebrows. These are the two classic administrations — the review question is which is the default and whether orientation becomes an instrument parameter."
          proposed={<ProposedLikert />}
        >
          <LikertSample />
        </Spec>

        <Spec
          title="Likert slider"
          file="src/components/study/NoDefaultSlider.jsx → Dana chrome"
          notes="Adopted 2026-08-19 (own sidebar entry under Instruments). Sliders split into two instruments; this is the discrete one — stepped scale with point labels, no numeric readout (the label is the value). Dana's track/thumb chrome combined with the platform's no-default behavior: no thumb until the first touch."
          proposedCaption="Adopted — implementation pending"
          proposed={<AdoptedLikertSlider />}
        >
          <SliderSample />
        </Spec>

        <Spec
          title="Numeric slider"
          file="src/components/study/NoDefaultSlider.jsx → Dana chrome"
          notes="Adopted 2026-08-19 (own sidebar entry under Instruments). The continuous one — 0–100 with sparse numbered anchors and a VALUE readout that stays '—' until touched. Same Dana chrome, same no-default behavior."
          proposedCaption="Adopted — implementation pending"
          proposed={<AdoptedNumericSlider />}
        >
          <NumericSliderSample />
        </Spec>

        <Spec
          title="Multiple choice"
          file="composable-surveys: MultipleChoiceQuestion"
          notes="Adopted 2026-08-19 (has its own sidebar entry under Instruments). The platform never had a generic single-select multiple-choice instrument — demographics and screeners each hand-roll their own. Options can be plain, or carry inline text/number entry with prefix/suffix and bounds (select the first option to see it)."
          proposedCaption="Adopted — implementation pending"
          proposed={<ProposedMultipleChoice />}
        />

        <Spec
          title="Open text list + contribution ratings"
          file="composable-surveys: OpenTextListQuestion"
          notes="Adopted 2026-08-19 (has its own sidebar entry under Instruments). Participant-generated factors with a per-factor rating: typing text reveals a contribution slider beneath that row, and filling the last row grows a new one. Word-capped with a live counter."
          proposedCaption="Adopted — implementation pending"
          proposed={<ProposedOpenList />}
        />

        <Spec
          title="Hierarchical belief question"
          file="composable-surveys: HierarchicalBeliefQuestion"
          notes="Adopted 2026-08-19 (has its own sidebar entry under Instruments). A belief hierarchy shown whole, indented by level; participants select every level that changed, and each selected level reveals a signed direction slider. Generalizes to any nested-construct rating."
          proposedCaption="Adopted — implementation pending"
          proposed={<ProposedHierarchy />}
        />

        <Spec
          title="Questionnaire instruction screen"
          file="src/components/questionnaire/InstructionScreen.jsx"
          notes="What a participant sees before a questionnaire begins: name, instructions, and the response scale previewed up front."
          tall
        >
          <InstructionScreen
            questionnaire={{
              name: 'Sample Mood Scale',
              instructions: 'Read each statement and choose the response that best describes your experience over the past week. There are no right or wrong answers.',
              scale_labels: FIVE_POINT,
            }}
            onBegin={() => {}}
          />
        </Spec>

        <Spec
          title="Scale-change interstitial"
          file="src/components/questionnaire/ScaleChangeScreen.jsx"
          notes="Shown mid-questionnaire when the response scale changes between parts, so the switch is never silent."
          tall
        >
          <ScaleChangeScreen
            slide={{
              scaleMin: 1, scaleMax: 7,
              anchorLow: 'Never', anchorHigh: 'Always',
              labels: [
                { value: 1, label: 'Never' }, { value: 2, label: '' }, { value: 3, label: '' },
                { value: 4, label: 'Sometimes' }, { value: 5, label: '' }, { value: 6, label: '' },
                { value: 7, label: 'Always' },
              ],
            }}
            onContinue={() => {}}
          />
        </Spec>

        <Spec
          title="Progress header + instruction reminder"
          file="src/components/questionnaire/ProgressLabel.jsx"
          notes="The sticky strip above every questionnaire item: part and item counters, plus the instructions repeated as a persistent reminder."
        >
          <ProgressLabel
            partNumber={1} totalParts={3}
            partName="Sample Mood Scale"
            itemIndex={4} totalItems={12}
            instructions="Rate each statement for the past week."
          />
        </Spec>

        <Spec
          title="Checklist"
          file="src/components/questionnaire/ChecklistScreen.jsx"
          notes="Count-based items (life events, symptoms): each row is checked off or counted up rather than rated. The Next button belongs to the surrounding flow, so this sample has no submit."
        >
          <ChecklistSample />
        </Spec>

        <Spec
          title="Display / debrief screen"
          file="src/components/study/DebriefStep.jsx"
          notes="The standard end-of-study text screen. Shown with its built-in placeholder copy; real studies pass their own HTML."
          tall
        >
          <DebriefStep onComplete={() => {}} />
        </Spec>

        <Spec
          title="Owl instruction screen"
          file="src/components/study/InterventionPage.jsx (OwlScreen)"
          notes="The Liliana study's instruction voice: mascot plus speech bubble. The atomic screen unit its intervention modules are built from."
        >
          <OwlScreen owl="owl_waving" text="Welcome back! Today we'll practice noticing a feeling without needing to change it." />
        </Spec>

        <Spec
          title="Daily mood check-in (study)"
          file="src/components/study/MoodCheckinStep.jsx"
          notes="The Zerin-protocol daily check-in card. Rendered in preview mode — nothing saves. The reflective arm adds a free-text prompt below the sliders."
          tall
        >
          <MoodCheckinStep
            previewMode
            enrollment={null}
            studyDay={3}
            sendTime="09:00"
            subcategory="mood_checkin"
            onComplete={() => {}}
          />
        </Spec>

        <Spec
          title="Wellness tip (control arm)"
          file="src/components/study/WellnessTipStep.jsx"
          notes="The control condition's daily touchpoint: one scripted tip per day-slot. Preview mode shows Day 1, morning."
          tall
        >
          <WellnessTipStep previewMode enrollment={null} onComplete={() => {}} />
        </Spec>

        <Spec
          title="Form primitives"
          file="src/components/ui/FillableBox.jsx · src/components/ui/Checkbox.jsx"
          notes="The shared text input and checkbox used across auth, onboarding, and study forms."
        >
          <PrimitivesSample />
        </Spec>

      </div>

      <div style={S.footer}>
        <p style={S.footerHead}>Not shown here — these have live preview homes of their own:</p>
        <ul style={S.footerList}>
          <li><Link to="/admin/questionnaires" style={S.link}>Questionnaires</Link> — the assembled QuestionnaireRenderer flow, previewable per questionnaire (it owns the full viewport, including the fixed Back/Next bar)</li>
          <li><Link to="/admin/vas" style={S.link}>Rating Scales</Link> — the VAS emoji-anchor scales, previewable per scale with their real anchor art</li>
          <li><Link to="/admin/displays" style={S.link}>Displays</Link> — admin-authored display screens, rendered from their stored blocks</li>
        </ul>
      </div>
    </div>
  )
}

// ── Interactive samples (local state only) ────────────────────────────────────

const FIVE_POINT = [
  { value: 1, label: 'Strongly disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly agree' },
]

function LikertSample() {
  const [v, setV] = useState(null)
  return (
    <div style={{ padding: '8px 0 28px' }}>
      <LikertItem
        item={{ id: 'demo-likert', text: 'I felt calm and relaxed over the past week.' }}
        labels={FIVE_POINT}
        selectedValue={v}
        onSelect={setV}
        autoAdvance={false}
        endpointOnly={false}
      />
    </div>
  )
}

function SliderSample() {
  const [v, setV] = useState(null)
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 28px' }}>
      {/* The card chrome study consumers give the slider (VasStepWrapper's
          StudySliderBlock) — the slider itself is the bare block inside. */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 24px 18px' }}>
        <p style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 'var(--fs-body)', color: 'var(--tx)', margin: '0 0 18px' }}>
          How often did you notice this feeling today?
        </p>
        <NoDefaultSlider
          min={1} max={6} value={v} onChange={setV}
          ariaLabel="How often did you notice this feeling today?"
          pointLabels={['Never', 'Rarely', 'Sometimes', 'Often', 'Very often', 'Almost always']}
        />
      </div>
    </div>
  )
}

function NumericSliderSample() {
  const [v, setV] = useState(null)
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 28px' }}>
      {/* The same NoDefaultSlider on a 0–100 span — above 12 ticks it draws no
          point labels, which is exactly the current numeric-slider experience. */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 24px 18px' }}>
        <p style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 'var(--fs-body)', color: 'var(--tx)', margin: '0 0 18px' }}>
          To what extent does pursuing this goal feel like your own choice?
        </p>
        <NoDefaultSlider
          min={0} max={100} value={v} onChange={setV}
          ariaLabel="To what extent does pursuing this goal feel like your own choice?"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11, color: 'var(--tx2)', marginTop: 6 }}>
          <span>Not at all my choice</span><span>Completely my choice</span>
        </div>
      </div>
    </div>
  )
}

function ChecklistSample() {
  const [resp, setResp] = useState({})
  return (
    <div style={{ paddingBottom: 28 }}>
      <ChecklistScreen
        items={[
          { id: 'c1', text: 'Had trouble falling asleep', weight: 1, allow_multiple: false },
          { id: 'c2', text: 'Skipped a meal', weight: 1, allow_multiple: true },
          { id: 'c3', text: 'Argued with someone close to me', weight: 2, allow_multiple: true },
        ]}
        responses={resp}
        onChange={(item, update) => setResp(p => {
          const n = update(p[item.id]?.occurrence_count ?? 0)
          return { ...p, [item.id]: { response_value: (item.weight ?? 0) * n, item_weight: item.weight ?? 0, occurrence_count: n } }
        })}
      />
    </div>
  )
}

function PrimitivesSample() {
  const [text, setText] = useState('')
  const [checked, setChecked] = useState(false)
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <FillableBox
        label="Display name"
        description="Shown on leaderboards."
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="e.g. River"
      />
      <Checkbox checked={checked} onChange={e => setChecked(e.target.checked)}>
        I agree to the study terms
      </Checkbox>
    </div>
  )
}

// ── Spec — one instrument section ─────────────────────────────────────────────
// `proposed`: mount a proposed redesign here and the section becomes a
// side-by-side CURRENT / PROPOSED comparison. With no children at all, the
// CURRENT column states there is no current equivalent — a proposed addition.

function Spec({ title, file, notes, tall = false, children, proposed = null, proposedCaption = 'Proposed' }) {
  return (
    <section>
      <div style={S.specHead}>
        <h2 style={S.specTitle}>{title}</h2>
        <code style={S.specFile}>{file}</code>
      </div>
      <p style={S.specNotes}>{notes}</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <p style={S.stageCaption}>Current</p>
          {children ? (
            <div className="spec-stage" style={{ ...S.stage, ...(tall ? S.stageTall : {}) }}>{children}</div>
          ) : (
            <div style={S.noCurrent}>No current equivalent — new instrument type.</div>
          )}
        </div>
        {proposed && (
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <p style={{ ...S.stageCaption, color: 'var(--pk)' }}>{proposedCaption}</p>
            <div className="spec-stage" style={{ ...S.stage, ...(tall ? S.stageTall : {}), borderColor: 'var(--pkbs)' }}>{proposed}</div>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  headRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 16, flexWrap: 'wrap', marginBottom: 32,
  },
  title: { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 8px' },
  sub:   { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, margin: 0, maxWidth: 620 },
  resetBtn: {
    fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: '8px 14px',
    background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 24,
    color: 'var(--tx2)', cursor: 'pointer', flexShrink: 0,
  },

  specHead:  { display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 },
  specTitle: { fontFamily: SERIF, fontSize: 19, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  specFile:  { fontFamily: MONO, fontSize: 11, color: 'var(--tx2)', background: 'var(--bgp)', padding: '2px 8px', borderRadius: 8, wordBreak: 'break-all' },
  specNotes: { fontFamily: SANS, fontSize: 13, color: 'var(--tx2)', lineHeight: 1.55, margin: '0 0 12px', maxWidth: 720 },

  stageCaption: {
    fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--gy)', margin: '0 0 6px',
  },
  noCurrent: {
    border: '1.5px dashed var(--bds)', borderRadius: 12, minHeight: 120,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: SANS, fontSize: 13, color: 'var(--gy)', fontStyle: 'italic',
    padding: 20, textAlign: 'center',
  },
  // overflow hidden also confines ProgressLabel's position: sticky.
  stage: {
    background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 12,
    overflow: 'hidden', position: 'relative',
  },
  // Screens that centre in 60–70vh get a scroll frame instead of a mile of page.
  stageTall: { maxHeight: 560, overflowY: 'auto' },

  footer:     { marginTop: 44, paddingTop: 20, borderTop: '1px solid var(--bd)' },
  footerHead: { fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--tx)', margin: '0 0 8px' },
  footerList: { fontFamily: SANS, fontSize: 13, color: 'var(--tx2)', lineHeight: 1.8, margin: 0, paddingLeft: 20 },
  link:       { color: 'var(--pk)' },
}
