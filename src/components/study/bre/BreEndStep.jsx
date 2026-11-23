import { useEffect, useMemo, useRef } from 'react'
import { createBreWriter } from './breLog'
import { TEXT } from './breScript'
import { MARKERS, sessionMarkerBus } from '../../../lib/physioMarkers'
import { createSubmitLock } from '../../../lib/useSubmitLock'

/**
 * Screen 12, end of tasks (plan §4 step 16). Verbatim text, the study code large enough for the RA to
 * read across the room (for naming the AcqKnowledge file), and end marker 255 when it appears.
 */
export default function BreEndStep({ enrollment, scheduleId, supabaseClient, onComplete, isSimMode = false }) {
  const writer = useMemo(() => isSimMode ? null : createBreWriter({
    db: supabaseClient, userId: enrollment?.profile_id, studyId: enrollment?.study_id, scheduleId, step: 'bre_end',
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const lock = useRef(createSubmitLock())

  useEffect(() => {
    if (!writer) return
    sessionMarkerBus().send(MARKERS.task_end, 'task_end').then(entry => {
      writer.event('task_end', { tMs: entry.requestedAt, marker: entry })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={S.wrap}>
      <p style={S.text}>{TEXT.screen12}</p>
      <p style={S.codeLabel}>Study code</p>
      <p style={S.code}>{enrollment?.study_code ?? '—'}</p>
      <button style={S.btn} onClick={() => lock.current.run(async () => {
        if (writer) { writer.event('end_confirmed'); await writer.drain() }
        try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* not fullscreen */ }
        onComplete({})
      })}>Finish</button>
    </div>
  )
}

const FONT = '"DM Sans",system-ui,sans-serif'
const S = {
  wrap:      { minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 16px', fontFamily: FONT },
  text:      { maxWidth: 640, fontSize: 20, lineHeight: 1.6, color: 'var(--tx)', textAlign: 'center', margin: 0 },
  codeLabel: { fontSize: 14, color: 'var(--tx2)', margin: '24px 0 0' },
  code:      { fontSize: 36, fontWeight: 700, letterSpacing: 4, fontFamily: 'ui-monospace,monospace', color: 'var(--tx)', margin: 0 },
  btn:       { marginTop: 24, padding: '8px 32px', borderRadius: 24, border: '1px solid var(--pk)', background: '#fff', color: 'var(--pkd)', fontSize: 16, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' },
}
