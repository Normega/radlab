import { Navigate, Outlet } from 'react-router-dom'

// Super admin only — not lab role. Sharing decides who can read a transcript of
// Norm's actual work, so the console that makes that decision is his alone. Lab
// role is the wrong gate here for the same reason it is wrong in WorkbenchRoute:
// every student holds it.
//
// UX gate only. `workbench_shareable_members()` raises `forbidden` server-side
// and the share tables' RLS policies check is_super_admin() independently, so
// bypassing this component gets you a blank page and a 403, not access.
export default function WorkbenchAdminRoute({ session, superAdmin }) {
  if (session === undefined || superAdmin === undefined) return null // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (!superAdmin) return <Navigate to="/workbench" replace />
  return <Outlet />
}
