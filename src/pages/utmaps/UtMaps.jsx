import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import SiteFooter from '../../components/SiteFooter'
import EyebrowLabel from '../../components/ui/EyebrowLabel'
import PrimaryCTA from '../../components/ui/PrimaryCTA'
import SecondaryCTA from '../../components/ui/SecondaryCTA'

/*
 * /utmaps — UTMaps, the UTM Wellness Maps Project (RADlab knowledge
 * translation), brought into radlab.zone's brand (2026-10-04). It replaces the
 * Google Sites home page at utmap.org; the survey-year sites it links to stay
 * on Google Sites for now, and the 2026 Wellness Cafe is a Figma site.
 *
 * Content is what the old home page held, reorganised: the Wellness Cafe, the
 * two survey years (opening with the questions each answers, taken from those
 * sites' own pages), and the Art of Sense Foraging videos. The project is drawn
 * as a route with each year a stop -- the one map in a project called UTMaps.
 *
 * Built only from /brand tokens and the shared ui/ primitives: the design
 * ratchet (npm run audit:design:check) counts anything else.
 */

const CAFE = {
  desktop: 'https://flask-swim-03700594.figma.site/',
  mobile: 'https://notch-mac-46886428.figma.site/',
}

const YEARS = [
  {
    id: 'y2425',
    year: '2024–25',
    title: 'The UTM Student Wellbeing Survey 2024',
    href: 'https://sites.google.com/radlab.zone/2025wb/home',
    questions: [
      'How does your mental health compare to other students’?',
      'How does social interaction affect wellbeing?',
      'How do UTM students practise self-care?',
      'How are social media use and wellbeing related?',
      'What are the good and bad sides of academic stress?',
    ],
    pages: ['Who took part', 'Wellbeing', 'Mental & physical health', 'Interesting intersections', 'Gallery', 'Resources'],
  },
  {
    id: 'y2324',
    year: '2023–24',
    title: 'UTM Student Wellbeing',
    href: 'https://sites.google.com/radlab.zone/utm-student-wellbeing/home',
    questions: [
      'Who took part in the survey?',
      'What does wellbeing mean, and how did we measure it?',
      'What makes UTM students happy?',
      'How do mental and physical health connect?',
    ],
    pages: ['Who took part', 'Defining wellbeing', 'Happiness', 'Interesting intersections', 'Mental & physical health', 'Self-care', 'Resources'],
  },
]

// The three stops, oldest first. The last is the current year.
const ROUTE = [
  { year: '2023–24', title: 'UTM Student Wellbeing', sub: 'Defining wellbeing, happiness, self-care', href: '#y2324' },
  { year: '2024–25', title: 'The UTM Student Wellbeing Survey 2024', sub: 'Social life, social media, academic stress', href: '#y2425' },
  { year: '2025–26', title: 'Two years compared, and the Wellness Cafe', sub: 'What the 2024 and 2025 surveys show', href: '#findings', now: true },
]

// Maya Alves's knowledge-translation series, in episode order.
const EPISODES = [
  { n: 1, id: 'QzWtJsf0Mc0', title: 'Why do we get stuck?', desc: 'Maya tries harder and harder, but can’t seem to get unstuck in life.' },
  { n: 2, id: 'nuBpWETxSvs', title: 'The brain’s house of habit', desc: 'How the brain’s default network supports us, and also limits our freedom.' },
  { n: 3, id: 'UkGcussiLFw', title: 'Sensory access points', desc: 'The surprising role of sensation in getting unstuck.' },
]

