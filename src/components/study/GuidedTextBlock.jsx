import { useState, useEffect, useRef } from 'react'
import { lineSeconds } from './guidedText'

// ── GuidedTextBlock ───────────────────────────────────────────────────────────
//
// A guided practice delivered as text: one large line at a time, paced by the
// clock, with quiet stretches where the eyes can close. Written for the
// class RCT, where Liliana's recorded non-reactivity scripts are delivered as
// text (a noisy room, no headphones, and the same delivery as the Sense
// Foraging arm). Same format as the BPMH talk's room exercises.
//
// Step JSON:
//   { "type": "guided_text",
//     "label": "optional small caps label",
//     "intro": "optional; replaces the default intro sentence",
//     "lines": [
//       { "text": "A line to read." },                 // paced by its length
//       { "text": "A longer line.", "seconds": 12 },   // or explicitly
//       { "quiet": 45, "text": "Stay with the breath." } // a quiet stretch
//     ],
//     "close": "optional last line, left on screen at the end",
//     "autostart": true }   // skip the Begin screen — for a short piece inside a
//                           // longer exercise, after an earlier tap has already
//                           // unlocked audio (see the Five Senses day)
//
// A quiet stretch shows its text dimmed with a slow pulse, and ends with a soft
// tone, so a participant whose eyes are closed knows to look back. Lines do not
// sound a tone: the eyes are on them already.
//
// Time only advances while the page is visible and not paused. Time away and
// time paused are both recorded (`hidden_ms`, `paused_ms`) rather than folded
// silently into a completed practice.

let ctx = null
function tone(freq = 528, decay = 1.8) {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.14, t + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay)
    osc.start(t); osc.stop(t + decay + 0.05)
  } catch { /* no audio: the screen still cues */ }
}

