import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import GameIntro from '../../shared/GameIntro'
import { supabase } from '../../../lib/supabase'
import { useSubmitLock } from '../../../lib/useSubmitLock'
import { createOwlBarn } from './engine'
import { createOwlAudio } from './audio'
import sceneData from './assets/scene.json'
import {
  summariseCalibration, makeSchedule, theoreticalMinimumMs, tierFor, summariseWindows,
} from './timing'

/* ── Owl Barn (Night Safari, exhibit 2) ───────────────────────────────────────

   You have been shrunk to owl-prey size. Cross the barn - two corridors, 20
   hiding spots - moving only while the owls are silent: 3 taps for one spot,
   8 taps for two, any other count and you are swooped back two spots.

   The measure is Norm's Risk Flexibility task (RiskFlex.iqx, 2013): silence
   windows rise and fall on a triangle wave between the player's own 3-tap and
   8-tap times. Spec and decisions: docs/markdowns/safari_build_plan.md.

   Flow: intro -> sound check -> calibration -> barn -> pause -> results.
   Data: one game_sessions row at the start, the session detail at the moment
   the barn is crossed (before the pause, so leaving during it loses nothing),
   and the pause length as its own later row.
──────────────────────────────────────────────────────────────────────────── */

const DATASET_VERSION = 1
const urls = import.meta.glob('./assets/*.webp', { eager: true, query: '?url', import: 'default' })
const fileUrl = Object.fromEntries(Object.entries(urls).map(([k, v]) => [k.split('/').pop(), v]))

function useImages() {
  const [images, setImages] = useState(null)
  useEffect(() => {
    let alive = true
    const out = {}
    Promise.all(Object.entries(fileUrl).map(([name, src]) => new Promise(res => {
      const im = new Image(); im.decoding = 'async'
      im.onload = im.onerror = () => res(); im.src = src; out[name] = im
    }))).then(() => { if (alive) setImages(out) })
    return () => { alive = false }
  }, [])
  return images
}

// ── persistence ──────────────────────────────────────────────────────────────
async function startSession(userId, studyId) {
  if (!userId) return null
  const { data, error } = await supabase.from('game_sessions').insert({
    user_id: userId, game_name: 'safari_owl_barn', study_id: studyId ?? null, started_at: new Date().toISOString(),
  }).select('id').single()
  if (error) { console.error('owl barn: game_sessions insert failed', error); return null }
  return data.id
}

// ── small pieces of UI ───────────────────────────────────────────────────────
const C = { ground: '#0d0905', panel: 'rgba(23,18,14,0.92)', text: '#f5e6c8', muted: '#b7a792', amber: '#e0a041', moon: '#9db4e8' }
const S = {
  shell: { position: 'fixed', inset: 0, background: C.ground, color: C.text, zIndex: 50, fontFamily: 'DM Sans, system-ui, sans-serif', userSelect: 'none', WebkitUserSelect: 'none' },
  center: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '24px 16px', textAlign: 'center' },
  h: { fontFamily: 'DM Serif Display, Georgia, serif', fontWeight: 400, fontSize: 28, margin: 0, lineHeight: 1.15 },
  p: { color: C.muted, fontSize: 16, lineHeight: 1.5, maxWidth: 420, margin: 0 },
  mono: { fontFamily: 'Space Mono, monospace', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.moon },
  btn: { background: C.text, color: C.ground, border: 0, borderRadius: 24, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghost: { background: 'transparent', color: C.text, border: `1px solid rgba(245,230,200,0.35)`, borderRadius: 24, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  pad: { width: 'min(80vw, 320px)', aspectRatio: '1 / 1', borderRadius: '50%', border: `2px solid rgba(245,230,200,0.25)`, display: 'grid', placeItems: 'center', touchAction: 'none', cursor: 'pointer' },
  exit: { position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 16, color: 'rgba(245,230,200,0.55)', fontSize: 14, textDecoration: 'none', zIndex: 5 },
}

/** Listen for taps: Space (held keys ignored) or a pointer press. `fn(event, device)`. */
function useTaps(fn, active, target) {
  const ref = useRef(fn); ref.current = fn
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      e.preventDefault()
      if (e.repeat) return                 // a held spacebar auto-repeats; those are not taps
      ref.current(e, 'keyboard')
    }
    const el = target?.current ?? window
    const onPtr = (e) => { if (e.button > 0) return; e.preventDefault(); ref.current(e, e.pointerType || 'mouse') }
    window.addEventListener('keydown', onKey)
    el.addEventListener('pointerdown', onPtr)
    return () => { window.removeEventListener('keydown', onKey); el.removeEventListener('pointerdown', onPtr) }
  }, [active, target])
}

