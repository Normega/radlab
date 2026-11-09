// Tanenbaum Symposium 2026, "Aging Neuroscience: Connecting Cognition, Brain
// Health, and Well-Being" · Tue Nov 10, after the 3:00 break · 40 min with Q&A
// (about 32 min of talk). "Aging attentively: How what we notice shapes
// wellbeing over time". Between Linda Mah (depression and dementia risk) and
// Alan Castel (memory, curiosity and successful aging). Mostly a medicine and
// rehabilitation audience, plus the Tanenbaum family and the other chairs.
//
// Argument: two levers on "what we notice". The input (hearing and vision loss,
// and correcting them) and the attention (sensing vs doing; sad mood turns the
// senses down, and keeping them online predicts staying well). Evidence and
// every number: F:/gits/radlab_project/talk_research/reports/ (outside the repo).
//
// The room takes part twice, on phones at radlab.zone/live/<code>
// (LivePhone.jsx): a mood tap on arrival (slide 2 plots it, RoomMood from the
// SocPers deck, talk_poll_mood_results) and a two-minute Toggle practice
// (slides 11–12, RoomToggle.jsx, talk_poll_toggle_results(),
// supabase/migrations/20261108_talk_poll_toggles.sql).
//
// Shell copied from /socpers-oct-2026: click / → / Space advance, ← back, P opens
// the presenter window (notes, target times, clock; its keys drive the deck), B
// the bonus index for Q&A (1–9 jump, Esc returns), N / T in-page notes / clock.
// ?poll=tanenbaum-rehearsal points the deck at the rehearsal poll. Before the
// real talk, press "New poll round" (top right, before the clock starts).
import { useState, useEffect, useCallback, useRef } from 'react'
import QRCode from 'react-qr-code'
import { supabase } from '../../lib/supabase'
import RoomMood from '../socpers-oct-2026/RoomMood'
import { RoomToggleLive, RoomToggleResults } from './RoomToggle'
import { pollCodeFromUrl, STORY, SENSE } from './toggle'

