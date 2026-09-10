import { Navigate, Outlet } from 'react-router-dom'

// Deliberately independent of AdminRoute/AdminLayout — Lecture Lounge admin
// is a separate partition from research admin (own bundle chunk, own route,
// own layout) so a problem in one can't take down the other. It no longer
// shares research admin's rule either: this page lists, creates, renames and
// DELETES every class and appoints its instructors, which is across-the-board
// work, so the super admin alone reaches it.
//
// It used to admit profiles.role='lab' as well. 'lab' is RADlab RESEARCH
// staff — studies, participants, exports — and reusing it here made every
// research assistant an admin of every course (2026-09-10). Per-course staff
// belong in class_admins and enter through ClassAdminRoute instead.
export default function LectureLoungeAdminRoute({ session, superAdmin }) {
  if (session === undefined || superAdmin === undefined) return null // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (!superAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
