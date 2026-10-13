// Social-personality research group, University of Toronto · October 2026 ·
// 15-minute talk + Q&A, in person. "What You Miss Won't Move You": the BCAT
// paper (Farb, Logie-Hagen & Amir Pour) at the centre, extended by Fouad &
// Farb ("We See Others as We Feel") into emotion perception and burnout.
//
// The room takes part: phones scan the title-slide QR (radlab.zone/poll/socpers)
// and tap where they are on the mood circle, which slide 2 plots live (RoomMood,
// talk_poll_mood_results(), supabase/migrations/20261013_talk_poll_moods.sql).
// Slide 3 frames the breath as both a readout of arousal and a lever on it.
// Then the room breathes through two BCAT trials (RoomTrials) and answers each
// on the phone (PollPhone), and slide 6 plots the room's noticers vs missers live
// (LiveResults) from talk_poll_results() (supabase/migrations/20261012_talk_polls.sql).
//
// Shell copied from /iscr-2026: click / → / Space advance, ← back, P opens the
// presenter window (notes, target times, clock; its keys drive the deck),
// B the bonus index for Q&A (1–9 jump, Esc returns), N / T in-page notes / clock.
// ?poll=socpers-rehearsal points the deck at the rehearsal poll. Before the real
// talk, press "New poll round" (top right, before the clock starts) so rehearsal
// answers don't show.
// Run of show: I:/My Drive/Talks/2026 UofT SocPers/SocPers2026_RunOfShow.md
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import RoomTrials, { PaceTraces } from './RoomTrials'
import LiveResults from './LiveResults'
import RoomMood from './RoomMood'
import { pollCodeFromUrl, LIVE_POLL } from './talkPoll'

