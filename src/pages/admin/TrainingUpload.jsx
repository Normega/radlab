import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_CONDITIONS = ['non_reactivity', 'reappraisal', 'self_compassion']
const VALID_PHASES     = ['phase1', 'phase2']
const VALID_STEP_TYPES = [
  'video', 'audio', 'text', 'prompt_response', 'closing', 'slider',
  'multi_response', 'timer', 'training_response', 'training_response_multi',
  'word_select', 'thought_rating', 'thought_choice', 'trigger_map',
  'body_diagram', 'quality_explorer',
]
const VALID_OWL_KEYS   = [
  'owl_waving','owl_excited','owl_nonreactivity','owl_reappraisal',
  'owl_selfcompassion','owl_love','owl_happy','owl_crying','owl_still','owl_thinking',
  'owl_veryhappy','Owl_graduation',
]

function validateModule(def) {
  const errors = []
  if (!def || typeof def !== 'object') { errors.push('Not a valid JSON object'); return errors }

  if (!def.module_id || typeof def.module_id !== 'string') errors.push('module_id is required (string)')
  if (!VALID_CONDITIONS.includes(def.condition))           errors.push(`condition must be one of: ${VALID_CONDITIONS.join(', ')}`)
  if (!VALID_PHASES.includes(def.phase))                   errors.push(`phase must be one of: ${VALID_PHASES.join(', ')}`)
  if (typeof def.lesson !== 'number' || def.lesson < 1)    errors.push('lesson must be a positive number')
  if (!def.title || typeof def.title !== 'string')         errors.push('title is required (string)')

  if (!def.lead_in || typeof def.lead_in !== 'object') {
    errors.push('lead_in is required')
  } else {
    if (!VALID_OWL_KEYS.includes(def.lead_in.owl)) errors.push(`lead_in.owl must be one of the valid owl keys`)
    if (!def.lead_in.text) errors.push('lead_in.text is required')
  }

  if (!def.lead_out || typeof def.lead_out !== 'object') {
    errors.push('lead_out is required')
  } else {
    if (!VALID_OWL_KEYS.includes(def.lead_out.owl)) errors.push(`lead_out.owl must be one of the valid owl keys`)
    if (!def.lead_out.text) errors.push('lead_out.text is required')
  }

  if (!Array.isArray(def.steps)) {
    errors.push('steps must be an array')
  } else {
    def.steps.forEach((step, i) => {
      if (!VALID_STEP_TYPES.includes(step.type))
        errors.push(`steps[${i}].type must be one of: ${VALID_STEP_TYPES.join(', ')}`)
      if (step.type === 'video' && !step.video_id)
        errors.push(`steps[${i}] (video) missing video_id`)
      if (step.type === 'audio' && !step.audio_id)
        errors.push(`steps[${i}] (audio) missing audio_id`)
      if ((step.type === 'text' || step.type === 'closing') && !Array.isArray(step.content))
        errors.push(`steps[${i}] (${step.type}) missing content array`)
      if (step.type === 'closing' && step.owl) {
        const owlKey = step.owl.replace(/\.png$/i, '')
        if (!VALID_OWL_KEYS.includes(step.owl) && !VALID_OWL_KEYS.includes(owlKey))
          errors.push(`steps[${i}] (closing) owl must be a valid owl key`)
      }
      if (step.type === 'prompt_response' && !step.prompt)
        errors.push(`steps[${i}] (prompt_response) missing prompt`)
      if (step.type === 'slider') {
        if (!step.prompt)     errors.push(`steps[${i}] (slider) missing prompt`)
        if (step.min == null) errors.push(`steps[${i}] (slider) missing min`)
        if (step.max == null) errors.push(`steps[${i}] (slider) missing max`)
        if (!step.min_label)  errors.push(`steps[${i}] (slider) missing min_label`)
        if (!step.max_label)  errors.push(`steps[${i}] (slider) missing max_label`)
      }
      if (step.type === 'multi_response') {
        if (!step.prompt)        errors.push(`steps[${i}] (multi_response) missing prompt`)
        if (step.count == null)  errors.push(`steps[${i}] (multi_response) missing count`)
      }
      if (step.type === 'timer') {
        if (step.duration_seconds == null) errors.push(`steps[${i}] (timer) missing duration_seconds`)
      }
      if (step.type === 'training_response' || step.type === 'training_response_multi') {
        if (!Array.isArray(step.options) || step.options.length === 0)
          errors.push(`steps[${i}] (${step.type}) missing options array`)
      }
      if (step.type === 'word_select') {
        if (!Array.isArray(step.words) || step.words.length === 0)
          errors.push(`steps[${i}] (word_select) missing words array`)
      }
      if (step.type === 'trigger_map') {
        if (!Array.isArray(step.categories) || step.categories.length === 0)
          errors.push(`steps[${i}] (trigger_map) missing categories array`)
      }
      if (step.type === 'body_diagram') {
        if (!Array.isArray(step.hotspots) || step.hotspots.length === 0)
          errors.push(`steps[${i}] (body_diagram) missing hotspots array`)
      }
      if (step.type === 'quality_explorer') {
        if (!Array.isArray(step.qualities) || step.qualities.length === 0)
          errors.push(`steps[${i}] (quality_explorer) missing qualities array`)
      }
    })
  }

  return errors
}

