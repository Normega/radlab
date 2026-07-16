import { useEffect, useRef, useState } from 'react'
import AvatarBreathPacer from '../../EbbAndFlow/components/AvatarBreathPacer'
import { useBreathCycle } from '../../EbbAndFlow/useBreathCycle'
import CalibReviewPanel from '../../BreathBelt/components/CalibReviewPanel'

// ── MirrorCalibration ───────────────────────────────────────────────────────
//
// The "learning to mirror" phase. The avatar breathes at a natural pace and the
// wearer syncs to it; as the calibration-confidence session (createCalibration-
// Session, driven live in useBreathSignal) climbs, the avatar *materializes* —
// a faint ghost sharpening into a solid figure. Opacity/blur = confidence, so
// the screen is honest biofeedback about the calibration itself, and it
// self-instructs: people settle and breathe evenly to make themselves appear.
// When confidence holds high the fit finalizes automatically (→ REVIEW); if it
// stalls, the weakest-factor coaching says exactly what to change, live, while
// collection continues.
//
// Drop-in for the Mirror flow — pass the whole `breath` hook object.

const MIRROR_PERIOD_MS = 5000   // ~12 bpm — a natural resting pace, not resonance
const FIXATION_DELAY_MS = 800

export default function MirrorCalibration({ breath, avatarProps, breathPeriodMs = MIRROR_PERIOD_MS }) {
  const {
    calibPhase, calibReviewData, signalRef,
    startCalibration, beginMirrorCollection, acceptCalibration, redoCalibration, acceptMirrorNow,
  } = breath

  const { getPhase, startBreath, reset } = useBreathCycle()
  const controlRef     = useRef(null)
  const animStartedRef = useRef(false)
  const phaseRef       = useRef(calibPhase)
  const outlineRef     = useRef(null)
  const avatarSize     = 240
  useEffect(() => { phaseRef.current = calibPhase }, [calibPhase])

  // Breathe the head outline with the pacer, matching the avatar's own scale
  // (1 + 0.22·bT). At low confidence the outline is basically all that's visible,
  // so it must move too — otherwise the screen looks frozen. Interval, not rAF,
  // so it keeps ticking if the tab is backgrounded.
  useEffect(() => {
    const id = setInterval(() => {
      const el = outlineRef.current
      if (!el) return
      const phase = getPhase ? getPhase() : 0
      const bT = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2
      el.style.transform = `scale(${(1 + 0.22 * bT).toFixed(4)})`
    }, 33)
    return () => clearInterval(id)
  }, [getPhase])

  // Live confidence snapshot (poll the ref ~10 Hz for the React-driven chrome).
  const [calib, setCalib] = useState(null)
  useEffect(() => {
    if (calibPhase !== 'BREATHE') return
    const id = setInterval(() => setCalib({ ...(signalRef.current.calib || {}) }), 100)
    return () => clearInterval(id)
  }, [calibPhase, signalRef])

  // FIXATION → begin collection exactly as the avatar animation starts.
  useEffect(() => {
    if (calibPhase !== 'FIXATION') { animStartedRef.current = false; return }
    if (animStartedRef.current) return
    animStartedRef.current = true
    const t = setTimeout(() => {
      const startMs = Date.now()
      reset()
      controlRef.current?.resumeAnimation?.()
      beginMirrorCollection(startMs, breathPeriodMs)
    }, FIXATION_DELAY_MS)
    return () => clearTimeout(t)
  }, [calibPhase, beginMirrorCollection, breathPeriodMs, reset])

  // BREATHE: keep the avatar breathing at the pace until we leave BREATHE
  // (confidence converged → REVIEW, or the user redid it). Adaptive length.
  const didRun = useRef(false)
  useEffect(() => {
    if (calibPhase !== 'BREATHE') { didRun.current = false; return }
    if (didRun.current) return
    didRun.current = true
    let cancelled = false
    ;(async () => {
      while (!cancelled && phaseRef.current === 'BREATHE') {
        await startBreath(breathPeriodMs)
      }
    })()
    return () => { cancelled = true }
  }, [calibPhase, breathPeriodMs, startBreath])

  const avatarPaused = calibPhase === 'FIXATION' || calibPhase === 'NONE'
  const showAvatar   = !['REVIEW', 'FAILED', 'COMPLETE'].includes(calibPhase)

  // Materialization: ghost → solid as confidence climbs.
  const conf   = calib?.confidence ?? 0
  const opacity = 0.06 + 0.94 * conf   // face materializes over an always-visible skin disc
  const blurPx  = (1 - conf) * 7
  const pct     = Math.round(conf * 100)
  const timedOut = calib?.status === 'timeout'

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-8" style={{ maxWidth: 520, margin: '0 auto' }}>
      {showAvatar && (
        <div style={{ position: 'relative', width: avatarSize, height: avatarSize }}>
          {/* Always-visible head outline so the avatar is never invisible: at
              low confidence it's just an empty circle; the face materializes
              inside it as confidence climbs, and the outline fades out as the
              real face edge takes over. */}
          <div ref={outlineRef} style={{
            position: 'absolute', left: avatarSize * 0.185, top: avatarSize * 0.21,
            width: avatarSize * 0.63, height: avatarSize * 0.72, borderRadius: '50%',
            border: '2px solid rgba(0,0,0,0.16)', background: 'transparent',
            transformOrigin: 'center 52%',
            opacity: Math.max(0, 1 - conf * 1.3),
            transition: 'opacity 160ms linear',
          }} />
          <div style={{
            position: 'relative',
            opacity, filter: `blur(${blurPx.toFixed(1)}px)`,
            transition: 'opacity 160ms linear, filter 160ms linear',
          }}>
            <AvatarBreathPacer
              {...avatarProps}
              scaleAmplitude={0.22}
              getPhase={getPhase}
              controlRef={controlRef}
              paused={avatarPaused}
              size={avatarSize}
            />
          </div>
          {/* confidence ring */}
          {calibPhase === 'BREATHE' && <ConfidenceRing conf={conf} size={avatarSize} />}
        </div>
      )}

      {calibPhase === 'NONE' && <MirrorReady onStart={startCalibration} />}

      {calibPhase === 'FIXATION' && (
        <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>
          Find a comfortable position and breathe with the figure…
        </p>
      )}

      {calibPhase === 'BREATHE' && (
        <div className="flex flex-col items-center gap-3" style={{ maxWidth: 420 }}>
          <p className="text-center" style={{ color: 'var(--tx)', fontSize: 'var(--fs-body)', margin: 0 }}>
            Breathe in as the figure grows, out as it fades.
          </p>
          {/* Before the session has enough samples to diagnose, stay neutral —
              don't flash "check the strap" in the first few seconds. */}
          {!calib?.ready && (
            <p className="text-center" style={{ color: 'var(--tx3)', fontSize: 'var(--fs-body-sm)', margin: 0 }}>
              settling in…
            </p>
          )}
          {/* Coaching — only once we can actually diagnose, and not yet confident.
              Persistent + firmer on timeout. */}
          {calib?.ready && calib?.coach && (
            <p className="text-center" style={{
              color: timedOut ? '#a04a00' : 'var(--tx3)',
              fontSize: 'var(--fs-body-sm)', margin: 0,
              background: timedOut ? '#fff3e0' : 'transparent',
              border: timedOut ? '1px solid #e6b980' : 'none',
              borderRadius: 10, padding: timedOut ? '8px 12px' : 0,
            }}>
              {calib.coach}
            </p>
          )}
          <p style={{ color: 'var(--tx3)', fontSize: 11, fontFamily: '"Space Mono",monospace', margin: 0 }}>
            connection {pct}%{calib?.breaths ? ` · ${calib.breaths} breaths` : ''}
          </p>
          {/* After a stall, let the wearer accept what we have or start over. */}
          {timedOut && (
            <div className="flex gap-3">
              <button onClick={acceptMirrorNow}
                style={{ background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 14, cursor: 'pointer' }}>
                Use this
              </button>
              <button onClick={redoCalibration}
                style={{ background: 'transparent', color: 'var(--tx2)', border: '1px solid var(--bds)', borderRadius: 10, padding: '9px 16px', fontSize: 14, cursor: 'pointer' }}>
                Start over
              </button>
            </div>
          )}
        </div>
      )}

      {calibPhase === 'REVIEW' && calibReviewData && (
        <CalibReviewPanel {...calibReviewData} onContinue={acceptCalibration} onRedo={redoCalibration} />
      )}

      {calibPhase === 'FAILED' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-center" style={{ color: '#c0392b', fontSize: 'var(--fs-body)' }}>
            We couldn’t forge the connection — the signal was too weak to model.
            <br />
            <span style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>
              Check the strap is snug against the skin and the electrodes are damp.
            </span>
          </p>
          <button onClick={redoCalibration}
            className="px-5 py-3 rounded-xl font-semibold"
            style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

// A ring around the avatar that fills with confidence.
function ConfidenceRing({ conf, size }) {
  const r = size / 2 - 6
  const c = 2 * Math.PI * r
  const col = conf >= 0.85 ? '#2ecc71' : conf >= 0.5 ? '#f39c12' : '#c0577f'
  return (
    <svg width={size} height={size} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="3"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - conf)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 160ms linear, stroke 300ms linear' }}
      />
    </svg>
  )
}

function MirrorReady({ onStart }) {
  return (
    <>
      <div className="text-center" style={{ maxWidth: 400 }}>
        <p style={{ color: 'var(--tx)', fontSize: 'var(--fs-body)', marginBottom: 8 }}>
          A figure will breathe at an easy pace. Breathe along with it — in as it grows,
          out as it fades — and it will slowly come into focus as it learns your breath.
        </p>
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>
          Sit comfortably and settle in. Once the connection is forged, it will follow you.
        </p>
      </div>
      <button onClick={onStart} className="px-6 py-3 rounded-xl font-semibold"
        style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}>
        Begin
      </button>
    </>
  )
}
