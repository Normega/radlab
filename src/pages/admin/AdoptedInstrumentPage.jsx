import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import VasRenderer from '../../components/vas/VasRenderer'
import SurveyComponentRenderer from '../../components/questionnaire/composable/SurveyComponentRenderer'
import '../../components/questionnaire/composable/composableSurvey.css'

// ── AdoptedInstrumentPage (/admin/instruments/:slug) ──────────────────────────
// One page per instrument type: status chips, description, a live sample, and
// — for types with authored content — a divider and the existing library
// beneath (Norm, 2026-08-24: the Rating Scales library split apart; VAS and
// numeric sliders each own their list here, packages became Assessments).
// The legacy /admin/vas library remains routable for CRUD flows and previews;
// these pages link into it rather than duplicating it.
//
// Since 2026-08-25 the interactive samples for the adopted types render the
// PRODUCTION components (src/components/questionnaire/composable/, ported from
// Dana's package), not the proposedInstruments.jsx review demos — those remain
// only on the Instrument Styles comparison page. The demo configs below mirror
// the seeds in 20260825_composable_instrument_seeds.sql; step 5 of the
// integration replaces them with composable_instruments DB rows.

const DEMO_CONFIGS = {
  likert_slider: {
    id: 'demo_noticing_frequency',
    type: 'likert_slider',
    question: 'How often did you notice this feeling today?',
    min: 1, max: 6, step: 1,
    labels: [
      { value: 1, label: 'Never' },
      { value: 2, label: 'Rarely' },
      { value: 3, label: 'Sometimes' },
      { value: 4, label: 'Often' },
      { value: 5, label: 'Very often' },
      { value: 6, label: 'Almost always' },
    ],
  },
  numeric_slider: {
    id: 'demo_goal_choice',
    type: 'slider',
    question: 'To what extent does pursuing this goal feel like your own choice, rather than something you feel pressured or required to pursue?',
    min: 0, max: 100, step: 1,
    labels: [
      { value: 0,   label: 'It does not feel like my own choice' },
      { value: 50,  label: 'It partly feels like my own choice' },
      { value: 100, label: 'It feels completely like my own choice' },
    ],
  },
  multiple_choice: {
    id: 'demo_target_grade',
    type: 'multiple_choice',
    question: 'What final grade are you aiming to achieve in this course?',
    required: true,
    options: [
      { id: 'specific_grade', label: 'I am aiming for a specific final grade.',
        response_type: 'number', placeholder: '85', suffix: '%', min: 0, max: 100, step: 1 },
      { id: 'pass_only', label: 'I do not have a specific target grade, as long as I pass.',
        response_type: 'plain' },
    ],
  },
  open_list: {
    id: 'demo_outcome_attribution',
    type: 'open_text_list',
    question: 'What do you think caused this outcome? Please list all the factors that you think contributed, and indicate how much each factor contributed.',
    required: true,
    initial_boxes: 3,
    max_words: 5,
    example_placeholder: 'Ex. I need better study strategies…',
    minimum_required_responses: 1,
    slider: {
      question: 'How much did this factor contribute?',
      min: 0, max: 100, step: 1,
      labels: [
        { value: 0, label: 'Did not contribute' },
        { value: 100, label: 'Contributed completely' },
      ],
    },
  },
  hierarchy: {
    id: 'demo_feedback_beliefs',
    type: 'hierarchical_belief',
    question: 'How much did this feedback change your belief about…',
    instruction: 'Select all of the beliefs that changed. You can select more than one.',
    allow_none_selected: true,
    beliefs: [
      { id: 'skill_specific',    depth: 0, level: 'Skill-specific',                  text: 'My understanding of the specific topic or skill assessed' },
      { id: 'strategy_specific', depth: 1, level: 'Strategy-specific',               text: 'Whether my current study strategy works for this course' },
      { id: 'meta_strategy',     depth: 2, level: 'Meta-strategy specific',          text: 'Whether my current strategy for managing my time, effort, and study process works for this course' },
      { id: 'course_efficacy',   depth: 3, level: 'Course-specific · self-efficacy', text: 'My ability to succeed in this subject area' },
      { id: 'domain_efficacy',   depth: 4, level: 'Domain-specific · self-efficacy', text: 'My ability to succeed in this domain' },
      { id: 'self_global',       depth: 5, level: 'Self-global · self-efficacy',     text: 'My general competence / self-worth' },
    ],
    slider: {
      question: 'Did this belief change in a positive or negative direction?',
      min: -50, max: 50, step: 1,
      labels: [
        { value: -50, label: 'Negative change' },
        { value: 0,   label: 'No directional change' },
        { value: 50,  label: 'Positive change' },
      ],
    },
  },
}