// ── sound check ──────────────────────────────────────────────────────────────
// Two hoots at unpredictable moments; the player taps when they hear each one.
// Passing plays with sound (and sight); failing, or choosing to, plays with the
// visual cues only. The choice is recorded - the two are different tasks.
function SoundCheck({ audio, onDone }) {
  const [stage, setStage] = useState('ready')          // ready | listening | heard | failed
  const [n, setN] = useState(0)
  const rts = useRef([]); const onset = useRef(null); const timers = useRef([])
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => clear, [])

  const next = useCallback(() => {
    setStage('listening'); onset.current = null
    const wait = 1000 + Math.random() * 2000
    timers.current.push(setTimeout(() => {
      const t0 = audio.now() + 0.05
      audio.hoot(t0, t0 + 1.4)
      onset.current = t0 + audio.latencySec()
      timers.current.push(setTimeout(() => { if (onset.current != null) { setStage('failed') } }, 3500))
    }, wait))
  }, [audio])

  useTaps((e) => {
    if (stage !== 'listening') return
    const t = audio.toCtx(e.timeStamp)
    if (onset.current == null || t < onset.current) return      // tapped before any hoot: ignore
    clear()
    rts.current.push(Math.round((t - onset.current) * 1000))
    onset.current = null
    const k = n + 1; setN(k)
    if (k >= 2) onDone({ modality: 'both', soundcheck_rt_ms: rts.current })
    else { setStage('heard'); timers.current.push(setTimeout(next, 700)) }
  }, stage === 'listening')

  return (
    <div style={S.center}>
      <div style={S.mono}>Sound check</div>
      <h2 style={S.h}>{stage === 'failed' ? 'Nothing heard' : stage === 'heard' ? 'Heard. Once more.' : 'Tap when you hear an owl'}</h2>
      <p style={S.p}>
        {stage === 'failed'
          ? 'Check your volume and silent switch, then try again - or play with the owls lit up instead of heard.'
          : 'Headphones help. An owl will hoot twice, at a moment you can\'t predict. Tap the screen, or press Space, as soon as you hear it.'}
      </p>
      {stage === 'ready' && <button style={S.btn} onClick={next}>Start listening</button>}
      {stage === 'failed' && <button style={S.btn} onClick={() => { setN(0); rts.current = []; next() }}>Try again</button>}
      {(stage === 'ready' || stage === 'failed') && (
        <button style={S.ghost} onClick={() => onDone({ modality: 'visual', soundcheck_rt_ms: rts.current })}>Play without sound</button>
      )}
      {stage === 'listening' && <div style={{ ...S.p, fontSize: 14 }}>Listening…</div>}
    </div>
  )
}

