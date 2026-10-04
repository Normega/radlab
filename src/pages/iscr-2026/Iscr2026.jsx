// ISCR 2026 — "What You Miss Won't Move You", a Zoom flash talk (6 min + 2 min
// Q&A) on the BCAT paper (Farb, Logie-Hagen & Amir Pour). The audience does two
// BCAT trials in the first minute (TwoTrials) and answers in the Zoom chat;
// later slides call back to those answers.
// Same shell as /keynote and /adobe-aug-2026: click / → / Space advance,
// ← back, Minimal / Reading density. Because the deck is screen-shared, notes
// and the clock live in a separate PRESENTER WINDOW (P): current note, target
// time, elapsed clock, next slide. Keys pressed in that window drive the deck.
// N (in-page notes) and T (in-page clock) still exist but are seen by the audience.
// Run of show, fallbacks and Q&A prep: I:\My Drive\Talks\2026 ISCR 2026\ISCR2026_RunOfShow.md
import { useState, useEffect, useCallback, useRef } from 'react'
import TwoTrials, { PaceTraces } from './TwoTrials'

export default function Iscr2026() {
  const [i, setI] = useState(0)
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('iscrDensity') || 'minimal' } catch { return 'minimal' }
  })
  const [showNotes, setShowNotes] = useState(false)
  const [showClock, setShowClock] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [presOpen, setPresOpen] = useState(false)
  const presRef = useRef(null)

  const total = SLIDES.length
  const go = useCallback((d) => setI(v => Math.min(total - 1, Math.max(0, v + d))), [total])
  const setDens = useCallback((d) => {
    setDensity(d)
    try { localStorage.setItem('iscrDensity', d) } catch { /* ignore */ }
  }, [])

  // Talk clock: starts the first time we leave the title slide.
  const step = useCallback((d) => {
    setStartedAt(t => t ?? Date.now())
    go(d)
  }, [go])
  useEffect(() => {
    if (startedAt === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const elapsed = startedAt === null ? 0 : Math.max(0, now - startedAt)

  useEffect(() => {
    const im = new Image(); im.src = '/iscr-2026/fig-gating-s5.png'
  }, [])

  // Presenter window: a same-origin popup we write into directly. Its keys are
  // re-dispatched on this window, so the deck (and the breathing exercise) can
  // be driven from it without moving focus back to the shared window.
  const openPresenter = useCallback(() => {
    let w = presRef.current
    if (!w || w.closed) {
      w = window.open('', 'iscr-presenter', 'width=620,height=560')
      if (!w) return
      w.document.title = 'Presenter · ISCR 2026'
      const st = w.document.createElement('style')
      st.textContent = PRESENTER_CSS
      w.document.head.appendChild(st)
      w.addEventListener('keydown', e => {
        if ([' ', 'ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp'].includes(e.key)) e.preventDefault()
        if (e.key === 'p' || e.key === 'P') return
        window.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }))
      })
      w.addEventListener('beforeunload', () => { presRef.current = null; setPresOpen(false) })
      presRef.current = w
    }
    w.focus()
    setPresOpen(true)
  }, [])

  useEffect(() => {
    function onKey(e) {
      const forward = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown'
      // The exercise owns the forward keys until its reveal.
      if (forward && document.body.dataset.exerciseActive) return
      if (forward)                                             { e.preventDefault(); step(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp')    { e.preventDefault(); go(-1) }
      else if (e.key === 'n' || e.key === 'N')                 { setShowNotes(s => !s) }
      else if (e.key === 't' || e.key === 'T')                 { setShowClock(s => !s) }
      else if (e.key === 'p' || e.key === 'P')                 { openPresenter() }
      else if (e.key === 'Home')                               { setI(0) }
      else if (e.key === 'End')                                { setI(total - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, step, total, openPresenter])

  // Repaint the presenter window whenever the slide or the clock moves.
  useEffect(() => {
    const w = presRef.current
    if (!presOpen || !w) return
    if (w.closed) return
    const cur = SLIDES[i], nxt = SLIDES[i + 1]
    const late = startedAt !== null && elapsed > cur.by * 1000 + 15000
    w.document.body.innerHTML = `
      <div class="top">
        <span class="n">${i + 1} / ${SLIDES.length}</span>
        <span class="clock${late ? ' late' : ''}">${fmt(elapsed)}</span>
        <span class="aim">finish by ${fmt(cur.by * 1000)}</span>
      </div>
      <div class="note">${esc(cur.note || '')}</div>
      <div class="next">${nxt ? `Next · ${esc(nxt.label)}` : 'Last slide'}</div>
      <div class="keys">→ / Space next · ← back · R resets the breathing demo · this window is not shared</div>`
  }, [presOpen, i, elapsed, startedAt])

  const slide = SLIDES[i]

  return (
    <div style={K.stage} data-iscr onClick={() => { if (!slide.exercise) step(1) }}>
      <div style={K.controls} onClick={e => e.stopPropagation()}>
        <div style={K.toggle}>
          {['minimal', 'reading'].map(d => (
            <button key={d} onClick={() => setDens(d)} style={{ ...K.toggleBtn, ...(density === d ? K.toggleOn : {}) }}>
              {d === 'minimal' ? 'Minimal' : 'Reading'}
            </button>
          ))}
        </div>
        <button onClick={openPresenter} style={{ ...K.notesBtn, ...(presOpen ? K.toggleOn : {}) }} title="Presenter window with notes and clock (P)">
          Presenter
        </button>
      </div>

      <div style={K.slideArea}>{slide.render(density)}</div>

      <div style={K.bottom} onClick={e => e.stopPropagation()}>
        <button onClick={() => go(-1)} style={{ ...K.navArrow, visibility: i === 0 ? 'hidden' : 'visible' }} aria-label="Previous">‹</button>
        <span style={K.counter}>{i + 1} / {total}</span>
        <button onClick={() => step(1)} style={{ ...K.navArrow, visibility: i === total - 1 ? 'hidden' : 'visible' }} aria-label="Next">›</button>
        {showClock && startedAt !== null && (
          <span style={{ ...K.counter, marginLeft: 8, color: elapsed > slide.by * 1000 + 15000 ? '#d0443e' : 'var(--tx3)' }}>
            {fmt(elapsed)} · aim {fmt(slide.by * 1000)}
          </span>
        )}
      </div>

      {showNotes && slide.note && (
        <div style={K.noteOverlay} onClick={e => e.stopPropagation()}>
          <span style={K.noteLabel}>Speaker note · finish by {fmt(slide.by * 1000)}</span>
          <div style={K.noteBody}>{slide.note}</div>
        </div>
      )}
    </div>
  )
}

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const PRESENTER_CSS = `
  body { margin: 0; padding: 22px 26px; background: #1c1c1e; color: #f2f2f4; font-family: system-ui, "Segoe UI", sans-serif; }
  .top { display: flex; align-items: baseline; gap: 18px; font-family: Consolas, monospace; }
  .n { color: #9a9b9f; font-size: 15px; }
  .clock { font-size: 44px; font-weight: 700; color: #f2f2f4; }
  .clock.late { color: #ff6b6b; }
  .aim { color: #ff9ec9; font-size: 16px; }
  .note { margin-top: 18px; font-size: 21px; line-height: 1.5; }
  .next { margin-top: 22px; color: #9a9b9f; font-size: 15px; border-top: 1px solid #3a3a3e; padding-top: 12px; }
  .keys { margin-top: 10px; color: #6b6c70; font-size: 12px; font-family: Consolas, monospace; }
`

function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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
function Cite({ children }) {
  return <p style={K.cite}>{children}</p>
}

// Colours match the paper's figure: detected = gold, missed = blue.
const GOLD = '#D99A00'
const BLUE = '#0072B2'

// Three positions, drawn as predictions for the missed-change line.
function Predictions() {
  const cards = [
    { k: 'A', name: 'Constructivist', who: 'Zillmann · interoceptive inference', miss: 'scaled',  line: 'Missed changes still move you, in proportion' },
    { k: 'B', name: 'Moderate',       who: 'Schachter & Singer · Barrett',      miss: 'raised',  line: 'Missed changes lift arousal, but not by how much' },
    { k: 'C', name: 'Constitutive',   who: 'James · Lange',                     miss: 'flat',    line: 'Missed changes do nothing: noticing is the feeling' },
  ]
  return (
    <div style={K.preds}>
      {cards.map(c => (
        <div key={c.k} style={K.pred}>
          <div style={K.predHead}><span style={K.predK}>{c.k}</span>{c.name}</div>
          <MiniPlot miss={c.miss} />
          <div style={K.predLine}>{c.line}</div>
          <div style={K.predWho}>{c.who}</div>
        </div>
      ))}
    </div>
  )
}

function MiniPlot({ miss }) {
  const W = 220, H = 128, x0 = 26, x1 = W - 10, yBase = 98, yTop = 20
  const hit = `M${x0},${yBase} L${x1},${yTop}`
  const missPath = miss === 'scaled' ? `M${x0},${yBase} L${x1},${yTop + 22}`
    : miss === 'raised' ? `M${x0},${yBase - 15} L${x1},${yBase - 15}`
    : `M${x0},${yBase} L${x1},${yBase}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
      <line x1={x0} y1={yBase} x2={x1} y2={yBase} stroke="#d5d6d9" strokeDasharray="3 4" />
      <line x1={x0} y1={10} x2={x0} y2={yBase + 6} stroke="#c9cacd" />
      <path d={hit} stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
      <path d={missPath} stroke={BLUE} strokeWidth="4" strokeLinecap="round" />
      <text x={x0 - 8} y={56} fontSize="11" fill="#8a8b8f" textAnchor="middle" transform={`rotate(-90 ${x0 - 8} 56)`} fontFamily="'DM Sans',sans-serif">felt arousal</text>
      <text x={(x0 + x1) / 2} y={H - 6} fontSize="11" fill="#8a8b8f" textAnchor="middle" fontFamily="'DM Sans',sans-serif">size of breathing change →</text>
    </svg>
  )
}

function Legend() {
  const item = (c, t) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 22, height: 4, borderRadius: 2, background: c, display: 'inline-block' }} />{t}
    </span>
  )
  return <div style={K.legend}>{item(GOLD, 'noticed the change')}{item(BLUE, 'missed the change')}</div>
}

function Stat({ big, label, sub, color = 'var(--tx)' }) {
  return (
    <div style={K.stat}>
      <div style={{ ...K.statBig, color }}>{big}</div>
      <div style={K.statLabel}>{label}</div>
      {sub && <div style={K.statSub}>{sub}</div>}
    </div>
  )
}

// ── Slides ──────────────────────────────────────────────────────────────────
// `by` = cumulative target time (seconds) at which this slide should be done.

const SLIDES = [
  // 1 — Title (up while you are introduced)
  {
    label: 'Title',
    by: 0,
    note: 'Shared before the chair introduces you (Zoom: share this browser window, F11 for full screen). Say nothing about the title. First words, as you click: “Before I tell you anything, I’d like you to do something with me.”',
    render: () => (
      <Frame>
        <div style={K.crests}>
          <img src="/RADlab_Logo.svg" alt="RADlab" style={{ height: 56 }} />
          <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 56 }} />
        </div>
        <h1 style={K.title}>What You Miss Won’t Move You</h1>
        <p style={K.subtitle}>Awareness as the bridge between body and feeling</p>
        <div style={{ height: 14 }} />
        <p style={K.author}>Norman Farb · Kyle Logie-Hagen · Rose Amir Pour</p>
        <p style={K.affil}>University of Toronto Mississauga</p>
        <p style={K.event}>ISCR 2026</p>
      </Frame>
    ),
  },

  // 2 — The room does two BCAT trials
  {
    label: 'Breathing demo',
    by: 65,
    exercise: true,
    note: 'Nothing to explain first. ① Begin. ~14 s: say nothing while it runs. ② “In the chat: F if it got faster, S if slower, = if it stayed the same.” Give it five seconds, then read the split out loud (“mostly equals signs, a few Fs”). Don’t reveal. ③ “Once more.” ~14 s. ④ “And this time? Same codes.” ⑤ “Last one, the one I care about: which trial stirred you up more? Type 1 or 2, or 0 for no difference.” ⑥ Reveal: “Your breathing did the same thing twice. What differed was whether you noticed.” If many caught trial 1: “This audience is unusually good at this. You meditate. In the lab, gradual changes this size are mostly missed.” R resets if you start early.',
    render: () => (
      <Frame wide>
        <TwoTrials />
      </Frame>
    ),
  },

  // 3 — The question
  {
    label: 'Three positions',
    by: 100,
    note: '“That’s an old question in emotion science: does a bodily change have to be noticed to be felt?” One clause per card. A: a missed change still moves you, in proportion. B: it lifts arousal but carries no size. C, James and Lange: noticing is the feeling. “It was never settled, because bigger changes are both easier to notice and more arousing.”',
    render: (d) => (
      <Frame wide kicker="Does a bodily change have to be noticed to be felt?">
        <Predictions />
        <Legend />
        <Detail density={d}>
          Until now these could not be told apart, because larger physiological changes are both more
          noticeable and more arousing. Detection and magnitude were confounded in every paradigm.
        </Detail>
      </Frame>
    ),
  },

  // 4 — The BCAT: what you just did
  {
    label: 'What you just did (BCAT)',
    by: 140,
    note: '“You’ve just done our task, the Breath Change Awareness Task.” Point to the two traces: same final pace, different onset. “Gradual onset hides a change; abrupt onset reveals it. A staircase finds each person’s threshold, so we get noticed and missed trials at the same size of change, in the same person.” Five studies, 787 people; the last preregistered, with a respiration belt.',
    render: (d) => (
      <Frame wide kicker="What you just did · the Breath Change Awareness Task">
        <H2>Same change, noticed or missed</H2>
        <PaceTraces width={640} />
        <Bullets items={[
          'Abrupt or gradual onset moves detection without moving the size of the change.',
          'An adaptive staircase sets the change at each person’s own threshold.',
          'Five studies, N = 787. Study 5 preregistered, with a respiration belt (N = 206).',
        ]} />
        <Detail density={d}>
          After every trial: faster / slower / same, confidence, and felt arousal. Analyses compare the
          change–arousal slope on detected versus missed trials at matched magnitudes (99–100% overlap).
        </Detail>
      </Frame>
    ),
  },

  // 5 — The result
  {
    label: 'Result',
    by: 210,
    note: '“Left is faster breathing. Gold, when people noticed: the bigger the change, the more aroused they felt. Blue, the same changes missed: flat.” Right panel: “That difference appears in all five studies.” Then: “Missed changes produced no more arousal than no change at all. Bayes factors favour the null, 9 to 30 to 1. And the belt shows their breathing really did change on the missed trials.” Callback: “The answer is C. And look back at the chat: most of you typed 2.”',
    render: (d) => (
      <Frame wide kicker="Result">
        <H2>Noticed changes move us. Missed ones don’t.</H2>
        <img src="/iscr-2026/fig-gating-s5.png" alt="Study 5: felt arousal by breathing-rate change for detected and missed trials, with a forest plot of the Change × Detection interaction across five studies" style={K.fig} />
        <p style={K.figCap}>Left: Study 5, felt arousal (z) by breathing-rate change, ← faster · slower →. Right: Change × Detection, all five studies.</p>
        <div style={K.stats}>
          <Stat big="5 / 5" label="studies replicate the gating" sub="pooled r = −.11 [−.15, −.06]" />
          <Stat big="9–30 : 1" label="evidence that a missed change = no change" sub="BF₀₁, four studies with a no-change baseline" color={BLUE} />
        </div>
        <Detail density={d}>
          On detected trials arousal scaled with change magnitude; on missed trials it did not, and missed-change
          trials did not differ from no-change trials (BF₀₁ = 8.7, 20.7, 9.6, 29.6). Study 5 belt recordings: breathing
          moved in the cued direction on 88.9% of missed and 91.0% of detected trials. This is the constitutive prediction.
        </Detail>
      </Frame>
    ),
  },

  // 6 — MAIA: confidence, not sensitivity
  {
    label: 'MAIA',
    by: 270,
    note: 'To this audience specifically: “Many of you would say you notice subtle changes in your breathing.” Beat. “That’s close to an item on the MAIA, the questionnaire our field uses most for body awareness. Across all five studies, MAIA predicted how confident people were in their judgements, but not how small a change they could detect.” Land it kindly: “It measures a habit of attending to and trusting the body, not better sensors. And on our account, that habit is exactly what decides which changes get noticed.”',
    render: (d) => (
      <Frame kicker="Self-reported body awareness (MAIA)">
        <H2>“I notice changes in my breathing”</H2>
        <div style={K.stats}>
          <Stat big="r = .26" label="MAIA → confidence in your judgement" sub="5 of 5 studies · [.20, .32]" color="var(--pkd)" />
          <Stat big="r = .07" label="MAIA → smallest change you can detect" sub="0 of 4 studies · BF₀₁ 2.5–5.5" color="#8a8b8f" />
        </div>
        <Lead>Body-awareness questionnaires capture a disposition to attend and trust, not finer sensing.</Lead>
        <Detail density={d}>
          Pooled random-effects estimates. MAIA was also unrelated to heartbeat-counting accuracy in Study 5
          (r = −.08), and the confidence link survived controlling for self-esteem and trait self-doubt.
        </Detail>
      </Frame>
    ),
  },

  // 7 — Why it matters for contemplative science
  {
    label: 'Detection habits',
    by: 335,
    note: '“If feeling waits on noticing, then emotional life partly reflects detection habits: which signals we notice, and how much we trust them.” One line each: panic (signals noticed and caught up in catastrophe; exposure works because noticed signals can update belief) and savouring (bringing mild pleasant states across the threshold). Then: “Contemplative practice may work less by changing the body than by changing what crosses the threshold. That’s testable, and the BCAT gives us the instrument.”',
    render: (d) => (
      <Frame kicker="For contemplative science">
        <H2>Emotion follows detection habits</H2>
        <Bullets items={[
          'Panic and health anxiety: mild signals noticed and read as threat. Exposure works on what is noticed.',
          'Savouring: mild pleasant states only count once they cross the threshold.',
          'Practice may change what crosses the threshold, not the body itself. That is testable.',
        ]} />
        <Detail density={d}>
          Limits: arousal was self-reported, samples were mostly undergraduates, and individual thresholds were only
          moderately reliable (ICC .24–.59 with 10-trial staircases). Next: autonomic measures on hit vs miss trials,
          and practitioners vs novices.
        </Detail>
      </Frame>
    ),
  },

  // 8 — Close
  {
    label: 'Close',
    by: 360,
    note: 'Slow down. “In your first trial your body changed and your feelings didn’t follow, because you didn’t notice. What you miss won’t move you, and what you practise noticing will.” Thank co-authors Kyle Logie-Hagen and Rose Amir Pour, and NSERC. “Happy to take questions.” Stop.',
    render: () => (
      <Frame>
        <h1 style={K.title}>What you miss won’t move you.</h1>
        <p style={K.subtitle}>What you practise noticing will.</p>
        <div style={{ height: 10 }} />
        <p style={K.author}>Kyle Logie-Hagen · Rose Amir Pour</p>
        <Cite>Materials, data and analysis code on OSF · NSERC Discovery RGPIN-2015-05901</Cite>
        <div style={K.crests}>
          <img src="/RADlab_Logo.svg" alt="RADlab" style={{ height: 44 }} />
          <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 44 }} />
        </div>
      </Frame>
    ),
  },
]

// ── Styles ──────────────────────────────────────────────────────────────────

const K = {
  stage: { position: 'fixed', inset: 0, background: 'var(--bg, #FCF0F5)', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)', cursor: 'pointer', overflow: 'hidden' },
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
  cite:     { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', margin: 0, letterSpacing: '0.03em' },

  h2:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(24px, 3.6vw, 40px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.12 },
  lead: { fontSize: 'clamp(16px, 2vw, 23px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, maxWidth: 820 },
  ul:   { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 860 },
  li:   { fontSize: 'clamp(15px, 1.9vw, 21px)', color: 'var(--tx)', lineHeight: 1.45, position: 'relative', paddingLeft: 24, textAlign: 'left' },
  detail: { fontSize: 'clamp(13px, 1.5vw, 16px)', color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 760, margin: 0, borderTop: '1px solid var(--bd)', paddingTop: 14 },

  preds: { display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  pred: { flex: '1 1 260px', maxWidth: 340, background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  predHead: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.4vw, 28px)', color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 10 },
  predK: { fontFamily: '"Space Mono",monospace', fontSize: 15, fontWeight: 700, color: '#fff', background: 'var(--pk)', borderRadius: 999, width: 28, height: 28, display: 'inline-grid', placeItems: 'center' },
  predLine: { fontSize: 'clamp(14px, 1.7vw, 18px)', color: 'var(--tx)', lineHeight: 1.35 },
  predWho: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)' },
  legend: { display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center', fontSize: 'clamp(13px, 1.6vw, 17px)', color: 'var(--tx2)' },

  fig: { maxWidth: '100%', maxHeight: '46vh', objectFit: 'contain', borderRadius: 8, background: '#fff' },
  figCap: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', margin: '-8px 0 0' },
  stats: { display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  stat: { flex: '1 1 280px', maxWidth: 420, background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 6 },
  statBig: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: 1 },
  statLabel: { fontSize: 'clamp(14px, 1.8vw, 19px)', color: 'var(--tx)', lineHeight: 1.35 },
  statSub: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },

  bottom: { position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, cursor: 'default' },
  navArrow: { border: 'none', background: 'none', color: 'var(--tx3)', fontSize: 30, lineHeight: 1, cursor: 'pointer', padding: '0 6px' },
  counter: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
  clickHint: { position: 'absolute', bottom: 44, left: 0, right: 0, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', opacity: 0.7, pointerEvents: 'none' },

  noteOverlay: { position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 90vw)', background: 'rgba(28,28,30,0.94)', color: '#fff', borderRadius: 12, padding: '14px 20px', cursor: 'default', zIndex: 6 },
  noteLabel: { fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ff9ec9' },
  noteBody: { fontSize: 14, lineHeight: 1.5, marginTop: 6 },
}

// Bullet markers (pink dot) — injected once.
if (typeof document !== 'undefined' && !document.getElementById('iscr-bullets')) {
  const s = document.createElement('style')
  s.id = 'iscr-bullets'
  s.textContent = `[data-iscr] li::before{content:'';position:absolute;left:4px;top:.62em;width:7px;height:7px;border-radius:50%;background:#f068a4}`
  document.head.appendChild(s)
}
