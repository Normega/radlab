import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const CONDITION_LABELS = {
  non_reactivity:  'Non-Reactivity',
  reappraisal:     'Reappraisal',
  self_compassion: 'Self-Compassion',
}

const CONDITION_ORDER = ['non_reactivity', 'reappraisal', 'self_compassion']

const STEP_TYPE_LABELS = {
  video:           'video',
  text:            'text',
  prompt_response: 'prompt',
  closing:         'closing',
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TrainingLibrary() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: modules = [], isLoading, isError } = useQuery({
    queryKey: ['intervention-modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_modules')
        .select('id, module_id, condition, phase, lesson, title, subtitle, definition, created_at')
        .order('condition')
        .order('phase')
        .order('lesson')
      if (error) throw error
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (mod) => {
      const { error } = await supabase
        .from('intervention_modules')
        .delete()
        .eq('id', mod.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervention-modules'] })
      setConfirmDelete(null)
    },
  })

  // Group by condition
  const grouped = CONDITION_ORDER.reduce((acc, cond) => {
    const items = modules.filter(m => m.condition === cond)
    if (items.length) acc[cond] = items
    return acc
  }, {})
  const uncategorized = modules.filter(m => !CONDITION_ORDER.includes(m.condition))
  if (uncategorized.length) grouped['other'] = uncategorized

  return (
    <div style={{ maxWidth: 840 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={S.h1}>Training Modules</h1>
          <p style={S.sub}>Import and manage intervention training modules for session delivery.</p>
        </div>
        <button onClick={() => navigate('/admin/training/new')} style={S.primaryBtn}>
          + Import module
        </button>
      </div>

      {isLoading && <p style={S.meta}>Loading…</p>}
      {isError  && <div style={S.errorBox}>Failed to load training modules.</div>}

      {!isLoading && modules.length === 0 && (
        <div style={S.emptyBox}>
          <p style={{ fontFamily: 'DM Sans', color: 'var(--tx2)', fontSize: 15, margin: '0 0 12px' }}>
            No training modules imported yet.
          </p>
          <button onClick={() => navigate('/admin/training/new')} style={S.primaryBtn}>
            Import your first module
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([cond, items]) => (
        <div key={cond} style={{ marginBottom: 36 }}>
          <div style={S.conditionHeader}>
            <div style={S.conditionDot} />
            <span style={S.conditionLabel}>
              {CONDITION_LABELS[cond] ?? cond}
            </span>
            <span style={S.conditionCount}>{items.length} module{items.length !== 1 ? 's' : ''}</span>
          </div>

          <div style={S.list}>
            {items.map(mod => {
              const steps = mod.definition?.steps ?? []
              const stepTypes = steps.map(s => STEP_TYPE_LABELS[s.type] ?? s.type)
              const isConfirming = confirmDelete === mod.id

              return (
                <div key={mod.id} style={S.row}>
                  {/* Phase + lesson badge */}
                  <div style={S.lessonBadge}>
                    <span style={S.lessonPhase}>{mod.phase === 'phase1' ? 'P1' : 'P2'}</span>
                    <span style={S.lessonDay}>D{mod.lesson}</span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={S.moduleTitle}>{mod.title}</p>
                    {mod.subtitle && <p style={S.moduleSub}>{mod.subtitle}</p>}
                    <p style={S.moduleMeta}>
                      <span style={S.moduleId}>{mod.module_id}</span>
                      {' · '}
                      {steps.length} step{steps.length !== 1 ? 's' : ''}
                      {stepTypes.length > 0 && ` (${stepTypes.join(', ')})`}
                      {' · '}
                      {fmtDate(mod.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!isConfirming ? (
                      <button
                        onClick={() => setConfirmDelete(mod.id)}
                        style={S.deleteBtn}
                      >
                        Delete
                      </button>
                    ) : (
                      <>
                        <span style={{ fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx2)' }}>Delete?</span>
                        <button onClick={() => setConfirmDelete(null)} style={S.ghostBtn}>Cancel</button>
                        <button
                          onClick={() => deleteMutation.mutate(mod)}
                          disabled={deleteMutation.isPending}
                          style={{ ...S.deleteBtn, background: '#c0392b', color: '#fff', border: 'none' }}
                        >
                          {deleteMutation.isPending ? '…' : 'Confirm'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const S = {
  h1: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px',
  },
  sub: { fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx3)', margin: 0 },
  meta: { fontFamily: 'Space Mono', fontSize: 12, color: 'var(--tx3)', margin: 0 },
  primaryBtn: {
    background: 'var(--pk)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 20px',
    fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  errorBox: {
    background: '#fff5f0', border: '1px solid #e67e22',
    borderRadius: 12, padding: '16px 20px',
    fontFamily: 'DM Sans', fontSize: 14, color: '#8b4513',
  },
  emptyBox: {
    background: 'var(--bgc)', border: '1px dashed var(--bds)',
    borderRadius: 14, padding: 40, textAlign: 'center',
  },
  conditionHeader: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  conditionDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#639922', flexShrink: 0,
  },
  conditionLabel: {
    fontFamily: 'Space Mono', fontSize: 11, color: 'var(--tx2)',
    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700,
  },
  conditionCount: {
    fontFamily: 'DM Sans', fontSize: 12, color: 'var(--tx3)',
  },
  list: {
    border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden',
    display: 'flex', flexDirection: 'column', gap: 1,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'var(--bgc)', padding: '12px 16px',
    borderBottom: '1px solid var(--bd)',
  },
  lessonBadge: {
    width: 44, flexShrink: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'var(--bgp)', border: '1px solid var(--pkb)',
    borderRadius: 8, padding: '5px 6px',
  },
  lessonPhase: {
    fontFamily: 'Space Mono', fontSize: 9, color: 'var(--pk)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  lessonDay: {
    fontFamily: 'Space Mono', fontSize: 13, fontWeight: 700, color: 'var(--tx)',
  },
  moduleTitle: {
    fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600,
    color: 'var(--tx)', margin: '0 0 2px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  moduleSub: {
    fontFamily: 'DM Sans', fontSize: 12, color: 'var(--tx2)',
    margin: '0 0 2px', fontStyle: 'italic',
  },
  moduleMeta: {
    fontFamily: 'DM Sans', fontSize: 12, color: 'var(--tx3)', margin: 0,
  },
  moduleId: {
    fontFamily: 'Space Mono', fontSize: 10, color: 'var(--gy)',
  },
  ghostBtn: {
    background: 'var(--bgc)', border: '1px solid var(--bd)',
    borderRadius: 7, padding: '5px 10px',
    fontFamily: 'DM Sans', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer',
  },
  deleteBtn: {
    background: 'var(--bgc)', border: '1px solid #e0b0b0',
    borderRadius: 7, padding: '5px 10px',
    fontFamily: 'DM Sans', fontSize: 12, color: '#c0392b', cursor: 'pointer',
  },
}
