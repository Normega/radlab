import { Navigate, Outlet } from 'react-router-dom'

// Super admin only (profiles.is_super_admin, read in App.jsx's session
// bootstrap). For design and staff tooling that is Norm's alone -- currently
// the component kit at /dev/ui-kit, which /brand points to as the live
// reference for every shared primitive.
//
// UX gate only. Nothing behind it reads or writes data: the kit renders
// components with sample props. Anything that does must enforce
// is_super_admin() server-side as well, as WorkbenchAdminRoute's pages do.
export default function SuperAdminRoute({ session, superAdmin }) {
  if (session === undefined || superAdmin === undefined) return null // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (!superAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