const CONDITION_LABELS = {
  non_reactivity:  'Non-Reactivity',
  reappraisal:     'Reappraisal',
  self_compassion: 'Self-Compassion',
}

const STEP_TYPE_COLORS = {
  video:                  { bg: '#e8f0fe', color: '#1a56db' },
  audio:                  { bg: '#fce7f3', color: '#9d174d' },
  text:                   { bg: '#f0fdf4', color: '#166534' },
  prompt_response:        { bg: '#fef9c3', color: '#854d0e' },
  closing:                { bg: '#f5f3ff', color: '#6d28d9' },
  slider:                 { bg: '#ecfdf5', color: '#065f46' },
  multi_response:         { bg: '#fff7ed', color: '#9a3412' },
  timer:                  { bg: '#f0f9ff', color: '#0369a1' },
  training_response:      { bg: '#fdf4ff', color: '#7e22ce' },
  training_response_multi:{ bg: '#fdf2f8', color: '#9d174d' },
  word_select:            { bg: '#fffbeb', color: '#92400e' },
  thought_rating:         { bg: '#f0fdf4', color: '#14532d' },
  thought_choice:         { bg: '#f0fdfa', color: '#134e4a' },
  trigger_map:            { bg: '#fef2f2', color: '#991b1b' },
  body_diagram:           { bg: '#f7f7ff', color: '#3730a3' },
  quality_explorer:       { bg: '#f0fdf4', color: '#065f46' },
}

// ── TrainingUpload ────────────────────────────────────────────────────────────

