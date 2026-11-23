import { useEffect, useMemo, useRef, useState } from 'react'
import RaPanel, { useRaShortcut, RA_STYLES as R } from './RaPanel'
import { createBreWriter } from './breLog'
import { loadBreMedia } from './breMedia'
import { baselineScript, mainScript, positionFor } from './breScript'
import { CLIP_PLAN, clipsFor, clipOrder } from './breClips'
import { ALL_ITEMS, PERCENT_STEPS, STRATEGY_CHECK, BREAK_CUE, strategyCheckCorrect } from './breItems'
import { MARKERS, CLIP_ONSET, sessionMarkerBus } from '../../../lib/physioMarkers'
import { createSubmitLock } from '../../../lib/useSubmitLock'
import { useScrollToTopOn } from '../../../lib/scrollToTop'

/**
 * The two coded tasks of Breath Attention and Emotional Recovery (plan WP-C1, C2):
 *   step 'bre_baseline'  rating practice, 180 s fixation, baseline upset, emotion check
 *   step 'bre_main'      training to the end of block 2, for the participant's version and condition
 * The timeline is data (breScript.js); this component plays it. Every operation writes events to
 * bre_events, every answer a row to bre_ratings (breLog.js), every marker through the session's marker
 * bus (physioMarkers.js). Nothing here waits on the network once the task has started.
 *
 * RA controls (Ctrl+Alt+R, then the RA PIN): pause / resume (freezes timers and media; 250 / 251),
 * skip to the final questions (the Distress Protocol's "skip the rest of the clips"; 252), stop (255).
 * A task already started once for this session row (a reload) does not silently start again: the RA
 * chooses to restart it or skip it, and either choice is logged.
 */
