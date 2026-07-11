import { useOutletContext } from 'react-router-dom'
import Nav from '../components/Nav'
import ConsoleLecturePlanner from './ConsoleLecturePlanner'

// Desktop planning surface — lecture/check-in authoring only. Live controls
// (open/close/results) live on the remote (WP3b), not here. classInfo comes
// from ClassAdminRoute's Outlet context — it already resolved the class to
// run the admin check, so there's no reason to fetch it a second time here.
export default function ClassConsole({ session }) {
  const classInfo = useOutletContext()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>
        {classInfo && <ConsoleLecturePlanner classInfo={classInfo} />}
      </div>
    </div>
  )
}

const S = {
  wrap: { maxWidth: 820, margin: '0 auto', padding: '40px 24px' },
}
