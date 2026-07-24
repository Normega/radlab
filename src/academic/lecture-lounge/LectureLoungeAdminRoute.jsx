import { Navigate, Outlet } from 'react-router-dom'

// Deliberately independent of AdminRoute/AdminLayout — Lecture Lounge admin
// is a separate partition from research admin (own bundle chunk, own route,
// own layout) so a problem in one can't take down the other. The
// authorization rule is the same (lab role or super_admin) but the code
// path shares nothing beyond that check.
export default function LectureLoungeAdminRoute({ session, role, superAdmin }) {
  if (session === undefined || role === undefined) return null // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (role !== 'lab' && !superAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