export default function SocPers2026() {
  const [i, setI] = useState(0)
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('socpersDensity') || 'minimal' } catch { return 'minimal' }
  })
  const [showNotes, setShowNotes] = useState(false)
  const [showClock, setShowClock] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [presOpen, setPresOpen] = useState(false)
  // null = main deck; 0 = bonus index; 1..BONUS.length = that bonus slide.
  const [bonus, setBonus] = useState(null)
  const presRef = useRef(null)
  const [code] = useState(pollCodeFromUrl)
  const [round, setRound] = useState(null)
  useEffect(() => {
    supabase.rpc('talk_poll_info', { p_code: code }).then(({ data }) => setRound(data?.[0]?.round ?? null))
  }, [code])
  const newRound = useCallback(async () => {
    if (!window.confirm(`Start a new round for poll "${code}"? Answers so far stay in the database but stop showing.`)) return
    const { data, error } = await supabase.rpc('talk_poll_new_round', { p_code: code })
    if (error) window.alert(`Could not start a new round: ${error.message}`)
    else setRound(data)
  }, [code])

  const total = SLIDES.length
  const go = useCallback((d) => setI(v => Math.min(total - 1, Math.max(0, v + d))), [total])
  const setDens = useCallback((d) => {
    setDensity(d)
    try { localStorage.setItem('socpersDensity', d) } catch { /* ignore */ }
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
    for (const src of [...DECK_FIGS, ...BONUS_FIGS]) { const im = new Image(); im.src = src }
  }, [])

  // Presenter window: a same-origin popup we write into directly. Its keys are
  // re-dispatched on this window, so the deck (and the breathing exercise) can
  // be driven from it without moving focus back to the shared window.
  const openPresenter = useCallback(() => {
    let w = presRef.current
    if (!w || w.closed) {
      w = window.open('', 'socpers-presenter', 'width=620,height=560')
      if (!w) return
      w.document.title = 'Presenter · SocPers 2026'
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
      else if (e.key === 'Home')                               { setI(0); setStartedAt(null); setBonus(null) }
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
      <div class="keys">→ / Space next · ← back · R resets the breathing demo · Home restarts (clock too) · B bonus index, 1–${BONUS.length} a bonus slide · this window is not shared</div>
      ${bonusList}`
  }, [presOpen, i, elapsed, startedAt, bonus])

  const slide = SLIDES[i]
  const shown = bonus === null ? slide : bonus === 0 ? BONUS_INDEX : BONUS[bonus - 1]

  return (
    <div style={K.stage} data-socpers onClick={() => { if (bonus === null && !slide.exercise) step(1) }}>
      <div style={K.controls} onClick={e => e.stopPropagation()}>
        <div style={K.toggle}>
          {['minimal', 'reading'].map(d => (
            <button key={d} onClick={() => setDens(d)} style={{ ...K.toggleBtn, ...(density === d ? K.toggleOn : {}) }}>
              {d === 'minimal' ? 'Minimal' : 'Reading'}
            </button>
          ))}
        </div>
        <button onClick={() => setBonus(b => (b === null ? 0 : null))} style={{ ...K.notesBtn, ...(bonus !== null ? K.toggleOn : {}) }} title="Bonus slides for Q&A (B); Esc returns">
          {bonus === null ? 'Bonus' : 'Back to talk'}
        </button>
        {startedAt === null && (
          <button onClick={newRound} style={K.notesBtn} title="Clear the live results by starting a new poll round (do this after rehearsing)">
            Poll “{code}” · round {round ?? '…'} · new round
          </button>
        )}
        <button onClick={openPresenter} style={{ ...K.notesBtn, ...(presOpen ? K.toggleOn : {}) }} title="Presenter window with notes and clock (P)">
          Presenter
        </button>
      </div>

      <div style={K.slideArea}>{shown.render(density, setBonus, { code })}</div>

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

const DECK_FIGS = ['/socpers-oct-2026/breath-arousal.jpg', '/socpers-oct-2026/dig.jpg', '/socpers-oct-2026/gert-wheel.png', '/socpers-oct-2026/fig-gating-s5.png', '/socpers-oct-2026/fig-recognition.png', '/socpers-oct-2026/fig-burnout.png', '/socpers-oct-2026/qr-poll.png']

// ── Slides ──────────────────────────────────────────────────────────────────
// `by` = cumulative target time (seconds) at which this slide should be done.
// render(density, openBonus, ctx) — ctx.code is the poll code (live or rehearsal).

const SLIDES = [
  // 1 — Title + QR (up while you are introduced)
  {
    label: 'Title + phones out',
    by: 50,
    note: 'Up during the introduction. First words: “Before I say anything about the research, please take out your phone and scan this. It’s anonymous: no name, no login. The first thing it asks is how you’re feeling right now: just tap where you are on the circle and send.” Give it ~30 s; watch for people struggling and read the short URL aloud. Then click: the dots come in live on the next slide.',
    render: (_d, _b, ctx) => (
      <Frame wide>
        <div style={K2.titleRow}>
          <div style={K2.titleText}>
            <div style={K.crests}>
              <img src="/RADlab_Logo.svg" alt="RADlab" style={{ height: 52 }} />
              <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 52 }} />
            </div>
            <h1 style={K.title}>What You Miss Won’t Move You</h1>
            <p style={K.subtitle}>Noticing the body, feeling, and seeing others</p>
            <p style={K.author}>Norman Farb</p>
            <p style={K.affil}>Psychological and Brain Sciences · University of Toronto Mississauga</p>
          </div>
          <div style={K2.qrBox}>
            {ctx.code === LIVE_POLL
              ? <img src="/socpers-oct-2026/qr-poll.png" alt="QR code for radlab.zone/poll/socpers" style={K2.qr} />
              : <div style={K2.qrStub}>rehearsal poll<br />type the address below</div>}
            <p style={K2.qrUrl}>radlab.zone/poll/{ctx.code}</p>
            <p style={K2.qrHint}>Scan now · anonymous · no login</p>
          </div>
        </div>
      </Frame>
    ),
  },

  // 2 — The room's mood, live, and the question the talk is about
  {
    label: 'The room’s mood (live)',
    by: 110,
    note: 'Let the dots land; late taps keep arriving every 2 s. Read it quickly: “Most of you are on the right, pleasant side; this many up top, this many down below.” Then the question: “How did you know whether to put yourself high or low? What did you check?” Take two or three answers. Expect: heart rate, breathing, energy, tiredness, coffee, the time of day, or “I just guessed.” Land it: “Some of you checked your body, some of you reasoned from the situation, and some of you couldn’t say. That gap, between what the body is doing and what we notice of it, is what this talk is about.” Phones wait on “You’re on the screen”; the Next instruction comes on the following slide. If no phones got through, the slide asks by hands (top half? bottom half?) and the same question.',
    render: (_d, _b, ctx) => (
      <Frame wide kicker="You, right now · live">
        <H2>Where the room is right now</H2>
        <RoomMood code={ctx.code} active />
      </Frame>
    ),
  },

  // 3 — The breath: a readout of arousal, and a lever on it
  {
    label: 'The breath: readout and lever',
    by: 150,
    note: '“You just placed yourselves high or low on that circle. One of the clearest places arousal shows is the breath.” Top row: “Running from a bear, riding a roller coaster: both make the breath race. Same breathing, opposite feelings: that’s the left and right of the circle, and we’ll come back to it with Schachter and Singer.” Bottom left: “Asleep, the breath slows by itself.” Bottom right: “But she is slowing hers on purpose. That’s the other direction: the breath isn’t only a readout of arousal, it’s a lever on it. Slow it and you settle; speed it up and you activate.” Bridge: “In a moment I’m going to pull that lever on you. A circle will set your breathing and quietly change it. The question is whether you need to notice the change for it to move you. On your phone, tap Next.”',
    render: (density) => (
      <div style={K.twoCol}>
        <BreathFig />
        <div style={{ ...K.col, alignItems: 'flex-start', textAlign: 'left' }}>
          <div style={K.kicker}>The breath and arousal</div>
          <H2>A readout, and a lever</H2>
          <div style={K2.rl}>
            <span style={K2.rlTag}>Readout</span>
            <span>Arousal shows up in the breath. The chase and the coaster both make it race; sleep slows it. It carries the level, not the feeling: fear and thrill breathe alike.</span>
          </div>
          <div style={K2.rl}>
            <span style={{ ...K2.rlTag, background: 'var(--pk)', color: '#fff', borderColor: 'var(--pk)' }}>Lever</span>
            <span>Change the breath and arousal follows. Slow it on purpose and you settle; speed it up and you activate.</span>
          </div>
          <p style={K2.digTake}>So what happens when something else sets your breathing, and you don’t notice?</p>
          <Detail density={density}>Slow paced breathing (around 6 breaths a minute) raises heart-rate variability and lowers self-reported arousal and anxiety (Zaccaro et al., 2018, systematic review).</Detail>
        </div>
      </div>
    ),
  },

  // 4 — The room does two trials, answering on phones
  {
    label: 'Breathing demo',
    by: 265,
    exercise: true,
    note: '“Breathe with the circle, in as it grows, out as it shrinks. When it stops, answer on your phone.” Phones are on the screen that explains all this (after they tapped Next on the mood slide). ① Begin; say nothing for ~14 s. ② “On your phone, tap ‘The circle has stopped’, then: did the pace change, and how activated do you feel right now?” Watch the count climb; move on at ~80% of the room. ③ Trial 2 (“once more”), ~14 s. ④ Same two questions. ⑤ Done. Don’t reveal anything yet. R resets if you start early.',
    render: (_d, _b, ctx) => (
      <Frame wide>
        <RoomTrials code={ctx.code} />
      </Frame>
    ),
  },

  // 5 — Reveal: same change, different onset
  {
    label: 'Reveal: same change',
    by: 290,
    note: '“Here’s what the circle did. Both trials sped your breathing up by exactly the same amount, from 15 to about 19½ breaths a minute, 30% faster, and they ended at the same moment. The first crept up across three breaths; the second jumped.” Then: “So your body did the same thing twice. Let’s see what you felt.”',
    render: () => (
      <Frame wide kicker="What the circle did">
        <H2>Both trials sped up by the same amount</H2>
        <PaceTraces width={700} />
        <Lead>Same change in your breathing. The only difference was how it arrived.</Lead>
      </Frame>
    ),
  },

  // 6 — The room's data, live
  {
    label: 'Your results (live)',
    by: 370,
    note: 'Read it in this order. (1) “How many of you noticed trial 1?” read the n. “And trial 2?” Usually more. (2) Compare gold to blue within each panel: people who noticed vs missed the same change. (3) The bottom line: how many felt more activated after trial 2. If it matches: “That’s the paper in one room.” If it doesn’t: “With this many people that’s close to a coin toss. That’s why we ran 787. Let’s see what they did.” Either way, don’t over-read it. Refreshes every 2 s, so late answers still land. If no answers reached the server, this slide shows three hands-up questions instead of empty axes: ask them in order, read the room, then “keep your hands in mind” and move on.',
    render: (_d, _b, ctx) => (
      <Frame wide kicker="You, a minute ago · live">
        <H2>Did noticing change how activated you felt?</H2>
        <LiveResults code={ctx.code} active />
      </Frame>
    ),
  },

  // 7 — Social psychology's arousal classics
  {
    label: 'The classics',
    by: 430,
    note: '“This room knows these studies better than I do.” One line each. Schachter and Singer: same adrenaline, and a euphoric or an angry confederate decided what it became. Dutton and Aron: the shaky bridge on the Capilano. Valins: change only the belief about the heart, and the photos look more attractive. “Arousal is the engine of some of the field’s most famous findings. But every one of them varied the body, or the belief about it. None varied whether the bodily change was noticed. That’s the gap.”',
    render: () => (
      <Frame wide kicker="Arousal in social psychology">
        <H2>The field’s classics varied the body, never the noticing</H2>
        <div style={K2.cards}>
          {CLASSICS.map(c => (
            <div key={c.who} style={K2.card}>
              <div style={K2.cardYear}>{c.year}</div>
              <div style={K2.cardWho}>{c.who}</div>
              <div style={K2.cardWhat}>{c.what}</div>
            </div>
          ))}
        </div>
        <Lead>Does a bodily change have to be noticed before it can move feeling, or behaviour?</Lead>
      </Frame>
    ),
  },

  // 8 — Three positions (hands bet)
  {
    label: 'Three positions (bet)',
    by: 480,
    note: 'One clause per card. A: missed changes move you just as much, noticing only adds a lift. B: missed changes still move you, noticing amplifies it. C, James and Lange: noticing is the feeling. “Hands up for A… B… C.” Ten seconds, keep moving. “It was never settled, because bigger changes are both easier to notice and more arousing.”',
    render: (d) => (
      <Frame wide kicker="Does a bodily change have to be noticed to be felt?">
        <Predictions />
        <Legend />
        <Lead>Hands up: A, B or C?</Lead>
        <Detail density={d}>
          Until now these could not be told apart, because larger physiological changes are both more
          noticeable and more arousing. Detection and magnitude were confounded in every paradigm.
        </Detail>
      </Frame>
    ),
  },

  // 9 — BCAT
  {
    label: 'The task (BCAT)',
    by: 520,
    note: '“You’ve just done our task, the Breath Change Awareness Task.” Gradual onset hides a change; abrupt onset reveals it. A staircase sets the change at each person’s own threshold, so we get noticed and missed trials at the same size of change, in the same person. Five studies, 787 people; the last preregistered, with a respiration belt.',
    render: (d) => (
      <Frame wide kicker="The Breath Change Awareness Task">
        <H2>Same change, noticed or missed, in the same person</H2>
        <Bullets items={[
          'Abrupt or gradual onset moves detection without moving the size of the change.',
          'An adaptive staircase sets the change at each person’s own threshold.',
          'After every trial: faster, slower or same? How confident? How activated?',
          'Five studies, N = 787. Study 5 preregistered, with a respiration belt (N = 206).',
        ]} />
        <Detail density={d}>
          Analyses compare the change–arousal slope on detected versus missed trials at matched magnitudes
          (99–100% overlap in change sizes).
        </Detail>
      </Frame>
    ),
  },

  // 10 — Result
  {
    label: 'Result',
    by: 590,
    note: '“Left is faster breathing. Gold, when people noticed: the bigger the change, the more aroused they felt. Blue, the same changes missed: flat.” Right: “That difference appears in all five studies.” Then: “Missed changes produced no more arousal than no change at all; Bayes factors favour the null 9 to 30 to 1. And the belt shows breathing really did change on missed trials: 89% of them moved the cued way.” “The answer is C.” Callback to the live slide if it matched.',
    render: (d) => (
      <Frame wide kicker="Result">
        <H2>Noticed changes move us. Missed ones don’t.</H2>
        <img src="/socpers-oct-2026/fig-gating-s5.png" alt="Study 5: felt arousal by breathing-rate change for detected and missed trials, with a forest plot of the Change × Detection interaction across five studies" style={K.fig} />
        <p style={K.figCap}>Left: Study 5, felt arousal by breathing change · Right: all five studies</p>
        <div style={K.stats}>
          <Stat big="5 / 5" label="studies replicate the gating" sub="pooled r = −.11 [−.15, −.06]" />
          <Stat big="9–30 : 1" label="evidence that a missed change = no change" sub="BF₀₁, 4 studies with a no-change baseline" color={BLUE} />
        </div>
        <Detail density={d}>
          Missed-change trials did not differ from no-change trials (BF₀₁ = 8.7, 20.7, 9.6, 29.6). Study 5 belt:
          breathing moved in the cued direction on 88.9% of missed and 91.0% of detected trials.
        </Detail>
      </Frame>
    ),
  },

  // 11 — The bridge, at threshold (Study 3)
  {
    label: 'The bridge, at threshold',
    by: 645,
    note: '“So we went back to the bridge.” Point along the strip: “Breathe with the circle for eight breaths, say whether it changed, rate how activated you feel, then rate four faces for attractiveness. Thirty-two times.” Then the numbers: faster breathing raised arousal, and that arousal carried over to the faces, but only on trials where the change was noticed. On missed trials, the same bodily change carried nothing. “Dutton and Aron’s men noticed the bridge shaking. Ours, half the time, didn’t, and then there was no transfer.” Signs flipped on the slide so that faster = positive.',
    render: (d) => (
      <Frame wide kicker="Study 3 · Dutton & Aron, at threshold">
        <H2>Arousal carried over to attraction only when the change was noticed</H2>
        <BridgeMethod />
        <div style={K.stats}>
          <Stat big=".06" label="noticed trials: breathing → arousal → attractiveness" sub="indirect effect, 95% CI [.04, .09]" color={GOLD} />
          <Stat big=".00" label="missed trials: the same path" sub="indirect effect, 95% CI [−.01, .00]" color={BLUE} />
        </div>
        <Detail density={d}>
          N = 103, fixed change sizes. Bayesian moderated mediation; the paper codes faster breathing as negative
          change (ACME noticed = −.062 [−.085, −.040], missed = .001 [−.003, .006]). Signs flipped here so faster =
          positive. Confidence and mood were also rated (1–9) after the detection question. Chicago Face Database
          faces, two high- and two average-attractiveness per trial, matched to stated preference.
        </Detail>
      </Frame>
    ),
  },

  // 12 — What the MAIA is (hands)
  {
    label: 'The MAIA',
    by: 675,
    note: '“If you study individual differences in body awareness, the questionnaire you reach for is the MAIA.” It was built to capture the adaptive kind: noticing sensations, staying with them without worrying, trusting your body. “And it behaves like a wellbeing measure. In Aya’s sample, people who scored higher had fewer anxiety and depression symptoms and less burnout.” Then the item: “Here’s one of its items. Hands up if that’s you.” Smile at the count, and hold it for the next slide.',
    render: (d) => (
      <Frame kicker="Self-reported body awareness (MAIA)">
        <H2>The standard questionnaire for body awareness</H2>
        <Lead>The MAIA measures adaptive interoceptive awareness: noticing sensations, staying with them without worry, trusting the body. Higher scores go with better mental health.</Lead>
        <div style={K.stats}>
          <Stat big="r = −.32" label="higher MAIA, fewer anxiety and depression symptoms" sub="PHQ-4 · n = 315" color="var(--pkd)" />
          <Stat big="r = −.34" label="higher MAIA, less burnout" sub="BAT-C · n = 315" color="var(--pkd)" />
        </div>
        <div style={K2.itemCard}>
          <p style={K.quote}>“I notice changes in my breathing, such as whether it slows down or speeds up.”</p>
          <span style={K2.itemHands}>One MAIA item · hands up if that’s you</span>
        </div>
        <Detail density={d}>
          Multidimensional Assessment of Interoceptive Awareness (Mehling et al., 2012): 32 items in eight scales
          (noticing, not-distracting, not-worrying, attention regulation, emotional awareness, self-regulation, body
          listening, trusting). Correlations from the Fouad & Farb sample.
        </Detail>
      </Frame>
    ),
  },

  // 13 — MAIA predicts confidence, not sensitivity
  {
    label: 'MAIA: confidence, not sensitivity',
    by: 710,
    note: '“So, all of you with your hands up: across five studies the MAIA predicted how confident people were in their judgements, not how small a change they could detect.” For this audience: “It looks less like a sensory ability and more like a disposition: a habit of attending to and trusting the body. And Aya’s new sample finds the same: MAIA unrelated to thresholds.”',
    render: (d) => (
      <Frame kicker="Self-reported body awareness (MAIA)">
        <H2>It predicts confidence, not sensitivity</H2>
        <div style={K.stats}>
          <Stat big="r = .26" label="MAIA → confidence in your judgement" sub="5 of 5 studies · [.20, .32]" color="var(--pkd)" />
          <Stat big="r = .07" label="MAIA → smallest change you can detect" sub="0 of 4 studies · BF₀₁ 2.5–5.5" color="#8a8b8f" />
        </div>
        <Lead>Self-reported body awareness tracks a disposition to attend and trust, not finer sensing.</Lead>
        <Detail density={d}>
          Pooled random-effects estimates. The confidence link survived controlling for self-esteem and trait
          self-doubt. In Fouad & Farb (N = 305) MAIA was again unrelated to breath-change thresholds (r = .04).
        </Detail>
      </Frame>
    ),
  },

  // 14 — Study 1, what we learned (bridge to Study 2)
  {
    label: 'Study 1: what we learned',
    by: 735,
    note: 'Wrap up the first paper in three beats, one per line. “We only feel a bodily change once we detect it: a missed change felt like no change at all. And the detail, how big the change was, only arrives with detection. And who detects isn’t something people can tell you about themselves: the questionnaire tracked confidence, not sensitivity.” Then the picture: “Two people working just as hard. One digs up a barrel of toxic waste, the other digs up treasure. If feeling waits on detection, then what we spend our attention digging for decides what we get to feel.” Bridge: “So does what we feel reach how we see other people?”',
    render: () => (
      <div style={K.twoCol}>
        <img src="/socpers-oct-2026/dig.jpg" alt="Two people digging with equal effort: one unearths a barrel of toxic waste, the other a trove of treasure" style={K2.digImg} />
        <div style={{ ...K.col, alignItems: 'flex-start', textAlign: 'left' }}>
          <div style={K.kicker}>Study 1 · what we learned</div>
          <H2>We feel what we detect</H2>
          <Bullets items={[
            'A missed change felt like no change at all.',
            'The detail, how big the change was, arrived only with detection.',
            'People can’t report who detects: self-rated body awareness tracked confidence, not sensitivity.',
          ]} />
          <p style={K2.digTake}>So what we spend our attention detecting decides what we get to feel.</p>
        </div>
      </div>
    ),
  },

  // 15 — Aya: the question and design
  {
    label: 'Seeing others: design',
    by: 765,
    note: '“If noticing gates what we feel, does it reach how we see other people?” Aya Fouad’s thesis, now submitted. 315 students, preregistered. Walk the storyboard left to right: “Here’s one block. Three breathing trials like yours, the change set at your own threshold. Then five short clips of an actor expressing one of 14 emotions, with face, voice and body, in made-up speech. After each: which emotion, on this wheel, and how intense. Twelve blocks.” (The face is a cartoon: the GERT clips are licensed for research only.) Breathing belt and ECG throughout. “So now we can ask: when the body changes, does perception follow the body, or the feeling?”',
    render: (d) => (
      <Frame wide kicker="Fouad & Farb · preregistered · N = 315">
        <H2>Does what we feel colour how we see others?</H2>
        <GertMethod />
        <Lead>Belt and ECG throughout, so the body, the noticing and the feeling can be pulled apart.</Lead>
        <Detail density={d}>
          Geneva Emotion Recognition Test (GERT): 14 emotions, short audio-video clips with pseudo-linguistic speech.
          286 completed the combined task; breathing analyses use the 224 whose belt followed the pacer
          (breathing followed the prescribed change at 90% gain).
        </Detail>
      </Frame>
    ),
  },

  // 16 — We see others as we feel
  {
    label: 'Felt, not bodily, arousal',
    by: 840,
    note: 'Say first: “This chain is within each person, block to block.” Walk the chain left to right. Bodily change → noticed (strong) → felt arousal (only via noticing) → perceived intensity (dashed: suggestive). The direct line from the body to perception: equivalent to zero. Then the two stats, starting with the contrast: “The arrow says .05, the card says .08, because they ask different questions. The chain is within a person, adjusted for the breathing change and for noticing; the card compares people: those who felt more aroused overall saw others’ emotions as more intense.” people who felt more aroused saw others’ emotions as more intense; heart rate didn’t move with the breathing change, so this isn’t general autonomic arousal. Honest caveat in one breath: “Small, correlational within person, and it varied a lot across people. The next study manipulates the feeling directly.”',
    render: (d) => (
      <Frame wide kicker="Fouad & Farb · within person, n = 224 with a working belt">
        <H2>We see others as we feel, not as our bodies change</H2>
        <PathDiagram />
        <div style={K.stats}>
          <Stat big="b = .08" label="felt more aroused → saw others’ emotions as more intense" sub="between people, per scale point · [.01, .15]" color="var(--pkd)" />
          <Stat big="≈ 0" label="heart-rate response to the breathing change" sub="−0.25 bpm · equivalent to zero (±1 bpm)" color="#8a8b8f" />
        </div>
        <Detail density={d}>
          Within person, felt arousal predicted intensity on average (b = 0.063 [0.017, 0.109]) but heterogeneously
          across people. Noticed vs missed changes: direction effect on felt arousal 0.32 vs 0.09 scale points.
          The serial path’s indirect effect just includes zero ([−0.0002, 0.0058]). Salience raised detection by
          12 points but did not move intensity, so the awareness–perception link is correlational.
        </Detail>
      </Frame>
    ),
  },

  // 17 — Breath sensitivity and recognition accuracy
  {
    label: 'Sensitivity → accuracy',
    by: 900,
    note: '“A second route, and it’s an individual difference.” People who could detect smaller changes in their own breathing recognised other people’s emotions more accurately: r = −.17 (higher threshold = less sensitive), and it replicated almost exactly on 60 clips they had never seen (−.18). “The questionnaire didn’t predict it, and neither did heartbeat counting.” Then the ladder, top to bottom: “It survives response bias, confidence, the questionnaire, mood and burnout. But in the people whose belt worked, once we control how closely their breathing followed the pacer, it drops to −.10 and is no longer significant.” Why: better pacer-followers had lower thresholds (r = −.28), and following the pacer itself predicted recognition (β = .14, p = .057). “So it could be the body, or it could be engagement, and following a breathing pacer may itself take breath awareness. Separating those is the next study.” (Bonus 5 if asked.)',
    render: (d) => (
      <Frame wide kicker="Fouad & Farb · preregistered H2B">
        <H2>Sensitive to your own breath, better at reading others</H2>
        <img src="/socpers-oct-2026/fig-recognition.png" alt="Breath-change threshold against emotion recognition accuracy, baseline clips (r = −.17) and 60 new clips (r = −.18)" style={K2.figShort} />
        <RobustLadder />
        <Detail density={d}>
          Higher threshold = less sensitive. Also held for each direction alone, as a rank correlation and without the
          ceiling thresholds; MAIA and heartbeat counting predicted neither threshold nor recognition. The pacer
          subsample alone keeps it (β = −.13, p = .039); adding synchrony, entrainment gain and false alarms removes it.
          Corrected for threshold unreliability, the raw association is about −.25.
        </Detail>
      </Frame>
    ),
  },

  // 18 — Burnout: same body, less feeling
  {
    label: 'Burnout',
    by: 955,
    note: 'Wellbeing turn. Optional, light: “Anyone had a week this term where everything felt a bit muted?” Then: “What burnout changed was feeling: higher burnout, lower felt arousal, even though their breathing followed the pacer exactly as closely as everyone else’s, and their heart rate didn’t differ. Same body, less feeling.” Then the path: “Does that reach how they see other people? A little, and only through feeling. Lower felt arousal went with seeing others’ emotions as less intense, so burnout has a small indirect effect, −.03, whose interval excludes zero. Burnout on its own didn’t predict intensity at all, because what’s left over runs slightly the other way.” If pressed: exploratory, cross-sectional, and both arousal and intensity are ratings, so a shared rating style could feed the felt → perceived link.',
    render: (d) => (
      <Frame wide kicker="Fouad & Farb · burnout (BAT), exploratory">
        <H2>Burnout: the same body, less feeling</H2>
        <div style={K2.split}>
          <img src="/socpers-oct-2026/fig-burnout.png" alt="Burnout against mean felt arousal, r = −.20" style={K2.figBurn} />
          <div style={K2.sideStats}>
            <div><Stat big="r = .01" label="burnout → how closely breathing followed the pacer" sub="equivalent to zero (±.17): same body" color="#8a8b8f" /></div>
          </div>
        </div>
        <BurnoutMediation />
        <Detail density={d}>
          Person level, n = 286, standardised; indirect effect from 10,000 bootstrap resamples. Preregistered burnout
          predictions (recognition, intensity, thresholds) were not supported and were equivalent to zero. Burnout was
          unrelated to task heart rate; resting heart rate and HRV associations up to |r| ≈ .2 cannot be excluded.
        </Detail>
      </Frame>
    ),
  },

  // 19 — Wellbeing
  {
    label: 'Wellbeing',
    by: 990,
    note: '“Put together, a lot of wellbeing may live in what we notice.” One line per row, then the caveat: “These are hypotheses, not findings, and the nice thing is that each one is testable with these tasks.” The burnout line is the one with data behind it today.',
    render: () => (
      <Frame kicker="For wellbeing">
        <H2>Wellbeing may live in what we notice</H2>
        <div style={K2.wellGrid}>
          {WELLBEING.map(w => (
            <div key={w.t} style={K2.well}>
              <div style={K2.wellT}>{w.t}</div>
              <div style={K2.wellS}>{w.s}</div>
            </div>
          ))}
        </div>
        <Lead>Hypotheses, each testable with these tasks.</Lead>
      </Frame>
    ),
  },

  // 20 — Close
  {
    label: 'Close',
    by: 1000,
    note: 'Slow down. “Your first trial was a change your body made that your feelings never registered. What you miss won’t move you, and what you feel colours what you see.” Thank Kyle Logie-Hagen, Rose Amir Pour and Aya Fouad; NSERC and SSHRC. “Happy to take questions.” (B opens the bonus slides.)',
    render: () => (
      <Frame>
        <h1 style={K.title}>What you miss won’t move you.</h1>
        <p style={K.subtitle}>What you feel colours what you see.</p>
        <div style={{ height: 10 }} />
        <p style={K.author}>With Kyle Logie-Hagen · Rose Amir Pour · Aya Fouad</p>
        <p style={K.link}>github.com/Normega/BCAT2026 · github.com/Normega/breathemopercept2026</p>
        <Cite>NSERC Discovery RGPIN-2015-05901 · SSHRC Insight Grant</Cite>
        <div style={K.crests}>
          <img src="/RADlab_Logo.svg" alt="RADlab" style={{ height: 44 }} />
          <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 44 }} />
        </div>
      </Frame>
    ),
  },
]

const CLASSICS = [
  { year: '1962', who: 'Schachter & Singer', what: 'The same adrenaline became euphoria or anger, depending on the confederate in the room.' },
  { year: '1966', who: 'Valins', what: 'A faster heartbeat played back as false feedback made photographs look more attractive.' },
  { year: '1974', who: 'Dutton & Aron', what: 'Men interviewed on the swaying Capilano bridge were more likely to call the interviewer afterwards.' },
]

const WELLBEING = [
  { t: 'Savouring', s: 'Pleasant bodily states only count once they cross the threshold.' },
  { t: 'Anxiety', s: 'Mild signals noticed and read as threat. Exposure works on what is noticed.' },
  { t: 'Burnout', s: 'The body still answers; the feeling is turned down. The one with data so far.' },
  { t: 'Social life', s: 'Our felt state colours how intense others look. Noticing it is a chance to set it aside.' },
]

// One Study 3 trial, in the task's order (Study3.py runmisattribution): eight
// breaths with the circle, the faster/slower/same question, arousal 1-9 (the
// confidence and mood ratings around it are left to the Detail line), then four
// faces rated 0-10. The face is a caricature: Chicago Face Database images are
// licensed for research, not for showing.
// Norm's four-panel arousal illustration: top row high arousal (fleeing a bear,
// a roller coaster), bottom row low (asleep, meditating). Chips name what the
// breath is doing in each (the scenes name themselves); only the meditator is
// steering it.
function BreathFig() {
  const chips = [
    ['Breath races', false],
    ['Breath races', false],
    ['Breath slows', false],
    ['Slowed on purpose', true],
  ]
  return (
    <div style={K2.bfWrap}>
      <img src="/socpers-oct-2026/breath-arousal.jpg" alt="Four panels: a hiker fleeing a bear, a rider screaming on a roller coaster, a person asleep in bed, and a person meditating outdoors" style={K2.bfImg} />
      <div style={K2.bfGrid}>
        {chips.map(([t, lever], i) => (
          <div key={i} style={K2.bfCell}>
            <span style={{ ...K2.bfChip, ...(lever ? K2.bfChipOn : {}) }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BridgeMethod() {
  const W = 1000, H = 296
  const sw = 210, sh = 148, sy = 44
  const xs = [6, 260, 514, 768]
  const ink = '#1c1c1e', grey = '#6b6c70', pink = '#F068A4', pkd = '#BA417A'
  const sans = "'DM Sans',sans-serif", mono = "'Space Mono',monospace"
  const cy = sy + sh / 2
  const screen = (x, children) => (
    <g>
      <rect x={x} y={sy} width={sw} height={sh} rx="12" fill="#fff" stroke={grey} strokeWidth="3" />
      <rect x={x + sw / 2 - 16} y={sy + sh} width="32" height="9" fill={grey} />
      <rect x={x + sw / 2 - 40} y={sy + sh + 9} width="80" height="5" rx="2.5" fill={grey} />
      {children}
    </g>
  )
  const caption = (x, t, s) => (
    <g>
      <text x={x + sw / 2} y={sy + sh + 42} textAnchor="middle" fontSize="20" fontWeight="600" fill={ink} fontFamily={sans}>{t}</text>
      <text x={x + sw / 2} y={sy + sh + 66} textAnchor="middle" fontSize="16" fill={grey} fontFamily={sans}>{s}</text>
    </g>
  )
  const arrow = (x1, x2) => (
    <line x1={x1} y1={cy} x2={x2} y2={cy} stroke={grey} strokeWidth="3" markerEnd="url(#bm-arrow)" />
  )
  const badge = (x, t, w) => (
    <g>
      <rect x={x + sw - w + 14} y={sy - 18} width={w} height="34" rx="17" fill={pink} />
      <text x={x + sw - w / 2 + 14} y={sy + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff" fontFamily={mono}>{t}</text>
    </g>
  )
  const slider = (x, y, n0, n1, at) => {
    const a = x + 22, b = x + sw - 22
    return (
      <g>
        <line x1={a} x2={b} y1={y} y2={y} stroke={ink} strokeWidth="2.5" />
        <text x={a} y={y + 24} textAnchor="middle" fontSize="14" fill={grey} fontFamily={mono}>{n0}</text>
        <text x={b} y={y + 24} textAnchor="middle" fontSize="14" fill={grey} fontFamily={mono}>{n1}</text>
        <circle cx={a + at * (b - a)} cy={y} r="8" fill={pink} />
      </g>
    )
  }
  const fx = xs[3] + sw / 2, fy = sy + 58
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 960, height: 'auto' }} role="img"
      aria-label="One trial: breathe with the circle for eight breaths, say whether it got faster, slower or stayed the same, rate arousal from 1 to 9, then rate four faces for attractiveness from 0 to 10; 32 trials in all">
      <defs>
        <marker id="bm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={grey} />
        </marker>
        <radialGradient id="bm-pk" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#ff9ec9" />
          <stop offset="72%" stopColor={pink} />
        </radialGradient>
      </defs>

      {/* 1 · breathe with the circle */}
      {screen(xs[0], (
        <circle cx={xs[0] + sw / 2} cy={cy} r="40" fill="url(#bm-pk)">
          <animate attributeName="r" values="24;56;24" dur="5s" repeatCount="indefinite" />
        </circle>
      ))}
      {badge(xs[0], '× 8 breaths', 140)}
      {caption(xs[0], 'Breathe with it', 'it may speed up or slow down')}
      {arrow(xs[0] + sw + 8, xs[1] - 10)}

      {/* 2 · did it change? */}
      {screen(xs[1], (
        <g>
          <text x={xs[1] + sw / 2} y={sy + 44} textAnchor="middle" fontSize="17" fontWeight="600" fill={ink} fontFamily={sans}>Did it change?</text>
          {['faster', 'slower', 'same'].map((t, k) => (
            <g key={t}>
              <rect x={xs[1] + 14 + k * 62} y={sy + 70} width="58" height="34" rx="17" fill={k === 0 ? '#FBEAF3' : '#fff'} stroke={k === 0 ? pink : grey} strokeWidth="2" />
              <text x={xs[1] + 43 + k * 62} y={sy + 92} textAnchor="middle" fontSize="14" fill={ink} fontFamily={sans}>{t}</text>
            </g>
          ))}
        </g>
      ))}
      {caption(xs[1], 'Noticed?', 'faster · slower · same')}
      {arrow(xs[1] + sw + 8, xs[2] - 10)}

      {/* 3 · arousal */}
      {screen(xs[2], (
        <g>
          <text x={xs[2] + sw / 2} y={sy + 44} textAnchor="middle" fontSize="17" fontWeight="600" fill={ink} fontFamily={sans}>How aroused?</text>
          {slider(xs[2], sy + 92, '1', '9', 0.62)}
        </g>
      ))}
      {caption(xs[2], 'Felt arousal', '1 = calm · 9 = activated')}
      {arrow(xs[2] + sw + 8, xs[3] - 10)}

      {/* 4 · a face, rated for attractiveness */}
      {screen(xs[3], (
        <g>
          <ellipse cx={fx} cy={fy + 4} rx="26" ry="32" fill="#F6E3D5" stroke={ink} strokeWidth="2.5" />
          <path d={`M${fx - 30},${fy - 6} q2,-36 30,-36 q28,0 30,36 q-10,-16 -30,-16 q-20,0 -30,16 z`} fill="#5a4636" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx={fx - 10} cy={fy + 2} r="3.5" fill={ink} />
          <circle cx={fx + 10} cy={fy + 2} r="3.5" fill={ink} />
          <path d={`M${fx - 10},${fy + 18} q10,8 20,0`} fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
          {slider(xs[3], sy + 112, '0', '10', 0.7)}
        </g>
      ))}
      {badge(xs[3], '× 4 faces', 118)}
      {caption(xs[3], 'How attractive?', '0–10 · two high, two average')}

      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="18" fontWeight="700" fill={pkd} fontFamily={mono}>one trial · × 32 trials · N = 103</text>
    </svg>
  )
}

// One combined-task block, drawn as the screens a participant saw: three
// breathing trials, then five emotion clips, each followed by the GERT wheel
// (the real response screen from the task, Task/images/RatingScreen.png) and
// the 1-7 intensity scale. The actor is a caricature: GERT clips are licensed
// for research use, not for showing.
function GertMethod() {
  const W = 1080, H = 372
  const sw = 230, sh = 168, sy = 66
  const xs = [10, 320, 580, 840]
  const ink = '#1c1c1e', grey = '#6b6c70', pink = '#F068A4', pkd = '#BA417A'
  const sans = "'DM Sans',sans-serif", mono = "'Space Mono',monospace"
  const screen = (x, children) => (
    <g>
      <rect x={x} y={sy} width={sw} height={sh} rx="14" fill="#fff" stroke={grey} strokeWidth="3" />
      <rect x={x + sw / 2 - 18} y={sy + sh} width="36" height="10" fill={grey} />
      <rect x={x + sw / 2 - 44} y={sy + sh + 10} width="88" height="6" rx="3" fill={grey} />
      {children}
    </g>
  )
  const caption = (x, t, s) => (
    <g>
      <text x={x + sw / 2} y={sy + sh + 46} textAnchor="middle" fontSize="20" fontWeight="600" fill={ink} fontFamily={sans}>{t}</text>
      <text x={x + sw / 2} y={sy + sh + 70} textAnchor="middle" fontSize="16" fill={grey} fontFamily={sans}>{s}</text>
    </g>
  )
  const arrow = (x1, x2) => (
    <line x1={x1} y1={sy + sh / 2} x2={x2} y2={sy + sh / 2} stroke={grey} strokeWidth="3" markerEnd="url(#gm-arrow)" />
  )
  const cx2 = xs[1] + sw / 2, cy = sy + sh / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 1080, height: 'auto' }} role="img"
      aria-label="One block: three breathing trials, then five emotion clips, each followed by a 14-emotion wheel and a 1 to 7 intensity rating; twelve blocks in all">
      <defs>
        <marker id="gm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={grey} />
        </marker>
        <radialGradient id="gm-pk" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#ff9ec9" />
          <stop offset="72%" stopColor={pink} />
        </radialGradient>
      </defs>

      {/* 1 · breathing trial (the circle breathes) */}
      {screen(xs[0], (
        <circle cx={xs[0] + sw / 2} cy={cy} r="40" fill="url(#gm-pk)">
          <animate attributeName="r" values="28;62;28" dur="4s" repeatCount="indefinite" />
        </circle>
      ))}
      <g>
        <rect x={xs[0] + sw - 58} y={sy - 18} width="70" height="36" rx="18" fill={pink} />
        <text x={xs[0] + sw - 23} y={sy + 7} textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff" fontFamily={mono}>× 3</text>
      </g>
      {caption(xs[0], 'Breathing trial', 'at your threshold · faster, slower, same?')}
      {arrow(xs[0] + sw + 10, xs[1] - 12)}

      {/* 2 · emotion clip: a caricatured actor mid-expression, with voice */}
      {screen(xs[1], (
        <g>
          <ellipse cx={cx2} cy={cy - 4} rx="44" ry="52" fill="#FBEAF3" stroke={ink} strokeWidth="3" />
          <path d={`M${cx2 - 28},${cy - 30} q10,-12 20,-4 M${cx2 + 8},${cy - 34} q10,-8 20,4`} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <circle cx={cx2 - 16} cy={cy - 14} r="5" fill={ink} />
          <circle cx={cx2 + 16} cy={cy - 14} r="5" fill={ink} />
          <ellipse cx={cx2} cy={cy + 22} rx="14" ry="10" fill={ink} />
          <path d={`M${cx2 + 58},${cy - 14} q10,14 0,28 M${cx2 + 72},${cy - 24} q16,24 0,48`} fill="none" stroke={pkd} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${xs[1] + 16},${sy + sh - 30} l0,16 l13,-8 z`} fill={grey} />
          <rect x={xs[1] + 38} y={sy + sh - 24} width={sw - 56} height="4" rx="2" fill="#e6e6e8" />
          <rect x={xs[1] + 38} y={sy + sh - 24} width={(sw - 56) * 0.45} height="4" rx="2" fill={pink} />
        </g>
      ))}
      {caption(xs[1], 'Emotion clip', 'an actor: face, voice, body')}
      {arrow(xs[1] + sw + 6, xs[2] - 8)}

      {/* 3 · the GERT response wheel, as participants saw it */}
      {screen(xs[2], (
        <image href="/socpers-oct-2026/gert-wheel.png" x={xs[2] + 10} y={sy + 10} width={sw - 20} height={sh - 20} preserveAspectRatio="xMidYMid meet" />
      ))}
      {caption(xs[2], 'Which emotion?', '14 choices')}
      {arrow(xs[2] + sw + 6, xs[3] - 8)}

      {/* 4 · intensity, 1-7 */}
      {screen(xs[3], (
        <g>
          <text x={xs[3] + sw / 2} y={sy + 54} textAnchor="middle" fontSize="18" fontWeight="600" fill={ink} fontFamily={sans}>How intense?</text>
          <line x1={xs[3] + 24} x2={xs[3] + sw - 24} y1={sy + 100} y2={sy + 100} stroke={ink} strokeWidth="2.5" />
          {[1, 2, 3, 4, 5, 6, 7].map((v, k) => {
            const x = xs[3] + 24 + k * ((sw - 48) / 6)
            return (
              <g key={v}>
                <line x1={x} x2={x} y1={sy + 92} y2={sy + 108} stroke={ink} strokeWidth="2" />
                <text x={x} y={sy + 132} textAnchor="middle" fontSize="15" fill={grey} fontFamily={mono}>{v}</text>
              </g>
            )
          })}
          <circle cx={xs[3] + 24 + 4 * ((sw - 48) / 6)} cy={sy + 100} r="9" fill={pink} />
        </g>
      ))}
      {caption(xs[3], 'How intense?', '1 = not at all · 7 = extremely')}

      {/* × 5: the clip, wheel and scale repeat five times */}
      <path d={`M${xs[1]},${sy - 14} L${xs[1]},${sy - 26} L${xs[3] + sw},${sy - 26} L${xs[3] + sw},${sy - 14}`} fill="none" stroke={pkd} strokeWidth="2.5" />
      <rect x={(xs[1] + xs[3] + sw) / 2 - 62} y={sy - 44} width="124" height="34" rx="17" fill="#fff" stroke={pkd} strokeWidth="2.5" />
      <text x={(xs[1] + xs[3] + sw) / 2} y={sy - 21} textAnchor="middle" fontSize="19" fontWeight="700" fill={pkd} fontFamily={mono}>× 5 clips</text>

      {/* × 12 blocks */}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="19" fontWeight="700" fill={pkd} fontFamily={mono}>one block · × 12 blocks</text>
    </svg>
  )
}