// Interactive stage around one production component: local state, nothing
// saved — the same controlled contract the session runtime will use.
function DemoStage({ config }) {
  const [value, setValue] = useState(undefined)
  return (
    <div style={{ padding: '20px 20px 24px' }} className="cs-page">
      <SurveyComponentRenderer config={config} value={value} onChange={setValue} />
    </div>
  )
}

const LikertSliderSample   = () => <DemoStage config={DEMO_CONFIGS.likert_slider} />
const NumericSliderSample  = () => <DemoStage config={DEMO_CONFIGS.numeric_slider} />
const MultipleChoiceSample = () => <DemoStage config={DEMO_CONFIGS.multiple_choice} />
const OpenListSample       = () => <DemoStage config={DEMO_CONFIGS.open_list} />
const HierarchySample      = () => <DemoStage config={DEMO_CONFIGS.hierarchy} />

const CHIP = {
  green: { color: '#1E7A55', background: '#E2F4EA', border: '1px solid #BFE5D0' },
  pink:  { color: 'var(--pkd)', background: 'var(--bgp)', border: '1px solid var(--pkbs)' },
}

const PAGES = {
  'likert-slider': {
    title: 'Likert slider',
    source: 'composable/LikertSliderQuestion.jsx + NoDefaultSlider',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Session runtime pending', tone: 'pink' }],
    C: LikertSliderSample,
    blurb: 'The discrete slider: stepped scale with point labels and no numeric readout — the label is the value. Dana’s track/thumb chrome combined with the platform’s no-default behavior (no thumb until the first touch).',
    note: 'The interactive sample is the production component (ported 2026-08-25). It becomes runnable in sessions when the dispatch step of the integration lands.',
  },
  'numeric-slider': {
    title: 'Numeric slider',
    source: 'composable/SliderQuestion.jsx + NoDefaultSlider',
    chips: [{ label: 'Official format · adopted 2026-08-19', tone: 'green' }, { label: 'Session runtime pending', tone: 'pink' }],
    C: NumericSliderSample,
    blurb: 'The continuous slider: numeric range with sparse anchors and a VALUE readout that stays “—” until touched. This is the official format (Norm, 2026-08-24). The track/thumb chrome shipped platform-wide 2026-08-25, and the sample and the library rows below now render through the production SliderQuestion component. Existing rows show start/end anchors derived from their min/max labels; a middle anchor appears once a row defines `anchors`.',
    note: null,
    library: {
      table: 'slider_scales', title: 'Existing numeric sliders',
      newLink: '/admin/sliders/new', newLabel: '+ New Slider',
      row: r => ({ name: r.prompt || r.slug, meta: `${r.min}–${r.max}${r.min_label ? ` · ${r.min_label} → ${r.max_label ?? ''}` : ''}` }),
      preview: r => <SliderPreview row={r} />,
    },
  },
  'vas': {
    title: 'VAS (emoji scales)',
    source: 'src/components/vas/VasRenderer.jsx',
    chips: [{ label: 'Current standard', tone: 'green' }],
    liveVas: true,
    blurb: 'The visual-analog scale with emoji anchors: one question, six anchor faces, tap or drag to answer. The sample below is the first scale in the library rendered live in preview mode (nothing saves).',
    note: null,
    library: {
      table: 'vas_scales', title: 'Existing VAS',
      newLink: '/admin/vas/new', newLabel: '+ New Scale',
      itemLink: r => `/admin/vas/${r.slug}`,
      row: r => ({ name: r.question || r.slug, meta: r.scale_type ?? '' }),
    },
  },
  'assessments': {
    title: 'Assessments',
    source: 'vas_packages',
    chips: [{ label: 'Current standard', tone: 'green' }],
    blurb: 'Custom combinations of instruments delivered as one unit — today these are the VAS packages (an ordered bundle of scales). As the composable-surveys integration lands, this is where mixed-instrument batteries live.',
    note: null,
    library: {
      table: 'vas_packages', title: 'Existing assessments',
      newLink: '/admin/vas/packages/new', newLabel: '+ New Package',
      row: r => ({ name: r.slug, meta: `${(r.scale_ids ?? []).length} scale${(r.scale_ids ?? []).length === 1 ? '' : 's'}` }),
    },
  },
  'multiple-choice': {
    title: 'Multiple choice',
    source: 'composable/MultipleChoiceQuestion.jsx',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Session runtime pending', tone: 'pink' }],
    C: MultipleChoiceSample,
    blurb: 'Single-select multiple choice, where an option can be plain or carry inline text/number entry with prefix/suffix and bounds. Fills a real gap: the platform has never had a generic MC instrument.',
    note: 'The interactive sample is the production component (ported 2026-08-25). It becomes runnable in sessions when the dispatch step of the integration lands.',
    library: {
      title: 'Existing multiple-choice questions',
      static: [{ id: 'demo-mc', name: 'Target grade (demo)', slug: 'demo' }],
      row: r => ({ name: r.name, meta: 'demo instance' }),
      preview: () => <MultipleChoiceSample />,
    },
  },
  'open-list': {
    title: 'Open text list + contribution ratings',
    source: 'composable/OpenTextListQuestion.jsx',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Session runtime pending', tone: 'pink' }],
    C: OpenListSample,
    blurb: 'Participant-generated factors with a per-factor rating: typing text reveals a contribution slider beneath that row, filling the last row grows a new one, and entries are word-capped with a live counter.',
    note: 'The interactive sample is the production component (ported 2026-08-25). It becomes runnable in sessions when the dispatch step of the integration lands.',
    library: {
      title: 'Existing open text lists',
      static: [{ id: 'demo-ol', name: 'Outcome attribution factors (demo)', slug: 'demo' }],
      row: r => ({ name: r.name, meta: 'demo instance' }),
      preview: () => <OpenListSample />,
    },
  },
  'hierarchy': {
    title: 'Hierarchical belief question',
    source: 'composable/HierarchicalBeliefQuestion.jsx',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Session runtime pending', tone: 'pink' }],
    C: HierarchySample,
    blurb: 'A belief hierarchy shown whole, indented by level. Participants select every level that changed; each selected level reveals a signed direction slider. Generalizes to any nested-construct rating.',
    note: 'The interactive sample is the production component (ported 2026-08-25). It becomes runnable in sessions when the dispatch step of the integration lands.',
    library: {
      title: 'Existing belief hierarchies',
      static: [{ id: 'demo-bh', name: 'Feedback belief hierarchy (demo)', slug: 'demo' }],
      row: r => ({ name: r.name, meta: 'demo instance' }),
      preview: () => <HierarchySample />,
    },
  },
}