export default function TrainingUpload() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const fileInputRef = useRef(null)

  const [raw,           setRaw]           = useState('')
  const [parsed,        setParsed]        = useState(null)
  const [jsonError,     setJsonError]     = useState('')
  const [errors,        setErrors]        = useState([])
  const [videoChecks,   setVideoChecks]   = useState(null)  // null=pending, []|[...]=done
  const [checkingVids,  setCheckingVids]  = useState(false)
  const [videoOverride, setVideoOverride] = useState(false)
  const [audioChecks,   setAudioChecks]   = useState(null)
  const [checkingAudio, setCheckingAudio] = useState(false)
  const [audioOverride, setAudioOverride] = useState(false)

  // ── Async video existence check whenever a valid module is parsed ──────────
  useEffect(() => {
    if (!parsed) { setVideoChecks(null); setVideoOverride(false); return }

    const videoSteps = (parsed.steps ?? []).filter(s => s.type === 'video')
    if (videoSteps.length === 0) { setVideoChecks([]); return }

    setCheckingVids(true)
    setVideoChecks(null)
    setVideoOverride(false)

    Promise.all(
      videoSteps.map(async step => {
        // List the liliana/ prefix and look for an exact filename match.
        // Supabase storage has no real directories — "liliana/" is a path prefix.
        const { data } = await supabase.storage
          .from('videos')
          .list('liliana', { limit: 500, search: step.video_id })
        const found = (data ?? []).some(f => f.name === step.video_id)
        return {
          video_id:    step.video_id,
          bucket_path: `liliana/${step.video_id}`,
          found,
        }
      })
    ).then(results => {
      setVideoChecks(results)
      setCheckingVids(false)
    })
  }, [parsed])

  // ── Async audio existence check ───────────────────────────────────────────
  useEffect(() => {
    if (!parsed) { setAudioChecks(null); setAudioOverride(false); return }

    const audioSteps = (parsed.steps ?? []).filter(s => s.type === 'audio')
    if (audioSteps.length === 0) { setAudioChecks([]); return }

    setCheckingAudio(true)
    setAudioChecks(null)
    setAudioOverride(false)

    Promise.all(
      audioSteps.map(async step => {
        const { data } = await supabase
          .from('study_audios')
          .select('id, title')
          .eq('storage_path', step.audio_id)
          .maybeSingle()
        return {
          audio_id: step.audio_id,
          found:    !!data,
          title:    data?.title ?? null,
        }
      })
    ).then(results => {
      setAudioChecks(results)
      setCheckingAudio(false)
    })
  }, [parsed])

  // ── JSON parsing + schema validation ──────────────────────────────────────

  function handleRawChange(text) {
    setRaw(text)
    setJsonError('')
    setErrors([])
    setParsed(null)
    if (!text.trim()) return
    let def
    try {
      def = JSON.parse(text)
    } catch (e) {
      setJsonError(`JSON parse error: ${e.message}`)
      return
    }
    const errs = validateModule(def)
    setErrors(errs)
    if (errs.length === 0) setParsed(def)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => handleRawChange(ev.target.result)
    reader.readAsText(file)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('intervention_modules').insert({
        module_id:  parsed.module_id,
        condition:  parsed.condition,
        phase:      parsed.phase,
        lesson:     parsed.lesson,
        title:      parsed.title,
        subtitle:   parsed.subtitle ?? null,
        definition: parsed,
        created_by: user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervention-modules'] })
      navigate('/admin/training')
    },
  })

  // ── Derived readiness ─────────────────────────────────────────────────────

  const isSchemaValid   = parsed && errors.length === 0
  const videosAllFound  = videoChecks !== null && videoChecks.every(c => c.found)
  const hasMissingVids  = videoChecks !== null && videoChecks.some(c => !c.found)
  const audiosAllFound  = audioChecks !== null && audioChecks.every(c => c.found)
  const hasMissingAudio = audioChecks !== null && audioChecks.some(c => !c.found)
  const canImport       = isSchemaValid
    && !checkingVids && !checkingAudio
    && (videosAllFound || videoChecks?.length === 0 || videoOverride)
    && (audiosAllFound || audioChecks?.length === 0 || audioOverride)

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => navigate('/admin/training')} style={S.backBtn}>← Back</button>
        <h1 style={S.h1}>Import training module</h1>
      </div>

      {/* File upload strip */}
      <div style={S.fileStrip}>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} style={S.chooseBtn}>
          Choose .json file
        </button>
        <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx3)', margin: 0 }}>
          or paste JSON below
        </p>
      </div>

      {/* JSON textarea */}
      <textarea
        value={raw}
        onChange={e => handleRawChange(e.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        style={{
          ...S.textarea,
          borderColor: jsonError ? '#c0392b' : errors.length ? '#e67e22' : 'var(--bd)',
        }}
      />

      {jsonError && (
        <p style={{ color: '#c0392b', fontFamily: 'Space Mono', fontSize: 12, margin: '8px 0' }}>
          {jsonError}
        </p>
      )}

      {errors.length > 0 && (
        <div style={S.errorBox}>
          <p style={{ fontFamily: 'Space Mono', fontSize: 12, color: '#c0392b', margin: '0 0 6px', fontWeight: 600 }}>
            {errors.length} validation error{errors.length > 1 ? 's' : ''}
          </p>
          {errors.map((e, i) => (
            <p key={i} style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#8b4513', margin: '2px 0' }}>· {e}</p>
          ))}
        </div>
      )}

      {/* Module preview (schema valid) */}
      {isSchemaValid && <ModulePreview module={parsed} />}

      {/* Video existence check */}
      {isSchemaValid && (
        <VideoCheckPanel
          checks={videoChecks}
          checking={checkingVids}
          override={videoOverride}
          onOverride={setVideoOverride}
        />
      )}

      {/* Audio existence check */}
      {isSchemaValid && (
        <AudioCheckPanel
          checks={audioChecks}
          checking={checkingAudio}
          override={audioOverride}
          onOverride={setAudioOverride}
        />
      )}

      {/* Save error */}
      {save.isError && (
        <p style={{ color: '#c0392b', fontFamily: 'DM Sans', fontSize: 13, margin: '8px 0' }}>
          {save.error?.message?.includes('duplicate') || save.error?.message?.includes('unique')
            ? `A module with id "${parsed?.module_id}" already exists.`
            : `Save failed: ${save.error?.message}`}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          onClick={() => save.mutate()}
          disabled={!canImport || save.isPending}
          style={{ ...S.primaryBtn, opacity: canImport ? 1 : 0.45, cursor: canImport ? 'pointer' : 'default' }}
        >
          {save.isPending ? 'Saving…' : 'Import module'}
        </button>
      </div>
    </div>
  )
}

// ── VideoCheckPanel ───────────────────────────────────────────────────────────

function VideoCheckPanel({ checks, checking, override, onOverride }) {
  if (checks !== null && checks.length === 0) return null  // no video steps

  const allFound    = checks !== null && checks.every(c => c.found)
  const hasMissing  = checks !== null && checks.some(c => !c.found)

  const borderColor = checking    ? 'var(--bd)'
                    : allFound    ? '#1EA878'
                    : hasMissing  ? (override ? '#f0c040' : '#e67e22')
                    : 'var(--bd)'

  const bgColor     = checking    ? 'var(--bgc)'
                    : allFound    ? '#f0faf5'
                    : hasMissing  ? (override ? '#fffbf0' : '#fff5f0')
                    : 'var(--bgc)'

  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '14px 16px', margin: '12px 0' }}>
      <p style={{ fontFamily: 'Space Mono', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px', color: allFound ? '#1EA878' : '#8b6000' }}>
        {checking ? 'Checking videos in bucket…' : allFound ? '✓ All videos found in bucket' : 'Video file check'}
      </p>

      {checks !== null && checks.map(c => (
        <div key={c.video_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: c.found ? '#1EA878' : '#c0392b', flexShrink: 0, width: 14, textAlign: 'center' }}>
            {c.found ? '✓' : '✗'}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--tx)', margin: '0 0 1px', wordBreak: 'break-all' }}>
              {c.video_id}
            </p>
            <p style={{ fontFamily: 'DM Sans', fontSize: 11, color: c.found ? 'var(--tx3)' : '#c0392b', margin: 0 }}>
              {c.found
                ? `found at videos/${c.bucket_path}`
                : `not found at videos/${c.bucket_path} — upload this file before delivery`}
            </p>
          </div>
        </div>
      ))}

      {hasMissing && !override && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          <p style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--tx2)', margin: '0 0 8px' }}>
            Upload the missing file{checks.filter(c => !c.found).length > 1 ? 's' : ''} to{' '}
            <code style={{ fontFamily: 'Space Mono', fontSize: 11, background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>
              videos/liliana/
            </code>{' '}
            before delivering this module.
          </p>
          <button onClick={() => onOverride(true)} style={S.overrideBtn}>
            Import anyway
          </button>
        </div>
      )}

      {hasMissing && override && (
        <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#8b6000', margin: '8px 0 0' }}>
          ⚠ Override active — import will proceed; upload missing videos before delivery
        </p>
      )}
    </div>
  )
}

