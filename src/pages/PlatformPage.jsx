import Nav from '../components/Nav'
import EyebrowLabel from '../components/ui/EyebrowLabel'
import PrimaryCTA from '../components/ui/PrimaryCTA'
import SecondaryCTA from '../components/ui/SecondaryCTA'

// AboutPage (Guest/User) — Onboarding Redesign v1 Phase 5 (Figma 111:147 /
// 170:514, from Norm's frame screenshots 2026-07-17; same layout both variants,
// header + CTAs reflect auth).
// Hero headline is the APPROVED post-Figma override: "Your mind, reflected"
// ("reflected" in primary pink) — brief §Approved changes; the Figma file
// still reads "How sharp is your mind?" and the brief wins.
// Auth-conditional CTAs (per Norm): hero primary "Sign up to play →"(guest) /
// "Play now →"(user); banner "Create free account →"(guest) / "Play now →"(user).
// Sections removed vs the old page (designer's notes §4.1): Latest Session
// stat panel, Leaderboard, "Who's This For?", numbered How-it-works steps —
// "How it works" now scrolls to the What-is-this section.
// Game illustrations are the live SVGs (real art, not Figma screenshots).

export default function PlatformPage({ session }) {
  const playTarget = session ? '/games' : '/signup'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />

      {/* HERO — centered, white band */}
      <section style={{ ...S.band, background: 'var(--bgc)' }}>
        <div style={{ ...S.inner, textAlign: 'center' }}>
          <p style={S.heroEyebrow}>Regulatory &amp; Affective Dynamics Lab · U of T Mississauga</p>
          <h1 style={S.h1}>
            Your mind, <em style={{ color: 'var(--pk)', fontStyle: 'normal' }}>reflected</em>
          </h1>
          <p style={S.heroSub}>
            RADlab turns real psychological research into short, interactive check-ins.
            Play a few minutes of guided tasks, and get a window into your own attention,
            mood, and stress patterns — while contributing to published science on wellbeing.
          </p>
          <div style={S.heroCtas}>
            <PrimaryCTA to={playTarget}>{session ? 'Play now →' : 'Sign up to play →'}</PrimaryCTA>
            <SecondaryCTA onClick={() => document.getElementById('what')?.scrollIntoView({ behavior: 'smooth' })}>
              How it works
            </SecondaryCTA>
          </div>
        </div>
      </section>

      {/* GAMES CAROUSEL — pink band, horizontal scroll (mobile-friendly swipe) */}
      <section style={S.band}>
        <div style={S.inner}>
          <EyebrowLabel variant="white" style={{ marginBottom: 20 }}>A peek at the games</EyebrowLabel>
          <div style={S.carousel} className="games-carousel">
            <GameCard
              title="First Contact"
              desc="Meet your Ripple. Breathe together. The more you sync, the more it comes alive. Required before anything else."
              meta={[['Duration', '~3 min'], ['Trials', '1']]}
              caption="Breath sync"
            >
              <ContactIllustration />
            </GameCard>
            <GameCard
              title="Pond Watch"
              desc="You're a wildlife monitor. A duck appears — hit spacebar. A heron glides past — don't you dare touch it. Sounds easy. Your brain will betray you."
              meta={[['Duration', '~5 min'], ['Trials', '60']]}
              caption="Duck spotted!"
            >
              <PondIllustration />
            </GameCard>
            <GameCard
              title="Ebb & Flow"
              desc="Breathe with your Ripple. Notice when something changes. A quiet game of awareness."
              meta={[['Duration', '~5 min'], ['Trials', '~15']]}
              caption="Hold on inhale"
            >
              <EbbFlowIllustration />
            </GameCard>
          </div>
        </div>
      </section>

      {/* WHAT IS THIS — white band; "How it works" scroll target */}
      <section id="what" style={{ ...S.band, background: 'var(--bgc)' }}>
        <div style={S.inner}>
          <EyebrowLabel variant="white" style={{ marginBottom: 20 }}>What is this</EyebrowLabel>
          <div style={S.whatCard} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={S.prose}>
                <strong>The Regulatory &amp; Affective Dynamics Lab</strong> (RADlab) at the
                University of Toronto Mississauga studies how emotions and attention shift
                moment to moment — and what that means for wellbeing.
              </p>
              <p style={S.prose}>
                On this games platform, we built short interactive tasks: a few minutes of
                breathing, listening, or watching, designed to surface how you actually
                respond in the moment. Every session feeds real academic research, and gives
                you a small reflection of your own patterns in return.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InfoMini title="De-identified"    body="Used for research only at the group level, never tied directly to you." />
              <InfoMini title="Always optional"  body="Skip any check-in, or stop anytime." />
              <InfoMini title="Not clinical"     body="A tool for reflection, not diagnosis or treatment." />
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS — pink band, 3 cards stacking to 1 col on mobile */}
      <section style={S.band}>
        <div style={S.inner}>
          <EyebrowLabel variant="white" style={{ marginBottom: 20 }}>What you get out of it</EyebrowLabel>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BenefitCard
              icon={<PatternIcon />}
              title="See your own patterns"
              body="After each task, you get a personal summary on how your focus or mood moved during the session. Not a diagnosis, just a mirror."
            />
            <BenefitCard
              icon={<PencilIcon />}
              title="Contribute to real research"
              body="Your (anonymized) responses become part of published studies on stress, attention, and wellbeing. Used by researchers, not advertisers."
            />
            <BenefitCard
              icon={<ClockIcon />}
              title="Two minutes, not two hours"
              body="Games are short, visual, and genuinely engaging. Play one for fun, or make it a regular check-in!"
            />
          </div>
        </div>
      </section>

      {/* CTA BANNER — inset rounded pink card */}
      <section style={{ ...S.band, background: 'var(--bgc)' }}>
        <div style={S.inner}>
          <div style={S.banner}>
            <h2 style={S.bannerTitle}>Curious what your own patterns look like?</h2>
            <p style={S.bannerSub}>A few minutes, a little more self-awareness.</p>
            <PrimaryCTA variant="white" to={playTarget}>
              {session ? 'Play now →' : 'Create free account →'}
            </PrimaryCTA>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <div style={S.footer}>
        <div style={{ ...S.inner, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/RADlab_Logo.svg" alt="RADlab" style={{ height: 40, width: 'auto', display: 'block' }} />
            <span style={S.footerTxt}>RADlab · Regulatory &amp; Affective Dynamics Lab · University of Toronto</span>
          </div>
          <span style={S.footerTxt}>Built with Supabase &amp; Vercel</span>
        </div>
      </div>
    </div>
  )
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

// Carousel card: info left, tint illustration panel right (Figma GameCard).
// Fixed-ish width so the row scrolls horizontally; ~85vw cap keeps the next
// card peeking on phones (Dev Spec §6.3).
function GameCard({ title, desc, meta, caption, children }) {
  return (
    <div style={S.gameCard}>
      <div style={S.gameInfo}>
        <h2 style={S.gameTitle}>{title}</h2>
        <p style={S.gameDesc}>{desc}</p>
        <div style={S.gameMetaRow}>
          {meta.map(([label, val]) => (
            <div key={label}>
              <p style={S.metaLabel}>{label}</p>
              <p style={S.metaVal}>{val}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={S.gameArt}>
        {children}
        <p style={S.gameCaption}>{caption}</p>
      </div>
    </div>
  )
}

function InfoMini({ title, body }) {
  return (
    <div style={S.infoMini}>
      <p style={S.infoMiniTitle}>{title}</p>
      <p style={S.infoMiniBody}>{body}</p>
    </div>
  )
}

function BenefitCard({ icon, title, body }) {
  return (
    <div style={S.benefit}>
      <div style={S.benefitIcon}>{icon}</div>
      <p style={S.benefitTitle}>{title}</p>
      <p style={S.benefitBody}>{body}</p>
    </div>
  )
}

// Icons — Figma "Icon" component set (Pattern, Pencil, Clock), drawn inline.
function PatternIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke="var(--pkd)" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="7.5" stroke="var(--pkd)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="10" cy="2.5" r="1.4" fill="var(--pkd)" />
    </svg>
  )
}
function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 17 L4.2 13 L14 3.2 A1.6 1.6 0 0 1 16.8 6 L7 15.8 Z" stroke="var(--pkd)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.5 4.7 L15.3 7.5" stroke="var(--pkd)" strokeWidth="1.5" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="var(--pkd)" strokeWidth="1.5" />
      <path d="M10 5.5 V10 L13 12" stroke="var(--pkd)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── GAME ILLUSTRATIONS — live art (Figma cards used these as screenshots) ───

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

function ContactIllustration() {
  return (
    <svg width="130" height="120" viewBox="0 0 120 115" xmlns="http://www.w3.org/2000/svg">
      {/* Sync rings */}
      <circle cx="60" cy="54" r="44" fill="none" stroke="#f068a4" strokeWidth="0.8" opacity="0.18"/>
      <circle cx="60" cy="54" r="34" fill="none" stroke="#f068a4" strokeWidth="0.9" opacity="0.28"/>
      <circle cx="60" cy="54" r="24" fill="none" stroke="#f068a4" strokeWidth="1.0" opacity="0.42"/>
      {/* Avatar head */}
      <ellipse cx="60" cy="54" rx="18" ry="20" fill="#f068a4" opacity="0.92"/>
      {/* Eyes */}
      <ellipse cx="53.5" cy="51" rx="3" ry="3.2" fill="white" opacity="0.95"/>
      <ellipse cx="66.5" cy="51" rx="3" ry="3.2" fill="white" opacity="0.95"/>
      <ellipse cx="53.5" cy="52" rx="1.8" ry="1.8" fill="#1c1c1e"/>
      <ellipse cx="66.5" cy="52" rx="1.8" ry="1.8" fill="#1c1c1e"/>
      {/* Eyelids */}
      <path d="M 50 49 Q 53.5 46.5 57 49" fill="#f068a4" opacity="0.85"/>
      <path d="M 63 49 Q 66.5 46.5 70 49" fill="#f068a4" opacity="0.85"/>
      {/* Smile */}
      <path d="M 55 61 Q 60 65 65 61" fill="none" stroke="#c04a82" strokeWidth="1.3" strokeLinecap="round"/>
      {/* Blush */}
      <ellipse cx="47" cy="56" rx="5" ry="3" fill="#ff8fab" opacity="0.35"/>
      <ellipse cx="73" cy="56" rx="5" ry="3" fill="#ff8fab" opacity="0.35"/>
      {/* Breath arc below */}
      <path d="M 20 95 Q 40 78 60 95 Q 80 112 100 95"
            fill="none" stroke="#f068a4" strokeWidth="1.8" strokeLinecap="round" opacity="0.55"/>
    </svg>
  )
}

function EbbFlowIllustration() {
  return (
    <svg width="130" height="120" viewBox="0 0 120 115" xmlns="http://www.w3.org/2000/svg">
      {/* Soft background pond shape */}
      <ellipse cx="60" cy="82" rx="50" ry="26" fill="#f5e0ee" opacity="0.55"/>
      <ellipse cx="60" cy="82" rx="50" ry="26" fill="none" stroke="#f068a4" strokeWidth="0.8" opacity="0.28"/>
      {/* Breath sine wave */}
      <path d="M 10 82 Q 25 56 40 82 Q 55 108 70 82 Q 85 56 110 82"
            fill="none" stroke="#f068a4" strokeWidth="2.2" strokeLinecap="round" opacity="0.9"/>
      {/* Avatar face */}
      <ellipse cx="60" cy="34" rx="20" ry="22" fill="#f068a4" opacity="0.9"/>
      {/* Eyes — half-lidded */}
      <ellipse cx="53" cy="32" rx="3.5" ry="3" fill="white" opacity="0.95"/>
      <ellipse cx="67" cy="32" rx="3.5" ry="3" fill="white" opacity="0.95"/>
      <ellipse cx="53" cy="33" rx="2" ry="2" fill="#1c1c1e"/>
      <ellipse cx="67" cy="33" rx="2" ry="2" fill="#1c1c1e"/>
      {/* Eyelids (half-lidded) */}
      <path d="M 49 30 Q 53 27 57 30" fill="#f068a4" opacity="0.85"/>
      <path d="M 63 30 Q 67 27 71 30" fill="#f068a4" opacity="0.85"/>
      {/* Gentle smile */}
      <path d="M 55 41 Q 60 45 65 41" fill="none" stroke="#c04a82" strokeWidth="1.3" strokeLinecap="round"/>
      {/* Blush dots */}
      <ellipse cx="47" cy="37" rx="5" ry="3" fill="#ff8fab" opacity="0.35"/>
      <ellipse cx="73" cy="37" rx="5" ry="3" fill="#ff8fab" opacity="0.35"/>
    </svg>
  )
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  inner: { maxWidth: 1200, margin: '0 auto' },
  band:  { padding: '52px 24px' },

  heroEyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 16 },
  h1: {
    // Large Hero — sanctioned exception to the 6-step type scale
    // (Dev Spec §1.2 caveat: per-screen CSS wins for the About hero).
    fontFamily: SERIF, fontWeight: 400,
    fontSize: 'clamp(40px, 5.5vw, 64px)',
    lineHeight: 1.15, letterSpacing: -1,
    margin: '0 auto 20px', color: 'var(--tx)',
  },
  heroSub: { fontSize: 14, fontFamily: SANS, lineHeight: 1.6, color: 'var(--tx2)', maxWidth: 520, margin: '0 auto 28px' },
  heroCtas: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },

  carousel: {
    display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 8,
    scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch',
  },
  gameCard: {
    display: 'flex', flexShrink: 0, scrollSnapAlign: 'start',
    width: 'min(480px, 85vw)',
    background: 'var(--bgc)', border: '1px solid var(--bgp)', borderRadius: 12,
    overflow: 'hidden',
  },
  gameInfo:  { flex: 1, padding: '20px 22px', display: 'flex', flexDirection: 'column' },
  gameTitle: { fontFamily: SERIF, fontWeight: 400, fontSize: 20, color: 'var(--tx)', margin: '0 0 8px' },
  gameDesc:  { fontSize: 12, fontFamily: SANS, color: 'var(--tx2)', lineHeight: 1.5, margin: '0 0 14px', flex: 1 },
  gameMetaRow: { display: 'flex', gap: 24, paddingTop: 12, borderTop: '1px solid var(--bd)' },
  metaLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--gy)', margin: '0 0 2px' },
  metaVal:   { fontFamily: MONO, fontSize: 12, color: 'var(--tx)', margin: 0 },
  gameArt: {
    width: 160, flexShrink: 0, background: 'var(--bgp)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '16px 10px',
  },
  gameCaption: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pkd)', margin: 0, textAlign: 'center' },

  whatCard: {
    background: 'var(--bgc)', border: '1px solid var(--bgp)', borderRadius: 12,
    padding: 'clamp(20px, 3vw, 36px)',
  },
  prose: { fontSize: 14, fontFamily: SANS, lineHeight: 1.6, color: 'var(--tx)', margin: 0 },
  infoMini: {
    background: 'var(--bgp)', borderRadius: 12, padding: '14px 18px',
  },
  infoMiniTitle: { fontSize: 14, fontWeight: 600, fontFamily: SANS, color: 'var(--pkd)', margin: '0 0 4px' },
  infoMiniBody:  { fontSize: 14, fontFamily: SANS, color: 'var(--tx)', lineHeight: 1.5, margin: 0 },

  benefit: {
    background: 'var(--bgc)', border: '1px solid var(--bgp)', borderRadius: 12,
    padding: '22px 24px',
  },
  benefitIcon: {
    width: 36, height: 36, borderRadius: '50%', background: 'var(--bgp)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  benefitTitle: { fontSize: 14, fontWeight: 600, fontFamily: SANS, color: 'var(--tx)', margin: '0 0 8px' },
  benefitBody:  { fontSize: 14, fontFamily: SANS, color: 'var(--tx2)', lineHeight: 1.55, margin: 0 },

  banner: {
    background: 'var(--pk)', borderRadius: 12, textAlign: 'center',
    padding: 'clamp(32px, 5vw, 56px) 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  },
  bannerTitle: { fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(24px, 3vw, 32px)', color: '#fff', margin: 0, lineHeight: 1.4 },
  bannerSub:   { fontSize: 14, fontFamily: SANS, color: '#fff', opacity: 0.9, margin: '0 0 14px' },

  footer: { background: 'var(--bgp)', padding: '24px' },
  footerTxt: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', letterSpacing: 0.5 },
}
