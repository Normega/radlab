import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Nav({ session }) {
  const navigate = useNavigate()

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
            <button style={S.btnOutline} onClick={handleSignOut}>Sign out</button>
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
  links: { display: 'flex', alignItems: 'center', gap: 12 },
  link: { fontSize: 14, color: 'var(--tx2)', textDecoration: 'none' },
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
}
