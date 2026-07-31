import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import RippleAvatar from '../ripple/RippleAvatar'
import { useAvatarConfig } from '../hooks/useAvatarConfig'

// ── ProfilePage (/profile) ────────────────────────────────────────────────
// Who you are on the platform and what you've earned. Narrowed 2026-07-30
// (Norm's account-menu IA rework): Ripple identity/appearance moved to
// /ripple, every prompt and reminder control moved to /settings, and the
// account facts below moved UP from the Dashboard's old `// Account` block,
// which is gone.

const UNLOCK_MILESTONES = [
  { pts: 50,  label: 'Ears & species',  icon: '👂' },
  { pts: 100, label: 'Nose styles',     icon: '👃' },
  { pts: 150, label: 'Hair',            icon: '💇' },
  { pts: 200, label: 'Mouth styles',    icon: '😄' },
  { pts: 300, label: 'Auras & extras',  icon: '✨' },
  { pts: 500, label: 'Scars & marks',   icon: '🔱' },
]

const ROLE_META = {
  lab:         { label: 'Lab Member',        bg: '#EDE9FE', color: '#6D28D9' },
  participant: { label: 'Participant',       bg: '#DBEAFE', color: '#1D4ED8' },
  public:      { label: 'Public Researcher', bg: 'var(--bgp)', color: 'var(--pkd)' },
}

