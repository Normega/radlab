// Adobe L&D leaders · August 2026 — "Sense Foraging for Growth".
// A brief companion deck for a moderated Q&A ("The Brain Science of Behavior
// Change"); the slides follow the interviewer's question arc rather than a
// lecture, and two whole-room exercises are embedded (BreathCheck, DriftRoom).
// Same shell as /toni-july-2026: click / → / Space advance, ← back, N toggles
// speaker notes (which hold the talking points for each question), Minimal /
// Reading density. Source: "2026 Farb adobe source.pptx", reframed from
// happiness/depression toward growth.
import { useState, useEffect, useCallback } from 'react'
import { BreathCheck, DriftRoom } from './exercises'

export default function AdobeAug2026() {
  const [i, setI] = useState(0)
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('adobeDensity') || 'minimal' } catch { return 'minimal' }
  })
  const [showNotes, setShowNotes] = useState(false)

  const total = SLIDES.length
  const go = useCallback((d) => setI(v => Math.min(total - 1, Math.max(0, v + d))), [total])
  const setDens = useCallback((d) => {
    setDensity(d)
    try { localStorage.setItem('adobeDensity', d) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    function onKey(e) {
      // An exercise mid-flight owns the keyboard (Enter drives it).
      if (document.body.dataset.exerciseActive) return
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp')                { e.preventDefault(); go(-1) }
      else if (e.key === 'n' || e.key === 'N')                             { setShowNotes(s => !s) }
      else if (e.key === 'Home')                                          { setI(0) }
      else if (e.key === 'End')                                           { setI(total - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, total])

  const slide = SLIDES[i]

  return (
    <div style={K.stage} data-adobe onClick={() => { if (!slide.exercise) go(1) }}>
      <div style={K.controls} onClick={e => e.stopPropagation()}>
        <div style={K.toggle}>
          {['minimal', 'reading'].map(d => (
            <button key={d} onClick={() => setDens(d)} style={{ ...K.toggleBtn, ...(density === d ? K.toggleOn : {}) }}>
              {d === 'minimal' ? 'Minimal' : 'Reading'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNotes(s => !s)} style={{ ...K.notesBtn, ...(showNotes ? K.toggleOn : {}) }} title="Speaker notes (N)">
          Notes
        </button>
      </div>

      <div style={K.slideArea}>{slide.render(density)}</div>

      <div style={K.bottom} onClick={e => e.stopPropagation()}>
        <button onClick={() => go(-1)} style={{ ...K.navArrow, visibility: i === 0 ? 'hidden' : 'visible' }} aria-label="Previous">‹</button>
        <span style={K.counter}>{i + 1} / {total}</span>
        <button onClick={() => go(1)} style={{ ...K.navArrow, visibility: i === total - 1 ? 'hidden' : 'visible' }} aria-label="Next">›</button>
      </div>

      {i === 0 && <div style={K.clickHint}>click anywhere to advance · N for notes</div>}

      {showNotes && slide.note && (
        <div style={K.noteOverlay} onClick={e => e.stopPropagation()}>
          <span style={K.noteLabel}>Speaker note</span>
          <div style={K.noteBody}>{slide.note}</div>
        </div>
      )}
    </div>
  )
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function Frame({ kicker, children, wide }) {
  return (
    <div style={{ ...K.frame, ...(wide ? K.frameWide : {}) }}>
      {kicker && <div style={K.kicker}>{kicker}</div>}
      {children}
    </div>
  )
}
const H2   = ({ children }) => <h2 style={K.h2}>{children}</h2>
const Lead = ({ children }) => <p style={K.lead}>{children}</p>
function Bullets({ items }) {
  return <ul style={K.ul}>{items.map((t, i) => <li key={i} style={K.li}>{t}</li>)}</ul>
}
function Detail({ density, children }) {
  if (density !== 'reading') return null
  return <p style={K.detail}>{children}</p>
}
// The interviewer's question, quoted at the top of the slide that answers it.
function Q({ children }) {
  return <p style={K.q}>“{children}”</p>
}
function Cite({ children }) {
  return <p style={K.cite}>{children}</p>
}

// Two-mode diagram: Judging (narrative) vs Sensing — the deck's one picture.
function TwoModes({ dim }) {
  const box = (title, sub, tone, items) => (
    <div style={{ ...K.mode, borderColor: `${tone}66`, opacity: dim === title ? 0.45 : 1 }}>
      <div style={{ ...K.modeTitle, color: tone }}>{title}</div>
      <div style={K.modeSub}>{sub}</div>
      <ul style={{ ...K.ul, gap: 6 }}>
        {items.map((t, i) => <li key={i} style={{ ...K.li, fontSize: 'clamp(13px,1.6vw,18px)' }}>{t}</li>)}
      </ul>
    </div>
  )
  return (
    <div style={K.modes}>
      {box('Judging', 'the narrative brain · default mode', '#4A90D9',
        ['stories about self, past, future', 'fast, efficient, and closed', 'runs on what it already knows'])}
      <div style={K.modeArrow}>⇄</div>
      {box('Sensing', 'the experiencing brain · insula & body', '#f068a4',
        ['what is happening right now', 'slower, open, surprisable', 'the only channel that carries change'])}
    </div>
  )
}

// The brake pedal: stress → sensory inhibition → habit wins.
function Brake() {
  const step = (t, sub, tone) => (
    <div style={{ ...K.brakeStep, borderColor: `${tone}66` }}>
      <div style={{ ...K.modeTitle, color: tone, fontSize: 15 }}>{t}</div>
      <div style={K.modeSub}>{sub}</div>
    </div>
  )
  return (
    <div style={K.brake}>
      {step('Stress', 'a hard meeting, a mistake, a cue', '#c04a82')}
      <span style={K.modeArrow}>→</span>
      {step('Brake on sensing', 'prefrontal cortex inhibits body & sensory cortex', '#4A90D9')}
      <span style={K.modeArrow}>→</span>
      {step('Old default wins', 'no fresh signal, so the story fills in', '#6b6c70')}
    </div>
  )
}

// ── Slides ──────────────────────────────────────────────────────────────────

const SLIDES = [
  // 1 — Title
  {
    render: () => (
      <Frame wide>
        <div style={K.crests}>
          <img src="/RADlab_Logo_light.svg" alt="RADlab" style={{ height: 48 }} onError={e => { e.currentTarget.style.display = 'none' }} />
          <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 48 }} onError={e => { e.currentTarget.style.display = 'none' }} />
        </div>
        <h1 style={K.title}>Sense Foraging for Growth</h1>
        <p style={K.subtitle}>the brain science of behaviour change — and the channel we keep leaving out</p>
        <div style={{ height: 8 }} />
        <p style={K.author}>Norman Farb, PhD</p>
        <p style={K.affil}>Regulatory & Affective Dynamics Lab · Psychology · University of Toronto Mississauga</p>
        <p style={K.event}>Adobe Learning & Development · August 2026</p>
      </Frame>
    ),
    note: 'This is a conversation, not a lecture — the slides follow the questions. One idea underneath all of them: growth needs a signal that something changed, and under stress the brain turns that signal down. Sense foraging is the practice of turning it back up on purpose.',
  },

  // 2 — Where should we start? (Q1)
  {
    note: 'Start with the body, because it already knows how to do this. Homeostasis isn’t stillness — it’s staying balanced by responding to change. A healthy heart is a variable heart (HRV). Stress is a temporary imbalance (Selye): anger physiology clears in ~90 seconds, cortisol in ~90 minutes — if we let it. Growth is the same move at a larger scale: notice the change, respond, re-balance. So the minimum conditions for growth = a working sensing channel + permission to be moved by what it reports.',
    render: (d) => (
      <Frame kicker="Where to start">
        <Q>For a room full of people whose job is to help others change — where should we start?</Q>
        <H2>Balance comes from being responsive to change</H2>
        <Bullets items={[
          'Homeostasis is not stillness — a healthy body is a body that keeps adjusting (a variable heart is a healthy heart).',
          'Stress is a temporary imbalance: the anger surge is ~90 s, cortisol ~90 min — if the system gets to hear it is over.',
          'Growth is the same move at a larger scale: sense the change, respond, re-balance.',
        ]} />
        <Lead>The minimum condition for growth is a working sensing channel.</Lead>
        <Detail density={d}>
          Selye (1956) on stress as adaptation; heart-rate variability as the everyday marker that the body is
          still responsive. The framing shift from the original talk: not “how do we feel better” but “what has to be
          working for a person to be changed by experience at all”.
        </Detail>
      </Frame>
    ),
  },

  // 3 — Mental habits & the two modes (Q2, Q3)
  {
    note: 'A mental habit is a story that runs itself: an interpretation the brain reaches for before checking. Physical habits keep meeting friction from the world — the stairs push back. Mental habits don’t: the story is self-confirming and closes the loop before anything new arrives. Two modes (Farb 2007): a narrative/judging network (midline default mode: mPFC, PCC) and a sensing/experiencing network (insula, somatosensory). Training almost always talks to the narrative brain — “here’s what good looks like” — which is fine for content, but it isn’t the channel change comes through. People trained in sensing can tell which mode they’re in and switch; untrained people default to narrative without noticing.',
    render: (d) => (
      <Frame wide kicker="Mental habits">
        <Q>What is a mental habit, and why is it harder to change than a physical one? Are we missing something by only talking to the narrative brain?</Q>
        <TwoModes />
        <Lead>A mental habit is a story that no longer checks with the senses. Physical habits meet friction from the world; stories don’t.</Lead>
        <Detail density={d}>
          Farb et al., SCAN 2007: narrative self-focus engages midline cortex (mPFC/PCC); present-moment experiential
          focus recruits insula and lateral prefrontal regions — and only trained participants could decouple the two.
          The narrative brain is where training lives; the sensing brain is where change registers.
        </Detail>
        <Cite>Farb et al., Soc Cog Affect Neurosci (2007)</Cite>
      </Frame>
    ),
  },

  // 4 — Why the old default wins (Q5, Q9)
  {
    note: 'Why does the micromanager who knows better still micromanage under pressure? Because stress applies a brake to sensation. In our film-clip studies, sad mood inhibited sensory and body-representing cortex (insula, somatosensory) — and the more inhibition, the more depression, and the more likely relapse two years out (2010, 2011, 2022). Translate out of the clinic: under stress, the brain stops taking in fresh information about the situation and runs the cached story. The gap for “I know what I should do but I react the old way” is physiological before it is cognitive — the knowledge is intact; the channel that would tell you this moment is different from the last one is off.',
    render: (d) => (
      <Frame wide kicker="Why the old default wins">
        <Q>When someone genuinely wants to change, why does the old default so often win — especially under stress?</Q>
        <Brake />
        <Bullets items={[
          'Under emotional stress the brain inhibits sensory and body-representing cortex — the insula and somatosensory areas go quiet.',
          'More inhibition → worse mood now, and a stronger predictor of relapse two years later.',
          'The gap is physiological before it is cognitive: the knowledge is intact; the channel that says “this moment is different” is off.',
        ]} />
        <Detail density={d}>
          Farb et al., Emotion 2010 (N=36): sad film clips → reduced insula/somatosensory activation, scaling with
          depression. Biological Psychiatry 2011: visual-cortex inhibition tracks lower acceptance. Neuroimage: Clinical
          2022 (N=85×2): the same sensory-inhibition signature predicts time to relapse (~88% accuracy in-sample).
        </Detail>
        <Cite>Farb et al., Emotion 2010 · Biol Psychiatry 2011 · Neuroimage: Clinical 2022</Cite>
      </Frame>
    ),
  },

  // 5 — EXERCISE: breath check (Q8 setup)
  {
    exercise: true,
    note: 'Whole-room exercise, ~40 seconds. Everyone breathes with the circle for four breaths; after two, the pace changes (or doesn’t) at random. Show of hands: faster / slower / same. Then reveal. The point isn’t who was right — it’s that most people were guessing, and this is the cheapest possible test of whether the sensing channel is on. Enter starts; Enter again reveals; Space moves to the next slide.',
    render: () => (
      <Frame wide kicker="Exercise · 4 breaths">
        <BreathCheck />
      </Frame>
    ),
  },

  // 6 — Debrief: the body is the lever (Q8, Q9)
  {
    note: 'What just happened is interoception — noticing a change in your own body — and it is the underused lever. Two parts to sensory resilience (eNeuro 2023): attending to the breath quiets most of the neocortex (that’s the calming everyone chases), but healthy, confident body awareness keeps the salience network online — noticing amidst the quiet. Resilient people aren’t less quieted; they keep the capacity to notice. That is the difference between relaxation and growth: relaxation turns the volume down; growth keeps one channel open to be surprised.',
    render: (d) => (
      <Frame kicker="The body’s role">
        <Q>Most workplace training treats behaviour change as purely cognitive. Are we ignoring the body?</Q>
        <H2>Two parts to sensory resilience</H2>
        <Bullets items={[
          'Quieting — attending to the breath inhibits much of the neocortex. That is the calm everyone chases.',
          'Noticing — confident body awareness keeps the salience network online amid that quiet.',
          'Resilient people are not less quieted. They keep the capacity to notice — to be surprised by their own state.',
        ]} />
        <Lead>Relaxation turns the volume down. Growth keeps one channel open.</Lead>
        <Detail density={d}>
          Farb, Zuo & Price, eNeuro 2023: during breath-focused attention, greater interoceptive awareness (MAIA)
          predicted sparing of salience-network regions from the broad inhibition (r = −.32). What you can’t feel can’t
          move you — the change in pace you just tried to catch is the smallest unit of that.
        </Detail>
        <Cite>Farb, Zuo & Price, eNeuro (2023)</Cite>
      </Frame>
    ),
  },

  // 7 — Is it trainable? (Q6, Q7 cues)
  {
    note: 'Resilient vs vulnerable is not fixed — but it is not a workshop either. Meta-analysis: mindfulness training raises interoception (g ≈ 0.31, Treves 2025). In our RCT (N=156, Segal 2019) what protected people was decentering — being able to observe a thought or feeling as an event rather than a fact — and practice mattered only when it continued after the course (follow-up practice .42 on decentering; course practice alone, nothing on relapse). On cues: a cue hijacks behaviour when it carries body state — heart rate, tightness — not when it’s a word on a poster. A replacement cue sticks when it is sensory and brief: a check-in you can do in the doorway, not a mantra.',
    render: (d) => (
      <Frame kicker="Is it fixed?">
        <Q>Is resilience something we could build in an offsite or a workshop, or is it more fixed than that?</Q>
        <H2>Trainable — but by practice, not by the course</H2>
        <Bullets items={[
          'Mindfulness training reliably raises interoception (meta-analytic g ≈ 0.31).',
          'What protected people in our trial was decentering — seeing a thought as an event, not a fact. Growth was protective.',
          'Practice after the course predicted decentering; practice during it did not predict much on its own.',
          'Cues that hijack carry body state. Cues that stick are sensory, brief, and can be done in a doorway.',
        ]} />
        <Detail density={d}>
          Treves et al., 2025 meta-analysis. Farb et al., JCCP 2018 & Segal et al., JCCP 2019: N=156 RCT (MBCT vs
          CT); decentering mediated relapse protection; follow-up practice → decentering (β = .42), decentering →
          relapse (β = −.22). Design implication: fund the follow-up, not just the offsite.
        </Detail>
        <Cite>Treves et al. 2025 · Segal et al., JCCP 2019</Cite>
      </Frame>
    ),
  },

  // 8 — EXERCISE: Drift
  {
    exercise: true,
    note: 'Second exercise, ~1 minute. Drift is one of our games at radlab.zone: reproduce an interval by feel. Felt time is a readout of state — activated people compress it, low people stretch it. Room version: play the interval (tone, breathing circle, tone), then start the clock and ask people to raise a hand when it feels like the same time has passed; stop at roughly half the hands. The reveal shows actual vs room. Use it to make the point that a check-in doesn’t need a questionnaire — the body already has a number.',
    render: () => (
      <Frame wide kicker="Exercise · Drift">
        <DriftRoom />
      </Frame>
    ),
  },

  // 9 — Sense foraging: the practice
  {
    note: 'So what is the practice? Sense foraging: purposely shifting attention from thinking to sensing, with receptivity to the sensory world and a willingness to be surprised. Three steps, sixty seconds. Check in — what’s the state, honestly (a number, a word, a felt sense). Forage — find one thing to actually sense: the breath, the weight in the chair, the light in the room, the sound of the HVAC; not to relax, to notice. Check in again — did anything shift? The second check-in is the whole game: it is the moment the sensing channel gets to report a change, and that report is what the narrative brain then has to update around.',
    render: (d) => (
      <Frame kicker="The practice">
        <H2>Sense foraging</H2>
        <Lead>Purposely shifting attention from thinking to sensing, with receptivity to the sensory world and a willingness to be surprised.</Lead>
        <div style={K.steps}>
          {[
            ['1', 'Check in', 'What is the state, honestly? A number, a word, a felt sense.'],
            ['2', 'Forage', 'Find one thing to actually sense — breath, weight, light, sound. Not to relax. To notice.'],
            ['3', 'Check in again', 'Did anything shift? The second look is where change gets registered.'],
          ].map(([n, t, s]) => (
            <div key={n} style={K.step}>
              <div style={K.stepN}>{n}</div>
              <div style={K.stepT}>{t}</div>
              <div style={K.stepS}>{s}</div>
            </div>
          ))}
        </div>
        <Detail density={d}>
          Brief, targeted practices are what people will actually do. The research problem we work on is finding
          practices short enough to fit the moment and specific enough to address sensory shutdown — rather than
          asking everyone to meditate for forty minutes.
        </Detail>
      </Frame>
    ),
  },

  // 10 — For L&D (Q10, Q11, Q12)
  {
    note: 'If I redesigned corporate learning: throw out the assumption that insight is change — that telling the narrative brain a better story produces a new behaviour. The assumption my research contradicts: that mindsets change by argument. They change when the body reports something the story didn’t predict. Self-change vs helping others: same mechanism, different lever. You can’t forage for someone else — but you can create the conditions: permission to check in, a brief practice, and a moment in the meeting where noticing is welcome instead of embarrassing. A leader who visibly checks in gives everyone else the cue.',
    render: (d) => (
      <Frame wide kicker="For learning & development">
        <Q>What is the first thing you would throw out — and what assumption does your research contradict?</Q>
        <div style={K.twoCol}>
          <div style={K.col}>
            <div style={K.colHead('#c04a82')}>Throw out</div>
            <Bullets items={[
              'Insight = change. A better story for the narrative brain is content, not change.',
              'Mindsets change by argument. They change when the body reports something the story didn’t predict.',
              'The workshop as the unit. The unit is the follow-up practice.',
            ]} />
          </div>
          <div style={K.col}>
            <div style={K.colHead('#4A90D9')}>Keep, and add</div>
            <Bullets items={[
              'Content — but pair it with a sensory check-in so it lands in a body, not just a notebook.',
              'Brief, targeted practices people will actually do in a doorway.',
              'Leaders who check in out loud. You can’t forage for someone else, but you can make noticing welcome.',
            ]} />
          </div>
        </div>
        <Detail density={d}>
          Self-change and helping others change run on the same mechanism with different levers: for yourself, the
          practice; for others, the conditions — permission, brevity, and a moment in the meeting where a shift can be
          reported without embarrassment.
        </Detail>
      </Frame>
    ),
  },

  // 11 — One thing (Q13)
  {
    note: 'If you do one thing: before the next meeting where you expect to react the old way, check in, forage for sixty seconds, check in again. Not to be calmer — to give the sensing channel one chance to report that this moment is not the last one. That report is where growth starts.',
    render: () => (
      <Frame>
        <div style={K.kicker}>One thing</div>
        <h1 style={K.title}>Check in. Forage. Check back.</h1>
        <Lead>Before the next moment you expect to react the old way — sixty seconds, not to be calmer, but to let the body report that this moment is not the last one.</Lead>
      </Frame>
    ),
  },

  // 12 — Thanks
  {
    render: () => (
      <Frame>
        <h1 style={K.title}>Thank you</h1>
        <p style={K.subtitle}>norman.farb@utoronto.ca</p>
        <div style={{ height: 6 }} />
        <Bullets items={[
          'radlab.zone — the lab, the games (Drift, Breath Belt, Still Water) and the studies behind them',
          'Better in Every Sense — Farb & Segal (2024): the sense-foraging practices in full',
        ]} />
        <Cite>Regulatory & Affective Dynamics Lab · University of Toronto Mississauga</Cite>
      </Frame>
    ),
    note: 'Leave this up for questions.',
  },
]

// ── Styles (mirrors the Toni deck shell, with the Q / steps / modes additions) ──

const K = {
  stage: {
    position: 'fixed', inset: 0, background: 'var(--bg, #FCF0F5)',
    fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)',
    cursor: 'pointer', overflow: 'hidden',
  },
  controls: { position: 'absolute', top: 16, right: 18, zIndex: 5, display: 'flex', gap: 8, cursor: 'default' },
  toggle: { display: 'flex', background: '#fff', border: '1px solid var(--bd)', borderRadius: 999, padding: 2 },
  toggleBtn: { border: 'none', background: 'none', borderRadius: 999, padding: '5px 12px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  toggleOn: { background: 'var(--pk)', color: '#fff' },
  notesBtn: { border: '1px solid var(--bd)', background: '#fff', borderRadius: 999, padding: '5px 14px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },

  slideArea: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '52px 40px 56px', overflowY: 'auto' },
  frame: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', maxWidth: 1000, width: '100%' },
  frameWide: { maxWidth: 'min(1180px, 95vw)' },
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },

  title:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px, 6vw, 64px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.05 },
  subtitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(19px, 3vw, 32px)', fontWeight: 400, color: 'var(--pkd)', margin: 0, fontStyle: 'italic' },
  author:   { fontSize: 'clamp(16px, 2.1vw, 21px)', color: 'var(--tx)', margin: 0, fontWeight: 600 },
  affil:    { fontSize: 'clamp(13px, 1.6vw, 16px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, fontFamily: '"Space Mono",monospace' },
  event:    { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx3)', margin: '10px 0 0', letterSpacing: '0.06em' },
  crests:   { display: 'flex', gap: 32, alignItems: 'center', marginBottom: 6 },

  q:    { fontFamily: '"DM Serif Display",Georgia,serif', fontStyle: 'italic', fontSize: 'clamp(16px, 2.1vw, 24px)', color: 'var(--pkd)', margin: 0, lineHeight: 1.35, maxWidth: 900 },
  cite: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', margin: 0, letterSpacing: '0.03em' },

  h2:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(24px, 3.6vw, 40px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.12 },
  lead: { fontSize: 'clamp(16px, 2vw, 23px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, maxWidth: 820 },
  ul:   { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 860 },
  li:   { fontSize: 'clamp(15px, 1.9vw, 21px)', color: 'var(--tx)', lineHeight: 1.45, position: 'relative', paddingLeft: 24, textAlign: 'left' },
  detail: { fontSize: 'clamp(13px, 1.5vw, 16px)', color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 760, margin: 0, borderTop: '1px solid var(--bd)', paddingTop: 14 },

  twoCol: { display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  col: { flex: '1 1 320px', maxWidth: 480, textAlign: 'left' },
  colHead: (c) => ({ fontFamily: '"Space Mono",monospace', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: c, marginBottom: 10 }),

  modes: { display: 'flex', gap: 18, alignItems: 'stretch', justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  mode:  { flex: '1 1 300px', maxWidth: 440, background: '#fff', border: '1.5px solid', borderRadius: 18, padding: '18px 22px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 },
  modeTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.6vw, 30px)' },
  modeSub:   { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', letterSpacing: '0.03em' },
  modeArrow: { alignSelf: 'center', fontSize: 34, color: 'var(--tx3)' },

  brake: { display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  brakeStep: { flex: '1 1 220px', maxWidth: 300, background: '#fff', border: '1.5px solid', borderRadius: 16, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 },

  steps: { display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  step:  { flex: '1 1 240px', maxWidth: 300, background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '20px 22px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 },
  stepN: { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--pkd)', letterSpacing: '0.1em' },
  stepT: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.6vw, 30px)', color: 'var(--tx)' },
  stepS: { fontSize: 'clamp(13px, 1.6vw, 17px)', color: 'var(--tx2)', lineHeight: 1.45 },

  bottom: { position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, cursor: 'default' },
  navArrow: { border: 'none', background: 'none', color: 'var(--tx3)', fontSize: 30, lineHeight: 1, cursor: 'pointer', padding: '0 6px' },
  counter: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
  clickHint: { position: 'absolute', bottom: 44, left: 0, right: 0, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', opacity: 0.7, pointerEvents: 'none' },

  noteOverlay: { position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 90vw)', background: 'rgba(28,28,30,0.94)', color: '#fff', borderRadius: 12, padding: '14px 20px', cursor: 'default', zIndex: 6 },
  noteLabel: { fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ff9ec9' },
  noteBody: { fontSize: 14, lineHeight: 1.5, marginTop: 6 },
}

// Bullet markers (pink dot) — injected once.
if (typeof document !== 'undefined' && !document.getElementById('adobe-bullets')) {
  const s = document.createElement('style')
  s.id = 'adobe-bullets'
  s.textContent = `[data-adobe] li::before{content:'';position:absolute;left:4px;top:.62em;width:7px;height:7px;border-radius:50%;background:#f068a4}`
  document.head.appendChild(s)
}
