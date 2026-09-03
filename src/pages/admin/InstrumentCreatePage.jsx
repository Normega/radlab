import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SurveyComponentRenderer from '../../components/questionnaire/composable/SurveyComponentRenderer'
import { createDefaultComponent, DB_COMPONENT_TYPE } from '../../components/questionnaire/composable/componentRegistry'
import { validateComposableDefinition } from '../../components/questionnaire/composable/composableQuestionnaireUtils'
import '../../components/questionnaire/composable/composableSurvey.css'

// ── InstrumentCreatePage (/admin/instruments/:slug/new) ───────────────────────
// Authoring UI for the four composable instrument types. Until 2026-08-31 these
// had no create path at all: the library table shipped with its rows seeded by
// 20260825_composable_instrument_seeds.sql, and the only way to add one was a
// migration. Numeric sliders, VAS and packages each had their own create page,
// which is why only those carried a "+ New" button (Dana, 2026-08-30).
//
// Two rows are written per instrument, and BOTH are required:
//   composable_instruments — the definition the participant step loads
//   activities             — the picker row, or the instrument is invisible to
//                            the session builder (it lists activities, not
//                            instruments). category = the DB type,
//                            subcategory = the slug: that pairing is the
//                            contract ComposableInstrumentStepWrapper resolves.
//
// The seed config comes from createDefaultComponent() — the same defaults the
// component package ships — so a new instrument starts valid and renders
// immediately. The preview is the production component via
// SurveyComponentRenderer, so what you author is what a participant gets.

