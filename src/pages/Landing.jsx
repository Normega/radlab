import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Landing({ session }) {
  const platformHref = '/platform'
  const platformCta  = 'Enter the platform →'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      <div style={S.blob} />

      {/* NAV */}
      <nav style={S.nav} className="px-4 md:px-6">
        <Link to="/" style={S.brand}>
          <div className="h-8 md:h-10" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/RADlab_Logo.svg" style={{ height: '100%', display: 'block' }} alt="RADlab logo" />
          </div>
          <span style={S.wordmark}>RAD<b style={{ color: 'var(--pk)', fontWeight: 400 }}>lab</b></span>
        </Link>
        <a href="https://www.utoronto.ca/" target="_blank" rel="noopener noreferrer" style={S.uoftLink}>
          <img src="/UofT_Logo.svg" style={{ height: 48, width: 'auto', display: 'block' }} alt="University of Toronto" />
        </a>
      </nav>

      {/* HERO */}
      <section style={S.hero}>
        <p className="hidden md:block" style={S.eyebrow}>
          <a href="https://www.utoronto.ca" target="_blank" rel="noopener noreferrer" style={S.eyebrowLink}>University of Toronto</a>
          &nbsp;·&nbsp; Department of Psychology
        </p>
        <div className="flex flex-col items-start md:flex-row md:items-center" style={{ gap: 12, marginBottom: 22 }}>
          <img src="/RADlab_Logo.svg" height="80" alt="" aria-hidden="true" style={S.heroLogo} />
          <h1 style={S.h1}>
            <span style={{ whiteSpace: 'nowrap' }}>Regulatory &amp; Affective</span><br />
            <em style={{ fontStyle: 'italic', color: 'var(--pk)' }}>Dynamics</em>
          </h1>
        </div>
        <p style={S.sub}>
          We study how people sense, regulate, and adapt — through rigorous experiments designed to feel like play.
        </p>
      </section>

      {/* HUB CARDS */}
      <section style={S.hubSection}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, maxWidth: 1080 }}>
          <HubCard
            tag="Game Platform"
            title="Come, See"
            desc="Psychophysics experiments embedded in immersive, nature-themed games. Participate as a researcher or a curious visitor."
            chips={['Pond Watch', 'Owl Barn', 'More coming']}
            cta={platformCta}
            href={platformHref}
            internal
          />
          <HubCard
            tag="Knowledge Translation"
            title="UTMaps"
            desc="An interactive wellbeing map for students at the University of Toronto Mississauga — finding the spaces that help."
            chips={['Student Wellbeing', 'Campus']}
            cta="Explore the map →"
            href="http://www.utmap.org"
            newTab
          />
          <HubCard
            tag="Our Lab"
            title="People & Research"
            desc="Meet the team, browse our publications, and learn about the science behind affect, perception, and adaptive regulation."
            chips={['People', 'Publications', 'Contact']}
            cta="Visit the lab →"
            href="/lab/about"
            internal
          />
          <HubCard
            tag="Book"
            title="Better in Every Sense"
            desc="Neuroscientist Dr. Norman Farb and psychologist Dr. Zindel Segal reveal why we get emotionally stuck — and how the neuroscience of sensation provides the unexpected key to getting unstuck. A practical guide to Sense Foraging: escaping the House of Habit to reclaim resilience, wellbeing, and creativity."
            cta="Read more →"
            href="https://www.betterineverysense.com"
            newTab
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer style={S.footer}>
        <div style={S.footerText}>
          <PulseDot />
          <strong style={{ color: 'var(--tx)' }}>RADlab</strong>&nbsp;·&nbsp;University of Toronto Mississauga
        </div>
        <div style={S.footerText}>radlab.zone</div>
      </footer>

    </div>
  )
}

// ─── HUB CARD ────────────────────────────────────────────────────────────────

