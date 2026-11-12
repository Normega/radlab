import { useState } from 'react'
import DemoModal from '../DemoModal'
import StepDispatcher from './StepDispatcher'
import { taskInfo } from '../tasks/taskRegistry'

/**
 * One session step, previewed on its own (the Preview button on each row of
 * the session builder's Sequence list, Norm 2026-11-12). It is the session
 * demo for a single node: StepDispatcher in demoMode, the real participant
 * screens, nothing saved.
 *
 * Games can't run inside the demo (they need a live session), so a game step
 * shows a card instead, with a link to the game's own no-save preview
 * (/admin/tasks/preview/:slug) where one exists. A session step that plays one
 * part of a game (Foggy Valleys' two valleys) links to the whole game's preview.
 *
 * `node` is shaped like a session_template_nodes row with `activities` nested,
 * the same shape SessionDemoModal builds.
 */

// Session steps that are one part of a previewable game
const GAME_PREVIEW = {
  foggy_valleys_1: 'foggy_valleys',
  foggy_valleys_2: 'foggy_valleys',
}

export default function StepPreviewModal({ node, onClose }) {
  const [run, setRun]   = useState(0)
  const [done, setDone] = useState(false)
  const act   = node?.activities
  const label = act?.label ?? node?.label ?? 'Step'

  const isGame   = act?.category === 'game'
  const gameSlug = isGame ? (GAME_PREVIEW[act.subcategory] ?? act.subcategory) : null
  const playable = isGame && taskInfo(gameSlug).previewable

  function again() { setDone(false); setRun(r => r + 1) }

  return (
    <DemoModal title={`Step preview: ${label}`} onClose={onClose}>
      <div style={S.body}>
        {isGame ? (
          <div style={S.card}>
            <span style={S.chip}>game · {act.subcategory}</span>
            <p style={S.title}>{label}</p>
            {playable ? (
              <>
                <p style={S.sub}>
                  A game needs a live session to run as a step, so it opens in its own preview. Nothing is saved.
                  {gameSlug !== act.subcategory && ' The preview plays the whole game; this step is one part of it.'}
                </p>
                <a style={S.btn} href={`/admin/tasks/preview/${gameSlug}`} target="_blank" rel="noreferrer">
                  Open the game preview
                </a>
              </>
            ) : (
              <p style={S.sub}>
                This game has no no-save preview yet, so it can only be seen in a test session.
                {taskInfo(act.subcategory).note ? ` ${taskInfo(act.subcategory).note}.` : ''}
              </p>
            )}
          </div>
        ) : done ? (
          <div style={S.card}>
            <p style={S.title}>End of this step</p>
            <p style={S.sub}>In a session, the participant would go on to the next step now. Nothing was saved.</p>
            <div style={S.row}>
              <button type="button" style={S.btn} onClick={again}>Preview again</button>
              <button type="button" style={S.btnQuiet} onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <StepDispatcher
            key={run}
            node={node}
            enrollment={null}
            scheduleId={null}
            stepIndex={0}
            totalSteps={1}
            onComplete={() => setDone(true)}
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
  body:  { background: '#fff', borderRadius: '12px 12px 0 0', minHeight: '70vh', overflow: 'hidden' },
  card:  { maxWidth: 440, margin: '0 auto', padding: '64px 24px', textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif' },
  chip:  { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  title: { fontSize: 20, fontWeight: 600, color: 'var(--tx)', margin: '8px 0' },
  sub:   { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55, margin: '0 0 24px' },
  row:   { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  btn:   { display: 'inline-block', background: 'var(--pkd)', color: '#fff', border: 'none', borderRadius: 24, padding: '16px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' },
  btnQuiet: { background: 'none', color: 'var(--pkd)', border: '1px solid var(--pkd)', borderRadius: 24, padding: '16px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}
