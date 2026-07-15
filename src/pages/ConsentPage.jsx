import { useSearchParams, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import ConsentGate from '../components/study/ConsentGate'

// ── ConsentPage ───────────────────────────────────────────────────────────────
// Route: /study/:studyId/consent?returnTo=<encoded-path>
//
// Thin route wrapper around ConsentGate for authenticated global-session
// visits — admin "preview consent form" links (StudyDetail.jsx) and a lab
// account re-visiting directly. The real daily-session participant path
// (SessionEntry.jsx's `needs_consent` step) renders ConsentGate inline
// instead, using its own isolated participant client — see ConsentGate.jsx
// for why that split exists.

export default function ConsentPage({ session }) {
  const { studyId }    = useParams()
  const [searchParams] = useSearchParams()
  const returnTo       = searchParams.get('returnTo') || '/dashboard'
  const navigate        = useNavigate()

  if (!session) return null // AuthRoute already guards this; defensive only

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <ConsentGate
        studyId={studyId}
        participantId={session.user.id}
        supabaseClient={supabase}
        onComplete={() => navigate(returnTo, { replace: true })}
      />
    </div>
  )
}