function HubCard({ tag, title, desc, chips, cta, href, internal, newTab }) {
  const [hovered, setHovered] = useState(false)

  const cardStyle = {
    ...S.card,
    background:   hovered ? 'var(--tx)'  : 'var(--bgc)',
    borderColor:  hovered ? 'var(--tx)'  : 'var(--pkb)',
    transform:    hovered ? 'translateY(-5px)' : 'none',
    boxShadow:    hovered ? '0 16px 48px rgba(28,28,30,0.18)' : 'none',
  }

  const El       = internal ? Link : 'a'
  const linkProp = internal
    ? { to: href }
    : { href, ...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }

  return (
    <El {...linkProp} style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ ...S.cardTag,   color: hovered ? '#f4a8cb' : 'var(--pk)' }}>{tag}</span>
      <h2  style={{ ...S.cardTitle, color: hovered ? '#fff'    : 'var(--tx)' }}>{title}</h2>
      <p   style={{ ...S.cardDesc,  color: hovered ? 'rgba(255,255,255,0.48)' : 'var(--gy)' }}>{desc}</p>
      {chips?.length > 0 && (
        <div style={S.chips}>
          {chips.map(c => (
            <span key={c} style={{
              ...S.chip,
              background: hovered ? 'rgba(240,104,164,0.15)' : 'var(--bgp)',
              color:      hovered ? '#f4a8cb' : 'var(--pk)',
            }}>{c}</span>
          ))}
        </div>
      )}
      <p style={{ ...S.cardCta, color: hovered ? '#f4a8cb' : 'var(--pk)' }}>{cta}</p>
    </El>
  )
}

// ─── PULSE DOT ───────────────────────────────────────────────────────────────

function PulseDot() {
  return <span style={S.pulse} />
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  blob: {
    position: 'fixed', top: -140, right: -100, width: 480, height: 480,
    background: 'radial-gradient(circle, #f9d0e5 0%, transparent 68%)',
    opacity: 0.6, pointerEvents: 'none', zIndex: 0,
  },

  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0',
    borderBottom: '1px solid var(--bd)', background: 'rgba(252,240,245,0.97)',
    position: 'sticky', top: 0, zIndex: 10,
    backdropFilter: 'blur(8px)',
  },
  brand:    { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
  uoftLink: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  wordmark: { fontFamily: SERIF, fontSize: 'clamp(22px, 5vw, 36px)', letterSpacing: -0.5, color: 'var(--tx)', lineHeight: 1 },

  hero:      { padding: '80px 52px 52px', maxWidth: 860, position: 'relative', zIndex: 1 },
  eyebrow:   { fontFamily: MONO, fontSize: '0.8125rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 20 },
  eyebrowLink: { color: 'var(--pk)', textDecoration: 'none', borderBottom: '1px solid rgba(240,104,164,0.35)' },
  heroBrand: {},
  heroLogo:  { flexShrink: 0, display: 'block' },
  h1:        { fontFamily: SERIF, fontSize: 'clamp(2.6rem, 5vw, 4rem)', lineHeight: 1.08, color: 'var(--tx)', margin: 0 },
  sub:       { fontSize: '1rem', color: 'var(--gy)', lineHeight: 1.7, maxWidth: 500, fontWeight: 300 },

  hubSection: { padding: '40px 52px 100px', position: 'relative', zIndex: 1 },

  card: {
    display: 'flex', flexDirection: 'column', gap: 14,
    borderRadius: 18, padding: '38px 32px 32px',
    border: '1.5px solid', textDecoration: 'none', cursor: 'pointer',
    transition: 'background 0.28s ease, border-color 0.28s ease, transform 0.22s ease, box-shadow 0.28s ease',
  },
  cardTag:   { fontFamily: MONO, fontSize: '0.75rem', letterSpacing: '0.13em', textTransform: 'uppercase', fontWeight: 700, transition: 'color 0.28s' },
  cardTitle: { fontFamily: SERIF, fontSize: '1.7rem', lineHeight: 1.12, transition: 'color 0.28s' },
  cardDesc:  { fontSize: '0.875rem', lineHeight: 1.65, fontWeight: 300, flex: 1, transition: 'color 0.28s' },
  chips:     { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 4 },
  chip:      { fontFamily: MONO, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 11px', borderRadius: 20, transition: 'background 0.28s, color 0.28s' },
  cardCta:   { marginTop: 8, fontFamily: MONO, fontSize: '0.8125rem', letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'color 0.28s' },

  footer:     { marginTop: 'auto', padding: '26px 52px', borderTop: '1px solid var(--pkb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, position: 'relative', zIndex: 1 },
  footerText: { fontFamily: MONO, fontSize: '0.75rem', color: 'var(--gy)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' },

  pulse: {
    display: 'inline-block', width: 6, height: 6, background: 'var(--pk)',
    borderRadius: '50%', marginRight: 7, verticalAlign: 'middle',
    animation: 'hub-pulse 2.6s ease-in-out infinite',
  },
}