export default function Tanenbaum2026() {
  const [i, setI] = useState(0)
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('tanenbaumDensity') || 'minimal' } catch { return 'minimal' }
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
    try { localStorage.setItem('tanenbaumDensity', d) } catch { /* ignore */ }
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
    for (const a of ART) { const im = new Image(); im.src = artSrc(a) }
  }, [])

  // Presenter window: a same-origin popup we write into directly. Its keys are
  // re-dispatched on this window, so the deck can be driven from it.
  const openPresenter = useCallback(() => {
    let w = presRef.current
    if (!w || w.closed) {
      w = window.open('', 'tanenbaum-presenter', 'width=620,height=560')
      if (!w) return
      w.document.title = 'Presenter · Tanenbaum 2026'
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
      if (forward)                                             { e.preventDefault(); step(1) }
      else if (back)                                           { e.preventDefault(); go(-1) }
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
    if (!presOpen || !w || w.closed) return
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
      <div class="keys">→ / Space next · ← back · Home restarts (clock too) · B bonus index, 1–${BONUS.length} a bonus slide · this window is not shared</div>
      ${bonusList}`
  }, [presOpen, i, elapsed, startedAt, bonus])

  const slide = SLIDES[i]
  const shown = bonus === null ? slide : bonus === 0 ? BONUS_INDEX : BONUS[bonus - 1]

  return (
    <div style={K.stage} data-tanenbaum onClick={() => { if (bonus === null) step(1) }}>
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
  return <ul style={K.ul}>{items.map((t, k) => <li key={k} style={K.li}>{t}</li>)}</ul>
}
function Detail({ density, children }) {
  if (density !== 'reading') return null
  return <p style={K.detail}>{children}</p>
}
function Cite({ children }) {
  return <p style={K.cite}>{children}</p>
}
function Take({ children }) {
  return <p style={K.take}>{children}</p>
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
function Caveat({ children }) {
  return <div style={K.caveat}><span style={K.caveatTag}>Caveat</span><span>{children}</span></div>
}
function Hypothesis({ children }) {
  return <div style={{ ...K.caveat, borderColor: 'var(--pk)' }}><span style={{ ...K.caveatTag, color: 'var(--pkd)', borderColor: 'var(--pkd)' }}>Hypothesis</span><span>{children}</span></div>
}

// Illustrations (Midjourney, Norm, Nov 9; prompts in the talk's Drive folder,
// art/PROMPTS.md). All 16:9, saved as JPG in public/tanenbaum-nov-2026/.
const ART = ['s01-title', 's03-levers', 's04-dinner', 's07-reconnect', 's08-touch', 's09-walk',
  's13-dimmed', 's15-rain', 's16-together', 's18-awe', 's21-close']
const artSrc = name => `/tanenbaum-nov-2026/${name}.jpg`

function Art({ name, alt, style }) {
  return <img src={artSrc(name)} alt={alt} style={{ ...K.art, ...style }} />
}

// Image beside text: the picture carries the slide, the text stays short.
function ArtSplit({ name, alt, kicker, children }) {
  return (
    <div style={K.artSplit}>
      <Art name={name} alt={alt} />
      <div style={{ ...K.col, alignItems: 'flex-start', textAlign: 'left' }}>
        {kicker && <div style={K.kicker}>{kicker}</div>}
        {children}
      </div>
    </div>
  )
}

// The title slide's QR: beside its address, so the image keeps the right half.
function LiveQrRow({ code }) {
  const url = `radlab.zone/live/${code}`
  return (
    <div style={K.qrRow}>
      <div style={{ width: 'min(180px, 22vh)' }}>
        <QRCode value={`https://${url}`} size={180} level="M" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        <p style={K.qrUrl}>{url}</p>
        <p style={K.qrHint}>Scan now · anonymous · no login</p>
      </div>
    </div>
  )
}

function LiveQr({ code, size = 220 }) {
  const url = `radlab.zone/live/${code}`
  return (
    <div style={K.qrBox}>
      <div style={{ background: '#fff', padding: 8, width: `min(${size}px, 24vh)` }}>
        <QRCode value={`https://${url}`} size={size} level="M" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
      <p style={K.qrUrl}>{url}</p>
      <p style={K.qrHint}>Scan now · anonymous · no login</p>
    </div>
  )
}

// ── Figures ─────────────────────────────────────────────────────────────────

// Two levers on what we notice: the input and the attention.
function TwoLevers({ highlight }) {
  const card = (k, title, sub, color) => (
    <div style={{ ...K.lever, borderColor: color, opacity: highlight && highlight !== k ? 0.45 : 1 }}>
      <span style={{ ...K.leverK, background: color }}>{k}</span>
      <span style={K.leverT}>{title}</span>
      <span style={K.leverS}>{sub}</span>
    </div>
  )
  return (
    <div style={K.levers}>
      {card('1', 'The input', 'Can the signal get in? Hearing, vision, smell, touch.', STORY)}
      {card('2', 'The attention', 'When it gets in, do we take it in? Sensing, or only thinking about it.', SENSE)}
    </div>
  )
}

// The popular chain, drawn with the middle link as thin as the evidence makes it.
function Chain() {
  const box = (t, s) => (
    <div style={K.chainBox}><span style={K.chainT}>{t}</span>{s && <span style={K.chainS}>{s}</span>}</div>
  )
  return (
    <div style={K.chain}>
      {box('Sensory loss', 'hearing, vision')}
      <div style={K.chainArrow}><span style={{ ...K.arrowLine, height: 3 }} /><span style={K.arrowLab}>2–6% of the link</span></div>
      {box('Isolation, loneliness')}
      <div style={K.chainArrow}><span style={{ ...K.arrowLine, height: 3 }} /></div>
      {box('Depression, decline', 'dementia')}
      <div style={K.chainDirect}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <span style={{ ...K.arrowLine, height: 8, background: 'var(--tx)' }} />
          <span style={{ width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: '18px solid var(--tx)' }} />
        </div>
        <span style={K.arrowLab}>most of the link runs by other routes</span>
      </div>
    </div>
  )
}

// Two ways of attending, redrawn from Farb, Anderson & Segal (2012), Figure 1:
// the narrative focus spans past to future in a thin band; the present-moment
// focus spans the range of experience now. Conceptual, not data.
function TwoModes() {
  const dots = [[205, 62], [228, 78], [199, 96], [224, 112], [210, 130], [236, 140], [196, 156], [220, 176], [203, 194], [230, 204]]
  const thoughts = [[70, 150], [104, 144], [138, 156], [292, 146], [326, 156], [358, 149]]
  return (
    <svg viewBox="0 0 430 270" style={{ width: '100%', maxWidth: 560, height: 'auto' }} role="img" aria-label="Doing spans past to future in a thin band; sensing spans the full range of experience now">
      <ellipse cx="215" cy="150" rx="170" ry="26" fill={`${STORY}22`} stroke={STORY} strokeWidth="2.5" />
      <ellipse cx="215" cy="134" rx="38" ry="104" fill={`${SENSE}18`} stroke={SENSE} strokeWidth="2.5" strokeDasharray="6 5" />
      {thoughts.map(([x, y], k) => <circle key={`t${k}`} cx={x} cy={y} r="6" fill={STORY} />)}
      {dots.map(([x, y], k) => <circle key={`d${k}`} cx={x} cy={y} r="6" fill={SENSE} />)}
      <line x1="30" y1="252" x2="400" y2="252" stroke="#9a9b9f" strokeWidth="1.5" />
      <text x="40" y="244" fontSize="13" fill="#6b6c70" fontFamily="'DM Sans',sans-serif">remembered past</text>
      <text x="215" y="268" fontSize="13" fill="#6b6c70" textAnchor="middle" fontFamily="'DM Sans',sans-serif">now</text>
      <text x="390" y="244" fontSize="13" fill="#6b6c70" textAnchor="end" fontFamily="'DM Sans',sans-serif">imagined future</text>
      <text x="62" y="118" fontSize="18" fill={STORY} fontFamily="'DM Serif Display',Georgia,serif">Doing</text>
      <text x="262" y="48" fontSize="18" fill={SENSE} fontFamily="'DM Serif Display',Georgia,serif">Sensing</text>
    </svg>
  )
}

// Farb et al. (2022), NeuroImage: Clinical, Figure 4C counts, one square per person.
function RelapseSquares() {
  const COLS = 22, CELL = 15, STEP = 18, X0 = 4
  const groups = [
    { label: 'Senses stayed most online during sad mood', relapsed: 2, total: 42, y: 0 },
    { label: 'Senses shut down most during sad mood', relapsed: 16, total: 43, y: 96 },
  ]
  return (
    <svg viewBox="0 0 410 220" style={{ width: '100%', maxWidth: 620, height: 'auto' }} role="img" aria-label="Of 42 people whose somatosensory cortex shut down least during sad film clips, 2 relapsed within two years; of 43 whose shut down most, 16 relapsed">
      {groups.map(g => (
        <g key={g.label}>
          <text x={X0} y={g.y + 16} fontSize="14" fill="#2a2a2e" fontFamily="'DM Sans',sans-serif" fontWeight="600">{g.label}</text>
          {Array.from({ length: g.total }, (_, k) => (
            <rect key={k} x={X0 + (k % COLS) * STEP} y={g.y + 26 + Math.floor(k / COLS) * STEP} width={CELL} height={CELL} rx="3"
              fill={k < g.relapsed ? '#2a2a2e' : `${SENSE}55`} />
          ))}
          <text x={X0 + COLS * STEP - 4} y={g.y + 80} textAnchor="end" fontSize="14" fill="#2a2a2e" fontFamily="'Space Mono',monospace">{g.relapsed} of {g.total} relapsed</text>
        </g>
      ))}
      <rect x={X0} y="204" width="13" height="13" rx="3" fill="#2a2a2e" />
      <text x={X0 + 20} y="215" fontSize="13" fill="#6b6c70" fontFamily="'DM Sans',sans-serif">relapsed within two years</text>
      <rect x={X0 + 210} y="204" width="13" height="13" rx="3" fill={`${SENSE}55`} />
      <text x={X0 + 230} y="215" fontSize="13" fill="#6b6c70" fontFamily="'DM Sans',sans-serif">stayed well</text>
    </svg>
  )
}

// ── Slides ──────────────────────────────────────────────────────────────────
// `by` = cumulative target time (seconds) at which this slide should be done.
// render(density, openBonus, ctx) — ctx.code is the poll code (live or rehearsal).

const SLIDES = [
  // 1 — Title + QR (up while Jen introduces)
  {
    label: 'Title + phones out',
    by: 60,
    note: 'Up during the introduction. Thank Jen, and thank Mrs. Spiro (SPY-ro) and the Tanenbaum family. First words after that: “Before I say anything about the research, please take out your phone and scan this. It’s anonymous: no name, no login. The first thing it asks is how you’re feeling right now. Just tap where you are on the circle and send.” Give it about 30 seconds; read the short URL aloud for anyone without a camera. Then click: the dots arrive live on the next slide.',
    render: (_d, _b, ctx) => (
      <div style={K.titleGrid}>
        <div style={K.titleText}>
          <div style={K.crests}>
            <img src="/RADlab_Logo.svg" alt="RADlab" style={{ height: 44 }} />
            <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 44 }} />
          </div>
          <h1 style={K.title}>Aging attentively</h1>
          <p style={K.subtitle}>How what we notice shapes wellbeing over time</p>
          <p style={K.author}>Norman Farb</p>
          <p style={K.affil}>Psychological and Brain Sciences · University of Toronto Mississauga</p>
          <p style={K.event}>Tanenbaum Symposium 2026 · Aging Neuroscience</p>
          <LiveQrRow code={ctx.code} />
        </div>
        <Art name="s01-title" alt="An older woman by a window, holding a warm mug, noticing the steam and the light" />
      </div>
    ),
  },

  // 2 — The room's mood, live
  {
    label: 'The room’s mood (live)',
    by: 140,
    note: 'Let the dots land; late taps keep arriving every 2 seconds. Read it quickly: “Most of you are on the pleasant side; this many up top, this many lower down. It’s after the coffee break.” Then the question: “How did you know where to put yourself? What did you check?” Take two or three answers. Expect: energy, tiredness, the coffee, heart rate, “I just guessed.” Land it: “Some of you checked your body, some of you reasoned from the situation. That difference, between sensing how you are and thinking about how you are, is what this talk is about.” Phones now say “keep this page open”.',
    render: (_d, _b, ctx) => (
      <Frame wide kicker="You, right now · live">
        <H2>Where the room is right now</H2>
        <RoomMood code={ctx.code} active />
      </Frame>
    ),
  },

  // 3 — Bridge from Linda Mah: what keeps people well? Two levers.
  {
    label: 'Bridge: two levers',
    by: 215,
    note: '“Linda has just shown us that depression and dementia risk travel together. So the natural next question is: what keeps people well? My answer today is about what we notice, and there are two levers on it.” Point to 1: “The input. Can the signal get in at all? This is where hearing and vision loss live, and where many of you in rehab and medicine already work.” Point to 2: “The attention. Once the signal is in, do we take it in, or do we only think about it? That is where my lab works.” “I’ll take them in that order.”',
    render: () => (
      <Frame wide kicker="What keeps people well?">
        <H2>Two levers on what we notice</H2>
        <Art name="s03-levers" alt="Two dials: one marked with an ear and an eye, one with a spotlight" style={{ ...K.artBanner, maxWidth: 'min(720px, 80vw, 48vh)' }} />
        <TwoLevers />
      </Frame>
    ),
  },

  // 4 — The input: Lancet Commission 2024
  {
    label: 'Lever 1: Lancet Commission',
    by: 300,
    note: '“Start with the input. In the 2024 Lancet Commission on dementia prevention, 14 modifiable risk factors together account for about 45% of dementia cases. Hearing loss is tied for the largest single factor, at 7%, level with high LDL cholesterol. Untreated vision loss was added in 2024, at about 2%.” Then the honest line, because this room will know it: “Those are population attributable fractions. They assume the link is causal, and that’s exactly what we need to look at next.” Reading mode adds how the hearing number was built.',
    render: (density) => (
      <ArtSplit name="s04-dinner" alt="A lively family dinner; around one older man, the faces and voices blur" kicker="Lever 1 · the input">
        <H2>Hearing loss is among the biggest dementia risks we can change</H2>
        <div style={K.bigLine}><b style={{ ...K.bigNum, color: STORY }}>7%</b><span>of dementia cases are linked to hearing loss, tied for first among 14 changeable risks</span></div>
        <div style={K.bigLine}><b style={{ ...K.bigNum, color: STORY }}>2%</b><span>to untreated vision loss</span></div>
        <Caveat>If the link is causal. That is the question.</Caveat>
        <Cite>Livingston et al. (2024), Lancet Commission</Cite>
        <Detail density={density}>All 14 factors together: about 45% of cases. Hearing is tied with high LDL cholesterol. The hearing estimate pools 6 cohorts with measured hearing (HR 1.37, 95% CI 1.00–1.87, I² = 80%, n = 666,370) and a hearing-loss prevalence of 59%. Measured and self-reported hearing give fractions that differ several-fold (Livingston et al., 2024).</Detail>
      </ArtSplit>
    ),
  },

  // 5 — The associations, and they compound
  {
    label: 'Losses compound',
    by: 370,
    note: '“The associations are robust. Hearing loss carries about 37% higher dementia risk; vision loss about 47%. Two impaired senses are worse than one, and four meta-analyses agree on that. And it isn’t only dementia: hearing loss raises the odds of depression by about half, across 35 studies.” Keep moving; the point is the next slide. If asked about direction: vision and depression predict each other both ways (Frank 2019).',
    render: (density) => (
      <Frame wide kicker="Lever 1 · the input">
        <H2>The risks are robust, and they add up</H2>
        <div style={K.stats}>
          <Stat big="+37%" label="dementia risk with hearing loss" color={STORY} />
          <Stat big="+47%" label="dementia risk with vision loss" color={STORY} />
          <Stat big="Both" label="worse than either alone" color={STORY} />
        </div>
        <Lead>Hearing loss also raises the odds of depression by about half.</Lead>
        <Detail density={density}>Hearing: HR 1.37, 6 cohorts, n = 666,370. Vision: RR 1.47, 14 cohorts, 6.2 million people. Both: HR 1.46–1.63 across four meta-analyses. Depression: OR 1.47, 35 studies, N = 147,148. Vision loss and depression predict each other in both directions (HR 1.33 and 1.37; Frank et al., 2019, n = 7,584). All observational: confounding and reverse causation remain possible.</Detail>
        <Cite>Livingston 2024 · Shang 2021 · Yoshida 2025 · Lawrence 2020</Cite>
      </Frame>
    ),
  },

  // 6 — The popular chain, and its weak middle link
  {
    label: 'The chain’s weak link',
    by: 460,
    note: '“The story we usually tell is a chain. You lose hearing, so conversation gets hard; you withdraw; you get lonely; loneliness drives depression and decline. It’s intuitive, and loneliness is real. But when people test the middle link formally, with mediation, isolation and loneliness carry about 2 to 6% of the association. In the Canadian Longitudinal Study on Aging, 30,000 people, the social mediators were weak and mostly non-significant.” Land it: “So most of what links sensory loss to decline goes some other way. One candidate is effortful listening and the cognitive load it brings; another is that the brain is simply getting less to work with. And that brings us to correction.”',
    render: (density) => (
      <Frame wide kicker="Lever 1 · the input">
        <H2>Isolation is part of the story, but a small part</H2>
        <Chain />
        <Lead>Where it has been tested, isolation and loneliness carry about 2–6% of the link between sensory loss and decline.</Lead>
        <Detail density={density}>All of Us (US): loneliness carries about 2% of the hearing–dementia association. CLSA (N = 30,029, cross-sectional): social factors were “weak and mostly non-significant” mediators. Reduced social engagement carries 2–6% of the dual sensory loss–depression link. Measurement error makes these a floor, not a ceiling.</Detail>
        <Cite>All of Us · CLSA · Ni et al. 2026</Cite>
      </Frame>
    ),
  },

  // 7 — Correcting the input
  {
    label: 'Correcting the input',
    by: 560,
    note: '“If the input matters, fixing it should help. The best test is ACHIEVE, a randomized trial of hearing intervention in 977 older adults. Over three years, the primary cognitive outcome was null. In one subgroup at higher risk, decline was 48% slower; that’s worth following but it’s a subgroup. What hearing intervention did do was widen people’s social networks, by about one person.” Then cataract: “Cataract surgery is associated with about 29% lower dementia risk, and here’s what makes that interesting: glaucoma surgery, which doesn’t restore vision, shows no association. It’s still observational.” The message for this room: “Correction reconnects people. Whether it protects cognition is still being tested. That’s reason enough to screen, fit and operate.”',
    render: (density) => (
      <ArtSplit name="s07-reconnect" alt="A grandfather wearing a hearing aid leans in, laughing with his granddaughter" kicker="Lever 1 · the input">
        <H2>Correcting the senses reconnects people</H2>
        <div style={K.plainItem}><b style={K.plainHead}>Hearing aids</b><span>In a large trial, no memory benefit overall. But people’s social circles grew.</span></div>
        <div style={K.plainItem}><b style={K.plainHead}>Cataract surgery</b><span>Linked to lower dementia risk. Glaucoma surgery, which doesn’t restore sight, isn’t.</span></div>
        <Take>Screen, fit, operate: it gives people back the conversation.</Take>
        <Detail density={density}>ACHIEVE (Lin et al., 2023), n = 977: cognition over 3 years −0.002 SD, null; a higher-risk subgroup (n = 238) declined 48% more slowly, a lead to follow, not a result; social network +1.05 people (Reed et al., 2025). Cataract surgery (Lee et al., 2022), n = 3,038: dementia HR 0.71; glaucoma surgery HR 1.08; observational, no randomized trial yet. Observational hearing-aid data mislead easily: one reanalysis moved from RR 1.43 (aid users at higher risk) to 0.68 once healthcare use was adjusted for (Mur et al., 2025). The widely quoted UK Biobank hearing-aid paper (2023) was retracted.</Detail>
        <Cite>Lin 2023 · Reed 2025 · Lee 2022</Cite>
      </ArtSplit>
    ),
  },

  // 8 — Engagement over acuity
  {
    label: 'Engagement over acuity',
    by: 650,
    note: '“Here is where the two levers meet. Across hearing and smell, how people experience their loss tracks mood more closely than the measured loss does. That could partly be depression colouring the self-report; we should be honest about that. But it points at something beyond the ear and the eye. And aging itself pulls these apart: sharpness falls, but appreciation doesn’t. In one study across the lifespan, gentle touch felt more pleasant with age even as touch sensitivity declined. Older adults also report trusting their body’s signals more.” Bridge: “So the input matters, and so does what we do with it. That’s lever 2.”',
    render: (density) => (
      <ArtSplit name="s08-touch" alt="An older hand trailing its fingertips through tall grass and wildflowers" kicker="Where the levers meet">
        <H2>What we do with the signal matters as much as the signal</H2>
        <div style={K.plainItem}><b style={K.plainHead}>How the loss feels</b><span>How people experience their hearing or smell loss tracks mood better than test scores do.</span></div>
        <div style={K.plainItem}><b style={K.plainHead}>Sharpness falls; appreciation holds</b><span>With age, gentle touch is felt less sharply, yet feels more pleasant.</span></div>
        <Caveat>Low mood also lowers how people rate their senses, and the touch study is small.</Caveat>
        <Detail density={density}>Self-reported smell loss is linked to depression more strongly than measured smell loss, which loses significance after correcting for publication bias except in adults 65+ (Bode et al., 2026, 23 studies). Touch: Sehlstedt et al. (2016), N = 120, ages 13–82, few over 60. Older adults also report more trust in their body’s signals (small sample).</Detail>
        <Cite>Bode 2026 · Sehlstedt 2016</Cite>
      </ArtSplit>
    ),
  },

  // 9 — Lever 2: two ways of knowing yourself
  {
    label: 'Lever 2: sensing and doing',
    by: 740,
    note: '“Lever 2 is attention. In 2007 we scanned people while they attended to themselves in two ways. In one, they judged: what does this word say about me? That’s the narrative mode, which I’ll call doing: using what you know to explain, judge and plan. It stretches across past and future. In the other, they sensed what was happening right now, in the body, with no goal. That’s sensing. The brain treats them as distinct: after training, the two networks came apart.” Important: “Neither mode is the villain. Doing is how we plan a life. The question is whether we can move between them.” Then: “Let’s try it. Phones out again.”',
    render: (density) => (
      <div style={K.artSplit}>
        <Art name="s09-walk" alt="One walk, twice: lost in a blue cloud of thoughts, then taking in the pink breeze, birds and leaves" />
        <div style={{ ...K.col, alignItems: 'flex-start', textAlign: 'left' }}>
          <div style={K.kicker}>Lever 2 · the attention</div>
          <H2>Two ways of knowing yourself</H2>
          <div style={K.rl}><span style={{ ...K.rlTag, color: STORY, borderColor: STORY }}>Doing</span><span>Explaining, judging, planning: the self across time.</span></div>
          <div style={K.rl}><span style={{ ...K.rlTag, color: 'var(--pkd)', borderColor: 'var(--pkd)' }}>Sensing</span><span>Taking in what is here: the self in the present moment.</span></div>
          <Take>Neither is the villain. The skill is moving between them.</Take>
          <Detail density={density}>Farb et al. (2007): 36 people enrolling in MBSR, scanned before (16) or after (20) the course. After training, right insula and ventromedial prefrontal activity no longer moved together (R = 0.61 before, 0.06 after). Different people before and after, so a group comparison.</Detail>
          <Cite>Farb et al. 2007, SCAN · Farb, Anderson & Segal 2012</Cite>
        </div>
      </div>
    ),
  },

  // 10 — Toggle: instructions
  {
    label: 'Toggle: instructions',
    by: 800,
    note: '“On your phone, tap Next. You’ll see two words, Story and Sense. For two minutes we’ll rest attention on the breath. Minds wander; that’s not failure, it’s what minds do. Your only job is to notice. When you notice you’re thinking, about this talk, dinner, anything, tap Story. When you’re back with the breath, tap Sense. You start in Sense. Ready? Press Begin.” Late scanners: the QR still works; they’ll land on the mood circle first, which is fine. Click to the live slide as you say “Begin”.',
    render: (_d, _b, ctx) => (
      <Frame wide kicker="Try it · two minutes">
        <div style={K.titleRow}>
          <div style={{ ...K.col, alignItems: 'flex-start', textAlign: 'left', maxWidth: 620 }}>
            <H2>Toggle</H2>
            <Lead>Rest your attention on the breath. When you notice you’re thinking, tap <b style={{ color: STORY }}>Story</b>. When you’re back with the breath, tap <b style={{ color: 'var(--pkd)' }}>Sense</b>.</Lead>
            <Lead>Drifting isn’t failure. Noticing is the whole job.</Lead>
          </div>
          <LiveQr code={ctx.code} size={180} />
        </div>
      </Frame>
    ),
  },

  // 11 — Toggle, live
  {
    label: 'Toggle (live, 2 min)',
    by: 950,
    note: 'Stay quiet for most of the two minutes. One cue around 0:40: “If you’ve drifted, no problem: notice, tap, come back.” Another near 1:30: “Wherever you are, just notice.” Don’t comment on the bars while people practise; they should be eyes-down or eyes-closed. When most phones show finished, click on.',
    render: (_d, _b, ctx) => (
      <Frame wide kicker="The room, right now">
        <RoomToggleLive code={ctx.code} />
      </Frame>
    ),
  },

  // 12 — Toggle, the room's two minutes
  {
    label: 'Toggle: the room',
    by: 1050,
    note: 'Read the room’s numbers: “Our median stay with the breath before someone noticed a drift was about X seconds. And this many of you came back at least once.” Then the literature, so the room knows it’s normal: “In a meditation study that decoded attention from brain activity, stays with the breath averaged about 11 seconds. In our own work, people held active attention to the body for about 90 seconds out of three minutes, trained or not.” Land it: “The drift is universal. What varies, and what can be trained, is noticing it and coming back.” Note for Q&A: a Story tap marks when a drift was noticed, not when it began, so the stays are an upper bound.',
    render: (density, _b, ctx) => (
      <Frame wide kicker="The room’s two minutes">
        <RoomToggleResults code={ctx.code} />
        <Take>The drift is universal. Noticing it and coming back is the skill.</Take>
        <Detail density={density}>Stays with the breath averaged 10.9 s, and mind-wandering stretches 8.1 s, in 16 people whose attention was decoded from brain activity (Weng et al., 2020). In 22 adults, active attention to the body lasted about 90 s of each 3 minutes, regardless of training (Zuo et al., 2023).</Detail>
      </Frame>
    ),
  },

  // 13 — Sad mood turns the senses down
  {
    label: 'Sad mood turns the senses down',
    by: 1130,
    note: '“Why does this matter for wellbeing? Because mood changes which mode we’re in. In 2010 we showed people sad film clips in the scanner. Everyone felt equally sad. But in people without training, sadness lit up the midline self-referential network, the doing mode, and turned down the body-sensing cortex: the insula and somatosensory cortex. And across all 36 people, the higher their depression scores, the more the insula shut down during sadness.” Plain version: “Sad mood pulls attention out of the senses and into the story.”',
    render: (density) => (
      <Frame wide kicker="Lever 2 · mood and the senses">
        <H2>Sad mood turns the senses down</H2>
        <Art name="s13-dimmed" alt="A garden split in two: one half in vivid colour, the other muted and grey" style={K.artBanner} />
        <Lead>Sad film clips quieted the brain areas that feel the body. The more depressive symptoms people had, the quieter those areas went.</Lead>
        <Detail density={density}>Farb et al. (2010): the same 36 as the 2007 study, 16 waitlist and 20 after MBSR. Both groups felt equally sad; in untrained participants sadness raised midline (self-referential) activity and lowered right insula and somatosensory cortex. Higher depression scores went with more insula shutdown (r = −.47). Trained participants showed less of both the midline increase and the sensory decrease. A community sample, not patients.</Detail>
        <Cite>Farb et al. 2010, Emotion</Cite>
      </Frame>
    ),
  },

  // 14 — Senses online predicts staying well
  {
    label: 'Senses online, staying well',
    by: 1250,
    note: '“Does it matter clinically? We followed 85 people who had recovered from depression, after a trial of two relapse-prevention therapies. We scanned them watching sad clips, then followed them for two years. Split them by how much their somatosensory cortex shut down during sadness. Of the 42 whose senses stayed most online, 2 relapsed. Of the 43 whose senses shut down most, 16 relapsed.” Pause. Then the honest part, said plainly: “That split was chosen in the same data, so it’s an optimistic estimate. It’s one trial cohort, mixed ages, and it hasn’t yet been replicated by another lab. An earlier, smaller study pointed the same way, with visual cortex.”',
    render: (density) => (
      <Frame wide kicker="Lever 2 · staying well">
        <H2>Keeping the senses online during sad mood predicts staying well</H2>
        <RelapseSquares />
        <Caveat>One trial cohort of mixed-age adults, in-sample split, not yet replicated by an independent lab.</Caveat>
        <Detail density={density}>Farb et al. (2022): 85 people in remission, 18 relapsed within two years; the link held after adjusting for past episodes, residual symptoms and medication. Farb et al. (2011): in 16 people in remission, 10 relapsed within 18 months; medial prefrontal reactivity to sadness predicted relapse (r = .68) and visual cortex reactivity predicted staying well (r = −.73), “in need of replication.”</Detail>
        <Cite>Farb et al. 2022, NeuroImage: Clinical · Farb et al. 2011, Biol Psychiatry</Cite>
      </Frame>
    ),
  },

  // 15 — The reframe
  {
    label: 'The reframe',
    by: 1310,
    note: '“So the reframe: feeling sad wasn’t the risk. Everyone gets sad. Turning the senses down while sad was the risk.” Then what we don’t know: “In that trial, neither therapy changed the pattern on average. But in a 2026 analysis of the same people, those whose sensory shutdown did come down with therapy had lower risk. So the open question, and the one for aging, is whether we can train it.”',
    render: (density) => (
      <ArtSplit name="s15-rain" alt="A woman at an open window in light rain, eyes closed, feeling the air" kicker="The reframe">
        <p style={K.big}>Feeling sad wasn’t the risk.<br /><span style={{ color: 'var(--pkd)' }}>Turning the senses down while sad was.</span></p>
        <Lead>Can we learn to keep the senses on? That is the open question.</Lead>
        <Detail density={density}>Farb et al. (2022) found the pattern before and after therapy, unchanged by either. Wu et al. (2026), same people, self-judgement task: somatosensory shutdown was the best overall indicator of relapse, and a reduction in it with therapy predicted lower risk.</Detail>
        <Cite>Farb et al. 2022 · Wu et al. 2026, NeuroImage: Clinical</Cite>
      </ArtSplit>
    ),
  },

  // 16 — What older adults bring
  {
    label: 'What older adults bring',
    by: 1400,
    note: '“Now bring it to aging. Older adults arrive with some advantages. Emotional experience tends to improve with age, and older adults attend more to positive information; Alan will say more about how this shapes memory, so I’ll stay with attention. Two things matter for us. First, the positivity effect depends on attention people can deploy: it helps mood most in older adults with good attentional control. Second, older adults mind-wander less in lab tasks. So attention is not only something aging takes away; it’s a resource older adults use, and one we can support.” Keep it brief; don’t step on Castel.',
    render: (density) => (
      <ArtSplit name="s16-together" alt="Two older friends on a park bench; one points out a bird to the other" kicker="Later life">
        <H2>Older adults use attention well, when they can deploy it</H2>
        <Bullets items={[
          'Day-to-day emotional life tends to improve with age',
          'Older adults look toward the positive, and it lifts mood most when they can steer attention',
          'Their minds wander less in lab tasks',
        ]} />
        <Take>Attention isn’t only what aging takes away. It’s a resource to support.</Take>
        <Detail density={density}>Carstensen et al. (2011), 10 years of experience sampling; Reed, Chan & Mikels (2014), positivity effect across 100 studies, N = 7,129; Isaacowitz & Noh, on gaze and mood repair; Jordão et al. (2019), meta-analysis of age and mind-wandering. Memory and curiosity: see Alan Castel’s talk.</Detail>
        <Cite>Carstensen 2011 · Reed 2014 · Jordão 2019</Cite>
      </ArtSplit>
    ),
  },

  // 17 — Training attention in later life
  {
    label: 'Training in later life',
    by: 1510,
    note: '“Can older adults train it? We ran an adapted mindfulness course for 28 adults aged 60 and over with mild to moderate depressive or anxious symptoms. Depression scores fell from 15 to about 9. What interested us most: people who said the course gave them present-moment awareness, or the ability to step back from thoughts, improved more; people who said it made them feel good improved less. No control group, so that’s a lead, not a result.” Then the field: “Mindfulness for older adults lowers depressive symptoms in symptomatic people and, in a small trial, loneliness. But be honest about cognition: the largest trial, MEDEX, with 585 older adults, found no cognitive benefit.”',
    render: (density) => (
      <Frame wide kicker="Later life · training">
        <H2>Training how older adults attend lifts mood, not memory</H2>
        <div style={K.twoCards}>
          <div style={K.card}>
            <span style={K.cardHead}>Our course for adults 60+</span>
            <Bullets items={[
              'Depressive symptoms fell by about a third',
              'Those who learned to notice the present, or step back from thoughts, improved most',
            ]} />
          </div>
          <div style={K.card}>
            <span style={K.cardHead}>The wider evidence</span>
            <Bullets items={[
              'Mood improves; one small trial also eased loneliness',
              'Memory doesn’t: no cognitive benefit in the largest trial',
            ]} />
          </div>
        </div>
        <Detail density={density}>Farb et al. (2021), Mindfulness: adapted MBSR for 28 adults aged 60+ with mild to moderate depressive or anxious symptoms; depression scores 15.0 → 9.4 (22 analysed); no control group, so a lead. Meta-analyses: lower depressive symptoms in symptomatic older adults. Creswell et al. (2012): MBSR reduced loneliness, ages 55–85, n = 40. Creswell et al. (2012), Brain Behav Immun. Lenze et al. (2022), JAMA (MEDEX: MBSR, exercise or both, no memory or executive benefit at 6 or 18 months).</Detail>
        <Cite>Farb 2021 · Creswell 2012 · Lenze 2022</Cite>
      </Frame>
    ),
  },

  // 18 — Stance, not stimulation
  {
    label: 'Stance, not stimulation',
    by: 1600,
    note: '“What’s the active ingredient? When the comparisons get tight, it looks like how attention is held, not how much stimulation is added. An awe walk beat a plain walk on daily positive emotion, though the plain walkers walked more. In a trial with all adults, training acceptance alongside monitoring reduced loneliness; monitoring alone did not. Meanwhile adding stimulation does less well under rigorous tests: multisensory rooms in dementia care have no good evidence, and music therapy’s effect on depression in dementia shrinks to small in the Cochrane estimate.” Land: “It’s not more input. It’s how we meet it.”',
    render: (density) => (
      <ArtSplit name="s18-awe" alt="An older man on a walk stops to look up at enormous trees" kicker="The active ingredient">
        <H2>It’s how we attend, not how much we take in</H2>
        <div style={K.plainItem}><b style={K.plainHead}>Holds up</b><span>An “awe walk”, noticing what’s around you, beat an ordinary walk for daily positive feeling.</span></div>
        <div style={K.plainItem}><b style={K.plainHead}>Weakens under test</b><span>Adding stimulation in dementia care, like multisensory rooms or music, does little once trials are rigorous.</span></div>
        <Take>Not more input. How we meet it.</Take>
        <Detail density={density}>Sturm et al. (2022), Emotion: awe walks vs plain walks in older adults (small trial; the plain walkers walked more). Acceptance plus monitoring cut loneliness, monitoring alone did not (d = 0.44, n = 153). Lindsay et al. (2019), PNAS, a community sample, not older adults. Snoezelen: Cochrane CD003152. Music: Cochrane 2018, 11 studies. Dance did no better than other active controls (Prudente 2024).</Detail>
        <Cite>Sturm 2022 · Lindsay 2019 · Cochrane</Cite>
      </ArtSplit>
    ),
  },

  // 19 — The hypothesis
  {
    label: 'A hypothesis for aging',
    by: 1690,
    note: '“Here is where I want to be careful, because this is a hypothesis, not a finding. In our relapse-prevention trial, what predicted staying well was decentering, the ability to step back from thoughts. People in the top quarter of growth in decentering had 77% lower relapse risk than the bottom quarter. Our hypothesis is that sensing makes room for stepping back: when you move into the senses, the story loosens its grip. The trials don’t settle it: cognitive therapy, with no sensory practice, protected as well as mindfulness. That’s what we’re testing now.”',
    render: (density) => (
      <Frame wide kicker="What we think is going on">
        <H2>Sensing may make room for stepping back</H2>
        <div style={K.stats}>
          <Stat big="77%" label="lower relapse risk in people who grew most at stepping back from their thoughts" sub="Toronto trial · 166 people" />
        </div>
        <Hypothesis>Moving into the senses loosens the grip of the story, and that is how sensing protects. Cognitive therapy, with no sensory practice, protected as well as MBCT, so this is open.</Hypothesis>
        <Detail density={density}>Practice after the course → decentering (β = .46) → lower relapse (β = −.27); direct path β = .03. Farb et al. (2018): MBCT vs cognitive therapy, relapse 15/75 vs 18/74 (HR 1.16, 0.60–2.25). Segal et al. (2019): post-course practice predicted decentering growth, which predicted lower relapse. Practice was self-reported and not randomized.</Detail>
        <Cite>Farb 2018 · Segal 2019</Cite>
      </Frame>
    ),
  },

  // 20 — Open questions / what we're testing
  {
    label: 'What we’re testing',
    by: 1770,
    note: '“So what would we need to know? Four things. Does the sensory marker replicate outside our lab, and does it hold in people over 60? Every prospective sample so far is ours, and mixed-age. Does chronic sensory loss produce something like that shutdown? Nobody has imaged older adults with and without hearing or vision loss during sad mood. Can practice move it? And we need a way to measure sensing as a skill: we’re developing the Sense Foraging Scale, and a course trial is under way.” Rehab hook: “These are studies that need your clinics as much as our scanners.”',
    render: () => (
      <Frame wide kicker="Open questions">
        <H2>What we need to know next</H2>
        <Bullets items={[
          'Does the sensory marker replicate in another lab, and in adults over 60?',
          'Does chronic hearing or vision loss produce a similar shutdown during sad mood?',
          'Can practice keep the senses online when mood drops?',
          'Can we measure sensing as a skill? (the Sense Foraging Scale, in development)',
        ]} />
        <Take>Studies that need clinics as much as scanners.</Take>
      </Frame>
    ),
  },

  // 21 — Take-home
  {
    label: 'Take-home: two levers',
    by: 1830,
    note: '“Two levers. The input: screen hearing and vision, fit the aids, do the surgery. It gives people back the conversation, whatever it turns out to do for memory. The attention: practise noticing the drift and coming back to the senses, especially when mood drops. You did it twice today: on the circle, and with the breath.”',
    render: () => (
      <Frame wide kicker="Take-home">
        <H2>Two levers on what we notice</H2>
        <Art name="s21-close" alt="An older couple sitting on a dock at dusk, listening to the lake" style={{ ...K.artBanner, maxWidth: 'min(900px, 88vw, 60vh)' }} />
        <div style={K.levers}>
          <div style={{ ...K.lever, borderColor: STORY }}>
            <span style={{ ...K.leverK, background: STORY }}>1</span>
            <span style={K.leverT}>Correct the senses</span>
            <span style={K.leverS}>Screen, fit, operate. It gives people back the conversation.</span>
          </div>
          <div style={{ ...K.lever, borderColor: SENSE }}>
            <span style={{ ...K.leverK, background: SENSE }}>2</span>
            <span style={K.leverT}>Practise using them</span>
            <span style={K.leverS}>Notice the drift and come back, especially when mood drops.</span>
          </div>
        </div>
      </Frame>
    ),
  },

  // 22 — Thanks
  {
    label: 'Thanks',
    by: 1900,
    note: 'Thank the Tanenbaum family and Mrs. Spiro, Jen and the organizers, the lab, and Zindel Segal, with whom much of this work was done. Point to the evidence page for anyone who wants the studies and their limits. Hand off: “Alan is going to take us from what we notice to what we remember.” Then questions; B opens the bonus slides (retraction, Lancet caveats, relapse prevention, Toggle method).',
    render: () => (
      <Frame wide kicker="Thank you">
        <H2>Thank you</H2>
        <Lead>The Tanenbaum family · Jennifer Ryan and the organizers · the RADlab · Zindel Segal and our trial participants</Lead>
        <div style={K.qrBox}>
          <div style={{ background: '#fff', padding: 8 }}><QRCode value="https://senseforaging.com/evidence" size={160} level="M" /></div>
          <p style={K.qrUrl}>senseforaging.com/evidence</p>
          <p style={K.qrHint}>The studies, their numbers and their limits</p>
        </div>
      </Frame>
    ),
  },
]

