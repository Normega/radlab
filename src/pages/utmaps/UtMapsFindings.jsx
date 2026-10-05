import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import SiteFooter from '../../components/SiteFooter'

/*
 * /utmaps/findings — the public, plain-language summary of the UTMAP
 * manuscript (two survey waves, autumn 2024 and 2025), integrated 2026-10-05
 * from I:\Shared drives\UTMAP\2026 Paper\Web\utmaps\index.html and its
 * HANDOFF.md.
 *
 * The manuscript is under masked review at Canadian Psychology. Its author
 * note declares that this summary exists on the research group's website and
 * is labelled as not peer reviewed. So, from the handoff's non-negotiables:
 *
 *   1. The "Not peer reviewed" notice stays near the top, as a full paragraph.
 *   2. "What it does not support" stays, in full, beside "What we think it
 *      supports".
 *   3. "Students are under real strain" comes before "Nothing changed between
 *      the two years" (level before trend).
 *   4. Numbers and hedging words are verbatim from the analysis pipeline.
 *      Do not round or restate them; raise anything that looks wrong with Norm.
 *   5. The "One further caution" paragraph stays after the two-column block.
 *
 * Text here must match the source file. Content edits go there first (and past
 * Norm), then here. No author names on this page: it should not unmask the
 * masked review.
 *
 * Styling is the RADlab brand. The two chart hues are kept from the
 * manuscript's figures, which were checked for colour-vision deficiency; they
 * also mark the supports / does-not-support columns.
 */

// Chart hues from the manuscript's figures (CVD-checked). Data colours, not
// brand colours, so they are defined here rather than in index.css.
const CHART_CSS = `
.utm-findings {
  --utm-fit: #2a78d6;
  --utm-cross: #c4501d;
}
.utm-findings a:focus-visible, .utm-findings summary:focus-visible {
  outline: 2px solid var(--pkd);
  outline-offset: 4px;
}
.utm-findings summary { cursor: pointer; }
@media (prefers-reduced-motion: reduce) {
  .utm-findings * { animation: none !important; transition: none !important; }
}
`

