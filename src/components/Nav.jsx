import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import RippleAvatar from '../ripple/RippleAvatar'
import { useAvatarConfig } from '../hooks/useAvatarConfig'
import ButtonNav from './ui/ButtonNav'
import PrimaryCTA from './ui/PrimaryCTA'
import SecondaryCTA from './ui/SecondaryCTA'

/**
 * Header (Guest / User) — Onboarding Redesign v1 (Figma node 161:1068).
 * Rewritten in place from the legacy Nav (Phase 2; DRIFT-REPORT §9 + review
 * decision 2026-07-16) so all existing <Nav session={...} /> mounts get the
 * redesign header at once.
 *
 * Consistent-header rule (Dev Spec §2): Dashboard · Games · About always
 * visible. For guests, Dashboard/Games are preview-only — visible, inert
 * (§9 Q7) — and About points at /platform (the redesign About page).
 * Admin pill is a live-site necessity for lab users (not in Figma; kept
 * per the Phase 2 header-swap decision).
 *
 * Mobile (<md): nav pills collapse into a drawer; primary auth action
 * (Join free / avatar) stays visible in the bar (Dev Spec §6.3 recommended
 * behavior — provisional until a real mobile design exists).
 */

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
  const navigate  = useNavigate()
  const location  = useLocation()
  const [open, setOpen] = useState(false)
  const userId    = session?.user?.id

  const { data: avatarData } = useAvatarConfig(userId)
  const { data: profile }    = useProfile(userId)
  const isAdmin = profile?.role === 'lab' || profile?.super_admin === true

  const initial = (
    session?.user?.user_metadata?.display_name?.[0] ||
    session?.user?.email?.[0] ||
    '?'
  ).toUpperCase()

  async function handleSignOut() {
    setOpen(false)
    await supabase.auth.signOut()
    navigate('/')
  }

  const isActive = (path) => location.pathname === path

  // The three always-present nav items (consistent-header rule).
  const navItems = session ? (
    <>
      <ButtonNav to="/dashboard" active={isActive('/dashboard')} onClick={() => setOpen(false)}>Dashboard</ButtonNav>
      <ButtonNav to="/games"     active={isActive('/games')}     onClick={() => setOpen(false)}>Games</ButtonNav>
      <ButtonNav to="/platform"  active={isActive('/platform')}  onClick={() => setOpen(false)}>About</ButtonNav>
      {isAdmin && <ButtonNav to="/admin" active={location.pathname.startsWith('/admin')}>Admin</ButtonNav>}
    </>
  ) : (
    <>
      <ButtonNav inert>Dashboard</ButtonNav>
      <ButtonNav inert>Games</ButtonNav>
      <ButtonNav to="/platform" active={isActive('/platform')} onClick={() => setOpen(false)}>About</ButtonNav>
    </>
  )

  const avatarCircle = session && (
    <Link to="/profile" style={S.avatarRing} aria-label="Profile">
      {avatarData ? (
        <RippleAvatar skinColor={avatarData.skin_color} eyeColor={avatarData.eye_color} species={avatarData.species ?? 'human'} hairStyle={avatarData.hair_style ?? 'none'} hairColor={avatarData.hair_color ?? '#784421'} valence={0} arousal={0} size={40} />
      ) : (
        <div style={S.avatarInitial}>{initial}</div>
      )}
    </Link>
  )

  return (
    <nav style={S.nav} className="px-4 md:px-6">
      <div style={S.bar}>
        <Link to="/" style={S.brand}>
          <div className="h-8 md:h-10" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/RADlab_Logo.svg" style={{ height: '100%', display: 'block' }} alt="RADlab logo" />
          </div>
          <span style={S.wordmark}>RAD<b style={{ color: 'var(--pk)', fontWeight: 400 }}>lab</b></span>
        </Link>

        {/* Desktop: full pill nav */}
        <div style={S.links} className="hidden md:flex">
          {navItems}
          {session ? (
            <>
              <SecondaryCTA onClick={handleSignOut}>Sign out</SecondaryCTA>
              {avatarCircle}
            </>
          ) : (
            <>
              <SecondaryCTA to="/login">Log in</SecondaryCTA>
              <PrimaryCTA to="/signup">Join free</PrimaryCTA>
            </>
          )}
        </div>

        {/* Mobile: primary action + hamburger */}
        <div style={S.links} className="flex md:hidden">
          {session ? avatarCircle : (
            <PrimaryCTA to="/signup" style={{ fontSize: 14, padding: '8px 14px' }}>Join free</PrimaryCTA>
          )}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            style={S.burger}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              {open ? (
                <path d="M5 5 L17 17 M17 5 L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M3 6 H19 M3 11 H19 M3 16 H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer — same items, same guest inert rule */}
      {open && (
        <div style={S.drawer} className="md:hidden">
          {navItems}
          {session ? (
            <SecondaryCTA onClick={handleSignOut} style={{ alignSelf: 'stretch' }}>Sign out</SecondaryCTA>
          ) : (
            <SecondaryCTA to="/login" onClick={() => setOpen(false)} style={{ alignSelf: 'stretch' }}>Log in</SecondaryCTA>
          )}
        </div>
      )}
    </nav>
  )
}

const S = {
  nav: {
    background: 'rgba(252,240,245,0.97)',
    borderBottom: '1px solid var(--bgp)',
    position: 'sticky', top: 0, zIndex: 10,
    backdropFilter: 'blur(8px)',
  },
  bar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 0',
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
  links: { alignItems: 'center', gap: 10 },
  burger: {
    width: 44, height: 44, padding: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', borderRadius: 24,
    color: 'var(--tx2)', cursor: 'pointer',
  },
  drawer: {
    display: 'flex', flexDirection: 'column', alignItems: 'stretch',
    gap: 6, padding: '10px 0 16px',
  },
  avatarRing: {
    padding: 3, borderRadius: 24, flexShrink: 0,
    border: '2px solid var(--pk)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', cursor: 'pointer',
    lineHeight: 0,
  },
  avatarInitial: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'var(--pk)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff',
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 15, fontWeight: 400,
  },
}