export default function AdoptedInstrumentPage() {
  const { slug } = useParams()
  const meta = PAGES[slug]

  if (!meta) return (
    <div>
      <h1 style={S.title}>Unknown instrument</h1>
      <p style={S.blurb}>No instrument named “{slug}”. <Link to="/admin/instruments" style={S.link}>Back to Instrument Styles</Link>.</p>
    </div>
  )

  const Sample = meta.C
  return (
    <div>
      <h1 style={S.title}>{meta.title}</h1>
      <div style={S.statusRow}>
        {meta.chips.map(c => <span key={c.label} style={{ ...S.chip, ...CHIP[c.tone] }}>{c.label}</span>)}
        <code style={S.sourceChip}>{meta.source}</code>
      </div>
      <p style={S.blurb}>{meta.blurb}</p>
      {meta.note && (
        <p style={S.statusNote}>
          {meta.note} Comparison context lives on{' '}
          <Link to="/admin/instruments" style={S.link}>Instrument Styles</Link>.
        </p>
      )}

      {Sample && (
        <div className="spec-stage" style={S.stage}><Sample /></div>
      )}
      {meta.liveVas && <LiveVasSample />}

      {meta.library && <Library cfg={meta.library} />}
    </div>
  )
}

// ── Live VAS sample — first scale in the library, preview mode ────────────────

function LiveVasSample() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vas-scales-first'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vas_scales').select('*')
        .order('created_at', { ascending: true }).limit(1)
      if (error) throw error
      return data?.[0] ?? null
    },
  })
  if (isLoading) return <p style={S.muted}>Loading sample scale…</p>
  if (error || !data) return <p style={S.muted}>No VAS in the library yet — the sample renders the first scale once one exists.</p>
  return (
    <div className="spec-stage" style={S.stage}>
      <VasRenderer scale={data} userId={null} previewMode onComplete={() => {}} />
    </div>
  )
}

// ── Library — the existing authored items of this type ────────────────────────

