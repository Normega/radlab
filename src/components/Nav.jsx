import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAvatarConfig } from '../hooks/useAvatarConfig'
import { useDisplayName } from '../hooks/useDisplayName'
import ButtonNav from './ui/ButtonNav'
import MenuAvatar from './ui/MenuAvatar'
import PrimaryCTA from './ui/PrimaryCTA'
import SecondaryCTA from './ui/SecondaryCTA'

/**
 * Header (Guest / User) — Onboarding Redesign v1 (Figma node 161:1068).
 * Rewritten in place from the legacy Nav (Phase 2; DRIFT-REPORT §9 + review
 * decision 2026-07-16) so all existing <Nav session={...} /> mounts get the
 * redesign header at once.
 *
 * Consistent-header rule (Dev Spec §2): Dashboard · Games · About always
 * visible. For guests, Dashboard stays preview-only — visible, inert (§9 Q7);
 * Games became a real link 2026-07-30 when /games went public read-only
 * (revised Games Page, Figma 4047:3653). About points at /platform (the
 * redesign About page).
 * Admin pill is a live-site necessity for lab users (not in Figma; kept
 * per the Phase 2 header-swap decision).
 *
 * Mobile (<md): nav pills collapse into a drawer; primary auth action
 * (Join free / avatar) stays visible in the bar (Dev Spec §6.3 recommended
 * behavior — provisional until a real mobile design exists).
 */

function useClassLinks(userId) {
  return useQuery({
    queryKey: ['nav-classes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('class_members').select('classes(slug)').eq('user_id', userId)
      return (data ?? [])
        .map(r => r.classes?.slug).filter(Boolean).sort()
        .map(slug => ({ to: `/academic/${slug}/lounge`, label: `${slug.toUpperCase()} Lecture Lounge` }))
    },
  })
}

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
  const { data: classLinks } = useClassLinks(userId)
  const isAdmin = profile?.role === 'lab' || profile?.super_admin === true

  // Same name the Dashboard greets you by — both read profiles.display_name
  // through the shared hook, so the initial can't drift from the greeting.
  const { displayName } = useDisplayName(session?.user, '')
  const initial = (displayName?.[0] || session?.user?.email?.[0] || '?').toUpperCase()

  async function handleSignOut() {
    setOpen(false)
    await supabase.auth.signOut()
    navigate('/')
  }

  // Close the mobile drawer on navigation. The account menu closes itself —
  // its state is per-instance, see AccountMenu.
  useEffect(() => { setOpen(false) }, [location.pathname])

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
      <ButtonNav to="/games" active={isActive('/games')} onClick={() => setOpen(false)}>Games</ButtonNav>
      <ButtonNav to="/platform" active={isActive('/platform')} onClick={() => setOpen(false)}>About</ButtonNav>
    </>
  )

  // Account menu. The avatar used to be a bare link to /profile with a
  // separate "Sign out" button beside it; since 2026-07-30 it opens this menu
  // and Sign out lives inside it (Norm's IA rework).
  const avatarMenu = session && (
    <AccountMenu
      onSignOut={handleSignOut}
      classLinks={classLinks}
      trigger={<MenuAvatar avatarData={avatarData} initial={initial} />}
    />
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
          {session ? avatarMenu : (
            <>
              <SecondaryCTA to="/login">Log in</SecondaryCTA>
              <PrimaryCTA to="/signup">Join free</PrimaryCTA>
            </>
          )}
        </div>

        {/* Mobile: primary action + hamburger */}
        <div style={S.links} className="flex md:hidden">
          {session ? avatarMenu : (
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

      {/* Mobile drawer — same items, same guest inert rule. Signed-in account
          actions are NOT repeated here; they live in the avatar menu, which
          stays visible in the bar on mobile. */}
      {open && (
        <div style={S.drawer} className="md:hidden">
          {navItems}
          {!session && (
            <SecondaryCTA to="/login" onClick={() => setOpen(false)} style={{ alignSelf: 'stretch' }}>Log in</SecondaryCTA>
          )}
        </div>
      )}
    </nav>
  )
}

// ── ACCOUNT MENU ──────────────────────────────────────────────────────────
// Avatar button + dropdown (My Ripple / Account / Sign out). Closes on
// outside click, on Escape, and on route change.
//
// Rendered TWICE — once in the desktop bar, once in the mobile bar — with one
// copy always `display:none`. Each instance therefore owns its `open` state
// locally; it must NOT be lifted into Nav and shared.
//
// Why (bug, 2026-07-30): with a single shared `open`, both copies mounted a
// dropdown and both attached a document `mousedown` listener. Clicking an item
// in the visible menu fired the HIDDEN copy's outside-click handler too — its
// wrapper doesn't contain the visible item — which closed the menu on
// mousedown, unmounting the <Link> before the browser could fire `click`. The
// menu just vanished and nothing navigated. Per-instance state means only the
// copy you actually opened has a listener at all.

const MENU_ITEMS = [
  { to: '/ripple',  label: 'My Ripple' },
  { to: '/account', label: 'Account' },
]

// Link or button depending on whether `to` is given, with a hover fill —
// inline styles can't express :hover, and a menu without hover feedback reads
// as inert. `active` mirrors ButtonNav's own default/active split (Figma's
// New Header/DropdownOverlay notes, 2026-08-13): Text/Secondary by default,
// Text/Main when the item matches the current route, same as the pills
// outside the overlay. Sign out keeps its own color regardless of active.
function MenuItem({ to, active = false, onClick, style, children }) {
  const [hover, setHover] = useState(false)
  const s = {
    ...S.menuItem,
    color: active ? 'var(--tx)' : 'var(--tx2)',
    ...style,
    ...(hover ? S.menuItemHover : {}),
  }
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onFocus:      () => setHover(true),
    onBlur:       () => setHover(false),
  }
  if (to) return <Link to={to} role="menuitem" style={s} {...handlers}>{children}</Link>
  return <button type="button" role="menuitem" onClick={onClick} style={s} {...handlers}>{children}</button>
}

