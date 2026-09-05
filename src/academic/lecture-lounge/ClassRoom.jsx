import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeCourseCode, loungePath } from '../courseRoutes'
import { useAvatarConfig } from '../../hooks/useAvatarConfig'
import { AcademicShell } from '../AcademicChrome'
import AvatarMenu from '../fieldguide/AvatarMenu'
import CheckinRunner from './CheckinRunner'
import ResultsView from './ResultsView'
import AvatarWall from './AvatarWall'
import { useClassPresence } from './useClassPresence'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// `radlab.zone` is accepted alongside the student domains: it is a Workspace
// domain restricted to lab staff, and without it the verification flow cannot be
// exercised end to end without a real student account (Norm, 2026-07-30). Kept
// out of the error copy below on purpose — students should be told to use their
// utoronto address, and staff already know their own domain.
// MUST STAY IN SYNC with the same list in
// supabase/functions/send-class-verification-email/index.ts, which is the real
// gate; this copy only saves a round trip.
const UTORONTO_DOMAINS = ['utoronto.ca', 'mail.utoronto.ca', 'radlab.zone']
function isUtorontoEmail(email) {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  return UTORONTO_DOMAINS.includes(email.slice(at + 1).toLowerCase())
}

const BROADCAST_EVENTS = ['staged', 'open', 'closed', 'results_ready']