// The within-person chain from Fouad & Farb (Figure 4C), drawn for the projector.
function PathDiagram() {
  const W = 1000, H = 284
  const boxes = [
    { x: 20,  t1: 'Breathing', t2: 'change made' },
    { x: 270, t1: 'Change', t2: 'noticed' },
    { x: 520, t1: 'Felt', t2: 'arousal' },
    { x: 770, t1: 'Perceived', t2: 'intensity in others' },
  ]
  const bw = 210, bh = 76, by = 88
  const arrows = [
    { from: 0, b: 'b = 0.45', p: 'p < .001', solid: true },
    { from: 1, b: 'b = 0.10', p: 'p = .012', solid: true },
    { from: 2, b: 'b = 0.05', p: 'p = .070', solid: false },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 980, height: 'auto' }} role="img"
      aria-label="Breathing change made leads to noticing, noticing to felt arousal, felt arousal (suggestively) to perceived intensity; the direct path from bodily change to perception is equivalent to zero">
      <defs>
        <marker id="sp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#1c1c1e" />
        </marker>
        <marker id="sp-arrow-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#ABADB0" />
        </marker>
      </defs>
      <text x={20} y={20} fontSize="17" fontWeight="700" fill="#BA417A" letterSpacing="1.5" fontFamily="'Space Mono',monospace">WITHIN PERSON · BLOCK TO BLOCK</text>
      {boxes.map((b, k) => (
        <g key={k}>
          <rect x={b.x} y={by} width={bw} height={bh} rx="12" fill={k === 3 ? '#FBEAF3' : '#fff'} stroke={k === 3 ? '#F068A4' : '#6b6c70'} strokeWidth="2" />
          <text x={b.x + bw / 2} y={by + 33} textAnchor="middle" fontSize="20" fontWeight="600" fill="#1c1c1e" fontFamily="'DM Sans',sans-serif">{b.t1}</text>
          <text x={b.x + bw / 2} y={by + 57} textAnchor="middle" fontSize="17" fill="#3a3a3e" fontFamily="'DM Sans',sans-serif">{b.t2}</text>
        </g>
      ))}
      {arrows.map(a => {
        const x1 = boxes[a.from].x + bw + 4, x2 = boxes[a.from + 1].x - 6
        return (
          <g key={a.from}>
            <line x1={x1} y1={by + bh / 2} x2={x2} y2={by + bh / 2} stroke="#1c1c1e" strokeWidth={a.solid ? 3 : 2} strokeDasharray={a.solid ? '' : '6 6'} markerEnd="url(#sp-arrow)" />
            <text x={(x1 + x2) / 2} y={by - 34} textAnchor="middle" fontSize="24" fontWeight="700" fill="#1c1c1e" fontFamily="'Space Mono',monospace">{a.b}</text>
            <text x={(x1 + x2) / 2} y={by - 10} textAnchor="middle" fontSize="18" fill="#3a3a3e" fontFamily="'Space Mono',monospace">{a.p}</text>
          </g>
        )
      })}
      <path d={`M${20 + bw / 2},${by + bh + 4} Q500,${H + 30} ${770 + bw / 2},${by + bh + 6}`} fill="none" stroke="#ABADB0" strokeWidth="2" strokeDasharray="6 6" markerEnd="url(#sp-arrow-g)" />
      <text x={500} y={H - 22} textAnchor="middle" fontSize="19" fill="#6b6c70" fontFamily="'DM Sans',sans-serif">bodily change → perception directly: 0.01 per SD, equivalent to zero</text>
    </svg>
  )
}

