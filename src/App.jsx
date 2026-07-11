import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase, savePondWatchSession, saveEbbFlowSession } from './lib/supabase'
import Nav              from './components/Nav'
import AuraFilterDef     from './components/AuraFilterDef'
import AdminRoute        from './components/AdminRoute'
import ClassAdminRoute   from './components/ClassAdminRoute'
import LectureLoungeAdminRoute from './components/LectureLoungeAdminRoute'
import ErrorBoundary     from './components/ErrorBoundary'

// Route-level code-splitting: every page below is its own chunk, fetched on
// first navigation and cached by the browser after (Vite's content-hashed
// filenames make this safe). Landing stays a static import since it's the
// first paint for almost every visitor — no reason to add a Suspense flash
// to the one page nearly everyone hits. Everything else is lazy so a
// visitor to "/" never downloads the game library, the research admin
// section, or Lecture Lounge at all unless they navigate there.
import Landing from './pages/Landing'

const SessionEntry  = lazy(() => import('./pages/SessionEntry'))
const StudyJoin     = lazy(() => import('./pages/StudyJoin'))
const PlatformPage  = lazy(() => import('./pages/PlatformPage'))
const Login         = lazy(() => import('./pages/Login'))
const Signup        = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const GamesPage      = lazy(() => import('./pages/GamesPage'))
const ProfilePage    = lazy(() => import('./pages/ProfilePage'))
const AvatarEditor   = lazy(() => import('./components/Avatar/AvatarEditor'))
const Unsubscribe    = lazy(() => import('./pages/Unsubscribe'))
const ConsentPage    = lazy(() => import('./pages/ConsentPage'))

const PondWatch     = lazy(() => import('./games/PondWatch'))
const OwlBarn       = lazy(() => import('./games/OwlBarn'))
const EbbAndFlow    = lazy(() => import('./games/EbbAndFlow/EbbAndFlow'))
const FirstContact  = lazy(() => import('./games/FirstContact/FirstContact'))
const StillWater    = lazy(() => import('./games/StillWater/StillWater'))
const FaceRead      = lazy(() => import('./games/FaceRead/FaceRead'))
const Drift         = lazy(() => import('./games/Drift/Drift'))
const FarmJoy       = lazy(() => import('./games/FarmJoy/FarmJoy'))
const BreathBelt    = lazy(() => import('./games/BreathBelt/BreathBelt'))
const AptitudeSuite = lazy(() => import('./games/AptitudeSuite/AptitudeSuite'))
const WordMax       = lazy(() => import('./games/WordMax/WordMax'))
const ColorMax      = lazy(() => import('./games/ColorMax/ColorMax'))
const Ember         = lazy(() => import('./games/Ember/Ember'))
const Mirror        = lazy(() => import('./games/Mirror/Mirror'))
const BreathBeltDemo  = lazy(() => import('./games/BreathBelt/BreathBeltDemo'))
const PacerOpenerDemo = lazy(() => import('./games/BreathBelt/PacerOpenerDemo'))
const BreathLab        = lazy(() => import('./games/shared/breath/BreathLab'))

const VideoTest = lazy(() => import('./pages/dev/VideoTest'))
const AudioTest = lazy(() => import('./pages/dev/AudioTest'))
const Keynote   = lazy(() => import('./pages/keynote/Keynote'))

// Lecture Lounge — its own partition: separate chunk group from research
// admin and from the rest of the app, wrapped in its own error boundary
// below so a crash here can't blank the rest of the site.
const ClassRoom        = lazy(() => import('./classroom/ClassRoom'))
const ClassVerifyEmail = lazy(() => import('./classroom/ClassVerifyEmail'))
const ClassConsole     = lazy(() => import('./classroom/ClassConsole'))
const LectureLoungeAdminPage = lazy(() => import('./classroom/LectureLoungeAdminPage'))

