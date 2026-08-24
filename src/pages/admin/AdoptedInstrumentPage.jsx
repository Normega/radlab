import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import VasRenderer from '../../components/vas/VasRenderer'
import {
  ProposedMultipleChoice, ProposedOpenList, ProposedHierarchy,
  AdoptedLikertSlider, AdoptedNumericSlider,
} from './proposedInstruments'

// ── AdoptedInstrumentPage (/admin/instruments/:slug) ──────────────────────────
// One page per instrument type: status chips, description, a live sample, and
// — for types with authored content — a divider and the existing library
// beneath (Norm, 2026-08-24: the Rating Scales library split apart; VAS and
// numeric sliders each own their list here, packages became Assessments).
// The legacy /admin/vas library remains routable for CRUD flows and previews;
// these pages link into it rather than duplicating it.

const CHIP = {
  green: { color: '#1E7A55', background: '#E2F4EA', border: '1px solid #BFE5D0' },
  pink:  { color: 'var(--pkd)', background: 'var(--bgp)', border: '1px solid var(--pkbs)' },
}

const PAGES = {
  'likert-slider': {
    title: 'Likert slider',
    source: 'NoDefaultSlider + composable-surveys SliderQuestion chrome',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Implementation pending', tone: 'pink' }],
    C: AdoptedLikertSlider,
    blurb: 'The discrete slider: stepped scale with point labels and no numeric readout — the label is the value. Dana’s track/thumb chrome combined with the platform’s no-default behavior (no thumb until the first touch).',
    note: 'The interactive sample is the review demo. The production component ships with the composable-surveys package integration.',
  },
  'numeric-slider': {
    title: 'Numeric slider',
    source: 'NoDefaultSlider + composable-surveys SliderQuestion chrome',
    chips: [{ label: 'Official format · adopted 2026-08-19', tone: 'green' }, { label: 'Chrome rollout pending', tone: 'pink' }],
    C: AdoptedNumericSlider,
    blurb: 'The continuous slider: numeric range with sparse anchors and a VALUE readout that stays “—” until touched. This is the official numeric-slider format (Norm, 2026-08-24); the sliders listed below render in the legacy chrome until the rollout.',
    note: null,
    library: {
      table: 'slider_scales', title: 'Existing numeric sliders',
      newLink: '/admin/sliders/new', newLabel: '+ New Slider',
      row: r => ({ name: r.prompt || r.slug, meta: `${r.min}–${r.max}${r.min_label ? ` · ${r.min_label} → ${r.max_label ?? ''}` : ''}` }),
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
    source: 'composable-surveys: MultipleChoiceQuestion',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Implementation pending', tone: 'pink' }],
    C: ProposedMultipleChoice,
    blurb: 'Single-select multiple choice, where an option can be plain or carry inline text/number entry with prefix/suffix and bounds. Fills a real gap: the platform has never had a generic MC instrument.',
    note: 'The interactive sample is the review demo. The production component ships with the composable-surveys package integration.',
  },
  'open-list': {
    title: 'Open text list + contribution ratings',
    source: 'composable-surveys: OpenTextListQuestion',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Implementation pending', tone: 'pink' }],
    C: ProposedOpenList,
    blurb: 'Participant-generated factors with a per-factor rating: typing text reveals a contribution slider beneath that row, filling the last row grows a new one, and entries are word-capped with a live counter.',
    note: 'The interactive sample is the review demo. The production component ships with the composable-surveys package integration.',
  },
  'hierarchy': {
    title: 'Hierarchical belief question',
    source: 'composable-surveys: HierarchicalBeliefQuestion',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Implementation pending', tone: 'pink' }],
    C: ProposedHierarchy,
    blurb: 'A belief hierarchy shown whole, indented by level. Participants select every level that changed; each selected level reveals a signed direction slider. Generalizes to any nested-construct rating.',
    note: 'The interactive sample is the review demo. The production component ships with the composable-surveys package integration.',
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
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['instrument-lib', cfg.table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(cfg.table).select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <div>
      <div style={S.divider} />
      <div style={S.libHead}>
        <h2 style={S.libTitle}>{cfg.title}{!isLoading && !error ? ` (${data.length})` : ''}</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to={cfg.newLink} style={S.newBtn}>{cfg.newLabel}</Link>
          <Link to="/admin/vas" style={S.link}>Full library →</Link>
        </div>
      </div>
      {isLoading && <p style={S.muted}>Loading…</p>}
      {error && <p style={S.muted}>Could not load the list.</p>}
      {!isLoading && !error && data.length === 0 && <p style={S.muted}>Nothing here yet.</p>}
      {data.map(r => {
        const { name, meta } = cfg.row(r)
        const inner = (
          <>
            <span style={S.rowName}>{name}</span>
            <span style={S.rowMeta}>{meta}</span>
            <code style={S.rowSlug}>{r.slug}</code>
          </>
        )
        return cfg.itemLink ? (
          <Link key={r.id} to={cfg.itemLink(r)} style={{ ...S.row, textDecoration: 'none' }}>{inner}</Link>
        ) : (
          <div key={r.id} style={S.row}>{inner}</div>
        )
      })}
    </div>
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
