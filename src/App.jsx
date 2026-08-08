import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase, savePondWatchSession, saveEbbFlowSession } from './lib/supabase'
import Nav              from './components/Nav'
import AuraFilterDef     from './components/AuraFilterDef'
import AdminRoute        from './components/AdminRoute'
import TalksRoute        from './components/TalksRoute'
import ClassAdminRoute   from './academic/lecture-lounge/ClassAdminRoute'
import LectureLoungeAdminRoute from './academic/lecture-lounge/LectureLoungeAdminRoute'
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
const BrandAssets   = lazy(() => import('./pages/BrandAssets'))
const StudyJoin     = lazy(() => import('./pages/StudyJoin'))
const PlatformPage  = lazy(() => import('./pages/PlatformPage'))
const Login         = lazy(() => import('./pages/Login'))
const Signup        = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const GamesPage      = lazy(() => import('./pages/GamesPage'))
const ProfilePage    = lazy(() => import('./pages/ProfilePage'))
const MyRipplePage   = lazy(() => import('./pages/MyRipplePage'))
const SettingsPage   = lazy(() => import('./pages/SettingsPage'))
const AvatarEditor   = lazy(() => import('./components/Avatar/AvatarEditor'))
const Unsubscribe    = lazy(() => import('./pages/Unsubscribe'))
const Withdraw       = lazy(() => import('./pages/Withdraw'))
const ConsentPage    = lazy(() => import('./pages/ConsentPage'))
const Verified       = lazy(() => import('./pages/Verified'))

// Ripple — public-tier onboarding/login concierge (docs/markdowns/ripple_spec.md).
// Its own partition like Lecture Lounge: separate chunk, own error boundary below.
const WelcomeFlow      = lazy(() => import('./ripple/WelcomeFlow'))
const RippleName       = lazy(() => import('./ripple/RippleName'))
const CheckinFlow      = lazy(() => import('./ripple/CheckinFlow'))

const PondWatch     = lazy(() => import('./games/PondWatch'))
const OwlBarn       = lazy(() => import('./games/OwlBarn'))
const EbbAndFlow    = lazy(() => import('./games/EbbAndFlow/EbbAndFlow'))
const FirstContact  = lazy(() => import('./games/FirstContact/FirstContact'))
const StillWater    = lazy(() => import('./games/StillWater/StillWater'))
const FaceRead      = lazy(() => import('./games/FaceRead/FaceRead'))
const Drift         = lazy(() => import('./games/Drift/Drift'))
const Delve         = lazy(() => import('./games/Delve/Delve'))
const Tune          = lazy(() => import('./games/Tune/Tune'))
const Alongside     = lazy(() => import('./games/Alongside/Alongside'))
const FarmJoy       = lazy(() => import('./games/FarmJoy/FarmJoy'))
const BreathBelt    = lazy(() => import('./games/BreathBelt/BreathBelt'))
const BreathGuardian = lazy(() => import('./games/BreathGuardian/BreathGuardian'))
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
const UiKit     = lazy(() => import('./pages/dev/UiKit'))
const OnboardingPreview = lazy(() => import('./pages/dev/OnboardingPreview'))
const InsightsPreview   = lazy(() => import('./pages/dev/InsightsPreview'))
const BodyDiagramPreview = lazy(() => import('./pages/dev/BodyDiagramPreview'))
const AlongsidePreview  = lazy(() => import('./pages/dev/AlongsidePreview'))
const Keynote   = lazy(() => import('./pages/keynote/Keynote'))
const ToniJuly2026 = lazy(() => import('./pages/toni-july-2026/ToniJuly2026'))
const Talks     = lazy(() => import('./pages/talks/Talks'))

