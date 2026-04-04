import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

export default function Dashboard({ session }) {
  const navigate   = useNavigate()
  const user       = session?.user
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'researcher'

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />

      <div style={S.wrap}>
        {/* Welcome */}
        <div style={S.header}>
          <div>
            <p style={S.eyebrow}>Dashboard</p>
            <h1 style={S.title}>Hey, {displayName}.</h1>
            <p style={S.sub}>Your lab bench is almost ready.</p>
          </div>
          <div style={S.accountBadge}>
            <p style={S.badgeLabel}>Signed in as</p>
            <p style={S.badgeEmail}>{user?.email}</p>
          </div>
        </div>

        {/* Coming soon game cards */}
        <p style={S.secLabel}>// Games</p>
        <div style={S.gameGrid}>
          <GameCard
            title="Pond Watch"
            tag="Go / No-Go · Reaction time"
            desc="Watch a pond. Hit spacebar when a duck surfaces. Withhold for everything else. Measures reaction time, sensitivity (d′), and response bias."
            status="Play now →"
            to="/games/pond-watch"
          />
          <GameCard
            title="More games"
            tag="In development"
            desc="Additional psychophysics tasks are in development — pitch discrimination, contrast detection, and more."
            status="in development"
            muted
          />
        </div>

        {/* Stats placeholder */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Your stats</p>
        <div style={S.statsPlaceholder}>
          <p style={S.placeholderTitle}>No sessions yet</p>
          <p style={S.placeholderSub}>
            Complete your first game to see your reaction time, d′, and accuracy here.
          </p>
        </div>

        {/* Account info */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Account</p>
        <div style={S.infoCard}>
          <Row label="Email"        val={user?.email} />
          <Row label="User ID"      val={user?.id?.slice(0, 8) + '…'} mono />
          <Row label="Account type" val="Public" />
          <Row label="Member since" val={new Date(user?.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })} />
        </div>
      </div>
    </div>
  )
}

function GameCard({ title, tag, desc, status, to, muted }) {
  const footer = to
    ? <Link to={to} style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>{status}</Link>
    : <div style={{ ...S.gameStatus, ...(muted ? S.gameStatusMuted : {}) }}>{status}</div>
  return (
    <div style={{ ...S.gameCard, ...(muted ? S.gameCardMuted : {}) }}>
      <div style={S.gameCardInner}>
        <span style={{ ...S.gameBadge, ...(muted ? S.gameBadgeMuted : {}) }}>{tag}</span>
        <h2 style={{ ...S.gameTitle, ...(muted ? { color: 'var(--tx3)' } : {}) }}>{title}</h2>
        <p style={S.gameDesc}>{desc}</p>
      </div>
      {footer}
    </div>
  )
}

function Row({ label, val, mono }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={{ ...S.rowVal, ...(mono ? { fontFamily: '"Space Mono", monospace', fontSize: 12 } : {}) }}>{val}</span>
    </div>
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  wrap:    { maxWidth: 1100, margin: '0 auto', padding: '48px 32px' },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48, flexWrap: 'wrap', gap: 20 },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title:   { fontFamily: SERIF, fontSize: 42, color: 'var(--tx)', letterSpacing: -1, marginBottom: 6 },
  sub:     { fontSize: 15, color: 'var(--tx2)' },
  accountBadge: { background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 12, padding: '14px 18px', textAlign: 'right' },
  badgeLabel:   { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 4 },
  badgeEmail:   { fontSize: 14, color: 'var(--tx)', fontWeight: 500 },
  secLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 16 },
  gameGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  gameCard: { background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  gameCardMuted: { border: '1px solid var(--bd)' },
  gameCardInner: { padding: '24px 24px 20px', flex: 1 },
  gameBadge: { display: 'inline-block', fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', padding: '3px 9px', borderRadius: 5, background: 'var(--bgp)', color: 'var(--pkd)', border: '1px solid var(--pkb)', marginBottom: 10 },
  gameBadgeMuted: { background: 'var(--bg)', color: 'var(--tx3)', border: '1px solid var(--bd)' },
  gameTitle: { fontFamily: SERIF, fontSize: 24, color: 'var(--tx)', marginBottom: 8 },
  gameDesc:  { fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6 },
  gameStatus: { padding: '12px 24px', background: 'var(--bgp)', borderTop: '1px solid var(--pkb)', fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  gameStatusMuted: { background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--tx3)' },
  statsPlaceholder: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '40px 32px', textAlign: 'center' },
  placeholderTitle: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', marginBottom: 8 },
  placeholderSub:   { fontSize: 14, color: 'var(--tx2)', maxWidth: 360, margin: '0 auto' },
  infoCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, overflow: 'hidden' },
  row:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--bd)' },
  rowLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--tx3)' },
  rowVal:   { fontSize: 14, color: 'var(--tx)' },
}