export default function UtMapsFindings({ session }) {
  return (
    <div style={S.page} className="utm-findings">
      <style>{CHART_CSS}</style>
      <Nav session={session} />

      <header style={S.masthead}>
        <div style={S.wrap}>
          <p style={S.crumb}><Link to="/utmaps" style={S.crumbLink}>UTMaps</Link> / Findings</p>
          <p style={S.eyebrow}>UTMAP &middot; Campus wellbeing survey</p>
          <h1 style={S.h1}>What students report, and what they think everyone else is going through</h1>
          <p style={S.standfirst}>Two surveys, a year apart, at the same campus. Distress is
            high and did not change. What students believe about each other turns out to have
            very little to do with how they are themselves.</p>
        </div>
      </header>

      <main style={S.wrap}>

        <div style={S.status} role="note" aria-label="Not peer reviewed">
          <strong>Not peer reviewed.</strong> This is a plain-language summary of a manuscript
          under review at an academic journal. It has not been through peer review, and nothing
          on this page should be read as a peer-reviewed finding. Review may change what it
          says, and has already changed earlier drafts. The 2025 survey was pre-registered
          before any data were examined and the figures are reproducible from the de-identified
          data, but the interpretations are ours, and several of them are provisional in ways
          the page notes as it goes.
        </div>

        <h2 style={S.h2}>What we did</h2>
        <p style={S.kicker}>Two waves, in-person recruitment, six and a half minutes.</p>

        <p style={S.p}>In the autumn of 2024 and again in 2025, we set up tables around campus and asked
          students passing by to fill in a short survey on their phones. The median response
          took six and a half minutes. Students chose a stress-relieving item on the way out,
          usually a keychain toy.</p>

        <p style={S.p}>After the same exclusions in both years, 544 students answered in 2024 and 518 in
          2025. The questions, the wording and the recruitment were identical across waves,
          which is the part that matters: it means the two years can actually be compared.
          The 2025 wave was pre-registered, so the analyses were committed to in public before
          anyone looked at the data.</p>

        <h2 style={S.h2}>Students are under real strain</h2>
        <p style={S.kicker}>This is the finding everything else has to be read against.</p>

        <div style={S.figures}>
          <div style={S.fig}><span style={S.figN}>42.5%</span><span style={S.figLab}>screened positive
            for depression</span></div>
          <div style={S.fig}><span style={S.figN}>60.4%</span><span style={S.figLab}>screened positive
            for anxiety</span></div>
          <div style={S.fig}><span style={S.figN}>50%</span><span style={S.figLab}>in the moderate or
            severe range overall</span></div>
        </div>

        <p style={S.p}>A positive screen is not a diagnosis. The questionnaire we used is four items long
          and is designed to flag people worth asking more about, not to identify who has a
          condition. Screening tools of this kind reliably return higher numbers than a
          clinical interview would. The figures also move with where the threshold is set: at
          a stricter cut-off they fall to 27.4% and 43.4%.</p>

        <p style={S.p}>Whichever threshold you prefer, a large share of students are reporting symptom
          levels that warrant attention, and that was equally true a year earlier.</p>

        <h3 style={S.h3}>At the same time, most students are doing well in other ways</h3>
        <p style={S.p}>84% reported a sense of belonging above the midpoint of the scale, 82% a sense of
          purpose, and 73% satisfaction with their lives. Distress and flourishing are not
          opposite ends of one measure. A student can be anxious and still find their work
          meaningful and their friends real.</p>

        <p style={S.p}>That separation has a limit worth naming. It holds between symptom measures and
          social measures. It does not hold for how students rate their own mental health
          overall, which tracked their symptoms, as you would expect. And one student in six
          fell below the midpoint on belonging, in a commuter campus where loneliness was the
          single stressor most strongly tied to every outcome we measured.</p>

        <h2 style={S.h2}>Nothing changed between the two years</h2>
        <p style={S.kicker}>Not &quot;we failed to find a change&quot; &mdash; a change that small can be ruled out.</p>

        <p style={S.p}>Anxiety, depression, self-rated physical health and self-rated mental health were
          all statistically indistinguishable between 2024 and 2025. We tested this the strict
          way, using a method that can rule out a difference rather than merely fail to find
          one, and even a small change can be excluded.</p>

        <p style={S.p}>Two years is two years. It cannot tell you about the decade, and we do not claim
          otherwise: national Canadian data show reported distress rising through the 2010s,
          and we take that as established. What our data say is that the level has been flat
          across the most recent interval we can measure, which is consistent with national
          figures since 2021.</p>

        <h2 style={S.h2}>Students misjudge each other, in both directions</h2>
        <p style={S.kicker}>The part we did not expect.</p>

        <p style={S.p}>We asked students the same questions twice: once about themselves, and once about
          where they thought most students they know would score on average. The gap between
          those two answers is not what we assumed it would be.</p>

        <figure style={S.figure}>
          <div style={S.chartShell}>
            <PeerChart />
          </div>
          <figcaption style={S.figcaption}>The blue line is the relationship we actually measured between a
            student's own depression score and where they placed their peers. If students
            simply assumed everyone was like them, it would sit on the dashed line. Instead
            it is much flatter, and the two cross near the middle of the scale (orange dot).
            The same pattern holds for anxiety and for life satisfaction.</figcaption>
        </figure>

        <p style={S.p}>Students who reported no depression placed their peers well above themselves.
          Students who reported the most placed their peers <em>below</em> themselves. The
          direction of the error flips depending on how the person answering is doing.</p>

        <p style={S.pull}>Almost everyone converges on roughly the same guess about everyone
          else, and that guess has very little to do with what they can actually see.</p>

        <p style={S.p}>This is close to what you would predict if students simply cannot observe how their
          peers are doing. Nobody has good information, so everyone falls back on a similar
          default. Students who are struggling end up underestimating how common that is;
          students who are doing well end up overestimating it.</p>

        <p style={S.p}>Averaged across the whole sample, the guesses did lean pessimistic: students placed
          their peers as more depressed and less satisfied than the sample actually was. But
          that average is a property of who was in the room, not a bias each student carries.</p>

        <h2 style={S.h2}>Most students think things are getting worse</h2>

        <p style={S.p}>Six students in ten said mental health struggles are more common now than in
          previous years. What predicted that belief was not how the student was doing. Their
          own depression, anxiety and life satisfaction together accounted for about 4% of the
          variation in it. How much they had heard other students talking about mental health
          accounted for considerably more.</p>

        <p style={S.p}>Students who were screening negative on everything held the belief about as firmly
          as students who were screening positive. And first-year students, a few weeks into
          their first term, held it about as firmly as students in their fifth year.</p>

        <p style={S.p}>We want to be careful here. We did not ask students what period they had in mind.
          Someone thinking about the past decade is agreeing with the national evidence, not
          misreading it. What we can say is that the belief does not appear to be an inference
          drawn from watching this campus, because the people who have watched it longest do
          not hold it any differently.</p>

        <h2 style={S.h2}>What this does and does not mean</h2>

        <div style={S.reading} className="grid grid-cols-1 md:grid-cols-2">
          <div style={{ ...S.readingCol, borderTopColor: 'var(--utm-fit)' }}>
            <h3 style={{ ...S.h3, marginTop: 0 }}>What we think it supports</h3>
            <ul style={S.ul}>
              <li style={S.li}>Student distress at this campus is high and has been high for at least two
                years running.</li>
              <li style={S.li}>Steady, planned support is a better fit for a steady, high level of need
                than year-to-year emergency budgeting.</li>
              <li style={S.li}>Loneliness and belonging deserve more attention than their share of the
                conversation suggests.</li>
              <li style={S.li}>Students have almost no reliable information about how their peers are
                doing, and that is a fixable problem.</li>
            </ul>
          </div>
          <div style={{ ...S.readingCol, borderTopColor: 'var(--utm-cross)' }}>
            <h3 style={{ ...S.h3, marginTop: 0 }}>What it does not support</h3>
            <ul style={S.ul}>
              <li style={S.li}><strong>That services are adequately resourced.</strong> We measured symptom
                levels. We did not measure service demand, waiting times, or unmet need.</li>
              <li style={S.li}><strong>That crisis capacity can be reduced.</strong> We asked nothing about
                suicidality or risk. A flat average is entirely compatible with a rising number
                of students in crisis.</li>
              <li style={S.li}><strong>That students are imagining it.</strong> Two in five screening
                positive for depression is not an imaginary problem.</li>
              <li style={S.li}><strong>That distress is falling.</strong> It is not falling. It is not
                rising either. It is high and it is staying there.</li>
            </ul>
          </div>
        </div>

        <p style={S.p}>One further caution, about a tempting response. If a campus simply announced the
          average, it would be telling the two-thirds of students who are struggling that they
          are further from typical than they thought. That is the opposite of what reducing
          stigma is meant to achieve. Any attempt to give students better information about
          each other needs to be designed carefully and then tested, not assumed to help.</p>

        <h2 style={S.h2}>Limitations</h2>

        <details style={S.details}>
          <summary style={S.summary}>Who answered, and who did not</summary>
          <p style={S.detailsP}>We recruited by standing at tables on campus, so we reached students who walk
            past tables. That under-represents students who are rarely on campus, and women
            are over-represented relative to the student body. There is no sampling frame,
            which means these numbers describe the students who answered rather than the
            campus as a whole.</p>
        </details>

        <details style={S.details}>
          <summary style={S.summary}>One campus, two years</summary>
          <p style={S.detailsP}>Everything here is from a single institution over a twelve-month interval. The
            stability finding is about that interval. It is not a claim about Canadian students
            generally, and it is not a claim about the longer trend.</p>
        </details>

        <details style={S.details}>
          <summary style={S.summary}>Short measures</summary>
          <p style={S.detailsP}>The brevity that made the survey work is also a limit. Four items for anxiety and
            depression, single items for life satisfaction and self-rated health. We measured
            no suicidality, no functional impairment and no service use, which is why the page
            above says nothing about any of them.</p>
        </details>

        <details style={{ ...S.details, borderBottom: '1px solid var(--bds)' }}>
          <summary style={S.summary}>What we would change</summary>
          <p style={S.detailsP}>The peer-estimate question asked students to place others on the same scale they
            had just used themselves, which turns out to invite the convergence we found. In
            2026 we will ask for a percentage instead, which has an answer that can be checked.
            We will also specify a time window on the &quot;getting worse&quot; question, ask about
            exposure condition by condition, and add items on help-seeking and unmet need.</p>
        </details>

        <h2 style={S.h2}>What happens next</h2>

        <p style={S.p}>A third wave runs in 2026, with the analyses in this summary pre-registered in
          advance as predictions rather than reported after the fact. That is the test that
          matters: findings arrived at by looking are worth less than findings committed to
          beforehand, and several of the results above are currently in the first category.</p>

        <p style={S.p}>The analysis code and the de-identified data are available, and the results on this
          page can be reproduced from them.</p>

        <div style={S.about}>
          <p style={S.p}><strong>UTMAP</strong> is a campus wellbeing survey run by the Regulatory &amp;
            Affective Dynamics Lab. The survey has been approved by the institutional research
            ethics board.</p>
          <p style={{ ...S.p, marginBottom: 0 }}>Summary last updated 4 October 2026. For questions, or to ask about the data,{' '}
            <Link to="/lab/contact" style={S.link}>contact the lab</Link>.</p>
        </div>
      </main>

      <SiteFooter session={session} />
    </div>
  )
}

