import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import RippleAvatar from '../ripple/RippleAvatar'
import { useAvatarConfig } from '../hooks/useAvatarConfig'

// ── MyRipplePage (/ripple) ────────────────────────────────────────────────
// The Ripple itself: what it looks like, what it's called, how the two of you
// are doing. Split out of the old do-everything /profile 2026-07-30 (Norm's
// account-menu IA rework) — account facts moved to /profile, and every
// prompt/reminder control moved to /settings.
//
// Customization lives at /profile/avatar (AvatarEditor), which is also the
// first-login avatar step, so it stays its own route rather than inlining here.

export default function MyRipplePage({ session }) {
  const userId = session?.user?.id

  const { data: avatarData } = useAvatarConfig(userId)

  const [ripple,       setRipple]       = useState(null)
  const [checkinCount, setCheckinCount] = useState(null)
  const [editing,      setEditing]      = useState(false)
  const [nameInput,    setNameInput]    = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      supabase.from('ripples')
        .select('name, streak_current, streak_best, last_checkin_on')
        .eq('user_id', userId).maybeSingle(),
      supabase.from('ripple_checkins')
        .select('local_date', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]).then(([{ data: r }, { count }]) => {
      if (cancelled) return
      setRipple(r ?? {})
      setCheckinCount(count ?? 0)
    })
    return () => { cancelled = true }
  }, [userId])

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
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
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
                  <button
                    onClick={() => { setNameInput(ripple?.name ?? ''); setEditing(true) }}
                    style={S.btnGhost}
                  >
                    Rename
                  </button>
                )}
              </div>
            )}

            <p style={S.portraitNote}>
              Your Ripple mirrors how you arrive. Change its face, species, or hair
              any time — nothing is locked in.
            </p>

            <Link to="/profile/avatar" style={S.editBtn}>Customize appearance</Link>

            {saveError && <p style={S.error}>{saveError}</p>}
          </div>
        </div>

        {/* ── Together so far ───────────────────────────────────── */}
        <p style={S.secLabel}>// Together so far</p>
        <div style={S.card}>
          <div style={S.statRow}>
            {[
              { label: 'current streak', value: `${ripple?.streak_current ?? 0}d` },
              { label: 'best streak',    value: `${ripple?.streak_best    ?? 0}d` },
              { label: 'check-ins',      value: checkinCount ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={S.statLabel}>{label}</div>
                <div style={S.statValue}>{value}</div>
              </div>
            ))}
          </div>
          <p style={S.cardFoot}>
            How often your Ripple prompts you — and whether it emails —
            lives in <Link to="/settings" style={S.inlineLink}>Settings</Link>.
          </p>
        </div>

      </div>
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
  btnGhost: {
    fontFamily: MONO, fontSize: 12, color: 'var(--pk)', background: 'none',
    border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.05em',
  },
  editBtn: {
    display: 'inline-block', fontFamily: SANS, fontWeight: 600, fontSize: 14,
    padding: '10px 16px', borderRadius: 24,
    background: 'var(--bgp)', color: 'var(--pkd)', textDecoration: 'none',
  },

  secLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gy)', marginBottom: 14 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24 },
  statRow:   { display: 'flex', gap: 40, flexWrap: 'wrap' },
  statLabel: { fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gy)', marginBottom: 4 },
  statValue: { fontFamily: MONO, fontSize: 20, color: 'var(--tx)' },
  cardFoot:  { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', margin: '18px 0 0', paddingTop: 16, borderTop: '1px solid var(--bd)' },
  inlineLink:{ color: 'var(--pk)' },

  error: { fontFamily: SANS, fontSize: 13, color: 'var(--err-tx)', margin: 0 },
}
