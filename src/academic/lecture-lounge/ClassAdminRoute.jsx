import { useEffect, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeCourseCode, loungePath } from '../courseRoutes'

// Per-class admin gate for /academic/:courseCode/lounge/{console,remote,
// screen,slides}. The URL carries the course code, which by convention IS the
// class slug (classes.slug === lowercase(courses.code)).
// Mirrors AdminRoute's shape but authorization is scoped to one class (a
// class_admins row), plus the super admin — matching the "classes: admins
// update" RLS policy this gate reflects at the UI layer.
//
// profiles.role='lab' used to pass here too. It is RADlab RESEARCH staff, not
// course staff, and admitting it made every research assistant an admin of
// every class — including one who was an enrolled student in one of them
// (2026-09-10). Course staff live in class_admins; 'lab' means nothing here.
//
// Resolves class + profile in parallel (the profile doesn't depend on the
// class at all), and only makes the class_admins round trip when the caller
// isn't already a super admin — for that case this settles in
// one round trip instead of two sequential ones. The resolved class is
// passed down via Outlet context so console/remote/screen don't each repeat
// the same "class by slug" fetch this route already did.
export default function ClassAdminRoute({ session }) {
  const { courseCode, slug: slugParam } = useParams()
  const slug = normalizeCourseCode(courseCode ?? slugParam)
  const [state, setState] = useState({ status: 'loading', cls: null })

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    let cancelled = false

    async function load() {
      const [clsRes, profileRes] = await Promise.all([
        supabase.from('classes').select('id, name, slug').eq('slug', slug).maybeSingle(),
        supabase.from('profiles').select('role, super_admin').eq('id', userId).single(),
      ])
      if (cancelled) return
      const cls = clsRes.data
      if (!cls) { setState({ status: 'not_found', cls: null }); return }

      if (profileRes.data?.super_admin) {
        setState({ status: 'authorized', cls })
        return
      }

      const { data: adminRow } = await supabase
        .from('class_admins').select('id').eq('class_id', cls.id).eq('user_id', userId).maybeSingle()
      if (cancelled) return
      setState({ status: adminRow ? 'authorized' : 'forbidden', cls })
    }
    load()
    return () => { cancelled = true }
  }, [slug, session?.user?.id])

  if (session === undefined) return null          // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (state.status === 'loading') return null
  if (state.status === 'not_found') return <Navigate to="/dashboard" replace />
  if (state.status === 'forbidden') return <Navigate to={loungePath(slug)} replace />
  return <Outlet context={state.cls} />
}