export default function BreTask({ step, enrollment, scheduleId, assignments, supabaseClient, onComplete, isSimMode = false }) {
  const db = supabaseClient
  const studyId = enrollment?.study_id
  const bus = sessionMarkerBus()
  const version = assignments?.version ?? null
  const condition = assignments?.condition ?? null
  const sequence = assignments?.sequence ?? null

  const built = useMemo(() => {
    try {
      if (step === 'bre_baseline') return { ops: baselineScript(), clips: [], audios: [] }
      const ops = mainScript({ version, condition, sequence })
      return { ops, clips: clipOrder(clipsFor({ version, sequence })), audios: [`bre_train_${condition}`, `bre_cue_${condition}`] }
    } catch (err) { return { error: String(err?.message ?? err) } }
  }, [step, version, condition, sequence])

  const writer = useMemo(() => createBreWriter({
    db, userId: enrollment?.profile_id, studyId, scheduleId, step, isTest: isSimMode,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  const [phase, setPhase] = useState('loading')   // loading | prior_run | running | saving | stopped | error
  const [errorMsg, setErrorMsg] = useState('')
  const [media, setMedia] = useState(null)
  const [opIndex, setOpIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [raOpen, setRaOpen] = useState(false)
  const [unsaved, setUnsaved] = useState(0)
  useRaShortcut(() => setRaOpen(true))
  useScrollToTopOn(opIndex)

  const ctxDetail = { clip_plan: CLIP_PLAN.id, clip_plan_provisional: CLIP_PLAN.provisional }
  function log(event, detail = {}, tMs) { writer.event(event, { tMs, detail: { ...detail } }) }
  async function mark(name, code, detail = {}) {
    const entry = await bus.send(code, name, detail)
    writer.event(name, { tMs: entry.requestedAt, marker: entry, detail })
    return entry
  }

  // ── start: refuse a bad assignment, check for an earlier run, load the media ──
  useEffect(() => {
    if (isSimMode) { onComplete({}); return }
    if (built.error) {
      setErrorMsg(`This task cannot start: ${built.error}.`); setPhase('error')
      log('task_error', { error: built.error, version, condition, sequence })
      return
    }
    let cancelled = false
    ;(async () => {
      const { data: prior, error } = await db.from('bre_events').select('t_wall')
        .eq('schedule_id', scheduleId).eq('step', step).eq('event', 'task_start').limit(1)
      if (cancelled) return
      if (error) { setErrorMsg('Could not check this session. Please let the research assistant know.'); setPhase('error'); return }
      try {
        const m = await loadBreMedia(db, { clips: built.clips, audios: built.audios })
        if (cancelled) return
        setMedia(m)
      } catch (err) {
        if (cancelled) return
        log('media_error', { error: String(err?.message ?? err) })
        setErrorMsg(`The clips or audio did not load (${err?.message ?? err}). Please let the research assistant know.`)
        setPhase('error'); return
      }
      if (prior?.length) { log('prior_run_found', { first_started: prior[0].t_wall }); setPhase('prior_run'); return }
      begin()
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function begin(detail = {}) {
    log('task_start', { ...ctxDetail, ...detail, version, condition, sequence, n_ops: built.ops.length,
      clips: built.clips, marker_device: bus.device, marker_connected: bus.connected })
    currentRef.current = 0
    setOpIndex(0); setPhase('running')
  }

  async function finish(event, detail = {}) {
    currentRef.current = -1
    setPhase('saving')
    log(event, detail)
    await writer.drain()
    if (writer.pending()) { setUnsaved(writer.pending()); return }
    onComplete({})
  }

  // Advance from operation i, once. A late or repeated onDone from an operation that is no longer
  // current (a media event after a skip, say) is ignored, so no screen is ever skipped by accident.
  const currentRef = useRef(0)
  function advanceFrom(i) {
    if (i !== currentRef.current) return
    currentRef.current = i + 1
    if (i + 1 >= built.ops.length) { finish('task_done'); return }
    setOpIndex(i + 1)
  }

  // ── RA actions ──
  async function raPause() { setPaused(true); await mark('ra_pause', MARKERS.ra_pause, { op: built.ops[opIndex]?.id }) }
  async function raResume() { setPaused(false); setRaOpen(false); await mark('ra_resume', MARKERS.ra_resume, { op: built.ops[opIndex]?.id }) }
  async function raSkip() {
    setRaOpen(false); setPaused(false)
    await mark('ra_skip', MARKERS.ra_skip, { op: built.ops[opIndex]?.id, reason: 'RA skip' })
    finish('task_skipped', { at_op: built.ops[opIndex]?.id ?? null })
  }
  async function raStop() {
    setRaOpen(false); setPaused(false)
    await mark('ra_stop', MARKERS.task_end, { op: built.ops[opIndex]?.id })
    log('task_stopped', { at_op: built.ops[opIndex]?.id ?? null })
    setPhase('stopped'); writer.drain()
  }

  const op = phase === 'running' ? built.ops?.[opIndex] : null
  const common = {
    op, paused, media, mark, log, condition, writer, onDone: () => advanceFrom(opIndex),
    ratingCtx: { version, condition, detail: ctxDetail, step },
  }

  return (
    <div style={S.page}>
      {phase === 'loading' && <p style={S.text}>Getting the next part ready…</p>}
      {phase === 'error' && <p style={S.text}>{errorMsg}</p>}
      {phase === 'prior_run' && <p style={S.text}>Please let the research assistant know.</p>}
      {phase === 'stopped' && <p style={S.text}>The session has been stopped. The research assistant will take it from here.</p>}
      {phase === 'saving' && <p style={S.text}>{unsaved ? 'Please let the research assistant know.' : 'One moment…'}</p>}

      {op?.kind === 'text'    && <TextOp key={op.id} {...common} />}
      {op?.kind === 'segment' && <SegmentOp key={op.id} {...common} />}
      {op?.kind === 'audio'   && <AudioOp key={op.id} {...common} />}
      {op?.kind === 'clip'    && <ClipOp key={op.id} {...common} />}
      {op?.kind === 'rating'  && <RatingOp key={op.id} {...common} />}
      {op?.kind === 'check'   && <CheckOp key={op.id} {...common} />}

      {paused && <div style={S.pause}><p style={{ ...S.text, color: '#fff' }}>Paused</p></div>}

      <RaPanel open={raOpen} onClose={() => setRaOpen(false)} studyId={studyId} db={db} title={step === 'bre_main' ? 'Clip task' : 'Baseline'}
        onUnlock={() => log('ra_unlock', { op: op?.id ?? phase })} onPinFailed={() => log('ra_pin_failed')}>
        <div style={S.panel}>
          <p style={R.note}>Study code <b>{enrollment?.study_code ?? '—'}</b> · version <b>{version ?? '—'}</b> · condition <b>{condition ?? '—'}</b>{sequence ? <> · sequence <b>{sequence}</b></> : null}</p>
          <p style={R.note}>Now: <b>{op?.id ?? phase}</b> ({opIndex + 1} of {built.ops?.length ?? 0}). Markers: {bus.connected ? bus.device : 'not connected'}. Unsaved records: {writer.pending()}.</p>
          {CLIP_PLAN.provisional && step === 'bre_main' && <p style={R.bad}>PROVISIONAL CLIP PLAN ({CLIP_PLAN.id}): dry runs only.</p>}
          {phase === 'prior_run' && (
            <div style={R.row}>
              <span style={R.note}>This task was started before for this session.</span>
              <button style={R.button} onClick={() => { setRaOpen(false); log('ra_restart'); begin({ restarted: true }) }}>Restart from the beginning</button>
              <button style={R.button} onClick={raSkip}>Skip this task</button>
            </div>
          )}
          {phase === 'running' && (
            <div style={R.row}>
              {paused ? <button style={R.primary} onClick={raResume}>Resume</button> : <button style={R.button} onClick={raPause}>Pause</button>}
              <button style={R.button} onClick={raSkip}>{step === 'bre_main' ? 'Skip to final questions' : 'Skip this task'}</button>
              <button style={R.button} onClick={raStop}>Stop session</button>
            </div>
          )}
          {phase === 'saving' && unsaved > 0 && (
            <div style={R.row}>
              <span style={R.bad}>{unsaved} record(s) have not saved. Check the connection, keep this window open.</span>
              <button style={R.button} onClick={async () => { await writer.drain(); setUnsaved(writer.pending()); if (!writer.pending()) onComplete({}) }}>Retry saving</button>
            </div>
          )}
          {phase === 'error' && <p style={R.bad}>{errorMsg}</p>}
        </div>
      </RaPanel>
    </div>
  )
}

// ── a pausable timer: fires once after `ms` of unpaused time ─────────────────
function usePausableTimer(ms, paused, onDone) {
  const elapsed = useRef(0)
  const startedAt = useRef(null)
  const fired = useRef(false)
  const cb = useRef(onDone)
  useEffect(() => { cb.current = onDone })
  useEffect(() => {
    if (fired.current || ms == null) return
    if (paused) return
    startedAt.current = performance.now()
    const t = setTimeout(() => {
      fired.current = true
      cb.current(elapsed.current + performance.now() - startedAt.current)
    }, Math.max(0, ms - elapsed.current))
    return () => {
      clearTimeout(t)
      if (!fired.current) elapsed.current += performance.now() - startedAt.current
    }
  }, [paused, ms])
}

function Cross() { return <div style={S.cross} aria-hidden="true">+</div> }

function TextOp({ op, onDone, log }) {
  const lock = useRef(createSubmitLock())
  useEffect(() => { log('screen_on', { op: op.id }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={S.col}>
      <p style={S.text}>{op.text}</p>
      <button style={S.btn} onClick={() => lock.current.run(async () => { log('screen_off', { op: op.id }); onDone() })}>Continue</button>
    </div>
  )
}

function useMediaPause(el, paused) {
  useEffect(() => {
    if (!el) return
    if (paused) el.pause()
    else if (el.dataset.started === '1' && !el.ended) el.play().catch(() => {})
  }, [el, paused])
}

function SegmentOp({ op, paused, media, mark, condition, onDone }) {
  const cueEl = op.cue ? media?.audios?.[`bre_cue_${condition}`] : null
  const [cueVisible, setCueVisible] = useState(!!op.cue)
  const plannedAt = useRef(performance.now())

  useEffect(() => {
    const detail = { op: op.id, block: op.block ?? null, segment: op.segment ?? null, planned_ms: op.ms }
    mark(`${op.id}_on`, op.markerOn, detail)
    if (cueEl) {
      cueEl.currentTime = 0; cueEl.dataset.started = '1'
      const hide = () => setTimeout(() => setCueVisible(false), 1000)
      cueEl.addEventListener('ended', hide, { once: true })
      cueEl.play().then(() => mark('cue_on', MARKERS.cue_on, { op: op.id })).catch(() => mark('cue_on', MARKERS.cue_on, { op: op.id, audio_failed: true }))
      return () => { cueEl.removeEventListener('ended', hide); cueEl.pause() }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useMediaPause(cueEl, paused)

  usePausableTimer(op.ms, paused, (activeMs) => {
    mark(`${op.id}_off`, op.markerOff, { op: op.id, planned_ms: op.ms, active_ms: Math.round(activeMs), wall_ms: Math.round(performance.now() - plannedAt.current) })
    onDone()
  })

  return (
    <div style={S.col}>
      {op.header && <p style={S.text}>{op.header}</p>}
      <p style={{ ...S.cue, visibility: op.cue && cueVisible ? 'visible' : 'hidden' }}>{BREAK_CUE[condition] ?? ''}</p>
      <Cross />
    </div>
  )
}

function playThrough(el, { onStart, onEnd, onError }) {
  el.currentTime = 0
  el.dataset.started = '1'
  const started = () => onStart()
  const ended = () => onEnd()
  const waiting = () => onError?.('waiting')
  el.addEventListener('playing', started, { once: true })
  el.addEventListener('ended', ended, { once: true })
  el.addEventListener('waiting', waiting)
  const p = el.play()
  return {
    promise: p,
    cleanup() {
      el.removeEventListener('playing', started); el.removeEventListener('ended', ended); el.removeEventListener('waiting', waiting)
      el.pause(); el.dataset.started = '0'
    },
  }
}

function AudioOp({ op, paused, media, mark, log, onDone }) {
  const el = media?.audios?.[op.audio]
  const [blocked, setBlocked] = useState(false)
  const start = () => {
    const run = playThrough(el, {
      onStart: () => mark(`${op.id}_on`, op.markerOn, { op: op.id, audio: op.audio }),
      onEnd: () => { mark(`${op.id}_off`, op.markerOff, { op: op.id }); onDone() },
    })
    run.promise.then(() => setBlocked(false)).catch(err => { setBlocked(true); log('media_blocked', { op: op.id, error: String(err?.message ?? err) }) })
    return run.cleanup
  }
  const cleanupRef = useRef(null)
  useEffect(() => { cleanupRef.current = start(); return () => cleanupRef.current?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useMediaPause(el, paused)
  return (
    <div style={S.col}>
      <Cross />
      {blocked && <button style={S.btn} onClick={() => { cleanupRef.current?.(); cleanupRef.current = start() }}>Play</button>}
    </div>
  )
}

function ClipOp({ op, paused, media, mark, log, onDone }) {
  const el = media?.videos?.[op.clip]
  const box = useRef(null)
  const [blocked, setBlocked] = useState(false)
  const runRef = useRef(null)
  const start = () => {
    runRef.current?.cleanup()
    const run = playThrough(el, {
      onStart: () => mark('clip_on', CLIP_ONSET[op.clip], { op: op.id, clip: op.clip, block: op.block, emotion: op.emotion }),
      onEnd: () => { mark('clip_off', MARKERS.clip_off, { op: op.id, clip: op.clip }); onDone() },
      onError: (what) => log('clip_stall', { op: op.id, clip: op.clip, what, t: el.currentTime }),
    })
    run.promise.then(() => setBlocked(false)).catch(err => { setBlocked(true); log('media_blocked', { op: op.id, error: String(err?.message ?? err) }) })
    runRef.current = run
  }
  useEffect(() => {
    box.current?.appendChild(el)
    start()
    return () => { runRef.current?.cleanup(); el.remove() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useMediaPause(el, paused)
  return (
    <div style={S.clipWrap}>
      <div ref={box} style={S.clipBox} />
      {blocked && <button style={{ ...S.btn, marginTop: 16 }} onClick={start}>Play</button>}
    </div>
  )
}

function Scale({ item, value, onPick }) {
  const steps = item.percent ? PERCENT_STEPS : [1, 2, 3, 4, 5, 6, 7]
  return (
    <div style={S.item}>
      <p style={S.itemText}>{item.text}</p>
      <div style={S.scale} role="radiogroup" aria-label={item.text}>
        {steps.map(v => (
          <button key={v} role="radio" aria-checked={value === v} onClick={() => onPick(v)}
            style={{ ...S.opt, ...(item.percent ? S.optPct : null), ...(value === v ? S.optOn : null) }}>
            {item.percent ? `${v}%` : v}
          </button>
        ))}
      </div>
      {!item.percent && (
        <div style={S.anchors}>
          <span>{item.low}</span>{item.mid ? <span>{item.mid}</span> : null}<span style={{ textAlign: 'right' }}>{item.high}</span>
        </div>
      )}
    </div>
  )
}

function RatingOp({ op, paused, mark, writer, onDone, ratingCtx }) {
  const items = op.items.map(id => ALL_ITEMS[id])
  const [onset] = useState(() => performance.now())
  const [ids] = useState(() => Object.fromEntries(op.items.map(i => [i, crypto.randomUUID()])))
  const [answers, setAnswers] = useState({})
  const answeredAt = useRef({})
  const pausedMs = useRef(0)
  const pauseStart = useRef(null)
  const lock = useRef(createSubmitLock())

  useEffect(() => { mark('rating_shown', MARKERS.rating_shown, { op: op.id, items: op.items }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (paused) pauseStart.current = performance.now()
    else if (pauseStart.current != null) { pausedMs.current += performance.now() - pauseStart.current; pauseStart.current = null }
  }, [paused])

  function submit(final) {
    lock.current.run(async () => {
      mark('rating_answered', MARKERS.rating_answered, { op: op.id })
      for (const itemId of op.items) {
        writer.rating({
          id: ids[itemId], item_id: itemId, position: positionFor(itemId, op.where), value: final[itemId],
          is_practice: !!op.practice, onset_ms: onset, rt_ms: Math.max(0, answeredAt.current[itemId] - onset - pausedMs.current),
          version: ratingCtx.version, condition: ratingCtx.condition, block: op.block ?? null,
          block_emotion: op.emotion ?? null, clip_ids: op.clipIds ?? null,
          detail: { ...ratingCtx.detail, op: op.id, paused_ms: Math.round(pausedMs.current) },
        })
      }
      onDone()
    })
  }

  function pick(itemId, v) {
    if (paused) return
    answeredAt.current[itemId] = performance.now()
    const nextAnswers = { ...answers, [itemId]: v }
    setAnswers(nextAnswers)
    if (op.items.length === 1) submit(nextAnswers)
  }

  const complete = op.items.every(i => answers[i] != null)
  return (
    <div style={S.ratingCol}>
      {op.intro && <p style={S.text}>{op.intro}</p>}
      {op.stem && <p style={S.stem}>{op.stem}</p>}
      {items.map(item => <Scale key={item.id} item={item} value={answers[item.id]} onPick={v => pick(item.id, v)} />)}
      {op.items.length > 1 && (
        <button style={{ ...S.btn, opacity: complete ? 1 : 0.5 }} disabled={!complete || paused} onClick={() => submit(answers)}>Continue</button>
      )}
    </div>
  )
}

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

function CheckOp({ op, paused, media, mark, log, onDone }) {
  const [attempt, setAttempt] = useState(1)
  const [replaying, setReplaying] = useState(false)
  const order = useMemo(() => shuffled(STRATEGY_CHECK.options.map(o => o.key)), [attempt])
  const [onset, setOnset] = useState(() => performance.now())
  const lock = useRef(createSubmitLock())
  useEffect(() => { lock.current.rekey(`${attempt}:${replaying}`) }, [attempt, replaying])

  function answer(key) {
    lock.current.run(async () => {
      const correct = strategyCheckCorrect(op.condition, key)
      log('strategy_check', { attempt, order, answer: key, correct, rt_ms: Math.round(performance.now() - onset) })
      if (correct) { onDone(); return }
      if (attempt === 1) { setReplaying(true); return }
      log('check_failed_twice', { order, answer: key })
      onDone()
    })
  }

  if (replaying) {
    return <AudioOp op={{ id: 'training_replay', audio: op.audio, markerOn: MARKERS.training_replay_on, markerOff: MARKERS.training_replay_off }}
      paused={paused} media={media} mark={mark} log={log}
      onDone={() => { setReplaying(false); setAttempt(2); setOnset(performance.now()) }} />
  }
  return (
    <div style={S.ratingCol}>
      <p style={S.itemText}>{STRATEGY_CHECK.text}</p>
      {order.map(key => (
        <button key={key} style={S.choice} disabled={paused} onClick={() => answer(key)}>
          {STRATEGY_CHECK.options.find(o => o.key === key).text}
        </button>
      ))}
    </div>
  )
}

const FONT = '"DM Sans",system-ui,sans-serif'
const S = {
  page:     { minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative', fontFamily: FONT },
  col:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxWidth: 720 },
  ratingCol:{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 24, width: '100%', maxWidth: 720 },
  text:     { fontSize: 20, lineHeight: 1.6, color: 'var(--tx)', textAlign: 'center', margin: 0, maxWidth: 720 },
  stem:     { fontSize: 20, fontWeight: 600, color: 'var(--tx)', margin: 0 },
  cue:      { fontSize: 20, lineHeight: 1.6, color: 'var(--tx2)', textAlign: 'center', margin: 0, minHeight: 64, maxWidth: 720 },
  cross:    { fontSize: 36, lineHeight: 1, color: 'var(--tx)', fontWeight: 300, userSelect: 'none' },
  btn:      { alignSelf: 'center', padding: '8px 32px', borderRadius: 24, border: '1px solid var(--pk)', background: 'var(--pk)', color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' },
  item:     { display: 'flex', flexDirection: 'column', gap: 8 },
  itemText: { fontSize: 20, lineHeight: 1.5, color: 'var(--tx)', margin: 0 },
  scale:    { display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' },
  opt:      { flex: '1 1 0', minWidth: 48, height: 48, borderRadius: 24, border: '1px solid var(--bd)', background: '#fff', color: 'var(--tx)', fontSize: 16, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' },
  optPct:   { minWidth: 56, fontSize: 14 },
  optOn:    { background: 'var(--pk)', borderColor: 'var(--pk)', color: '#fff' },
  anchors:  { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--tx2)' },
  choice:   { textAlign: 'left', padding: '16px 24px', borderRadius: 24, border: '1px solid var(--bd)', background: '#fff', color: 'var(--tx)', fontSize: 16, lineHeight: 1.5, fontFamily: FONT, cursor: 'pointer' },
  clipWrap: { width: '100%', maxWidth: 1280, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  clipBox:  { width: '100%', aspectRatio: '16 / 9', background: '#000' },
  pause:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 },
  panel:    { display: 'flex', flexDirection: 'column', gap: 16 },
}
