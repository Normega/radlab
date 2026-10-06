import { Link, Outlet } from 'react-router-dom'

// Gate for /breathevidence, the BCAT-DDM planning page shared with a student.
//
// Who can see it: lab members and admins (role 'lab' / 'admin', or super admin), plus the
// accounts listed in GUESTS. Guests are listed by account id, not given role 'lab', because
// 'lab' also opens /admin and participant data. To share with someone else, add their
// profiles.id here with a comment saying who it is.
//
// Like TalksRoute this is a UX gate, not cryptographic privacy: the page is client-side React
// in the public bundle. Right for a planning page with no participant data.
//
// Unlike TalksRoute it shows a short panel instead of redirecting: login does not return people
// to the page they asked for, so a bare redirect would strand a guest on the dashboard.
const GUESTS = new Set([
  '0b288dbb-3426-4995-8db8-190364783d17',   // Nansi Hassoun (UofT account)
  'a110fc78-560c-451f-a35c-393a6b365f78',   // Nansi Hassoun (personal account)
])

export default function BreathEvidenceRoute({ session, role, superAdmin }) {
  if (session === undefined) return null
  if (!session) {
    return (
      <Panel title="Log in to see this page">
        This planning page is shared with the lab. Log in, then open this link again.
        <div style={S.actions}><Link to="/login" style={S.btn}>Log in</Link></div>
      </Panel>
    )
  }
  if (role === undefined) return null
  const allowed = superAdmin || role === 'admin' || role === 'lab' || GUESTS.has(session.user?.id)
  if (!allowed) {
    return (
      <Panel title="This page is shared with specific people">
        Your account does not have access yet. Ask Norm to add you, mentioning the email you log in with.
        <div style={S.actions}><Link to="/dashboard" style={S.ghost}>← radlab.zone</Link></div>
      </Panel>
    )
  }
  return <Outlet />
}

function Panel({ title, children }) {
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.kicker}>BCAT-DDM · planning</div>
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
  actions: { marginTop: 16 },
  btn: { display: 'inline-block', background: 'var(--pkd)', color: 'var(--bgc)', borderRadius: 24, padding: '8px 24px', textDecoration: 'none', fontWeight: 600 },
  ghost: { display: 'inline-block', border: '1px solid var(--bds)', color: 'var(--pkd)', borderRadius: 24, padding: '8px 24px', textDecoration: 'none' },
}