// Academic partition (src/academic/) — Lecture Lounge lives here, the Field
// Guide ingest portal joins it. Separate chunk group from research admin and
// from the rest of the app, wrapped in its own error boundary below so a
// crash here can't blank the rest of the site.
const ClassRoom        = lazy(() => import('./academic/lecture-lounge/ClassRoom'))
const ClassVerifyEmail = lazy(() => import('./academic/lecture-lounge/ClassVerifyEmail'))
const ClassConsole     = lazy(() => import('./academic/lecture-lounge/ClassConsole'))
const ClassRemote      = lazy(() => import('./academic/lecture-lounge/ClassRemote'))
const ClassScreen      = lazy(() => import('./academic/lecture-lounge/ClassScreen'))
const LectureLoungeAdminPage = lazy(() => import('./academic/lecture-lounge/LectureLoungeAdminPage'))
const AcademicHome         = lazy(() => import('./academic/AcademicHome'))
// Field Guide auths against the separate radlab-academic Supabase project;
// its guard carries that login flow, so it's lazy like the pages (unlike the
// small static guards above).
const FieldGuideStaffRoute = lazy(() => import('./academic/fieldguide/FieldGuideStaffRoute'))
const IngestPortal         = lazy(() => import('./academic/fieldguide/IngestPortal'))
const ReviewQueue          = lazy(() => import('./academic/fieldguide/ReviewQueue'))
const SubmissionsQueue     = lazy(() => import('./academic/fieldguide/SubmissionsQueue'))
// The wiki reader takes any active enrollment, not just staff — students read
// through the same components, and RLS decides what comes back.
const FieldGuideMemberRoute = lazy(() => import('./academic/fieldguide/FieldGuideMemberRoute'))
const WikiIndex            = lazy(() => import('./academic/fieldguide/wiki/WikiIndex'))
const WikiPage             = lazy(() => import('./academic/fieldguide/wiki/WikiPage'))
const GapBrowser           = lazy(() => import('./academic/fieldguide/GapBrowser'))
const FieldGuideHome       = lazy(() => import('./academic/fieldguide/FieldGuideHome'))

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
const AdvancedInstrumentPreview = lazy(() => import('./pages/admin/AdvancedInstrumentPreview'))
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
const LilianaCreditPage    = lazy(() => import('./pages/admin/LilianaCreditPage'))
const DisplaysPage         = lazy(() => import('./pages/admin/DisplaysPage'))
const DisplayEditorPage    = lazy(() => import('./pages/admin/DisplayEditorPage'))
const UserAdminPage        = lazy(() => import('./pages/admin/UserAdminPage'))
const Diagnostics          = lazy(() => import('./pages/admin/Diagnostics'))

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

// Guards a game that unlocks only once its prerequisite has been played, and
// bounces to the prerequisite with `?from=<this game's route slug>` so that
// game can explain why the user landed there.
//
// `unlocked` is tri-state: undefined while the profile read is in flight, and
// we render nothing rather than bounce — redirecting on a not-yet-loaded value
// would throw out a user who has in fact unlocked the game.
//
// The gates here mirror `unlock` in src/data/games.js, which drives the padlock
// on the games page. Change one, change the other.
function UnlockGuard({ unlocked, to, from, children }) {
  if (unlocked === undefined) return null
  if (unlocked === false) return <Navigate to={`${to}?from=${from}`} replace />
  return children
}

