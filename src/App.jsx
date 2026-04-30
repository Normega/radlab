import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase, savePondWatchSession, saveEbbFlowSession } from './lib/supabase'

import Landing      from './pages/Landing'
import Login        from './pages/Login'
import Signup       from './pages/Signup'
import Dashboard    from './pages/Dashboard'
import GamesPage    from './pages/GamesPage'
import ProfilePage  from './pages/ProfilePage'
import Nav          from './components/Nav'
import PondWatch    from './games/PondWatch'
import AvatarEditor  from './components/Avatar/AvatarEditor'
import EbbAndFlow    from './games/EbbAndFlow/EbbAndFlow'
import FirstContact  from './games/FirstContact/FirstContact'
import AuraFilterDef from './components/AuraFilterDef'

const queryClient = new QueryClient()

function roleToPath(role) {
  if (role === 'lab')         return '/admin'
  if (role === 'participant') return '/study'
  return '/dashboard'
}

// Guards /games/ebb-flow: redirects to /games/first-contact when not yet complete.
// Renders nothing while firstContactComplete is still loading (undefined).
function EbbFlowGuard({ firstContactComplete, children }) {
  if (firstContactComplete === undefined) return null
  if (firstContactComplete === false)
    return <Navigate to="/games/first-contact?from=ebb-flow" replace />
  return children
}

// Requires auth + avatar. If no avatar row exists, redirects to /profile/avatar.
function ProtectedRoute({ session, hasAvatar, children }) {
  if (session === undefined) return null                          // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (hasAvatar === undefined) return null                       // avatar check in progress
  if (hasAvatar === false) return <Navigate to="/profile/avatar" replace />
  return children
}

// Requires auth only — used for /profile/avatar so the guard doesn't loop.
function AuthRoute({ session, children }) {
  if (session === undefined) return null
  if (!session) return <Navigate to="/login" replace />
  return children
}

function PublicOnlyRoute({ session, role, children }) {
  if (session === undefined || (session && role === undefined)) return null
  if (session) return <Navigate to={roleToPath(role)} replace />
  return children
}

export default function App() {
  const [session,              setSession]              = useState(undefined)
  const [role,                 setRole]                 = useState(undefined)
  const [hasAvatar,            setHasAvatar]            = useState(undefined)
  const [firstContactComplete, setFirstContactComplete] = useState(undefined)

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role, first_contact_complete')
      .eq('id', userId)
      .single()
    setRole(data?.role ?? 'public')
    setFirstContactComplete(data?.first_contact_complete ?? false)
  }

  async function checkAvatar(userId) {
    const { data } = await supabase.from('avatars').select('id').eq('user_id', userId).maybeSingle()
    setHasAvatar(!!data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session ?? null
      setSession(s)
      if (s) { fetchRole(s.user.id); checkAvatar(s.user.id) }
      else   { setRole(null); setHasAvatar(undefined) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      const sess = s ?? null
      setSession(sess)
      if (sess) { fetchRole(sess.user.id); checkAvatar(sess.user.id) }
      else      { setRole(null); setHasAvatar(undefined); setFirstContactComplete(undefined) }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuraFilterDef />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing session={session} />} />
          <Route path="/login"  element={<PublicOnlyRoute session={session} role={role}><Login /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute session={session} role={role}><Signup /></PublicOnlyRoute>} />

          <Route path="/dashboard" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <Dashboard session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <GamesPage session={session} firstContactComplete={firstContactComplete} />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <ProfilePage session={session} />
            </ProtectedRoute>
          } />

          {/* AuthRoute (no avatar guard) — this IS the onboarding screen */}
          <Route path="/profile/avatar" element={
            <AuthRoute session={session}>
              <AvatarEditor session={session} setHasAvatar={setHasAvatar} />
            </AuthRoute>
          } />

          <Route path="/games/pond-watch" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <Nav session={session} />
              <PondWatch userId={session?.user?.id} studyId={null} onSessionComplete={savePondWatchSession} />
            </ProtectedRoute>
          } />

          <Route path="/games/first-contact" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <FirstContact
                session={session}
                onComplete={() => setFirstContactComplete(true)}
              />
            </ProtectedRoute>
          } />

          <Route path="/games/ebb-flow" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <EbbFlowGuard firstContactComplete={firstContactComplete}>
                <EbbAndFlow session={session} onSessionComplete={saveEbbFlowSession} />
              </EbbFlowGuard>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