export default function GuidedTextBlock({ step, demoMode = false, onComplete }) {
  const lines = step.lines ?? []
  const durs  = lines.map(lineSeconds)
  const total = durs.reduce((a, b) => a + b, 0)
  const mins  = Math.max(1, Math.round(total / 60))

  const [phase,  setPhase]  = useState(step.autostart ? 'run' : 'intro')   // intro → run → done
  const [paused, setPaused] = useState(false)
  const [view,   setView]   = useState({ idx: 0, e: 0, done: 0 })

  const phaseRef  = useRef(step.autostart ? 'run' : 'intro')
  const pausedRef = useRef(false)
  const idxRef    = useRef(0)
  const eRef      = useRef(0)      // visible, unpaused seconds on the current line
  const doneRef   = useRef(0)      // seconds of lines already finished
  const hiddenMs  = useRef(0)
  const pausedMs  = useRef(0)
  const lastTs    = useRef(null)
  const completed = useRef(false)

  function advance() {
    const i = idxRef.current
    if (lines[i]?.quiet != null) tone()
    doneRef.current += durs[i] ?? 0
    eRef.current = 0
    if (i + 1 >= lines.length) {
      phaseRef.current = 'done'
      setPhase('done')
      tone(440, 2.4)
    } else {
      idxRef.current = i + 1
    }
    setView({ idx: idxRef.current, e: 0, done: doneRef.current })
  }

  useEffect(() => {
    let raf
    const tick = ts => {
      raf = requestAnimationFrame(tick)
      const prev = lastTs.current
      lastTs.current = ts
      if (prev == null || phaseRef.current !== 'run') return
      const dt = Math.min(0.25, (ts - prev) / 1000)
      if (document.hidden) { hiddenMs.current += dt * 1000; return }
      if (pausedRef.current) { pausedMs.current += dt * 1000; return }
      eRef.current += dt
      if (eRef.current >= (durs[idxRef.current] ?? 0)) { advance(); return }
      setView({ idx: idxRef.current, e: eRef.current, done: doneRef.current })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'done' || completed.current) return
    completed.current = true
    onComplete?.({
      completed:  true,
      seconds:    Math.round(total),
      hidden_ms:  Math.round(hiddenMs.current),
      paused_ms:  Math.round(pausedMs.current),
    })
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function begin() {
    tone(528, 0.9)   // inside the tap: unlocks audio on phones, and says "tones are on"
    phaseRef.current = 'run'
    setPhase('run')
  }
  function togglePause() {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  const line  = lines[view.idx]
  const quiet = line?.quiet != null
  const progress = phase === 'done' ? 1 : phase === 'intro' ? 0 : (view.done + view.e) / total
  const quietLeft = quiet ? Math.max(0, Math.ceil(durs[view.idx] - view.e)) : 0

  return (
    <div style={S.wrap}>
      <div style={S.topRow}>
        <p style={S.label}>{step.label ?? ''}</p>
        {phase === 'run' && (
          <button type="button" style={S.smallBtn} onClick={togglePause}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>

      <div style={S.stage}>
        {phase === 'intro' && (
          <div style={{ textAlign: 'center' }}>
            <p style={S.introText}>
              {step.intro ?? 'Find a comfortable position. The practice appears one line at a time, so there is nothing to do but read and follow.'}
            </p>
            <p style={S.introNote}>
              About {mins} minute{mins === 1 ? '' : 's'}. In the quiet stretches you can close your eyes; a soft tone brings you back.
            </p>
            <button type="button" style={S.primaryBtn} onClick={begin}>Begin</button>
          </div>
        )}

        {phase === 'run' && line && (
          <div key={view.idx} style={S.lineWrap}>
            {quiet && <div style={S.pulse} aria-hidden />}
            <p style={quiet ? S.quietText : S.lineText}>{line.text ?? ''}</p>
            {quiet && <p style={S.quietNote}>quiet · {quietLeft}s</p>}
            {paused && <p style={S.quietNote}>paused</p>}
          </div>
        )}

        {phase === 'done' && (
          <div style={S.lineWrap}>
            <p style={S.lineText}>{step.close ?? 'When you’re ready, continue with the rest of your day.'}</p>
          </div>
        )}
      </div>

      {phase !== 'intro' && (
        <div style={S.track} aria-hidden>
          <div style={{ ...S.fill, width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      {demoMode && phase === 'run' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button type="button" style={S.demoSkip} onClick={advance}>Demo: next line →</button>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FONT = '"DM Sans", system-ui, sans-serif'

const S = {
  wrap:   { fontFamily: FONT },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 28, marginBottom: 8 },
  label:  { fontSize: 12, fontWeight: 600, color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 },
  smallBtn: {
    fontFamily: FONT, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
    border: '1.5px solid var(--bds)', background: '#fff', color: 'var(--tx2)', cursor: 'pointer',
  },
  stage: {
    minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 8px', borderRadius: 14, background: 'var(--bgp)',
  },
  introText: { fontSize: 17, lineHeight: 1.6, color: 'var(--tx)', maxWidth: 440, margin: '0 auto 12px' },
  introNote: { fontSize: 14, lineHeight: 1.6, color: 'var(--tx2)', maxWidth: 440, margin: '0 auto 20px' },
  primaryBtn: {
    fontFamily: FONT, fontSize: 15, fontWeight: 600, padding: '10px 26px', borderRadius: 8,
    border: '1.5px solid var(--tx)', background: 'var(--tx)', color: '#fff', cursor: 'pointer',
  },
  lineWrap:  { textAlign: 'center', maxWidth: 480, animation: 'gtFade 1.2s ease' },
  lineText:  { fontSize: 22, lineHeight: 1.5, color: 'var(--tx)', margin: 0, fontWeight: 500 },
  quietText: { fontSize: 18, lineHeight: 1.5, color: 'var(--tx2)', margin: '14px 0 0' },
  quietNote: { fontSize: 12, color: 'var(--gy)', margin: '12px 0 0', letterSpacing: '0.04em' },
  pulse: {
    width: 14, height: 14, borderRadius: '50%', background: 'var(--pk)', margin: '0 auto',
    animation: 'gtPulse 5s ease-in-out infinite',
  },
  track: { height: 4, background: 'var(--bd)', borderRadius: 2, overflow: 'hidden', marginTop: 16 },
  fill:  { height: '100%', background: 'var(--pk)', transition: 'width 0.3s linear' },
  demoSkip: {
    fontFamily: FONT, fontSize: 12, padding: '6px 10px', borderRadius: 6,
    border: '1px dashed var(--bds)', background: 'transparent', color: 'var(--tx2)', cursor: 'pointer',
  },
}

if (typeof document !== 'undefined' && !document.getElementById('gt-keyframes')) {
  const el = document.createElement('style')
  el.id = 'gt-keyframes'
  el.textContent =
    '@keyframes gtFade { from { opacity: 0 } to { opacity: 1 } }' +
    '@keyframes gtPulse { 0%,100% { transform: scale(1); opacity: .45 } 50% { transform: scale(2.2); opacity: .15 } }'
  document.head.appendChild(el)
}