// The H2B estimate as covariates are added (Aya repo, Results/h2b_robustness/
// report.md). Standardised, 95% CIs; higher threshold = less sensitive, so
// negative = sensitive people read emotions better.
function RobustLadder() {
  const rows = [
    { t: 'As preregistered', s: 'n = 305', e: -0.174, lo: -0.281, hi: -0.063, v: 'r = −.17', p: 'p = .002' },
    { t: '+ bias, confidence, MAIA, mood, burnout', s: 'n = 301', e: -0.138, lo: -0.262, hi: -0.015, v: 'β = −.14', p: 'p = .028' },
    { t: 'Belt followed the pacer', s: 'subsample, n = 240', e: -0.133, lo: -0.260, hi: -0.007, v: 'β = −.13', p: 'p = .039' },
    { t: '+ how closely breathing followed it', s: 'synchrony, entrainment, false alarms · n = 236', e: -0.095, lo: -0.234, hi: 0.044, v: 'β = −.10', p: 'p = .18', ns: true },
  ]
  const W = 1000, rh = 54, top = 30, H = top + rows.length * rh + 26
  const px0 = 520, px1 = 790, lo = -0.35, hi = 0.1
  const X = v => px0 + (v - lo) / (hi - lo) * (px1 - px0)
  const sans = "'DM Sans',sans-serif", mono = "'Space Mono',monospace"
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 1000, height: 'auto' }} role="img"
      aria-label="Breath sensitivity and recognition: r = −.17 as preregistered; −.14 with bias, confidence, MAIA, mood and burnout controlled; −.13 in the subsample whose belt followed the pacer; −.10, p = .18, not significant, once pacer-following is controlled">
      <text x={16} y={16} fontSize="16" fontWeight="700" fill="#BA417A" letterSpacing="1.5" fontFamily={mono}>CONTROLLING FOR…</text>
      {rows.map((r, k) => {
        const y = top + k * rh + rh / 2
        const c = r.ns ? '#8a8b8f' : '#1c1c1e'
        return (
          <g key={k}>
            {r.ns && <rect x={0} y={y - rh / 2 + 2} width={W} height={rh - 4} rx="12" fill="#FBEAF3" />}
            <text x={16} y={y - 3} fontSize="19" fontWeight="600" fill={r.ns ? '#3a3a3e' : c} fontFamily={sans}>{r.t}</text>
            <text x={16} y={y + 18} fontSize="15" fill="#6b6c70" fontFamily={sans}>{r.s}</text>
            <line x1={X(r.lo)} x2={X(r.hi)} y1={y} y2={y} stroke={c} strokeWidth="3" strokeLinecap="round" />
            <circle cx={X(r.e)} cy={y} r="8" fill={r.ns ? '#fff' : c} stroke={c} strokeWidth="3" />
            <text x={px1 + 28} y={y + 6} fontSize="20" fontWeight="700" fill={r.ns ? '#BA417A' : c} fontFamily={mono}>{r.v}</text>
            <text x={px1 + 136} y={y + 6} fontSize="17" fill={r.ns ? '#BA417A' : '#3a3a3e'} fontFamily={mono}>{r.p}</text>
          </g>
        )
      })}
      <line x1={X(0)} x2={X(0)} y1={top - 6} y2={H - 24} stroke="#6b6c70" strokeWidth="2" strokeDasharray="5 5" />
      {[[-0.3, '−.30'], [-0.15, '−.15'], [0, '0']].map(([v, t]) => (
        <text key={t} x={X(v)} y={H - 4} textAnchor="middle" fontSize="15" fill="#6b6c70" fontFamily={mono}>{t}</text>
      ))}
    </svg>
  )
}

