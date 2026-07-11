import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const UTORONTO_DOMAINS = ['utoronto.ca', 'mail.utoronto.ca']
function isUtorontoEmail(email) {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  return UTORONTO_DOMAINS.includes(email.slice(at + 1).toLowerCase())
}

// Student surface. Phase 1 ships the join + utoronto verification shell —
// the broadcast-driven check-in state machine (idle/open/closed/results)
// is WP4 and replaces the placeholder "waiting" panel below.
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: cls } = await supabase
        .from('classes').select('id, name, slug').eq('slug', slug).maybeSingle()
      if (cancelled) return
      setClassInfo(cls ?? null)
      if (!cls || !userId) { setMembership(null); return }

      const [{ data: mem }, { data: profile }] = await Promise.all([
        supabase.from('class_members').select('id').eq('class_id', cls.id).eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('utoronto_verified_at').eq('id', userId).single(),
      ])
      if (cancelled) return
      setMembership(mem ?? null)
      setUtorontoVerifiedAt(profile?.utoronto_verified_at ?? null)
    }
    load()
    return () => { cancelled = true }
  }, [slug, userId])

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

  if (classInfo === undefined || (classInfo && membership === undefined)) {
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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>
        {!membership ? (
          <div style={S.card}>
            <p style={S.eyebrow}>Lecture Lounge</p>
            <h1 style={S.title}>{classInfo.name}</h1>
            <p style={S.sub}>Join to respond to live check-ins during class.</p>
            {joinError && <p style={S.error}>{joinError}</p>}
            <button style={S.primaryBtn} onClick={handleJoin} disabled={joining}>
              {joining ? 'Joining…' : 'Join class'}
            </button>
          </div>
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

            <div style={S.card}>
              <p style={S.eyebrow}>{classInfo.name}</p>
              <h1 style={S.title}>You're in.</h1>
              <p style={S.sub}>Waiting for your instructor to open the next check-in…</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  wrap: { maxWidth: 480, margin: '0 auto', padding: '40px 20px' },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  error: { fontSize: 13, color: '#c04a4a', marginTop: 8 },
  primaryBtn: {
    marginTop: 20, padding: '12px 28px', borderRadius: 10, border: 'none',
    background: 'var(--pk)', color: '#fff', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
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