// Hand-authored from the manuscript's figure. The geometry encodes real values
// and must not be nudged by eye (HANDOFF §5):
//   x: own depression score 0–6  -> px 70..420
//   y: peer estimate 0–6         -> px 300..30
//   dashed: identity (peer = own); blue: measured fit peer = 1.96 + 0.342 × self
//   orange dot: where the two cross, at 2.98
// Rescale both lines together and recompute the crossing if this ever changes.
function PeerChart() {
  return (
    <svg viewBox="0 0 460 350" role="img" style={S.svg}
      aria-label="Chart showing that students' estimates of their peers change much less than their own scores do. Students reporting no depression place peers well above themselves; students reporting the most place peers below themselves. The two lines cross near the middle of the scale.">
      <defs>
        <marker id="utm-ar" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" style={{ fill: 'var(--utm-fit)' }} />
        </marker>
      </defs>

      <g style={{ stroke: 'var(--bds)', strokeWidth: 1 }}>
        <line x1="70" y1="300" x2="420" y2="300" />
        <line x1="70" y1="30" x2="70" y2="300" />
      </g>

      <g style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fill: 'var(--tx2)' }}>
        <text x="70" y="320" textAnchor="middle" fontSize="11">0</text>
        <text x="245" y="320" textAnchor="middle" fontSize="11">3</text>
        <text x="420" y="320" textAnchor="middle" fontSize="11">6</text>
        <text x="62" y="304" textAnchor="end" fontSize="11">0</text>
        <text x="62" y="169" textAnchor="end" fontSize="11">3</text>
        <text x="62" y="34" textAnchor="end" fontSize="11">6</text>
        <text x="245" y="341" textAnchor="middle" fontSize="11" style={{ fill: 'var(--tx)' }}>Their own depression score</text>
        <text transform="rotate(-90 20 165)" x="20" y="165" textAnchor="middle" fontSize="11" style={{ fill: 'var(--tx)' }}>Where they place their peers</text>
      </g>

      {/* identity line */}
      <line x1="70" y1="300" x2="420" y2="30" style={{ stroke: 'var(--tx2)', strokeWidth: 1.5, strokeDasharray: '5 4' }} />
      <text x="398" y="46" fontSize="11" textAnchor="end" style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fill: 'var(--tx2)' }}>same as themselves</text>

      {/* fitted line: peer = 1.96 + 0.342 x self */}
      <line x1="70" y1="212" x2="420" y2="120" style={{ stroke: 'var(--utm-fit)', strokeWidth: 3, strokeLinecap: 'round' }} />

      {/* crossing point */}
      <circle cx="244" cy="166" r="4.5" style={{ fill: 'var(--utm-cross)' }} />

      <g style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fill: 'var(--tx)' }}>
        <text x="86" y="196" fontSize="11.5">sees peers as worse off</text>
        <text x="86" y="211" fontSize="11.5" style={{ fill: 'var(--tx2)' }}>than themselves</text>
        <text x="404" y="140" fontSize="11.5" textAnchor="end">sees peers as better off</text>
        <text x="404" y="155" fontSize="11.5" textAnchor="end" style={{ fill: 'var(--tx2)' }}>than themselves</text>
      </g>

      <g style={{ stroke: 'var(--utm-fit)', fill: 'none', strokeWidth: 1.2 }}>
        <path d="M80,190 L74,214" markerEnd="url(#utm-ar)" />
        <path d="M410,146 L416,124" markerEnd="url(#utm-ar)" />
      </g>
    </svg>
  )
}