// ── Bonus slides for Q&A ────────────────────────────────────────────────────

const BONUS = [
  {
    q: 'Hearing aids and dementia: the retracted paper',
    note: 'If someone cites “hearing aids erase the dementia risk” from UK Biobank: that Lancet Public Health paper (2023) was retracted in December 2023 because the aided and unaided groups were swapped. A later reanalysis of the same cohort showed how strong healthy-user and healthcare-use bias is in these data.',
    render: () => (
      <Frame wide kicker="Bonus · hearing aids">
        <H2>The hearing-aid result many people quote was retracted</H2>
        <Bullets items={[
          'UK Biobank, Lancet Public Health 2023: retracted Dec 2023 (aided and unaided groups swapped)',
          'Reanalysis (Mur et al., 2025, n = 59,768): RR 1.43 for aid users, 0.68–0.77 after adjusting for healthcare use',
          'The randomized evidence is ACHIEVE: null overall on cognition',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'How the Lancet fractions are built',
    note: 'The population attributable fraction combines a relative risk and a prevalence and assumes causation. Hearing: pooled HR 1.37 (1.00–1.87, I² = 80%) from 6 cohorts with measured hearing, prevalence set at 59%. The 20 dB threshold inflates prevalence; measured vs self-reported hearing give fractions several-fold apart. The 45% total depends on how the factors are assumed to overlap.',
    render: () => (
      <Frame wide kicker="Bonus · Lancet Commission">
        <H2>Population attributable fractions assume causation</H2>
        <Bullets items={[
          'Hearing: HR 1.37 (95% CI 1.00–1.87), I² = 80%, 6 cohorts, n = 666,370',
          'Prevalence of hearing loss set at 59%; the threshold drives it',
          'Measured vs self-reported hearing: fractions several-fold apart',
          'The 45% total depends on assumed overlap between factors',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'Relapse prevention: does it work at all?',
    note: 'Pooled individual records of 1,720 people in 14 RCTs: psychological relapse prevention lowered 12-month relapse risk by 40% (HR 0.60, 0.48–0.74), clearly only in people with three or more past episodes. MBCT alone: HR 0.69 (0.58–0.82), and age did not moderate it.',
    render: () => (
      <Frame wide kicker="Bonus · relapse prevention">
        <H2>Skills that protect against relapse</H2>
        <div style={K.stats}>
          <Stat big="HR 0.60" label="psychological relapse prevention, 12 months" sub="14 RCTs · 1,720 people" />
          <Stat big="HR 0.69" label="MBCT alone; age not a moderator" sub="Kuyken et al. 2016" />
        </div>
        <Lead>The benefit was clear in people with three or more past episodes.</Lead>
        <Cite>Breedvelt et al. 2024 · Kuyken et al. 2016</Cite>
      </Frame>
    ),
  },
  {
    q: 'Smell loss and mortality',
    note: 'Smell loss is a striking marker: single cohorts give large effects (Pinto 2014, OR 3.37 for 5-year mortality), but pooled estimates are smaller (HR 1.52 across 11 cohorts; 1.20 falling to 1.09 after correcting for publication bias). Treat it as a marker of whole-system aging, not a cause. Olfactory training: 6 small RCTs, fragile.',
    render: () => (
      <Frame wide kicker="Bonus · smell">
        <H2>Smell loss marks whole-system aging</H2>
        <Bullets items={[
          'Mortality: HR 1.52 pooled (11 cohorts); 1.20 → 1.09 after publication-bias correction',
          'Dementia: about twice the risk (single cohort OR 2.13)',
          'Olfactory training: 6 RCTs, N = 302, fragile benefits',
        ]} />
        <Cite>Pang 2022 · Lin 2026 · Adams 2018 · Chen 2025</Cite>
      </Frame>
    ),
  },
  {
    q: 'How the Toggle numbers were computed',
    note: 'Each phone starts in Sense at Begin. A Story tap marks the moment someone noticed they were thinking, not when the drift began, so “time with the breath before a drift” is an upper bound on how long attention actually stayed. Returns count Story → Sense switches. Anonymous: devices are numbered in the order they first tapped; no names, no device ids leave the database, nothing is kept for research.',
    render: () => (
      <Frame wide kicker="Bonus · the Toggle data">
        <H2>What the room’s numbers mean</H2>
        <Bullets items={[
          'Everyone starts in Sense when they press Begin',
          'A Story tap marks when a drift was noticed, not when it began: stays are an upper bound',
          'Returns count Story → Sense switches',
          'Anonymous: devices are numbered, never identified; nothing kept for research',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'Two ways of attending (the diagram)',
    note: 'The conceptual diagram behind slide 9, redrawn from Farb, Anderson & Segal (2012), Figure 1. Doing (the narrative focus) stretches from the remembered past to the imagined future but takes in a thin slice of now; sensing (the present-moment focus) spans the full range of what is here. A diagram, not data.',
    render: () => (
      <Frame wide kicker="Bonus · two ways of attending">
        <H2>Doing spans time; sensing spans the present</H2>
        <TwoModes />
        <Cite>Redrawn from Farb, Anderson & Segal 2012, Can J Psychiatry, Figure 1 · conceptual, not data</Cite>
      </Frame>
    ),
  },
  {
    q: 'Mindfulness and cognition: MEDEX',
    note: 'MEDEX randomized 585 cognitively unimpaired older adults to MBSR, exercise, both, or a health-education control. No benefit on memory or executive function at 6 or 18 months. The mood evidence and the cognition evidence should not be conflated.',
    render: () => (
      <Frame wide kicker="Bonus · MEDEX">
        <H2>No cognitive benefit from MBSR or exercise in older adults</H2>
        <Lead>585 cognitively unimpaired older adults; MBSR, exercise, both, or health education; no memory or executive benefit at 6 or 18 months.</Lead>
        <Cite>Lenze et al. 2022, JAMA</Cite>
      </Frame>
    ),
  },
]

const BONUS_INDEX = {
  note: 'Bonus slides for Q&A. Press a number to jump; Esc returns to the talk.',
  render: (_d, openBonus) => (
    <Frame wide kicker="Bonus slides">
      <div style={K.bonusGrid}>
        {BONUS.map((b, k) => (
          <button key={k} style={K.bonusCard} onClick={e => { e.stopPropagation(); openBonus(k + 1) }}>
            <b style={{ color: 'var(--pkd)', fontFamily: '"Space Mono",monospace' }}>{k + 1}</b>{b.q}
          </button>
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

  titleRow: { display: 'flex', gap: 48, alignItems: 'center', justifyContent: 'center', width: '100%' },
  titleText: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, textAlign: 'left', maxWidth: 640, minWidth: 0, flex: '0 1 640px' },
  title:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px, 6vw, 64px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.05 },
  subtitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(19px, 3vw, 32px)', fontWeight: 400, color: 'var(--pkd)', margin: 0, fontStyle: 'italic' },
  author:   { fontSize: 'clamp(16px, 2.1vw, 21px)', color: 'var(--tx)', margin: 0, fontWeight: 600 },
  affil:    { fontSize: 'clamp(16px, 1.6vw, 18px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, fontFamily: '"Space Mono",monospace' },
  event:    { fontFamily: '"Space Mono",monospace', fontSize: 16, color: 'var(--tx2)', margin: '10px 0 0', letterSpacing: '0.06em' },
  crests:   { display: 'flex', gap: 32, alignItems: 'center', marginBottom: 6 },
  qrBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--bd)', borderRadius: 24, padding: 24 },
  qrUrl: { fontFamily: '"Space Mono",monospace', fontSize: 'clamp(16px, 1.8vw, 20px)', fontWeight: 700, color: 'var(--pkd)', margin: 0 },
  qrHint: { fontSize: 16, color: 'var(--tx2)', margin: 0 },

  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 40, alignItems: 'center', width: 'min(1180px, 95vw)' },
  col:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' },
  h2:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(24px, 3.6vw, 40px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.12 },
  lead: { fontSize: 'clamp(16px, 2vw, 23px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, maxWidth: 860 },
  ul:   { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 860 },
  li:   { fontSize: 'clamp(16px, 1.9vw, 21px)', color: 'var(--tx)', lineHeight: 1.45, position: 'relative', paddingLeft: 24, textAlign: 'left' },
  detail: { fontSize: 'clamp(13px, 1.5vw, 16px)', color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 820, margin: 0, borderTop: '1px solid var(--bd)', paddingTop: 16 },
  cite: { fontFamily: '"Space Mono",monospace', fontSize: 14, color: 'var(--tx2)', margin: 0, letterSpacing: '0.03em' },
  take: { fontFamily: '"DM Serif Display",Georgia,serif', fontStyle: 'italic', fontSize: 'clamp(20px, 2.4vw, 28px)', color: 'var(--pkd)', margin: 0, lineHeight: 1.3 },
  big:  { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(30px, 4.6vw, 52px)', color: 'var(--tx)', margin: 0, lineHeight: 1.2 },

  stats: { display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  stat: { flex: '1 1 260px', maxWidth: 380, background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 },
  statBig: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(32px, 4.6vw, 52px)', lineHeight: 1 },
  statLabel: { fontSize: 'clamp(16px, 1.8vw, 20px)', color: 'var(--tx)', lineHeight: 1.35 },
  statSub: { fontFamily: '"Space Mono",monospace', fontSize: 14, color: 'var(--tx2)' },

  twoCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24, width: '100%' },
  card: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHead: { fontFamily: '"Space Mono",monospace', fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--pkd)' },
  cardBody: { fontSize: 'clamp(16px, 1.9vw, 21px)', color: 'var(--tx)', lineHeight: 1.45 },

  caveat: { display: 'flex', gap: 16, alignItems: 'baseline', textAlign: 'left', border: '1px solid var(--bd)', borderLeft: '4px solid var(--tx3)', borderRadius: 12, padding: '8px 16px', background: '#fff', fontSize: 'clamp(16px, 1.7vw, 19px)', color: 'var(--tx)', lineHeight: 1.4, maxWidth: 900 },
  caveatTag: { flex: '0 0 auto', fontFamily: '"Space Mono",monospace', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)', border: '1px solid var(--tx3)', borderRadius: 24, padding: '2px 8px' },

  rl: { display: 'flex', alignItems: 'baseline', gap: 16, fontSize: 'clamp(17px, 1.9vw, 22px)', lineHeight: 1.4, color: 'var(--tx)' },
  rlTag: { flex: '0 0 auto', width: 104, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', border: '2px solid', borderRadius: 24, padding: '4px 0' },

  levers: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, width: '100%', maxWidth: 1000 },
  lever: { background: '#fff', border: '2px solid', borderRadius: 24, padding: '24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, textAlign: 'left', transition: 'opacity .3s ease' },
  leverK: { color: '#fff', borderRadius: 24, width: 40, height: 40, display: 'grid', placeItems: 'center', fontFamily: '"Space Mono",monospace', fontWeight: 700, fontSize: 20 },
  leverT: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(26px, 3vw, 36px)', color: 'var(--tx)' },
  leverS: { fontSize: 'clamp(16px, 1.8vw, 20px)', color: 'var(--tx2)', lineHeight: 1.4 },

  chain: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', paddingBottom: 48, width: '100%' },
  chainBox: { background: '#fff', border: '2px solid var(--bd)', borderRadius: 12, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 },
  chainT: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.4vw, 28px)', color: 'var(--tx)' },
  chainS: { fontSize: 14, color: 'var(--tx2)' },
  chainArrow: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 120 },
  arrowLine: { display: 'block', width: '100%', background: 'var(--tx3)', borderRadius: 4 },
  arrowLab: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
  chainDirect: { position: 'absolute', left: '12%', right: '12%', bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },

  titleGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.15fr)', gap: 48, alignItems: 'center', width: 'min(1560px, 94vw)' },
  qrRow: { display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '1px solid var(--bd)', borderRadius: 24, padding: 16, marginTop: 8 },
  bigLine: { display: 'flex', alignItems: 'baseline', gap: 16, fontSize: 'clamp(18px, 2vw, 24px)', color: 'var(--tx)', lineHeight: 1.35 },
  bigNum: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1, flex: '0 0 auto', minWidth: '2.2ch' },
  plainItem: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'clamp(17px, 1.9vw, 22px)', color: 'var(--tx)', lineHeight: 1.4, textAlign: 'left' },
  plainHead: { fontFamily: '"Space Mono",monospace', fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pkd)', fontWeight: 400 },
  art: { width: '100%', height: 'auto', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 24, display: 'block' },
  artSplit: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 48, alignItems: 'center', width: 'min(1560px, 94vw)' },
  artBanner: { maxWidth: 'min(1100px, 92vw, 71vh)' },
  bonusGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, width: '100%', maxWidth: 1000 },
  bonusCard: { display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', padding: '16px 24px', textAlign: 'left', fontSize: 'clamp(16px, 1.8vw, 19px)', color: 'var(--tx)' },

  bottom: { position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, cursor: 'default' },
  navArrow: { border: 'none', background: 'none', color: 'var(--tx3)', fontSize: 30, lineHeight: 1, cursor: 'pointer', padding: '0 6px' },
  counter: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },

  noteOverlay: { position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 90vw)', background: 'rgba(28,28,30,0.94)', color: '#fff', borderRadius: 12, padding: '14px 20px', cursor: 'default', zIndex: 6 },
  noteLabel: { fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ff9ec9' },
  noteBody: { fontSize: 14, lineHeight: 1.5, marginTop: 6 },
}

// Bullet markers (pink dot) — injected once.
if (typeof document !== 'undefined' && !document.getElementById('tanenbaum-bullets')) {
  const s = document.createElement('style')
  s.id = 'tanenbaum-bullets'
  s.textContent = `[data-tanenbaum] li::before{content:'';position:absolute;left:4px;top:.62em;width:7px;height:7px;border-radius:50%;background:#f068a4}`
  document.head.appendChild(s)
}
