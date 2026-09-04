import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import VasRenderer from '../../components/vas/VasRenderer'
import SurveyComponentRenderer from '../../components/questionnaire/composable/SurveyComponentRenderer'
import { DB_COMPONENT_TYPE } from '../../components/questionnaire/composable/componentRegistry'
import '../../components/questionnaire/composable/composableSurvey.css'

// ── AdoptedInstrumentPage (/admin/instruments/:slug) ──────────────────────────
// One page per instrument type: status chips, description, a live sample, and
// — for types with authored content — a divider and the existing library
// beneath (Norm, 2026-08-24: the Rating Scales library split apart; VAS and
// numeric sliders each own their list here, packages became Assessments).
// The legacy /admin/vas library remains routable for CRUD flows and previews;
// these pages link into it rather than duplicating it.
//
// The samples and libraries for the four composable types render REAL
// composable_instruments rows through the PRODUCTION components (step 5 of
// the integration, 2026-08-25) — the same rows a session step loads, so what
// this page shows is by definition what a participant gets. The review demos
// remain only on the Instrument Styles comparison page.

// The numeric-slider sample keeps a canonical demo config: numeric sliders
// live in slider_scales (listed below it), and no authored row carries a
// middle anchor yet — the demo is the one place the full official format
// (sparse three-anchor spec) is always visible.
const NUMERIC_SLIDER_DEMO = {
  id: 'demo_goal_choice',
  type: 'slider',
  question: 'To what extent does pursuing this goal feel like your own choice, rather than something you feel pressured or required to pursue?',
  min: 0, max: 100, step: 1,
  labels: [
    { value: 0,   label: 'It does not feel like my own choice' },
    { value: 50,  label: 'It partly feels like my own choice' },
    { value: 100, label: 'It feels completely like my own choice' },
  ],
}

// Interactive stage around one production component: local state, nothing
// saved — the same controlled contract the session runtime uses.
function DemoStage({ config }) {
  const [value, setValue] = useState(undefined)
  return (
    <div style={{ padding: '20px 20px 24px' }} className="cs-page">
      <SurveyComponentRenderer config={config} value={value} onChange={setValue} />
    </div>
  )
}

const instrumentConfig = r => ({ id: r.slug, type: DB_COMPONENT_TYPE[r.type], ...r.config })

// Live sample for a composable type: the first instrument of that type in the
// library, rendered through the production component (same pattern as the VAS
// sample below).
function InstrumentSample({ type }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['composable-instrument-first', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('composable_instruments').select('*').eq('type', type)
        .order('created_at', { ascending: true }).limit(1)
      if (error) throw error
      return data?.[0] ?? null
    },
  })
  if (isLoading) return <p style={S.muted}>Loading sample instrument…</p>
  if (error || !data) return <p style={S.muted}>No instrument of this type in the library yet — the sample renders the first one once it exists.</p>
  // The page already wraps samples in the spec-stage box.
  return <DemoStage config={instrumentConfig(data)} />
}

const LikertSliderSample   = () => <InstrumentSample type="likert_slider" />
const NumericSliderSample  = () => <DemoStage config={NUMERIC_SLIDER_DEMO} />
const MultipleChoiceSample = () => <InstrumentSample type="multiple_choice" />
const OpenListSample       = () => <InstrumentSample type="open_list" />
const OpenTextSample       = () => <InstrumentSample type="open_text" />
const HierarchySample      = () => <InstrumentSample type="hierarchy" />

// One-line library row summary per composable type, from the stored config.
function instrumentMeta(r) {
  const c = r.config ?? {}
  switch (r.type) {
    case 'likert_slider':   return `${(c.labels ?? []).length} points`
    case 'multiple_choice': return `${(c.options ?? []).length} options`
    case 'open_list':       return `min ${c.minimum_required_responses ?? 1} response${(c.minimum_required_responses ?? 1) === 1 ? '' : 's'}${c.max_words != null ? ` · ${c.max_words}-word cap` : ''}`
    case 'open_text': {
      const shape = c.multiline === false ? 'single line' : `${c.rows ?? 4}-row box`
      const caps = [
        c.min_words != null ? `min ${c.min_words}` : null,
        c.max_words != null ? `max ${c.max_words}` : null,
      ].filter(Boolean).join(', ')
      return `${shape}${caps ? ` · ${caps} words` : ''}`
    }
    case 'hierarchy':       return `${(c.beliefs ?? []).length} levels`
    default:                return r.type
  }
}