export default function ProfilePage({ session }) {
  const user          = session?.user
  const userId        = user?.id
  const emailFallback = user?.email?.split('@')[0] || 'researcher'
  const queryClient   = useQueryClient()

  const [editing,   setEditing]   = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState(null)

  const { data: avatarData } = useAvatarConfig(userId)

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles')
        .select('display_name, role, points').eq('id', userId).maybeSingle()
      return data
    },
    enabled: !!userId,
  })

  const { data: sessionCount } = useQuery({
    queryKey: ['sessionCount', userId],
    queryFn: async () => {
      const { count } = await supabase.from('game_sessions')
        .select('id', { count: 'exact', head: true }).eq('user_id', userId)
      return count ?? 0
    },
    enabled: !!userId,
  })

  const displayName = profile?.display_name || user?.user_metadata?.display_name || emailFallback
  const role        = profile?.role || 'public'

  // Your name is stored TWICE: profiles.display_name (read here, and by every
  // admin list) and auth user_metadata.display_name (read by the Dashboard
  // greeting and Nav's avatar initial). `handle_new_user` copies metadata →
  // profiles once at signup and never again, so a rename must write both or
  // the Dashboard keeps greeting you by the old name (Norm hit exactly this,
  // 2026-07-31). UPDATE, not upsert: profiles has no INSERT policy for
  // `authenticated` — the row is created by the signup trigger — and .update()
  // matching zero rows reports success, so .select() is what proves it landed.
  async function saveName() {
    const name = nameInput.trim()
    if (!name || name === profile?.display_name) { setEditing(false); return }
    setSaving(true)

    const { data: rows, error: dbErr } = await supabase.from('profiles')
      .update({ display_name: name }).eq('id', userId).select('display_name')

    if (dbErr || !rows?.length) {
      console.error('profiles display_name update:', dbErr ?? 'no row matched')
      setSaveError('Could not save that — please try again.')
      setSaving(false)
      return
    }

    // Emits USER_UPDATED, which App's onAuthStateChange turns into a fresh
    // `session` prop — so the Dashboard greeting changes without a reload.
    const { error: authErr } = await supabase.auth.updateUser({ data: { display_name: name } })
    if (authErr) console.error('auth updateUser display_name:', authErr)

    queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    setSaveError(authErr ? 'Saved, but the greeting may lag until you sign in again.' : null)
    setEditing(false)
    setSaving(false)
  }
  const points      = profile?.points ?? 0
  const roleMeta    = ROLE_META[role] || ROLE_META.public

  // Progress bar spans the gap between the milestone just passed and the next.
  const nextIdx       = UNLOCK_MILESTONES.findIndex(m => m.pts > points)
  const nextMilestone = nextIdx >= 0 ? UNLOCK_MILESTONES[nextIdx] : null
  const prevPts       = nextMilestone
    ? (UNLOCK_MILESTONES[nextIdx - 1]?.pts ?? 0)
    : (UNLOCK_MILESTONES[UNLOCK_MILESTONES.length - 1]?.pts ?? 0)
  const progressPct   = nextMilestone
    ? Math.round(((points - prevPts) / (nextMilestone.pts - prevPts)) * 100)
    : 100

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>

        <p style={S.eyebrow}>Profile</p>
        <h1 style={S.title}>{displayName}</h1>

        {/* ── Identity ──────────────────────────────────────────── */}
        <div style={S.identityCard}>
          <RippleAvatar
            skinColor={avatarData?.skin_color || '#FDBCB4'}
            eyeColor={avatarData?.eye_color   || '#4A90D9'}
            species={avatarData?.species      ?? 'human'}
            hairStyle={avatarData?.hair_style ?? 'none'}
            hairColor={avatarData?.hair_color ?? '#784421'}
            size={96}
          />
          <div style={S.identitySide}>
            {editing ? (
              <div style={S.nameRow}>
                <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false) }}
                  style={S.nameInput}
                  maxLength={60}
                  aria-label="Your name"
                />
                <button onClick={saveName} disabled={saving} style={S.btnSmall}>{saving ? '…' : 'Save'}</button>
                <button onClick={() => setEditing(false)} style={S.btnGhost}>Cancel</button>
              </div>
            ) : (
              <div style={S.nameRow}>
                <span style={S.nameVal}>{displayName}</span>
                <button
                  onClick={() => { setNameInput(profile?.display_name ?? displayName); setEditing(true); setSaveError(null) }}
                  style={S.btnGhost}
                >
                  Rename
                </button>
              </div>
            )}

            <span style={{ ...S.roleBadge, background: roleMeta.bg, color: roleMeta.color }}>
              {roleMeta.label}
            </span>
            <p style={S.identityNote}>
              This is what the platform calls <em>you</em>. Your Ripple&rsquo;s own
              name and face live on <Link to="/ripple" style={S.inlineLink}>My Ripple</Link>.
            </p>

            {saveError && <p style={S.error}>{saveError}</p>}
          </div>
        </div>

        {/* ── Account ───────────────────────────────────────────── */}
        <p style={S.secLabel}>// Account</p>
        <div style={S.card}>
          <Row label="Email"        val={user?.email} />
          <Row label="User ID"      val={userId ? `${userId.slice(0, 8)}…` : '—'} mono />
          <Row label="Account type" val={roleMeta.label} />
          <Row label="Member since" val={memberSince} last />
        </div>

        {/* ── Points & progress ─────────────────────────────────── */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Points &amp; Progress</p>
        <div style={S.card}>
          <div style={S.pointsRow}>
            <span style={S.pointsNum}>{points}</span>
            <span style={S.pointsUnit}>points</span>
          </div>
          {nextMilestone ? (
            <>
              <div style={S.progressTrack}>
                <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
              </div>
              <p style={S.progressNote}>
                <span style={{ fontFamily: MONO, color: 'var(--pk)' }}>{nextMilestone.pts - points} pts</span>
                {' until '}
                <strong>{nextMilestone.icon} {nextMilestone.label}</strong>
                {' unlocks'}
              </p>
            </>
          ) : (
            <p style={S.progressNote}>All features unlocked!</p>
          )}
        </div>

        {/* ── Unlock tracker ────────────────────────────────────── */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Unlock Tracker</p>
        <div style={S.card}>
          {UNLOCK_MILESTONES.map((m, i) => {
            const unlocked = points >= m.pts
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

        {/* ── Activity ──────────────────────────────────────────── */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Activity</p>
        <div style={S.card}>
          <div style={S.activityRow}>
            <span style={S.activityNum}>{sessionCount ?? '—'}</span>
            <span style={S.activityLabel}>game sessions completed</span>
          </div>
        </div>

      </div>
    </div>
  )
}

function Row({ label, val, mono = false, last = false }) {
  return (
    <div style={{ ...S.row, borderBottom: last ? 'none' : '1px solid var(--bd)' }}>
      <span style={S.rowLabel}>{label}</span>
      <span style={{ ...S.rowVal, ...(mono ? { fontFamily: MONO } : {}) }}>{val ?? '—'}</span>
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

  identityCard: {
    background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 12,
    padding: 24, display: 'flex', alignItems: 'center', gap: 24,
    flexWrap: 'wrap', marginBottom: 40,
  },
  identitySide: { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' },
  roleBadge: {
    display: 'inline-block', fontFamily: MONO, fontSize: 12,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    padding: '5px 10px', borderRadius: 12,
  },
  identityNote: { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', margin: 0, lineHeight: 1.55 },
  inlineLink:   { color: 'var(--pk)' },

  // Rename controls — same shapes as MyRipplePage's, so renaming yourself and
  // renaming your Ripple look and behave identically.
  nameRow: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  nameVal: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)' },
  nameInput: {
    fontFamily: SANS, fontSize: 16, padding: '8px 12px', minWidth: 0, width: 180,
    borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)',
  },
  btnSmall: {
    fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: '8px 14px', borderRadius: 24,
    background: 'var(--pk)', color: '#fff', border: 'none', cursor: 'pointer',
  },
  btnGhost: {
    fontFamily: MONO, fontSize: 12, color: 'var(--pk)', background: 'none',
    border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.05em',
  },
  error: { fontFamily: SANS, fontSize: 13, color: 'var(--err-tx)', margin: 0 },

  secLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gy)', marginBottom: 14 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24 },

  row:      { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '12px 0' },
  rowLabel: { fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gy)' },
  rowVal:   { fontFamily: SANS, fontSize: 14, color: 'var(--tx)', textAlign: 'right', wordBreak: 'break-word' },

  pointsRow:  { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 },
  pointsNum:  { fontFamily: MONO, fontSize: 36, color: 'var(--tx)' },
  pointsUnit: { fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gy)' },
  progressTrack: { height: 8, borderRadius: 4, background: 'var(--bgp)', overflow: 'hidden' },
  progressFill:  { height: '100%', background: 'var(--pk)', borderRadius: 4, transition: 'width 0.3s' },
  progressNote:  { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', marginTop: 10 },

  unlockRow:   { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' },
  unlockInfo:  { flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  unlockLabel: { fontFamily: SANS, fontSize: 14 },
  unlockedTag: {
    fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--pkd)', background: 'var(--bgp)', padding: '2px 8px', borderRadius: 12,
  },
  unlockPts: { fontFamily: MONO, fontSize: 12, color: 'var(--gy)' },

  activityRow:   { display: 'flex', alignItems: 'baseline', gap: 10 },
  activityNum:   { fontFamily: MONO, fontSize: 28, color: 'var(--tx)' },
  activityLabel: { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)' },
}
