import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { to: '/admin/sessions',        label: 'Sessions'       },
  { to: '/admin/studies',         label: 'Studies'        },
  { to: '/admin/questionnaires',  label: 'Questionnaires' },
  { to: '/admin/videos',          label: 'Videos'         },
  { to: '/admin/training',        label: 'Training'       },
  { to: '/admin/compensation',    label: 'Compensation'   },
  { to: '/admin/export',          label: 'Export'         },
]

function Sidebar({ session, onClose }) {
  const navigate = useNavigate()
  const displayName =
    session?.user?.user_metadata?.display_name ||
    session?.user?.email?.split('@')[0] ||
    'Lab member'

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div style={S.sidebar}>
      <Link to="/" style={S.logoLink} onClick={onClose}>
        <img src="/RADlab_Logo_light.svg" alt="RADlab" style={S.logo} />
      </Link>

      <nav style={S.nav}>
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({ ...S.navLink, ...(isActive ? S.navActive : {}) })}
            onClick={onClose}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={S.bottom}>
        <p style={S.userName}>{displayName}</p>
        <Link to="/dashboard" style={S.backLink} onClick={onClose}>← Back to platform</Link>
        <button style={S.signOut} onClick={handleSignOut}>Sign out</button>
      </div>
    </div>
  )
}

export default function AdminLayout({ session }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Desktop sidebar — hidden on mobile via Tailwind */}
      <div className="hidden md:block" style={{ width: 220, flexShrink: 0 }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
          <Sidebar session={session} onClose={() => {}} />
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.32)' }}
          onClick={() => setOpen(false)}
        >
          <div style={{ width: 240, height: '100%', background: '#fff' }} onClick={e => e.stopPropagation()}>
            <Sidebar session={session} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Mobile topbar */}
        <div className="flex md:hidden" style={S.mobilebar}>
          <button style={S.hamburger} onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <Link to="/admin" style={{ fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 18, color: 'var(--tx)', textDecoration: 'none' }}>
            Admin
          </Link>
        </div>

        <div style={S.content}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

const S = {
  sidebar: {
    display: 'flex', flexDirection: 'column',
    height: '100%', minHeight: '100vh',
    background: '#fff',
    borderRight: '1px solid var(--bd)',
    padding: '24px 0',
  },
  logoLink: {
    display: 'block', padding: '0 20px 28px',
    textDecoration: 'none',
  },
  logo: { height: 36, display: 'block' },
  nav: {
    display: 'flex', flexDirection: 'column', gap: 2,
    padding: '0 10px',
  },
  navLink: {
    display: 'block', padding: '9px 12px', borderRadius: 8,
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 14, fontWeight: 500,
    color: 'var(--tx2)', textDecoration: 'none',
  },
  navActive: {
    background: 'var(--pkb)', color: 'var(--pk)',
  },
  bottom: {
    marginTop: 'auto', padding: '20px',
    borderTop: '1px solid var(--bd)',
  },
  userName: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 12, color: 'var(--tx)',
    margin: '0 0 8px', fontWeight: 700,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  backLink: {
    display: 'block', fontSize: 13, color: 'var(--tx2)',
    textDecoration: 'none', marginBottom: 8,
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  signOut: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    fontSize: 13, color: 'var(--gy)',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  mobilebar: {
    alignItems: 'center', gap: 12,
    padding: '12px 16px',
    background: '#fff',
    borderBottom: '1px solid var(--bd)',
  },
  hamburger: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 20, color: 'var(--tx)', padding: '0 4px',
  },
  content: {
    flex: 1, padding: '32px 24px',
    maxWidth: 960, width: '100%', margin: '0 auto',
  },
}