const TYPES = {
  'likert-slider': {
    dbType: 'likert_slider',
    title: 'Likert slider',
    lead: 'A stepped scale with a label at every point and no numeric readout — the label is the value.',
    example: 'noticing_frequency_weekly',
  },
  'multiple-choice': {
    dbType: 'multiple_choice',
    title: 'Multiple choice',
    lead: 'Single-select options, or select-all-that-apply. Any option can carry inline text or number entry.',
    example: 'target_grade',
  },
  'open-list': {
    dbType: 'open_list',
    title: 'Open text list',
    lead: 'Participant-generated entries, each with its own contribution slider.',
    example: 'outcome_factors',
  },
  'open-text': {
    dbType: 'open_text',
    title: 'Open text response',
    lead: 'A single free-text answer — one line for a short response, or a box for a paragraph.',
    example: 'exam_reflection',
  },
  'hierarchy': {
    dbType: 'hierarchy',
    title: 'Belief hierarchy',
    lead: 'Nested belief levels; each level the participant selects reveals a signed direction slider.',
    example: 'feedback_beliefs',
  },
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

// A single instrument validated as if it were a one-page questionnaire — this
// reuses every per-type rule (MC needs two labelled options, hierarchy needs
// beliefs, sliders need min < max with in-range labels) instead of restating them.
function validateInstrument({ slug, label, componentType, config }) {
  const errors = validateComposableDefinition({
    questionnaire_type: 'composable',
    slug: slug || 'unset',
    name: label || 'unset',
    pages: [{ id: 'page_1', components: [{ ...config, id: slug || 'unset', type: componentType }] }],
  })
  // Page/questionnaire-level messages can't arise from a single component, but
  // strip the "Page 1, component 1: " prefix so the reader sees the real issue.
  return errors.map(e => e.replace(/^Page 1, component 1: /, '').replace(/^Page 1, /, ''))
}

export default function InstrumentCreatePage() {
  const { slug: typeSlug, id: editId } = useParams()
  const navigate = useNavigate()
  const meta = TYPES[typeSlug]
  const componentType = meta ? DB_COMPONENT_TYPE[meta.dbType] : null
  const isEdit = Boolean(editId)

  const [label,       setLabel]       = useState('')
  const [slug,        setSlug]        = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [config,      setConfig]      = useState(() =>
    meta ? stripIdentity(createDefaultComponent(DB_COMPONENT_TYPE[meta.dbType], 'new_instrument')) : {})
  const [previewVal,  setPreviewVal]  = useState(undefined)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [loading,     setLoading]     = useState(isEdit)
  // Responses freeze the config: the answers already collected were given to
  // the question as it was worded then, so silently re-wording it (or moving a
  // scale point) would change what that data means. The label stays editable —
  // it is only how the instrument reads in the library and the picker.
  const [responseCount, setResponseCount] = useState(0)

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    ;(async () => {
      const [{ data, error: loadErr }, respRes] = await Promise.all([
        supabase.from('composable_instruments').select('*').eq('id', editId).single(),
        supabase.from('instrument_responses').select('id').eq('instrument_id', editId),
      ])
      if (cancelled) return
      if (loadErr) { setError(loadErr.message); setLoading(false); return }
      setLabel(data.label ?? '')
      setSlug(data.slug ?? '')
      setSlugTouched(true)
      setConfig(data.config ?? {})
      setResponseCount((respRes.data ?? []).length)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [isEdit, editId])

  if (!meta) return (
    <div>
      <h1 style={S.h1}>Unknown instrument type</h1>
      <p style={S.sub}>
        No creatable instrument type named “{typeSlug}”.{' '}
        <Link to="/admin/instruments" style={S.link}>Back to Instrument Styles</Link>.
      </p>
    </div>
  )

  const set = (patch) => setConfig(c => ({ ...c, ...patch }))
  const problems = validateInstrument({ slug, label, componentType, config })
  const configLocked = isEdit && responseCount > 0
  const canSave = label.trim() && slug.trim() && problems.length === 0 && !saving && !loading

  function handleLabelChange(v) {
    setLabel(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const cleanSlug = slug.trim()

      if (isEdit) {
        // The slug is never updated — it is the key a session step resolves,
        // so changing it would strand every template already pointing at it.
        const patch = configLocked
          ? { label: label.trim() }
          : { label: label.trim(), config }
        const { error: updErr } = await supabase
          .from('composable_instruments').update(patch).eq('id', editId)
        if (updErr) throw new Error(updErr.message)

        // Keep the picker's description in step with the edited definition.
        const { error: actErr } = await supabase.from('activities')
          .update({
            label:       `${meta.title} – ${label.trim().slice(0, 60)}`,
            description: summarize(meta.dbType, config),
          })
          .eq('category', meta.dbType).eq('subcategory', cleanSlug)
        if (actErr) {
          throw new Error(
            `The instrument saved, but its session-builder entry did not update: ${actErr.message}`
          )
        }

        navigate(`/admin/instruments/${typeSlug}`)
        return
      }

      const { error: insErr } = await supabase.from('composable_instruments').insert({
        slug: cleanSlug,
        type: meta.dbType,
        label: label.trim(),
        config,
        created_by: user?.id ?? null,
      })
      if (insErr) {
        // 23505 = unique_violation on composable_instruments.slug
        if (insErr.code === '23505') throw new Error(`The slug “${cleanSlug}” is already taken. Choose another.`)
        throw new Error(insErr.message)
      }

      // The picker row. Without it the instrument exists but no session can
      // reach it, so a failure here is surfaced rather than warned about.
      const { error: actErr } = await supabase.from('activities').insert({
        category:    meta.dbType,
        subcategory: cleanSlug,
        label:       `${meta.title} – ${label.trim().slice(0, 60)}`,
        description: summarize(meta.dbType, config),
      })
      if (actErr) {
        throw new Error(
          `The instrument saved, but its session-builder entry did not: ${actErr.message}. ` +
          `It will not appear in the session builder until an activities row with ` +
          `category "${meta.dbType}" and subcategory "${cleanSlug}" exists.`
        )
      }

      navigate(`/admin/instruments/${typeSlug}`)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  if (loading) return <p style={S.sub}>Loading instrument…</p>

  return (
    <div>
      <h1 style={S.h1}>{isEdit ? `Edit ${meta.title.toLowerCase()}` : `New ${meta.title.toLowerCase()}`}</h1>
      <p style={S.sub}>{meta.lead}</p>
      <p style={S.sub}>
        {isEdit ? (
          <>Changes apply everywhere this instrument is used — every session template
            pointing at <code>{slug}</code> renders the edited version from now on.</>
        ) : (
          <>Saving adds it to the library on{' '}
            <Link to={`/admin/instruments/${typeSlug}`} style={S.link}>{meta.title}</Link>{' '}
            and to the session builder’s Instruments picker.</>
        )}
      </p>

      {configLocked && (
        <div style={S.problems}>
          <p style={S.problemsTitle}>
            {responseCount} response{responseCount === 1 ? '' : 's'} already collected — question locked
          </p>
          <p style={S.problem}>
            Those answers were given to this question as it is worded now, so re-wording it (or
            moving a scale point) would change what the collected data means. The name is still
            editable. To ask a different question, create a new instrument.
          </p>
        </div>
      )}

      <div style={S.columns}>
        <div style={S.form}>
          <Field label="Name *" hint="How it reads in the library and the session-builder picker.">
            <input style={S.input} value={label} onChange={e => handleLabelChange(e.target.value)}
              placeholder="Noticing frequency (weekly)" />
          </Field>

          <Field label="Slug *" hint={isEdit
            ? 'The identifier session steps resolve. Fixed once created.'
            : 'The identifier a session step resolves. Cannot be changed later.'}>
            <input style={{ ...S.input, ...(isEdit ? S.inputLocked : null) }} value={slug}
              readOnly={isEdit}
              onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
              placeholder={meta.example} />
          </Field>

          <fieldset style={S.fieldset} disabled={configLocked}>
            <Field label="Question *">
              <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' }}
                value={config.question ?? ''} onChange={e => set({ question: e.target.value })} />
            </Field>

            {meta.dbType === 'likert_slider' && <LikertEditor config={config} set={set} />}
            {meta.dbType === 'multiple_choice' && <ChoiceEditor config={config} set={set} />}
            {meta.dbType === 'open_list' && <OpenListEditor config={config} set={set} />}
            {meta.dbType === 'open_text' && <OpenTextEditor config={config} set={set} />}
            {meta.dbType === 'hierarchy' && <HierarchyEditor config={config} set={set} />}
          </fieldset>

          {problems.length > 0 && (
            <div style={S.problems}>
              <p style={S.problemsTitle}>Fix before saving</p>
              {problems.map(p => <p key={p} style={S.problem}>{p}</p>)}
            </div>
          )}
          {error && <p style={S.errMsg}>{error}</p>}

          <div style={S.actions}>
            <button style={{ ...S.saveBtn, opacity: canSave ? 1 : 0.45 }} onClick={handleSave} disabled={!canSave}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : `Save ${meta.title.toLowerCase()}`}
            </button>
            <button style={S.cancelBtn} onClick={() => navigate(`/admin/instruments/${typeSlug}`)}>Cancel</button>
          </div>
        </div>

        <div style={S.previewCol}>
          <p style={S.previewLabel}>Live preview</p>
          <p style={S.previewNote}>The production component — exactly what a participant sees. Nothing saves.</p>
          <div className="spec-stage" style={S.stage}>
            <div style={{ padding: '16px 16px 24px' }} className="cs-page">
              <SurveyComponentRenderer
                config={{ ...config, id: slug || 'preview', type: componentType }}
                value={previewVal}
                onChange={setPreviewVal}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// The stored config carries neither id nor type — AdoptedInstrumentPage and the
// step wrapper inject both from the row (id = slug, type = DB_COMPONENT_TYPE).
// Storing them would let a renamed row disagree with its own config.
function stripIdentity(component) {
  const { id, type, ...config } = component
  return config
}

// One-line description for the activities row, so the picker says something
// useful about the instrument rather than repeating its name.
function summarize(dbType, c) {
  switch (dbType) {
    case 'likert_slider': {
      const pts = c.labels ?? []
      const ends = pts.length ? `${pts[0]?.label ?? ''} → ${pts[pts.length - 1]?.label ?? ''}` : ''
      return `${pts.length}-point scale${ends.trim() === '→' ? '' : ` (${ends})`}`
    }
    case 'multiple_choice': {
      const opts = c.options ?? []
      const entry = opts.filter(o => o.response_type === 'text' || o.response_type === 'number').length
      const multi = c.allow_multiple === true ? ', select all that apply' : ''
      return `${opts.length} options${multi}${entry ? `, ${entry} with entry` : ''}`
    }
    case 'open_list':
      return `Free-listed factors, each with a contribution slider · min ${c.minimum_required_responses ?? 1}`
    case 'open_text': {
      const shape = c.multiline === false ? 'Single-line answer' : 'Paragraph answer'
      const caps = [
        c.min_words != null ? `min ${c.min_words}` : null,
        c.max_words != null ? `max ${c.max_words}` : null,
      ].filter(Boolean).join(', ')
      return `${shape}${caps ? ` · ${caps} words` : ''}`
    }
    case 'hierarchy':
      return `${(c.beliefs ?? []).length}-level hierarchy with signed direction sliders`
    default:
      return ''
  }
}

// ── Shared field furniture ────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={S.label}>{label}</label>
      {children}
      {hint && <p style={S.hint}>{hint}</p>}
    </div>
  )
}

function NumField({ label, value, onChange, ...rest }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={S.label}>{label}</label>
      <input style={S.input} type="number" value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} {...rest} />
    </div>
  )
}

function RowList({ title, hint, items, onAdd, addLabel }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={S.label}>{title}</label>
      {hint && <p style={{ ...S.hint, margin: '0 0 8px' }}>{hint}</p>}
      {items}
      <button style={S.addBtn} onClick={onAdd}>{addLabel}</button>
    </div>
  )
}