// ── AudioCheckPanel ───────────────────────────────────────────────────────────

function AudioCheckPanel({ checks, checking, override, onOverride }) {
  if (checks !== null && checks.length === 0) return null  // no audio steps

  const allFound   = checks !== null && checks.every(c => c.found)
  const hasMissing = checks !== null && checks.some(c => !c.found)

  const borderColor = checking   ? 'var(--bd)'
                    : allFound   ? '#1EA878'
                    : hasMissing ? (override ? '#f0c040' : '#e67e22')
                    : 'var(--bd)'

  const bgColor     = checking   ? 'var(--bgc)'
                    : allFound   ? '#f0faf5'
                    : hasMissing ? (override ? '#fffbf0' : '#fff5f0')
                    : 'var(--bgc)'

  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '14px 16px', margin: '12px 0' }}>
      <p style={{ fontFamily: 'Space Mono', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px', color: allFound ? '#1EA878' : '#8b6000' }}>
        {checking ? 'Checking audio in library…' : allFound ? '✓ All audio found in library' : 'Audio file check'}
      </p>

      {checks !== null && checks.map(c => (
        <div key={c.audio_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: c.found ? '#1EA878' : '#c0392b', flexShrink: 0, width: 14, textAlign: 'center' }}>
            {c.found ? '✓' : '✗'}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--tx)', margin: '0 0 1px', wordBreak: 'break-all' }}>
              {c.audio_id}
            </p>
            <p style={{ fontFamily: 'DM Sans', fontSize: 11, color: c.found ? 'var(--tx3)' : '#c0392b', margin: 0 }}>
              {c.found
                ? `found in audio library — "${c.title}"`
                : 'not found in audio library — upload via Admin → Audio before delivery'}
            </p>
          </div>
        </div>
      ))}

      {hasMissing && !override && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          <p style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--tx2)', margin: '0 0 8px' }}>
            Upload the missing file{checks.filter(c => !c.found).length > 1 ? 's' : ''} via{' '}
            <strong>Admin → Audio</strong> before delivering this module.
          </p>
          <button onClick={() => onOverride(true)} style={S.overrideBtn}>
            Import anyway
          </button>
        </div>
      )}

      {hasMissing && override && (
        <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#8b6000', margin: '8px 0 0' }}>
          ⚠ Override active — import will proceed; upload missing audio before delivery
        </p>
      )}
    </div>
  )
}

