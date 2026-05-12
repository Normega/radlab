import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminRoute({ session }) {
  const [profile, setProfile] = useState(undefined)

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) { setProfile(null); return }
    supabase
      .from('profiles')
      .select('role, super_admin')
      .eq('id', userId)
      .single()
      .then(({ data }) => setProfile(data ?? null))
  }, [session?.user?.id])

  if (!session) return <Navigate to="/login" replace />
  if (profile === undefined) return null
  if (profile?.role !== 'lab' && !profile?.super_admin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
