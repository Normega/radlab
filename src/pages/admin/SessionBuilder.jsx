import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'

const CATEGORY_ORDER  = ['game', 'questionnaire', 'vas', 'form', 'physio', 'training']
const CATEGORY_LABELS = { game: 'Games', questionnaire: 'Questionnaires', vas: 'Rating Scales', form: 'Forms', physio: 'Physio', training: 'Training Modules' }

function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, label, category, estimated_minutes')
        .order('label')
      if (error) throw error
      return data ?? []
    },
  })
}

function useTrainingModules() {
  return useQuery({
    queryKey: ['intervention-modules-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_modules')
        .select('id, module_id, condition, phase, lesson, title')
        .order('condition').order('phase').order('lesson')
      if (error) throw error
      return data ?? []
    },
  })
}

// Uploaded questionnaires from the questionnaires table — shown alongside
// hardcoded activity-based questionnaires in the picker.
function useUploadedQuestionnaires() {
  return useQuery({
    queryKey: ['questionnaires-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionnaires')
        .select('id, slug, name')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

function useSession(id) {
  return useQuery({
    queryKey: ['session-template', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_templates')
        .select(`
          id, label, description,
          session_template_nodes(id, order_index, activity_id, questionnaire_id, module_id, label,
            activities(id, label, category, estimated_minutes),
            questionnaires(id, name, slug)
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

function SortableItem({ item, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._key })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={{ ...S.seqItem, ...style }}>
      <span style={S.dragHandle} {...attributes} {...listeners}>⠿</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={S.seqLabel}>{item.label}</span>
        {item.category && <span style={S.seqCat}>{item.category}</span>}
      </div>
      {item.estimated_minutes ? (
        <span style={S.seqMin}>{item.estimated_minutes}m</span>
      ) : null}
      <button style={S.removeBtn} onClick={() => onRemove(item._key)}>×</button>
    </div>
  )
}

export default function SessionBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isNew = !id

  const { data: activities = [] }            = useActivities()
  const { data: uploadedQuestionnaires = [] } = useUploadedQuestionnaires()
  const { data: trainingModules = [] }       = useTrainingModules()
  const { data: existing, isLoading }        = useSession(id)

  const [label,         setLabel]         = useState('')
  const [description,   setDescription]   = useState('')
  const [sequence,      setSequence]      = useState([])
  const [error,         setError]         = useState(null)
  const [collapsedCats, setCollapsedCats] = useState(new Set(CATEGORY_ORDER))

  function toggleCat(cat) {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  useEffect(() => {
    if (!existing) return
    setLabel(existing.label ?? '')
    setDescription(existing.description ?? '')
    const sorted = [...(existing.session_template_nodes ?? [])].sort(
      (a, b) => a.order_index - b.order_index
    )
    setSequence(sorted.map((n, i) => ({
      _key:              `existing-${n.id}-${i}`,
      activity_id:       n.activity_id      ?? null,
      questionnaire_id:  n.questionnaire_id ?? null,
      module_id:         n.module_id        ?? null,
      label:             n.activities?.label ?? n.questionnaires?.name ?? n.label,
      category:          n.module_id ? 'training' : (n.activities?.category ?? 'questionnaire'),
      estimated_minutes: n.activities?.estimated_minutes ?? null,
    })))
  }, [existing])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      setSequence(prev => {
        const oldIdx = prev.findIndex(i => i._key === active.id)
        const newIdx = prev.findIndex(i => i._key === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  // Handles activities-table items, uploaded questionnaires, and training modules.
  function addItem(act) {
    if (act._source === 'training') {
      setSequence(prev => [...prev, {
        _key:              `tm-${act.module_id}-${Date.now()}`,
        activity_id:       null,
        questionnaire_id:  null,
        module_id:         act.module_id,
        label:             act.label,
        category:          'training',
        estimated_minutes: null,
      }])
    } else if (act._source === 'uploaded') {
      setSequence(prev => [...prev, {
        _key:             `q-${act.id}-${Date.now()}`,
        activity_id:      null,
        questionnaire_id: act.id,
        module_id:        null,
        label:            act.label,
        category:         'questionnaire',
        estimated_minutes: null,
      }])
    } else {
      setSequence(prev => [...prev, {
        _key:              `${act.id}-${Date.now()}`,
        activity_id:       act.id,
        questionnaire_id:  null,
        module_id:         null,
        label:             act.label,
        category:          act.category,
        estimated_minutes: act.estimated_minutes,
      }])
    }
  }

  function removeItem(key) {
    setSequence(prev => prev.filter(i => i._key !== key))
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error('Label is required.')
      const buildNodes = (tmplId) =>
        sequence.map((item, i) => ({
          session_template_id: tmplId,
          order_index:         i,
          activity_id:         item.activity_id    ?? null,
          questionnaire_id:    item.questionnaire_id ?? null,
          module_id:           item.module_id      ?? null,
          label:               item.label,
        }))

      if (isNew) {
        const { data: tmpl, error: te } = await supabase
          .from('session_templates')
          .insert({ label: label.trim(), description: description.trim() || null })
          .select('id').single()
        if (te) throw te
        if (sequence.length) {
          const { error: ne } = await supabase.from('session_template_nodes').insert(buildNodes(tmpl.id))
          if (ne) throw ne
        }
        return tmpl.id
      } else {
        const { error: ue } = await supabase
          .from('session_templates')
          .update({ label: label.trim(), description: description.trim() || null })
          .eq('id', id)
        if (ue) throw ue
        await supabase.from('session_template_nodes').delete().eq('session_template_id', id)
        if (sequence.length) {
          const { error: ne } = await supabase.from('session_template_nodes').insert(buildNodes(id))
          if (ne) throw ne
        }
        return id
      }
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ['session-templates'] })
      qc.invalidateQueries({ queryKey: ['session-template', id] })
      navigate(`/admin/sessions/${newId}`)
    },
    onError: (e) => setError(e.message),
  })

  // Build the grouped picker: activities + uploaded questionnaires + training modules.
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const actItems = activities.filter(a => a.category === cat)
    if (cat === 'questionnaire') {
      const uploadedItems = uploadedQuestionnaires.map(q => ({
        _source: 'uploaded', id: q.id, label: q.name, slug: q.slug,
        category: 'questionnaire', estimated_minutes: null,
      }))
      const combined = [...actItems, ...uploadedItems]
      if (combined.length) acc[cat] = combined
    } else if (cat === 'training') {
      const tmItems = trainingModules.map(m => ({
        _source:   'training',
        id:        m.id,
        module_id: m.module_id,
        label:     `${m.title} (P${m.phase === 'phase1' ? 1 : 2} D${m.lesson})`,
        category:  'training',
        estimated_minutes: null,
      }))
      if (tmItems.length) acc[cat] = tmItems
    } else if (actItems.length) {
      acc[cat] = actItems
    }
    return acc
  }, {})
  const uncategorized = activities.filter(a => !CATEGORY_ORDER.includes(a.category))
  if (uncategorized.length) grouped['other'] = uncategorized

  const totalMinutes = sequence.reduce((sum, i) => sum + (i.estimated_minutes ?? 0), 0)
  const empty = activities.length === 0 && uploadedQuestionnaires.length === 0 && trainingModules.length === 0

  if (!isNew && isLoading) return <p style={S.muted}>Loading…</p>

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>{isNew ? 'New Session' : 'Edit Session'}</h1>
          <p style={S.sub}>Build an ordered sequence of activities.</p>
        </div>
        <button
          style={{ ...S.btnPrimary, opacity: save.isPending ? 0.7 : 1 }}
          onClick={() => { setError(null); save.mutate() }}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save session'}
        </button>
      </div>

      {error && <p style={S.errMsg}>{error}</p>}

      <div style={S.fields}>
        <label style={S.fieldLabel}>Label <span style={{ color: '#e04' }}>*</span></label>
        <input
          style={S.input}
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Baseline intake"
        />
        <label style={{ ...S.fieldLabel, marginTop: 12 }}>Description</label>
        <textarea
          style={{ ...S.input, minHeight: 64, resize: 'vertical' }}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional notes for this session"
        />
      </div>

      <div style={S.columns}>
        {/* Activity picker */}
        <div style={S.panel}>
          <p style={S.panelTitle}>Activities</p>
          {empty && <p style={S.muted}>No activities in the database yet.</p>}
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <button style={S.catToggle} onClick={() => toggleCat(cat)}>
                <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                <span style={S.catChevron}>{collapsedCats.has(cat) ? '▶' : '▼'}</span>
              </button>
              {!collapsedCats.has(cat) && items.map(act => (
                <button
                  key={`${act._source ?? 'act'}-${act.id}`}
                  style={S.actBtn}
                  onClick={() => addItem(act)}
                >
                  <span style={S.actLabel}>{act.label}</span>
                  {act._source === 'uploaded' && (
                    <span style={S.uploadedTag}>uploaded</span>
                  )}
                  {act.estimated_minutes ? (
                    <span style={S.actMin}>{act.estimated_minutes}m</span>
                  ) : null}
                  <span style={S.actAdd}>+</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Sequence */}
        <div style={S.panel}>
          <p style={S.panelTitle}>Sequence</p>
          {sequence.length === 0 ? (
            <p style={S.muted}>Click activities on the left to add them here.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sequence.map(i => i._key)} strategy={verticalListSortingStrategy}>
                {sequence.map(item => (
                  <SortableItem key={item._key} item={item} onRemove={removeItem} />
                ))}
              </SortableContext>
            </DndContext>
          )}
          {totalMinutes > 0 && (
            <div style={S.totalRow}>
              <span style={S.totalLabel}>Total</span>
              <span style={S.totalVal}>{totalMinutes} min</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  header:       { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  h1:           { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  sub:          { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  muted:        { fontSize: 14, color: 'var(--tx3)', margin: '8px 0' },
  errMsg:       { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 },
  fields:       { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '18px 20px', marginBottom: 20 },
  fieldLabel:   { display: 'block', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  input:        { width: '100%', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', boxSizing: 'border-box' },
  columns:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  panel:        { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '18px 16px', minHeight: 200 },
  panelTitle:   { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' },
  catLabel:     { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--pk)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' },
  catToggle:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: '0 0 6px', cursor: 'pointer', fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--pk)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 },
  catChevron:   { fontSize: 8, opacity: 0.7 },
  actBtn:       { display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', marginBottom: 5, textAlign: 'left' },
  actLabel:     { flex: 1, fontSize: 13, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  uploadedTag:  { fontSize: 10, color: 'var(--tx3)', fontFamily: '"Space Mono",monospace', border: '1px solid var(--bd)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 },
  actMin:       { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)' },
  actAdd:       { fontSize: 16, color: 'var(--pk)', fontWeight: 700, lineHeight: 1 },
  seqItem:      { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--pkb)', border: '1px solid var(--bd)', borderRadius: 8, padding: '7px 10px', marginBottom: 6, cursor: 'default' },
  dragHandle:   { fontSize: 16, color: 'var(--tx3)', cursor: 'grab', userSelect: 'none', flexShrink: 0 },
  seqLabel:     { fontSize: 13, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  seqCat:       { fontSize: 11, color: 'var(--tx3)', fontFamily: '"Space Mono",monospace', display: 'block' },
  seqMin:       { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', flexShrink: 0 },
  removeBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--tx3)', padding: '0 2px', lineHeight: 1, flexShrink: 0 },
  totalRow:     { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--bd)', marginTop: 12, paddingTop: 10 },
  totalLabel:   { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  totalVal:     { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx)', fontWeight: 700 },
  btnPrimary:   { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
}
