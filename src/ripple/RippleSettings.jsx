import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import { useAvatarConfig } from '../hooks/useAvatarConfig'
import RippleAvatar from './RippleAvatar'

// Ripple WP4 — settings + disable path.
// Route: /ripple/settings  (ProtectedRoute, inside Ripple ErrorBoundary)

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

export default function RippleSettings({ session }) {
  const userId = session?.user?.id ?? null
  const { data: avatar } = useAvatarConfig(userId)

  const [ripple,       setRipple]       = useState(null)
  const [checkinCount, setCheckinCount] = useState(null)
  const [editing,      setEditing]      = useState(false)
  const [nameInput,    setNameInput]    = useState('')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('ripples')
        .select('name, streak_current, streak_best, check_in_enabled, last_checkin_on')
        .eq('user_id', userId).maybeSingle(),
      supabase.from('ripple_checkins')
        .select('local_date', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]).then(([{ data: r }, { count }]) => {
      setRipple(r ?? {})
      setCheckinCount(count ?? 0)
    })
  }, [userId])

  async function saveName() {
    const name = nameInput.trim()
    if (!name || name === ripple?.name) { setEditing(false); return }
    setSaving(true)
    await supabase.from('ripples').update({ name }).eq('user_id', userId)
    setRipple(r => ({ ...r, name }))
    setSaving(false)
    setEditing(false)
  }

  async function toggleCheckIn() {
    const next = !(ripple?.check_in_enabled !== false)
    await supabase.from('ripples').update({ check_in_enabled: next }).eq('user_id', userId)
    setRipple(r => ({ ...r, check_in_enabled: next }))
  }

  const enabled = ripple?.check_in_enabled !== false

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px' }}>

        <p style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 24 }}>
          // Ripple settings
        </p>

        {/* Identity card */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: ripple ? 20 : 0 }}>
            <RippleAvatar
              skinColor={avatar?.skin_color ?? '#FDBCB4'}
              eyeColor={avatar?.eye_color   ?? '#4A90D9'}
              species={avatar?.species      ?? 'human'}
              hairStyle={avatar?.hair_style ?? 'none'}
              hairColor={avatar?.hair_color ?? '#784421'}
              valence={0} arousal={0} intensityT={0} pupilTier={1}
              size={72}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false) }}
                    style={{
                      fontFamily: SERIF, fontSize: 22, border: 'none',
                      borderBottom: '2px solid var(--pk)', background: 'transparent',
                      color: 'var(--tx)', outline: 'none', minWidth: 0, flex: 1, padding: '2px 0',
                    }}
                  />
                  <button onClick={saveName} disabled={saving} style={S.btnSmall}>
                    {saving ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} style={{ ...S.btnSmall, background: 'var(--bgp)', color: 'var(--tx2)', border: '1px solid var(--bd)' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', fontWeight: 400, margin: 0 }}>
                    {ripple?.name ?? (ripple === null ? '…' : '—')}
                  </h1>
                  {ripple && (
                    <button
                      onClick={() => { setNameInput(ripple?.name ?? ''); setEditing(true) }}
                      style={{ fontFamily: MONO, fontSize: 11, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em', padding: 0 }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
              <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', margin: '4px 0 0' }}>Your Ripple</p>
            </div>
          </div>

          {ripple && (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'streak',      value: `${ripple.streak_current ?? 0}d` },
                { label: 'best streak', value: `${ripple.streak_best    ?? 0}d` },
                { label: 'check-ins',   value: checkinCount ?? '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 17, color: 'var(--tx)', fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Check-in toggle */}
        <div style={{ ...S.card, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: MONO, fontSize: 13, color: 'var(--tx)', margin: '0 0 4px', letterSpacing: '0.03em' }}>
                Daily check-in
              </p>
              <p style={{ fontFamily: SANS, fontSize: 13, color: 'var(--tx3)', margin: 0, lineHeight: 1.5 }}>
                {enabled
                  ? 'Active — your streak and history are tracking.'
                  : 'Paused — your data is safe and your streak is saved.'}
              </p>
            </div>
            <button
              onClick={ripple ? toggleCheckIn : undefined}
              disabled={!ripple}
              style={{ ...S.toggle, background: enabled ? 'var(--pk)' : 'var(--bds)' }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: 'white',
                transform: enabled ? 'translateX(20px)' : 'translateX(2px)',
                transition: 'transform 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
              }} />
            </button>
          </div>
        </div>

        {/* Footer links */}
        <div style={{ display: 'flex', gap: 20, marginTop: 28, fontFamily: MONO, fontSize: 12, letterSpacing: '0.05em' }}>
          {enabled && (
            <Link to="/checkin" style={{ color: 'var(--pk)', textDecoration: 'none' }}>Check in now →</Link>
          )}
          <Link to="/dashboard" style={{ color: 'var(--tx3)', textDecoration: 'none' }}>← Dashboard</Link>
        </div>
      </div>
    </div>
  )
}

const S = {
  card: {
    background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 16, padding: '22px 24px',
  },
  btnSmall: {
    fontFamily: MONO, fontSize: 12, padding: '5px 12px', borderRadius: 8,
    background: 'var(--pk)', color: 'white', border: 'none', cursor: 'pointer',
  },
  toggle: {
    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
    padding: 0, flexShrink: 0, transition: 'background 0.2s',
    display: 'flex', alignItems: 'center',
  },
}
