import { Link } from 'react-router-dom'
import { pi } from '../../data/people'

const pillars = [
  {
    heading: 'Affective Neuroscience',
    body: 'Using fMRI, we map how attention to bodily signals — interoception — shapes emotion regulation and predicts depression vulnerability. Our neuroimaging work builds an objective picture of who gets stuck in negative states, and why.',
  },
  {
    heading: 'Digital Intervention Science',
    body: 'From reflective wellbeing check-ins and AI-powered chatbots to mindfulness games, we design and rigorously evaluate online tools that put evidence-based strategies directly in students’ hands.',
  },
  {
    heading: 'Contemplative Health',
    body: 'We probe the central claims of mindfulness and yoga as stress-reduction approaches — asking not just whether they work, but how, for whom, and through what neural and psychological mechanisms.',
  },
]

const quickLinks = [
  { label: 'Our Research', to: '/lab/research' },
  { label: 'Meet the Team', to: '/lab/people' },
  { label: 'Publications', to: '/lab/publications' },
]

export default function AboutPage() {
  return (
    <div className="lab-page">

      {/* ── Hero ── */}
      <section className="lab-section" style={S.hero}>
        <p style={S.eyebrow}>University of Toronto Mississauga · Department of Psychology</p>
        <h1 style={S.heroHeading}>Understanding how emotions unfold — and what that means for wellbeing.</h1>
        <div style={S.banner}>
          <img
            src="/images/homesite_lotus_brain_hero.png"
            alt="Lotus flower connected to a brain by golden luminous threads"
            style={S.bannerImg}
          />
        </div>
        <p style={S.heroBody}>
          The Regulatory and Affective Dynamics (RAD) Lab is dedicated to understanding how emotions
          and regulatory responses unfold over time to determine a person&apos;s sense of wellbeing.
          Part of the Health, Adaptation, and Wellbeing Cluster at UTM, we bring together
          neuroscience, clinical psychology, and digital technology to study resilience where it
          matters most: in real people, navigating real stress.
        </p>
      </section>

      {/* ── What we study ── */}
      <section className="lab-section">
        <h2 className="lab-section__heading">What we study</h2>
        <p style={S.bodyText}>
          Emotions are not static events — they rise, shift, and resolve in patterns that shape
          mental health across a lifetime. The RAD Lab was established in 2014 to investigate
          the complex interplay between emotion and cognition that determines subjective wellbeing
          and stress resilience. We evaluate how individuals employ regulatory strategies under
          stress, with particular focus on the theoretical foundations of contemplative practices
          like mindfulness meditation and yoga. Our work spans the brain imaging scanner to the
          smartphone screen: we identify neural markers of depression vulnerability and translate
          those findings into accessible, evidence-based interventions for university students.
        </p>
      </section>

      {/* ── Three pillars ── */}
      <section className="lab-section">
        <h2 className="lab-section__heading">Our approach</h2>
        <div style={S.pillarGrid}>
          {pillars.map(p => (
            <div key={p.heading} style={S.pillarCard}>
              <h3 style={S.pillarHeading}>{p.heading}</h3>
              <p style={S.pillarBody}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PI ── */}
      <section className="lab-section">
        <h2 className="lab-section__heading">Principal Investigator</h2>
        <div className="person-card person-card--featured">
          <div className="person-card__photo-wrap">
            <img
              src={pi.photo}
              alt={pi.name}
              className="person-card__photo person-card__photo--featured"
              onError={e => { e.target.style.visibility = 'hidden' }}
            />
          </div>
          <div className="person-card__body">
            <p className="person-card__role">{pi.role}</p>
            <h3 className="person-card__name">{pi.name}{pi.credentials ? `, ${pi.credentials}` : ''}</h3>
            <p className="person-card__bio">{pi.bio}</p>
            {pi.links?.length > 0 && (
              <div className="person-card__links">
                {pi.links.map(link => (
                  <a key={link.url} className="person-card__link" href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Quick links ── */}
      <section className="lab-section">
        <h2 className="lab-section__heading">Explore the lab</h2>
        <div style={S.quickLinks}>
          {quickLinks.map(l => (
            <Link key={l.to} to={l.to} style={S.quickLink}>
              {l.label} →
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}

const S = {
  hero: { paddingBottom: '0.5rem' },
  eyebrow: {
    fontFamily: '"Space Mono", monospace',
    fontSize: '0.7rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--tx3, #abadb0)',
    margin: '0 0 1rem',
  },
  heroHeading: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
    fontWeight: 400,
    color: '#1c1c1e',
    lineHeight: 1.25,
    margin: '0 0 1.25rem',
    maxWidth: 680,
  },
  heroBody: {
    fontSize: '1rem',
    lineHeight: 1.75,
    color: '#444',
    maxWidth: 680,
    margin: 0,
  },
  bodyText: {
    fontSize: '1rem',
    lineHeight: 1.75,
    color: '#444',
    maxWidth: 700,
    margin: 0,
  },
  pillarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1.25rem',
  },
  pillarCard: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    borderTop: '3px solid var(--pk, #7c5cbf)',
  },
  pillarHeading: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: '1.1rem',
    fontWeight: 400,
    color: '#1c1c1e',
    margin: 0,
  },
  pillarBody: {
    fontSize: '0.875rem',
    lineHeight: 1.65,
    color: '#555',
    margin: 0,
  },
  banner: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 680,
    margin: '1.5rem 0',
  },
  bannerImg: {
    display: 'block',
    width: '100%',
    height: 'auto',
  },
  quickLinks: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  quickLink: {
    display: 'inline-block',
    background: 'var(--pk, #7c5cbf)',
    color: '#fff',
    borderRadius: 9,
    padding: '10px 20px',
    fontSize: '0.9rem',
    fontWeight: 600,
    textDecoration: 'none',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    whiteSpace: 'nowrap',
  },
}