export default function UtMaps({ session }) {
  return (
    <div style={S.page}>
      <Nav session={session} />

      {/* ── hero ─────────────────────────────────────────────────────── */}
      <section style={S.band}>
        <div style={S.container} className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] items-center gap-12">
          <div style={S.stack16}>
            <EyebrowLabel variant="nobg">UTMaps · UTM Wellness Maps</EyebrowLabel>
            <h1 style={S.h1}>
              Wellness information by the UTM community, <span style={{ color: 'var(--pkd)' }}>for</span> the UTM community.
            </h1>
            <p style={S.lede}>
              Each year, UTM students tell us how they’re doing. UTMaps turns their answers into maps of
              student wellbeing, this year’s Wellness Cafe, and short videos on the science of getting unstuck.
            </p>
            <div style={S.ctas}>
              <PrimaryCTA to="/utmaps/findings">Read the survey findings</PrimaryCTA>
              <SecondaryCTA href={CAFE.desktop}>Visit the 2026 Wellness Cafe ↗</SecondaryCTA>
            </div>
          </div>
          <RouteMap />
        </div>
      </section>

      {/* ── survey findings (2024 vs 2025) ───────────────────────────────
           The full summary lives at /utmaps/findings with its "not peer
           reviewed" notice. No figures here: the handoff keeps every number
           beside its caveats, so this panel only points to the page. */}
      <section id="findings" style={S.band}>
        <div style={S.container}>
          <Link to="/utmaps/findings" style={S.findings} className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-6">
            <div style={S.stack8}>
              <span style={S.label}>Survey findings · 2024 and 2025 · Not peer reviewed</span>
              <h2 style={S.h2}>What students report, and what they think everyone else is going through</h2>
              <p style={S.body}>
                Two surveys, a year apart, at the same campus. Distress is high and did not change. What students
                believe about each other turns out to have very little to do with how they are themselves.
              </p>
            </div>
            <span style={S.findingsGo}>Read the summary →</span>
          </Link>
        </div>
      </section>

      {/* ── wellness cafe ────────────────────────────────────────────── */}
      <section id="cafe" style={{ ...S.band, ...S.surfaceBand }}>
        <div style={S.container}>
          <div style={S.feature} className="grid grid-cols-1 md:grid-cols-2 items-center gap-8">
            <div style={S.stack16}>
              <EyebrowLabel variant="white">2025–26 · Interactive prototype</EyebrowLabel>
              <h2 style={S.h2}>Take a trip to the 2026 Wellness Cafe</h2>
              <p style={S.body}>
                Step up to the Wellness Drink Bar, this year’s interactive Wellness Cafe. It comes in two
                versions, one sized for a computer or tablet and one for a phone.
              </p>
              <div style={S.ctas}>
                <PrimaryCTA href={CAFE.desktop}>Open on desktop or tablet ↗</PrimaryCTA>
                <SecondaryCTA href={CAFE.mobile}>Open on mobile ↗</SecondaryCTA>
              </div>
            </div>
            <CafeIllustration />
          </div>
        </div>
      </section>

      {/* ── survey maps ──────────────────────────────────────────────── */}
      <section id="maps" style={S.band}>
        <div style={S.container}>
          <div style={S.secHead}>
            <EyebrowLabel variant="nobg">Survey maps</EyebrowLabel>
            <h2 style={S.h2}>What UTM students told us</h2>
            <p style={S.body}>Each year’s survey has its own site, with the findings drawn as maps and charts. Start with a question.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {YEARS.map(y => <YearCard key={y.id} {...y} />)}
          </div>
        </div>
      </section>

      {/* ── videos ───────────────────────────────────────────────────── */}
      <section id="videos" style={{ ...S.band, ...S.surfaceBand }}>
        <div style={S.container}>
          <div style={S.secHead}>
            <EyebrowLabel variant="nobg">The Art of Sense Foraging</EyebrowLabel>
            <h2 style={S.h2}>The science of getting unstuck, in three short episodes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {EPISODES.map(e => <Episode key={e.id} {...e} />)}
          </div>
          <p style={{ ...S.small, marginTop: 24 }}>
            A knowledge-translation series for RADlab by Maya Alves. Sense Foraging comes from{' '}
            <a href="https://www.betterineverysense.com" target="_blank" rel="noopener noreferrer" style={S.link}>Better in Every Sense</a>{' '}
            by Norman Farb and Zindel Segal.
          </p>
        </div>
      </section>

      {/* ── about ────────────────────────────────────────────────────── */}
      <section style={S.pinkBand}>
        <div style={S.container} className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] items-center gap-8">
          <div style={S.stack16}>
            <h2 style={{ ...S.h2, color: 'var(--bgc)' }}>
              UTMaps is a knowledge-translation project of RADlab at the University of Toronto Mississauga.
            </h2>
            <p style={{ ...S.body, color: 'var(--bgp)' }}>
              The Regulatory &amp; Affective Dynamics Lab studies affect, perception and adaptive regulation.
            </p>
          </div>
          <div style={S.ctas} className="md:justify-end">
            <PrimaryCTA variant="white" to="/lab/about">Visit RADlab</PrimaryCTA>
            <SecondaryCTA href="https://www.utm.utoronto.ca/" style={S.onPinkOutline}>UTM ↗</SecondaryCTA>
          </div>
        </div>
      </section>

      <SiteFooter session={session} />
    </div>
  )
}

