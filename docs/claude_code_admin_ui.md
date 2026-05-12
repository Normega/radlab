# Claude Code Prompt — Admin Section UI

## Context

You are working on the RADlab Come, See platform. Read `website.md` in full before making any changes. The stack is React + Vite + Tailwind CSS v3 + Supabase. The study infrastructure schema and `generateSchedule` / `issueLink` utilities are already live (see `src/lib/scheduleGenerator.js`).

This prompt builds the admin UI: a role-gated section for lab members to manage sessions, protocols, and studies. Do not touch any existing game files, Hub.jsx, or lab pages.

---

## Design System

Match the existing platform aesthetic throughout:

- **Background**: `#FCF0F5` warm pinkish off-white
- **Cards**: white, soft shadow
- **Accent**: `#f068a4` pink
- **Gray**: `#abadb0`
- **Dark**: `#1c1c1e`
- **Fonts**: DM Serif Display (headings), Space Mono (data/labels), DM Sans (body)
- **Minimum font size**: 12px — enforce via existing `--fs-min` token
- **Logo**: never redraw — use `RADlab_Logo_light.svg` in the admin layout header
- Tone is warm and functional, not clinical. Labels and empty states should have personality.

---

## 1. Schema Addition

Add to Supabase via migration `YYYYMMDD_super_admin.sql`:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS super_admin bool DEFAULT false;
```

Set your own account as super admin directly in Supabase SQL editor — no UI needed:

```sql
UPDATE profiles SET super_admin = true WHERE id = '<your-user-id>';
```

---

## 2. Route Guard

Create `src/components/AdminRoute.jsx`:

- Wraps any `/admin/*` route
- Reads `profile.role` and `profile.super_admin` from Supabase
- If `role !== 'lab'` and `super_admin !== true`: redirect to `/dashboard`
- While loading profile: show a neutral loading state (no flash of content)

---

## 3. Admin Layout

Create `src/layouts/AdminLayout.jsx`:

- Persistent left sidebar on desktop, collapsible drawer on mobile
- Sidebar contains:
  - `RADlab_Logo_light.svg` at top (inline SVG, dark fill, links to `/`)
  - Nav links: **Sessions**, **Protocols**, **Studies** (in that order — this is the composition chain)
  - Active link highlighted with pink accent
  - Bottom of sidebar: logged-in user display name + a subtle "Back to platform" link
- Main content area to the right
- Wrap all `/admin/*` routes with both `<AdminRoute>` and `<AdminLayout>`

---

## 4. Admin Dashboard `/admin`

Simple overview page. Three summary cards showing counts:

- Session templates (total)
- Protocols (total)
- Active studies (studies with at least one enrolled participant)

Each card links to its respective library page. Empty state copy examples:
- "No sessions yet. Build your first one."
- "No protocols yet. Assemble one from your sessions."
- "No studies yet. Launch one using a protocol."

---

## 5. Session Template Library `/admin/sessions`

List all session templates. Each row shows:
- Label
- Number of activities (count of `session_template_nodes`)
- Estimated total duration (sum of `activities.estimated_minutes`)
- Created date
- Actions: Edit, Clone, Delete (with confirm dialog)

**Clone**: creates a new `session_templates` row with `cloned_from` set, deep-copies all `session_template_nodes`.

Empty state: "No session templates yet. A session is an ordered sequence of activities delivered in one sitting."

**New Session button** → `/admin/sessions/new`

---

## 6. Session Builder `/admin/sessions/new` and `/admin/sessions/:id`

Two-column layout:
- **Left**: activity picker — grouped list of all `activities` by category (Forms, Questionnaires, Games). Each item shows label + estimated minutes. Click to add to sequence.
- **Right**: current sequence — ordered list of added activities. Drag to reorder (use `@dnd-kit/sortable`). Click to remove. Shows running total estimated duration at the bottom.

Fields above the sequence:
- Label (required)
- Description (optional)

Save button inserts/updates `session_templates` and all `session_template_nodes` in a transaction (delete existing nodes, reinsert in new order).

---

## 7. Protocol Library `/admin/protocols`

List all protocols. Each row shows:
- Label
- Type badge: `single_shot` or `scheduled`
- Number of study days (scheduled) or "One-time" (single_shot)
- Created date
- Actions: Edit, Clone, Delete

**Clone**: creates a new `study_protocols` row with `cloned_from` set, deep-copies all `protocol_study_days` and `protocol_day_contacts`.

Empty state: "No protocols yet. A protocol defines the schedule and session sequence for a study."

**New Protocol button** → `/admin/protocols/new`

---

## 8. Protocol Builder `/admin/protocols/new` and `/admin/protocols/:id`

### Header fields

- Label (required)
- Protocol type toggle: `single_shot` | `scheduled`
- If `single_shot`: show a single session template picker (dropdown of all session templates) — this sets the one contact
- Allow restart toggle (default off)
- Max attempts (shown only if allow restart is on)
- Reminders toggle (default off)
- If reminders on: reminder interval (hours) + max reminders fields
- Enrollment protocol (optional): dropdown of other protocols — if set, completing this protocol triggers generation of the selected downstream protocol

### Study days section (shown only for `scheduled` type)

List of study days, each showing:
- Day number + day of week selector (mon/tue/wed/thu/fri/sat/sun)
- Label field
- List of contacts for that day (ordered)

Each contact row shows:
- Send time (time input)
- Session template picker (dropdown)
- Link expires (hours, default 48)
- Label

Actions per day: Add contact, Remove day
Actions per contact: Remove

**Add study day** button appends a new day with `day_number` auto-incremented.

Save inserts/updates `study_protocols`, `protocol_study_days`, and `protocol_day_contacts`.

---

## 9. Study Library `/admin/studies`

List all studies. Each row shows:
- Study label
- Assigned protocol label
- Participant count
- Completion rate (completed schedule rows / total schedule rows, as a percentage)
- Created date
- Actions: View, Archive

Empty state: "No studies yet. A study enrolls participants into a protocol."

**New Study button** → `/admin/studies/new`

---

## 10. Study Builder `/admin/studies/new`

Fields:
- Study label (required)
- Protocol picker: dropdown of all protocols (show label + type badge)
- Messaging required toggle — sets `studies.messaging_required`; if on, show a note: "Messaging will be treated as a participation requirement under the research exemption."

Save inserts into `studies` and `study_protocol_assignments`.

---

## 11. Study Detail `/admin/studies/:id`

### Header
Study label, protocol name, created date, participant count.

### Participants tab

Table of enrolled participants:
- Display name
- Enrolled at
- Schedule progress (e.g. "3 / 8 completed")
- Last active
- Actions: View schedule, Revoke access

**Add participant** button: email input → looks up profile by email → if found, enrolls them (inserts into `participant_consent` with appropriate `messaging_basis`, calls `generateSchedule`), → issues first link if protocol is `single_shot`

### Schedule tab (per participant, opened via "View schedule")

The audit table in long format:

| Check-in | Scheduled For | Status | Completed At | Attempts |
|---|---|---|---|---|

Rows colored by status: completed = green tint, expired = red tint, pending = neutral.

PI actions per row:
- Issue link manually (if pending and no active link)
- Revoke active link
- Copy link to clipboard

---

## 12. Nav Update

In `Nav.jsx` (the main platform nav), add an **Admin** link visible only when:

```js
profile?.role === 'lab' || profile?.super_admin === true
```

Link goes to `/admin`. Style consistently with existing nav links.

---

## 13. App.jsx Route Additions

Add under a shared `<AdminRoute>` + `<AdminLayout>` wrapper:

```jsx
<Route path="/admin" element={<AdminDashboard />} />
<Route path="/admin/sessions" element={<SessionLibrary />} />
<Route path="/admin/sessions/new" element={<SessionBuilder />} />
<Route path="/admin/sessions/:id" element={<SessionBuilder />} />
<Route path="/admin/protocols" element={<ProtocolLibrary />} />
<Route path="/admin/protocols/new" element={<ProtocolBuilder />} />
<Route path="/admin/protocols/:id" element={<ProtocolBuilder />} />
<Route path="/admin/studies" element={<StudyLibrary />} />
<Route path="/admin/studies/new" element={<StudyBuilder />} />
<Route path="/admin/studies/:id" element={<StudyDetail />} />
```

---

## 14. File Checklist

```
supabase/
  migrations/
    YYYYMMDD_super_admin.sql

src/
  components/
    AdminRoute.jsx
  layouts/
    AdminLayout.jsx
  pages/
    admin/
      AdminDashboard.jsx
      SessionLibrary.jsx
      SessionBuilder.jsx
      ProtocolLibrary.jsx
      ProtocolBuilder.jsx
      StudyLibrary.jsx
      StudyBuilder.jsx
      StudyDetail.jsx
```

---

## Notes

- Use TanStack Query for all data fetching — follow the pattern already used in the codebase
- Use `supabase-js` for all DB operations via `src/lib/supabase.js` — do not reinitialize the client
- Install `@dnd-kit/core` and `@dnd-kit/sortable` for drag-to-reorder in the session builder
- All timestamps are `timestamptz`, always UTC
- Follow existing component and hook patterns in the codebase
- Empty states and helper text should be warm and human, not generic ("No records found" is not acceptable)
- The existing `App.jsx` and `Nav.jsx` are provided below — modify minimally and only where specified

## Existing Files

### src/App.jsx
```
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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
          <Route path="/"         element={<Landing      session={session} />} />
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

          {/* Standalone participant link — no nav or auth guard */}
          <Route path="/s/:token" element={<SessionEntry />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

### src/Nav.jsx
```
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BaseAvatar from './Avatar/BaseAvatar'
import { useAvatarConfig } from '../hooks/useAvatarConfig'

export default function Nav({ session }) {
  const navigate = useNavigate()
  const userId   = session?.user?.id

  const { data: avatarData } = useAvatarConfig(userId)

  const initial = (
    session?.user?.user_metadata?.display_name?.[0] ||
    session?.user?.email?.[0] ||
    '?'
  ).toUpperCase()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav style={S.nav} className="px-4 md:px-6">
      <Link to="/" style={S.brand}>
        <div className="h-8 md:h-10" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/RADlab_Logo.svg" height="100%" style={{ height: '100%', display: 'block' }} alt="RADlab logo" />
        </div>
        <span style={S.wordmark}>RAD<b style={{ color: 'var(--pk)', fontWeight: 400 }}>lab</b></span>
      </Link>

      <div style={S.links}>
        {session ? (
          <>
            <Link to="/dashboard" style={S.link}>Dashboard</Link>
            <Link to="/games"     style={S.link}>Games</Link>
            <button style={S.btnOutline} onClick={handleSignOut}>Sign out</button>
            <Link to="/profile" style={S.avatarCircle}>
              {avatarData ? (
                <BaseAvatar skinColor={avatarData.skin_color} eyeColor={avatarData.eye_color} species={avatarData.species ?? 'human'} size={36} />
              ) : (
                <div style={S.avatarInitial}>{initial}</div>
              )}
            </Link>
          </>
        ) : (
          <>
            <Link to="/" style={S.link} className="hidden md:inline">About</Link>
            <Link to="/login"  style={S.btnOutline} className="hidden md:inline-flex">Log in</Link>
            <Link to="/signup" style={S.btnPrimary} className="text-sm px-3 py-1.5 md:px-5 md:py-2">Join free</Link>
          </>
        )}
      </div>
    </nav>
  )
}

const S = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 0',
    background: 'rgba(252,240,245,0.97)',
    borderBottom: '1px solid var(--bd)',
    position: 'sticky', top: 0, zIndex: 10,
    backdropFilter: 'blur(8px)',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 10,
    textDecoration: 'none',
  },
  wordmark: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 'clamp(22px, 5vw, 36px)',
    letterSpacing: -0.5,
    color: 'var(--tx)',
    lineHeight: 1,
  },
  links:     { display: 'flex', alignItems: 'center', gap: 12 },
  link:      { fontSize: 14, color: 'var(--tx2)', textDecoration: 'none' },
  btnOutline: {
    fontSize: 14, padding: '7px 18px', borderRadius: 9,
    cursor: 'pointer', fontWeight: 500,
    border: '1px solid var(--bds)', background: 'transparent',
    color: 'var(--tx2)', textDecoration: 'none',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    borderRadius: 9, cursor: 'pointer', fontWeight: 500,
    background: 'var(--pk)', border: '1px solid var(--pk)',
    color: '#fff', textDecoration: 'none',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  avatarCircle: {
    width: 36, height: 36, borderRadius: '50%',
    overflow: 'hidden', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '2px solid var(--pkb)',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  avatarInitial: {
    width: '100%', height: '100%',
    background: 'var(--pk)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff',
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 15, fontWeight: 700,
  },
}

```
