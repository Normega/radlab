import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LabLayout     from './layouts/LabLayout'
import AboutPage     from './pages/lab/AboutPage'
import PeoplePage    from './pages/lab/PeoplePage'
import ResearchPage  from './pages/lab/ResearchPage'
import PublicationsPage from './pages/lab/PublicationsPage'
import ContactPage   from './pages/lab/ContactPage'
import MediaPage     from './pages/lab/MediaPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
import { supabase, savePondWatchSession, saveEbbFlowSession } from './lib/supabase'

import Landing        from './pages/Landing'
import SessionEntry  from './pages/SessionEntry'
import PlatformPage from './pages/PlatformPage'
import Login        from './pages/Login'
import Signup       from './pages/Signup'
import Dashboard    from './pages/Dashboard'
import GamesPage    from './pages/GamesPage'
import ProfilePage  from './pages/ProfilePage'
import Nav          from './components/Nav'
import PondWatch    from './games/PondWatch'
import OwlBarn      from './games/OwlBarn'
import AvatarEditor  from './components/Avatar/AvatarEditor'
import EbbAndFlow    from './games/EbbAndFlow/EbbAndFlow'
import FirstContact  from './games/FirstContact/FirstContact'
import AuraFilterDef from './components/AuraFilterDef'
import StillWater   from './games/StillWater/StillWater'
import FaceRead     from './games/FaceRead/FaceRead'
import Drift        from './games/Drift/Drift'
import FarmJoy      from './games/FarmJoy/FarmJoy'
import BreathBelt   from './games/BreathBelt/BreathBelt'
import AptitudeSuite          from './games/AptitudeSuite/AptitudeSuite'
import WordMax                from './games/WordMax/WordMax'
import AdminRoute    from './components/AdminRoute'
import AdminLayout   from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import SessionLibrary from './pages/admin/SessionLibrary'
import SessionBuilder from './pages/admin/SessionBuilder'
import StudyLibrary     from './pages/admin/StudyLibrary'
import StudyDetail      from './pages/admin/StudyDetail'
import StudyFormPage    from './pages/admin/StudyFormPage'
import StudySessionRunner from './pages/admin/StudySessionRunner'
import QuestionnairesPage   from './pages/admin/QuestionnairesPage'
import QuestionnaireUpload  from './pages/admin/QuestionnaireUpload'
import QuestionnairePreview from './pages/admin/QuestionnairePreview'
import DataExportPage       from './pages/admin/DataExportPage'
import CompensationPage     from './pages/admin/CompensationPage'
import VideoLibrary         from './pages/admin/VideoLibrary'
import VideoUpload          from './pages/admin/VideoUpload'
import TrainingLibrary      from './pages/admin/TrainingLibrary'
import TrainingUpload       from './pages/admin/TrainingUpload'
import Unsubscribe   from './pages/Unsubscribe'
import ConsentPage   from './pages/ConsentPage'
import VideoTest     from './pages/dev/VideoTest'
import AudioAdmin    from './pages/admin/AudioAdmin'
import AudioTest     from './pages/dev/AudioTest'

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
        <ScrollToTop />
        <Routes>
          <Route path="/"         element={<Landing session={session} />} />
          <Route path="/platform" element={<PlatformPage session={session} />} />
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

          <Route path="/games/owl-barn" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <Nav session={session} />
              <OwlBarn userId={session?.user?.id} studyId={null} />
            </ProtectedRoute>
          } />

          <Route path="/games/still-water" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <StillWater session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/face-read" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <FaceRead session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/drift" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <Drift session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/farm-joy" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <FarmJoy session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/breath-belt" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <BreathBelt />
            </ProtectedRoute>
          } />

          <Route path="/games/aptitude-suite" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <AptitudeSuite session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/word-max" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <WordMax />
            </ProtectedRoute>
          } />

          {/* Participant consent — auth required, no avatar guard */}
          <Route path="/study/:studyId/consent" element={
            <AuthRoute session={session}>
              <ConsentPage session={session} />
            </AuthRoute>
          } />

          {/* Standalone participant link — no nav or auth guard */}
          <Route path="/s/:token" element={<SessionEntry />} />

          {/* Dev-only test harness — component guards with import.meta.env.DEV */}
          <Route path="/dev/video-test" element={<VideoTest />} />
          <Route path="/dev/audio-test" element={<AudioTest />} />

          {/* Unsubscribe — no auth or layout */}
          <Route path="/unsubscribe/:token" element={<Unsubscribe />} />

          {/* Admin section — role-gated */}
          <Route element={<AdminRoute session={session} />}>
            {/* Full-screen session runner — no admin chrome */}
            <Route path="/admin/studies/:id/session/:enrollmentId/:studySessionId" element={<StudySessionRunner />} />

            <Route element={<AdminLayout session={session} />}>
              <Route path="/admin"                  element={<AdminDashboard />} />
              <Route path="/admin/sessions"         element={<SessionLibrary />} />
              <Route path="/admin/sessions/new"     element={<SessionBuilder />} />
              <Route path="/admin/sessions/:id"     element={<SessionBuilder />} />
              <Route path="/admin/studies"          element={<StudyLibrary />} />
              <Route path="/admin/studies/new"      element={<StudyFormPage />} />
              <Route path="/admin/studies/:id/edit" element={<StudyFormPage />} />
              <Route path="/admin/studies/:id"      element={<StudyDetail />} />
              <Route path="/admin/questionnaires"        element={<QuestionnairesPage />} />
              <Route path="/admin/questionnaires/new"    element={<QuestionnaireUpload />} />
              <Route path="/admin/questionnaires/:slug"  element={<QuestionnairePreview />} />
              <Route path="/admin/export"                element={<DataExportPage />} />
              <Route path="/admin/videos"               element={<VideoLibrary />} />
              <Route path="/admin/videos/new"           element={<VideoUpload />} />
              <Route path="/admin/audio"                element={<AudioAdmin />} />
              <Route path="/admin/training"             element={<TrainingLibrary />} />
              <Route path="/admin/training/new"         element={<TrainingUpload />} />
              <Route path="/admin/compensation"         element={<CompensationPage />} />
            </Route>
          </Route>

          {/* Lab section — public */}
          <Route element={<LabLayout />}>
            <Route path="/lab" element={<Navigate to="/lab/about" replace />} />
            <Route path="/lab/about"        element={<AboutPage />} />
            <Route path="/lab/people"       element={<PeoplePage />} />
            <Route path="/lab/research"     element={<ResearchPage />} />
            <Route path="/lab/publications" element={<PublicationsPage />} />
            <Route path="/lab/media"        element={<MediaPage />} />
            <Route path="/lab/contact"      element={<ContactPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