function AccountMenu({ onSignOut, trigger, classLinks }) {
  const [open, setOpen] = useState(false)
  const wrapRef  = useRef(null)
  const { pathname } = useLocation()

  // The items are <Link>s, which change the route without unmounting Nav.
  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!open) return
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={S.menuWrap}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={S.avatarRing}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </button>

      {open && (
        <div style={S.menu} role="menu">
          {/* Prefix match, not exact — /account has no sub-routes today, but
              stays active on any it grows (2026-08-13 review decision). */}
          {(classLinks ?? []).map(({ to, label }) => (
            <MenuItem key={to} to={to} active={pathname.startsWith(to)}>{label}</MenuItem>
          ))}
          {!!classLinks?.length && <div style={S.menuDivider} />}
          {MENU_ITEMS.map(({ to, label }) => (
            <MenuItem key={to} to={to} active={pathname.startsWith(to)}>{label}</MenuItem>
          ))}
          <div style={S.menuDivider} />
          <MenuItem onClick={onSignOut} style={S.menuSignOut}>Sign out</MenuItem>
        </div>
      )}
    </div>
  )
}

const S = {
  nav: {
    background: 'rgba(252,240,245,0.97)',
    borderBottom: '1px solid var(--pkbs)', /* visible divider, matches Landing + LabLayout */
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
    padding: 0, borderRadius: 24, flexShrink: 0,
    border: 'none',
    background: 'transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', cursor: 'pointer',
    lineHeight: 0,
  },

  // ── account menu ──
  menuWrap: { position: 'relative', display: 'inline-flex', flexShrink: 0 },
  menu: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 20,
    minWidth: 184, padding: 6,
    background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 12,
    boxShadow: '0 10px 28px rgba(180,100,140,0.16)',
    display: 'flex', flexDirection: 'column',
  },
  menuItem: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '10px 12px', borderRadius: 8, border: 'none',
    background: 'transparent', cursor: 'pointer',
    fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600, fontSize: 14,
    color: 'var(--tx)', textDecoration: 'none', whiteSpace: 'nowrap',
  },
  menuItemHover: { background: 'var(--bgp)' },
  menuDivider: { height: 1, background: 'var(--bd)', margin: '6px 4px' },
  menuSignOut: { color: 'var(--pkd)' },
}