// Burnout → felt arousal → perceived intensity, person level (n = 286,
// standardised; indirect from 10,000 bootstrap resamples, run 2026-10-12 on
// the Aya repo's Results/Combined_data.csv + questionnaireFile.csv, set_combined).
function BurnoutMediation() {
  const W = 1000, H = 300
  const boxes = [
    { x: 20,  t1: 'Burnout', t2: 'BAT-C' },
    { x: 395, t1: 'Felt', t2: 'arousal' },
    { x: 770, t1: 'Perceived', t2: 'intensity in others' },
  ]
  const bw = 210, bh = 72, by = 64
  const arrows = [
    { from: 0, b: 'β = −.20', p: 'p < .001' },
    { from: 1, b: 'β = .15', p: 'p = .012' },
  ]
  const sans = "'DM Sans',sans-serif", mono = "'Space Mono',monospace"
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 980, height: 'auto' }} role="img"
      aria-label="Burnout lowers felt arousal (β = −.20), felt arousal predicts perceived intensity (β = .15), so burnout has a small indirect effect on perceived intensity, β = −.03, 95% CI −.065 to −.005; the direct path is +.08, not significant, and the total is .05, not significant">
      <defs>
        <marker id="sp-arrow-m" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#1c1c1e" />
        </marker>
        <marker id="sp-arrow-mg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#ABADB0" />
        </marker>
      </defs>
      <text x={20} y={18} fontSize="16" fontWeight="700" fill="#BA417A" letterSpacing="1.5" fontFamily={mono}>BETWEEN PEOPLE · n = 286</text>
      {boxes.map((b, k) => (
        <g key={k}>
          <rect x={b.x} y={by} width={bw} height={bh} rx="12" fill={k === 2 ? '#FBEAF3' : '#fff'} stroke={k === 2 ? '#F068A4' : '#6b6c70'} strokeWidth="2" />
          <text x={b.x + bw / 2} y={by + 31} textAnchor="middle" fontSize="20" fontWeight="600" fill="#1c1c1e" fontFamily={sans}>{b.t1}</text>
          <text x={b.x + bw / 2} y={by + 54} textAnchor="middle" fontSize="17" fill="#3a3a3e" fontFamily={sans}>{b.t2}</text>
        </g>
      ))}
      {arrows.map(a => {
        const x1 = boxes[a.from].x + bw + 4, x2 = boxes[a.from + 1].x - 6
        return (
          <g key={a.from}>
            <line x1={x1} y1={by + bh / 2} x2={x2} y2={by + bh / 2} stroke="#1c1c1e" strokeWidth="3" markerEnd="url(#sp-arrow-m)" />
            <text x={(x1 + x2) / 2} y={by + bh / 2 - 14} textAnchor="middle" fontSize="22" fontWeight="700" fill="#1c1c1e" fontFamily={mono}>{a.b}</text>
            <text x={(x1 + x2) / 2} y={by + bh / 2 + 30} textAnchor="middle" fontSize="16" fill="#3a3a3e" fontFamily={mono}>{a.p}</text>
          </g>
        )
      })}
      <path d={`M${20 + bw / 2},${by + bh + 4} Q500,${by + bh + 110} ${770 + bw / 2},${by + bh + 6}`} fill="none" stroke="#ABADB0" strokeWidth="2" strokeDasharray="6 6" markerEnd="url(#sp-arrow-mg)" />
      <text x={500} y={by + bh + 82} textAnchor="middle" fontSize="17" fill="#6b6c70" fontFamily={sans}>direct β = +.08, n.s.</text>
      <text x={500} y={H - 34} textAnchor="middle" fontSize="20" fontWeight="700" fill="#BA417A" fontFamily={mono}>indirect β = −.03 [−.065, −.005]</text>
      <text x={500} y={H - 8} textAnchor="middle" fontSize="17" fill="#6b6c70" fontFamily={sans}>total β = .05, n.s.: burnout alone doesn’t predict intensity</text>
    </svg>
  )
}

