import { useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import Nav from '../../components/Nav'
import ConsoleLecturePlanner from './ConsoleLecturePlanner'
import ConsoleParticipation from './ConsoleParticipation'
import ClassRemote from './ClassRemote'

const MONO  = '"Space Mono", "Courier New", monospace'

// The one instructor surface per class: Plan (build the run of show),
// Run (drive it live — the former /remote, which now redirects here), and
// Review (participation). The projector Screen stays its own URL because it
// is a different physical machine, opened once and never touched.
//
// Default tab: Run, every device (Norm, 2026-09-09 — with term underway the
// console's job is running the lecture; planning is the occasional visit).
// ?tab= overrides — the /remote redirect arrives with ?tab=run, and
// ?tab=planning deep-links the planner.
export default function ClassConsole({ session }) {
  const classInfo = useOutletContext()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => {
    const q = params.get('tab')
    if (['planning', 'run', 'participation'].includes(q)) return q
    return 'run'
  })

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>
        {classInfo && (
          <>
            <div style={S.tabs}>
              <button style={S.tab(tab === 'planning')} onClick={() => setTab('planning')}>Plan</button>
              <button style={S.tab(tab === 'run')} onClick={() => setTab('run')}>Run</button>
              <button style={S.tab(tab === 'participation')} onClick={() => setTab('participation')}>Review</button>
            </div>
            {tab === 'planning' && <ConsoleLecturePlanner classInfo={classInfo} />}
            {tab === 'run' && <ClassRemote />}
            {tab === 'participation' && <ConsoleParticipation classInfo={classInfo} />}
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  wrap: { maxWidth: 820, margin: '0 auto', padding: '24px 16px 40px' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--bd)' },
  tab: (active) => ({
    padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
    fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
    color: active ? 'var(--pk)' : 'var(--tx3)',
    borderBottom: active ? '2px solid var(--pk)' : '2px solid transparent',
    marginBottom: -1,
  }),
}
