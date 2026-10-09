import { Link, Outlet } from 'react-router-dom'

// Gate for lab-only planning pages (first: the teaching trial's launch
// tracker, Oct 2026). Lab members and admins only: role 'lab' /
// 'admin', or super admin. Like BreathEvidenceRoute and TalksRoute this is a UX
// gate, not cryptographic privacy (the page is client-side React in the public
// bundle), so it is for planning pages with no participant data. It shows a
// short panel rather than redirecting, because login does not return people to
// the page they asked for.
export default function LabOnlyRoute({ session, role, superAdmin, kicker = 'radlab.zone · lab' }) {
  if (session === undefined) return null
  if (!session) {
    return (
      <Panel kicker={kicker} title="Log in to see this page">
        This planning page is for the lab. Log in, then open this link again.
        <span style={S.actions}><Link to="/login" style={S.btn}>Log in</Link></span>
      </Panel>
    )
  }
  if (role === undefined) return null
  if (!(superAdmin || role === 'admin' || role === 'lab')) {
    return (
      <Panel kicker={kicker} title="This page is for the lab">
        Your account does not have access. Ask Norm if you need it, mentioning the email you log in with.
        <span style={S.actions}><Link to="/dashboard" style={S.ghost}>← radlab.zone</Link></span>
      </Panel>
    )
  }
  return <Outlet />
}

function Panel({ kicker, title, children }) {
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.kicker}>{kicker}</div>
        <h1 style={S.h1}>{title}</h1>
        <p style={S.p}>{children}</p>
      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, maxWidth: 480, width: '100%' },
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 28, margin: '8px 0', color: 'var(--tx)' },
  p: { fontSize: 16, lineHeight: 1.5, color: 'var(--tx2)', margin: 0 },
  actions: { display: 'block', marginTop: 16 },
  btn: { display: 'inline-block', background: 'var(--pkd)', color: 'var(--bgc)', borderRadius: 24, padding: '8px 24px', textDecoration: 'none', fontWeight: 600 },
  ghost: { display: 'inline-block', border: '1px solid var(--bds)', color: 'var(--pkd)', borderRadius: 24, padding: '8px 24px', textDecoration: 'none' },
}
