import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import BaseAvatar from '../components/Avatar/BaseAvatar'
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
  const userId      = session?.user?.id
  const emailFallback = session?.user?.email?.split('@')[0] || 'researcher'

  const { data: avatarData } = useAvatarConfig(userId)

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
  const nextIdx     = UNLOCK_MILESTONES.findIndex(m => m.pts > points)
  const nextMilestone = nextIdx >= 0 ? UNLOCK_MILESTONES[nextIdx] : null
  const prevPts     = nextMilestone
    ? (UNLOCK_MILESTONES[nextIdx - 1]?.pts ?? 0)
    : (UNLOCK_MILESTONES[UNLOCK_MILESTONES.length - 1]?.pts ?? 0)
  const progressPct = nextMilestone
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
            <BaseAvatar skinColor={skinColor} eyeColor={eyeColor} species={avatarData?.species ?? 'human'} hairStyle={hairStyle} hairColor={hairColor} size={160} />
          </div>
          <div style={S.avatarInfo}>
            <h1 style={S.displayName}>{displayName}</h1>
            <span style={{ ...S.roleBadge, background: roleMeta.bg, color: roleMeta.color }}>
              {roleMeta.label}
            </span>
            <Link to="/profile/avatar" style={S.editBtn}>Edit Avatar</Link>
          </div>
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

  secLabel:    { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 16 },
  card:        { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '20px 24px', overflow: 'hidden' },

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
