import { useState, useEffect, useRef } from 'react'
import SCRIPT from './breathPracticeScript.json'
import useBreathVoice from './useBreathVoice'

// ── BreathPracticeBlock ───────────────────────────────────────────────────────
//
// A ~2-minute interactive stand-in for the guided "Breath Sensation" video
// (non-reactivity Phase 1 Day 1). One screen, seven stages, each a beat of the
// original script:
//
//   intro   → settle  → paced  → anchor  → natural  → expand  → done
//   (tap)     (timed)   (timed)  (choose)   (timed)    (timed)
//
// The diagram is a head-and-torso silhouette that "fills" with breath. In the
// paced stage the fill follows a clock (three slow breaths); in the natural
// stage it follows the participant — touch-and-hold while breathing in, let go
// to breathe out — and the spot they chose as their anchor glows with it.
//
// Timed stages only advance while the page is visible, so a participant who
// switches away does not come back to a finished practice they never did. The
// time spent away is recorded (`hidden_ms`) rather than silently discarded.
//
// Every duration and line of copy can be overridden from the step JSON; the
// defaults below are the Day 1 script (breathPracticeScript.json).
//
// Voice-over: a step with `voice_base` (e.g. "/audio/breath-sensation/") speaks
// each caption, rendered ahead of time by scripts/tts/breath_sensation.py from
// the same script file. The paced breaths wait for their spoken instruction to
// finish, then each in- and out-breath is cued aloud. Participants can turn the
// voice off; time spent with it off is recorded (`voice_off_ms`).

const DEFAULTS = {
  settle_seconds:  8,
  paced_breaths:   3,
  inhale_seconds:  4,
  exhale_seconds:  6,
  natural_seconds: 60,
  expand_seconds:  12,
  intro_text:    SCRIPT.intro,
  settle_text:   SCRIPT.settle,
  paced_text:    SCRIPT.paced,
  anchor_prompt: SCRIPT.anchor,
  natural_cues:  [SCRIPT.natural_1, SCRIPT.natural_2, SCRIPT.natural_3],
  expand_text:   SCRIPT.expand,
  done_text:     SCRIPT.done,
}

// Script names four places the breath can be felt. `centers` are SVG coords.
const ANCHORS = [
  { id: 'nostrils',  label: 'Nostrils',  centers: [[120, 74]],              r: 16 },
  { id: 'shoulders', label: 'Shoulders', centers: [[74, 124], [166, 124]],  r: 20 },
  { id: 'chest',     label: 'Chest',     centers: [[120, 152]],             r: 26 },
  { id: 'belly',     label: 'Belly',     centers: [[120, 222]],             r: 28 },
]

const COOL = [143, 189, 224]   // in-breath
const WARM = [242, 169, 143]   // out-breath
const REST = [233, 160, 190]   // between breaths — the platform's soft pink
const MAX_HOLDS = 200

const ease = x => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, x)))) / 2
const rgb  = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

