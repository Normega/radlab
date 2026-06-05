import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const GAMES = [
  { slug: 'aptitude_suite', label: 'Aptitude Suite' },
  { slug: 'breath_belt',    label: 'Breath Belt' },
  { slug: 'still_water',    label: 'Still Water' },
]

const PHYSIO_STEPS = [
  { slug: 'belt_setup', label: 'Physio Setup (Belt + Triggers)' },
]

const STEP_TYPES = [
  { value: 'consent',       label: 'Consent' },
  { value: 'game',          label: 'Game' },
  { value: 'physio',        label: 'Physio' },
  { value: 'questionnaire', label: 'Questionnaire' },
  { value: 'debrief',       label: 'Debrief' },
]

function useQuestionnaires() {
  return useQuery({
    queryKey: ['questionnaires-locked'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionnaires')
        .select('slug, name')
        .eq('locked', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export default function ProtocolBuilder({ steps, onChange }) {
  const { data: questionnaires = [] } = useQuestionnaires()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function addStep() {
    onChange([...steps, { id: crypto.randomUUID(), type: 'game', slug: 'breath_belt' }])
  }

  function removeStep(id) {
    onChange(steps.filter(s => s.id !== id))
  }

  function updateStep(id, patch) {
    onChange(steps.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = steps.findIndex(s => s.id === active.id)
      const newIndex = steps.findIndex(s => s.id === over.id)
      onChange(arrayMove(steps, oldIndex, newIndex))
    }
  }

  return (
    <div style={S.wrap}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {steps.map((step, i) => (
            <SortableStep
              key={step.id}
              step={step}
              index={i}
              questionnaires={questionnaires}
              onUpdate={patch => updateStep(step.id, patch)}
              onRemove={() => removeStep(step.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {steps.length === 0 && (
        <p style={S.empty}>No steps yet. Add at least one below.</p>
      )}

      <button type="button" style={S.addBtn} onClick={addStep}>
        + Add step
      </button>

      {steps.length > 0 && !steps.some(s => s.type === 'consent') && (
        <p style={S.warn}>Warning: no consent step in this protocol.</p>
      )}
      {steps.length > 0 && !steps.some(s => s.type === 'debrief') && (
        <p style={S.warn}>Warning: no debrief step in this protocol.</p>
      )}
    </div>
  )
}

function SortableStep({ step, index, questionnaires, onUpdate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isFixed = step.type === 'consent' || step.type === 'debrief'

  return (
    <div ref={setNodeRef} style={{ ...S.row, ...style }}>
      <span style={S.handle} {...attributes} {...listeners} title="Drag to reorder">⠿</span>

      <span style={S.indexBadge}>{index + 1}</span>

      <select
        style={S.typeSelect}
        value={step.type}
        onChange={e => {
          const type = e.target.value
          const slug = type === 'consent'       ? 'consent'
            : type === 'debrief'                ? 'debrief'
            : type === 'game'                   ? (GAMES[0]?.slug ?? '')
            : type === 'physio'                 ? (PHYSIO_STEPS[0]?.slug ?? '')
            : (questionnaires[0]?.slug ?? '')
          onUpdate({ type, slug })
        }}
      >
        {STEP_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {!isFixed && (
        <select
          style={S.slugSelect}
          value={step.slug}
          onChange={e => onUpdate({ slug: e.target.value })}
        >
          {step.type === 'game' && GAMES.map(g => (
            <option key={g.slug} value={g.slug}>{g.label}</option>
          ))}
          {step.type === 'physio' && PHYSIO_STEPS.map(p => (
            <option key={p.slug} value={p.slug}>{p.label}</option>
          ))}
          {step.type === 'questionnaire' && questionnaires.map(q => (
            <option key={q.slug} value={q.slug}>{q.name}</option>
          ))}
          {step.type === 'questionnaire' && questionnaires.length === 0 && (
            <option value="">No locked questionnaires</option>
          )}
        </select>
      )}

      {isFixed && (
        <span style={S.fixedLabel}>{step.type}</span>
      )}

      <button type="button" style={S.removeBtn} onClick={onRemove} title="Remove step">✕</button>
    </div>
  )
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 8,
    padding: '10px 12px',
  },
  handle: {
    cursor: 'grab',
    color: 'var(--tx3)',
    fontSize: 16,
    lineHeight: 1,
    userSelect: 'none',
    flexShrink: 0,
  },
  indexBadge: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 11,
    color: 'var(--tx3)',
    minWidth: 18,
    textAlign: 'center',
    flexShrink: 0,
  },
  typeSelect: {
    fontSize: 13,
    fontFamily: '"DM Sans",system-ui,sans-serif',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    padding: '5px 8px',
    color: 'var(--tx)',
    background: '#fff',
    flexShrink: 0,
  },
  slugSelect: {
    fontSize: 13,
    fontFamily: '"DM Sans",system-ui,sans-serif',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    padding: '5px 8px',
    color: 'var(--tx)',
    background: '#fff',
    flex: 1,
    minWidth: 0,
  },
  fixedLabel: {
    flex: 1,
    fontSize: 13,
    color: 'var(--tx3)',
    fontFamily: '"Space Mono",monospace',
    fontStyle: 'italic',
  },
  addBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: '1px dashed var(--bd)',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    color: 'var(--tx2)',
    cursor: 'pointer',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    marginTop: 4,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: 'var(--tx3)',
    padding: '0 2px',
    lineHeight: 1,
    flexShrink: 0,
  },
  empty: {
    fontSize: 13,
    color: 'var(--tx3)',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    margin: 0,
  },
  warn: {
    fontSize: 12,
    color: '#92400e',
    background: '#fef9c3',
    border: '1px solid #fde68a',
    borderRadius: 6,
    padding: '6px 10px',
    margin: 0,
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
}