// Requires auth + onboarding + avatar. New public users (no consent/demographics
// on record and no avatar yet) are routed through /welcome first (Ripple WP1);
// existing users with an avatar keep the old /profile/avatar path until the
// WP2 migration beat lands.
function ProtectedRoute({ session, hasAvatar, needsWelcome, needsRippleName, children }) {
  if (session === undefined) return null                          // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (needsWelcome === undefined) return null                    // role/onboarding check in progress
  if (needsWelcome) return <Navigate to="/welcome" replace />
  if (hasAvatar === undefined) return null                       // avatar check in progress
  if (hasAvatar === false) return <Navigate to="/profile/avatar" replace />
  if (needsRippleName === undefined) return null                 // ripple name check in progress
  if (needsRippleName) return <Navigate to="/ripple/name" replace />
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
  const [stillWaterPlayed,     setStillWaterPlayed]     = useState(undefined)
  const [onboardingComplete,   setOnboardingComplete]   = useState(undefined)
  const [rippleNamed,          setRippleNamed]          = useState(undefined)

  async function checkRippleName(userId) {
    const { data } = await supabase.from('ripples').select('name').eq('user_id', userId).maybeSingle()
    setRippleNamed(!!(data?.name))
  }

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role, first_contact_complete, super_admin, onboarding_complete, still_water_sessions')
      .eq('id', userId)
      .single()
    const r  = data?.role ?? 'public'
    const oc = data?.onboarding_complete ?? false
    setRole(r)
    setFirstContactComplete(data?.first_contact_complete ?? false)
    setStillWaterPlayed((data?.still_water_sessions ?? 0) > 0)
    setSuperAdmin(!!data?.super_admin)
    setOnboardingComplete(oc)
    // Checked for ALL public users, not just onboarded ones (2026-07-30): the name
    // is what distinguishes a user part-way through the current /welcome flow from
    // a legacy user who predates it — see needsWelcome.
    if (r === 'public') checkRippleName(userId)
    else setRippleNamed(true)
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
      else   { setRole(null); setSuperAdmin(false); setHasAvatar(undefined); setFirstContactComplete(undefined); setStillWaterPlayed(undefined); setOnboardingComplete(undefined); setRippleNamed(undefined) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      const sess = s ?? null
      setSession(sess)
      if (sess) { fetchRole(sess.user.id); checkAvatar(sess.user.id) }
      else      { setRole(null); setSuperAdmin(false); setHasAvatar(undefined); setFirstContactComplete(undefined); setStillWaterPlayed(undefined); setOnboardingComplete(undefined); setRippleNamed(undefined) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Ripple onboarding guards:
  //   needsWelcome    — public user who hasn't finished /welcome → /welcome (full flow)
  //   needsRippleName — existing public user, onboarded but no Ripple name yet → /ripple/name (migration beat)
  //
  // "Hasn't finished" cannot be read off the avatar row alone. Until 2026-07-30 it
  // could: the avatar was written on the LAST content step, so no-avatar ≈ not-done.
  // The Ripple-first reorder moved that write to the consent step, which silently
  // opened the exit — a user who agreed and then clicked any link in the global Nav
  // passed this guard with demographics and reminders never collected, and
  // onboarding_complete still false. Caught 2026-07-30 walking the new flow live.
  //
  // So the two states are told apart by the Ripple's NAME, written in the same
  // transaction as the avatar by WelcomeFlow's persistRipple():
  //   no avatar                  → brand-new user, hasn't started  → /welcome
  //   avatar + name, not complete→ part-way through the new flow   → /welcome (resumes)
  //   avatar, NO name, not complete → legacy user predating the flow → left alone
  const needsWelcome =
    (role === undefined || onboardingComplete === undefined || hasAvatar === undefined || rippleNamed === undefined)
      ? undefined
      : role === 'public' && onboardingComplete === false && (hasAvatar === false || rippleNamed === true)

  const needsRippleName =
    (role === undefined || onboardingComplete === undefined || rippleNamed === undefined)
      ? undefined
      : role === 'public' && onboardingComplete === true && rippleNamed === false

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
          {/* Email confirmation landing — no guard; Supabase sets the session from the URL hash on arrival */}
          <Route path="/verified" element={<Verified session={session} />} />

          <Route path="/dashboard" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <Dashboard session={session} />
            </ProtectedRoute>
          } />

          {/*
            Public, read-only for guests (revised Games Page, Figma 4047:3653):
            the catalogue is browsable logged-out, but every card routes to
            /signup rather than into the game. Logged-in users get the check-in
            reminder and the unlock gates. Deliberately NOT wrapped in
            ProtectedRoute — a guest landing here is the designed state.
          */}
          <Route path="/games" element={<GamesPage session={session} />} />

          {/*
            The three destinations of the header's avatar menu (2026-07-30 IA
            rework): /ripple = the Ripple itself, /profile = who you are and
            what you've earned, /settings = prompts, reminders, password,
            deletion. /ripple is distinct from the /ripple/name migration beat
            below, which is an onboarding step, not a destination.
          */}
          <Route path="/ripple" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <MyRipplePage session={session} />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <ProfilePage session={session} />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <SettingsPage session={session} />
            </ProtectedRoute>
          } />

          {/*
            Ripple — public-tier onboarding/login concierge. Own partition per
            the Lecture Lounge precedent: own lazy chunk, own error boundary so
            a crash here can never block login or the dashboard.
            AuthRoute only — this flow runs BEFORE the avatar guard is satisfied.
          */}
          <Route element={<ErrorBoundary label="Ripple"><Outlet /></ErrorBoundary>}>
            <Route path="/welcome" element={
              <AuthRoute session={session}>
                <WelcomeFlow session={session} onComplete={() => { setOnboardingComplete(true); setHasAvatar(true); setRippleNamed(true) }} />
              </AuthRoute>
            } />
            <Route path="/ripple/name" element={
              <AuthRoute session={session}>
                <RippleName session={session} onNamed={() => setRippleNamed(true)} />
              </AuthRoute>
            } />
            <Route path="/checkin" element={
              <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
                <CheckinFlow session={session} context="manual" showNav={true} />
              </ProtectedRoute>
            } />
          </Route>

          {/* AuthRoute (no avatar guard) — this IS the onboarding screen */}
          <Route path="/profile/avatar" element={
            <AuthRoute session={session}>
              <AvatarEditor session={session} setHasAvatar={setHasAvatar} />
            </AuthRoute>
          } />

          <Route path="/games/pond-watch" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <Nav session={session} />
              <PondWatch userId={session?.user?.id} studyId={null} onSessionComplete={savePondWatchSession} />
            </ProtectedRoute>
          } />

          <Route path="/games/first-contact" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <FirstContact
                session={session}
                onComplete={() => setFirstContactComplete(true)}
              />
            </ProtectedRoute>
          } />

          <Route path="/games/ebb-flow" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <UnlockGuard unlocked={firstContactComplete} to="/games/first-contact" from="ebb-flow">
                <EbbAndFlow session={session} onSessionComplete={saveEbbFlowSession} />
              </UnlockGuard>
            </ProtectedRoute>
          } />

          <Route path="/games/owl-barn" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <Nav session={session} />
              <OwlBarn userId={session?.user?.id} studyId={null} />
            </ProtectedRoute>
          } />

          <Route path="/games/still-water" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <StillWater session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/face-read" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <UnlockGuard unlocked={stillWaterPlayed} to="/games/still-water" from="face-read">
                <FaceRead session={session} />
              </UnlockGuard>
            </ProtectedRoute>
          } />

          <Route path="/games/drift" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <Drift session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/delve" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <Delve session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/tune" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <Tune session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/alongside" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <Alongside session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/farm-joy" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <FarmJoy session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/breath-belt" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <BreathBelt />
            </ProtectedRoute>
          } />

          {/* Breath Guardian — hold-to-inhale dome game; fullscreen fixed overlay
              with its own in-game exit link, so no Nav here (it would be covered). */}
          <Route path="/games/breath-guardian" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <UnlockGuard unlocked={firstContactComplete} to="/games/first-contact" from="breath-guardian">
                <BreathGuardian session={session} />
              </UnlockGuard>
            </ProtectedRoute>
          } />

          <Route path="/games/aptitude-suite" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <AptitudeSuite session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/word-max" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
              <WordMax />
            </ProtectedRoute>
          } />

          <Route path="/games/color-max" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar} needsWelcome={needsWelcome} needsRippleName={needsRippleName}>
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

          {/* Brand/press-kit page — logos, crests, palette, fonts. Not linked in nav, direct URL only. */}
          <Route path="/brand" element={<BrandAssets />} />

          {/* Dev-only test harness — component guards with import.meta.env.DEV */}
          <Route path="/dev/video-test" element={<VideoTest />} />
          <Route path="/dev/audio-test" element={<AudioTest />} />
          {/* Phase 2 primitive gallery (Onboarding Redesign v1) */}
          <Route path="/dev/ui-kit" element={<UiKit />} />
          {/* Phase 4 onboarding step previews (?step=welcome|data|demographics|ripple|finish) */}
          <Route path="/dev/onboarding-preview" element={<OnboardingPreview />} />
          {/* Dashboard Insights widget with synthetic data (?state=rich|sparse|empty) */}
          <Route path="/dev/insights-preview" element={<InsightsPreview />} />
          <Route path="/dev/body-diagram-preview" element={<BodyDiagramPreview />} />
          <Route path="/dev/alongside-preview" element={<AlongsidePreview />} />
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
          {/*
            Talks — private slide-deck hub + the decks it lists, gated by
            TalksRoute (superAdmin only for now; widen to lab admins with a
            one-line change in TalksRoute). Everything here requires login:
            /talks is the index, the deck routes are the click-through shows.
          */}
          <Route element={<TalksRoute session={session} role={role} superAdmin={superAdmin} />}>
            <Route path="/talks" element={<Talks />} />
            {/* ISARP keynote deck — click-through, doubles as read-later resource */}
            <Route path="/keynote" element={<Keynote />} />
            {/* toni_july_2026 deck — fMRI preprocessing + downstream analysis with an AI agent */}
            <Route path="/toni-july-2026" element={<ToniJuly2026 />} />
          </Route>

          {/*
            Academic partition — Lecture Lounge (and, next, the Field Guide
            ingest portal). Own chunk group (every component separately
            lazy-loaded), own error boundary (a crash here shows a scoped
            error screen instead of blanking the whole app), own admin
            route/layout entirely separate from research admin
            (LectureLoungeAdminRoute, not AdminRoute/AdminLayout).
            Student-facing /class/:slug URLs deliberately stay short — they
            are typed from projector QR codes and baked into sent emails.
          */}
          <Route element={<ErrorBoundary label="Academic"><Outlet /></ErrorBoundary>}>
            <Route path="/class/verify" element={<ClassVerifyEmail />} />
            <Route path="/class/:slug" element={
              <AuthRoute session={session}>
                <ClassRoom session={session} />
              </AuthRoute>
            } />
            <Route element={<ClassAdminRoute session={session} />}>
              <Route path="/class/:slug/console" element={<ClassConsole session={session} />} />
              <Route path="/class/:slug/remote" element={<ClassRemote session={session} />} />
              <Route path="/class/:slug/screen" element={<ClassScreen />} />
            </Route>
            <Route element={<LectureLoungeAdminRoute session={session} role={role} superAdmin={superAdmin} />}>
              <Route path="/academic/lecture-lounge/admin" element={<LectureLoungeAdminPage session={session} />} />
            </Route>
            {/* Pre-partition URL, keep redirecting for at least two terms */}
            <Route path="/lecture-lounge/admin" element={<Navigate to="/academic/lecture-lounge/admin" replace />} />
            <Route path="/academic" element={<AcademicHome />} />
            {/* Field Guide — auth against the radlab-academic project lives
                inside FieldGuideStaffRoute (course login + staff enrollment
                check), not the main-site session. */}
            <Route element={<FieldGuideStaffRoute />}>
              <Route path="/academic/fieldguide/ingest" element={<IngestPortal />} />
              <Route path="/academic/fieldguide/review" element={<ReviewQueue />} />
              {/* Student contributions. Deliberately its own route and chunk:
                  /review is the staff authoring path, this is the student one,
                  and TAs who live here should never need the ingest portal. */}
              <Route path="/academic/fieldguide/submissions" element={<SubmissionsQueue />} />
            </Route>
            {/* The wiki itself — same login, member-level gate. */}
            <Route element={<FieldGuideMemberRoute />}>
              {/* The front door. One url to give a TA or a student: staff see
                  the queues with live counts, members see the two student
                  surfaces — RLS decides which counts even return. */}
              <Route path="/academic/fieldguide" element={<FieldGuideHome />} />
              <Route path="/academic/fieldguide/wiki" element={<WikiIndex />} />
              <Route path="/academic/fieldguide/wiki/:slug" element={<WikiPage />} />
              {/* The gap browser: students plan their research assignment here.
                  Member-level on purpose — the board is part of reading the
                  guide, not part of submitting to it. */}
              <Route path="/academic/fieldguide/gaps" element={<GapBrowser />} />
            </Route>
          </Route>

          {/* Unsubscribe — no auth or layout */}
          <Route path="/unsubscribe/:token" element={<Unsubscribe />} />

          {/* Formal study withdrawal (from lapsed session emails) — no auth or layout */}
          <Route path="/withdraw/:token" element={<Withdraw />} />

          {/* Admin section — role-gated */}
          <Route element={<AdminRoute session={session} role={role} superAdmin={superAdmin} />}>
            {/* Full-screen session runner — no admin chrome */}
            <Route path="/admin/studies/:id/session/:enrollmentId/:studySessionId" element={<StudySessionRunner />} />

            <Route element={<AdminLayout session={session} superAdmin={superAdmin} />}>
              <Route path="/admin"                  element={<AdminDashboard />} />
              <Route path="/admin/sessions"         element={<SessionLibrary />} />
              <Route path="/admin/sessions/new"     element={<SessionBuilder />} />
              <Route path="/admin/sessions/:id"     element={<SessionBuilder />} />
              <Route path="/admin/studies"               element={<StudyLibrary />} />
              <Route path="/admin/studies/new"           element={<StudyFormPage />} />
              <Route path="/admin/studies/:id/edit"      element={<StudyFormPage />} />
              <Route path="/admin/studies/:id/design"    element={<ExperimentBuilder />} />
              <Route path="/admin/studies/:id/balance"   element={<StudyBalancePage />} />
              <Route path="/admin/studies/:id/liliana-credit" element={<LilianaCreditPage />} />
              <Route path="/admin/studies/:id"           element={<StudyDetail />} />
              <Route path="/admin/questionnaires"        element={<QuestionnairesPage />} />
              <Route path="/admin/questionnaires/new"    element={<QuestionnaireUpload />} />
              <Route path="/admin/questionnaires/advanced/:key" element={<AdvancedInstrumentPreview />} />
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
              {/* Super-admin only — RPCs enforce server-side, page shows 'forbidden' otherwise */}
              <Route path="/admin/users"               element={<UserAdminPage />} />
              <Route path="/admin/diagnostics"         element={<Diagnostics />} />
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
