import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import DemoModal from '../DemoModal'
import StepDispatcher from './StepDispatcher'

/**
 * Admin session demo — steps through a session template's nodes with
 * StepDispatcher in demoMode: real participant UI, zero DB writes.
 *
 * Steps that need participant/server context get demo substitutes:
 *   - midpoint: locally generated random Phase 1 data + an arm picker
 *   - video/audio: play in preview mode (no tracking rows)
 *   - questionnaires/VAS: real UI, responses discarded
 *   - forms (consent/demographics/compensation) + games + physio: skip card
 * A persistent "Skip step" control covers anything gated (e.g. watch-to-90%
 * video gates) so an auditor can move on without sitting through media.
 */
// studyDay/sendTime: optional design-time context from the Experiment Builder
// (the demoed node's nominal day + send time), letting day-keyed steps (Zerin
// daily check-ins / wellness tips) render that day's real content. Absent when
// demoing from the Session Library, where a template has no day context.
export default function SessionDemoModal({ templateId, label, studyDay = null, sendTime = null, onClose }) {
  const [index, setIndex] = useState(0)
  const [runId, setRunId] = useState(0) // bump to restart

  const { data: nodes = [], isLoading, error } = useQuery({
    queryKey: ['session-demo-nodes', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_template_nodes')
        .select(`
          id, order_index, label, activity_id, questionnaire_id, module_id,
          activities(id, category, subcategory, label),
          questionnaires(id, slug, name)
        `)
        .eq('session_template_id', templateId)
        .order('order_index')
      if (error) throw error
      // Normalize to the shape get_session_by_token returns, so
      // StepDispatcher sees identical nodes to a real participant session.
      return (data ?? []).map(n => ({
        ...n,
        activities: n.activities
          ?? (n.questionnaires
            ? { id: n.questionnaires.id, category: 'questionnaire', subcategory: n.questionnaires.slug, label: n.questionnaires.name }
            : null)
          ?? (n.module_id
            ? { id: null, category: 'training', subcategory: n.module_id, label: n.label }
            : null),
      }))
    },
  })

  const total = nodes.length
  const node  = nodes[index]
  const doneAll = !isLoading && !error && total > 0 && index >= total

  function advance() { setIndex(i => i + 1) }
  function restart() { setIndex(0); setRunId(r => r + 1) }

  return (
    <DemoModal title={`Session demo — ${label}`} onClose={onClose}>
      {/* Progress + skip strip */}
      <div style={S.strip} onClick={e => e.stopPropagation()}>
        <span style={S.stripText}>
          {isLoading ? 'Loading session…' : doneAll ? 'Session complete' : `Step ${index + 1} of ${total}`}
          {node ? ` · ${node.activities?.label ?? node.label ?? ''}` : ''}
        </span>
        {!doneAll && !isLoading && node && (
          <button style={S.skipBtn} onClick={advance}>Skip step →</button>
        )}
      </div>

      <div style={S.body}>
        {error && <p style={S.err}>Could not load session nodes: {error.message}</p>}
        {!isLoading && !error && total === 0 && <p style={S.err}>This session has no steps.</p>}

        {doneAll && (
          <div style={S.doneCard}>
            <p style={S.doneTitle}>End of session</p>
            <p style={S.doneSub}>All {total} steps walked through. Nothing was saved.</p>
            <button style={S.restartBtn} onClick={restart}>Restart demo</button>
          </div>
        )}

        {node && !doneAll && (
          <StepDispatcher
            key={`${runId}-${node.id}`}
            node={node}
            enrollment={null}
            scheduleId={null}
            studyDay={studyDay}
            sendTime={sendTime}
            stepIndex={index}
            totalSteps={total}
            onComplete={advance}
            debriefHtml={null}
            supabaseClient={null}
            demoMode
          />
        )}
      </div>
    </DemoModal>
  )
}

const S = {
  strip: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '0 16px 10px',
  },
  stripText: { fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  skipBtn: {
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
    fontFamily: 'DM Sans', fontSize: 12, color: '#fff', whiteSpace: 'nowrap',
  },
  body: { background: '#fff', borderRadius: '12px 12px 0 0', minHeight: '70vh', overflow: 'hidden' },
  err: { padding: 40, textAlign: 'center', fontFamily: 'DM Sans', color: '#e04', fontSize: 14 },
  doneCard: { padding: '80px 24px', textAlign: 'center', fontFamily: 'DM Sans' },
  doneTitle: { fontSize: 20, fontWeight: 600, color: 'var(--tx)', margin: '0 0 8px' },
  doneSub: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 24px' },
  restartBtn: {
    background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10,
    padding: '11px 26px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
  },
}
