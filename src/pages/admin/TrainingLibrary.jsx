import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import InterventionPage from '../../components/study/InterventionPage'
import WrapperElementPage from '../../components/study/WrapperElementPage'
import { WRAPPER_ELEMENTS } from '../../components/study/wrapperElements'

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
  const [demoModule,    setDemoModule]    = useState(null)
  const [demoWrapper,   setDemoWrapper]   = useState(null)

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

      {/* Standard session wrapper elements — platform-managed, shared by every day */}
      <div style={{ marginBottom: 36 }}>
        <div style={S.conditionHeader}>
          <div style={{ ...S.conditionDot, background: 'var(--pk)' }} />
          <span style={S.conditionLabel}>Standard Session Elements</span>
          <span style={S.conditionCount}>every daily session · platform-managed</span>
        </div>

        <div style={S.list}>
          {WRAPPER_ELEMENTS.map(el => (
            <div key={el.key} style={S.row}>
              <div style={{ ...S.lessonBadge, background: 'var(--bgc)', border: '1px solid var(--bd)' }}>
                <span style={S.lessonPhase}>step</span>
                <span style={S.lessonDay}>{el.slot + 1}/5</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={S.moduleTitle}>{el.name}</p>
                <p style={S.moduleMeta}>{el.description}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setDemoWrapper(el)} style={S.demoBtn}>
                  ▶ Demo
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--tx3)', margin: '8px 2px 0' }}>
          These screens wrap every practice module: Welcome → Check-in → Practice → Check-in → Farewell.
          Check-in rating items are placeholders pending final wording — edit{' '}
          <span style={{ fontFamily: 'Space Mono', fontSize: 11 }}>src/components/study/wrapperElements.js</span>.
        </p>
      </div>

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
              const stepTypes  = steps.map(s => STEP_TYPE_LABELS[s.type] ?? s.type)
              const videoPaths = steps.filter(s => s.type === 'video').map(s => `liliana/${s.video_id}`)
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
                    {videoPaths.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {videoPaths.map(p => (
                          <p key={p} style={S.videoPath}>
                            videos/{p}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!isConfirming ? (
                      <>
                        <button
                          onClick={() => setDemoModule(mod.definition)}
                          style={S.demoBtn}
                        >
                          ▶ Demo
                        </button>
                        <button
                          onClick={() => setConfirmDelete(mod.id)}
                          style={S.deleteBtn}
                        >
                          Delete
                        </button>
                      </>
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

      {/* Demo modals */}
      {demoModule && (
        <DemoModal title={`Demo — ${demoModule.title}`} onClose={() => setDemoModule(null)}>
          <InterventionPage
            module={demoModule}
            participantId={null}
            dayDataId={null}
            scheduleId={null}
            studyDay={demoModule.lesson}
            onComplete={() => setDemoModule(null)}
            demoMode
          />
        </DemoModal>
      )}
      {demoWrapper && (
        <DemoModal title={`Demo — ${demoWrapper.name}`} onClose={() => setDemoWrapper(null)}>
          <WrapperElementPage
            element={demoWrapper}
            onComplete={() => setDemoWrapper(null)}
          />
        </DemoModal>
      )}
    </div>
  )
}

// ── DemoModal ─────────────────────────────────────────────────────────────────

function DemoModal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      {/* Header bar */}
      <div
        style={{
          width: '100%', maxWidth: 640,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <p style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, color: '#fff', margin: '0 0 2px' }}>
            {title}
          </p>
          <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Preview only — no data saved
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            fontFamily: 'DM Sans', fontSize: 13, color: '#fff',
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Preview content — no participant data, no DB writes */}
      <div
        style={{ width: '100%', maxWidth: 640, flex: 1 }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
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
  videoPath: {
    fontFamily: 'Space Mono', fontSize: 10, color: 'var(--tx2)',
    margin: '1px 0', letterSpacing: '0.02em',
  },
  demoBtn: {
    background: 'var(--bgp)', border: '1px solid var(--pkb)',
    borderRadius: 7, padding: '5px 10px',
    fontFamily: 'DM Sans', fontSize: 12,
    color: 'var(--pkd)', cursor: 'pointer',
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
