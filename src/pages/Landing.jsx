import { Link } from 'react-router-dom'
import Nav from '../components/Nav'

export default function Landing({ session }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />

      {/* HERO */}
      <section style={S.sectionOuter} className="border-b" className2="">
        <div style={S.inner}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_min(340px,35%)] gap-10 lg:gap-14 items-center">
            <div>
              <p style={S.eyebrow}>Regulatory &amp; Affective Dynamics Lab · U of T</p>
              <h1 style={S.h1}>
                How sharp<br />is your<br />
                <em style={{ color: 'var(--pk)', fontStyle: 'normal' }}>mind?</em>
              </h1>
              <p style={S.heroSub}>
                Play neuroscience-backed perception games. Track yourself over time.
                Find out if you're actually as quick as you think you are.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/signup" style={S.btnPrimary}>Play now — it's free</Link>
                <a href="#how" style={S.btnOutline}>How it works</a>
              </div>
            </div>
            {/* Stat panel — shown below on mobile, beside on desktop */}
            <div style={S.statPanel}>
              <p style={S.statLabel}>Latest session · Pond Watch</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                <span style={S.statBig}>213</span>
                <span style={S.statUnit}>ms</span>
              </div>
              <p style={S.statContext}>faster than 71% of players</p>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--bd)' }}>
                <StatCell label="Hit rate"     val="94%"  up="+3%" />
                <StatCell label="d′"           val="3.41" up="+0.2" />
                <StatCell label="False alarms" val="2%" />
                <StatCell label="Sessions"     val="12" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GAME TEASER */}
      <section style={{ ...S.sectionOuter, background: 'var(--bgc)' }}>
        <div style={S.inner}>
          <p style={S.secLabel}>// Games</p>
          {/* Game card: stacked on mobile (illustration top), side by side on md+ */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px]" style={S.gameCard}>
            {/* Illustration — first on mobile (top), last on desktop (right) */}
            <div
              className="order-first md:order-last flex flex-col items-center justify-center gap-3 p-6 border-b md:border-b-0 md:border-l"
              style={{ background: 'var(--bgp)', borderColor: 'var(--pkb)' }}
            >
              <PondIllustration />
              <p style={S.pondHint}>Duck spotted!</p>
              <span style={S.keyPill}>spacebar</span>
            </div>
            {/* Info — second on mobile (bottom), first on desktop (left) */}
            <div className="order-last md:order-first" style={S.gameInfo}>
              <span style={S.gameBadge}>Go / No-Go · Reaction time</span>
              <h2 style={S.gameTitle}>Pond Watch</h2>
              <p style={S.gameDesc}>
                You're a wildlife monitor. A duck appears — hit spacebar. A heron glides
                past — don't you dare touch it. Sounds easy. Your brain will betray you.
              </p>
              <div className="flex gap-6 pt-4 mb-5" style={{ borderTop: '1px solid var(--bd)' }}>
                <MetaItem label="Trials"   val="60" />
                <MetaItem label="Duration" val="~5 min" />
                <MetaItem label="Measures" val="RT · d′ · bias" />
              </div>
              <Link to="/signup" style={S.btnPrimary}>Coming soon — sign up to play</Link>
            </div>
          </div>
        </div>
      </section>

      {/* LEADERBOARD */}
      <section style={S.sectionOuter}>
        <div style={S.inner}>
          <p style={S.secLabel}>// This week's leaderboard · Pond Watch</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <LbRow rank="01" name="neuroqueen88" score="187 ms" dp="d′ 4.2" />
            <LbRow rank="02" name="reflexgoblin"  score="194 ms" dp="d′ 4.0" />
            <LbRow rank="03" name="you · normf"   score="213 ms" dp="d′ 3.4" you />
            <LbRow rank="04" name="pondwatcher42" score="221 ms" dp="d′ 3.1" />
            <LbRow rank="05" name="slowbutsteady" score="248 ms" dp="d′ 2.8" />
          </div>
          <p style={S.lbNote}>1,284 players this week · pseudonymous display names</p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ ...S.sectionOuter, background: 'var(--bgc)' }}>
        <div style={S.inner}>
          <p style={S.secLabel}>// How it works</p>
          {/* 1 col mobile → 3 col desktop */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={S.steps}>
            <Step n="01" title="Play the games"    body="Each game is a disguised perceptual experiment. You're having fun. Science is happening. Both things are true." />
            <Step n="02" title="See your results"  body="Reaction time, sensitivity, bias — measured precisely. Every session adds to your personal performance history." />
            <Step n="03" title="Compete & improve" body="Leaderboards, population comparisons. The only person you really need to beat is past you." />
          </div>
        </div>
      </section>

      {/* WHO'S THIS FOR */}
      <section style={S.sectionOuter}>
        <div style={S.inner}>
          <p style={S.secLabel}>// Who's this for?</p>
          {/* 1 col mobile → 2 col tablet → 3 col desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <TierCard title="Curious public"     body="Sign up free, play any game, chase the leaderboard. You're also contributing to real neuroscience. Pretty good deal." />
            <TierCard title="Study participants" body="Enrolled in a RADlab study? You'll get a personalised set of tasks and questionnaires, with compensation for your time." highlight />
            <TierCard title="Lab members"        body="RADlab researchers get admin tools for study design, participant management, and data export. Invite-only." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <div style={{ ...S.sectionOuter, background: 'var(--bgp)', textAlign: 'center', borderTop: '1px solid var(--pkb)', borderBottom: '1px solid var(--pkb)' }}>
        <div style={S.inner}>
          <h2 style={S.ctaTitle}>Your brain is waiting.</h2>
          <p style={S.ctaSub}>Five minutes. Sixty trials. Find out where you actually stand.</p>
          <Link to="/signup" style={{ ...S.btnPrimary, fontSize: 16, padding: '13px 32px' }}>
            Create free account →
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--bd)' }}>
        <div style={{ ...S.inner, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/RADlab_Logo.svg" height="22" alt="RADlab" />
            <span style={S.footerTxt}>RADlab · Regulatory &amp; Affective Dynamics Lab · University of Toronto</span>
          </div>
          <span style={S.footerTxt}>Built with Supabase &amp; Vercel</span>
        </div>
      </div>
    </div>
  )
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function StatCell({ label, val, up }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>{val}</p>
      {up && <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#1D9E75', marginTop: 2 }}>↑ {up}</p>}
    </div>
  )
}

function MetaItem({ label, val }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--tx)' }}>{val}</p>
    </div>
  )
}

function LbRow({ rank, name, score, dp, you }) {
  return (
    <div style={{ ...S.lbRow, ...(you ? S.lbRowYou : {}) }}>
      <span style={{ ...S.lbRank, ...(you ? { color: 'var(--pk)', fontWeight: 700 } : {}) }}>{rank}</span>
      <span style={{ ...S.lbName, ...(you ? { color: 'var(--pkd)', fontWeight: 500 } : {}) }}>{name}</span>
      <span style={S.lbScore}>{score}</span>
      <span style={S.lbDp}>{dp}</span>
    </div>
  )
}

function Step({ n, title, body }) {
  return (
    <div style={S.step}>
      <p style={S.stepN}>{n} —</p>
      <p style={S.stepTitle}>{title}</p>
      <p style={S.stepBody}>{body}</p>
    </div>
  )
}

function TierCard({ title, body, highlight }) {
  return (
    <div style={{ ...S.tierCard, ...(highlight ? { borderColor: 'var(--pkbs)' } : {}) }}>
      <p style={S.tierTitle}>{title}</p>
      <p style={S.tierBody}>{body}</p>
    </div>
  )
}

function PondIllustration() {
  return (
    <svg width="130" height="120" viewBox="0 0 120 115" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="72" rx="48" ry="33" fill="#f5e0ee" opacity="0.55"/>
      <ellipse cx="60" cy="72" rx="48" ry="33" fill="none" stroke="#f068a4" strokeWidth="0.8" opacity="0.28"/>
      <ellipse cx="60" cy="70" rx="17" ry="10" fill="#f068a4" opacity="0.9"/>
      <circle  cx="74" cy="62" r="8.5" fill="#f068a4" opacity="0.95"/>
      <path    d="M82 62 L90 60 L82 66Z" fill="#c04a82"/>
      <circle  cx="76" cy="60" r="1.6" fill="#1c1c1e"/>
      <path    d="M53 68 Q60 63 70 68" fill="none" stroke="#c04a82" strokeWidth="0.9" opacity="0.65"/>
      <ellipse cx="25" cy="85" rx="8"  ry="5"  fill="#abadb0" opacity="0.2"/>
      <line    x1="18" y1="100" x2="18" y2="50" stroke="#abadb0" strokeWidth="1.3" opacity="0.35"/>
      <ellipse cx="18" cy="50" rx="3"  ry="8"  fill="#abadb0" opacity="0.3"/>
    </svg>
  )
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  inner:      { maxWidth: 1200, margin: '0 auto' },
  sectionOuter: { padding: '52px 24px', borderBottom: '1px solid var(--bd)' },

  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 16 },
  h1: {
    fontFamily: SERIF,
    fontSize: 'clamp(40px, 5.5vw, 72px)',
    lineHeight: 1.03, letterSpacing: -2,
    marginBottom: 20, color: 'var(--tx)',
  },
  heroSub: { fontSize: 'clamp(15px, 1.4vw, 18px)', lineHeight: 1.65, color: 'var(--tx2)', maxWidth: 480, marginBottom: 32 },

  statPanel:   { background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 16, padding: 24 },
  statLabel:   { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 7 },
  statBig:     { fontFamily: MONO, fontSize: 42, fontWeight: 700, color: 'var(--tx)', lineHeight: 1 },
  statUnit:    { fontFamily: MONO, fontSize: 16, color: 'var(--tx3)', marginLeft: 4 },
  statContext: { fontFamily: MONO, fontSize: 12, color: 'var(--pk)', marginTop: 4 },

  secLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 22 },

  gameCard:  { border: '1px solid var(--bds)', borderRadius: 16, overflow: 'hidden', background: 'var(--bgc)' },
  gameInfo:  { padding: 28 },
  gameBadge: { display: 'inline-block', fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 11px', borderRadius: 5, background: 'var(--bgp)', color: 'var(--pkd)', border: '1px solid var(--pkb)', marginBottom: 13 },
  gameTitle: { fontFamily: SERIF, fontSize: 32, color: 'var(--tx)', marginBottom: 12 },
  gameDesc:  { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.65, marginBottom: 4 },
  pondPanel: { background: 'var(--bgp)', borderLeft: '1px solid var(--pkb)', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 13, padding: 24 },
  pondHint:  { fontFamily: MONO, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--pkd)', textAlign: 'center' },
  keyPill:   { border: '1px solid var(--pkbs)', borderRadius: 6, padding: '4px 13px', fontFamily: MONO, fontSize: 12, color: 'var(--pkd)', background: 'rgba(240,104,164,0.07)' },

  lbRow:    { display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderRadius: 10, background: 'var(--bgc)', border: '1px solid var(--bd)' },
  lbRowYou: { background: 'var(--bgp)', borderColor: 'var(--pkb)' },
  lbRank:   { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', width: 26, flexShrink: 0 },
  lbName:   { flex: 1, fontSize: 15, color: 'var(--tx2)' },
  lbScore:  { fontFamily: MONO, fontSize: 14, color: 'var(--tx)', fontWeight: 700 },
  lbDp:     { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', minWidth: 54, textAlign: 'right' },
  lbNote:   { marginTop: 13, fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', textAlign: 'center', letterSpacing: 1 },

  steps:     { gap: 1, background: 'var(--bd)', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' },
  step:      { background: 'var(--bgc)', padding: '26px 24px' },
  stepN:     { fontFamily: MONO, fontSize: 12, color: 'var(--pk)', marginBottom: 10, letterSpacing: 1 },
  stepTitle: { fontSize: 16, fontWeight: 500, color: 'var(--tx)', marginBottom: 8 },
  stepBody:  { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6 },

  tierCard:  { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14, padding: 26 },
  tierTitle: { fontSize: 16, fontWeight: 500, color: 'var(--tx)', marginBottom: 8 },
  tierBody:  { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6 },

  ctaTitle: { fontFamily: SERIF, fontSize: 'clamp(32px, 4vw, 54px)', color: 'var(--tx)', marginBottom: 14, letterSpacing: -1 },
  ctaSub:   { fontSize: 17, color: 'var(--tx2)', marginBottom: 32 },

  footerTxt: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', letterSpacing: 1 },

  btnPrimary: { display: 'inline-block', fontSize: 14, padding: '9px 20px', borderRadius: 9, fontWeight: 500, background: 'var(--pk)', border: '1px solid var(--pk)', color: '#fff', textDecoration: 'none', fontFamily: 'inherit', cursor: 'pointer' },
  btnOutline: { display: 'inline-block', fontSize: 14, padding: '9px 20px', borderRadius: 9, fontWeight: 500, border: '1px solid var(--bds)', background: 'transparent', color: 'var(--tx2)', textDecoration: 'none', fontFamily: 'inherit', cursor: 'pointer' },
}
