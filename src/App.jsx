import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase, savePondWatchSession } from './lib/supabase'

import Landing   from './pages/Landing'
import Login     from './pages/Login'
import Signup    from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Nav       from './components/Nav'
import PondWatch from './games/PondWatch'

const queryClient = new QueryClient()

function roleToPath(role) {
  if (role === 'lab')         return '/admin'
  if (role === 'participant') return '/study'
  return '/dashboard'
}

function ProtectedRoute({ session, children }) {
  if (session === undefined) return null // still loading
  if (!session) return <Navigate to="/login" replace />
  return children
}

function PublicOnlyRoute({ session, role, children }) {
  if (session === undefined || (session && role === undefined)) return null // loading
  if (session) return <Navigate to={roleToPath(role)} replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [role,    setRole]    = useState(undefined)

  async function fetchRole(userId) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
    setRole(data?.role ?? 'public')
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session ?? null
      setSession(s)
      if (s) fetchRole(s.user.id)
      else   setRole(null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      const sess = s ?? null
      setSession(sess)
      if (sess) fetchRole(sess.user.id)
      else      setRole(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing session={session} />} />
          <Route path="/login"  element={<PublicOnlyRoute session={session} role={role}><Login /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute session={session} role={role}><Signup /></PublicOnlyRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute session={session}><Dashboard session={session} /></ProtectedRoute>} />
          <Route path="/games/pond-watch" element={
            <ProtectedRoute session={session}>
              <Nav session={session} />
              <PondWatch userId={session?.user?.id} studyId={null} onSessionComplete={savePondWatchSession} />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