function RouteMap() {
  return (
    <nav aria-label="UTMaps, year by year" style={S.mapCard}>
      <div style={S.mapHead}>
        <span style={S.label}>The route so far</span>
        <span style={{ ...S.label, color: 'var(--tx2)' }}>{ROUTE.length} stops</span>
      </div>
      <ol style={S.route}>
        <span aria-hidden="true" style={S.routeLine} />
        {ROUTE.map(stop => (
          <li key={stop.year} style={S.stop}>
            <span aria-hidden="true" style={{ ...S.dot, ...(stop.now ? S.dotNow : null) }} />
            <a href={stop.href} style={S.stopLink}>
              <span style={S.label}>{stop.year}{stop.now ? ' · You are here' : ''}</span>
              <span style={S.stopTitle}>{stop.title}</span>
              <span style={S.small}>{stop.sub}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function YearCard({ id, year, title, href, questions, pages }) {
  return (
    <article id={id} style={S.card}>
      <div style={S.stack8}>
        <span style={S.label}>{year}</span>
        <h3 style={S.h3}>{title}</h3>
      </div>
      <ul style={S.questions}>
        {questions.map(q => (
          <li key={q} style={S.question}>
            <span aria-hidden="true" style={S.bullet} />{q}
          </li>
        ))}
      </ul>
      <div style={S.topics} aria-label="Pages on this site">
        {pages.map(p => <span key={p} style={S.topic}>{p}</span>)}
      </div>
      <div>
        <SecondaryCTA href={href}>Open the {year} maps ↗</SecondaryCTA>
      </div>
    </article>
  )
}

function Episode({ n, id, title, desc }) {
  return (
    <a href={`https://youtu.be/${id}`} target="_blank" rel="noopener noreferrer" style={S.episode}>
      <span style={S.thumb}>
        <img src={`/images/utmaps/episode-${n}.jpg`} alt="" loading="lazy" style={S.thumbImg} />
        <span aria-hidden="true" style={S.play}>
          <svg viewBox="0 0 16 16" width="16" height="16" style={{ marginLeft: 4 }}><path d="M3 1.5v13l11-6.5z" style={{ fill: 'var(--bgc)' }} /></svg>
        </span>
      </span>
      <span style={S.label}>Episode {n}</span>
      <h3 style={S.h3}>{title}</h3>
      <span style={S.body}>{desc}</span>
    </a>
  )
}

// A counter seen from the front: a menu board with drawn lines (the real menu
// is in the prototype), four cups, steam over the one being poured.
function CafeIllustration() {
  const cups = [[150, 0.85], [270, 1], [390, 0.9], [500, 0.8]]
  return (
    <svg viewBox="0 0 640 480" role="img" aria-label="Illustration of a cafe counter" style={S.cafe}>
      <rect x="0" y="0" width="640" height="480" style={{ fill: 'var(--bgc)' }} />
      <rect x="64" y="48" width="512" height="150" rx="12" style={{ fill: 'var(--bgp)' }} />
      <text x="92" y="86" style={{ fill: 'var(--pkd)', font: '400 15px "Space Mono", monospace', letterSpacing: '0.08em' }}>TODAY’S MENU</text>
      {[0.62, 0.48, 0.55].map((w, i) => (
        <g key={i}>
          <rect x="92" y={110 + i * 28} width={392 * w} height="10" rx="5" style={{ fill: 'var(--tx2)', opacity: 0.3 }} />
          <circle cx="536" cy={115 + i * 28} r="5" style={{ fill: 'var(--pk)' }} />
        </g>
      ))}
      <rect x="40" y="380" width="560" height="4" style={{ fill: 'var(--bds)' }} />
      {cups.map(([x, s], i) => {
        const w = 70 * s, h = 82 * s, y = 380 - h, poured = i === 1
        const stroke = poured ? 'var(--pkd)' : 'var(--tx2)'
        return (
          <g key={x}>
            <path d={`M${x - w / 2},${y} L${x + w / 2},${y} L${x + w / 2 - 8},${y + h} L${x - w / 2 + 8},${y + h} Z`}
              style={{ fill: poured ? 'var(--pkd)' : 'var(--bgc)', stroke, strokeWidth: 3 }} />
            <path d={`M${x + w / 2 + 6 - 0},${y + h * 0.22} a${h * 0.2},${h * 0.2} 0 0 1 0,${h * 0.4}`}
              style={{ fill: 'none', stroke, strokeWidth: 3 }} />
          </g>
        )
      })}
      {[0, 1, 2].map(k => {
        const sx = 252 + k * 18
        return <path key={k} d={`M${sx},286 C${sx - 10},266 ${sx + 10},250 ${sx},230`}
          style={{ fill: 'none', stroke: 'var(--pk)', strokeWidth: 3, strokeLinecap: 'round' }} />
      })}
    </svg>
  )
}

const SERIF = '"DM Serif Display", Georgia, serif'
const SANS = '"DM Sans", system-ui, sans-serif'
const MONO = '"Space Mono", "Courier New", monospace'

const S = {
  page: { background: 'var(--bg)', minHeight: '100vh', color: 'var(--tx)', fontFamily: SANS },
  container: { width: '100%', maxWidth: 'var(--container-lg)', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' },
  band: { padding: '64px 0' },
  surfaceBand: { background: 'var(--bgc)', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)' },
  pinkBand: { background: 'var(--pkd)', padding: '48px 0' },

  stack8: { display: 'grid', gap: 8 },
  stack16: { display: 'grid', gap: 16, alignContent: 'start' },
  ctas: { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  secHead: { display: 'grid', gap: 8, marginBottom: 32, maxWidth: 672 },

  h1: { fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(28px, 5vw, 36px)', lineHeight: 1.2, margin: 0, color: 'var(--tx)', textWrap: 'balance' },
  h2: { fontFamily: SERIF, fontWeight: 400, fontSize: 28, lineHeight: 1.25, margin: 0, color: 'var(--tx)', textWrap: 'balance' },
  h3: { fontFamily: SERIF, fontWeight: 400, fontSize: 28, lineHeight: 1.25, margin: 0, color: 'var(--tx)', textWrap: 'balance' },
  lede: { fontSize: 16, lineHeight: 1.6, color: 'var(--tx2)', margin: 0, maxWidth: 560 },
  body: { fontSize: 16, lineHeight: 1.6, color: 'var(--tx2)', margin: 0 },
  small: { fontSize: 14, lineHeight: 1.5, color: 'var(--tx2)', margin: 0 },
  label: { fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pkd)' },
  link: { color: 'var(--pkd)' },

  mapCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, display: 'grid', gap: 16 },
  mapHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  route: { listStyle: 'none', margin: 0, padding: 0, position: 'relative', display: 'grid', gap: 8 },
  routeLine: { position: 'absolute', left: 12, top: 16, bottom: 16, width: 4, borderRadius: 999, background: 'linear-gradient(var(--pk), var(--pkd))' },
  stop: { position: 'relative', display: 'grid', gridTemplateColumns: '28px 1fr', gap: 16, alignItems: 'start' },
  dot: { position: 'relative', zIndex: 1, width: 28, height: 28, borderRadius: '50%', boxSizing: 'border-box', background: 'var(--bgc)', border: '4px solid var(--pkd)' },
  dotNow: { background: 'var(--pkd)', outline: '4px solid var(--bgp)' },
  stopLink: { display: 'grid', gap: 4, textDecoration: 'none', color: 'inherit' },
  stopTitle: { fontFamily: SANS, fontWeight: 600, fontSize: 16, lineHeight: 1.4, color: 'var(--tx)' },

  feature: { background: 'var(--bgp)', borderRadius: 12, padding: 32 },
  // The whole panel is the link, so it takes the clickable radius.
  findings: { display: 'grid', background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 24, padding: 32, textDecoration: 'none', color: 'inherit' },
  findingsGo: { fontFamily: SANS, fontWeight: 600, fontSize: 16, color: 'var(--pkd)', whiteSpace: 'nowrap' },
  cafe: { width: '100%', height: 'auto', display: 'block', borderRadius: 12, border: '1px solid var(--bd)' },

  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, display: 'grid', gap: 16, alignContent: 'start' },
  questions: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 },
  question: { display: 'grid', gridTemplateColumns: '16px 1fr', alignItems: 'start', fontSize: 16, lineHeight: 1.5, color: 'var(--tx)' },
  bullet: { width: 8, height: 8, borderRadius: '50%', background: 'var(--pk)', marginTop: 8 },
  topics: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  topic: { fontSize: 14, color: 'var(--tx2)', background: 'var(--bgp)', borderRadius: 12, padding: '0 8px' },

  episode: { display: 'grid', gap: 8, alignContent: 'start', textDecoration: 'none', color: 'inherit' },
  thumb: { position: 'relative', display: 'block', aspectRatio: '16 / 9', maxWidth: '100%', borderRadius: 12, overflow: 'hidden', background: 'var(--bgp)', border: '1px solid var(--bd)' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  play: { position: 'absolute', left: 16, bottom: 16, width: 48, height: 48, borderRadius: '50%', background: 'var(--pkd)', display: 'grid', placeItems: 'center' },

  // SecondaryCTA recoloured for the pink band (its default outline is --tx2).
  onPinkOutline: { border: '1px solid var(--bgp)', color: 'var(--bgc)' },
}
