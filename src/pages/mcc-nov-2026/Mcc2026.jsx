// MCC Summit 2026 · Sun Nov 15, noon–3 pm ET, on Zoom · about 45 minutes with
// Q&A (about 31 min of talk). "Two ways of paying attention: Moving between
// doing and sensing". Shares the program with Michael Yellow Bird and Jeffrey
// Proulx (Indigenous contemplative practice); Dylan Jenkins moderates and opens
// with a song and the land acknowledgement; Jackie Gardner-Nix watches the chat.
// No breakout rooms. Audience: mindfulness practitioners and teachers.
//
// Argument: everyone moves between a doing mode and a sensing mode; mood moves
// us without asking (sad mood turns the senses down, and keeping them on
// predicts staying well); practice protects through the skill of noticing; and
// sensing needs no cushion (sense foraging). It ends on a question for the
// co-presenters rather than a claim about their traditions.
//
// The room takes part on phones or a second tab at radlab.zone/mcc (MccPhone.jsx):
// eight statements at the start (slide 4 counts them, slide 17 shows them beside
// Study 2a; RoomScale.jsx, talk_poll_scale_results(),
// supabase/migrations/20261111_talk_poll_scale.sql) and a two-minute Toggle on
// sounds (slides 10–11, the Tanenbaum RoomToggle, talk_poll_toggle_results()).
// BreathCheck (breathing) and ForageRoom (sounds, light, touch) run on the shared
// screen, answered in the Zoom chat.
//
// Shell copied from /tanenbaum-nov-2026: click / → / Space advance, ← back, P opens
// the presenter window (notes, target times, clock; its keys drive the deck), B
// the bonus index for Q&A (1–9 jump, Esc returns), N / T in-page notes / clock.
// Enter drives the two on-screen exercises. ?poll=mcc-rehearsal points the deck at
// the rehearsal poll. Before the real talk, press "New poll round" (top right,
// before the clock starts).
import { useState, useEffect, useCallback, useRef } from 'react'
import QRCode from 'react-qr-code'
import { supabase } from '../../lib/supabase'
import { RoomToggleLive, RoomToggleResults } from '../tanenbaum-nov-2026/RoomToggle'
import { STORY, SENSE } from '../tanenbaum-nov-2026/toggle'
import { BreathCheck } from '../adobe-aug-2026/exercises'
import { ForageRoom } from '../bpmh-sep-2026/exercises'
import { RoomScaleLive, RoomScaleResults } from './RoomScale'
import { pollCodeFromUrl, ANCHOR, LIVE_POLL, REF_2A } from './scale'

export default function Mcc2026() {
  const [i, setI] = useState(0)
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('mccDensity') || 'minimal' } catch { return 'minimal' }
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
    try { localStorage.setItem('mccDensity', d) } catch { /* ignore */ }
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
      w = window.open('', 'mcc-presenter', 'width=620,height=560')
      if (!w) return
      w.document.title = 'Presenter · MCC 2026'
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
      if (forward && document.body.dataset.exerciseActive) return
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
    <div style={K.stage} data-mcc onClick={() => { if (bonus === null) step(1) }}>
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

// Illustrations reused from the Tanenbaum talk (Midjourney, Norm, Nov 9; prompts
// in that talk's Drive folder, art/PROMPTS.md). All 16:9, in public/tanenbaum-nov-2026/.
const ART = ['s08-touch', 's09-walk', 's13-dimmed', 's18-awe', 's21-close']
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

// The phone page: radlab.zone/mcc for the talk, /mcc/<code> for any other poll.
const phoneUrl = code => (code === LIVE_POLL ? 'radlab.zone/mcc' : `radlab.zone/mcc/${code}`)

function PhoneUrl({ code }) {
  return <p style={K.qrUrl}>{phoneUrl(code)} · also in the Zoom chat</p>
}

// The title slide's QR: beside its address, so the image keeps the right half.
function LiveQrRow({ code }) {
  const url = phoneUrl(code)
  return (
    <div style={K.qrRow}>
      <div style={{ width: 'min(180px, 22vh)' }}>
        <QRCode value={`https://${url}`} size={180} level="M" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        <p style={K.qrUrl}>{url}</p>
        <p style={K.qrHint}>Scan, or use the link in the chat · anonymous · no login</p>
      </div>
    </div>
  )
}

function LiveQr({ code, size = 220 }) {
  const url = phoneUrl(code)
  return (
    <div style={K.qrBox}>
      <div style={{ background: '#fff', padding: 8, width: `min(${size}px, 24vh)` }}>
        <QRCode value={`https://${url}`} size={size} level="M" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
      <p style={K.qrUrl}>{url}</p>
      <p style={K.qrHint}>Scan, or use the link in the chat · anonymous · no login</p>
    </div>
  )
}

// ── Figures ─────────────────────────────────────────────────────────────────

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

