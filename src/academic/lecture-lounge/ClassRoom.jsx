import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAvatarConfig } from '../../hooks/useAvatarConfig'
import Nav from '../../components/Nav'
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
  const { slug } = useParams()
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

  if (session === undefined || classInfo === undefined || (session && classInfo && membership === undefined)) {
    return <div style={{ background: 'var(--bg)', minHeight: '100vh' }}><Nav session={session} /></div>
  }

  if (classInfo === null) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Nav session={session} />
        <div style={S.wrap}>
          <p style={S.title}>Class not found</p>
          <p style={S.sub}>Double-check the link your instructor shared.</p>
        </div>
      </div>
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

  const fieldGuideCard = classInfo.field_guide_url ? (
    <a href={classInfo.field_guide_url} style={S.fgCard}>
      <p style={S.fgEyebrow}>Course textbook</p>
      <p style={S.fgTitle}>The Field Guide to Abnormal Psychology</p>
      <p style={S.fgMeta}>Free, built for this course — sign in with your utoronto email →</p>
    </a>
  ) : null

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>
        {!session ? (
          <>
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
              <Link to={`/class/${slug}/wall/${weekly.id}`} style={S.weeklyCard}>
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

            {fieldGuideCard}
          </>
        )}
      </div>
    </div>
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
    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/class/${slug}` },
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setConfirmSent(true)
  }

  if (confirmSent) {
    return (
      <div style={S.card}>
        <p style={S.eyebrow}>Lecture Lounge</p>
        <h1 style={S.title}>Check your email</h1>
        <p style={S.sub}>
          We sent a confirmation link to <strong>{email}</strong>. Clicking it brings you
          straight back here, signed in and ready to join {classInfo.name}.
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
  wrap: { maxWidth: 480, margin: '0 auto', padding: '40px 20px' },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  wallWrap: { marginTop: 24 },
  error: { fontSize: 13, color: '#c04a4a', marginTop: 8 },
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
  fgEyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  fgTitle: { fontFamily: SERIF, fontSize: 18, color: 'var(--tx)', lineHeight: 1.35, marginBottom: 6 },
  fgMeta: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  weeklyCard: {
    display: 'block', textDecoration: 'none', marginTop: 16, textAlign: 'left',
    background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 14, padding: '16px 20px',
  },
  weeklyEyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  weeklyPrompt: { fontFamily: SERIF, fontSize: 18, color: 'var(--tx)', lineHeight: 1.35, marginBottom: 6 },
  weeklyMeta: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  banner: { background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 12, padding: '14px 18px', marginBottom: 16 },
  bannerForm: {},
  bannerText: { fontSize: 13, color: 'var(--tx2)', marginBottom: 10 },
  bannerRow: { display: 'flex', gap: 8 },
  emailInput: {
    flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--bds)',
    fontSize: 14, fontFamily: 'inherit',
  },
  bannerBtn: {
    padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--pk)',
    color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
}
