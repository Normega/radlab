// ISARP keynote — single-page click-through deck (replaces PowerPoint) and
// permanent read-later resource on radlab.zone. Click anywhere to advance;
// ← / → / Space also work. Two density modes (Minimal for stage, Reading for
// the standalone resource) toggle live so both can be compared. Speaker notes
// (figure sources + spoken-only content) toggle with the notes button or "N".
// The two live demos are NOT embedded — their slides link out in a new tab.
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PositionIcons, SalienceMagnitudeSchematic, MissTrialTrace,
  MaiaScatter, NeuralFlow, PacerAttentionIllustration,
} from './graphics'

const DEMO_PACER = '/demo/pacer-opener'
const DEMO_BELT  = '/demo/breath-belt'

// Figures that exist in public/keynote (BCAT behavioral). Neuro figures are
// left as drop-in slots — see FIG placeholders below.
export default function Keynote() {
  const [i, setI] = useState(0)
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('keynoteDensity') || 'minimal' } catch { return 'minimal' }
  })
  const [showNotes, setShowNotes] = useState(false)

  const slides = SLIDES
  const total  = slides.length
  const go = useCallback((d) => setI(v => Math.min(total - 1, Math.max(0, v + d))), [total])

  const setDens = useCallback((d) => {
    setDensity(d)
    try { localStorage.setItem('keynoteDensity', d) } catch { /* ignore */ }
  }, [])

  // Preload figures so click-through never stalls on stage.
  useEffect(() => {
    FIGURE_PRELOAD.forEach(src => { const im = new Image(); im.src = src })
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp')                { e.preventDefault(); go(-1) }
      else if (e.key === 'n' || e.key === 'N')                             { setShowNotes(s => !s) }
      else if (e.key === 'Home')                                          { setI(0) }
      else if (e.key === 'End')                                           { setI(total - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, total])

  const slide = slides[i]

  return (
    <div style={K.stage} data-keynote onClick={() => go(1)}>
      {/* Top-right controls — do not advance on click */}
      <div style={K.controls} onClick={e => e.stopPropagation()}>
        <div style={K.toggle}>
          {['minimal', 'reading'].map(d => (
            <button
              key={d}
              onClick={() => setDens(d)}
              style={{ ...K.toggleBtn, ...(density === d ? K.toggleOn : {}) }}
            >
              {d === 'minimal' ? 'Minimal' : 'Reading'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNotes(s => !s)}
          style={{ ...K.notesBtn, ...(showNotes ? K.toggleOn : {}) }}
          title="Speaker notes (N)"
        >
          Notes
        </button>
      </div>

      {/* Slide body */}
      <div style={K.slideArea}>
        {slide.render(density)}
      </div>

      {/* Bottom bar: back arrow + counter + advance hint */}
      <div style={K.bottom} onClick={e => e.stopPropagation()}>
        <button onClick={() => go(-1)} style={{ ...K.navArrow, visibility: i === 0 ? 'hidden' : 'visible' }} aria-label="Previous">‹</button>
        <span style={K.counter}>{i + 1} / {total}</span>
        <button onClick={() => go(1)} style={{ ...K.navArrow, visibility: i === total - 1 ? 'hidden' : 'visible' }} aria-label="Next">›</button>
      </div>

      {i === 0 && <div style={K.clickHint}>click anywhere to advance</div>}

      {/* Speaker-notes overlay */}
      {showNotes && slide.note && (
        <div style={K.noteOverlay} onClick={e => e.stopPropagation()}>
          <span style={K.noteLabel}>Speaker note</span>
          <div style={K.noteBody}>{slide.note}</div>
        </div>
      )}
    </div>
  )
}

// ── Layout + content helpers ────────────────────────────────────────────────

function Frame({ kicker, children, wide }) {
  return (
    <div style={{ ...K.frame, ...(wide ? K.frameWide : {}) }}>
      {kicker && <div style={K.kicker}>{kicker}</div>}
      {children}
    </div>
  )
}
const H = ({ children }) => <h1 style={K.h}>{children}</h1>
const H2 = ({ children }) => <h2 style={K.h2}>{children}</h2>
const Lead = ({ children }) => <p style={K.lead}>{children}</p>
function Bullets({ items }) {
  return (
    <ul style={K.ul}>
      {items.map((t, i) => <li key={i} style={K.li}>{t}</li>)}
    </ul>
  )
}
// Reading-mode-only supporting prose.
function Detail({ density, children }) {
  if (density !== 'reading') return null
  return <p style={K.detail}>{children}</p>
}

function Figure({ src, alt, missingLabel, maxH = '64vh' }) {
  const [err, setErr] = useState(false)
  const [zoom, setZoom] = useState(false)
  if (err || !src) {
    return (
      <div style={K.figPlaceholder}>
        <span style={K.figPlaceIcon}>▦</span>
        <span style={K.figPlaceText}>{missingLabel}</span>
        {src && <span style={K.figPlacePath}>drop image at <code>public{src}</code></span>}
      </div>
    )
  }
  return (
    <>
      <img
        src={src}
        alt={alt}
        title="Click to enlarge"
        style={{ ...K.figImg, maxHeight: maxH, cursor: 'zoom-in' }}
        onError={() => setErr(true)}
        onClick={e => { e.stopPropagation(); setZoom(true) }}
      />
      {zoom && (
        <div style={K.lightbox} onClick={e => { e.stopPropagation(); setZoom(false) }}>
          <img src={src} alt={alt} style={K.lightboxImg} />
          <span style={K.lightboxHint}>click anywhere to close</span>
        </div>
      )}
    </>
  )
}

function DemoLink({ href, label, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
      <a href={href} target="_blank" rel="noopener noreferrer" style={K.demoBtn}>{label} ↗</a>
      {sub && <span style={K.demoSub}>{sub}</span>}
    </div>
  )
}

// ── Slides (1–23, matching the brief) ───────────────────────────────────────

const SLIDES = [
  // 1 — Title
  {
    render: () => (
      <Frame>
        <div style={K.crests}>
          <img src="/RADlab_Logo_light.svg" alt="RADlab" style={{ height: 60 }} />
          <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 60 }} />
        </div>
        <h1 style={K.title}>What You Miss Won’t Move You</h1>
        <p style={K.subtitle}>Awareness Connects Respiratory Change to Subjective Arousal</p>
        <div style={{ height: 18 }} />
        <p style={K.author}>Professor Norman Farb</p>
        <p style={K.affil}>Department of Psychological and Brain Sciences<br />University of Toronto Mississauga</p>
        <p style={K.event}>ISARP Keynote · 2026</p>
      </Frame>
    ),
  },

  // 2 — Vignette hook
  {
    note: 'Deliver as a short spoken story — about 30 seconds. Let the four beats breathe; do not read them verbatim. Image: provided illustration — confirm usage rights for the hosted page.',
    render: () => (
      <Frame wide kicker="A moment">
        <div style={{ display: 'flex', gap: 44, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <img
            src="/keynote/anxious.png"
            alt="A person feeling acutely anxious"
            style={{ width: 'min(360px, 68vw)', borderRadius: 16, boxShadow: '0 6px 30px rgba(0,0,0,0.12)', flexShrink: 0 }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <div style={{ maxWidth: 460 }}>
            <Bullets items={[
              'Someone with anxiety — heart pounding, breath tight.',
              "A wave of undifferentiated arousal hits. They can't break it down or get a handle on it.",
              'Two clinicians disagree: one says calm the body, one says change the meaning.',
              'Who is right depends on something we have not been able to test.',
            ]} />
          </div>
        </div>
      </Frame>
    ),
  },

  // 3 — Three positions
  {
    note: 'Spoken, not on slide: medication or relaxation for the body; mindfulness or cognitive therapy for meaning.',
    render: (d) => (
      <Frame kicker="Three positions, three intervention targets">
        <H2>How does a change in the breath become subjective arousal?</H2>
        <PositionIcons />
        <Lead>Intractable until now: we couldn't independently manipulate bodily arousal and detection probability to see their separate impact on felt arousal.</Lead>
        <Detail density={d}>
          The task manipulates both breathing rate and detection probability, letting us adjudicate
          between the three positions rather than argue them.
        </Detail>
      </Frame>
    ),
  },

  // 4 — Breath frame
  {
    render: (d) => (
      <Frame wide kicker="The breath">
        <div style={{ display: 'flex', gap: 44, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', textAlign: 'left' }}>
            <H>One signal we both feel and control</H>
            <Bullets items={[
              'Relaxation techniques use it to change the body.',
              'Mindfulness and third-wave therapies use it as an anchor for appraisal — to change the meaning.',
            ]} />
            <Lead>One signal, both mechanisms, directly tied to therapeutic practice.</Lead>
            <Detail density={d}>
              Because breathing is simultaneously sensed and voluntarily controllable, it is the rare
              physiological channel where the "change the body" and "change the meaning" routes to
              emotion regulation can be studied with the same manipulation.
            </Detail>
          </div>
          <img
            src="/keynote/breath.png"
            alt="A person pausing to breathe amid a crowd"
            style={{ width: 'min(360px, 68vw)', borderRadius: 16, boxShadow: '0 6px 30px rgba(0,0,0,0.12)', flexShrink: 0 }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      </Frame>
    ),
  },

  // 5 — Opener demo (live)
  {
    note: 'Run live. Four breaths, no explanation beforehand. Open the demo in a new tab, run breathe → polls → reveal there, then return here and click forward.',
    render: () => (
      <Frame kicker="Live · everyone">
        <H>Breathe with the circle</H>
        <Lead>Four breaths together. No explanation yet — just follow.</Lead>
        <DemoLink href={DEMO_PACER} label="Open the pacer" sub="opens in a new tab · return here after" />
      </Frame>
    ),
  },

  // 6 — Return, live polls
  {
    render: () => (
      <Frame kicker="You just voted">
        <div style={K.pollGrid}>
          <PollCard q="Did the pace change?" opts={['Faster', 'Slower', 'Same']} />
          <PollCard q="How confident were you?" opts={['Confident', 'Not confident']} />
          <PollCard q="What happened to your arousal?" opts={['More activated', 'Same', 'Calmer']} />
        </div>
        <Lead>Did noticing — or not noticing — change how you felt?</Lead>
      </Frame>
    ),
  },

  // 7 — The confound and the fix
  {
    render: (d) => (
      <Frame kicker="The confound, and the fix">
        <H>Change magnitude and detection move together</H>
        <Bullets items={[
          'Bigger changes are both more arousing and easier to detect.',
          'So arousal and detection are normally confounded.',
        ]} />
        <Lead>This paradigm is designed to break that confound and test the three positions directly.</Lead>
        <Detail density={d}>
          If you only ever present larger changes, you can never tell whether felt arousal follows the
          size of the bodily change or the fact that it was noticed. Separating the two is the whole game.
        </Detail>
      </Frame>
    ),
  },

  // 8 — BCAT design: salience × magnitude schematic
  {
    render: (d) => (
      <Frame kicker="Breath Change Awareness Task (BCAT)">
        <Bullets items={[
          'Breath rate can be paced, changed by a known amount, and verified with a belt.',
          'This separates detection from magnitude for the first time.',
          'The change is delivered abruptly or gradually, across a range of magnitudes.',
        ]} />
        <SalienceMagnitudeSchematic />
        <Detail density={d}>
          Salience (abrupt vs gradual onset) is crossed with magnitude (how large the rate change is),
          so detection can be moved independently of how big the bodily change actually is.
        </Detail>
      </Frame>
    ),
  },

  // 9 — Methods overview table
  {
    render: (d) => (
      <Frame kicker="Five studies · N = 787">
        <MethodsTable />
        <Detail density={d}>
          Each study adds a control — salience manipulation, a visual control condition, physiological
          recording, preregistration — culminating in the preregistered, physiologically verified test in Study 5.
        </Detail>
      </Frame>
    ),
  },

  // 10 — Staircase finds each person's threshold
  {
    render: (d) => (
      <Frame wide kicker="Finding the threshold">
        <H2>A staircase finds each person’s detection threshold</H2>
        <Figure src="/keynote/fig-staircase.png" alt="QUEST staircase level across trials" missingLabel="Staircase figure" maxH="62vh" />
        <Detail density={d}>
          Studies 1A–2 use a single staircase; Studies 4–5 cross salience (high/low) with direction
          (acceleration/deceleration). The staircase converges on the smallest change each person can detect.
        </Detail>
      </Frame>
    ),
  },

  // 11 — Result 1: detection curve
  {
    note: 'Figure: psychometric detection curves, all five studies + random-effects meta-analytic forest plot (BCAT manuscript, fig_accuracy).',
    render: (d) => (
      <Frame wide kicker="Result 1">
        <H2>People reliably detect changes above threshold</H2>
        <Figure src="/keynote/fig-detection-curve.png" alt="Psychometric detection curves across five studies" missingLabel="Detection curve figure" />
        <Detail density={d}>
          P(correct detection) rises with the size of the breathing-rate change in every study; the
          pooled partial-r meta-analysis confirms the effect holds across online and lab samples.
        </Detail>
      </Frame>
    ),
  },

  // 12 — Result 2: arousal gates on detection
  {
    note: 'Figure: predicted arousal by breathing-rate change, split by detected/missed, across studies + forest plot (BCAT manuscript, fig_arousal). BF01 = 8.7–29.6 supporting the null on misses.',
    render: (d) => (
      <Frame wide kicker="Result 2 — the key result">
        <H2>Arousal gates on detection</H2>
        <Figure src="/keynote/fig-arousal-gating.png" alt="Arousal by breathing-rate change, split by hit vs miss" missingLabel="Arousal gating figure" maxH={d === 'reading' ? '50vh' : '58vh'} />
        <Bullets items={[
          'Hits: arousal scales with magnitude.',
          'Misses: arousal stays flat.',
          'Holds across all five studies — BF01 = 8.7 to 29.6 support the null on misses.',
        ]} />
        <Detail density={d}>
          The body changed by the same amount on hits and misses. Felt arousal tracked the change only
          when the change was consciously detected — evidence for the detection-gating (moderate) position.
        </Detail>
      </Frame>
    ),
  },

  // 13 — Belt clincher
  {
    render: (d) => (
      <Frame kicker="Study 5 — the clincher">
        <H2>The body changed — the mind missed it</H2>
        <MissTrialTrace />
        <Lead>Adherence is read per trial: did the belt’s breathing rate move the cued way? On missed trials it still does — 91.0% of the time, vs 88.9% on hits.</Lead>
        <Detail density={d}>
          Averaged over trials, correct-direction adherence is statistically the same on hits and misses.
          So "nothing changed in the body" cannot explain the missed detections — the paced change happened
          either way. What separates a hit from a miss is only whether it was consciously registered.
        </Detail>
      </Frame>
    ),
  },

  // 14 — MAIA intro
  {
    render: (d) => (
      <Frame kicker="Self-report awareness">
        <H2>What do people know about their own interoception?</H2>
        <Lead>The MAIA — Multidimensional Assessment of Interoceptive Awareness — asks how much people notice, attend to, and trust the signals of their own body.</Lead>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720 }}>
          {['Noticing', 'Attention regulation', 'Emotional awareness', 'Body listening', 'Trusting', 'Not-distracting'].map(s => (
            <span key={s} style={{ fontSize: 14, color: 'var(--pkd)', background: 'var(--pkb)', borderRadius: 999, padding: '6px 14px' }}>{s}</span>
          ))}
        </div>
        <div style={{ maxWidth: 640, borderLeft: '3px solid var(--pk)', padding: '4px 18px', textAlign: 'left' }}>
          <p style={{ fontStyle: 'italic', color: 'var(--tx)', fontSize: 'clamp(15px, 1.9vw, 21px)', margin: 0, lineHeight: 1.45 }}>
            "I notice changes in my breathing, such as whether it slows down or speeds up."
          </p>
          <p style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', margin: '8px 0 0' }}>
            MAIA item 4 — the questionnaire literally asks about the breath.
          </p>
        </div>
        <Detail density={d}>
          Self-report tells us what people believe about their bodily awareness. But does believing you
          notice your breathing mean you actually can? The BCAT lets us check self-report against measured ability.
        </Detail>
      </Frame>
    ),
  },

  // 15 — MAIA: confidence not sensitivity
  {
    note: 'Illustrative scatterplots rendered from the reported correlations (confidence r = .260; sensitivity r = .071). Swap for supplementary figures if preferred.',
    render: (d) => (
      <Frame kicker="Trait awareness (MAIA)">
        <H2>Predicts confidence, not sensitivity</H2>
        <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', justifyContent: 'center' }}>
          <MaiaScatter r={0.260} yLabel="Detection confidence" seed="maia-confidence" />
          <MaiaScatter r={0.071} yLabel="Detection threshold" seed="maia-sensitivity" />
        </div>
        <Detail density={d}>
          People who report more bodily awareness feel more confident about detecting breath changes,
          but are no better at actually detecting them. Self-report indexes metacognition, not acuity —
          illustrative scatter from the reported correlations.
        </Detail>
      </Frame>
    ),
  },

  // 16 — Cortical deactivation
  {
    note: 'Figure: eNeuro (Farb, Zuo & Price 2023) Figure 3 — whole-brain deactivation maps for breath vs visual attention.',
    render: (d) => (
      <Frame wide kicker="Where it happens in the brain">
        <H2>Attending to the breath deactivates cortex</H2>
        <Figure src="/keynote/fig-eneuro-3.png" alt="Whole-brain deactivation maps" missingLabel="eNeuro Fig 3 — whole-brain deactivation maps" />
        <Bullets items={[
          'Prefrontal, somatomotor, and temporoparietal regions all quiet down.',
          "Not what you'd expect if interoception simply lit up a dedicated cortex.",
        ]} />
        <Detail density={d}>
          Relative to attending a visual target, breath attention produces widespread cortical
          deactivation — interoceptive awareness looks like a withdrawal of exteroceptive processing.
        </Detail>
      </Frame>
    ),
  },

  // 17 — ACC sparing by awareness
  {
    note: 'Figure: eNeuro (Farb, Zuo & Price 2023) Figure 4 — MAIA covariate brain map and scatterplot.',
    render: (d) => (
      <Frame wide kicker="Individual differences">
        <H2>Awareness spares the ACC</H2>
        <Figure src="/keynote/fig-eneuro-4a.png" alt="ACC activity by interoceptive awareness (MAIA)" missingLabel="eNeuro Fig 4A — ACC × MAIA" maxH="60vh" />
        <Bullets items={[
          'Higher MAIA scores predict less deactivation in ACC and language regions.',
          'Greater self-reported body awareness → more preserved ACC activity during breath attention.',
        ]} />
      </Frame>
    ),
  },

  // 18 — ACC-DAN connectivity
  {
    note: 'Figure: eNeuro (Farb, Zuo & Price 2023) — dorsal attention network maps (same figure as slide 16, DAN panel).',
    render: (d) => (
      <Frame wide kicker="Connectivity">
        <H2>ACC sparing tracks attention-network coupling</H2>
        <Figure src="/keynote/fig-eneuro-4b.png" alt="Dorsal attention network maps" missingLabel="eNeuro Fig 4B — DAN maps" maxH="60vh" />
        <Bullets items={[
          'ACC sparing predicts greater connectivity with the dorsal attention network (DAN).',
          'Attention-network engagement — not just regional activity — tracks subjective awareness.',
        ]} />
      </Frame>
    ),
  },

  // 19 — Schematic recap (visual only)
  {
    render: () => (
      <Frame kicker="Putting it together">
        <NeuralFlow />
      </Frame>
    ),
  },

  // 20 — Decodable and trainable
  {
    note: 'Figures: EJN (Zuo, Price & Farb 2023) Fig 5 or 9 — classification map; Brain Sci (Price, Sevinc & Farb 2023) Fig 2C or 3B — connectivity increase with MABT training.',
    render: (d) => (
      <Frame wide kicker="Decodable and trainable">
        <div style={{ display: 'flex', gap: 28, flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center', maxWidth: '100%' }}>
          <Figure src="/keynote/fig-ejn-accuracy.png" alt="Classifier accuracy: baseline vs post-intervention" missingLabel="EJN — classification accuracy" maxH="46vh" />
          <Figure src="/keynote/fig-brainsci-training.png" alt="Connectivity increase with training" missingLabel="Brain Sci — training connectivity" maxH="46vh" />
        </div>
        <Bullets items={[
          'A classifier tells interoceptive from exteroceptive attention on brain activity alone — 73–85% accuracy, holding two months later.',
          'MABT training reduces the deactivation and increases ACC–somatomotor and DAN–insula connectivity.',
          'Connectivity changes track increases in self-reported awareness.',
        ]} />
        <Detail density={d}>
          Caveat: these studies test sustained interoceptive attention, not rate-change detection —
          a bridge still to be built to the BCAT results.
        </Detail>
      </Frame>
    ),
  },

  // 21 — Meaning, detection habits
  {
    render: (d) => (
      <Frame kicker="Back to meaning">
        <H2>Detection habits, not just sensitivity</H2>
        <Bullets items={[
          'Panic: catastrophic interpretation of detected signals.',
          'Interoceptive exposure: changes the habit, not the sensitivity.',
          'Savoring: the same logic, in the positive direction.',
        ]} />
        <Lead>The vignette's two clinicians only had two of the three levers.</Lead>
        <Detail density={d}>
          If feeling is gated by detection, then interventions that change what a detected signal means —
          or how often it is detected — are a third, independent route, alongside changing the body and changing appraisal.
        </Detail>
      </Frame>
    ),
  },

  // 22 — Callback to opening votes (image only)
  {
    note: 'Spoken, not on slide: return to the opening votes. Compare the room’s split to the hit/miss arousal pattern just shown.',
    render: () => (
      <Frame>
        <PacerAttentionIllustration />
      </Frame>
    ),
  },

  // 23 — Closer demo (live)
  {
    note: 'Live strap demo. Open in a new tab: pairing → calibration → paced trials → change-detection trials. Return here after.',
    render: () => (
      <Frame kicker="Live · one volunteer">
        <H>From the room to the body</H>
        <Lead>A Polar H10 strap, a browser, and a fitted breathing model — measured live.</Lead>
        <DemoLink href={DEMO_BELT} label="Open the belt demo" sub="opens in a new tab · return here after" />
      </Frame>
    ),
  },

  // 24 — Thank you
  {
    render: () => (
      <Frame>
        <h1 style={K.title}>Thank you</h1>
        <Lead>Questions</Lead>
        <div style={{ height: 12 }} />
        <div style={K.crests}>
          <img src="/RADlab_Logo_light.svg" alt="RADlab" style={{ height: 48 }} />
          <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 48 }} />
        </div>
      </Frame>
    ),
  },
]

const FIGURE_PRELOAD = [
  '/keynote/anxious.png',
  '/keynote/breath.png',
  '/keynote/fig-staircase.png',
  '/keynote/fig-detection-curve.png',
  '/keynote/fig-arousal-gating.png',
  '/keynote/fig-eneuro-3.png',
  '/keynote/fig-eneuro-4a.png',
  '/keynote/fig-eneuro-4b.png',
  '/keynote/fig-ejn-accuracy.png',
  '/keynote/fig-brainsci-training.png',
  '/RADlab_Logo_light.svg',
  '/UofT_Logo.svg',
]

// ── Small slide-local components ────────────────────────────────────────────

function PollCard({ q, opts }) {
  return (
    <div style={K.pollCard}>
      <div style={K.pollQ}>{q}</div>
      <div style={K.pollOpts}>
        {opts.map(o => <span key={o} style={K.pollOpt}>{o}</span>)}
      </div>
    </div>
  )
}

function MethodsTable() {
  const cols = ['Study 1A/1B', 'Study 2', 'Study 3', 'Study 4', 'Study 5']
  const rows = [
    ['N', '181', '166', '103', '131', '206'],
    ['Setting', 'Online', 'Online', 'Lab', 'Online', 'Lab'],
    ['Salience manipulation', '', '', '✓', '✓', '✓'],
    ['Visual control', '', '', '', '✓', '✓'],
    ['Physiological recording', '', '', '', '', '✓'],
    ['Preregistered', '', '', '', '', '✓'],
  ]
  return (
    <table style={K.table}>
      <thead>
        <tr>
          <th style={K.th}></th>
          {cols.map(c => <th key={c} style={K.th}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            {r.map((cell, ci) => (
              <td key={ci} style={ci === 0 ? K.tdLabel : K.td}>
                {cell === '✓' ? <span style={{ color: '#f068a4', fontWeight: 700 }}>✓</span> : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

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

  slideArea: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '44px 40px' },
  frame: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    textAlign: 'center', maxWidth: 1000, width: '100%',
  },
  frameWide: { maxWidth: 'min(1280px, 95vw)' },
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },

  title:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px, 6vw, 66px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.05 },
  subtitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 3.2vw, 34px)', fontWeight: 400, color: 'var(--pkd)', margin: 0, fontStyle: 'italic' },
  author:   { fontSize: 'clamp(17px, 2.2vw, 22px)', color: 'var(--tx)', margin: 0, fontWeight: 500 },
  affil:    { fontSize: 'clamp(14px, 1.7vw, 17px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5 },
  event:    { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx3)', margin: '10px 0 0', letterSpacing: '0.06em' },
  crests:   { display: 'flex', gap: 32, alignItems: 'center', marginBottom: 6 },

  h:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(28px, 4.6vw, 52px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.1 },
  h2:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(24px, 3.6vw, 42px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.12 },
  lead: { fontSize: 'clamp(17px, 2.1vw, 25px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, maxWidth: 780 },
  ul:   { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 },
  li:   { fontSize: 'clamp(16px, 2vw, 23px)', color: 'var(--tx)', lineHeight: 1.45, position: 'relative', paddingLeft: 24, textAlign: 'left' },
  detail: { fontSize: 'clamp(14px, 1.6vw, 17px)', color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 720, margin: 0, borderTop: '1px solid var(--bd)', paddingTop: 14 },

  figImg: { maxWidth: '100%', width: 'auto', objectFit: 'contain', borderRadius: 8, background: '#fff' },
  lightbox: { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(252,240,245,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '2vh 2vw' },
  lightboxImg: { maxWidth: '96vw', maxHeight: '94vh', objectFit: 'contain', borderRadius: 8, background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  lightboxHint: { position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)' },
  figPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '48px 40px', border: '1.5px dashed rgba(180,100,140,0.4)', borderRadius: 12, background: 'rgba(255,255,255,0.5)', color: 'var(--tx3)', minWidth: 420 },
  figPlaceIcon: { fontSize: 34, color: 'var(--pkb)' },
  figPlaceText: { fontSize: 15, color: 'var(--tx2)', fontWeight: 500 },
  figPlacePath: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)' },

  demoBtn: { display: 'inline-block', background: 'var(--pk)', color: '#fff', textDecoration: 'none', borderRadius: 14, padding: '16px 44px', fontSize: 'clamp(16px, 2vw, 21px)', fontWeight: 500 },
  demoSub: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },

  pollGrid: { display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' },
  pollCard: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, padding: '18px 20px', minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 },
  pollQ: { fontSize: 17, fontWeight: 600, color: 'var(--tx)' },
  pollOpts: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  pollOpt: { fontSize: 14, color: 'var(--pkd)', background: 'var(--pkb)', borderRadius: 8, padding: '5px 12px' },

  table: { borderCollapse: 'collapse', fontSize: 'clamp(12px, 1.5vw, 17px)', background: '#fff', borderRadius: 10, overflow: 'hidden' },
  th: { fontFamily: '"Space Mono",monospace', fontSize: '0.82em', fontWeight: 700, color: 'var(--pkd)', padding: '10px 14px', borderBottom: '2px solid var(--pkb)', textAlign: 'center' },
  td: { padding: '9px 14px', textAlign: 'center', color: 'var(--tx)', borderBottom: '1px solid var(--bd)' },
  tdLabel: { padding: '9px 16px', textAlign: 'left', color: 'var(--tx2)', borderBottom: '1px solid var(--bd)', fontWeight: 500, whiteSpace: 'nowrap' },

  bottom: { position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, cursor: 'default' },
  navArrow: { border: 'none', background: 'none', color: 'var(--tx3)', fontSize: 30, lineHeight: 1, cursor: 'pointer', padding: '0 6px' },
  counter: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
  clickHint: { position: 'absolute', bottom: 44, left: 0, right: 0, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', opacity: 0.7, pointerEvents: 'none' },

  noteOverlay: { position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 90vw)', background: 'rgba(28,28,30,0.94)', color: '#fff', borderRadius: 12, padding: '14px 20px', cursor: 'default', zIndex: 6 },
  noteLabel: { fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ff9ec9' },
  noteBody: { fontSize: 14, lineHeight: 1.5, marginTop: 6 },
}

// Bullet markers (pink dot) — injected once.
if (typeof document !== 'undefined' && !document.getElementById('keynote-bullets')) {
  const s = document.createElement('style')
  s.id = 'keynote-bullets'
  s.textContent = `[data-keynote] li::before{content:'';position:absolute;left:4px;top:.6em;width:7px;height:7px;border-radius:50%;background:#f068a4}`
  document.head.appendChild(s)
}