// Shared library config for the four composable types. newLink points at the
// authoring page added 2026-08-31 — until then these types had no create path
// at all (their rows were seeded by migration), which is why only the numeric
// slider, VAS and package libraries carried a "+ New" button.
function composableLibrary(type, title, pageSlug, newLabel) {
  return {
    table: 'composable_instruments',
    type,
    title,
    newLink: `/admin/instruments/${pageSlug}/new`,
    newLabel,
    row: r => ({ name: r.label, meta: instrumentMeta(r) }),
    preview: r => <DemoStage config={instrumentConfig(r)} />,
    // Edit/delete, added 2026-09-03: the library was insert-only, so a
    // correction meant authoring a new instrument and abandoning the old one.
    // A single study build produced four generations of the same question
    // (`x`, `new_x`, `newnew_x`, `tt2_x`), all of them live in the session
    // builder's picker — clutter, but also a real chance of attaching the
    // wrong version of a question to a session.
    editLink: r => `/admin/instruments/${pageSlug}/edit/${r.id}`,
    deletable: true,
  }
}

// Usage counts for one composable type, so the library can refuse a delete
// that would break something rather than discovering it at the failure.
//
// Two independent reasons an instrument is undeletable:
//   responses — `instrument_responses.instrument_id` is NOT NULL with no ON
//     DELETE, so the delete fails at the database. It should also never
//     succeed: the responses are the study's data.
//   sessions  — the paired `activities` row is referenced by
//     `session_template_nodes.activity_id` (also NO ACTION), and removing the
//     instrument while a template still points at it strands that step: the
//     step wrapper resolves the slug at runtime and would error the
//     participant's session.
function useInstrumentUsage(type, rows) {
  const ids = rows.map(r => r.id)
  const slugs = rows.map(r => r.slug)

  return useQuery({
    queryKey: ['instrument-usage', type, ids.length, slugs.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [respRes, actRes] = await Promise.all([
        supabase.from('instrument_responses').select('instrument_id').in('instrument_id', ids),
        supabase.from('activities').select('id, subcategory').eq('category', type).in('subcategory', slugs),
      ])
      if (respRes.error) throw respRes.error
      if (actRes.error) throw actRes.error

      const responses = {}
      for (const row of respRes.data ?? []) {
        responses[row.instrument_id] = (responses[row.instrument_id] ?? 0) + 1
      }

      const activities = actRes.data ?? []
      const slugByActivity = new Map(activities.map(a => [a.id, a.subcategory]))
      const sessions = {}

      if (activities.length) {
        const { data: nodes, error } = await supabase
          .from('session_template_nodes')
          .select('activity_id')
          .in('activity_id', activities.map(a => a.id))
        if (error) throw error
        for (const node of nodes ?? []) {
          const slug = slugByActivity.get(node.activity_id)
          if (slug) sessions[slug] = (sessions[slug] ?? 0) + 1
        }
      }

      return { responses, sessions, activityIdBySlug: new Map(activities.map(a => [a.subcategory, a.id])) }
    },
  })
}

const CHIP = {
  green: { color: '#1E7A55', background: '#E2F4EA', border: '1px solid #BFE5D0' },
  pink:  { color: 'var(--pkd)', background: 'var(--bgp)', border: '1px solid var(--pkbs)' },
}