// Student surface — a state machine (idle / open / closed / results) driven
// by broadcasts on the class's Realtime channel, with a DB fetch on mount
// so a refresh or reconnect restores state without waiting for a broadcast.
export default function ClassRoom({ session }) {
  // Mounted at BOTH /academic/:courseCode/lounge (canonical) and /class/:slug
  // (permanent alias — printed QR codes and sent signup confirmations land
  // there). Same token either way: classes.slug === lowercase(courses.code).
  const { courseCode, slug: slugParam } = useParams()
  const slug = normalizeCourseCode(courseCode ?? slugParam)
  const userId = session?.user?.id

  const [classInfo, setClassInfo] = useState(undefined) // undefined=loading, null=not found
  const [membership, setMembership] = useState(undefined)
  // Verification is account-level (profiles), not per class-membership —
  // proving utoronto ownership once carries across every class you join.
  const [utorontoVerifiedAt, setUtorontoVerifiedAt] = useState(undefined)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)

  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState(null)
  const [sendingVerify, setSendingVerify] = useState(false)
  const [verifySent, setVerifySent] = useState(false)

  // { id, status, config } | null (no live checkin) | undefined (loading)
  const [liveCheckin, setLiveCheckin] = useState(undefined)
  const [alreadyResponded, setAlreadyResponded] = useState(false)
  const channelRef = useRef(null)

  // Presence: only actual members register themselves in the room (per
  // website.md — "members joining the student URL register presence"), so
  // selfPayload stays null until membership resolves to a real row AND the
  // avatar query has settled (data is undefined while loading, null if the
  // user has never opened the avatar editor — most haven't: only ~12% of
  // profiles have an avatars row live. Falling back to {} rather than
  // gating on a row existing means those students still show up in the
  // wall wearing BaseAvatar's own defaults, same as they'd see elsewhere.
  const { data: avatarConfig, isLoading: avatarLoading } = useAvatarConfig(userId)
  const selfPresence = membership && !avatarLoading ? { user_id: userId, ...(avatarConfig ?? {}) } : null
  const presentAvatars = useClassPresence(classInfo?.id, selfPresence)

  // classInfo and utoronto verification don't depend on each other at all —
  // fire both the moment we have a slug/userId instead of one waiting on
  // the other.
  useEffect(() => {
    let cancelled = false
    // Via RPC rather than a table read: this page now renders for logged-out
    // visitors (the class-branded join card), and `classes` is readable by
    // authenticated only. class_public_info exposes exactly id/name/
    // field_guide_url for one slug, callable by anon.
    supabase.rpc('class_public_info', { p_slug: slug }).then(({ data }) => {
      if (!cancelled) setClassInfo(data ?? null)
    })
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase.from('profiles').select('utoronto_verified_at').eq('id', userId).single().then(({ data }) => {
      if (!cancelled) setUtorontoVerifiedAt(data?.utoronto_verified_at ?? null)
    })
    return () => { cancelled = true }
  }, [userId])

  // membership and the check-in-state restore both only need classInfo.id —
  // membership doesn't gate the checkin query (RLS already enforces that
  // server-side), so firing them together instead of restore-waits-for-
  // membership saves a full round trip on every load.
  useEffect(() => {
    if (classInfo === undefined) return // still loading
    if (!classInfo || !userId) { queueMicrotask(() => setMembership(null)); return }
    let cancelled = false
    supabase.from('class_members').select('id').eq('class_id', classInfo.id).eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (!cancelled) setMembership(data ?? null)
    })
    return () => { cancelled = true }
  }, [classInfo, userId])

  // Restore current check-in state from the DB on mount/reconnect — most
  // recently touched non-planned, non-dismissed checkin for this class.
  // Excluding dismissed ones matters: without it, a checkin left in
  // results_ready forever (nothing else resets it) would keep "restoring"
  // as the live one on every reload, so the true idle/lobby view — and the
  // avatar wall, which only renders there — could become unreachable after
  // the first check-in of a term until the instructor explicitly dismisses.
  useEffect(() => {
    if (!classInfo) return
    let cancelled = false
    supabase
      .from('checkins')
      .select('id, status, config, lecture_id, lectures!inner(class_id)')
      .eq('lectures.class_id', classInfo.id)
      .neq('status', 'planned')
      .neq('kind', 'weekly') // weekly walls live on their own page, never in the live flow
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return
        const row = data?.[0]
        setLiveCheckin(row ? { id: row.id, status: row.status, config: row.config } : null)
      })
    return () => { cancelled = true }
  }, [classInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- only the id should re-trigger this, not every field on classInfo

  // Question of the Week: the currently-open weekly check-in, if any, plus
  // its wall summary (count + whether this student has answered) from the
  // get_weekly_wall RPC. DB-driven, no broadcast involvement — a student
  // opening the page from home mid-week sees the card with no live session.
  const [weekly, setWeekly] = useState(null)
  useEffect(() => {
    if (!classInfo || !membership) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('checkins')
        .select('id, config, lectures!inner(class_id)')
        .eq('lectures.class_id', classInfo.id)
        .eq('kind', 'weekly')
        .eq('status', 'open')
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
      const row = data?.[0]
      if (cancelled || !row) { if (!cancelled) setWeekly(null); return }
      // rpc reports failure in `error`, not by throwing — a failed summary
      // still renders the card, just without count/answered detail.
      const { data: wall, error } = await supabase.rpc('get_weekly_wall', { p_checkin_id: row.id })
      if (cancelled) return
      setWeekly({
        id: row.id,
        prompt: row.config?.prompt_text ?? 'This week’s question',
        count: error ? null : wall?.count,
        answered: error ? false : !!(wall?.my_response && wall.my_response.trim()),
      })
    })()
    return () => { cancelled = true }
  }, [classInfo?.id, membership]) // eslint-disable-line react-hooks/exhaustive-deps

  // Discussion boards summary for the lobby card. Board presence is the
  // feature switch: a class with no class_boards rows shows no card.
  const [boardsInfo, setBoardsInfo] = useState(null)
  useEffect(() => {
    if (!classInfo || !membership) { setBoardsInfo(null); return }
    let cancelled = false
    supabase.rpc('get_class_boards', { p_class_id: classInfo.id }).then(({ data }) => {
      if (!cancelled) setBoardsInfo(Array.isArray(data) && data.length ? data : null)
    })
    return () => { cancelled = true }
  }, [classInfo?.id, membership]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live updates via the class broadcast channel — remote pushes state,
  // screen/student are consumers only.
  useEffect(() => {
    if (!classInfo) return
    const channel = supabase.channel(`lounge:${classInfo.id}`)
    for (const status of BROADCAST_EVENTS) {
      channel.on('broadcast', { event: status }, ({ payload }) => {
        if (!payload?.checkin_id) return
        setLiveCheckin((prev) => ({
          id: payload.checkin_id,
          status,
          config: payload.checkin_id === prev?.id ? prev?.config : undefined,
        }))
      })
    }
    // Not a checkin status — a distinct signal meaning "there is no live
    // checkin," so this goes straight to null rather than through the
    // status-object shape the loop above builds.
    channel.on('broadcast', { event: 'dismissed' }, () => setLiveCheckin(null))
    channel.subscribe()
    channelRef.current = channel
    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [classInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // A broadcast only carries the checkin_id, not its config — fetch it once
  // if we don't already have it cached from the mount-time restore.
  useEffect(() => {
    if (!liveCheckin || liveCheckin.config !== undefined) return
    let cancelled = false
    supabase.from('checkins').select('config').eq('id', liveCheckin.id).single().then(({ data }) => {
      if (cancelled || !data) return
      setLiveCheckin((prev) => (prev?.id === liveCheckin.id ? { ...prev, config: data.config } : prev))
    })
    return () => { cancelled = true }
  }, [liveCheckin])

  // If the checkin is open, check whether this student already responded
  // (refresh mid-checkin shouldn't re-ask everything). Not resetting to
  // false when status leaves 'open' is deliberate — alreadyResponded is
  // only ever read while status === 'open', so a stale value elsewhere is
  // inert; the next 'open' checkin's id changing re-triggers this query.
  useEffect(() => {
    if (liveCheckin?.status !== 'open' || !userId) return
    let cancelled = false
    supabase.from('checkin_responses').select('id').eq('checkin_id', liveCheckin.id).eq('profile_id', userId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setAlreadyResponded(!!data) })
    return () => { cancelled = true }
  }, [liveCheckin?.id, liveCheckin?.status, userId])

  async function handleJoin() {
    if (!classInfo || !userId) return
    setJoining(true)
    setJoinError(null)
    const { data, error } = await supabase
      .from('class_members')
      .insert({ class_id: classInfo.id, user_id: userId })
      .select('id')
      .single()
    setJoining(false)
    if (error) {
      // 23505 = unique violation on (class_id, user_id) — the membership row
      // already exists (stale page loaded before an earlier join, a second
      // tab, etc). That's not actually a failure from the student's point of
      // view, so recover silently instead of showing a scary error.
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('class_members').select('id').eq('class_id', classInfo.id).eq('user_id', userId).single()
        if (existing) { setMembership(existing); return }
      }
      setJoinError(error.message)
      return
    }
    setMembership(data)
  }

  async function handleSendVerify(e) {
    e.preventDefault()
    setEmailError(null)
    if (!isUtorontoEmail(emailInput)) {
      setEmailError('Please use a utoronto.ca or mail.utoronto.ca email address.')
      return
    }
    setSendingVerify(true)
    const { data, error } = await supabase.functions.invoke('send-class-verification-email', {
      body: { class_id: classInfo.id, email: emailInput },
    })
    setSendingVerify(false)
    if (error || data?.error) {
      setEmailError(data?.error || 'Could not send verification email — please try again.')
      return
    }
    setVerifySent(true)
  }

  // The same academic menu every academic page mounts; Sign out here ends
  // the MAIN session (this half of the course runs on the main project).
  const menuEl = session ? (
    <AvatarMenu email={session.user.email} courseCode={slug}
                signOut={() => supabase.auth.signOut()} />
  ) : null

  if (session === undefined || classInfo === undefined || (session && classInfo && membership === undefined)) {
    return <AcademicShell courseCode={slug} homeTo={loungePath(slug)} menu={menuEl} />
  }

  if (classInfo === null) {
    return (
      <AcademicShell courseCode={slug} menu={menuEl}>
        <div style={S.wrap}>
          <p style={S.title}>Class not found</p>
          <p style={S.sub}>Double-check the link your instructor shared.</p>
        </div>
      </AcademicShell>
    )
  }

  function renderCheckinArea() {
    if (liveCheckin === undefined) return null
    if (liveCheckin?.status === 'open' && !alreadyResponded) {
      if (liveCheckin.config === undefined) return null // still fetching config
      return (
        <div style={S.card}>
          <CheckinRunner
            checkinId={liveCheckin.id} config={liveCheckin.config} session={session}
            onComplete={() => setAlreadyResponded(true)}
          />
        </div>
      )
    }
    if (liveCheckin?.status === 'results_ready') {
      return <div style={S.card}><ResultsView checkinId={liveCheckin.id} session={session} /></div>
    }
    // idle (no live checkin), staged, closed, or already-responded-while-open
    return (
      <div style={S.card}>
        <p style={S.eyebrow}>{classInfo.name}</p>
        <h1 style={S.title}>{liveCheckin?.status === 'open' ? "You're all set." : "You're in."}</h1>
        <p style={S.sub}>
          {liveCheckin?.status === 'open'
            ? 'Waiting for your instructor to close this check-in…'
            : liveCheckin?.status === 'closed'
            ? 'Check-in closed. Results coming up…'
            : liveCheckin?.status === 'staged'
            ? 'Your instructor is about to open a check-in…'
            : 'Waiting for your instructor to open the next check-in…'}
        </p>
        <div style={S.wallWrap}><AvatarWall avatars={presentAvatars} /></div>
      </div>
    )
  }

  // Session-aware textbook card: the Field Guide is a separate Supabase
  // project, but it shares this origin — its session sits in localStorage
  // under courseClient's storageKey. If one is present, skip the join door
  // and link straight into the wiki (an expired session just bounces to the
  // join door anyway, so a stale token costs one extra hop, not a dead end).
  const hasFieldGuideSession = (() => {
    try { return !!JSON.parse(localStorage.getItem('radlab-academic-auth'))?.access_token }
    catch { return false }
  })()
  const fieldGuideCard = classInfo.field_guide_url ? (
    <a href={hasFieldGuideSession ? `/academic/${slug}/wiki` : classInfo.field_guide_url} style={S.fgCard}>
      <p style={S.fgEyebrow}>Course textbook</p>
      <p style={S.fgTitle}>The Field Guide — your course textbook</p>
      <p style={S.fgMeta}>
        {hasFieldGuideSession
          ? 'You’re signed in — open the Field Guide →'
          : 'Free, built for this course — sign in with your utoronto email →'}
      </p>
    </a>
  ) : null

  return (
    <AcademicShell courseCode={slug} homeTo={loungePath(slug)} menu={menuEl}>
      <div style={S.wrap}>
        {!session ? (
          <>
            <FieldGuideBridge slug={slug} />
            <ClassAuthCard classInfo={classInfo} slug={slug} />
            {fieldGuideCard}
          </>
        ) : !membership ? (
          <>
            <div style={S.card}>
              <p style={S.eyebrow}>Lecture Lounge</p>
              <h1 style={S.title}>{classInfo.name}</h1>
              <p style={S.sub}>Join to respond to live check-ins during class.</p>
              {joinError && <p style={S.error}>{joinError}</p>}
              <button style={S.primaryBtn} onClick={handleJoin} disabled={joining}>
                {joining ? 'Joining…' : 'Join class'}
              </button>
            </div>
            {fieldGuideCard}
          </>
        ) : (
          <>
            {!utorontoVerifiedAt && (
              <div style={S.banner}>
                {!verifySent ? (
                  <form onSubmit={handleSendVerify} style={S.bannerForm}>
                    <p style={S.bannerText}>Verify your utoronto email to help your instructor confirm attendance.</p>
                    <div style={S.bannerRow}>
                      <input
                        type="email"
                        placeholder="you@mail.utoronto.ca"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        style={S.emailInput}
                      />
                      <button type="submit" style={S.bannerBtn} disabled={sendingVerify}>
                        {sendingVerify ? 'Sending…' : 'Verify'}
                      </button>
                    </div>
                    {emailError && <p style={S.error}>{emailError}</p>}
                  </form>
                ) : (
                  <p style={S.bannerText}>Check {emailInput} for a verification link.</p>
                )}
              </div>
            )}

            {renderCheckinArea()}

            {weekly && (
              <Link to={`${loungePath(slug)}/wall/${weekly.id}`} style={S.weeklyCard}>
                <p style={S.weeklyEyebrow}>Question of the week</p>
                <p style={S.weeklyPrompt}>{weekly.prompt}</p>
                <p style={S.weeklyMeta}>
                  {weekly.answered
                    ? `You've answered — see the wall (${weekly.count ?? '…'}) →`
                    : weekly.count
                    ? `${weekly.count} ${weekly.count === 1 ? 'answer' : 'answers'} on the wall — add yours →`
                    : 'Be the first on the wall →'}
                </p>
              </Link>
            )}

            <Link to={`${loungePath(slug)}/slides`} style={S.fgCard}>
              <p style={S.fgEyebrow}>Lecture slides</p>
              <p style={S.fgMeta}>Review any week's deck — printing one gives a study handout →</p>
            </Link>

            {boardsInfo && (
              <Link to={`${loungePath(slug)}/boards`} style={S.fgCard}>
                <p style={S.fgEyebrow}>Discussion boards</p>
                <p style={S.fgMeta}>
                  {boardsInfo.map((b) => `${b.title}: ${b.threads}`).join(' · ')} — ask anything, staff answer →
                </p>
              </Link>
            )}

            {fieldGuideCard}
          </>
        )}
      </div>
    </AcademicShell>
  )
}

// Class-branded auth for logged-out visitors — sign in or create an account
// without ever leaving /class/:slug, so the class context is never lost (the
// old AuthRoute bounce sent students to the generic /login with no way back,
// and new signups fell into the Ripple welcome flow). Sign-in resolves via
// App's onAuthStateChange — this page re-renders as the join view. Sign-up
// follows the platform's confirm-email flow, but with emailRedirectTo set
// back HERE, so the confirmation click lands the student on the class page
// already signed in.
// A student signed in to the Field Guide is not a stranger: Field Guide
// access is only granted by clicking a token emailed to their roster address,
// which is the same proof of mailbox control the Lounge's own verification
// asks for. Rather than make them create a second account on a second
// Supabase project, spend that proof — /api/lounge-continue mints a
// main-project token for the same address and the browser exchanges it here.
//
// Reads the academic session straight from localStorage (both projects share
// this origin, and ClassRoom already reads this key for the textbook card).
// Absent or unreadable, this renders nothing and the ordinary signup card
// below is exactly what it always was.
function FieldGuideBridge({ slug }) {
  const [fg, setFg] = useState(null)      // { token, email } | null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('radlab-academic-auth') ?? 'null')
      const token = raw?.access_token
      const email = raw?.user?.email
      if (token && email) setFg({ token, email })
    } catch { /* no usable Field Guide session — stay hidden */ }
  }, [])

  if (!fg) return null

  const go = async () => {
    setBusy(true); setError(null)
    try {
      const rsp = await fetch('/api/lounge-continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fg_token: fg.token, slug }),
      })
      const out = await rsp.json().catch(() => ({}))
      if (!rsp.ok || !out.token_hash) {
        setBusy(false)
        setError(out.error ?? 'Could not carry your sign-in across — use the form below.')
        return
      }
      const { error: vErr } = await supabase.auth.verifyOtp({
        token_hash: out.token_hash, type: out.type || 'magiclink',
      })
      if (vErr) {
        setBusy(false)
        setError(vErr.message)
        return
      }
      // Session change re-renders this page as a joined member; a clean load
      // is the surest way for every guard to see it.
      window.location.assign(loungePath(slug))
    } catch (err) {
      setBusy(false)
      setError(err.message)
    }
  }

  return (
    <div style={S.bridge}>
      <p style={S.bridgeEyebrow}>Already signed in to the Field Guide</p>
      <p style={S.bridgeEmail}>{fg.email}</p>
      <p style={S.bridgeSub}>
        Use the same account here — your check-ins and participation will be credited to it.
      </p>
      <button style={S.bridgeBtn} onClick={go} disabled={busy}>
        {busy ? 'One moment…' : 'Continue to the Lecture Lounge'}
      </button>
      {error && <p style={S.bridgeErr}>{error}</p>}
    </div>
  )
}