// ── calibration (RiskFlex): time from "go" to the last tap, three tries each ──
const CAL_TRIALS = 3
function Calibration({ onDone }) {
  const [need, setNeed] = useState(3)                  // 3, then 8
  const [trial, setTrial] = useState(0)
  const [state, setState] = useState('wait')           // wait | go | early | slow | ok
  const [count, setCount] = useState(0)
  const go = useRef(null); const taps = useRef(0); const timers = useRef([])
  const res = useRef({ 3: [], 8: [], device: new Set(), raw: [] })
  const padRef = useRef(null)
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => clear, [])

  const arm = useCallback(() => {
    clear(); taps.current = 0; setCount(0); setState('wait'); go.current = null
    timers.current.push(setTimeout(() => { go.current = performance.now(); setState('go') }, 900 + Math.random() * 900))
    timers.current.push(setTimeout(() => { if (go.current != null && taps.current < 99) setState(s => (s === 'go' ? 'slow' : s)) }, 900 + 1800 + 5000))
  }, [])
  useEffect(() => { arm() }, [arm, need])

  useTaps((e, device) => {
    if (state === 'wait') { clear(); setState('early'); timers.current.push(setTimeout(arm, 1100)); return }
    if (state !== 'go') return
    res.current.device.add(device)
    taps.current += 1; setCount(taps.current)
    if (taps.current === need) {
      const ms = Math.round(e.timeStamp - go.current)
      res.current[need].push(ms); res.current.raw.push({ need, ms, device })
      clear(); setState('ok')
      const t = trial + 1
      if (t < CAL_TRIALS) { setTrial(t); timers.current.push(setTimeout(arm, 700)) }
      else if (need === 3) { timers.current.push(setTimeout(() => { setTrial(0); setNeed(8) }, 900)) }
      else {
        const cal = summariseCalibration(res.current[3], res.current[8])
        onDone({ ...cal, trials3: res.current[3], trials8: res.current[8], raw: res.current.raw, devices: [...res.current.device] })
      }
    }
  }, true, padRef)

  const label = state === 'go' ? 'Go' : state === 'early' ? 'Too early' : state === 'slow' ? 'Tap to try again' : state === 'ok' ? 'Got it' : 'Wait for it'
  return (
    <div style={S.center}>
      <div style={S.mono}>Warm-up · {need === 3 ? 'three taps' : 'eight taps'} · {Math.min(trial + 1, CAL_TRIALS)} of {CAL_TRIALS}</div>
      <h2 style={S.h}>Tap exactly {need} times, as fast as you can, on “Go”</h2>
      <p style={S.p}>This sets the silences to your own speed. Space works too.</p>
      <div ref={padRef} style={{ ...S.pad, background: state === 'go' ? 'rgba(127,212,106,0.18)' : 'rgba(245,230,200,0.04)', borderColor: state === 'go' ? '#7fd46a' : 'rgba(245,230,200,0.25)' }}
        onClick={() => { if (state === 'slow') arm() }}>
        <div>
          <div style={{ ...S.h, fontSize: 36 }}>{label}</div>
          <div style={{ ...S.mono, marginTop: 8, color: C.muted }}>{state === 'go' ? `${count} / ${need}` : ' '}</div>
        </div>
      </div>
    </div>
  )
}

