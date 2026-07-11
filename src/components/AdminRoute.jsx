import { Navigate, Outlet } from 'react-router-dom'

// role/superAdmin are already fetched once in App.jsx the moment the session
// resolves (fetchRole) — reusing them here instead of re-querying profiles
// removes a redundant round-trip on every cold /admin/* load. This is a UX
// gate only; the real enforcement is server-side RLS (my_role()/is_super_admin()),
// which is re-evaluated fresh on every actual query regardless of what this
// component renders.
export default function AdminRoute({ session, role, superAdmin }) {
  if (session === undefined) return null          // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (role === undefined) return null             // profile loading
  if (role !== 'lab' && !superAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
