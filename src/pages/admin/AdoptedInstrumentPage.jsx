import { useParams, Link } from 'react-router-dom'
import { ProposedMultipleChoice, ProposedOpenList, ProposedHierarchy } from './proposedInstruments'

// ── AdoptedInstrumentPage (/admin/instruments/:slug) ──────────────────────────
// One page per instrument type adopted from Dana's composable-surveys package
// (adoption decision: Norm, 2026-08-19). Each shows the live review sample and
// an honest status: adopted, implementation pending — the production
// components ship with the package integration (questionnaire_type:
// "composable"), at which point these pages become the instrument's library/
// authoring home and the demo sample retires.

const ADOPTED = {
  'multiple-choice': {
    title: 'Multiple choice',
    source: 'MultipleChoiceQuestion',
    C: ProposedMultipleChoice,
    blurb: 'Single-select multiple choice, where an option can be plain or carry inline text/number entry with prefix/suffix and bounds. Fills a real gap: the platform has never had a generic MC instrument — demographics and screeners each hand-roll their own.',
  },
  'open-list': {
    title: 'Open text list + contribution ratings',
    source: 'OpenTextListQuestion',
    C: ProposedOpenList,
    blurb: 'Participant-generated factors with a per-factor rating: typing text reveals a contribution slider beneath that row, filling the last row grows a new one, and entries are word-capped with a live counter.',
  },
  'hierarchy': {
    title: 'Hierarchical belief question',
    source: 'HierarchicalBeliefQuestion',
    C: ProposedHierarchy,
    blurb: 'A belief hierarchy shown whole, indented by level. Participants select every level that changed; each selected level reveals a signed direction slider. Generalizes to any nested-construct rating.',
  },
}

export default function AdoptedInstrumentPage() {
  const { slug } = useParams()
  const meta = ADOPTED[slug]

  if (!meta) return (
    <div>
      <h1 style={S.title}>Unknown instrument</h1>
      <p style={S.blurb}>No adopted instrument named “{slug}”. <Link to="/admin/instruments" style={S.link}>Back to Instrument Styles</Link>.</p>
    </div>
  )

  const Sample = meta.C
  return (
    <div>
      <h1 style={S.title}>{meta.title}</h1>
      <div style={S.statusRow}>
        <span style={S.adoptedChip}>Adopted 2026-08-19</span>
        <span style={S.pendingChip}>Implementation pending</span>
        <code style={S.sourceChip}>composable-surveys: {meta.source}</code>
      </div>
      <p style={S.blurb}>{meta.blurb}</p>
      <p style={S.statusNote}>
        The interactive sample below is the review demo transcribed from Dana&rsquo;s approved
        prototype. The production component ships with the composable-surveys package integration
        (<code style={S.inlineCode}>questionnaire_type: &quot;composable&quot;</code>), at which point
        this page becomes the instrument&rsquo;s authoring home. Comparison context lives on{' '}
        <Link to="/admin/instruments" style={S.link}>Instrument Styles</Link>.
      </p>
      <div className="spec-stage" style={S.stage}>
        <Sample />
      </div>
    </div>
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  title: { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 12px' },
  statusRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  adoptedChip: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: '#1E7A55', background: '#E2F4EA', border: '1px solid #BFE5D0',
    padding: '3px 10px', borderRadius: 12,
  },
  pendingChip: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--pkd)', background: 'var(--bgp)', border: '1px solid var(--pkbs)',
    padding: '3px 10px', borderRadius: 12,
  },
  sourceChip: {
    fontFamily: MONO, fontSize: 11, color: 'var(--tx2)', background: 'var(--bgp)',
    padding: '3px 10px', borderRadius: 12,
  },
  blurb:      { fontFamily: SANS, fontSize: 14, color: 'var(--tx)', lineHeight: 1.6, margin: '0 0 10px', maxWidth: 680 },
  statusNote: { fontFamily: SANS, fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 680 },
  inlineCode: { fontFamily: MONO, fontSize: 12, background: 'var(--bgp)', padding: '1px 5px', borderRadius: 4 },
  link:       { color: 'var(--pk)' },
  stage: {
    background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 12,
    overflow: 'hidden', position: 'relative', maxWidth: 860,
  },
}