function Library({ cfg }) {
  const [open, setOpen] = useState(null)
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['instrument-lib', cfg.table ?? 'static'],
    enabled: !!cfg.table,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(cfg.table).select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
  const rows = cfg.static ?? data
  const ready = cfg.static || (!isLoading && !error)

  return (
    <div>
      <div style={S.divider} />
      <div style={S.libHead}>
        <h2 style={S.libTitle}>{cfg.title}{ready ? ` (${rows.length})` : ''}</h2>
        {cfg.newLink && <Link to={cfg.newLink} style={S.newBtn}>{cfg.newLabel}</Link>}
      </div>
      {!cfg.static && isLoading && <p style={S.muted}>Loading…</p>}
      {!cfg.static && error && <p style={S.muted}>Could not load the list.</p>}
      {ready && rows.length === 0 && <p style={S.muted}>Nothing here yet.</p>}
      {ready && rows.map(r => {
        const { name, meta } = cfg.row(r)
        const inner = (
          <>
            <span style={S.rowName}>{name}</span>
            <span style={S.rowMeta}>{meta}</span>
            {r.slug && <code style={S.rowSlug}>{r.slug}</code>}
          </>
        )
        if (cfg.itemLink) return (
          <Link key={r.id} to={cfg.itemLink(r)} style={{ ...S.row, textDecoration: 'none' }}>{inner}</Link>
        )
        // Expandable in-place preview — click the row to view the instance.
        const isOpen = open === r.id
        return (
          <div key={r.id}>
            <button style={{ ...S.row, width: '100%', cursor: 'pointer', textAlign: 'left', border: isOpen ? '1px solid var(--pkbs)' : '1px solid var(--bd)' }}
              onClick={() => setOpen(isOpen ? null : r.id)}>
              {inner}
              <span style={{ ...S.rowMeta, marginLeft: 'auto' }}>{isOpen ? 'Hide ▲' : 'View ▼'}</span>
            </button>
            {isOpen && cfg.preview && (
              <div className="spec-stage" style={{ ...S.stage, margin: '0 0 12px' }}>{cfg.preview(r)}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// In-place viewer for an authored numeric slider — renders through the SAME
// production component as the sample above (Norm, 2026-08-25: the template is
// enforced), so prior sliders get the white card, anchors, and VALUE box.
// A row's `anchors` jsonb (20260825_composable_instruments.sql) is the full
// anchor spec; rows without one fall back to start/end from min/max labels.
function SliderPreview({ row }) {
  const min = row.min ?? 0
  const max = row.max ?? 100
  return (
    <DemoStage config={{
      id: `slider_${row.slug}`,
      type: 'slider',
      question: row.prompt,
      min,
      max,
      step: row.step ?? 1,
      labels: row.anchors ?? [
        { value: min, label: row.min_label ?? '' },
        { value: max, label: row.max_label ?? '' },
      ],
    }} />
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  title: { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 12px' },
  statusRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  chip: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
    padding: '3px 10px', borderRadius: 12,
  },
  sourceChip: {
    fontFamily: MONO, fontSize: 11, color: 'var(--tx2)', background: 'var(--bgp)',
    padding: '3px 10px', borderRadius: 12,
  },
  blurb:      { fontFamily: SANS, fontSize: 14, color: 'var(--tx)', lineHeight: 1.6, margin: '0 0 10px', maxWidth: 680 },
  statusNote: { fontFamily: SANS, fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 680 },
  link:       { color: 'var(--pk)', fontFamily: SANS, fontSize: 13 },
  stage: {
    background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 12,
    overflow: 'hidden', position: 'relative', maxWidth: 860,
  },

  divider: { height: 1, background: 'var(--bds)', margin: '28px 0 20px', maxWidth: 860 },
  libHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    gap: 12, flexWrap: 'wrap', marginBottom: 12, maxWidth: 860,
  },
  libTitle: { fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  newBtn: {
    fontFamily: SANS, fontWeight: 600, fontSize: 13, padding: '6px 12px',
    background: 'var(--pk)', color: '#fff', borderRadius: 20, textDecoration: 'none',
  },
  row: {
    display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap',
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10,
    padding: '10px 14px', marginBottom: 8, maxWidth: 860,
  },
  rowName: { fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--tx)', flex: '1 1 260px', minWidth: 0 },
  rowMeta: { fontFamily: SANS, fontSize: 12.5, color: 'var(--tx2)' },
  rowSlug: { fontFamily: MONO, fontSize: 11, color: 'var(--gy)' },
  muted:   { fontFamily: SANS, fontSize: 13, color: 'var(--tx2)', margin: '4px 0 0' },
}