const PAGES = {
  'likert-slider': {
    title: 'Likert slider',
    source: 'composable/LikertSliderQuestion.jsx + NoDefaultSlider',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Live in sessions · 2026-08-25', tone: 'green' }],
    C: LikertSliderSample,
    blurb: 'The discrete slider: stepped scale with point labels and no numeric readout — the label is the value. Dana’s track/thumb chrome combined with the platform’s no-default behavior (no thumb until the first touch).',
    note: 'The sample is the first Likert slider in the library, rendered by the production component — the exact step a participant gets. Use + New below to author another; add instances to sessions from the session builder’s Instruments picker.',
    library: composableLibrary('likert_slider', 'Existing Likert sliders', 'likert-slider', '+ New Likert Slider'),
  },
  'numeric-slider': {
    title: 'Numeric slider',
    source: 'composable/SliderQuestion.jsx + NoDefaultSlider',
    chips: [{ label: 'Official format · adopted 2026-08-19', tone: 'green' }, { label: 'Live in sessions · 2026-08-25', tone: 'green' }],
    C: NumericSliderSample,
    blurb: 'The continuous slider: numeric range with sparse anchors and a VALUE readout that stays “—” until touched. This is the official format (Norm, 2026-08-24), and it is what sessions render: participant slider steps go through the same production SliderQuestion component as the sample and the library rows below. Existing rows show start/end anchors derived from their min/max labels; a middle anchor appears once a row defines `anchors`.',
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
      // items is the mixed-content list; legacy VAS-only packages have only scale_ids.
      row: r => {
        const n = (r.items ?? r.scale_ids ?? []).length
        return { name: r.name || r.slug, meta: `${n} item${n === 1 ? '' : 's'}` }
      },
      preview: r => <PackagePreview pkg={r} />,
    },
  },
  'multiple-choice': {
    title: 'Multiple choice',
    source: 'composable/MultipleChoiceQuestion.jsx',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Live in sessions · 2026-08-25', tone: 'green' }],
    C: MultipleChoiceSample,
    blurb: 'Single-select multiple choice, where an option can be plain or carry inline text/number entry with prefix/suffix and bounds. Fills a real gap: the platform has never had a generic MC instrument.',
    note: 'The sample is the first multiple-choice instrument in the library, rendered by the production component — the exact step a participant gets. Use + New below to author another; add instances to sessions from the session builder’s Instruments picker.',
    library: composableLibrary('multiple_choice', 'Existing multiple-choice questions', 'multiple-choice', '+ New Question'),
  },
  'open-list': {
    title: 'Open text list + contribution ratings',
    source: 'composable/OpenTextListQuestion.jsx',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Live in sessions · 2026-08-25', tone: 'green' }],
    C: OpenListSample,
    blurb: 'Participant-generated factors with a per-factor rating: typing text reveals a contribution slider beneath that row, filling the last row grows a new one, and entries are word-capped with a live counter.',
    note: 'The sample is the first open text list in the library, rendered by the production component — the exact step a participant gets. Use + New below to author another; add instances to sessions from the session builder’s Instruments picker.',
    library: composableLibrary('open_list', 'Existing open text lists', 'open-list', '+ New Open List'),
  },
  'open-text': {
    title: 'Open text response',
    source: 'composable/OpenTextQuestion.jsx',
    chips: [{ label: 'Added 2026-09-03', tone: 'green' }],
    C: OpenTextSample,
    blurb: 'A plain free-text answer: a single line for a short response, or a resizable box for a paragraph. Optional word floor and ceiling, with a live counter when a maximum is set. The open text LIST above it is a different instrument — that one collects several short factors and forces a contribution rating on each; this one is just the question and the participant’s words.',
    note: 'The sample is the first open text response in the library, rendered by the production component — the exact step a participant gets. Use + New below to author another; add instances to sessions from the session builder’s Instruments picker.',
    library: composableLibrary('open_text', 'Existing open text responses', 'open-text', '+ New Open Text'),
  },
  'hierarchy': {
    title: 'Hierarchical belief question',
    source: 'composable/HierarchicalBeliefQuestion.jsx',
    chips: [{ label: 'Adopted 2026-08-19', tone: 'green' }, { label: 'Live in sessions · 2026-08-25', tone: 'green' }],
    C: HierarchySample,
    blurb: 'A belief hierarchy shown whole, indented by level. Participants select every level that changed; each selected level reveals a signed direction slider. Generalizes to any nested-construct rating.',
    note: 'The sample is the first belief hierarchy in the library, rendered by the production component — the exact step a participant gets. Use + New below to author another; add instances to sessions from the session builder’s Instruments picker.',
    library: composableLibrary('hierarchy', 'Existing belief hierarchies', 'hierarchy', '+ New Hierarchy'),
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
  const qc = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    // cfg.type in the key: composable types share one table, split by filter.
    queryKey: ['instrument-lib', cfg.table ?? 'static', cfg.type ?? null],
    enabled: !!cfg.table,
    queryFn: async () => {
      let q = supabase.from(cfg.table).select('*')
      if (cfg.type) q = q.eq('type', cfg.type)
      const { data, error } = await q.order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
  const rows = cfg.static ?? data
  const ready = cfg.static || (!isLoading && !error)
  const { data: usage, error: usageError } = useInstrumentUsage(cfg.type, cfg.deletable ? rows : [])

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
            <div style={{ ...S.row, border: isOpen ? '1px solid var(--pkbs)' : '1px solid var(--bd)' }}>
              <button style={S.rowMain} onClick={() => setOpen(isOpen ? null : r.id)}>
                {inner}
              </button>
              {cfg.editLink && (
                <Link to={cfg.editLink(r)} style={S.editBtn}>Edit</Link>
              )}
              {cfg.deletable && (
                <DeleteInstrumentButton
                  row={r}
                  type={cfg.type}
                  usage={usage}
                  usageError={usageError}
                  onDeleted={() => {
                    setOpen(o => (o === r.id ? null : o))
                    qc.invalidateQueries({ queryKey: ['instrument-lib', cfg.table, cfg.type] })
                    qc.invalidateQueries({ queryKey: ['instrument-usage', cfg.type] })
                  }}
                />
              )}
              <button style={S.viewToggle} onClick={() => setOpen(isOpen ? null : r.id)}>
                {isOpen ? 'Hide ▲' : 'View ▼'}
              </button>
            </div>
            {isOpen && cfg.preview && (
              <div className="spec-stage" style={{ ...S.stage, margin: '0 0 12px' }}>{cfg.preview(r)}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── DeleteInstrumentButton ────────────────────────────────────────────────────
// Two-step inline confirm (the pattern VasLibraryPage established), gated on
// the usage counts above.
//
// It deliberately does NOT copy one thing from VasLibraryPage: that page fires
// the `activities` delete without checking its error, so when the activity is
// referenced by a session template the delete fails silently and the library
// row is removed anyway — leaving a picker entry pointing at a scale that no
// longer exists. Here the activities delete is checked and aborts the whole
// operation, and the instrument row is removed only after it succeeds.
function DeleteInstrumentButton({ row, type, usage, usageError, onDeleted }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)

  const responses = usage?.responses?.[row.id] ?? 0
  const sessions  = usage?.sessions?.[row.slug] ?? 0
  const loading   = !usage && !usageError

  // Without the usage counts there is no way to tell a safe delete from one
  // that strands a live session step, so the button stays withheld rather
  // than guessing.
  if (usageError) return (
    <span style={S.lockedMsg} title="Could not check where this instrument is used.">
      Usage unknown
    </span>
  )

  const del = useMutation({
    mutationFn: async () => {
      const { error: actErr } = await supabase
        .from('activities').delete().eq('category', type).eq('subcategory', row.slug)
      if (actErr) throw new Error(`its session-builder entry could not be removed (${actErr.message})`)

      const { error: insErr } = await supabase
        .from('composable_instruments').delete().eq('id', row.id)
      if (insErr) throw new Error(insErr.message)
    },
    onSuccess: () => { setConfirming(false); onDeleted() },
    onError: (e) => setError(e.message),
  })

  if (loading) return <span style={S.rowMeta}>…</span>

  if (responses > 0) return (
    <span style={S.lockedMsg} title="Deleting would destroy collected data.">
      {responses} response{responses === 1 ? '' : 's'}
    </span>
  )

  if (sessions > 0) return (
    <span style={S.lockedMsg} title="Remove it from those session templates first.">
      Used in {sessions} session{sessions === 1 ? '' : 's'}
    </span>
  )

  if (error) return (
    <span style={S.deleteErr} title={error}>Could not delete — {error}</span>
  )

  return confirming ? (
    <>
      <span style={S.rowMeta}>Delete?</span>
      <button style={S.deleteConfirmBtn} onClick={() => del.mutate()} disabled={del.isPending}>
        {del.isPending ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button style={S.smallBtn} onClick={() => setConfirming(false)}>Cancel</button>
    </>
  ) : (
    <button style={S.deleteBtn} onClick={() => setConfirming(true)}>Delete</button>
  )
}

// slider_scales row → production SliderQuestion config. A row's `anchors`
// jsonb (20260825_composable_instruments.sql) is the full anchor spec; rows
// without one fall back to start/end from min/max labels.
function sliderRowConfig(row) {
  const min = row.min ?? 0
  const max = row.max ?? 100
  return {
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
  }
}

// In-place viewer for an authored numeric slider — renders through the SAME
// production component as the sample above (Norm, 2026-08-25: the template is
// enforced), so prior sliders get the white card, anchors, and VALUE box.
function SliderPreview({ row }) {
  return <DemoStage config={sliderRowConfig(row)} />
}

// In-place viewer for an assessment (VAS package): every item of the bundle,
// in its stored order, rendered by the component a participant gets — VAS
// items through VasRenderer in preview mode, sliders through the production
// SliderQuestion. Legacy packages with only scale_ids are VAS-only.
function PackagePreview({ pkg }) {
  const itemList = pkg.items ?? (pkg.scale_ids ?? []).map(id => ({ type: 'vas', id }))
  const vasIds    = itemList.filter(x => x.type !== 'slider').map(x => x.id)
  const sliderIds = itemList.filter(x => x.type === 'slider').map(x => x.id)

  const { data, isLoading, error } = useQuery({
    queryKey: ['pkg-preview', pkg.id],
    queryFn: async () => {
      const [vas, sliders] = await Promise.all([
        vasIds.length
          ? supabase.from('vas_scales').select('*').in('id', vasIds).then(r => { if (r.error) throw r.error; return r.data ?? [] })
          : [],
        sliderIds.length
          ? supabase.from('slider_scales').select('*').in('id', sliderIds).then(r => { if (r.error) throw r.error; return r.data ?? [] })
          : [],
      ])
      return { vas, sliders }
    },
  })

  if (isLoading) return <p style={{ ...S.muted, padding: 16 }}>Loading package items…</p>
  if (error)     return <p style={{ ...S.muted, padding: 16 }}>Could not load the package items.</p>
  if (!itemList.length) return <p style={{ ...S.muted, padding: 16 }}>This package has no items configured.</p>

  return (
    <div style={{ padding: '4px 0 12px' }}>
      {itemList.map((it, i) => {
        const isSlider = it.type === 'slider'
        const row = (isSlider ? data.sliders : data.vas).find(s => s.id === it.id)
        if (!row) return (
          <p key={`${it.id}-${i}`} style={{ ...S.muted, padding: '0 16px' }}>
            Item {i + 1}: its {isSlider ? 'slider' : 'VAS'} row no longer exists.
          </p>
        )
        return (
          <div key={`${it.id}-${i}`}>
            <p style={S.pkgItemLabel}>{i + 1} of {itemList.length} · {isSlider ? 'Numeric slider' : 'VAS'}</p>
            {isSlider
              ? <DemoStage config={sliderRowConfig(row)} />
              /* the bare spec-stage class collapses VasRenderer's full-viewport
                 min-height (the .spec-stage > div rule in index.css) */
              : <div className="spec-stage"><VasRenderer scale={row} userId={null} previewMode onComplete={() => {}} /></div>}
          </div>
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
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
    padding: '3px 10px', borderRadius: 12,
  },
  sourceChip: {
    fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', background: 'var(--bgp)',
    padding: '3px 10px', borderRadius: 12,
  },
  blurb:      { fontFamily: SANS, fontSize: 14, color: 'var(--tx)', lineHeight: 1.6, margin: '0 0 10px', maxWidth: 680 },
  statusNote: { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 680 },
  link:       { color: 'var(--pk)', fontFamily: SANS, fontSize: 14 },
  stage: {
    background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 12,
    overflow: 'hidden', position: 'relative', maxWidth: 860,
  },

  divider: { height: 1, background: 'var(--bds)', margin: '28px 0 20px', maxWidth: 860 },
  libHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    gap: 12, flexWrap: 'wrap', marginBottom: 12, maxWidth: 860,
  },
  libTitle: { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  newBtn: {
    fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: '6px 12px',
    background: 'var(--pk)', color: '#fff', borderRadius: 20, textDecoration: 'none',
  },
  row: {
    display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap',
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10,
    padding: '10px 14px', marginBottom: 8, maxWidth: 860,
  },
  rowName: { fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--tx)', flex: '1 1 260px', minWidth: 0 },
  pkgItemLabel: {
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--gy)', margin: '14px 20px 0', paddingTop: 10, borderTop: '1px solid var(--bd)',
  },
  rowMeta: { fontFamily: SANS, fontSize: 12.5, color: 'var(--tx2)' },
  rowSlug: { fontFamily: MONO, fontSize: 12, color: 'var(--gy)' },
  muted:   { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', margin: '4px 0 0' },

  // Row actions (edit / delete / preview toggle)
  rowMain: {
    display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap',
    flex: '1 1 260px', minWidth: 0, background: 'none', border: 'none',
    padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit',
  },
  viewToggle: {
    fontFamily: SANS, fontSize: 12.5, color: 'var(--tx2)', background: 'none',
    border: 'none', cursor: 'pointer', padding: '2px 4px', whiteSpace: 'nowrap',
  },
  editBtn: {
    fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--pkd)',
    background: 'none', border: '1px solid var(--pkbs)', borderRadius: 20,
    padding: '3px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
  },
  deleteBtn: {
    fontFamily: SANS, fontSize: 12.5, color: 'var(--tx2)', background: 'none',
    border: '1px solid var(--bd)', borderRadius: 20, padding: '3px 12px',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  deleteConfirmBtn: {
    fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: '#fff',
    background: '#c2334d', border: 'none', borderRadius: 20, padding: '4px 12px',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  smallBtn: {
    fontFamily: SANS, fontSize: 12.5, color: 'var(--tx2)', background: 'none',
    border: '1px solid var(--bd)', borderRadius: 20, padding: '3px 10px',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  lockedMsg: { fontFamily: SANS, fontSize: 12.5, color: 'var(--tx3)', whiteSpace: 'nowrap' },
  deleteErr: { fontFamily: SANS, fontSize: 12.5, color: 'var(--err-tx)', maxWidth: 260 },
}