const SERIF = '"DM Serif Display", Georgia, serif'
const SANS = '"DM Sans", system-ui, sans-serif'
const MONO = '"Space Mono", "Courier New", monospace'

const S = {
  page: { background: 'var(--bg)', minHeight: '100vh', color: 'var(--tx)', fontFamily: SANS },
  // Reading measure (~34rem) kept from the source: this page is read, not scanned.
  wrap: { width: '100%', maxWidth: 544, margin: '0 auto', padding: '0 24px', boxSizing: 'content-box' },
  masthead: { borderBottom: '1px solid var(--bds)', padding: '48px 0 32px', marginBottom: 32, background: 'var(--bgc)' },
  crumb: { fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 16px' },
  crumbLink: { color: 'var(--pkd)', textDecoration: 'none' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pkd)', margin: '0 0 16px' },
  h1: { fontFamily: SERIF, fontWeight: 400, fontSize: 36, lineHeight: 1.15, margin: '0 0 16px', color: 'var(--tx)', textWrap: 'balance' },
  standfirst: { fontFamily: SANS, fontSize: 16, lineHeight: 1.5, color: 'var(--tx2)', margin: 0, textWrap: 'pretty' },

  status: { background: 'var(--bgp)', border: '1px solid var(--pkbs)', borderRadius: 12, padding: '16px 24px', fontSize: 16, lineHeight: 1.6, color: 'var(--tx)', margin: '32px 0' },

  h2: { fontFamily: SERIF, fontWeight: 400, fontSize: 28, lineHeight: 1.25, margin: '48px 0 4px', color: 'var(--tx)', textWrap: 'balance' },
  kicker: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 24px' },
  h3: { fontFamily: SANS, fontWeight: 600, fontSize: 16, lineHeight: 1.5, margin: '32px 0 8px', color: 'var(--tx)' },
  p: { fontSize: 16, lineHeight: 1.7, margin: '0 0 16px', color: 'var(--tx)', textWrap: 'pretty' },
  link: { color: 'var(--pkd)' },

  figures: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(144px, 1fr))', gap: 1, background: 'var(--bds)', border: '1px solid var(--bds)', borderRadius: 12, overflow: 'hidden', margin: '24px 0' },
  fig: { background: 'var(--bgc)', padding: '16px', minWidth: 0 },
  figN: { display: 'block', fontFamily: SERIF, fontSize: 36, lineHeight: 1, marginBottom: 8, fontVariantNumeric: 'tabular-nums', color: 'var(--tx)' },
  figLab: { fontSize: 14, lineHeight: 1.4, color: 'var(--tx2)' },

  figure: { margin: '32px 0' },
  chartShell: { overflowX: 'auto', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16 },
  svg: { display: 'block', width: '100%', maxWidth: 460, height: 'auto', margin: '0 auto' },
  figcaption: { fontSize: 14, lineHeight: 1.6, color: 'var(--tx2)', marginTop: 16 },

  pull: { fontFamily: SERIF, fontSize: 28, lineHeight: 1.35, borderLeft: '2px solid var(--pkd)', padding: '0 0 0 24px', margin: '32px 0', color: 'var(--tx)', textWrap: 'pretty' },

  reading: { gap: 24, margin: '24px 0' },
  readingCol: { minWidth: 0, borderTop: '4px solid', paddingTop: 16 },
  ul: { margin: 0, paddingLeft: 16, listStyle: 'disc' },
  li: { fontSize: 16, lineHeight: 1.6, marginBottom: 8, color: 'var(--tx)' },

  details: { borderTop: '1px solid var(--bds)', padding: '16px 0' },
  summary: { fontWeight: 600, fontSize: 16, color: 'var(--tx)' },
  detailsP: { fontSize: 16, lineHeight: 1.7, margin: '8px 0 0', color: 'var(--tx)' },

  about: { borderTop: '1px solid var(--bds)', marginTop: 48, padding: '24px 0 64px', color: 'var(--tx2)' },
}
