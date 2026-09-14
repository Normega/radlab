import Nav from '../components/Nav'
import SiteFooter from '../components/SiteFooter'
import EyebrowLabel from '../components/ui/EyebrowLabel'
import PrimaryCTA from '../components/ui/PrimaryCTA'
import SecondaryCTA from '../components/ui/SecondaryCTA'
import GameCard from '../components/GameCard'
import { gameBySlug } from '../data/games'

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
// Sept 14 2026 design-system handoff: the carousel shows the SAME GameCard
// as /games (src/components/GameCard.jsx) — the bespoke marketing
// illustrations and captions this page carried are retired with it — and it
// shows for GUESTS ONLY. A signed-in user has the "Play now →" CTA; the
// designer's call is they don't also need a peek at three games.

const CAROUSEL = ['first_contact', 'pond_watch', 'ebb_flow']

export default function PlatformPage({ session }) {
  const playTarget = session ? '/games' : '/signup'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

      {/* GAMES CAROUSEL — guests only (Sept 14 handoff); pink band,
          horizontal scroll (mobile-friendly swipe) */}
      {!session && (
        <section style={S.band}>
          <div style={S.inner}>
            <EyebrowLabel variant="white" style={{ marginBottom: 20 }}>A peek at the games</EyebrowLabel>
            <div style={S.carousel} className="games-carousel">
              {CAROUSEL.map(slug => (
                <div key={slug} style={S.carouselSlot}>
                  <GameCard game={gameBySlug(slug)} isGuest />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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

      {/* FOOTER — shared SiteFooter replaced the bespoke logo/"Built with" band 2026-08-21 */}
      <SiteFooter session={session} />
    </div>
  )
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

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
  // Fixed-ish slot so the row scrolls horizontally; ~85vw cap keeps the next
  // card peeking on phones (Dev Spec §6.3).
  carouselSlot: {
    flexShrink: 0, scrollSnapAlign: 'start',
    width: 'min(480px, 85vw)', display: 'flex', flexDirection: 'column',
  },

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

}
