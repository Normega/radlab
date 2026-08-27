import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import SiteFooter from '../components/SiteFooter'
import EyebrowLabel from '../components/ui/EyebrowLabel'
import PrimaryCTA from '../components/ui/PrimaryCTA'
import RippleAvatar from '../ripple/RippleAvatar'
import { useAvatarConfig } from '../hooks/useAvatarConfig'

// ── MyRipplePage (/ripple) ────────────────────────────────────────────────
// The Ripple itself: what it looks like, what it's called, how the two of you
// are doing, and what customizing it has unlocked. Split out of the old
// do-everything /profile 2026-07-30 (Norm's account-menu IA rework); merged
// with Points & Progress / Unlock Tracker 2026-08-13 (Account/My Ripple
// redesign) — those gate avatar customization, so they're avatar-related
// under the "avatar → ripple, everything else → account" rule, not account
// facts. Account facts and reminder/password/deletion mechanics live on
// /account.
//
// Customization lives at /ripple/avatar (AvatarEditor), which is also the
// first-login avatar step, so it stays its own route rather than inlining here.

const UNLOCK_MILESTONES = [
  { pts: 50,  label: 'Ears & species',  icon: '👂' },
  { pts: 100, label: 'Nose styles',     icon: '👃' },
  { pts: 150, label: 'Hair',            icon: '💇' },
  { pts: 200, label: 'Mouth styles',    icon: '😄' },
  { pts: 300, label: 'Auras & extras',  icon: '✨' },
  { pts: 500, label: 'Scars & marks',   icon: '🔱' },
]