// ── the pause: invited, never scored ──────────────────────────────────────────
function Pause({ onContinue }) {
  const [visibleMs, setVisibleMs] = useState(0)
  useEffect(() => {
    let last = performance.now(), acc = 0, raf = 0
    const tick = () => {
      const now = performance.now()
      if (document.visibilityState === 'visible') acc += Math.min(250, now - last)   // only time spent looking counts
      last = now; setVisibleMs(acc); raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const s = visibleMs / 1000
  return (
    <div style={{ ...S.center, background: `radial-gradient(ellipse at 50% 70%, rgba(224,160,65,${s >= 60 ? 0.22 : 0}) 0%, rgba(13,9,5,0.88) 60%)`, transition: 'background 4s' }}>
      <p style={{ ...S.h, fontSize: 20, maxWidth: 440, color: C.text }}>
        Before you go - the owls were loud. But the silence between hoots: did you notice it had a shape? Some silences longer, some shorter. What did you listen to - the sound, or the quiet?
      </p>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', height: 120, opacity: s >= 30 ? 1 : 0, transition: 'opacity 3s' }} aria-hidden="true">
        {['owl_head_blink.webp', 'owl_head_neutral.webp', 'owl_head_blink.webp'].map((f, i) => (
          <img key={i} src={fileUrl[f]} alt="" style={{ height: 90 + (i === 1 ? 20 : 0), transform: `rotate(${(i - 1) * 8}deg)` }} />
        ))}
      </div>
      <button style={{ ...S.btn, opacity: s >= 5 ? 1 : 0, pointerEvents: s >= 5 ? 'auto' : 'none', transition: 'opacity 1.2s' }}
        onClick={() => onContinue(Math.round(visibleMs))}>Continue →</button>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function OwlBarn({ session, studyId = null }) {
  const userId = session?.user?.id ?? null
  const images = useImages()
  const [screen, setScreen] = useState('intro')        // intro | sound | calibrate | barn | pause | results
  const [modality, setModality] = useState('both')
  const [result, setResult] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const audioRef = useRef(null), engineRef = useRef(null), canvasRef = useRef(null), stageRef = useRef(null)
  const sessionIdRef = useRef(null), sessionPromise = useRef(null)
  const run = useRef({})                                // everything the dataset needs, filled as we go
  // one lock per run: the hook's lock stays held after a successful save, so a fixed key would
  // silently skip saving every "Play again"
  const [runKey, setRunKey] = useState(null)
  const { submit } = useSubmitLock(runKey)

  useEffect(() => () => { engineRef.current?.destroy(); audioRef.current?.close() }, [])

  function begin() {
    audioRef.current?.close()
    audioRef.current = createOwlAudio()                 // created on the Begin gesture (autoplay rules)
    run.current = { startedISO: new Date().toISOString(), windows: [], sound: {} }
    setRunKey(run.current.startedISO)
    sessionPromise.current = startSession(userId, studyId).then(id => (sessionIdRef.current = id))
    setResult(null); setShowDetail(false)
    setScreen(audioRef.current ? 'sound' : 'calibrate')
    if (!audioRef.current) setModality('visual')
  }

  function afterSound(r) {
    setModality(r.modality)
    run.current.sound = { modality: r.modality, soundcheck_rt_ms: r.soundcheck_rt_ms }
    setScreen('calibrate')
  }

  function afterCalibration(cal) {
    run.current.calibration = cal
    run.current.schedule = makeSchedule({ safeMs: cal.safeMs, riskyMs: cal.riskyMs })
    setScreen('barn')
  }

  // start the engine when the barn screen mounts
  useEffect(() => {
    if (screen !== 'barn' || !images || !canvasRef.current) return
    const schedule = run.current.schedule
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const engine = createOwlBarn(canvasRef.current, {
      scene: sceneData, images, schedule, audio: audioRef.current, modality, reduceMotion,
      onWindow: (w) => { run.current.windows.push(w) },
      onFinish: (f) => { finishRun(f) },
    })
    engineRef.current = engine
    run.current.layout = { viewport: [window.innerWidth, window.innerHeight], ...engine.layout(), orientation: window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait' }
    return () => { engine.destroy(); engineRef.current = null }
  }, [screen, images]) // eslint-disable-line react-hooks/exhaustive-deps

  useTaps((e, device) => {
    const d = run.current.devices || (run.current.devices = {})
    d[device] = (d[device] || 0) + 1
    engineRef.current?.tap(e)
  }, screen === 'barn', stageRef)

  async function finishRun(f) {
    const cal = run.current.calibration, schedule = run.current.schedule
    const theoretical = theoreticalMinimumMs(schedule)
    const ratio = f.crossed ? f.crossing_ms / theoretical : null
    const tier = f.crossed ? tierFor(ratio) : null
    const summary = { ...summariseWindows(run.current.windows), crossed: f.crossed, crossing_ms: f.crossing_ms, theoretical_ms: theoretical, ratio: ratio && +ratio.toFixed(3), tier: tier?.name ?? null, swoops: run.current.windows.filter(w => w.outcome === 'swooped' || w.outcome === 'wrong_count').length }
    const dataset = {
      version: DATASET_VERSION, game: 'safari_owl_barn', startedISO: run.current.startedISO,
      calibration: cal, schedule: { safeMs: schedule.safeMs, riskyMs: schedule.riskyMs, stepMs: schedule.stepMs },
      sound: { ...run.current.sound, audio: audioRef.current?.info() ?? null },
      input: { devices: run.current.devices || {} }, layout: run.current.layout,
      windows: run.current.windows, summary,
    }
    setResult({ ...summary, tierLine: tier?.line ?? null, dataset })
    setScreen('pause')
    // Saved now, before the pause - closing the tab during the pause loses nothing.
    await sessionPromise.current
    const sid = sessionIdRef.current
    if (!userId || !sid) return
    submit(async () => {
      const { error } = await supabase.from('safari_exhibit_sessions').insert({
        session_id: sid, user_id: userId, exhibit: 'owl_barn', study_id: studyId ?? null,
        raw_score: f.crossing_ms, tier: tier?.name ?? null, cue_modality: modality,
        dataset_version: DATASET_VERSION, dataset,
      })
      if (error) throw error
      await supabase.from('game_sessions').update({ ended_at: new Date().toISOString() }).eq('id', sid)
    }).catch(err => console.error('owl barn: save failed', err))
  }

  async function afterPause(visibleMs) {
    setScreen('results')
    const sid = sessionIdRef.current
    if (!userId || !sid) return
    const { error } = await supabase.from('safari_pause_events').insert({ session_id: sid, user_id: userId, exhibit: 'owl_barn', visible_ms: visibleMs })
    if (error) console.error('owl barn: pause save failed', error)
  }

  const fmt = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

  if (screen === 'intro') {
    return (
      <div style={{ ...S.shell, overflowY: 'auto', position: 'fixed' }}>
        <Link to="/safari" style={S.exit}>← Night Safari</Link>
        <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 16px 24px' }}>
          <GameIntro
            tone="dark"
            eyebrow="Night Safari · Exhibit 2"
            title="The Owl Barn."
            lead={<>It's dark in here. Is that a bale of hay? Why is everything so large?<br />You've been shrunk to owl-prey size. At least owls are loud.</>}
            steps={[
              { title: 'Move only in the silence', body: 'While the owls hoot, keep still. The moment the barn goes quiet, you can run.' },
              { title: '3 taps or 8', body: 'Three taps for the next hiding spot. Eight taps for two - if the silence is long enough.' },
              { title: 'Any other count, you’re caught', body: 'Tap during a hoot, or miscount, and an owl carries you back two spots.' },
            ]}
            note={<>Sound on, ideally with headphones. Two corridors, twenty hiding spots, a few minutes.</>}
            cta={images ? 'Enter the barn →' : 'The animals are getting ready…'}
            ctaDisabled={!images}
            onStart={begin}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={S.shell}>
      <Link to="/safari" style={S.exit}>← Night Safari</Link>
      {screen === 'sound' && <SoundCheck audio={audioRef.current} onDone={afterSound} />}
      {screen === 'calibrate' && <Calibration onDone={afterCalibration} />}
      {(screen === 'barn' || screen === 'pause') && (
        <div ref={stageRef} style={{ position: 'absolute', inset: 0, touchAction: 'none' }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
      )}
      {screen === 'pause' && <Pause onContinue={afterPause} />}
      {screen === 'results' && result && (
        <div style={{ ...S.center, overflowY: 'auto' }}>
          <div style={S.mono}>{result.crossed ? 'You crossed the barn' : 'The owls lost interest'}</div>
          <h2 style={{ ...S.h, fontSize: 36 }}>{result.crossed ? fmt(result.crossing_ms) : 'Still in the barn'}</h2>
          {result.tier && <div style={{ ...S.h, fontSize: 20, color: C.amber }}>{result.tier}</div>}
          {result.tierLine && <p style={{ ...S.p, fontStyle: 'italic' }}>“{result.tierLine}”</p>}
          <button style={{ ...S.ghost, fontSize: 12 }} onClick={() => setShowDetail(v => !v)} aria-expanded={showDetail}>{showDetail ? 'Hide the details' : 'Show the details'}</button>
          {showDetail && (
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 16px', fontSize: 14, color: C.muted, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              <dt>Times caught</dt><dd style={{ margin: 0, color: C.text }}>{result.swoops}</dd>
              <dt>Silences</dt><dd style={{ margin: 0, color: C.text }}>{result.windows}</dd>
              <dt>Long silences you used for 8</dt><dd style={{ margin: 0, color: C.text }}>{result.long_window_8tap_rate == null ? '-' : `${Math.round(result.long_window_8tap_rate * 100)}%`}</dd>
              <dt>Short silences you took 3 in</dt><dd style={{ margin: 0, color: C.text }}>{result.short_window_3tap_rate == null ? '-' : `${Math.round(result.short_window_3tap_rate * 100)}%`}</dd>
              <dt>Silences you waited out</dt><dd style={{ margin: 0, color: C.text }}>{result.no_input_rate == null ? '-' : `${Math.round(result.no_input_rate * 100)}%`}</dd>
            </dl>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button style={S.btn} onClick={() => setScreen('intro')}>Play again</button>
            <Link to="/safari" style={{ ...S.ghost, textDecoration: 'none' }}>Back to the safari</Link>
          </div>
        </div>
      )}
    </div>
  )
}