// ── Bonus slides (Q&A only) ─────────────────────────────────────────────────
// B opens the index, 1–9 jump to one, Esc returns. Nothing here goes beyond the
// two manuscripts and the /iscr-2026 and /keynote decks.

function Figs({ items }) {
  return (
    <div style={K.figRow}>
      {items.map(f => <img key={f.src} src={f.src} alt={f.alt} style={K.figHalf} />)}
    </div>
  )
}

const BONUS_FIGS = ['/keynote/fig-staircase.png', '/keynote/fig-detection-curve.png']

const BONUS = [
  {
    q: 'Did breathing really change on missed trials?',
    note: '“Yes, trial by trial.” Study 5’s belt: breathing moved the cued way on 88.9% of missed and 91.0% of noticed trials, 63 ms apart in breath length. In Aya’s sample, 85% of missed changes still moved the prescribed way, reaching a median 88% of the prescribed change. “A miss is a change the body made and the person didn’t notice.”',
    render: () => (
      <Frame kicker="Bonus · respiration belts">
        <H2>The body changed on missed trials too</H2>
        <div style={K.stats}>
          <Stat big="88.9%" label="BCAT Study 5: missed trials where breathing moved the cued way" sub="vs 91.0% of noticed trials" color={BLUE} />
          <Stat big="85%" label="Fouad & Farb: missed changes where breathing moved the prescribed way" sub="median 88% of the prescribed change" color={BLUE} />
        </div>
      </Frame>
    ),
  },
  {
    q: 'Isn’t a missed change just a weaker response?',
    note: '“That’s position B: missed changes still move you, just less, so the blue line should still slope. It was flat, and missed trials matched no-change trials: the Bayes factors favour no difference in all four studies with a no-change baseline.”',
    render: () => (
      <Frame wide kicker="Bonus · missed versus no change">
        <H2>Missed changes look like no change at all</H2>
        <Bullets items={[
          'A: missed changes should move arousal as much as noticed ones. They did not.',
          'B: missed changes should still move arousal, only less. They did not.',
          'C: missed changes do nothing. They matched no-change trials.',
        ]} />
        <div style={K.stats}>
          <Stat big="9–30 : 1" label="evidence that a missed change = no change" sub="BF₀₁ 8.7, 20.7, 9.6, 29.6 · four studies" color={BLUE} />
        </div>
      </Frame>
    ),
  },
  {
    q: 'How did you set the size of the change?',
    note: '“An adaptive staircase converges on the smallest change each person can detect, so hits and misses happen at the same magnitudes.” Left: one staircase. Right: detection rises with change size in every study.',
    render: () => (
      <Frame wide kicker="Bonus · finding each person’s threshold">
        <H2>A staircase sets the change at each person’s threshold</H2>
        <Figs items={[
          { src: '/keynote/fig-staircase.png', alt: 'Staircase level across trials converging on a threshold' },
          { src: '/keynote/fig-detection-curve.png', alt: 'Detection accuracy rising with the size of the breathing change, all five studies' },
        ]} />
      </Frame>
    ),
  },
  {
    q: 'Is noticing → perception causal?',
    note: '“Not yet shown, and we say so.” Salience was randomised and raised detection by 12 points, but perceived intensity did not move (equivalent to zero, ±0.03 points). So the awareness–intensity link is within-person and correlational. The causal test is to manipulate felt arousal while holding the body constant, which is the next study.',
    render: () => (
      <Frame kicker="Bonus · what is and isn’t causal">
        <H2>The feeling–perception link is correlational, so far</H2>
        <Bullets items={[
          'Randomised salience raised detection by 12 points (72.9% vs 61.3%).',
          'It did not move perceived intensity: 0.000 [−0.034, 0.034], equivalent to zero.',
          'Next: manipulate felt arousal while holding the body constant.',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'Is breath sensitivity just general ability or engagement?',
    note: '“It could be, and we can’t rule it out yet: we didn’t measure cognitive ability.” What argues against a purely general account: it survived response bias, confidence, MAIA, demographics, PHQ-4 and burnout (β = −.14); and heartbeat counting, also an effortful attention task, predicted neither the threshold (r = −.08) nor recognition (r = −.05), though counting has its own problems. What argues for it: among people whose belt worked, controlling how closely they followed the pacer (synchrony, entrainment gain) and false alarms weakened it from β = −.13 to −.10, p = .18, and emotion-recognition tests generally track cognitive ability modestly. “The clean test is the BCAT’s visual condition: the same pacer and the same change, watched without breathing along. If visual thresholds predict reading others just as well, it’s general ability. If breath predicts over and above visual, it’s interoceptive. Add a short ability measure as a covariate.”',
    render: () => (
      <Frame kicker="Bonus · interoception or general ability?">
        <H2>Is it the body, or just being good at tasks?</H2>
        <Bullets items={[
          'Not measured: no cognitive-ability or working-memory task in this study.',
          'Survives response bias, confidence, MAIA, demographics, PHQ-4 and burnout: β = −.14, p = .028.',
          'Heartbeat counting, also effortful, predicted neither threshold (r = −.08) nor recognition (r = −.05).',
          'Controlling how closely breathing followed the pacer, plus false alarms, weakens it: β = −.10, p = .18.',
        ]} />
        <Lead>Next: the BCAT’s visual condition (same pacer, no breathing) plus a short ability measure. Breath beyond visual = interoceptive.</Lead>
      </Frame>
    ),
  },
  {
    q: 'Did burnout change emotion perception?',
    note: '“No, and the nulls are informative: equivalent to zero at |r| = .17, with burnout scores spanning 31 to 110 of 115.” Burnout did predict lower felt arousal (r = −.20). Did that reach perception? Only through feeling, and only a little: tested directly, the indirect path burnout → felt arousal → intensity is β = −.03 [−.065, −.005]. The total stays at zero because the remaining direct path runs slightly the other way (+.08, n.s.).',
    render: () => (
      <Frame kicker="Bonus · burnout and emotion perception">
        <H2>Burnout did not impair reading others</H2>
        <Bullets items={[
          'Recognition r = −.01, intensity r = .04, thresholds r = .02: all equivalent to zero (±.17).',
          'Scores spanned 31 to 110 of a possible 115, so not restricted range.',
          'Through felt arousal, a small indirect effect on intensity: β = −.03 [−.065, −.005].',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'What about meditators?',
    note: '“We haven’t tested them yet.” Mostly undergraduates; arousal self-reported; thresholds moderately reliable (ICC .24–.59). Practitioners vs novices is next, and because the BCAT separates sensitivity from confidence, it can say which one practice changes.',
    render: () => (
      <Frame kicker="Bonus · limits and next steps">
        <H2>What we don’t know yet</H2>
        <Bullets items={[
          'Samples were mostly undergraduates. Practitioners versus novices is the next test.',
          'Arousal was self-reported; heart rate did not track it.',
          'Individual thresholds were only moderately reliable (ICC .24–.59 with 10-trial staircases).',
        ]} />
      </Frame>
    ),
  },
]

const BONUS_INDEX = {
  note: 'Bonus index. Press the number for the question asked; Esc returns to the slide you left. ← → step through the bonus slides.',
  render: (_d, openBonus) => (
    <Frame wide kicker="Bonus slides">
      <H2>Questions</H2>
      <div style={K.bonusGrid}>
        {BONUS.map((b, k) => (
          <button key={k} type="button" style={K.bonusCard} onClick={e => { e.stopPropagation(); openBonus(k + 1) }}><span style={{ ...K.predK, flexShrink: 0 }}>{k + 1}</span><span>{b.q}</span></button>
        ))}
      </div>
    </Frame>
  ),
}

const K2 = {
  titleRow: { display: 'flex', gap: 48, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  titleText: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, textAlign: 'left', maxWidth: 640 },
  qrBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--bd)', borderRadius: 24, padding: 24 },
  qr: { width: 'min(30vh, 280px)', height: 'auto', imageRendering: 'pixelated' },
  qrStub: { width: 'min(30vh, 280px)', aspectRatio: '1', display: 'grid', placeItems: 'center', textAlign: 'center', border: '2px dashed var(--bd)', borderRadius: 12, color: 'var(--tx2)', fontSize: 16 },
  qrUrl: { fontFamily: '"Space Mono",monospace', fontSize: 'clamp(16px, 1.8vw, 20px)', fontWeight: 700, color: 'var(--pkd)', margin: 0 },
  qrHint: { fontSize: 16, color: 'var(--tx2)', margin: 0 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, width: '100%' },
  card: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '18px 22px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 },
  cardYear: { fontFamily: '"Space Mono",monospace', fontSize: 16, color: 'var(--pkd)' },
  cardWho: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.4vw, 28px)', color: 'var(--tx)' },
  cardWhat: { fontSize: 'clamp(16px, 1.7vw, 19px)', color: 'var(--tx)', lineHeight: 1.4 },
  flow: { display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'center' },
  flowBox: { background: '#fff', border: '2px solid', borderRadius: 18, padding: '18px 24px', maxWidth: 360, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 },
  flowT: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(22px, 2.6vw, 30px)' },
  flowS: { fontSize: 'clamp(16px, 1.6vw, 18px)', color: 'var(--tx2)', lineHeight: 1.4 },
  flowArrow: { fontSize: 36, color: 'var(--tx3)' },
  flowTimes: { fontFamily: '"Space Mono",monospace', fontSize: 'clamp(16px, 2vw, 22px)', color: 'var(--pkd)', fontWeight: 700 },
  figWide: { maxWidth: '100%', maxHeight: '44vh', objectFit: 'contain', borderRadius: 8, background: '#fff' },
  split: { display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  figSide: { maxWidth: 'min(560px, 90vw)', maxHeight: '46vh', objectFit: 'contain', borderRadius: 8, background: '#fff' },
  figShort: { maxWidth: '100%', maxHeight: '30vh', objectFit: 'contain', borderRadius: 8, background: '#fff' },
  figBurn: { maxWidth: 'min(440px, 90vw)', maxHeight: '30vh', objectFit: 'contain', borderRadius: 8, background: '#fff' },
  sideStats: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 300, maxWidth: 420 },
  itemCard: { background: '#fff', border: '2px solid var(--pk)', borderRadius: 24, padding: '16px 32px', maxWidth: 860, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  itemHands: { fontFamily: '"Space Mono",monospace', fontSize: 16, fontWeight: 700, color: 'var(--pkd)', letterSpacing: '0.05em', textTransform: 'uppercase' },
  bfWrap: { position: 'relative', width: '100%', maxWidth: 'min(560px, 64vh)', aspectRatio: '1 / 1', justifySelf: 'center', borderRadius: 24, overflow: 'hidden' },
  bfImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  bfGrid: { position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' },
  bfCell: { display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 12 },
  bfChip: { whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.92)', color: 'var(--tx)', borderRadius: 24, padding: '4px 12px', fontSize: 'clamp(12px, 1.3vw, 16px)', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.18)' },
  bfChipOn: { background: 'var(--pk)', color: '#fff' },
  rl: { display: 'flex', alignItems: 'baseline', gap: 16, fontSize: 'clamp(17px, 1.9vw, 22px)', lineHeight: 1.4, color: 'var(--tx)' },
  rlTag: { flex: '0 0 auto', width: 104, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', border: '2px solid var(--pkd)', color: 'var(--pkd)', borderRadius: 24, padding: '4px 0' },
  digImg: { width: '100%', maxWidth: 520, maxHeight: '70vh', objectFit: 'cover', borderRadius: 24, justifySelf: 'center' },
  digTake: { fontFamily: '"DM Serif Display",Georgia,serif', fontStyle: 'italic', fontSize: 'clamp(20px, 2.4vw, 28px)', color: 'var(--pkd)', margin: '8px 0 0', lineHeight: 1.3 },
  wellGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, width: '100%' },
  well: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '16px 22px', textAlign: 'left' },
  wellT: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.4vw, 28px)', color: 'var(--pkd)' },
  wellS: { fontSize: 'clamp(16px, 1.8vw, 20px)', color: 'var(--tx)', lineHeight: 1.4, marginTop: 4 },
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
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 40, alignItems: 'center', width: 'min(1180px, 95vw)' },
  col:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' },
  sutta:      { borderLeft: '3px solid var(--pk)', padding: '4px 0 4px 18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 460 },
  suttaQuote: { fontFamily: '"DM Serif Display",Georgia,serif', fontStyle: 'italic', fontSize: 'clamp(17px, 1.8vw, 21px)', color: 'var(--tx)', margin: 0, lineHeight: 1.35 },
  suttaSrc:   { fontFamily: '"Space Mono",monospace', fontSize: 16, color: 'var(--tx2)', margin: '4px 0 0' },
  suttaTake:  { fontSize: 'clamp(17px, 1.9vw, 21px)', fontWeight: 600, color: 'var(--pkd)', margin: 0 },
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
  bonusCard: { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', padding: '14px 18px', textAlign: 'left', fontSize: 'clamp(16px, 1.8vw, 19px)', color: 'var(--tx)' },
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
if (typeof document !== 'undefined' && !document.getElementById('socpers-bullets')) {
  const s = document.createElement('style')
  s.id = 'socpers-bullets'
  s.textContent = `[data-socpers] li::before{content:'';position:absolute;left:4px;top:.62em;width:7px;height:7px;border-radius:50%;background:#f068a4}`
  document.head.appendChild(s)
}
