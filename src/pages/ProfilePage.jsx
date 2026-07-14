import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import RippleAvatar from '../ripple/RippleAvatar'
import { useAvatarConfig } from '../hooks/useAvatarConfig'

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
  participant: { label: 'Participant',        bg: '#DBEAFE', color: '#1D4ED8' },
  public:      { label: 'Public Researcher',  bg: 'var(--bgp)', color: 'var(--pkd)' },
}

export default function ProfilePage({ session }) {
  const userId        = session?.user?.id
  const emailFallback = session?.user?.email?.split('@')[0] || 'researcher'

  const { data: avatarData } = useAvatarConfig(userId)

  // ── Ripple state (local — mutations happen here) ──────────────────────────
  const [ripple,       setRipple]       = useState(null)
  const [checkinCount, setCheckinCount] = useState(null)
  const [editing,      setEditing]      = useState(false)
  const [nameInput,    setNameInput]    = useState('')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('ripples')
        .select('name, streak_current, streak_best, check_in_enabled, prompt_cadence, last_checkin_on, reminder_enabled, reminder_time')
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

  async function saveCadence(cadence) {
    await supabase.from('ripples').update({ prompt_cadence: cadence }).eq('user_id', userId)
    setRipple(r => ({ ...r, prompt_cadence: cadence }))
  }

  async function saveReminderEnabled(next) {
    await supabase.from('ripples').update({ reminder_enabled: next }).eq('user_id', userId)
    setRipple(r => ({ ...r, reminder_enabled: next }))
  }

  async function saveReminderTime(time) {
    await supabase.from('ripples').update({ reminder_time: time }).eq('user_id', userId)
    setRipple(r => ({ ...r, reminder_time: time }))
  }

  const enabled        = ripple?.check_in_enabled !== false
  const cadence        = ripple?.prompt_cadence ?? 'daily'
  const reminderOn     = ripple?.reminder_enabled === true
  const reminderTime   = ripple?.reminder_time ?? 'morning'

  // ── Profile / gamification (read-only) ───────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('display_name, role, points').eq('id', userId).maybeSingle()
      return data
    },
    enabled: !!userId,
  })

  const { data: sessionCount } = useQuery({
    queryKey: ['sessionCount', userId],
    queryFn: async () => {
      const { count } = await supabase.from('game_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      return count ?? 0
    },
    enabled: !!userId,
  })

  const displayName = profile?.display_name || session?.user?.user_metadata?.display_name || emailFallback
  const role        = profile?.role || 'public'
  const points      = profile?.points ?? 0
  const roleMeta    = ROLE_META[role] || ROLE_META.public

  // Progress bar: distance between the milestone just passed and the next one
  const nextIdx       = UNLOCK_MILESTONES.findIndex(m => m.pts > points)
  const nextMilestone = nextIdx >= 0 ? UNLOCK_MILESTONES[nextIdx] : null
  const prevPts       = nextMilestone
    ? (UNLOCK_MILESTONES[nextIdx - 1]?.pts ?? 0)
    : (UNLOCK_MILESTONES[UNLOCK_MILESTONES.length - 1]?.pts ?? 0)
  const progressPct   = nextMilestone
    ? Math.round(((points - prevPts) / (nextMilestone.pts - prevPts)) * 100)
    : 100

  const skinColor = avatarData?.skin_color  || '#FDBCB4'
  const eyeColor  = avatarData?.eye_color   || '#4A90D9'
  const hairStyle = avatarData?.hair_style  ?? 'none'
  const hairColor = avatarData?.hair_color  ?? '#784421'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>

        {/* ── Avatar card ─────────────────────────────────────────── */}
        <div style={S.avatarCard}>
          <div style={S.avatarPreview}>
            <RippleAvatar skinColor={skinColor} eyeColor={eyeColor} species={avatarData?.species ?? 'human'} hairStyle={hairStyle} hairColor={hairColor} size={160} />
          </div>
          <div style={S.avatarInfo}>
            <h1 style={S.displayName}>{displayName}</h1>
            <span style={{ ...S.roleBadge, background: roleMeta.bg, color: roleMeta.color }}>
              {roleMeta.label}
            </span>
            <Link to="/profile/avatar" style={S.editBtn}>Edit avatar</Link>
          </div>
        </div>

        {/* ── Ripple ──────────────────────────────────────────────── */}
        <p style={S.secLabel}>// Ripple</p>

        {/* Identity + stats */}
        <div style={S.card}>
          {editing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: ripple ? 16 : 0 }}>
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false) }}
                style={S.nameInput}
              />
              <button onClick={saveName} disabled={saving} style={S.btnSmall}>
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} style={S.btnSmallGhost}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: ripple ? 16 : 0 }}>
              <span style={S.rippleName}>
                {ripple?.name ?? (ripple === null ? '…' : '—')}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--tx3)' }}>your ripple</span>
              {ripple && (
                <button
                  onClick={() => { setNameInput(ripple?.name ?? ''); setEditing(true) }}
                  style={{ fontFamily: MONO, fontSize: 11, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em', padding: 0, marginLeft: 4 }}
                >
                  Edit
                </button>
              )}
            </div>
          )}

          {ripple && (
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
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

        {/* Check-in toggle + cadence */}
        <div style={{ ...S.card, marginTop: 10, marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: MONO, fontSize: 13, color: 'var(--tx)', margin: '0 0 4px', letterSpacing: '0.03em' }}>
                Daily check-in
              </p>
              <p style={{ fontSize: 13, color: 'var(--tx3)', margin: 0, lineHeight: 1.5 }}>
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

          {ripple && enabled && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
              <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', margin: '0 0 10px' }}>
                Prompt frequency
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'every_login', label: 'Every login' },
                  { key: 'daily',       label: 'Once daily' },
                  { key: 'weekly',      label: 'Weekly' },
                  { key: 'never',       label: 'Never' },
                ].map(({ key, label }) => {
                  const active = cadence === key
                  return (
                    <button key={key} onClick={() => saveCadence(key)} style={{
                      fontFamily: MONO, fontSize: 12, padding: '6px 14px', borderRadius: 8,
                      background: active ? 'var(--pk)' : 'var(--bgp)',
                      color: active ? 'white' : 'var(--tx2)',
                      border: `1.5px solid ${active ? 'var(--pk)' : 'var(--bd)'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {ripple && enabled && cadence !== 'never' && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: reminderOn ? 14 : 0 }}>
                <div>
                  <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', margin: '0 0 3px' }}>
                    Email reminders
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--tx3)', margin: 0, lineHeight: 1.4 }}>
                    {reminderOn ? 'Sending at your chosen time.' : 'Off — no reminder emails.'}
                  </p>
                </div>
                <button
                  onClick={() => saveReminderEnabled(!reminderOn)}
                  style={{ ...S.toggle, background: reminderOn ? 'var(--pk)' : 'var(--bds)', flexShrink: 0 }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'white',
                    transform: reminderOn ? 'translateX(20px)' : 'translateX(2px)',
                    transition: 'transform 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                  }} />
                </button>
              </div>

              {reminderOn && (
                <div>
                  <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', margin: '0 0 8px' }}>
                    Time of day (Toronto)
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { key: 'morning', label: 'Morning', sub: '8 AM' },
                      { key: 'midday',  label: 'Midday',  sub: '12 PM' },
                      { key: 'evening', label: 'Evening', sub: '7 PM' },
                    ].map(({ key, label, sub }) => {
                      const active = reminderTime === key
                      return (
                        <button key={key} onClick={() => saveReminderTime(key)} style={{
                          fontFamily: MONO, fontSize: 12, padding: '6px 14px', borderRadius: 8,
                          background: active ? 'var(--pk)' : 'var(--bgp)',
                          color: active ? 'white' : 'var(--tx2)',
                          border: `1.5px solid ${active ? 'var(--pk)' : 'var(--bd)'}`,
                          cursor: 'pointer', transition: 'all 0.15s',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                        }}>
                          <span>{label}</span>
                          <span style={{ fontSize: 10, opacity: 0.75 }}>{sub}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Points & progress ───────────────────────────────────── */}
        <p style={S.secLabel}>// Points &amp; Progress</p>
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

        {/* ── Unlock tracker ──────────────────────────────────────── */}
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
                  <span style={{ ...S.unlockLabel, color: unlocked ? 'var(--tx)' : 'var(--tx3)' }}>
                    {m.label}
                  </span>
                  {unlocked && <span style={S.unlockedTag}>Unlocked</span>}
                </div>
                <span style={S.unlockPts}>{m.pts} pts</span>
              </div>
            )
          })}
        </div>

        {/* ── Activity summary ────────────────────────────────────── */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Activity</p>
        <div style={S.card}>
          <div style={S.statRow}>
            <span style={S.statNum}>{sessionCount ?? '—'}</span>
            <span style={S.statLabel}>game sessions completed</span>
          </div>
        </div>

      </div>
    </div>
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  wrap:         { maxWidth: 720, margin: '0 auto', padding: '48px 24px' },

  avatarCard:   {
    background: 'var(--bgc)', border: '1px solid var(--pkbs)',
    borderRadius: 20, padding: '28px',
    display: 'flex', alignItems: 'center', gap: 28,
    marginBottom: 40, flexWrap: 'wrap',
  },
  avatarPreview: { flexShrink: 0 },
  avatarInfo:    { display: 'flex', flexDirection: 'column', gap: 10 },
  displayName:   { fontFamily: SERIF, fontSize: 32, color: 'var(--tx)', margin: 0, letterSpacing: -0.5 },
  roleBadge: {
    display: 'inline-block', fontFamily: MONO, fontSize: 12,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    padding: '4px 10px', borderRadius: 6, alignSelf: 'flex-start',
  },
  editBtn: {
    display: 'inline-block', fontFamily: MONO, fontSize: 12,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    padding: '8px 18px', borderRadius: 10,
    background: 'var(--pk)', color: '#fff',
    textDecoration: 'none', alignSelf: 'flex-start', marginTop: 4,
  },

  secLabel:  { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 16 },
  card:      { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '20px 24px', overflow: 'hidden' },

  rippleName:  { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', fontWeight: 400 },
  nameInput:   {
    fontFamily: SERIF, fontSize: 22, border: 'none',
    borderBottom: '2px solid var(--pk)', background: 'transparent',
    color: 'var(--tx)', outline: 'none', minWidth: 0, flex: 1, padding: '2px 0',
  },
  btnSmall: {
    fontFamily: MONO, fontSize: 12, padding: '5px 12px', borderRadius: 8,
    background: 'var(--pk)', color: 'white', border: 'none', cursor: 'pointer',
  },
  btnSmallGhost: {
    fontFamily: MONO, fontSize: 12, padding: '5px 12px', borderRadius: 8,
    background: 'var(--bgp)', color: 'var(--tx2)', border: '1px solid var(--bd)', cursor: 'pointer',
  },
  toggle: {
    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
    padding: 0, flexShrink: 0, transition: 'background 0.2s',
    display: 'flex', alignItems: 'center',
  },

  pointsRow:   { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  pointsNum:   { fontFamily: MONO, fontSize: 52, color: 'var(--pk)', lineHeight: 1 },
  pointsUnit:  { fontFamily: MONO, fontSize: 13, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: 2 },
  progressTrack: { height: 10, borderRadius: 999, background: 'var(--bgp)', overflow: 'hidden', marginBottom: 10 },
  progressFill:  { height: '100%', borderRadius: 999, background: 'var(--pk)', transition: 'width 0.6s ease' },
  progressNote:  { fontSize: 13, color: 'var(--tx2)', margin: 0 },

  unlockRow:   { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' },
  unlockInfo:  { flex: 1, display: 'flex', alignItems: 'center', gap: 8 },
  unlockLabel: { fontSize: 14 },
  unlockedTag: {
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
    background: '#D1FAE5', color: '#065F46', borderRadius: 5, padding: '2px 7px',
  },
  unlockPts:   { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', background: 'var(--bg)', borderRadius: 6, padding: '2px 8px' },

  statRow:     { display: 'flex', alignItems: 'baseline', gap: 10 },
  statNum:     { fontFamily: MONO, fontSize: 36, color: 'var(--tx)', lineHeight: 1 },
  statLabel:   { fontSize: 14, color: 'var(--tx2)' },
}