// Several vocabularies for one shape of experience. The last row is left to the
// co-presenters on purpose: this talk does not speak for their traditions.
const VOCAB = [
  ['Buddhist psychology', 'papañca: proliferating thought', 'contact and feeling (vedanā), before the story'],
  ['MBCT', 'doing mode', 'being mode'],
  ['Neuroscience', 'narrative self-reference', 'experiential self-reference'],
  ['This talk', 'doing', 'sensing'],
]
function Vocabularies() {
  return (
    <div style={K.vocab}>
      <span style={K.vocabHead} />
      <span style={{ ...K.vocabHead, color: STORY }}>Judging, explaining, planning</span>
      <span style={{ ...K.vocabHead, color: 'var(--pkd)' }}>Receiving what is here</span>
      {VOCAB.map(([who, a, b]) => (
        <div key={who} style={K.vocabRow}>
          <span style={K.vocabWho}>{who}</span>
          <span style={{ ...K.vocabCell, borderColor: `${STORY}66` }}>{a}</span>
          <span style={{ ...K.vocabCell, borderColor: `${SENSE}88` }}>{b}</span>
        </div>
      ))}
      <div style={K.vocabRow}>
        <span style={K.vocabWho}>Indigenous traditions</span>
        <span style={K.vocabOpen}>In their own terms and their own voices: Michael Yellow Bird and Jeffrey Proulx today. Whether experience is even divided this way is their question to answer.</span>
      </div>
    </div>
  )
}

// Too much story, too much sense: the aim is the switch, not a side.
function SweetSpot() {
  const side = (title, items, color) => (
    <div style={{ ...K.card, borderColor: color, borderWidth: 2 }}>
      <span style={{ ...K.cardHead, color }}>{title}</span>
      <Bullets items={items} />
    </div>
  )
  return (
    <div style={K.twoCards}>
      {side('Stuck in the story', ['rumination and worry', 'low mood that shuts the senses down', 'reacting before taking things in'], STORY)}
      {side('Flooded by sensation', ['overwhelm', 'feeling detached or unreal', 'trouble getting back to the task'], 'var(--pkd)')}
    </div>
  )
}

// ── Slides ──────────────────────────────────────────────────────────────────
// `by` = cumulative target time (seconds) at which this slide should be done.
// render(density, openBonus, ctx) — ctx.code is the poll code (live or rehearsal).
// About 31 minutes of talk, leaving about 14 for questions in a 45-minute slot.