export default function MyRipplePage({ session }) {
  const userId = session?.user?.id

  const { data: avatarData } = useAvatarConfig(userId)

  const [ripple,       setRipple]       = useState(null)
  const [points,       setPoints]       = useState(null)
  const [editing,      setEditing]      = useState(false)
  const [nameInput,    setNameInput]    = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      supabase.from('ripples')
        .select('name, last_checkin_on')
        .eq('user_id', userId).maybeSingle(),
      supabase.from('profiles')
        .select('points')
        .eq('id', userId).maybeSingle(),
    ]).then(([{ data: r }, { data: p }]) => {
      if (cancelled) return
      setRipple(r ?? {})
      setPoints(p?.points ?? 0)
    })
    return () => { cancelled = true }
  }, [userId])

  // Progress bar spans the gap between the milestone just passed and the next.
  const nextIdx       = points == null ? -1 : UNLOCK_MILESTONES.findIndex(m => m.pts > points)
  const nextMilestone = nextIdx >= 0 ? UNLOCK_MILESTONES[nextIdx] : null
  const prevPts       = nextMilestone
    ? (UNLOCK_MILESTONES[nextIdx - 1]?.pts ?? 0)
    : (UNLOCK_MILESTONES[UNLOCK_MILESTONES.length - 1]?.pts ?? 0)
  const progressPct   = nextMilestone
    ? Math.round((((points ?? 0) - prevPts) / (nextMilestone.pts - prevPts)) * 100)
    : 100

  // UPSERT, not update — see the note that used to live on ProfilePage: a
  // plain .update().eq('user_id', …) matches zero rows for anyone without a
  // `ripples` row (180 of 186 profiles had none when this was found on
  // 2026-07-30) and reports success anyway.
  async function saveName() {
    const name = nameInput.trim()
    if (!name || name === ripple?.name) { setEditing(false); return }
    setSaving(true)
    const { error } = await supabase.from('ripples')
      .upsert({ user_id: userId, name }, { onConflict: 'user_id' })
    if (error) {
      console.error('ripples upsert:', error)
      setSaveError('Could not save that — please try again.')
    } else {
      setSaveError(null)
      setRipple(r => ({ ...r, name }))
      setEditing(false)
    }
    setSaving(false)
  }

  const skinColor = avatarData?.skin_color || '#FDBCB4'
  const eyeColor  = avatarData?.eye_color  || '#4A90D9'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav session={session} />
      <div style={S.wrap}>

        <p style={S.eyebrow}>My Ripple</p>
        <h1 style={S.title}>{ripple?.name || 'Your Ripple'}</h1>

        {/* ── Portrait + customize ──────────────────────────────── */}
        <div style={S.portraitCard}>
          <RippleAvatar
            skinColor={skinColor}
            eyeColor={eyeColor}
            species={avatarData?.species ?? 'human'}
            hairStyle={avatarData?.hair_style ?? 'none'}
            hairColor={avatarData?.hair_color ?? '#784421'}
            size={160}
          />
          <div style={S.portraitSide}>
            {editing ? (
              <div style={S.nameRow}>
                <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false) }}
                  style={S.nameInput}
                  aria-label="Ripple name"
                />
                <button onClick={saveName} disabled={saving} style={S.btnSmall}>{saving ? '…' : 'Save'}</button>
                <button onClick={() => setEditing(false)} style={S.btnGhost}>Cancel</button>
              </div>
            ) : (
              <div style={S.nameRow}>
                <span style={S.rippleName}>{ripple?.name ?? (ripple === null ? '…' : 'Unnamed')}</span>
                {ripple && (
                  <PrimaryCTA
                    onClick={() => { setNameInput(ripple?.name ?? ''); setEditing(true) }}
                    style={S.btnRename}
                  >
                    Rename
                  </PrimaryCTA>
                )}
              </div>
            )}

            <p style={S.portraitNote}>
              Your Ripple mirrors how you arrive. Change its face, species, or hair
              any time — nothing is locked in.
            </p>

            <Link to="/ripple/avatar" style={S.editBtn}>Customize appearance</Link>

            {saveError && <p style={S.error}>{saveError}</p>}
          </div>
        </div>

        {/* ── Progress tracker ──────────────────────────────────── */}
        {/* Points & Progress + Unlock Tracker, moved here from the old
            /profile (2026-08-13): both gate avatar customization, so they're
            avatar-related, not account facts. */}
        <div style={S.secLabel}><EyebrowLabel variant="white">Progress Tracker</EyebrowLabel></div>
        <div style={S.card}>
          <div style={S.pointsRow}>
            <span style={S.pointsNum}>{points ?? 0}</span>
            <span style={S.pointsUnit}>points</span>
          </div>
          {nextMilestone ? (
            <>
              <div style={S.progressTrack}>
                <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
              </div>
              <p style={S.progressNote}>
                <span style={{ fontFamily: MONO, color: 'var(--pk)' }}>{nextMilestone.pts - (points ?? 0)} pts</span>
                {' until '}
                <strong>{nextMilestone.icon} {nextMilestone.label}</strong>
                {' unlocks'}
              </p>
            </>
          ) : (
            <p style={S.progressNote}>All features unlocked!</p>
          )}

          <div style={S.unlockList}>
            {UNLOCK_MILESTONES.map((m, i) => {
              const unlocked = (points ?? 0) >= m.pts
              return (
                <div
                  key={m.pts}
                  style={{
                    ...S.unlockRow,
                    opacity: unlocked ? 1 : 0.42,
                    borderBottom: i < UNLOCK_MILESTONES.length - 1 ? '1px solid var(--bd)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
                  <div style={S.unlockInfo}>
                    <span style={{ ...S.unlockLabel, color: unlocked ? 'var(--tx)' : 'var(--gy)' }}>
                      {m.label}
                    </span>
                    {unlocked && <span style={S.unlockedTag}>Unlocked</span>}
                  </div>
                  <span style={S.unlockPts}>{m.pts} pts</span>
                </div>
              )
            })}
          </div>

          <p style={S.cardFoot}>
            How often your Ripple prompts you — and whether it emails —
            lives in <Link to="/account" style={S.inlineLink}>Account</Link>.
          </p>
        </div>

      </div>

      <SiteFooter session={session} />
    </div>
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  wrap:    { maxWidth: 720, margin: '0 auto', padding: '40px 24px 72px' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title:   { fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 36px)', color: 'var(--tx)', letterSpacing: -0.5, marginBottom: 28 },

  portraitCard: {
    background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 12,
    padding: 28, display: 'flex', alignItems: 'center', gap: 28,
    flexWrap: 'wrap', marginBottom: 40,
  },
  portraitSide: { flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' },
  portraitNote: { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55, margin: 0 },

  nameRow:    { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  rippleName: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)' },
  nameInput: {
    fontFamily: SANS, fontSize: 16, padding: '8px 12px', minWidth: 0, width: 180,
    borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)',
  },
  btnSmall: {
    fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: '8px 14px', borderRadius: 24,
    background: 'var(--pk)', color: '#fff', border: 'none', cursor: 'pointer',
  },
  // Formal button, not a bare text link (policy, 2026-08-13): every option in
  // a choice pair is a real button — the non-suggested one is just grayer.
  btnGhost: {
    fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--tx2)',
    background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 24,
    cursor: 'pointer', padding: '8px 14px',
  },
  btnRename: { padding: '6px 14px', fontSize: 14, borderRadius: 20 },
  editBtn: {
    display: 'inline-block', fontFamily: SANS, fontWeight: 600, fontSize: 14,
    padding: '10px 16px', borderRadius: 24,
    background: 'var(--bgp)', color: 'var(--pkd)', textDecoration: 'none',
  },

  secLabel: { marginBottom: 14 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24 },
  cardFoot:  { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', margin: '18px 0 0', paddingTop: 16, borderTop: '1px solid var(--bd)' },
  inlineLink:{ color: 'var(--pk)' },

  pointsRow:  { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 },
  pointsNum:  { fontFamily: MONO, fontSize: 36, color: 'var(--tx)' },
  pointsUnit: { fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gy)' },
  progressTrack: { height: 8, borderRadius: 4, background: 'var(--bgp)', overflow: 'hidden' },
  progressFill:  { height: '100%', background: 'var(--pk)', borderRadius: 4, transition: 'width 0.3s' },
  progressNote:  { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', marginTop: 10 },

  unlockList:  { marginTop: 24, borderTop: '1px solid var(--bd)' },
  unlockRow:   { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' },
  unlockInfo:  { flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  unlockLabel: { fontFamily: SANS, fontSize: 14 },
  unlockedTag: {
    fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--pkd)', background: 'var(--bgp)', padding: '2px 8px', borderRadius: 12,
  },
  unlockPts: { fontFamily: MONO, fontSize: 12, color: 'var(--gy)' },

  error: { fontFamily: SANS, fontSize: 14, color: 'var(--err-tx)', margin: 0 },
}
