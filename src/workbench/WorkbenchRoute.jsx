import { Navigate, Outlet } from 'react-router-dom'

// Deliberately its own file rather than a reuse of AuthRoute — the Workbench is
// a separate partition (own chunk, own chrome, own ErrorBoundary), and the
// partitioning rule in CLAUDE.md asks for an independent guard even when the
// authorization check is identical.
//
// The check here is only "are you signed in", and that is not an oversight.
// `profiles.role = 'lab'` already grants /admin/*, so *every student in the lab
// holds it* — gating on role would let any of them read every shared session and
// would be security theatre. Visibility is decided by RLS against
// claude_session_shares / claude_project_shares, so a signed-in user who has been
// shared nothing simply sees an empty shelf. That is the correct outcome and it
// needs no guard.
export default function WorkbenchRoute({ session }) {
  if (session === undefined) return null // auth loading
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