// Research admin section — separate partition from Lecture Lounge.
const AdminLayout   = lazy(() => import('./layouts/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const SessionLibrary = lazy(() => import('./pages/admin/SessionLibrary'))
const SessionBuilder = lazy(() => import('./pages/admin/SessionBuilder'))
const StudyLibrary     = lazy(() => import('./pages/admin/StudyLibrary'))
const StudyDetail      = lazy(() => import('./pages/admin/StudyDetail'))
const StudyFormPage    = lazy(() => import('./pages/admin/StudyFormPage'))
const StudySessionRunner = lazy(() => import('./pages/admin/StudySessionRunner'))
const QuestionnairesPage   = lazy(() => import('./pages/admin/QuestionnairesPage'))
const QuestionnaireUpload  = lazy(() => import('./pages/admin/QuestionnaireUpload'))
const QuestionnairePreview = lazy(() => import('./pages/admin/QuestionnairePreview'))
const DataExportPage       = lazy(() => import('./pages/admin/DataExportPage'))
const CompensationPage     = lazy(() => import('./pages/admin/CompensationPage'))
const VideoLibrary         = lazy(() => import('./pages/admin/VideoLibrary'))
const VideoUpload          = lazy(() => import('./pages/admin/VideoUpload'))
const TrainingLibrary      = lazy(() => import('./pages/admin/TrainingLibrary'))
const TrainingUpload       = lazy(() => import('./pages/admin/TrainingUpload'))
const AudioAdmin    = lazy(() => import('./pages/admin/AudioAdmin'))
const AudioUpload   = lazy(() => import('./pages/admin/AudioUpload'))
const AdminGamesPage    = lazy(() => import('./pages/admin/GamesPage'))
const VasLibraryPage   = lazy(() => import('./pages/admin/VasLibraryPage'))
const VasUploadPage    = lazy(() => import('./pages/admin/VasUploadPage'))
const VasPackageBuilder = lazy(() => import('./pages/admin/VasPackageBuilder'))
const VasPreviewPage   = lazy(() => import('./pages/admin/VasPreviewPage'))
const SliderCreatePage      = lazy(() => import('./pages/admin/SliderCreatePage'))
const ScreenerLibraryPage  = lazy(() => import('./pages/admin/ScreenerLibraryPage'))
const ExperimentBuilder    = lazy(() => import('./pages/admin/ExperimentBuilder'))
const StudyBalancePage     = lazy(() => import('./pages/admin/StudyBalancePage'))
const DisplaysPage         = lazy(() => import('./pages/admin/DisplaysPage'))
const DisplayEditorPage    = lazy(() => import('./pages/admin/DisplayEditorPage'))

const LabLayout      = lazy(() => import('./layouts/LabLayout'))
const AboutPage      = lazy(() => import('./pages/lab/AboutPage'))
const PeoplePage     = lazy(() => import('./pages/lab/PeoplePage'))
const ResearchPage   = lazy(() => import('./pages/lab/ResearchPage'))
const PublicationsPage = lazy(() => import('./pages/lab/PublicationsPage'))
const ContactPage    = lazy(() => import('./pages/lab/ContactPage'))
const MediaPage      = lazy(() => import('./pages/lab/MediaPage'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// Blank themed background rather than a spinner — most chunks are small and
// load fast, especially on repeat visits once the browser has them cached.
function RouteFallback() {
  return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
}

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
  const [superAdmin,           setSuperAdmin]           = useState(undefined)
  const [hasAvatar,            setHasAvatar]            = useState(undefined)
  const [firstContactComplete, setFirstContactComplete] = useState(undefined)

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role, first_contact_complete, super_admin')
      .eq('id', userId)
      .single()
    setRole(data?.role ?? 'public')
    setFirstContactComplete(data?.first_contact_complete ?? false)
    setSuperAdmin(!!data?.super_admin)
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
      else   { setRole(null); setSuperAdmin(false); setHasAvatar(undefined) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      const sess = s ?? null
      setSession(sess)
      if (sess) { fetchRole(sess.user.id); checkAvatar(sess.user.id) }
      else      { setRole(null); setSuperAdmin(false); setHasAvatar(undefined); setFirstContactComplete(undefined) }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuraFilterDef />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/"         element={<Landing session={session} />} />
          <Route path="/platform" element={<PlatformPage session={session} />} />
          <Route path="/login"  element={<PublicOnlyRoute session={session} role={role}><Login /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute session={session} role={role}><Signup /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<PublicOnlyRoute session={session} role={role}><ForgotPassword /></PublicOnlyRoute>} />
          {/* No session/role guard — Supabase establishes a temporary recovery session when this link is followed from email */}
          <Route path="/reset-password" element={<ResetPassword />} />

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

          <Route path="/games/color-max" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <ColorMax session={session} />
            </ProtectedRoute>
          } />

          {/* Participant consent — auth required, no avatar guard */}
          <Route path="/study/:studyId/consent" element={
            <AuthRoute session={session}>
              <ConsentPage session={session} />
            </AuthRoute>
          } />

          {/* External participant enrollment (SONA / Prolific) — no auth guard */}
          <Route path="/study/join" element={<StudyJoin />} />

          {/* Standalone participant link — no nav or auth guard */}
          <Route path="/s/:token" element={<SessionEntry />} />

          {/* Dev-only test harness — component guards with import.meta.env.DEV */}
          <Route path="/dev/video-test" element={<VideoTest />} />
          <Route path="/dev/audio-test" element={<AudioTest />} />
          {/* Breath-signal instrumentation for biofeedback game dev; ?sim=1 for beltless */}
          <Route path="/dev/breath-lab" element={<BreathLab />} />

          {/* Conference demo — no auth, writes nothing; ?sim=1 for beltless rehearsal */}
          <Route path="/demo/breath-belt" element={<BreathBeltDemo />} />
          {/* Keynote opener — whole-room pacer, no device, no data */}
          <Route path="/demo/pacer-opener" element={<PacerOpenerDemo />} />
          {/* Ember — breath biofeedback campfire; ?sim=1 for beltless rehearsal */}
          <Route path="/demo/ember" element={<Ember />} />
          {/* Mirror — breath-driven avatar + materializing calibration; ?sim=1 beltless */}
          <Route path="/demo/mirror" element={<Mirror />} />
          {/* ISARP keynote deck — click-through, doubles as read-later resource */}
          <Route path="/keynote" element={<Keynote />} />

          {/*
            Lecture Lounge — its own partition. Own chunk group (all four
            components below are separately lazy-loaded), own error boundary
            (a crash here shows a scoped error screen instead of blanking the
            whole app), own admin route/layout entirely separate from
            research admin (LectureLoungeAdminRoute, not AdminRoute/AdminLayout).
          */}
          <Route element={<ErrorBoundary label="Lecture Lounge"><Outlet /></ErrorBoundary>}>
            <Route path="/class/verify" element={<ClassVerifyEmail />} />
            <Route path="/class/:slug" element={
              <AuthRoute session={session}>
                <ClassRoom session={session} />
              </AuthRoute>
            } />
            <Route element={<ClassAdminRoute session={session} />}>
              <Route path="/class/:slug/console" element={<ClassConsole session={session} />} />
            </Route>
            <Route element={<LectureLoungeAdminRoute session={session} role={role} superAdmin={superAdmin} />}>
              <Route path="/lecture-lounge/admin" element={<LectureLoungeAdminPage session={session} />} />
            </Route>
          </Route>

          {/* Unsubscribe — no auth or layout */}
          <Route path="/unsubscribe/:token" element={<Unsubscribe />} />

          {/* Admin section — role-gated */}
          <Route element={<AdminRoute session={session} role={role} superAdmin={superAdmin} />}>
            {/* Full-screen session runner — no admin chrome */}
            <Route path="/admin/studies/:id/session/:enrollmentId/:studySessionId" element={<StudySessionRunner />} />

            <Route element={<AdminLayout session={session} />}>
              <Route path="/admin"                  element={<AdminDashboard />} />
              <Route path="/admin/sessions"         element={<SessionLibrary />} />
              <Route path="/admin/sessions/new"     element={<SessionBuilder />} />
              <Route path="/admin/sessions/:id"     element={<SessionBuilder />} />
              <Route path="/admin/studies"               element={<StudyLibrary />} />
              <Route path="/admin/studies/new"           element={<StudyFormPage />} />
              <Route path="/admin/studies/:id/edit"      element={<StudyFormPage />} />
              <Route path="/admin/studies/:id/design"    element={<ExperimentBuilder />} />
              <Route path="/admin/studies/:id/balance"   element={<StudyBalancePage />} />
              <Route path="/admin/studies/:id"           element={<StudyDetail />} />
              <Route path="/admin/questionnaires"        element={<QuestionnairesPage />} />
              <Route path="/admin/questionnaires/new"    element={<QuestionnaireUpload />} />
              <Route path="/admin/questionnaires/:slug"  element={<QuestionnairePreview />} />
              <Route path="/admin/export"                element={<DataExportPage />} />
              <Route path="/admin/videos"               element={<VideoLibrary />} />
              <Route path="/admin/videos/new"           element={<VideoUpload />} />
              <Route path="/admin/audio"                element={<AudioAdmin />} />
              <Route path="/admin/audio/new"            element={<AudioUpload />} />
              <Route path="/admin/training"             element={<TrainingLibrary />} />
              <Route path="/admin/training/new"         element={<TrainingUpload />} />
              <Route path="/admin/compensation"         element={<CompensationPage />} />
              <Route path="/admin/games"               element={<AdminGamesPage />} />
              <Route path="/admin/vas"                 element={<VasLibraryPage />} />
              <Route path="/admin/vas/new"             element={<VasUploadPage />} />
              <Route path="/admin/vas/packages/new"    element={<VasPackageBuilder />} />
              <Route path="/admin/vas/:slug"           element={<VasPreviewPage />} />
              <Route path="/admin/sliders/new"         element={<SliderCreatePage />} />
              <Route path="/admin/displays"            element={<DisplaysPage />} />
              <Route path="/admin/displays/new"        element={<DisplayEditorPage />} />
              <Route path="/admin/displays/:id"        element={<DisplayEditorPage />} />
              <Route path="/admin/screeners"           element={<ScreenerLibraryPage />} />
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
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