function ClassAuthCard({ classInfo, slug }) {
  const [mode, setMode] = useState('signup') // most first-time visitors are new students
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmSent, setConfirmSent] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    if (mode === 'signin') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setBusy(false); setError(err.message) }
      // on success: stay busy — the session change re-renders the whole page
      return
    }
    // NOT supabase.auth.signUp: that flow's confirmation email links straight
    // to /auth/v1/verify, which consumes the token on a plain GET — exactly
    // what the university's mail scanner performs on every link it delivers.
    // The endpoint mints the same confirmation token but mails a link to our
    // own /class/confirm page, which is inert until a human presses it.
    try {
      const rsp = await fetch('/api/lounge-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, slug }),
      })
      const out = await rsp.json().catch(() => ({}))
      setBusy(false)
      if (out.exists) {
        // A confirmed account already lives at this address — signup must
        // never become a password reset, so send them to the sign-in mode.
        setMode('signin')
        setError('This address already has an account — sign in with your password.')
        return
      }
      if (!rsp.ok || !out.ok) { setError(out.error ?? 'Could not create the account — please try again.'); return }
      setConfirmSent(true)
    } catch {
      setBusy(false)
      setError('Could not reach the server — please try again.')
    }
  }

  if (confirmSent) {
    return (
      <div style={S.card}>
        <p style={S.eyebrow}>Lecture Lounge</p>
        <h1 style={S.title}>Check your email</h1>
        <p style={S.sub}>
          We sent a confirmation link to <strong>{email}</strong>. Tap it, press the
          button on the page it opens, and you'll land back here signed in and ready
          to join {classInfo.name}.
        </p>
        <p style={{ ...S.sub, fontSize: 13 }}>
          If the page says the link was already used, your account is confirmed —
          just sign in here with your password.
        </p>
      </div>
    )
  }

  return (
    <div style={S.card}>
      <p style={S.eyebrow}>Lecture Lounge</p>
      <h1 style={S.title}>{classInfo.name}</h1>
      <p style={S.sub}>
        {mode === 'signup'
          ? 'Create your account to join the class — check-ins, polls, and the question of the week.'
          : 'Sign in to join the class.'}
      </p>
      <form onSubmit={submit} style={{ marginTop: 18 }}>
        <input
          type="email" placeholder="you@mail.utoronto.ca" value={email}
          onChange={(e) => setEmail(e.target.value)} style={S.authInput} autoComplete="email"
        />
        <input
          type="password" placeholder={mode === 'signup' ? 'Choose a password' : 'Password'} value={password}
          onChange={(e) => setPassword(e.target.value)} style={S.authInput}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
        {error && <p style={S.error}>{error}</p>}
        <button type="submit" style={{ ...S.primaryBtn, width: '100%', marginTop: 12 }} disabled={busy || !email || !password}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p style={{ ...S.sub, marginTop: 14 }}>
        {mode === 'signup' ? (
          <>Already have a radlab account?{' '}
            <button style={S.authSwitch} onClick={() => { setMode('signin'); setError(null) }}>Sign in</button></>
        ) : (
          <>New here?{' '}
            <button style={S.authSwitch} onClick={() => { setMode('signup'); setError(null) }}>Create an account</button></>
        )}
      </p>
    </div>
  )
}

