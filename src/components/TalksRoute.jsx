import { Navigate, Outlet } from 'react-router-dom'

// Gate for the private Talks hub (/talks) and the slide decks it lists.
// Currently superAdmin-only — the intended audience is just the PI presenting.
//
// This is a UX gate only: the decks are client-side React in the public bundle,
// so this hides them from the UI and redirects strangers, but it is NOT
// cryptographic privacy. That's the right tradeoff for a talks hub of
// methods-only, no-participant-data slideshows.
//
// role/superAdmin are already fetched once in App.jsx (fetchRole) when the
// session resolves, so this reuses them with no extra round-trip.
//
// To widen access to lab admins later, change the last check to:
//   if (role !== 'lab' && !superAdmin) return <Navigate to="/dashboard" replace />
// (identical to AdminRoute). `role` is already passed in for exactly this.
export default function TalksRoute({ session, role, superAdmin }) {
  if (session === undefined) return null          // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (role === undefined) return null             // profile/role loading
  if (!superAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
