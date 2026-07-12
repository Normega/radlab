import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import RippleAvatar from '../ripple/RippleAvatar'
import { useAvatarConfig } from '../hooks/useAvatarConfig'

function useProfile(userId) {
  return useQuery({
    queryKey: ['nav-profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('role, super_admin').eq('id', userId).single()
      return data
    },
  })
}

export default function Nav({ session }) {
  const navigate = useNavigate()
  const userId   = session?.user?.id

  const { data: avatarData } = useAvatarConfig(userId)
  const { data: profile }    = useProfile(userId)

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
            {(profile?.role === 'lab' || profile?.super_admin === true) && (
              <Link to="/admin" style={S.link}>Admin</Link>
            )}
            <button style={S.btnOutline} onClick={handleSignOut}>Sign out</button>
            <Link to="/profile" style={S.avatarCircle}>
              {avatarData ? (
                <RippleAvatar skinColor={avatarData.skin_color} eyeColor={avatarData.eye_color} species={avatarData.species ?? 'human'} hairStyle={avatarData.hair_style ?? 'none'} hairColor={avatarData.hair_color ?? '#784421'} valence={0} arousal={0} size={36} />
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