function RemoveBtn({ onClick, disabled }) {
  return (
    <button style={{ ...S.removeBtn, opacity: disabled ? 0.35 : 1 }} onClick={onClick} disabled={disabled}
      title={disabled ? 'At least two are required' : 'Remove'}>×</button>
  )
}

// Anchors for a nested slider (contribution / direction). Values are positions
// on that slider's own range, which is why min/max are edited beside them.
function SliderEditor({ title, slider, onChange }) {
  const patch = (p) => onChange({ ...slider, ...p })
  const labels = slider.labels ?? []
  return (
    <div style={S.nested}>
      <p style={S.nestedTitle}>{title}</p>
      <Field label="Slider question">
        <input style={S.input} value={slider.question ?? ''} onChange={e => patch({ question: e.target.value })} />
      </Field>
      <div style={S.row2}>
        <NumField label="Min" value={slider.min} onChange={v => patch({ min: v })} />
        <NumField label="Max" value={slider.max} onChange={v => patch({ max: v })} />
        <NumField label="Step" value={slider.step} onChange={v => patch({ step: v })} />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={S.label}>Anchors</label>
        {labels.map((a, i) => (
          <div key={i} style={S.itemRow}>
            <input style={{ ...S.input, width: 88 }} type="number" value={a.value ?? ''}
              onChange={e => patch({ labels: labels.map((x, j) => j === i ? { ...x, value: Number(e.target.value) } : x) })} />
            <input style={S.input} value={a.label ?? ''} placeholder="Anchor text"
              onChange={e => patch({ labels: labels.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
            <RemoveBtn disabled={labels.length <= 2}
              onClick={() => patch({ labels: labels.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <button style={S.addBtn}
          onClick={() => patch({ labels: [...labels, { value: slider.max ?? 100, label: '' }] })}>
          + Add anchor
        </button>
      </div>
    </div>
  )
}

// ── Per-type editors ──────────────────────────────────────────────────────────

// Points ARE the scale here, so min/max derive from the first and last point
// rather than being edited separately — that keeps every label in range by
// construction (validateSlider rejects out-of-range labels).
function LikertEditor({ config, set }) {
  const points = config.labels ?? []
  const commit = (labels) => set({
    labels,
    min: labels.length ? Number(labels[0].value) : 1,
    max: labels.length ? Number(labels[labels.length - 1].value) : 6,
    step: 1,
  })
  return (
    <RowList
      title="Scale points *"
      hint="Every point carries a label — the label is the value the participant sees. Range follows the first and last point."
      addLabel="+ Add point"
      onAdd={() => commit([...points, { value: (Number(points[points.length - 1]?.value) || 0) + 1, label: '' }])}
      items={points.map((p, i) => (
        <div key={i} style={S.itemRow}>
          <input style={{ ...S.input, width: 88 }} type="number" value={p.value ?? ''}
            onChange={e => commit(points.map((x, j) => j === i ? { ...x, value: Number(e.target.value) } : x))} />
          <input style={S.input} value={p.label ?? ''} placeholder="Point label"
            onChange={e => commit(points.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <RemoveBtn disabled={points.length <= 2} onClick={() => commit(points.filter((_, j) => j !== i))} />
        </div>
      ))}
    />
  )
}

function ChoiceEditor({ config, set }) {
  const options = config.options ?? []
  const commit = (o) => set({ options: o })
  const patchAt = (i, p) => commit(options.map((x, j) => j === i ? { ...x, ...p } : x))
  return (
    <>
    <label style={S.checkRow}>
      <input type="checkbox" checked={config.allow_multiple === true}
        onChange={e => set({ allow_multiple: e.target.checked })} />
      <span style={S.checkText}>Allow selecting multiple options — checkboxes instead of radios, participants pick every option that applies</span>
    </label>
    <RowList
      title="Options *"
      hint="At least two. An option set to text or number entry reveals an input beside its label."
      addLabel="+ Add option"
      onAdd={() => commit([...options, {
        id: `option_${Date.now().toString(36)}`, label: '', response_type: 'plain',
      }])}
      items={options.map((o, i) => (
        <div key={o.id ?? i} style={S.itemBlock}>
          <div style={S.itemRow}>
            <input style={S.input} value={o.label ?? ''} placeholder="Option label"
              onChange={e => patchAt(i, { label: e.target.value })} />
            <select style={{ ...S.input, width: 132 }} value={o.response_type ?? 'plain'}
              onChange={e => patchAt(i, { response_type: e.target.value })}>
              <option value="plain">Plain</option>
              <option value="text">Text entry</option>
              <option value="number">Number entry</option>
            </select>
            <RemoveBtn disabled={options.length <= 2} onClick={() => commit(options.filter((_, j) => j !== i))} />
          </div>
          {(o.response_type === 'text' || o.response_type === 'number') && (
            <div style={{ ...S.row2, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Prefix</label>
                <input style={S.input} value={o.prefix ?? ''} placeholder="e.g. $"
                  onChange={e => patchAt(i, { prefix: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Suffix</label>
                <input style={S.input} value={o.suffix ?? ''} placeholder="e.g. %"
                  onChange={e => patchAt(i, { suffix: e.target.value })} />
              </div>
              {o.response_type === 'number' && <>
                <NumField label="Min" value={o.min} onChange={v => patchAt(i, { min: v })} />
                <NumField label="Max" value={o.max} onChange={v => patchAt(i, { max: v })} />
              </>}
            </div>
          )}
        </div>
      ))}
    />
    </>
  )
}

function OpenListEditor({ config, set }) {
  return (
    <>
      <div style={S.row2}>
        <NumField label="Initial boxes" value={config.initial_boxes} min={1}
          onChange={v => set({ initial_boxes: v })} />
        <NumField label="Word cap" value={config.max_words} min={1}
          onChange={v => set({ max_words: v })} />
        <NumField label="Min responses" value={config.minimum_required_responses} min={0}
          onChange={v => set({ minimum_required_responses: v })} />
      </div>
      <p style={{ ...S.hint, marginBottom: 16 }}>
        Filling the last box grows a new one, so initial boxes is a starting point, not a limit.
        Leave the word cap empty for no limit.
      </p>
      <Field label="Example placeholder" hint="Shown in the first empty box.">
        <input style={S.input} value={config.example_placeholder ?? ''}
          onChange={e => set({ example_placeholder: e.target.value })} />
      </Field>
      <SliderEditor title="Contribution slider — appears under each filled row"
        slider={config.slider ?? {}} onChange={s => set({ slider: s })} />
    </>
  )
}

function OpenTextEditor({ config, set }) {
  const multiline = config.multiline !== false
  return (
    <>
      <label style={S.checkRow}>
        <input type="checkbox" checked={multiline}
          onChange={e => set({ multiline: e.target.checked })} />
        <span style={S.checkText}>Paragraph box — several lines, resizable. Uncheck for a single-line answer.</span>
      </label>

      <div style={S.row2}>
        {multiline && (
          <NumField label="Box height (rows)" value={config.rows} min={1}
            onChange={v => set({ rows: v })} />
        )}
        <NumField label="Min words" value={config.min_words} min={1}
          onChange={v => set({ min_words: v })} />
        <NumField label="Max words" value={config.max_words} min={1}
          onChange={v => set({ max_words: v })} />
      </div>
      <p style={{ ...S.hint, marginBottom: 16 }}>
        Leave both word limits empty for no limit. A maximum stops typing at the cap and shows a
        live counter; a minimum holds Submit until it is met.
      </p>

      <Field label="Placeholder" hint="Grey example text inside the empty box.">
        <input style={S.input} value={config.placeholder ?? ''}
          onChange={e => set({ placeholder: e.target.value })} />
      </Field>
    </>
  )
}

function HierarchyEditor({ config, set }) {
  const beliefs = config.beliefs ?? []
  const commit = (b) => set({ beliefs: b })
  const patchAt = (i, p) => commit(beliefs.map((x, j) => j === i ? { ...x, ...p } : x))
  return (
    <>
      <Field label="Instruction" hint="Sits under the question, above the levels.">
        <input style={S.input} value={config.instruction ?? ''}
          onChange={e => set({ instruction: e.target.value })} />
      </Field>
      <label style={S.checkRow}>
        <input type="checkbox" checked={config.allow_none_selected !== false}
          onChange={e => set({ allow_none_selected: e.target.checked })} />
        <span style={S.checkText}>Allow “none changed” — participants may continue without selecting a level</span>
      </label>
      <RowList
        title="Belief levels *"
        hint="Depth controls indentation: 0 is the most specific, each step out is one level broader."
        addLabel="+ Add level"
        onAdd={() => commit([...beliefs, {
          id: `level_${Date.now().toString(36)}`,
          level: `Level ${beliefs.length + 1}`, depth: beliefs.length, text: '',
        }])}
        items={beliefs.map((b, i) => (
          <div key={b.id ?? i} style={S.itemBlock}>
            <div style={S.itemRow}>
              <input style={{ ...S.input, width: 112 }} value={b.level ?? ''} placeholder="Level name"
                onChange={e => patchAt(i, { level: e.target.value })} />
              <input style={{ ...S.input, width: 88 }} type="number" min={0} value={b.depth ?? 0}
                onChange={e => patchAt(i, { depth: Number(e.target.value) })} />
              <RemoveBtn disabled={beliefs.length <= 1} onClick={() => commit(beliefs.filter((_, j) => j !== i))} />
            </div>
            <input style={{ ...S.input, marginTop: 8 }} value={b.text ?? ''} placeholder="Belief statement"
              onChange={e => patchAt(i, { text: e.target.value })} />
          </div>
        ))}
      />
      <SliderEditor title="Direction slider — appears under each selected level"
        slider={config.slider ?? {}} onChange={s => set({ slider: s })} />
    </>
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  h1:  { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 8px' },
  sub: { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 8px', maxWidth: 680 },
  link: { color: 'var(--pk)' },

  columns: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 24 },
  form: {
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
    padding: 24, flex: '1 1 480px', minWidth: 320, boxSizing: 'border-box',
  },
  previewCol: { flex: '1 1 380px', minWidth: 320, position: 'sticky', top: 16 },
  previewLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 4px' },
  previewNote:  { fontFamily: SANS, fontSize: 12, color: 'var(--tx2)', margin: '0 0 8px' },
  stage: { background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden', position: 'relative' },

  label: { display: 'block', fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
  input: {
    width: '100%', fontSize: 14, fontFamily: SANS, border: '1px solid var(--bd)',
    borderRadius: 12, padding: '8px 16px', color: 'var(--tx)', background: 'var(--bgc)', boxSizing: 'border-box',
  },
  hint: { fontFamily: SANS, fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, margin: '4px 0 0' },
  inputLocked: { background: 'var(--bg)', color: 'var(--tx2)', cursor: 'not-allowed' },
  fieldset: { border: 'none', padding: 0, margin: 0, minWidth: 0 },
  row2: { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' },

  itemRow:   { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  itemBlock: { border: '1px solid var(--bd)', borderRadius: 12, padding: 8, marginBottom: 8 },
  nested:    { border: '1px solid var(--bd)', borderRadius: 12, padding: 16, marginBottom: 16, background: 'var(--bg)' },
  nestedTitle: { fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--tx)', margin: '0 0 16px' },

  checkRow:  { display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16, cursor: 'pointer' },
  checkText: { fontFamily: SANS, fontSize: 14, color: 'var(--tx)', lineHeight: 1.5 },

  addBtn: {
    background: 'none', border: '1px solid var(--pkbs)', color: 'var(--pkd)', borderRadius: 24,
    padding: '4px 16px', fontSize: 12, fontFamily: SANS, fontWeight: 600, cursor: 'pointer',
  },
  removeBtn: {
    background: 'none', border: '1px solid var(--bd)', color: 'var(--tx2)', borderRadius: 24,
    width: 32, height: 32, fontSize: 16, cursor: 'pointer', flexShrink: 0, lineHeight: 1,
  },

  problems:      { background: 'var(--bgp)', border: '1px solid var(--pkbs)', borderRadius: 12, padding: 16, margin: '16px 0 0' },
  problemsTitle: { fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--pkd)', margin: '0 0 4px' },
  problem:       { fontFamily: SANS, fontSize: 12, color: 'var(--pkd)', lineHeight: 1.5, margin: 0 },
  errMsg: {
    fontFamily: SANS, fontSize: 14, color: 'var(--err-tx)', background: 'var(--err-bg)',
    border: '1px solid var(--err-bd)', borderRadius: 12, padding: '8px 16px', margin: '16px 0 0', lineHeight: 1.5,
  },

  actions: { display: 'flex', gap: 8, marginTop: 24 },
  saveBtn: {
    background: 'var(--pk)', color: 'var(--bgc)', border: 'none', borderRadius: 24,
    padding: '8px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS,
  },
  cancelBtn: {
    background: 'none', border: '1px solid var(--bd)', borderRadius: 24, padding: '8px 16px',
    fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: SANS,
  },
}
