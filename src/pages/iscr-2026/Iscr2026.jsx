// ISCR 2026 — "What You Miss Won't Move You", a Zoom flash talk (6 min + 2 min
// Q&A) on the BCAT paper (Farb, Logie-Hagen & Amir Pour). The audience does two
// BCAT trials in the first minute (TwoTrials) and answers in the Zoom chat;
// later slides call back to those answers.
// Same shell as /keynote and /adobe-aug-2026: click / → / Space advance,
// ← back, Minimal / Reading density. Because the deck is screen-shared, notes
// and the clock live in a separate PRESENTER WINDOW (P): current note, target
// time, elapsed clock, next slide. Keys pressed in that window drive the deck.
// N (in-page notes) and T (in-page clock) still exist but are seen by the audience.
// Bonus slides for Q&A sit outside the main sequence: B opens their index, 1–8 jump
// straight to one, ← → step through them, Esc returns to the slide you left.
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
  // null = main deck; 0 = bonus index; 1..BONUS.length = that bonus slide.
  const [bonus, setBonus] = useState(null)
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
    for (const src of ['/iscr-2026/fig-gating-s5.png', ...BONUS_FIGS]) { const im = new Image(); im.src = src }
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
      const back = e.key === 'ArrowLeft' || e.key === 'PageUp'
      if (e.key === 'b' || e.key === 'B') { setBonus(b => (b === null ? 0 : null)); return }
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= BONUS.length) { setBonus(Number(e.key)); return }
      if (e.key === 'Escape') { setBonus(null); return }
      if (bonus !== null) {
        if (forward)   { e.preventDefault(); setBonus(b => Math.min(BONUS.length, b + 1)) }
        else if (back) { e.preventDefault(); setBonus(b => Math.max(0, b - 1)) }
        return
      }
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
  }, [go, step, total, openPresenter, bonus])

  // Repaint the presenter window whenever the slide or the clock moves.
  useEffect(() => {
    const w = presRef.current
    if (!presOpen || !w) return
    if (w.closed) return
    const bonusList = `<div class="bonus">${BONUS.map((b, k) =>
      `<span${bonus === k + 1 ? ' class="on"' : ''}><b>${k + 1}</b> ${esc(b.q)}</span>`).join('')}</div>`
    if (bonus !== null) {
      const cur = bonus === 0 ? BONUS_INDEX : BONUS[bonus - 1]
      w.document.body.innerHTML = `
        <div class="top">
          <span class="n">${bonus === 0 ? 'Bonus index' : `Bonus ${bonus} / ${BONUS.length}`}</span>
          <span class="clock">${fmt(elapsed)}</span>
          <span class="aim">Esc returns to slide ${i + 1}</span>
        </div>
        <div class="note">${esc(cur.note || '')}</div>
        ${bonusList}`
      return
    }
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
      <div class="keys">→ / Space next · ← back · R resets the breathing demo · B bonus index, 1–${BONUS.length} a bonus slide · this window is not shared</div>
      ${bonusList}`
  }, [presOpen, i, elapsed, startedAt, bonus])

  const slide = SLIDES[i]
  const shown = bonus === null ? slide : bonus === 0 ? BONUS_INDEX : BONUS[bonus - 1]

  return (
    <div style={K.stage} data-iscr onClick={() => { if (bonus === null && !slide.exercise) step(1) }}>
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

      <div style={K.slideArea}>{shown.render(density)}</div>

      <div style={K.bottom} onClick={e => e.stopPropagation()}>
        {bonus === null ? (<>
          <button onClick={() => go(-1)} style={{ ...K.navArrow, visibility: i === 0 ? 'hidden' : 'visible' }} aria-label="Previous">‹</button>
          <span style={K.counter}>{i + 1} / {total}</span>
          <button onClick={() => step(1)} style={{ ...K.navArrow, visibility: i === total - 1 ? 'hidden' : 'visible' }} aria-label="Next">›</button>
        </>) : (
          <span style={K.counter}>{bonus === 0 ? 'Bonus' : `Bonus ${bonus} / ${BONUS.length}`}</span>
        )}
        {showClock && startedAt !== null && (
          <span style={{ ...K.counter, marginLeft: 8, color: elapsed > slide.by * 1000 + 15000 ? '#d0443e' : 'var(--tx3)' }}>
            {fmt(elapsed)} · aim {fmt(slide.by * 1000)}
          </span>
        )}
      </div>

      {showNotes && shown.note && (
        <div style={K.noteOverlay} onClick={e => e.stopPropagation()}>
          <span style={K.noteLabel}>{bonus === null ? `Speaker note · finish by ${fmt(slide.by * 1000)}` : 'Bonus · speaker note'}</span>
          <div style={K.noteBody}>{shown.note}</div>
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
  .bonus { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 13px; color: #9a9b9f; }
  .bonus b { color: #ff9ec9; margin-right: 6px; font-family: Consolas, monospace; }
  .bonus .on { color: #f2f2f4; }
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
    { k: 'A', name: 'Constructivist', who: 'Zillmann · interoceptive inference', miss: 'parallel',  line: 'Missed changes move you just as much; noticing adds a lift' },
    { k: 'B', name: 'Moderate',       who: 'Schachter & Singer · Barrett',      miss: 'amplified', line: 'Missed changes still move you; noticing amplifies it' },
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
  const lift = 20
  const hit = miss === 'parallel' ? `M${x0},${yBase - lift} L${x1},${yTop}` : `M${x0},${yBase} L${x1},${yTop}`
  const missPath = miss === 'parallel' ? `M${x0},${yBase} L${x1},${yTop + lift}`
    : miss === 'amplified' ? `M${x0},${yBase} L${x1},${yTop + 42}`
    : `M${x0},${yBase} L${x1},${yBase}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
      <line x1={x0} y1={yBase} x2={x1} y2={yBase} stroke="#d5d6d9" strokeDasharray="3 4" />
      <line x1={x0} y1={10} x2={x0} y2={yBase + 6} stroke="#c9cacd" />
      <path d={hit} stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
      <path d={missPath} stroke={BLUE} strokeWidth="4" strokeLinecap="round" />
      <text x={x0 - 8} y={56} fontSize="12" fill="#8a8b8f" textAnchor="middle" transform={`rotate(-90 ${x0 - 8} 56)`} fontFamily="'DM Sans',sans-serif">felt arousal</text>
      <text x={(x0 + x1) / 2} y={H - 6} fontSize="12" fill="#8a8b8f" textAnchor="middle" fontFamily="'DM Sans',sans-serif">size of breathing change →</text>
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
    note: 'Shared before the chair introduces you (Zoom: share this browser window, F11 for full screen). Say nothing about the title. Click straight to the situated-context slide.',
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

  // 2 — Situated context (ISCR's invitation to every presenter)
  {
    label: 'Where I’m speaking from',
    by: 20,
    note: 'About 15 seconds, even pace, no pause for effect. Read the three lines as written. Then, as you click: “Now, before I tell you anything else, I’d like you to do something with me.”',
    render: () => (
      <Frame kicker="Situated context">
        <H2>Where I’m speaking from</H2>
        <Bullets items={[
          'I live in Toronto and work in Toronto and Mississauga, on the traditional land of the Huron-Wendat, the Seneca, and the Mississaugas of the Credit.',
          'I grew up in Toronto. My grandparents came from Poland and Russia, survivors of the Holocaust and of the pogroms.',
          'Trained in psychology and neuroscience, I build tools that train breath and body awareness, informed by contemplative practice.',
        ]} />
      </Frame>
    ),
  },

  // 3 — The room does two BCAT trials
  {
    label: 'Breathing demo',
    by: 85,
    exercise: true,
    note: 'Nothing to explain first. ① Begin. ~14 s: say nothing while it runs. ② “In the chat: F if it got faster, S if slower, = if it stayed the same.” Give it five seconds, then read the split out loud (“mostly equals signs, a few Fs”). Don’t reveal. ③ “Once more.” ~14 s. ④ “And this time? Same codes.” ⑤ “Last one, the one I care about: which trial stirred you up more? Type 1 or 2, or 0 for no difference.” ⑥ Reveal: “Your breathing did the same thing twice. What differed was whether you noticed.” If many caught trial 1: “This audience is unusually good at this. You meditate. In the lab, gradual changes this size are mostly missed.” R resets if you start early.',
    render: () => (
      <Frame wide>
        <TwoTrials />
      </Frame>
    ),
  },

  // 4 — The question
  {
    label: 'Three positions',
    by: 120,
    note: '“That’s an old question in emotion science: does a bodily change have to be noticed to be felt?” One clause per card. A: missed changes move you just as much, noticing only adds a lift (parallel lines). B: missed changes still move you, noticing amplifies it (steeper gold). C, James and Lange: noticing is the feeling (flat blue). “It was never settled, because bigger changes are both easier to notice and more arousing.”',
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

  // 5 — The BCAT: what you just did
  {
    label: 'What you just did (BCAT)',
    by: 160,
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

  // 6 — The result
  {
    label: 'Result',
    by: 230,
    note: '“Left is faster breathing. Gold, when people noticed: the bigger the change, the more aroused they felt. Blue, the same changes missed: flat.” Right panel: “That difference appears in all five studies.” Then: “Missed changes produced no more arousal than no change at all. Bayes factors favour the null, 9 to 30 to 1. And the belt shows their breathing really did change on the missed trials.” Callback: “The answer is C. The interaction rules out A, and the flat blue line rules out B.” Then match the chat: if most typed 2, “and most of you typed 2: the trial you noticed is the one that moved you.” If it was mixed or mostly 0, “and if neither trial stirred you, that fits too: a change this small mostly moves people when they catch it.”',
    render: (d) => (
      <Frame wide kicker="Result">
        <H2>Noticed changes move us. Missed ones don’t.</H2>
        <img src="/iscr-2026/fig-gating-s5.png" alt="Study 5: felt arousal by breathing-rate change for detected and missed trials, with a forest plot of the Change × Detection interaction across five studies" style={K.fig} />
        <p style={K.figCap}>Left: Study 5, felt arousal by breathing change · Right: all five studies</p>
        <div style={K.stats}>
          <Stat big="5 / 5" label="studies replicate the gating" sub="pooled r = −.11 [−.15, −.06]" />
          <Stat big="9–30 : 1" label="evidence that a missed change = no change" sub="BF₀₁, 4 studies with a no-change baseline" color={BLUE} />
        </div>
        <Detail density={d}>
          On detected trials arousal scaled with change magnitude; on missed trials it did not, and missed-change
          trials did not differ from no-change trials (BF₀₁ = 8.7, 20.7, 9.6, 29.6). Study 5 belt recordings: breathing
          moved in the cued direction on 88.9% of missed and 91.0% of detected trials. This is the constitutive prediction.
        </Detail>
      </Frame>
    ),
  },

  // 7 — MAIA: confidence, not sensitivity
  {
    label: 'MAIA',
    by: 290,
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

  // 8 — Why it matters for contemplative science
  {
    label: 'Detection habits',
    by: 340,
    note: '“If feeling waits on noticing, then emotional life partly reflects detection habits: which signals we notice, and how much we trust them.” One line on panic (signals noticed and caught up in catastrophe; exposure works because noticed signals can update belief). Leave savouring on the slide unspoken: this slide is 15 s shorter to make room for the situated-context slide. Then: “Contemplative practice may work less by changing the body than by changing what crosses the threshold. That’s testable, and the BCAT gives us the instrument.”',
    render: (d) => (
      <Frame kicker="For contemplative science">
        <H2>Emotion follows detection habits</H2>
        <Bullets items={[
          'Panic and health anxiety: mild signals noticed and read as threat. Exposure helps because noticed signals can update beliefs.',
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

  // 9 — Close
  {
    label: 'Close',
    by: 360,
    note: 'Slow down. “In your first trial your body changed and your feelings didn’t follow, because you didn’t notice. What you miss won’t move you, and what you practise noticing will.” Thank co-authors Kyle Logie-Hagen and Rose Amir Pour, and NSERC. Point to the GitHub link for the code. “Happy to take questions.” Stop.',
    render: () => (
      <Frame>
        <h1 style={K.title}>What you miss won’t move you.</h1>
        <p style={K.subtitle}>What you practise noticing will.</p>
        <div style={{ height: 10 }} />
        <p style={K.author}>With Kyle Logie-Hagen · Rose Amir Pour</p>
        <p style={K.link}>Materials, data and code · github.com/Normega/BCAT2026</p>
        <Cite>NSERC Discovery RGPIN-2015-05901</Cite>
        <div style={K.crests}>
          <img src="/RADlab_Logo.svg" alt="RADlab" style={{ height: 44 }} />
          <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 44 }} />
        </div>
      </Frame>
    ),
  },
]


// ── Bonus slides (Q&A only) ─────────────────────────────────────────────────
// Reached with B (index) or 1–8, never by clicking forward from the close.
// Every figure and number here is already in this deck's Reading text or in
// the /keynote deck; nothing new is asserted.

function Figs({ items }) {
  return (
    <div style={K.figRow}>
      {items.map(f => <img key={f.src} src={f.src} alt={f.alt} style={K.figHalf} />)}
    </div>
  )
}

const BONUS_FIGS = [
  '/keynote/fig-staircase.png', '/keynote/fig-detection-curve.png',
  '/keynote/fig-eneuro-3.png', '/keynote/fig-eneuro-4a.png',
  '/keynote/fig-ejn-accuracy.png', '/keynote/fig-brainsci-training.png',
]

const BONUS = [
  {
    q: 'Did breathing really change on missed trials?',
    note: '“Yes, and we checked trial by trial.” Study 5’s belt shows breathing moved the cued way on 88.9% of missed trials and 91.0% of noticed ones, 63 ms apart in breath length. “So a miss is not a change that never happened. What separated hit from miss was whether it was noticed.”',
    render: () => (
      <Frame kicker="Bonus · Study 5 respiration belt">
        <H2>The body changed on missed trials too</H2>
        <div style={K.stats}>
          <Stat big="88.9%" label="of missed trials: breathing moved the cued way" sub="respiration belt, Study 5" color={BLUE} />
          <Stat big="91.0%" label="of noticed trials: breathing moved the cued way" sub="63 ms apart in breath length" color={GOLD} />
        </div>
        <Lead>A miss is not a change that never happened. What separated a hit from a miss was whether it was noticed.</Lead>
      </Frame>
    ),
  },
  {
    q: 'Isn’t a missed change just a weaker response?',
    note: '“That’s the Moderate account: missed changes still move you, just less, so the blue line should still slope up. It was flat, and missed trials matched no-change trials: the Bayes factors favour no difference in all four studies that had a no-change baseline.” If someone proposes a magnitude-blind lift instead (missed raised but flat), the same Bayes factors rule that out too.',
    render: () => (
      <Frame wide kicker="Bonus · missed versus no change">
        <H2>Missed changes look like no change at all</H2>
        <Bullets items={[
          'A, Constructivist: missed changes should move arousal as much as noticed ones. They did not.',
          'B, Moderate: missed changes should still move arousal, only less. They did not.',
          'C, Constitutive: missed changes do nothing. They matched no-change trials.',
        ]} />
        <div style={K.stats}>
          <Stat big="9–30 : 1" label="evidence that a missed change = no change" sub="BF₀₁ 8.7, 20.7, 9.6, 29.6 · four studies" color={BLUE} />
        </div>
      </Frame>
    ),
  },
  {
    q: 'How did you set the size of the change?',
    note: '“An adaptive staircase. It converges on the smallest change each person can detect, so hits and misses happen at the same magnitudes.” Left: one staircase. Right: detection rises with the size of the change in every study. Studies 1A–2 use a single staircase; 4–5 cross salience with direction.',
    render: () => (
      <Frame wide kicker="Bonus · finding each person’s threshold">
        <H2>A staircase sets the change at each person’s threshold</H2>
        <Figs items={[
          { src: '/keynote/fig-staircase.png', alt: 'Staircase level across trials converging on a threshold' },
          { src: '/keynote/fig-detection-curve.png', alt: 'Detection accuracy rising with the size of the breathing change, all five studies' },
        ]} />
        <Bullets items={[
          'Studies 1A–2 use one staircase; Studies 4–5 cross salience (high or low) with direction (faster or slower).',
          'Detection rises with the size of the change in every study.',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'Is the MAIA effect just self-esteem?',
    note: '“We checked. The confidence link survived controlling for self-esteem and trait self-doubt. And MAIA was unrelated to heartbeat-counting accuracy too (r = −.08), so it isn’t tracking sensing on a second task either.” The quoted item is MAIA item 4.',
    render: () => (
      <Frame kicker="Bonus · self-reported body awareness">
        <H2>Confidence, not sensitivity, and not just self-esteem</H2>
        <p style={K.quote}>“I notice changes in my breathing, such as whether it slows down or speeds up.” <span style={K.quoteSrc}>MAIA item 4</span></p>
        <Bullets items={[
          'MAIA predicted confidence (r = .26, 5 of 5 studies), not the smallest change detected (r = .07).',
          'The confidence link survived controlling for self-esteem and trait self-doubt.',
          'MAIA was also unrelated to heartbeat-counting accuracy in Study 5 (r = −.08).',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'What about meditators?',
    note: '“Honest answer: we haven’t tested them yet, and this audience is exactly why we want to.” Then the three limits, briefly. “Practitioners versus novices is the next study, and because the BCAT separates sensitivity from confidence, it can say which one practice changes.” Do not claim a result.',
    render: () => (
      <Frame kicker="Bonus · limits and next steps">
        <H2>What we don’t know yet</H2>
        <Bullets items={[
          'Samples were mostly undergraduates. Practitioners versus novices is the next test.',
          'Arousal was self-reported. Autonomic measures on hit and miss trials come next.',
          'Individual thresholds were only moderately reliable (ICC .24–.59 with 10-trial staircases).',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'Where does this happen in the brain?',
    note: 'Flag first: “This is a separate fMRI paradigm, sustained attention to the breath, not the BCAT (Farb, Zuo & Price, 2023, eNeuro).” Left: breath attention deactivates prefrontal, somatomotor and temporoparietal cortex relative to a visual target. Right: higher MAIA predicts less deactivation in the ACC. “Read it as convergent mechanism, not the same task.”',
    render: () => (
      <Frame wide kicker="Bonus · a separate fMRI paradigm (Farb, Zuo & Price, 2023)">
        <H2>Breath attention quiets cortex; awareness spares the ACC</H2>
        <Figs items={[
          { src: '/keynote/fig-eneuro-3.png', alt: 'Whole-brain deactivation during breath attention versus visual attention' },
          { src: '/keynote/fig-eneuro-4a.png', alt: 'ACC activity by self-reported interoceptive awareness (MAIA)' },
        ]} />
        <Bullets items={[
          'Attending to the breath deactivates prefrontal, somatomotor and temporoparietal cortex.',
          'Higher MAIA scores predict less deactivation in the ACC.',
          'Sustained breath attention, not the BCAT: convergent mechanism, not the same task.',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'Can noticing be trained?',
    note: 'Same caveat: these test sustained breath attention, not rate-change detection. Left (Zuo, Price & Farb, 2023, EJN): a classifier separates interoceptive from exteroceptive attention at 73–85%, holding two months later. Right (Price, Sevinc & Farb, 2023, Brain Sciences): Mindful Awareness in Body-oriented Therapy (MABT) reduces the deactivation and increases ACC–somatomotor and DAN–insula connectivity, tracking gains in self-reported awareness.',
    render: () => (
      <Frame wide kicker="Bonus · decodable and trainable">
        <H2>Breath attention is decodable, and it changes with training</H2>
        <Figs items={[
          { src: '/keynote/fig-ejn-accuracy.png', alt: 'Classifier accuracy for interoceptive versus exteroceptive attention' },
          { src: '/keynote/fig-brainsci-training.png', alt: 'Connectivity increase after body-awareness training' },
        ]} />
        <Bullets items={[
          'A classifier separates breath from visual attention at 73–85%, holding two months later.',
          'MABT training increases ACC–somatomotor and DAN–insula connectivity, tracking self-reported awareness.',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'What does this mean clinically?',
    note: '“If feeling waits on detection, there is a third lever besides changing the body or changing appraisal: changing what gets noticed and how much it is trusted.” Panic: catastrophic reading of detected signals. Interoceptive exposure changes the habit, not the sensitivity. And since MAIA tracks confidence rather than acuity, confidence in what you notice is a target in its own right.',
    render: () => (
      <Frame kicker="Bonus · clinical implications">
        <H2>A third lever: what gets noticed, and how it is trusted</H2>
        <Bullets items={[
          'Panic: catastrophic interpretation of detected signals.',
          'Interoceptive exposure changes the habit, not the sensitivity.',
          'Body awareness tracks confidence, not acuity, so confidence in what you notice is its own target.',
        ]} />
        <Lead>Alongside changing the body and changing appraisal, change what crosses the threshold.</Lead>
      </Frame>
    ),
  },
]

const BONUS_INDEX = {
  note: 'Bonus index. Press the number for the question asked; Esc returns to the slide you left. ← → step through the bonus slides.',
  render: () => (
    <Frame wide kicker="Bonus slides">
      <H2>Questions</H2>
      <div style={K.bonusGrid}>
        {BONUS.map((b, k) => (
          <div key={k} style={K.bonusCard}><span style={{ ...K.predK, flexShrink: 0 }}>{k + 1}</span><span>{b.q}</span></div>
        ))}
      </div>
    </Frame>
  ),
}

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
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 16, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },

  title:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px, 6vw, 64px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.05 },
  subtitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(19px, 3vw, 32px)', fontWeight: 400, color: 'var(--pkd)', margin: 0, fontStyle: 'italic' },
  author:   { fontSize: 'clamp(16px, 2.1vw, 21px)', color: 'var(--tx)', margin: 0, fontWeight: 600 },
  affil:    { fontSize: 'clamp(16px, 1.6vw, 18px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, fontFamily: '"Space Mono",monospace' },
  event:    { fontFamily: '"Space Mono",monospace', fontSize: 16, color: 'var(--tx2)', margin: '10px 0 0', letterSpacing: '0.06em' },
  crests:   { display: 'flex', gap: 32, alignItems: 'center', marginBottom: 6 },
  link:     { fontFamily: '"Space Mono",monospace', fontSize: 'clamp(16px, 1.9vw, 20px)', color: 'var(--pkd)', margin: 0, letterSpacing: '0.02em' },
  cite:     { fontFamily: '"Space Mono",monospace', fontSize: 16, color: 'var(--tx2)', margin: 0, letterSpacing: '0.03em' },

  h2:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(24px, 3.6vw, 40px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.12 },
  lead: { fontSize: 'clamp(16px, 2vw, 23px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, maxWidth: 820 },
  ul:   { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 860 },
  li:   { fontSize: 'clamp(16px, 1.9vw, 21px)', color: 'var(--tx)', lineHeight: 1.45, position: 'relative', paddingLeft: 24, textAlign: 'left' },
  detail: { fontSize: 'clamp(13px, 1.5vw, 16px)', color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 760, margin: 0, borderTop: '1px solid var(--bd)', paddingTop: 14 },

  preds: { display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  pred: { flex: '1 1 260px', maxWidth: 340, background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  predHead: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.4vw, 28px)', color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 10 },
  predK: { fontFamily: '"Space Mono",monospace', fontSize: 15, fontWeight: 700, color: '#fff', background: 'var(--pk)', borderRadius: 999, width: 28, height: 28, display: 'inline-grid', placeItems: 'center' },
  predLine: { fontSize: 'clamp(16px, 1.7vw, 19px)', color: 'var(--tx)', lineHeight: 1.35 },
  predWho: { fontFamily: '"Space Mono",monospace', fontSize: 16, color: 'var(--tx2)' },
  legend: { display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center', fontSize: 'clamp(16px, 1.6vw, 18px)', color: 'var(--tx2)' },

  figRow: { display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center', width: '100%' },
  figHalf: { flex: '1 1 0', minWidth: 0, maxWidth: '50%', maxHeight: '44vh', objectFit: 'contain', borderRadius: 8, background: '#fff' },
  quote: { fontFamily: '"DM Serif Display",Georgia,serif', fontStyle: 'italic', fontSize: 'clamp(18px, 2.2vw, 24px)', color: 'var(--tx)', margin: 0, maxWidth: 820, lineHeight: 1.4 },
  quoteSrc: { display: 'block', fontFamily: '"Space Mono",monospace', fontStyle: 'normal', fontSize: 16, color: 'var(--tx2)', marginTop: 6 },
  bonusGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, width: '100%', maxWidth: 1000 },
  bonusCard: { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, padding: '14px 18px', textAlign: 'left', fontSize: 'clamp(16px, 1.8vw, 19px)', color: 'var(--tx)' },
  fig: { maxWidth: '100%', maxHeight: '40vh', objectFit: 'contain', borderRadius: 8, background: '#fff' },
  figCap: { fontFamily: '"Space Mono",monospace', fontSize: 16, color: 'var(--tx2)', margin: '-8px 0 0' },
  stats: { display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  stat: { flex: '1 1 280px', maxWidth: 420, background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 6 },
  statBig: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: 1 },
  statLabel: { fontSize: 'clamp(16px, 1.8vw, 20px)', color: 'var(--tx)', lineHeight: 1.35 },
  statSub: { fontFamily: '"Space Mono",monospace', fontSize: 16, color: 'var(--tx2)' },

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