const S = {
  wrap: { maxWidth: 480, margin: '0 auto', padding: '10px 20px 40px' },
  bridge: { background: 'var(--bgc)', border: '1px solid var(--pk)', borderRadius: 16, padding: '22px 24px', textAlign: 'left', marginBottom: 16 },
  bridgeEyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--pk)' },
  bridgeEmail: { fontSize: 16, fontWeight: 700, color: 'var(--tx)', margin: '4px 0 6px', overflowWrap: 'anywhere' },
  bridgeSub: { fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 12 },
  bridgeBtn: { width: '100%', fontSize: 15, fontWeight: 600, padding: '12px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  bridgeErr: { fontSize: 13, color: '#c0392b', marginTop: 10 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  wallWrap: { marginTop: 24 },
  error: { fontSize: 14, color: '#c04a4a', marginTop: 8 },
  primaryBtn: {
    marginTop: 20, padding: '12px 28px', borderRadius: 10, border: 'none',
    background: 'var(--pk)', color: '#fff', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  authInput: {
    width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10,
    border: '1px solid var(--bds)', fontSize: 15, fontFamily: 'inherit', marginTop: 10,
  },
  authSwitch: { border: 'none', background: 'none', color: 'var(--pk)', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 },
  fgCard: {
    display: 'block', textDecoration: 'none', marginTop: 16, textAlign: 'left',
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 20px',
  },
  fgEyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  fgTitle: { fontFamily: SERIF, fontSize: 18, color: 'var(--tx)', lineHeight: 1.35, marginBottom: 6 },
  fgMeta: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  weeklyCard: {
    display: 'block', textDecoration: 'none', marginTop: 16, textAlign: 'left',
    background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 14, padding: '16px 20px',
  },
  weeklyEyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  weeklyPrompt: { fontFamily: SERIF, fontSize: 18, color: 'var(--tx)', lineHeight: 1.35, marginBottom: 6 },
  weeklyMeta: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  banner: { background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 12, padding: '14px 18px', marginBottom: 16 },
  bannerForm: {},
  bannerText: { fontSize: 14, color: 'var(--tx2)', marginBottom: 10 },
  bannerRow: { display: 'flex', gap: 8 },
  emailInput: {
    flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--bds)',
    fontSize: 14, fontFamily: 'inherit',
  },
  bannerBtn: {
    padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--pk)',
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
}