// ── ModulePreview ─────────────────────────────────────────────────────────────

function ModulePreview({ module }) {
  const steps = module.steps ?? []
  return (
    <div style={S.previewBox}>
      <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--pk)', margin: '0 0 10px' }}>
        ✓ Valid module
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', marginBottom: 12 }}>
        <PreviewRow label="Module ID"    value={module.module_id}                              mono />
        <PreviewRow label="Condition"    value={CONDITION_LABELS[module.condition] ?? module.condition} />
        <PreviewRow label="Phase"        value={module.phase}                                  mono />
        <PreviewRow label="Lesson"       value={`Day ${module.lesson}`}                             />
        <PreviewRow label="Title"        value={module.title}                                       />
        {module.subtitle && <PreviewRow label="Subtitle" value={module.subtitle} />}
        <PreviewRow label="Lead-in owl"  value={module.lead_in.owl}  mono />
        <PreviewRow label="Lead-out owl" value={module.lead_out.owl} mono />
      </div>
      <p style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0 6px' }}>
        {steps.length} step{steps.length !== 1 ? 's' : ''}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {steps.map((s, i) => {
          const col = STEP_TYPE_COLORS[s.type] ?? { bg: '#f0ede8', color: '#5f5e5a' }
          return (
            <span key={i} style={{ background: col.bg, color: col.color, borderRadius: 6, padding: '3px 10px', fontFamily: 'Space Mono', fontSize: 11 }}>
              {i + 1}. {s.type}{s.video_id ? ` — ${s.video_id}` : s.audio_id ? ` — ${s.audio_id}` : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function PreviewRow({ label, value, mono }) {
  return (
    <div>
      <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}: </span>
      <span style={{ fontFamily: mono ? 'Space Mono' : 'DM Sans', fontSize: mono ? 11 : 13, color: 'var(--tx)' }}>{value}</span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 24, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  backBtn: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx2)' },
  fileStrip: { background: 'var(--bgc)', border: '1px dashed var(--bds)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 },
  chooseBtn: { background: 'var(--bgp)', border: '1px solid var(--pkbs)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13, color: 'var(--pkd)' },
  textarea: { width: '100%', minHeight: 260, boxSizing: 'border-box', fontFamily: 'Space Mono', fontSize: 12, color: 'var(--tx)', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16, resize: 'vertical', lineHeight: 1.6, outline: 'none' },
  errorBox: { background: '#fff5f0', border: '1px solid #e67e22', borderRadius: 10, padding: '12px 16px', margin: '12px 0' },
  previewBox: { background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 10, padding: '14px 16px', margin: '12px 0' },
  primaryBtn: { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600 },
  overrideBtn: { background: 'transparent', border: '1px solid #c09000', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, color: '#8b6000' },
}

const PLACEHOLDER = `{
  "module_id": "non-reactivity-phase1-day1",
  "condition": "non_reactivity",
  "phase": "phase1",
  "lesson": 1,
  "title": "Non-Reactivity Practice",
  "subtitle": "Guided training session",
  "lead_in": {
    "owl": "owl_nonreactivity",
    "text": "Today's lesson involves watching a guided training video."
  },
  "steps": [
    {
      "type": "video",
      "video_id": "filename_resampled.mp4",
      "label": "Guided non-reactivity practice"
    }
  ],
  "lead_out": {
    "owl": "owl_love",
    "text": "You've completed today's training."
  }
}`