export default function BreathPracticeBlock({ step, demoMode = false, onComplete }) {
  const cfg = { ...DEFAULTS, ...step }
  const cycle = cfg.inhale_seconds + cfg.exhale_seconds
  const durations = {
    settle:  cfg.settle_seconds,
    paced:   cfg.paced_breaths * cycle,
    natural: cfg.natural_seconds,
    expand:  cfg.expand_seconds,
  }
  const totalTimed = Object.values(durations).reduce((a, b) => a + b, 0)
  const NEXT = { settle: 'paced', paced: 'anchor', natural: 'expand', expand: 'done' }

  const [stage,   setStage]   = useState('intro')
  const [anchor,  setAnchor]  = useState(null)
  const [holding, setHolding] = useState(false)
  // Per-frame snapshot of the loop's refs — render reads this, never the refs.
  const [view, setView] = useState({ level: 0, e: 0, doneTimed: 0, waiting: false })

  // Everything the loop touches lives in refs, so the loop never goes stale.
  const stageRef    = useRef('intro')
  const elapsedRef  = useRef(0)      // visible seconds in the current stage
  const doneTimed   = useRef(0)      // visible seconds in completed timed stages
  const levelRef    = useRef(0)      // 0 = empty, 1 = full breath
  const holdingRef  = useRef(false)
  const holdsRef    = useRef([])     // [[startMs, endMs], …] within the natural stage
  const hiddenMs    = useRef(0)
  const lastTs      = useRef(null)
  const completed   = useRef(false)
  const phaseRef    = useRef(-1)     // paced: last in/out phase cued aloud
  const voiceOffMs  = useRef(0)

  const voice = useBreathVoice(cfg.voice_base)
  // The text each clip must match to be played. A clip whose manifest text no
  // longer matches the caption stays silent rather than saying something else.
  const clipText = {
    settle: cfg.settle_text, paced: cfg.paced_text, anchor: cfg.anchor_prompt,
    natural_1: cfg.natural_cues[0], natural_2: cfg.natural_cues[1], natural_3: cfg.natural_cues[2],
    expand: cfg.expand_text, done: cfg.done_text, cue_in: SCRIPT.cue_in, cue_out: SCRIPT.cue_out,
  }
  const say = key => voice.play(key, clipText[key])
  const sayRef = useRef(say)
  useEffect(() => { sayRef.current = say })

  function goto(next) {
    if (durations[stageRef.current] != null) doneTimed.current += durations[stageRef.current]
    stageRef.current = next
    elapsedRef.current = 0
    phaseRef.current = -1
    setStage(next)
    // From the Begin tap this runs inside the user gesture, which is what
    // lets a phone start audio at all.
    if (next === 'settle') voice.unlock()
    if (next === 'natural') sayRef.current('natural_1')
    else if (clipText[next]) sayRef.current(next)
  }

  // ── Holding (natural stage only) ───────────────────────────────────────────
  function startHold() {
    if (stageRef.current !== 'natural' || holdingRef.current) return
    holdingRef.current = true
    setHolding(true)
    if (holdsRef.current.length < MAX_HOLDS) holdsRef.current.push([Math.round(elapsedRef.current * 1000), null])
  }
  function endHold() {
    if (!holdingRef.current) return
    holdingRef.current = false
    setHolding(false)
    const last = holdsRef.current[holdsRef.current.length - 1]
    if (last && last[1] == null) last[1] = Math.round(elapsedRef.current * 1000)
  }

  // ── Animation / timing loop ────────────────────────────────────────────────
  useEffect(() => {
    let raf
    const tick = ts => {
      raf = requestAnimationFrame(tick)
      const prev = lastTs.current
      lastTs.current = ts
      if (prev == null) return
      const dt = Math.min(0.25, (ts - prev) / 1000)   // clamp: rAF stalls when backgrounded
      if (document.hidden) { hiddenMs.current += dt * 1000; return }

      const s = stageRef.current
      const dur = durations[s]
      if (dur != null && voice.offRef.current) voiceOffMs.current += dt * 1000
      // The paced breaths wait for their spoken instruction to finish.
      const waiting = s === 'paced' && voice.speaking('paced')
      if (dur != null && !waiting) {
        elapsedRef.current += dt
        if (elapsedRef.current >= dur) {
          if (s === 'natural' && holdingRef.current) endHold()
          goto(NEXT[s])
          // The rest of this frame belongs to the stage just left; running it
          // would, e.g., cue a paced "Breathe in" over the new stage's voice.
          return
        }
      }

      // Breath level for the figure
      const e = elapsedRef.current
      if (s === 'paced' && waiting) {
        levelRef.current += (0.12 - levelRef.current) * (1 - Math.exp(-dt / 1.0))
      } else if (s === 'paced') {
        const t = e % cycle
        levelRef.current = t < cfg.inhale_seconds
          ? ease(t / cfg.inhale_seconds)
          : 1 - ease((t - cfg.inhale_seconds) / cfg.exhale_seconds)
        const phase = Math.floor(e / cycle) * 2 + (t < cfg.inhale_seconds ? 0 : 1)
        if (phase !== phaseRef.current) {
          phaseRef.current = phase
          sayRef.current(phase % 2 === 0 ? 'cue_in' : 'cue_out')
        }
      } else if (s === 'natural') {
        // Follows the participant: rise while held, settle when released.
        const target = holdingRef.current ? 1 : 0
        const tau = holdingRef.current ? 0.9 : 1.3
        levelRef.current += (target - levelRef.current) * (1 - Math.exp(-dt / tau))
      } else if (s === 'settle') {
        levelRef.current = 0.12 + 0.08 * Math.sin(e * 1.1)
      } else if (s === 'expand' || s === 'done') {
        levelRef.current += (0.6 - levelRef.current) * (1 - Math.exp(-dt / 1.5))
      } else {
        levelRef.current += (0.15 - levelRef.current) * (1 - Math.exp(-dt / 1.0))
      }
      setView({ level: levelRef.current, e: elapsedRef.current, doneTimed: doneTimed.current, waiting })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Completion ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'done' || completed.current) return
    completed.current = true
    const holds = holdsRef.current
    const inhaleMs = holds.map(([a, b]) => b - a)
    onComplete?.({
      completed:        true,
      anchor,
      breaths_marked:   holds.length,
      holds_ms:         holds,           // [start, end] within the natural stage
      mean_inhale_ms:   inhaleMs.length ? Math.round(inhaleMs.reduce((a, b) => a + b, 0) / inhaleMs.length) : null,
      natural_seconds:  cfg.natural_seconds,
      hidden_ms:        Math.round(hiddenMs.current),
      voice_available:  voice.available,
      voice_off_ms:     voice.available ? Math.round(voiceOffMs.current) : null,
    })
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage !== 'natural') return
    const down = e => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startHold() } }
    const up   = e => { if (e.code === 'Space') { e.preventDefault(); endHold() } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [stage])

  // ── Derived view state ─────────────────────────────────────────────────────
  const { level, e, waiting } = view
  const dur   = durations[stage]
  const cueIdx = stage === 'natural'
    ? Math.min(cfg.natural_cues.length - 1, Math.floor(e / (dur / cfg.natural_cues.length)))
    : 0

  useEffect(() => {
    if (stage === 'natural' && cueIdx > 0) sayRef.current(`natural_${cueIdx + 1}`)
  }, [stage, cueIdx])

  let breathingIn = false
  if (stage === 'paced') breathingIn = !waiting && (e % cycle) < cfg.inhale_seconds
  if (stage === 'natural') breathingIn = holding
  const tint = stage === 'paced' || stage === 'natural'
    ? (breathingIn ? COOL : WARM)
    : REST

  let caption = null
  let sub     = null
  switch (stage) {
    case 'intro':
      caption = cfg.intro_text
      if (voice.available) sub = 'Sound on if you can — a voice will guide you.'
      break
    case 'settle': caption = cfg.settle_text; break
    case 'paced': {
      const n = Math.min(cfg.paced_breaths, Math.floor(e / cycle) + 1)
      caption = cfg.paced_text
      sub = waiting ? null : `${breathingIn ? 'Breathe in…' : '…and out'}   ·   ${n} of ${cfg.paced_breaths}`
      break
    }
    case 'anchor': caption = cfg.anchor_prompt; break
    case 'natural': {
      const cues = cfg.natural_cues
      caption = cues[cueIdx]
      sub = holding ? 'Breathing in…' : 'Touch and hold to breathe in'
      break
    }
    case 'expand': caption = cfg.expand_text; break
    case 'done':   caption = cfg.done_text; break
  }

  const timedSoFar = view.doneTimed + (dur != null ? Math.min(e, dur) : 0)
  const progress = stage === 'done' ? 1 : timedSoFar / totalTimed
  const expandT  = stage === 'expand' ? e / dur : stage === 'done' ? 1 : 0

  return (
    <div style={S.wrap}>
      <div style={S.topRow}>
        <p style={S.label}>{step.label ?? ''}</p>
        {voice.available && (
          <button type="button" style={S.voiceBtn} onClick={voice.toggle} aria-pressed={!voice.off}>
            {voice.off ? 'Voice off' : 'Voice on'}
          </button>
        )}
      </div>

      <p key={caption} style={S.caption}>{caption}</p>

      <div
        style={{ ...S.figureWrap, cursor: stage === 'natural' ? 'pointer' : 'default' }}
        onPointerDown={e2 => { if (stage === 'natural') { e2.preventDefault(); startHold() } }}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onContextMenu={e2 => stage === 'natural' && e2.preventDefault()}
      >
        <BreathFigure
          level={level}
          tint={tint}
          anchor={anchor}
          stage={stage}
          expandT={expandT}
          onPickAnchor={stage === 'anchor' ? setAnchor : null}
        />
      </div>

      <p style={{ ...S.sub, visibility: sub ? 'visible' : 'hidden' }}>{sub ?? '·'}</p>

      {stage === 'intro' && (
        <div style={S.centerRow}>
          <button type="button" style={S.primaryBtn} onClick={() => goto('settle')}>Begin</button>
        </div>
      )}

      {stage === 'anchor' && (
        <>
          <div style={S.anchorRow}>
            {ANCHORS.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAnchor(a.id)}
                style={{ ...S.anchorBtn, ...(anchor === a.id ? S.anchorBtnOn : {}) }}
                aria-pressed={anchor === a.id}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div style={S.centerRow}>
            <button
              type="button"
              disabled={!anchor}
              style={anchor ? S.primaryBtn : { ...S.primaryBtn, ...S.primaryBtnOff }}
              onClick={() => goto('natural')}
            >
              Breathe with this spot
            </button>
          </div>
        </>
      )}

      {stage !== 'intro' && (
        <div style={S.track} aria-hidden>
          <div style={{ ...S.fill, width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      {demoMode && NEXT[stage] && (
        <div style={S.centerRow}>
          <button type="button" style={S.demoSkip} onClick={() => goto(NEXT[stage])}>
            Demo: skip this stage →
          </button>
        </div>
      )}
    </div>
  )
}

// ── BreathFigure ──────────────────────────────────────────────────────────────

const BODY_PATH =
  'M106 100 L134 100 Q138 113 160 117 Q194 124 198 152 L202 280 L38 280 L42 152 Q46 124 80 117 Q102 113 106 100 Z'

function BreathFigure({ level, tint, anchor, stage, expandT, onPickAnchor }) {
  // Fill rises from the belly up to the collarbones as the breath comes in.
  const fillTop = 280 - (40 + 150 * level)
  const a = ANCHORS.find(x => x.id === anchor)
  const showAnchor = a && (stage === 'natural' || stage === 'anchor')
  const bodyGlow   = Math.min(1, expandT * 2)             // first half: whole body
  const roomT      = Math.max(0, expandT * 2 - 1)         // second half: the room

  return (
    <svg viewBox="-50 -12 340 312" style={{ width: '100%', maxWidth: 300, display: 'block', margin: '0 auto', touchAction: 'none', userSelect: 'none' }} role="img" aria-label="Breathing figure">
      <defs>
        <clipPath id="bp-body">
          <path d={BODY_PATH} />
          <ellipse cx="120" cy="62" rx="34" ry="40" />
        </clipPath>
        <radialGradient id="bp-glow">
          <stop offset="0%"   stopColor={rgb(tint, 0.95)} />
          <stop offset="100%" stopColor={rgb(tint, 0)} />
        </radialGradient>
        <linearGradient id="bp-fill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor={rgb(tint, 0.75)} />
          <stop offset="100%" stopColor={rgb(tint, 0.35)} />
        </linearGradient>
      </defs>

      {/* The room — attention widening past the body */}
      {roomT > 0 && (
        <circle cx="120" cy="144" r={134 + 14 * roomT} fill="none"
          stroke={rgb(tint, 0.5 * roomT)} strokeWidth={2} strokeDasharray="3 7" />
      )}
      {roomT > 0 && (
        <circle cx="120" cy="144" r={148} fill={rgb(tint, 0.10 * roomT)} />
      )}

      {/* Silhouette */}
      <g>
        <path d={BODY_PATH} fill="#fbf1f4" />
        <ellipse cx="120" cy="62" rx="34" ry="40" fill="#fbf1f4" />
        <g clipPath="url(#bp-body)">
          <rect x="30" y={fillTop} width="180" height={290 - fillTop} fill="url(#bp-fill)" />
          {bodyGlow > 0 && <rect x="30" y="0" width="180" height="290" fill={rgb(tint, 0.35 * bodyGlow)} />}
        </g>
        <path d={BODY_PATH} fill="none" stroke="#c9b3bb" strokeWidth="2" />
        <ellipse cx="120" cy="62" rx="34" ry="40" fill="none" stroke="#c9b3bb" strokeWidth="2" />
        {/* nose, a hint of a face */}
        <path d="M120 58 Q116 72 121 75" fill="none" stroke="#c9b3bb" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      {/* Anchor glow */}
      {showAnchor && a.centers.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={a.r * (1 + 0.6 * level)}
          fill="url(#bp-glow)" opacity={0.45 + 0.55 * level} />
      ))}

      {/* Tap targets while choosing */}
      {onPickAnchor && ANCHORS.map(an => an.centers.map(([cx, cy], i) => (
        <g key={an.id + i} onClick={() => onPickAnchor(an.id)} style={{ cursor: 'pointer' }}>
          <circle cx={cx} cy={cy} r={an.r + 6} fill="transparent" />
          <circle cx={cx} cy={cy} r={5}
            fill={anchor === an.id ? rgb(tint) : '#fff'}
            stroke={anchor === an.id ? rgb(tint) : '#b89aa5'} strokeWidth="2" />
        </g>
      )))}
    </svg>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FONT = '"DM Sans", system-ui, sans-serif'

const S = {
  wrap:    { fontFamily: FONT, userSelect: 'none', WebkitUserSelect: 'none' },
  topRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, minHeight: 28 },
  label:   { fontSize: 12, fontWeight: 600, color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 },
  voiceBtn: {
    fontFamily: FONT, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
    border: '1.5px solid var(--bds)', background: '#fff', color: 'var(--tx2)', cursor: 'pointer',
  },
  caption: {
    fontSize: 15, lineHeight: 1.65, color: 'var(--tx)', textAlign: 'center',
    minHeight: 74, margin: '0 auto 8px', maxWidth: 460,
    animation: 'bpFade 0.8s ease',
  },
  figureWrap: { padding: '4px 0', WebkitTouchCallout: 'none' },
  sub:     { fontSize: 14, color: 'var(--tx2)', textAlign: 'center', margin: '6px 0 14px', fontStyle: 'italic', whiteSpace: 'pre' },
  centerRow: { display: 'flex', justifyContent: 'center', marginTop: 10 },
  anchorRow: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  anchorBtn: {
    fontFamily: FONT, fontSize: 14, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
    border: '1.5px solid var(--bds)', background: '#fff', color: 'var(--tx2)', cursor: 'pointer',
  },
  anchorBtnOn: { borderColor: 'var(--pk)', color: 'var(--tx)', background: 'var(--bgp)' },
  primaryBtn: {
    fontFamily: FONT, fontSize: 14, fontWeight: 600, padding: '10px 22px', borderRadius: 8,
    border: '1.5px solid var(--tx)', background: 'var(--tx)', color: '#fff', cursor: 'pointer',
  },
  primaryBtnOff: { opacity: 0.35, cursor: 'default' },
  track:   { height: 4, background: 'var(--bd)', borderRadius: 2, overflow: 'hidden', marginTop: 16 },
  fill:    { height: '100%', background: 'var(--pk)', transition: 'width 0.3s linear' },
  demoSkip: {
    fontFamily: FONT, fontSize: 12, padding: '6px 10px', borderRadius: 6,
    border: '1px dashed var(--bds)', background: 'transparent', color: 'var(--tx2)', cursor: 'pointer',
  },
}

// Caption crossfade — injected once.
if (typeof document !== 'undefined' && !document.getElementById('bp-keyframes')) {
  const el = document.createElement('style')
  el.id = 'bp-keyframes'
  el.textContent = '@keyframes bpFade { from { opacity: 0 } to { opacity: 1 } }'
  document.head.appendChild(el)
}
