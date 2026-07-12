import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Nav from '../components/Nav'
import ConsoleLecturePlanner from './ConsoleLecturePlanner'
import ConsoleParticipation from './ConsoleParticipation'

const MONO  = '"Space Mono", "Courier New", monospace'

// Desktop planning surface. classInfo comes from ClassAdminRoute's Outlet
// context — it already resolved the class to run the admin check, so
// there's no reason to fetch it a second time here.
export default function ClassConsole({ session }) {
  const classInfo = useOutletContext()
  const [tab, setTab] = useState('planning')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>
        {classInfo && (
          <>
            <div style={S.tabs}>
              <button style={S.tab(tab === 'planning')} onClick={() => setTab('planning')}>Planning</button>
              <button style={S.tab(tab === 'participation')} onClick={() => setTab('participation')}>Participation</button>
            </div>
            {tab === 'planning'
              ? <ConsoleLecturePlanner classInfo={classInfo} />
              : <ConsoleParticipation classInfo={classInfo} />}
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  wrap: { maxWidth: 820, margin: '0 auto', padding: '40px 24px' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--bd)' },
  tab: (active) => ({
    padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
    fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
    color: active ? 'var(--pk)' : 'var(--tx3)',
    borderBottom: active ? '2px solid var(--pk)' : '2px solid transparent',
    marginBottom: -1,
  }),
}