const SLIDES = [
  // 1 — Title + QR (up during the introduction)
  {
    label: 'Title + phones out',
    by: 60,
    note: 'Up while Dylan or Jackie introduces you. Ask Jackie beforehand to paste “radlab.zone/mcc” in the Zoom chat as you start. Thank Dylan for the opening and the song, Jackie and the Council for the invitation, and Michael and Jeffrey. First words after that: “I’m going to ask you to do a few things with me today, and the first is on your phone or a second browser tab. Scan this, or click the link Jackie just put in the chat. It’s anonymous: no name, no login.” Don’t start the questionnaire yet; the next slide explains it.',
    render: (_d, _b, ctx) => (
      <div style={K.titleGrid}>
        <div style={K.titleText}>
          <div style={K.crests}>
            <img src="/RADlab_Logo.svg" alt="RADlab" style={{ height: 44 }} />
            <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 44 }} />
          </div>
          <h1 style={K.title}>Two ways of paying attention</h1>
          <p style={K.subtitle}>Moving between doing and sensing</p>
          <p style={K.author}>Norman Farb</p>
          <p style={K.affil}>Psychological and Brain Sciences · University of Toronto Mississauga</p>
          <p style={K.event}>MCC Summit · November 15, 2026</p>
        </div>
        <div style={K.titleRight}>
          <Art name="s09-walk" alt="One walk, twice: lost in a blue cloud of thoughts, then taking in the pink breeze, birds and leaves" style={{ maxWidth: '96vh' }} />
          <LiveQrRow code={ctx.code} />
        </div>
      </div>
    ),
  },

  // 2 — Where I'm speaking from
  {
    label: 'Where I’m speaking from',
    by: 120,
    note: 'About 30 seconds, even pace. Dylan has opened with the land acknowledgement, so this is not a second one; it is where you stand. Read the three lines, then: “Michael and Jeffrey will speak from traditions that are theirs. What I can offer is one lens, from psychology and neuroscience, on a capacity I think every person has. I’m here to listen as much as to share.”',
    render: () => (
      <Frame kicker="Situated context">
        <H2>Where I’m speaking from</H2>
        <Bullets items={[
          'I live in Toronto and work in Toronto and Mississauga, on the traditional land of the Huron-Wendat, the Seneca, and the Mississaugas of the Credit.',
          'I grew up in Toronto. My grandparents came from Poland and Russia, survivors of the Holocaust and of the pogroms.',
          'Trained in psychology and neuroscience, I study how people move between thinking and sensing, informed by contemplative practice.',
        ]} />
        <Take>One lens among several. I’m here to listen as much as to share.</Take>
      </Frame>
    ),
  },

  // 3 — The two modes, defined, + the questionnaire
  {
    label: 'Two modes + questionnaire',
    by: 190,
    note: '“Here’s the distinction the whole talk turns on, in the words we use in our studies.” Read the two definitions. “Your phone shows the same thing, then eight short statements about how you pay attention in general. About a minute. There are no right or wrong answers, and you can skip any statement.” Then: “This is a scale we are still developing; you’ll see the room’s answers later, beside 500 adults from our last study.” Click on while they start.',
    render: (_d, _b, ctx) => (
      <Frame wide kicker="Two ways of paying attention">
        <div style={K.titleRow}>
          <div style={{ ...K.col, alignItems: 'flex-start', textAlign: 'left', maxWidth: 680 }}>
            <div style={K.rl}><span style={{ ...K.rlTag, color: STORY, borderColor: STORY }}>Doing</span><span>We look or listen to accomplish something, using what we already know: finding our keys, checking out a body ache or a strange sound outside.</span></div>
            <div style={K.rl}><span style={{ ...K.rlTag, color: 'var(--pkd)', borderColor: 'var(--pkd)' }}>Sensing</span><span>We look, listen, smell, taste or feel just out of curiosity, taking in whatever is there.</span></div>
            <Take>Everyone does both. Neither is better.</Take>
            <Lead>On your phone: eight short statements, about a minute.</Lead>
          </div>
          <LiveQr code={ctx.code} size={200} />
        </div>
      </Frame>
    ),
  },

  // 4 — Answers arriving
  {
    label: 'Questionnaire (live count)',
    by: 280,
    note: 'Give it about 90 seconds. Fill the silence lightly: “Take your time. Answer for how you are in general, not today.” Read the count when it settles. For anyone without a phone: “Watching is fine; there’s plenty more to do with me.” When most have sent: “Thank you. Keep that page open; we’ll use it again in about ten minutes.”',
    render: (_d, _b, ctx) => (
      <Frame wide kicker="On your phones">
        <H2>How you pay attention</H2>
        <RoomScaleLive code={ctx.code} />
        <PhoneUrl code={ctx.code} />
      </Frame>
    ),
  },

  // 5 — BreathCheck (breathing)
  {
    label: 'BreathCheck (breathing)',
    by: 400,
    note: 'Zoom: share computer sound is not needed; it is visual. “Breathe with the circle for four breaths. Afterwards I’ll ask whether the pace sped up, slowed down or stayed the same.” Enter begins. When it asks: “In the chat: F for faster, S for slower, = for the same.” Read the split aloud, then Enter to reveal. The debrief is the point: “How did you decide? Some of you counted, or reasoned about it. Some of you just felt it in the breath. Those are the two modes, in forty seconds.” Space moves on once it is done.',
    render: () => (
      <Frame wide>
        <BreathCheck />
      </Frame>
    ),
  },

  // 6 — Two ways of knowing yourself
  {
    label: 'Two ways of knowing yourself',
    by: 490,
    note: '“In 2007 we scanned people while they attended to themselves in two ways. In one, they judged: what does this word say about me? That’s the narrative mode, doing: using what you know to explain, judge and plan. It stretches across past and future. In the other, they simply sensed what was happening right now, in the body, with no goal. The brain treats them as distinct: after mindfulness training, the two networks came apart.” Then the line for this audience: “Neither mode is the villain. Doing is how we plan a life and care for people. The skill is moving between them.”',
    render: (density) => (
      <div style={K.artSplit}>
        <Art name="s18-awe" alt="An older man on a walk stops to look up at enormous trees" />
        <div style={{ ...K.col, alignItems: 'flex-start', textAlign: 'left' }}>
          <div style={K.kicker}>What the brain does</div>
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

  // 7 — Doing spans time; sensing spans the present
  {
    label: 'Doing spans time',
    by: 550,
    note: '“A picture of the difference. Doing is a thin band that stretches from the remembered past to the imagined future: it’s how we connect today to yesterday and tomorrow. Sensing is narrow in time but wide in what it takes in: everything that is here, now.” Keep it brief.',
    render: () => (
      <Frame wide kicker="Two ways of attending">
        <H2>Doing spans time; sensing spans the present</H2>
        <TwoModes />
        <Cite>Redrawn from Farb, Anderson & Segal 2012, Can J Psychiatry, Figure 1 · conceptual, not data</Cite>
      </Frame>
    ),
  },

  // 8 — Many vocabularies
  {
    label: 'Many vocabularies',
    by: 640,
    note: '“This isn’t a new idea. Buddhist psychology describes contact and feeling, and then papañca, the proliferation of thought that builds a story on top. MBCT calls them doing and being. My field calls them narrative and experiential. I suspect every tradition has noticed this capacity, and each frames it differently.” Pause on the last row: “And I won’t speak for Indigenous traditions; Michael and Jeffrey will, in their own terms. One thing I’m curious about, and will come back to: whether experience is even divided this way at all.”',
    render: () => (
      <Frame wide kicker="An old distinction">
        <H2>Many vocabularies, one capacity?</H2>
        <Vocabularies />
      </Frame>
    ),
  },

  // 9 — Toggle: instructions
  {
    label: 'Toggle: instructions',
    by: 700,
    note: '“Back to your phones. Tap Next. You’ll see two words, Story and Sense. For two minutes, rest your attention on the sounds around you, near and far: the room, the street, your own computer’s hum. No breath to watch, no posture to hold. Minds wander; that’s not failure. Your only job is to notice. When you notice you’re thinking, tap Story. When you’re back with the sounds, tap Sense. You start in Sense. Ready? Press Begin.” If they joined late, the phone has a “skip to the listening practice” link. Click to the live slide as you say Begin.',
    render: (_d, _b, ctx) => (
      <Frame wide kicker="Try it · two minutes">
        <div style={K.titleRow}>
          <div style={{ ...K.col, alignItems: 'flex-start', textAlign: 'left', maxWidth: 620 }}>
            <H2>Toggle</H2>
            <Lead>Rest your attention on the sounds around you. When you notice you’re thinking, tap <b style={{ color: STORY }}>Story</b>. When you’re back with the sounds, tap <b style={{ color: 'var(--pkd)' }}>Sense</b>.</Lead>
            <Lead>Drifting isn’t failure. Noticing is the whole job.</Lead>
          </div>
          <LiveQr code={ctx.code} size={180} />
        </div>
      </Frame>
    ),
  },

  // 10 — Toggle, live
  {
    label: 'Toggle (live, 2 min)',
    by: 840,
    note: 'Stay quiet for most of the two minutes; mute yourself if your room is noisy. One cue around 0:40: “If you’ve drifted, no problem: notice, tap, come back to the sounds.” Another near 1:30: “Wherever you are, just notice.” Don’t comment on the bars while people practise. When most have finished, click on.',
    render: (_d, _b, ctx) => (
      <Frame wide kicker="The room, right now">
        <RoomToggleLive code={ctx.code} anchor={ANCHOR} />
      </Frame>
    ),
  },

  // 11 — Toggle, the room's two minutes
  {
    label: 'Toggle: the room',
    by: 930,
    note: 'Read the room’s numbers: “Our median stay with the sounds before someone noticed a drift was about X seconds. And this many of you came back at least once.” Then the literature, so the room knows it’s normal: “In a meditation study that decoded attention from brain activity, stays with the breath averaged about 11 seconds. In our own work, people held active attention to the body for about 90 seconds of three minutes, trained or not.” Land it: “The drift is universal. What varies, and what can be trained, is noticing it and coming back.” For Q&A: a Story tap marks when a drift was noticed, not when it began, so the stays are an upper bound.',
    render: (density, _b, ctx) => (
      <Frame wide kicker="The room’s two minutes">
        <RoomToggleResults code={ctx.code} anchor={ANCHOR} />
        <Take>The drift is universal. Noticing it and coming back is the skill.</Take>
        <Detail density={density}>Stays with the breath averaged 10.9 s, and mind-wandering stretches 8.1 s, in 16 people whose attention was decoded from brain activity (Weng et al., 2020). In 22 adults, active attention to the body lasted about 90 s of each 3 minutes, regardless of training (Zuo et al., 2023).</Detail>
      </Frame>
    ),
  },

  // 12 — Sad mood turns the senses down
  {
    label: 'Sad mood turns the senses down',
    by: 1010,
    note: 'Story, not data: “Why does this matter? Because mood moves us between modes, without asking. In 2010 we showed people sad film clips in the scanner. Everyone felt equally sad. But in people without training, sadness lit up the story network and turned down the areas that feel the body. And the more depressive symptoms people had, the more those areas went quiet.” Plain version: “Sad mood pulls attention out of the senses and into the story.”',
    render: (density) => (
      <Frame wide kicker="Why it matters">
        <H2>Sad mood turns the senses down</H2>
        <Art name="s13-dimmed" alt="A garden split in two: one half in vivid colour, the other muted and grey" style={K.artBanner} />
        <Lead>Sad film clips quieted the brain areas that feel the body. The more depressive symptoms people had, the quieter those areas went.</Lead>
        <Detail density={density}>Farb et al. (2010): the same 36 as the 2007 study, 16 waitlist and 20 after MBSR. Both groups felt equally sad; in untrained participants sadness raised midline (self-referential) activity and lowered right insula and somatosensory cortex. Higher depression scores went with more insula shutdown (r = −.47). Trained participants showed less of both. A community sample, not patients.</Detail>
        <Cite>Farb et al. 2010, Emotion</Cite>
      </Frame>
    ),
  },

  // 13 — Senses online predicts staying well
  {
    label: 'Senses online, staying well',
    by: 1100,
    note: '“Does it matter clinically? We followed 85 people who had recovered from depression. We scanned them watching sad clips, then followed them for two years. Of the 42 whose senses stayed most online during sadness, 2 relapsed. Of the 43 whose senses shut down most, 16 relapsed.” Pause. Then, plainly: “That split was chosen in the same data, so it’s optimistic, and it hasn’t yet been replicated by another lab.” Then the reframe: “Feeling sad wasn’t the risk. Turning the senses down while sad was.”',
    render: (density) => (
      <Frame wide kicker="Why it matters">
        <H2>Keeping the senses online during sad mood predicts staying well</H2>
        <RelapseSquares />
        <Take>Feeling sad wasn’t the risk. Turning the senses down while sad was.</Take>
        <Caveat>One trial cohort, an in-sample split, not yet replicated by an independent lab.</Caveat>
        <Detail density={density}>Farb et al. (2022): 85 people in remission, 18 relapsed within two years; the link held after adjusting for past episodes, residual symptoms and medication. Wu et al. (2026), same people: a reduction in somatosensory shutdown with therapy predicted lower risk.</Detail>
        <Cite>Farb et al. 2022, NeuroImage: Clinical · Wu et al. 2026</Cite>
      </Frame>
    ),
  },

  // 14 — Practice works through the skill
  {
    label: 'Practice works through the skill',
    by: 1180,
    note: 'For teachers in the room: “In our relapse-prevention trial, what mattered was practice after the course ended. Practice grew decentering, the ability to see a thought as a thought, and decentering predicted staying well. Practice didn’t protect directly; it protected through the skill.” Then the humbling part: “Cognitive therapy, with no sensory practice at all, protected about as well. So there may be several doors to the same skill.” [Norm: the decks disagree on these path numbers and Ns (BPMH/Adobe .31/.42/−.22, Tanenbaum .46/−.27, N 156 vs 166). Check Segal et al. 2019 before Sunday; the slide face carries no numbers.]',
    render: (density) => (
      <Frame wide kicker="For teachers">
        <H2>Practice protects through the skill it builds</H2>
        <div style={K.path}>
          <span style={K.pathBox}>Practice after the course</span>
          <span style={K.pathArrow}>→</span>
          <span style={{ ...K.pathBox, borderColor: 'var(--pk)' }}>Decentering: seeing a thought as a thought</span>
          <span style={K.pathArrow}>→</span>
          <span style={K.pathBox}>Staying well</span>
        </div>
        <Lead>Every Story tap you made was a small act of decentering.</Lead>
        <Caveat>Cognitive therapy, with no sensory practice, protected about as well. Practice was self-reported, not randomized.</Caveat>
        <Detail density={density}>Segal et al. (2019): MBCT vs cognitive therapy in people recovered from depression; post-course practice predicted growth in decentering, which predicted lower relapse; the direct path from practice to relapse was near zero. Farb et al. (2018): relapse did not differ between the two therapies.</Detail>
        <Cite>Segal et al. 2019 · Farb et al. 2018</Cite>
      </Frame>
    ),
  },

  // 15 — Sense foraging
  {
    label: 'Sense foraging',
    by: 1260,
    note: 'Your own idea, so say it simply: “Most of what I’ve shown you came from people sitting with their eyes closed. But sensing doesn’t need a cushion, a posture or the breath. It needs curiosity. Sense foraging is shifting from thinking to sensing on purpose, open to whatever is there, willing to be surprised. Three steps, anywhere: check in, forage, check back.” Then the Council’s own concern: “It isn’t about stopping judgement. It’s about having somewhere to go.”',
    render: (density) => (
      <ArtSplit name="s08-touch" alt="An older hand trailing its fingertips through tall grass and wildflowers" kicker="No cushion required">
        <H2>Sense foraging</H2>
        <Lead>Shifting on purpose from thinking to sensing, open to the sensory world and willing to be surprised.</Lead>
        <div style={K.steps}>
          {[['1', 'Check in', 'One word for how you are.'], ['2', 'Forage', 'Sounds, light, touch, temperature: whatever is there.'], ['3', 'Check back', 'One word again. Did it change?']].map(([n, t, s]) => (
            <div key={n} style={K.step}><b style={K.stepN}>{n}</b><span style={K.stepT}>{t}</span><span style={K.stepS}>{s}</span></div>
          ))}
        </div>
        <Take>Not to relax. To notice.</Take>
        <Detail density={density}>The aim is a movement toward the senses rather than an effort to stop judging. It works with eyes open, in motion, in the middle of ordinary tasks.</Detail>
      </ArtSplit>
    ),
  },

  // 16 — ForageRoom (vision, sound, touch)
  {
    label: 'Forage together (1 min)',
    by: 1390,
    note: 'Enter steps through it. Check in: “One word for how you are right now; keep it to yourself.” Enter starts a minute of rotating prompts (sounds, the seat, the brightest light, the air on your hands); a tone opens and closes it. Say nothing during the minute. Check back: “One word again.” Then: “In the chat: did your word change? Yes, a little, or no.” Read a few aloud. “Either answer is information. The second look is where change gets registered.” Space moves on.',
    render: () => (
      <Frame wide>
        <ForageRoom />
      </Frame>
    ),
  },

  // 17 — The room's questionnaire answers
  {
    label: 'The room’s answers',
    by: 1510,
    note: '“Remember the eight statements? Here’s the room, beside 500 adults from our last online study.” Read the left panel: “Most of you sit toward sensing, which is what we’d expect from people who practise; in that study, people who practise scored about two-thirds of a standard deviation higher.” Then the right panel, the highlighted row: “The one this room found hardest was…” If it is “never the right time” or “a struggle”: “Even for practitioners, the barrier isn’t knowing how. It’s that sensing doesn’t feel like it has a place in the day.” Caveat, briefly: “The scale is still being validated, and this is a demonstration, not data we keep.”',
    render: (density, _b, ctx) => (
      <Frame wide kicker="The room, beside 500 adults">
        <H2>How this room pays attention</H2>
        <RoomScaleResults code={ctx.code} />
        <Detail density={density}>The 8-statement Sense Foraging Scale chosen after Study 2a (N = 500 online adults, osf.io/vt7gn): mean {REF_2A.mean.toFixed(2)} (SD {REF_2A.sd.toFixed(2)}); people who practise scored higher than people who never have (d = {REF_2A.dPractice.toFixed(2)}). Chosen on 2a’s data, so Study 2b is the test. Three statements are reversed and flipped for the averages.</Detail>
      </Frame>
    ),
  },

  // 18 — Balance and cautions for teachers
  {
    label: 'Balance and cautions',
    by: 1600,
    note: '“Sensing isn’t always the answer. Too much story and we ruminate; too much sensation and some people feel flooded or detached, especially with a trauma history. For teaching, that means a few simple habits.” Read the four. “The goal isn’t to live in either mode. It’s the switch.”',
    render: (density) => (
      <Frame wide kicker="For teachers">
        <H2>Not one mode. The ability to switch.</H2>
        <SweetSpot />
        <div style={K.tips}>
          {['Outside anchors first: sounds and sights before the body', 'Eyes open is fine', 'Short doses', 'Stopping is always allowed'].map(t => <span key={t} style={K.tip}>{t}</span>)}
        </div>
        <Detail density={density}>Lindahl et al. (2017, PLOS ONE) documented a wide range of challenging meditation experiences in Western Buddhist practitioners, including anxiety, re-experiencing of trauma and feelings of unreality. External anchors and short, optional practice are common ways to lighten the load for people who find inward attention hard.</Detail>
        <Cite>Lindahl et al. 2017</Cite>
      </Frame>
    ),
  },

  // 19 — A question for this program
  {
    label: 'A question for this program',
    by: 1690,
    note: 'Slow down here. “I want to end with a question rather than an answer, because I’m sharing this program with people who know much more than I do about other ways of knowing. My field tends to treat doing and sensing as opposites. But in many practices, beading, harvesting, song, careful work on the land, open sensory attention seems to be the way the doing is done well. So I’m curious whether the split I’ve drawn is a Western habit, and whether the skill is less about switching away from doing and more about doing with the senses open.” Hand it on: “That’s a question I’d love to hear Michael and Jeffrey take up.” Do not summarize their work for them. Bonus 1 has the research literature if someone asks.',
    render: () => (
      <ArtSplit name="s21-close" alt="An older couple sitting on a dock at dusk, listening to the lake" kicker="A question, not an answer">
        <H2>Is sensing a different mode from doing, or the way doing is done well?</H2>
        <Lead>In crafts, song and work on the land, open attention to the senses can be part of the doing itself.</Lead>
        <Take>One lens among several. I’d like to hear yours.</Take>
      </ArtSplit>
    ),
  },

  // 20 — Take-home + thanks
  {
    label: 'Take-home + thanks',
    by: 1860,
    note: '“Three things to take with you. Everyone has both modes. Mood moves us between them without asking, and keeping the senses on when mood drops seems to matter. And the practice is the noticing: you did it three ways today, with the breath, the sounds and the room around you.” Thank the Council, Jackie, Dylan, Michael and Jeffrey, the lab and Zindel Segal. Then questions: Jackie has the chat. B opens the bonus slides.',
    render: () => (
      <Frame wide kicker="Take-home">
        <H2>Two ways of paying attention</H2>
        <div style={K.levers3}>
          {[['1', 'Everyone has both', 'Doing and sensing are capacities, not personalities.', STORY],
            ['2', 'Mood moves us', 'Keeping the senses on when mood drops seems to protect.', 'var(--pkd)'],
            ['3', 'Noticing is the practice', 'Breath, sounds, the room: any door will do.', SENSE]].map(([k, t, s, c]) => (
            <div key={k} style={{ ...K.lever, padding: '16px 24px', borderColor: c }}>
              <span style={{ ...K.leverK, background: c }}>{k}</span>
              <span style={K.leverT}>{t}</span>
              <span style={K.leverS}>{s}</span>
            </div>
          ))}
        </div>
        <div style={K.thanksRow}>
          <Lead>Thank you · the Council and Jackie Gardner-Nix · Dylan Jenkins · Michael Yellow Bird and Jeffrey Proulx · the RADlab · Zindel Segal</Lead>
          <div style={K.qrRow}>
            <div style={{ width: 'min(96px, 12vh)' }}><QRCode value="https://senseforaging.com/evidence" size={96} level="M" style={{ width: '100%', height: 'auto', display: 'block' }} /></div>
            <p style={K.qrUrl}>senseforaging.com/evidence</p>
          </div>
        </div>
      </Frame>
    ),
  },
]

// ── Bonus slides for Q&A ────────────────────────────────────────────────────

const BONUS = [
  {
    q: 'Indigenous parallels in the research literature',
    note: 'Only if asked, and defer first: “Michael and Jeffrey are the right people for this.” The safest empirical bridge is Rogoff: children from Indigenous-heritage communities in Mexico and Guatemala more often attend to several events at once, and learn by keen observation while taking part; it tracks schooling history too, so it is a cultural practice, not a trait. Dadirri (Miriam-Rose Ungunmerr-Baumann, Ngan’gikurunggurr, northern Australia): deep listening and quiet, still awareness; relational, not a technique, and not a Canadian tradition. Two-Eyed Seeing (Elder Albert Marshall): knowledge systems side by side, each whole; never map Indigenous = sensing, Western = doing. Land-based programs in Canada: qualitative reports of calm and settings free of distraction and judgement, but the benefits people name are identity and belonging. Evidence for culturally adapted mindfulness with First Nations peoples is thin (9 studies, 125 people), and nothing yet links these practices to interoception. Michael co-authored the IndigenousMIND study with Jeffrey; leave it to them.',
    render: () => (
      <Frame wide kicker="Bonus · other ways of knowing">
        <H2>Parallels, with care</H2>
        <Bullets items={[
          'Keen attention to several things at once, learning by observing and pitching in (Rogoff et al., 2003; Correa-Chávez et al., 2005)',
          'Dadirri: deep listening and quiet, still awareness (Ungunmerr-Baumann; Morris et al., 2022)',
          'Two-Eyed Seeing: knowledge systems side by side, each whole (Bartlett, Marshall & Marshall, 2012)',
          'Land-based healing in Canada: calm, belonging, identity (Hatala et al., 2019; Ollier et al., 2022), qualitative',
          'Adapted mindfulness with First Nations peoples: 9 studies, 125 people (Li et al., 2024)',
        ]} />
        <Caveat>These are relational and communal practices, not attention training. They belong to particular Peoples, and they are not mine to explain.</Caveat>
      </Frame>
    ),
  },
  {
    q: 'The questionnaire: what it is',
    note: 'The 8 statements are the Sense Foraging Scale as chosen after Study 2a (N = 500 online adults, preregistered at osf.io/vt7gn): one broad sensing factor, three reversed statements, two of which name the sensing mode, which is why the phone defined the modes first. Mean 4.10 (SD 0.78), alpha .80, practitioners vs never d = .67. Chosen on 2a’s data, so Study 2b (new adults, a behavioural pause and new validity measures) is the test. The room’s answers are a demonstration: anonymous, not consented research data, not exported.',
    render: () => (
      <Frame wide kicker="Bonus · the questionnaire">
        <H2>The Sense Foraging Scale, in development</H2>
        <Bullets items={[
          'Eight statements chosen from 58 after Study 2a (N = 500): one broad sensing factor',
          `Study 2a: mean ${REF_2A.mean.toFixed(2)} (SD ${REF_2A.sd.toFixed(2)}); people who practise score higher (d = ${REF_2A.dPractice.toFixed(2)})`,
          'Chosen on 2a’s data, so the next study is the real test',
          'Today’s answers: anonymous, a demonstration, not kept for research',
        ]} />
      </Frame>
    ),
  },
  {
    q: 'How the Toggle numbers were computed',
    note: 'Each phone starts in Sense at Begin. A Story tap marks the moment someone noticed they were thinking, not when the drift began, so “time with the sounds before a drift” is an upper bound on how long attention actually stayed. Returns count Story → Sense switches. Anonymous: devices are numbered in the order they first tapped; no names, no device ids leave the database, nothing is kept for research.',
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
    q: 'Is clinical mindfulness still Buddhist?',
    note: 'A likely question in this room. Secular programs kept attention training and dropped much of the ethical and communal frame; critics argue that frame matters (Bhikkhu Bodhi 2011, on what mindfulness means in the canon; Purser 2019, a popular book). A fair reply from the data: the protective ingredient in our trials looks like a skill (decentering) built by practice, but the trials could not test what the ethical frame adds. Communities adapting the practice, as Jeffrey and Michael have, are where that gets answered.',
    render: () => (
      <Frame wide kicker="Bonus · roots">
        <H2>What did secular mindfulness keep, and leave behind?</H2>
        <Bullets items={[
          'Kept: training attention, and stepping back from thought',
          'Often left behind: the ethical, communal and relational frame',
          'Our trials can show the skill matters; they can’t show what the frame adds',
        ]} />
        <Cite>Bodhi 2011, Contemporary Buddhism · Purser 2019</Cite>
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
  bigQrWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  bigQrBox: { background: '#fff', padding: 'min(32px, 3vh)', borderRadius: 12, width: 'min(74vh, 86vw)' },
  bigQrUrl: { fontFamily: '"Space Mono",monospace', fontSize: 'clamp(20px, 3vw, 36px)', fontWeight: 700, color: 'var(--pkd)', margin: 0 },
  titleRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 },
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

  vocab: { display: 'grid', gridTemplateColumns: 'minmax(160px, 0.6fr) 1fr 1fr', gap: 8, width: '100%', maxWidth: 1100, textAlign: 'left' },
  vocabHead: { fontFamily: '"Space Mono",monospace', fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 16px' },
  vocabRow: { display: 'contents' },
  vocabWho: { fontFamily: '"Space Mono",monospace', fontSize: 14, color: 'var(--tx2)', alignSelf: 'center' },
  vocabCell: { background: '#fff', border: '2px solid', borderRadius: 12, padding: '8px 16px', fontSize: 'clamp(16px, 1.7vw, 20px)', color: 'var(--tx)', lineHeight: 1.35 },
  vocabOpen: { gridColumn: '2 / span 2', border: '2px dashed var(--tx3)', borderRadius: 12, padding: '8px 16px', fontSize: 'clamp(16px, 1.7vw, 20px)', color: 'var(--tx2)', lineHeight: 1.4, fontStyle: 'italic' },
  path: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', width: '100%' },
  pathBox: { background: '#fff', border: '2px solid var(--bd)', borderRadius: 12, padding: '16px 24px', fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.2vw, 26px)', color: 'var(--tx)', maxWidth: 360 },
  pathArrow: { fontSize: 32, color: 'var(--tx3)' },
  steps: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  step: { display: 'grid', gridTemplateColumns: '40px 140px 1fr', alignItems: 'baseline', gap: 8, fontSize: 'clamp(16px, 1.8vw, 20px)', color: 'var(--tx)' },
  stepN: { fontFamily: '"Space Mono",monospace', color: 'var(--pkd)', fontSize: 20 },
  stepT: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.2vw, 26px)' },
  stepS: { color: 'var(--tx2)', lineHeight: 1.4 },
  tips: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  tip: { background: '#fff', border: '1px solid var(--pk)', borderRadius: 24, padding: '8px 16px', fontSize: 'clamp(16px, 1.6vw, 18px)', color: 'var(--tx)' },
  thanksRow: { display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  levers3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 24, width: '100%', maxWidth: 1180 },

  bottom: { position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, cursor: 'default' },
  navArrow: { border: 'none', background: 'none', color: 'var(--tx3)', fontSize: 30, lineHeight: 1, cursor: 'pointer', padding: '0 6px' },
  counter: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },

  noteOverlay: { position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 90vw)', background: 'rgba(28,28,30,0.94)', color: '#fff', borderRadius: 12, padding: '14px 20px', cursor: 'default', zIndex: 6 },
  noteLabel: { fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ff9ec9' },
  noteBody: { fontSize: 14, lineHeight: 1.5, marginTop: 6 },
}

// Bullet markers (pink dot) — injected once.
if (typeof document !== 'undefined' && !document.getElementById('mcc-bullets')) {
  const s = document.createElement('style')
  s.id = 'mcc-bullets'
  s.textContent = `[data-mcc] li::before{content:'';position:absolute;left:4px;top:.62em;width:7px;height:7px;border-radius:50%;background:#f068a4}`
  document.head.appendChild(s)
}
